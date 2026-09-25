import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEffectiveRoles } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

// Admin yetkisinin TEK kaynağı. app/admin/layout.tsx, admin sayfaları ve
// tüm admin server action'ları buradan geçer. Yetki = effectiveRoles
// (role + additional_roles, bkz. P27) içinde "admin" — giriş yapmış herhangi
// bir işletme sahibi değil.
//
// Sayfalar layout'a ek olarak bunu KENDİLERİ de çağırır: App Router'da
// layout, kardeş sayfalar arasındaki istemci tarafı gezinmede yeniden
// çalışmaz; ayrıca bazı sayfalar (ör. /admin/tideline-kurulum) servis
// token'ıyla Tideline'dan veri çeker, yani tek koruma RLS değildir.
//
// target verilirse deneme (izin/red) admin_audit_events'e yazılır.

type Outcome = "allowed" | "denied_unauthenticated" | "denied_not_admin";

export interface AdminContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  roles: UserRole[];
}

async function checkAdmin(): Promise<
  { outcome: Outcome; ctx: AdminContext | null; email: string | null; userId: string | null }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { outcome: "denied_unauthenticated", ctx: null, email: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user.id)
    .single();
  const roles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });

  return roles.includes("admin")
    ? { outcome: "allowed", ctx: { supabase, userId: user.id, roles }, email: user.email ?? null, userId: user.id }
    : { outcome: "denied_not_admin", ctx: null, email: user.email ?? null, userId: user.id };
}

async function audit(target: string, outcome: Outcome, userId: string | null, email: string | null) {
  try {
    const h = headers();
    await createServiceClient()
      .from("admin_audit_events")
      .insert({
        user_id: userId,
        email,
        target,
        outcome,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
      });
  } catch {
    // Denetim kaydı yazılamasa bile yetki kararı değişmez.
  }
}

/** Sayfa/layout/action: admin değilse yönlendirir. */
export async function requireAdmin(target?: string): Promise<AdminContext> {
  const result = await checkAdmin();
  if (target) await audit(target, result.outcome, result.userId, result.email);
  if (result.outcome === "denied_unauthenticated") redirect("/giris?next=/admin");
  if (result.outcome === "denied_not_admin") redirect("/");
  return result.ctx!;
}

/** Yönlendirme yerine null döner (ör. hata mesajı döndüren action'lar). */
export async function getAdminContext(target?: string): Promise<AdminContext | null> {
  const result = await checkAdmin();
  if (target) await audit(target, result.outcome, result.userId, result.email);
  return result.ctx;
}
