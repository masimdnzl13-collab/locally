import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, AtSign, Ticket, CalendarClock } from "lucide-react";
import { getBusinessBySlug } from "@/lib/business/queries";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/ui/category-icon";
import { TicketCard } from "@/components/ui/ticket-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Scribble } from "@/components/ui/scribble";
import { Reveal } from "@/components/motion/reveal";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";

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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {BUSINESS_CATEGORY_LABELS[business.category]}
          </span>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">
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

        <section className="mt-12">
          <Reveal>
            <h2 className="text-lg font-semibold text-foreground">Paketler</h2>
            <Scribble className="mt-1 mb-4 text-primary-500" />
          </Reveal>
          {business.packages.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="Bu işletmenin şu an aktif paketi yok"
              description="Yakında eklenecek — daha sonra tekrar bak."
            />
          ) : (
            <StaggerContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {business.packages.map((pkg) => {
                const savings = Math.round(
                  (1 - pkg.sale_price / pkg.summer_reference_price) * 100
                );
                return (
                  <StaggerItem key={pkg.id}>
                    <Link href={`/paket/${pkg.id}`} className="block h-full">
                      <TicketCard
                        className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-sepia-300"
                        stub={
                          <>
                            <div>
                              <p className="strike-price text-xs">
                                Yaz: {formatTL(pkg.summer_reference_price)}
                              </p>
                              <p className="font-display text-xl font-semibold text-accent-500">
                                Bugün: {formatTL(pkg.sale_price)}
                              </p>
                            </div>
                            <Badge variant="accent">%{savings}</Badge>
                          </>
                        }
                      >
                        <Badge variant="neutral" className="mb-1 self-start">
                          {pkg.usage_count} kullanım
                        </Badge>
                        <h3 className="font-semibold text-foreground">{pkg.title}</h3>
                      </TicketCard>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}
        </section>

        <section className="mt-12">
          <Reveal>
            <h2 className="text-lg font-semibold text-foreground">
              Yaklaşan Etkinlikler
            </h2>
            <Scribble className="mt-1 mb-4 text-primary-500" />
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
                    <span className="text-sm font-semibold text-primary-600">
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
