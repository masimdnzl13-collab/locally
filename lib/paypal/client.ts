import { X509Certificate, createPublicKey, verify as verifySignature } from "node:crypto";

// PayPal REST istemcisi (ABD pazarı: abonelik + etkinlik bileti). Resmi bir
// Node SDK'sı yerine doğrudan REST: ihtiyaç duyulan uçlar az ve SDK'lar
// Subscriptions API'sini kapsamıyor.
//
// TEST MODU: PAYPAL_ENV varsayılanı "sandbox" (api-m.sandbox.paypal.com).
// Canlı ortam (PAYPAL_ENV=live) yalnızca PAYPAL_LIVE_MODE=true ile açılır —
// gerçek hesaptan yanlışlıkla para çekilmesin diye (Stripe'taki sk_live_
// korumasının eşdeğeri). Kimlik bilgisi yoksa null döner; çağıran taraf bunu
// "simülasyon" sinyali olarak kullanır (bkz. lib/payments/paypal-provider.ts).

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  live: boolean;
}

export function getPayPalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const live = process.env.PAYPAL_ENV === "live";
  if (live && process.env.PAYPAL_LIVE_MODE !== "true") {
    throw new Error("PAYPAL_ENV=live ama PAYPAL_LIVE_MODE=true değil. Test için PAYPAL_ENV=sandbox kullan.");
  }
  return {
    clientId,
    clientSecret,
    live,
    baseUrl: live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
  };
}

export class PayPalApiError extends Error {
  constructor(
    public status: number,
    public issue: string | null,
    message: string,
  ) {
    super(message);
    this.name = "PayPalApiError";
  }
}

let cachedToken: { value: string; expiresAt: number; key: string } | null = null;

async function accessToken(config: PayPalConfig): Promise<string> {
  const key = `${config.baseUrl}:${config.clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new PayPalApiError(res.status, null, body.error_description ?? `PayPal kimlik doğrulaması başarısız (${res.status})`);
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000, key };
  return body.access_token;
}

/**
 * PayPal REST çağrısı. requestId verilirse PayPal-Request-Id başlığıyla gider:
 * aynı istek tekrarlanırsa (ör. capture) PayPal ikinci kez işlem yapmaz,
 * ilk yanıtı döner.
 */
export async function paypalRequest<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const config = getPayPalConfig();
  if (!config) throw new PayPalApiError(0, null, "PayPal yapılandırılmamış (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).");

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${await accessToken(config)}`,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init.requestId ? { "paypal-request-id": init.requestId } : {}),
      prefer: "return=representation",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    details?: { issue?: string; description?: string }[];
  };
  if (!res.ok) {
    const detail = body.details?.[0];
    throw new PayPalApiError(
      res.status,
      detail?.issue ?? null,
      detail?.description ?? body.message ?? `PayPal isteği başarısız (${res.status})`,
    );
  }
  return body;
}

export function approveLink(links: { rel: string; href: string }[] | undefined): string | null {
  return links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
}

/* ------------------------------------------------------------------------- */
/* Webhook imza doğrulaması                                                  */
/* ------------------------------------------------------------------------- */
//
// PayPal'ın belgelediği "kendin doğrula" yöntemi: her webhook şu başlıklarla
// gelir — paypal-transmission-id, paypal-transmission-time,
// paypal-transmission-sig, paypal-cert-url, paypal-auth-algo. İmzalanan dize:
//   <transmission-id>|<transmission-time>|<webhook-id>|<crc32(ham gövde), ondalık>
// Bu dize, paypal-cert-url'deki sertifikanın açık anahtarıyla SHA256withRSA
// olarak doğrulanır. webhook-id bizim PayPal panelinde oluşturduğumuz
// webhook'un kimliğidir (PAYPAL_WEBHOOK_ID) — başka bir hesabın/webhook'un
// imzaladığı olay bu yüzden geçmez.
//
// Sertifika adresine güvenmeden önce: yalnızca https ve yalnızca PayPal'ın
// alan adları (*.paypal.com). Sertifika HTTPS ile PayPal'dan indirildiği için
// kaynağı TLS ile doğrulanmış olur; ayrıca geçerlilik tarihleri ve konu adı
// kontrol edilir.

const CERT_HOST = /^([a-z0-9-]+\.)*paypal\.com$/i;
const certCache = new Map<string, { pem: string; fetchedAt: number }>();
const CERT_CACHE_MS = 24 * 60 * 60 * 1000;

let crcTable: Uint32Array | null = null;
export function crc32(data: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function fetchCertificate(certUrl: string): Promise<string> {
  const cached = certCache.get(certUrl);
  if (cached && Date.now() - cached.fetchedAt < CERT_CACHE_MS) return cached.pem;
  const res = await fetch(certUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`PayPal sertifikası indirilemedi (${res.status})`);
  const pem = await res.text();
  certCache.set(certUrl, { pem, fetchedAt: Date.now() });
  return pem;
}

export async function verifyPayPalWebhookSignature(input: {
  rawBody: string;
  headers: Headers;
  webhookId: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = (name: string) => input.headers.get(name);
  const transmissionId = h("paypal-transmission-id");
  const transmissionTime = h("paypal-transmission-time");
  const signature = h("paypal-transmission-sig");
  const certUrl = h("paypal-cert-url");
  const algo = h("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !signature || !certUrl || !algo) {
    return { ok: false, error: "PayPal imza başlıkları eksik" };
  }
  if (algo !== "SHA256withRSA") return { ok: false, error: `Desteklenmeyen imza algoritması: ${algo}` };

  let url: URL;
  try {
    url = new URL(certUrl);
  } catch {
    return { ok: false, error: "Geçersiz paypal-cert-url" };
  }
  if (url.protocol !== "https:" || !CERT_HOST.test(url.hostname)) {
    return { ok: false, error: "paypal-cert-url PayPal'a ait değil" };
  }

  let pem: string;
  try {
    pem = await fetchCertificate(url.toString());
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  let cert: X509Certificate;
  try {
    cert = new X509Certificate(pem);
  } catch {
    return { ok: false, error: "PayPal sertifikası okunamadı" };
  }
  const now = input.now ?? new Date();
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
    return { ok: false, error: "PayPal sertifikasının süresi geçerli değil" };
  }
  if (!/paypal/i.test(cert.subject)) return { ok: false, error: "Sertifika PayPal'a ait değil" };

  const message = `${transmissionId}|${transmissionTime}|${input.webhookId}|${crc32(Buffer.from(input.rawBody, "utf8"))}`;
  const valid = verifySignature(
    "sha256",
    Buffer.from(message, "utf8"),
    createPublicKey(cert.publicKey.export({ type: "spki", format: "pem" })),
    Buffer.from(signature, "base64"),
  );
  return valid ? { ok: true } : { ok: false, error: "PayPal webhook imzası doğrulanamadı" };
}

/** Yalnızca testler için: modül seviyesindeki önbellekleri sıfırlar. */
export function resetPayPalCachesForTests() {
  cachedToken = null;
  certCache.clear();
}
