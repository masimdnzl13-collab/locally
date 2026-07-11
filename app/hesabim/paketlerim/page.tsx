import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyPackages } from "@/lib/purchases/queries";
import { getMyTickets } from "@/lib/events/queries";
import { generateQrDataUrl } from "@/lib/qr";
import MyPackagesView, { type MyPackageCard } from "@/components/packages/my-packages-view";
import MyTicketsView, { type MyTicketCard } from "@/components/events/my-tickets-view";
import MyStuffSwitcher from "@/components/packages/my-stuff-switcher";

export default async function PaketlerimPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=/hesabim/paketlerim");

  const [entitlements, tickets] = await Promise.all([
    getMyPackages(user.id),
    getMyTickets(user.id),
  ]);

  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const packageItems: MyPackageCard[] = await Promise.all(
    entitlements.map(async (e) => ({
      id: e.id,
      businessName: e.package.business.name,
      title: e.package.title,
      remainingUses: e.remaining_uses,
      totalUses: e.package.usage_count,
      expiresAt: e.package.expires_at,
      qrDataUrl: await generateQrDataUrl(e.qr_code),
      qrCode: e.qr_code,
      finished: e.status !== "active" || new Date(e.package.expires_at) < new Date(),
      purchaseId: e.purchase_id,
      refundEligible:
        e.purchase_status === "completed" &&
        !e.refund_requested &&
        e.remaining_uses === e.package.usage_count &&
        new Date(e.purchase_created_at).getTime() >= fourteenDaysAgo,
      refundRequested: e.refund_requested,
      refundRejectReason: e.refund_reject_reason,
    }))
  );

  const ticketItems: MyTicketCard[] = await Promise.all(
    tickets.map(async (t) => ({
      id: t.id,
      businessName: t.event.business.name,
      eventTitle: t.event.title,
      eventAt: t.event.event_at,
      priceLabel:
        t.price_paid && t.price_paid > 0
          ? t.price_paid.toLocaleString("tr-TR") + "₺"
          : "Ücretsiz",
      qrDataUrl: await generateQrDataUrl(t.qr_code),
      qrCode: t.qr_code,
      finished: t.status !== "active" || new Date(t.event.event_at) < new Date(),
      statusLabel: t.event.is_cancelled
        ? t.refund_status === "iade_sureci_baslatildi"
          ? "İptal edildi — iade süreci başlatıldı"
          : "Etkinlik iptal edildi"
        : null,
    }))
  );

  return (
    <MyStuffSwitcher
      packagesView={<MyPackagesView items={packageItems} />}
      ticketsView={<MyTicketsView items={ticketItems} />}
    />
  );
}
