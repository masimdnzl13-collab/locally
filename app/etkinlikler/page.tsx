import { getUpcomingEventsThisWeek } from "@/lib/events/queries";
import { getSelectedCity } from "@/lib/locations-server";
import DayEventsView from "@/components/events/day-events-view";

export default async function EtkinliklerPage() {
  const city = getSelectedCity();
  const events = await getUpcomingEventsThisWeek(city);
  return <DayEventsView events={events} />;
}
