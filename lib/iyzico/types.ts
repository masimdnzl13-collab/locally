export interface SubMerchantInput {
  externalId: string;
  type: "PERSONAL" | "PRIVATE_COMPANY";
  legalName: string;
  contactName: string;
  contactSurname: string;
  email: string;
  gsmNumber: string;
  address: string;
  iban: string;
  identityNumber: string;
  taxOffice?: string;
}

export interface SubMerchantResult {
  success: boolean;
  submerchantKey?: string;
  simulated: boolean;
  error?: string;
}

export interface CheckoutBuyer {
  id: string;
  name: string;
  surname: string;
  email: string;
  gsmNumber?: string;
  identityNumber: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
}

export interface InitializeCheckoutInput {
  conversationId: string;
  price: number;
  itemId: string;
  itemName: string;
  submerchantKey: string;
  businessPayoutAmount: number;
  buyer: CheckoutBuyer;
  callbackUrl: string;
}

export interface InitializeCheckoutResult {
  success: boolean;
  simulated: boolean;
  token?: string;
  checkoutFormContent?: string;
  error?: string;
}

export interface RetrieveCheckoutResult {
  success: boolean;
  simulated: boolean;
  paymentStatus?: "SUCCESS" | "FAILURE" | string;
  paymentTransactionId?: string;
  paidPrice?: number;
  error?: string;
}

export interface RefundInput {
  paymentTransactionId: string;
  price: number;
  ip: string;
}

export interface RefundResult {
  success: boolean;
  simulated: boolean;
  error?: string;
}
