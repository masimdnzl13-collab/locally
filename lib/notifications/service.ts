import type { NotificationService, SendEmailInput, SendResult, SendSmsInput } from "@/lib/notifications/types";

// Netgsm / Twilio (SMS) ve Resend (e-posta) anahtarları ortam değişkenlerinde
// tanımlıysa gerçek sağlayıcıya gönderir; tanımlı değilse gönderimi
// simüle eder ("test modu"). Böylece sağlayıcı değişse de bu katmanı
// çağıran kod (duyuru gönderimi, P16 cron işleri) değişmez.
//
// SMS sağlayıcısı numaraya göre seçilir: ABD (+1) numaraları Twilio'dan,
// diğerleri (TR) Netgsm'den gider — Netgsm yurt dışına gönderemiyor.

function isUsNumber(to: string) {
  const digits = to.replace(/\D/g, "");
  return to.trim().startsWith("+1") || (digits.length === 11 && digits.startsWith("1"));
}

export function smsProviderFor(to: string): { provider: "twilio" | "netgsm"; configured: boolean } {
  if (isUsNumber(to)) {
    return {
      provider: "twilio",
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
      ),
    };
  }
  return {
    provider: "netgsm",
    configured: Boolean(
      process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD && process.env.NETGSM_MSGHEADER
    ),
  };
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

class LocallyNotificationService implements NotificationService {
  async sendSms(input: SendSmsInput): Promise<SendResult> {
    return isUsNumber(input.to) ? this.sendTwilioSms(input) : this.sendNetgsmSms(input);
  }

  private async sendTwilioSms({ to, message }: SendSmsInput): Promise<SendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) {
      return { success: true, simulated: true, providerRef: `TEST-SMS-${Date.now()}` };
    }

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: new URLSearchParams({ To: "+" + to.replace(/\D/g, ""), From: from, Body: message }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { success: false, simulated: false, error: `Twilio hata: ${res.status} ${data?.message ?? ""}`.trim() };
      }
      return { success: true, simulated: false, providerRef: String(data?.sid ?? "") };
    } catch (err) {
      return {
        success: false,
        simulated: false,
        error: err instanceof Error ? err.message : "SMS gönderilemedi",
      };
    }
  }

  private async sendNetgsmSms({ to, message }: SendSmsInput): Promise<SendResult> {
    const usercode = process.env.NETGSM_USERCODE;
    const password = process.env.NETGSM_PASSWORD;
    const msgheader = process.env.NETGSM_MSGHEADER;

    if (!usercode || !password || !msgheader) {
      return { success: true, simulated: true, providerRef: `TEST-SMS-${Date.now()}` };
    }

    try {
      const res = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + Buffer.from(`${usercode}:${password}`).toString("base64"),
        },
        body: JSON.stringify({
          msgheader,
          messages: [{ msg: message, no: to.replace(/\D/g, "") }],
        }),
      });

      if (!res.ok) {
        return { success: false, simulated: false, error: `Netgsm hata: ${res.status}` };
      }

      const data = await res.json();
      return { success: true, simulated: false, providerRef: String(data?.jobid ?? "") };
    } catch (err) {
      return {
        success: false,
        simulated: false,
        error: err instanceof Error ? err.message : "SMS gönderilemedi",
      };
    }
  }

  async sendEmail({ to, subject, html }: SendEmailInput): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return { success: true, simulated: true, providerRef: `TEST-EMAIL-${Date.now()}` };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from: fromEmail, to, subject, html }),
      });

      if (!res.ok) {
        return { success: false, simulated: false, error: `Resend hata: ${res.status}` };
      }

      const data = await res.json();
      return { success: true, simulated: false, providerRef: String(data?.id ?? "") };
    } catch (err) {
      return {
        success: false,
        simulated: false,
        error: err instanceof Error ? err.message : "E-posta gönderilemedi",
      };
    }
  }
}

export const notificationService: NotificationService = new LocallyNotificationService();
