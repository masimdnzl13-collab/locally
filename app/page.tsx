import Link from "next/link";
import ShowcaseCard, { type ShowcaseItem } from "@/components/landing/showcase-card";
import FounderWaitlistForm from "@/components/landing/founder-waitlist-form";
import FlashStripServer from "@/components/flash/flash-strip-server";
import EventCard from "@/components/events/event-card";
import { getUpcomingEventsForHome } from "@/lib/events/queries";

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
    emoji: "🎟️",
    title: "Paketini al",
    description: "Bodrum'daki işletmelerden sana uygun paketi seç, güvenle satın al.",
  },
  {
    emoji: "📱",
    title: "QR ile kullan",
    description: "İşletmeye gittiğinde telefonundaki QR kodunu okut, hakkın anında düşsün.",
  },
  {
    emoji: "☀️",
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
      <section className="relative overflow-hidden bg-dark-900 px-6 py-20 text-center text-white md:py-28">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <span className="mb-6 inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-primary-200">
            Bodrum · Sezon Dışı
          </span>

          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Kasabanın kışı da güzel
          </h1>

          <p className="mx-auto mt-5 max-w-md text-balance text-base text-white/70 md:text-lg">
            Sezon dışında Bodrum&apos;un işletmelerini keşfet, yazın turiste
            ayrılan fiyatları kendine ayır.
          </p>

          <div className="mt-10">
            <a
              href="#kurucu-500"
              className="inline-block rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-dark-950 shadow-lg shadow-accent/30 transition-transform hover:scale-[1.02]"
            >
              Kurucu 500&apos;e Katıl
            </a>
          </div>
        </div>
      </section>

      {/* Yaz/Kış kontrast vitrini */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-dark-900 md:text-3xl">
              Yaz fiyatı değil, kış fiyatı
            </h2>
            <p className="mt-2 text-sm text-slate-500 md:text-base">
              Bodrum&apos;daki gerçek işletmelerden birkaç örnek
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE_ITEMS.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* Bu Hafta */}
      {weekEvents.length > 0 && (
        <section className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight text-dark-900 md:text-3xl">
                Bu Hafta
              </h2>
              <Link href="/etkinlikler" className="text-sm font-semibold text-primary-600">
                Tümünü Gör →
              </Link>
            </div>
            <div className="space-y-3">
              {weekEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nasıl çalışır */}
      <section className="bg-slate-50 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-extrabold tracking-tight text-dark-900 md:text-3xl">
            Nasıl çalışır
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                  {step.emoji}
                </div>
                <p className="mb-1 text-xs font-bold text-primary-600">
                  ADIM {i + 1}
                </p>
                <h3 className="mb-2 font-bold text-dark-900">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kurucu 500 */}
      <section
        id="kurucu-500"
        className="relative overflow-hidden bg-dark-900 px-6 py-16 text-white md:py-24"
      >
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-lg text-center">
          <span className="mb-4 inline-block text-4xl">🏆</span>
          <h2 className="text-balance text-2xl font-extrabold tracking-tight md:text-3xl">
            İlk 500 Kurucu Yerli&apos;ye ömür boyu ayrıcalık
          </h2>
          <p className="mt-3 text-sm text-white/70 md:text-base">
            Kurucu 500 listesine katıl, lansmandan önce özel avantajlarla
            tanış.
          </p>

          <div className="mx-auto mt-6 max-w-xs">
            <div className="mb-1.5 flex justify-between text-xs text-white/60">
              <span>127 katıldı</span>
              <span>500 kontenjan</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[25%] rounded-full bg-accent" />
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-sm">
            <FounderWaitlistForm />
          </div>
        </div>
      </section>

      {/* İşletmeler için çağrı */}
      <section className="px-6 py-16 text-center md:py-24">
        <div className="mx-auto max-w-lg">
          <h2 className="text-balance text-2xl font-extrabold tracking-tight text-dark-900 md:text-3xl">
            İşletmeniz mi var? Kış sezonunu birlikte kazanalım
          </h2>
          <p className="mt-3 text-sm text-slate-500 md:text-base">
            Sezon dışında boş kalan masalarınızı, odalarınızı ve
            şezlonglarınızı yerel halka açın.
          </p>
          <a
            href="/kayit?rol=isletme"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
          >
            İşletmemi Kaydet
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 py-10 text-center">
        <p className="text-lg font-extrabold tracking-tight text-dark-900">
          Locally
        </p>
        <p className="mt-1 text-sm text-slate-500">Kasabanın kışı da güzel</p>
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
        <p className="mt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Locally. Tüm hakları saklıdır.
        </p>
      </footer>
    </>
  );
}
