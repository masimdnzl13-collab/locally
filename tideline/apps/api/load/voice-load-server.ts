/**
 * AH — load-test server: the REAL Tideline API app (Fastify, Twilio incoming webhook, media
 * WebSocket route, VoiceSessionManager, μ-law resampling/encoding, chunked playback) with the
 * external dependencies replaced by fakes that have realistic latencies:
 *
 *   Postgres   → in-memory repo, LOAD_DB_MS per query (default 3 ms)
 *   STT        → emits a final transcript after every LOAD_UTTERANCE_FRAMES caller frames
 *                (default 150 frames = 3 s of caller audio at Twilio's 20 ms frames)
 *   AI         → LOAD_AI_MS (default 900 ms, roughly one Claude round trip)
 *   TTS        → LOAD_TTS_MS (default 350 ms), returns 2.5 s of 24 kHz linear16 audio, so the
 *                server does real resample + μ-law work per reply
 *
 * So this measures what the API process itself costs per concurrent call (CPU, memory, event
 * loop, WebSocket fan-out) — not Deepgram/Claude capacity or Postgres. Driven by voice-load.ts;
 * exposes GET /__load/metrics. Never imported by the app.
 */
import { monitorEventLoopDelay } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import { TestTelephonyProvider } from "../src/voice/twilio-provider.js";
import type { SpeechSessionInput, SpeechToTextProvider, TextToSpeechProvider, VoiceAIEngine } from "../src/voice/contracts.js";
import type { VoiceRuntime } from "../src/voice/runtime.js";

const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
const DB_MS = num("LOAD_DB_MS", 3);
const AI_MS = num("LOAD_AI_MS", 900);
const TTS_MS = num("LOAD_TTS_MS", 350);
const UTTERANCE_FRAMES = num("LOAD_UTTERANCE_FRAMES", 150);
const PORT = num("LOAD_PORT", 3999);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const env = loadEnv({
  APP_ENV: "test",
  DATABASE_URL: "postgres://unused/load",
  JWT_SECRET: "load-test-secret-that-is-long-enough-xx",
  CORS_ORIGINS: "http://localhost:5173",
  LOG_LEVEL: "error",
  TELEPHONY_MODE: "test",
  PORT: String(PORT),
  // Every virtual caller is distinct, but keep the throttle out of the measurement.
  CALLER_THROTTLE_MAX_CALLS: "0",
  VOICE_RESPONSE_TIMEOUT_MS: "15000",
  VOICE_PROVIDER_TIMEOUT_MS: "15000",
});

// --- fakes -------------------------------------------------------------------------------
const repo = {
  async resolveActivePhone(phone: string) {
    await sleep(DB_MS);
    return { restaurantId: "00000000-0000-0000-0000-000000000001", restaurantName: "Load Test Grill", status: "ACTIVE", timezone: "America/New_York", voiceConfig: {}, phoneNumber: phone, contactPhone: "+13055550123" };
  },
  async recentCallsFromCaller() { await sleep(DB_MS); return 0; },
  async createCall(input: { restaurantId: string }) { await sleep(DB_MS); return { call: { id: randomUUID(), restaurantId: input.restaurantId }, created: true }; },
  async createSession(call: { id: string; restaurantId: string }) { await sleep(DB_MS); return { id: randomUUID(), callId: call.id, restaurantId: call.restaurantId, state: "INITIALIZING", startedAt: new Date() }; },
  async event() { await sleep(DB_MS); },
  async updateCall() { await sleep(DB_MS); },
  async endSession() { await sleep(DB_MS); },
  async restaurantContext() { await sleep(DB_MS); return {}; },
  async updateProviderStatus() { await sleep(DB_MS); },
};

class FakeStt implements SpeechToTextProvider {
  private sessions = new Map<string, { frames: number; onTranscript: SpeechSessionInput["onTranscript"] }>();
  async startSession(input: SpeechSessionInput) {
    this.sessions.set(input.sessionId, { frames: 0, onTranscript: input.onTranscript });
  }
  async sendAudio(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    if (++s.frames % UTTERANCE_FRAMES === 0)
      // Like Deepgram: the transcript arrives asynchronously, not inside sendAudio.
      setImmediate(() => void s.onTranscript({ text: "I'd like two large pepperoni pizzas for pickup", isFinal: true } as Parameters<SpeechSessionInput["onTranscript"]>[0]));
  }
  async endSession(sessionId: string) { this.sessions.delete(sessionId); }
}
const ai: VoiceAIEngine = {
  respond: async () => { await sleep(AI_MS); return { responseText: "Sure, two large pepperoni pizzas for pickup. Can I have a name for the order?", nextState: "LISTENING", actions: [] }; },
};
const replyPcm = Buffer.alloc(24_000 * 2 * 2.5); // 2.5 s, 24 kHz, 16-bit mono
for (let i = 0; i < replyPcm.length; i += 2) replyPcm.writeInt16LE(Math.round(8000 * Math.sin(i / 20)), i);
const tts: TextToSpeechProvider = {
  synthesize: async () => { await sleep(TTS_MS); return { buffer: replyPcm, encoding: "pcm_s16le", sampleRateHz: 24_000, channels: 1 }; },
};

const manager = new VoiceSessionManager(repo as never, new FakeStt(), tts, ai, new TestTelephonyProvider(), env);
const runtime = { repo, telephony: new TestTelephonyProvider(), manager } as unknown as VoiceRuntime;
const app = createApp(env, { query: async () => ({ rows: [] }), connect: async () => ({}), end: async () => {} } as never, { voice: runtime });

// --- metrics -------------------------------------------------------------------------------
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
let samples: { rssMb: number; heapMb: number; cpuPct: number; active: number }[] = [];
let lastCpu = process.cpuUsage();
let lastAt = process.hrtime.bigint();
setInterval(() => {
  const cpu = process.cpuUsage(lastCpu);
  const now = process.hrtime.bigint();
  const wallUs = Number(now - lastAt) / 1000;
  lastCpu = process.cpuUsage();
  lastAt = now;
  const mem = process.memoryUsage();
  samples.push({ rssMb: mem.rss / 2 ** 20, heapMb: mem.heapUsed / 2 ** 20, cpuPct: ((cpu.user + cpu.system) / wallUs) * 100, active: manager.activeCount() });
}, 500).unref();

app.get("/__load/metrics", async (req) => {
  const reset = (req.query as { reset?: string }).reset === "1";
  const max = (k: keyof (typeof samples)[number]) => Math.max(0, ...samples.map((s) => s[k]));
  const avg = (k: keyof (typeof samples)[number]) => (samples.length ? samples.reduce((a, s) => a + s[k], 0) / samples.length : 0);
  const out = {
    samples: samples.length,
    activeSessionsNow: manager.activeCount(),
    activeSessionsPeak: max("active"),
    rssMbPeak: +max("rssMb").toFixed(1),
    heapMbPeak: +max("heapMb").toFixed(1),
    cpuPctAvg: +avg("cpuPct").toFixed(1),
    cpuPctPeak: +max("cpuPct").toFixed(1),
    eventLoopDelayMs: { p50: +(loop.percentile(50) / 1e6).toFixed(1), p99: +(loop.percentile(99) / 1e6).toFixed(1), max: +(loop.max / 1e6).toFixed(1) },
  };
  if (reset) { samples = []; loop.reset(); }
  return out;
});

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(JSON.stringify({ event: "load_server_ready", port: PORT, dbMs: DB_MS, aiMs: AI_MS, ttsMs: TTS_MS, utteranceFrames: UTTERANCE_FRAMES }));
