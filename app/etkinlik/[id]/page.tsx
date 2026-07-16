import { notFound } from "next/navigation";
import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { getEventDetail } from "@/lib/events/queries";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import JoinBar from "@/components/events/join-bar";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getEventDetail(params.id);

  if (!event) notFound();

  const full = event.capacity !== null && event.ticket_count >= event.capacity;

  return (
    <div className="pb-40 md:pb-28">
      <div className="relative h-56 sm:h-72">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-500 to-primary-800">
            <PartyPopper className="h-14 w-14 text-white/90" strokeWidth={1.5} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 via-ink-950/5 to-transparent" />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        <Reveal>
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
            {event.title}
          </h1>
          <p className="mt-1 text-sm font-medium text-primary-600">
            {formatDateTime(event.event_at)}
          </p>

          <Link
            href={`/isletme/${event.business.slug}`}
            className="mt-3 block text-sm text-muted-foreground hover:underline"
          >
            {event.business.name}
            {event.business_district ? ` · ${event.business_district}` : ""}
          </Link>

          {event.description && (
            <p className="mt-4 text-sm text-muted-foreground">{event.description}</p>
          )}

          {event.capacity !== null && (
            <Badge variant={full ? "neutral" : "primary"} className="mt-4">
              {full
                ? "Kontenjan doldu"
                : `${event.capacity - event.ticket_count} / ${event.capacity} yer kaldı`}
            </Badge>
          )}
        </Reveal>
      </div>

      <JoinBar
        eventId={event.id}
        isPaid={event.is_paid}
        ticketPrice={event.ticket_price}
        full={full}
      />
    </div>
  );
}
