"use client";

import { useState, useTransition } from "react";
import { completeTestCheckoutAction } from "@/lib/purchases/actions";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-2xl border border-dashed border-accent-400/60 bg-accent-50 p-6 text-center">
      <p className="text-sm font-semibold text-accent-700">Test Modu</p>
      <p className="mt-1 text-xs text-muted-foreground">
        iyzico anahtarları tanımlı değil; gerçek bir ödeme alınmayacak.
      </p>
      {error && <p className="mt-2 text-sm text-tile-600">{error}</p>}
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant="secondary"
        shape="pill"
        className="mt-4 w-full"
      >
        {isPending ? "İşleniyor..." : "Test Ödemeyi Tamamla"}
      </Button>
    </div>
  );
}
