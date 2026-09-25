import { createHmac, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { createApp } from "../src/app.js";
import { migrate } from "../src/database/migrate.js";
import type { Env } from "../src/config/env.js";
import { NotificationService } from "../src/notifications/notification-service.js";
import { SmsProviderError, type MessagingProvider } from "../src/notifications/contracts.js";
import { smsKeyword, toE164 } from "../src/notifications/sms-keywords.js";

// Prompt AM: a customer who texts STOP to a restaurant's number never gets another SMS from it,
// whatever the message type, until they text START themselves. Real migrations on pg-mem; only
// the Twilio send is faked.
const secret = "test-secret-that-is-long-enough-for-security";
const baseEnv = {
  APP_ENV: "test", PORT: 3000, DATABASE_URL: "postgres://test", APP_URL: "http://localhost:5173", API_URL: "http://localhost:3000",
  JWT_SECRET: secret, LOG_LEVEL: "silent", CORS_ORIGINS: "http://localhost:5173", TELEPHONY_MODE: "test",
  VOICE_STREAM_PATH: "/api/v1/telephony/twilio/media", SMS_OPT_OUT_REPLIES: "twilio",
} as unknown as Env;
const RESTAURANT_NUMBER = "+15550001111";
const CUSTOMER = "+15551234567";
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map((close) => close())); });

async function setup(env: Env = baseEnv) {
  const memory = newDb({ noAstCoverageCheck: true });
  memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
  const db = new (memory.adapters.createPg().Pool)();
  await migrate(db as never, undefined, (name) => ["001_initial.sql", "010_auth_sessions.sql", "018_sso_assertions.sql"].includes(name));
  // pg-mem cannot run 003_voice.sql; create the phone-number table as 003 defines it (see phone-provisioning.test.ts).
  await db.query(`CREATE TABLE restaurant_phone_numbers (id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'AI', active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(phone_number))`);
  await migrate(db as never, undefined, (name) => ["006_notifications.sql", "007_sms_preferences.sql", "023_sms_opt_out.sql"].includes(name));
  // 015 (plpgsql) is beyond pg-mem; add the one piece of it the send path relies on.
  await db.query("CREATE UNIQUE INDEX messages_notification_id_key ON messages(notification_id)");
  const app = createApp(env, db as never);
  await app.ready();
  closers.push(async () => { await app.close(); await db.end(); });

  const owner = (await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "owner@harbor.test", password: "SecurePassword123!" } })).json() as { token: string };
  const created = await app.inject({ method: "POST", url: "/api/v1/restaurants", headers: { authorization: `Bearer ${owner.token}` }, payload: { name: "Harbor Grill", slug: "harbor-grill" } });
  const restaurantId = created.json().restaurant.id as string;
  await db.query("INSERT INTO restaurant_phone_numbers(id,restaurant_id,phone_number) VALUES($1,$2,$3)", [randomUUID(), restaurantId, RESTAURANT_NUMBER]);

  const sent: { to: string; body: string }[] = [];
  let failWith: Error | undefined;
  const provider: MessagingProvider = {
    sendMessage: async (input) => {
      if (failWith) throw failWith;
      sent.push(input);
      return { providerMessageId: `SM${sent.length}`, providerStatus: "queued" };
    },
  };
  const notifications = new NotificationService(db as never, provider);
  // Every SMS type goes through the same outbox → NotificationService path; queue one of each kind.
  const queue = async (eventType: string, phone = "(555) 123-4567") => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO outbox_events(id,restaurant_id,event_type,aggregate_type,aggregate_id,payload) VALUES($1,$2,$3,'ORDER',$4,$5)",
      [id, restaurantId, eventType, randomUUID(), JSON.stringify({ phone, from: RESTAURANT_NUMBER, orderNumber: "A1", confirmationCode: "C1" })],
    );
    return notifications.process(id);
  };
  const text = (body: string, extra: Record<string, string> = {}, headers: Record<string, string> = {}) =>
    app.inject({
      method: "POST",
      url: "/api/v1/telephony/twilio/sms",
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      payload: new URLSearchParams({ From: CUSTOMER, To: RESTAURANT_NUMBER, Body: body, MessageSid: "SMin", ...extra }).toString(),
    });
  const preference = async () =>
    (await db.query("SELECT phone,consent,consent_source,opted_out_at FROM customer_sms_preferences WHERE restaurant_id=$1", [restaurantId])).rows;
  return { app, db, owner, restaurantId, sent, queue, text, preference, failWith: (e?: Error) => { failWith = e; } };
}

describe("SMS keywords", () => {
  it("treats only a whole-message keyword as STOP/START/HELP, in English and Spanish", () => {
    expect(smsKeyword("STOP")).toBe("STOP");
    expect(smsKeyword("  stop. ")).toBe("STOP");
    expect(smsKeyword("Unsubscribe")).toBe("STOP");
    expect(smsKeyword("opt out")).toBe("STOP");
    expect(smsKeyword("Parar")).toBe("STOP");
    expect(smsKeyword("start")).toBe("START");
    expect(smsKeyword("UNSTOP")).toBe("START");
    expect(smsKeyword("help")).toBe("HELP");
    expect(smsKeyword("Ayuda")).toBe("HELP");
    expect(smsKeyword("stop by at 7 tonight")).toBeNull();
    expect(smsKeyword("can I cancel my order?")).toBeNull();
    // Twilio Advanced Opt-Out classifies custom keywords itself and says so in OptOutType.
    expect(smsKeyword("please no more", "STOP")).toBe("STOP");
  });
  it("normalises US numbers to E.164", () => {
    expect(toE164("(555) 123-4567")).toBe(CUSTOMER);
    expect(toE164("1-555-123-4567")).toBe(CUSTOMER);
    expect(toE164(CUSTOMER)).toBe(CUSTOMER);
  });
});

describe("TCPA opt-out", () => {
  it("never sends another SMS of any type after STOP, until the customer texts START", async () => {
    const x = await setup();
    await x.queue("ORDER_CREATED");
    expect(x.sent).toHaveLength(1);

    const stop = await x.text("Stop");
    expect(stop.statusCode).toBe(200);
    // Twilio's default handling already replied; we must not double-text.
    expect(stop.body).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(await x.preference()).toMatchObject([{ phone: CUSTOMER, consent: false, consent_source: "sms_keyword" }]);

    for (const type of ["ORDER_CREATED", "ORDER_MODIFIED", "ORDER_CANCELLED", "RESERVATION_CREATED", "RESERVATION_MODIFIED", "RESERVATION_CANCELLED"])
      expect(await x.queue(type)).toMatchObject({ status: "SUPPRESSED" });
    // The same person written differently in an order is still the same person.
    expect(await x.queue("ORDER_CREATED", "+1 555 123 4567")).toMatchObject({ status: "SUPPRESSED" });
    expect(x.sent).toHaveLength(1);

    // HELP changes nothing.
    await x.text("HELP");
    expect(await x.preference()).toMatchObject([{ consent: false }]);
    expect(await x.queue("ORDER_CREATED")).toMatchObject({ status: "SUPPRESSED" });

    // The owner cannot re-subscribe them from the dashboard.
    const resubscribe = await x.app.inject({
      method: "PUT",
      url: `/api/v1/restaurants/${x.restaurantId}/notifications/preferences`,
      headers: { authorization: `Bearer ${x.owner.token}` },
      payload: { phone: CUSTOMER, consent: true },
    });
    expect(resubscribe.statusCode).toBe(409);
    expect(x.sent).toHaveLength(1);

    await x.text("START");
    expect(await x.preference()).toMatchObject([{ consent: true, consent_source: "sms_keyword", opted_out_at: null }]);
    await x.queue("ORDER_CREATED");
    expect(x.sent).toHaveLength(2);
  });

  it("records the opt-out and stops retrying when Twilio refuses with 21610", async () => {
    const x = await setup();
    x.failWith(new SmsProviderError("Attempt to send to unsubscribed recipient", "21610"));
    expect(await x.queue("ORDER_CREATED")).toMatchObject({ status: "SUPPRESSED" });
    expect(await x.preference()).toMatchObject([{ phone: CUSTOMER, consent: false, consent_source: "carrier" }]);
    const outbox = (await x.db.query("SELECT status FROM outbox_events")).rows;
    expect(outbox).toEqual([{ status: "PROCESSED" }]);
    x.failWith(undefined);
    expect(await x.queue("ORDER_CREATED")).toMatchObject({ status: "SUPPRESSED" });
    expect(x.sent).toHaveLength(0);
  });

  it("still retries ordinary provider failures", async () => {
    const x = await setup();
    x.failWith(new SmsProviderError("Service unavailable", "20503"));
    await expect(x.queue("ORDER_CREATED")).rejects.toThrow("Service unavailable");
    expect(await x.preference()).toEqual([]);
  });

  it("replies itself only when SMS_OPT_OUT_REPLIES=app", async () => {
    const x = await setup({ ...baseEnv, SMS_OPT_OUT_REPLIES: "app" } as Env);
    expect((await x.text("STOP")).body).toContain("<Message>You're unsubscribed from Harbor Grill texts");
    expect((await x.text("HELP")).body).toContain("Reply STOP to opt out");
    expect((await x.text("see you at 7")).body).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  it("ignores texts to unknown numbers and rejects unsigned webhooks", async () => {
    const x = await setup();
    const unknown = await x.text("STOP", { To: "+15559999999" });
    expect(unknown.statusCode).toBe(200);
    expect(await x.preference()).toEqual([]);

    const signed = await setup({ ...baseEnv, TELEPHONY_MODE: "twilio", TWILIO_VALIDATE_SIGNATURES: true, TWILIO_AUTH_TOKEN: "tok", VOICE_PUBLIC_URL: "https://api.example.test" } as Env);
    const forged = await signed.text("START", {}, { "x-twilio-signature": "bogus" });
    expect(forged.statusCode).toBe(403);
    const params = { From: CUSTOMER, To: RESTAURANT_NUMBER, Body: "STOP", MessageSid: "SMin" };
    const payload = "https://api.example.test/api/v1/telephony/twilio/sms" + Object.keys(params).sort().map((k) => k + params[k as keyof typeof params]).join("");
    const signature = createHmac("sha1", "tok").update(payload).digest("base64");
    const genuine = await signed.text("STOP", {}, { "x-twilio-signature": signature });
    expect(genuine.statusCode).toBe(200);
    expect(await signed.preference()).toMatchObject([{ consent: false }]);
  });
});
