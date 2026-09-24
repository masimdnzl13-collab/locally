import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import type {
  CancelSubscriptionInput,
  CancelSubscriptionResult,
  ChargeInput,
  ChargeResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentService,
  PaymentWebhookEvent,
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

export function toWebhookEvent(event: Stripe.Event): PaymentWebhookEvent {
  const base = { eventId: event.id, rawType: event.type };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
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
    case "customer.subscription.deleted":
      return { ...base, type: "subscription.canceled", subscriptionId: event.data.object.id };
    default:
      return { ...base, type: "ignored" };
  }
}

class StripePaymentProvider implements PaymentService {
  readonly provider = "stripe" as const;

  // Tek seferlik ödeme (etkinlik bileti) kart bilgisini sunucuda tutmadan
  // tamamlanamaz — Stripe'ta bunun için ayrı bir Checkout (mode: payment)
  // akışı gerekir. ABD pazarında şimdilik yalnızca abonelik destekleniyor.
  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!getStripeClient()) {
      return { success: true, providerRef: `TEST-STRIPE-${input.packageId.slice(0, 8)}-${Date.now()}` };
    }
    return {
      success: false,
      providerRef: "",
      error: "ABD pazarında tek seferlik ödeme henüz desteklenmiyor.",
    };
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
