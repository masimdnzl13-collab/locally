import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

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
