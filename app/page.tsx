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
import { cn } from "@/lib/utils";
import { Ticket, Smartphone, Sun, Trophy } from "lucide-react";

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
      <section className="relative overflow-hidden bg-dark-950 px-6 py-24 text-center text-white md:py-32">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-float rounded-full bg-primary/30 blur-3xl" />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 animate-float rounded-full bg-accent/20 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-2xl">
          <span className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary-200 backdrop-blur">
            Bodrum · Sezon Dışı
          </span>

          <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
            Kasabanın kışı da güzel
          </h1>

          <p className="mx-auto mt-6 max-w-md text-balance text-base text-white/70 md:text-lg">
            Sezon dışında Bodrum&apos;un işletmelerini keşfet, yazın turiste
            ayrılan fiyatları kendine ayır.
          </p>

          <div className="mt-10">
            <a
              href="#kurucu-500"
              className={cn(buttonVariants({ variant: "accent", size: "lg" }), "shadow-glow-accent")}
            >
              Kurucu 500&apos;e Katıl
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
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Bodrum&apos;daki gerçek işletmelerden birkaç örnek
            </p>
          </Reveal>

          <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_ITEMS.map((item) => (
              <StaggerItem key={item.title}>
                <ShowcaseCard item={item} />
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
      <section className="bg-muted/60 px-6 py-20 md:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-14 text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Nasıl çalışır
            </h2>
          </Reveal>
          <div className="relative grid gap-10 sm:grid-cols-3">
            <div className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block" />
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12} className="relative text-center">
                <div className="relative z-10 mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary-600 shadow-md">
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
      <section
        id="kurucu-500"
        className="relative overflow-hidden bg-dark-950 px-6 py-20 text-white md:py-28"
      >
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <Reveal className="relative mx-auto max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent-400">
            <Trophy className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h2 className="text-balance font-display text-3xl font-medium tracking-tight md:text-4xl">
            İlk 500 Kurucu Yerli&apos;ye ömür boyu ayrıcalık
          </h2>
          <p className="mt-3 text-sm text-white/70 md:text-base">
            Kurucu 500 listesine katıl, lansmandan önce özel avantajlarla
            tanış.
          </p>

          <div className="mx-auto mt-8 max-w-xs">
            <div className="mb-1.5 flex justify-between text-xs text-white/60">
              <span>
                <AnimatedCounter value={127} /> katıldı
              </span>
              <span>500 kontenjan</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[25%] rounded-full bg-gradient-to-r from-accent-400 to-accent-600" />
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-sm">
            <FounderWaitlistForm />
          </div>
        </Reveal>
      </section>

      {/* İşletmeler için çağrı */}
      <section className="px-6 py-20 text-center md:py-28">
        <Reveal className="mx-auto max-w-lg">
          <h2 className="text-balance font-display text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            İşletmeniz mi var? Kış sezonunu birlikte kazanalım
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Sezon dışında boş kalan masalarınızı, odalarınızı ve
            şezlonglarınızı yerel halka açın.
          </p>
          <div className="mt-8">
            <a
              href="/kayit?rol=isletme"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "shadow-glow-primary")}
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
