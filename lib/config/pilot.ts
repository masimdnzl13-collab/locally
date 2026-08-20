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

// TEST LAB (bkz. app/test-lab-k7m2p9x4/page.tsx): pilot sırasında tek
// kişi/tek telefonla test yapabilmek için hazır hesaplar, sahte QR'lar ve
// simülasyon düğmeleri barındıran, adresi tahmin edilemeyen bir sayfa.
// KAPATMAK İÇİN: bu değeri false yap ve deploy et. Sayfa false iken sadece
// admin girişli kullanıcılara açık kalır (bkz. app/test-lab-k7m2p9x4/page.tsx),
// true iken herkese (giriş yapmamış olsa bile) açıktır — bilerek, çünkü
// tek amacı hesap değiştirmeden test yapabilmek, dolayısıyla pilot bittiğinde
// veya prod'a gerçek kullanıcı alındığında MUTLAKA false yapılmalı.
export const TEST_LAB_ENABLED = true;
