import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getMyEvents } from "@/lib/events/queries";
import EventsTabs from "@/components/panel/events-tabs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PanelEventsPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const events = await getMyEvents(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Etkinlikler
        </h1>
        <Link
          href="/panel/etkinlikler/yeni"
          className={cn(buttonVariants({ variant: "teal", size: "sm" }))}
        >
          + Yeni Etkinlik
        </Link>
      </div>

      <EventsTabs events={events} />
    </div>
  );
}
