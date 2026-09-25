import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { addModule, removeModule } from "@/lib/modules/seasonal";

// AG — switching the "tideline" module in Locally must switch the AI in Tideline, otherwise a
// restaurant whose module/season is off would keep getting AI-answered calls.
// Mocked: Supabase (in-memory fake; the add/remove RPC returns the changed ids like the SQL
// functions do), the Tideline service API, and notifications.

const state = vi.hoisted(() => ({
  db: null as (ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> & { rpc: unknown }) | null,
  setActive: vi.fn(async () => ({ ok: true as const, data: { restaurantId: "rest-1", status: "INACTIVE" } })),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.db }));
vi.mock("@/lib/tideline/service-api", () => ({ setTidelineRestaurantActive: state.setActive }));
vi.mock("@/lib/notifications/service", () => ({
  notificationService: { sendSms: vi.fn(async () => ({ success: true, simulated: true })), sendEmail: vi.fn(async () => ({ success: true, simulated: true })) },
  smsProviderFor: () => ({ provider: "twilio", configured: false }),
  isEmailConfigured: () => false,
}));

beforeEach(() => {
  const fake = createFakeSupabase({
    tables: {
      businesses: [
        { id: "biz-1", owner_id: "o-1", phone: null, market: "US", tideline_restaurant_id: "rest-1" },
        { id: "biz-2", owner_id: "o-2", phone: null, market: "US", tideline_restaurant_id: null },
      ],
    },
  });
  state.db = Object.assign(fake, {
    rpc: async (_fn: string, args: { p_business_ids: string[] }) => ({ data: args.p_business_ids.map((id) => ({ business_id: id })), error: null }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "o@x.com" } } }) } },
  });
  state.setActive.mockClear();
});

describe("tideline module ⇄ Tideline restaurant status", () => {
  it("turning the module off marks the mapped Tideline restaurant INACTIVE", async () => {
    await removeModule(["biz-1", "biz-2"], "tideline", "admin");
    // biz-2 has no Tideline restaurant yet: nothing to switch.
    expect(state.setActive).toHaveBeenCalledTimes(1);
    expect(state.setActive).toHaveBeenCalledWith("rest-1", false);
  });

  it("turning it back on reactivates it", async () => {
    await addModule(["biz-1"], "tideline", "admin");
    expect(state.setActive).toHaveBeenCalledWith("rest-1", true);
  });

  it("the winter module (locally_core) does not touch Tideline", async () => {
    await addModule(["biz-1"], "locally_core", "cron");
    await removeModule(["biz-1"], "locally_core", "admin");
    expect(state.setActive).not.toHaveBeenCalled();
  });
});
