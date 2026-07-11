import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export default function SifremiUnuttumPage() {
  return (
    <AuthShell
      title="Şifreni mi unuttun?"
      description="E-postana bir sıfırlama bağlantısı gönderelim"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
