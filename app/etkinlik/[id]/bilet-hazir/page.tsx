import Link from "next/link";
import { redirect } from "next/navigation";
import { getTicketWithQr } from "@/lib/events/queries";
import { generateQrDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { TicketCard } from "@/components/ui/ticket-card";
import { Stamp } from "@/components/ui/stamp";
import { buttonVariants } from "@/components/ui/button";

export default async function BiletHazirPage({
  searchParams,
  params,
}: {
  searchParams: { ticket?: string };
  params: { id: string };
}) {
  if (!searchParams.ticket) redirect(`/etkinlik/${params.id}`);

  const ticket = await getTicketWithQr(searchParams.ticket);
  if (!ticket) redirect(`/etkinlik/${params.id}`);

  const qrDataUrl = await generateQrDataUrl(ticket.qr_code);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <Stamp label="Bilet Hazır" tone="primary" className="mb-5" />
      <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
        Biletin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
        {ticket.event.title} · {ticket.event.business.name}
      </p>

      <TicketCard
        className="mt-8 w-full max-w-xs"
        bodyClassName="p-6"
        stub={
          <span className="mx-auto text-xs uppercase tracking-wide text-muted-foreground">
            QR kodunu işletmede okut
          </span>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Bilet QR kodu" className="mx-auto h-56 w-56" />
        <p className="mt-3 text-sm font-semibold tracking-widest text-ink-900">
          {ticket.qr_code}
        </p>
      </TicketCard>

      <Link
        href="/hesabim/paketlerim"
        className={cn(buttonVariants({ variant: "default", shape: "pill", size: "lg" }), "mt-8 w-full max-w-xs")}
      >
        Biletlerime Git
      </Link>
    </section>
  );
}
