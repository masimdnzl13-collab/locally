export type PaymentProviderName = "test" | "iyzico" | "stripe" | "paypal";

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

// Abonelik onay sayfası sağlayıcıda açılır (PayPal onay akışı / Stripe
// Checkout): kart bilgisi hiçbir zaman Locally sunucusundan geçmez. Abonelik
// gerçekten başladığında sağlayıcı webhook'u "subscription.activated" olayıyla
// haber verir.
export interface CreateSubscriptionInput {
  businessId: string;
  // Sağlayıcıdaki plan/fiyat kimliği: PayPal'da Billing Plan (P-...), Stripe'ta price_...
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

// Abonelik özeti (Faturalandırma sayfası): sağlayıcıdan canlı çekilir, kart
// numarasının yalnızca markası ve son 4 hanesi gelir.
export interface SubscriptionSummary {
  planName: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
}

export type SubscriptionSummaryResult =
  | { success: true; simulated: boolean; summary: SubscriptionSummary }
  | { success: false; error: string };

// Tek seferlik ödeme (ör. etkinlik bileti): sağlayıcının barındırdığı ödeme
// sayfası (Stripe Checkout, mode: "payment"). Ödeme gerçekten alındığında
// webhook "one_time.completed" olayıyla haber verir; reference, ödemenin hangi
// kayda (bilet vb.) ait olduğunu webhook'a taşır.
export type OneTimeReference = { kind: "event_ticket"; id: string };

export interface CreateOneTimeCheckoutInput {
  reference: OneTimeReference;
  // Ana para birimi cinsinden (ör. 25.00 USD); sağlayıcıya kuruş olarak gider.
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  // Platform komisyonu vb. — yalnızca kayıt/raporlama amaçlı metadata.
  metadata?: Record<string, string>;
}

export type CreateOneTimeCheckoutResult =
  | { success: true; simulated: boolean; checkoutUrl: string; sessionId: string }
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
  | {
      type: "one_time.completed";
      sessionId: string;
      reference: OneTimeReference;
      paymentId: string | null;
      // Sağlayıcının bildirdiği tahsil edilen tutar (ana para birimi).
      amount: number;
      currency: string;
      paid: boolean;
    }
  | { type: "one_time.expired"; sessionId: string; reference: OneTimeReference }
  // Ödeyen onayladı ama para henüz alınmadı (PayPal Orders: sunucu "capture"
  // etmeli). Stripe'ta yok — Checkout onayla birlikte tahsil eder.
  | { type: "one_time.approved"; sessionId: string; reference: OneTimeReference }
  | { type: "ignored" }
);

// Tek seferlik ödemenin sunucu tarafında kesinleştirilmesi (PayPal: capture).
// completed: para alındı, olay bilete uygulanabilir. pending: ödeyen henüz
// onaylamadı. Stripe'ta her zaman not_needed (Checkout kendi tahsil eder).
export type ConfirmOneTimeResult =
  | { status: "completed"; event: Extract<PaymentWebhookEvent, { type: "one_time.completed" }> }
  | { status: "pending" | "not_needed" }
  | { status: "failed"; error: string };

export type WebhookResult =
  | { success: true; event: PaymentWebhookEvent }
  | { success: false; error: string };

export interface PaymentService {
  readonly provider: PaymentProviderName;
  // Gerçek sağlayıcı anahtarları tanımlı mı? false → akışlar simüle edilir.
  isConfigured(): boolean;
  charge(input: ChargeInput): Promise<ChargeResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult>;
  getSubscriptionSummary(subscriptionId: string): Promise<SubscriptionSummaryResult>;
  createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<CreateOneTimeCheckoutResult>;
  // Yarım kalan bir ödeme sayfasını kapatır (aynı bilet için ikinci ödeme olmasın).
  expireOneTimeCheckout(sessionId: string): Promise<void>;
  // Ödeyenin onayından sonra ödemeyi kesinleştirir (idempotent).
  confirmOneTimeCheckout(sessionId: string, reference: OneTimeReference): Promise<ConfirmOneTimeResult>;
  // rawBody imza doğrulaması için ayrıştırılmamış gövde olmalı.
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}
