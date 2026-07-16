import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getTicketWithQr } from "@/lib/events/queries";
import { generateQrDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
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
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-700">
        <CheckCircle2 size={32} strokeWidth={1.75} />
      </div>
      <h1 className="font-serif text-3xl italic tracking-tight text-foreground">
        Biletin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
        {ticket.event.title} · {ticket.event.business.name}
      </p>

      <Card className="mt-8 w-full max-w-xs p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          QR kodunu işletmede okut
        </p>
        <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-lg bg-muted p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Bilet QR kodu" className="h-full w-full" />
        </div>
        <p className="mt-3 text-sm font-semibold tracking-widest text-navy-900">
          {ticket.qr_code}
        </p>
      </Card>

      <Link
        href="/hesabim/paketlerim"
        className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8 w-full max-w-xs")}
      >
        Biletlerime Git
      </Link>
    </section>
  );
}
