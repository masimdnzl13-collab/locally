import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { ensureBusinessForOwner } from "@/lib/business/ensure-business";
import type { UserRole } from "@/lib/types";
import { getEffectiveRoles } from "@/lib/auth/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/kesfet";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const requestedRole = (data.user.user_metadata?.role === "business"
        ? "business"
        : "user") as UserRole;

      let profile: { id: string; role: UserRole; additional_roles?: UserRole[] | null } | null = null;
      try {
        profile = (await ensureProfile({
          id: data.user.id,
          email: data.user.email ?? null,
          fullName: (data.user.user_metadata?.full_name as string | undefined) || null,
          phone: (data.user.user_metadata?.phone as string | undefined) || null,
          requestedRole,
        })) as { id: string; role: UserRole; additional_roles?: UserRole[] | null };
      } catch {
        // Profil zaten varsa veya oluşturma başarısız olsa da kullanıcıyı
        // akışta tutmaya devam ediyoruz; ilk girişte profil eksikse
        // sonraki bir işlemde tekrar denenir.
      }

      // E-posta onayı açıkken signUp anında oturum dönmediği için business
      // satırı signUpAction içinde değil burada oluşuyor — kayıt formunda
      // topladığımız işletme adı user_metadata üzerinden buraya taşınıyor.
      if (profile?.role === "business") {
        const businessName = (data.user.user_metadata?.business_name as string | undefined)?.trim();
        if (businessName) {
          try {
            await ensureBusinessForOwner(data.user.id, businessName);
          } catch {
            // Aynı sebeple: işletme oluşturma başarısız olsa bile kullanıcıyı
            // akışta tutuyoruz, panel ana sayfası eksik işletmeyi tespit eder.
          }
        }
      }

      if (next === "/kesfet" && profile) {
        const effectiveRoles = getEffectiveRoles({
          role: profile.role,
          additional_roles: profile.additional_roles,
        });
        if (effectiveRoles.length > 1) {
          return NextResponse.redirect(`${origin}/rol-sec`);
        }
      }

      if (profile?.role === "admin" && next === "/kesfet") {
        return NextResponse.redirect(`${origin}/admin`);
      }
      if (profile?.role === "business" && next === "/kesfet") {
        return NextResponse.redirect(`${origin}/panel`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/giris?hata=dogrulama`);
}
