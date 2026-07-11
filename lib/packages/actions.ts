"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";

async function requireBusiness() {
  const business = await getMyBusiness();
  if (!business) redirect("/panel/kurulum");
  return business!;
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

interface PackageInput {
  title: string;
  description: string | null;
  image_url: string | null;
  sale_price: number;
  summer_reference_price: number;
  normal_value: number | null;
  usage_count: number;
  usage_description: string | null;
  expires_at: string;
  quota: number | null;
  per_person_limit: number;
}

function parsePackageForm(formData: FormData): { input?: PackageInput; error?: string } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sale_price = Number(formData.get("sale_price"));
  const summer_reference_price = Number(formData.get("summer_reference_price"));
  const normal_valueRaw = String(formData.get("normal_value") ?? "").trim();
  const usage_count = Number(formData.get("usage_count"));
  const usage_description = String(formData.get("usage_description") ?? "").trim();
  const expires_at = String(formData.get("expires_at") ?? "");
  const quotaRaw = String(formData.get("quota") ?? "").trim();
  const per_person_limitRaw = String(formData.get("per_person_limit") ?? "1").trim();

  if (!title) return { error: "Başlık zorunlu." };
  if (!Number.isFinite(sale_price) || sale_price < 0) {
    return { error: "Satış fiyatı geçerli olmalı." };
  }
  if (!Number.isFinite(summer_reference_price) || summer_reference_price < 0) {
    return { error: "Referans yaz fiyatı geçerli olmalı." };
  }
  if (summer_reference_price <= sale_price) {
    return {
      error: "Referans yaz fiyatı satış fiyatından yüksek olmalı (kontrast mantığı buna dayanır).",
    };
  }
  if (!Number.isFinite(usage_count) || usage_count < 1) {
    return { error: "Hak sayısı en az 1 olmalı." };
  }
  if (!expires_at) return { error: "Son kullanma tarihi zorunlu." };
  const expiresDate = new Date(expires_at);
  if (Number.isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
    return { error: "Son kullanma tarihi gelecekte bir tarih olmalı." };
  }

  const normal_value = normal_valueRaw ? Number(normal_valueRaw) : null;
  if (normal_value !== null && (!Number.isFinite(normal_value) || normal_value < 0)) {
    return { error: "Kış değeri geçerli olmalı." };
  }

  const quota = quotaRaw ? Number(quotaRaw) : null;
  if (quota !== null && (!Number.isFinite(quota) || quota < 0)) {
    return { error: "Satış kontenjanı geçerli olmalı." };
  }

  const per_person_limit = per_person_limitRaw ? Number(per_person_limitRaw) : 1;
  if (!Number.isFinite(per_person_limit) || per_person_limit < 1) {
    return { error: "Kişi başı satın alma limiti en az 1 olmalı." };
  }

  return {
    input: {
      title,
      description: description || null,
      image_url: null,
      sale_price,
      summer_reference_price,
      normal_value,
      usage_count,
      usage_description: usage_description || null,
      expires_at: expiresDate.toISOString(),
      quota,
      per_person_limit,
    },
  };
}

async function resolveImageUrl(
  formData: FormData,
  businessId: string,
  ownerId: string,
  fallbackCoverUrl: string | null
): Promise<{ url: string | null; error?: string }> {
  const image = formData.get("image") as File | null;
  if (!image || image.size === 0) {
    return { url: fallbackCoverUrl };
  }

  const supabase = createClient();
  const path = `${ownerId}/packages/${businessId}-${Date.now()}.${extFromFile(image)}`;
  const { error } = await supabase.storage
    .from("business-images")
    .upload(path, image, { upsert: true, contentType: image.type });

  if (error) return { url: null, error: "Görsel yüklenemedi: " + error.message };

  const { data } = supabase.storage.from("business-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function createPackageAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await requireBusiness();
  const { input, error } = parsePackageForm(formData);
  if (error || !input) return { error };

  const { url, error: imageError } = await resolveImageUrl(
    formData,
    business.id,
    business.owner_id,
    business.cover_url
  );
  if (imageError) return { error: imageError };

  const supabase = createClient();
  const { error: insertError } = await supabase.from("packages").insert({
    business_id: business.id,
    title: input.title,
    description: input.description,
    image_url: url,
    sale_price: input.sale_price,
    summer_reference_price: input.summer_reference_price,
    normal_value: input.normal_value,
    usage_count: input.usage_count,
    usage_description: input.usage_description,
    expires_at: input.expires_at,
    quota: input.quota,
    per_person_limit: input.per_person_limit,
  });

  if (insertError) return { error: friendlyDbError(insertError.message) };

  revalidatePath("/panel/paketler");
  revalidatePath("/kesfet");
  redirect("/panel/paketler");
}

export async function updatePackageAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await requireBusiness();
  const packageId = String(formData.get("packageId") ?? "");
  if (!packageId) return { error: "Paket bulunamadı." };

  const { input, error } = parsePackageForm(formData);
  if (error || !input) return { error };

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("packages")
    .select("id, sold_count, image_url")
    .eq("id", packageId)
    .eq("business_id", business.id)
    .single();

  if (!existing) return { error: "Paket bulunamadı." };

  const { url, error: imageError } = await resolveImageUrl(
    formData,
    business.id,
    business.owner_id,
    existing.image_url
  );
  if (imageError) return { error: imageError };

  const { error: updateError } = await supabase
    .from("packages")
    .update({
      title: input.title,
      description: input.description,
      image_url: url,
      sale_price: input.sale_price,
      summer_reference_price: input.summer_reference_price,
      normal_value: input.normal_value,
      usage_count: input.usage_count,
      usage_description: input.usage_description,
      expires_at: input.expires_at,
      quota: input.quota,
      per_person_limit: input.per_person_limit,
    })
    .eq("id", packageId)
    .eq("business_id", business.id);

  if (updateError) return { error: friendlyDbError(updateError.message) };

  revalidatePath("/panel/paketler");
  revalidatePath("/kesfet");
  revalidatePath(`/paket/${packageId}`);
  redirect("/panel/paketler");
}

export async function setPackageActiveAction(formData: FormData) {
  const business = await requireBusiness();
  const packageId = String(formData.get("packageId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!packageId) return { error: "Paket bulunamadı." };

  const supabase = createClient();
  const { error } = await supabase
    .from("packages")
    .update({ is_active: isActive })
    .eq("id", packageId)
    .eq("business_id", business.id);

  if (error) return { error: error.message };

  revalidatePath("/panel/paketler");
  revalidatePath("/kesfet");
  return { success: true };
}

function friendlyDbError(message: string): string {
  if (message.includes("USAGE_COUNT_LOCKED")) {
    return "Bu pakette satış olduğu için hak sayısı düşürülemez.";
  }
  if (message.includes("packages_summer_price_gt_sale_price")) {
    return "Referans yaz fiyatı satış fiyatından yüksek olmalı.";
  }
  return "Kaydedilemedi: " + message;
}
