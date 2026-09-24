import Stripe from "stripe";

let cached: Stripe | null | undefined;

// Anahtar tanımlı değilse null döner — çağıran kod bunu "simülasyon" sinyali
// olarak kullanır (bkz. lib/payments/stripe-provider.ts), tıpkı
// lib/iyzico/client.ts'teki gibi.
//
// TEST MODU: şu an yalnızca sk_test_... anahtarları kabul edilir. Canlı
// (sk_live_...) anahtar, STRIPE_LIVE_MODE=true açıkça ayarlanmadıkça
// reddedilir — gerçek karttan yanlışlıkla para çekilmesin diye.
export function getStripeClient(): Stripe | null {
  if (cached !== undefined) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    cached = null;
    return cached;
  }

  if (secretKey.startsWith("sk_live_") && process.env.STRIPE_LIVE_MODE !== "true") {
    throw new Error(
      "STRIPE_SECRET_KEY canlı (sk_live_) anahtar ama STRIPE_LIVE_MODE=true değil. Test için sk_test_ anahtarı kullan."
    );
  }

  cached = new Stripe(secretKey, { appInfo: { name: "Locally" } });
  return cached;
}
