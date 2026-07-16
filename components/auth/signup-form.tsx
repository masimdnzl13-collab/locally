"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Compass, MailCheck, Store } from "lucide-react";
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
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <MailCheck size={22} strokeWidth={1.75} />
        </div>
        <p className="text-sm text-foreground">{notice}</p>
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
            "flex items-center gap-2.5 rounded-input border p-3 text-left text-sm transition-colors",
            role === "user"
              ? "border-teal-600 bg-teal-50 font-semibold text-teal-700"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <Compass size={18} strokeWidth={2} className="shrink-0" />
          Fırsatları keşfetmek istiyorum
        </button>
        <button
          type="button"
          onClick={() => setRole("business")}
          className={cn(
            "flex items-center gap-2.5 rounded-input border p-3 text-left text-sm transition-colors",
            role === "business"
              ? "border-teal-600 bg-teal-50 font-semibold text-teal-700"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <Store size={18} strokeWidth={2} className="shrink-0" />
          İşletme sahibiyim
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">
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
        <label className="mb-1.5 block text-sm font-medium text-foreground">
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
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </p>
      )}

      <SubmitButton pending={isPending}>Kayıt Ol</SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="font-semibold text-teal-700">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
