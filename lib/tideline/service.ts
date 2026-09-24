import { SignJWT } from "jose";

// Locally sunucusu → Tideline API servis-servis çağrıları (P3 SSO köprüsüyle
// aynı desen): Tideline'ın JWT_SECRET'ı ile HS256, iss="locally",
// aud="tideline-service", 60 sn ömür. Kullanıcı oturumu DEĞİLDİR —
// Authorization yerine X-Service-Token başlığıyla gider, Tideline tarafında
// yalnızca /api/v1/internal/* uçları kabul eder (AuthService.verifyServiceToken).
const SERVICE_TOKEN_TTL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 6000;

export function getTidelineApiConfig() {
  const secret = process.env.TIDELINE_JWT_SECRET;
  const apiUrl = process.env.TIDELINE_API_URL;
  if (!secret || secret.length < 32 || !apiUrl) return null;
  return { secret, apiUrl: apiUrl.replace(/\/+$/, "") };
}

async function mintServiceToken(secret: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("locally")
    .setAudience("tideline-service")
    .setSubject("locally-admin")
    .setIssuedAt()
    .setExpirationTime(`${SERVICE_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

export interface TidelineActivity {
  restaurantId: string;
  name: string;
  calls7d: number;
  orders7d: number;
  reservations7d: number;
  costMonthUsd: number;
  costOverThreshold: boolean;
}

export type TidelineActivityResult =
  | { ok: true; byRestaurant: Map<string, TidelineActivity>; thresholdUsd: number }
  | { ok: false; reason: "not_configured" | "unavailable" };

/**
 * Son 7 günün çağrı/sipariş sayıları + bu ayki maliyet, verilen Tideline
 * restoranları için. Tideline erişilemezse sayfa çökmez: ok=false döner ve
 * tablo o sütunları "—" gösterir.
 */
export async function fetchTidelineActivity(restaurantIds: string[]): Promise<TidelineActivityResult> {
  const config = getTidelineApiConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  if (restaurantIds.length === 0) return { ok: true, byRestaurant: new Map(), thresholdUsd: 0 };

  try {
    const url = `${config.apiUrl}/api/v1/internal/restaurants/activity?ids=${restaurantIds
      .slice(0, 200)
      .map(encodeURIComponent)
      .join(",")}`;
    const res = await fetch(url, {
      headers: { "x-service-token": await mintServiceToken(config.secret) },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const body = (await res.json()) as { restaurants: TidelineActivity[]; thresholdUsd: number };
    return {
      ok: true,
      byRestaurant: new Map(body.restaurants.map((r) => [r.restaurantId, r])),
      thresholdUsd: body.thresholdUsd,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
