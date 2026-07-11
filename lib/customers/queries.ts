import { createClient } from "@/lib/supabase/server";

export interface Customer {
  id: string;
  phone: string;
  full_name: string | null;
  first_visit_at: string | null;
  last_visit_at: string | null;
  visit_count: number;
  notes: string | null;
  created_at: string;
}

export async function getCustomers(businessId: string): Promise<Customer[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, phone, full_name, first_visit_at, last_visit_at, visit_count, notes, created_at")
    .eq("business_id", businessId)
    .order("last_visit_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as Customer[];
}

export interface TimelineEntry {
  kind: "paket" | "flas" | "etkinlik";
  label: string;
  occurred_at: string;
}

export interface CustomerPackage {
  package_title: string;
  remaining_uses: number;
  usage_count: number;
  status: string;
  qr_code: string;
}

export async function getCustomer(id: string, businessId: string): Promise<Customer | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, phone, full_name, first_visit_at, last_visit_at, visit_count, notes, created_at")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (error || !data) return null;
  return data as Customer;
}

export async function getCustomerDetail(
  id: string
): Promise<{ timeline: TimelineEntry[]; packages: CustomerPackage[] } | null> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_customer_detail", { p_customer_id: id });
  if (error || !data) return null;

  return {
    timeline: (data.timeline ?? []) as TimelineEntry[],
    packages: (data.packages ?? []) as CustomerPackage[],
  };
}
