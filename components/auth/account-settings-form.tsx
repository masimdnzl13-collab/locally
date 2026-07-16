"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateProfileAction } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/components/ui/submit-button";

export default function AccountSettingsForm({
  email,
  fullName,
  phone,
}: {
  email: string;
  fullName: string | null;
  phone: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result?.error) setError(result.error);
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">E-posta</label>
        <Input value={email} disabled />
        <p className="mt-1 text-xs text-muted-foreground">E-posta adresi şu an değiştirilemiyor.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Ad Soyad</label>
        <Input name="fullName" defaultValue={fullName ?? ""} placeholder="Adın Soyadın" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Telefon</label>
        <Input name="phone" type="tel" defaultValue={phone ?? ""} placeholder="05xx xxx xx xx" />
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

      <SubmitButton pending={isPending}>Kaydet</SubmitButton>
    </form>
  );
}
