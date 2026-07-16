"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { panelNavItems } from "@/lib/panel-nav-items";
import { signOutAction } from "@/lib/auth/actions";
import type { Business } from "@/lib/types";

export default function PanelShell({
  business,
  children,
}: {
  business: Business;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="md:flex md:min-h-screen">
      {/* Masaüstü: sol menü (ink workspace surface) */}
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:flex md:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <span className="text-lg font-extrabold tracking-tight text-white">
            Locally <span className="text-primary-300">İşletme</span>
          </span>
          <p className="mt-1 truncate text-xs text-ink-300">{business.name}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {panelNavItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-ink-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={18} className={active ? "text-primary-300" : undefined} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="border-t border-white/10 p-3">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Çıkış Yap
          </button>
        </form>
      </aside>

      <div className="flex-1 bg-background">
        {/* Mobil üst bar */}
        <header className="flex items-center justify-between border-b border-border bg-ink-900 px-4 py-3 md:hidden">
          <span className="font-extrabold tracking-tight text-white">
            Locally <span className="text-primary-300">İşletme</span>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs font-medium text-ink-300">
              Çıkış
            </button>
          </form>
        </header>

        <main className="pb-20 md:pb-0">{children}</main>

        {/* Mobil: kaydırmalı alt sekmeler */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-border bg-card/95 backdrop-blur md:hidden">
          <div className="flex min-w-max">
            {panelNavItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex w-20 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                    active ? "text-primary-600" : "text-muted-foreground"
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
