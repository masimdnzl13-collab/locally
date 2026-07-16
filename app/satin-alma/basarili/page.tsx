import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getPurchaseWithEntitlement } from "@/lib/purchases/queries";
import { generateQrDataUrl } from "@/lib/qr";
import { Card } from "@/components/ui/card";
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
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-700">
        <CheckCircle2 size={32} strokeWidth={1.75} />
      </div>
      <h1 className="font-serif text-3xl italic tracking-tight text-foreground">
        Paketin hazır!
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
        QR kodunla {purchase.package.business.name} işletmesinde kullanabilirsin.
      </p>

      <Card className="mt-8 w-full max-w-xs p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {purchase.package.title}
        </p>
        <div className="mx-auto mt-4 flex h-56 w-56 items-center justify-center rounded-lg bg-muted p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR kod" className="h-full w-full" />
        </div>
        <p className="mt-3 text-sm font-semibold tracking-widest text-navy-900">
          {purchase.entitlement.qr_code}
        </p>
      </Card>

      <Link
        href="/hesabim/paketlerim"
        className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8 w-full max-w-xs")}
      >
        Paketlerime Git
      </Link>
    </section>
  );
}
