import { createClient } from "@/lib/supabase/server";
import { fetchTidelineActivity, type TidelineActivity } from "@/lib/tideline/service";
import type { SalesLeadStatus } from "@/lib/admin/pipeline-constants";

export interface SalesLead {
  id: string;
  business_name: string;
  city: string;
  visited_on: string;
  status: SalesLeadStatus;
  contact: string | null;
  notes: string | null;
  business_id: string | null;
  created_at: string;
}

interface UsBusiness {
  id: string;
  name: string;
  slug: string;
  city: string;
  approval_status: string;
  active_modules: string[] | null;
  tideline_restaurant_id: string | null;
  created_at: string;
}

export interface PipelineRow {
  key: string;
  kind: "lead" | "business";
  name: string;
  city: string;
  visitedOn: string | null;
  status: SalesLeadStatus;
  lead: SalesLead | null;
  business: UsBusiness | null;
  activity: TidelineActivity | null;
}

export interface SalesPipeline {
  rows: PipelineRow[];
  signedUp: number;
  unlinkedSignedLeads: number;
  linkableBusinesses: { id: string; name: string }[];
  tideline: "ok" | "not_configured" | "unavailable";
  costThresholdUsd: number | null;
}

/**
 * Elle eklenen adaylar + gerçek ABD kayıtları tek listede. Adayı bir
 * işletmeye bağlanmışsa (business_id) o işletmenin satırıyla birleşir; sayaç
 * yalnızca gerçek businesses kayıtlarını sayar (market = 'US').
 */
export async function getSalesPipeline(): Promise<SalesPipeline> {
  const supabase = createClient();
  const [leadsRes, businessesRes] = await Promise.all([
    supabase
      .from("sales_leads")
      .select("id, business_name, city, visited_on, status, contact, notes, business_id, created_at")
      .order("visited_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("businesses")
      .select("id, name, slug, city, approval_status, active_modules, tideline_restaurant_id, created_at")
      .eq("market", "US")
      .order("created_at", { ascending: false }),
  ]);

  const leads = (leadsRes.data ?? []) as SalesLead[];
  const businesses = (businessesRes.data ?? []) as UsBusiness[];
  const leadByBusiness = new Map(leads.filter((l) => l.business_id).map((l) => [l.business_id!, l]));

  const tidelineIds = businesses.map((b) => b.tideline_restaurant_id).filter((id): id is string => Boolean(id));
  const activity = await fetchTidelineActivity(tidelineIds);
  const activityFor = (b: UsBusiness) =>
    activity.ok && b.tideline_restaurant_id ? activity.byRestaurant.get(b.tideline_restaurant_id) ?? null : null;

  const businessRows: PipelineRow[] = businesses.map((b) => {
    const lead = leadByBusiness.get(b.id) ?? null;
    return {
      key: `b:${b.id}`,
      kind: "business",
      name: b.name,
      city: lead?.city || b.city,
      visitedOn: lead?.visited_on ?? null,
      status: "kaydoldu",
      lead,
      business: b,
      activity: activityFor(b),
    };
  });
  const usIds = new Set(businesses.map((b) => b.id));
  const leadRows: PipelineRow[] = leads
    .filter((l) => !l.business_id || !usIds.has(l.business_id))
    .map((l) => ({
      key: `l:${l.id}`,
      kind: "lead",
      name: l.business_name,
      city: l.city,
      visitedOn: l.visited_on,
      status: l.status,
      lead: l,
      business: null,
      activity: null,
    }));

  const statusOrder: Record<SalesLeadStatus, number> = { ilgileniyor: 0, tanitildi: 1, kaydoldu: 2, reddetti: 3 };
  leadRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return {
    rows: [...leadRows, ...businessRows],
    signedUp: businesses.length,
    unlinkedSignedLeads: leadRows.filter((r) => r.status === "kaydoldu").length,
    linkableBusinesses: businesses.filter((b) => !leadByBusiness.has(b.id)).map((b) => ({ id: b.id, name: b.name })),
    tideline: activity.ok ? "ok" : activity.reason,
    costThresholdUsd: activity.ok && activity.thresholdUsd > 0 ? activity.thresholdUsd : null,
  };
}
