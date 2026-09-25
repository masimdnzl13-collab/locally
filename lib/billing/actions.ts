"use server";

import { revalidatePath } from "next/cache";
import { getMyBusiness } from "@/lib/business/current";
import { cancelBusinessSubscription } from "@/lib/billing/subscriptions";

// İşletme sahibinin kendi aboneliğini iptal etmesi. İşletme kimliği formdan
// DEĞİL oturumdan gelir: getMyBusiness RLS altında yalnızca owner_id =
// auth.uid() satırını döner, cancelBusinessSubscription da aboneliği o
// işletmenin kimliğiyle bulur — başka bir işletmenin aboneliği iptal edilemez.
export async function cancelMySubscriptionAction(
  formData: FormData
): Promise<{ error?: string; success?: true; atPeriodEnd?: boolean }> {
  const business = await getMyBusiness();
  if (!business) return { error: "İşletme bulunamadı." };

  const when = String(formData.get("when") ?? "");
  if (when !== "now" && when !== "period_end") return { error: "İptal zamanı seçilmedi." };
  if (formData.get("confirm") !== "yes") return { error: "İptali onaylaman gerekiyor." };

  const atPeriodEnd = when === "period_end";
  const result = await cancelBusinessSubscription(business.id, { atPeriodEnd });
  if (!result.success) return { error: result.error };

  revalidatePath("/panel/faturalandirma");
  return { success: true, atPeriodEnd };
}
