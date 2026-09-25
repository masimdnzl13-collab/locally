import { NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payments";
import { applyPaymentWebhookEvent } from "@/lib/billing/subscriptions";
import { completeUsSignupFromWebhook } from "@/lib/onboarding-us/complete";
import { releaseNumberForSubscription } from "@/lib/billing/number-release";

export const dynamic = "force-dynamic";

// Stripe webhook'u (ABD pazarı). Stripe Dashboard → Developers → Webhooks'ta
// bu adres (https://<domain>/api/webhooks/stripe) eklenir ve şu olaylar
// seçilir: checkout.session.completed, checkout.session.expired, invoice.paid,
// invoice.payment_failed, customer.subscription.deleted. Yerelde: `stripe listen
// --forward-to localhost:3001/api/webhooks/stripe` — çıkan whsec_ değeri
// STRIPE_WEBHOOK_SECRET olur.
//
// checkout.session.completed iki türlüdür: mode=subscription → işletme
// aboneliği; mode=payment → tek seferlik ödeme (etkinlik bileti; metadata
// reference_kind/reference_id bileti gösterir). İkisi de
// applyPaymentWebhookEvent'te ayrışır (bkz. lib/payments/stripe-provider.ts
// toWebhookEvent, lib/events/ticket-payments.ts).
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
    const outcome = await applyPaymentWebhookEvent("stripe", event);
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
    if (outcome === "applied" && event.type === "subscription.canceled") {
      // Stripe bunu hemen iptalde hemen, dönem sonu iptalinde dönem bitince
      // gönderir. Hata Stripe'a 500 dönmez; günlük iş yeniden dener.
      try {
        await releaseNumberForSubscription(event.subscriptionId);
      } catch (err) {
        console.error("[stripe-webhook] number release", event.subscriptionId, (err as Error).message);
      }
    }
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 500 → Stripe olayı daha sonra yeniden dener.
    console.error("[stripe-webhook]", result.event.rawType, (err as Error).message);
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }
}
