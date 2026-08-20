import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/types";

// admin_emails beyaz listesindeki bir e-posta ile kayıt/giriş yapan hesaba
// otomatik admin rolü atanır. Bu tablo yalnızca service role ile okunabilir.
async function resolveRole(email: string | null, requestedRole: UserRole): Promise<UserRole> {
  if (!email) return requestedRole;

  const service = createServiceClient();
  const { data } = await service
    .from("admin_emails")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  return data ? "admin" : requestedRole;
}

// profiles satırı auth.users'a 1-1 bağlıdır ama e-posta doğrulaması açıkken
// signUp anında oturum dönmez, bu yüzden satır burada oluşturulamaz. Bu
// fonksiyon hem doğrudan kayıt hem de /auth/callback (e-posta onayı,
// magic link, OAuth) akışlarından çağrılarak satırın garanti oluşmasını
// ve admin beyaz listesinin her iki yolda da uygulanmasını sağlar.
export async function ensureProfile(params: {
  id: string;
  email: string | null;
  fullName: string | null;
  phone?: string | null;
  requestedRole: UserRole;
}) {
  const service = createServiceClient();

  const { data: existing } = await service
    .from("profiles")
    .select("id, role")
    .eq("id", params.id)
    .maybeSingle();

  if (existing) {
    // Zaten kayıtlı bir hesap sonradan admin beyaz listesine eklenmiş
    // olabilir (ör. m.asimdnzl13@gmail.com) — her giriş/callback akışında
    // burada tekrar kontrol edip rolü yükseltiyoruz. Admin rolü asla
    // otomatik düşürülmez, yalnızca yükseltilir.
    if (existing.role !== "admin" && (await resolveRole(params.email, existing.role)) === "admin") {
      const { data: upgraded } = await service
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", params.id)
        .select("id, role")
        .single();
      return upgraded ?? existing;
    }
    return existing;
  }

  const role = await resolveRole(params.email, params.requestedRole);

  const { data, error } = await service
    .from("profiles")
    .insert({ id: params.id, full_name: params.fullName, phone: params.phone || null, role })
    .select("id, role")
    .single();

  if (error && error.code !== "23505") throw error;
  return data ?? { id: params.id, role };
}
