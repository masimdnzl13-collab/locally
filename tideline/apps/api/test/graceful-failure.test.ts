import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { VoiceSessionManager, type VoiceFailure } from "../src/voice/session-manager.js";
import { TwilioTelephonyProvider } from "../src/voice/twilio-provider.js";
import { callFailureMessage, speakablePhone } from "../src/voice/failure-message.js";
import { registerTelephonyRoutes } from "../src/voice/telephony-routes.js";
import { TelephonyErrorMonitor } from "../src/alerts/telephony-monitor.js";
import { ConversationRepository } from "../src/ai/conversation-repository.js";
import type { CallSession, SpeechToTextProvider, TelephonyProvider, TextToSpeechProvider, TtsAudio, VoiceAIEngine } from "../src/voice/contracts.js";
import type { Env } from "../src/config/env.js";

const env = { VOICE_RESPONSE_TIMEOUT_MS: 200, VOICE_PROVIDER_TIMEOUT_MS: 200, VOICE_ENGLISH_VOICE: "en-US", VOICE_SPANISH_VOICE: "es-US", VOICE_STREAM_PATH: "/media" } as Env;
const audio = (): TtsAudio => ({ buffer: Buffer.from([1, 2]), encoding: "pcm_s16le", sampleRateHz: 8000, channels: 1 });
const session: CallSession = { id: "s-1", callId: "c-1", restaurantId: "r-1", state: "INITIALIZING", startedAt: new Date() };

function harness(opts: { ai?: VoiceAIEngine; tts?: TextToSpeechProvider; sayAndEnd?: TelephonyProvider["sayAndEnd"]; context?: Record<string, unknown> } = {}) {
  const events: { type: string; metadata?: Record<string, unknown> }[] = [];
  const ended: string[] = [];
  let sttError: ((e: Error) => void) | undefined;
  const stt: SpeechToTextProvider = {
    startSession: async (input: { onError: (e: Error) => void }) => { sttError = input.onError; },
    sendAudio: async () => {},
    endSession: async () => {},
  } as never;
  const sayAndEnd = vi.fn(opts.sayAndEnd ?? (async () => {}));
  const telephony: TelephonyProvider = { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {}, sayAndEnd };
  const manager = new VoiceSessionManager(
    {
      updateCall: async () => {},
      event: async (e: { type: string; metadata?: Record<string, unknown> }) => { events.push(e); },
      endSession: async (_id: string, reason: string) => { ended.push(reason); },
    } as never,
    stt,
    opts.tts ?? { synthesize: async () => audio() },
    opts.ai ?? { respond: async () => ({ responseText: "hi", nextState: "LISTENING", actions: [] }) },
    telephony,
    env,
    async () => {},
  );
  const failures: VoiceFailure[] = [];
  manager.onFailure = (f) => failures.push(f);
  const start = () => manager.begin(session, "c-1", "r-1", { providerCallId: "CA123", fallbackPhone: "+13055550123", ...opts.context });
  return { manager, events, ended, failures, sayAndEnd, start, sttError: (e: Error) => sttError!(e) };
}

describe("graceful failure on a live call", () => {
  it("apologizes with the restaurant's number and hangs up when the AI turn throws", async () => {
    const h = harness({ ai: { respond: async () => { throw new Error("Restaurant Brain is unavailable"); } } });
    await h.start();
    await h.manager.transcript("s-1", "I'd like to order a pizza");
    expect(h.sayAndEnd).toHaveBeenCalledWith({
      providerCallId: "CA123",
      language: "en",
      transferNumber: undefined,
      message: "We're sorry, we can't take your call right now. Please call again in a few minutes. You can also reach the restaurant directly at 3 0 5, 5 5 5, 0 1 2 3.",
    });
    expect(h.events.map((e) => e.type)).toEqual(expect.arrayContaining(["ERROR", "FAILURE_MESSAGE_PLAYED", "CALL_ENDED"]));
    expect(h.events.find((e) => e.type === "ERROR")?.metadata).toMatchObject({ stage: "ai" });
    expect(h.ended).toEqual(["PROVIDER_FAILURE"]);
    expect(h.failures).toEqual([expect.objectContaining({ stage: "ai", apologized: true, restaurantId: "r-1" })]);
  });

  it("handles a TTS timeout the same way (no dead air)", async () => {
    const h = harness({ tts: { synthesize: () => new Promise(() => {}) } });
    await h.start();
    await h.manager.transcript("s-1", "what time do you close");
    expect(h.sayAndEnd).toHaveBeenCalledTimes(1);
    expect(h.failures[0]).toMatchObject({ stage: "tts", reason: "Voice provider timeout" });
  });

  it("handles a speech-to-text provider error mid-call", async () => {
    const h = harness();
    await h.start();
    await h.sttError(new Error("Deepgram socket closed (1011)"));
    expect(h.failures[0]).toMatchObject({ stage: "stt", apologized: true });
    expect(h.ended).toEqual(["PROVIDER_FAILURE"]);
  });

  it("apologizes in Spanish to a Spanish-speaking caller", async () => {
    const h = harness({ ai: { respond: async () => { throw new Error("boom"); } } });
    await h.start();
    await h.manager.transcript("s-1", "hola, quiero hacer una reservación");
    expect(h.sayAndEnd.mock.calls[0][0]).toMatchObject({ language: "es", message: expect.stringMatching(/^Lo sentimos/) });
  });

  it("connects the caller to the restaurant's transfer line when one is configured", async () => {
    const h = harness({ ai: { respond: async () => { throw new Error("boom"); } }, context: { transferNumber: "+13055550999" } });
    await h.start();
    await h.manager.transcript("s-1", "hello");
    expect(h.sayAndEnd.mock.calls[0][0]).toMatchObject({ transferNumber: "+13055550999", message: "Sorry, we're having a technical problem. Let me connect you to the restaurant." });
  });

  it("still ends the call when even the apology redirect fails (TwiML fallback takes over)", async () => {
    const h = harness({ ai: { respond: async () => { throw new Error("boom"); } }, sayAndEnd: async () => { throw new Error("Twilio 503"); } });
    await h.start();
    await h.manager.transcript("s-1", "hello");
    expect(h.ended).toEqual(["PROVIDER_FAILURE"]);
    expect(h.failures[0]).toMatchObject({ apologized: false });
    expect(h.events.map((e) => e.type)).not.toContain("FAILURE_MESSAGE_PLAYED");
  });
});

describe("failure message", () => {
  it("reads US numbers digit by digit and omits an unusable number", () => {
    expect(speakablePhone("(305) 555-0123")).toBe("3 0 5, 5 5 5, 0 1 2 3");
    expect(speakablePhone("12345")).toBeUndefined();
    expect(callFailureMessage({ language: "en", restaurantPhone: "12345" })).toBe("We're sorry, we can't take your call right now. Please call again in a few minutes.");
  });

  it("Twilio: replaces the live call's TwiML with <Say> + <Hangup/> (or <Dial>)", async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: { body?: URLSearchParams }) => { bodies.push(init!.body!.get("Twiml")!); return new Response("{}"); });
    const twilio = new TwilioTelephonyProvider("tok", "AC1", fetchImpl as unknown as typeof fetch);
    await twilio.sayAndEnd({ providerCallId: "CA1", language: "es", message: "Lo sentimos & adiós" });
    await twilio.sayAndEnd({ providerCallId: "CA1", language: "en", message: "Sorry", transferNumber: "+13055550999" });
    expect(bodies).toEqual([
      '<Response><Say language="es-US">Lo sentimos &amp; adiós</Say><Hangup/></Response>',
      '<Response><Say language="en-US">Sorry</Say><Dial>+13055550999</Dial></Response>',
    ]);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Calls/CA1.json");
  });
});

describe("monitoring", () => {
  it("failed calls feed the telephony monitor, which alerts when they cluster", async () => {
    const send = vi.fn(async (_alert: { subject: string; text: string }) => {});
    const monitor = new TelephonyErrorMonitor({ send }, { maxErrors: 3, windowMs: 300_000, cooldownMs: 900_000 });
    const h = harness({ ai: { respond: async () => { throw new Error("Anthropic 529 overloaded"); } } });
    const app = Fastify();
    await app.register(websocket);
    registerTelephonyRoutes(app, env, { repo: {} as never, telephony: {} as never, manager: h.manager }, monitor);
    await app.ready();
    for (let i = 0; i < 4; i++) {
      await h.manager.begin({ ...session, id: `s-${i}` }, `c-${i}`, "r-1", { providerCallId: `CA${i}` });
      await h.manager.transcript(`s-${i}`, "hello");
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toMatch(/voice-session:ai\s+Anthropic 529 overloaded/);
    await app.close();
  });
});

describe("restaurant without a restaurant_brain row (self-serve restaurants)", () => {
  const repoWith = (restaurantExists: boolean) =>
    new ConversationRepository({
      query: async (sql: string) => ({
        rows: sql.includes("FROM restaurant_brain") ? [] : sql.includes("FROM restaurants") && restaurantExists ? [{ name: "Harbor", timezone: "America/New_York" }] : [],
      }),
    } as never);

  it("gets an in-season default Brain instead of failing every call", async () => {
    await expect(repoWith(true).brain("r-1")).resolves.toMatchObject({ restaurantName: "Harbor", timezone: "America/New_York", seasonalStatus: "ACTIVE", seasonalClosedMessage: {} });
  });

  it("still returns nothing for a restaurant that does not exist", async () => {
    await expect(repoWith(false).brain("r-404")).resolves.toBeUndefined();
  });
});
