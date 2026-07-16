"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNavItems } from "@/lib/admin-nav-items";
import { signOutAction } from "@/lib/auth/actions";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background md:flex">
      {/* Masaüstü: sol menü (ink workspace surface) */}
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:flex md:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <span className="text-base font-extrabold tracking-tight text-white">
            Locally <span className="text-primary-300">Admin</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {adminNavItems.map((item) => {
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
                <Icon size={17} className={active ? "text-primary-300" : undefined} />
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

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-white/10 bg-ink-900 px-4 py-3 md:hidden">
          <span className="font-extrabold tracking-tight text-white">
            Locally <span className="text-primary-300">Admin</span>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs font-medium text-ink-300">
              Çıkış
            </button>
          </form>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-2 py-2 md:hidden">
          {adminNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main>{children}</main>
      </div>
    </div>
  );
}
