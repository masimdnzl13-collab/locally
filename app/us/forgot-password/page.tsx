import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import UsShell from "@/components/us/us-shell";

export const metadata: Metadata = {
  title: "Reset your password · Locally",
};

// /sifremi-unuttum'un İngilizce karşılığı (ABD restoranları). Aynı
// requestPasswordResetAction'ı kullanır; e-postadaki bağlantı /us/reset-password'e döner.
export default function UsForgotPasswordPage() {
  return (
    <UsShell>
      <AuthShell title="Forgot your password?" description="We'll email you a link to reset it">
        <ForgotPasswordForm locale="en" />
      </AuthShell>
    </UsShell>
  );
}
