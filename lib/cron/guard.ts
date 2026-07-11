import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function logCronRun(
  supabase: SupabaseClient,
  jobName: string,
  status: "success" | "error",
  affectedCount: number,
  message?: string
) {
  await supabase.from("cron_logs").insert({
    job_name: jobName,
    status,
    affected_count: affectedCount,
    message: message ?? null,
  });
}
