import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ComingSoon from "@/components/coming-soon";

export default async function OdemeYontemleriPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/hesabim/odeme-yontemleri");

  return (
    <ComingSoon
      title="Ödeme mekânda alınıyor"
      description="Şu an paketlerini ve biletlerini uygulamadan ayırtıyorsun, ödemeyi ilk ziyaretinde işletmede yapıyorsun. Kart kaydetme gibi online ödeme seçenekleri yakında eklenecek."
    />
  );
}
