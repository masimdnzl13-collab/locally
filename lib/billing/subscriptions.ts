import { createServiceClient } from "@/lib/supabase/service";
import { releaseNumberForSubscription } from "@/lib/billing/number-release";
import { getPaymentService } from "@/lib/payments";
import type {
  CancelSubscriptionResult,
  CreateSubscriptionResult,
  PaymentWebhookEvent,
  SubscriptionSummary,
} from "@/lib/payments";
import { applyTicketPaymentEvent } from "@/lib/events/ticket-payments";
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
  // güncellenir — tek doğruluk kaynağı sağlayıcı kalsın. "Dönem sonunda"
  // iptalde abonelik dönem bitene kadar aktif kalır; yalnızca işaretlenir.
  const result = await getPaymentService(market).cancelSubscription({
    subscriptionId: subscription.provider_subscription_id,
    atPeriodEnd: options.atPeriodEnd,
  });
  // Hemen iptalde Twilio numarası da hemen serbest bırakılır (webhook'u
  // beklemeden; test modunda webhook hiç gelmez). Dönem sonu iptalinde numara
  // dönem bitene kadar aktif kalır — bkz. lib/billing/number-release.ts.
  if (result.success && !options.atPeriodEnd) {
    try {
      await releaseNumberForSubscription(subscription.provider_subscription_id);
    } catch (err) {
      console.error("[billing] number release", businessId, (err as Error).message);
    }
  }
  if (result.success && options.atPeriodEnd) {
    await createServiceClient()
      .from("business_subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", subscription.provider_subscription_id);
  }
  return result;
}

export interface BusinessBilling {
  market: BusinessMarket;
  provider: "stripe" | "iyzico";
  subscription: {
    status: "active" | "past_due" | "canceled";
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    lastPaymentAt: string | null;
    canceledAt: string | null;
  } | null;
  // Sağlayıcıdan canlı çekilen ayrıntılar (plan, tutar, kart). Sağlayıcıya
  // ulaşılamazsa null — sayfa yerel kayıtla idare eder.
  live: SubscriptionSummary | null;
  liveError: string | null;
  simulated: boolean;
}

/**
 * Faturalandırma sayfası için işletmenin abonelik özeti. Yetki kontrolü
 * YAPMAZ: çağıran, businessId'nin oturumdaki kullanıcıya ait olduğunu
 * getMyBusiness ile doğrulamış olmalı.
 */
export async function getBusinessBilling(businessId: string, market: BusinessMarket): Promise<BusinessBilling> {
  const provider = market === "US" ? "stripe" : "iyzico";
  const { data: row } = await createServiceClient()
    .from("business_subscriptions")
    .select("provider_subscription_id, status, cancel_at_period_end, current_period_end, last_payment_at, canceled_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { market, provider, subscription: null, live: null, liveError: null, simulated: false };

  const subscription = {
    status: row.status as "active" | "past_due" | "canceled",
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end as string | null,
    lastPaymentAt: row.last_payment_at as string | null,
    canceledAt: row.canceled_at as string | null,
  };
  if (subscription.status === "canceled") {
    return { market, provider, subscription, live: null, liveError: null, simulated: false };
  }

  const live = await getPaymentService(market).getSubscriptionSummary(row.provider_subscription_id);
  return live.success
    ? { market, provider, subscription, live: live.summary, liveError: null, simulated: live.simulated }
    : { market, provider, subscription, live: null, liveError: live.error, simulated: false };
}

// Webhook'tan gelen ortak olayı işler: abonelik olayları
// business_subscriptions'a, tek seferlik ödemeler (etkinlik bileti) bilete
// yansır. Olay payment_events'e önce yazılır; aynı olay tekrar gelirse insert
// benzersizlik ihlaline düşer ve işlenmeden atlanır.
export async function applyPaymentWebhookEvent(
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
    if (event.type === "one_time.completed" || event.type === "one_time.expired") {
      await applyTicketPaymentEvent(event);
    } else {
      await applyToSubscription(supabase, provider, event);
    }
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
  event: Exclude<PaymentWebhookEvent, { type: "ignored" | "one_time.completed" | "one_time.expired" }>
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
