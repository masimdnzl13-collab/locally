import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";
import { istanbulDateString, startOfIstanbulDayUtcIso } from "@/lib/istanbul-time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();

  try {
    const summaryDate = istanbulDateString();
    const dayStartIso = startOfIstanbulDayUtcIso();
    const dayEndIso = new Date(
      new Date(dayStartIso).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id")
      .eq("approval_status", "approved");

    if (businessesError) throw businessesError;

    let affected = 0;

    for (const business of businesses ?? []) {
      const [salesRes, redemptionsRes, reservationsRes, ticketsRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("amount, package:packages!inner(business_id)")
          .eq("package.business_id", business.id)
          .eq("status", "completed")
          .gte("created_at", dayStartIso)
          .lt("created_at", dayEndIso),
        supabase
          .from("redemptions")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .gte("redeemed_at", dayStartIso)
          .lt("redeemed_at", dayEndIso),
        supabase
          .from("flash_deal_reservations")
          .select("id, flash_deal:flash_deals!inner(business_id)", { count: "exact" })
          .eq("flash_deal.business_id", business.id)
          .gte("created_at", dayStartIso)
          .lt("created_at", dayEndIso),
        supabase
          .from("tickets")
          .select("id, event:events!inner(business_id)", { count: "exact" })
          .eq("event.business_id", business.id)
          .gte("created_at", dayStartIso)
          .lt("created_at", dayEndIso),
      ]);

      const salesAmount = (salesRes.data ?? []).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0
      );

      const { error: upsertError } = await supabase.from("business_daily_summaries").upsert(
        {
          business_id: business.id,
          summary_date: summaryDate,
          sales_count: salesRes.data?.length ?? 0,
          sales_amount: salesAmount,
          redemptions_count: redemptionsRes.count ?? 0,
          flash_reservations_count: reservationsRes.count ?? 0,
          tickets_count: ticketsRes.count ?? 0,
        },
        { onConflict: "business_id,summary_date" }
      );

      if (upsertError) throw upsertError;
      affected++;
    }

    await logCronRun(supabase, "daily-summary", "success", affected);

    return NextResponse.json({ ok: true, affected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "daily-summary", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
