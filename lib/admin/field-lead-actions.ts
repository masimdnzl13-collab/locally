"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SALES_LEAD_PHOTO_BUCKET } from "@/lib/admin/pipeline-constants";

// AN — sahada telefondan hızlı aday ekleme (/admin/isletme-hatti/ekle).
// Masaüstü formundan (pipeline-actions.ts createSalesLeadAction) farkı: fotoğraf
// alır ve eklenen adayı geri döndürür; istemci sayfayı yenilemeden bir
// sonrakine geçer. Kayıt aynı sales_leads tablosuna düşer.

// İstemci fotoğrafı ~1600px JPEG'e küçültür (components/admin/field-lead-form.tsx);
// bu sınır server action gövde sınırının (1 MB) altında kalmak için.
const MAX_PHOTO_BYTES = 950 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type FieldLeadResult =
  | { error: string }
  | { success: true; lead: { id: string; name: string; city: string; hasPhoto: boolean }; warning?: string };

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);

export async function createFieldLeadAction(formData: FormData): Promise<FieldLeadResult> {
  const { supabase, userId } = await requireAdmin("action:createFieldLead");
  const name = text(formData, "businessName", 120);
  if (!name) return { error: "Restoran adı gerekli." };
  const city = text(formData, "city", 80);
  const status = text(formData, "status", 20) === "ilgileniyor" ? "ilgileniyor" : "tanitildi";

  const photo = formData.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && !PHOTO_TYPES[file.type]) return { error: "Fotoğraf JPEG, PNG ya da WebP olmalı." };
  if (file && file.size > MAX_PHOTO_BYTES) return { error: "Fotoğraf çok büyük; tekrar çekmeyi dene." };

  const { data: lead, error } = await supabase
    .from("sales_leads")
    .insert({
      business_name: name,
      city,
      status,
      notes: text(formData, "notes", 1000) || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !lead) return { error: "Aday kaydedilemedi. Bağlantını kontrol edip tekrar dene." };

  // Fotoğraf yüklenemese de aday kaybolmaz; uyarı döner, sahada tekrar denenmez.
  let warning: string | undefined;
  let hasPhoto = false;
  if (file) {
    const path = `${lead.id}/${randomUUID()}.${PHOTO_TYPES[file.type]}`;
    const upload = await supabase.storage
      .from(SALES_LEAD_PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      warning = "Aday kaydedildi ama fotoğraf yüklenemedi.";
    } else {
      const { error: linkError } = await supabase.from("sales_leads").update({ photo_path: path }).eq("id", lead.id);
      if (linkError) warning = "Aday kaydedildi ama fotoğraf adaya bağlanamadı.";
      else hasPhoto = true;
    }
  }

  revalidatePath("/admin/isletme-hatti");
  return { success: true, lead: { id: lead.id, name, city, hasPhoto }, warning };
}
