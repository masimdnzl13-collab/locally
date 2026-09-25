import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResult,
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

// ABD pazarı (businesses.market = 'US') ödeme sağlayıcısı. STRIPE_SECRET_KEY
// yoksa gerçek API'ye hiç gidilmez, simüle edilir (lib/iyzico ile aynı desen);
// sk_test_ anahtarıyla Stripe'ın test modunda gerçek API çağrıları yapılır.

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// 2025-03-31 (basil) sürümünden beri abonelik kimliği invoice.subscription
// yerine invoice.parent.subscription_details.subscription altında.
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

// Tek seferlik Checkout oturumlarının hangi kayda ait olduğu metadata'da taşınır.
function oneTimeReference(session: Stripe.Checkout.Session): OneTimeReference | null {
  const kind = session.metadata?.reference_kind;
  const id = session.metadata?.reference_id;
  if (kind === "event_ticket" && id) return { kind, id };
  return null;
}

export function toWebhookEvent(event: Stripe.Event): PaymentWebhookEvent {
  const base = { eventId: event.id, rawType: event.type };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "payment") {
        const reference = oneTimeReference(session);
        if (!reference) return { ...base, type: "ignored" };
        return {
          ...base,
          type: "one_time.completed",
          sessionId: session.id,
          reference,
          paymentId: idOf(session.payment_intent),
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? "usd",
          paid: session.payment_status === "paid",
        };
      }
      const businessId = session.metadata?.business_id ?? session.client_reference_id;
      const subscriptionId = idOf(session.subscription);
      if (session.mode !== "subscription" || !businessId || !subscriptionId) {
        return { ...base, type: "ignored" };
      }
      return {
        ...base,
        type: "subscription.activated",
        businessId,
        subscriptionId,
        customerId: idOf(session.customer),
      };
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return { ...base, type: "ignored" };
      const periodEnd = invoice.lines.data[0]?.period?.end;
      return {
        ...base,
        type: "payment.succeeded",
        subscriptionId,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      };
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return { ...base, type: "ignored" };
      return {
        ...base,
        type: "payment.failed",
        subscriptionId,
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
      };
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      const reference = session.mode === "payment" ? oneTimeReference(session) : null;
      if (!reference) return { ...base, type: "ignored" };
      return { ...base, type: "one_time.expired", sessionId: session.id, reference };
    }
    case "customer.subscription.deleted":
      return { ...base, type: "subscription.canceled", subscriptionId: event.data.object.id };
    default:
      return { ...base, type: "ignored" };
  }
}

class StripePaymentProvider implements PaymentService {
  readonly provider = "stripe" as const;

  // Stripe'ta kart bilgisi Locally sunucusundan hiç geçmez; tek seferlik
  // ödemeler createOneTimeCheckout (Checkout, mode: "payment") ile alınır.
  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!getStripeClient()) {
      return { success: true, providerRef: `TEST-STRIPE-${input.packageId.slice(0, 8)}-${Date.now()}` };
    }
    return {
      success: false,
      providerRef: "",
      error: "Stripe tek seferlik ödemeleri Checkout sayfasıyla alınır (createOneTimeCheckout).",
    };
  }

  async createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<CreateOneTimeCheckoutResult> {
    const stripe = getStripeClient();
    if (!stripe) {
      const sessionId = `TEST-PAYMENT-${Date.now()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("simulated", "1");
      return { success: true, simulated: true, checkoutUrl: url.toString(), sessionId };
    }

    const metadata = {
      ...input.metadata,
      reference_kind: input.reference.kind,
      reference_id: input.reference.id,
    };
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        // Yalnızca kart: ödeme Checkout tamamlandığında kesinleşir, gecikmeli
        // ödeme yöntemlerinin async_payment_* olaylarına gerek kalmaz.
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: Math.round(input.amount * 100),
              product_data: { name: input.description },
            },
          },
        ],
        customer_email: input.customerEmail,
        client_reference_id: input.reference.id,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // Stripe'ın izin verdiği en kısa süre: yarım kalan ödeme kontenjanı en
        // fazla 30 dk tutar, sonra checkout.session.expired ile bırakılır.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata,
        payment_intent_data: { metadata },
      });
      if (!session.url) return { success: false, error: "Stripe ödeme sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: session.url, sessionId: session.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Stripe ödeme sayfası açılamadı") };
    }
  }

  async expireOneTimeCheckout(sessionId: string): Promise<void> {
    const stripe = getStripeClient();
    if (!stripe || sessionId.startsWith("TEST-")) return;
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Zaten tamamlanmış ya da süresi dolmuş oturum: yapılacak bir şey yok.
    }
  }

  async getSubscriptionSummary(subscriptionId: string): Promise<SubscriptionSummaryResult> {
    const stripe = getStripeClient();
    if (!stripe || subscriptionId.startsWith("TEST-")) {
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
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: [
          "default_payment_method",
          "items.data.price.product",
          "customer.invoice_settings.default_payment_method",
        ],
      });
      const item = sub.items.data[0];
      const price = item?.price;
      const product = price?.product;
      const customer =
        typeof sub.customer === "object" && !sub.customer.deleted ? (sub.customer as Stripe.Customer) : null;
      const method = [sub.default_payment_method, customer?.invoice_settings?.default_payment_method].find(
        (m): m is Stripe.PaymentMethod => typeof m === "object" && m !== null
      );
      // 2025-03-31 (basil) sürümünden beri dönem bilgisi abonelik kalemlerinde.
      const periodEnd = item?.current_period_end ?? null;
      const summary: SubscriptionSummary = {
        planName:
          product && typeof product === "object" && !product.deleted ? product.name : price?.nickname ?? null,
        amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
        currency: price?.currency ?? null,
        interval: price?.recurring?.interval ?? null,
        status: sub.status,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        paymentMethod: method?.card
          ? {
              brand: method.card.brand,
              last4: method.card.last4,
              expMonth: method.card.exp_month,
              expYear: method.card.exp_year,
            }
          : null,
      };
      return { success: true, simulated: false, summary };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Stripe abonelik bilgisi alınamadı") };
    }
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const stripe = getStripeClient();
    if (!stripe) {
      const sessionId = `TEST-SESSION-${Date.now()}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("simulated", "1");
      return { success: true, simulated: true, checkoutUrl: url.toString(), sessionId };
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        client_reference_id: input.businessId,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { business_id: input.businessId },
        // Sonraki fatura/iptal olayları da işletmeye bağlanabilsin.
        subscription_data: { metadata: { business_id: input.businessId } },
      });
      if (!session.url) return { success: false, error: "Stripe ödeme sayfası adresi dönmedi" };
      return { success: true, simulated: false, checkoutUrl: session.url, sessionId: session.id };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Stripe aboneliği başlatılamadı") };
    }
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    const stripe = getStripeClient();
    if (!stripe || input.subscriptionId.startsWith("TEST-")) {
      return { success: true, simulated: true };
    }

    try {
      if (input.atPeriodEnd) {
        await stripe.subscriptions.update(input.subscriptionId, { cancel_at_period_end: true });
      } else {
        await stripe.subscriptions.cancel(input.subscriptionId);
      }
      return { success: true, simulated: false };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Stripe aboneliği iptal edilemedi") };
    }
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) {
      return { success: false, error: "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET tanımlı değil" };
    }

    const signature = headers.get("stripe-signature");
    if (!signature) return { success: false, error: "stripe-signature başlığı yok" };

    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      return { success: true, event: toWebhookEvent(event) };
    } catch (err) {
      return { success: false, error: errorMessage(err, "Webhook imzası doğrulanamadı") };
    }
  }
}

export const stripePaymentProvider = new StripePaymentProvider();
