import { testModePaymentService } from "@/lib/payments/test-mode-service";
import type { PaymentService } from "@/lib/payments/types";

// iyzico entegrasyonu hazır olduğunda burası değişecek:
// export const paymentService: PaymentService = process.env.PAYMENTS_MODE === "iyzico"
//   ? iyzicoPaymentService
//   : testModePaymentService;
export const paymentService: PaymentService = testModePaymentService;

export * from "@/lib/payments/types";
