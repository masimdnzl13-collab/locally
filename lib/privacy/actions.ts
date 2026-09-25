"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { notificationService } from "@/lib/notifications/service";
import { US_SUPPORT_EMAIL } from "@/lib/us/config";

// AO — /privacy formundan gelen silme / erişim talepleri. Otomatik silme yok:
// talep public.privacy_requests'e yazılır ve /admin/gizlilik-talepleri
// kuyruğunda görünür. Destek adresi tanımlıysa ayrıca e-posta bildirimi
// gider (en iyi çaba; gitmese de talep kayıtlı).

// Görünmez tuzak alanı (bkz. components/us/privacy-request-form.tsx).
const HONEYPOT_FIELD = "company_website";

export type PrivacyRequestResult = { ok: true } | { error: string };

const field = (fd: FormData, name: string, max: number) => String(fd.get(name) ?? "").trim().slice(0, max);
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function submitPrivacyRequestAction(formData: FormData): Promise<PrivacyRequestResult> {
  // Bot: kayıt yok, başarılı gibi dön (hata mesajı alanı atlamayı öğretir).
  if (field(formData, HONEYPOT_FIELD, 200)) return { ok: true };

  const limited = await rateLimit("privacyRequest", clientIp(headers()));
  if (!limited.ok) return { error: `Too many requests. Please try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minutes.` };

  const requestType = field(formData, "requestType", 10);
  const requesterType = field(formData, "requesterType", 10);
  const fullName = field(formData, "fullName", 120);
  const email = field(formData, "email", 254).toLowerCase();
  const phone = field(formData, "phone", 32);
  const businessName = field(formData, "businessName", 160);
  const details = field(formData, "details", 2000);

  if (requestType !== "delete" && requestType !== "access") return { error: "Please choose what you'd like us to do." };
  if (!["merchant", "caller", "other"].includes(requesterType)) return { error: "Please tell us who you are." };
  if (!fullName) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address so we can reply." };
  if (requesterType === "caller" && !phone) {
    return { error: "Please enter the phone number you called from — it's how we find your records." };
  }
  if (requesterType === "merchant" && !businessName) return { error: "Please enter your restaurant's name." };

  const { data, error } = await createServiceClient()
    .from("privacy_requests")
    .insert({
      request_type: requestType,
      requester_type: requesterType,
      full_name: fullName,
      email,
      phone: phone || null,
      business_name: businessName || null,
      details: details || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[privacy-request] kaydedilemedi:", error?.message);
    return {
      error: US_SUPPORT_EMAIL
        ? `We couldn't submit your request. Please try again, or email ${US_SUPPORT_EMAIL}.`
        : "We couldn't submit your request. Please try again in a few minutes.",
    };
  }

  const notifyTo = process.env.PRIVACY_REQUESTS_EMAIL || US_SUPPORT_EMAIL;
  if (notifyTo) {
    const kind = requestType === "delete" ? "deletion" : "access";
    await notificationService
      .sendEmail({
        to: notifyTo,
        subject: `New privacy ${kind} request (${requesterType})`,
        html:
          `<p>A new privacy ${kind} request was submitted and is waiting in /admin/gizlilik-talepleri ` +
          `(reference ${escapeHtml(data.id)}). Respond within 45 days.</p>` +
          `<p>From: ${escapeHtml(fullName)} &lt;${escapeHtml(email)}&gt;</p>`,
      })
      .catch(() => undefined);
  }

  return { ok: true };
}
