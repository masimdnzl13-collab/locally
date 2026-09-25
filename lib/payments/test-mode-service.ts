import type {
  CancelSubscriptionResult,
  ChargeInput,
  ChargeResult,
  ConfirmOneTimeResult,
  CreateOneTimeCheckoutResult,
  CreateSubscriptionResult,
  PaymentService,
  SubscriptionSummaryResult,
  WebhookResult,
} from "@/lib/payments/types";

// Gerçek iyzico entegrasyonu gelene kadar kullanılan test modu: ödeme adımı
// her zaman başarılı sayılır ve sahte bir sağlayıcı referansı üretilir.
// PaymentService arayüzünü uygulayan başka bir servisle (iyzicoPaymentService
// gibi) değiştirilene kadar lib/payments/index.ts TR pazarı için buradan
// servis alır. Abonelik TR pazarında henüz yok; o metodlar açıkça
// "desteklenmiyor" döner ki yanlışlıkla sahte bir abonelik başlamasın.
const UNSUPPORTED = "Abonelik bu pazarda (TR / iyzico) henüz desteklenmiyor.";

class TestModePaymentService implements PaymentService {
  readonly provider = "test" as const;

  isConfigured() {
    return false;
  }

  async confirmOneTimeCheckout(): Promise<ConfirmOneTimeResult> {
    return { status: "not_needed" };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    return {
      success: true,
      providerRef: `TEST-${input.packageId.slice(0, 8)}-${Date.now()}`,
    };
  }

  async createSubscription(): Promise<CreateSubscriptionResult> {
    return { success: false, error: UNSUPPORTED };
  }

  async cancelSubscription(): Promise<CancelSubscriptionResult> {
    return { success: false, error: UNSUPPORTED };
  }

  async getSubscriptionSummary(): Promise<SubscriptionSummaryResult> {
    return { success: false, error: UNSUPPORTED };
  }

  // TR'de tek seferlik ödeme charge() + (ileride) iyzico checkout ile yürür.
  async createOneTimeCheckout(): Promise<CreateOneTimeCheckoutResult> {
    return { success: false, error: "Barındırılan ödeme sayfası bu pazarda (TR / iyzico) henüz yok." };
  }

  async expireOneTimeCheckout(): Promise<void> {}

  async handleWebhook(): Promise<WebhookResult> {
    return { success: false, error: UNSUPPORTED };
  }
}

export const testModePaymentService = new TestModePaymentService();
