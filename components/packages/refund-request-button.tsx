"use client";

import { useState, useTransition } from "react";
import { requestRefundAction } from "@/lib/purchases/actions";

export default function RefundRequestButton({ purchaseId }: { purchaseId: string }) {
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("purchaseId", purchaseId);
      const result = await requestRefundAction(formData);
      if (result?.error) setError(result.error);
      else setRequested(true);
    });
  }

  if (requested) {
    return <p className="mt-3 text-xs font-semibold text-teal-700">İade talebin alındı.</p>;
  }

  return (
    <div className="mt-3">
      {error && <p className="mb-1.5 text-xs text-danger-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-semibold text-danger-600 underline underline-offset-2 disabled:opacity-60"
      >
        {isPending ? "Gönderiliyor..." : "İade Talebi Oluştur"}
      </button>
    </div>
  );
}
