import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { releaseNumberForSubscription } from "@/lib/billing/number-release";

// AC — releasing a canceled subscription's Twilio number (lib/billing/number-release.ts).
// Mocked: the Supabase service client (in-memory fake) and the Tideline service API call.

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null,
  tideline: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.db }));
vi.mock("@/lib/tideline/service-api", () => ({ releaseTidelineRestaurantNumber: state.tideline }));


const sub = (over: Record<string, unknown> = {}) => ({
  id: "s-1", business_id: "biz-1", provider_subscription_id: "sub_1", status: "canceled",
  cancel_at_period_end: false, tideline_number_released_at: null, tideline_number_release_error: null, ...over,
});

beforeEach(() => {
  state.db = createFakeSupabase({
    tables: {
      business_subscriptions: [sub()],
      businesses: [{ id: "biz-1", tideline_restaurant_id: "rest-1" }],
    },
  });
  state.tideline.mockReset();
  state.tideline.mockResolvedValue({ ok: true, data: { released: [{ id: "n1", phoneNumber: "+14155550100" }], failed: [] } });
});

describe("releaseNumberForSubscription", () => {
  it("releases the restaurant's number once and records it", async () => {
    expect(await releaseNumberForSubscription("sub_1")).toBe("released");
    expect(state.tideline).toHaveBeenCalledWith("rest-1");
    expect(state.db!.tables.business_subscriptions[0].tideline_number_released_at).toEqual(expect.any(String));
    expect(await releaseNumberForSubscription("sub_1")).toBe("already_released");
    expect(state.tideline).toHaveBeenCalledTimes(1);
  });

  it("keeps the number when the business has since re-subscribed", async () => {
    state.db!.tables.business_subscriptions.push(sub({ id: "s-2", provider_subscription_id: "sub_2", status: "active" }));
    expect(await releaseNumberForSubscription("sub_1")).toBe("still_subscribed");
    expect(state.tideline).not.toHaveBeenCalled();
  });

  it("does nothing for a business that never got a Tideline restaurant", async () => {
    state.db!.tables.businesses[0].tideline_restaurant_id = null;
    expect(await releaseNumberForSubscription("sub_1")).toBe("not_needed");
    expect(state.tideline).not.toHaveBeenCalled();
  });

  it("leaves it pending (for the daily job) when Twilio or Tideline fails", async () => {
    state.tideline.mockResolvedValue({ ok: true, data: { released: [], failed: [{ id: "n1", phoneNumber: "+14155550100", error: "Twilio 500" }] } });
    expect(await releaseNumberForSubscription("sub_1")).toBe("failed");
    expect(state.db!.tables.business_subscriptions[0]).toMatchObject({ tideline_number_released_at: null, tideline_number_release_error: "Twilio 500" });

    state.tideline.mockResolvedValue({ ok: false, error: "Tideline API'ye ulaşılamadı" });
    expect(await releaseNumberForSubscription("sub_1")).toBe("failed");
  });
});
