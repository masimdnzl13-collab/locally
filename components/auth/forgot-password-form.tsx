"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { US_LOGIN_PATH } from "@/lib/us/config";

const COPY = {
  tr: { email: "E-posta", placeholder: "sen@ornek.com", submit: "Sıfırlama Bağlantısı Gönder", pending: "Bir saniye...", back: "Girişe dön", backHref: "/giris" },
  en: { email: "Email", placeholder: "you@restaurant.com", submit: "Send reset link", pending: "One moment...", back: "Back to log in", backHref: US_LOGIN_PATH },
} as const;

export default function ForgotPasswordForm({ locale = "tr" }: { locale?: keyof typeof COPY }) {
  const t = COPY[locale];
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
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <MailCheck size={22} strokeWidth={1.75} />
        </div>
        <p className="text-sm text-foreground">{message}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {locale === "en" && <input type="hidden" name="lang" value="en" />}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {t.email}
        </label>
        <Input
          type="email"
          name="email"
          required
          placeholder={t.placeholder}
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending} pendingLabel={t.pending}>{t.submit}</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={t.backHref} className="font-semibold text-teal-700">
          {t.back}
        </Link>
      </p>
    </form>
  );
}
