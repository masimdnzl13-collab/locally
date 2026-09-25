import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentService } from "@/lib/payments";
import type { PaymentWebhookEvent } from "@/lib/payments";

// ABD pazarı etkinlik bileti: PayPal Orders v2 ile tek seferlik ödeme
// (sağlayıcı lib/payments'tan gelir; önceden Stripe Checkout, mode: "payment").
// TR'deki paket satışıyla aynı mantık — platform komisyonu ödeme anında
// hesaplanıp kayda yazılır, kalan tutar işletmenin payıdır. Bilet satırları
// yalnızca burada, servis rolüyle yazılır; istemcinin ödeme alanlarına
// dokunması DB'de engelli (guard_ticket_payment trigger'ı).
//
// Akış:
//   1) startUsTicketCheckout: bilet payment_status='pending' açılır (kontenjan
//      tutulur, QR yok), payment_expires_at = +30 dk, alıcı PayPal'a gider.
//   2) Alıcı onaylar → CHECKOUT.ORDER.APPROVED webhook'u ve/veya dönüş sayfası
//      (confirmUsTicketReturn) → bilet hâlâ bekliyor ve 30 dk dolmadıysa ödeme
//      tahsil edilir (capture). Süresi dolmuş bilet için para HİÇ çekilmez.
//   3) Tahsilat tamam → 'paid'; QR kodu DB trigger'ında atanır.
//   4) 30 dk içinde onay gelmeyen bilet 'expired' olur, kontenjan boşalır
//      (expireStaleTicketPayments: yeni ödeme başlarken + günlük iş).
export const US_TICKET_COMMISSION_RATE = Number(process.env.US_TICKET_COMMISSION_RATE ?? "0.10");
const US_TICKET_CURRENCY = "usd";
export const TICKET_PAYMENT_WINDOW_MS = 30 * 60 * 1000;
// Süre dolduğu anda tahsilatı süren bir onayla yarışmamak için bilet biraz
// daha geç serbest bırakılır; tahsilat ise tam süre sonunda kesilir.
const EXPIRY_GRACE_MS = 5 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ticketCommission(price: number) {
  const commissionAmount = round2(price * US_TICKET_COMMISSION_RATE);
  return { commissionAmount, businessPayoutAmount: round2(price - commissionAmount) };
}

function friendlyError(message: string) {
  if (message.includes("EVENT_FULL")) return "Kontenjan doldu.";
  if (message.includes("idx_tickets_event_user_active") || message.includes("duplicate key")) {
    return "Bu etkinliğe zaten kayıtlısın.";
  }
  return "Ödeme başlatılamadı, tekrar dener misin?";
}

/**
 * Onay süresi (30 dk) dolmuş bekleyen biletleri düşürür, kontenjanı açar.
 * eventId verilirse yalnızca o etkinlik. Tahsilat süresi dolan bilete asla
 * yapılmadığından (bkz. captureApprovedTicket) düşen bilet için para çekilmez.
 */
export async function expireStaleTicketPayments(eventId?: string, now = new Date()): Promise<number> {
  let query = createServiceClient()
    .from("tickets")
    .update({ status: "cancelled", payment_status: "expired" })
    .eq("payment_status", "pending")
    .lt("payment_expires_at", new Date(now.getTime() - EXPIRY_GRACE_MS).toISOString());
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Bekleyen (pending) bir bilet açar, kontenjanı tutar ve ödeme sayfasının
 * adresini döner. Aynı kullanıcının aynı etkinlik için yarım kalmış önceki
 * ödemesi varsa o bilet düşürülür (onaylansa da tahsil edilmez — iki kez
 * ödeme alınmasın).
 */
export async function startUsTicketCheckout(input: {
  eventId: string;
  eventTitle: string;
  ticketPrice: number;
  userId: string;
  userEmail?: string;
  siteUrl: string;
}): Promise<{ checkoutUrl: string } | { error: string }> {
  const supabase = createServiceClient();
  const payments = getPaymentService("US");

  // Terk edilmiş ödemelerin tuttuğu kontenjan önce boşalsın.
  try {
    await expireStaleTicketPayments(input.eventId);
  } catch (err) {
    console.error("[ticket-payment] stale expiry", input.eventId, (err as Error).message);
  }

  const { data: previous } = await supabase
    .from("tickets")
    .select("id, provider_session_id")
    .eq("event_id", input.eventId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("payment_status", "pending")
    .maybeSingle();
  if (previous) {
    await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", previous.id)
      .eq("payment_status", "pending");
    if (previous.provider_session_id) await payments.expireOneTimeCheckout(previous.provider_session_id);
  }

  const { commissionAmount, businessPayoutAmount } = ticketCommission(input.ticketPrice);
  const { data: ticket, error: insertError } = await supabase
    .from("tickets")
    .insert({
      event_id: input.eventId,
      user_id: input.userId,
      status: "active",
      price_paid: input.ticketPrice,
      payment_status: "pending",
      payment_provider: payments.provider,
      payment_expires_at: new Date(Date.now() + TICKET_PAYMENT_WINDOW_MS).toISOString(),
      currency: US_TICKET_CURRENCY,
      commission_amount: commissionAmount,
      business_payout_amount: businessPayoutAmount,
    })
    .select("id")
    .single();
  if (insertError || !ticket) return { error: friendlyError(insertError?.message ?? "") };

  const checkout = await payments.createOneTimeCheckout({
    reference: { kind: "event_ticket", id: ticket.id },
    amount: input.ticketPrice,
    currency: US_TICKET_CURRENCY,
    description: `Ticket: ${input.eventTitle}`.slice(0, 250),
    customerEmail: input.userEmail,
    successUrl: `${input.siteUrl}/etkinlik/${input.eventId}/bilet-hazir?ticket=${ticket.id}`,
    cancelUrl: `${input.siteUrl}/etkinlik/${input.eventId}?odeme=iptal`,
    metadata: {
      event_id: input.eventId,
      commission_amount: commissionAmount.toFixed(2),
      business_payout_amount: businessPayoutAmount.toFixed(2),
    },
  });

  if (!checkout.success) {
    await supabase.from("tickets").update({ status: "cancelled", payment_status: "failed" }).eq("id", ticket.id);
    return { error: checkout.error };
  }

  await supabase.from("tickets").update({ provider_session_id: checkout.sessionId }).eq("id", ticket.id);

  // Sağlayıcı yapılandırılmamışken (yerel geliştirme) webhook gelmez: ödeme
  // simüle edilip bilet hemen onaylanır, tıpkı abonelik test modu gibi.
  if (checkout.simulated) {
    await markTicketPaid(ticket.id, { sessionId: checkout.sessionId, paymentId: checkout.sessionId });
  }

  return { checkoutUrl: checkout.checkoutUrl };
}

async function markTicketPaid(ticketId: string, ref: { sessionId: string; paymentId: string | null }) {
  const { data } = await createServiceClient()
    .from("tickets")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      provider_session_id: ref.sessionId,
      provider_payment_id: ref.paymentId,
    })
    .eq("id", ticketId)
    .eq("payment_status", "pending")
    .select("id");
  return (data?.length ?? 0) > 0;
}

interface PendingTicket {
  id: string;
  payment_status: string;
  provider_session_id: string | null;
  payment_expires_at: string | null;
}

/**
 * Alıcının onayladığı ödemeyi tahsil eder — yalnızca bilet hâlâ bu ödeme
 * oturumu için bekliyorsa ve 30 dakikalık süre dolmadıysa. Webhook
 * (CHECKOUT.ORDER.APPROVED) ve dönüş sayfası aynı anda çağırabilir; sağlayıcı
 * tahsilatı idempotent (aynı sipariş ikinci kez çekilmez).
 */
async function captureApprovedTicket(ticket: PendingTicket, sessionId: string, now = new Date()): Promise<void> {
  const supabase = createServiceClient();
  if (ticket.payment_status !== "pending" || ticket.provider_session_id !== sessionId) {
    // Düşürülmüş/yenilenmiş bilet: para çekilmez, PayPal onayı kendiliğinden düşer.
    return;
  }
  if (ticket.payment_expires_at && new Date(ticket.payment_expires_at) < now) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", ticket.id)
      .eq("payment_status", "pending");
    if (error) throw new Error(error.message);
    return;
  }

  const capture = await getPaymentService("US").captureOneTimeCheckout(sessionId);
  // Geçici hata: fırlatılır ki webhook yeniden denensin.
  if (!capture.success) throw new Error(capture.error);
  if (!capture.paid) {
    // paymentId varsa tahsilat PayPal'da beklemede (ör. inceleme):
    // PAYMENT.CAPTURE.COMPLETED gelince tamamlanır. Yoksa ödeme reddedildi.
    if (!capture.paymentId) {
      await supabase
        .from("tickets")
        .update({ status: "cancelled", payment_status: "failed" })
        .eq("id", ticket.id)
        .eq("payment_status", "pending");
    }
    return;
  }
  await applyCompletedPayment(ticket.id, {
    sessionId,
    paymentId: capture.paymentId,
    amount: capture.amount,
    currency: capture.currency,
  });
}

/**
 * Dönüş sayfası (bilet-hazir): PayPal alıcıyı ?token=<sipariş id> ile geri
 * gönderir. Webhook'u beklemeden tahsil etmeyi dener ki QR hemen görünsün.
 * Hata kullanıcıyı tıkamaz — sayfa "onaylanıyor" gösterip yenilenir, webhook
 * işi tamamlar.
 */
export async function confirmUsTicketReturn(ticketId: string, orderToken: string): Promise<void> {
  try {
    const { data: ticket } = await createServiceClient()
      .from("tickets")
      .select("id, payment_status, provider_session_id, payment_expires_at")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket || ticket.provider_session_id !== orderToken) return;
    await captureApprovedTicket(ticket as PendingTicket, orderToken);
  } catch (err) {
    console.error("[ticket-payment] return capture", ticketId, (err as Error).message);
  }
}

async function applyCompletedPayment(
  ticketId: string,
  payment: { sessionId: string; paymentId: string | null; amount: number; currency: string }
): Promise<void> {
  const supabase = createServiceClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, price_paid, currency, payment_status, provider_session_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) {
    console.error("[ticket-payment] bilet yok, elle iade gerekebilir", ticketId, payment.sessionId);
    return;
  }
  if (ticket.payment_status === "paid") return;

  const expected = Math.round(Number(ticket.price_paid) * 100);
  const charged = Math.round(payment.amount * 100);
  if (expected !== charged || (ticket.currency ?? US_TICKET_CURRENCY) !== payment.currency.toLowerCase()) {
    await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "failed", provider_payment_id: payment.paymentId })
      .eq("id", ticketId);
    console.error("[ticket-payment] tutar uyuşmuyor, elle iade gerekli", ticketId, { expected, charged });
    return;
  }

  const paid = await markTicketPaid(ticketId, { sessionId: payment.sessionId, paymentId: payment.paymentId });
  if (!paid) {
    // Süre dolup bilet serbest bırakıldıktan sonra tamamlanan ödeme.
    console.error("[ticket-payment] bekleyen bilet değil, elle iade gerekli", ticketId, ticket.payment_status);
  }
}

/**
 * Webhook'tan gelen tek seferlik ödeme olayını bilete yansıtır.
 * Kalıcı bir tutarsızlıkta (bilet yok, tutar uyuşmuyor) hata FIRLATMAZ —
 * sağlayıcının yeniden denemesi bir şey düzeltmez; loglanır, elle iade
 * gerekir. Geçici DB/sağlayıcı hataları fırlatılır ki tekrar denensin.
 */
export async function applyTicketPaymentEvent(
  event: Extract<PaymentWebhookEvent, { type: "one_time.completed" | "one_time.expired" | "one_time.approved" }>
): Promise<void> {
  if (event.reference.kind !== "event_ticket") return;
  const supabase = createServiceClient();
  const ticketId = event.reference.id;

  if (event.type === "one_time.expired") {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", ticketId)
      .eq("payment_status", "pending");
    if (error) throw new Error(error.message);
    return;
  }

  if (event.type === "one_time.approved") {
    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("id, payment_status, provider_session_id, payment_expires_at")
      .eq("id", ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) {
      console.error("[ticket-payment] onaylanan bilet yok, tahsil edilmedi", ticketId, event.sessionId);
      return;
    }
    await captureApprovedTicket(ticket as PendingTicket, event.sessionId);
    return;
  }

  // completed ama paid değilse (tahsilat beklemede/reddedildi) ödeme alınmamıştır.
  if (!event.paid) return;
  await applyCompletedPayment(ticketId, event);
}
