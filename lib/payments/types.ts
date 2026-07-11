export interface ChargeInput {
  amount: number;
  userId: string;
  packageId: string;
}

export interface ChargeResult {
  success: boolean;
  providerRef: string;
  error?: string;
}

export interface PaymentService {
  charge(input: ChargeInput): Promise<ChargeResult>;
}
