import { PhoneOff, PlugZap } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingNumberActions, RetryActivationButton } from "@/components/admin/tideline-setup-actions";
import { isTidelineApiConfigured, listPendingTidelineNumbers } from "@/lib/tideline/service-api";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// P6 + Prompt F — ABD self-servis kurulumunun elle tamamlanan kuyruğu.
//  1) Ödemesi tamamlanmış ama Tideline restoranı hiç oluşturulamamış
//     başvurular (Tideline'a ulaşılamadı vb.) → "Tekrar dene".
//  2) Tideline'da restoranı oluşmuş ama Twilio numarası otomatik alınamamış
//     restoranlar (restaurant_phone_numbers.status='pending_manual') →
//     numarayı elle ata ya da otomatik almayı tekrar dene.
// İşletme sahibi bu süre boyunca "kurulumunuz 24 saat içinde tamamlanacak"
// ekranını görür (/kayit/us/durum).
export default async function AdminTidelineSetupPage() {
  await requireAdmin("/admin/tideline-kurulum");
  const supabase = createClient();

  const [{ data: unlinked }, pendingNumbers] = await Promise.all([
    supabase
      .from("us_onboarding")
      .select(
        "business_id, contact_name, contact_phone, city, state, provisioning_error, completed_at, business:businesses!inner(name, tideline_restaurant_id)"
      )
      .neq("status", "awaiting_payment")
      .is("business.tideline_restaurant_id", null)
      .order("completed_at", { ascending: true }),
    listPendingTidelineNumbers(),
  ]);

  const { data: names } = await supabase
    .from("businesses")
    .select("id, name")
    .in("id", pendingNumbers.ok ? pendingNumbers.data.numbers.map((n) => n.externalRef).filter((x): x is string => Boolean(x)) : []);
  const locallyName = new Map((names ?? []).map((b) => [b.id, b.name]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Tideline Kurulum Kuyruğu</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        ABD self-servis kayıtlarında otomatik tamamlanamayan adımlar. Burada bir kayıt varken işletme sahibi
        &quot;kurulumunuz 24 saat içinde tamamlanacak&quot; ekranını görür.
      </p>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Tideline&apos;a bağlanamayan işletmeler</h2>
      {(unlinked ?? []).length === 0 ? (
        <EmptyState icon={PlugZap} title="Bekleyen yok" description="Ödemesi tamamlanan tüm işletmelerin Tideline restoranı var." />
      ) : (
        <ul className="mb-8 divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-card">
          {(unlinked ?? []).map((row) => {
            const business = row.business as unknown as { name: string };
            return (
              <li key={row.business_id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{business.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.contact_name} · {row.contact_phone} · {row.city}, {row.state}
                    {row.completed_at && ` · ${formatDate(row.completed_at)}`}
                  </p>
                  {row.provisioning_error && <p className="mt-1 text-xs text-danger-600">{row.provisioning_error}</p>}
                </div>
                <RetryActivationButton businessId={row.business_id} />
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">Numara bekleyen restoranlar (pending_manual)</h2>
      {!pendingNumbers.ok ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {isTidelineApiConfigured() ? "Tideline API'ye ulaşılamadı: " : ""}
          {pendingNumbers.error}
        </p>
      ) : pendingNumbers.data.numbers.length === 0 ? (
        <EmptyState icon={PhoneOff} title="Bekleyen numara yok" description="Tüm Tideline restoranlarının aktif bir numarası var." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm shadow-card">
          {pendingNumbers.data.numbers.map((n) => (
            <li key={n.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {(n.externalRef && locallyName.get(n.externalRef)) ?? n.restaurantName}
                </p>
                <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
              </div>
              {n.failureReason && <p className="text-xs text-danger-600">{n.failureReason}</p>}
              <PendingNumberActions numberId={n.id} externalRef={n.externalRef} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
