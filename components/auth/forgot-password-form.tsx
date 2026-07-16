"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(formData);
      if (result?.error) setError(result.error);
      if (result?.message) setMessage(result.message);
    });
  }

  if (message) {
    return (
      <div className="text-center">
        <div className="mb-3 text-4xl">📬</div>
        <p className="text-sm text-ink-900">{message}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">
          E-posta
        </label>
        <Input
          type="email"
          name="email"
          required
          placeholder="sen@ornek.com"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-tile-50 px-3 py-2 text-sm text-tile-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Sıfırlama Bağlantısı Gönder</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/giris" className="font-semibold text-primary-600">
          Girişe dön
        </Link>
      </p>
    </form>
  );
}
