import { SignJWT } from "jose";

// Locally sunucusu → Tideline API'sinin /api/v1/internal/* uçları: tek giriş
// noktası. Her çağrı 60 saniyelik bir servis token'ı taşır: SSO ile aynı sır
// (TIDELINE_JWT_SECRET, HS256), iss="locally" ama aud="tideline-service" —
// Tideline bunu ne kullanıcı oturumu ne de SSO assertion'ı olarak kabul eder
// (bkz. tideline AuthService.verifyServiceToken). Authorization yerine
// X-Service-Token başlığıyla gider. Yalnızca sunucu tarafında çağrılır.

const SERVICE_TOKEN_TTL_SECONDS = 60;
const DEFAULT_TIMEOUT_MS = 20_000;
// Admin sayfalarını besleyen okuma çağrıları: Tideline yavaşsa sayfa beklemesin.
const READ_TIMEOUT_MS = 6000;

export type TidelinePhone =
  | { status: "active"; id: string; phoneNumber: string }
  | { status: "pending_manual"; id: string; phoneNumber: null; failureReason: string };

export interface TidelinePendingNumber {
  id: string;
  restaurantId: string;
  restaurantName: string;
  externalRef: string | null;
  failureReason: string | null;
  createdAt: string;
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

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function getServiceConfig() {
  const secret = process.env.TIDELINE_JWT_SECRET;
  const apiUrl = process.env.TIDELINE_API_URL;
  if (!secret || secret.length < 32 || !apiUrl) return null;
  return { secret, apiUrl: apiUrl.replace(/\/+$/, "") };
}

export function isTidelineApiConfigured() {
  return getServiceConfig() !== null;
}

function mintServiceToken(secret: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("locally")
    .setAudience("tideline-service")
    .setIssuedAt()
    .setExpirationTime(`${SERVICE_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

async function callTideline<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<Result<T>> {
  const config = getServiceConfig();
  if (!config) return { ok: false, error: "Tideline API yapılandırılmamış (TIDELINE_API_URL / TIDELINE_JWT_SECRET)." };

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "X-Service-Token": await mintServiceToken(config.secret),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !data) {
      return { ok: false, error: data?.error?.message ?? `Tideline API hata: ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Tideline API'ye ulaşılamadı" };
  }
}

// İdempotent: aynı Locally işletmesi (externalRef) için tekrar çağrılırsa
// Tideline aynı restoranı döner, ikinci bir numara satın almaz.
export function provisionTidelineRestaurant(input: {
  businessId: string;
  name: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  return callTideline<{ restaurant: { id: string; name: string }; phone: TidelinePhone | null }>(
    "/api/v1/internal/provisioning/restaurants",
    {
      method: "POST",
      body: {
        externalRef: input.businessId,
        name: input.name,
        contactPhone: input.contactPhone,
        address: input.address,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
      },
    }
  );
}

export function listPendingTidelineNumbers() {
  return callTideline<{ numbers: TidelinePendingNumber[] }>("/api/v1/internal/provisioning/phone-numbers/pending");
}

export function retryTidelineNumber(numberId: string) {
  return callTideline<{ phone: TidelinePhone }>(
    `/api/v1/internal/provisioning/phone-numbers/${encodeURIComponent(numberId)}/retry`,
    { method: "POST" }
  );
}

export function assignTidelineNumber(numberId: string, phoneNumber: string) {
  return callTideline<{ phone: TidelinePhone }>(
    `/api/v1/internal/provisioning/phone-numbers/${encodeURIComponent(numberId)}/assign`,
    { method: "POST", body: { phoneNumber } }
  );
}

export interface TidelineBrainReadiness {
  hoursDays: number;
  menuItems: number;
}

// Onboarding menü adımı: restoranın Brain'inde kaç günün saati ve kaç aktif
// menü kalemi var (eşik Locally'de, bkz. lib/onboarding-us/complete.ts).
export function getTidelineBrainReadiness(restaurantId: string) {
  return callTideline<TidelineBrainReadiness>(
    `/api/v1/internal/restaurants/${encodeURIComponent(restaurantId)}/brain-readiness`,
    { timeoutMs: READ_TIMEOUT_MS }
  );
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
  if (!isTidelineApiConfigured()) return { ok: false, reason: "not_configured" };
  if (restaurantIds.length === 0) return { ok: true, byRestaurant: new Map(), thresholdUsd: 0 };

  const ids = restaurantIds.slice(0, 200).map(encodeURIComponent).join(",");
  const result = await callTideline<{ restaurants: TidelineActivity[]; thresholdUsd: number }>(
    `/api/v1/internal/restaurants/activity?ids=${ids}`,
    { timeoutMs: READ_TIMEOUT_MS }
  );
  if (!result.ok) return { ok: false, reason: "unavailable" };
  return {
    ok: true,
    byRestaurant: new Map(result.data.restaurants.map((r) => [r.restaurantId, r])),
    thresholdUsd: result.data.thresholdUsd,
  };
}
