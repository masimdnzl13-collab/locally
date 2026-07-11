import { getDiscoverPackages } from "@/lib/packages/queries";
import DiscoverView from "@/components/discover/discover-view";
import FlashStripServer from "@/components/flash/flash-strip-server";

export default async function KesfetPage() {
  const packages = await getDiscoverPackages();

  if (packages.length === 0) {
    return (
      <div>
        <FlashStripServer />
        <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 text-center md:min-h-[calc(100dvh-4.5rem)]">
          <div className="mb-4 text-4xl">🌤️</div>
          <p className="font-medium text-dark-900">
            Bu kategoride şu an paket yok, yakında eklenecek
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Bodrum&apos;daki işletmeler çok yakında burada.
          </p>
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
