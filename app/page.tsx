import Link from "next/link";
import ShowcaseCard, { type ShowcaseItem } from "@/components/landing/showcase-card";
import FounderWaitlistForm from "@/components/landing/founder-waitlist-form";
import FlashStripServer from "@/components/flash/flash-strip-server";
import EventCard from "@/components/events/event-card";
import { getUpcomingEventsForHome } from "@/lib/events/queries";
import { Reveal } from "@/components/motion/reveal";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { buttonVariants } from "@/components/ui/button";
import { TicketCard } from "@/components/ui/ticket-card";
import { Stamp } from "@/components/ui/stamp";
import { Scribble } from "@/components/ui/scribble";
import { cn } from "@/lib/utils";
import { Ticket, Smartphone, Sun } from "lucide-react";

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    category: "kafe",
    categoryLabel: "Kafe",
    business: "Liman Kafe · Gümbet",
    title: "5 Kahve Paketi",
    summerPrice: 2400,
    todayPrice: 900,
  },
  {
    category: "restoran",
    categoryLabel: "Restoran",
    business: "Rüzgar Sofrası · Yalıkavak",
    title: "Akşam Yemeği İkramı",
    summerPrice: 3200,
    todayPrice: 1200,
  },
  {
    category: "beach_club",
    categoryLabel: "Beach Club",
    business: "Mavi Koy · Bitez",
    title: "Gün Boyu Şezlong",
    summerPrice: 4500,
    todayPrice: 1800,
  },
];

const HOW_IT_WORKS = [
  {
    icon: Ticket,
    title: "Paketini al",
    description: "Bodrum'daki işletmelerden sana uygun paketi seç, güvenle satın al.",
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

export default async function HomePage() {
  const weekEvents = await getUpcomingEventsForHome(5);

  return (
    <>
      <FlashStripServer />

      {/* Hero */}
      <section className="relative overflow-hidden bg-background px-6 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-accent-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            Bodrum · Sezon Dışı
          </span>

          <h1 className="mt-6 max-w-3xl text-balance font-display text-5xl font-medium leading-[1.03] tracking-tight text-ink-900 md:text-7xl">
            Kasabanın kışı da güzel
          </h1>
          <Scribble className="mt-3 h-4 w-24 text-primary-500" />

          <p className="mt-6 max-w-md text-balance text-base text-muted-foreground md:text-lg">
            Sezon dışında Bodrum&apos;un işletmelerini keşfet, yazın turiste
            ayrılan fiyatları kendine ayır.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href="#kurucu-500"
              className={cn(buttonVariants({ variant: "accent", size: "lg" }))}
            >
              Kurucu 500&apos;e Katıl
            </a>
            <a
              href="#nasil-calisir"
              className="text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              Nasıl çalışır? →
            </a>
          </div>
        </div>
      </section>

      {/* Yaz/Kış kontrast vitrini */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mb-12 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Yaz fiyatı değil, kış fiyatı
            </h2>
            <Scribble className="mx-auto mt-3" />
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Bodrum&apos;daki gerçek işletmelerden birkaç örnek
            </p>
          </Reveal>

          <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
            <StaggerItem className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
              <ShowcaseCard item={SHOWCASE_ITEMS[0]} featured className="h-full" />
            </StaggerItem>
            {SHOWCASE_ITEMS.slice(1).map((item) => (
              <StaggerItem key={item.title}>
                <ShowcaseCard item={item} className="h-full" />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Bu Hafta */}
      {weekEvents.length > 0 && (
        <section className="px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl">
            <Reveal className="mb-8 flex items-center justify-between">
              <h2 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                Bu Hafta
              </h2>
              <Link
                href="/etkinlikler"
                className="text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
              >
                Tümünü Gör →
              </Link>
            </Reveal>
            <StaggerContainer className="space-y-3">
              {weekEvents.map((event) => (
                <StaggerItem key={event.id}>
                  <EventCard event={event} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>
      )}

      {/* Nasıl çalışır */}
      <section id="nasil-calisir" className="bg-muted/60 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-14 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Nasıl çalışır
            </h2>
            <Scribble className="mx-auto mt-3" />
          </Reveal>
          <div className="relative grid gap-10 sm:grid-cols-3">
            <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block" />
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12} className="relative text-center">
                <div className="relative z-10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary-600">
                  <step.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <p className="mb-1.5 text-xs font-bold tracking-wide text-primary-600">
                  ADIM {i + 1}
                </p>
                <h3 className="mb-2 font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Kurucu 500 */}
      <section id="kurucu-500" className="px-6 py-20 md:py-28">
        <Reveal className="mx-auto max-w-lg">
          <TicketCard
            className="text-center"
            bodyClassName="flex flex-col items-center px-6 py-10 sm:px-10"
            notchBg="var(--background)"
            stub={
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>
                    <AnimatedCounter value={127} /> katıldı
                  </span>
                  <span>500 kontenjan</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sand-200">
                  <div className="h-full w-[25%] rounded-full bg-gradient-to-r from-accent-400 to-accent-600" />
                </div>
              </div>
            }
          >
            <Stamp label="Kurucu 500" tone="accent" className="mb-5" />
            <h2 className="text-balance font-display text-3xl font-medium tracking-tight text-ink-900 md:text-4xl">
              İlk 500 Kurucu Yerli&apos;ye ömür boyu ayrıcalık
            </h2>
            <Scribble className="mt-3" />
            <p className="mt-4 text-sm text-muted-foreground md:text-base">
              Kurucu 500 listesine katıl, lansmandan önce özel avantajlarla
              tanış.
            </p>

            <div className="mt-8 w-full max-w-sm">
              <FounderWaitlistForm />
            </div>
          </TicketCard>
        </Reveal>
      </section>

      {/* İşletmeler için çağrı */}
      <section className="px-6 py-20 text-center md:py-28">
        <Reveal className="mx-auto max-w-lg">
          <h2 className="text-balance font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            İşletmeniz mi var? Kış sezonunu birlikte kazanalım
          </h2>
          <Scribble className="mx-auto mt-3" />
          <p className="mt-4 text-sm text-muted-foreground md:text-base">
            Sezon dışında boş kalan masalarınızı, odalarınızı ve
            şezlonglarınızı yerel halka açın.
          </p>
          <div className="mt-8">
            <a
              href="/kayit?rol=isletme"
              className={cn(buttonVariants({ variant: "default", size: "lg" }))}
            >
              İşletmemi Kaydet
            </a>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="font-display text-lg font-medium tracking-tight text-foreground">
          Locally
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Kasabanın kışı da güzel</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 hover:underline"
          >
            Instagram
          </a>
          <a href="mailto:merhaba@locally.app" className="text-primary-600 hover:underline">
            merhaba@locally.app
          </a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} Locally. Tüm hakları saklıdır.
        </p>
      </footer>
    </>
  );
}
