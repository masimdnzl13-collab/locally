import AuthShell from "@/components/auth/auth-shell";
import ResetPasswordForm from "@/components/auth/reset-password-form";

export default function SifreSifirlaPage() {
  return (
    <AuthShell title="Yeni şifre belirle" description="Hesabın için yeni bir şifre oluştur">
      <ResetPasswordForm />
    </AuthShell>
  );
}
