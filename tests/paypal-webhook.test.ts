import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
import { crc32 } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

// /api/webhooks/paypal: PayPal's own signature scheme (transmission id + time + webhook id + CRC32
// of the raw body, RSA-SHA256 with the certificate at paypal-cert-url), translation of subscription
// and one-time (Orders v2) events to the shared format, and the ticket rules (capture only while the
// ticket is still pending and inside its 30-minute window).
//
// NOT mocked: signature verification. Payloads are signed with a throwaway key whose self-signed
// certificate (tests/fixtures, test-only) is served for a sandbox cert URL.
// Mocked: fetch (PayPal cert + REST API), Supabase (in-memory fake), and the two post-processing hooks.

const WEBHOOK_ID = "WH-TEST-LOCALLY";
process.env.PAYPAL_CLIENT_ID = "test-client";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;
delete process.env.PAYPAL_LIVE_MODE;

const KEY = readFileSync(new URL("./fixtures/paypal-test-key.pem", import.meta.url), "utf8");
const CERT = readFileSync(new URL("./fixtures/paypal-test-cert.pem", import.meta.url), "utf8");
const CERT_URL = "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-locally-test";

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null }));
const hooks = vi.hoisted(() => ({ completeSignup: vi.fn(async () => null), releaseNumber: vi.fn(async () => "released") }));
const api = vi.hoisted(() => ({ calls: [] as { method: string; path: string }[], captureStatus: "COMPLETED", captureValue: "25.00" }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => db.current }));
vi.mock("@/lib/onboarding-us/complete", () => ({ completeUsSignupFromWebhook: hooks.completeSignup }));
vi.mock("@/lib/billing/number-release", () => ({ releaseNumberForSubscription: hooks.releaseNumber }));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  if (url.href === CERT_URL) return new Response(CERT);
  if (url.pathname === "/v1/oauth2/token") return json({ access_token: "A21-test", expires_in: 3600 });
  api.calls.push({ method, path: url.pathname });
  if (method === "GET" && url.pathname === "/v1/billing/subscriptions/I-1") {
    return json({ id: "I-1", status: "ACTIVE", billing_info: { next_billing_time: "2026-10-25T10:00:00Z" } });
  }
  if (method === "POST" && url.pathname === "/v2/checkout/orders/O-1/capture") {
    return json({
      id: "O-1",
      status: "COMPLETED",
      purchase_units: [{ payments: { captures: [{ id: "CAP-1", status: api.captureStatus, amount: { currency_code: "USD", value: api.captureValue } }] } }],
    });
  }
  return new Response("not found", { status: 404 });
});

function event(id: string, eventType: string, resource: Record<string, unknown>) {
  return JSON.stringify({ id, event_type: eventType, resource_type: "x", resource });
}

function signed(body: string, opts: { webhookId?: string; certUrl?: string; transmissionId?: string } = {}) {
  const transmissionId = opts.transmissionId ?? `tx-${Math.random().toString(36).slice(2)}`;
  const time = new Date().toISOString();
  const message = `${transmissionId}|${time}|${opts.webhookId ?? WEBHOOK_ID}|${crc32(Buffer.from(body))}`;
  return {
    "paypal-transmission-id": transmissionId,
    "paypal-transmission-time": time,
    "paypal-transmission-sig": sign("sha256", Buffer.from(message), KEY).toString("base64"),
    "paypal-cert-url": opts.certUrl ?? CERT_URL,
    "paypal-auth-algo": "SHA256withRSA",
  };
}

async function post(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/webhooks/paypal/route");
  return POST(new Request("http://localhost/api/webhooks/paypal", { method: "POST", body, headers }));
}

const activated = (id = "WH-activated-1") =>
  event(id, "BILLING.SUBSCRIPTION.ACTIVATED", {
    id: "I-1",
    status: "ACTIVE",
    custom_id: "biz-1",
    subscriber: { payer_id: "PAYER-1" },
    billing_info: { next_billing_time: "2026-10-25T10:00:00Z" },
  });

const future = () => new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

beforeEach(() => {
  db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] } });
  hooks.completeSignup.mockClear();
  hooks.releaseNumber.mockClear();
  api.calls = [];
  api.captureStatus = "COMPLETED";
  api.captureValue = "25.00";
});

describe("POST /api/webhooks/paypal — signature", () => {
  it("rejects a request without PayPal transmission headers and writes nothing", async () => {
    const res = await post(activated());
    expect(res.status).toBe(400);
    expect(db.current!.calls).toEqual([]);
  });

  it("rejects a body that was altered after signing", async () => {
    const body = activated();
    const res = await post(body.replace("biz-1", "biz-2"), signed(body));
    expect(res.status).toBe(400);
    expect(db.current!.calls).toEqual([]);
  });

  it("rejects an event signed for another webhook id", async () => {
    const body = activated();
    const res = await post(body, signed(body, { webhookId: "WH-SOMEONE-ELSE" }));
    expect(res.status).toBe(400);
  });

  it("rejects a certificate that is not hosted by PayPal", async () => {
    const body = activated();
    const res = await post(body, signed(body, { certUrl: "https://evil.example.com/v1/notifications/certs/x" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("PayPal") });
  });
});

describe("POST /api/webhooks/paypal — subscriptions", () => {
  it("records an activated subscription once and starts US onboarding", async () => {
    const body = activated();
    const first = await post(body, signed(body));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ outcome: "applied" });
    expect(db.current!.tables.business_subscriptions).toEqual([
      expect.objectContaining({
        business_id: "biz-1",
        provider: "paypal",
        provider_customer_id: "PAYER-1",
        provider_subscription_id: "I-1",
        status: "active",
        current_period_end: "2026-10-25T10:00:00Z",
      }),
    ]);
    expect(hooks.completeSignup).toHaveBeenCalledWith("biz-1", "I-1", "paypal");

    // PayPal retries with a new transmission but the same event id.
    const again = await post(body, signed(body));
    expect(await again.json()).toMatchObject({ outcome: "duplicate" });
    expect(hooks.completeSignup).toHaveBeenCalledTimes(1);
  });

  it("maps PAYMENT.SALE.COMPLETED to payment.succeeded with the period end read from the subscription", async () => {
    db.current = createFakeSupabase({
      tables: { business_subscriptions: [{ provider_subscription_id: "I-1", status: "past_due" }] },
      unique: { payment_events: [["conversation_id", "event_type"]] },
    });
    const body = event("WH-sale-1", "PAYMENT.SALE.COMPLETED", {
      id: "SALE-1",
      state: "completed",
      amount: { total: "49.00", currency: "USD" },
      billing_agreement_id: "I-1",
    });
    const res = await post(body, signed(body));
    expect(res.status).toBe(200);
    expect(api.calls).toContainEqual({ method: "GET", path: "/v1/billing/subscriptions/I-1" });
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({
      status: "active",
      current_period_end: "2026-10-25T10:00:00Z",
    });
  });

  it("cancels immediately and releases the phone number", async () => {
    db.current = createFakeSupabase({
      tables: { business_subscriptions: [{ provider_subscription_id: "I-1", status: "active", cancel_at_period_end: false }] },
      unique: { payment_events: [["conversation_id", "event_type"]] },
    });
    const body = event("WH-cancel-1", "BILLING.SUBSCRIPTION.CANCELLED", { id: "I-1", status: "CANCELLED" });
    const res = await post(body, signed(body));
    expect(await res.json()).toMatchObject({ outcome: "applied" });
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "canceled" });
    expect(hooks.releaseNumber).toHaveBeenCalledWith("I-1");
  });

  it("keeps a period-end cancellation active until the paid period ends", async () => {
    db.current = createFakeSupabase({
      tables: {
        business_subscriptions: [
          { provider_subscription_id: "I-1", status: "active", cancel_at_period_end: true, current_period_end: future() },
        ],
      },
      unique: { payment_events: [["conversation_id", "event_type"]] },
    });
    const body = event("WH-cancel-2", "BILLING.SUBSCRIPTION.CANCELLED", { id: "I-1", status: "CANCELLED" });
    const res = await post(body, signed(body));
    expect(await res.json()).toMatchObject({ outcome: "deferred" });
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "active", canceled_at: expect.any(String) });
    expect(hooks.releaseNumber).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/paypal — event tickets (Orders v2)", () => {
  const ticket = (extra: Record<string, unknown> = {}) => ({
    id: "t-1",
    status: "active",
    price_paid: 25,
    currency: "usd",
    payment_status: "pending",
    provider_session_id: "O-1",
    payment_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    ...extra,
  });
  const approved = (id = "WH-approved-1") =>
    event(id, "CHECKOUT.ORDER.APPROVED", { id: "O-1", status: "APPROVED", purchase_units: [{ custom_id: "event_ticket:t-1" }] });

  function withTicket(extra: Record<string, unknown> = {}) {
    db.current = createFakeSupabase({ tables: { tickets: [ticket(extra)] }, unique: { payment_events: [["conversation_id", "event_type"]] } });
  }

  it("captures an approved order for a pending ticket and marks it paid", async () => {
    withTicket();
    const body = approved();
    const res = await post(body, signed(body));
    expect(res.status).toBe(200);
    expect(api.calls).toContainEqual({ method: "POST", path: "/v2/checkout/orders/O-1/capture" });
    expect(db.current!.tables.tickets[0]).toMatchObject({ payment_status: "paid", provider_payment_id: "CAP-1" });
  });

  it("never captures once the 30-minute window has passed; the ticket expires instead", async () => {
    withTicket({ payment_expires_at: new Date(Date.now() - 60 * 1000).toISOString() });
    const body = approved();
    await post(body, signed(body));
    expect(api.calls.filter((c) => c.path.endsWith("/capture"))).toEqual([]);
    expect(db.current!.tables.tickets[0]).toMatchObject({ status: "cancelled", payment_status: "expired" });
  });

  it("does not capture for a ticket that was replaced by a newer checkout", async () => {
    withTicket({ status: "cancelled", payment_status: "expired" });
    const body = approved();
    await post(body, signed(body));
    expect(api.calls.filter((c) => c.path.endsWith("/capture"))).toEqual([]);
  });

  it("fails the ticket when the captured amount does not match the price", async () => {
    withTicket();
    api.captureValue = "1.00";
    const body = approved();
    await post(body, signed(body));
    expect(db.current!.tables.tickets[0]).toMatchObject({ status: "cancelled", payment_status: "failed" });
  });

  it("applies PAYMENT.CAPTURE.COMPLETED (e.g. a capture that was pending) to the ticket", async () => {
    withTicket();
    const body = event("WH-capture-1", "PAYMENT.CAPTURE.COMPLETED", {
      id: "CAP-9",
      status: "COMPLETED",
      custom_id: "event_ticket:t-1",
      amount: { currency_code: "USD", value: "25.00" },
      supplementary_data: { related_ids: { order_id: "O-1" } },
    });
    const res = await post(body, signed(body));
    expect(res.status).toBe(200);
    expect(db.current!.tables.tickets[0]).toMatchObject({ payment_status: "paid", provider_payment_id: "CAP-9" });
  });
});
