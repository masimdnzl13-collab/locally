import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentService } from "@/lib/payments";
import type { PaymentWebhookEvent } from "@/lib/payments";

// ABD pazarı etkinlik bileti: sağlayıcının barındırdığı ödeme sayfasıyla tek
// seferlik ödeme (şu an PayPal Orders; Stripe Checkout da aynı arayüzle
// çalışır). TR'deki paket satışıyla aynı mantık — platform komisyonu ödeme
// anında hesaplanıp kayda yazılır, kalan tutar işletmenin payıdır. Bilet
// satırları yalnızca burada, servis rolüyle yazılır; istemcinin ödeme
// alanlarına dokunması DB'de engelli (guard_ticket_payment trigger'ı). QR kodu
// yalnızca payment_status='paid' olunca DB trigger'ı atar.
//
// Kurallar:
//   * Bekleyen bilet kontenjanı en fazla PENDING_TICKET_MINUTES (30 dk) tutar.
//   * PayPal'da para ancak sunucu "capture" edince alınır; capture yalnızca
//     bilet hâlâ bekliyor ve 30 dakikayı geçmemişse yapılır — geç kalan onay
//     hiç tahsil edilmez (iade gerekmez).
export const US_TICKET_COMMISSION_RATE = Number(process.env.US_TICKET_COMMISSION_RATE ?? "0.10");
const US_TICKET_CURRENCY = "usd";

export const PENDING_TICKET_MINUTES = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;
const pendingCutoff = (now = new Date()) => new Date(now.getTime() - PENDING_TICKET_MINUTES * 60_000).toISOString();

/**
 * Süresi dolmuş bekleyen biletleri bırakır (kontenjan geri açılır). Stripe'ta
 * bunu oturumun kendi süresi yapıyordu; PayPal siparişlerinin 30 dakikalık
 * süresi yok, bu yüzden yeni bir ödeme başlarken ve onay gelince çağrılır.
 */
export async function expireStalePendingTickets(eventId?: string) {
  let query = createServiceClient()
    .from("tickets")
    .update({ status: "cancelled", payment_status: "expired" })
    .eq("payment_status", "pending")
    .lt("created_at", pendingCutoff());
  if (eventId) query = query.eq("event_id", eventId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

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
 * Bekleyen (pending) bir bilet açar, kontenjanı tutar ve sağlayıcının ödeme
 * sayfasının adresini döner. Aynı kullanıcının aynı etkinlik için yarım kalmış
 * önceki ödemesi varsa o oturum kapatılır (iki kez ödeme alınmasın).
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
  const provider = getPaymentService("US");
  // Önce süresi dolmuş bekleyen biletler kontenjanı bıraksın.
  await expireStalePendingTickets(input.eventId);

  const { data: previous } = await supabase
    .from("tickets")
    .select("id, provider_session_id")
    .eq("event_id", input.eventId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .eq("payment_status", "pending")
    .maybeSingle();
  if (previous) {
    if (previous.provider_session_id) await provider.expireOneTimeCheckout(previous.provider_session_id);
    await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", previous.id)
      .eq("payment_status", "pending");
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
      payment_provider: provider.provider,
      currency: US_TICKET_CURRENCY,
      commission_amount: commissionAmount,
      business_payout_amount: businessPayoutAmount,
    })
    .select("id")
    .single();
  if (insertError || !ticket) return { error: friendlyError(insertError?.message ?? "") };

  const checkout = await provider.createOneTimeCheckout({
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

  // Sağlayıcı anahtarları yokken (yerel geliştirme) webhook gelmez: ödeme
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

/**
 * Ödeyen onayladıktan sonra ödemeyi kesinleştirir (PayPal: capture). İki
 * yerden çağrılır: ödeme dönüş sayfası (bilet-hazir, ?token=<sipariş>) ve
 * CHECKOUT.ORDER.APPROVED webhook'u (kullanıcı sekmeyi kapattıysa). Bilet,
 * URL'deki kimlikle değil sipariş kimliğiyle (provider_session_id) bulunur;
 * capture PayPal-Request-Id ile idempotent olduğundan iki çağrı çift tahsilat
 * yaratmaz.
 */
export async function confirmUsTicketPayment(orderId: string): Promise<"paid" | "pending" | "expired" | "failed" | "not_found"> {
  const supabase = createServiceClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, payment_status, created_at")
    .eq("provider_session_id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) return "not_found";
  if (ticket.payment_status === "paid") return "paid";
  if (ticket.payment_status !== "pending") return ticket.payment_status === "failed" ? "failed" : "expired";

  if (new Date(ticket.created_at as string) < new Date(pendingCutoff())) {
    // 30 dakika geçti: onay gelse de tahsil etme, kontenjanı bırak.
    await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", ticket.id)
      .eq("payment_status", "pending");
    return "expired";
  }

  const result = await getPaymentService("US").confirmOneTimeCheckout(orderId, { kind: "event_ticket", id: ticket.id });
  if (result.status === "completed") {
    await applyTicketPaymentEvent(result.event);
    return result.event.paid ? "paid" : "pending";
  }
  if (result.status === "failed") {
    console.error("[ticket-payment] capture başarısız", ticket.id, result.error);
    return "failed";
  }
  return "pending";
}

/**
 * Webhook'tan gelen tek seferlik ödeme olayını bilete yansıtır.
 * Kalıcı bir tutarsızlıkta (bilet yok, tutar uyuşmuyor) hata FIRLATMAZ —
 * Stripe'ın sonsuz yeniden denemesi bir şey düzeltmez; loglanır, elle iade
 * gerekir. Geçici DB hataları fırlatılır ki Stripe tekrar denesin.
 */
export async function applyTicketPaymentEvent(
  event: Extract<PaymentWebhookEvent, { type: "one_time.completed" | "one_time.expired" | "one_time.approved" }>
): Promise<void> {
  if (event.reference.kind !== "event_ticket") return;
  const supabase = createServiceClient();
  const ticketId = event.reference.id;

  if (event.type === "one_time.approved") {
    // Ödeyen onayladı ama dönüş sayfasına gelmemiş olabilir: sunucu tahsil eder.
    const outcome = await confirmUsTicketPayment(event.sessionId);
    if (outcome === "failed") throw new Error(`capture failed for ${event.sessionId}`);
    return;
  }

  if (event.type === "one_time.expired") {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "expired" })
      .eq("id", ticketId)
      .eq("payment_status", "pending");
    if (error) throw new Error(error.message);
    return;
  }

  // completed ama paid değilse (ör. PayPal capture beklemede) ödeme alınmamıştır.
  if (!event.paid) return;

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, price_paid, currency, payment_status, provider_session_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ticket) {
    console.error("[ticket-payment] bilet yok, elle iade gerekebilir", ticketId, event.sessionId);
    return;
  }
  if (ticket.payment_status === "paid") return;

  const expected = Math.round(Number(ticket.price_paid) * 100);
  const charged = Math.round(event.amount * 100);
  if (expected !== charged || (ticket.currency ?? US_TICKET_CURRENCY) !== event.currency.toLowerCase()) {
    await supabase
      .from("tickets")
      .update({ status: "cancelled", payment_status: "failed", provider_payment_id: event.paymentId })
      .eq("id", ticketId);
    console.error("[ticket-payment] tutar uyuşmuyor, elle iade gerekli", ticketId, { expected, charged });
    return;
  }

  const paid = await markTicketPaid(ticketId, { sessionId: event.sessionId, paymentId: event.paymentId });
  if (!paid) {
    // Oturum süresi dolup bilet serbest bırakıldıktan sonra gelen ödeme.
    console.error("[ticket-payment] bekleyen bilet değil, elle iade gerekli", ticketId, ticket.payment_status);
  }
}
