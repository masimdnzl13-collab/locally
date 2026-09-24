"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRoles } from "@/lib/auth/roles";
import { addModule, removeModule, runWinterActivation, WINTER_MODULE } from "@/lib/modules/seasonal";
import { activateUsSignup } from "@/lib/onboarding-us/complete";
import { assignTidelineNumber, retryTidelineNumber } from "@/lib/tideline/internal-api";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/types";

type Result = { error?: string; success?: true; message?: string };

// Modül değişiklikleri servis rolüyle yapılır (bkz. lib/modules/seasonal.ts);
// bu kontrol tek yetki kapısı olduğu için zorunlu.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, additional_roles")
    .eq("id", user!.id)
    .single();
  const roles = getEffectiveRoles({
    role: (profile?.role as UserRole) ?? "user",
    additional_roles: profile?.additional_roles as UserRole[] | null,
  });
  if (!roles.includes("admin")) redirect("/");
  return user!.id;
}

function summary(verb: string, changed: number, notified: number, failures: number) {
  if (changed === 0) return "Değişiklik yok — seçilen işletmelerin hepsi zaten bu durumdaydı.";
  let text = `${changed} işletmede kış modülü ${verb}.`;
  if (notified) text += ` ${notified} bildirim gönderildi.`;
  if (failures) text += ` ${failures} bildirim gönderilemedi.`;
  return text;
}

export async function setWinterModuleAction(formData: FormData): Promise<Result> {
  const actorId = await requireAdmin();
  const ids = formData.getAll("businessId").map(String).filter(Boolean);
  const mode = formData.get("mode");
  if (ids.length === 0) return { error: "En az bir işletme seç." };

  try {
    if (mode === "add") {
      const r = await addModule(ids, WINTER_MODULE, "admin", actorId);
      revalidatePath("/admin/moduller");
      return { success: true, message: summary("açıldı", r.changed.length, r.notified, r.notificationFailures) };
    }
    if (mode === "remove") {
      const r = await removeModule(ids, WINTER_MODULE, "admin", actorId);
      revalidatePath("/admin/moduller");
      return { success: true, message: summary("kapatıldı", r.changed.length, 0, 0) };
    }
  } catch (err) {
    return { error: (err as Error).message };
  }
  return { error: "Geçersiz işlem." };
}

// 1 Ekim cron işinin aynısını şimdi çalıştırır (tüm ABD işletmeleri).
export async function runWinterActivationNowAction(): Promise<Result> {
  const actorId = await requireAdmin();
  try {
    const r = await runWinterActivation("admin", actorId);
    revalidatePath("/admin/moduller");
    return { success: true, message: summary("açıldı", r.changed.length, r.notified, r.notificationFailures) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// --- Tideline kurulum kuyruğu (/admin/tideline-kurulum) ---

export async function retryUsActivationAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "İşletme bulunamadı." };
  try {
    const signup = await activateUsSignup(businessId);
    revalidatePath("/admin/tideline-kurulum");
    if (!signup) return { error: "Başvuru bulunamadı." };
    if (!signup.business.tideline_restaurant_id) {
      return { error: signup.provisioning_error ?? "Tideline restoranı oluşturulamadı." };
    }
    return { success: true, message: "Tideline restoranı bağlandı." };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// Tideline'daki numara durumunu Locally tarafındaki başvuru satırına yansıtır
// (işletme sahibinin durum ekranı buradan okur).
async function syncOnboardingPhone(externalRef: string | null, phone: { status: string; phoneNumber: string | null }) {
  if (!externalRef) return;
  await createServiceClient()
    .from("us_onboarding")
    .update({
      tideline_phone_status: phone.status,
      tideline_phone_number: phone.phoneNumber,
      provisioning_error: phone.status === "active" ? null : undefined,
    })
    .eq("business_id", externalRef);
}

export async function retryTidelineNumberAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const numberId = String(formData.get("numberId") ?? "");
  const externalRef = String(formData.get("externalRef") ?? "") || null;
  const result = await retryTidelineNumber(numberId);
  if (!result.ok) return { error: result.error };
  await syncOnboardingPhone(externalRef, result.data.phone);
  revalidatePath("/admin/tideline-kurulum");
  return result.data.phone.status === "active"
    ? { success: true, message: `Numara alındı: ${result.data.phone.phoneNumber}` }
    : { error: `Yine alınamadı: ${result.data.phone.failureReason}` };
}

export async function assignTidelineNumberAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const numberId = String(formData.get("numberId") ?? "");
  const externalRef = String(formData.get("externalRef") ?? "") || null;
  const phoneNumber = String(formData.get("phoneNumber") ?? "").replace(/[\s()-]/g, "");
  if (!phoneNumber) return { error: "Numara gerekli (+1XXXXXXXXXX)." };
  const result = await assignTidelineNumber(numberId, phoneNumber);
  if (!result.ok) return { error: result.error };
  await syncOnboardingPhone(externalRef, result.data.phone);
  revalidatePath("/admin/tideline-kurulum");
  return { success: true, message: `Numara atandı: ${phoneNumber}` };
}
