import { getActiveFlashDeals } from "@/lib/flash-deals/queries";
import FlashStrip from "@/components/flash/flash-strip";

export default async function FlashStripServer() {
  const deals = await getActiveFlashDeals();
  if (deals.length === 0) return null;

  const nearestEndsAt = deals.reduce(
    (min, d) => (d.ends_at < min ? d.ends_at : min),
    deals[0].ends_at
  );

  return <FlashStrip count={deals.length} nearestEndsAt={nearestEndsAt} />;
}
