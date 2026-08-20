import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/supabase/with-timeout";
import type { UserRole } from "@/lib/types";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = createClient();
    const user = await withTimeout(
      supabase.auth.getUser().then((res) => res.data.user),
      AUTH_LOOKUP_TIMEOUT_MS,
      null
    );
    if (!user) return null;

    const profile = await withTimeout(
      Promise.resolve(
        supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
      ).then((res) => res.data),
      AUTH_LOOKUP_TIMEOUT_MS,
      null
    );

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
