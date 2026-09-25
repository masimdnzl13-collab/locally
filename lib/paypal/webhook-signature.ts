import { X509Certificate, verify as verifySignature } from "node:crypto";
import { crc32 } from "node:zlib";

// PayPal webhook imza doğrulaması — PayPal'ın kendi yöntemi, API'ye
// "verify-webhook-signature" çağrısı yapmadan (çevrimdışı):
//
//   imzalanan mesaj = <paypal-transmission-id>|<paypal-transmission-time>|<webhook id>|<ham gövdenin CRC32'si (ondalık)>
//   imza           = paypal-transmission-sig (base64), algoritma paypal-auth-algo (SHA256withRSA)
//   açık anahtar   = paypal-cert-url'deki X.509 sertifikası
//
// Sertifika adresi başlıktan geldiği için saldırgan kendi sertifikasını
// gösterebilir; bu yüzden yalnızca PayPal'ın kendi alan adlarından HTTPS ile
// indirilen, süresi geçerli sertifikalar kabul edilir. Webhook id
// (PAYPAL_WEBHOOK_ID) mesaja girdiği için başka bir PayPal hesabının/uç
// noktasının geçerli imzalı olayı da buraya taşınamaz.

const CERT_HOSTS = new Set([
  "api.paypal.com",
  "api-m.paypal.com",
  "api.sandbox.paypal.com",
  "api-m.sandbox.paypal.com",
]);

export type SignatureCheck = { ok: true } | { ok: false; error: string };

export type CertFetcher = (url: string) => Promise<string>;

const certCache = new Map<string, X509Certificate>();

const defaultFetcher: CertFetcher = async (url) => {
  const res = await fetch(url, { cache: "no-store", redirect: "error" });
  if (!res.ok) throw new Error(`Sertifika indirilemedi (${res.status})`);
  return res.text();
};

export function isAllowedCertUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    !url.username &&
    CERT_HOSTS.has(url.hostname) &&
    url.pathname.startsWith("/v1/notifications/certs/")
  );
}

async function loadCert(url: string, fetcher: CertFetcher): Promise<X509Certificate> {
  const cached = certCache.get(url);
  if (cached) return cached;
  const cert = new X509Certificate(await fetcher(url));
  certCache.set(url, cert);
  return cert;
}

export async function verifyPayPalWebhookSignature(
  rawBody: string,
  headers: Headers,
  webhookId: string,
  options: { fetchCert?: CertFetcher; now?: Date } = {}
): Promise<SignatureCheck> {
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const signature = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const algo = headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !signature || !certUrl || !algo) {
    return { ok: false, error: "PayPal imza başlıkları eksik" };
  }
  if (algo !== "SHA256withRSA") return { ok: false, error: `Desteklenmeyen imza algoritması: ${algo}` };
  if (!isAllowedCertUrl(certUrl)) return { ok: false, error: "Sertifika adresi PayPal'a ait değil" };

  let cert: X509Certificate;
  try {
    cert = await loadCert(certUrl, options.fetchCert ?? defaultFetcher);
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Sertifika okunamadı" };
  }
  const now = options.now ?? new Date();
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
    certCache.delete(certUrl);
    return { ok: false, error: "PayPal sertifikasının süresi geçerli değil" };
  }

  const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(Buffer.from(rawBody, "utf8")) >>> 0}`;
  const valid = verifySignature("sha256", Buffer.from(message, "utf8"), cert.publicKey, Buffer.from(signature, "base64"));
  return valid ? { ok: true } : { ok: false, error: "Webhook imzası doğrulanamadı" };
}

export function clearPayPalCertCache() {
  certCache.clear();
}
