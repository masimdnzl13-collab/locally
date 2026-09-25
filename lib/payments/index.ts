import { paypalPaymentProvider } from "@/lib/payments/paypal-provider";
import { testModePaymentService } from "@/lib/payments/test-mode-service";
import type { PaymentService } from "@/lib/payments/types";
import type { BusinessMarket } from "@/lib/types";

// Sağlayıcı işletmenin pazarına (businesses.market) göre seçilir:
//   TR → iyzico. Gerçek iyzico PaymentService'i hazır olana kadar test modu
//        servisi onun yerini tutar; hazır olduğunda yalnızca bu satır değişir.
//   US → PayPal (bkz. lib/payments/paypal-provider.ts).
// Stripe (lib/payments/stripe-provider.ts) aktif seçimde değil; aynı arayüzü
// uyguladığı için gerekirse yalnızca bu tablo değişerek geri alınabilir.
const providers: Record<BusinessMarket, PaymentService> = {
  TR: testModePaymentService,
  US: paypalPaymentProvider,
};

export function getPaymentService(market: BusinessMarket): PaymentService {
  return providers[market];
}

export * from "@/lib/payments/types";
