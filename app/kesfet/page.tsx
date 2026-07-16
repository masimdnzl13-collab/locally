import { CloudSun } from "lucide-react";
import { getDiscoverPackages } from "@/lib/packages/queries";
import DiscoverView from "@/components/discover/discover-view";
import FlashStripServer from "@/components/flash/flash-strip-server";
import { EmptyState } from "@/components/ui/empty-state";

export default async function KesfetPage() {
  const packages = await getDiscoverPackages();

  if (packages.length === 0) {
    return (
      <div>
        <FlashStripServer />
        <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 md:min-h-[calc(100dvh-4.5rem)]">
          <EmptyState
            icon={CloudSun}
            title="Bu kategoride şu an paket yok, yakında eklenecek"
            description="Bodrum'daki işletmeler çok yakında burada."
            className="border-none bg-transparent"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <FlashStripServer />
      <DiscoverView packages={packages} />
    </div>
  );
}
