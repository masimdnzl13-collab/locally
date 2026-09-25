import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv, loadEnvOrExit } from "../src/config/env.js";

// Prompt AP: in production the API and worker refuse to start when anything they need is missing,
// and say exactly which variables, all at once.
const production = {
  APP_ENV: "production",
  DATABASE_URL: "postgresql://tideline:pw@db.internal:5432/tideline",
  REDIS_URL: "rediss://default:pw@redis.upstash.io:6379",
  APP_URL: "https://app.tideline.test",
  API_URL: "https://api.tideline.test",
  JWT_SECRET: "a-real-shared-secret-with-at-least-32-chars",
  SESSION_SECRET: "another-real-secret-with-at-least-32-chars",
  CORS_ORIGINS: "https://app.tideline.test,https://locally.test",
  ALLOWED_FRAME_ANCESTORS: "https://locally.test",
  TELEPHONY_MODE: "twilio",
  TWILIO_ACCOUNT_SID: "AC-test-account",
  TWILIO_AUTH_TOKEN: "test-auth-token",
  TWILIO_PHONE_NUMBER: "+14155550100",
  TWILIO_VALIDATE_SIGNATURES: "true",
  VOICE_PUBLIC_URL: "https://api.tideline.test",
  STT_PROVIDER: "deepgram",
  STT_API_KEY: "dg-key",
  TTS_PROVIDER: "deepgram",
  TTS_API_KEY: "dg-key",
  AI_PROVIDER: "anthropic",
  AI_API_KEY: "sk-ant-key",
  ALERT_WEBHOOK_URL: "https://hooks.slack.com/services/T/B/X",
};

afterEach(() => vi.restoreAllMocks());

describe("production environment", () => {
  it("starts with a complete production configuration", () => {
    expect(loadEnv(production).APP_ENV).toBe("production");
    // Email alerts are an alternative to the webhook.
    const { ALERT_WEBHOOK_URL: _unused, ...withoutWebhook } = production;
    expect(() => loadEnv({ ...withoutWebhook, RESEND_API_KEY: "re_x", ALERT_EMAIL_TO: "ops@locally.test", ALERT_EMAIL_FROM: "alerts@locally.test" })).not.toThrow();
  });

  it("lists every missing or unusable variable in one error", () => {
    const broken: Record<string, string> = { ...production, TWILIO_AUTH_TOKEN: "", ALLOWED_FRAME_ANCESTORS: "", REDIS_URL: "", ALERT_WEBHOOK_URL: "", STT_API_KEY: "", API_URL: "http://localhost:3000" };
    let message = "";
    try {
      loadEnv(broken);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Production environment is incomplete \(6 problems\):/);
    for (const key of ["TWILIO_AUTH_TOKEN", "ALLOWED_FRAME_ANCESTORS", "REDIS_URL", "ALERT_WEBHOOK_URL / ALERT_EMAIL_*", "STT_API_KEY", "API_URL"])
      expect(message).toContain(`  - ${key}: `);
  });

  it("rejects the .env.example placeholders", () => {
    expect(() => loadEnv({ ...production, JWT_SECRET: "replace-with-at-least-32-random-characters" })).toThrow(/JWT_SECRET: still the example placeholder/);
    expect(() => loadEnv({ ...production, VOICE_PUBLIC_URL: "https://your-public-api.example.com" })).toThrow(/VOICE_PUBLIC_URL/);
  });

  it("does not demand production settings outside production", () => {
    expect(() => loadEnv({ APP_ENV: "development", DATABASE_URL: "postgres://localhost/dev", JWT_SECRET: production.JWT_SECRET, CORS_ORIGINS: "http://localhost:5173" })).not.toThrow();
  });

  it("names the missing variable in a schema failure", () => {
    expect(() => loadEnv({ APP_ENV: "production" })).toThrow(/  - DATABASE_URL: /);
  });

  it("exits with the report instead of a stack trace", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    try {
      loadEnvOrExit("api");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(log.mock.calls[0][0])).toContain("[api] Refusing to start. Invalid environment configuration:");
  });
});
