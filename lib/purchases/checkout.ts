import { createServiceClient } from "@/lib/supabase/service";
import { retrieveCheckout } from "@/lib/iyzico/service";

export interface FinalizeResult {
  status: "completed" | "failed" | "already_processed";
  purchaseId: string;
}

// Servis rolüyle çalışır: gerçek callback iyzico'nun sunucusundan gelen bir
// POST olduğundan kullanıcı oturum çerezine güvenilmez. Güvenlik, tahmin
// edilemez checkout_token'ın kendisinden değil, iyzico'ya KENDİ gizli
// anahtarımızla geri dönüp ödeme durumunu bağımsızca doğrulamamızdan gelir.
export async function finalizeCheckout(token: string): Promise<FinalizeResult | null> {
  const supabase = createServiceClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("checkout_token", token)
    .maybeSingle();

  if (!purchase) return null;

  if (purchase.status !== "pending") {
    return {
      status: purchase.status === "completed" ? "already_processed" : "failed",
      purchaseId: purchase.id,
    };
  }

  const verification = await retrieveCheckout(token);
  const success = verification.success && verification.paymentStatus === "SUCCESS";

  // conversation_id + event_type üzerindeki benzersiz indeks, aynı callback
  // iki kez tetiklense bile ikinci log satırını sessizce engeller.
  await supabase.from("payment_events").insert({
    purchase_id: purchase.id,
    conversation_id: token,
    event_type: "checkout_callback",
    status: success ? "success" : "failed",
    raw_payload: verification as unknown as Record<string, unknown>,
  });

  if (success) {
    await supabase
      .from("purchases")
      .update({
        status: "completed",
        provider_status: "success",
        payment_transaction_id: verification.paymentTransactionId ?? null,
      })
      .eq("id", purchase.id)
      .eq("status", "pending");

    return { status: "completed", purchaseId: purchase.id };
  }

  await supabase
    .from("purchases")
    .update({ status: "failed", provider_status: "failed" })
    .eq("id", purchase.id)
    .eq("status", "pending");

  return { status: "failed", purchaseId: purchase.id };
}
