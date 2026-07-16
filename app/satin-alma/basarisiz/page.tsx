import Link from "next/link";
import { CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function SatinAlmaBasarisizPage() {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[calc(100dvh-4.5rem)]">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tile-50 text-tile-600">
        <CircleX size={30} strokeWidth={1.5} />
      </div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">
        Ödeme tamamlanamadı
      </h1>
      <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
        Bir sorun oluştu ve ödemen alınamadı. Kartından herhangi bir tutar çekilmediyse
        tekrar deneyebilirsin.
      </p>
      <Link
        href="/kesfet"
        className={cn(buttonVariants({ variant: "default", shape: "pill", size: "lg" }), "mt-8 w-full max-w-xs")}
      >
        Keşfet&apos;e Dön
      </Link>
    </section>
  );
}
