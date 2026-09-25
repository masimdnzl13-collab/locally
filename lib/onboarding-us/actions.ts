"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { uniqueSlug } from "@/lib/business/slug";
import { startBusinessSubscription } from "@/lib/billing/subscriptions";
import { getPaymentService } from "@/lib/payments";
import { US_STATES } from "@/lib/onboarding-us/us-states";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import {
  AGREEMENT_VERSION,
  getCurrentUsSignup,
  hashResumeToken,
  newResumeToken,
  setResumeCookie,
} from "@/lib/onboarding-us/signup";

const MIN_PASSWORD_LENGTH = 8;
// Görünmez tuzak alanı (bkz. us-signup-form.tsx): insanlar görmez, basit botlar doldurur.
const HONEYPOT_FIELD = "company_website";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

// (415) 555-0199, 415-555-0199, +1 415 555 0199 → +14155550199
function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+1${national}` : null;
}

// P6 — ABD restoranları için self-servis kayıt, 1. adım: hesap + işletme.
// businesses satırı burada market='US', active_modules='{}' olarak oluşur
// (Stripe Checkout işletme kimliğiyle açıldığı için ödemeden önce var olmalı);
// tideline modülü ödeme tamamlanınca açılır (bkz. lib/onboarding-us/complete.ts).
// market/active_modules'ü yalnızca servis rolü yazabildiği için (guard
// trigger) insert servis istemcisiyle yapılır.
export async function startUsSignupAction(formData: FormData): Promise<{ error: string } | void> {
  // Bot: hiçbir şey oluşturmadan, başarılı gibi görünen boş bir akışa düşür
  // (hata mesajı vermek botun alanı atlamayı öğrenmesini kolaylaştırır).
  if (field(formData, HONEYPOT_FIELD)) redirect("/kayit/us");

  const limited = await rateLimit("usSignup", clientIp(headers()));
  if (!limited.ok) {
    return { error: `Too many attempts. Please try again in ${limited.retryAfterSeconds} seconds.` };
  }

  const businessName = field(formData, "businessName");
  const contactName = field(formData, "contactName");
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phone = normalizeUsPhone(field(formData, "phone"));
  const street = field(formData, "street");
  const city = field(formData, "city");
  const state = field(formData, "state").toUpperCase();
  const postalCode = field(formData, "postalCode");
  const agreed = formData.get("agreement") === "on";

  if (!businessName || !contactName || !email || !street || !city) {
    return { error: "Please fill in all required fields." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (!phone) return { error: "Please enter a valid US phone number." };
  if (!US_STATES.some((s) => s.code === state)) return { error: "Please select a state." };
  if (!/^\d{5}(-\d{4})?$/.test(postalCode)) return { error: "Please enter a valid ZIP code." };
  if (!agreed) return { error: "You need to accept the Locally Terms & Merchant Agreement to continue." };

  const supabase = createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    return { error: "You're already signed in. Sign out first to register a new restaurant." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // business_name bilerek YOK: /auth/callback onu görürse bir TR
      // işletmesi oluşturur (bkz. ensureBusinessForOwner). ABD işletmesi
      // aşağıda, bu action'da oluşuyor.
      data: { full_name: contactName, phone, role: "business", signup_market: "US" },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/kayit/us/durum`,
    },
  });
  if (error) return { error: error.message };
  // E-posta onayı açıkken zaten kayıtlı bir adres hata vermez, kimliği
  // olmayan sahte bir kullanıcı döner.
  if (!data.user || data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Please sign in instead." };
  }

  try {
    await ensureProfile({ id: data.user.id, email, fullName: contactName, phone, requestedRole: "business" });
  } catch (err) {
    return { error: "Could not create your profile: " + (err as Error).message };
  }

  const service = createServiceClient();
  const { data: business, error: businessError } = await service
    .from("businesses")
    .insert({
      owner_id: data.user.id,
      name: businessName,
      slug: uniqueSlug(businessName),
      category: "restoran",
      city,
      address: `${street}, ${city}, ${state} ${postalCode}`,
      phone,
      market: "US",
      active_modules: [],
    })
    .select("id")
    .single();
  if (businessError || !business) {
    return { error: "Could not create your restaurant: " + (businessError?.message ?? "unknown error") };
  }

  const token = newResumeToken();
  const { error: onboardingError } = await service.from("us_onboarding").insert({
    business_id: business.id,
    owner_id: data.user.id,
    contact_name: contactName,
    contact_phone: phone,
    street_address: street,
    city,
    state,
    postal_code: postalCode,
    agreement_version: AGREEMENT_VERSION,
    agreement_accepted_at: new Date().toISOString(),
    resume_token_hash: hashResumeToken(token),
  });
  if (onboardingError) {
    await service.from("businesses").delete().eq("id", business.id);
    return { error: "Could not save your registration: " + onboardingError.message };
  }

  setResumeCookie(business.id, token);
  redirect("/kayit/us/odeme");
}

// 2. adım: ödeme. ABD sağlayıcısı (PayPal) Billing Plan'ına abonelik; kullanıcı
// PayPal'ın onay sayfasına gider. PAYPAL_CLIENT_ID/SECRET yoksa sağlayıcı
// ödemeyi simüle eder ve doğrudan dönüş sayfasına (?simulated=1) yönlendirir
// (test modu).
export async function startUsCheckoutAction(): Promise<{ error: string } | void> {
  const current = await getCurrentUsSignup();
  if (!current) return { error: "We couldn't find your registration. Please start again." };
  const { signup } = current;
  if (signup.status !== "awaiting_payment") redirect("/kayit/us/durum");

  const configured = getPaymentService("US").isConfigured();
  const planId = process.env.PAYPAL_US_PLAN_ID;
  if (configured && !planId) {
    return { error: "Payments are not fully configured yet (PAYPAL_US_PLAN_ID). Please try again later." };
  }

  const { data: owner } = await createServiceClient().auth.admin.getUserById(signup.owner_id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const result = await startBusinessSubscription({
    businessId: signup.business_id,
    priceId: planId ?? "plan_test_mode",
    customerEmail: owner?.user?.email ?? undefined,
    successUrl: `${siteUrl}/kayit/us/durum?returned=1`,
    cancelUrl: `${siteUrl}/kayit/us/odeme?canceled=1`,
  });
  if (!result.success) return { error: result.error };

  redirect(result.checkoutUrl);
}
