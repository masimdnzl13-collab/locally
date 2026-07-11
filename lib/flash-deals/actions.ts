"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";

export async function reserveFlashDealAction(formData: FormData) {
  const flashDealId = String(formData.get("flashDealId") ?? "");
  if (!flashDealId) return { error: "Flaş fırsat bulunamadı." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/giris?next=/bu-aksam`);
  }

  const { data, error } = await supabase.rpc("reserve_flash_deal", {
    p_flash_deal_id: flashDealId,
  });

  if (error) {
    const [code, ...rest] = error.message.split(":");
    const message = rest.join(":").trim();
    if (code === "ALREADY_RESERVED") return { error: "Bu flaş için zaten yerin var." };
    if (code === "DEAL_FULL") return { error: "Kontenjan doldu." };
    if (code === "DEAL_NOT_LIVE") return { error: "Bu flaş fırsat artık geçerli değil." };
    return { error: message || "Yer ayırtılamadı, tekrar dener misin?" };
  }

  return { success: true, confirmationCode: data.confirmation_code as string };
}

export async function createFlashDealAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await getMyBusiness();
  if (!business) return { error: "İşletme bulunamadı." };

  const offerText = String(formData.get("offerText") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const quota = Number(formData.get("quota"));

  if (!offerText) return { error: "Teklif metni zorunlu." };
  if (!startsAt || !endsAt) return { error: "Saat aralığı zorunlu." };
  if (new Date(endsAt) <= new Date(startsAt)) {
    return { error: "Bitiş saati başlangıçtan sonra olmalı." };
  }
  if (!Number.isFinite(quota) || quota < 1) {
    return { error: "Kontenjan en az 1 olmalı." };
  }

  const supabase = createClient();

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("flash_deals")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .gt("ends_at", nowIso)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { error: "Zaten aktif bir flaşın var. Önce onu bitirmelisin." };
  }

  const { error } = await supabase.from("flash_deals").insert({
    business_id: business.id,
    offer_text: offerText,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    total_quota: quota,
    remaining_quota: quota,
    is_active: true,
  });

  if (error) return { error: "Flaş yayınlanamadı: " + error.message };

  revalidatePath("/panel/bu-aksam");
  revalidatePath("/bu-aksam");
  return { success: true };
}

export async function endFlashDealAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await getMyBusiness();
  if (!business) return { error: "İşletme bulunamadı." };

  const flashDealId = String(formData.get("flashDealId") ?? "");
  if (!flashDealId) return { error: "Flaş bulunamadı." };

  const supabase = createClient();
  const { error } = await supabase
    .from("flash_deals")
    .update({ is_active: false })
    .eq("id", flashDealId)
    .eq("business_id", business.id);

  if (error) return { error: error.message };

  revalidatePath("/panel/bu-aksam");
  revalidatePath("/bu-aksam");
  return { success: true };
}
