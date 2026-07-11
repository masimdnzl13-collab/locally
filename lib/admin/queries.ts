import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus, BusinessCategory } from "@/lib/types";

export interface AdminBusinessRow {
  id: string;
  name: string;
  slug: string;
  category: BusinessCategory;
  district: string | null;
  city: string;
  approval_status: ApprovalStatus;
  created_at: string;
  owner: { full_name: string | null; phone: string | null } | null;
}

async function fetchBusinessesByStatus(status: ApprovalStatus): Promise<AdminBusinessRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, category, district, city, approval_status, created_at, owner:profiles(full_name, phone)"
    )
    .eq("approval_status", status)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    ...row,
    owner: Array.isArray(row.owner) ? row.owner[0] : row.owner,
  })) as AdminBusinessRow[];
}

export async function getPendingBusinesses() {
  return fetchBusinessesByStatus("pending");
}

export async function getApprovedBusinesses() {
  return fetchBusinessesByStatus("approved");
}

export async function getSuspendedBusinesses() {
  return fetchBusinessesByStatus("suspended");
}

export interface AdminBusinessDetail extends AdminBusinessRow {
  description: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  suspend_reason: string | null;
}

export async function getBusinessDetailForAdmin(id: string): Promise<AdminBusinessDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select(
      `id, name, slug, category, district, city, approval_status, created_at,
       description, address, phone, instagram, logo_url, cover_url, suspend_reason,
       owner:profiles(full_name, phone)`
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    owner: Array.isArray(data.owner) ? data.owner[0] : data.owner,
  } as AdminBusinessDetail;
}

export interface OverviewMetrics {
  totalUsers: number;
  newUsersThisMonth: number;
  approvedBusinesses: number;
  pendingBusinesses: number;
  monthlySalesCount: number;
  monthlySalesAmount: number;
  totalCommission: number;
  weeklyVerifications: number;
  waitlistCount: number;
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const supabase = createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    totalUsersRes,
    newUsersRes,
    approvedRes,
    pendingRes,
    salesRes,
    commissionRes,
    verificationsRes,
    waitlistRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", startOfMonth),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from("purchases")
      .select("amount")
      .eq("status", "completed")
      .gte("created_at", startOfMonth),
    supabase.from("purchases").select("commission_amount").eq("status", "completed"),
    supabase
      .from("verification_logs")
      .select("id", { count: "exact", head: true })
      .eq("result", "success")
      .gte("created_at", startOfWeek.toISOString()),
    supabase.from("founder_waitlist").select("id", { count: "exact", head: true }),
  ]);

  const monthlySalesAmount = (salesRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const totalCommission = (commissionRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.commission_amount ?? 0),
    0
  );

  return {
    totalUsers: totalUsersRes.count ?? 0,
    newUsersThisMonth: newUsersRes.count ?? 0,
    approvedBusinesses: approvedRes.count ?? 0,
    pendingBusinesses: pendingRes.count ?? 0,
    monthlySalesCount: salesRes.data?.length ?? 0,
    monthlySalesAmount,
    totalCommission,
    weeklyVerifications: verificationsRes.count ?? 0,
    waitlistCount: waitlistRes.count ?? 0,
  };
}

export interface ContentItem {
  id: string;
  kind: "paket" | "flas" | "etkinlik";
  title: string;
  businessName: string;
  isActive: boolean;
  removedByAdmin: boolean;
  createdAt: string;
}

export async function getModerationContent(): Promise<ContentItem[]> {
  const supabase = createClient();

  const [packagesRes, flashRes, eventsRes] = await Promise.all([
    supabase
      .from("packages")
      .select("id, title, is_active, removed_by_admin, created_at, business:businesses(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("flash_deals")
      .select(
        "id, offer_text, is_active, removed_by_admin, created_at, business:businesses(name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("events")
      .select(
        "id, title, is_cancelled, removed_by_admin, created_at, business:businesses(name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const items: ContentItem[] = [];

  for (const row of packagesRes.data ?? []) {
    const business = Array.isArray(row.business) ? row.business[0] : row.business;
    items.push({
      id: row.id,
      kind: "paket",
      title: row.title,
      businessName: business?.name ?? "",
      isActive: row.is_active,
      removedByAdmin: row.removed_by_admin,
      createdAt: row.created_at,
    });
  }

  for (const row of flashRes.data ?? []) {
    const business = Array.isArray(row.business) ? row.business[0] : row.business;
    items.push({
      id: row.id,
      kind: "flas",
      title: row.offer_text,
      businessName: business?.name ?? "",
      isActive: row.is_active,
      removedByAdmin: row.removed_by_admin,
      createdAt: row.created_at,
    });
  }

  for (const row of eventsRes.data ?? []) {
    const business = Array.isArray(row.business) ? row.business[0] : row.business;
    items.push({
      id: row.id,
      kind: "etkinlik",
      title: row.title,
      businessName: business?.name ?? "",
      isActive: !row.is_cancelled,
      removedByAdmin: row.removed_by_admin,
      createdAt: row.created_at,
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface PendingRefund {
  purchaseId: string;
  amount: number;
  refundRequestedAt: string | null;
  packageTitle: string;
  businessName: string;
  customerName: string | null;
  customerPhone: string | null;
}

export async function getPendingRefunds(): Promise<PendingRefund[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select(
      `id, amount, refund_requested_at,
       package:packages(title, business:businesses(name)),
       user:profiles(full_name, phone)`
    )
    .eq("refund_requested", true)
    .order("refund_requested_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const pkg = Array.isArray(row.package) ? row.package[0] : row.package;
    const business = Array.isArray(pkg?.business) ? pkg.business[0] : pkg?.business;
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    return {
      purchaseId: row.id,
      amount: row.amount,
      refundRequestedAt: row.refund_requested_at,
      packageTitle: pkg?.title ?? "",
      businessName: business?.name ?? "",
      customerName: user?.full_name ?? null,
      customerPhone: user?.phone ?? null,
    };
  });
}

export interface WaitlistEntry {
  email: string;
  created_at: string;
}

export async function getWaitlist(): Promise<WaitlistEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("founder_waitlist")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as WaitlistEntry[];
}
