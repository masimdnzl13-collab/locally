"use client";

import { useState, useTransition } from "react";
import { createEventAction, updateEventAction } from "@/lib/events/actions";
import SubmitButton from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import type { PanelEventDetail } from "@/lib/events/queries";

const inputClass =
  "w-full rounded-input border border-border bg-card px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

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
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
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
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700"
            />
            {event?.image_url && (
              <p className="mt-1 text-xs text-muted-foreground">Boş bırakılırsa mevcut görsel korunur.</p>
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
              className={cn(inputClass, started && "bg-muted text-muted-foreground")}
            />
            {started && (
              <p className="mt-1 text-xs text-muted-foreground">
                Etkinlik başladığı için tarih değiştirilemez.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold text-foreground">Etkinlik Türü</h2>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setEventType("free")}
            className={cn(
              "flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors",
              eventType === "free"
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-border text-muted-foreground"
            )}
          >
            Ücretsiz Katılım
          </button>
          <button
            type="button"
            onClick={() => setEventType("paid")}
            className={cn(
              "flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors",
              eventType === "paid"
                ? "border-teal-600 bg-teal-50 text-teal-700"
                : "border-border text-muted-foreground"
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
