import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentService } from "@/lib/payments";
import type {
  CancelSubscriptionResult,
  CreateSubscriptionResult,
  PaymentWebhookEvent,
} from "@/lib/payments";
import type { BusinessMarket } from "@/lib/types";

// İşletme aboneliği akışları. Sağlayıcı businesses.market'e göre seçilir
// (TR → iyzico, US → Stripe). Bu fonksiyonlar yetki kontrolü YAPMAZ —
// çağıran server action, kullanıcının işletmenin sahibi olduğunu (bkz.
// getMyBusiness) doğrulamış olmalı.

async function getBusinessMarket(businessId: string): Promise<BusinessMarket | null> {
  const { data } = await createServiceClient()
    .from("businesses")
    .select("market")
    .eq("id", businessId)
    .maybeSingle();
  return (data?.market as BusinessMarket | undefined) ?? null;
}

export async function startBusinessSubscription(input: {
  businessId: string;
  priceId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CreateSubscriptionResult> {
  const market = await getBusinessMarket(input.businessId);
  if (!market) return { success: false, error: "İşletme bulunamadı." };
  return getPaymentService(market).createSubscription(input);
}

export async function cancelBusinessSubscription(
  businessId: string,
  options: { atPeriodEnd?: boolean } = {}
): Promise<CancelSubscriptionResult> {
  const market = await getBusinessMarket(businessId);
  if (!market) return { success: false, error: "İşletme bulunamadı." };

  const { data: subscription } = await createServiceClient()
    .from("business_subscriptions")
    .select("provider_subscription_id")
    .eq("business_id", businessId)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) return { success: false, error: "Aktif abonelik bulunamadı." };

  // Durum burada değil, sağlayıcının "subscription.canceled" webhook'unda
  // güncellenir — tek doğruluk kaynağı sağlayıcı kalsın.
  return getPaymentService(market).cancelSubscription({
    subscriptionId: subscription.provider_subscription_id,
    atPeriodEnd: options.atPeriodEnd,
  });
}

// Webhook'tan gelen ortak olayı business_subscriptions'a yansıtır. Olay
// payment_events'e önce yazılır; aynı olay tekrar gelirse insert benzersizlik
// ihlaline düşer ve işlenmeden atlanır.
export async function applySubscriptionWebhookEvent(
  provider: "stripe" | "iyzico",
  event: PaymentWebhookEvent
): Promise<"applied" | "duplicate" | "ignored"> {
  if (event.type === "ignored") return "ignored";

  const supabase = createServiceClient();
  const { error: logError } = await supabase.from("payment_events").insert({
    purchase_id: null,
    conversation_id: event.eventId,
    event_type: `${provider}:${event.rawType}`,
    status: event.type === "payment.failed" ? "failed" : "success",
    raw_payload: event as unknown as Record<string, unknown>,
  });
  if (logError) {
    if (logError.code === "23505") return "duplicate";
    throw new Error(logError.message);
  }

  try {
    await applyToSubscription(supabase, provider, event);
  } catch (err) {
    // Log satırı kalırsa sağlayıcının yeniden denemesi "duplicate" sayılıp
    // hiç uygulanmaz; geri al ki bir sonraki deneme işlensin.
    await supabase
      .from("payment_events")
      .delete()
      .eq("conversation_id", event.eventId)
      .eq("event_type", `${provider}:${event.rawType}`);
    throw err;
  }
  return "applied";
}

async function applyToSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  provider: "stripe" | "iyzico",
  event: Exclude<PaymentWebhookEvent, { type: "ignored" }>
): Promise<void> {
  const now = new Date().toISOString();

  switch (event.type) {
    case "subscription.activated": {
      const { error } = await supabase.from("business_subscriptions").upsert(
        {
          business_id: event.businessId,
          provider,
          provider_customer_id: event.customerId,
          provider_subscription_id: event.subscriptionId,
          status: "active",
          updated_at: now,
        },
        { onConflict: "provider_subscription_id" }
      );
      if (error) throw new Error(error.message);
      break;
    }
    case "payment.succeeded": {
      const { error } = await supabase
        .from("business_subscriptions")
        .update({
          status: "active",
          last_payment_at: now,
          current_period_end: event.currentPeriodEnd,
          updated_at: now,
        })
        .eq("provider_subscription_id", event.subscriptionId)
        .neq("status", "canceled");
      if (error) throw new Error(error.message);
      break;
    }
    case "payment.failed": {
      const { error } = await supabase
        .from("business_subscriptions")
        .update({ status: "past_due", updated_at: now })
        .eq("provider_subscription_id", event.subscriptionId)
        .neq("status", "canceled");
      if (error) throw new Error(error.message);
      break;
    }
    case "subscription.canceled": {
      const { error } = await supabase
        .from("business_subscriptions")
        .update({ status: "canceled", canceled_at: now, updated_at: now })
        .eq("provider_subscription_id", event.subscriptionId);
      if (error) throw new Error(error.message);
      break;
    }
  }
}
