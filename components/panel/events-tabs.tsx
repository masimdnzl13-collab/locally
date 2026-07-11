"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import EventRow from "@/components/panel/event-row";
import type { PanelEvent } from "@/lib/events/queries";

export default function EventsTabs({ events }: { events: PanelEvent[] }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const upcoming = events.filter((e) => new Date(e.event_at) >= new Date());
  const past = events.filter((e) => new Date(e.event_at) < new Date());
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("upcoming")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            tab === "upcoming" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Yaklaşan ({upcoming.length})
        </button>
        <button
          onClick={() => setTab("past")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold",
            tab === "past" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          Geçmiş ({past.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            {tab === "upcoming" ? "Yaklaşan etkinliğin yok." : "Henüz geçmiş etkinliğin yok."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
