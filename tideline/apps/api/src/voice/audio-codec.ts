import type { TtsAudio } from "./contracts.js";
/** Convert signed little-endian PCM16 samples to Twilio's 8 kHz μ-law payload. */
export function pcm16ToMuLaw(input: Buffer): Buffer {
  const output = Buffer.alloc(Math.floor(input.length / 2));
  for (let i = 0; i < output.length; i++) {
    let sample = input.readInt16LE(i * 2);
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    const exponent = Math.min(7, Math.max(0, Math.floor(Math.log2(Math.max(sample, 1))) - 4));
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    output[i] = ~(sign | (exponent << 4) | mantissa) & 0xff;
  }
  return output;
}
/** Linear-interpolation resample of mono PCM16 to 8 kHz. */
export function resamplePcm16To8k(input: Buffer, sampleRateHz: number): Buffer {
  if (sampleRateHz === 8000) return input;
  const samples = Math.floor(input.length / 2);
  const outSamples = Math.floor((samples * 8000) / sampleRateHz);
  const output = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const position = (i * sampleRateHz) / 8000;
    const left = Math.min(samples - 1, Math.floor(position));
    const right = Math.min(samples - 1, left + 1);
    const fraction = position - left;
    const value = input.readInt16LE(left * 2) * (1 - fraction) + input.readInt16LE(right * 2) * fraction;
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(value))), i * 2);
  }
  return output;
}
/** Normalises any TTS output to Twilio's 8 kHz μ-law. */
export function toTwilioMuLaw(audio: TtsAudio): Buffer {
  if (audio.encoding === "mulaw") return audio.buffer;
  return pcm16ToMuLaw(resamplePcm16To8k(audio.buffer, audio.sampleRateHz));
}
/** Playback duration of 8 kHz μ-law audio (one byte per sample). */
export const muLawDurationMs = (audio: Buffer) => Math.ceil(audio.length / 8);
