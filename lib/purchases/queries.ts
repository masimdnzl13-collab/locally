import { createClient } from "@/lib/supabase/server";

export interface PurchaseWithEntitlement {
  id: string;
  package: {
    title: string;
    business: { name: string };
  };
  entitlement: {
    qr_code: string;
    remaining_uses: number;
    status: string;
  } | null;
}

export interface MyPackage {
  id: string;
  qr_code: string;
  remaining_uses: number;
  status: "active" | "used" | "expired";
  purchase_id: string;
  purchase_created_at: string;
  purchase_status: string;
  refund_requested: boolean;
  refund_reject_reason: string | null;
  package: {
    title: string;
    usage_count: number;
    expires_at: string;
    business: { name: string };
  };
}

export async function getMyPackages(userId: string): Promise<MyPackage[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("entitlements")
      .select(
        `id, qr_code, remaining_uses, status,
         purchase:purchases!inner(
           id, user_id, created_at, status, refund_requested, refund_reject_reason,
           package:packages(title, usage_count, expires_at, business:businesses(name))
         )`
      )
      .eq("purchase.user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => {
      const purchase = Array.isArray(row.purchase) ? row.purchase[0] : row.purchase;
      const pkg = Array.isArray(purchase?.package) ? purchase.package[0] : purchase?.package;
      const business = Array.isArray(pkg?.business) ? pkg.business[0] : pkg?.business;
      return {
        id: row.id,
        qr_code: row.qr_code,
        remaining_uses: row.remaining_uses,
        status: row.status,
        purchase_id: purchase?.id ?? "",
        purchase_created_at: purchase?.created_at ?? "",
        purchase_status: purchase?.status ?? "",
        refund_requested: purchase?.refund_requested ?? false,
        refund_reject_reason: purchase?.refund_reject_reason ?? null,
        package: {
          title: pkg?.title ?? "",
          usage_count: pkg?.usage_count ?? 0,
          expires_at: pkg?.expires_at ?? "",
          business: { name: business?.name ?? "" },
        },
      };
    }) as MyPackage[];
  } catch {
    return [];
  }
}

export interface CheckoutPurchase {
  id: string;
  status: string;
  amount: number;
  checkout_token: string | null;
  checkout_form_content: string | null;
  package: { title: string };
}

export async function getCheckoutPurchase(
  id: string,
  userId: string
): Promise<CheckoutPurchase | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select("id, status, amount, checkout_token, checkout_form_content, package:packages(title)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const pkg = Array.isArray(data.package) ? data.package[0] : data.package;

  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    checkout_token: data.checkout_token,
    checkout_form_content: data.checkout_form_content,
    package: { title: pkg?.title ?? "" },
  };
}

export async function getPurchaseWithEntitlement(
  purchaseId: string
): Promise<PurchaseWithEntitlement | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("purchases")
      .select(
        `id,
         package:packages(title, business:businesses(name)),
         entitlement:entitlements(qr_code, remaining_uses, status)`
      )
      .eq("id", purchaseId)
      .single();

    if (error || !data) return null;

    const pkg = Array.isArray(data.package) ? data.package[0] : data.package;
    const business = Array.isArray(pkg?.business) ? pkg.business[0] : pkg?.business;
    const entitlement = Array.isArray(data.entitlement)
      ? data.entitlement[0]
      : data.entitlement;

    return {
      id: data.id,
      package: { title: pkg?.title ?? "", business: { name: business?.name ?? "" } },
      entitlement: entitlement ?? null,
    };
  } catch {
    return null;
  }
}
