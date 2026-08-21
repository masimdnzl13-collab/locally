"use client";

import { useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { generateSignupInviteAction } from "@/lib/admin/actions";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/components/ui/submit-button";

export default function SignupInviteGenerator() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; qrDataUrl: string; name: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await generateSignupInviteAction(formData);
      if (res?.error) {
        setError(res.error);
        setResult(null);
      } else if (res?.url && res?.qrDataUrl && res?.name) {
        setResult({ url: res.url, qrDataUrl: res.qrDataUrl, name: res.name });
      }
    });
  }

  return (
    <div>
      <form action={handleSubmit} className="flex items-end gap-3 print:hidden">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-foreground">İşletme Adı</label>
          <Input type="text" name="businessName" required placeholder="Örn. Liman Kafe" />
        </div>
        <SubmitButton pending={isPending} className="w-auto px-6">
          Oluştur
        </SubmitButton>
      </form>

      {error && (
        <p className="mt-4 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600 print:hidden">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8">
          <div className="mx-auto flex w-full max-w-xs flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-card print:border-0 print:p-0 print:shadow-none">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Locally</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">Kayıt Ol</h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.qrDataUrl} alt={`${result.name} kayıt QR kodu`} className="mt-6 h-56 w-56" />
            <p className="mt-6 text-sm font-semibold text-foreground">Hesabını açmak için okut</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{result.url}</p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="mx-auto mt-6 flex items-center gap-2 rounded-md bg-navy-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800 print:hidden"
          >
            <Printer size={16} />
            Kartı Yazdır
          </button>
        </div>
      )}
    </div>
  );
}
