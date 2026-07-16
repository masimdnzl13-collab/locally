import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      role: (profile?.role as UserRole) ?? "user",
    };
  } catch {
    return null;
  }
});
