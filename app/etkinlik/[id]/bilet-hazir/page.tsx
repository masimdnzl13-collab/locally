import Link from "next/link";
import { redirect } from "next/navigation";
import { getTicketWithQr } from "@/lib/events/queries";
import { generateQrDataUrl } from "@/lib/qr";

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
      <div className="mb-4 text-5xl">🎟️</div>
      <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">
        Biletin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-slate-500">
        {ticket.event.title} · {ticket.event.business.name}
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Bilet QR kodu" className="h-56 w-56" />
        <p className="mt-3 text-sm font-semibold tracking-widest text-dark-900">
          {ticket.qr_code}
        </p>
      </div>

      <Link
        href="/hesabim/paketlerim"
        className="mt-8 w-full max-w-xs rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white"
      >
        Biletlerime Git
      </Link>
    </section>
  );
}
