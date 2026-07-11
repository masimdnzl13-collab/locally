import { createClient } from "@/lib/supabase/server";

export interface AnnouncementHistoryItem {
  id: string;
  channel: string;
  content: string;
  target_segment: string;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
}

export async function getAnnouncementHistory(
  businessId: string
): Promise<AnnouncementHistoryItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("id, channel, content, target_segment, recipient_count, sent_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return data as AnnouncementHistoryItem[];
}
