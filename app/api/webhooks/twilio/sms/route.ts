import { smsKeyword, type SmsKeyword } from "@/lib/notifications/sms-keywords";
import { recordSmsConsent } from "@/lib/notifications/sms-opt-out";
import { validTwilioSignature } from "@/lib/notifications/twilio-signature";
import { US_SUPPORT_EMAIL } from "@/lib/us/config";

export const dynamic = "force-dynamic";

// AM — Locally'nin Twilio numarasına (TWILIO_FROM_NUMBER) gelen SMS'ler.
// Twilio Console → Phone Numbers → numara → Messaging → "A message comes in":
// Webhook, HTTP POST, https://<domain>/api/webhooks/twilio/sms
// (ya da: node scripts/twilio-sms-webhooks.mjs ... --apply — kontrol + düzeltme).
//
// STOP ailesi → sms_opt_outs.opted_out=true (bir daha hiçbir SMS gitmez, bkz.
// lib/notifications/service.ts); START → false; HELP → değişiklik yok.
// Tideline'ın restoran numaraları kendi webhook'unu kullanır
// (tideline/apps/api/src/notifications/sms-inbound-routes.ts).
//
// Yanıt: Twilio'nun varsayılan opt-out yanıtları uzun numaralarda her zaman
// açıktır ve STOP/START/HELP'e kendisi cevap verir; biz de cevaplarsak kişi iki
// mesaj alır. Bu yüzden boş TwiML dönülür. Twilio'nun yanıtları kapatılmışsa
// TWILIO_OPT_OUT_REPLIES=app ile yanıtı biz veririz.

const REPLIES: Record<SmsKeyword, string> = {
  STOP: "Locally: You're unsubscribed and won't receive more texts. Reply START to resubscribe.",
  START: "Locally: You're resubscribed to account notices. Msg&data rates may apply. Reply STOP to opt out, HELP for help.",
  HELP: "Locally: account notices for Locally businesses. Msg&data rates may apply. Reply STOP to opt out." + (US_SUPPORT_EMAIL ? ` Help: ${US_SUPPORT_EMAIL}` : ""),
};

function twiml(message?: string, status = 200) {
  const body = message ? `<Message>${message.replace(/[<>&]/g, "")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const params = new URLSearchParams(await request.text());
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    // Twilio imzayı kendi çağırdığı herkese açık adrese göre atar; proxy arkasında
    // request.url farklıysa TWILIO_SMS_WEBHOOK_URL ile sabitlenir.
    const url = process.env.TWILIO_SMS_WEBHOOK_URL ?? request.url;
    if (!validTwilioSignature(authToken, url, params, request.headers.get("x-twilio-signature"))) {
      return twiml(undefined, 403);
    }
  } else if (process.env.NODE_ENV === "production") {
    // Doğrulanamayan istekle kimsenin tercihini değiştirmeyiz.
    return twiml(undefined, 403);
  }

  const from = params.get("From")?.trim();
  const keyword = smsKeyword(params.get("Body"), params.get("OptOutType"));
  if (!from || !keyword) return twiml();

  if (keyword !== "HELP") {
    try {
      await recordSmsConsent(from, { optedOut: keyword === "STOP", source: "sms_keyword", keyword });
    } catch (err) {
      // 500 → Twilio Debugger'da hata olarak görünür. Twilio'nun kendi engeli yine de
      // devrede; ilk gönderim denemesi 21610 alıp listeye yazar (service.ts).
      console.error("[twilio-sms] opt-out kaydedilemedi:", err instanceof Error ? err.message : err);
      return twiml(undefined, 500);
    }
  }
  return twiml(process.env.TWILIO_OPT_OUT_REPLIES === "app" ? REPLIES[keyword] : undefined);
}
