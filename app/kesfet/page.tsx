import { CloudSun } from "lucide-react";
import { getDiscoverPackages } from "@/lib/packages/queries";
import { getSelectedCity } from "@/lib/locations-server";
import DiscoverView from "@/components/discover/discover-view";
import FlashStripServer from "@/components/flash/flash-strip-server";
import { EmptyState } from "@/components/ui/empty-state";
import type { BusinessCategory } from "@/lib/types";

const VALID_CATEGORIES: BusinessCategory[] = [
  "restoran",
  "kafe",
  "otel",
  "beach_club",
  "aktivite",
  "diger",
];

export default async function KesfetPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const city = getSelectedCity();
  const packages = await getDiscoverPackages(city);

  if (packages.length === 0) {
    return (
      <div>
        <FlashStripServer />
        <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 md:min-h-[calc(100dvh-4.5rem)]">
          <EmptyState
            icon={CloudSun}
            title="Bu kategoride şu an paket yok, yakında eklenecek"
            description={`${city}'daki işletmeler çok yakında burada.`}
            className="border-none bg-transparent"
          />
        </div>
      </div>
    );
  }

  const initialCategory = VALID_CATEGORIES.includes(
    searchParams.category as BusinessCategory
  )
    ? (searchParams.category as BusinessCategory)
    : "tumu";

  return (
    <div>
      <FlashStripServer />
      <DiscoverView
        packages={packages}
        city={city}
        initialQuery={searchParams.q ?? ""}
        initialCategory={initialCategory}
      />
    </div>
  );
}
