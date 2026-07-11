"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav-items";

export default function NavBar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/panel")) return null;

  return (
    <>
      {/* Masaüstü: üst menü */}
      <header className="sticky top-0 z-40 hidden border-b border-slate-100 bg-white/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-dark-900">
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
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-dark-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/panel"
            className="rounded-full bg-dark-900 px-4 py-2 text-sm font-semibold text-white hover:bg-dark-800"
          >
            İşletme Paneli
          </Link>
        </div>
      </header>

      {/* Mobil: alt gezinme çubuğu */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary-600" : "text-slate-400"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
