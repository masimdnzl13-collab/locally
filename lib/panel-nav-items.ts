import {
  LayoutDashboard,
  Package,
  Flame,
  CalendarDays,
  CalendarCheck,
  QrCode,
  Users,
  MessageSquareText,
  Megaphone,
  Percent,
  CreditCard,
  Settings,
  ListChecks,
  PhoneCall,
} from "lucide-react";

export const panelNavItems = [
  { href: "/panel", label: "Özet", icon: LayoutDashboard },
  { href: "/panel/kurulum-adimlari", label: "Kurulum", icon: ListChecks },
  { href: "/panel/paketler", label: "Paketlerim", icon: Package },
  { href: "/panel/kuponlar", label: "Kuponlar", icon: Percent },
  { href: "/panel/bu-aksam", label: "Bu Akşam", icon: Flame },
  { href: "/panel/etkinlikler", label: "Etkinlikler", icon: CalendarDays },
  { href: "/panel/rezervasyonlar", label: "Rezervasyonlar", icon: CalendarCheck },
  { href: "/panel/qr-dogrula", label: "QR Doğrula", icon: QrCode },
  { href: "/panel/musteriler", label: "Müşteriler", icon: Users },
  { href: "/panel/yorumlar", label: "Yorumlar", icon: MessageSquareText },
  { href: "/panel/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/panel/abonelik", label: "Abonelik", icon: CreditCard },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: Settings },
] as const;

// Yalnızca hasTidelineAccess(business) olan (US pazarı + tideline modülü +
// eşlenmiş restoran) işletmelerde menüye eklenir — bkz. PanelShell.
export const tidelineNavItem = { href: "/panel/tideline", label: "Tideline", icon: PhoneCall } as const;
