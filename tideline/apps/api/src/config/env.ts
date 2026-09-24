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
export function loadEnv(input: NodeJS.ProcessEnv | Record<string, unknown> = process.env): Env {
  const parsed = schema.safeParse(emptyToUndefined(input));
  if (!parsed.success)
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues.map((x) => x.path.join(".")).join(", ")}`,
    );
  const env = parsed.data;
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
  if (env.APP_ENV === "production") {
    if (
      env.JWT_SECRET.includes("replace-with") ||
      env.SESSION_SECRET?.includes("replace-with") ||
      env.CORS_ORIGINS.includes("*") ||
      env.CORS_ORIGINS.split(",").some((origin) => origin.includes("localhost"))
    )
      throw new Error(
        "Production secrets and explicit non-local CORS_ORIGINS are required",
      );
    if (!env.SESSION_SECRET)
      throw new Error("Production SESSION_SECRET is required");
    if (env.TELEPHONY_MODE !== "twilio" || !env.TWILIO_PHONE_NUMBER)
      throw new Error(
        "Production voice requires Twilio credentials, TWILIO_PHONE_NUMBER, VOICE_PUBLIC_URL, and TELEPHONY_MODE=twilio",
      );
    if (!env.TWILIO_VALIDATE_SIGNATURES)
      throw new Error("Production requires TWILIO_VALIDATE_SIGNATURES=true");
    if (
      env.STT_PROVIDER === "mock" ||
      env.TTS_PROVIDER === "mock" ||
      env.AI_PROVIDER === "mock"
    )
      throw new Error(
        "Production STT_PROVIDER, TTS_PROVIDER, and AI_PROVIDER cannot be mock",
      );
    if (!env.AI_API_KEY && !input.ANTHROPIC_API_KEY)
      throw new Error(
        "Production AI_API_KEY (or ANTHROPIC_API_KEY) is required for the configured AI provider",
      );
  }
  // Fail at startup on a malformed origin instead of emitting a broken CSP.
  resolveFrameAncestors(env.ALLOWED_FRAME_ANCESTORS);
  return env;
}
