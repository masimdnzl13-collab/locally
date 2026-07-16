import { redirect } from "next/navigation";
import { getMyBusiness } from "@/lib/business/current";
import { signOutAction } from "@/lib/auth/actions";
import PanelShell from "@/components/panel/panel-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getMyBusiness();

  if (!business || !business.logo_url || !business.cover_url) {
    redirect("/panel/kurulum");
  }

  if (business.approval_status === "pending") {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-discount-50 text-3xl text-discount-700">
          ⏳
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Başvurun inceleniyor
        </h1>
        <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
          {business.name} için başvurunu aldık, en kısa sürede onaylanacak.
        </p>
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="text-sm font-medium text-muted-foreground underline underline-offset-4">
            Çıkış Yap
          </button>
        </form>
      </section>
    );
  }

  if (business.approval_status === "rejected") {
    return (
      <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-3xl text-danger-700">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Başvurun onaylanmadı
        </h1>
        <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
          Detaylar için bizimle iletişime geçebilirsin.
        </p>
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="text-sm font-medium text-muted-foreground underline underline-offset-4">
            Çıkış Yap
          </button>
        </form>
      </section>
    );
  }

  return <PanelShell business={business}>{children}</PanelShell>;
}
