"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Town } from "@/lib/locations";
import { SearchBar } from "@/components/ui/search-bar";

export function Hero({ town }: { town: Town }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const imageOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.25]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <div ref={ref} className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-navy-950">
      <motion.div
        style={{ opacity: imageOpacity, scale: imageScale }}
        className="absolute inset-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={town.heroImage}
          alt={town.label}
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Soft radial vignette behind the text column only — the image stays
          bright and airy everywhere else, no full-bleed dark cast. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% 42%, rgb(6 18 28 / 0.38), transparent 72%)",
        }}
      />

      {/* Bottom: layered atmospheric fog — several soft passes instead of one
          flat gradient, so the image dissolves into the page rather than cutting off. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/95 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background/70 via-background/25 to-transparent blur-sm" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-background/25 via-transparent to-transparent" />

      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: town.accent }} />
          {town.label} · Sezon Dışı
        </span>

        <h1 className="mt-8 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-6xl md:text-7xl lg:text-[76px] lg:leading-[1.02]">
          <span className="block">Bu kışın gerçek hâli</span>
          <span className="block font-serif italic">{town.label}&apos;da seni bekliyor</span>
        </h1>

        <p className="mt-7 max-w-lg text-balance text-lg text-white/95 drop-shadow-sm md:text-xl">
          {town.heroTagline}
        </p>

        <div className="mx-auto mt-12 w-full max-w-2xl">
          <SearchBar size="xl" className="border-transparent bg-white shadow-[0_24px_60px_-12px_rgba(6,18,28,0.45)]" />
        </div>

        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 text-white/80"
        >
          <ChevronDown size={22} strokeWidth={1.75} />
        </motion.div>
      </motion.div>
    </div>
  );
}
