"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Keşfet",
    links: [
      { href: "/kesfet", label: "Tüm kampanyalar" },
      { href: "/bu-aksam", label: "Bu akşam" },
      { href: "/etkinlikler", label: "Etkinlikler" },
    ],
  },
  {
    title: "Hesap",
    links: [
      { href: "/hesabim", label: "Hesabım" },
      { href: "/favorilerim", label: "Favorilerim" },
      { href: "/giris", label: "Giriş yap" },
      { href: "/kayit", label: "Kayıt ol" },
    ],
  },
  {
    title: "İşletmeler",
    links: [{ href: "/panel", label: "İşletme paneli" }],
  },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/panel") || pathname?.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-border bg-muted pb-16 md:pb-0">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span className="font-serif text-xl italic text-foreground">Locally</span>
            <p className="mt-2 max-w-[22ch] text-sm text-muted-foreground">
              Bodrum&apos;da sezon dışı yerel fırsatları keşfet.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Locally. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}
