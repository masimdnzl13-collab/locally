"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles } from "@/lib/auth/roles";
import { SALES_LEAD_STATUSES, type SalesLeadStatus } from "@/lib/admin/pipeline-constants";
import type { UserRole } from "@/lib/types";

type Result = { error?: string; success?: true };
const PATH = "/admin/isletme-hatti";

// RLS zaten yalnızca admin'e izin veriyor (sales_leads_admin_all); bu kontrol
// admin olmayan birine anlamlı bir yönlendirme vermek için.
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
  const roles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });
  if (!roles.includes("admin")) redirect("/");
  return { supabase, userId: user!.id };
}

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);
const isStatus = (v: string): v is SalesLeadStatus => (SALES_LEAD_STATUSES as string[]).includes(v);

export async function createSalesLeadAction(formData: FormData): Promise<Result> {
  const { supabase, userId } = await requireAdmin();
  const name = text(formData, "businessName", 120);
  if (!name) return { error: "İşletme adı gerekli." };
  const status = text(formData, "status", 20) || "tanitildi";
  if (!isStatus(status)) return { error: "Geçersiz durum." };
  const visitedOn = text(formData, "visitedOn", 10);

  const { error } = await supabase.from("sales_leads").insert({
    business_name: name,
    city: text(formData, "city", 80),
    visited_on: /^\d{4}-\d{2}-\d{2}$/.test(visitedOn) ? visitedOn : undefined,
    status,
    contact: text(formData, "contact", 160) || null,
    notes: text(formData, "notes", 1000) || null,
    created_by: userId,
  });
  if (error) return { error: "Aday kaydedilemedi." };
  revalidatePath(PATH);
  return { success: true };
}

export async function updateSalesLeadStatusAction(formData: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const id = text(formData, "leadId", 64);
  const status = text(formData, "status", 20);
  if (!id || !isStatus(status)) return { error: "Geçersiz istek." };
  const { error } = await supabase.from("sales_leads").update({ status }).eq("id", id);
  if (error) return { error: "Durum güncellenemedi." };
  revalidatePath(PATH);
  return { success: true };
}

// Kaydolan adayı gerçek businesses satırına bağlar; tabloda iki satır tek satıra iner.
export async function linkSalesLeadAction(formData: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const id = text(formData, "leadId", 64);
  const businessId = text(formData, "businessId", 64);
  if (!id || !businessId) return { error: "Geçersiz istek." };
  const { error } = await supabase
    .from("sales_leads")
    .update({ business_id: businessId, status: "kaydoldu" })
    .eq("id", id);
  if (error) return { error: "Bu işletme zaten başka bir adaya bağlı olabilir." };
  revalidatePath(PATH);
  return { success: true };
}

export async function deleteSalesLeadAction(formData: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const id = text(formData, "leadId", 64);
  if (!id) return { error: "Geçersiz istek." };
  const { error } = await supabase.from("sales_leads").delete().eq("id", id);
  if (error) return { error: "Aday silinemedi." };
  revalidatePath(PATH);
  return { success: true };
}
