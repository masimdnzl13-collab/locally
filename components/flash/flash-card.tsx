"use client";

import { useState, useTransition } from "react";
import { useCountdown } from "@/components/flash/use-countdown";
import { reserveFlashDealAction } from "@/lib/flash-deals/actions";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
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
    ? "bg-navy-800 text-stone-400"
    : ratio <= 0.25
      ? "bg-danger-500 text-white"
      : ratio <= 0.5
        ? "bg-discount-500 text-white"
        : "bg-teal-500/20 text-teal-200";

  const totalMinutes = countdown.hours * 60 + countdown.minutes;
  const timeCritical = totalMinutes < 5;
  const timeUrgent = !timeCritical && totalMinutes < 15;
  const countdownBadge = timeCritical
    ? "bg-danger-500 text-white"
    : timeUrgent
      ? "bg-discount-500 text-white"
      : "bg-navy-950/80 text-white";

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
        "overflow-hidden rounded-lg border border-navy-700 bg-navy-800 transition-opacity",
        full && "opacity-60"
      )}
    >
      <div className="relative h-32">
        {deal.business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.business.cover_url}
            alt={deal.business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryIcon category={deal.business.category} className="h-full" />
        )}
        <span
          className={cn(
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold",
            countdownBadge
          )}
        >
          {countdown.label}
        </span>
      </div>

      <div className="p-4">
        <p className="text-sm font-medium text-stone-300">
          {deal.business.name}
          {deal.business.district ? ` · ${deal.business.district}` : ""}
        </p>
        <p className="mt-1 font-semibold text-white">{deal.offer_text}</p>
        <p className="mt-1 text-xs text-stone-400">
          Geçerlilik: {formatWindow(deal.starts_at, deal.ends_at)}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", urgency)}>
            {full ? "Doldu" : remaining <= 3 ? `Son ${remaining} yer` : `${remaining} yer kaldı`}
          </span>

          {reserved ? (
            <span className="rounded-full border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs font-bold text-teal-200">
              ✓ Yerin ayrıldı · {code}
            </span>
          ) : (
            <Button
              onClick={handleReserve}
              disabled={full || isPending}
              variant="teal"
              size="sm"
            >
              {isPending ? "Bir saniye..." : full ? "Doldu" : "Yerimi Ayır"}
            </Button>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}
      </div>
    </div>
  );
}
