import { redirect } from "next/navigation";
import { Compass, Store, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles, ROLE_DESTINATIONS } from "@/lib/auth/roles";
import { getPendingBusinesses } from "@/lib/admin/queries";
import { chooseRoleAction } from "@/lib/auth/role-switch-actions";
import type { UserRole } from "@/lib/types";

export const metadata = { title: "Rol Seç" };

interface CardInfo {
  role: UserRole;
  title: string;
  description: string;
  icon: typeof Compass;
  stat: string | null;
}

export default async function RolSecPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=/rol-sec");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, additional_roles")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/giris");

  const effectiveRoles = getEffectiveRoles({
    role: profile.role as UserRole,
    additional_roles: profile.additional_roles as UserRole[] | null,
  });

  // Tek rollü bir hesap bu sayfaya bir şekilde gelirse (ör. eski bir
  // yer imi) hiç kart göstermeden doğrudan gitmesi gereken yere gider —
  // seçim ekranı yalnızca gerçekten birden fazla rolü olanlar içindir.
  if (effectiveRoles.length <= 1) {
    redirect(ROLE_DESTINATIONS[effectiveRoles[0] ?? "user"]);
  }

  const cards: CardInfo[] = [];

  if (effectiveRoles.includes("user")) {
    const { count } = await supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed");

    cards.push({
      role: "user",
      title: "Kullanıcı",
      description: "Fırsatları keşfet, paketlerini ve biletlerini gör.",
      icon: Compass,
      stat: `${count ?? 0} tamamlanmış satın alma`,
    });
  }

  if (effectiveRoles.includes("business")) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let stat = "Henüz bir işletmen yok";
    if (business) {
      const { count } = await supabase
        .from("packages")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_active", true);
      stat = `${business.name} — ${count ?? 0} aktif paket`;
    }

    cards.push({
      role: "business",
      title: "İşletme Paneli",
      description: "Paketler, flaş fırsatlar, QR doğrulama, müşteriler.",
      icon: Store,
      stat,
    });
  }

  if (effectiveRoles.includes("admin")) {
    const pending = await getPendingBusinesses();
    cards.push({
      role: "admin",
      title: "Admin Paneli",
      description: "Onaylar, içerik gözetimi, metrikler, demo veri.",
      icon: ShieldCheck,
      stat: `${pending.length} işletme onay bekliyor`,
    });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col items-center justify-center px-6 py-12 md:min-h-[calc(100dvh-4.5rem)]">
      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
        {profile.full_name ? `Merhaba, ${profile.full_name}` : "Merhaba"}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        Nasıl devam etmek istersin?
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
        Bu hesapta birden fazla rol var. Birini seç, dilediğin zaman üst menüdeki
        &quot;Rol değiştir&quot; ile buraya dönebilirsin.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <form key={card.role} action={chooseRoleAction}>
            <input type="hidden" name="role" value={card.role} />
            <button
              type="submit"
              className="flex h-full w-full flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <card.icon size={22} strokeWidth={1.75} />
              </span>
              <span className="text-base font-bold text-foreground">{card.title}</span>
              <span className="text-sm text-muted-foreground">{card.description}</span>
              {card.stat && (
                <span className="mt-auto rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                  {card.stat}
                </span>
              )}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
