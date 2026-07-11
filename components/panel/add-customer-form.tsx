"use client";

import { useState, useTransition } from "react";
import { addCustomerAction } from "@/lib/customers/actions";
import SubmitButton from "@/components/ui/submit-button";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "mb-1.5 block text-sm font-medium text-dark-900";

export default function AddCustomerForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addCustomerAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div>
        <label className={labelClass}>Ad Soyad</label>
        <input type="text" name="fullName" required className={inputClass} placeholder="Örn. Ayşe Yılmaz" />
      </div>
      <div>
        <label className={labelClass}>Telefon</label>
        <input type="tel" name="phone" required className={inputClass} placeholder="05xx xxx xx xx" />
      </div>
      <div>
        <label className={labelClass}>Not — isteğe bağlı</label>
        <textarea name="notes" rows={3} className={inputClass} placeholder="Örn. Doğum günü Ağustos'ta" />
      </div>

      <SubmitButton pending={isPending}>Müşteriyi Ekle</SubmitButton>
    </form>
  );
}
