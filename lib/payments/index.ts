import { stripePaymentProvider } from "@/lib/payments/stripe-provider";
import { testModePaymentService } from "@/lib/payments/test-mode-service";
import type { PaymentService } from "@/lib/payments/types";
import type { BusinessMarket } from "@/lib/types";

// Sağlayıcı işletmenin pazarına (businesses.market) göre seçilir:
//   TR → iyzico. Gerçek iyzico PaymentService'i hazır olana kadar test modu
//        servisi onun yerini tutar; hazır olduğunda yalnızca bu satır değişir.
//   US → Stripe (bkz. lib/payments/stripe-provider.ts).
const providers: Record<BusinessMarket, PaymentService> = {
  TR: testModePaymentService,
  US: stripePaymentProvider,
};

export function getPaymentService(market: BusinessMarket): PaymentService {
  return providers[market];
}

export * from "@/lib/payments/types";
