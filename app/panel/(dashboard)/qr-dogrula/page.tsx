import { getMyBusiness } from "@/lib/business/current";
import { getTodayVerificationHistory } from "@/lib/verification/queries";
import QrVerifyView from "@/components/panel/qr-verify-view";

export default async function QrDogrulaPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const history = await getTodayVerificationHistory(business.id);

  return <QrVerifyView initialHistory={history} />;
}
