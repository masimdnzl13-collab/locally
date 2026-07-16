import { createClient } from "@/lib/supabase/server";
import type { BusinessCategory } from "@/lib/types";

export interface DiscoverPackage {
  id: string;
  title: string;
  sale_price: number;
  summer_reference_price: number;
  usage_count: number;
  expires_at: string;
  purchasable: boolean;
  quota: number | null;
  sold_count: number;
  business: {
    name: string;
    slug: string;
    district: string | null;
    city: string;
    category: BusinessCategory;
    cover_url: string | null;
  };
}

// Supabase henüz yapılandırılmadıysa (env değişkenleri boş) bu fonksiyon
// hata fırlatmak yerine boş liste döner; girişsiz keşfet sayfası hiçbir
// zaman çökmemeli.
export async function getDiscoverPackages(): Promise<DiscoverPackage[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("packages")
      .select(
        `id, title, sale_price, summer_reference_price, usage_count, expires_at, quota, sold_count,
         business:businesses!inner(name, slug, district, city, category, cover_url, approval_status, iyzico_onboarding_status)`
      )
      .eq("is_active", true)
      .eq("business.approval_status", "approved")
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => {
      const business = Array.isArray(row.business) ? row.business[0] : row.business;
      return {
        ...row,
        business,
        purchasable: business.iyzico_onboarding_status === "approved",
      };
    }) as unknown as DiscoverPackage[];
  } catch {
    return [];
  }
}

export interface PackageDetail {
  id: string;
  title: string;
  description: string | null;
  sale_price: number;
  summer_reference_price: number;
  normal_value: number | null;
  usage_count: number;
  expires_at: string;
  purchasable: boolean;
  business: {
    id: string;
    name: string;
    slug: string;
    district: string | null;
    city: string;
    category: BusinessCategory;
    cover_url: string | null;
  };
}

export interface PanelPackage {
  id: string;
  title: string;
  image_url: string | null;
  sale_price: number;
  summer_reference_price: number;
  usage_count: number;
  quota: number | null;
  sold_count: number;
  expires_at: string;
  is_active: boolean;
  removed_by_admin: boolean;
}

export async function getMyPackages(businessId: string): Promise<PanelPackage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("packages")
    .select(
      "id, title, image_url, sale_price, summer_reference_price, usage_count, quota, sold_count, expires_at, is_active, removed_by_admin"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as PanelPackage[];
}

export async function getPackageForEdit(id: string, businessId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (error || !data) return null;
  return data as import("@/lib/types").Package;
}

export async function getPackageDetail(id: string): Promise<PackageDetail | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("packages")
      .select(
        `id, title, description, sale_price, summer_reference_price, normal_value,
         usage_count, expires_at,
         business:businesses!inner(id, name, slug, district, city, category, cover_url, approval_status, iyzico_onboarding_status)`
      )
      .eq("id", id)
      .eq("is_active", true)
      .eq("business.approval_status", "approved")
      .single();

    if (error || !data) return null;

    const business = Array.isArray(data.business) ? data.business[0] : data.business;

    return {
      ...data,
      business,
      purchasable: business.iyzico_onboarding_status === "approved",
    } as unknown as PackageDetail;
  } catch {
    return null;
  }
}
