export interface SendSmsInput {
  to: string;
  message: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendResult {
  success: boolean;
  providerRef?: string;
  simulated: boolean;
  error?: string;
}

export interface NotificationService {
  sendSms(input: SendSmsInput): Promise<SendResult>;
  sendEmail(input: SendEmailInput): Promise<SendResult>;
}
