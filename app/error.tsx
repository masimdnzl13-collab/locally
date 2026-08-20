"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app-error]", error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-danger-700">
        <AlertTriangle size={28} strokeWidth={1.75} />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Bir şeyler ters gitti
      </h1>
      <p className="mt-3 text-balance text-sm text-muted-foreground">
        Bu bizim tarafımızdaki bir hata, senin hesabınla veya işlemlerinle ilgisi yok.
        Tekrar dener misin?
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={() => reset()} className={buttonVariants({ variant: "primary", size: "md" })}>
          Tekrar dene
        </button>
        <a href="/" className={buttonVariants({ variant: "outline", size: "md" })}>
          Ana sayfa
        </a>
      </div>
    </section>
  );
}
