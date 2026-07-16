"use client";

import { useState, useTransition } from "react";
import { initiatePackageCheckoutAction } from "@/lib/purchases/actions";
import { Button } from "@/components/ui/button";

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
    <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:bottom-0">
      {error && (
        <p className="mb-2 rounded-lg bg-danger-50 px-3 py-2 text-center text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
      <form action={handleSubmit}>
        <input type="hidden" name="packageId" value={packageId} />
        <Button
          type="submit"
          variant="teal"
          size="lg"
          disabled={isPending || !purchasable}
          className="w-full"
        >
          {!purchasable
            ? "Yakında"
            : isPending
              ? "Bir saniye..."
              : `Paketi Al — ${formatTL(price)}`}
        </Button>
      </form>
    </div>
  );
}
