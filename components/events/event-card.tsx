import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventListItem } from "@/lib/events/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function EventCard({ event }: { event: EventListItem }) {
  const full = event.capacity !== null && event.ticket_count >= event.capacity;

  return (
    <Link href={`/etkinlik/${event.id}`}>
      <Card hoverLift className="flex items-center gap-4 p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.image_url}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-500 to-primary-800">
              <CalendarDays className="h-6 w-6 text-white/90" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{event.business.name}</p>
          <p className="truncate font-semibold text-foreground">{event.title}</p>
          <p className="text-xs text-muted-foreground/80">{formatTime(event.event_at)}</p>
        </div>
        <div className="shrink-0">
          {full ? (
            <Badge variant="neutral">Kontenjan doldu</Badge>
          ) : event.is_paid ? (
            <Badge variant="primary">{formatTL(event.ticket_price ?? 0)}</Badge>
          ) : (
            <Badge variant="accent">Ücretsiz</Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
