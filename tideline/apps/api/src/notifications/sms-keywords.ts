// SMS compliance keywords (TCPA / CTIA). Twilio matches its own list only when the whole
// message is the keyword; we do the same so "stop by at 7" is not an opt-out. The FCC's 2025
// revocation rule also counts "revoke", "opt out" and plain-language equivalents, and Spanish
// speakers text in Spanish, so both are included. Keep in sync with lib/notifications/sms-keywords.ts
// in Locally (separate package, same list).
export type SmsKeyword = "STOP" | "START" | "HELP";

const STOP = ["STOP", "STOPALL", "STOP ALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT OUT", "REVOKE", "ALTO", "PARAR", "DETENER", "CANCELAR", "BAJA"];
const START = ["START", "UNSTOP", "YES", "SUBSCRIBE", "OPTIN", "OPT IN"];
const HELP = ["HELP", "INFO", "AYUDA"];

/** Twilio's Advanced Opt-Out sends OptOutType; without it we classify the message body ourselves. */
export function smsKeyword(body: string | undefined, optOutType?: string): SmsKeyword | null {
  const type = optOutType?.trim().toUpperCase();
  if (type === "STOP" || type === "START" || type === "HELP") return type;
  const text = (body ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (STOP.includes(text)) return "STOP";
  if (START.includes(text)) return "START";
  if (HELP.includes(text)) return "HELP";
  return null;
}

/** US numbers in any common spelling → E.164, so "(555) 123-4567" and "+15551234567" are one person. */
export function toE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return trimmed.startsWith("+") ? "+" + digits : digits;
}
