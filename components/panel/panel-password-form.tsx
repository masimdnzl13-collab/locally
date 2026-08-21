"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updatePanelPasswordAction } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/components/ui/submit-button";

export default function PanelPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updatePanelPasswordAction(formData);
      if (result?.error) setError(result.error);
      if (result?.message) {
        setMessage(result.message);
        (document.getElementById("panel-password-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="panel-password-form" action={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Yeni Şifre</label>
        <Input type="password" name="password" required minLength={8} placeholder="En az 8 karakter" />
      </div>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
      )}
      {message && (
        <p className="flex items-center gap-1.5 rounded-md bg-success-50 px-3 py-2 text-sm text-success-700">
          <Check size={15} />
          {message}
        </p>
      )}

      <SubmitButton pending={isPending} className="w-auto px-6">
        Şifreyi Güncelle
      </SubmitButton>
    </form>
  );
}
