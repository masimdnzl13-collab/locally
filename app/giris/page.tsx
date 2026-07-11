import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";

export default function GirisPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthShell title="Tekrar hoş geldin" description="Hesabına giriş yap">
      <LoginForm next={searchParams.next} />
    </AuthShell>
  );
}
