import { getPayPalConfig, PayPalApiError, paypalRequest, type PayPalConfig } from "@/lib/paypal/client";
import { verifyPayPalWebhookSignature } from "@/lib/paypal/webhook-signature";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResult,
  CaptureOneTimeResult,
  ChargeInput,
  ChargeResult,
  CreateOneTimeCheckoutInput,
  CreateOneTimeCheckoutResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  OneTimeReference,
  PaymentService,
  PaymentWebhookEvent,
  SubscriptionSummary,
  SubscriptionSummaryResult,
  WebhookResult,
} from "@/lib/payments/types";

// ABD pazarı (businesses.market = 'US') ödeme sağlayıcısı: PayPal
// Subscriptions (Billing Plans + Subscriptions) ve tek seferlik ödemeler için
// Orders v2. Kart/PayPal hesabı bilgisi hiçbir zaman Locally sunucusundan
// geçmez: kullanıcı PayPal'ın onay sayfasına yönlendirilir (Stripe Checkout'un
// eşdeğeri), sonuç webhook'la gelir. PAYPAL_CLIENT_ID/SECRET yoksa gerçek
// API'ye hiç gidilmez, simüle edilir (lib/payments/stripe-provider.ts ile aynı
// desen); varsayılan sandbox, canlı için PAYPAL_LIVE_MODE=true.
//
// Stripe'tan farkları (ortak olay formatı aynı kalır, bkz. types.ts):
//   * Tek seferlik ödemede alıcının onayı parayı çekmez. CHECKOUT.ORDER.APPROVED
//     → "one_time.approved"; uygulama bilet hâlâ bekliyorsa captureOneTimeCheckout
//     ile tahsil eder, PAYMENT.CAPTURE.COMPLETED → "one_time.completed".
//   * PayPal'da "dönem sonunda iptal" yok: iptal hemen yapılır (sonraki tahsilat
//     olmaz), BILLING.SUBSCRIPTION.CANCELLED hemen gelir. Aboneliğin ödenmiş
//     dönemin sonuna kadar açık kalması uygulamada (cancel_at_period_end) tutulur.
//   * PAYMENT.SALE.COMPLETED dönem sonunu taşımaz; abonelikten okunur.

type Money = { currency_code: string; value: string };

interface PayPalSubscription {
  id: string;
  status: string;
  plan_id?: string;
  custom_id?: string;
  subscriber?: { payer_id?: string; email_address?: string };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: Money; time?: string };
    last_failed_payment?: { amount?: Money };
    outstanding_balance?: Money;
  };
  links?: { href: string; rel: string }[];
}

interface PayPalPlan {
  id: string;
  name?: string;
  billing_cycles?: {
    tenure_type: string;
    frequency?: { interval_unit?: string; interval_count?: number };
    pricing_scheme?: { fixed_price?: Money };
  }[];
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
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    payments?: { captures?: PayPalCapture[] };
  }[];
  links?: { href: string; rel: string }[];
}

interface PayPalSale {
  id: string;
  state?: string;
  amount?: { total: string; currency: string };
  billing_agreement_id?: string;
}

export interface PayPalWebhookBody {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const money = (m: Money | undefined) => ({
  amount: m ? Number(m.value) : 0,
  currency: (m?.currency_code ?? "usd").toLowerCase(),
});

// Tek seferlik ödemenin hangi kayda ait olduğu purchase unit'in custom_id'sinde
// taşınır ("event_ticket:<id>"); tahsilat (capture) olayına da aynen geçer.
function encodeReference(reference: OneTimeReference) {
  return `${reference.kind}:${reference.id}`;
}

function decodeReference(customId: string | undefined | null): OneTimeReference | null {
  if (!customId) return null;
  const [kind, id] = customId.split(":", 2);
  if (kind === "event_ticket" && id) return { kind, id };
  return null;
}

function linkOf(links: { href: string; rel: string }[] | undefined, rel: string) {
  return links?.find((l) => l.rel === rel)?.href ?? null;
}

function captureResult(capture: PayPalCapture | undefined): CaptureOneTimeResult {
  if (!capture) return { success: false, error: "PayPal tahsilat kaydı dönmedi" };
  return {
    success: true,
    paid: capture.status === "COMPLETED",
    paymentId: capture.id,
    ...money(capture.amount),
  };
}

// Webhook gövdesini ortak olay formatına çevirir. PAYMENT.SALE.COMPLETED dönem
// sonunu taşımadığı için abonelik PayPal'dan okunur (fetchSubscription).
export async function toWebhookEvent(
  body: PayPalWebhookBody,
  fetchSubscription: (id: string) => Promise<PayPalSubscription>
): Promise<PaymentWebhookEvent> {
  const base = { eventId: body.id, rawType: body.event_type };

  switch (body.event_type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const sub = body.resource as unknown as PayPalSubscription;
      if (!sub.custom_id) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "subscription.activated",
        businessId: sub.custom_id,
        subscriptionId: sub.id,
        customerId: sub.subscriber?.payer_id ?? null,
        currentPeriodEnd: sub.billing_info?.next_billing_time ?? null,
      };
    }
    case "PAYMENT.SALE.COMPLETED": {
      const sale = body.resource as unknown as PayPalSale;
      // billing_agreement_id yoksa aboneliğe ait olmayan (eski tip) bir satış.
      if (!sale.billing_agreement_id) return { ...base, type: "ignored" };
      const sub = await fetchSubscription(sale.billing_agreement_id);
      return {
        ...base,
        type: "payment.succeeded",
        subscriptionId: sale.billing_agreement_id,
        amount: Number(sale.amount?.total ?? 0),
        currency: (sale.amount?.currency ?? "usd").toLowerCase(),
        currentPeriodEnd: sub.billing_info?.next_billing_time ?? null,
      };
    }
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    // Başarısız tahsilat eşiği aşılınca PayPal aboneliği askıya alır: ödeme
    // alınamıyor, "past_due" ile aynı anlam.
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const sub = body.resource as unknown as PayPalSubscription;
      const failed = sub.billing_info?.last_failed_payment?.amount ?? sub.billing_info?.outstanding_balance;
      return { ...base, type: "payment.failed", subscriptionId: sub.id, ...money(failed) };
    }
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return { ...base, type: "subscription.canceled", subscriptionId: (body.resource as { id: string }).id };
    case "CHECKOUT.ORDER.APPROVED": {
      const order = body.resource as unknown as PayPalOrder;
      const reference = decodeReference(order.purchase_units?.[0]?.custom_id);
      if (!reference) return { ...base, type: "ignored" };
      return { ...base, type: "one_time.approved", sessionId: order.id, reference };
    }
    case "PAYMENT.CAPTURE.COMPLETED": {
      const capture = body.resource as unknown as PayPalCapture;
      const reference = decodeReference(capture.custom_id);
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (!reference || !orderId) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "one_time.completed",
        sessionId: orderId,
        reference,
        paymentId: capture.id,
        ...money(capture.amount),
        paid: capture.status === "COMPLETED",
      };
    }
    case "CHECKOUT.ORDER.VOIDED": {
      const order = body.resource as unknown as PayPalOrder;
      const reference = decodeReference(order.purchase_units?.[0]?.custom_id);
      if (!reference) return { ...base, type: "ignored" };
      return { ...base, type: "one_time.expired", sessionId: order.id, reference };
    }
    default:
      return { ...base, type: "ignored" };
  }
}

function simulatedReturn(successUrl: string, prefix: string) {
  const sessionId = `TEST-${prefix}-${Date.now()}`;
  const url = new URL(successUrl);
  url.searchParams.set("simulated", "1");
  return { success: true as const, simulated: true, checkoutUrl: url.toString(), sessionId };
}

function intervalName(unit: string | undefined, count: number | undefined) {
  if (!unit) return null;
  const name = unit.toLowerCase();
  return count && count > 1 ? `${count} ${name}s` : name;
}

// PayPal durumlarını Stripe'ın küçük harfli adlarına yaklaştırır (Faturalandırma
// sayfası iki sağlayıcıda da aynı değerleri görsün).
function normalizeStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "past_due";
    case "CANCELLED":
    case "EXPIRED":
      return "canceled";
    default:
      return "incomplete";
  }
}

class PayPalPaymentProvider implements PaymentService {
  readonly provider = "paypal" as const;

  private config(): PayPalConfig | null {
    return getPayPalConfig();
  }

  // Tek seferlik ödemeler PayPal onay sayfasıyla alınır (createOneTimeCheckout).
  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!this.config()) {
      return { success: true, providerRef: `TEST-PAYPAL-${input.packageId.slice(0, 8)}-${Date.now()}` };
    }
    return {
      success: false,
      providerRef: "",
      error: "PayPal tek seferlik ödemeleri onay sayfasıyla alınır (createOneTimeCheckout).",
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const config = this.config();
    if (!config) return simulatedReturn(input.successUrl, "SUBSCRIPTION");

    try {
      const sub = await paypalRequest<PayPalSubscription>(config, "POST", "/v1/billing/subscriptions", {
        body: {
          plan_id: input.priceId,
          // Sonraki olaylar (ödeme, iptal) aboneliği işletmeye custom_id ile bağlar.
          custom_id: input.businessId,
          subscriber: input.customerEmail ? { email_address: input.customerEmail } : undefined,
          application_context: {
            brand_name: "Locally",
            user_action: "SUBSCRIBE_NOW",
            shipping_preference: "NO_SHIPPING",
            // PayPal dönüşte ?subscription_id=I-...&ba_token=...&token=... ekler.
            return_url: input.successUrl,
            cancel_url: input.cancelUrl,
          },
        },
      });
      const approveUrl = linkOf(sub.links, "approve");
      if (!approveUrl) return { success: false, error: "PayPal onay sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: approveUrl, sessionId: sub.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal aboneliği başlatılamadı") };
    }
  }

  // PayPal'da ertelenmiş iptal yok: atPeriodEnd de hemen iptal eder (bir
  // sonraki tahsilat hiç yapılmaz). Ödenmiş dönemin sonuna kadar hizmet,
  // cancelBusinessSubscription'ın önceden yazdığı cancel_at_period_end işaretiyle
  // korunur (bkz. lib/billing/subscriptions.ts "deferred").
  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    const config = this.config();
    if (!config || input.subscriptionId.startsWith("TEST-")) return { success: true, simulated: true };

    const id = encodeURIComponent(input.subscriptionId);
    try {
      await paypalRequest(config, "POST", `/v1/billing/subscriptions/${id}/cancel`, {
        body: { reason: input.atPeriodEnd ? "Canceled at period end by the business" : "Canceled by the business" },
      });
      return { success: true, simulated: false };
    } catch (err) {
      // Zaten iptal/sona ermiş abonelik: sonuç aynı.
      if (err instanceof PayPalApiError && err.status === 422) {
        try {
          const sub = await paypalRequest<PayPalSubscription>(config, "GET", `/v1/billing/subscriptions/${id}`);
          if (sub.status === "CANCELLED" || sub.status === "EXPIRED") return { success: true, simulated: false };
        } catch {
          // Asıl hatayı döndür.
        }
      }
      return { success: false, error: errorMessage(err, "PayPal aboneliği iptal edilemedi") };
    }
  }

  async getSubscriptionSummary(subscriptionId: string): Promise<SubscriptionSummaryResult> {
    const config = this.config();
    if (!config || subscriptionId.startsWith("TEST-")) {
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
      const sub = await paypalRequest<PayPalSubscription>(
        config,
        "GET",
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`
      );
      const plan = sub.plan_id
        ? await paypalRequest<PayPalPlan>(config, "GET", `/v1/billing/plans/${encodeURIComponent(sub.plan_id)}`)
        : null;
      const cycle = plan?.billing_cycles?.find((c) => c.tenure_type === "REGULAR");
      const price = cycle?.pricing_scheme?.fixed_price;
      const summary: SubscriptionSummary = {
        planName: plan?.name ?? null,
        amount: price ? Number(price.value) : null,
        currency: price ? price.currency_code.toLowerCase() : null,
        interval: intervalName(cycle?.frequency?.interval_unit, cycle?.frequency?.interval_count),
        status: normalizeStatus(sub.status),
        currentPeriodEnd: sub.billing_info?.next_billing_time ?? null,
        // PayPal'da iptal hemen gerçekleşir; dönem sonu bilgisi yerel kayıttadır.
        cancelAtPeriodEnd: false,
        // PayPal kart ayrıntısını satıcıya vermez (ödeme PayPal hesabından).
        paymentMethod: null,
      };
      return { success: true, simulated: false, summary };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal abonelik bilgisi alınamadı") };
    }
  }

  async createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<CreateOneTimeCheckoutResult> {
    const config = this.config();
    if (!config) return simulatedReturn(input.successUrl, "PAYMENT");

    try {
      const order = await paypalRequest<PayPalOrder>(config, "POST", "/v2/checkout/orders", {
        // Aynı kayıt için tekrar gelen istek ikinci bir sipariş açmasın.
        requestId: `order-${input.reference.kind}-${input.reference.id}`,
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.reference.id,
              custom_id: encodeReference(input.reference),
              // PayPal aynı invoice_id ile ikinci ödemeyi reddeder: bilet başına tek tahsilat.
              invoice_id: `${input.reference.kind}-${input.reference.id}`,
              description: input.description.slice(0, 127),
              amount: { currency_code: input.currency.toUpperCase(), value: input.amount.toFixed(2) },
            },
          ],
          payment_source: {
            paypal: {
              email_address: input.customerEmail,
              experience_context: {
                brand_name: "Locally",
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                // PayPal dönüşte ?token=<order id>&PayerID=... ekler.
                return_url: input.successUrl,
                cancel_url: input.cancelUrl,
              },
            },
          },
        },
      });
      const approveUrl = linkOf(order.links, "payer-action") ?? linkOf(order.links, "approve");
      if (!approveUrl) return { success: false, error: "PayPal ödeme sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: approveUrl, sessionId: order.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal ödeme sayfası açılamadı") };
    }
  }

  // PayPal'da onaylanmamış sipariş kapatılamaz ama gerek de yok: para yalnızca
  // captureOneTimeCheckout ile çekilir ve o, bilet hâlâ bekliyorken çağrılır.
  async expireOneTimeCheckout(): Promise<void> {}

  async captureOneTimeCheckout(sessionId: string): Promise<CaptureOneTimeResult> {
    const config = this.config();
    if (!config || sessionId.startsWith("TEST-")) {
      return { success: true, paid: true, paymentId: sessionId, amount: 0, currency: "usd" };
    }

    const id = encodeURIComponent(sessionId);
    try {
      const order = await paypalRequest<PayPalOrder>(config, "POST", `/v2/checkout/orders/${id}/capture`, {
        // Dönüş sayfası ve webhook aynı anda tahsil etmeye çalışabilir.
        requestId: `capture-${sessionId}`,
        body: {},
      });
      return captureResult(order.purchase_units?.[0]?.payments?.captures?.[0]);
    } catch (err) {
      if (err instanceof PayPalApiError && err.issue === "ORDER_ALREADY_CAPTURED") {
        try {
          const order = await paypalRequest<PayPalOrder>(config, "GET", `/v2/checkout/orders/${id}`);
          return captureResult(order.purchase_units?.[0]?.payments?.captures?.[0]);
        } catch (inner) {
          return { success: false, error: errorMessage(inner, "PayPal siparişi okunamadı") };
        }
      }
      // Alıcının kartı/PayPal bakiyesi reddetti: para çekilmedi.
      if (err instanceof PayPalApiError && err.issue === "INSTRUMENT_DECLINED") {
        return { success: true, paid: false, paymentId: null, amount: 0, currency: "usd" };
      }
      return { success: false, error: errorMessage(err, "PayPal ödemesi tahsil edilemedi") };
    }
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const config = this.config();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!config || !webhookId) {
      return { success: false, error: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID tanımlı değil" };
    }

    const check = await verifyPayPalWebhookSignature(rawBody, headers, webhookId);
    if (!check.ok) return { success: false, error: check.error };

    let body: PayPalWebhookBody;
    try {
      body = JSON.parse(rawBody) as PayPalWebhookBody;
    } catch {
      return { success: false, error: "Webhook gövdesi JSON değil" };
    }
    if (!body.id || !body.event_type || !body.resource) {
      return { success: false, error: "Webhook gövdesi eksik" };
    }

    try {
      const event = await toWebhookEvent(body, (subscriptionId) =>
        paypalRequest<PayPalSubscription>(
          config,
          "GET",
          `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`
        )
      );
      return { success: true, event };
    } catch (err) {
      return { success: false, error: errorMessage(err, "PayPal olayı çözümlenemedi") };
    }
  }
}

export const paypalPaymentProvider = new PayPalPaymentProvider();
