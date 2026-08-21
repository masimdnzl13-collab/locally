import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

export interface OnboardingStatus {
  info: boolean;
  images: boolean;
  pkg: boolean;
  qr: boolean;
  completed: boolean;
  doneCount: number;
}

type OnboardingBusiness = Pick<
  Business,
  "district" | "address" | "phone" | "logo_url" | "cover_url" | "qr_stand_viewed_at"
>;

export function deriveOnboardingStatus(
  business: OnboardingBusiness,
  hasPackage: boolean
): OnboardingStatus {
  const info = Boolean(business.district && business.address && business.phone);
  const images = Boolean(business.logo_url && business.cover_url);
  const pkg = hasPackage;
  const qr = Boolean(business.qr_stand_viewed_at);
  const doneCount = [info, images, pkg, qr].filter(Boolean).length;

  return { info, images, pkg, qr, completed: doneCount === 4, doneCount };
}

export async function getHasAnyPackage(businessId: string): Promise<boolean> {
  const supabase = createClient();
  const { count } = await supabase
    .from("packages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  return (count ?? 0) > 0;
}
