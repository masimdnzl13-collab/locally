import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { DeepgramSttProvider } from "../src/voice/deepgram-stt.js";
import { DeepgramTtsProvider, ElevenLabsTtsProvider } from "../src/voice/tts-providers.js";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import { OrchestratorVoiceEngine } from "../src/voice/orchestrator-engine.js";
import { toTwilioMuLaw } from "../src/voice/audio-codec.js";
import type { SpeechTranscriptEvent, TtsAudio, VoiceAIEngine, VoiceMediaSink } from "../src/voice/contracts.js";
import type { Env } from "../src/config/env.js";

const servers: WebSocketServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r)))); });
async function fakeDeepgram() {
  const server = new WebSocketServer({ port: 0 });
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  const connection = new Promise<{ socket: WebSocket; auth?: string; url?: string; received: Buffer[] }>((resolve) =>
    server.once("connection", (socket, request) => {
      const received: Buffer[] = [];
      socket.on("message", (data, isBinary) => { if (isBinary) received.push(data as Buffer); });
      resolve({ socket, auth: request.headers.authorization, url: request.url, received });
    }),
  );
  return { url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/v1/listen`, connection };
}
const results = (text: string, isFinal: boolean, speechFinal = false, language = "en") =>
  JSON.stringify({ type: "Results", is_final: isFinal, speech_final: speechFinal, channel: { alternatives: [{ transcript: text, confidence: 0.93, languages: [language] }] } });
const settle = () => new Promise((r) => setTimeout(r, 30));

describe("DeepgramSttProvider", () => {
  it("streams μ-law audio with token auth and emits interim then complete final utterances", async () => {
    const dg = await fakeDeepgram();
    const events: SpeechTranscriptEvent[] = [];
    const stt = new DeepgramSttProvider({ apiKey: "dg-key", url: dg.url });
    await stt.startSession({ sessionId: "s1", onTranscript: (e) => { events.push(e); } });
    const server = await dg.connection;
    expect(server.auth).toBe("Token dg-key");
    expect(server.url).toContain("encoding=mulaw");
    expect(server.url).toContain("sample_rate=8000");
    expect(server.url).toContain("language=multi");
    await stt.sendAudio("s1", Buffer.from([1, 2, 3]));
    server.socket.send(results("quiero una", false, false, "es"));
    server.socket.send(results("Quiero una mesa", true, false, "es"));
    server.socket.send(results("para dos.", true, true, "es"));
    await settle();
    expect(server.received[0]).toEqual(Buffer.from([1, 2, 3]));
    expect(events).toEqual([
      expect.objectContaining({ text: "quiero una", isFinal: false }),
      expect.objectContaining({ text: "Quiero una mesa para dos.", isFinal: true, language: "es" }),
    ]);
    await stt.endSession("s1");
  });
  it("flushes on UtteranceEnd when endpointing never fired", async () => {
    const dg = await fakeDeepgram();
    const events: SpeechTranscriptEvent[] = [];
    const stt = new DeepgramSttProvider({ apiKey: "k", url: dg.url });
    await stt.startSession({ sessionId: "s1", onTranscript: (e) => { events.push(e); } });
    const server = await dg.connection;
    server.socket.send(results("What time do you close", true));
    server.socket.send(JSON.stringify({ type: "UtteranceEnd" }));
    await settle();
    expect(events.filter((e) => e.isFinal).map((e) => e.text)).toEqual(["What time do you close"]);
    await stt.endSession("s1");
  });
  it("reports an unexpected disconnect as an error", async () => {
    const dg = await fakeDeepgram();
    const errors: unknown[] = [];
    const stt = new DeepgramSttProvider({ apiKey: "k", url: dg.url });
    await stt.startSession({ sessionId: "s1", onTranscript: () => {}, onError: (e) => { errors.push(e); } });
    (await dg.connection).socket.close();
    await settle();
    expect(errors).toHaveLength(1);
  });
});

describe("TTS providers", () => {
  const capture = () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(new Uint8Array([0xff, 0x7f]), { status: 200 });
    }) as unknown as typeof fetch;
    return { requests, fetchImpl };
  };
  it("Deepgram Aura returns Twilio-ready μ-law and maps locale voices to Aura voices", async () => {
    const { requests, fetchImpl } = capture();
    const audio = await new DeepgramTtsProvider("dg", fetchImpl).synthesize({ text: "Hola", voice: "es-US", language: "es" });
    expect(audio).toMatchObject({ encoding: "mulaw", sampleRateHz: 8000 });
    expect(audio.buffer).toEqual(Buffer.from([0xff, 0x7f]));
    expect(requests[0].url).toContain("model=aura-2-celeste-es");
    expect(requests[0].url).toContain("encoding=mulaw");
    expect((requests[0].init.headers as Record<string, string>).Authorization).toBe("Token dg");
  });
  it("ElevenLabs requests ulaw_8000 output with the configured voice id", async () => {
    const { requests, fetchImpl } = capture();
    await new ElevenLabsTtsProvider("el", "eleven_flash_v2_5", fetchImpl).synthesize({ text: "Hi", voice: "voice123", language: "en" });
    expect(requests[0].url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice123?output_format=ulaw_8000");
    expect((requests[0].init.headers as Record<string, string>)["xi-api-key"]).toBe("el");
  });
  it("surfaces provider HTTP errors", async () => {
    const fetchImpl = (async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    await expect(new DeepgramTtsProvider("x", fetchImpl).synthesize({ text: "a", voice: "en-US", language: "en" })).rejects.toThrow(/401/);
  });
  it("resamples 16 kHz PCM to 8 kHz μ-law", () => {
    const pcm = Buffer.alloc(3200); // 100 ms at 16 kHz
    expect(toTwilioMuLaw({ buffer: pcm, encoding: "pcm_s16le", sampleRateHz: 16000, channels: 1 })).toHaveLength(800);
  });
});

const env = { VOICE_RESPONSE_TIMEOUT_MS: 1000, VOICE_PROVIDER_TIMEOUT_MS: 1000, VOICE_ENGLISH_VOICE: "en-US", VOICE_SPANISH_VOICE: "es-US" } as Env;
const session = { id: "session-1", callId: "call-1", restaurantId: "r1", state: "INITIALIZING", startedAt: new Date() };
const mulaw = (text: string): TtsAudio => ({ buffer: Buffer.from(text), encoding: "mulaw", sampleRateHz: 8000, channels: 1 });
function manager(ai: VoiceAIEngine, overrides: { onTranscript?: (cb: (e: SpeechTranscriptEvent) => unknown) => void } = {}) {
  const events: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const telephony = { calls: [] as string[], incomingResponse: () => "", stopPlayback: async () => {}, transfer: async (x: { providerCallId: string; targetNumber: string }) => { telephony.calls.push(`transfer:${x.providerCallId}:${x.targetNumber}`); }, hangup: async (id: string) => { telephony.calls.push(`hangup:${id}`); } };
  const repo = { updateCall: async (_id: string, x: Record<string, unknown>) => { updates.push(x); }, event: async (x: { type: string }) => { events.push(x.type); }, endSession: async () => {} };
  const voices: string[] = [];
  const m = new VoiceSessionManager(
    repo as never,
    { startSession: async (input) => { overrides.onTranscript?.(input.onTranscript); }, sendAudio: async () => {}, endSession: async () => {} },
    { synthesize: async ({ text, voice }) => { voices.push(voice); return mulaw(text); } },
    ai,
    telephony,
    env,
    async () => {},
  );
  const sent: string[] = []; let clears = 0;
  const sink: VoiceMediaSink = { sendAudio: async (b) => { sent.push(b.toString()); }, clear: async () => { clears++; }, close: async () => {} };
  return { m, events, updates, telephony, sent, voices, sink, clears: () => clears };
}
describe("VoiceSessionManager with real-call behaviour", () => {
  it("does not interrupt playback for inbound silence frames, only for caller speech", async () => {
    let emit!: (e: SpeechTranscriptEvent) => unknown;
    const h = manager({ respond: async () => ({ responseText: "r".repeat(8000), nextState: "LISTENING", actions: [] }) }, { onTranscript: (cb) => { emit = cb; } });
    await h.m.begin(session, "call-1", "r1"); h.m.attachMedia(session.id, h.sink);
    await h.m.transcript(session.id, "hello");
    const before = h.clears();
    for (let i = 0; i < 50; i++) await h.m.audio(session.id, Buffer.alloc(160, 0xff));
    expect(h.clears()).toBe(before);
    await emit({ sessionId: session.id, text: "wait", isFinal: false });
    expect(h.clears()).toBe(before + 1);
    expect(h.events.filter((e) => e === "SPEECH_STARTED")).toHaveLength(1);
  });
  it("detects Spanish including accented words and speaks with the Spanish voice", async () => {
    const h = manager({ respond: async () => ({ responseText: "Claro", nextState: "LISTENING", actions: [] }) });
    await h.m.begin(session, "call-1", "r1"); h.m.attachMedia(session.id, h.sink);
    await h.m.transcript(session.id, "¿Tienen mesa para mañana?");
    expect(h.events).toContain("LANGUAGE_DETECTED");
    expect(h.updates).toContainEqual({ language: "es" });
    expect(h.voices).toEqual(["es-US"]);
  });
  it("transfers to a human after the reply plays", async () => {
    const h = manager({ respond: async () => ({ responseText: "Connecting you", nextState: "LISTENING", actions: [], shouldTransfer: true, transferTo: "+15550001111" }) });
    await h.m.begin(session, "call-1", "r1", { providerCallId: "CA9" }); h.m.attachMedia(session.id, h.sink);
    await h.m.transcript(session.id, "person please");
    expect(h.sent).toEqual(["Connecting you"]);
    expect(h.telephony.calls).toEqual(["transfer:CA9:+15550001111"]);
    expect(h.updates).toContainEqual(expect.objectContaining({ status: "TRANSFERRED" }));
    expect(h.m.activeCount()).toBe(0);
  });
  it("hangs up after saying goodbye", async () => {
    const h = manager({ respond: async () => ({ responseText: "Goodbye", nextState: "LISTENING", actions: [], shouldEndCall: true }) });
    await h.m.begin(session, "call-1", "r1", { providerCallId: "CA9" }); h.m.attachMedia(session.id, h.sink);
    await h.m.transcript(session.id, "bye");
    expect(h.telephony.calls).toEqual(["hangup:CA9"]);
    expect(h.m.activeCount()).toBe(0);
  });
  it("runs a caller utterance through the orchestrator and plays its reply", async () => {
    const turns: Array<Record<string, unknown>> = [];
    const engine = new OrchestratorVoiceEngine({
      processTurn: async (input: Record<string, unknown>) => {
        turns.push(input);
        return { conversationId: "c", turnId: "t", intent: "HOURS", confidence: 1, language: "EN", assistantText: "We open at 11.", toolCall: { name: "get_business_hours", result: {} }, transferTo: undefined };
      },
    } as never);
    const h = manager(engine);
    await h.m.begin(session, "call-1", "r1", { callerPhone: "+15551234567" }); h.m.attachMedia(session.id, h.sink);
    await h.m.transcript(session.id, "When do you open?");
    expect(turns[0]).toMatchObject({ restaurantId: "r1", callSessionId: "session-1", transcript: "When do you open?", language: "EN", callerPhone: "+15551234567" });
    expect(h.sent).toEqual(["We open at 11."]);
    expect(h.updates).toContainEqual({ intent: "HOURS" });
  });
});
