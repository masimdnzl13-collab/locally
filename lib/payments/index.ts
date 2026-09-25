import { paypalPaymentProvider } from "@/lib/payments/paypal-provider";
import { testModePaymentService } from "@/lib/payments/test-mode-service";
import type { PaymentService } from "@/lib/payments/types";
import type { BusinessMarket } from "@/lib/types";

// Sağlayıcı işletmenin pazarına (businesses.market) göre seçilir:
//   TR → iyzico. Gerçek iyzico PaymentService'i hazır olana kadar test modu
//        servisi onun yerini tutar; hazır olduğunda yalnızca bu satır değişir.
//   US → PayPal (bkz. lib/payments/paypal-provider.ts).
// lib/payments/stripe-provider.ts aynı arayüzün Stripe uygulaması olarak
// duruyor ama aktif seçimde değil; geri dönmek için US satırını
// stripePaymentProvider yapmak (ve webhook'u /api/webhooks/stripe'a almak) yeter.
const providers: Record<BusinessMarket, PaymentService> = {
  TR: testModePaymentService,
  US: paypalPaymentProvider,
};

export function getPaymentService(market: BusinessMarket): PaymentService {
  return providers[market];
}

export * from "@/lib/payments/types";
