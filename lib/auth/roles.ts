import type { UserRole } from "@/lib/types";

const ALL_ROLES: readonly UserRole[] = ["user", "business", "admin"];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

// Bir hesabın "birincil" rolü (profiles.role) her zaman tekil kalır — kayıt
// akışı, e-posta onayı ve admin beyaz listesi bu alana yazmaya devam eder.
// additional_roles yalnızca P27 ile eklenen, elle atanan ek yetkiler.
// effectiveRoles bu ikisinin tekilleştirilmiş birleşimidir ve gerçek yetki
// kontrollerinin (panel/admin sayfa kapıları) baktığı tek şeydir.
export function getEffectiveRoles(profile: {
  role: UserRole;
  additional_roles?: UserRole[] | null;
}): UserRole[] {
  return Array.from(new Set<UserRole>([profile.role, ...(profile.additional_roles ?? [])]));
}

export const ROLE_DESTINATIONS: Record<UserRole, string> = {
  user: "/kesfet",
  business: "/panel",
  admin: "/admin",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Kullanıcı",
  business: "İşletme",
  admin: "Admin",
};

export const ACTIVE_ROLE_COOKIE = "locally_active_role";
