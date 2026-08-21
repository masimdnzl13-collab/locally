"use client";

import { Printer } from "lucide-react";

export default function QrStandCard({
  businessName,
  qrDataUrl,
  profileUrl,
}: {
  businessName: string;
  qrDataUrl: string;
  profileUrl: string;
}) {
  return (
    <div>
      <div className="mx-auto flex w-full max-w-xs flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-card print:border-0 print:p-0 print:shadow-none">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Locally</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{businessName}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`${businessName} QR kodu`} className="mt-6 h-56 w-56" />
        <p className="mt-6 text-sm font-semibold text-foreground">Fırsatları keşfetmek için okut</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{profileUrl}</p>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="mx-auto mt-6 flex items-center gap-2 rounded-md bg-navy-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-800 print:hidden"
      >
        <Printer size={16} />
        Yazdır
      </button>
    </div>
  );
}
