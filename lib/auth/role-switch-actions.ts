"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { ACTIVE_ROLE_COOKIE, getEffectiveRoles, isUserRole } from "@/lib/auth/roles";

// Rol seçim ekranındaki bir kartın tetiklediği tek işlem. Kritik nokta:
// istemciden gelen "role" alanına asla güvenilmez — kullanıcının GERÇEKTEN
// sahip olduğu roller (profiles.role + additional_roles) burada, sunucu
// tarafında, veritabanından tekrar okunup doğrulanır. Biri form alanını
// elle "admin" yapıp gönderse bile, o hesabın additional_roles'ünde admin
// yoksa bu fonksiyon reddeder — çerez sadece hangi panele yönlendirileceğini
// hatırlamak için, bir yetki kaynağı değil.
export async function chooseRoleAction(formData: FormData) {
  const requested = String(formData.get("role") ?? "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=/rol-sec");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user.id)
    .single();

  const effectiveRoles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });

  if (!isUserRole(requested) || !effectiveRoles.includes(requested)) {
    redirect("/rol-sec");
  }

  cookies().set(ACTIVE_ROLE_COOKIE, requested, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // maxAge verilmiyor: tarayıcı oturumu kapanınca (session cookie) düşer,
    // "oturum boyunca hatırla" isteği tam olarak bunu ifade ediyor.
  });

  if (requested === "business") {
    const { data: business } = await supabase
      .from("businesses")
      .select("logo_url, cover_url")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    redirect(business?.logo_url && business?.cover_url ? "/panel" : "/panel/kurulum");
  }

  redirect(requested === "admin" ? "/admin" : "/kesfet");
}
