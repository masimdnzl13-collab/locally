"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";
import { createSubMerchant } from "@/lib/iyzico/service";

export async function setPaymentAccountAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await getMyBusiness();
  if (!business) redirect("/panel/kurulum");

  const submerchantType = String(formData.get("submerchantType") ?? "PERSONAL") as
    | "PERSONAL"
    | "PRIVATE_COMPANY";
  const legalName = String(formData.get("legalName") ?? "").trim();
  const identityNumber = String(formData.get("identityNumber") ?? "").trim();
  const taxOffice = String(formData.get("taxOffice") ?? "").trim();
  const iban = String(formData.get("iban") ?? "").trim().replace(/\s+/g, "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactSurname = String(formData.get("contactSurname") ?? "").trim();

  if (!legalName) return { error: "Ad Soyad / Şirket Unvanı zorunlu." };
  if (!identityNumber) return { error: "TC Kimlik No / Vergi No zorunlu." };
  if (!iban || !iban.toUpperCase().startsWith("TR") || iban.length !== 26) {
    return { error: "Geçerli bir IBAN gir (TR ile başlayan 26 karakter)." };
  }
  if (!contactName || !contactSurname) return { error: "Yetkili adı ve soyadı zorunlu." };
  if (submerchantType === "PRIVATE_COMPANY" && !taxOffice) {
    return { error: "Şirket için vergi dairesi zorunlu." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/panel/ayarlar");

  const result = await createSubMerchant({
    externalId: business.id,
    type: submerchantType,
    legalName,
    contactName,
    contactSurname,
    email: user!.email ?? "",
    gsmNumber: business.phone ?? "",
    address: business.address ?? "",
    iban,
    identityNumber,
    taxOffice: taxOffice || undefined,
  });

  if (!result.success) {
    return { error: result.error ?? "Alt üye işyeri kaydı oluşturulamadı." };
  }

  // Test modunda gerçek bir inceleme süreci olmadığı için akışın uçtan uca
  // denenebilmesi adına doğrudan onaylanmış sayılır; gerçek modda iyzico
  // incelemesi sürdüğünden durum 'pending' kalır.
  const nextStatus = result.simulated ? "approved" : "pending";

  const { error } = await supabase
    .from("businesses")
    .update({
      legal_name: legalName,
      tax_identity_number: identityNumber,
      iban,
      iyzico_submerchant_type: submerchantType,
      iyzico_submerchant_key: result.submerchantKey,
      iyzico_onboarding_status: nextStatus,
      iyzico_reject_reason: null,
    })
    .eq("id", business.id);

  if (error) return { error: error.message };

  revalidatePath("/panel/ayarlar");
  revalidatePath("/kesfet");
  return { success: true };
}
