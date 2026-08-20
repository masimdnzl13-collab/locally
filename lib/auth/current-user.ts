import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/supabase/with-timeout";
import type { UserRole } from "@/lib/types";
import { ACTIVE_ROLE_COOKIE, getEffectiveRoles, isUserRole } from "@/lib/auth/roles";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  /** Birincil rol — kayıt/onay akışlarının belirlediği, değişmeyen rol. */
  role: UserRole;
  /** Yalnızca elle, izin verilen hesaplara atanan ek roller (çoğunlukla boş). */
  additionalRoles: UserRole[];
  /** role + additionalRoles, tekilleştirilmiş — gerçek yetki bunu kullanır. */
  effectiveRoles: UserRole[];
  /**
   * "Şu an hangi modda olduğu" — yalnızca arayüz/yönlendirme kolaylığı,
   * bir yetki kaynağı DEĞİL. locally_active_role çerezinden okunur ama
   * kullanıcının gerçek effectiveRoles'ünde yoksa asla kullanılmaz, role'e
   * düşer — böylece bayat/başkasına ait bir çerez asla yanlış rozet/menü
   * göstermez. Gerçek erişim kontrolü her zaman sunucu tarafında
   * effectiveRoles + RLS (is_admin()/owns_business()) üzerinden yapılır.
   */
  activeRole: UserRole;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = createClient();
    const user = await withTimeout(
      supabase.auth.getUser().then((res) => res.data.user),
      AUTH_LOOKUP_TIMEOUT_MS,
      null
    );
    if (!user) return null;

    const profile = await withTimeout(
      Promise.resolve(
        supabase
          .from("profiles")
          .select("full_name, role, additional_roles")
          .eq("id", user.id)
          .single()
      ).then((res) => res.data),
      AUTH_LOOKUP_TIMEOUT_MS,
      null
    );

    const role = (profile?.role as UserRole) ?? "user";
    const additionalRoles = (profile?.additional_roles as UserRole[] | null) ?? [];
    const effectiveRoles = getEffectiveRoles({ role, additional_roles: additionalRoles });

    const cookieRole = cookies().get(ACTIVE_ROLE_COOKIE)?.value;
    const activeRole =
      cookieRole && isUserRole(cookieRole) && effectiveRoles.includes(cookieRole)
        ? cookieRole
        : role;

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      role,
      additionalRoles,
      effectiveRoles,
      activeRole,
    };
  } catch {
    return null;
  }
});
