import Link from "next/link";
import { Moon } from "lucide-react";
import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import FlashCard from "@/components/flash/flash-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default async function BuAksamPage() {
  const deals = await getActiveFlashDeals();

  if (deals.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 md:min-h-[calc(100dvh-4.5rem)]">
        <EmptyState
          icon={Moon}
          title="Bu akşam henüz flaş yok — akşam saatlerinde tekrar bak"
          description="O sırada yaklaşan etkinliklere göz atabilirsin."
          action={
            <Link href="/etkinlikler" className={buttonVariants({ variant: "default", shape: "pill" })}>
              Etkinliklere Git
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-ink-900 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-2xl font-medium tracking-tight text-sand-50 md:text-3xl">
          Bu Akşam
        </h1>
        <p className="mt-1 text-sm text-sand-300">
          Bodrum&apos;da bu akşam geçerli {deals.length} flaş fırsat
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
