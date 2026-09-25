import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";

// AH regression: the load test found the 61st incoming call in a minute failing with a 500 for
// EVERY restaurant, because Twilio webhooks all share Twilio's IPs and the limit was per IP (and
// the rate-limit 429 was rewritten into a 500). The limit is now per restaurant number.
const env = loadEnv({ APP_ENV: "test", DATABASE_URL: "postgres://localhost/test", JWT_SECRET: "test-secret-that-is-long-enough-for-security", CORS_ORIGINS: "http://localhost:5173", LOG_LEVEL: "fatal", TELEPHONY_MODE: "test", CALLER_THROTTLE_MAX_CALLS: "0" });

function runtime() {
  let n = 0;
  return {
    repo: {
      resolveActivePhone: async (phone: string) => ({ restaurantId: "r", restaurantName: "R", status: "ACTIVE", timezone: "UTC", voiceConfig: {}, phoneNumber: phone, contactPhone: null }),
      createCall: async () => ({ call: { id: `c${++n}` }, created: false }),
      createSession: async () => ({ id: `s${n}` }),
      restaurantContext: async () => ({}),
    },
    telephony: { incomingResponse: () => "<Response/>" },
    manager: { begin: async () => {} },
  } as unknown as VoiceRuntime;
}

describe("Twilio webhook rate limit", () => {
  it("is per restaurant number, not per Twilio IP, and answers 429 (not 500) when hit", async () => {
    const app = createApp(env, { query: async () => ({ rows: [] }) } as never, { voice: runtime() });
    await app.ready();
    const ring = (to: string, i: number) =>
      app.inject({ method: "POST", url: "/api/v1/telephony/twilio/incoming", remoteAddress: "54.172.60.1", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: `To=${encodeURIComponent(to)}&From=%2B1415555${1000 + i}&CallSid=CA${to}${i}` });
    const first = [];
    for (let i = 0; i < 60; i++) first.push((await ring("+13055550100", i)).statusCode);
    expect(first.every((s) => s === 200)).toBe(true);
    const limited = await ring("+13055550100", 60);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
    // Another restaurant's line, same Twilio IP: unaffected.
    expect((await ring("+17865550100", 0)).statusCode).toBe(200);
    await app.close();
  });
});
