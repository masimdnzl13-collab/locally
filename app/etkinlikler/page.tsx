import { getUpcomingEventsThisWeek } from "@/lib/events/queries";
import DayEventsView from "@/components/events/day-events-view";

export default async function EtkinliklerPage() {
  const events = await getUpcomingEventsThisWeek();
  return <DayEventsView events={events} />;
}
