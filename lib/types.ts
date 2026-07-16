export type UserRole = "user" | "business" | "admin";

export type BusinessCategory =
  | "restoran"
  | "kafe"
  | "otel"
  | "beach_club"
  | "aktivite"
  | "diger";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: BusinessCategory;
  city: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
  approval_status: ApprovalStatus;
  legal_name: string | null;
  tax_identity_number: string | null;
  iban: string | null;
  iyzico_submerchant_type: string | null;
  iyzico_submerchant_key: string | null;
  iyzico_onboarding_status: "not_started" | "pending" | "approved" | "rejected";
  iyzico_reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const IYZICO_ONBOARDING_LABELS: Record<Business["iyzico_onboarding_status"], string> = {
  not_started: "Başlanmadı",
  pending: "İnceleniyor",
  approved: "Onaylı",
  rejected: "Reddedildi",
};

export interface Package {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sale_price: number;
  summer_reference_price: number;
  normal_value: number | null;
  usage_count: number;
  usage_description: string | null;
  expires_at: string;
  quota: number | null;
  per_person_limit: number;
  sold_count: number;
  is_active: boolean;
  removed_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

export type PackageStatus =
  | "aktif"
  | "pasif"
  | "suresi_doldu"
  | "kontenjan_doldu"
  | "admin_kaldirdi";

export function getPackageStatus(
  pkg: Pick<Package, "is_active" | "expires_at" | "quota" | "sold_count"> &
    Partial<Pick<Package, "removed_by_admin">>
): PackageStatus {
  if (pkg.removed_by_admin) return "admin_kaldirdi";
  if (!pkg.is_active) return "pasif";
  if (new Date(pkg.expires_at) < new Date()) return "suresi_doldu";
  if (pkg.quota !== null && pkg.sold_count >= pkg.quota) return "kontenjan_doldu";
  return "aktif";
}

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  aktif: "Aktif",
  pasif: "Pasif",
  suresi_doldu: "Süresi Doldu",
  kontenjan_doldu: "Kontenjan Doldu",
  admin_kaldirdi: "Admin Tarafından Kaldırıldı",
};

export const PACKAGE_STATUS_CLASSES: Record<PackageStatus, string> = {
  aktif: "bg-primary/10 text-primary-700",
  pasif: "bg-sand-100 text-sepia-600",
  suresi_doldu: "bg-tile-50 text-tile-600",
  kontenjan_doldu: "bg-accent/10 text-accent-700",
  admin_kaldirdi: "bg-tile-100 text-tile-700",
};

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  restoran: "Restoran",
  kafe: "Kafe",
  otel: "Otel",
  beach_club: "Beach Club",
  aktivite: "Aktivite",
  diger: "Diğer",
};
