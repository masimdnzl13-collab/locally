import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import UsSignupForm from "@/components/onboarding-us/us-signup-form";
import { getCurrentUsSignup } from "@/lib/onboarding-us/signup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get started with Locally",
};

// P6 — ABD restoranları için self-servis kayıt (1/3: bilgiler + sözleşme).
// Arayüz İngilizce, marka her yerde "Locally".
export default async function UsSignupPage() {
  // Yarım kalmış bir başvuru varsa (çerez veya oturum) kaldığı yerden devam.
  if (await getCurrentUsSignup()) redirect("/kayit/us/durum");

  return (
    <AuthShell title="Get started with Locally" description="Set up your restaurant in about 3 minutes">
      <UsSignupForm />
    </AuthShell>
  );
}
