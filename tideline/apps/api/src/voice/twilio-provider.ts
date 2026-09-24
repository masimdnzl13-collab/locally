import { createHmac, timingSafeEqual } from "node:crypto";
import type { TelephonyProvider } from "./contracts.js";
const esc = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, unknown>,
  signature?: string,
): boolean {
  if (!signature) return false;
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + String(params[k] ?? ""))
      .join("");
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
export class TwilioTelephonyProvider implements TelephonyProvider {
  constructor(
    private readonly authToken: string,
    private readonly accountSid?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  validateSignature(
    url: string,
    params: Record<string, unknown>,
    signature?: string,
  ): boolean {
    return validateTwilioSignature(this.authToken, url, params, signature);
  }
  incomingResponse({
    streamUrl,
    greeting,
    transferNumber,
    parameters = {},
  }: {
    streamUrl: string;
    greeting?: string;
    transferNumber?: string;
    /** Delivered in the stream's `start` message; Twilio does not support query strings on Stream urls. */
    parameters?: Record<string, string>;
  }): string {
    const say = greeting ? `<Say>${esc(greeting)}</Say>` : "";
    // Runs only if the media stream ends without the call being redirected or hung up.
    const fallback = transferNumber
      ? `<Dial>${esc(transferNumber)}</Dial>`
      : "<Say>We are unable to connect your call. Please call back shortly.</Say><Hangup/>";
    const params = Object.entries(parameters)
      .map(([name, value]) => `<Parameter name="${esc(name)}" value="${esc(value)}" />`)
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Connect><Stream url="${esc(streamUrl)}">${params}</Stream></Connect>${fallback}</Response>`;
  }
  async stopPlayback(sessionId: string): Promise<void> {
    void sessionId;
    /* Bidirectional stream clear is sent by the stream transport. */
  }
  private async updateCall(providerCallId: string, body: Record<string, string>) {
    if (!this.accountSid) throw new Error("TWILIO_ACCOUNT_SID is required for call control");
    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls/${encodeURIComponent(providerCallId)}.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error(`Twilio call update failed with HTTP ${response.status}`);
  }
  async transfer(input: { providerCallId: string; targetNumber: string }): Promise<void> {
    await this.updateCall(input.providerCallId, {
      Twiml: `<Response><Dial>${esc(input.targetNumber)}</Dial></Response>`,
    });
  }
  async hangup(providerCallId: string): Promise<void> {
    await this.updateCall(providerCallId, { Status: "completed" });
  }
}
/** Test mode: never calls Twilio. */
export class TestTelephonyProvider extends TwilioTelephonyProvider {
  constructor() {
    super("test-token");
  }
  override async transfer(): Promise<void> {}
  override async hangup(): Promise<void> {}
}
