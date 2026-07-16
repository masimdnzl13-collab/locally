import { getOverviewMetrics } from "@/lib/admin/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default async function AdminOverviewPage() {
  const metrics = await getOverviewMetrics();

  const cards = [
    { label: "Toplam Kullanıcı", value: metrics.totalUsers },
    { label: "Bu Ay Yeni Kullanıcı", value: metrics.newUsersThisMonth },
    { label: "Onaylı İşletme", value: metrics.approvedBusinesses },
    { label: "Bekleyen İşletme", value: metrics.pendingBusinesses },
    { label: "Bu Ay Satış Adedi", value: metrics.monthlySalesCount },
    { label: "Bu Ay Ciro", value: formatTL(metrics.monthlySalesAmount) },
    { label: "Kesilen Toplam Komisyon", value: formatTL(metrics.totalCommission) },
    { label: "Bu Hafta Doğrulama", value: metrics.weeklyVerifications },
    { label: "Kurucu 500 Bekleme Listesi", value: metrics.waitlistCount },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-ink-900">Genel Bakış</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
