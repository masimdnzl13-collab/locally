"use client";

import { useState, useTransition } from "react";
import { createPackageAction, updatePackageAction } from "@/lib/packages/actions";
import SubmitButton from "@/components/ui/submit-button";
import type { Package } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-900";

function toLocalDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold text-ink-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export default function PackageForm({
  pkg,
  hasSales,
  fallbackCoverUrl,
}: {
  pkg?: Package;
  hasSales?: boolean;
  fallbackCoverUrl?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!pkg;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const action = isEdit ? updatePackageAction : createPackageAction;
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {isEdit && <input type="hidden" name="packageId" value={pkg!.id} />}

      {error && (
        <p className="rounded-md bg-tile-50 px-3 py-2 text-sm text-tile-600">{error}</p>
      )}

      {hasSales && (
        <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent-700">
          Bu pakette satış var: hak sayısı düşürülemez, fiyat değişikliği yalnızca yeni
          satışları etkiler.
        </p>
      )}

      <Section title="Temel Bilgiler">
        <div>
          <label className={labelClass}>Başlık</label>
          <input
            type="text"
            name="title"
            required
            defaultValue={pkg?.title}
            className={inputClass}
            placeholder="Örn. Serpme Kahvaltı Paketi"
          />
        </div>
        <div>
          <label className={labelClass}>Açıklama</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={pkg?.description ?? ""}
            className={inputClass}
            placeholder="Paketi kısaca anlat"
          />
        </div>
        <div>
          <label className={labelClass}>Görsel</label>
          <input
            type="file"
            name="image"
            accept="image/*"
            className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Boş bırakılırsa {pkg?.image_url ? "mevcut görsel korunur" : "işletmenin kapak görseli kullanılır"}
            {!pkg?.image_url && !fallbackCoverUrl ? " (kapak görseli yoksa boş kalır)." : "."}
          </p>
        </div>
      </Section>

      <Section title="Fiyatlandırma">
        <div>
          <label className={labelClass}>Satış Fiyatı (₺)</label>
          <input
            type="number"
            name="sale_price"
            required
            min={0}
            step="0.01"
            defaultValue={pkg?.sale_price}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Referans Yaz Fiyatı (₺)</label>
          <input
            type="number"
            name="summer_reference_price"
            required
            min={0}
            step="0.01"
            defaultValue={pkg?.summer_reference_price}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Bu paketin içeriğinin yaz sezonundaki gerçek fiyatı; vitrinde karşılaştırma
            olarak gösterilir. Satış fiyatından yüksek olmalı.
          </p>
        </div>
        <div>
          <label className={labelClass}>Normal Kış Değeri (₺) — isteğe bağlı</label>
          <input
            type="number"
            name="normal_value"
            min={0}
            step="0.01"
            defaultValue={pkg?.normal_value ?? ""}
            className={inputClass}
          />
        </div>
      </Section>

      <Section title="Haklar">
        <div>
          <label className={labelClass}>Hak Sayısı</label>
          <input
            type="number"
            name="usage_count"
            required
            min={1}
            defaultValue={pkg?.usage_count ?? 1}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Paketin kaç kullanım içerdiği. {hasSales && "Satış olduğu için düşürülemez."}
          </p>
        </div>
        <div>
          <label className={labelClass}>Her Hakkın Kapsamı</label>
          <input
            type="text"
            name="usage_description"
            defaultValue={pkg?.usage_description ?? ""}
            className={inputClass}
            placeholder="Örn. 1 serpme kahvaltı, 2 kişilik"
          />
        </div>
      </Section>

      <Section title="Sınırlar">
        <div>
          <label className={labelClass}>Son Kullanma Tarihi</label>
          <input
            type="date"
            name="expires_at"
            required
            defaultValue={pkg ? toLocalDateInput(pkg.expires_at) : undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Satış Kontenjanı — boş = sınırsız</label>
          <input
            type="number"
            name="quota"
            min={0}
            defaultValue={pkg?.quota ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Kişi Başı Satın Alma Limiti</label>
          <input
            type="number"
            name="per_person_limit"
            min={1}
            defaultValue={pkg?.per_person_limit ?? 1}
            className={inputClass}
          />
        </div>
      </Section>

      <SubmitButton pending={isPending}>
        {isEdit ? "Değişiklikleri Kaydet" : "Paketi Yayınla"}
      </SubmitButton>
    </form>
  );
}
