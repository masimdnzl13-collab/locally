// PayPal REST istemcisi (ABD pazarı ödeme sağlayıcısı, bkz.
// lib/payments/paypal-provider.ts). Resmi SDK yerine doğrudan fetch: yalnızca
// OAuth + birkaç Subscriptions/Orders ucu kullanılıyor.
//
// Kimlik bilgileri tanımlı değilse getPayPalConfig() null döner — çağıran kod
// bunu "simülasyon" sinyali olarak kullanır (lib/stripe/client.ts ile aynı desen).
//
// TEST MODU: varsayılan sandbox (api-m.sandbox.paypal.com). Canlı API'ye
// yalnızca PAYPAL_LIVE_MODE=true açıkça ayarlanınca gidilir — sandbox
// uygulamasının kimlik bilgileriyle yanlışlıkla canlıya (ya da tersi) gidilmesin.

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  live: boolean;
}

const SANDBOX_URL = "https://api-m.sandbox.paypal.com";
const LIVE_URL = "https://api-m.paypal.com";

export function getPayPalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const live = process.env.PAYPAL_LIVE_MODE === "true";
  return { clientId, clientSecret, baseUrl: live ? LIVE_URL : SANDBOX_URL, live };
}

export function isPayPalConfigured(): boolean {
  return getPayPalConfig() !== null;
}

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    // PayPal hata gövdesindeki name / details[0].issue (ör. ORDER_ALREADY_CAPTURED).
    readonly issue: string | null,
    message: string
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}

let cachedToken: { value: string; expiresAt: number; key: string } | null = null;

async function getAccessToken(config: PayPalConfig): Promise<string> {
  const key = `${config.baseUrl}:${config.clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new PayPalApiError(res.status, null, `PayPal kimlik doğrulaması başarısız (${res.status})`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000, key };
  return body.access_token;
}

interface PayPalErrorBody {
  name?: string;
  message?: string;
  details?: { issue?: string; description?: string }[];
}

/**
 * Kimliği doğrulanmış PayPal API çağrısı. 2xx dışı yanıtlarda PayPalApiError
 * fırlatır. requestId verilirse PayPal-Request-Id olarak gider: PayPal aynı
 * kimlikli tekrar isteğe ilk yanıtı döner (ör. aynı siparişi iki kez
 * tahsil etmeye çalışan eşzamanlı istekler).
 */
export async function paypalRequest<T>(
  config: PayPalConfig,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: { body?: unknown; requestId?: string } = {}
): Promise<T> {
  const token = await getAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;

  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!res.ok) {
    let parsed: PayPalErrorBody = {};
    try {
      parsed = JSON.parse(text) as PayPalErrorBody;
    } catch {
      // HTML/boş gövde: yalnızca durum koduyla raporlanır.
    }
    const issue = parsed.details?.[0]?.issue ?? parsed.name ?? null;
    const detail = parsed.details?.[0]?.description ?? parsed.message ?? `HTTP ${res.status}`;
    throw new PayPalApiError(res.status, issue, `PayPal: ${issue ? `${issue} — ` : ""}${detail}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

// Testler modül önbelleğini sıfırlayabilsin.
export function resetPayPalTokenCache() {
  cachedToken = null;
}
