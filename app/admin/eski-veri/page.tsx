import { getLegacyBusinesses } from "@/lib/admin/queries";
import LegacyBusinessView from "@/components/admin/legacy-business-view";

export default async function AdminLegacyDataPage() {
  const businesses = await getLegacyBusinesses();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-navy-900">Eski Örnek Veri</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pilot öncesi elle yüklenmiş, demo veri işareti taşımayan eski örnek işletmeler.
        Gerçek pilot işletmeleri burada asla görünmez — yalnızca{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">@locally.app</code> sahipli
        kayıtlar listelenir. Her satır tek tek kaldırılır, toplu silme yoktur.
      </p>
      <LegacyBusinessView businesses={businesses} />
    </div>
  );
}
