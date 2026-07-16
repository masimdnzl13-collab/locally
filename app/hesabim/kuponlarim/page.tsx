import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ComingSoon from "@/components/coming-soon";

export default async function KuponlarimPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/hesabim/kuponlarim");

  return (
    <ComingSoon
      title="Kuponlarım çok yakında"
      description="İşletmelerden aldığın özel kuponları burada toplayacaksın. Şu an bu özellik üzerinde çalışıyoruz."
    />
  );
}
