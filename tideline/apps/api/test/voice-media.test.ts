import { describe, expect, it } from "vitest";
import { VoiceSessionManager } from "../src/voice/session-manager.js";
import type {
  CallSession,
  SpeechToTextProvider,
  TextToSpeechProvider,
  VoiceAIEngine,
  VoiceMediaSink,
  TelephonyProvider,
} from "../src/voice/contracts.js";
import type { TtsAudio } from "../src/voice/contracts.js";
import type { Env } from "../src/config/env.js";

const env = {
  VOICE_RESPONSE_TIMEOUT_MS: 1000,
  VOICE_PROVIDER_TIMEOUT_MS: 1000,
  VOICE_ENGLISH_VOICE: "en-US",
  VOICE_SPANISH_VOICE: "es-US",
} as Env;
const audio = (buffer: Buffer): TtsAudio => ({ buffer, encoding: "pcm_s16le", sampleRateHz: 8000, channels: 1 });
const session: CallSession = {
  id: "session-1",
  callId: "call-1",
  restaurantId: "restaurant-1",
  state: "INITIALIZING",
  startedAt: new Date(),
};
function harness() {
  const events: string[] = [];
  const repo = {
    updateCall: async () => {},
    event: async (x: { type: string }) => {
      events.push(x.type);
    },
    endSession: async () => {},
  } as never;
  const stt: SpeechToTextProvider = {
    startSession: async () => {},
    sendAudio: async () => {},
    endSession: async () => {},
  };
  const tts: TextToSpeechProvider = {
    synthesize: async () => audio(Buffer.from([1, 2, 3])),
  };
  const ai: VoiceAIEngine = {
    respond: async () => ({
      responseText: "hello",
      nextState: "LISTENING",
      actions: [],
    }),
  };
  const telephony: TelephonyProvider = {
    incomingResponse: () => "",
    stopPlayback: async () => {},
    transfer: async () => {},
  };
  const manager = new VoiceSessionManager(repo, stt, tts, ai, telephony, env);
  return { manager, events };
}
describe("voice media loop", () => {
  it("sends synthesized audio to the attached media sink", async () => {
    const { manager } = harness();
    const sent: Buffer[] = [];
    const sink: VoiceMediaSink = {
      sendAudio: async (b) => {
        sent.push(b);
      },
      clear: async () => {},
      close: async () => {},
    };
    await manager.begin(session, "call-1", "restaurant-1", {
      season: "OPEN",
      hours: [],
    });
    manager.attachMedia(session.id, sink);
    await manager.transcript(session.id, "hello");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual(Buffer.from([173]));
  });
  it("cleans up on provider failure", async () => {
    const { manager, events } = harness();
    const badAi: VoiceAIEngine = {
      respond: async () => {
        throw new Error("provider down");
      },
    };
    const stt: SpeechToTextProvider = {
      startSession: async () => {},
      sendAudio: async () => {},
      endSession: async () => {},
    };
    const telephony: TelephonyProvider = {
      incomingResponse: () => "",
      stopPlayback: async () => {},
      transfer: async () => {},
    };
    const m = new VoiceSessionManager(
      {
        updateCall: async () => {},
        event: async (x: { type: string }) => events.push(x.type),
        endSession: async () => {},
      } as never,
      stt,
      { synthesize: async () => audio(Buffer.from("x")) } as TextToSpeechProvider,
      badAi,
      telephony,
      env,
    );
    await m.begin(session, "call-1", "restaurant-1");
    await m.transcript(session.id, "hello");
    expect(m.activeCount()).toBe(0);
    expect(events).toContain("ERROR");
  });

  it("cancels the previous AI turn and ignores its stale result", async () => {
    const { manager } = harness();
    let release!: (value: { responseText: string; nextState: string; actions: never[] }) => void;
    const first = new Promise<{ responseText: string; nextState: string; actions: never[] }>((resolve) => { release = resolve; });
    let calls = 0;
    const ai: VoiceAIEngine = { respond: async (ctx) => { calls++; return calls === 1 ? first : { responseText: ctx.transcript, nextState: "LISTENING", actions: [] }; } };
    const sent: string[] = [];
    const sink: VoiceMediaSink = { sendAudio: async (b) => { sent.push(b.toString()); }, clear: async () => {}, close: async () => {} };
    const repo = { updateCall: async () => {}, event: async () => {}, endSession: async () => {} } as never;
    const m = new VoiceSessionManager(repo, { startSession: async () => {}, sendAudio: async () => {}, endSession: async () => {} }, { synthesize: async ({ text }) => audio(Buffer.from(text)) }, ai, { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {} }, env);
    await m.begin(session, "call-1", "restaurant-1"); m.attachMedia(session.id, sink);
    const old = m.transcript(session.id, "old");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await m.transcript(session.id, "new");
    release({ responseText: "old", nextState: "LISTENING", actions: [] });
    await old;
    expect(sent).toHaveLength(1);
  });

  it("allows only the latest of rapid consecutive turns to play", async () => {
    const { manager } = harness(); const sent: Buffer[] = [];
    const sink: VoiceMediaSink = { sendAudio: async (b) => { sent.push(b); }, clear: async () => {}, close: async () => {} };
    await manager.begin(session, "call-1", "restaurant-1"); manager.attachMedia(session.id, sink);
    await Promise.all([manager.transcript(session.id, "one"), manager.transcript(session.id, "two")]);
    expect(sent).toHaveLength(1);
  });

  it("clears playback on barge-in while TTS is pending", async () => {
    let release!: (audio: Buffer) => void; let clears = 0;
    const repo = { updateCall: async () => {}, event: async () => {}, endSession: async () => {} } as never;
    const tts: TextToSpeechProvider = { synthesize: async ({ text }) => new Promise<TtsAudio>((resolve) => { release = () => { resolve(audio(Buffer.from(text))); }; }) };
    const m = new VoiceSessionManager(repo, { startSession: async () => {}, sendAudio: async () => {}, endSession: async () => {} }, tts, { respond: async () => ({ responseText: "reply", nextState: "LISTENING", actions: [] }) }, { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {} }, env);
    await m.begin(session, "call-1", "restaurant-1"); m.attachMedia(session.id, { sendAudio: async () => {}, clear: async () => { clears++; }, close: async () => {} });
    const first = m.transcript(session.id, "first"); await new Promise((resolve) => setTimeout(resolve, 0));
    const second = m.transcript(session.id, "second"); release(Buffer.from("old")); await Promise.all([first, second]);
    expect(clears).toBeGreaterThanOrEqual(1);
  });

  it("makes duplicate disconnect cleanup idempotent", async () => {
    const { manager } = harness();
    await manager.begin(session, "call-1", "restaurant-1");
    await Promise.all([manager.end(session.id), manager.end(session.id), manager.end(session.id)]);
    expect(manager.activeCount()).toBe(0);
  });

  it("releases terminal resources", async () => {
    const { manager } = harness(); let closed = 0;
    await manager.begin(session, "call-1", "restaurant-1"); manager.attachMedia(session.id, { sendAudio: async () => {}, clear: async () => {}, close: async () => { closed++; } });
    await manager.end(session.id, "MEDIA_STOP");
    expect(closed).toBe(1); expect(manager.activeCount()).toBe(0);
  });

  it("keeps simultaneous sessions isolated", async () => {
    const { manager } = harness();
    const other = { ...session, id: "session-2", callId: "call-2" };
    const sent = new Map<string, string[]>();
    const ai: VoiceAIEngine = { respond: async (ctx) => ({ responseText: ctx.sessionId, nextState: "LISTENING", actions: [] }) };
    const repo = { updateCall: async () => {}, event: async () => {}, endSession: async () => {} } as never;
    const m = new VoiceSessionManager(repo, { startSession: async () => {}, sendAudio: async () => {}, endSession: async () => {} }, { synthesize: async ({ text }) => audio(Buffer.from(text)) }, ai, { incomingResponse: () => "", stopPlayback: async () => {}, transfer: async () => {} }, env);
    for (const s of [session, other]) { await m.begin(s, s.callId, s.restaurantId); const out: string[] = []; sent.set(s.id, out); m.attachMedia(s.id, { sendAudio: async (b) => { out.push(b.toString()); }, clear: async () => {}, close: async () => {} }); }
    await Promise.all([m.transcript(session.id, "one"), m.transcript(other.id, "two")]);
    expect(sent.get(session.id)).toHaveLength(1); expect(sent.get(other.id)).toHaveLength(1);
  });
});
