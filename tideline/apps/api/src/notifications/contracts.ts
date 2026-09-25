export type NotificationEvent =
  | "RESERVATION_CREATED"
  | "RESERVATION_MODIFIED"
  | "RESERVATION_CANCELLED"
  | "ORDER_CREATED"
  | "ORDER_MODIFIED"
  | "ORDER_CANCELLED";
export type MessagingProvider = {
  sendMessage(input: {
    to: string;
    from: string;
    body: string;
  }): Promise<{ providerMessageId: string; providerStatus: string }>;
};
/** Twilio error 21610: the recipient replied STOP to this sender; Twilio refuses every further send. */
export const TWILIO_UNSUBSCRIBED = "21610";
export class SmsProviderError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "SmsProviderError";
  }
}
