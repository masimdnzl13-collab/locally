import type { Language } from "./contracts.js";

// What the caller hears when the AI/STT/TTS pipeline fails mid-call (see
// VoiceSessionManager.fail). It is spoken by Twilio's own <Say>, not our TTS, because the TTS
// provider may be the thing that failed. Kept short: the caller is already waiting.

/** "+13055550123" → "3 0 5, 5 5 5, 0 1 2 3" so <Say> reads it digit by digit with pauses. */
export function speakablePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return undefined;
  const spaced = (part: string) => part.split("").join(" ");
  return `${spaced(national.slice(0, 3))}, ${spaced(national.slice(3, 6))}, ${spaced(national.slice(6))}`;
}

export function callFailureMessage(input: { language: Language; restaurantPhone?: string; transfer?: boolean }): string {
  const phone = input.restaurantPhone ? speakablePhone(input.restaurantPhone) : undefined;
  if (input.language === "es") {
    if (input.transfer) return "Lo sentimos, tenemos un problema técnico. Le comunicamos con el restaurante.";
    return (
      "Lo sentimos, en este momento no podemos atender su llamada. Por favor, vuelva a llamar en unos minutos." +
      (phone ? ` También puede comunicarse directamente con el restaurante al ${phone}.` : "")
    );
  }
  if (input.transfer) return "Sorry, we're having a technical problem. Let me connect you to the restaurant.";
  return (
    "We're sorry, we can't take your call right now. Please call again in a few minutes." +
    (phone ? ` You can also reach the restaurant directly at ${phone}.` : "")
  );
}
