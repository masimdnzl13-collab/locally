import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadRowControls, NewLeadForm } from "@/components/admin/pipeline-controls";
import { getSalesPipeline } from "@/lib/admin/pipeline";
import { PIPELINE_DEADLINE, PIPELINE_GOAL, SALES_LEAD_STATUS_LABELS, type SalesLeadStatus } from "@/lib/admin/pipeline-constants";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function daysUntil(deadline: string) {
  const end = new Date(`${deadline}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

export default async function AdminSalesPipelinePage() {
  await requireAdmin("/admin/isletme-hatti");
  const pipeline = await getSalesPipeline();
  const { signedUp } = pipeline;
  const remaining = Math.max(0, PIPELINE_GOAL - signedUp);
  const daysLeft = daysUntil(PIPELINE_DEADLINE);
  const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  const pct = Math.min(100, Math.round((signedUp / PIPELINE_GOAL) * 100));
  const counts = pipeline.rows.reduce<Record<SalesLeadStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { tanitildi: 0, ilgileniyor: 0, kaydoldu: 0, reddetti: 0 }
  );
  const dash = pipeline.tideline === "ok" ? "0" : "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">İşletme Hattı</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        WAT saha turu: tanıtılan adaylar ve gerçekten kaydolan ABD işletmeleri tek listede.
      </p>

      <section className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-bold tracking-tight text-navy-900">
              {signedUp}
              <span className="text-2xl text-muted-foreground">/{PIPELINE_GOAL}</span>
              <span className="ml-2 text-base font-semibold text-foreground">kaydoldu</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {remaining === 0
                ? "Hedefe ulaşıldı."
                : `Ekim sonuna ${daysLeft} gün · günde ~${perDay.toFixed(1)} kayıt gerekiyor`}
            </p>
          </div>
          <dl className="flex gap-5 text-sm">
            {(["tanitildi", "ilgileniyor", "reddetti"] as const).map((s) => (
              <div key={s}>
                <dt className="text-xs text-muted-foreground">{SALES_LEAD_STATUS_LABELS[s]}</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">{counts[s]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={signedUp}
          aria-valuemin={0}
          aria-valuemax={PIPELINE_GOAL}
        >
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
        {pipeline.unlinkedSignedLeads > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {pipeline.unlinkedSignedLeads} aday “Kaydoldu” olarak işaretli ama henüz bir işletme kaydına bağlanmadı —
            sayaç yalnızca gerçek (market = US) kayıtları sayar.
          </p>
        )}
      </section>

      <div className="mb-6">
        <NewLeadForm />
      </div>

      {pipeline.tideline !== "ok" && (
        <p className="mb-3 rounded-md bg-discount-50 px-3 py-2 text-xs text-discount-700">
          {pipeline.tideline === "not_configured"
            ? "Tideline bağlantısı yapılandırılmamış (TIDELINE_API_URL + TIDELINE_JWT_SECRET) — çağrı/sipariş sütunları boş."
            : "Tideline API'ye şu an ulaşılamıyor — çağrı/sipariş sütunları gösterilemiyor."}
        </p>
      )}

      {pipeline.rows.length === 0 ? (
        <EmptyState icon={Target} title="Henüz aday yok" description="Sahada tanıttığın ilk işletmeyi yukarıdan ekle." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">İşletme</th>
                <th className="px-4 py-2.5 font-medium">Şehir</th>
                <th className="px-4 py-2.5 font-medium">Ziyaret</th>
                <th className="px-4 py-2.5 font-medium">Durum</th>
                <th className="px-4 py-2.5 text-right font-medium">Çağrı (7g)</th>
                <th className="px-4 py-2.5 text-right font-medium">Sipariş (7g)</th>
                <th className="px-4 py-2.5 text-right font-medium">Maliyet (ay)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pipeline.rows.map((row) => {
                const a = row.activity;
                const linked = Boolean(row.business?.tideline_restaurant_id);
                return (
                  <tr key={row.key} className="odd:bg-muted/60 hover:bg-muted">
                    <td className="px-4 py-2.5">
                      {row.business ? (
                        <Link href={`/admin/isletmeler/${row.business.id}`} className="font-semibold text-foreground hover:underline">
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-foreground">{row.name}</span>
                      )}
                      {row.lead?.contact && <p className="text-xs text-muted-foreground">{row.lead.contact}</p>}
                      {row.business && !linked && (
                        <p className="text-xs text-muted-foreground">Tideline restoranına eşlenmedi</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.city || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(row.visitedOn)}</td>
                    <td className="px-4 py-2.5">
                      {row.kind === "lead" && row.lead ? (
                        <LeadRowControls leadId={row.lead.id} status={row.status} linkable={pipeline.linkableBusinesses} />
                      ) : (
                        <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                          Kaydoldu · {formatDate(row.business!.created_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a ? a.calls7d : row.business && linked ? dash : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a ? a.orders7d : row.business && linked ? dash : ""}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {a ? (
                        <span className={a.costOverThreshold ? "font-semibold text-danger-600" : undefined}>
                          ${a.costMonthUsd.toFixed(2)}
                        </span>
                      ) : row.business && linked ? (
                        dash
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pipeline.costThresholdUsd !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Kırmızı maliyet: bu ay ${pipeline.costThresholdUsd.toFixed(2)} uyarı eşiği aşıldı (yalnızca görünürlük, hizmet kesilmez).
        </p>
      )}
    </div>
  );
}
