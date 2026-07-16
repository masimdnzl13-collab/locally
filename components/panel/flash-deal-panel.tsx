"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFlashDealAction, endFlashDealAction } from "@/lib/flash-deals/actions";
import { useCountdown } from "@/components/flash/use-countdown";
import { cn } from "@/lib/utils";
import type { PanelFlashDeal } from "@/lib/flash-deals/queries";

const TIME_PRESETS = [
  { label: "Akşam 19–22", start: "19:00", end: "22:00" },
  { label: "Tüm Gün", start: "00:00", end: "23:59" },
  { label: "Öğlen 12–15", start: "12:00", end: "15:00" },
];

function todayAt(time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatWindow(startsAt: string, endsAt: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(startsAt).toLocaleTimeString("tr-TR", opts)}–${new Date(
    endsAt
  ).toLocaleTimeString("tr-TR", opts)}`;
}

function LiveFlashCard({ deal }: { deal: PanelFlashDeal }) {
  const router = useRouter();
  const countdown = useCountdown(deal.ends_at);
  const [isPending, startTransition] = useTransition();
  const reservedCount = deal.total_quota - deal.remaining_quota;

  function handleEnd() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("flashDealId", deal.id);
      await endFlashDealAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-accent/30 bg-accent/5">
      <div className="flex items-center justify-between bg-accent px-5 py-3">
        <span className="text-sm font-bold text-ink-950">🔥 Flaşın Şu An Canlı</span>
        <span className="rounded-full bg-ink-950/10 px-2.5 py-1 text-xs font-bold tabular-nums text-ink-950">
          {countdown.expired ? "Süresi doldu" : countdown.label}
        </span>
      </div>
      <div className="p-5">
        <p className="text-lg font-bold text-ink-900">{deal.offer_text}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Geçerlilik: {formatWindow(deal.starts_at, deal.ends_at)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-card p-3">
            <p className="text-xs text-muted-foreground">Kalan / Toplam</p>
            <p className="mt-0.5 font-sans text-xl font-bold tabular-nums text-ink-900">
              {deal.remaining_quota} / {deal.total_quota}
            </p>
          </div>
          <div className="rounded-md bg-card p-3">
            <p className="text-xs text-muted-foreground">Yer Ayırtan</p>
            <p className="mt-0.5 font-sans text-xl font-bold tabular-nums text-ink-900">{reservedCount} kişi</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnd}
          disabled={isPending}
          className="mt-5 w-full rounded-md border border-tile-200 bg-card px-4 py-3 text-sm font-bold text-tile-600 transition-colors hover:bg-tile-50 disabled:opacity-60"
        >
          {isPending ? "Bir saniye..." : "Flaşı Bitir"}
        </button>
      </div>
    </div>
  );
}

function CreateFlashForm() {
  const router = useRouter();
  const [offerText, setOfferText] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("22:00");
  const [quota, setQuota] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyPreset(preset: (typeof TIME_PRESETS)[number]) {
    setStartTime(preset.start);
    setEndTime(preset.end);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("offerText", offerText);
    formData.set("startsAt", todayAt(startTime).toISOString());
    formData.set("endsAt", todayAt(endTime).toISOString());
    formData.set("quota", String(quota));

    startTransition(async () => {
      const result = await createFlashDealAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-5">
      {error && (
        <p className="rounded-md bg-tile-50 px-3 py-2 text-sm text-tile-600">{error}</p>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">Teklif Metni</label>
        <input
          type="text"
          value={offerText}
          onChange={(e) => setOfferText(e.target.value)}
          required
          maxLength={120}
          placeholder="19:00–22:00 arası ana yemekler yarı fiyat"
          className="w-full rounded-md border border-border bg-card px-4 py-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">Saat Aralığı</label>
        <div className="mb-2 flex flex-wrap gap-2">
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                startTime === preset.start && endTime === preset.end
                  ? "border-primary bg-primary/10 text-primary-700"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-900">Kontenjan</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuota((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg font-bold text-muted-foreground transition-colors hover:bg-muted"
          >
            −
          </button>
          <span className="w-12 text-center font-sans text-lg font-bold tabular-nums text-ink-900">{quota}</span>
          <button
            type="button"
            onClick={() => setQuota((q) => q + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg font-bold text-muted-foreground transition-colors hover:bg-muted"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-md bg-accent px-4 py-3.5 text-base font-extrabold text-ink-950 transition-all duration-200 hover:bg-accent-500 hover:-translate-y-0.5 disabled:opacity-60"
      >
        {isPending ? "Yayınlanıyor..." : "🔥 Flaşı Yayınla"}
      </button>
    </form>
  );
}

function HistorySection({ history }: { history: PanelFlashDeal[] }) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-bold text-ink-900">Geçmiş Flaşlar</h2>
      <ul className="divide-y divide-border">
        {history.map((deal) => (
          <li key={deal.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{deal.offer_text}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(deal.created_at).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {formatWindow(deal.starts_at, deal.ends_at)}
              </p>
              {deal.removed_by_admin && (
                <p className="text-xs font-semibold text-tile-600">Admin tarafından kaldırıldı</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-bold text-sepia-700">
              {deal.total_quota - deal.remaining_quota} ayırtma
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FlashDealPanel({
  liveFlash,
  history,
}: {
  liveFlash: PanelFlashDeal | null;
  history: PanelFlashDeal[];
}) {
  return (
    <div className="space-y-5">
      {liveFlash ? <LiveFlashCard deal={liveFlash} /> : <CreateFlashForm />}

      {!liveFlash && (
        <div className="rounded-xl bg-primary/5 p-4 text-sm text-primary-800">
          <p className="mb-1 font-bold">💡 İpucu</p>
          <ul className="list-inside list-disc space-y-1 text-primary-700">
            <li>En çok ilgi gören flaşlar somut ve saat aralıklı olanlar.</li>
            <li>Net bir indirim yüzdesi veya ürün adı belirtmek katılımı artırır.</li>
            <li>Akşamüstü paylaşılan flaşlar aynı gün en yüksek dönüşümü alır.</li>
          </ul>
        </div>
      )}

      <HistorySection history={history} />
    </div>
  );
}
