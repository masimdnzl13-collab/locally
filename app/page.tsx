import Link from "next/link";
import { getDiscoverPackages, type DiscoverPackage } from "@/lib/packages/queries";
import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import { getUpcomingEventsForHome } from "@/lib/events/queries";
import { getWaitlistCount } from "@/lib/waitlist/queries";
import { getSelectedTown } from "@/lib/locations-server";
import type { Town } from "@/lib/locations";
import FounderWaitlistForm from "@/components/landing/founder-waitlist-form";
import EventCard from "@/components/events/event-card";
import { SearchBar } from "@/components/ui/search-bar";
import { CategoryGrid } from "@/components/ui/category-grid";
import { DealCard } from "@/components/ui/deal-card";
import { Shelf, ShelfGrid, ShelfScroller } from "@/components/ui/shelf";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import type { BusinessCategory } from "@/lib/types";
import { Ticket, Smartphone, Sun, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

function howItWorks(town: Town) {
  return [
    {
      icon: Ticket,
      title: "Paketini al",
      description: `${town.possessive} işletmelerinden sana uygun paketi seç, güvenle satın al.`,
    },
    {
      icon: Smartphone,
      title: "QR ile kullan",
      description: "İşletmeye gittiğinde telefonundaki QR kodunu okut, hakkın anında düşsün.",
    },
    {
      icon: Sun,
      title: "Kışın tadını çıkar",
      description: "Yazın turiste ayrılan keyfi, kasabanda sen keşfet.",
    },
  ];
}

function byCategory(pkgs: DiscoverPackage[], category: BusinessCategory) {
  return pkgs.filter((p) => p.business.category === category);
}

function savingsPercent(p: DiscoverPackage) {
  return 1 - p.sale_price / p.summer_reference_price;
}

export default async function HomePage() {
  const town = getSelectedTown();
  const city = town.label;
  const [packages, flashDeals, weekEvents, waitlistCount] = await Promise.all([
    getDiscoverPackages(city),
    getActiveFlashDeals(city),
    getUpcomingEventsForHome(5, city),
    getWaitlistCount(),
  ]);

  const trending = [...packages].sort((a, b) => savingsPercent(b) - savingsPercent(a)).slice(0, 8);
  const recentlyAdded = packages.slice(0, 8); // getDiscoverPackages already orders by created_at desc
  const restaurants = byCategory(packages, "restoran").slice(0, 8);
  const cafes = byCategory(packages, "kafe").slice(0, 8);
  const experiences = byCategory(packages, "aktivite").slice(0, 8);
  const waitlistProgress = Math.min(100, Math.round((waitlistCount / 500) * 100));

  return (
    <>
      {/* Search-first hero — no giant illustration, real content starts immediately below */}
      <section className="border-b border-border bg-card px-6 py-12 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-discount-500" />
            {city} · Sezon Dışı
          </span>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Yerel işletmelerde <span className="font-serif italic text-teal-700">özel fırsatlar</span> keşfet
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            Sezon dışında {town.possessive} işletmelerini keşfet, yazın turiste ayrılan fiyatları kendine ayır.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      <section className="px-5 py-6 xl:px-8">
        <div className="mx-auto max-w-[100rem]">
          <CategoryGrid />
        </div>
      </section>

      <div className="mx-auto max-w-[100rem] divide-y divide-border px-5 xl:px-8">
        {trending.length > 0 && (
          <Shelf title="Trend kampanyalar" href="/kesfet">
            <ShelfGrid className="sm:grid-cols-2 lg:grid-cols-4">
              {trending.map((pkg, i) => (
                <div key={pkg.id} className={i === 0 ? "col-span-2 row-span-2" : undefined}>
                  <DealCard pkg={pkg} variant={i === 0 ? "featured" : "compact"} className="h-full" />
                </div>
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {recentlyAdded.length > 0 && (
          <Shelf title="Yeni eklenenler" href="/kesfet">
            <ShelfScroller>
              {recentlyAdded.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} className="w-64 shrink-0" />
              ))}
            </ShelfScroller>
          </Shelf>
        )}

        {restaurants.length > 0 && (
          <Shelf title="Popüler restoranlar" href="/kesfet?category=restoran">
            <ShelfGrid>
              {restaurants.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {cafes.length > 0 && (
          <Shelf title="Popüler kafeler" href="/kesfet?category=kafe">
            <ShelfGrid>
              {cafes.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {experiences.length > 0 && (
          <Shelf title="Deneyimler" href="/kesfet?category=aktivite">
            <ShelfGrid>
              {experiences.map((pkg) => (
                <DealCard key={pkg.id} pkg={pkg} />
              ))}
            </ShelfGrid>
          </Shelf>
        )}

        {flashDeals.length > 0 && (
          <Shelf title="Bugünün fırsatları" href="/bu-aksam" hrefLabel="Bu akşama git">
            <Link
              href="/bu-aksam"
              className="flex items-center gap-4 rounded-lg bg-navy-900 p-6 text-white transition-colors hover:bg-navy-800"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-discount-500">
                <Zap size={20} className="text-white" fill="currentColor" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">
                  {flashDeals.length} işletmede süreli flaş fırsat aktif
                </p>
                <p className="text-sm text-navy-200">Kontenjan dolmadan yakala</p>
              </div>
              <Badge variant="discount">Canlı</Badge>
            </Link>
          </Shelf>
        )}

        {weekEvents.length > 0 && (
          <Shelf title="Bu hafta etkinlikler" href="/etkinlikler">
            <div className="space-y-3">
              {weekEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </Shelf>
        )}
      </div>

      {/* Nasıl çalışır */}
      <section className="border-y border-border bg-muted px-6 py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Nasıl çalışır
            </h2>
          </Reveal>
          <div className="grid gap-10 sm:grid-cols-3">
            {howItWorks(town).map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-teal-700">
                  <step.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="mb-1.5 text-xs font-bold tracking-wide text-teal-700">
                  ADIM {i + 1}
                </p>
                <h3 className="mb-2 font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Kurucu 500 — real waitlist, real count */}
      <section id="kurucu-500" className="px-6 py-16 md:py-20">
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
      <section className="px-6 py-16 text-center md:py-20">
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
