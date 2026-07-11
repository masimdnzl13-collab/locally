import Link from "next/link";
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
    <Link
      href={`/etkinlik/${event.id}`}
      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🎉</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-500">{event.business.name}</p>
        <p className="truncate font-bold text-dark-900">{event.title}</p>
        <p className="text-xs text-slate-400">{formatTime(event.event_at)}</p>
      </div>
      <div className="shrink-0 text-right">
        {full ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
            Kontenjan doldu
          </span>
        ) : event.is_paid ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-700">
            {formatTL(event.ticket_price ?? 0)}
          </span>
        ) : (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent-700">
            Ücretsiz
          </span>
        )}
      </div>
    </Link>
  );
}
