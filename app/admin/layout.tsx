import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/admin-shell";
import { getEffectiveRoles } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user.id)
    .single();

  const effectiveRoles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });

  if (!effectiveRoles.includes("admin")) redirect("/");

  return <AdminShell isMultiRole={effectiveRoles.length > 1}>{children}</AdminShell>;
}
