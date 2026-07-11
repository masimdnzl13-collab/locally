"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import EventCard from "@/components/events/event-card";
import type { EventListItem } from "@/lib/events/queries";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cts"];

function buildDays() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = i === 0 ? "Bugün" : i === 1 ? "Yarın" : WEEKDAY_SHORT[d.getDay()];
    days.push({ key: dayKey(d), label, dayNumber: d.getDate() });
  }
  return days;
}

export default function DayEventsView({ events }: { events: EventListItem[] }) {
  const days = useMemo(buildDays, []);
  const [selected, setSelected] = useState(days[0].key);

  const shown = events.filter((e) => dayKey(new Date(e.event_at)) === selected);

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-dark-900">
        Etkinlikler
      </h1>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => setSelected(d.key)}
            className={cn(
              "flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors",
              selected === d.key
                ? "border-primary bg-primary text-white"
                : "border-slate-200 text-slate-600 hover:border-primary/40"
            )}
          >
            <span>{d.label}</span>
            <span className="text-xs opacity-70">{d.dayNumber}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-4xl">🗓️</div>
          <p className="font-medium text-dark-900">Bu gün için etkinlik yok</p>
          <p className="mt-1 text-sm text-slate-500">Başka bir güne göz atabilirsin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
