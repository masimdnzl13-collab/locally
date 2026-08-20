import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";

export const dynamic = "force-dynamic";

// Pilot mod: 14 gün içinde ödemesi/ilk QR doğrulaması yapılmayan
// rezervasyonlar (status='reserved') otomatik düşer — kontenjan geri
// açılır, hak/QR geçersiz olur. Bu iş cron job olduğu için (auth.uid()
// yok) cancel_package_reservation() RPC'sini değil, doğrudan servis
// rolüyle tabloları günceller.
const RESERVATION_EXPIRY_DAYS = 14;

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();
  let expiredCount = 0;

  try {
    const cutoff = new Date(
      Date.now() - RESERVATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: stale, error: staleError } = await supabase
      .from("purchases")
      .select("id, package_id")
      .eq("status", "reserved")
      .lt("created_at", cutoff);

    if (staleError) throw staleError;

    for (const purchase of stale ?? []) {
      const { error: purchaseError } = await supabase
        .from("purchases")
        .update({ status: "cancelled", cancelled_reason: "no_show_expired" })
        .eq("id", purchase.id)
        .eq("status", "reserved");
      if (purchaseError) continue;

      await supabase
        .from("entitlements")
        .update({ status: "expired", remaining_uses: 0 })
        .eq("purchase_id", purchase.id);

      await supabase.rpc("decrement_package_sold_count", { p_package_id: purchase.package_id });

      expiredCount++;
    }

    await logCronRun(
      supabase,
      "reservation-expiry",
      "success",
      expiredCount,
      `${expiredCount} rezervasyon ${RESERVATION_EXPIRY_DAYS} gün içinde gelinmediği için düştü`
    );

    return NextResponse.json({ ok: true, expiredCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "reservation-expiry", "error", expiredCount, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
