"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NavBar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/panel")) return null;

  return (
    <>
      {/* Masaüstü: üst menü */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-tight text-ink-900"
          >
            Locally
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active ? "text-primary-700" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-desktop-indicator"
                      className="absolute inset-0 rounded-full bg-primary/10"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/panel"
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800"
            >
              İşletme Paneli
            </Link>
          </div>
        </div>
      </header>

      {/* Mobil: yüzen tema anahtarı */}
      <div className="fixed right-4 top-4 z-40 md:hidden">
        <ThemeToggle className="bg-card/90 backdrop-blur" />
      </div>

      {/* Mobil: alt gezinme çubuğu */}
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
                    className="absolute inset-x-3 top-1 h-9 rounded-2xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.75}
                  className={cn(
                    "relative z-10 transition-colors",
                    active ? "text-primary-600" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 transition-colors",
                    active ? "text-primary-600" : "text-muted-foreground"
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
