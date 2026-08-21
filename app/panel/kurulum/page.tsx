import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessForOwner } from "@/lib/business/ensure-business";

// Bu sayfa artık kurulum sihirbazı DEĞİL — businesses satırı normalde kayıt
// anında oluşur (bkz. lib/business/ensure-business.ts), bu route yalnızca
// o oluşturmanın bir sebepten (ör. e-posta onayı callback'inde geçici bir
// hata) atlandığı nadir durumu kendi kendine onarır, sonra asıl kurulum
// kontrol listesine (/panel/kurulum-adimlari) yönlendirir. Panel
// düzenindeki (dashboard) layout, business hiç yoksa buraya yönlendirir —
// bu yüzden bu sayfa o layout'un DIŞINDA durur (aksi halde döngü olurdu).
export default async function KurulumRepairPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/panel/kurulum");

  const { data: existing } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const businessName =
      (user.user_metadata?.business_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "İşletmem";

    try {
      await ensureBusinessForOwner(user.id, businessName);
    } catch {
      return (
        <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground">İşletme oluşturulamadı</h1>
          <p className="mt-2 max-w-sm text-balance text-sm text-muted-foreground">
            Bir sorun oluştu. Lütfen tekrar giriş yapmayı dene; sorun devam ederse bizimle iletişime geç.
          </p>
        </section>
      );
    }
  }

  redirect("/panel/kurulum-adimlari");
}
