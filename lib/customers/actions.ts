"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";

export async function addCustomerAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await getMyBusiness();
  if (!business) redirect("/panel/kurulum");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) return { error: "Ad zorunlu." };
  if (!phone) return { error: "Telefon zorunlu." };

  const supabase = createClient();
  const { error } = await supabase.from("customers").insert({
    business_id: business!.id,
    phone,
    full_name: fullName,
    notes: notes || null,
  });

  if (error) {
    if (error.message.includes("duplicate key")) {
      return { error: "Bu telefon numarası zaten kayıtlı." };
    }
    return { error: "Eklenemedi: " + error.message };
  }

  revalidatePath("/panel/musteriler");
  redirect("/panel/musteriler");
}

export async function updateCustomerNotesAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await getMyBusiness();
  if (!business) redirect("/panel/kurulum");

  const customerId = String(formData.get("customerId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!customerId) return { error: "Müşteri bulunamadı." };

  const supabase = createClient();
  const { error } = await supabase
    .from("customers")
    .update({ notes: notes || null })
    .eq("id", customerId)
    .eq("business_id", business!.id);

  if (error) return { error: error.message };

  revalidatePath(`/panel/musteriler/${customerId}`);
  return { success: true };
}
