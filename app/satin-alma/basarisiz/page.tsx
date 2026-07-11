import Link from "next/link";

export default function SatinAlmaBasarisizPage() {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <div className="mb-4 text-5xl">😕</div>
      <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">Ödeme tamamlanamadı</h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-slate-500">
        Bir sorun oluştu ve ödemen alınamadı. Kartından herhangi bir tutar çekilmediyse
        tekrar deneyebilirsin.
      </p>
      <Link
        href="/kesfet"
        className="mt-8 w-full max-w-xs rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white"
      >
        Keşfet&apos;e Dön
      </Link>
    </section>
  );
}
