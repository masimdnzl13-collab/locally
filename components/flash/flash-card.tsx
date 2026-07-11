"use client";

import { useState, useTransition } from "react";
import { useCountdown } from "@/components/flash/use-countdown";
import { reserveFlashDealAction } from "@/lib/flash-deals/actions";
import { cn } from "@/lib/utils";
import type { FlashDeal } from "@/lib/flash-deals/queries";

function formatWindow(startsAt: string, endsAt: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(startsAt).toLocaleTimeString("tr-TR", opts)}–${new Date(
    endsAt
  ).toLocaleTimeString("tr-TR", opts)}`;
}

export default function FlashCard({ deal }: { deal: FlashDeal }) {
  const countdown = useCountdown(deal.ends_at);
  const [reserved, setReserved] = useState(deal.reserved_by_me);
  const [code, setCode] = useState(deal.my_confirmation_code);
  const [remaining, setRemaining] = useState(deal.remaining_quota);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (countdown.expired) return null;

  const full = remaining <= 0;
  const ratio = remaining / Math.max(deal.total_quota, 1);
  const urgency = full
    ? "bg-slate-200 text-slate-500"
    : ratio <= 0.25
      ? "bg-red-100 text-red-700"
      : ratio <= 0.5
        ? "bg-accent/15 text-accent-700"
        : "bg-primary/10 text-primary-700";

  function handleReserve() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("flashDealId", deal.id);
      const result = await reserveFlashDealAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success) {
        setReserved(true);
        setCode(result.confirmationCode);
        setRemaining((r) => Math.max(r - 1, 0));
      }
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity",
        full && "opacity-60"
      )}
    >
      <div className="relative h-32 bg-slate-100">
        {deal.business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.business.cover_url}
            alt={deal.business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🔥</div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-dark-950/80 px-2.5 py-1 text-xs font-bold text-white">
          {countdown.label}
        </span>
      </div>

      <div className="p-4">
        <p className="text-sm font-medium text-slate-500">
          {deal.business.name}
          {deal.business.district ? ` · ${deal.business.district}` : ""}
        </p>
        <p className="mt-1 font-bold text-dark-900">{deal.offer_text}</p>
        <p className="mt-1 text-xs text-slate-400">
          Geçerlilik: {formatWindow(deal.starts_at, deal.ends_at)}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", urgency)}>
            {full ? "Doldu" : remaining <= 3 ? `Son ${remaining} yer` : `${remaining} yer kaldı`}
          </span>

          {reserved ? (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-700">
              ✓ Yerin ayrıldı · {code}
            </span>
          ) : (
            <button
              onClick={handleReserve}
              disabled={full || isPending}
              className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isPending ? "Bir saniye..." : full ? "Doldu" : "Yerimi Ayır"}
            </button>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
