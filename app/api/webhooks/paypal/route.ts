import { paypalPaymentProvider } from "@/lib/payments/paypal-provider";
import { handlePaymentWebhook } from "@/lib/billing/webhook-handler";

export const dynamic = "force-dynamic";

// PayPal webhook'u (ABD pazarı: abonelik + etkinlik bileti).
// developer.paypal.com → Apps & Credentials → uygulama → Webhooks'ta bu adres
// (https://<domain>/api/webhooks/paypal) eklenir ve şu olaylar seçilir:
//   BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
//   BILLING.SUBSCRIPTION.EXPIRED, BILLING.SUBSCRIPTION.SUSPENDED,
//   BILLING.SUBSCRIPTION.PAYMENT.FAILED, PAYMENT.SALE.COMPLETED,
//   CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED,
//   PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.DECLINED
// Oluşan webhook'un kimliği PAYPAL_WEBHOOK_ID olur: imza doğrulaması
// (sertifika + transmission id) bu kimliği de içerdiği için zorunlu.
// PayPal yerel adrese webhook gönderemez; yerelde test için ngrok vb. bir
// tünel ya da PayPal'ın "Webhooks simulator"ü kullanılır.
export async function POST(request: Request) {
  return handlePaymentWebhook("paypal", paypalPaymentProvider, request);
}
