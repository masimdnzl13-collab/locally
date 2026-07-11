import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";

export const dynamic = "force-dynamic";

// Paketin kendi "süresi doldu" durumu panelde expires_at'ten dinamik
// hesaplanır (bkz. lib/types.ts getPackageStatus), bu yüzden packages
// tablosunda ayrıca saklanan bir alan yok. Bu iş yalnızca: (1) süresi
// geçmiş paketlerin hâlâ 'active' görünen haklarını 'expired' yapar,
// (2) son 7 gün kalan ve hâlâ hakkı olan kullanıcılar için hatırlatma
// kuyruğa eklenir.

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();
  let expiredCount = 0;
  let queuedCount = 0;

  try {
    const nowIso = new Date().toISOString();

    const { data: expiring, error: expiringError } = await supabase
      .from("entitlements")
      .select("id, purchase:purchases!inner(package:packages!inner(expires_at))")
      .eq("status", "active")
      .lt("purchase.package.expires_at", nowIso);

    if (expiringError) throw expiringError;

    const expiringIds = (expiring ?? []).map((row) => row.id as string);
    if (expiringIds.length > 0) {
      const { error: updateError } = await supabase
        .from("entitlements")
        .update({ status: "expired" })
        .in("id", expiringIds);
      if (updateError) throw updateError;
      expiredCount = expiringIds.length;
    }

    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: soonExpiring, error: soonError } = await supabase
      .from("entitlements")
      .select(
        `id, remaining_uses,
         purchase:purchases!inner(user_id, package:packages!inner(title, expires_at))`
      )
      .eq("status", "active")
      .gt("remaining_uses", 0)
      .lte("purchase.package.expires_at", in7Days)
      .gt("purchase.package.expires_at", nowIso);

    if (soonError) throw soonError;

    for (const row of soonExpiring ?? []) {
      const purchase = Array.isArray(row.purchase) ? row.purchase[0] : row.purchase;
      const pkg = Array.isArray(purchase?.package) ? purchase.package[0] : purchase?.package;
      if (!purchase || !pkg) continue;

      // Aynı hak için hatırlatma daha önce kuyruğa girdiyse (job iki kez
      // çalışsa bile) tekrar eklemiyoruz — benzersiz kısmi indeks de
      // bunu ikinci bir güvenlik katmanı olarak garanti eder.
      const { data: alreadyQueued } = await supabase
        .from("notification_queue")
        .select("id")
        .eq("kind", "package_expiry_reminder")
        .eq("payload->>entitlement_id", row.id)
        .maybeSingle();

      if (alreadyQueued) continue;

      const { error: insertError } = await supabase.from("notification_queue").insert({
        user_id: purchase.user_id,
        kind: "package_expiry_reminder",
        payload: {
          entitlement_id: row.id,
          package_title: pkg.title,
          remaining_uses: row.remaining_uses,
          expires_at: pkg.expires_at,
          message: `${pkg.title}: ${row.remaining_uses} hakkın var, son 7 gün!`,
        },
      });

      if (!insertError) queuedCount++;
    }

    await logCronRun(
      supabase,
      "package-lifecycle",
      "success",
      expiredCount + queuedCount,
      `${expiredCount} hak süresi doldu, ${queuedCount} hatırlatma kuyruğa eklendi`
    );

    return NextResponse.json({ ok: true, expiredCount, queuedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "package-lifecycle", "error", expiredCount + queuedCount, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
