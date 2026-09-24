import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";
import UsShell from "@/components/us/us-shell";

export const metadata: Metadata = {
  title: "Log in · Locally",
};

// ABD restoranlarının İngilizce giriş sayfası. /giris ile aynı signInAction'ı
// kullanır (lang=en → İngilizce hata metinleri).
export default function UsLoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <UsShell>
      <AuthShell title="Welcome back" description="Log in to your restaurant dashboard">
        <LoginForm next={searchParams.next} locale="en" />
      </AuthShell>
    </UsShell>
  );
}
