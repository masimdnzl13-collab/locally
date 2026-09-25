import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createFakeSupabase } from "./helpers/fake-supabase";

// (2) /api/webhooks/stripe rejects unsigned/forged requests and never applies the same event twice.
//
// NOT mocked: Stripe. The real SDK verifies signatures (stripe.webhooks.constructEvent) against a
// test webhook secret, and payloads are signed with the SDK's generateTestHeaderString, exactly as
// Stripe does it. No network call is made: constructEvent is pure HMAC.
// Mocked: Supabase (in-memory fake enforcing payment_events' unique (conversation_id, event_type),
// the index real duplicate detection relies on), plus the two post-processing hooks, which are
// only asserted as "called once".

const WEBHOOK_SECRET = "whsec_test_locally_suite";
process.env.STRIPE_SECRET_KEY = "sk_test_locally_suite";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null }));
const hooks = vi.hoisted(() => ({ completeSignup: vi.fn(async () => null), releaseNumber: vi.fn(async () => "released") }));

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => db.current }));
vi.mock("@/lib/onboarding-us/complete", () => ({ completeUsSignupFromWebhook: hooks.completeSignup }));
vi.mock("@/lib/billing/number-release", () => ({ releaseNumberForSubscription: hooks.releaseNumber }));

const stripe = new Stripe("sk_test_locally_suite");

function event(id: string, type: string, object: Record<string, unknown>) {
  return JSON.stringify({ id, object: "event", type, api_version: "2025-03-31.basil", created: 1_790_000_000, data: { object } });
}
const checkoutCompleted = (id = "evt_checkout_1") =>
  event(id, "checkout.session.completed", {
    id: "cs_test_1",
    object: "checkout.session",
    mode: "subscription",
    subscription: "sub_1",
    customer: "cus_1",
    client_reference_id: "biz-1",
    metadata: { business_id: "biz-1" },
  });

async function post(body: string, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body, headers }));
}
const signed = (body: string, secret = WEBHOOK_SECRET) => ({
  "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload: body, secret }),
});

beforeEach(() => {
  db.current = createFakeSupabase({ unique: { payment_events: [["conversation_id", "event_type"]] } });
  hooks.completeSignup.mockClear();
  hooks.releaseNumber.mockClear();
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a request with no signature and writes nothing", async () => {
    const res = await post(checkoutCompleted());
    expect(res.status).toBe(400);
    expect(db.current!.calls).toEqual([]);
  });

  it("rejects a forged signature and a tampered body", async () => {
    const body = checkoutCompleted();
    expect((await post(body, signed(body, "whsec_attacker"))).status).toBe(400);
    const tampered = body.replace("biz-1", "biz-2");
    expect((await post(tampered, signed(body))).status).toBe(400);
    expect(db.current!.tables.business_subscriptions ?? []).toEqual([]);
  });

  it("applies a signed event once and treats Stripe's retry of the same event as a duplicate", async () => {
    const body = checkoutCompleted();
    const first = await post(body, signed(body));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true, outcome: "applied" });

    // Stripe re-delivers with a fresh timestamp/signature but the same event id.
    const retry = await post(body, signed(body));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ received: true, outcome: "duplicate" });

    expect(db.current!.tables.business_subscriptions).toEqual([
      expect.objectContaining({ business_id: "biz-1", provider_subscription_id: "sub_1", status: "active" }),
    ]);
    expect(db.current!.tables.payment_events).toHaveLength(1);
    expect(db.current!.calls.filter((c) => c.table === "business_subscriptions")).toHaveLength(1);
    expect(hooks.completeSignup).toHaveBeenCalledTimes(1);
    expect(hooks.completeSignup).toHaveBeenCalledWith("biz-1", "sub_1", "stripe");
  });

  it("releases the Twilio number once when a subscription-deleted event is delivered twice", async () => {
    db.current = createFakeSupabase({
      unique: { payment_events: [["conversation_id", "event_type"]] },
      tables: { business_subscriptions: [{ business_id: "biz-1", provider_subscription_id: "sub_1", status: "active" }] },
    });
    const body = event("evt_deleted_1", "customer.subscription.deleted", { id: "sub_1", object: "subscription" });
    await post(body, signed(body));
    await post(body, signed(body));
    expect(db.current.tables.business_subscriptions[0]).toMatchObject({ status: "canceled" });
    expect(hooks.releaseNumber).toHaveBeenCalledTimes(1);
    expect(hooks.releaseNumber).toHaveBeenCalledWith("sub_1");
  });
});
