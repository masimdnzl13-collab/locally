import Link from "next/link";
import { Moon } from "lucide-react";
import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import { getSelectedCity } from "@/lib/locations-server";
import FlashCard from "@/components/flash/flash-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default async function BuAksamPage() {
  const city = getSelectedCity();
  const deals = await getActiveFlashDeals(city);

  if (deals.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 md:min-h-[calc(100dvh-4.5rem)]">
        <EmptyState
          icon={Moon}
          title="Bu akşam henüz flaş yok — akşam saatlerinde tekrar bak"
          description="O sırada yaklaşan etkinliklere göz atabilirsin."
          action={
            <Link href="/etkinlikler" className={buttonVariants({ variant: "teal" })}>
              Etkinliklere Git
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-navy-900 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-2xl italic tracking-tight text-white md:text-3xl">
          Bu Akşam
        </h1>
        <p className="mt-1 text-sm text-stone-300">
          {city}&apos;da bu akşam geçerli {deals.length} flaş fırsat
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <FlashCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </div>
  );
}
