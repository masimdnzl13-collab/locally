"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNavItems } from "@/lib/admin-nav-items";
import { signOutAction } from "@/lib/auth/actions";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-100 px-5 py-4">
          <span className="text-base font-extrabold tracking-tight text-dark-900">
            Locally <span className="text-primary-600">Admin</span>
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-dark-900"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="border-t border-slate-100 p-3">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Çıkış Yap
          </button>
        </form>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="font-extrabold tracking-tight text-dark-900">
            Locally <span className="text-primary-600">Admin</span>
          </span>
          <form action={signOutAction}>
            <button type="submit" className="text-xs font-medium text-slate-500">
              Çıkış
            </button>
          </form>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 md:hidden">
          {adminNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                  active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
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
