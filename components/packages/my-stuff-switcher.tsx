"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function MyStuffSwitcher({
  packagesView,
  ticketsView,
}: {
  packagesView: ReactNode;
  ticketsView: ReactNode;
}) {
  const [section, setSection] = useState<"paketler" | "biletler">("paketler");

  return (
    <div>
      <div className="mx-auto flex max-w-2xl gap-2 px-6 pt-6">
        <button
          onClick={() => setSection("paketler")}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide",
            section === "paketler"
              ? "border-dark-900 bg-dark-900 text-white"
              : "border-slate-200 text-slate-400"
          )}
        >
          Paketler
        </button>
        <button
          onClick={() => setSection("biletler")}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide",
            section === "biletler"
              ? "border-dark-900 bg-dark-900 text-white"
              : "border-slate-200 text-slate-400"
          )}
        >
          Biletler
        </button>
      </div>

      {section === "paketler" ? packagesView : ticketsView}
    </div>
  );
}
