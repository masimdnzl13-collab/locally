import AuthShell from "@/components/auth/auth-shell";
import SignupForm from "@/components/auth/signup-form";

export default function KayitPage({
  searchParams,
}: {
  searchParams: { rol?: string; isletme?: string };
}) {
  // Only skip the "continue as" chooser when a role was explicitly requested
  // (e.g. the homepage's "İşletmemi Kaydet" CTA, or the admin saha kayıt
  // kartı — bkz. app/admin/kayit-karti — links to ?rol=isletme).
  const initialRole = searchParams.rol === "isletme" ? "business" : undefined;
  // Saha kayıt kartındaki QR, işletme adını önceden doldurarak sürtünmeyi
  // daha da azaltır — bkz. lib/admin/actions.ts generateSignupInviteAction.
  const initialBusinessName = searchParams.isletme?.trim() || undefined;

  return (
    <AuthShell title="Locally'e katıl" description="1,5 dakikada hesabını oluştur">
      <SignupForm initialRole={initialRole} initialBusinessName={initialBusinessName} />
    </AuthShell>
  );
}
