import { readFileSync } from "node:fs";
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";

// /api/webhooks/paypal: PayPal's own signature scheme and the mapping of PayPal events onto the
// shared event types the Stripe webhook already produces.
//
// NOT mocked: signature verification. Each request is signed exactly like PayPal does it —
// SHA256withRSA over "<transmission-id>|<time>|<webhook-id>|<crc32(body)>" — with the private key
// of a self-signed test certificate (tests/fixtures, CN=messageverificationcerts.sandbox.paypal.com),
// and lib/paypal/client.ts downloads that certificate from paypal-cert-url.
// Mocked: fetch (the certificate download, OAuth and the few REST calls), Supabase (in-memory fake
// enforcing payment_events' unique index) and the onboarding / number-release hooks.

const WEBHOOK_ID = "WH-TEST-LOCALLY";
process.env.PAYPAL_CLIENT_ID = "test-client";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_ENV = "sandbox";
process.env.PAYPAL_WEBHOOK_ID = WEBHOOK_ID;

const CERT_URL = "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-test-locally";
const certPem = readFileSync(new URL("./fixtures/paypal-test-cert.pem", import.meta.url), "utf8");
const privateKey = createPrivateKey(readFileSync(new URL("./fixtures/paypal-test-key.pem", import.meta.url), "utf8"));

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null }));
const hooks = vi.hoisted(() => ({ completeSignup: vi.fn(async () => null), releaseNumber: vi.fn(async () => "released") }));
const paypal = vi.hoisted(() => ({ captures: [] as string[], nextBillingTime: "2026-10-25T10:00:00Z" }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => db.current }));
vi.mock("@/lib/onboarding-us/complete", () => ({ completeUsSignupFromWebhook: hooks.completeSignup }));
vi.mock("@/lib/billing/number-release", () => ({ releaseNumberForSubscription: hooks.releaseNumber }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === CERT_URL) return new Response(certPem);
    if (url.endsWith("/v1/oauth2/token")) return json({ access_token: "A21-test", expires_in: 3600 });
    const sub = url.match(/\/v1\/billing\/subscriptions\/([^/]+)$/);
    if (sub) return json({ id: sub[1], status: "ACTIVE", billing_info: { next_billing_time: paypal.nextBillingTime } });
    const capture = url.match(/\/v2\/checkout\/orders\/([^/]+)\/capture$/);
    if (capture && init?.method === "POST") {
      paypal.captures.push(capture[1]);
      return json({
        id: capture[1],
        status: "COMPLETED",
        purchase_units: [
          { custom_id: "event_ticket:ticket-1", payments: { captures: [{ id: "CAP-1", status: "COMPLETED", amount: { value: "25.00", currency_code: "USD" } }] } },
        ],
      });
    }
    return json({ message: `unexpected ${url}` }, 500);
  }),
);

let transmission = 0;
function signedHeaders(body: string, options: { webhookId?: string; key?: typeof privateKey; certUrl?: string } = {}) {
  const id = `tx-${++transmission}`;
  const time = new Date().toISOString();
  const { crc32 } = requireCrc();
  const message = `${id}|${time}|${options.webhookId ?? WEBHOOK_ID}|${crc32(Buffer.from(body))}`;
  return {
    "paypal-transmission-id": id,
    "paypal-transmission-time": time,
    "paypal-transmission-sig": sign("sha256", Buffer.from(message), options.key ?? privateKey).toString("base64"),
    "paypal-cert-url": options.certUrl ?? CERT_URL,
    "paypal-auth-algo": "SHA256withRSA",
  };
}
let crcModule: typeof import("@/lib/paypal/client") | null = null;
const requireCrc = () => crcModule!;

function event(id: string, eventType: string, resource: Record<string, unknown>) {
  return JSON.stringify({ id, event_version: "1.0", create_time: "2026-09-25T10:00:00Z", event_type: eventType, resource });
}
const activated = (id = "WH-EVT-ACT-1") =>
  event(id, "BILLING.SUBSCRIPTION.ACTIVATED", { id: "I-SUB1", status: "ACTIVE", custom_id: "biz-1", subscriber: { payer_id: "PAYER1" } });

async function post(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/webhooks/paypal/route");
  return POST(new Request("http://localhost/api/webhooks/paypal", { method: "POST", body, headers }));
}
const payload = async (res: Response) => (await res.json()) as { outcome?: string; error?: string };

beforeEach(async () => {
  crcModule ??= await import("@/lib/paypal/client");
  db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] } });
  hooks.completeSignup.mockClear();
  hooks.releaseNumber.mockClear();
  paypal.captures = [];
});

describe("PayPal signature verification", () => {
  it("computes PayPal's CRC32 (standard check value)", () => {
    expect(requireCrc().crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("rejects missing headers, forged signatures, tampered bodies, foreign cert hosts and other webhooks", async () => {
    const body = activated();
    expect((await post(body)).status).toBe(400);

    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    expect((await post(body, signedHeaders(body, { key: attacker }))).status).toBe(400);

    const headers = signedHeaders(body);
    expect((await post(body.replace("biz-1", "biz-2"), headers)).status).toBe(400);

    const evilCert = await post(body, signedHeaders(body, { certUrl: "https://paypal.com.evil.example/cert.pem" }));
    expect(evilCert.status).toBe(400);
    expect((await payload(evilCert)).error).toMatch(/PayPal'a ait değil/);

    // Signed by PayPal, but for a different webhook subscription.
    expect((await post(body, signedHeaders(body, { webhookId: "WH-SOMEONE-ELSE" }))).status).toBe(400);

    expect(db.current!.calls).toEqual([]);
  });
});

describe("POST /api/webhooks/paypal — subscriptions", () => {
  it("activates once, records PayPal as provider and treats a redelivery as duplicate", async () => {
    const body = activated();
    const first = await post(body, signedHeaders(body));
    expect(first.status).toBe(200);
    expect(await payload(first)).toEqual({ received: true, outcome: "applied" });

    // PayPal redelivers with a new transmission id/signature but the same event id.
    const retry = await post(body, signedHeaders(body));
    expect(await payload(retry)).toEqual({ received: true, outcome: "duplicate" });

    expect(db.current!.tables.business_subscriptions).toEqual([
      expect.objectContaining({ business_id: "biz-1", provider: "paypal", provider_subscription_id: "I-SUB1", provider_customer_id: "PAYER1", status: "active" }),
    ]);
    expect(db.current!.tables.payment_events).toEqual([expect.objectContaining({ event_type: "paypal:BILLING.SUBSCRIPTION.ACTIVATED" })]);
    expect(hooks.completeSignup).toHaveBeenCalledTimes(1);
    expect(hooks.completeSignup).toHaveBeenCalledWith("biz-1", "I-SUB1");
  });

  it("maps PAYMENT.SALE.COMPLETED to a payment and fills the period end from the subscription", async () => {
    db.current = createFakeSupabase({
      unique: { payment_events: [["conversation_id", "event_type"]] },
      tables: { business_subscriptions: [{ business_id: "biz-1", provider_subscription_id: "I-SUB1", status: "past_due" }] },
    });
    const body = event("WH-EVT-SALE-1", "PAYMENT.SALE.COMPLETED", {
      id: "SALE-1",
      state: "completed",
      billing_agreement_id: "I-SUB1",
      amount: { total: "199.00", currency: "USD" },
    });
    expect(await payload(await post(body, signedHeaders(body)))).toEqual({ received: true, outcome: "applied" });
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "active", current_period_end: paypal.nextBillingTime });
  });

  it("marks the subscription past_due when PayPal reports a failed payment", async () => {
    db.current = createFakeSupabase({
      unique: { payment_events: [["conversation_id", "event_type"]] },
      tables: { business_subscriptions: [{ business_id: "biz-1", provider_subscription_id: "I-SUB1", status: "active" }] },
    });
    const body = event("WH-EVT-FAIL-1", "BILLING.SUBSCRIPTION.PAYMENT.FAILED", {
      id: "I-SUB1",
      billing_info: { last_failed_payment: { amount: { value: "199.00", currency_code: "USD" } } },
    });
    await post(body, signedHeaders(body));
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "past_due" });
  });

  it("cancels immediately and releases the number once", async () => {
    db.current = createFakeSupabase({
      unique: { payment_events: [["conversation_id", "event_type"]] },
      tables: { business_subscriptions: [{ business_id: "biz-1", provider_subscription_id: "I-SUB1", status: "active" }] },
    });
    const body = event("WH-EVT-CAN-1", "BILLING.SUBSCRIPTION.CANCELLED", { id: "I-SUB1", status: "CANCELLED" });
    await post(body, signedHeaders(body));
    await post(body, signedHeaders(body));
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "canceled" });
    expect(hooks.releaseNumber).toHaveBeenCalledTimes(1);
    expect(hooks.releaseNumber).toHaveBeenCalledWith("I-SUB1");
  });

  it("defers an end-of-period cancellation: stays active, keeps the number until the period ends", async () => {
    const periodEnd = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    db.current = createFakeSupabase({
      unique: { payment_events: [["conversation_id", "event_type"]] },
      tables: {
        business_subscriptions: [
          { business_id: "biz-1", provider_subscription_id: "I-SUB1", status: "active", cancel_at_period_end: true, current_period_end: periodEnd },
        ],
      },
    });
    const body = event("WH-EVT-CAN-2", "BILLING.SUBSCRIPTION.CANCELLED", { id: "I-SUB1", status: "CANCELLED" });
    expect(await payload(await post(body, signedHeaders(body)))).toEqual({ received: true, outcome: "deferred" });
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "active", cancel_at_period_end: true });
    expect(hooks.releaseNumber).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/paypal — event tickets (Orders API)", () => {
  const pendingTicket = (createdMinutesAgo: number) => ({
    id: "ticket-1",
    price_paid: 25,
    currency: "usd",
    status: "active",
    payment_status: "pending",
    provider_session_id: "ORDER-1",
    created_at: new Date(Date.now() - createdMinutesAgo * 60_000).toISOString(),
  });
  const approved = (id = "WH-EVT-APPROVED-1") =>
    event(id, "CHECKOUT.ORDER.APPROVED", { id: "ORDER-1", status: "APPROVED", purchase_units: [{ custom_id: "event_ticket:ticket-1" }] });

  it("captures an approved order server-side and marks the ticket paid", async () => {
    db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] }, tables: { tickets: [pendingTicket(5)] } });
    const body = approved();
    expect(await payload(await post(body, signedHeaders(body)))).toEqual({ received: true, outcome: "applied" });
    expect(paypal.captures).toEqual(["ORDER-1"]);
    expect(db.current.tables.tickets[0]).toMatchObject({ payment_status: "paid", provider_payment_id: "CAP-1" });
  });

  it("never captures an approval that arrives after the 30-minute hold; the seat is released instead", async () => {
    db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] }, tables: { tickets: [pendingTicket(31)] } });
    const body = approved("WH-EVT-APPROVED-LATE");
    await post(body, signedHeaders(body));
    expect(paypal.captures).toEqual([]);
    expect(db.current.tables.tickets[0]).toMatchObject({ status: "cancelled", payment_status: "expired" });
  });

  it("applies PAYMENT.CAPTURE.COMPLETED to the ticket (idempotent with the return-page capture)", async () => {
    db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] }, tables: { tickets: [pendingTicket(2)] } });
    const body = event("WH-EVT-CAPTURE-1", "PAYMENT.CAPTURE.COMPLETED", {
      id: "CAP-1",
      status: "COMPLETED",
      custom_id: "event_ticket:ticket-1",
      amount: { value: "25.00", currency_code: "USD" },
      supplementary_data: { related_ids: { order_id: "ORDER-1" } },
    });
    await post(body, signedHeaders(body));
    expect(db.current.tables.tickets[0]).toMatchObject({ payment_status: "paid", provider_payment_id: "CAP-1" });
  });

  it("refuses to mark a ticket paid when the captured amount does not match", async () => {
    db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] }, tables: { tickets: [pendingTicket(2)] } });
    const body = event("WH-EVT-CAPTURE-2", "PAYMENT.CAPTURE.COMPLETED", {
      id: "CAP-2",
      status: "COMPLETED",
      custom_id: "event_ticket:ticket-1",
      amount: { value: "1.00", currency_code: "USD" },
      supplementary_data: { related_ids: { order_id: "ORDER-1" } },
    });
    await post(body, signedHeaders(body));
    expect(db.current.tables.tickets[0]).toMatchObject({ payment_status: "failed", status: "cancelled" });
  });
});
