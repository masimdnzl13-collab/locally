"use client";

import { useState, useTransition } from "react";
import { startUsCheckoutAction } from "@/lib/onboarding-us/actions";
import SubmitButton from "@/components/ui/submit-button";

export default function CheckoutButton({ label }: { label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        setError(null);
        startTransition(async () => {
          const result = await startUsCheckoutAction();
          if (result?.error) setError(result.error);
        });
      }}
      className="space-y-3"
    >
      {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>}
      <SubmitButton pending={isPending} pendingLabel="Redirecting...">
        {label}
      </SubmitButton>
    </form>
  );
}
