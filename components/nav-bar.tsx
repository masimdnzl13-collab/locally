"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchBar } from "@/components/ui/search-bar";
import { LocationSelector } from "@/components/ui/location-selector";
import { AccountDropdown } from "@/components/ui/account-dropdown";
import type { CurrentUser } from "@/lib/auth/current-user";

const CONTENT_LINKS = [
  { href: "/kesfet", label: "Keşfet" },
  { href: "/bu-aksam", label: "Bu Akşam" },
  { href: "/etkinlikler", label: "Etkinlikler" },
];

export default function NavBar({ city, user }: { city: string; user: CurrentUser | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname?.startsWith("/panel") || pathname?.startsWith("/admin")) return null;

  // Transparent-over-hero is only meaningful on the homepage; every other
  // page is solid from the start so content never sits under a see-through bar.
  const onHero = isHome && !scrolled;
  const solid = !onHero;

  return (
    <>
      {/* Masaüstü */}
      <header
        className={cn(
          "sticky top-0 z-40 hidden transition-all duration-300 md:block",
          solid
            ? "border-b border-border bg-background/95 backdrop-blur shadow-sm"
            : "border-b border-white/0 bg-gradient-to-b from-black/40 via-black/15 to-transparent backdrop-blur-[2px]"
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-[100rem] items-center gap-6 px-5 py-3 xl:px-8",
            onHero && "[text-shadow:0_1px_3px_rgb(0_0_0_/_0.45)]"
          )}
        >
          <Link
            href="/"
            className={cn(
              "shrink-0 font-serif text-2xl italic transition-colors",
              onHero ? "text-white" : "text-foreground"
            )}
          >
            Locally
          </Link>

          {!onHero && <SearchBar size="md" className="max-w-md flex-1" />}

          <LocationSelector
            city={city}
            className={onHero ? "text-white hover:text-white/80 [&_svg]:opacity-90" : undefined}
          />

          <nav className={cn("flex shrink-0 items-center gap-5", onHero && "ml-2")}>
            {CONTENT_LINKS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative py-1 text-sm font-medium transition-colors",
                    onHero
                      ? "text-white/85 hover:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={active ? (onHero ? "text-white" : "text-foreground") : undefined}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="nav-desktop-underline"
                      className={cn(
                        "absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full",
                        onHero ? "bg-white" : "bg-teal-600"
                      )}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/favorilerim"
              aria-label="Favoriler"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                onHero
                  ? "text-white/90 hover:bg-white/15 hover:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Heart size={19} strokeWidth={1.75} />
            </Link>
            <Link
              href="/bildirimler"
              aria-label="Bildirimler"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                onHero
                  ? "text-white/90 hover:bg-white/15 hover:text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Bell size={19} strokeWidth={1.75} />
            </Link>
            <ThemeToggle />
            {user ? (
              <AccountDropdown user={user} className="ml-1" />
            ) : (
              <Link
                href="/giris"
                className="ml-1 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
              >
                Giriş Yap
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-40 space-y-2.5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Link href="/" className="shrink-0 font-serif text-xl italic text-foreground">
            Locally
          </Link>
          <LocationSelector city={city} className="shrink-0" />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
            {user ? (
              <AccountDropdown user={user} />
            ) : (
              <Link
                href="/giris"
                className="rounded-full bg-navy-900 px-3.5 py-1.5 text-sm font-semibold text-white"
              >
                Giriş
              </Link>
            )}
          </div>
        </div>
        {!isHome && <SearchBar size="md" placeholder="İşletme veya kampanya ara" />}
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
