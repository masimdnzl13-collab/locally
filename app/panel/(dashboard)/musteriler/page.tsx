import Link from "next/link";
import { getMyBusiness } from "@/lib/business/current";
import { getCustomers } from "@/lib/customers/queries";
import CustomersView from "@/components/panel/customers-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PanelCustomersPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const customers = await getCustomers(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Müşteriler
        </h1>
        <Link
          href="/panel/musteriler/yeni"
          className={cn(buttonVariants({ variant: "teal", size: "sm" }))}
        >
          + Müşteri Ekle
        </Link>
      </div>

      <CustomersView customers={customers} />

      <p className="mt-8 rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
        🔒 Bu müşteri verileri yalnızca senin işletmene ait ve gizlidir. Veriler
        işletmeler arasında hiçbir şekilde paylaşılmaz.
      </p>
    </div>
  );
}
