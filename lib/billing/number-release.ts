import { createServiceClient } from "@/lib/supabase/service";
import { releaseTidelineRestaurantNumber } from "@/lib/tideline/service-api";

// AC — abonelik bitince Tideline restoranının Twilio numarasını serbest bırakır.
// Ne zaman çağrılır:
//   * "Hemen iptal" (cancelBusinessSubscription, atPeriodEnd=false) → anında.
//   * Stripe customer.subscription.deleted webhook'u → Stripe bunu hemen
//     iptalde hemen, dönem sonu iptalinde dönem BİTİNCE gönderir; yani dönem
//     sonu iptalinde numara dönem bitene kadar aktif kalır.
//   * Günlük iş (/api/cron/tideline-number-release) → kaçan webhook'lar ve test
//     modu (Stripe anahtarı yokken webhook gelmez) için güvenlik ağı.
// İdempotent: tideline_number_released_at dolu ise hiçbir şey yapmaz; Tideline
// tarafı da yalnızca aktif satırlara dokunur.

export type NumberReleaseOutcome = "released" | "not_needed" | "already_released" | "still_subscribed" | "failed" | "not_found";

export async function releaseNumberForSubscription(providerSubscriptionId: string): Promise<NumberReleaseOutcome> {
  const supabase = createServiceClient();
  const { data: sub } = await supabase
    .from("business_subscriptions")
    .select("id, business_id, tideline_number_released_at")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();
  if (!sub) return "not_found";
  if (sub.tideline_number_released_at) return "already_released";

  const markDone = (error: string | null = null) =>
    supabase
      .from("business_subscriptions")
      .update({ tideline_number_released_at: new Date().toISOString(), tideline_number_release_error: error })
      .eq("id", sub.id);

  // İşletme bu arada yeniden abone olduysa numarası yeni aboneliğe aittir.
  const { data: other } = await supabase
    .from("business_subscriptions")
    .select("id")
    .eq("business_id", sub.business_id)
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .neq("id", sub.id)
    .limit(1)
    .maybeSingle();
  if (other) {
    await markDone("superseded by a newer active subscription");
    return "still_subscribed";
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("tideline_restaurant_id")
    .eq("id", sub.business_id)
    .maybeSingle();
  if (!business?.tideline_restaurant_id) {
    await markDone();
    return "not_needed";
  }

  const result = await releaseTidelineRestaurantNumber(business.tideline_restaurant_id);
  const error = !result.ok
    ? result.error
    : result.data.failed.length
      ? result.data.failed.map((f) => f.error).join("; ")
      : null;
  if (error) {
    await supabase
      .from("business_subscriptions")
      .update({ tideline_number_release_error: error.slice(0, 500) })
      .eq("id", sub.id);
    return "failed";
  }
  await markDone();
  return "released";
}

// Günlük iş: iptal edilmiş ya da dönem sonu iptali olup dönemi bitmiş, numarası
// henüz serbest bırakılmamış abonelikler.
export async function releaseNumbersForEndedSubscriptions(now = new Date()) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("provider_subscription_id, status, cancel_at_period_end, current_period_end")
    .is("tideline_number_released_at", null)
    .or(`status.eq.canceled,and(cancel_at_period_end.eq.true,current_period_end.lt.${now.toISOString()})`);
  if (error) throw new Error(error.message);

  const outcomes: Record<NumberReleaseOutcome, number> = {
    released: 0, not_needed: 0, already_released: 0, still_subscribed: 0, failed: 0, not_found: 0,
  };
  for (const row of data ?? []) {
    outcomes[await releaseNumberForSubscription(row.provider_subscription_id)]++;
  }
  return outcomes;
}
