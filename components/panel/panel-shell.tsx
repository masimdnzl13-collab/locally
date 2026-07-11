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
    <div className="md:flex">
      {/* Masaüstü: sol menü */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-100 px-5 py-4">
          <span className="text-lg font-extrabold tracking-tight text-dark-900">
            Locally <span className="text-primary-600">İşletme</span>
          </span>
          <p className="mt-1 truncate text-xs text-slate-400">{business.name}</p>
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-dark-900"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="border-t border-slate-100 p-3">
          <button
            type="submit"
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Çıkış Yap
          </button>
        </form>
      </aside>

      <div className="flex-1">
        {/* Mobil üst bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-extrabold tracking-tight text-dark-900">
            Locally <span className="text-primary-600">İşletme</span>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs font-medium text-slate-500">
              Çıkış
            </button>
          </form>
        </header>

        <main className="pb-20 md:pb-0">{children}</main>

        {/* Mobil: kaydırmalı alt sekmeler */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
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
                    active ? "text-primary-600" : "text-slate-400"
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
