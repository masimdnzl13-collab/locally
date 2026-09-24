import { NextResponse } from "next/server";
import { getPaymentService } from "@/lib/payments";
import { applySubscriptionWebhookEvent } from "@/lib/billing/subscriptions";

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
    const outcome = await applySubscriptionWebhookEvent("stripe", result.event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    // 500 → Stripe olayı daha sonra yeniden dener.
    console.error("[stripe-webhook]", result.event.rawType, (err as Error).message);
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }
}
