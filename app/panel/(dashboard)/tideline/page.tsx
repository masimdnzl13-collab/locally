import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { hasTidelineAccess } from "@/lib/tideline/access";
import TidelineFrame from "@/components/panel/tideline-frame";

export const dynamic = "force-dynamic";

export default async function PanelTidelinePage() {
  const business = await getMyBusiness();
  if (!business || !hasTidelineAccess(business)) redirect("/panel");

  return <TidelineFrame />;
}
