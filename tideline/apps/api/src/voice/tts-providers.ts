import type { Language, TextToSpeechProvider, TtsAudio } from "./contracts.js";

/** Env voice values like "en-US" are locales, not provider voices: map them to a sensible default. */
const isLocale = (voice: string) => /^[a-z]{2}(-[A-Z]{2})?$/.test(voice);

async function audioResponse(response: Response, provider: string): Promise<TtsAudio> {
  if (!response.ok) {
    // Only the provider's error code, never the body: TTS error bodies can echo the text being
    // spoken (the assistant's reply, i.e. order contents), and this message reaches logs.
    const body = (await response.json().catch(() => null)) as { err_code?: unknown; detail?: { status?: unknown } } | null;
    const code = typeof body?.err_code === "string" ? body.err_code : typeof body?.detail?.status === "string" ? body.detail.status : undefined;
    throw new Error(`${provider} TTS failed with HTTP ${response.status}${code ? ` (${code.slice(0, 64)})` : ""}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    encoding: "mulaw",
    sampleRateHz: 8000,
    channels: 1,
  };
}

/** Deepgram Aura: returns raw 8 kHz μ-law, so no transcoding is needed for Twilio. */
export class DeepgramTtsProvider implements TextToSpeechProvider {
  static defaultVoice: Record<Language, string> = { en: "aura-2-thalia-en", es: "aura-2-celeste-es" };
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  async synthesize(input: { text: string; voice: string; language: Language }, signal?: AbortSignal) {
    const model = isLocale(input.voice) ? DeepgramTtsProvider.defaultVoice[input.language] : input.voice;
    const params = new URLSearchParams({ model, encoding: "mulaw", sample_rate: "8000", container: "none" });
    const response = await this.fetchImpl(`https://api.deepgram.com/v1/speak?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text }),
      signal,
    });
    return audioResponse(response, "Deepgram");
  }
}

/** ElevenLabs: `ulaw_8000` output is Twilio-ready. Voices are ElevenLabs voice ids. */
export class ElevenLabsTtsProvider implements TextToSpeechProvider {
  // Premade "Sarah" voice; eleven_flash_v2_5 is multilingual, so it also speaks Spanish.
  // Override with VOICE_ENGLISH_VOICE / VOICE_SPANISH_VOICE voice ids.
  static defaultVoice: Record<Language, string> = { en: "EXAVITQu4vr4xnSDxMaL", es: "EXAVITQu4vr4xnSDxMaL" };
  constructor(
    private readonly apiKey: string,
    private readonly model = "eleven_flash_v2_5",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  async synthesize(input: { text: string; voice: string; language: Language }, signal?: AbortSignal) {
    const voice = isLocale(input.voice) ? ElevenLabsTtsProvider.defaultVoice[input.language] : input.voice;
    const response = await this.fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=ulaw_8000`,
      {
        method: "POST",
        headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json", Accept: "audio/basic" },
        body: JSON.stringify({ text: input.text, model_id: this.model, language_code: input.language }),
        signal,
      },
    );
    return audioResponse(response, "ElevenLabs");
  }
}
