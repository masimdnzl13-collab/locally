import { afterEach, describe, expect, it, vi } from "vitest";
import { newDb } from "pg-mem";
import { SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { migrate } from "../src/database/migrate.js";
import type { Env } from "../src/config/env.js";
import { TwilioNumberPurchaser, type NumberPurchaser } from "../src/services/phone-provisioning-service.js";

const secret = "test-secret-that-is-long-enough-for-security";
const env = {
  APP_ENV: "test", PORT: 3000, DATABASE_URL: "postgres://test", APP_URL: "http://localhost:5173", API_URL: "http://localhost:3000",
  JWT_SECRET: secret, LOG_LEVEL: "silent", CORS_ORIGINS: "http://localhost:5173", TELEPHONY_MODE: "test",
  VOICE_STREAM_PATH: "/api/v1/telephony/twilio/media",
} as unknown as Env;
const migrations = new Set(["001_initial.sql", "010_auth_sessions.sql", "018_sso_assertions.sql", "019_phone_provisioning.sql"]);
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map((close) => close())); vi.unstubAllGlobals(); });

async function setup(numberPurchaser: NumberPurchaser | null) {
  const memory = newDb({ noAstCoverageCheck: true });
  memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
  const db = new (memory.adapters.createPg().Pool)();
  // pg-mem cannot run 003_voice.sql (it depends on the AI orchestration tables), so create the
  // phone-number table as 003 defines it and let 019 extend it.
  await migrate(db as never, undefined, (name) => migrations.has(name) && name < "019");
  await db.query(`CREATE TABLE restaurant_phone_numbers (id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'AI', active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(phone_number))`);
  await migrate(db as never, undefined, (name) => name === "019_phone_provisioning.sql" || name === "022_phone_release.sql");
  const app = createApp(env, db as never, { numberPurchaser });
  await app.ready();
  closers.push(async () => { await app.close(); await db.end(); });
  return { app, db };
}
const assertion = (audience = "tideline-service") =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("locally").setAudience(audience).setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));
const provision = async (app: Awaited<ReturnType<typeof setup>>["app"], payload: Record<string, unknown>, token?: string) =>
  app.inject({ method: "POST", url: "/api/v1/internal/provisioning/restaurants", headers: { "x-service-token": token ?? (await assertion()) }, payload });

describe("automatic phone number provisioning", () => {
  it("rejects calls without a Locally service token, including SSO-audience tokens", async () => {
    const { app } = await setup(null);
    expect((await app.inject({ method: "POST", url: "/api/v1/internal/provisioning/restaurants", payload: { externalRef: "b1", name: "X" } })).statusCode).toBe(401);
    expect((await provision(app, { externalRef: "b1", name: "X" }, await assertion("tideline-sso"))).statusCode).toBe(401);
  });

  it("creates the restaurant and assigns a purchased number, idempotently", async () => {
    const purchase = vi.fn(async () => ({ phoneNumber: "+14155550100", sid: "PN1" }));
    const { app, db } = await setup({ purchase, release: vi.fn() });
    const first = await provision(app, { externalRef: "biz-1", name: "Crème Brûlée Café", contactPhone: "(415) 555-0199", state: "CA" });
    expect(first.statusCode).toBe(201);
    expect(first.json().phone).toMatchObject({ status: "active", phoneNumber: "+14155550100" });
    expect(purchase).toHaveBeenCalledWith({ areaCode: "415", friendlyName: "Tideline - Crème Brûlée Café" });
    const again = await provision(app, { externalRef: "biz-1", name: "Crème Brûlée Café" });
    expect(again.statusCode).toBe(200);
    expect(again.json().restaurant.id).toBe(first.json().restaurant.id);
    expect(purchase).toHaveBeenCalledTimes(1);
    const rows = (await db.query("SELECT slug,external_ref FROM restaurants")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toMatch(/^creme-brulee-cafe-[0-9a-f]{6}$/);
  });

  it("still creates the restaurant when the purchase fails and queues the number for manual assignment", async () => {
    const purchase = vi.fn(async () => { throw new Error("Twilio 400 (21631): No payment method"); });
    const { app, db } = await setup({ purchase, release: vi.fn() });
    const res = await provision(app, { externalRef: "biz-2", name: "Harbor Grill" });
    expect(res.statusCode).toBe(201);
    expect(res.json().phone).toMatchObject({ status: "pending_manual", phoneNumber: null });
    const pending = await app.inject({ method: "GET", url: "/api/v1/internal/provisioning/phone-numbers/pending", headers: { "x-service-token": await assertion() } });
    const [queued] = pending.json().numbers;
    expect(queued).toMatchObject({ restaurantName: "Harbor Grill", externalRef: "biz-2", failureReason: "Twilio 400 (21631): No payment method" });
    // Pending rows are never routable: voice lookups only match active rows.
    expect((await db.query("SELECT active FROM restaurant_phone_numbers")).rows).toEqual([{ active: false }]);

    const invalid = await app.inject({ method: "POST", url: `/api/v1/internal/provisioning/phone-numbers/${queued.id}/assign`, headers: { "x-service-token": await assertion() }, payload: { phoneNumber: "555-0100" } });
    expect(invalid.statusCode).toBe(400);
    const assigned = await app.inject({ method: "POST", url: `/api/v1/internal/provisioning/phone-numbers/${queued.id}/assign`, headers: { "x-service-token": await assertion() }, payload: { phoneNumber: "+13055550123" } });
    expect(assigned.json().phone).toMatchObject({ status: "active", phoneNumber: "+13055550123" });
    expect((await db.query("SELECT phone_number,active,status FROM restaurant_phone_numbers")).rows).toEqual([{ phone_number: "+13055550123", active: true, status: "active" }]);
    const empty = await app.inject({ method: "GET", url: "/api/v1/internal/provisioning/phone-numbers/pending", headers: { "x-service-token": await assertion() } });
    expect(empty.json().numbers).toEqual([]);
  });

  it("queues the number when automatic purchase is disabled and a retry can complete it later", async () => {
    const { app } = await setup(null);
    const res = await provision(app, { externalRef: "biz-3", name: "Test Diner" });
    expect(res.json().phone.failureReason).toMatch(/disabled/);
    const retry = await app.inject({ method: "POST", url: `/api/v1/internal/provisioning/phone-numbers/${res.json().phone.id}/retry`, headers: { "x-service-token": await assertion() } });
    expect(retry.json().phone.status).toBe("pending_manual");
  });
});

describe("releasing a restaurant's number when its subscription ends", () => {
  const release = async (app: Awaited<ReturnType<typeof setup>>["app"], restaurantId: string) =>
    (await app.inject({ method: "POST", url: `/api/v1/internal/provisioning/restaurants/${restaurantId}/release-number`, headers: { "x-service-token": await assertion() } })).json();

  it("releases the Twilio number once, frees it for reuse, and a new subscription gets a fresh number", async () => {
    const purchase = vi.fn().mockResolvedValueOnce({ phoneNumber: "+14155550100", sid: "PN1" }).mockResolvedValueOnce({ phoneNumber: "+14155550111", sid: "PN2" });
    const releaseFn = vi.fn(async () => {});
    const { app, db } = await setup({ purchase, release: releaseFn });
    const restaurantId = (await provision(app, { externalRef: "biz-r1", name: "Harbor" })).json().restaurant.id;

    const first = await release(app, restaurantId);
    expect(first).toEqual({ released: [{ id: expect.any(String), phoneNumber: "+14155550100" }], failed: [] });
    expect(releaseFn).toHaveBeenCalledWith({ sid: "PN1", phoneNumber: "+14155550100" });
    expect((await db.query("SELECT status,active,phone_number,released_phone_number FROM restaurant_phone_numbers")).rows).toEqual([
      { status: "released", active: false, phone_number: null, released_phone_number: "+14155550100" },
    ]);

    // Webhook + daily job may both fire: the second call touches nothing.
    expect(await release(app, restaurantId)).toEqual({ released: [], failed: [] });
    expect(releaseFn).toHaveBeenCalledTimes(1);

    // Re-subscribing (same externalRef) provisions a new number instead of reusing the released row.
    const again = await provision(app, { externalRef: "biz-r1", name: "Harbor" });
    expect(again.json().phone).toMatchObject({ status: "active", phoneNumber: "+14155550111" });
  });

  it("keeps the number active and reports the failure when Twilio refuses, so the caller retries", async () => {
    const { app, db } = await setup({ purchase: vi.fn(async () => ({ phoneNumber: "+14155550100", sid: "PN1" })), release: vi.fn(async () => { throw new Error("Twilio 500: try again"); }) });
    const restaurantId = (await provision(app, { externalRef: "biz-r2", name: "Grill" })).json().restaurant.id;
    const out = await release(app, restaurantId);
    expect(out.released).toEqual([]);
    expect(out.failed).toEqual([{ id: expect.any(String), phoneNumber: "+14155550100", error: "Twilio 500: try again" }]);
    expect((await db.query("SELECT status,active FROM restaurant_phone_numbers")).rows).toEqual([{ status: "active", active: true }]);
  });

  it("closes a pending_manual row without calling Twilio", async () => {
    const releaseFn = vi.fn(async () => {});
    const { app } = await setup({ purchase: vi.fn(async () => { throw new Error("no numbers"); }), release: releaseFn });
    const restaurantId = (await provision(app, { externalRef: "biz-r3", name: "Diner" })).json().restaurant.id;
    expect((await release(app, restaurantId)).released).toHaveLength(1);
    expect(releaseFn).not.toHaveBeenCalled();
  });
});

describe("TwilioNumberPurchaser", () => {
  it("prefers the area code, falls back nationally, and wires the voice webhooks", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: URLSearchParams }) => {
      calls.push({ url, body: init?.body?.toString() });
      if (url.includes("AreaCode=212")) return new Response(JSON.stringify({ available_phone_numbers: [] }));
      if (url.includes("AvailablePhoneNumbers")) return new Response(JSON.stringify({ available_phone_numbers: [{ phone_number: "+16465550100" }] }));
      return new Response(JSON.stringify({ sid: "PN9", phone_number: "+16465550100" }), { status: 201 });
    }));
    const bought = await new TwilioNumberPurchaser("AC1", "tok", "https://voice.example.com").purchase({ areaCode: "212", friendlyName: "Tideline - X" });
    expect(bought).toEqual({ phoneNumber: "+16465550100", sid: "PN9" });
    expect(calls).toHaveLength(3);
    const buy = new URLSearchParams(calls[2].body);
    expect(calls[2].url).toMatch(/\/Accounts\/AC1\/IncomingPhoneNumbers\.json$/);
    expect(buy.get("VoiceUrl")).toBe("https://voice.example.com/api/v1/telephony/twilio/incoming");
    expect(buy.get("StatusCallback")).toBe("https://voice.example.com/api/v1/telephony/twilio/status");
  });

  it("surfaces Twilio errors so the caller can queue the number", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 20003, message: "Authenticate" }), { status: 401 })));
    await expect(new TwilioNumberPurchaser("AC1", "bad", "https://x.example.com").purchase({ friendlyName: "X" })).rejects.toThrow("Twilio 401 (20003): Authenticate");
  });
});

describe("TwilioNumberPurchaser.release", () => {
  it("deletes by SID, looks the SID up for manually assigned numbers, and treats 404 as already released", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.includes("IncomingPhoneNumbers.json?PhoneNumber=")) return new Response(JSON.stringify({ incoming_phone_numbers: [{ sid: "PN7" }] }));
      if (url.endsWith("/PN404.json")) return new Response("", { status: 404 });
      return new Response(null, { status: 204 });
    }));
    const twilio = new TwilioNumberPurchaser("AC1", "tok", "https://voice.example.com");
    await twilio.release({ sid: "PN1", phoneNumber: "+14155550100" });
    await twilio.release({ sid: null, phoneNumber: "+14155550101" });
    await twilio.release({ sid: "PN404", phoneNumber: "+14155550102" });
    expect(calls).toEqual([
      { url: "https://api.twilio.com/2010-04-01/Accounts/AC1/IncomingPhoneNumbers/PN1.json", method: "DELETE" },
      { url: "https://api.twilio.com/2010-04-01/Accounts/AC1/IncomingPhoneNumbers.json?PhoneNumber=%2B14155550101", method: "GET" },
      { url: "https://api.twilio.com/2010-04-01/Accounts/AC1/IncomingPhoneNumbers/PN7.json", method: "DELETE" },
      { url: "https://api.twilio.com/2010-04-01/Accounts/AC1/IncomingPhoneNumbers/PN404.json", method: "DELETE" },
    ]);
  });
});
