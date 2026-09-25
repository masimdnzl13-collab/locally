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

export type BillingProvider = "paypal" | "stripe" | "iyzico";

// İşletme aboneliği akışları. Sağlayıcı businesses.market'e göre seçilir
// (TR → iyzico, US → PayPal). Bu fonksiyonlar yetki kontrolü YAPMAZ —
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

  // Dönem sonu iptalinde işaret sağlayıcıya gitmeden ÖNCE yazılır: PayPal'da
  // ertelenmiş iptal yok, abonelik hemen iptal edilir ve
  // BILLING.SUBSCRIPTION.CANCELLED birkaç saniye içinde gelir. Webhook bu
  // işareti görünce aboneliği dönem sonuna kadar açık tutar ("deferred").
  if (options.atPeriodEnd) {
    await createServiceClient()
      .from("business_subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", subscription.provider_subscription_id);
  }

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
  if (!result.success && options.atPeriodEnd) {
    await createServiceClient()
      .from("business_subscriptions")
      .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq("provider_subscription_id", subscription.provider_subscription_id);
  }
  return result;
}

export interface BusinessBilling {
  market: BusinessMarket;
  provider: BillingProvider;
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
  const provider: BillingProvider = market === "US" ? "paypal" : "iyzico";
  const { data: row } = await createServiceClient()
    .from("business_subscriptions")
    .select("provider_subscription_id, status, cancel_at_period_end, current_period_end, last_payment_at, canceled_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { market, provider, subscription: null, live: null, liveError: null, simulated: false };

  const periodEnded = row.current_period_end ? new Date(row.current_period_end) <= new Date() : true;
  const subscription = {
    // Dönem sonu iptali: dönem bitince (PayPal'da bunu bildiren bir olay yok)
    // abonelik bitmiş sayılır.
    status: (row.cancel_at_period_end && periodEnded ? "canceled" : row.status) as "active" | "past_due" | "canceled",
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    currentPeriodEnd: row.current_period_end as string | null,
    lastPaymentAt: row.last_payment_at as string | null,
    canceledAt: row.canceled_at as string | null,
  };
  if (subscription.status === "canceled") {
    return { market, provider, subscription, live: null, liveError: null, simulated: false };
  }

  const live = await getPaymentService(market).getSubscriptionSummary(row.provider_subscription_id);
  if (live.success && subscription.cancelAtPeriodEnd) {
    // PayPal'da abonelik iptal anında "canceled" görünür ve dönem bilgisi
    // kaybolur; ödenmiş dönem yerel kayıttan gösterilir.
    live.summary = {
      ...live.summary,
      status: subscription.status,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: live.summary.currentPeriodEnd ?? subscription.currentPeriodEnd,
    };
  }
  return live.success
    ? { market, provider, subscription, live: live.summary, liveError: null, simulated: live.simulated }
    : { market, provider, subscription, live: null, liveError: live.error, simulated: false };
}

// Webhook'tan gelen ortak olayı işler: abonelik olayları
// business_subscriptions'a, tek seferlik ödemeler (etkinlik bileti) bilete
// yansır. Olay payment_events'e önce yazılır; aynı olay tekrar gelirse insert
// benzersizlik ihlaline düşer ve işlenmeden atlanır.
//
// "deferred": dönem sonu iptali işaretli bir aboneliğin iptal olayı dönem
// bitmeden geldi (PayPal iptali hemen bildirir). Abonelik dönem sonuna kadar
// açık kalır; numara serbest bırakma gibi bitiş işleri çağıranda YAPILMAZ —
// dönem bitince günlük iş (/api/cron/tideline-number-release) halleder.
export async function applyPaymentWebhookEvent(
  provider: BillingProvider,
  event: PaymentWebhookEvent
): Promise<"applied" | "deferred" | "duplicate" | "ignored"> {
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
    if (event.type === "one_time.completed" || event.type === "one_time.expired" || event.type === "one_time.approved") {
      await applyTicketPaymentEvent(event);
    } else if ((await applyToSubscription(supabase, provider, event)) === "deferred") {
      return "deferred";
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
  provider: BillingProvider,
  event: Exclude<PaymentWebhookEvent, { type: "ignored" | "one_time.completed" | "one_time.expired" | "one_time.approved" }>
): Promise<"deferred" | void> {
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
          // undefined → kolon hiç gönderilmez, mevcut değer korunur.
          current_period_end: event.currentPeriodEnd ?? undefined,
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
      const { data: row, error: readError } = await supabase
        .from("business_subscriptions")
        .select("cancel_at_period_end, current_period_end")
        .eq("provider_subscription_id", event.subscriptionId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (row?.cancel_at_period_end && row.current_period_end && new Date(row.current_period_end) > new Date()) {
        const { error } = await supabase
          .from("business_subscriptions")
          .update({ canceled_at: now, updated_at: now })
          .eq("provider_subscription_id", event.subscriptionId);
        if (error) throw new Error(error.message);
        return "deferred";
      }
      const { error } = await supabase
        .from("business_subscriptions")
        .update({ status: "canceled", canceled_at: now, updated_at: now })
        .eq("provider_subscription_id", event.subscriptionId);
      if (error) throw new Error(error.message);
      break;
    }
  }
}
