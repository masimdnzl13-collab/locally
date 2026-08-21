"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin, Image as ImageIcon, Package, QrCode } from "lucide-react";
import { saveBusinessInfoAction, saveBusinessImagesAction } from "@/lib/business/actions";
import SubmitButton from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/lib/types";
import type { OnboardingStatus } from "@/lib/business/onboarding";
import type { Business } from "@/lib/types";

const inputClass =
  "w-full rounded-input border border-border bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

const fileInputClass =
  "w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700";

type StepKey = "info" | "images" | "pkg" | "qr";

export default function OnboardingChecklist({
  business,
  status,
}: {
  business: Pick<Business, "category" | "district" | "address" | "phone" | "instagram" | "description">;
  status: OnboardingStatus;
}) {
  const nextStep = (["info", "images", "pkg", "qr"] as StepKey[]).find(
    (key) => !status[key]
  );
  const [openStep, setOpenStep] = useState<StepKey | null>(nextStep ?? null);

  const percent = Math.round((status.doneCount / 4) * 100);

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border bg-navy-900 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white">İşletmeni Kur</h2>
          <span className="text-xs font-semibold text-teal-300">{status.doneCount}/4 tamamlandı</span>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-teal-400 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border">
        <InfoStep
          business={business}
          done={status.info}
          isNext={nextStep === "info"}
          open={openStep === "info"}
          onToggle={() => setOpenStep((s) => (s === "info" ? null : "info"))}
        />
        <ImagesStep
          done={status.images}
          isNext={nextStep === "images"}
          open={openStep === "images"}
          onToggle={() => setOpenStep((s) => (s === "images" ? null : "images"))}
        />
        <LinkStep
          icon={Package}
          title="İlk kış paketini oluştur"
          description="Müşterilerin satın alabileceği ilk indirimli paketini yayınla."
          done={status.pkg}
          isNext={nextStep === "pkg"}
          href="/panel/paketler/yeni"
          cta="Paket Oluştur"
        />
        <LinkStep
          icon={QrCode}
          title="QR standını görüntüle veya yazdır"
          description="Müşterilerin masada okutacağı QR standını görüntüle, istersen yazdır."
          done={status.qr}
          isNext={nextStep === "qr"}
          href="/panel/qr-standi"
          cta="QR Standını Görüntüle"
        />
      </div>
    </div>
  );
}

function StepShell({
  icon: Icon,
  title,
  description,
  done,
  isNext,
  open,
  onToggle,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  description: string;
  done: boolean;
  isNext: boolean;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("px-5 py-4", isNext && !done && "bg-teal-50/40")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            done ? "bg-teal-100 text-teal-700" : "bg-stone-100 text-stone-500"
          )}
        >
          {done ? <Check size={16} /> : <Icon size={16} />}
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {isNext && !done && (
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Sırada
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        </span>
        {onToggle && (
          <ChevronDown
            size={16}
            className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {open && <div className="mt-4 pl-11">{children}</div>}
    </div>
  );
}

function InfoStep({
  business,
  done,
  isNext,
  open,
  onToggle,
}: {
  business: Pick<Business, "category" | "district" | "address" | "phone" | "instagram" | "description">;
  done: boolean;
  isNext: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveBusinessInfoAction(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <StepShell
      icon={MapPin}
      title="İşletme bilgilerini tamamla"
      description="Kategori, mahalle, adres ve telefon — müşterilerin seni bulması için gerekli."
      done={done}
      isNext={isNext}
      open={open}
      onToggle={onToggle}
    >
      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Kategori</label>
          <select name="category" required defaultValue={business.category} className={inputClass}>
            {Object.entries(BUSINESS_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value as BusinessCategory}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Mahalle</label>
          <input
            type="text"
            name="district"
            required
            defaultValue={business.district ?? ""}
            className={inputClass}
            placeholder="Örn. Gümbet"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Adres</label>
          <input
            type="text"
            name="address"
            required
            defaultValue={business.address ?? ""}
            className={inputClass}
            placeholder="Açık adres"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Telefon</label>
          <input
            type="tel"
            name="phone"
            required
            defaultValue={business.phone ?? ""}
            className={inputClass}
            placeholder="05xx xxx xx xx"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Instagram (opsiyonel)</label>
          <input
            type="text"
            name="instagram"
            defaultValue={business.instagram ?? ""}
            className={inputClass}
            placeholder="@kullaniciadi"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Kısa açıklama (opsiyonel)</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={business.description ?? ""}
            className={inputClass}
            placeholder="İşletmeni birkaç cümleyle anlat"
          />
        </div>
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
        )}
        <SubmitButton pending={isPending} className="w-auto px-6">
          Kaydet
        </SubmitButton>
      </form>
    </StepShell>
  );
}

function ImagesStep({
  done,
  isNext,
  open,
  onToggle,
}: {
  done: boolean;
  isNext: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveBusinessImagesAction(formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <StepShell
      icon={ImageIcon}
      title="Görselleri yükle"
      description="Logo ve kapak fotoğrafı — telefon kamerasıyla doğrudan çekebilirsin."
      done={done}
      isNext={isNext}
      open={open}
      onToggle={onToggle}
    >
      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Logo</label>
          <input type="file" name="logo" accept="image/*" capture="environment" className={fileInputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">Kapak Görseli</label>
          <input type="file" name="cover" accept="image/*" capture="environment" className={fileInputClass} />
        </div>
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
        )}
        <SubmitButton pending={isPending} className="w-auto px-6">
          Yükle
        </SubmitButton>
      </form>
    </StepShell>
  );
}

function LinkStep({
  icon: Icon,
  title,
  description,
  done,
  isNext,
  href,
  cta,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  done: boolean;
  isNext: boolean;
  href: string;
  cta: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-4", isNext && !done && "bg-teal-50/40")}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          done ? "bg-teal-100 text-teal-700" : "bg-stone-100 text-stone-500"
        )}
      >
        {done ? <Check size={16} /> : <Icon size={16} />}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {isNext && !done && (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Sırada
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <Link
        href={href}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
      >
        {done ? "Görüntüle" : cta}
      </Link>
    </div>
  );
}
