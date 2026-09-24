import { createServiceClient } from "@/lib/supabase/service";
import { notificationService, smsProviderFor, isEmailConfigured } from "@/lib/notifications/service";
import { winterModuleActivatedTemplate } from "@/lib/notifications/templates/seasonal-modules";
import type { BusinessMarket, BusinessModule } from "@/lib/types";

// P7 — sezonluk modül geçişi. Hem admin paneli (/admin/moduller) hem de
// 1 Ekim cron işi (/api/cron/seasonal-modules) buradan geçer. Ekleme/çıkarma
// atomik SQL fonksiyonlarıyla yapılır (bkz. *_seasonal_modules.sql); yalnızca
// gerçekten değişen işletmelere bildirim gider.

export const WINTER_MODULE: BusinessModule = "locally_core";

type Source = "admin" | "cron";
type Channel = "sms" | "email" | "none";
type NotifyStatus = "sent" | "simulated" | "failed" | "skipped";

export interface ModuleChangeResult {
  changed: string[];
  notified: number;
  notificationFailures: number;
}

async function notifyWinterActivated(
  supabase: ReturnType<typeof createServiceClient>,
  business: { id: string; owner_id: string; phone: string | null; market: BusinessMarket }
): Promise<{ channel: Channel; status: NotifyStatus; error?: string }> {
  const template = winterModuleActivatedTemplate(business.market);

  // SMS öncelikli — ama yalnızca o numaranın sağlayıcısı (US → Twilio,
  // TR → Netgsm) gerçekten yapılandırılmışsa. Aksi halde e-postaya düşer;
  // ikisi de yoksa bildirim servisinin test modu simüle eder.
  const phone = business.phone?.trim();
  if (phone && smsProviderFor(phone).configured) {
    const result = await notificationService.sendSms({ to: phone, message: template.sms });
    if (result.success) return { channel: "sms", status: result.simulated ? "simulated" : "sent" };
    if (!isEmailConfigured()) return { channel: "sms", status: "failed", error: result.error };
  }

  const { data } = await supabase.auth.admin.getUserById(business.owner_id);
  const email = data?.user?.email;
  if (!email) {
    if (phone) {
      const result = await notificationService.sendSms({ to: phone, message: template.sms });
      return { channel: "sms", status: result.success ? (result.simulated ? "simulated" : "sent") : "failed", error: result.error };
    }
    return { channel: "none", status: "skipped", error: "İşletmenin telefonu ve e-postası yok" };
  }

  const result = await notificationService.sendEmail({
    to: email,
    subject: template.emailSubject,
    html: template.emailHtml,
  });
  return {
    channel: "email",
    status: result.success ? (result.simulated ? "simulated" : "sent") : "failed",
    error: result.error,
  };
}

export async function addModule(
  businessIds: string[],
  module: BusinessModule,
  source: Source,
  actorId: string | null = null
): Promise<ModuleChangeResult> {
  if (businessIds.length === 0) return { changed: [], notified: 0, notificationFailures: 0 };

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("business_modules_add", {
    p_business_ids: businessIds,
    p_module: module,
  });
  if (error) throw new Error(error.message);

  const changed = ((data ?? []) as { business_id: string }[]).map((r) => r.business_id);
  if (changed.length === 0) return { changed, notified: 0, notificationFailures: 0 };

  // Bildirim metni yalnızca kış modülü için var; başka bir modül eklenirse
  // (ör. admin elle tideline açarsa) değişiklik yine loglanır ama mesaj gitmez.
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, owner_id, phone, market")
    .in("id", changed);

  let notified = 0;
  let notificationFailures = 0;
  const events = [];
  for (const business of (businesses ?? []) as {
    id: string;
    owner_id: string;
    phone: string | null;
    market: BusinessMarket;
  }[]) {
    const outcome =
      module === WINTER_MODULE
        ? await notifyWinterActivated(supabase, business)
        : { channel: "none" as const, status: "skipped" as const, error: undefined };
    if (outcome.status === "sent" || outcome.status === "simulated") notified++;
    if (outcome.status === "failed") notificationFailures++;
    events.push({
      business_id: business.id,
      module,
      action: "added",
      source,
      actor_id: actorId,
      notification_channel: outcome.channel,
      notification_status: outcome.status,
      notification_error: outcome.error ?? null,
    });
  }
  if (events.length) await supabase.from("business_module_events").insert(events);

  return { changed, notified, notificationFailures };
}

export async function removeModule(
  businessIds: string[],
  module: BusinessModule,
  source: Source,
  actorId: string | null = null
): Promise<ModuleChangeResult> {
  if (businessIds.length === 0) return { changed: [], notified: 0, notificationFailures: 0 };

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("business_modules_remove", {
    p_business_ids: businessIds,
    p_module: module,
  });
  if (error) throw new Error(error.message);

  const changed = ((data ?? []) as { business_id: string }[]).map((r) => r.business_id);
  if (changed.length) {
    await supabase.from("business_module_events").insert(
      changed.map((id) => ({
        business_id: id,
        module,
        action: "removed",
        source,
        actor_id: actorId,
        notification_channel: "none",
        notification_status: "skipped",
      }))
    );
  }
  return { changed, notified: 0, notificationFailures: 0 };
}

// 1 Ekim geçişi: market='US' olan tüm işletmelere kış modülünü ekler (zaten
// olanlara dokunmaz). active_modules'ü BOŞ olanlar hariç — onlar ödemesini
// henüz tamamlamamış /kayit/us başvuruları (bkz. *_us_onboarding.sql).
export async function runWinterActivation(source: Source, actorId: string | null = null) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, active_modules")
    .eq("market", "US")
    .not("active_modules", "cs", `{${WINTER_MODULE}}`);
  if (error) throw new Error(error.message);

  const ids = ((data ?? []) as { id: string; active_modules: string[] }[])
    .filter((b) => b.active_modules.length > 0)
    .map((b) => b.id);
  return addModule(ids, WINTER_MODULE, source, actorId);
}
