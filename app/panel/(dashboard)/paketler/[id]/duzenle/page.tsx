import { notFound } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { getPackageForEdit } from "@/lib/packages/queries";
import PackageForm from "@/components/panel/package-form";

export default async function EditPackagePage({
  params,
}: {
  params: { id: string };
}) {
  const business = await getMyBusiness();
  if (!business) return null;

  const pkg = await getPackageForEdit(params.id, business.id);
  if (!pkg) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 font-display text-2xl font-medium tracking-tight text-ink-900">
        Paketi Düzenle
      </h1>
      <PackageForm pkg={pkg} hasSales={pkg.sold_count > 0} />
    </div>
  );
}
