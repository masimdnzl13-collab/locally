"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setPackageActiveAction } from "@/lib/packages/actions";
import {
  PACKAGE_STATUS_CLASSES,
  PACKAGE_STATUS_LABELS,
  getPackageStatus,
} from "@/lib/types";
import type { PanelPackage } from "@/lib/packages/queries";

function formatTL(n: number) {
  return n.toLocaleString("tr-TR") + "₺";
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PackageRow({ pkg }: { pkg: PanelPackage }) {
  const [isPending, startTransition] = useTransition();
  const status = getPackageStatus(pkg);
  const left = daysLeft(pkg.expires_at);

  function toggleActive() {
    const formData = new FormData();
    formData.set("packageId", pkg.id);
    formData.set("isActive", String(!pkg.is_active));
    startTransition(async () => {
      await setPackageActiveAction(formData);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {pkg.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pkg.image_url} alt={pkg.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">✨</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold text-dark-900">{pkg.title}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${PACKAGE_STATUS_CLASSES[status]}`}
          >
            {PACKAGE_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {formatTL(pkg.sale_price)}{" "}
          <span className="text-slate-300 line-through">{formatTL(pkg.summer_reference_price)}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {pkg.sold_count} satıldı{pkg.quota !== null ? ` / ${pkg.quota} kontenjan` : ""} ·{" "}
          {left > 0 ? `${left} gün kaldı` : "süresi doldu"}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link
          href={`/panel/paketler/${pkg.id}/duzenle`}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-dark-900 hover:bg-slate-50"
        >
          Düzenle
        </Link>
        {!pkg.removed_by_admin && (
          <button
            type="button"
            disabled={isPending}
            onClick={toggleActive}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {pkg.is_active ? "Pasifleştir" : "Aktifleştir"}
          </button>
        )}
      </div>
    </div>
  );
}
