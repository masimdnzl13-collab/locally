"use client";

import { useState, useTransition } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

const COPY = {
  tr: { label: "Yeni Şifre", placeholder: "En az 8 karakter", submit: "Şifreyi Güncelle", pending: "Bir saniye..." },
  en: { label: "New password", placeholder: "At least 8 characters", submit: "Update password", pending: "One moment..." },
} as const;

export default function ResetPasswordForm({ locale = "tr" }: { locale?: keyof typeof COPY }) {
  const t = COPY[locale];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePasswordAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {locale === "en" && <input type="hidden" name="lang" value="en" />}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {t.label}
        </label>
        <Input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder={t.placeholder}
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending} pendingLabel={t.pending}>{t.submit}</SubmitButton>
    </form>
  );
}
