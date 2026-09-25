import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { Env } from "../config/env.js";
import type { Db } from "../database/db.js";
import { AppError } from "../domain/errors.js";
import { redactPii } from "../observability.js";

export interface PurchasedNumber { phoneNumber: string; sid: string }
export interface NumberPurchaser { purchase(input: { areaCode?: string; friendlyName: string }): Promise<PurchasedNumber> }
export type PhoneAssignment =
  | { status: "active"; id: string; phoneNumber: string }
  | { status: "pending_manual"; id: string; phoneNumber: null; failureReason: string };
export interface PendingNumber { id: string; restaurantId: string; restaurantName: string; externalRef: string | null; failureReason: string | null; createdAt: string }

const TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts/";
const e164Us = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
const areaCodeOf = (phone?: string | null) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10 && /^[2-9]/.test(national) ? national.slice(0, 3) : undefined;
};

// Twilio "Available Phone Numbers" + "Incoming Phone Numbers" APIs: find a voice+SMS capable US
// local number (preferring the restaurant's own area code), buy it, and point its voice webhooks
// and SMS webhooks at this API so calls route straight into the receptionist and STOP texts are honoured.
export class TwilioNumberPurchaser implements NumberPurchaser {
  private readonly auth: string;
  constructor(private readonly accountSid: string, authToken: string, private readonly publicUrl: string) {
    this.auth = "Basic " + Buffer.from(accountSid + ":" + authToken).toString("base64");
  }
  private async twilio<T>(path: string, init?: { method: "POST"; body: URLSearchParams }): Promise<T> {
    const response = await fetch(TWILIO_API + this.accountSid + path, {
      method: init?.method ?? "GET",
      headers: { Authorization: this.auth, ...(init ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: init?.body,
    });
    const data = (await response.json().catch(() => ({}))) as T & { message?: string; code?: number };
    if (!response.ok) throw new Error(`Twilio ${response.status}${data.code ? ` (${data.code})` : ""}: ${data.message ?? "request failed"}`);
    return data;
  }
  private async search(areaCode?: string) {
    const query = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "true", PageSize: "1" });
    if (areaCode) query.set("AreaCode", areaCode);
    const data = await this.twilio<{ available_phone_numbers?: { phone_number: string }[] }>(`/AvailablePhoneNumbers/US/Local.json?${query}`);
    return data.available_phone_numbers?.[0]?.phone_number;
  }
  async purchase(input: { areaCode?: string; friendlyName: string }): Promise<PurchasedNumber> {
    const candidate = (input.areaCode ? await this.search(input.areaCode) : undefined) ?? (await this.search());
    if (!candidate) throw new Error("No US local numbers available");
    const bought = await this.twilio<{ sid?: string; phone_number?: string }>("/IncomingPhoneNumbers.json", {
      method: "POST",
      body: new URLSearchParams({
        PhoneNumber: candidate,
        FriendlyName: input.friendlyName.slice(0, 64),
        VoiceUrl: new URL("/api/v1/telephony/twilio/incoming", this.publicUrl).toString(),
        VoiceMethod: "POST",
        StatusCallback: new URL("/api/v1/telephony/twilio/status", this.publicUrl).toString(),
        StatusCallbackMethod: "POST",
        // Inbound texts (STOP/START/HELP) → customer_sms_preferences; see notifications/sms-inbound-routes.ts.
        SmsUrl: new URL("/api/v1/telephony/twilio/sms", this.publicUrl).toString(),
        SmsMethod: "POST",
      }),
    });
    if (!bought.sid || !bought.phone_number) throw new Error("Twilio did not return the purchased number");
    return { phoneNumber: bought.phone_number, sid: bought.sid };
  }
}

// Buying numbers costs money, so it only happens with live telephony; in test mode (and with
// missing credentials) every restaurant goes to the manual queue instead.
export function createNumberPurchaser(env: Env): NumberPurchaser | null {
  if (env.TELEPHONY_MODE !== "twilio" || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  return new TwilioNumberPurchaser(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.VOICE_PUBLIC_URL ?? env.API_URL);
}

export class PhoneProvisioningService {
  constructor(private readonly db: Db, private readonly purchaser: NumberPurchaser | null, private readonly log: FastifyBaseLogger) {}

  async current(restaurantId: string): Promise<PhoneAssignment | undefined> {
    const row = (await this.db.query<{ id: string; phone_number: string | null; status: string; failure_reason: string | null }>(
      "SELECT id,phone_number,status,failure_reason FROM restaurant_phone_numbers WHERE restaurant_id=$1 ORDER BY (status='active') DESC, created_at ASC LIMIT 1",
      [restaurantId],
    )).rows[0];
    if (!row) return undefined;
    return row.status === "active" && row.phone_number
      ? { status: "active", id: row.id, phoneNumber: row.phone_number }
      : { status: "pending_manual", id: row.id, phoneNumber: null, failureReason: row.failure_reason ?? "" };
  }

  // Never throws: a failed purchase must not block restaurant creation. The worst case is a
  // pending_manual row an admin completes by hand (assignManually).
  async ensureNumber(restaurant: { id: string; name: string }, contactPhone?: string | null): Promise<PhoneAssignment | undefined> {
    try {
      const existing = await this.current(restaurant.id);
      if (existing) return existing;
      return await this.attempt(restaurant, contactPhone);
    } catch (error) {
      this.log.error({ error, restaurantId: restaurant.id }, "phone number provisioning bookkeeping failed");
      return undefined;
    }
  }

  async retry(numberId: string): Promise<PhoneAssignment> {
    const row = await this.pendingRow(numberId);
    return this.attempt({ id: row.restaurant_id, name: row.name }, null, numberId);
  }

  async assignManually(numberId: string, phoneNumber: string): Promise<PhoneAssignment> {
    if (!e164Us.test(phoneNumber)) throw new AppError("VALIDATION_ERROR", "Phone number must be a US number in E.164 format (+1XXXXXXXXXX)", 400);
    await this.pendingRow(numberId);
    await this.activate(numberId, phoneNumber, null);
    return { status: "active", id: numberId, phoneNumber };
  }

  async pending(): Promise<PendingNumber[]> {
    return (await this.db.query<PendingNumber>(
      `SELECT p.id,p.restaurant_id "restaurantId",r.name "restaurantName",r.external_ref "externalRef",p.failure_reason "failureReason",p.created_at "createdAt"
       FROM restaurant_phone_numbers p JOIN restaurants r ON r.id=p.restaurant_id WHERE p.status='pending_manual' ORDER BY p.created_at ASC`,
    )).rows;
  }

  private async pendingRow(numberId: string) {
    const row = (await this.db.query<{ restaurant_id: string; name: string }>(
      "SELECT p.restaurant_id,r.name FROM restaurant_phone_numbers p JOIN restaurants r ON r.id=p.restaurant_id WHERE p.id=$1 AND p.status='pending_manual'",
      [numberId],
    )).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Pending phone number not found", 404);
    return row;
  }

  private async activate(numberId: string, phoneNumber: string, sid: string | null) {
    await this.db.query(
      "UPDATE restaurant_phone_numbers SET phone_number=$2,provider_sid=$3,status='active',active=TRUE,failure_reason=NULL,updated_at=NOW() WHERE id=$1",
      [numberId, phoneNumber, sid],
    );
  }

  private async attempt(restaurant: { id: string; name: string }, contactPhone: string | null | undefined, pendingId?: string): Promise<PhoneAssignment> {
    let purchased: PurchasedNumber | undefined;
    let failureReason: string;
    if (!this.purchaser) failureReason = "Automatic number purchase is disabled (TELEPHONY_MODE is not twilio or Twilio credentials are missing)";
    else {
      try {
        purchased = await this.purchaser.purchase({ areaCode: areaCodeOf(contactPhone), friendlyName: `Tideline - ${restaurant.name}` });
        const id = pendingId ?? randomUUID();
        if (pendingId) await this.activate(pendingId, purchased.phoneNumber, purchased.sid);
        else await this.db.query(
          "INSERT INTO restaurant_phone_numbers(id,restaurant_id,phone_number,type,active,status,provider_sid) VALUES($1,$2,$3,'AI',TRUE,'active',$4)",
          [id, restaurant.id, purchased.phoneNumber, purchased.sid],
        );
        this.log.info({ restaurantId: restaurant.id, sid: purchased.sid }, "twilio number provisioned");
        return { status: "active", id, phoneNumber: purchased.phoneNumber };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // A number bought but not recorded is still ours on Twilio; keep its SID in the reason so
        // an admin can attach it instead of buying a second one.
        failureReason = purchased ? `Purchased ${purchased.phoneNumber} (${purchased.sid}) but could not save it: ${message}` : message;
        this.log.warn({ restaurantId: restaurant.id, error: redactPii(message) }, "twilio number provisioning failed; queued for manual assignment");
      }
    }
    failureReason = failureReason.slice(0, 500);
    if (pendingId) {
      await this.db.query("UPDATE restaurant_phone_numbers SET failure_reason=$2,updated_at=NOW() WHERE id=$1", [pendingId, failureReason]);
      return { status: "pending_manual", id: pendingId, phoneNumber: null, failureReason };
    }
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO restaurant_phone_numbers(id,restaurant_id,phone_number,type,active,status,failure_reason) VALUES($1,$2,NULL,'AI',FALSE,'pending_manual',$3)",
      [id, restaurant.id, failureReason],
    );
    return { status: "pending_manual", id, phoneNumber: null, failureReason };
  }
}
