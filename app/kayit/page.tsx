import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";

export default function KayitPage({
  searchParams,
}: {
  searchParams: { rol?: string };
}) {
  const initialRole = searchParams.rol === "isletme" ? "business" : "user";

  return (
    <AuthShell title="Locally'e katıl" description="30 saniyede hesabını oluştur">
      <SignupForm initialRole={initialRole} />
    </AuthShell>
  );
}
