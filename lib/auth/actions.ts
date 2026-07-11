"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

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
  const role = (formData.get("role") === "business" ? "business" : "user") as UserRole;

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
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

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName || null,
    role,
  });

  if (profileError && profileError.code !== "23505") {
    return { error: "Profil oluşturulamadı: " + profileError.message };
  }

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

  if (next) {
    redirect(next);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(profile?.role === "business" ? "/panel" : "/kesfet");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
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
