"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SALES_LEAD_STATUSES, type SalesLeadStatus } from "@/lib/admin/pipeline-constants";

type Result = { error?: string; success?: true };
const PATH = "/admin/isletme-hatti";


const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);
const isStatus = (v: string): v is SalesLeadStatus => (SALES_LEAD_STATUSES as string[]).includes(v);

export async function createSalesLeadAction(formData: FormData): Promise<Result> {
  const { supabase, userId } = await requireAdmin("action:createSalesLead");
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
  const { supabase } = await requireAdmin("action:updateSalesLeadStatus");
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
  const { supabase } = await requireAdmin("action:linkSalesLead");
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
  const { supabase } = await requireAdmin("action:deleteSalesLead");
  const id = text(formData, "leadId", 64);
  if (!id) return { error: "Geçersiz istek." };
  const { error } = await supabase.from("sales_leads").delete().eq("id", id);
  if (error) return { error: "Aday silinemedi." };
  revalidatePath(PATH);
  return { success: true };
}
