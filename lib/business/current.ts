import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

export const getMyBusiness = cache(async (): Promise<Business | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Business | null;
});
