import { createClient } from "@/lib/supabase/server";

export interface DashboardMetrics {
  monthlySalesCount: number;
  monthlySalesAmount: number;
  totalRedemptions: number;
  activePackagesCount: number;
  hasActiveFlashToday: boolean;
  dailyRedemptions: { date: string; count: number }[];
}

export interface ActivityItem {
  id: string;
  type: "sale" | "redemption" | "ticket";
  label: string;
  at: string;
}

export async function getDashboardMetrics(businessId: string): Promise<DashboardMetrics> {
  const supabase = createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [salesRes, redemptionsRes, activePackagesRes, flashRes, dailyRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("amount, package:packages!inner(business_id)", { count: "exact" })
      .eq("package.business_id", businessId)
      .eq("status", "completed")
      .gte("created_at", startOfMonth),
    supabase
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("flash_deals")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .gt("ends_at", now.toISOString())
      .limit(1),
    supabase
      .from("redemptions")
      .select("redeemed_at")
      .eq("business_id", businessId)
      .gte("redeemed_at", sevenDaysAgo.toISOString()),
  ]);

  const monthlySalesAmount = (salesRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of dailyRes.data ?? []) {
    const key = new Date(row.redeemed_at).toISOString().slice(0, 10);
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  }

  return {
    monthlySalesCount: salesRes.data?.length ?? 0,
    monthlySalesAmount,
    totalRedemptions: redemptionsRes.count ?? 0,
    activePackagesCount: activePackagesRes.count ?? 0,
    hasActiveFlashToday: (flashRes.data?.length ?? 0) > 0,
    dailyRedemptions: Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })),
  };
}

export async function getRecentActivity(businessId: string): Promise<ActivityItem[]> {
  const supabase = createClient();

  const [salesRes, redemptionsRes, ticketsRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, amount, created_at, package:packages!inner(title, business_id)")
      .eq("package.business_id", businessId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("redemptions")
      .select("id, redeemed_at")
      .eq("business_id", businessId)
      .order("redeemed_at", { ascending: false })
      .limit(10),
    supabase
      .from("tickets")
      .select("id, created_at, event:events!inner(title, business_id)")
      .eq("event.business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const items: ActivityItem[] = [];

  for (const row of salesRes.data ?? []) {
    const pkg = Array.isArray(row.package) ? row.package[0] : row.package;
    items.push({
      id: `sale-${row.id}`,
      type: "sale",
      label: `Paket satışı: ${pkg?.title ?? ""} — ${Number(row.amount).toLocaleString("tr-TR")}₺`,
      at: row.created_at,
    });
  }

  for (const row of redemptionsRes.data ?? []) {
    items.push({
      id: `redemption-${row.id}`,
      type: "redemption",
      label: "QR kullanımı",
      at: row.redeemed_at,
    });
  }

  for (const row of ticketsRes.data ?? []) {
    const event = Array.isArray(row.event) ? row.event[0] : row.event;
    items.push({
      id: `ticket-${row.id}`,
      type: "ticket",
      label: `Etkinlik kaydı: ${event?.title ?? ""}`,
      at: row.created_at,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);
}
