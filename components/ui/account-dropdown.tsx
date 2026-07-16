"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  Heart,
  Ticket,
  Percent,
  Bell,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Store,
  ChevronDown,
} from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/hesabim", label: "Profilim", icon: User },
  { href: "/favorilerim", label: "Favorilerim", icon: Heart },
  { href: "/hesabim/paketlerim", label: "Paketim", icon: Ticket },
  { href: "/hesabim/kuponlarim", label: "Kuponlarım", icon: Percent },
  { href: "/bildirimler", label: "Bildirimler", icon: Bell },
  { href: "/hesabim/odeme-yontemleri", label: "Ödeme Yöntemleri", icon: CreditCard },
  { href: "/hesabim/ayarlar", label: "Hesap Ayarları", icon: Settings },
  { href: "/yardim", label: "Yardım", icon: HelpCircle },
];

export function AccountDropdown({ user, className }: { user: CurrentUser; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initial = (user.fullName ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
          {initial}
        </span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.fullName || "Hesabım"}
              </p>
              {user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>

            {user.role === "business" && (
              <>
                <Link
                  href="/panel"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50"
                >
                  <Store size={16} strokeWidth={2} />
                  İşletme Panelim
                </Link>
                <div className="border-b border-border" />
              </>
            )}

            <div className="py-1">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <item.icon size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-danger-600 transition-colors hover:bg-danger-50"
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  Çıkış Yap
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
