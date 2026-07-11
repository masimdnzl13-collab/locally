"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (profile?.role !== "admin") redirect("/");

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
