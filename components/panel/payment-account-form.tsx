"use client";

import { useState, useTransition } from "react";
import { setPaymentAccountAction } from "@/lib/business/payment-account";
import SubmitButton from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { IYZICO_ONBOARDING_LABELS, type Business } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "mb-1.5 block text-sm font-medium text-dark-900";

const STATUS_CLASS: Record<Business["iyzico_onboarding_status"], string> = {
  not_started: "bg-slate-100 text-slate-500",
  pending: "bg-accent/10 text-accent-700",
  approved: "bg-primary/10 text-primary-700",
  rejected: "bg-red-50 text-red-600",
};

export default function PaymentAccountForm({ business }: { business: Business }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [type, setType] = useState<"PERSONAL" | "PRIVATE_COMPANY">(
    (business.iyzico_submerchant_type as "PERSONAL" | "PRIVATE_COMPANY") ?? "PERSONAL"
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set("submerchantType", type);
    startTransition(async () => {
      const result = await setPaymentAccountAction(formData);
      if (result?.error) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold text-dark-900">Kayıt Durumu</p>
          <p className="text-xs text-slate-400">
            Onaylanmadan paketlerin satışa kapalı kalır ve vitrinde &quot;yakında&quot; görünür.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
            STATUS_CLASS[business.iyzico_onboarding_status]
          )}
        >
          {IYZICO_ONBOARDING_LABELS[business.iyzico_onboarding_status]}
        </span>
      </div>

      {business.iyzico_onboarding_status === "rejected" && business.iyzico_reject_reason && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          Red gerekçesi: {business.iyzico_reject_reason}
        </p>
      )}

      <form action={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {success && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary-700">
            Kaydedildi.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("PERSONAL")}
            className={cn(
              "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold",
              type === "PERSONAL"
                ? "border-primary bg-primary/10 text-primary-700"
                : "border-slate-200 text-slate-500"
            )}
          >
            Şahıs
          </button>
          <button
            type="button"
            onClick={() => setType("PRIVATE_COMPANY")}
            className={cn(
              "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold",
              type === "PRIVATE_COMPANY"
                ? "border-primary bg-primary/10 text-primary-700"
                : "border-slate-200 text-slate-500"
            )}
          >
            Şirket
          </button>
        </div>

        <div>
          <label className={labelClass}>
            {type === "PERSONAL" ? "Ad Soyad" : "Şirket Unvanı"}
          </label>
          <input
            type="text"
            name="legalName"
            required
            defaultValue={business.legal_name ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>{type === "PERSONAL" ? "TC Kimlik No" : "Vergi No"}</label>
          <input
            type="text"
            name="identityNumber"
            required
            defaultValue={business.tax_identity_number ?? ""}
            className={inputClass}
          />
        </div>

        {type === "PRIVATE_COMPANY" && (
          <div>
            <label className={labelClass}>Vergi Dairesi</label>
            <input type="text" name="taxOffice" required className={inputClass} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Yetkili Adı</label>
            <input type="text" name="contactName" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Yetkili Soyadı</label>
            <input type="text" name="contactSurname" required className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>IBAN</label>
          <input
            type="text"
            name="iban"
            required
            placeholder="TR..."
            defaultValue={business.iban ?? ""}
            className={inputClass}
          />
        </div>

        <SubmitButton pending={isPending}>
          {business.iyzico_submerchant_key ? "Bilgileri Güncelle" : "Ödeme Hesabını Oluştur"}
        </SubmitButton>
      </form>
    </div>
  );
}
