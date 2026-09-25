import { NextResponse } from "next/server";
import type { PaymentService } from "@/lib/payments";
import { applyPaymentWebhookEvent, type SubscriptionProvider } from "@/lib/billing/subscriptions";
import { completeUsSignupFromWebhook } from "@/lib/onboarding-us/complete";
import { releaseNumberForSubscription } from "@/lib/billing/number-release";

// Sağlayıcı webhook route'larının ortak gövdesi (/api/webhooks/paypal,
// /api/webhooks/stripe). İmza doğrulaması ve olay çevirisi sağlayıcıda;
// buradan sonrası sağlayıcıdan bağımsız: ortak olay → payment_events +
// abonelik/bilet güncellemesi → kurulum ve numara bırakma yan etkileri.
//
// İmza ham gövde üzerinde doğrulanır: request.json() DEĞİL request.text().
export async function handlePaymentWebhook(
  provider: SubscriptionProvider,
  service: PaymentService,
  request: Request
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
    if (outcome === "applied" && event.type === "subscription.activated") {
      // Abonelik kaydedildi; kurulum hatası sağlayıcıya 500 olarak dönmemeli
      // (olay zaten işlendi, tekrar denemesi "duplicate" sayılır). Kalan adımları
      // /kayit/us/durum ve admin kuyruğu idempotent olarak tamamlar.
      try {
        await completeUsSignupFromWebhook(event.businessId, event.subscriptionId);
      } catch (err) {
        console.error(tag, "onboarding", event.businessId, (err as Error).message);
      }
    }
    // "deferred" (dönem sonuna ertelenmiş iptal) burada numara bırakmaz.
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
