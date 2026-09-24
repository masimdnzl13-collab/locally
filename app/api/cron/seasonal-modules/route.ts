import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";
import { runWinterActivation } from "@/lib/modules/seasonal";

export const dynamic = "force-dynamic";

// P7 — her yıl 1 Ekim'de (vercel.json: "0 6 1 10 *", UTC) market='US' olan
// işletmelerin active_modules'üne locally_core'u ekler; zaten olanlara
// dokunmaz, yalnızca yeni eklenenlere bildirim gider. Aynı işlem admin
// panelinden (/admin/moduller) elle de tetiklenebilir.
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();

  try {
    const result = await runWinterActivation("cron");
    await logCronRun(
      supabase,
      "seasonal-modules",
      "success",
      result.changed.length,
      result.notificationFailures ? `${result.notificationFailures} bildirim gönderilemedi` : undefined
    );
    return NextResponse.json({ ok: true, ...result, changed: result.changed.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "seasonal-modules", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
