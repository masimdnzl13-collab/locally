import Link from "next/link";
import { Package as PackageIcon } from "lucide-react";
import { getMyBusiness } from "@/lib/business/current";
import { getMyPackages } from "@/lib/packages/queries";
import PackageRow from "@/components/panel/package-row";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default async function PanelPackagesPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const packages = await getMyPackages(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink-900">
          Paketlerim
        </h1>
        <Link
          href="/panel/paketler/yeni"
          className={cn(buttonVariants({ variant: "default", shape: "rect", size: "sm" }))}
        >
          + Yeni Paket
        </Link>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="Henüz paket eklemedin"
          description="İlk paketini oluşturarak vitrine çık."
          action={
            <Link
              href="/panel/paketler/yeni"
              className="text-sm font-semibold text-primary-600 hover:underline"
            >
              İlk paketini oluştur →
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <PackageRow key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
