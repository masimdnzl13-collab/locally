import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventDetail } from "@/lib/events/queries";
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
      <div className="relative h-56 bg-slate-100 sm:h-72">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">🎉</div>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
          {event.title}
        </h1>
        <p className="mt-1 text-sm font-medium text-primary-600">
          {formatDateTime(event.event_at)}
        </p>

        <Link
          href={`/isletme/${event.business.slug}`}
          className="mt-3 block text-sm text-slate-500 hover:underline"
        >
          {event.business.name}
          {event.business_district ? ` · ${event.business_district}` : ""}
        </Link>

        {event.description && (
          <p className="mt-4 text-sm text-slate-600">{event.description}</p>
        )}

        {event.capacity !== null && (
          <p className="mt-4 text-xs font-semibold text-slate-500">
            {full
              ? "Kontenjan doldu"
              : `${event.capacity - event.ticket_count} / ${event.capacity} yer kaldı`}
          </p>
        )}
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
