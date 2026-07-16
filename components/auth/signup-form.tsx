"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signUpAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SignupForm({
  initialRole = "user",
}: {
  initialRole?: "user" | "business";
}) {
  const [role, setRole] = useState<"user" | "business">(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await signUpAction(formData);
      if (result?.error) setError(result.error);
      if (result?.needsEmailConfirmation) setNotice(result.message ?? null);
    });
  }

  if (notice) {
    return (
      <div className="text-center">
        <div className="mb-3 text-4xl">📬</div>
        <p className="text-sm text-ink-900">{notice}</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="role" value={role} />

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setRole("user")}
          className={cn(
            "rounded-xl border p-3 text-left text-sm transition-colors",
            role === "user"
              ? "border-primary bg-primary-50 font-semibold text-primary-700"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          🔍 Fırsatları keşfetmek istiyorum
        </button>
        <button
          type="button"
          onClick={() => setRole("business")}
          className={cn(
            "rounded-xl border p-3 text-left text-sm transition-colors",
            role === "business"
              ? "border-primary bg-primary-50 font-semibold text-primary-700"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          🏪 İşletme sahibiyim
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">
          Ad Soyad
        </label>
        <Input
          type="text"
          name="fullName"
          required
          placeholder="Adın Soyadın"
        />
      </div>
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
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">
          Şifre
        </label>
        <Input
          type="password"
          name="password"
          required
          minLength={6}
          placeholder="En az 6 karakter"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-tile-50 px-3 py-2 text-sm text-tile-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Kayıt Ol</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-semibold text-primary-600">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
