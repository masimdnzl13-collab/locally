import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCronSecret, logCronRun } from "@/lib/cron/guard";
import { notificationService } from "@/lib/notifications";
import { istanbulDateString } from "@/lib/istanbul-time";

export const dynamic = "force-dynamic";

function upcomingWeekendRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Pazar, 4 = Perşembe, 6 = Cumartesi
  const daysUntilSaturday = (6 - day + 7) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() + daysUntilSaturday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 2); // cumartesi + pazar
  return { start, end };
}

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();

  try {
    const today = istanbulDateString();

    // Aynı gün içinde job iki kez tetiklense bile bültenin iki kez
    // gönderilmesini engeller.
    const { data: alreadySent } = await supabase
      .from("cron_logs")
      .select("id")
      .eq("job_name", "thursday-newsletter")
      .eq("status", "success")
      .gte("run_at", `${today}T00:00:00.000Z`)
      .limit(1)
      .maybeSingle();

    if (alreadySent) {
      return NextResponse.json({ ok: true, skipped: true, reason: "already_sent_today" });
    }

    const { start, end } = upcomingWeekendRange();

    const [eventsRes, packagesRes, usersRes] = await Promise.all([
      supabase
        .from("events")
        .select("title, event_at, business:businesses!inner(name, approval_status)")
        .eq("business.approval_status", "approved")
        .eq("is_cancelled", false)
        .gte("event_at", start.toISOString())
        .lt("event_at", end.toISOString())
        .order("event_at", { ascending: true })
        .limit(20),
      supabase
        .from("packages")
        .select("title, sale_price, business:businesses!inner(name, approval_status)")
        .eq("business.approval_status", "approved")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("profiles").select("id").eq("role", "user"),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (packagesRes.error) throw packagesRes.error;
    if (usersRes.error) throw usersRes.error;

    const events = eventsRes.data ?? [];
    const packages = packagesRes.data ?? [];

    const eventLines = events
      .map((e) => {
        const business = Array.isArray(e.business) ? e.business[0] : e.business;
        return `<li>${e.title} — ${business?.name ?? ""} (${new Date(e.event_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })})</li>`;
      })
      .join("");

    const packageLines = packages
      .map((p) => {
        const business = Array.isArray(p.business) ? p.business[0] : p.business;
        return `<li>${p.title} — ${business?.name ?? ""}</li>`;
      })
      .join("");

    const html = `
      <h2>Bu hafta sonu Bodrum'da neler var?</h2>
      <h3>Etkinlikler</h3>
      <ul>${eventLines || "<li>Bu hafta sonu öne çıkan etkinlik yok.</li>"}</ul>
      <h3>Aktif Paketler</h3>
      <ul>${packageLines || "<li>Şu an aktif paket yok.</li>"}</ul>
    `;

    let sentCount = 0;
    const userIds = (usersRes.data ?? []).map((u) => u.id as string);

    for (const userId of userIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (!email) continue;

      const result = await notificationService.sendEmail({
        to: email,
        subject: "Bu hafta Bodrum'da neler var — Locally",
        html,
      });
      if (result.success) sentCount++;
    }

    await logCronRun(
      supabase,
      "thursday-newsletter",
      "success",
      sentCount,
      `${events.length} etkinlik, ${packages.length} paket derlendi, ${sentCount} kullanıcıya gönderildi`
    );

    return NextResponse.json({ ok: true, sentCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await logCronRun(supabase, "thursday-newsletter", "error", 0, message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
