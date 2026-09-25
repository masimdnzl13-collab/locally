import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import UsShell from "@/components/us/us-shell";

export const metadata: Metadata = {
  title: "Choose a new password · Locally",
};

// /sifre-sifirla'nın İngilizce karşılığı: şifre sıfırlama e-postasındaki
// bağlantı buraya döner (Supabase Redirect URLs listesinde olmalı).
export default function UsResetPasswordPage() {
  return (
    <UsShell>
      <AuthShell title="Choose a new password" description="Set a new password for your Locally account">
        <ResetPasswordForm locale="en" />
      </AuthShell>
    </UsShell>
  );
}
