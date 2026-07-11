import type { NotificationService, SendEmailInput, SendResult, SendSmsInput } from "@/lib/notifications/types";

// Netgsm (SMS) ve Resend (e-posta) anahtarları ortam değişkenlerinde
// tanımlıysa gerçek sağlayıcıya gönderir; tanımlı değilse gönderimi
// simüle eder ("test modu"). Böylece sağlayıcı değişse de bu katmanı
// çağıran kod (duyuru gönderimi, P16 cron işleri) değişmez.
class LocallyNotificationService implements NotificationService {
  async sendSms({ to, message }: SendSmsInput): Promise<SendResult> {
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
