import { NextResponse } from "next/server";
import type { PaymentService } from "@/lib/payments";
import { applyPaymentWebhookEvent, type BillingProvider } from "@/lib/billing/subscriptions";
import { completeUsSignupFromWebhook } from "@/lib/onboarding-us/complete";
import { releaseNumberForSubscription } from "@/lib/billing/number-release";

// Sağlayıcı webhook uçlarının (app/api/webhooks/paypal, .../stripe) ortak
// gövdesi: imzayı sağlayıcı doğrular ve olayı ortak formata çevirir; buradan
// sonrası sağlayıcıdan bağımsızdır.
//
// İmza doğrulaması ham gövde üzerinde yapılır, bu yüzden request.json()
// DEĞİL request.text() kullanılıyor.
export async function handlePaymentWebhookRequest(
  request: Request,
  service: PaymentService,
  provider: BillingProvider
): Promise<NextResponse> {
  const tag = `[${provider}-webhook]`;
  const rawBody = await request.text();
  const result = await service.handleWebhook(rawBody, request.headers);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const event = result.event;
    const outcome = await applyPaymentWebhookEvent(provider, event);
    if (outcome === "applied" && event.type === "subscription.activated" && provider !== "iyzico") {
      // Abonelik kaydedildi; kurulum hatası sağlayıcıya 500 olarak dönmemeli
      // (olay zaten işlendi, tekrar denemesi "duplicate" sayılır). Kalan adımları
      // /kayit/us/durum ve admin kuyruğu idempotent olarak tamamlar.
      try {
        await completeUsSignupFromWebhook(event.businessId, event.subscriptionId, provider);
      } catch (err) {
        console.error(tag, "onboarding", event.businessId, (err as Error).message);
      }
    }
    // Dönem sonu iptalinde ("deferred") numara dönem bitene kadar kalır.
    if (outcome === "applied" && event.type === "subscription.canceled") {
      // Hata sağlayıcıya 500 dönmez; günlük iş yeniden dener.
      try {
        await releaseNumberForSubscription(event.subscriptionId);
      } catch (err) {
        console.error(tag, "number release", event.subscriptionId, (err as Error).message);
      }
    }
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 500 → sağlayıcı olayı daha sonra yeniden dener.
    console.error(tag, result.event.rawType, (err as Error).message);
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }
}
