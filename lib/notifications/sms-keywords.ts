// SMS uyum anahtar kelimeleri (TCPA / CTIA). Twilio gibi yalnızca mesajın TAMAMI anahtar
// kelimeyse sayılır ("stop by at 7" bir opt-out değildir). FCC'nin 2025 kuralı "revoke",
// "opt out" gibi ifadeleri de kapsıyor; İspanyolca yazanlar için karşılıkları da var.
// Tideline'daki tideline/apps/api/src/notifications/sms-keywords.ts ile aynı liste (ayrı paket).
export type SmsKeyword = "STOP" | "START" | "HELP";

const STOP = ["STOP", "STOPALL", "STOP ALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "OPT OUT", "REVOKE", "ALTO", "PARAR", "DETENER", "CANCELAR", "BAJA"];
const START = ["START", "UNSTOP", "YES", "SUBSCRIBE", "OPTIN", "OPT IN"];
const HELP = ["HELP", "INFO", "AYUDA"];

/** Twilio Advanced Opt-Out açıksa OptOutType gönderir; yoksa mesaj gövdesini kendimiz sınıflarız. */
export function smsKeyword(body: string | null | undefined, optOutType?: string | null): SmsKeyword | null {
  const type = optOutType?.trim().toUpperCase();
  if (type === "STOP" || type === "START" || type === "HELP") return type;
  const text = (body ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (STOP.includes(text)) return "STOP";
  if (START.includes(text)) return "START";
  if (HELP.includes(text)) return "HELP";
  return null;
}
