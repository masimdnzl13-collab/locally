import { approveLink, getPayPalConfig, PayPalApiError, paypalRequest, verifyPayPalWebhookSignature } from "@/lib/paypal/client";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResult,
  ChargeInput,
  ChargeResult,
  ConfirmOneTimeResult,
  CreateOneTimeCheckoutInput,
  CreateOneTimeCheckoutResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  OneTimeReference,
  PaymentService,
  PaymentWebhookEvent,
  SubscriptionSummaryResult,
  WebhookResult,
} from "@/lib/payments/types";

// ABD pazarı (businesses.market = 'US') ödeme sağlayıcısı: PayPal.
//   * Abonelik: Subscriptions API. Kullanıcı PayPal'ın onay sayfasına gider
//     (Stripe Checkout'un eşdeğeri) — kart/hesap bilgisi Locally'den geçmez.
//     Plan, PayPal'da önceden oluşturulmuş bir Billing Plan'dır (PAYPAL_US_PLAN_ID;
//     sandbox'ta oluşturmak için: scripts/paypal-setup-plan.mjs).
//   * Tek seferlik ödeme (etkinlik bileti): Orders API, intent=CAPTURE. Ödeyen
//     onaylar, para ancak sunucu "capture" edince alınır (confirmOneTimeCheckout).
//   * Webhook: imza PayPal sertifikasıyla doğrulanır (lib/paypal/client.ts),
//     olaylar Stripe sağlayıcısının ürettiği ortak olay tiplerine çevrilir.
// PAYPAL_CLIENT_ID/SECRET yoksa gerçek API'ye gidilmez, simüle edilir.

type Money = { value?: string; currency_code?: string };
type PayPalLink = { rel: string; href: string };

interface PayPalSubscription {
  id: string;
  status: string;
  plan_id?: string;
  custom_id?: string;
  subscriber?: { payer_id?: string };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: Money; time?: string };
    last_failed_payment?: { amount?: Money };
  };
  links?: PayPalLink[];
}

interface PayPalCapture {
  id: string;
  status: string;
  amount?: Money;
  custom_id?: string;
  supplementary_data?: { related_ids?: { order_id?: string } };
}

interface PayPalOrder {
  id: string;
  status: string;
  links?: PayPalLink[];
  purchase_units?: { custom_id?: string; payments?: { captures?: PayPalCapture[] } }[];
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const amountOf = (money: Money | undefined) => Number(money?.value ?? 0);
const currencyOf = (money: Money | undefined) => (money?.currency_code ?? "USD").toLowerCase();

// Tek seferlik ödemenin hangi kayda ait olduğu purchase unit'in custom_id'sinde
// taşınır ("event_ticket:<uuid>"); capture olaylarında da aynen geri gelir.
export function encodeReference(reference: OneTimeReference) {
  return `${reference.kind}:${reference.id}`;
}
export function decodeReference(customId: string | undefined): OneTimeReference | null {
  const [kind, id] = (customId ?? "").split(":");
  return kind === "event_ticket" && id ? { kind, id } : null;
}

export function toWebhookEvent(event: PayPalWebhookEvent): PaymentWebhookEvent {
  const base = { eventId: event.id, rawType: event.event_type };
  const r = event.resource;

  switch (event.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const sub = r as unknown as PayPalSubscription;
      if (!sub.id || !sub.custom_id) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "subscription.activated",
        businessId: sub.custom_id,
        subscriptionId: sub.id,
        customerId: sub.subscriber?.payer_id ?? null,
      };
    }
    case "PAYMENT.SALE.COMPLETED": {
      // Abonelik tahsilatları "sale" olarak gelir; billing_agreement_id abonelik kimliğidir.
      const sale = r as { billing_agreement_id?: string; amount?: { total?: string; currency?: string } };
      if (!sale.billing_agreement_id) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "payment.succeeded",
        subscriptionId: sale.billing_agreement_id,
        amount: Number(sale.amount?.total ?? 0),
        currency: (sale.amount?.currency ?? "USD").toLowerCase(),
        // Sale olayında dönem bilgisi yok; handleWebhook abonelikten tamamlar.
        currentPeriodEnd: null,
      };
    }
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      // SUSPENDED: PayPal art arda başarısız tahsilattan sonra aboneliği askıya alır.
      const sub = r as unknown as PayPalSubscription;
      if (!sub.id) return { ...base, type: "ignored" };
      const failed = sub.billing_info?.last_failed_payment?.amount;
      return { ...base, type: "payment.failed", subscriptionId: sub.id, amount: amountOf(failed), currency: currencyOf(failed) };
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const sub = r as unknown as PayPalSubscription;
      if (!sub.id) return { ...base, type: "ignored" };
      return { ...base, type: "subscription.canceled", subscriptionId: sub.id };
    }
    case "CHECKOUT.ORDER.APPROVED": {
      const order = r as unknown as PayPalOrder;
      const reference = decodeReference(order.purchase_units?.[0]?.custom_id);
      if (!order.id || !reference) return { ...base, type: "ignored" };
      return { ...base, type: "one_time.approved", sessionId: order.id, reference };
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const capture = r as unknown as PayPalCapture;
      const reference = decodeReference(capture.custom_id);
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (!reference || !orderId) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "one_time.completed",
        sessionId: orderId,
        reference,
        paymentId: capture.id,
        amount: amountOf(capture.amount),
        currency: currencyOf(capture.amount),
        paid: capture.status === "COMPLETED",
      };
    }
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED": {
      // Tahsilat reddedildi: bilet bekletilmez, kontenjan serbest bırakılır.
      const capture = r as unknown as PayPalCapture;
      const reference = decodeReference(capture.custom_id);
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (!reference || !orderId) return { ...base, type: "ignored" };
      return { ...base, type: "one_time.expired", sessionId: orderId, reference };
    }
    default:
      return { ...base, type: "ignored" };
  }
}

function captureEvent(order: PayPalOrder, reference: OneTimeReference): ConfirmOneTimeResult {
  const unit = order.purchase_units?.[0];
  // URL'deki sipariş kimliğine değil, siparişin kendi taşıdığı referansa güvenilir.
  if (decodeReference(unit?.custom_id)?.id !== reference.id) {
    return { status: "failed", error: "PayPal siparişi bu kayda ait değil" };
  }
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return { status: "pending" };
  if (capture.status === "PENDING") return { status: "pending" };
  return {
    status: "completed",
    event: {
      eventId: `capture:${order.id}`,
      rawType: "CHECKOUT.ORDER.CAPTURED",
      type: "one_time.completed",
      sessionId: order.id,
      reference,
      paymentId: capture.id,
      amount: amountOf(capture.amount),
      currency: currencyOf(capture.amount),
      paid: capture.status === "COMPLETED",
    },
  };
}

const SUBSCRIPTION_STATUS: Record<string, string> = {
  APPROVAL_PENDING: "incomplete",
  APPROVED: "incomplete",
  ACTIVE: "active",
  SUSPENDED: "past_due",
  CANCELLED: "canceled",
  EXPIRED: "canceled",
};

class PayPalPaymentProvider implements PaymentService {
  readonly provider = "paypal" as const;

  isConfigured() {
    try {
      return getPayPalConfig() !== null;
    } catch {
      // Canlı ortam koruması: kimlik bilgisi var ama kullanılamaz — sessizce
      // simülasyona düşmek yerine çağrılar anlaşılır hatayla dönsün.
      return true;
    }
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!this.isConfigured()) {
      return { success: true, providerRef: `TEST-PAYPAL-${input.packageId.slice(0, 8)}-${Date.now()}` };
    }
    return {
      success: false,
      providerRef: "",
      error: "PayPal tek seferlik ödemeleri onay sayfasıyla alınır (createOneTimeCheckout).",
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.isConfigured()) {
      const sessionId = `TEST-SUB-${Date.now()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("simulated", "1");
      return { success: true, simulated: true, checkoutUrl: url.toString(), sessionId };
    }
    try {
      const sub = await paypalRequest<PayPalSubscription>("/v1/billing/subscriptions", {
        method: "POST",
        requestId: `sub-${input.businessId}-${Date.now()}`,
        body: {
          plan_id: input.priceId,
          // Webhook'ta aboneliği işletmeye bağlayan alan (Stripe'taki metadata.business_id).
          custom_id: input.businessId,
          ...(input.customerEmail ? { subscriber: { email_address: input.customerEmail } } : {}),
          application_context: {
            brand_name: "Locally",
            user_action: "SUBSCRIBE_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: input.successUrl,
            cancel_url: input.cancelUrl,
          },
        },
      });
      const href = approveLink(sub.links);
      if (!href) return { success: false, error: "PayPal onay sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: href, sessionId: sub.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal aboneliği başlatılamadı") };
    }
  }

  // PayPal'da "dönem sonunda iptal" yok: iptal anında gelecek tahsilatlar
  // durur, ödenmiş dönem zaten müşterinindir. atPeriodEnd=true'da da PayPal'da
  // hemen iptal edilir; Locally tarafı aboneliği current_period_end'e kadar
  // aktif tutar (bkz. lib/billing/subscriptions.ts applyToSubscription).
  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    if (!this.isConfigured() || input.subscriptionId.startsWith("TEST-")) return { success: true, simulated: true };
    try {
      await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`, {
        method: "POST",
        body: { reason: input.atPeriodEnd ? "Canceled by customer (end of billing period)" : "Canceled by customer" },
      });
      return { success: true, simulated: false };
    } catch (err) {
      // Zaten iptal edilmiş abonelik: istenen sonuç zaten gerçekleşmiş.
      if (err instanceof PayPalApiError && err.issue === "SUBSCRIPTION_STATUS_INVALID") return { success: true, simulated: false };
      return { success: false, error: errorMessage(err, "PayPal aboneliği iptal edilemedi") };
    }
  }

  async getSubscriptionSummary(subscriptionId: string): Promise<SubscriptionSummaryResult> {
    if (!this.isConfigured() || subscriptionId.startsWith("TEST-")) {
      return {
        success: true,
        simulated: true,
        summary: {
          planName: null,
          amount: null,
          currency: null,
          interval: "month",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          paymentMethod: null,
        },
      };
    }
    try {
      const sub = await paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const plan = sub.plan_id
        ? await paypalRequest<{
            name?: string;
            billing_cycles?: { tenure_type?: string; frequency?: { interval_unit?: string }; pricing_scheme?: { fixed_price?: Money } }[];
          }>(`/v1/billing/plans/${encodeURIComponent(sub.plan_id)}`).catch(() => null)
        : null;
      const cycle = plan?.billing_cycles?.find((c) => c.tenure_type === "REGULAR") ?? plan?.billing_cycles?.[0];
      const price = cycle?.pricing_scheme?.fixed_price;
      return {
        success: true,
        simulated: false,
        summary: {
          planName: plan?.name ?? null,
          amount: price ? amountOf(price) : null,
          currency: price ? currencyOf(price) : null,
          interval: cycle?.frequency?.interval_unit?.toLowerCase() ?? null,
          status: SUBSCRIPTION_STATUS[sub.status] ?? sub.status.toLowerCase(),
          currentPeriodEnd: sub.billing_info?.next_billing_time ?? null,
          // PayPal'da iptal edilmiş ama Locally'de dönem sonuna kadar süren abonelik.
          cancelAtPeriodEnd: sub.status === "CANCELLED",
          // PayPal kart ayrıntısı paylaşmaz; ödeme PayPal hesabından yönetilir.
          paymentMethod: null,
        },
      };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal abonelik bilgisi alınamadı") };
    }
  }

  async createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<CreateOneTimeCheckoutResult> {
    if (!this.isConfigured()) {
      const sessionId = `TEST-ORDER-${Date.now()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("simulated", "1");
      return { success: true, simulated: true, checkoutUrl: url.toString(), sessionId };
    }
    try {
      const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
        method: "POST",
        requestId: `order-${input.reference.kind}-${input.reference.id}`,
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.reference.id,
              custom_id: encodeReference(input.reference),
              description: input.description.slice(0, 127),
              amount: { currency_code: input.currency.toUpperCase(), value: input.amount.toFixed(2) },
            },
          ],
          payment_source: {
            paypal: {
              ...(input.customerEmail ? { email_address: input.customerEmail } : {}),
              experience_context: {
                brand_name: "Locally",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: input.successUrl,
                cancel_url: input.cancelUrl,
              },
            },
          },
        },
      });
      const href = approveLink(order.links);
      if (!href) return { success: false, error: "PayPal ödeme sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: href, sessionId: order.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal ödeme sayfası açılamadı") };
    }
  }

  // Onaylanmamış bir PayPal siparişini iptal eden bir uç yok; gerek de yok:
  // para yalnızca capture ile alınır ve süresi dolan biletin siparişi hiçbir
  // zaman capture edilmez (bkz. lib/events/ticket-payments.ts).
  async expireOneTimeCheckout(): Promise<void> {}

  async confirmOneTimeCheckout(orderId: string, reference: OneTimeReference): Promise<ConfirmOneTimeResult> {
    if (!this.isConfigured() || orderId.startsWith("TEST-")) return { status: "not_needed" };
    const path = `/v2/checkout/orders/${encodeURIComponent(orderId)}`;
    try {
      // PayPal-Request-Id: aynı siparişi iki yerden (dönüş sayfası + webhook)
      // capture etmeye çalışmak ikinci bir tahsilat yaratmaz.
      const order = await paypalRequest<PayPalOrder>(`${path}/capture`, { method: "POST", body: {}, requestId: `capture-${orderId}` });
      return captureEvent(order, reference);
    } catch (err) {
      if (err instanceof PayPalApiError && err.issue === "ORDER_NOT_APPROVED") return { status: "pending" };
      if (err instanceof PayPalApiError && err.issue === "ORDER_ALREADY_CAPTURED") {
        try {
          return captureEvent(await paypalRequest<PayPalOrder>(path), reference);
        } catch (inner) {
          return { status: "failed", error: errorMessage(inner, "PayPal siparişi okunamadı") };
        }
      }
      return { status: "failed", error: errorMessage(err, "PayPal ödemesi alınamadı") };
    }
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!this.isConfigured() || !webhookId) {
      return { success: false, error: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID tanımlı değil" };
    }
    const verified = await verifyPayPalWebhookSignature({ rawBody, headers, webhookId });
    if (!verified.ok) return { success: false, error: verified.error };

    let parsed: PayPalWebhookEvent;
    try {
      parsed = JSON.parse(rawBody) as PayPalWebhookEvent;
    } catch {
      return { success: false, error: "Webhook gövdesi JSON değil" };
    }
    const event = toWebhookEvent(parsed);

    // Tahsilat olayı dönem sonunu taşımaz; abonelikten tamamla (olmazsa null kalır).
    if (event.type === "payment.succeeded") {
      try {
        const sub = await paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(event.subscriptionId)}`);
        event.currentPeriodEnd = sub.billing_info?.next_billing_time ?? null;
      } catch {
        /* dönem sonu olmadan da ödeme kaydedilir */
      }
    }
    return { success: true, event };
  }
}

export const paypalPaymentProvider = new PayPalPaymentProvider();
