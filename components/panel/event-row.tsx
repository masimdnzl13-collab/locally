import Link from "next/link";
import type { PanelEvent } from "@/lib/events/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusOf(event: PanelEvent) {
  if (event.removed_by_admin) {
    return { label: "Admin Tarafından Kaldırıldı", cls: "bg-danger-100 text-danger-700" };
  }
  if (event.is_cancelled) return { label: "İptal Edildi", cls: "bg-danger-50 text-danger-600" };
  if (new Date(event.event_at) < new Date()) {
    return { label: "Geçmiş", cls: "bg-stone-100 text-stone-700" };
  }
  if (event.capacity !== null && event.ticket_count >= event.capacity) {
    return { label: "Kontenjan Doldu", cls: "bg-discount-50 text-discount-700" };
  }
  return { label: "Yaklaşıyor", cls: "bg-teal-50 text-teal-700" };
}

export default function EventRow({ event }: { event: PanelEvent }) {
  const status = statusOf(event);

  return (
    <Link
      href={`/panel/etkinlikler/${event.id}`}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🎉</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold text-foreground">{event.title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.cls}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.event_at)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {event.ticket_count} katılımcı{event.capacity !== null ? ` / ${event.capacity} kontenjan` : ""}{" "}
          · {event.is_paid ? formatTL(event.ticket_price ?? 0) : "Ücretsiz"}
        </p>
      </div>
    </Link>
  );
}
