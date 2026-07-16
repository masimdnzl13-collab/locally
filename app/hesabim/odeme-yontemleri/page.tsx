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
      title="Ödeme yöntemleri çok yakında"
      description="Kartlarını kaydedip tek dokunuşla ödeme yapabileceğin bu alan üzerinde çalışıyoruz. Şimdilik her satın almada ödeme bilgisi iyzico üzerinden güvenle alınıyor."
    />
  );
}
