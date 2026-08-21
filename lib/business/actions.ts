"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BusinessCategory } from "@/lib/types";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/panel");
  return { supabase, user: user! };
}

// Kurulum kontrol listesinin "İşletme bilgileri" adımı — kategori, mahalle,
// adres ve telefonu tek seferde kaydeder. Adımın "tamamlandı" sayılması
// district/address/phone'un dolu olmasına bağlı (bkz. lib/business/onboarding.ts);
// kategori her zaman bir varsayılana sahip olduğu için o alan tek başına
// tamamlanma sinyali değil.
export async function saveBusinessInfoAction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const category = String(formData.get("category") ?? "") as BusinessCategory;
  const district = String(formData.get("district") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();

  if (!category || !district || !address || !phone) {
    return { error: "Kategori, mahalle, adres ve telefon zorunlu." };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      category,
      district,
      address,
      phone,
      description: description || null,
      instagram: instagram || null,
    })
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/panel");
  revalidatePath("/panel/kurulum");
  return { success: true };
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

// Kurulum kontrol listesinin "Görseller" adımı — logo ve kapak görselini
// tek seferde yükler. Tamamlanma sinyali: her ikisinin de dolu olması.
export async function saveBusinessImagesAction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const logo = formData.get("logo") as File | null;
  const cover = formData.get("cover") as File | null;

  if ((!logo || logo.size === 0) && (!cover || cover.size === 0)) {
    return { error: "Logo veya kapak görseli seç." };
  }

  const updates: Record<string, string> = {};

  for (const [key, file] of [
    ["logo_url", logo],
    ["cover_url", cover],
  ] as const) {
    if (!file || file.size === 0) continue;
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

  const { error } = await supabase.from("businesses").update(updates).eq("owner_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/panel");
  revalidatePath("/panel/kurulum");
  return { success: true };
}

// Panele ilk girişte gösterilen "şifreni güçlendir" hatırlatmasını kapatır.
export async function dismissPasswordReminderAction() {
  const { supabase, user } = await requireUser();

  await supabase
    .from("businesses")
    .update({ password_reminder_dismissed_at: new Date().toISOString() })
    .eq("owner_id", user.id);

  revalidatePath("/panel");
}
