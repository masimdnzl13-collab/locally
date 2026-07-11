import { Home, Compass, Moon, CalendarDays, UserRound } from "lucide-react";

export const navItems = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/kesfet", label: "Keşfet", icon: Compass },
  { href: "/bu-aksam", label: "Bu Akşam", icon: Moon },
  { href: "/etkinlikler", label: "Etkinlikler", icon: CalendarDays },
  { href: "/hesabim", label: "Hesabım", icon: UserRound },
] as const;
