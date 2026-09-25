import { stripePaymentProvider } from "@/lib/payments/stripe-provider";
import { handlePaymentWebhookRequest } from "@/lib/billing/webhook-route";

export const dynamic = "force-dynamic";

// ESKİ — ABD pazarı PayPal'a geçti (app/api/webhooks/paypal). Bu uç, Stripe'a
// geri dönülürse ya da geçiş öncesi açılmış Stripe aboneliklerinin son olayları
// için duruyor; aktif sağlayıcı seçiminden bağımsız olarak doğrudan Stripe
// sağlayıcısını kullanır.
//
// Stripe Dashboard → Developers → Webhooks'ta bu adres
// (https://<domain>/api/webhooks/stripe) eklenir ve şu olaylar seçilir:
// checkout.session.completed, checkout.session.expired, invoice.paid,
// invoice.payment_failed, customer.subscription.deleted. Yerelde: `stripe listen
// --forward-to localhost:3001/api/webhooks/stripe` — çıkan whsec_ değeri
// STRIPE_WEBHOOK_SECRET olur.
//
// checkout.session.completed iki türlüdür: mode=subscription → işletme
// aboneliği; mode=payment → tek seferlik ödeme (etkinlik bileti; metadata
// reference_kind/reference_id bileti gösterir). İkisi de
// applyPaymentWebhookEvent'te ayrışır (bkz. lib/payments/stripe-provider.ts
// toWebhookEvent, lib/events/ticket-payments.ts).
export async function POST(request: Request) {
  return handlePaymentWebhookRequest(request, stripePaymentProvider, "stripe");
}
