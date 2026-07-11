import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getDashboardMetrics, getRecentActivity } from "@/lib/panel/dashboard-queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import WeeklyBarChart from "@/components/panel/weekly-bar-chart";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

const ACTIVITY_ICON: Record<string, string> = {
  sale: "💳",
  redemption: "📱",
  ticket: "🎟️",
};

export default async function PanelDashboardPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const [metrics, activity] = await Promise.all([
    getDashboardMetrics(business.id),
    getRecentActivity(business.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Hoş geldin,</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
            {business.name}
          </h1>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-700">
          ✓ Yayında · {BUSINESS_CATEGORY_LABELS[business.category]}
        </span>
      </div>

      {/* Metrik kartları */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Bu ay satış</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {metrics.monthlySalesCount}
          </p>
          <p className="text-xs text-slate-400">{formatTL(metrics.monthlySalesAmount)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Kullanılan hak</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {metrics.totalRedemptions}
          </p>
          <p className="text-xs text-slate-400">toplam QR okutma</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Aktif paket</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {metrics.activePackagesCount}
          </p>
          <p className="text-xs text-slate-400">satışta</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Bu akşam</p>
          <p className="mt-1 text-xl font-extrabold text-dark-900">
            {metrics.hasActiveFlashToday ? "Flaş var 🔥" : "Flaş yok"}
          </p>
          <Link href="/panel/bu-aksam" className="text-xs font-semibold text-primary-600">
            {metrics.hasActiveFlashToday ? "Görüntüle" : "Oluştur"}
          </Link>
        </div>
      </div>

      {/* Haftalık QR grafiği */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-dark-900">Son 7 gün QR okutma</h2>
        <WeeklyBarChart data={metrics.dailyRedemptions} />
      </div>

      {/* Hızlı işlemler */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-dark-900">Hızlı İşlemler</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/panel/bu-aksam"
            className="rounded-2xl bg-accent px-5 py-4 text-center text-sm font-bold text-dark-950 shadow-sm hover:brightness-95"
          >
            🔥 Bu Akşam Flaşı Oluştur
          </Link>
          <Link
            href="/panel/paketler/yeni"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-bold text-dark-900 hover:bg-slate-50"
          >
            + Yeni Paket Ekle
          </Link>
          <Link
            href="/panel/duyurular"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-bold text-dark-900 hover:bg-slate-50"
          >
            📣 Duyuru Gönder
          </Link>
        </div>
      </div>

      {/* Son hareketler */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-dark-900">Son Hareketler</h2>
        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            İlk paketini ekle, satışlar ve hareketler burada görünecek.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-lg">{ACTIVITY_ICON[item.type]}</span>
                <span className="flex-1 text-dark-900">{item.label}</span>
                <span className="text-xs text-slate-400">{formatRelative(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
