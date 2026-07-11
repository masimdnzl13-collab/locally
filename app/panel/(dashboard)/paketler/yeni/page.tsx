import { getMyBusiness } from "@/lib/business/current";
import PackageForm from "@/components/panel/package-form";

export default async function NewPackagePage() {
  const business = await getMyBusiness();
  if (!business) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-dark-900">
        Yeni Paket
      </h1>
      <PackageForm fallbackCoverUrl={business.cover_url} />
    </div>
  );
}
