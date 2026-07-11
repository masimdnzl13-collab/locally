import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getMyPackages } from "@/lib/packages/queries";
import PackageRow from "@/components/panel/package-row";

export default async function PanelPackagesPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const packages = await getMyPackages(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">Paketlerim</h1>
        <Link
          href="/panel/paketler/yeni"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          + Yeni Paket
        </Link>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">Henüz paket eklemedin.</p>
          <Link
            href="/panel/paketler/yeni"
            className="mt-3 inline-block text-sm font-semibold text-primary-600"
          >
            İlk paketini oluştur →
          </Link>
        </div>
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
