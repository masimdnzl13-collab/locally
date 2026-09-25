import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import FieldLeadForm from "@/components/admin/field-lead-form";

export const metadata: Metadata = { title: "Sahada aday ekle" };

// AN — WAT saha turu için mobil-öncelikli hızlı ekleme. Yetki admin
// layout'unda (app/admin/layout.tsx) ve server action'da kontrol edilir.
export default function FieldLeadPage() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/admin/isletme-hatti"
          className="flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <ChevronLeft size={18} aria-hidden /> İşletme Hattı
        </Link>
      </div>
      <h1 className="px-4 pt-1 text-2xl font-bold tracking-tight text-navy-900">Aday ekle</h1>
      <FieldLeadForm />
    </div>
  );
}
