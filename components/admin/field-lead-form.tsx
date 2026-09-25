"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, ImageIcon, Loader2, X } from "lucide-react";
import { createFieldLeadAction } from "@/lib/admin/field-lead-actions";
import { cn } from "@/lib/utils";

// AN — tek elle, arka arkaya aday girişi. Kaydet'e basınca form sıfırlanır
// (şehir kalır — aynı sokakta gezerken tekrar yazılmasın), odak restoran
// adına döner, eklenenler aşağıda birikir. Sayfa yeniden yüklenmez.

const LAST_CITY_KEY = "locally.fieldLead.city";
// Server action gövde sınırı 1 MB; küçültülmüş fotoğraf bunun altında kalmalı.
const PHOTO_TARGET_BYTES = 900 * 1024;
const PHOTO_MAX_EDGE = 1600;

type Added = { id: string; name: string; city: string; hasPhoto: boolean };

/** Telefon kamerasının 4–12 MB'lık fotoğrafını ~1600px JPEG'e indirir; sahada mobil veriyle hızlı yüklensin. */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= PHOTO_TARGET_BYTES) return new File([blob], "photo.jpg", { type: "image/jpeg" });
    }
  } catch {
    // Tarayıcı bu biçimi çözemiyor (ör. bazı HEIC'ler): küçükse olduğu gibi gönder.
  }
  if (file.size <= PHOTO_TARGET_BYTES) return file;
  throw new Error("Fotoğraf küçültülemedi; tekrar çekmeyi dene.");
}

export default function FieldLeadForm() {
  const nameRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [interested, setInterested] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      setCity(localStorage.getItem(LAST_CITY_KEY) ?? "");
    } catch {
      // Gizli sekme vb.: şehir hatırlanmaz, sorun değil.
    }
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    if (photoRef.current) photoRef.current.value = "";
  };

  const onPhoto = async (file: File | undefined) => {
    setError(null);
    if (!file) return clearPhoto();
    setPreparingPhoto(true);
    try {
      const small = await shrinkPhoto(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch (e) {
      clearPhoto();
      setError(e instanceof Error ? e.message : "Fotoğraf eklenemedi.");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending || preparingPhoto) return;
    setError(null);
    const fd = new FormData();
    fd.set("businessName", name);
    fd.set("city", city);
    fd.set("notes", notes);
    fd.set("status", interested ? "ilgileniyor" : "tanitildi");
    if (photo) fd.set("photo", photo);
    startTransition(async () => {
      const result = await createFieldLeadAction(fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      try {
        localStorage.setItem(LAST_CITY_KEY, city.trim());
      } catch {
        // yok say
      }
      setAdded((list) => [result.lead, ...list]);
      setFlash(result.warning ?? `${result.lead.name} eklendi`);
      setName("");
      setNotes("");
      setInterested(false);
      clearPhoto();
      nameRef.current?.focus();
      window.setTimeout(() => setFlash(null), 2500);
    });
  };

  const field =
    "block w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <div className="flex-1 space-y-4 px-4 pb-32 pt-4">
        {flash && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-base font-semibold text-success-700"
          >
            <CheckCircle2 size={20} aria-hidden /> {flash}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-base font-medium text-danger-700">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="fl-name" className="mb-1.5 block text-sm font-semibold text-foreground">
            Restoran adı
          </label>
          <input
            id="fl-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Luigi's Pizza"
            className={cn(field, "h-14")}
          />
        </div>

        <div>
          <label htmlFor="fl-city" className="mb-1.5 block text-sm font-semibold text-foreground">
            Şehir
          </label>
          <input
            id="fl-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            autoComplete="address-level2"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Wildwood"
            className={cn(field, "h-14")}
          />
        </div>

        <div>
          <label htmlFor="fl-notes" className="mb-1.5 block text-sm font-semibold text-foreground">
            Not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
          </label>
          <textarea
            id="fl-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Sahibi Mike, perşembe tekrar uğra"
            className={cn(field, "py-3 text-base")}
          />
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={interested}
          onClick={() => setInterested((v) => !v)}
          className={cn(
            "flex h-14 w-full items-center justify-between rounded-xl border px-4 text-base font-semibold transition-colors",
            interested ? "border-teal-600 bg-teal-50 text-teal-800" : "border-border bg-card text-foreground"
          )}
        >
          İlgileniyor
          <span
            aria-hidden
            className={cn("relative h-7 w-12 rounded-full transition-colors", interested ? "bg-teal-600" : "bg-muted")}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
                interested ? "left-6" : "left-1"
              )}
            />
          </span>
        </button>

        <div>
          <input
            ref={photoRef}
            id="fl-photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          {preview ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob URL) */}
              <img src={preview} alt="Seçilen fotoğraf" className="h-16 w-16 rounded-lg object-cover" />
              <span className="flex-1 text-sm text-muted-foreground">Fotoğraf eklendi</span>
              <button
                type="button"
                onClick={clearPhoto}
                aria-label="Fotoğrafı kaldır"
                className="flex h-12 w-12 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
              >
                <X size={22} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="fl-photo"
              className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-base font-medium text-muted-foreground active:bg-muted"
            >
              {preparingPhoto ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
              {preparingPhoto ? "Fotoğraf hazırlanıyor…" : "Kartvizit / tabela fotoğrafı"}
            </label>
          )}
        </div>

        {added.length > 0 && (
          <section aria-label="Bu turda eklenenler" className="pt-2">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bu turda eklenenler ({added.length})
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {added.map((lead) => (
                <li key={lead.id} className="flex items-center gap-2 px-4 py-3 text-sm">
                  <span className="flex-1 font-medium text-foreground">{lead.name}</span>
                  {lead.city && <span className="text-muted-foreground">{lead.city}</span>}
                  {lead.hasPhoto && <ImageIcon size={16} className="text-muted-foreground" aria-label="Fotoğraflı" />}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Başparmak bölgesi: kaydet ekranın altına sabit. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:border-0 md:bg-transparent md:px-4">
        <button
          type="submit"
          disabled={!name.trim() || isPending || preparingPhoto}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-navy-900 text-lg font-bold text-white transition-opacity active:opacity-90 disabled:opacity-40"
        >
          {isPending && <Loader2 size={20} className="animate-spin" />}
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
