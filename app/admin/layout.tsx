import AdminShell from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Merkezi guard (lib/auth/require-admin.ts). Denetim kaydını sayfalar kendi
  // yollarıyla yazar; layout yolu bilmediği için burada yalnızca kontrol eder.
  const { roles } = await requireAdmin();
  return <AdminShell isMultiRole={roles.length > 1}>{children}</AdminShell>;
}
