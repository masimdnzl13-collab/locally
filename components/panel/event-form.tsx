"use client";

import { useState, useTransition } from "react";
import { createEventAction, updateEventAction } from "@/lib/events/actions";
import SubmitButton from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { PanelEventDetail } from "@/lib/events/queries";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "mb-1.5 block text-sm font-medium text-dark-900";

function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function EventForm({ event }: { event?: PanelEventDetail }) {
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState<"free" | "paid">(
    event?.is_paid ? "paid" : "free"
  );
  const [isPending, startTransition] = useTransition();
  const isEdit = !!event;
  const started = event ? new Date(event.event_at) < new Date() : false;

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("event_type", eventType);
    startTransition(async () => {
      const action = isEdit ? updateEventAction : createEventAction;
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {isEdit && <input type="hidden" name="eventId" value={event!.id} />}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Başlık</label>
            <input
              type="text"
              name="title"
              required
              defaultValue={event?.title}
              className={inputClass}
              placeholder="Örn. Canlı Müzik Gecesi"
            />
          </div>
          <div>
            <label className={labelClass}>Açıklama</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event?.description ?? ""}
              className={inputClass}
              placeholder="Etkinliği kısaca anlat"
            />
          </div>
          <div>
            <label className={labelClass}>Görsel</label>
            <input
              type="file"
              name="image"
              accept="image/*"
              className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700"
            />
            {event?.image_url && (
              <p className="mt-1 text-xs text-slate-400">Boş bırakılırsa mevcut görsel korunur.</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Tarih ve Saat</label>
            <input
              type="datetime-local"
              name="event_at"
              required
              disabled={started}
              defaultValue={event ? toLocalDateTimeInput(event.event_at) : undefined}
              className={cn(inputClass, started && "bg-slate-50 text-slate-400")}
            />
            {started && (
              <p className="mt-1 text-xs text-slate-400">
                Etkinlik başladığı için tarih değiştirilemez.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-dark-900">Etkinlik Türü</h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setEventType("free")}
            className={cn(
              "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold",
              eventType === "free"
                ? "border-primary bg-primary/10 text-primary-700"
                : "border-slate-200 text-slate-500"
            )}
          >
            Ücretsiz Katılım
          </button>
          <button
            type="button"
            onClick={() => setEventType("paid")}
            className={cn(
              "flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold",
              eventType === "paid"
                ? "border-primary bg-primary/10 text-primary-700"
                : "border-slate-200 text-slate-500"
            )}
          >
            Biletli
          </button>
        </div>

        {eventType === "paid" && (
          <div className="mb-4">
            <label className={labelClass}>Bilet Fiyatı (₺)</label>
            <input
              type="number"
              name="ticket_price"
              min={0.01}
              step="0.01"
              required
              defaultValue={event?.ticket_price ?? ""}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>
            Kontenjan{eventType === "free" ? " — boş bırakılırsa sınırsız" : ""}
          </label>
          <input
            type="number"
            name="capacity"
            min={0}
            required={eventType === "paid"}
            defaultValue={event?.capacity ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <SubmitButton pending={isPending}>
        {isEdit ? "Değişiklikleri Kaydet" : "Etkinliği Yayınla"}
      </SubmitButton>
    </form>
  );
}
