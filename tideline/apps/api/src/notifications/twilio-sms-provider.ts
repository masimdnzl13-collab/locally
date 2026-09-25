import { SmsProviderError, type MessagingProvider } from "./contracts.js";
export class TwilioSmsProvider implements MessagingProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
  ) {}
  async sendMessage(input: { to: string; from: string; body: string }) {
    const auth = Buffer.from(this.accountSid + ":" + this.authToken).toString(
      "base64",
    );
    const body = new URLSearchParams({
      To: input.to,
      From: input.from,
      Body: input.body,
    });
    const response = await fetch(
      "https://api.twilio.com/2010-04-01/Accounts/" +
        this.accountSid +
        "/Messages.json",
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const data = (await response.json()) as {
      sid?: string;
      status?: string;
      message?: string;
      code?: number;
    };
    if (!response.ok || !data.sid)
      throw new SmsProviderError(data.message ?? "Twilio SMS failed", data.code === undefined ? undefined : String(data.code));
    return {
      providerMessageId: data.sid,
      providerStatus: data.status ?? "queued",
    };
  }
}
