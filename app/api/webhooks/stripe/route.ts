import { NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payments";
import { applySubscriptionWebhookEvent } from "@/lib/billing/subscriptions";
import { completeUsSignupFromWebhook } from "@/lib/onboarding-us/complete";

export const dynamic = "force-dynamic";

// Stripe webhook'u (ABD pazarı). Stripe Dashboard → Developers → Webhooks'ta
// bu adres (https://<domain>/api/webhooks/stripe) eklenir ve şu olaylar
// seçilir: checkout.session.completed, invoice.paid, invoice.payment_failed,
// customer.subscription.deleted. Yerelde: `stripe listen --forward-to
// localhost:3001/api/webhooks/stripe` — çıkan whsec_ değeri
// STRIPE_WEBHOOK_SECRET olur.
//
// İmza doğrulaması ham gövde üzerinde yapılır, bu yüzden request.json()
// DEĞİL request.text() kullanılıyor.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await getPaymentService("US").handleWebhook(rawBody, request.headers);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const event = result.event;
    const outcome = await applySubscriptionWebhookEvent("stripe", event);
    if (outcome === "applied" && event.type === "subscription.activated") {
      // Abonelik kaydedildi; kurulum hatası Stripe'a 500 olarak dönmemeli
      // (olay zaten işlendi, tekrar denemesi "duplicate" sayılır). Kalan adımları
      // /kayit/us/durum ve admin kuyruğu idempotent olarak tamamlar.
      try {
        await completeUsSignupFromWebhook(event.businessId, event.subscriptionId);
      } catch (err) {
        console.error("[stripe-webhook] onboarding", event.businessId, (err as Error).message);
      }
    }
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 500 → Stripe olayı daha sonra yeniden dener.
    console.error("[stripe-webhook]", result.event.rawType, (err as Error).message);
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }
}
