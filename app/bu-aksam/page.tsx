import Link from "next/link";
import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import FlashCard from "@/components/flash/flash-card";

export default async function BuAksamPage() {
  const deals = await getActiveFlashDeals();

  if (deals.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-4.5rem)]">
        <div className="mb-4 text-4xl">🌙</div>
        <p className="font-medium text-dark-900">
          Bu akşam henüz flaş yok — akşam saatlerinde tekrar bak
        </p>
        <p className="mt-1 text-sm text-slate-500">
          O sırada yaklaşan etkinliklere göz atabilirsin.
        </p>
        <Link
          href="/etkinlikler"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
        >
          Etkinliklere Git
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-dark-900">
        Bu Akşam
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Bodrum&apos;da bu akşam geçerli {deals.length} flaş fırsat
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <FlashCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
