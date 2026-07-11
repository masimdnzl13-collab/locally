import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getCustomers } from "@/lib/customers/queries";
import CustomersView from "@/components/panel/customers-view";

export default async function PanelCustomersPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const customers = await getCustomers(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-dark-900">Müşteriler</h1>
        <Link
          href="/panel/musteriler/yeni"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
        >
          + Müşteri Ekle
        </Link>
      </div>

      <CustomersView customers={customers} />

      <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        🔒 Bu müşteri verileri yalnızca senin işletmene ait ve gizlidir. Veriler
        işletmeler arasında hiçbir şekilde paylaşılmaz.
      </p>
    </div>
  );
}
