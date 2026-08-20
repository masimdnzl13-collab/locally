import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/panel");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user.id)
    .single();

  // "business" tek rollü işletme sahipleri için (büyük çoğunluk) role
  // alanından, çok rollü hesaplar için (bkz. P27) additional_roles'ten
  // gelebilir — ikisi de aynı kapıdan geçer, gerçek yetki her durumda
  // owns_business() (RLS) tarafından ayrıca doğrulanır.
  const effectiveRoles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });

  if (!effectiveRoles.includes("business")) {
    redirect("/");
  }

  return <div className="min-h-dvh bg-background">{children}</div>;
}
