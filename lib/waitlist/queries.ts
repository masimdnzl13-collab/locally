import { createClient } from "@/lib/supabase/server";

export async function getWaitlistCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("founder_waitlist")
      .select("*", { count: "exact", head: true });

    if (error || count === null) return 0;
    return count;
  } catch {
    return 0;
  }
}
