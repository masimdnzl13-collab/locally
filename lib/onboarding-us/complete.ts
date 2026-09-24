import { createServiceClient } from "@/lib/supabase/service";
import { provisionTidelineRestaurant } from "@/lib/tideline/internal-api";
import { US_SIGNUP_COLUMNS, type UsSignup } from "@/lib/onboarding-us/signup";

// Ödeme sonrası kurulum: tideline modülünü açar ve Tideline'dan restoran +
// Twilio numarası ister. İdempotent — ödeme dönüş sayfası her yenilendiğinde,
// işletme sahibi panele her girdiğinde ve admin kuyruğundan "tekrar dene"
// ile güvenle yeniden çağrılabilir; Tideline tarafı da externalRef (Locally
// business id) ile idempotent, ikinci bir restoran/numara açılmaz.
//
// Tideline'a ulaşılamazsa ya da numara alınamazsa akış TIKANMAZ: başvuru
// yine "active" olur, tideline_restaurant_id boş kalır ve kullanıcı "24 saat
// içinde" bekleme ekranını görür; admin /admin/tideline-kurulum'dan tamamlar.

export async function markUsSignupPaid(businessId: string, payment: { mode: "stripe" | "test"; ref: string }) {
  await createServiceClient()
    .from("us_onboarding")
    .update({
      status: "activating",
      payment_mode: payment.mode,
      payment_ref: payment.ref,
      paid_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("status", "awaiting_payment");
}

// Stripe modunda ödemenin kanıtı webhook'un yazdığı aktif abonelik satırıdır
// (bkz. lib/billing/subscriptions.ts) — dönüş URL'ine güvenilmez.
export async function findActiveSubscriptionRef(businessId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from("business_subscriptions")
    .select("provider_subscription_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.provider_subscription_id ?? null;
}

export async function activateUsSignup(businessId: string): Promise<UsSignup | null> {
  const service = createServiceClient();
  const { data } = await service.from("us_onboarding").select(US_SIGNUP_COLUMNS).eq("business_id", businessId).maybeSingle();
  const signup = data as unknown as UsSignup | null;
  if (!signup || signup.status === "awaiting_payment") return signup;

  // Yalnızca yaz modülü (tideline); kış modülü (locally_core) P7'deki sezon
  // geçişiyle gelir.
  if (!signup.business.active_modules.includes("tideline")) {
    const { error } = await service.rpc("business_modules_add", {
      p_business_ids: [businessId],
      p_module: "tideline",
    });
    if (error) throw new Error(error.message);
  }

  const update: Record<string, unknown> = {};
  if (!signup.business.tideline_restaurant_id) {
    const result = await provisionTidelineRestaurant({
      businessId,
      name: signup.business.name,
      contactPhone: signup.contact_phone,
      address: signup.street_address,
      city: signup.city,
      state: signup.state,
      postalCode: signup.postal_code,
    });
    if (result.ok) {
      const { error } = await service
        .from("businesses")
        .update({ tideline_restaurant_id: result.data.restaurant.id })
        .eq("id", businessId);
      if (error) throw new Error(error.message);
      update.tideline_phone_status = result.data.phone?.status ?? null;
      update.tideline_phone_number = result.data.phone?.phoneNumber ?? null;
      update.provisioning_error =
        result.data.phone?.status === "pending_manual" ? result.data.phone.failureReason : null;
    } else {
      update.provisioning_error = result.error;
    }
  }

  if (signup.status !== "active") {
    update.status = "active";
    update.completed_at = new Date().toISOString();
  }
  if (Object.keys(update).length) {
    await service.from("us_onboarding").update(update).eq("business_id", businessId);
  }

  const { data: fresh } = await service.from("us_onboarding").select(US_SIGNUP_COLUMNS).eq("business_id", businessId).maybeSingle();
  return fresh as unknown as UsSignup | null;
}
