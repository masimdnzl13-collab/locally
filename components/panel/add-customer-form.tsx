"use client";

import { useState, useTransition } from "react";
import { addCustomerAction } from "@/lib/customers/actions";
import SubmitButton from "@/components/ui/submit-button";

const inputClass =
  "w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-900";

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
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
      {error && <p className="rounded-md bg-tile-50 px-3 py-2 text-sm text-tile-600">{error}</p>}

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
