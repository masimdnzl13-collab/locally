"use client";

import { useState, useTransition } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import SubmitButton from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordForm() {
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
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">
          Yeni Şifre
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

      <SubmitButton pending={isPending}>Şifreyi Güncelle</SubmitButton>
    </form>
  );
}
