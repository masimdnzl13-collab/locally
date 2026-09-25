import { createServiceClient } from "@/lib/supabase/service";
import {
  getTidelineBrainReadiness,
  provisionTidelineRestaurant,
  type TidelineBrainReadiness,
} from "@/lib/tideline/service-api";
import { US_SIGNUP_COLUMNS, type UsSignup } from "@/lib/onboarding-us/signup";

// Ödeme sonrası kurulum: tideline modülünü açar ve Tideline'dan restoran +
// Twilio numarası ister. İdempotent — ödeme dönüş sayfası her yenilendiğinde,
// işletme sahibi panele her girdiğinde ve admin kuyruğundan "tekrar dene"
// ile güvenle yeniden çağrılabilir; Tideline tarafı da externalRef (Locally
// business id) ile idempotent, ikinci bir restoran/numara açılmaz.
//
// Tideline'a ulaşılamazsa ya da numara alınamazsa akış TIKANMAZ: başvuru
// yine "awaiting_menu"ya geçer, tideline_restaurant_id boş kalır ve kullanıcı
// "24 saat içinde" bekleme ekranını görür; admin /admin/tideline-kurulum'dan
// tamamlar.
//
// "active" yalnızca Brain'de çalışma saatleri ve en az MIN_MENU_ITEMS aktif
// menü kalemi varken olur (menü adımı: /kayit/us/menu). Bu veri olmadan
// Tideline'ın AI asistanı arayana saat/menü sorularında cevap veremez.

export const MIN_MENU_ITEMS = 5;
export const MIN_HOURS_DAYS = 1;

export function isMenuReady(readiness: TidelineBrainReadiness) {
  return readiness.hoursDays >= MIN_HOURS_DAYS && readiness.menuItems >= MIN_MENU_ITEMS;
}

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
  let restaurantId = signup.business.tideline_restaurant_id;
  if (!restaurantId) {
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
      restaurantId = result.data.restaurant.id;
      update.tideline_phone_status = result.data.phone?.status ?? null;
      update.tideline_phone_number = result.data.phone?.phoneNumber ?? null;
      update.provisioning_error =
        result.data.phone?.status === "pending_manual" ? result.data.phone.failureReason : null;
    } else {
      update.provisioning_error = result.error;
    }
  }

  if (signup.status === "activating") update.status = "awaiting_menu";
  // Menü adımı: Tideline'a ulaşılamazsa "awaiting_menu"da kalır, bir sonraki
  // çağrıda (durum/menü sayfası yenilemesi) yeniden bakılır.
  if (signup.status !== "active" && restaurantId) {
    const readiness = await getTidelineBrainReadiness(restaurantId);
    if (readiness.ok && isMenuReady(readiness.data)) {
      update.status = "active";
      update.completed_at = new Date().toISOString();
    }
  }
  if (Object.keys(update).length) {
    await service.from("us_onboarding").update(update).eq("business_id", businessId);
  }

  const { data: fresh } = await service.from("us_onboarding").select(US_SIGNUP_COLUMNS).eq("business_id", businessId).maybeSingle();
  return fresh as unknown as UsSignup | null;
}

// Stripe webhook'u (checkout.session.completed → subscription.activated)
// kurulumu kullanıcının durum sayfasına dönmesini beklemeden tamamlar:
// ödemeyi işaretler, tideline modülünü açar, Tideline restoran + numara
// kurulumunu tetikler. ABD kaydı olmayan işletmeler için hiçbir şey yapmaz.
// Durum sayfası aynı adımları idempotent olarak yine dener; buradaki bir
// hata kullanıcıyı tıkamaz.
export async function completeUsSignupFromWebhook(businessId: string, subscriptionId: string) {
  await markUsSignupPaid(businessId, { mode: "stripe", ref: subscriptionId });
  return activateUsSignup(businessId);
}
