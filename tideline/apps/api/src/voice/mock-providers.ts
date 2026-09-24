import type {
  SpeechToTextProvider,
  TextToSpeechProvider,
} from "./contracts.js";
/** Test-mode STT: transcripts are injected through the test session events endpoint. */
export class MockSttProvider implements SpeechToTextProvider {
  sessions = new Set<string>();
  async startSession({ sessionId }: { sessionId: string }) {
    this.sessions.add(sessionId);
  }
  async sendAudio(id: string, audio: Buffer) { void id; void audio; }
  async endSession(id: string) {
    this.sessions.delete(id);
  }
}
export class MockTtsProvider implements TextToSpeechProvider {
  async synthesize({ text }: { text: string }) {
    return { buffer: Buffer.from(text), encoding: "pcm_s16le" as const, sampleRateHz: 8000, channels: 1 as const };
  }
}
