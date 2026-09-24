"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signInAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { US_SIGNUP_HREF } from "@/lib/us/config";

const COPY = {
  tr: {
    email: "E-posta",
    emailPlaceholder: "sen@ornek.com",
    password: "Şifre",
    forgot: "Şifremi unuttum",
    submit: "Giriş Yap",
    noAccount: "Hesabın yok mu?",
    signUp: "Kayıt ol",
    signUpHref: "/kayit",
  },
  en: {
    email: "Email",
    emailPlaceholder: "you@restaurant.com",
    password: "Password",
    forgot: "Forgot password?",
    submit: "Log in",
    noAccount: "Don't have an account?",
    signUp: "Sign up",
    signUpHref: US_SIGNUP_HREF,
  },
} as const;

export default function LoginForm({ next, locale = "tr" }: { next?: string; locale?: keyof typeof COPY }) {
  const t = COPY[locale];
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
      {locale === "en" && <input type="hidden" name="lang" value="en" />}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {t.email}
        </label>
        <Input
          type="email"
          name="email"
          required
          placeholder={t.emailPlaceholder}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">
            {t.password}
          </label>
          <Link href="/sifremi-unuttum" className="text-xs font-medium text-teal-700">
            {t.forgot}
          </Link>
        </div>
        <Input
          type="password"
          name="password"
          required
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>{t.submit}</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        {t.noAccount}{" "}
        <Link href={t.signUpHref} className="font-semibold text-teal-700">
          {t.signUp}
        </Link>
      </p>
    </form>
  );
}
