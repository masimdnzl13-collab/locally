import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/panel/onboarding-wizard";

export default async function KurulumPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=/panel/kurulum");

  const { data: business } = await supabase
    .from("businesses")
    .select("name, category, description, district, address, phone, instagram, logo_url, cover_url")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (business?.logo_url && business?.cover_url) {
    redirect("/panel");
  }

  let initialStep: 1 | 2 | 3 = 1;
  if (business?.district && business?.address && business?.phone) {
    initialStep = 3;
  } else if (business?.name && business?.category) {
    initialStep = 2;
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-dark-900">
        İşletmeni Kur
      </h1>
      <p className="mb-8 text-sm text-slate-500">
        3 kısa adımda başvurunu tamamla, onaydan sonra yayına alalım.
      </p>
      <OnboardingWizard
        initialStep={initialStep}
        initialData={{
          name: business?.name ?? "",
          category: business?.category ?? "",
          description: business?.description ?? "",
          district: business?.district ?? "",
          address: business?.address ?? "",
          phone: business?.phone ?? "",
          instagram: business?.instagram ?? "",
        }}
      />
    </section>
  );
}
