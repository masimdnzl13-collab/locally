"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, Bell, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchBar } from "@/components/ui/search-bar";

const CONTENT_LINKS = [
  { href: "/kesfet", label: "Keşfet" },
  { href: "/bu-aksam", label: "Bu Akşam" },
  { href: "/etkinlikler", label: "Etkinlikler" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname?.startsWith("/panel") || pathname?.startsWith("/admin")) return null;

  // Transparent-over-hero is only meaningful on the homepage; every other
  // page is solid from the start so content never sits under a see-through bar.
  const solid = scrolled || !isHome;

  return (
    <>
      {/* Masaüstü */}
      <header
        className={cn(
          "sticky top-0 z-40 hidden transition-all duration-200 md:block",
          solid
            ? "border-b border-border bg-background/95 backdrop-blur shadow-sm"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
          <Link href="/" className="shrink-0 font-serif text-2xl italic text-foreground">
            Locally
          </Link>

          <SearchBar size="md" className="max-w-md flex-1" />

          <Link
            href="/kesfet"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <MapPin size={16} />
            Bodrum
          </Link>

          <nav className="flex shrink-0 items-center gap-5">
            {CONTENT_LINKS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className={active ? "text-foreground" : undefined}>{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="nav-desktop-underline"
                      className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-teal-600"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/favorilerim"
              aria-label="Favoriler"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Heart size={19} strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              aria-label="Bildirimler"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell size={19} strokeWidth={1.75} />
            </button>
            <ThemeToggle />
            <Link
              href="/hesabim"
              className="ml-1 rounded-full bg-muted px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-stone-200"
            >
              Hesabım
            </Link>
            <Link
              href="/panel"
              className="rounded-md border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              İşletme Paneli
            </Link>
          </div>
        </div>
      </header>

      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="shrink-0 font-serif text-xl italic text-foreground">
          Locally
        </Link>
        <SearchBar size="md" className="ml-auto flex-1" placeholder="Ara" />
        <ThemeToggle className="shrink-0" />
      </header>

      {/* Mobil alt gezinme çubuğu */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              >
                {active && (
                  <motion.span
                    layoutId="nav-mobile-indicator"
                    className="absolute inset-x-3 top-1 h-9 rounded-lg bg-muted"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon
                  size={21}
                  strokeWidth={active ? 2.1 : 1.75}
                  className={cn(
                    "relative z-10 transition-colors",
                    active ? "text-teal-700" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 transition-colors",
                    active ? "text-teal-700" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
