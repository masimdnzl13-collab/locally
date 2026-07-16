"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { registerFreeEventAction, purchaseEventTicketAction } from "@/lib/events/actions";
import { Button } from "@/components/ui/button";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

export default function JoinBar({
  eventId,
  isPaid,
  ticketPrice,
  full,
  isDemo,
}: {
  eventId: string;
  isPaid: boolean;
  ticketPrice: number | null;
  full: boolean;
  isDemo?: boolean;
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

  if (isDemo) {
    return (
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:bottom-0">
        <Button type="button" variant="teal" size="lg" disabled className="w-full">
          Örnek etkinlik — kayıt yakında aktif olacak
        </Button>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:bottom-0">
        <div className="flex items-center justify-between rounded-xl bg-success-50 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-success-700">
            <Check size={16} strokeWidth={2.5} />
            Kaydın alındı, görüşürüz!
          </span>
          <Link href="/hesabim/paketlerim" className="text-sm font-bold text-success-700 underline">
            Biletlerim
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:bottom-0">
      {error && (
        <p className="mb-2 rounded-lg bg-danger-50 px-3 py-2 text-center text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
      <form action={handleSubmit}>
        <input type="hidden" name="eventId" value={eventId} />
        <Button
          type="submit"
          variant="teal"
          size="lg"
          disabled={isPending || full}
          className="w-full"
        >
          {full
            ? "Kontenjan Doldu"
            : isPending
              ? "Bir saniye..."
              : isPaid
                ? `Bilet Al — ${formatTL(ticketPrice ?? 0)}`
                : "Katılacağım"}
        </Button>
      </form>
    </div>
  );
}
