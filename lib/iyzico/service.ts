import Iyzipay from "iyzipay";
import { getIyzicoClient } from "@/lib/iyzico/client";
import type {
  CheckoutBuyer,
  InitializeCheckoutInput,
  InitializeCheckoutResult,
  RefundInput,
  RefundResult,
  RetrieveCheckoutResult,
  SubMerchantInput,
  SubMerchantResult,
} from "@/lib/iyzico/types";

// iyzico Node SDK'sı callback tabanlı; burada Promise'e sarılıyor. Anahtar
// yoksa (test modu) gerçek API'ye hiç gidilmez, gerçekçi şekilde simüle
// edilir — tıpkı lib/payments ve lib/notifications katmanlarında olduğu gibi.

export async function createSubMerchant(input: SubMerchantInput): Promise<SubMerchantResult> {
  const client = getIyzicoClient();

  if (!client) {
    return { success: true, simulated: true, submerchantKey: `TEST-SUB-${Date.now()}` };
  }

  return new Promise((resolve) => {
    client.subMerchant.create(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: input.externalId,
        subMerchantExternalId: input.externalId,
        subMerchantType: input.type as Iyzipay.SubMerchantTypes[keyof Iyzipay.SubMerchantTypes],
        address: input.address,
        taxOffice: input.taxOffice,
        legalCompanyTitle: input.type === "PRIVATE_COMPANY" ? input.legalName : undefined,
        contactName: input.contactName,
        contactSurname: input.contactSurname,
        email: input.email,
        gsmNumber: input.gsmNumber,
        name: input.legalName,
        iban: input.iban,
        identityNumber: input.identityNumber,
        currency: Iyzipay.CURRENCY.TRY,
      },
      (err, result) => {
        if (err || !result || result.status !== "success") {
          resolve({
            success: false,
            simulated: false,
            error: err?.message ?? "iyzico alt üye kaydı oluşturulamadı",
          });
          return;
        }
        resolve({ success: true, simulated: false, submerchantKey: result.subMerchantKey });
      }
    );
  });
}

export async function initializeCheckout(
  input: InitializeCheckoutInput
): Promise<InitializeCheckoutResult> {
  const client = getIyzicoClient();

  if (!client) {
    return { success: true, simulated: true, token: `TEST-TOKEN-${Date.now()}` };
  }

  const buyer: CheckoutBuyer = input.buyer;

  return new Promise((resolve) => {
    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: input.conversationId,
      price: input.price.toFixed(2),
      paidPrice: input.price.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: input.itemId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: input.callbackUrl,
      buyer: {
        id: buyer.id,
        name: buyer.name,
        surname: buyer.surname,
        gsmNumber: buyer.gsmNumber,
        email: buyer.email,
        identityNumber: buyer.identityNumber,
        registrationAddress: buyer.registrationAddress,
        ip: buyer.ip,
        city: buyer.city,
        country: buyer.country,
      },
      basketItems: [
        {
          id: input.itemId,
          name: input.itemName,
          category1: "Paket",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: input.price.toFixed(2),
          subMerchantKey: input.submerchantKey,
          subMerchantPrice: input.businessPayoutAmount.toFixed(2),
        },
      ],
      // Not: checkoutFormInitialize'ın gerçek gövdesi (buyer + basketItems +
      // callbackUrl) resmi Node SDK örnekleriyle doğrulandı; @types/iyzipay
      // bu çağrı için yanlışlıkla kart/adres alanları zorunlu kılıyor, bu
      // yüzden burada tip güvenli olmayan bir çağrıya düşüyoruz.
    };

    (client.checkoutFormInitialize.create as unknown as (
      data: typeof request,
      cb: (err: Error, result: Iyzipay.CheckoutFormInitialResult) => void
    ) => void)(request, (err, result) => {
      if (err || !result || result.status !== "success") {
        resolve({
          success: false,
          simulated: false,
          error: err?.message ?? "Ödeme formu başlatılamadı",
        });
        return;
      }
      resolve({
        success: true,
        simulated: false,
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
      });
    });
  });
}

export async function retrieveCheckout(token: string): Promise<RetrieveCheckoutResult> {
  const client = getIyzicoClient();

  if (!client || token.startsWith("TEST-TOKEN-")) {
    // Test modunda gerçek doğrulama yapılmaz; kullanıcı "Test Ödemeyi
    // Tamamla" adımına ulaştıysa başarılı sayılır.
    return {
      success: true,
      simulated: true,
      paymentStatus: "SUCCESS",
      paymentTransactionId: `TEST-TXN-${Date.now()}`,
    };
  }

  return new Promise((resolve) => {
    client.checkoutForm.retrieve(
      { locale: Iyzipay.LOCALE.TR, conversationId: token, token },
      (err, result) => {
        if (err || !result || result.status !== "success") {
          resolve({
            success: false,
            simulated: false,
            error: err?.message ?? "Ödeme doğrulanamadı",
          });
          return;
        }

        const firstItem = result.paymentItems?.[0];

        resolve({
          success: true,
          simulated: false,
          paymentStatus: result.paymentStatus,
          paymentTransactionId: firstItem?.paymentTransactionId,
          paidPrice: Number(result.paidPrice),
        });
      }
    );
  });
}

export async function refundPayment(input: RefundInput): Promise<RefundResult> {
  const client = getIyzicoClient();

  if (!client || input.paymentTransactionId.startsWith("TEST-TXN-")) {
    return { success: true, simulated: true };
  }

  return new Promise((resolve) => {
    client.refund.create(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: input.paymentTransactionId,
        paymentTransactionId: input.paymentTransactionId,
        price: input.price.toFixed(2),
        currency: Iyzipay.CURRENCY.TRY,
        ip: input.ip,
      },
      (err, result) => {
        if (err || !result || result.status !== "success") {
          resolve({
            success: false,
            simulated: false,
            error: err?.message ?? "İade işlemi başarısız",
          });
          return;
        }
        resolve({ success: true, simulated: false });
      }
    );
  });
}
