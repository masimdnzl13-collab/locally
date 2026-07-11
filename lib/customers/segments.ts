import type { Customer } from "@/lib/customers/queries";

export type Segment = "tumu" | "yeni" | "sadik" | "uyuyan";

export const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "tumu", label: "Tümü" },
  { id: "yeni", label: "Yeni" },
  { id: "sadik", label: "Sadık" },
  { id: "uyuyan", label: "Uyuyan" },
];

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function matchesSegment(c: Customer, segment: Segment) {
  if (segment === "tumu") return true;
  if (segment === "yeni") return !!c.first_visit_at && isThisMonth(c.first_visit_at);
  if (segment === "sadik") return c.visit_count >= 3;
  if (segment === "uyuyan") return !!c.last_visit_at && daysSince(c.last_visit_at) >= 30;
  return true;
}
