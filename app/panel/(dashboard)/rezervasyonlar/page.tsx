import { getMyBusiness } from "@/lib/business/current";
import { getPendingReservations } from "@/lib/purchases/queries";
import ReservationsView from "@/components/panel/reservations-view";

export default async function RezervasyonlarPage() {
  const business = await getMyBusiness();
  if (!business) return null;

  const reservations = await getPendingReservations(business.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rezervasyonlar</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Ödemesini henüz almadığın paket ayırtmaları. Müşteri ilk kez geldiğinde
        QR kodunu okut — ödeme aldıktan sonra rezervasyon otomatik aktif olur.
        14 gün içinde gelinmeyen rezervasyonlar otomatik düşer.
      </p>

      <ReservationsView reservations={reservations} />
    </div>
  );
}
