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
