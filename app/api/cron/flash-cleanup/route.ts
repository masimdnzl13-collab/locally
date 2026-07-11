import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();

  try {
    const { data, error } = await supabase
      .from("flash_deals")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("ends_at", new Date().toISOString())
      .select("id");

    if (error) throw error;

    const affected = data?.length ?? 0;
    await logCronRun(supabase, "flash-cleanup", "success", affected);

    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "flash-cleanup", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
