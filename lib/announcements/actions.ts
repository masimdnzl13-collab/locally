"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyBusiness } from "@/lib/business/current";
import { notificationService } from "@/lib/notifications";
import { personalize } from "@/lib/announcements/templates";
import { isNightHours, startOfIstanbulDayUtcIso } from "@/lib/announcements/time";
import type { Segment } from "@/lib/customers/segments";

interface SegmentRecipient {
  full_name: string | null;
  phone: string;
  email: string | null;
}

export async function getSegmentRecipientsAction(
  formData: FormData
): Promise<{ error?: string; count?: number; recipients?: SegmentRecipient[] }> {
  const business = await getMyBusiness();
  if (!business) return { error: "İşletme bulunamadı." };

  const segment = String(formData.get("segment") ?? "tumu") as Segment;

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_segment_recipients", {
    p_business_id: business.id,
    p_segment: segment,
  });

  if (error) return { error: error.message };

  const recipients = (data ?? []) as SegmentRecipient[];
  return { count: recipients.length, recipients };
}

export async function sendAnnouncementAction(
  formData: FormData
): Promise<{ error?: string; success?: true; recipientCount?: number }> {
  const business = await getMyBusiness();
  if (!business) return { error: "İşletme bulunamadı." };

  const segment = String(formData.get("segment") ?? "tumu") as Segment;
  const channel = String(formData.get("channel") ?? "sms") as "sms" | "email";
  const content = String(formData.get("content") ?? "").trim();
  const templateKey = String(formData.get("templateKey") ?? "") || null;

  if (!content) return { error: "İçerik boş olamaz." };

  if (isNightHours()) {
    return { error: "Gece 21:00–09:00 arası duyuru gönderimi yapılamaz." };
  }

  const supabase = createClient();

  if (channel === "sms") {
    const { data: existing } = await supabase
      .from("announcements")
      .select("id")
      .eq("business_id", business.id)
      .eq("channel", "sms")
      .eq("target_segment", segment)
      .gte("created_at", startOfIstanbulDayUtcIso())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { error: "Bu segmente bugün zaten SMS gönderildi. Yarın tekrar deneyebilirsin." };
    }
  }

  const { data: recipientsData, error: recipientsError } = await supabase.rpc(
    "get_segment_recipients",
    { p_business_id: business.id, p_segment: segment }
  );

  if (recipientsError) return { error: recipientsError.message };

  const recipients = (recipientsData ?? []) as SegmentRecipient[];

  let delivered = 0;
  for (const recipient of recipients) {
    const message = personalize(content, recipient.full_name);
    if (channel === "sms") {
      if (!recipient.phone) continue;
      const result = await notificationService.sendSms({ to: recipient.phone, message });
      if (result.success) delivered++;
    } else {
      if (!recipient.email) continue;
      const result = await notificationService.sendEmail({
        to: recipient.email,
        subject: "Locally'den yeni bir duyuru",
        html: `<p>${message}</p>`,
      });
      if (result.success) delivered++;
    }
  }

  const { error: insertError } = await supabase.from("announcements").insert({
    business_id: business.id,
    channel,
    content,
    target_segment: segment,
    template_key: templateKey,
    recipient_count: delivered,
    sent_at: new Date().toISOString(),
  });

  if (insertError) return { error: "Duyuru kaydedilemedi: " + insertError.message };

  revalidatePath("/panel/duyurular");
  return { success: true, recipientCount: delivered };
}
