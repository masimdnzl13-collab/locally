import { afterEach, describe, expect, it, vi } from "vitest";
import { newDb } from "pg-mem";
import { SignJWT } from "jose";
import { AIOrchestrator } from "../src/ai/orchestrator.js";
import { ReceptionistInstructionBuilder } from "../src/ai/instructions.js";
import { emptyState, type AIProvider } from "../src/ai/types.js";
import { ReservationAvailabilityService } from "../src/domain/action-engine.js";
import { OrchestratorVoiceEngine } from "../src/voice/orchestrator-engine.js";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import { createApp } from "../src/app.js";
import { loadEnv, type Env } from "../src/config/env.js";
import { migrate } from "../src/database/migrate.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";
import type { Db } from "../src/database/db.js";
import type { TtsAudio } from "../src/voice/contracts.js";

// AG — the season switch and restaurant-local time, end to end inside the API.
// Why it matters: in October Locally's season/module switch changes; Tideline must then stop
// running the AI (not keep answering calls for a restaurant that no longer pays for it), and
// every "is it open / is that slot bookable" decision must use the RESTAURANT's clock, not the
// server's (the API runs in UTC).

const restaurantId = "00000000-0000-0000-0000-000000000001";
afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------------------------
// 1. Seasonal closure (restaurant_brain.seasonal_status) in the orchestrator
// ---------------------------------------------------------------------------------------------
function seasonalOrchestrator(brainOverrides: Record<string, unknown>) {
  const provider = {
    name: "spy",
    detectIntent: vi.fn(),
    decideToolCall: vi.fn(),
    generateResponse: vi.fn(),
    generateStructuredOutput: vi.fn(),
  } as unknown as AIProvider & Record<string, ReturnType<typeof vi.fn>>;
  const startTurn = vi.fn();
  const repo = {
    db: { query: async () => ({ rows: [] }) } as unknown as Db,
    callForRestaurant: async () => ({ id: "session-1", restaurant_id: restaurantId }),
    ensureConversation: async () => ({ id: "conv-1", restaurantId, callSessionId: "session-1", state: emptyState(), status: "ACTIVE", language: undefined }),
    brain: async () => ({ restaurantName: "Harbor Grill", timezone: "America/New_York", greeting: {}, hours: { weekly: [] }, menu: [], policies: {}, seasonalStatus: "CLOSED", seasonalClosedMessage: {}, humanTransfer: {}, ...brainOverrides }),
    startTurn,
  };
  return { orchestrator: new AIOrchestrator(provider, repo as never), provider, startTurn };
}
const turn = (o: AIOrchestrator, language: "EN" | "ES" = "EN") =>
  o.processTurn({ requestId: "req-1", restaurantId, callSessionId: "session-1", transcript: "can I book a table for tonight", language });

describe("out-of-season restaurant", () => {
  it("answers with the restaurant's own closed message and never reaches the AI provider", async () => {
    const { orchestrator, provider, startTurn } = seasonalOrchestrator({
      seasonalClosedMessage: { en: "Harbor Grill is closed for the winter. We reopen on May 1st." },
    });
    const out = await turn(orchestrator);
    expect(out.assistantText).toBe("Harbor Grill is closed for the winter. We reopen on May 1st.");
    expect(out.toolCall).toBeNull();
    // No Claude tokens, no tools, no turn row: a closed restaurant costs nothing per utterance.
    expect(provider.detectIntent).not.toHaveBeenCalled();
    expect(provider.decideToolCall).not.toHaveBeenCalled();
    expect(provider.generateResponse).not.toHaveBeenCalled();
    expect(startTurn).not.toHaveBeenCalled();
  });

  it("falls back to a default closed message in the caller's language", async () => {
    expect((await turn(seasonalOrchestrator({}).orchestrator, "ES")).assistantText).toBe("El restaurante está cerrado por temporada.");
    expect((await turn(seasonalOrchestrator({}).orchestrator, "EN")).assistantText).toBe("The restaurant is closed for the season.");
  });

  it("the caller actually hears it: voice pipeline speaks the closed message and the call stays healthy", async () => {
    const { orchestrator } = seasonalOrchestrator({ seasonalClosedMessage: { en: "Closed for the season, see you in May." } });
    const spoken: string[] = [];
    const events: string[] = [];
    const manager = new VoiceSessionManager(
      { updateCall: async () => {}, event: async (e: { type: string }) => { events.push(e.type); }, endSession: async () => {} } as never,
      { startSession: async () => {}, sendAudio: async () => {}, endSession: async () => {} },
      { synthesize: async ({ text }) => { spoken.push(text); return { buffer: Buffer.from([0]), encoding: "pcm_s16le", sampleRateHz: 8000, channels: 1 } as TtsAudio; } },
      new OrchestratorVoiceEngine(orchestrator),
      { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {} },
      { VOICE_RESPONSE_TIMEOUT_MS: 1000, VOICE_PROVIDER_TIMEOUT_MS: 1000, VOICE_ENGLISH_VOICE: "en-US", VOICE_SPANISH_VOICE: "es-US" } as Env,
    );
    await manager.begin({ id: "session-1", callId: "call-1", restaurantId, state: "INITIALIZING", startedAt: new Date() }, "call-1", restaurantId);
    await manager.transcript("session-1", "hi, are you open tonight?");
    expect(spoken).toEqual(["Closed for the season, see you in May."]);
    expect(events).not.toContain("ERROR");
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Restaurant-local time
// ---------------------------------------------------------------------------------------------
describe("restaurant-local clock given to the AI", () => {
  const localLine = (timezone: string, now: string) =>
    new ReceptionistInstructionBuilder()
      .build({ restaurantName: "Harbor Grill", timezone, now: new Date(now), intent: "HOURS", state: emptyState(), context: "" })
      .split("\n")
      .find((l) => l.startsWith("Local date and time"))!;

  it("uses the restaurant's date, not the server's, across midnight UTC", () => {
    // 02:30 UTC Saturday is still Friday evening on the US east and west coasts.
    expect(localLine("America/New_York", "2026-09-26T02:30:00Z")).toContain("Friday 2026-09-25 22:30 (America/New_York)");
    expect(localLine("America/Los_Angeles", "2026-09-26T02:30:00Z")).toContain("Friday 2026-09-25 19:30 (America/Los_Angeles)");
  });

  it("follows the DST change (US clocks fall back on 2026-11-01)", () => {
    expect(localLine("America/New_York", "2026-10-31T23:30:00Z")).toContain("Saturday 2026-10-31 19:30"); // EDT, UTC-4
    expect(localLine("America/New_York", "2026-11-02T00:30:00Z")).toContain("Sunday 2026-11-01 19:30"); // EST, UTC-5
  });

  it("falls back to UTC for a missing or invalid timezone instead of crashing", () => {
    expect(localLine("Not/AZone", "2026-09-26T02:30:00Z")).toContain("Saturday 2026-09-26 02:30 (UTC)");
  });
});

describe("reservation slots are checked against the restaurant's hours in its own timezone", () => {
  const weekdaysQueried: number[] = [];
  function service(status = "ACTIVE") {
    weekdaysQueried.length = 0;
    const db = {
      query: async (sql: string, params: unknown[] = []) => {
        if (sql.includes("FROM restaurants r LEFT JOIN reservation_settings"))
          return { rows: [{ timezone: "America/New_York", status, accept_reservations: true, advance_booking_days: 30, same_day_booking_allowed: true, minimum_notice_minutes: 0, minimum_party_size: 1, maximum_party_size: 10, capacity_per_slot: 20 }] };
        if (sql.includes("FROM business_hours")) {
          weekdaysQueried.push(Number(params[1]));
          // Friday (5): 17:00–22:00 only.
          return { rows: params[1] === 5 ? [{ start_time: "17:00:00", end_time: "22:00:00" }] : [] };
        }
        return { rows: [] };
      },
    } as unknown as Db;
    return new ReservationAvailabilityService(db);
  }
  // Server clock: Saturday 01:00 UTC = Friday 21:00 in New York.
  const fridayEveningInNewYork = () => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-26T01:00:00Z")); };

  it("books tonight 21:30 (restaurant's Friday, although it's already Saturday in UTC)", async () => {
    fridayEveningInNewYork();
    await expect(service().check(restaurantId, { date: "2026-09-25", time: "21:30", partySize: 2 })).resolves.toMatchObject({ available: true });
    expect(weekdaysQueried).toEqual([5]);
  });

  it("refuses 22:30 tonight (after closing) and Saturday (closed all day)", async () => {
    fridayEveningInNewYork();
    await expect(service().check(restaurantId, { date: "2026-09-25", time: "22:30", partySize: 2 })).resolves.toMatchObject({ available: false, reason: "OUTSIDE_BUSINESS_HOURS" });
    await expect(service().check(restaurantId, { date: "2026-09-26", time: "18:00", partySize: 2 })).resolves.toMatchObject({ available: false, reason: "OUTSIDE_BUSINESS_HOURS" });
  });

  it("refuses a time that has already passed in the restaurant's timezone", async () => {
    fridayEveningInNewYork();
    await expect(service().check(restaurantId, { date: "2026-09-25", time: "18:00", partySize: 2 })).resolves.toMatchObject({ available: false, reason: "BOOKING_WINDOW" });
  });

  it("books nothing while the restaurant is switched off", async () => {
    fridayEveningInNewYork();
    await expect(service("INACTIVE").check(restaurantId, { date: "2026-09-25", time: "21:30", partySize: 2 })).resolves.toMatchObject({ available: false, reason: "RESTAURANT_UNAVAILABLE" });
  });
});

// ---------------------------------------------------------------------------------------------
// 3. Module switched off in Locally → restaurant INACTIVE → calls never reach the AI
// ---------------------------------------------------------------------------------------------
const secret = "test-secret-that-is-long-enough-for-security";
const env = loadEnv({ APP_ENV: "test", DATABASE_URL: "postgres://localhost/test", JWT_SECRET: secret, CORS_ORIGINS: "http://localhost:5173", LOG_LEVEL: "fatal", TELEPHONY_MODE: "test" });

describe("incoming call while the AI is switched off for the restaurant", () => {
  function runtime(voiceConfig: Record<string, unknown>) {
    const log: string[] = [];
    const rt = {
      repo: {
        resolveActivePhone: async () => ({ restaurantId, restaurantName: "Harbor Grill", status: "INACTIVE", timezone: "America/New_York", voiceConfig, phoneNumber: "+13055550100", contactPhone: "+13055550123" }),
        recentCallsFromCaller: async () => 0,
        createCall: async () => { log.push("createCall"); return { call: { id: "c" }, created: true }; },
        createSession: async () => { log.push("createSession"); return { id: "s" }; },
      },
      telephony: { incomingResponse: () => { log.push("stream"); return "<Response/>"; } },
      manager: { begin: async () => { log.push("begin"); } },
    } as unknown as VoiceRuntime;
    return { rt, log };
  }
  const ring = async (voiceConfig: Record<string, unknown>) => {
    const { rt, log } = runtime(voiceConfig);
    const app = createApp(env, { query: async () => ({ rows: [] }) } as never, { voice: rt });
    await app.ready();
    const res = await app.inject({ method: "POST", url: "/api/v1/telephony/twilio/incoming", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "To=%2B13055550100&From=%2B14155550199&CallSid=CA1" });
    await app.close();
    return { res, log };
  };

  it("forwards the caller to the restaurant's own line when it has one — no AI, no call record", async () => {
    const { res, log } = await ring({ transferNumber: "+1 (305) 555-0123" });
    expect(res.body).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Dial>+13055550123</Dial></Response>');
    expect(log).toEqual([]);
  });

  it("otherwise plays the closed message and hangs up", async () => {
    const { res, log } = await ring({ closedMessage: "Harbor Grill is closed for the season." });
    expect(res.body).toContain("<Say>Harbor Grill is closed for the season.</Say><Hangup/>");
    expect(log).toEqual([]);
  });
});

describe("POST /internal/restaurants/:id/status (Locally's module switch)", () => {
  const token = () => new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("locally").setAudience("tideline-service").setIssuedAt().setExpirationTime("60s").sign(new TextEncoder().encode(secret));
  async function setup() {
    const memory = newDb({ noAstCoverageCheck: true });
    memory.public.registerFunction({ name: "now", returns: "timestamptz" as never, implementation: () => new Date() });
    const db = new (memory.adapters.createPg().Pool)();
    await migrate(db as never, undefined, (name) => ["001_initial.sql", "010_auth_sessions.sql", "018_sso_assertions.sql"].includes(name));
    await db.query("INSERT INTO restaurants(id,name,slug) VALUES($1,'Harbor','harbor')", [restaurantId]);
    const app = createApp(env, db as never, { voice: {} as never });
    await app.ready();
    return { app, db };
  }
  const post = async (app: Awaited<ReturnType<typeof setup>>["app"], id: string, active: boolean, auth = true) =>
    app.inject({ method: "POST", url: `/api/v1/internal/restaurants/${id}/status`, headers: auth ? { "x-service-token": await token() } : {}, payload: { active } });

  it("turns the AI off and back on", async () => {
    const { app, db } = await setup();
    expect((await post(app, restaurantId, false)).json()).toEqual({ restaurantId, status: "INACTIVE" });
    expect((await db.query("SELECT status FROM restaurants")).rows).toEqual([{ status: "INACTIVE" }]);
    expect((await post(app, restaurantId, true)).json()).toEqual({ restaurantId, status: "ACTIVE" });
    expect((await post(app, "00000000-0000-0000-0000-00000000ffff", false)).statusCode).toBe(404);
    expect((await post(app, restaurantId, false, false)).statusCode).toBe(401);
    await app.close();
    await db.end();
  });
});
