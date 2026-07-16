import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";

export default function KayitPage({
  searchParams,
}: {
  searchParams: { rol?: string };
}) {
  // Only skip the "continue as" chooser when a role was explicitly requested
  // (e.g. the homepage's "İşletmemi Kaydet" CTA links to ?rol=isletme).
  const initialRole = searchParams.rol === "isletme" ? "business" : undefined;

  return (
    <AuthShell title="Locally'e katıl" description="30 saniyede hesabını oluştur">
      <SignupForm initialRole={initialRole} />
    </AuthShell>
  );
}
