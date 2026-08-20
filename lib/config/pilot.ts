// PİLOT MOD: para hiçbir şekilde platformdan geçmez. Kullanıcı paketi/bileti
// uygulamadan ayırtır, ödemeyi işletmede (nakit/kart) yapar. Platform
// yalnızca hakları ve QR doğrulamayı yönetir.
//
// Gerçek ödeme sağlayıcısına (iyzico) geçiş tek noktadan yapılır: bu değeri
// false yap. lib/payments, lib/iyzico ve app/api/iyzico katmanları silinmedi,
// kapalı duruyor — false olduğunda initiatePackageCheckoutAction ve
// purchaseEventTicketAction otomatik olarak gerçek ödeme akışına döner
// (bkz. lib/purchases/actions.ts, lib/events/actions.ts).
export const PILOT_MODE = true;
