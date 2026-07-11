"use client";

import { useState, useTransition } from "react";
import {
  saveOnboardingStepOne,
  saveOnboardingStepTwo,
  finishOnboarding,
} from "@/lib/business/actions";
import SubmitButton from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const STEP_LABELS = ["İşletme", "Konum", "Görseller"];

export default function OnboardingWizard({
  initialStep,
  initialData,
}: {
  initialStep: 1 | 2 | 3;
  initialData: {
    name?: string;
    category?: string;
    description?: string;
    district?: string;
    address?: string;
    phone?: string;
    instagram?: string;
  };
}) {
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStepOne(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingStepOne(formData);
      if (result?.error) setError(result.error);
      else setStep(2);
    });
  }

  function handleStepTwo(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingStepTwo(formData);
      if (result?.error) setError(result.error);
      else setStep(3);
    });
  }

  function handleStepThree(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboarding(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  active && "bg-primary text-white",
                  done && "bg-primary/20 text-primary-700",
                  !active && !done && "bg-slate-100 text-slate-400"
                )}
              >
                {done ? "✓" : n}
              </div>
              {n < 3 && <div className="h-px w-6 bg-slate-200" />}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {step === 1 && (
        <form action={handleStepOne} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              İşletme Adı
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={initialData.name}
              className={inputClass}
              placeholder="Örn. Liman Kafe"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Kategori
            </label>
            <select
              name="category"
              required
              defaultValue={initialData.category}
              className={inputClass}
            >
              <option value="" disabled>
                Seç
              </option>
              {Object.entries(BUSINESS_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value as BusinessCategory}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Kısa Açıklama
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={initialData.description}
              className={inputClass}
              placeholder="İşletmeni birkaç cümleyle anlat"
            />
          </div>
          <SubmitButton pending={isPending}>Devam Et</SubmitButton>
        </form>
      )}

      {step === 2 && (
        <form action={handleStepTwo} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Mahalle
            </label>
            <input
              type="text"
              name="district"
              required
              defaultValue={initialData.district}
              className={inputClass}
              placeholder="Örn. Gümbet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Adres
            </label>
            <input
              type="text"
              name="address"
              required
              defaultValue={initialData.address}
              className={inputClass}
              placeholder="Açık adres"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Telefon
            </label>
            <input
              type="tel"
              name="phone"
              required
              defaultValue={initialData.phone}
              className={inputClass}
              placeholder="05xx xxx xx xx"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Instagram
            </label>
            <input
              type="text"
              name="instagram"
              defaultValue={initialData.instagram}
              className={inputClass}
              placeholder="@kullaniciadi"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              Geri
            </button>
            <SubmitButton pending={isPending}>Devam Et</SubmitButton>
          </div>
        </form>
      )}

      {step === 3 && (
        <form action={handleStepThree} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Logo
            </label>
            <input
              type="file"
              name="logo"
              accept="image/*"
              required
              className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-dark-900">
              Kapak Görseli
            </label>
            <input
              type="file"
              name="cover"
              accept="image/*"
              required
              className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              Geri
            </button>
            <SubmitButton pending={isPending}>Başvuruyu Gönder</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
