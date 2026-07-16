import Link from "next/link";
import { redirect } from "next/navigation";
import { getPurchaseWithEntitlement } from "@/lib/purchases/queries";
import { generateQrDataUrl } from "@/lib/qr";
import { TicketCard } from "@/components/ui/ticket-card";
import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default async function SatinAlmaBasariliPage({
  searchParams,
}: {
  searchParams: { purchase?: string };
}) {
  if (!searchParams.purchase) redirect("/kesfet");

  const purchase = await getPurchaseWithEntitlement(searchParams.purchase);

  if (!purchase || !purchase.entitlement) redirect("/kesfet");

  const qrDataUrl = await generateQrDataUrl(purchase.entitlement.qr_code);

  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <Stamp label="Satın Alındı" tone="primary" className="mb-5" />
      <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
        Paketin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
        QR kodunla {purchase.package.business.name} işletmesinde kullanabilirsin.
      </p>

      <TicketCard
        className="mt-8 w-full max-w-xs"
        bodyClassName="p-6"
        stub={
          <span className="mx-auto text-xs uppercase tracking-wide text-muted-foreground">
            {purchase.package.title}
          </span>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR kod" className="mx-auto h-56 w-56" />
        <p className="mt-3 text-sm font-semibold tracking-widest text-ink-900">
          {purchase.entitlement.qr_code}
        </p>
      </TicketCard>

      <Link
        href="/hesabim/paketlerim"
        className={cn(buttonVariants({ variant: "default", shape: "pill", size: "lg" }), "mt-8 w-full max-w-xs")}
      >
        Paketlerime Git
      </Link>
    </section>
  );
}
