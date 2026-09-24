import WebSocket from "ws";
import type {
  Language,
  SpeechSessionInput,
  SpeechToTextProvider,
} from "./contracts.js";

type DeepgramResult = {
  type: "Results";
  is_final?: boolean;
  speech_final?: boolean;
  channel?: { alternatives?: Array<{ transcript?: string; confidence?: number; languages?: string[] }> };
};
type Session = {
  socket: WebSocket;
  input: SpeechSessionInput;
  /** Final segments of the utterance currently being spoken. */
  segments: string[];
  language?: Language;
  confidence?: number;
  keepAlive: ReturnType<typeof setInterval>;
  sequence: number;
  closing: boolean;
};
const toLanguage = (code?: string): Language | undefined =>
  code?.startsWith("es") ? "es" : code?.startsWith("en") ? "en" : undefined;

/**
 * Streaming speech-to-text over Deepgram's live WebSocket API, fed with the
 * raw 8 kHz μ-law frames Twilio Media Streams deliver.
 */
export class DeepgramSttProvider implements SpeechToTextProvider {
  private sessions = new Map<string, Session>();
  constructor(
    private readonly options: {
      apiKey: string;
      model?: string;
      endpointingMs?: number;
      url?: string;
    },
  ) {}
  private url() {
    const params = new URLSearchParams({
      model: this.options.model ?? "nova-3",
      // Multilingual code-switching covers English and Spanish callers on one stream.
      language: "multi",
      encoding: "mulaw",
      sample_rate: "8000",
      channels: "1",
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      endpointing: String(this.options.endpointingMs ?? 400),
      utterance_end_ms: "1000",
      vad_events: "true",
    });
    return `${this.options.url ?? "wss://api.deepgram.com/v1/listen"}?${params}`;
  }
  async startSession(input: SpeechSessionInput, signal?: AbortSignal): Promise<void> {
    await this.endSession(input.sessionId);
    const socket = new WebSocket(this.url(), {
      headers: { Authorization: `Token ${this.options.apiKey}` },
    });
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        socket.terminate();
        reject(new Error("Deepgram connection aborted"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      socket.once("open", () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      });
      socket.once("error", (error) => {
        signal?.removeEventListener("abort", abort);
        reject(error);
      });
    });
    const session: Session = {
      socket,
      input,
      segments: [],
      keepAlive: setInterval(() => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "KeepAlive" }));
      }, 5000),
      sequence: 0,
      closing: false,
    };
    this.sessions.set(input.sessionId, session);
    socket.on("message", (raw) => void this.onMessage(session, raw.toString()));
    socket.on("error", (error) => void input.onError?.(error));
    socket.on("close", () => {
      clearInterval(session.keepAlive);
      if (this.sessions.get(input.sessionId) === session) this.sessions.delete(input.sessionId);
      if (!session.closing) void input.onError?.(new Error("Deepgram stream closed unexpectedly"));
      void input.onClosed?.();
    });
  }
  private async flush(session: Session) {
    const text = session.segments.join(" ").replace(/\s+/g, " ").trim();
    session.segments = [];
    if (!text) return;
    await session.input.onTranscript({
      sessionId: session.input.sessionId,
      text,
      isFinal: true,
      confidence: session.confidence,
      language: session.language,
      sequence: ++session.sequence,
    });
  }
  private async onMessage(session: Session, raw: string) {
    let message: DeepgramResult | { type: string };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      if (message.type === "UtteranceEnd") return await this.flush(session);
      if (message.type !== "Results") return;
      const result = message as DeepgramResult;
      const alternative = result.channel?.alternatives?.[0];
      const text = alternative?.transcript?.trim() ?? "";
      if (text) {
        session.language = toLanguage(alternative?.languages?.[0]) ?? session.language;
        session.confidence = alternative?.confidence;
      }
      if (!result.is_final) {
        // Interim words mean the caller is talking: used for barge-in.
        if (text)
          await session.input.onTranscript({ sessionId: session.input.sessionId, text, isFinal: false, language: session.language });
        return;
      }
      if (text) session.segments.push(text);
      if (result.speech_final) await this.flush(session);
    } catch (error) {
      await session.input.onError?.(error);
    }
  }
  async sendAudio(sessionId: string, audio: Buffer): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.socket.readyState === WebSocket.OPEN) session.socket.send(audio);
  }
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.closing = true;
    this.sessions.delete(sessionId);
    clearInterval(session.keepAlive);
    if (session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify({ type: "CloseStream" }));
      session.socket.close();
    } else session.socket.terminate();
  }
}
