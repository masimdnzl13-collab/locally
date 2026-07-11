"use client";

import { useState, useTransition } from "react";
import { initiatePackageCheckoutAction } from "@/lib/purchases/actions";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function BuyBar({
  packageId,
  price,
  purchasable = true,
}: {
  packageId: string;
  price: number;
  purchasable?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await initiatePackageCheckoutAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white px-4 py-3 md:bottom-0">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <form action={handleSubmit}>
        <input type="hidden" name="packageId" value={packageId} />
        <button
          type="submit"
          disabled={isPending || !purchasable}
          className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {!purchasable
            ? "Yakında"
            : isPending
              ? "Bir saniye..."
              : `Paketi Al — ${formatTL(price)}`}
        </button>
      </form>
    </div>
  );
}
