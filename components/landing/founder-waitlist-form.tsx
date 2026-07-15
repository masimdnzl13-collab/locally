"use client";

import { useState, useTransition } from "react";
import { joinWaitlistAction } from "@/lib/waitlist/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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
      <div className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-4 text-center">
        <Check size={18} className="text-accent-300" />
        <p className="font-semibold text-white">{message}</p>
      </div>
    );
  }

  return (
    <div>
      <form action={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          name="email"
          required
          placeholder="sen@ornek.com"
          className="w-full flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:border-accent focus-visible:ring-accent/40"
        />
        <Button
          type="submit"
          disabled={isPending}
          variant="accent"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isPending ? "Bir saniye..." : "Kurucu 500'e Katıl"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-accent-200">{error}</p>}
    </div>
  );
}
