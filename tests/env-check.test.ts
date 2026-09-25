import { afterEach, describe, expect, it, vi } from "vitest";
import { checkEnv, formatEnvReport, isStrictEnvCheck } from "@/lib/env-spec.mjs";
import { register } from "@/instrumentation";

// AP — production refuses to build/start with a missing or unusable variable, and says which.
const complete: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_SITE_URL: "https://locally.test",
  CRON_SECRET: "a-long-cron-secret-value",
  TIDELINE_API_URL: "https://api.tideline.test",
  TIDELINE_WEB_URL: "https://app.tideline.test",
  TIDELINE_JWT_SECRET: "a-real-shared-secret-with-at-least-32-chars",
  PAYPAL_CLIENT_ID: "id",
  PAYPAL_CLIENT_SECRET: "secret",
  PAYPAL_WEBHOOK_ID: "WH-1",
  PAYPAL_US_PLAN_ID: "P-123",
  PAYPAL_LIVE_MODE: "true",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "token",
  TWILIO_FROM_NUMBER: "+14155550100",
  RESEND_API_KEY: "re_x",
  RESEND_FROM_EMAIL: "Locally <no-reply@locally.test>",
  NEXT_PUBLIC_US_SUPPORT_EMAIL: "support@locally.test",
  ANTHROPIC_API_KEY: "sk-ant",
  NETGSM_USERCODE: "u",
  NETGSM_PASSWORD: "p",
  NETGSM_MSGHEADER: "LOCALLY",
  NEXT_PUBLIC_US_LEGAL_ENTITY: "Locally Inc.",
  NEXT_PUBLIC_US_GOVERNING_LAW: "the State of New Jersey",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("production env check", () => {
  it("passes a complete production configuration", () => {
    expect(checkEnv(complete)).toEqual({ errors: [], warnings: [] });
  });

  it("reports every missing or malformed variable at once", () => {
    const result = checkEnv({ ...complete, TWILIO_AUTH_TOKEN: "", PAYPAL_WEBHOOK_ID: "  ", TIDELINE_API_URL: "http://localhost:3000", TWILIO_FROM_NUMBER: "4155550100" });
    expect(result.errors.map((e) => e.key)).toEqual(["TIDELINE_API_URL", "PAYPAL_WEBHOOK_ID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"]);
    const report = formatEnvReport(result, "[check-env] Üretim build'i durduruldu");
    expect(report).toContain("4 zorunlu ortam değişkeni eksik ya da hatalı");
    expect(report).toContain("✗ TWILIO_AUTH_TOKEN: eksik");
    expect(report).toContain("✗ TIDELINE_API_URL: geçersiz");
  });

  it("only warns about optional features and sandbox PayPal", () => {
    const result = checkEnv({ ...complete, PAYPAL_LIVE_MODE: "false", ANTHROPIC_API_KEY: "" });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.key)).toEqual(["PAYPAL_LIVE_MODE", "ANTHROPIC_API_KEY"]);
  });

  it("is strict only in Vercel production (or when asked)", () => {
    expect(isStrictEnvCheck({ VERCEL_ENV: "production" })).toBe(true);
    expect(isStrictEnvCheck({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isStrictEnvCheck({})).toBe(false);
    expect(isStrictEnvCheck({ ENV_CHECK: "strict" })).toBe(true);
    expect(isStrictEnvCheck({ VERCEL_ENV: "production", SKIP_ENV_CHECK: "1" })).toBe(false);
  });

  it("stops the server at startup in production when something is missing", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("VERCEL_ENV", "production");
    for (const [k, v] of Object.entries(complete)) vi.stubEnv(k, v);
    vi.stubEnv("RESEND_API_KEY", "");
    await register();
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(log.mock.calls[0][0])).toContain("✗ RESEND_API_KEY: eksik");

    exit.mockClear();
    vi.stubEnv("RESEND_API_KEY", "re_x");
    await register();
    expect(exit).not.toHaveBeenCalled();
  });
});
