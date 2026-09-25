import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./helpers/fake-supabase";
import { submitPrivacyRequestAction } from "@/lib/privacy/actions";

// AO — /privacy deletion/access form: requests are validated, stored for the admin queue
// (/admin/gizlilik-talepleri) and never silently lost; bots and floods are turned away.
// Mocked: Supabase (in-memory fake; its rpc stands in for the rate-limit counter), request headers.

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("./helpers/fake-supabase").createFakeSupabase> | null,
  allowed: true,
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => state.db }));
vi.mock("next/headers", () => ({ headers: () => new Headers({ "x-real-ip": "203.0.113.7" }) }));
delete process.env.RESEND_API_KEY;

beforeEach(() => {
  state.db = createFakeSupabase({ tables: { privacy_requests: [] } });
  state.allowed = true;
  (state.db as unknown as { rpc: unknown }).rpc = async () => ({ data: state.allowed, error: null });
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const caller = {
  requestType: "delete",
  requesterType: "caller",
  fullName: "Sam Rivera",
  email: "Sam@Example.com",
  phone: "(415) 555-0123",
  businessName: "Harbor Grill",
  details: "Please delete my order history.",
};

describe("privacy requests", () => {
  it("stores a caller's deletion request for the admin queue", async () => {
    expect(await submitPrivacyRequestAction(form(caller))).toEqual({ ok: true });
    expect(state.db!.tables.privacy_requests).toMatchObject([
      {
        request_type: "delete",
        requester_type: "caller",
        full_name: "Sam Rivera",
        email: "sam@example.com",
        phone: "(415) 555-0123",
        business_name: "Harbor Grill",
      },
    ]);
  });

  it("asks callers for the number they called from and merchants for their restaurant", async () => {
    expect(await submitPrivacyRequestAction(form({ ...caller, phone: "" }))).toHaveProperty("error");
    expect(await submitPrivacyRequestAction(form({ ...caller, requesterType: "merchant", businessName: "" }))).toHaveProperty("error");
    expect(await submitPrivacyRequestAction(form({ ...caller, email: "not-an-email" }))).toHaveProperty("error");
    expect(await submitPrivacyRequestAction(form({ ...caller, requestType: "sell" }))).toHaveProperty("error");
    expect(state.db!.tables.privacy_requests).toEqual([]);
  });

  it("pretends to accept bot submissions without storing them", async () => {
    expect(await submitPrivacyRequestAction(form({ ...caller, company_website: "http://spam.test" }))).toEqual({ ok: true });
    expect(state.db!.tables.privacy_requests).toEqual([]);
  });

  it("turns away floods from one address", async () => {
    state.allowed = false;
    const result = await submitPrivacyRequestAction(form(caller));
    expect(result).toHaveProperty("error");
    expect(state.db!.tables.privacy_requests).toEqual([]);
  });
});
