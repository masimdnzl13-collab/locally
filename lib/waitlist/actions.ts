"use server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlistAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { error: "Geçerli bir e-posta adresi gir." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("founder_waitlist").insert({ email });

  // 23505: benzersizlik ihlali — e-posta zaten listede. Bu durumda da
  // kullanıcıya başarı mesajı gösteriyoruz; sonuçta amaç zaten sağlanmış.
  if (error && error.code !== "23505") {
    return { error: "Bir şeyler ters gitti, tekrar dener misin?" };
  }

  return { success: true, message: "Listedesin! Lansmanı ilk sen duyacaksın." };
}
