import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { cancelMySubscriptionAction } from "@/lib/billing/actions";

// (4) An owner can cancel only their OWN business's subscription. The business id never comes
// from the form: cancelMySubscriptionAction resolves it from the session (getMyBusiness, which in
// production is RLS-scoped to owner_id = auth.uid()). A forged businessId field is ignored.
//
// Mocked: getMyBusiness (the RLS boundary — returns the caller's business), the Supabase service
// client (in-memory fake with two businesses), the payment provider (a spy standing in for
// Stripe's subscriptions.cancel/update), revalidatePath, and the Twilio-number release hook (AC).

const state = vi.hoisted(() => ({
  myBusiness: null as { id: string; market: "US" | "TR" } | null,
  db: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null,
  cancel: vi.fn(async () => ({ success: true as const, simulated: false })),
  release: vi.fn(async () => "released"),
}));

vi.mock("@/lib/business/current", () => ({ getMyBusiness: async () => state.myBusiness }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.db }));
vi.mock("@/lib/payments", () => ({ getPaymentService: () => ({ cancelSubscription: state.cancel }) }));
vi.mock("@/lib/billing/number-release", () => ({ releaseNumberForSubscription: state.release }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));


const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

beforeEach(() => {
  state.myBusiness = { id: "biz-A", market: "US" };
  state.db = createFakeSupabase({
    tables: {
      businesses: [
        { id: "biz-A", market: "US" },
        { id: "biz-B", market: "US" },
      ],
      business_subscriptions: [
        { business_id: "biz-A", provider_subscription_id: "sub_A", status: "active", cancel_at_period_end: false },
        { business_id: "biz-B", provider_subscription_id: "sub_B", status: "active", cancel_at_period_end: false },
      ],
    },
  });
  state.cancel.mockClear();
  state.release.mockClear();
});

describe("cancelMySubscriptionAction", () => {
  it("ignores a forged businessId and cancels only the caller's own subscription", async () => {
    const result = await cancelMySubscriptionAction(form({ businessId: "biz-B", when: "now", confirm: "yes" }));
    expect(result).toEqual({ success: true, atPeriodEnd: false });
    expect(state.cancel).toHaveBeenCalledTimes(1);
    expect(state.cancel).toHaveBeenCalledWith({ subscriptionId: "sub_A", atPeriodEnd: false });
    expect(state.cancel).not.toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub_B" }));
    // Immediate cancel releases the caller's Twilio number right away (AC).
    expect(state.release).toHaveBeenCalledWith("sub_A");
  });

  it("refuses when the caller has no business of their own (e.g. another owner's id is all they have)", async () => {
    state.myBusiness = null;
    const result = await cancelMySubscriptionAction(form({ businessId: "biz-B", when: "now", confirm: "yes" }));
    expect(result).toEqual({ error: "İşletme bulunamadı." });
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it("refuses when the caller's own business has no active subscription, even if another one does", async () => {
    state.myBusiness = { id: "biz-C", market: "US" };
    state.db!.tables.businesses.push({ id: "biz-C", market: "US" });
    const result = await cancelMySubscriptionAction(form({ businessId: "biz-B", when: "now", confirm: "yes" }));
    expect(result).toEqual({ error: "Aktif abonelik bulunamadı." });
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it("period-end cancel marks only the caller's subscription and keeps the number until the period ends", async () => {
    const result = await cancelMySubscriptionAction(form({ businessId: "biz-B", when: "period_end", confirm: "yes" }));
    expect(result).toEqual({ success: true, atPeriodEnd: true });
    const subs = state.db!.tables.business_subscriptions;
    expect(subs.find((s) => s.provider_subscription_id === "sub_A")).toMatchObject({ cancel_at_period_end: true });
    expect(subs.find((s) => s.provider_subscription_id === "sub_B")).toMatchObject({ cancel_at_period_end: false });
    expect(state.release).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation", async () => {
    expect(await cancelMySubscriptionAction(form({ when: "now" }))).toEqual({ error: "İptali onaylaman gerekiyor." });
    expect(state.cancel).not.toHaveBeenCalled();
  });
});
