"use client";

import { useState, useTransition } from "react";
import { joinWaitlistAction } from "@/lib/waitlist/actions";
import SubmitButton from "@/components/ui/submit-button";

export default function FounderWaitlistForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlistAction(formData);
      if (result?.error) setError(result.error);
      if (result?.message) setMessage(result.message);
    });
  }

  if (message) {
    return (
      <div className="rounded-xl bg-white/10 px-5 py-4 text-center">
        <p className="font-semibold text-white">✓ {message}</p>
      </div>
    );
  }

  return (
    <div>
      <form action={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="sen@ornek.com"
          className="w-full flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm text-white placeholder:text-white/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <SubmitButton
          pending={isPending}
          className="w-full bg-accent text-dark-950 hover:bg-accent-400 sm:w-auto sm:px-6"
        >
          Kurucu 500&apos;e Katıl
        </SubmitButton>
      </form>
      {error && <p className="mt-2 text-sm text-accent-200">{error}</p>}
    </div>
  );
}
