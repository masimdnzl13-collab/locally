import { createServiceClient } from "@/lib/supabase/service";

// AM — STOP diyen numaralar (public.sms_opt_outs). Gönderim tarafı yalnızca
// isSmsOptedOut'u çağırır; yazma tarafı Twilio gelen-SMS webhook'u
// (/api/webhooks/twilio/sms) ve 21610 hatası (Twilio'nun "bu kişi STOP dedi" reddi).

/** ABD numarası mı — service.ts'teki yönlendirmeyle aynı kural. */
export function isUsNumber(to: string) {
  const digits = to.replace(/\D/g, "");
  return to.trim().startsWith("+1") || (digits.length === 11 && digits.startsWith("1"));
}

/** Kayıt anahtarı: ülke kodlu rakamlar (+ yok). "(555) 123-4567" → "15551234567". */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (isUsNumber(phone)) return digits;
  // Ülke kodsuz numaralar service.ts'te TR sayılır (Netgsm): 05xx… / 5xx… → 905xx…
  if (digits.length === 11 && digits.startsWith("0")) return "90" + digits.slice(1);
  if (digits.length === 10) return "90" + digits;
  return digits;
}

// Aynı kişi farklı yazılmış olabilir; hepsine bakılır, biri bile "çıktı" diyorsa gönderilmez.
function candidateKeys(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const keys = new Set([phoneKey(phone), digits]);
  if (digits.length === 10) keys.add("1" + digits);
  return Array.from(keys).filter((k) => /^[0-9]{8,15}$/.test(k));
}

export async function isSmsOptedOut(phone: string): Promise<boolean> {
  const keys = candidateKeys(phone);
  if (keys.length === 0) return false;
  const { data, error } = await createServiceClient()
    .from("sms_opt_outs")
    .select("phone_digits")
    .in("phone_digits", keys)
    .eq("opted_out", true)
    .limit(1);
  if (error) throw new Error(`sms_opt_outs okunamadı: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function recordSmsConsent(
  phone: string,
  input: { optedOut: boolean; source: "sms_keyword" | "carrier"; keyword?: string }
) {
  const key = phoneKey(phone);
  if (!/^[0-9]{8,15}$/.test(key)) return;
  const now = new Date().toISOString();
  const { error } = await createServiceClient()
    .from("sms_opt_outs")
    .upsert(
      {
        phone_digits: key,
        opted_out: input.optedOut,
        source: input.source,
        last_keyword: input.keyword ?? null,
        opted_out_at: input.optedOut ? now : null,
        updated_at: now,
      },
      { onConflict: "phone_digits" }
    );
  if (error) throw new Error(`sms_opt_outs yazılamadı: ${error.message}`);
}
