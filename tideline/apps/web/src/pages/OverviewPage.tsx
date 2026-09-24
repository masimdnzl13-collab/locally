import { useEffect, useState } from "react";
import { api, money, userMessage, type Stats, type Timeseries } from "../api";
import { useAuth } from "../auth";
import { BarSeriesChart, LineSeriesChart, Skeleton, StatTile } from "../ui";

export function OverviewPage({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [series, setSeries] = useState<Timeseries | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStats(null);
    setSeries(null);
    setError("");
    Promise.all([
      api<Stats>(`/api/v1/restaurants/${restaurantId}/stats`, {}, session!.token),
      api<Timeseries>(`/api/v1/restaurants/${restaurantId}/stats/timeseries?days=14`, {}, session!.token),
    ])
      .then(([s, t]) => {
        setStats(s);
        setSeries(t);
      })
      .catch((e) => setError(userMessage(e)));
  }, [restaurantId]);

  if (error) return <p role="alert">{error}</p>;
  if (!stats || !series) return <OverviewSkeleton />;

  const missedRate = stats.calls.total ? Math.round((stats.calls.missed / stats.calls.total) * 100) : 0;
  const deliveryPct = stats.notifications.deliveryRate !== null ? Math.round(stats.notifications.deliveryRate * 100) : null;

  return (
    <>
      <div className="grid kpi-grid">
        <StatTile icon="phone" label="Calls handled" value={String(stats.calls.total)} delta={{ direction: "up", text: `${stats.calls.last7d} in the last 7 days` }} />
        <StatTile icon="bag" label="Order revenue" value={money(stats.orders.revenueCents)} delta={{ direction: "up", text: `${money(stats.orders.last7dRevenueCents)} last 7 days` }} />
        <StatTile icon="calendar" label="Upcoming reservations" value={String(stats.reservations.upcoming)} delta={{ direction: stats.reservations.noShow > 0 ? "down" : "up", text: `${stats.reservations.noShow} no-shows total` }} />
        <StatTile icon="bell" label="SMS delivery rate" value={deliveryPct !== null ? `${deliveryPct}%` : "—"} delta={{ direction: deliveryPct !== null && deliveryPct < 90 ? "down" : "up", text: `${stats.notifications.total} sent total` }} />
      </div>

      <div className="grid two-col">
        <div className="card card-pad">
          <div className="card-head">
            <h2>Calls — last 14 days</h2>
            <span className="hint">{stats.calls.completed} completed · {missedRate}% missed</span>
          </div>
          <BarSeriesChart points={series.calls.map((p) => ({ day: p.day, value: p.count }))} />
        </div>
        <div className="card card-pad">
          <div className="card-head">
            <h2>Order revenue — last 14 days</h2>
            <span className="hint">{stats.orders.total} orders</span>
          </div>
          <LineSeriesChart points={series.revenueCents.map((p) => ({ day: p.day, value: p.value }))} formatValue={(v) => money(v)} />
        </div>
      </div>

      <div className="section-title">Operations at a glance</div>
      <div className="grid kpi-grid">
        <StatTile icon="clock" label="Avg. call duration" value={formatDuration(stats.calls.avgDurationSeconds)} />
        <StatTile icon="book" label="Menu items" value={`${stats.menu.activeItems} / ${stats.menu.items}`} delta={{ direction: "up", text: `${stats.menu.categories} categories` }} />
        <StatTile icon="message" label="FAQs published" value={String(stats.faqs)} />
        <StatTile icon="grid" label="AI usage cost (est.)" value={`$${stats.ai.estimatedCostUsd.toFixed(2)}`} delta={{ direction: "up", text: `${stats.ai.totalTokens.toLocaleString()} tokens` }} />
      </div>
    </>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="card stat-tile" key={i}>
            <Skeleton height={12} width={90} />
            <div style={{ height: 8 }} />
            <Skeleton height={26} width={70} />
          </div>
        ))}
      </div>
      <div className="grid two-col">
        <div className="card card-pad">
          <Skeleton height={220} />
        </div>
        <div className="card card-pad">
          <Skeleton height={220} />
        </div>
      </div>
    </>
  );
}
