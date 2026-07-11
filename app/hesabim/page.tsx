import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";

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
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary-600">
          {(profile?.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-dark-900">
            {profile?.full_name ?? "Locally Kullanıcısı"}
          </p>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <Link
        href="/hesabim/paketlerim"
        className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-dark-900 hover:bg-slate-50"
      >
        🎟️ Paketlerim
        <span className="text-slate-400">→</span>
      </Link>

      <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        <p>Biletlerin ve hesap ayarların çok yakında burada olacak.</p>
      </div>

      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Çıkış Yap
        </button>
      </form>
    </section>
  );
}
