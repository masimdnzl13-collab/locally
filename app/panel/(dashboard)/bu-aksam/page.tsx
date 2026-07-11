import { getMyBusiness } from "@/lib/business/current";
import { getLiveFlashForBusiness, getFlashHistory } from "@/lib/flash-deals/queries";
import FlashDealPanel from "@/components/panel/flash-deal-panel";

export default async function PanelFlashPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const [liveFlash, history] = await Promise.all([
    getLiveFlashForBusiness(business.id),
    getFlashHistory(business.id),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-dark-900">Bu Akşam</h1>
      <FlashDealPanel liveFlash={liveFlash} history={history} />
    </div>
  );
}
