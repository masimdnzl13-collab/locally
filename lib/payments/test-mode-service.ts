import type { ChargeInput, ChargeResult, PaymentService } from "@/lib/payments/types";

// Gerçek iyzico entegrasyonu gelene kadar kullanılan test modu: ödeme adımı
// her zaman başarılı sayılır ve sahte bir sağlayıcı referansı üretilir.
// PaymentService arayüzünü uygulayan başka bir servisle (iyzicoPaymentService
// gibi) değiştirilene kadar lib/payments/index.ts buradan servis alır.
class TestModePaymentService implements PaymentService {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    return {
      success: true,
      providerRef: `TEST-${input.packageId.slice(0, 8)}-${Date.now()}`,
    };
  }
}

export const testModePaymentService = new TestModePaymentService();
