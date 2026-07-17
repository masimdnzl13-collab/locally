import { createClient } from "@/lib/supabase/server";
import type { Business, BusinessCategory } from "@/lib/types";

const ZERO_COUNTS: Record<BusinessCategory, number> = {
  restoran: 0,
  kafe: 0,
  otel: 0,
  beach_club: 0,
  aktivite: 0,
  diger: 0,
};

/** Real per-category counts of approved businesses — never fabricated. */
export async function getBusinessCategoryCounts(
  city?: string
): Promise<Record<BusinessCategory, number>> {
  try {
    const supabase = createClient();
    let query = supabase.from("businesses").select("category").eq("approval_status", "approved");
    if (city) query = query.eq("city", city);

    const { data, error } = await query;
    if (error || !data) return { ...ZERO_COUNTS };

    const counts = { ...ZERO_COUNTS };
    for (const row of data as { category: BusinessCategory }[]) {
      counts[row.category] = (counts[row.category] ?? 0) + 1;
    }
    return counts;
  } catch {
    return { ...ZERO_COUNTS };
  }
}

export interface BusinessProfilePackage {
  id: string;
  title: string;
  sale_price: number;
  summer_reference_price: number;
  usage_count: number;
}

export interface BusinessProfileEvent {
  id: string;
  title: string;
  event_at: string;
  image_url: string | null;
  is_paid: boolean;
  ticket_price: number | null;
}

export interface BusinessProfile extends Business {
  packages: BusinessProfilePackage[];
  events: BusinessProfileEvent[];
}

export async function getBusinessBySlug(slug: string): Promise<BusinessProfile | null> {
  try {
    const supabase = createClient();

    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("slug", slug)
      .eq("approval_status", "approved")
      .single();

    if (error || !business) return null;

    const [{ data: packages }, { data: events }] = await Promise.all([
      supabase
        .from("packages")
        .select("id, title, sale_price, summer_reference_price, usage_count")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("id, title, event_at, image_url, is_paid, ticket_price")
        .eq("business_id", business.id)
        .gte("event_at", new Date().toISOString())
        .order("event_at", { ascending: true }),
    ]);

    return {
      ...(business as Business),
      packages: packages ?? [],
      events: events ?? [],
    };
  } catch {
    return null;
  }
}
