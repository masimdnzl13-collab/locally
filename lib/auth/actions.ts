"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import type { UserRole } from "@/lib/types";
import { ACTIVE_ROLE_COOKIE, getEffectiveRoles } from "@/lib/auth/roles";

function safeNext(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = (formData.get("role") === "business" ? "business" : "user") as UserRole;

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }
  // Telefon, işletmelerin QR doğrulama sonrası müşteriyi CRM'e
  // düşürebilmesi ve duyuru gönderebilmesi için müşteri hesaplarında zorunlu.
  if (role === "user" && !phone) {
    return { error: "Telefon numarası gerekli." };
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, role },
      // E-posta onay bağlantısı /auth/callback'e (PKCE code exchange) düşmezse
      // profiles satırı hiç oluşturulmaz — bkz. ensureProfile.
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session || !data.user) {
    return {
      needsEmailConfirmation: true,
      message: "Kaydını aldık! Devam etmek için e-postana gelen bağlantıya tıkla.",
    };
  }

  let profile: { id: string; role: UserRole } | null = null;
  try {
    profile = (await ensureProfile({
      id: data.user.id,
      email,
      fullName: fullName || null,
      phone: phone || null,
      requestedRole: role,
    })) as { id: string; role: UserRole };
  } catch (err) {
    return { error: "Profil oluşturulamadı: " + (err as Error).message };
  }

  if (profile?.role === "admin") redirect("/admin");
  redirect(role === "business" ? "/panel/kurulum" : "/kesfet");
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-posta veya şifre hatalı." };
  }

  // ensureProfile hem eksik profiles satırını (e-posta onayı akışındaki
  // geçmiş hatadan kalan) onarır hem de admin beyaz listesine sonradan
  // eklenmiş bir e-postanın rolünü her girişte admin'e yükseltir — bkz.
  // lib/auth/ensure-profile.ts.
  const requestedRole = (data.user.user_metadata?.role === "business"
    ? "business"
    : "user") as UserRole;
  const profile = (await ensureProfile({
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: (data.user.user_metadata?.full_name as string | undefined) || null,
    phone: (data.user.user_metadata?.phone as string | undefined) || null,
    requestedRole,
  })) as { role: UserRole; additional_roles?: UserRole[] | null };

  if (next) {
    redirect(next);
  }

  // Tek rollü hesaplar (büyük çoğunluk) için davranış birebir eskisiyle
  // aynı — hiçbir ek ekran görmezler. Yalnızca elle birden fazla rol
  // atanmış hesaplar (bkz. lib/auth/roles.ts, additional_roles) her
  // girişte /rol-sec'e düşer.
  const effectiveRoles = getEffectiveRoles({
    role: profile?.role ?? "user",
    additional_roles: profile?.additional_roles,
  });

  if (effectiveRoles.length > 1) {
    redirect("/rol-sec");
  }

  if (profile?.role === "admin") redirect("/admin");
  redirect(profile?.role === "business" ? "/panel" : "/kesfet");
}

export async function updateProfileAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, phone: phone || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Profil güncellenemedi: " + error.message };
  }

  return { success: true, message: "Bilgilerin güncellendi." };
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  cookies().delete(ACTIVE_ROLE_COOKIE);
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "E-posta gerekli." };
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/sifre-sifirla`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    message: "Şifre sıfırlama bağlantısı e-postana gönderildi.",
  };
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "Şifre en az 6 karakter olmalı." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/hesabim");
}
