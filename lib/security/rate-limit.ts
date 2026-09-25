import { createServiceClient } from "@/lib/supabase/service";

// Halka açık uçlar için IP başına sabit pencereli sınır (sayaç Postgres'te,
// bkz. *_rate_limits.sql). Veritabanına ulaşılamazsa isteği ENGELLEMEZ —
// rate limit bir koruma katmanı, kayıt/SSO'nun tek bağımlılığı olmamalı.

export const RATE_LIMITS = {
  // Panel iframe'i oturum düşünce yeniden bağlanır; normal kullanım dakikada birkaç istek.
  tidelineSso: { limit: 20, windowSeconds: 60 },
  usSignup: { limit: 5, windowSeconds: 60 },
  // /privacy talep formu: gerçek bir kişi birkaç talep gönderir, fazlası spam.
  privacyRequest: { limit: 5, windowSeconds: 600 },
} as const;

// Vercel x-real-ip'i kendisi yazar; x-forwarded-for'un ilk girdisi yedek.
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function rateLimit(
  scope: keyof typeof RATE_LIMITS,
  ip: string
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const { limit, windowSeconds } = RATE_LIMITS[scope];
  const { data, error } = await createServiceClient().rpc("rate_limit_hit", {
    p_key: `${scope}:${ip}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit]", scope, error.message);
    return { ok: true };
  }
  if (data === false) {
    const retryAfterSeconds = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
    return { ok: false, retryAfterSeconds };
  }
  return { ok: true };
}
