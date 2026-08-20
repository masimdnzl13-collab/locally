import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import type { UserRole } from "@/lib/types";

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

      let profile: { id: string; role: UserRole } | null = null;
      try {
        profile = (await ensureProfile({
          id: data.user.id,
          email: data.user.email ?? null,
          fullName: (data.user.user_metadata?.full_name as string | undefined) || null,
          phone: (data.user.user_metadata?.phone as string | undefined) || null,
          requestedRole,
        })) as { id: string; role: UserRole };
      } catch {
        // Profil zaten varsa veya oluşturma başarısız olsa da kullanıcıyı
        // akışta tutmaya devam ediyoruz; ilk girişte profil eksikse
        // sonraki bir işlemde tekrar denenir.
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
