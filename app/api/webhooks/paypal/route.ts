import { paypalPaymentProvider } from "@/lib/payments/paypal-provider";
import { handlePaymentWebhookRequest } from "@/lib/billing/webhook-route";

export const dynamic = "force-dynamic";

// PayPal webhook'u (ABD pazarı). PayPal Developer Dashboard → Apps & Credentials
// → uygulama → Webhooks'ta bu adres (https://<domain>/api/webhooks/paypal)
// eklenir; çıkan Webhook ID, PAYPAL_WEBHOOK_ID olur (imza doğrulamasına girer).
// Seçilecek olaylar:
//   abonelik:       BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.SALE.COMPLETED,
//                   BILLING.SUBSCRIPTION.PAYMENT.FAILED, BILLING.SUBSCRIPTION.SUSPENDED,
//                   BILLING.SUBSCRIPTION.CANCELLED, BILLING.SUBSCRIPTION.EXPIRED
//   tek seferlik:   CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED,
//                   CHECKOUT.ORDER.VOIDED
// Yerelde: sandbox webhook'u localhost'a ulaşamaz; bir tünel (ör. `cloudflared
// tunnel --url http://localhost:3001`) adresini webhook olarak ekle.
//
// Olaylar lib/payments/paypal-provider.ts toWebhookEvent'te ortak formata
// çevrilir; abonelik olayları business_subscriptions'a, tek seferlik olaylar
// (etkinlik bileti; custom_id "event_ticket:<id>") bilete yansır (bkz.
// lib/billing/subscriptions.ts applyPaymentWebhookEvent, lib/events/ticket-payments.ts).
export async function POST(request: Request) {
  return handlePaymentWebhookRequest(request, paypalPaymentProvider, "paypal");
}
