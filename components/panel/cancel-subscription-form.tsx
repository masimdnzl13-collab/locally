"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMySubscriptionAction } from "@/lib/billing/actions";
import { Button } from "@/components/ui/button";
import type { BillingCopy } from "@/lib/billing/copy";

// "Aboneliği iptal et": önce zamanlama (hemen / dönem sonunda) seçilir, sonra
// ikinci bir adımda onaylanır — tek tıkla yanlışlıkla iptal olmasın.
export default function CancelSubscriptionForm({
  copy,
  periodEndLabel,
}: {
  copy: BillingCopy["cancel"];
  periodEndLabel: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState<"period_end" | "now">("period_end");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) return <p className="rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">{done}</p>;

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="border-danger-200 text-danger-600 hover:bg-danger-50">
        {copy.button}
      </Button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("when", when);
      fd.set("confirm", "yes");
      const result = await cancelMySubscriptionAction(fd);
      if (result.error) return setError(result.error);
      setDone(result.atPeriodEnd ? copy.doneAtPeriodEnd : copy.doneNow);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-danger-200 bg-danger-50/40 p-4">
      <p className="text-sm font-semibold text-foreground">{copy.question}</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">{copy.question}</legend>
        <label className="flex cursor-pointer gap-3 rounded-md border border-border bg-card p-3 text-sm">
          <input
            type="radio"
            name="when"
            value="period_end"
            checked={when === "period_end"}
            onChange={() => setWhen("period_end")}
            className="mt-0.5"
          />
          <span>
            <span className="block font-semibold text-foreground">{copy.periodEndTitle}</span>
            <span className="text-muted-foreground">
              {periodEndLabel ? copy.periodEndBody.replace("{date}", periodEndLabel) : copy.periodEndBodyNoDate}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-md border border-border bg-card p-3 text-sm">
          <input
            type="radio"
            name="when"
            value="now"
            checked={when === "now"}
            onChange={() => setWhen("now")}
            className="mt-0.5"
          />
          <span>
            <span className="block font-semibold text-foreground">{copy.nowTitle}</span>
            <span className="text-muted-foreground">{copy.nowBody}</span>
          </span>
        </label>
      </fieldset>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" onClick={submit} disabled={isPending}>
          {isPending ? copy.pending : copy.confirm}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          {copy.keep}
        </Button>
      </div>
    </div>
  );
}
