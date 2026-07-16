import { notFound } from "next/navigation";
import { MapPin, AtSign, Ticket, CalendarClock } from "lucide-react";
import { getBusinessBySlug, type BusinessProfile, type BusinessProfilePackage } from "@/lib/business/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { DealCard } from "@/components/ui/deal-card";
import { Shelf, ShelfGrid } from "@/components/ui/shelf";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/motion/reveal";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import type { DiscoverPackage } from "@/lib/packages/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDiscoverPackage(
  pkg: BusinessProfilePackage,
  business: BusinessProfile
): DiscoverPackage {
  return {
    id: pkg.id,
    title: pkg.title,
    sale_price: pkg.sale_price,
    summer_reference_price: pkg.summer_reference_price,
    usage_count: pkg.usage_count,
    expires_at: "",
    purchasable: true,
    business: {
      name: business.name,
      slug: business.slug,
      district: business.district,
      city: business.city,
      category: business.category,
      cover_url: business.cover_url,
    },
  };
}

export default async function BusinessProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const business = await getBusinessBySlug(params.slug);

  if (!business) notFound();

  const mapsUrl =
    business.lat && business.lng
      ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          `${business.name} ${business.address ?? ""} ${business.city}`
        )}`;

  return (
    <div>
      <div className="relative h-56 sm:h-72">
        {business.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.cover_url}
            alt={business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CategoryIcon category={business.category} className="h-full" iconClassName="h-14 w-14" />
        )}
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {BUSINESS_CATEGORY_LABELS[business.category]}
          </span>
          <h1 className="mt-1 font-serif text-3xl italic tracking-tight text-foreground">
            {business.name}
          </h1>
          {business.description && (
            <p className="mt-2 text-sm text-muted-foreground">{business.description}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
            >
              <MapPin size={15} strokeWidth={2} />
              {business.district ?? business.city}
            </a>
            {business.instagram && (
              <a
                href={`https://instagram.com/${business.instagram.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
              >
                <AtSign size={15} strokeWidth={2} />
                Instagram
              </a>
            )}
          </div>
        </Reveal>

        <Shelf title="Paketler" className="mt-6">
          {business.packages.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="Bu işletmenin şu an aktif paketi yok"
              description="Yakında eklenecek — daha sonra tekrar bak."
            />
          ) : (
            <ShelfGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
              {business.packages.map((pkg) => (
                <DealCard key={pkg.id} pkg={toDiscoverPackage(pkg, business)} />
              ))}
            </ShelfGrid>
          )}
        </Shelf>

        <section className="mt-4">
          <Reveal>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Yaklaşan Etkinlikler</h2>
          </Reveal>
          {business.events.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Şu an yaklaşan bir etkinlik yok"
              description="Yeni etkinlikler eklendiğinde burada görünecek."
            />
          ) : (
            <StaggerContainer className="space-y-3">
              {business.events.map((event) => (
                <StaggerItem key={event.id}>
                  <Card className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-foreground">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatEventDate(event.event_at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-teal-700">
                      {event.is_paid ? formatTL(event.ticket_price ?? 0) : "Ücretsiz"}
                    </span>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </section>
      </div>
    </div>
  );
}
