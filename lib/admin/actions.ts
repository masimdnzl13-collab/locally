"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles } from "@/lib/auth/roles";
import { generateQrDataUrl } from "@/lib/qr";
import type { UserRole } from "@/lib/types";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user!.id)
    .single();

  const effectiveRoles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });
  if (!effectiveRoles.includes("admin")) redirect("/");

  return supabase;
}

export async function approveBusinessAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "İşletme bulunamadı." };

  const { error } = await supabase
    .from("businesses")
    .update({ approval_status: "approved", suspend_reason: null })
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/admin/isletmeler");
  revalidatePath("/kesfet");
  return { success: true };
}

export async function rejectBusinessAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!businessId) return { error: "İşletme bulunamadı." };
  if (!reason) return { error: "Red gerekçesi zorunlu." };

  const { error } = await supabase
    .from("businesses")
    .update({ approval_status: "rejected", suspend_reason: reason })
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/admin/isletmeler");
  return { success: true };
}

export async function suspendBusinessAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!businessId) return { error: "İşletme bulunamadı." };

  const { error } = await supabase
    .from("businesses")
    .update({ approval_status: "suspended", suspend_reason: reason || null })
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/admin/isletmeler");
  revalidatePath("/kesfet");
  return { success: true };
}

export async function reactivateBusinessAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "İşletme bulunamadı." };

  const { error } = await supabase
    .from("businesses")
    .update({ approval_status: "approved", suspend_reason: null })
    .eq("id", businessId);

  if (error) return { error: error.message };

  revalidatePath("/admin/isletmeler");
  revalidatePath("/kesfet");
  return { success: true };
}

// Sahada işletmeye uzatılacak, önceden işletme adı doldurulmuş kayıt
// bağlantısı + QR kodu üretir. Hiçbir şey kaydetmez — businesses tablosuna
// hiç dokunmaz, salt istemci tarafında link/QR birleştirir; bu yüzden aynı
// isim için istenildiği kadar tekrar üretilebilir.
export async function generateSignupInviteAction(
  formData: FormData
): Promise<{ error?: string; success?: true; url?: string; qrDataUrl?: string; name?: string }> {
  await requireAdmin();

  const name = String(formData.get("businessName") ?? "").trim();
  if (!name) return { error: "İşletme adı gerekli." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${siteUrl}/kayit?rol=isletme&isletme=${encodeURIComponent(name)}`;
  const qrDataUrl = await generateQrDataUrl(url);

  return { success: true, url, qrDataUrl, name };
}

const CONTENT_TABLES = {
  paket: "packages",
  flas: "flash_deals",
  etkinlik: "events",
} as const;

export async function removeContentAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const kind = String(formData.get("kind") ?? "") as keyof typeof CONTENT_TABLES;
  const id = String(formData.get("id") ?? "");
  if (!id || !CONTENT_TABLES[kind]) return { error: "İçerik bulunamadı." };

  const updates: Record<string, boolean> =
    kind === "etkinlik"
      ? { is_cancelled: true, removed_by_admin: true }
      : { is_active: false, removed_by_admin: true };

  const { error } = await supabase.from(CONTENT_TABLES[kind]).update(updates).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/icerik");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");
  revalidatePath("/etkinlikler");
  return { success: true };
}

// Yalnızca eski seed-demo.sql işletmelerini (sahibi @locally.app ile biten)
// tek tek kaldırmak için — RPC'nin kendisi de aynı imzayı ayrıca kontrol
// eder, bu yüzden form alanı kurcalanıp başka bir işletme gönderilse bile
// gerçek bir pilot işletmesi asla silinemez. Toplu silme yok, bilinçli.
export async function deleteLegacyBusinessAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const supabase = await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "İşletme bulunamadı." };

  const { error } = await supabase.rpc("admin_delete_legacy_business", {
    p_business_id: businessId,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/eski-veri");
  revalidatePath("/kesfet");
  revalidatePath("/bu-aksam");
  revalidatePath("/etkinlikler");
  return { success: true };
}
