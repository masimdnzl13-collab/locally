import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ComingSoon from "@/components/coming-soon";

export default async function BildirimlerPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/bildirimler");

  return (
    <ComingSoon
      title="Bildirimler çok yakında"
      description="Fırsat başladığında, biletin hazır olduğunda ya da bir kampanya bitmek üzereyken seni burada haberdar edeceğiz."
    />
  );
}
