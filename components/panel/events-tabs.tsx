"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import EventRow from "@/components/panel/event-row";
import type { PanelEvent } from "@/lib/events/queries";

export default function EventsTabs({ events }: { events: PanelEvent[] }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const upcoming = events.filter((e) => new Date(e.event_at) >= new Date());
  const past = events.filter((e) => new Date(e.event_at) < new Date());
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      <SegmentedControl
        className="mb-4 inline-flex"
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: `Yaklaşan (${upcoming.length})` },
          { value: "past", label: `Geçmiş (${past.length})` },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === "upcoming" ? "Yaklaşan etkinliğin yok" : "Henüz geçmiş etkinliğin yok"}
        />
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
