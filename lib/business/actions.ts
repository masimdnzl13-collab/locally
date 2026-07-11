"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uniqueSlug } from "@/lib/business/slug";
import type { BusinessCategory } from "@/lib/types";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/panel/kurulum");
  return { supabase, user: user! };
}

export async function saveOnboardingStepOne(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "") as BusinessCategory;
  const description = String(formData.get("description") ?? "").trim();

  if (!name || !category) {
    return { error: "İşletme adı ve kategori zorunlu." };
  }

  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("businesses")
      .update({ name, category, description: description || null })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("businesses").insert({
      owner_id: user.id,
      name,
      category,
      description: description || null,
      slug: uniqueSlug(name),
    });
    if (error) return { error: error.message };
  }

  return { success: true };
}

export async function saveOnboardingStepTwo(formData: FormData) {
  const { supabase, user } = await requireUser();

  const district = String(formData.get("district") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();

  if (!district || !address || !phone) {
    return { error: "Mahalle, adres ve telefon zorunlu." };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      district,
      address,
      phone,
      instagram: instagram || null,
    })
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

export async function finishOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();

  const logo = formData.get("logo") as File | null;
  const cover = formData.get("cover") as File | null;

  if (!logo || logo.size === 0 || !cover || cover.size === 0) {
    return { error: "Logo ve kapak görseli zorunlu." };
  }

  const updates: Record<string, string> = {};

  for (const [key, file] of [
    ["logo_url", logo],
    ["cover_url", cover],
  ] as const) {
    const path = `${user.id}/${key === "logo_url" ? "logo" : "cover"}-${Date.now()}.${extFromFile(
      file
    )}`;
    const { error: uploadError } = await supabase.storage
      .from("business-images")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { error: "Görsel yüklenemedi: " + uploadError.message };

    const { data } = supabase.storage.from("business-images").getPublicUrl(path);
    updates[key] = data.publicUrl;
  }

  const { error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  redirect("/panel");
}
