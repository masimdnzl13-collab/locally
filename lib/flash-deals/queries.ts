import { createClient } from "@/lib/supabase/server";
import type { BusinessCategory } from "@/lib/types";

export interface FlashDeal {
  id: string;
  offer_text: string;
  starts_at: string;
  ends_at: string;
  total_quota: number;
  remaining_quota: number;
  business: {
    name: string;
    slug: string;
    district: string | null;
    category: BusinessCategory;
    cover_url: string | null;
  };
  reserved_by_me: boolean;
  my_confirmation_code: string | null;
}

export interface PanelFlashDeal {
  id: string;
  offer_text: string;
  starts_at: string;
  ends_at: string;
  total_quota: number;
  remaining_quota: number;
  is_active: boolean;
  removed_by_admin: boolean;
  created_at: string;
}

export async function getLiveFlashForBusiness(businessId: string): Promise<PanelFlashDeal | null> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("flash_deals")
    .select("id, offer_text, starts_at, ends_at, total_quota, remaining_quota, is_active, removed_by_admin, created_at")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .gt("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as PanelFlashDeal;
}

export async function getFlashHistory(businessId: string, limit = 8): Promise<PanelFlashDeal[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("flash_deals")
    .select("id, offer_text, starts_at, ends_at, total_quota, remaining_quota, is_active, removed_by_admin, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as PanelFlashDeal[];
}

export async function getActiveFlashDeals(city?: string): Promise<FlashDeal[]> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const nowIso = new Date().toISOString();

    let query = supabase
      .from("flash_deals")
      .select(
        `id, offer_text, starts_at, ends_at, total_quota, remaining_quota,
         business:businesses!inner(name, slug, district, city, category, cover_url, approval_status),
         reservations:flash_deal_reservations(user_id, confirmation_code)`
      )
      .eq("is_active", true)
      .eq("business.approval_status", "approved")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: true });

    if (city) query = query.eq("business.city", city);

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row) => {
      const business = Array.isArray(row.business) ? row.business[0] : row.business;
      const reservations = (row.reservations ?? []) as {
        user_id: string;
        confirmation_code: string;
      }[];
      const mine = user ? reservations.find((r) => r.user_id === user.id) : undefined;
      return {
        id: row.id,
        offer_text: row.offer_text,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        total_quota: row.total_quota,
        remaining_quota: row.remaining_quota,
        business,
        reserved_by_me: !!mine,
        my_confirmation_code: mine?.confirmation_code ?? null,
      };
    }) as FlashDeal[];
  } catch {
    return [];
  }
}
