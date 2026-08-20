import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Compass size={28} strokeWidth={1.75} />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Burada bir şey yok
      </h1>
      <p className="mt-3 text-balance text-sm text-muted-foreground">
        Aradığın sayfa taşınmış ya da hiç var olmamış olabilir. Keşfet&apos;e dönüp
        yakınındaki fırsatlara bakabilirsin.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/kesfet" className={buttonVariants({ variant: "primary", size: "md" })}>
          Keşfet&apos;e dön
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
          Ana sayfa
        </Link>
      </div>
    </section>
  );
}
