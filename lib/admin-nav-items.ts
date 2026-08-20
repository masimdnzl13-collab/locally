import {
  LayoutDashboard,
  Building2,
  ShieldAlert,
  Undo2,
  Mail,
  Archive,
} from "lucide-react";

export const adminNavItems = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/isletmeler", label: "İşletme Onayları", icon: Building2 },
  { href: "/admin/icerik", label: "İçerik Gözetimi", icon: ShieldAlert },
  { href: "/admin/iadeler", label: "İade Talepleri", icon: Undo2 },
  { href: "/admin/bekleme-listesi", label: "Bekleme Listesi", icon: Mail },
  { href: "/admin/eski-veri", label: "Eski Örnek Veri", icon: Archive },
] as const;
