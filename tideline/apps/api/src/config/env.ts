import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { resolveFrameAncestors } from "./frame-ancestors.js";

// API commands are commonly run from apps/api, while the canonical local
// configuration lives at the repository root. Load that file in both cases;
// explicit process environment variables still take precedence.
const envFiles = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", ".env"),
  resolve(process.cwd(), "..", "..", ".env"),
];
const envFile = envFiles.find((file) => existsSync(file));
if (envFile) loadDotenv({ path: envFile });

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL URL",
    ),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  API_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32).optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGINS: z.string().min(1),
  ALLOWED_FRAME_ANCESTORS: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  // z.coerce.boolean() turns any non-empty string (including "false") into true.
  TWILIO_VALIDATE_SIGNATURES: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((value) => value === "true" || value === "1"),
  // Who answers STOP/START/HELP texts: "twilio" (its built-in opt-out replies, on by default for
  // long codes) or "app" (our TwiML reply; only when Twilio's default handling is turned off).
  SMS_OPT_OUT_REPLIES: z.enum(["twilio", "app"]).default("twilio"),
  TELEPHONY_MODE: z.enum(["twilio", "test"]).default("test"),
  VOICE_PUBLIC_URL: z.string().url().optional(),
  VOICE_STREAM_PATH: z.string().default("/api/v1/telephony/twilio/media"),
  VOICE_SILENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(900),
  VOICE_MAX_SILENCE_MS: z.coerce.number().int().positive().default(8000),
  VOICE_SPEECH_SENSITIVITY: z.coerce.number().min(0).max(1).default(0.45),
  VOICE_MAX_CALL_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(1800),
  VOICE_GREETING_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  VOICE_RESPONSE_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  VOICE_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  VOICE_RECONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // Per-caller abuse guard: once a caller number has reached MAX calls to the
  // same restaurant within WINDOW, further calls get a fixed message and no AI.
  // 0 disables it.
  CALLER_THROTTLE_MAX_CALLS: z.coerce.number().int().min(0).default(5),
  CALLER_THROTTLE_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  CALLER_THROTTLE_MESSAGE: z
    .string()
    .min(1)
    .max(300)
    .default("We're very busy right now. Please call again a little later. Goodbye."),
  STT_PROVIDER: z.enum(["mock", "deepgram"]).default("mock"),
  TTS_PROVIDER: z.enum(["mock", "deepgram", "elevenlabs"]).default("mock"),
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  STT_API_KEY: z.string().optional(),
  TTS_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default("claude-opus-5"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  DEEPGRAM_STT_MODEL: z.string().min(1).default("nova-3"),
  VOICE_ENGLISH_VOICE: z.string().default("en-US"),
  VOICE_SPANISH_VOICE: z.string().default("es-US"),
  // Admin alerts (telephony failures, cost thresholds). Slack-compatible incoming
  // webhook first; otherwise a plain email through Resend; otherwise log only.
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_TO: z.string().email().optional(),
  ALERT_EMAIL_FROM: z.string().min(3).optional(),
  RESEND_API_KEY: z.string().optional(),
  TELEPHONY_ALERT_MAX_ERRORS: z.coerce.number().int().positive().default(3),
  TELEPHONY_ALERT_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  TELEPHONY_ALERT_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(900),
  // Cost guard: alert when a restaurant's month-to-date cost passes
  // SUBSCRIPTION_PRICE_USD * COST_ALERT_THRESHOLD_RATIO. Visibility only, never a cut-off.
  SUBSCRIPTION_PRICE_USD: z.coerce.number().positive().default(199),
  COST_ALERT_THRESHOLD_RATIO: z.coerce.number().positive().max(10).default(0.6),
  // Per-minute voice rates (USD) — estimates, override with your actual invoices.
  COST_TWILIO_PER_MINUTE: z.coerce.number().min(0).default(0.0125),
  COST_STT_PER_MINUTE: z.coerce.number().min(0).default(0.0077),
  COST_TTS_PER_MINUTE: z.coerce.number().min(0).default(0.01),
  // Locally -> Tideline service-to-service calls (pipeline dashboard) are signed
  // with JWT_SECRET, iss=locally, aud=tideline-service.
});
const emptyToUndefined = (input: NodeJS.ProcessEnv | Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ""),
  );
export type Env = z.infer<typeof schema>;
const isLocal = (url: string | undefined) => !url || /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(url);
const isPlaceholder = (value: string | undefined) => !value || /replace-with|your-public-api|example\.com|xxxxxxxx/i.test(value);

/**
 * Everything production needs to actually work, checked together so one start-up failure lists
 * every missing or unusable variable (Prompt AP). Anything here that is merely "unset" in
 * development falls back to mocks/test mode; in production that fallback would be a silently
 * broken service (calls not answered, alerts going nowhere, the Locally iframe refused), so the
 * API and worker refuse to start instead.
 */
export function productionEnvProblems(env: Env, input: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const need = (key: string, ok: boolean, why: string) => {
    if (!ok) problems.push(`${key}: ${why}`);
  };
  const raw = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");

  need("JWT_SECRET", !isPlaceholder(env.JWT_SECRET), "still the example placeholder; use the same value as Locally's TIDELINE_JWT_SECRET");
  need("SESSION_SECRET", Boolean(env.SESSION_SECRET) && !isPlaceholder(env.SESSION_SECRET), "missing or placeholder (at least 32 random characters)");
  need("CORS_ORIGINS", !env.CORS_ORIGINS.includes("*") && !env.CORS_ORIGINS.split(",").some((o) => isLocal(o.trim())), "must list the real https origins (no *, no localhost)");
  need("ALLOWED_FRAME_ANCESTORS", Boolean(raw("ALLOWED_FRAME_ANCESTORS")), "missing; without it only localhost may embed Tideline and the Locally panel tab stays blank");
  need("APP_URL", !isLocal(env.APP_URL), "missing or localhost; set the dashboard's public https URL");
  need("API_URL", !isLocal(env.API_URL), "missing or localhost; set this API's public https URL");
  need("REDIS_URL", Boolean(raw("REDIS_URL")) && !isLocal(env.REDIS_URL), "missing or localhost; the notification queue (confirmation texts) needs a real Redis");
  need("TELEPHONY_MODE", env.TELEPHONY_MODE === "twilio", "must be twilio (test mode answers no real calls)");
  need("TWILIO_ACCOUNT_SID", Boolean(env.TWILIO_ACCOUNT_SID) && !isPlaceholder(env.TWILIO_ACCOUNT_SID), "missing or placeholder");
  need("TWILIO_AUTH_TOKEN", Boolean(env.TWILIO_AUTH_TOKEN) && !isPlaceholder(env.TWILIO_AUTH_TOKEN), "missing or placeholder");
  need("TWILIO_PHONE_NUMBER", /^\+1\d{10}$/.test(env.TWILIO_PHONE_NUMBER ?? ""), "missing or not a US E.164 number (+1XXXXXXXXXX)");
  need("TWILIO_VALIDATE_SIGNATURES", env.TWILIO_VALIDATE_SIGNATURES, "must be true (unsigned Twilio webhooks would be accepted)");
  need("VOICE_PUBLIC_URL", Boolean(env.VOICE_PUBLIC_URL) && !isLocal(env.VOICE_PUBLIC_URL) && !isPlaceholder(env.VOICE_PUBLIC_URL), "missing, localhost or placeholder; Twilio must reach this API over https");
  need("STT_PROVIDER", env.STT_PROVIDER !== "mock", "cannot be mock");
  need("STT_API_KEY", Boolean(env.STT_API_KEY), "missing");
  need("TTS_PROVIDER", env.TTS_PROVIDER !== "mock", "cannot be mock");
  need("TTS_API_KEY", Boolean(env.TTS_API_KEY), "missing");
  need("AI_PROVIDER", env.AI_PROVIDER !== "mock", "cannot be mock");
  need("AI_API_KEY", Boolean(env.AI_API_KEY || raw("ANTHROPIC_API_KEY")), "missing (or set ANTHROPIC_API_KEY)");
  const emailAlerts = Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM);
  need(
    "ALERT_WEBHOOK_URL / ALERT_EMAIL_*",
    Boolean(env.ALERT_WEBHOOK_URL) || emailAlerts,
    "no alert channel; set ALERT_WEBHOOK_URL, or RESEND_API_KEY + ALERT_EMAIL_TO + ALERT_EMAIL_FROM (otherwise telephony and cost alerts are only logged)",
  );
  return problems;
}

export function loadEnv(input: NodeJS.ProcessEnv | Record<string, unknown> = process.env): Env {
  const cleaned = emptyToUndefined(input);
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success)
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues.map((x) => `  - ${x.path.join(".") || "(root)"}: ${x.message}`).join("\n")}`,
    );
  const env = parsed.data;
  // Production first: its list covers the single checks below, and reports every problem at once.
  if (env.APP_ENV === "production") {
    const problems = productionEnvProblems(env, cleaned);
    if (problems.length)
      throw new Error(
        `Production environment is incomplete (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
      );
  }
  if (
    env.TELEPHONY_MODE === "twilio" &&
    (!env.TWILIO_AUTH_TOKEN || !env.TWILIO_ACCOUNT_SID || !env.VOICE_PUBLIC_URL)
  )
    throw new Error(
      "TELEPHONY_MODE=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and VOICE_PUBLIC_URL",
    );
  if (env.STT_PROVIDER !== "mock" && !env.STT_API_KEY)
    throw new Error(`STT_API_KEY is required for STT_PROVIDER=${env.STT_PROVIDER}`);
  if (env.TTS_PROVIDER !== "mock" && !env.TTS_API_KEY)
    throw new Error(`TTS_API_KEY is required for TTS_PROVIDER=${env.TTS_PROVIDER}`);
  // Fail at startup on a malformed origin instead of emitting a broken CSP.
  resolveFrameAncestors(env.ALLOWED_FRAME_ANCESTORS);
  return env;
}

/** Entry points (server, worker): print what is wrong, without a stack trace, and exit non-zero. */
export function loadEnvOrExit(processName: string): Env {
  try {
    return loadEnv();
  } catch (error) {
    console.error(`\n[${processName}] Refusing to start. ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
