import { beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import type { Business } from "@/lib/types";

// (1) /api/tideline/sso mints a Tideline assertion ONLY for a signed-in owner whose business is
// US + tideline module + mapped to a Tideline restaurant.
//
// Mocked: the Supabase session (createClient().auth.getUser), getMyBusiness (in production this
// is the RLS boundary: it only ever returns the caller's own business), and the Postgres-backed
// rate limiter. NOT mocked: hasTidelineAccess and the real JWT signing, verified below with jose.

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  business: null as Partial<Business> | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/business/current", () => ({ getMyBusiness: async () => state.business }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: async () => ({ ok: true }), clientIp: () => "203.0.113.9" }));

const SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
const RESTAURANT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const usBusiness = (over: Partial<Business> = {}): Partial<Business> => ({
  id: "b-1",
  market: "US",
  active_modules: ["tideline"],
  tideline_restaurant_id: RESTAURANT_ID,
  ...over,
});

async function callSso() {
  const { POST } = await import("@/app/api/tideline/sso/route");
  return POST(new Request("http://localhost/api/tideline/sso", { method: "POST" }));
}

beforeEach(() => {
  process.env.TIDELINE_JWT_SECRET = SECRET;
  process.env.TIDELINE_WEB_URL = "https://app.tideline.test";
  state.user = { id: "u-1", email: "Owner@Harbor.com" };
  state.business = usBusiness();
});

describe("POST /api/tideline/sso", () => {
  it("rejects an anonymous request", async () => {
    state.user = null;
    const res = await callSso();
    expect(res.status).toBe(401);
  });

  it.each([
    ["no business", null],
    ["business not mapped to a Tideline restaurant yet", usBusiness({ tideline_restaurant_id: null })],
    ["tideline module not enabled", usBusiness({ active_modules: ["locally_core"] })],
    ["Turkish-market business", usBusiness({ market: "TR" })],
  ])("refuses a signed-in owner with %s", async (_label, business) => {
    state.business = business;
    const res = await callSso();
    expect(res.status).toBe(403);
    expect(await res.json()).not.toHaveProperty("url");
  });

  it("mints a short-lived, single-use assertion for the owner's own mapped restaurant", async () => {
    const res = await callSso();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { url } = (await res.json()) as { url: string };
    expect(url.startsWith("https://app.tideline.test/sso#assertion=")).toBe(true);

    const assertion = decodeURIComponent(new URL(url).hash.match(/assertion=([^&]+)/)![1]);
    const { payload } = await jwtVerify(assertion, new TextEncoder().encode(SECRET), {
      issuer: "locally",
      audience: "tideline-sso",
    });
    expect(payload).toMatchObject({ sub: "u-1", email: "owner@harbor.com", restaurant_id: RESTAURANT_ID });
    expect(typeof payload.jti).toBe("string");
    expect(payload.exp! - payload.iat!).toBe(60);
  });

  it("returns 503 instead of minting with a missing or weak secret", async () => {
    process.env.TIDELINE_JWT_SECRET = "short";
    expect((await callSso()).status).toBe(503);
  });
});
