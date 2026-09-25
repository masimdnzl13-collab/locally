import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// /kayit/us akışında "şu anki başvuru"yu bulur. E-posta onayı açıkken
// kayıt anında oturum dönmez; ödeme adımına oturumsuz devam edilebilsin diye
// başvuru, httpOnly bir çerezdeki devam anahtarıyla da eşleşebilir (yalnızca
// sha256'sı veritabanında). Oturum varsa önce ona bakılır.

export const US_SIGNUP_COOKIE = "locally_us_signup";
// /terms sayfasında yayınlanan sözleşme sürümü (lib/us/config.ts US_TERMS_VERSION ile aynı).
export const AGREEMENT_VERSION = "2026-09-us-v1";

// awaiting_menu: ödendi + Tideline kuruldu, ama saat/menü (Brain) henüz yetersiz.
export type UsOnboardingStatus = "awaiting_payment" | "activating" | "awaiting_menu" | "active";

export interface UsSignup {
  business_id: string;
  owner_id: string;
  contact_name: string;
  contact_phone: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  status: UsOnboardingStatus;
  payment_mode: "paypal" | "stripe" | "test" | null;
  tideline_phone_number: string | null;
  tideline_phone_status: "active" | "pending_manual" | null;
  provisioning_error: string | null;
  business: {
    id: string;
    name: string;
    active_modules: string[];
    tideline_restaurant_id: string | null;
  };
}

export const US_SIGNUP_COLUMNS =
  "business_id, owner_id, contact_name, contact_phone, street_address, city, state, postal_code, status, payment_mode, tideline_phone_number, tideline_phone_status, provisioning_error, business:businesses!inner(id, name, active_modules, tideline_restaurant_id)";

export function hashResumeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newResumeToken() {
  return randomBytes(32).toString("base64url");
}

export function setResumeCookie(businessId: string, token: string) {
  cookies().set(US_SIGNUP_COOKIE, `${businessId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/kayit/us",
    maxAge: 60 * 60 * 24 * 14,
  });
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function getCurrentUsSignup(): Promise<{ signup: UsSignup; signedIn: boolean } | null> {
  const service = createServiceClient();

  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (user) {
    const { data } = await service
      .from("us_onboarding")
      .select(US_SIGNUP_COLUMNS)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { signup: data as unknown as UsSignup, signedIn: true };
  }

  const raw = cookies().get(US_SIGNUP_COOKIE)?.value;
  const [businessId, token] = raw?.split(".") ?? [];
  if (!businessId || !token || !/^[0-9a-f-]{36}$/i.test(businessId)) return null;

  const { data } = await service
    .from("us_onboarding")
    .select(`${US_SIGNUP_COLUMNS}, resume_token_hash`)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data || !sameHash((data as { resume_token_hash: string }).resume_token_hash, hashResumeToken(token))) {
    return null;
  }
  return { signup: data as unknown as UsSignup, signedIn: Boolean(user) };
}
