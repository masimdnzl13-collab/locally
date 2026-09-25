import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

// Admin server action'ları için oturum + rol kontrolü. RLS (is_admin()) asıl
// korumadır; bu, admin olmayana anlamlı bir yönlendirme verir ve yazma
// sorgularına kullanıcının kendi (RLS'e tabi) istemcisini döndürür.
export async function requireAdminSession(next = "/admin") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user!.id)
    .single();
  const roles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });
  if (!roles.includes("admin")) redirect("/");
  return { supabase, userId: user!.id };
}
