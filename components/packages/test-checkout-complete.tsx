"use client";

import { useState, useTransition } from "react";
import { completeTestCheckoutAction } from "@/lib/purchases/actions";

export default function TestCheckoutComplete({ purchaseId }: { purchaseId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("purchaseId", purchaseId);
      const result = await completeTestCheckoutAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-6 text-center">
      <p className="text-sm font-semibold text-accent-700">Test Modu</p>
      <p className="mt-1 text-xs text-slate-500">
        iyzico anahtarları tanımlı değil; gerçek bir ödeme alınmayacak.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-dark-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {isPending ? "İşleniyor..." : "Test Ödemeyi Tamamla"}
      </button>
    </div>
  );
}
