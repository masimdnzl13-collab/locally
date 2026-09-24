import type { Env } from "../config/env.js";
import type { Db } from "../database/db.js";
import { AIOrchestrator } from "../ai/orchestrator.js";
import { ConversationRepository } from "../ai/conversation-repository.js";
import { createAIProvider } from "../ai/provider-factory.js";
import { VoiceRepository } from "../repositories/voice-repository.js";
import type { SpeechToTextProvider, TextToSpeechProvider } from "./contracts.js";
import { DeepgramSttProvider } from "./deepgram-stt.js";
import { MockSttProvider, MockTtsProvider } from "./mock-providers.js";
import { OrchestratorVoiceEngine } from "./orchestrator-engine.js";
import { VoiceSessionManager } from "./session-manager.js";
import { DeepgramTtsProvider, ElevenLabsTtsProvider } from "./tts-providers.js";
import { TestTelephonyProvider, TwilioTelephonyProvider } from "./twilio-provider.js";

export type VoiceRuntime = {
  repo: VoiceRepository;
  telephony: TwilioTelephonyProvider;
  manager: VoiceSessionManager;
};
function createStt(env: Env): SpeechToTextProvider {
  if (env.STT_PROVIDER === "deepgram")
    return new DeepgramSttProvider({ apiKey: env.STT_API_KEY!, model: env.DEEPGRAM_STT_MODEL });
  return new MockSttProvider();
}
function createTts(env: Env): TextToSpeechProvider {
  if (env.TTS_PROVIDER === "deepgram") return new DeepgramTtsProvider(env.TTS_API_KEY!);
  if (env.TTS_PROVIDER === "elevenlabs") return new ElevenLabsTtsProvider(env.TTS_API_KEY!);
  return new MockTtsProvider();
}
/** Wires telephony, STT, TTS and the AI orchestrator from configuration. */
export function createVoiceRuntime(env: Env, db: Db): VoiceRuntime {
  const repo = new VoiceRepository(db);
  const telephony =
    env.TELEPHONY_MODE === "twilio"
      ? new TwilioTelephonyProvider(env.TWILIO_AUTH_TOKEN!, env.TWILIO_ACCOUNT_SID)
      : new TestTelephonyProvider();
  const orchestrator = new AIOrchestrator(createAIProvider(env), new ConversationRepository(db));
  const manager = new VoiceSessionManager(
    repo,
    createStt(env),
    createTts(env),
    new OrchestratorVoiceEngine(orchestrator),
    telephony,
    env,
  );
  return { repo, telephony, manager };
}
