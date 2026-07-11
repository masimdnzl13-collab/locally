"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signInAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-sm font-medium text-dark-900">
            Şifre
          </label>
          <Link href="/sifremi-unuttum" className="text-xs font-medium text-primary-600">
            Şifremi unuttum
          </Link>
        </div>
        <input
          type="password"
          name="password"
          required
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Giriş Yap</SubmitButton>

      <p className="text-center text-sm text-slate-500">
        Hesabın yok mu?{" "}
        <Link href="/kayit" className="font-semibold text-primary-600">
          Kayıt ol
        </Link>
      </p>
    </form>
  );
}
