"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registerFreeEventAction, purchaseEventTicketAction } from "@/lib/events/actions";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function JoinBar({
  eventId,
  isPaid,
  ticketPrice,
  full,
}: {
  eventId: string;
  isPaid: boolean;
  ticketPrice: number | null;
  full: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = isPaid ? purchaseEventTicketAction : registerFreeEventAction;
      const result = await action(formData);
      if (result?.error) setError(result.error);
      else if (result?.success) setJoined(true);
    });
  }

  if (joined) {
    return (
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white px-4 py-3 md:bottom-0">
        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
          <span className="text-sm font-semibold text-primary-700">
            ✓ Kaydın alındı, görüşürüz!
          </span>
          <Link href="/hesabim/paketlerim" className="text-sm font-bold text-primary-700 underline">
            Biletlerim
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white px-4 py-3 md:bottom-0">
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <form action={handleSubmit}>
        <input type="hidden" name="eventId" value={eventId} />
        <button
          type="submit"
          disabled={isPending || full}
          className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {full
            ? "Kontenjan Doldu"
            : isPending
              ? "Bir saniye..."
              : isPaid
                ? `Bilet Al — ${formatTL(ticketPrice ?? 0)}`
                : "Katılacağım"}
        </button>
      </form>
    </div>
  );
}
