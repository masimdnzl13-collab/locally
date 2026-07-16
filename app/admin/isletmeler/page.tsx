import {
  getApprovedBusinesses,
  getPendingBusinesses,
  getSuspendedBusinesses,
} from "@/lib/admin/queries";
import BusinessTabs from "@/components/admin/business-tabs";

export default async function AdminBusinessesPage() {
  const [pending, approved, suspended] = await Promise.all([
    getPendingBusinesses(),
    getApprovedBusinesses(),
    getSuspendedBusinesses(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-ink-900">
        İşletme Onayları
      </h1>
      <BusinessTabs pending={pending} approved={approved} suspended={suspended} />
    </div>
  );
}
