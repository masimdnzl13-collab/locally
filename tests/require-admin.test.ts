import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { requireAdmin, getAdminContext } from "@/lib/auth/require-admin";

// (3) requireAdmin (lib/auth/require-admin.ts) lets through only accounts whose effective roles
// include "admin" — a signed-in business owner is refused — and audits every attempt.
//
// Mocked: the Supabase session (auth.getUser) and profiles lookup, the service client used for
// the audit insert (in-memory fake), next/headers, and next/navigation's redirect — which, like
// the real one, throws, so nothing after it runs.

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  profiles: [] as Record<string, unknown>[],
  audit: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null,
}));

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`NEXT_REDIRECT ${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));
vi.mock("next/headers", () => ({
  headers: () => new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1", "user-agent": "vitest" }),
}));
vi.mock("@/lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./helpers/fake-supabase");
  return {
    createClient: () => {
      const fake = createFakeSupabase({ tables: { profiles: state.profiles } });
      return { ...fake, auth: { getUser: async () => ({ data: { user: state.user } }) } };
    },
  };
});
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.audit }));


const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.to;
    throw e;
  }
  return null;
};

beforeEach(() => {
  state.user = null;
  state.profiles = [];
  state.audit = createFakeSupabase();
});

describe("requireAdmin", () => {
  it("sends an anonymous visitor to log in and audits the attempt", async () => {
    expect(await redirectOf(requireAdmin("/admin/moduller"))).toBe("/giris?next=/admin");
    expect(state.audit!.tables.admin_audit_events).toEqual([
      expect.objectContaining({ target: "/admin/moduller", outcome: "denied_unauthenticated", user_id: null, ip: "198.51.100.7" }),
    ]);
  });

  it("refuses a signed-in business owner", async () => {
    state.user = { id: "owner-1", email: "owner@harbor.com" };
    state.profiles = [{ id: "owner-1", role: "business", additional_roles: [] }];
    expect(await redirectOf(requireAdmin("/admin/tideline-kurulum"))).toBe("/");
    expect(state.audit!.tables.admin_audit_events).toEqual([
      expect.objectContaining({ target: "/admin/tideline-kurulum", outcome: "denied_not_admin", user_id: "owner-1", email: "owner@harbor.com" }),
    ]);
  });

  it("refuses a customer account and a profile-less account", async () => {
    state.user = { id: "c-1", email: "c@x.com" };
    state.profiles = [{ id: "c-1", role: "user", additional_roles: null }];
    expect(await redirectOf(requireAdmin())).toBe("/");
    state.user = { id: "ghost", email: "g@x.com" };
    expect(await redirectOf(requireAdmin())).toBe("/");
  });

  it("allows an admin, including a business owner with admin as an additional role (P27)", async () => {
    state.user = { id: "a-1", email: "admin@locally.app" };
    state.profiles = [{ id: "a-1", role: "admin", additional_roles: [] }];
    await expect(requireAdmin("/admin/isletme-hatti")).resolves.toMatchObject({ userId: "a-1", roles: ["admin"] });

    state.user = { id: "multi", email: "m@locally.app" };
    state.profiles = [{ id: "multi", role: "business", additional_roles: ["admin"] }];
    const ctx = await requireAdmin("action:setWinterModule");
    expect(ctx.roles).toEqual(expect.arrayContaining(["business", "admin"]));
    expect(state.audit!.tables.admin_audit_events.map((e) => e.outcome)).toEqual(["allowed", "allowed"]);
  });

  it("getAdminContext returns null instead of redirecting (for actions that return an error)", async () => {
    state.user = { id: "owner-1", email: "owner@harbor.com" };
    state.profiles = [{ id: "owner-1", role: "business", additional_roles: [] }];
    await expect(getAdminContext("action:adminApproveRefund")).resolves.toBeNull();
  });

  it("does not write an audit row when no target is given (layout-level check)", async () => {
    state.user = { id: "a-1", email: "admin@locally.app" };
    state.profiles = [{ id: "a-1", role: "admin" }];
    await requireAdmin();
    expect(state.audit!.tables.admin_audit_events ?? []).toEqual([]);
  });
});
