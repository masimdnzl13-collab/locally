"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SEGMENTS, type Segment } from "@/lib/customers/segments";
import { ANNOUNCEMENT_TEMPLATES, personalize } from "@/lib/announcements/templates";
import { getSegmentRecipientsAction, sendAnnouncementAction } from "@/lib/announcements/actions";
import { isNightHours, SMS_PRICING } from "@/lib/announcements/time";

type Channel = "sms" | "email";

export default function AnnouncementWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [segment, setSegment] = useState<Segment>("tumu");
  const [channel, setChannel] = useState<Channel>("sms");
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [sampleName, setSampleName] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("segment", segment);
      const result = await getSegmentRecipientsAction(formData);
      if (result.count !== undefined) setCount(result.count);
      setSampleName(result.recipients?.[0]?.full_name ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  useEffect(() => {
    if (step === 3) {
      setNight(isNightHours());
    }
  }, [step]);

  function applyTemplate(key: string) {
    const tpl = ANNOUNCEMENT_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    setTemplateKey(key);
    setContent(tpl.body);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("segment", segment);
      formData.set("channel", channel);
      formData.set("content", content);
      formData.set("templateKey", templateKey ?? "");
      const result = await sendAnnouncementAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(result.recipientCount ?? 0);
      router.refresh();
    });
  }

  if (sent !== null) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
        <div className="stamp mx-auto mb-3 flex h-14 w-14 items-center justify-center text-2xl text-primary-700">
          ✓
        </div>
        <p className="text-lg font-bold text-ink-900">Duyuru gönderildi</p>
        <p className="mt-1 text-sm text-muted-foreground">{sent} kişiye ulaştı.</p>
        <button
          onClick={() => router.push("/panel/duyurular")}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
        >
          Duyurulara Dön
        </button>
      </div>
    );
  }

  const smsSegments = Math.max(1, Math.ceil(content.length / SMS_PRICING.segmentLength));
  const estimatedCost =
    channel === "sms" && count ? (count * smsSegments * SMS_PRICING.unitPrice).toFixed(2) : null;
  const previewText = personalize(content, sampleName ?? "Ayşe Yılmaz");

  return (
    <div>
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                n === step && "bg-primary text-white",
                n < step && "bg-primary/20 text-primary-700",
                n > step && "bg-sand-100 text-sepia-400"
              )}
            >
              {n < step ? "✓" : n}
            </div>
            {n < 3 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-tile-50 px-3 py-2 text-sm text-tile-600">{error}</p>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-ink-900">Hedef Kitle</h2>
          <div className="grid grid-cols-2 gap-2">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSegment(s.id)}
                className={cn(
                  "rounded-md border px-4 py-3 text-left text-sm font-semibold transition-colors",
                  segment === s.id
                    ? "border-primary bg-primary/10 text-primary-700"
                    : "border-border text-muted-foreground"
                )}
              >
                {s.id === "tumu" ? "Tüm müşterilerim" : s.label}
              </button>
            ))}
          </div>
          <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            {count === null ? "Hesaplanıyor..." : `${count} kişiye ulaşacaksın`}
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600"
          >
            Devam Et
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-ink-900">Kanal ve İçerik</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setChannel("sms")}
              className={cn(
                "flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors",
                channel === "sms"
                  ? "border-primary bg-primary/10 text-primary-700"
                  : "border-border text-muted-foreground"
              )}
            >
              SMS
            </button>
            <button
              onClick={() => setChannel("email")}
              className={cn(
                "flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors",
                channel === "email"
                  ? "border-primary bg-primary/10 text-primary-700"
                  : "border-border text-muted-foreground"
              )}
            >
              E-posta
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ANNOUNCEMENT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => applyTemplate(tpl.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  templateKey === tpl.key
                    ? "border-primary bg-primary/10 text-primary-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Duyuru metnini yaz... {{isim}} yazarak müşteri adını kişiselleştirebilirsin."
              className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {channel === "sms" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {content.length} karakter · {smsSegments} SMS
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Geri
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!content.trim()}
              className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
            >
              Devam Et
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-ink-900">Önizleme ve Gönderim</h2>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Örnek görünüm — {sampleName ?? "Ayşe Yılmaz"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-900">{previewText}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Toplam Alıcı</p>
              <p className="font-sans text-lg font-bold tabular-nums text-ink-900">{count ?? "—"}</p>
            </div>
            {estimatedCost && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Tahmini SMS Maliyeti</p>
                <p className="font-sans text-lg font-bold tabular-nums text-ink-900">{estimatedCost}₺</p>
              </div>
            )}
          </div>

          {night && (
            <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent-700">
              Gece 21:00–09:00 arası duyuru gönderimi engellidir. Sabah 09:00&apos;dan sonra
              tekrar dene.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Geri
            </button>
            <button
              onClick={handleSend}
              disabled={isPending || night}
              className="flex-1 rounded-md bg-accent px-4 py-3 text-sm font-bold text-ink-950 transition-all duration-200 hover:bg-accent-500 hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isPending ? "Gönderiliyor..." : "Gönder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
