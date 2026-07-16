import Link from "next/link";
import { redirect } from "next/navigation";
import { Ticket, ChevronRight, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { Card } from "@/components/ui/card";

export default async function HesabimPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris?next=/hesabim");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <section className="mx-auto max-w-md px-6 py-10">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-xl font-bold text-teal-700">
          {(profile?.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {profile?.full_name ?? "Locally Kullanıcısı"}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Link href="/hesabim/paketlerim" className="block">
        <Card
          hoverLift
          className="flex items-center justify-between p-4 text-sm font-semibold text-foreground"
        >
          <span className="flex items-center gap-2.5">
            <Ticket size={18} className="text-teal-600" strokeWidth={1.75} />
            Paketlerim
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </Card>
      </Link>

      <Card className="mt-3 p-4 text-sm text-muted-foreground">
        Biletlerin ve hesap ayarların çok yakında burada olacak.
      </Card>

      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <LogOut size={15} strokeWidth={2} />
          Çıkış Yap
        </button>
      </form>
    </section>
  );
}
