import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ModuleSwitcher, { type ModuleRow } from "@/components/admin/module-switcher";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MARKETS = [
  { value: "US", label: "ABD" },
  { value: "TR", label: "Türkiye" },
  { value: "all", label: "Tümü" },
] as const;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// P7 — sezonluk modül geçişi. Kış modülü (locally_core) tek tek ya da toplu
// açılıp kapatılır; her yıl 1 Ekim'de /api/cron/seasonal-modules aynı işlemi
// tüm ABD işletmeleri için otomatik yapar. Bildirim metni:
// lib/notifications/templates/seasonal-modules.ts.
export default async function AdminModulesPage({ searchParams }: { searchParams: { pazar?: string } }) {
  const market = MARKETS.some((m) => m.value === searchParams.pazar) ? searchParams.pazar! : "US";
  const supabase = createClient();

  let query = supabase
    .from("businesses")
    .select("id, name, market, city, active_modules")
    .eq("is_demo", false)
    .order("name");
  if (market !== "all") query = query.eq("market", market);

  const [{ data: businesses }, { data: events }] = await Promise.all([
    query,
    supabase
      .from("business_module_events")
      .select("id, module, action, source, notification_channel, notification_status, notification_error, created_at, business:businesses(name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Sezon Modülleri</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Kış modülü (locally_core) her yıl 1 Ekim&apos;de tüm ABD işletmelerine otomatik eklenir ve işletmeye
        bildirim gider. Buradan tek tek ya da toplu olarak açıp kapatabilirsin.
      </p>

      <div className="mb-4 flex gap-1.5">
        {MARKETS.map((m) => (
          <Link
            key={m.value}
            href={`/admin/moduller?pazar=${m.value}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              m.value === market ? "bg-navy-900 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </Link>
        ))}
      </div>

      <ModuleSwitcher rows={(businesses ?? []) as ModuleRow[]} />

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">Son geçişler</h2>
      {(events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz modül değişikliği yok.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {(events ?? []).map((e) => {
            const business = e.business as unknown as { name: string } | null;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium text-foreground">{business?.name ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.module} {e.action === "added" ? "eklendi" : "kaldırıldı"} ({e.source === "cron" ? "otomatik" : "admin"})
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.notification_status && e.notification_status !== "skipped" && (
                    <span className={e.notification_status === "failed" ? "text-danger-600" : undefined}>
                      {e.notification_channel === "sms" ? "SMS" : "E-posta"}{" "}
                      {e.notification_status === "sent"
                        ? "gönderildi"
                        : e.notification_status === "simulated"
                          ? "simüle edildi"
                          : `gönderilemedi${e.notification_error ? `: ${e.notification_error}` : ""}`}
                      {" · "}
                    </span>
                  )}
                  {formatDateTime(e.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
