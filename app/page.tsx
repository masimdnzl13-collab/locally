import { getDiscoverPackages, type DiscoverPackage } from "@/lib/packages/queries";
import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import { getUpcomingEventsForHome } from "@/lib/events/queries";
import { getWaitlistCount } from "@/lib/waitlist/queries";
import FounderWaitlistForm from "@/components/landing/founder-waitlist-form";
import EventCard from "@/components/events/event-card";
import FlashCard from "@/components/flash/flash-card";
import { SearchBar } from "@/components/ui/search-bar";
import { CategoryGrid } from "@/components/ui/category-grid";
import { DealCard } from "@/components/ui/deal-card";
import { Shelf, ShelfGrid, ShelfScroller } from "@/components/ui/shelf";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import type { BusinessCategory } from "@/lib/types";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

function byCategory(pkgs: DiscoverPackage[], category: BusinessCategory) {
  return pkgs.filter((p) => p.business.category === category);
}

function savingsPercent(p: DiscoverPackage) {
  return 1 - p.sale_price / p.summer_reference_price;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function HomePage() {
  const [packages, flashDeals, weekEvents, waitlistCount] = await Promise.all([
    getDiscoverPackages(),
    getActiveFlashDeals(),
    getUpcomingEventsForHome(5),
    getWaitlistCount(),
  ]);

  const trending = [...packages].sort((a, b) => savingsPercent(b) - savingsPercent(a)).slice(0, 8);
  const recentlyAdded = packages.slice(0, 8); // getDiscoverPackages already orders by created_at desc
  const restaurants = byCategory(packages, "restoran").slice(0, 8);
  const cafes = byCategory(packages, "kafe").slice(0, 8);
  const beachClubs = byCategory(packages, "beach_club").slice(0, 8);
  const experiences = byCategory(packages, "aktivite").slice(0, 8);
  const now = Date.now();
  const endingSoon = [...packages]
    .filter((p) => {
      const t = new Date(p.expires_at).getTime();
      return t - now > 0 && t - now <= WEEK_MS;
    })
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
    .slice(0, 8);
  const waitlistProgress = Math.min(100, Math.round((waitlistCount / 500) * 100));

  return (
    <>
      {/* Slim search row — no headline hero, real content starts immediately */}
      <section className="border-b border-border bg-card px-4 py-4 md:px-10 md:py-5">
        <div className="mx-auto max-w-7xl">
          <SearchBar size="md" className="mx-auto max-w-2xl" />
        </div>
      </section>

      <section className="px-4 py-4 md:px-10">
        <div className="mx-auto max-w-7xl">
          <CategoryGrid />
        </div>
      </section>

      <div className="mx-auto max-w-7xl divide-y divide-border px-4 md:px-10">
        {/* Bugünün fırsatları: real flash deals when live, otherwise the highest real discounts — never empty placeholders */}
        {(flashDeals.length > 0 || trending.length > 0) && (
          <Shelf
            title={
              <span className="inline-flex items-center gap-2">
                <Flame size={22} className="text-discount-500" />
                Bugünün Fırsatları
              </span>
            }
            href={flashDeals.length > 0 ? "/bu-aksam" : "/kesfet"}
          >
            {flashDeals.length > 0 ? (
              <ShelfGrid className="sm:grid-cols-2 lg:grid-cols-4">
                {flashDeals.slice(0, 8).map((deal) => (
                  <FlashCard key={deal.id} deal={deal} />
                ))}
              </ShelfGrid>
            ) : (
              <ShelfGrid className="sm:grid-cols-2 lg:grid-cols-4">
                {trending.map((pkg, i) => (
                  <div key={pkg.id} className={i === 0 ? "col-span-2 row-span-2" : undefined}>
                    <DealCard pkg={pkg} variant={i === 0 ? "featured" : "compact"} className="h-full" />
                  </div>
                ))}
              </ShelfGrid>
            )}
          </Shelf>
        )}

        {endingSoon.length > 0 && (
          <Shelf title="Bu Hafta Bitiyor" href="/kesfet">
            <ShelfScroller>
              {endingSoon.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} className="w-56 shrink-0" />
              ))}
            </ShelfScroller>
          </Shelf>
        )}

        {recentlyAdded.length > 0 && (
          <Shelf title="Son Eklenenler" href="/kesfet">
            <ShelfScroller>
              {recentlyAdded.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} className="w-56 shrink-0" />
              ))}
            </ShelfScroller>
          </Shelf>
        )}

        {restaurants.length > 0 && (
          <Shelf title="Popüler Restoranlar" href="/kesfet?category=restoran">
            <ShelfGrid>
              {restaurants.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {cafes.length > 0 && (
          <Shelf title="Kafeler" href="/kesfet?category=kafe">
            <ShelfGrid>
              {cafes.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {beachClubs.length > 0 && (
          <Shelf title="Beach Club" href="/kesfet?category=beach_club">
            <ShelfGrid>
              {beachClubs.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {experiences.length > 0 && (
          <Shelf title="Aktiviteler" href="/kesfet?category=aktivite">
            <ShelfGrid>
              {experiences.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {weekEvents.length > 0 && (
          <Shelf title="Bu Hafta Etkinlikler" href="/etkinlikler">
            <div className="space-y-3 py-1">
              {weekEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </Shelf>
        )}
      </div>

      {/* Kurucu 500 — real waitlist, real count */}
      <section id="kurucu-500" className="px-4 py-14 md:px-10 md:py-16">
        <Reveal className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-card sm:p-10">
          <Badge variant="discount" className="mx-auto">
            Kurucu 500
          </Badge>
          <h2 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            İlk 500 Kurucu Yerli&apos;ye ömür boyu ayrıcalık
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Kurucu 500 listesine katıl, lansmandan önce özel avantajlarla tanış.
          </p>

          {waitlistCount > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  <AnimatedCounter value={waitlistCount} /> katıldı
                </span>
                <span>500 kontenjan</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-discount-500"
                  style={{ width: `${waitlistProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            <FounderWaitlistForm />
          </div>
        </Reveal>
      </section>

      {/* İşletmeler için çağrı */}
      <section className="px-4 py-14 text-center md:px-10 md:py-16">
        <Reveal className="mx-auto max-w-lg">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            İşletmeniz mi var? Kış sezonunu birlikte kazanalım
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Sezon dışında boş kalan masalarınızı, odalarınızı ve şezlonglarınızı yerel halka açın.
          </p>
          <div className="mt-6">
            <a href="/kayit?rol=isletme" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}>
              İşletmemi Kaydet
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
