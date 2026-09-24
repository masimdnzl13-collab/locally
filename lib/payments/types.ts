export type PaymentProviderName = "test" | "iyzico" | "stripe";

export interface ChargeInput {
  amount: number;
  userId: string;
  packageId: string;
}

export interface ChargeResult {
  success: boolean;
  providerRef: string;
  error?: string;
}

// Abonelik ödeme sayfası sağlayıcıda (Stripe Checkout) açılır: kart bilgisi
// hiçbir zaman Locally sunucusundan geçmez. Abonelik gerçekten başladığında
// sağlayıcı webhook'u "subscription.activated" olayıyla haber verir.
export interface CreateSubscriptionInput {
  businessId: string;
  priceId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export type CreateSubscriptionResult =
  | { success: true; simulated: boolean; checkoutUrl: string; sessionId: string }
  | { success: false; error: string };

export interface CancelSubscriptionInput {
  subscriptionId: string;
  // false: hemen iptal; true: dönem sonunda iptal (kullanıcı ödediği süreyi kullanır)
  atPeriodEnd?: boolean;
}

export type CancelSubscriptionResult =
  | { success: true; simulated: boolean }
  | { success: false; error: string };

// Sağlayıcıya özgü webhook olayları bu ortak şekle çevrilir; uygulama kodu
// (bkz. app/api/webhooks/stripe) yalnızca bununla konuşur.
export type PaymentWebhookEvent = { eventId: string; rawType: string } & (
  | {
      type: "subscription.activated";
      businessId: string;
      subscriptionId: string;
      customerId: string | null;
    }
  | {
      type: "payment.succeeded";
      subscriptionId: string;
      amount: number;
      currency: string;
      currentPeriodEnd: string | null;
    }
  | { type: "payment.failed"; subscriptionId: string; amount: number; currency: string }
  | { type: "subscription.canceled"; subscriptionId: string }
  | { type: "ignored" }
);

export type WebhookResult =
  | { success: true; event: PaymentWebhookEvent }
  | { success: false; error: string };

export interface PaymentService {
  readonly provider: PaymentProviderName;
  charge(input: ChargeInput): Promise<ChargeResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
  // rawBody imza doğrulaması için ayrıştırılmamış gövde olmalı.
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}
