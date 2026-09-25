import { stripePaymentProvider } from "@/lib/payments/stripe-provider";
import { handlePaymentWebhook } from "@/lib/billing/webhook-handler";

export const dynamic = "force-dynamic";

// Stripe webhook'u. ABD pazarı PayPal'a taşındı (bkz. /api/webhooks/paypal);
// bu uç yerinde duruyor ki Stripe'ta açılmış eski abonelik/ödemelerin olayları
// (iptal, iade…) hâlâ işlenebilsin ve Stripe ileride yeniden etkinleştirilebilsin.
//
// Stripe Dashboard → Developers → Webhooks'ta bu adres
// (https://<domain>/api/webhooks/stripe) eklenir ve şu olaylar seçilir:
// checkout.session.completed, checkout.session.expired, invoice.paid,
// invoice.payment_failed, customer.subscription.deleted. Yerelde: `stripe
// listen --forward-to localhost:3001/api/webhooks/stripe` — çıkan whsec_ değeri
// STRIPE_WEBHOOK_SECRET olur.
//
// checkout.session.completed iki türlüdür: mode=subscription → işletme
// aboneliği; mode=payment → tek seferlik ödeme (etkinlik bileti). İkisi de
// applyPaymentWebhookEvent'te ayrışır (bkz. lib/payments/stripe-provider.ts
// toWebhookEvent, lib/events/ticket-payments.ts).
export async function POST(request: Request) {
  return handlePaymentWebhook("stripe", stripePaymentProvider, request);
}
