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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        {pkg.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pkg.image_url} alt={pkg.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">✨</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold text-foreground">{pkg.title}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${PACKAGE_STATUS_CLASSES[status]}`}
          >
            {PACKAGE_STATUS_LABELS[status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatTL(pkg.sale_price)}{" "}
          <span className="text-muted-foreground/50 line-through">{formatTL(pkg.summer_reference_price)}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {pkg.sold_count} satıldı{pkg.quota !== null ? ` / ${pkg.quota} kontenjan` : ""} ·{" "}
          {left > 0 ? `${left} gün kaldı` : "süresi doldu"}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link
          href={`/panel/paketler/${pkg.id}/duzenle`}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Düzenle
        </Link>
        {!pkg.removed_by_admin && (
          <button
            type="button"
            disabled={isPending}
            onClick={toggleActive}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {pkg.is_active ? "Pasifleştir" : "Aktifleştir"}
          </button>
        )}
      </div>
    </div>
  );
}
