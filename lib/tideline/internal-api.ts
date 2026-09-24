import { SignJWT } from "jose";

// Locally sunucusu → Tideline API'sinin /api/v1/internal/* uçları. Her çağrı
// 60 saniyelik bir servis token'ı taşır: SSO ile aynı sır (TIDELINE_JWT_SECRET,
// HS256), iss="locally" ama aud="tideline-service" — Tideline bunu ne kullanıcı
// oturumu ne de SSO assertion'ı olarak kabul eder (bkz. tideline AuthService).
// Yalnızca sunucu tarafında çağrılır.

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

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 20_000;

function getInternalConfig() {
  const secret = process.env.TIDELINE_JWT_SECRET;
  const apiUrl = process.env.TIDELINE_API_URL;
  if (!secret || secret.length < 32 || !apiUrl) return null;
  return { secret, apiUrl: apiUrl.replace(/\/+$/, "") };
}

export function isTidelineApiConfigured() {
  return getInternalConfig() !== null;
}

async function callTideline<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Result<T>> {
  const config = getInternalConfig();
  if (!config) return { ok: false, error: "Tideline API yapılandırılmamış (TIDELINE_API_URL / TIDELINE_JWT_SECRET)." };

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("locally")
    .setAudience("tideline-service")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(config.secret));

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "X-Service-Token": token,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
