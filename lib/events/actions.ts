"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentService } from "@/lib/payments";
import { getMyBusiness } from "@/lib/business/current";

async function requireBusiness() {
  const business = await getMyBusiness();
  if (!business) redirect("/panel/kurulum");
  return business!;
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

interface EventInput {
  title: string;
  description: string | null;
  event_at: string;
  is_paid: boolean;
  ticket_price: number | null;
  capacity: number | null;
}

function parseEventForm(formData: FormData): { input?: EventInput; error?: string } {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const eventAtRaw = String(formData.get("event_at") ?? "");
  const eventType = String(formData.get("event_type") ?? "free");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const ticketPriceRaw = String(formData.get("ticket_price") ?? "").trim();

  if (!title) return { error: "Başlık zorunlu." };
  if (!eventAtRaw) return { error: "Tarih ve saat zorunlu." };

  const eventAt = new Date(eventAtRaw);
  if (Number.isNaN(eventAt.getTime())) return { error: "Geçersiz tarih." };

  const isPaid = eventType === "paid";

  let capacity: number | null = null;
  if (capacityRaw) {
    capacity = Number(capacityRaw);
    if (!Number.isFinite(capacity) || capacity < 0) {
      return { error: "Kontenjan geçerli olmalı." };
    }
  }

  let ticketPrice: number | null = null;
  if (isPaid) {
    if (!ticketPriceRaw) return { error: "Biletli etkinlikte bilet fiyatı zorunlu." };
    ticketPrice = Number(ticketPriceRaw);
    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      return { error: "Bilet fiyatı geçerli olmalı." };
    }
    if (capacity === null) return { error: "Biletli etkinlikte kontenjan zorunlu." };
  }

  return {
    input: {
      title,
      description: description || null,
      event_at: eventAt.toISOString(),
      is_paid: isPaid,
      ticket_price: ticketPrice,
      capacity,
    },
  };
}

async function resolveEventImageUrl(
  formData: FormData,
  ownerId: string,
  fallbackUrl: string | null
): Promise<{ url: string | null; error?: string }> {
  const image = formData.get("image") as File | null;
  if (!image || image.size === 0) return { url: fallbackUrl };

  const supabase = createClient();
  const path = `${ownerId}/events/${Date.now()}.${extFromFile(image)}`;
  const { error } = await supabase.storage
    .from("business-images")
    .upload(path, image, { upsert: true, contentType: image.type });

  if (error) return { url: null, error: "Görsel yüklenemedi: " + error.message };

  const { data } = supabase.storage.from("business-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function createEventAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await requireBusiness();
  const { input, error } = parseEventForm(formData);
  if (error || !input) return { error };

  if (new Date(input.event_at) < new Date()) {
    return { error: "Etkinlik tarihi gelecekte olmalı." };
  }

  const { url, error: imageError } = await resolveEventImageUrl(
    formData,
    business.owner_id,
    null
  );
  if (imageError) return { error: imageError };

  const supabase = createClient();
  const { error: insertError } = await supabase.from("events").insert({
    business_id: business.id,
    title: input.title,
    description: input.description,
    image_url: url,
    event_at: input.event_at,
    is_paid: input.is_paid,
    ticket_price: input.ticket_price,
    capacity: input.capacity,
  });

  if (insertError) return { error: "Etkinlik oluşturulamadı: " + insertError.message };

  revalidatePath("/panel/etkinlikler");
  revalidatePath("/etkinlikler");
  redirect("/panel/etkinlikler");
}

export async function updateEventAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await requireBusiness();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Etkinlik bulunamadı." };

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("events")
    .select("id, event_at, image_url")
    .eq("id", eventId)
    .eq("business_id", business.id)
    .single();

  if (!existing) return { error: "Etkinlik bulunamadı." };

  const { input, error } = parseEventForm(formData);
  if (error || !input) return { error };

  const started = new Date(existing.event_at) < new Date();
  const dateChanged = new Date(input.event_at).getTime() !== new Date(existing.event_at).getTime();
  if (started && dateChanged) {
    return { error: "Başlamış etkinliğin tarihi değiştirilemez." };
  }

  const { url, error: imageError } = await resolveEventImageUrl(
    formData,
    business.owner_id,
    existing.image_url
  );
  if (imageError) return { error: imageError };

  const { error: updateError } = await supabase
    .from("events")
    .update({
      title: input.title,
      description: input.description,
      image_url: url,
      event_at: started ? existing.event_at : input.event_at,
      is_paid: input.is_paid,
      ticket_price: input.ticket_price,
      capacity: input.capacity,
    })
    .eq("id", eventId)
    .eq("business_id", business.id);

  if (updateError) return { error: "Kaydedilemedi: " + updateError.message };

  revalidatePath("/panel/etkinlikler");
  revalidatePath(`/panel/etkinlikler/${eventId}`);
  revalidatePath("/etkinlikler");
  redirect("/panel/etkinlikler");
}

export async function cancelEventAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const business = await requireBusiness();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Etkinlik bulunamadı." };

  const supabase = createClient();

  const { error: eventError } = await supabase
    .from("events")
    .update({ is_cancelled: true })
    .eq("id", eventId)
    .eq("business_id", business.id);

  if (eventError) return { error: eventError.message };

  const { error: freeTicketsError } = await supabase
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("event_id", eventId)
    .eq("status", "active")
    .or("price_paid.is.null,price_paid.eq.0");

  if (freeTicketsError) return { error: freeTicketsError.message };

  const { error: paidTicketsError } = await supabase
    .from("tickets")
    .update({ status: "cancelled", refund_status: "iade_sureci_baslatildi" })
    .eq("event_id", eventId)
    .eq("status", "active")
    .gt("price_paid", 0);

  if (paidTicketsError) return { error: paidTicketsError.message };

  revalidatePath("/panel/etkinlikler");
  revalidatePath(`/panel/etkinlikler/${eventId}`);
  revalidatePath("/etkinlikler");
  revalidatePath("/hesabim/paketlerim");
  return { success: true };
}

function friendlyTicketError(message: string) {
  if (message.includes("EVENT_FULL")) return "Kontenjan doldu.";
  if (message.includes("idx_tickets_event_user_active") || message.includes("duplicate key")) {
    return "Bu etkinliğe zaten kayıtlısın.";
  }
  return "Kayıt oluşturulamadı, tekrar dener misin?";
}

export async function registerFreeEventAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Etkinlik bulunamadı." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/giris?next=/etkinlik/${eventId}`);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("is_paid, event_at")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return { error: "Etkinlik bulunamadı." };
  if (event.is_paid) return { error: "Bu etkinlik biletli." };
  if (new Date(event.event_at) < new Date()) return { error: "Bu etkinlik geçti." };

  const { error } = await supabase.from("tickets").insert({
    event_id: eventId,
    user_id: user.id,
    status: "active",
    price_paid: 0,
  });

  if (error) return { error: friendlyTicketError(error.message) };

  return { success: true };
}

export async function purchaseEventTicketAction(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { error: "Etkinlik bulunamadı." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/giris?next=/etkinlik/${eventId}`);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("is_paid, ticket_price, event_at")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return { error: "Etkinlik bulunamadı." };
  if (!event.is_paid || !event.ticket_price) return { error: "Bu etkinlik ücretsiz." };
  if (new Date(event.event_at) < new Date()) return { error: "Bu etkinlik geçti." };

  const charge = await paymentService.charge({
    amount: event.ticket_price,
    userId: user.id,
    packageId: eventId,
  });

  if (!charge.success) {
    return { error: charge.error ?? "Ödeme alınamadı, tekrar dener misin?" };
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      event_id: eventId,
      user_id: user.id,
      status: "active",
      price_paid: event.ticket_price,
    })
    .select("id")
    .single();

  if (error || !ticket) return { error: friendlyTicketError(error?.message ?? "") };

  redirect(`/etkinlik/${eventId}/bilet-hazir?ticket=${ticket.id}`);
}
