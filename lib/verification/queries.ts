import { createClient } from "@/lib/supabase/server";

export interface VerificationLogItem {
  id: string;
  code: string;
  code_type: string;
  result: string;
  error_code: string | null;
  customer_name: string | null;
  detail: string | null;
  created_at: string;
}

export async function getTodayVerificationHistory(
  businessId: string
): Promise<VerificationLogItem[]> {
  const supabase = createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("verification_logs")
    .select("id, code, code_type, result, error_code, customer_name, detail, created_at")
    .eq("business_id", businessId)
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as VerificationLogItem[];
}
