/**
 * AH — concurrent-call load test for the Tideline voice API.
 *
 *   npm run load:voice                       # 10, 20, 50 concurrent calls, 30 s each
 *   npm run load:voice -- --calls 20 --duration 60
 *
 * Starts load/voice-load-server.ts in a separate process (so the driver's CPU is not counted as
 * the server's), then for each concurrency level places N calls at once, like Twilio would:
 * POST /incoming (TwiML) → media WebSocket → `start` → a 160-byte μ-law frame every 20 ms per
 * call → `stop`. The server's fake STT turns every 150 frames (3 s) into a final utterance; the
 * driver measures the time from the frame that completed an utterance to the first reply audio
 * frame ("turn latency"). With the default fake provider latencies (AI 900 ms + TTS 350 ms) an
 * unloaded server answers in ~1.3 s; anything above that is the API's own overhead under load.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const LEVELS = arg("calls", "10,20,50").split(",").map(Number);
const DURATION_S = Number(arg("duration", "30"));
const PORT = Number(arg("port", "3999"));
const PROVIDER_MS = Number(process.env.LOAD_AI_MS ?? 900) + Number(process.env.LOAD_TTS_MS ?? 350);
const UTTERANCE_FRAMES = Number(process.env.LOAD_UTTERANCE_FRAMES ?? 150);
const BASE = `http://127.0.0.1:${PORT}`;
const FRAME = Buffer.alloc(160, 0xff).toString("base64"); // 20 ms of μ-law silence
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : NaN);

type CallResult = { webhookMs: number; turnLatencies: number[]; framesSent: number; bytesReceived: number; error?: string; closedEarly: boolean };

// A busy evening is many restaurants at once: spread calls over this many restaurant numbers
// (webhook rate limits are per restaurant number).
const RESTAURANTS = Number(arg("restaurants", "20"));
let callCounter = 0;

async function placeCall(stopAt: number): Promise<CallResult> {
  const to = `+1305555${String(100 + (callCounter++ % RESTAURANTS)).padStart(4, "0")}`;
  const result: CallResult = { webhookMs: NaN, turnLatencies: [], framesSent: 0, bytesReceived: 0, closedEarly: false };
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/v1/telephony/twilio/incoming`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: `+1415${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`, CallSid: `CA${randomUUID().replace(/-/g, "")}` }),
  });
  const twiml = await res.text();
  result.webhookMs = performance.now() - t0;
  const sessionId = twiml.match(/name="sessionId" value="([^"]+)"/)?.[1];
  if (!res.ok || !sessionId) return { ...result, error: `incoming ${res.status}` };

  const streamSid = `MZ${randomUUID().replace(/-/g, "")}`;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/v1/telephony/twilio/media`);
  await new Promise<void>((resolve, reject) => { ws.once("open", () => resolve()); ws.once("error", reject); });
  let utteranceAt: number | undefined;
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString()) as { event: string; media?: { payload: string } };
    if (msg.event !== "media") return;
    result.bytesReceived += Buffer.byteLength(msg.media!.payload, "base64");
    if (utteranceAt !== undefined) { result.turnLatencies.push(performance.now() - utteranceAt); utteranceAt = undefined; }
  });
  let closed = false;
  ws.on("close", () => { closed = true; });
  ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
  ws.send(JSON.stringify({ event: "start", streamSid, start: { streamSid, callSid: "CA", tracks: ["inbound"], customParameters: { sessionId } } }));

  // Twilio sends one frame every 20 ms; setInterval drifts under load, so pace against the clock.
  const started = performance.now();
  while (performance.now() < stopAt && !closed) {
    const due = Math.floor((performance.now() - started) / 20) + 1;
    while (result.framesSent < due && !closed) {
      ws.send(JSON.stringify({ event: "media", streamSid, media: { track: "inbound", payload: FRAME } }));
      if (++result.framesSent % UTTERANCE_FRAMES === 0) utteranceAt = performance.now();
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  result.closedEarly = closed;
  if (!closed) {
    ws.send(JSON.stringify({ event: "stop", streamSid }));
    await new Promise((r) => setTimeout(r, 100));
    ws.close();
  }
  return result;
}

async function level(n: number) {
  await fetch(`${BASE}/__load/metrics?reset=1`);
  const stopAt = performance.now() + DURATION_S * 1000;
  // Real rush: all calls land within ~0.5 s.
  const calls = await Promise.all(
    Array.from({ length: n }, () =>
      new Promise((r) => setTimeout(r, Math.random() * 500)).then(() => placeCall(stopAt).catch((e: Error) => ({ webhookMs: NaN, turnLatencies: [], framesSent: 0, bytesReceived: 0, closedEarly: true, error: e.message }) as CallResult)),
    ),
  );
  await new Promise((r) => setTimeout(r, 500));
  const server = (await (await fetch(`${BASE}/__load/metrics`)).json()) as Record<string, unknown>;
  const turns = calls.flatMap((c) => c.turnLatencies);
  const webhooks = calls.map((c) => c.webhookMs).filter((x) => !Number.isNaN(x));
  const expectedTurns = calls.reduce((a, c) => a + Math.floor(c.framesSent / UTTERANCE_FRAMES), 0);
  return {
    calls: n,
    failedCalls: calls.filter((c) => c.error).length,
    droppedStreams: calls.filter((c) => c.closedEarly && !c.error).length,
    webhookMs: { p50: Math.round(pct(webhooks, 50)), p95: Math.round(pct(webhooks, 95)), max: Math.round(Math.max(...webhooks)) },
    turns: { answered: turns.length, expected: expectedTurns },
    turnLatencyMs: { p50: Math.round(pct(turns, 50)), p95: Math.round(pct(turns, 95)), max: Math.round(Math.max(...turns)) },
    apiOverheadMs: { p50: Math.round(pct(turns, 50) - PROVIDER_MS), p95: Math.round(pct(turns, 95) - PROVIDER_MS) },
    replyAudioMb: +(calls.reduce((a, c) => a + c.bytesReceived, 0) / 2 ** 20).toFixed(1),
    server,
    errors: [...new Set(calls.map((c) => c.error).filter(Boolean))],
  };
}

const serverPath = fileURLToPath(new URL("./voice-load-server.ts", import.meta.url));
const server = spawn(process.execPath, ["--import", "tsx", serverPath], { env: { ...process.env, LOAD_PORT: String(PORT) }, stdio: ["ignore", "pipe", "inherit"] });
await new Promise<void>((resolve, reject) => {
  server.stdout!.on("data", (d: Buffer) => { if (d.toString().includes("load_server_ready")) resolve(); });
  server.once("exit", (code) => reject(new Error(`load server exited (${code})`)));
});
try {
  // Idle baseline: on Windows the timer granularity alone shows up as ~15 ms "event loop delay".
  await fetch(`${BASE}/__load/metrics?reset=1`);
  await new Promise((r) => setTimeout(r, 3000));
  const idle = (await (await fetch(`${BASE}/__load/metrics`)).json()) as Record<string, unknown>;
  console.error(`idle baseline: ${JSON.stringify(idle)}`);
  const results = [];
  for (const n of LEVELS) {
    console.error(`▶ ${n} concurrent calls for ${DURATION_S}s…`);
    const r = await level(n);
    results.push(r);
    console.error(JSON.stringify(r));
  }
  console.log(JSON.stringify({ durationSeconds: DURATION_S, providerLatencyMs: PROVIDER_MS, node: process.version, platform: `${process.platform} ${process.arch}`, idle, results }, null, 2));
} finally {
  server.kill();
}
