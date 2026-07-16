import { notFound } from "next/navigation";
import Link from "next/link";
import { getPackageDetail } from "@/lib/packages/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import { TicketCard } from "@/components/ui/ticket-card";
import { Badge } from "@/components/ui/badge";
import { Scribble } from "@/components/ui/scribble";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Reveal } from "@/components/motion/reveal";
import BuyBar from "@/components/packages/buy-bar";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pkg = await getPackageDetail(params.id);

  if (!pkg) notFound();

  const savings = Math.round((1 - pkg.sale_price / pkg.summer_reference_price) * 100);

  return (
    <div className="pb-40 md:pb-28">
      <div className="relative h-56 sm:h-72">
        {pkg.business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pkg.business.cover_url}
            alt={pkg.business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryIcon category={pkg.business.category} className="h-full" iconClassName="h-14 w-14" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/60 via-ink-950/5 to-transparent" />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-6">
        <Reveal>
          <Link
            href={`/isletme/${pkg.business.slug}`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            {pkg.business.name}
            {pkg.business.district ? ` · ${pkg.business.district}` : ""}
          </Link>

          <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {BUSINESS_CATEGORY_LABELS[pkg.business.category]}
          </span>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
            {pkg.title}
          </h1>
          {pkg.description && (
            <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
          )}

          {/* Price contrast block — the ticket motif carries the money moment */}
          <TicketCard
            className="mt-6"
            bodyClassName="py-8 text-center"
            stubClassName="justify-center gap-10"
            stub={
              <>
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-ink-900">{pkg.usage_count}</p>
                  <p className="text-xs text-muted-foreground">kullanım hakkı</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-ink-900">{formatDate(pkg.expires_at)}</p>
                  <p className="text-xs text-muted-foreground">son kullanma tarihi</p>
                </div>
              </>
            }
          >
            <p className="strike-price text-sm">
              Yaz fiyatı: {formatTL(pkg.summer_reference_price)}
            </p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight text-accent-600">
              {formatTL(pkg.sale_price)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bugünün fiyatı
            </p>
            <Badge variant="accent" className="mt-4">
              %{savings} tasarruf
            </Badge>
          </TicketCard>
        </Reveal>

        <section className="mt-10">
          <h2 className="font-display text-lg font-medium text-foreground">Kullanım Koşulları</h2>
          <Scribble className="mt-1 text-primary-500" />
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
              Paket, satın alma tarihinden itibaren son kullanma tarihine kadar geçerlidir.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
              Her kullanım işletmede QR kodun okutulmasıyla gerçekleşir.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
              Kullanılmayan haklar iade edilmez.
            </li>
          </ul>
        </section>
      </div>

      <BuyBar packageId={pkg.id} price={pkg.sale_price} purchasable={pkg.purchasable} />
    </div>
  );
}
