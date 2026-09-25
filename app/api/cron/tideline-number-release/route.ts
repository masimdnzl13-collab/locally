import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";
import { releaseNumbersForEndedSubscriptions } from "@/lib/billing/number-release";

export const dynamic = "force-dynamic";

// AC — günlük (vercel.json: "15 3 * * *", UTC). Dönem sonu iptali dönemi biten
// ya da iptal edilmiş ama numarası henüz serbest bırakılmamış abonelikler için
// Tideline'daki Twilio numarasını bırakır. Asıl tetikleyici Stripe'ın
// customer.subscription.deleted webhook'u; bu iş kaçanları ve test modunu yakalar.
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();
  try {
    const outcomes = await releaseNumbersForEndedSubscriptions();
    await logCronRun(
      supabase,
      "tideline-number-release",
      outcomes.failed ? "error" : "success",
      outcomes.released,
      outcomes.failed ? `${outcomes.failed} numara serbest bırakılamadı; yarın tekrar denenecek` : undefined
    );
    return NextResponse.json({ ok: true, ...outcomes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "tideline-number-release", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
