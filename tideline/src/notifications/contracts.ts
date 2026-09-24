export type NotificationEvent = 'RESERVATION_CREATED'|'RESERVATION_MODIFIED'|'RESERVATION_CANCELLED'|'ORDER_CREATED'|'ORDER_MODIFIED'|'ORDER_CANCELLED'|'HUMAN_FOLLOWUP';
export type MessageStatus='QUEUED'|'SENDING'|'SENT'|'DELIVERED'|'FAILED'|'UNDELIVERED'|'CANCELLED'|'UNKNOWN';
export type MessagingProvider={sendMessage(input:{to:string;from:string;body:string;statusCallback?:string}):Promise<{providerMessageId:string;providerStatus:string}>;getMessageStatus(id:string):Promise<{status:string}>};
export type NotificationVariables=Record<string,string|number|undefined>;
