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

  const imageOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.35]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div ref={ref} className="relative h-[100svh] min-h-[560px] w-full overflow-hidden">
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

      {/* Top: dark gradient — keeps the navbar readable regardless of the photo's own brightness */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
      {/* Bottom: soft fade into the page background — no hard cut */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background via-background/60 to-transparent" />

      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: town.accent }} />
          {town.label} · Sezon Dışı
        </span>

        <h1 className="mt-6 max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white drop-shadow-sm md:text-6xl">
          <span className="block">Bu kışın gerçek hâli</span>
          <span className="block font-serif italic">{town.label}&apos;da seni bekliyor</span>
        </h1>

        <p className="mt-4 max-w-md text-balance text-base text-white/90 md:text-lg">
          {town.heroTagline}
        </p>

        <div className="mx-auto mt-9 w-full max-w-xl">
          <SearchBar size="lg" className="border-transparent bg-white shadow-xl" />
        </div>

        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-8 text-white/80"
        >
          <ChevronDown size={22} strokeWidth={1.75} />
        </motion.div>
      </motion.div>
    </div>
  );
}
