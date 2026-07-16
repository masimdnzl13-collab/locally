import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getDashboardMetrics, getRecentActivity } from "@/lib/panel/dashboard-queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import WeeklyBarChart from "@/components/panel/weekly-bar-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <p className="text-sm text-muted-foreground">Hoş geldin,</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink-900">
            {business.name}
          </h1>
        </div>
        <Badge variant="primary">
          ✓ Yayında · {BUSINESS_CATEGORY_LABELS[business.category]}
        </Badge>
      </div>

      {/* Metrik kartları */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Bu ay satış</p>
            <p className="mt-1 font-sans text-xl font-bold tabular-nums text-ink-900">
              {metrics.monthlySalesCount}
            </p>
            <p className="text-xs text-muted-foreground/80">{formatTL(metrics.monthlySalesAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Kullanılan hak</p>
            <p className="mt-1 font-sans text-xl font-bold tabular-nums text-ink-900">
              {metrics.totalRedemptions}
            </p>
            <p className="text-xs text-muted-foreground/80">toplam QR okutma</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Aktif paket</p>
            <p className="mt-1 font-sans text-xl font-bold tabular-nums text-ink-900">
              {metrics.activePackagesCount}
            </p>
            <p className="text-xs text-muted-foreground/80">satışta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Bu akşam</p>
            <p className="mt-1 font-sans text-xl font-bold text-ink-900">
              {metrics.hasActiveFlashToday ? "Flaş var 🔥" : "Flaş yok"}
            </p>
            <Link href="/panel/bu-aksam" className="text-xs font-semibold text-primary-600 hover:underline">
              {metrics.hasActiveFlashToday ? "Görüntüle" : "Oluştur"}
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Haftalık QR grafiği */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="mb-4 text-sm font-bold text-ink-900">Son 7 gün QR okutma</h2>
          <WeeklyBarChart data={metrics.dailyRedemptions} />
        </CardContent>
      </Card>

      {/* Hızlı işlemler */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink-900">Hızlı İşlemler</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/panel/bu-aksam"
            className={cn(buttonVariants({ variant: "accent", shape: "rect", size: "lg" }), "w-full")}
          >
            🔥 Bu Akşam Flaşı Oluştur
          </Link>
          <Link
            href="/panel/paketler/yeni"
            className={cn(buttonVariants({ variant: "outline", shape: "rect", size: "lg" }), "w-full")}
          >
            + Yeni Paket Ekle
          </Link>
          <Link
            href="/panel/duyurular"
            className={cn(buttonVariants({ variant: "outline", shape: "rect", size: "lg" }), "w-full")}
          >
            📣 Duyuru Gönder
          </Link>
        </div>
      </div>

      {/* Son hareketler */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-bold text-ink-900">Son Hareketler</h2>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              İlk paketini ekle, satışlar ve hareketler burada görünecek.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="text-lg">{ACTIVITY_ICON[item.type]}</span>
                  <span className="flex-1 text-ink-900">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{formatRelative(item.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
