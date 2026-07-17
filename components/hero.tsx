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

      {/* Top: soft white mist the photo fades into behind the floating navbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 to-transparent" />

      {/* Bottom: layered atmospheric fog — several soft passes instead of one
          flat gradient, so the image dissolves into the page rather than cutting off. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/95 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background/70 via-background/25 to-transparent blur-sm" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-background/25 via-transparent to-transparent" />

      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative flex h-full flex-col items-center justify-center gap-5 px-6 py-24 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-discount-500" />
          {town.label} · Sezon Dışı
        </span>

        <h1 className="max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.4)] sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="block">Yerel işletmelerde</span>
          <span className="block">
            <span className="font-serif italic font-normal text-[#3DDBA6]">özel fırsatlar</span>{" "}
            keşfet
          </span>
        </h1>

        <p className="max-w-lg text-balance text-base text-white/95 drop-shadow-sm md:text-lg">
          Sezon dışında {town.possessive} işletmelerini keşfet, yazın turiste ayrılan fiyatları kendine ayır.
        </p>

        <div className="mx-auto mt-3 w-full max-w-2xl">
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
