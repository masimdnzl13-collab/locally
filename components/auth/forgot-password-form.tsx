"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
        <p className="text-sm text-dark-900">{message}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-dark-900">
          E-posta
        </label>
        <input
          type="email"
          name="email"
          required
          className={inputClass}
          placeholder="sen@ornek.com"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Sıfırlama Bağlantısı Gönder</SubmitButton>

      <p className="text-center text-sm text-slate-500">
        <Link href="/giris" className="font-semibold text-primary-600">
          Girişe dön
        </Link>
      </p>
    </form>
  );
}
