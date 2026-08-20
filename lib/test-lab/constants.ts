// Client ve server tarafından ortak kullanılan sabitler — bu dosya
// next/headers gibi yalnızca-server modülleri asla import etmemeli, aksi
// halde "use client" bileşenleri (ör. account-card.tsx) build'i kırar.

export const TEST_LAB_PASSWORD = "TestLab2026!";

export const TEST_LAB_ACCOUNTS = [
  {
    role: "admin" as const,
    label: "Admin",
    email: "test.admin@locally.test",
    description: "Admin panelini, işletme onayını ve içerik gözetimini test etmek için.",
  },
  {
    role: "business" as const,
    label: "İşletme Sahibi",
    email: "test.isletme@locally.test",
    description: '"Test İşletmesi" hesabı — panel, paket/flaş/etkinlik yönetimi, QR doğrulama.',
  },
  {
    role: "user" as const,
    label: "Normal Kullanıcı",
    email: "test.kullanici@locally.test",
    description: "Paket satın alma, flaşa yer ayırtma, etkinlik bileti, paketlerim ekranı.",
  },
];
