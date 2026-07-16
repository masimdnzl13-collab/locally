import EventForm from "@/components/panel/event-form";

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Yeni Etkinlik
      </h1>
      <EventForm />
    </div>
  );
}
