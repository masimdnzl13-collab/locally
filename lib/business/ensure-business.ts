import { createClient } from "@/lib/supabase/server";
import { uniqueSlug } from "@/lib/business/slug";

// Kayıt artık yalnızca işletme adını topluyor; kategori/şehir gibi zorunlu
// ama henüz bilinmeyen alanlar makul varsayılanlarla dolduruluyor ve
// kalanı panel ana sayfasındaki kurulum kontrol listesinde tamamlanıyor
// (bkz. lib/business/onboarding.ts). owner_id auth.uid() ile eşleştiği için
// bu, mevcut "businesses_insert_own" RLS politikasıyla çalışır — service
// role gerekmez.
export async function ensureBusinessForOwner(ownerId: string, name: string) {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: ownerId,
      name,
      slug: uniqueSlug(name),
      category: "diger",
      city: "Bodrum",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
