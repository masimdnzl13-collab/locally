import {
  LayoutDashboard,
  Package,
  Flame,
  CalendarDays,
  QrCode,
  Users,
  Megaphone,
  Settings,
} from "lucide-react";

export const panelNavItems = [
  { href: "/panel", label: "Özet", icon: LayoutDashboard },
  { href: "/panel/paketler", label: "Paketlerim", icon: Package },
  { href: "/panel/bu-aksam", label: "Bu Akşam", icon: Flame },
  { href: "/panel/etkinlikler", label: "Etkinlikler", icon: CalendarDays },
  { href: "/panel/qr-dogrula", label: "QR Doğrula", icon: QrCode },
  { href: "/panel/musteriler", label: "Müşteriler", icon: Users },
  { href: "/panel/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: Settings },
] as const;
