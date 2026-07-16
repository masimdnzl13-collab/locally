import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountSettingsForm from "@/components/auth/account-settings-form";

export default async function HesapAyarlariPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/hesabim/ayarlar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Hesap Ayarları</h1>
      <AccountSettingsForm
        email={user.email ?? ""}
        fullName={profile?.full_name ?? null}
        phone={profile?.phone ?? null}
      />
    </div>
  );
}
