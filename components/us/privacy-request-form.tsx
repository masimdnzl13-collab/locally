"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitPrivacyRequestAction } from "@/lib/privacy/actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Requester = "caller" | "merchant" | "other";

const REQUESTERS: { value: Requester; label: string }[] = [
  { value: "caller", label: "I called a restaurant that uses Locally" },
  { value: "merchant", label: "I own or manage a restaurant on Locally" },
  { value: "other", label: "Something else" },
];

export default function PrivacyRequestForm() {
  const [requester, setRequester] = useState<Requester>("caller");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <div role="status" className="flex gap-3 rounded-lg border border-success-600/30 bg-success-50 p-5 text-success-700">
        <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">We&apos;ve received your request.</p>
          <p className="mt-1 text-sm">
            We&apos;ll reply by email, usually within a few days and always within 45 days. We may ask you to confirm
            your identity before we act on it.
          </p>
        </div>
      </div>
    );
  }

  const label = "mb-1.5 block text-sm font-medium text-foreground";

  return (
    <form
      action={(fd) => {
        setError(null);
        fd.set("requesterType", requester);
        startTransition(async () => {
          const result = await submitPrivacyRequestAction(fd);
          if ("error" in result) setError(result.error);
          else setSent(true);
        });
      }}
      className="space-y-5 rounded-lg border border-border bg-card p-5 md:p-6"
    >
      {/* Honeypot: invisible to people, filled by simple bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <fieldset>
        <legend className={label}>What would you like us to do?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "delete", text: "Delete my information" },
            { value: "access", text: "Tell me what information you have" },
          ].map((o, i) => (
            <label
              key={o.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50"
            >
              <input type="radio" name="requestType" value={o.value} defaultChecked={i === 0} className="accent-teal-600" />
              {o.text}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Who are you?</legend>
        <div className="grid gap-2">
          {REQUESTERS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                requester === r.value ? "border-teal-600 bg-teal-50" : "border-border"
              )}
            >
              <input
                type="radio"
                name="requesterChoice"
                value={r.value}
                checked={requester === r.value}
                onChange={() => setRequester(r.value)}
                className="accent-teal-600"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pr-name" className={label}>
            Your name
          </label>
          <Input id="pr-name" name="fullName" required maxLength={120} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="pr-email" className={label}>
            Email (we&apos;ll reply here)
          </label>
          <Input id="pr-email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </div>
        {requester !== "merchant" && (
          <div>
            <label htmlFor="pr-phone" className={label}>
              Phone number you called from{requester === "other" && " (optional)"}
            </label>
            <Input
              id="pr-phone"
              name="phone"
              type="tel"
              required={requester === "caller"}
              maxLength={32}
              autoComplete="tel"
              placeholder="(555) 123-4567"
            />
          </div>
        )}
        <div>
          <label htmlFor="pr-business" className={label}>
            {requester === "merchant" ? "Restaurant name" : "Restaurant you called (if you know it)"}
          </label>
          <Input id="pr-business" name="businessName" required={requester === "merchant"} maxLength={160} />
        </div>
      </div>

      <div>
        <label htmlFor="pr-details" className={label}>
          Anything else we should know? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="pr-details"
          name="details"
          rows={3}
          maxLength={2000}
          className="w-full rounded-input border border-border bg-card px-4 py-3 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-md bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
