import { notFound } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getMyEventDetail } from "@/lib/events/queries";
import EventForm from "@/components/panel/event-form";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const event = await getMyEventDetail(params.id, business.id);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Etkinliği Düzenle
      </h1>
      <EventForm event={event} />
    </div>
  );
}
