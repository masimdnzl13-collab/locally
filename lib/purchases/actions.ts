"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { initializeCheckout, refundPayment } from "@/lib/iyzico/service";
import { finalizeCheckout } from "@/lib/purchases/checkout";

function clientIp(): string {
  const forwarded = headers().get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "85.34.78.112";
}

async function requireAdminUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? supabase : null;
}

export async function initiatePackageCheckoutAction(
  formData: FormData
): Promise<{ error?: string }> {
  const packageId = String(formData.get("packageId") ?? "");
  if (!packageId) return { error: "Paket bulunamadı." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/giris?next=/paket/${packageId}`);
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select(
      "id, title, sale_price, is_active, expires_at, quota, sold_count, per_person_limit, business:businesses(id, iyzico_onboarding_status, iyzico_submerchant_key)"
    )
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) return { error: "Paket bulunamadı." };

  const business = Array.isArray(pkg.business) ? pkg.business[0] : pkg.business;
  if (!business) return { error: "İşletme bulunamadı." };

  if (!pkg.is_active) return { error: "Bu paket artık satışta değil." };
  if (new Date(pkg.expires_at) < new Date()) return { error: "Bu paketin süresi dolmuş." };
  if (pkg.quota !== null && pkg.sold_count >= pkg.quota) {
    return { error: "Bu paket için kontenjan doldu." };
  }
  if (business.iyzico_onboarding_status !== "approved" || !business.iyzico_submerchant_key) {
    return { error: "Bu işletme ödeme altyapısını henüz tamamlamadı." };
  }

  const { count: existingCount } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId)
    .eq("user_id", user!.id)
    .eq("status", "completed");

  if ((existingCount ?? 0) >= pkg.per_person_limit) {
    return { error: "Bu paketi kişi başı satın alma limitine ulaştın." };
  }

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("commission_rate")
    .eq("id", true)
    .single();

  const commissionRate = settings?.commission_rate ?? 0.09;
  const commissionAmount = Math.round(pkg.sale_price * commissionRate * 100) / 100;
  const businessPayoutAmount = Math.round((pkg.sale_price - commissionAmount) * 100) / 100;

  const conversationId = crypto.randomUUID();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user!.id)
    .single();

  const [name, ...rest] = (profile?.full_name || "Locally Müşteri").split(" ");

  const checkout = await initializeCheckout({
    conversationId,
    price: pkg.sale_price,
    itemId: pkg.id,
    itemName: pkg.title,
    submerchantKey: business.iyzico_submerchant_key,
    businessPayoutAmount,
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/iyzico/callback`,
    buyer: {
      id: user!.id,
      name: name || "Locally",
      surname: rest.join(" ") || "Müşteri",
      email: user!.email ?? "",
      gsmNumber: profile?.phone ?? undefined,
      identityNumber: "11111111111", // Not: sandbox test değeri; gerçek modda profile'a KYC alanı eklenmeli.
      registrationAddress: "Bodrum",
      ip: clientIp(),
      city: "Bodrum",
      country: "Turkey",
    },
  });

  if (!checkout.success || !checkout.token) {
    return { error: checkout.error ?? "Ödeme başlatılamadı, tekrar dener misin?" };
  }

  const { data: purchase, error: insertError } = await supabase
    .from("purchases")
    .insert({
      user_id: user!.id,
      package_id: pkg.id,
      amount: pkg.sale_price,
      commission_amount: commissionAmount,
      business_payout_amount: businessPayoutAmount,
      status: "pending",
      provider_status: "pending",
      checkout_token: checkout.token,
      checkout_form_content: checkout.checkoutFormContent ?? null,
    })
    .select("id")
    .single();

  if (insertError || !purchase) {
    return { error: "Satın alma başlatılamadı: " + insertError?.message };
  }

  redirect(`/satin-alma/odeme?purchase=${purchase.id}`);
}

export async function completeTestCheckoutAction(
  formData: FormData
): Promise<{ error?: string }> {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  if (!purchaseId) return { error: "Satın alma bulunamadı." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, checkout_token, user_id, status")
    .eq("id", purchaseId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!purchase || !purchase.checkout_token) return { error: "Satın alma bulunamadı." };
  if (purchase.status !== "pending") return { error: "Bu ödeme zaten işlendi." };

  const result = await finalizeCheckout(purchase.checkout_token);
  if (!result || result.status === "failed") {
    return { error: "Ödeme tamamlanamadı." };
  }

  redirect(`/satin-alma/basarili?purchase=${result.purchaseId}`);
}

export async function requestRefundAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  if (!purchaseId) return { error: "Satın alma bulunamadı." };

  const supabase = createClient();
  const { error } = await supabase.rpc("request_refund", { p_purchase_id: purchaseId });

  if (error) {
    const [code, ...rest] = error.message.split(":");
    const message = rest.join(":").trim();
    if (code === "NOT_ELIGIBLE") return { error: "Bu satın alma iade edilemez." };
    if (code === "ALREADY_REQUESTED") return { error: "İade talebi zaten oluşturulmuş." };
    if (code === "WINDOW_EXPIRED") return { error: "İade süresi (14 gün) doldu." };
    if (code === "ALREADY_USED") {
      return { error: "Bu paketin hakları kullanılmaya başlanmış, iade edilemez." };
    }
    return { error: message || "İade talebi oluşturulamadı." };
  }

  return { success: true };
}

export async function adminApproveRefundAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  if (!purchaseId) return { error: "Satın alma bulunamadı." };

  const supabase = await requireAdminUser();
  if (!supabase) return { error: "Bu işlem için admin yetkisi gerekli." };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, amount, payment_transaction_id")
    .eq("id", purchaseId)
    .single();

  if (!purchase) return { error: "Satın alma bulunamadı." };
  if (!purchase.payment_transaction_id) return { error: "Ödeme işlem kaydı bulunamadı." };

  const refund = await refundPayment({
    paymentTransactionId: purchase.payment_transaction_id,
    price: purchase.amount,
    ip: clientIp(),
  });

  if (!refund.success) {
    return { error: refund.error ?? "iyzico iade işlemi başarısız." };
  }

  const { error } = await supabase.rpc("finalize_refund", { p_purchase_id: purchaseId });
  if (error) return { error: error.message };

  return { success: true };
}

export async function adminRejectRefundAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!purchaseId) return { error: "Satın alma bulunamadı." };

  const supabase = await requireAdminUser();
  if (!supabase) return { error: "Bu işlem için admin yetkisi gerekli." };

  const { error } = await supabase.rpc("reject_refund", {
    p_purchase_id: purchaseId,
    p_reason: reason || null,
  });

  if (error) return { error: error.message };
  return { success: true };
}
