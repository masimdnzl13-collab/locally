import Iyzipay from "iyzipay";

let cached: Iyzipay | null | undefined;

// Anahtarlar tanımlı değilse null döner — çağıran kod bunu "test modu"
// sinyali olarak kullanır (bkz. lib/iyzico/service.ts), tıpkı
// lib/payments ve lib/notifications katmanlarındaki gibi.
export function getIyzicoClient(): Iyzipay | null {
  if (cached !== undefined) return cached;

  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const uri = process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com";

  if (!apiKey || !secretKey) {
    cached = null;
    return cached;
  }

  cached = new Iyzipay({ apiKey, secretKey, uri });
  return cached;
}
