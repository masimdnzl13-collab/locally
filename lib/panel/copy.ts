import type { BusinessCategory, BusinessMarket } from "@/lib/types";

// İşletme paneli görünen metinleri — ABD (market='US') işletmeleri İngilizce
// görür. Tam bir i18n altyapısı DEĞİL: yalnızca panel kabuğu (menü, üst bar)
// ve panel ana sayfasının metinleri; desen lib/billing/copy.ts ile aynı.
// Menü etiketleri href'e göre eşlenir (bkz. lib/panel-nav-items.ts).

const tr = {
  locale: "tr-TR",
  currency: "TRY",
  brandSuffix: "İşletme",
  businessMode: "İşletme modu",
  switchRole: "Rol değiştir",
  signOut: "Çıkış Yap",
  signOutShort: "Çıkış",
  nav: {} as Record<string, string>,
  dashboard: {
    welcome: "Hoş geldin,",
    live: "Yayında",
    monthlySales: "Bu ay satış",
    redemptions: "Kullanılan hak",
    redemptionsHint: "toplam QR okutma",
    activePackages: "Aktif paket",
    activePackagesHint: "satışta",
    tonight: "Bu akşam",
    flashOn: "Flaş var 🔥",
    flashOff: "Flaş yok",
    view: "Görüntüle",
    create: "Oluştur",
    weeklyChart: "Son 7 gün QR okutma",
    quickActions: "Hızlı İşlemler",
    createFlash: "🔥 Bu Akşam Flaşı Oluştur",
    newPackage: "+ Yeni Paket Ekle",
    sendAnnouncement: "📣 Duyuru Gönder",
    recentActivity: "Son Hareketler",
    emptyActivity: "İlk paketini ekle, satışlar ve hareketler burada görünecek.",
    justNow: "az önce",
    minutesAgo: "{n} dk önce",
    hoursAgo: "{n} sa önce",
    daysAgo: "{n} gün önce",
  },
  categories: {
    restoran: "Restoran",
    kafe: "Kafe",
    otel: "Otel",
    beach_club: "Beach Club",
    aktivite: "Aktivite",
    diger: "Diğer",
  } as Record<BusinessCategory, string>,
};

type PanelCopy = typeof tr;

const en: PanelCopy = {
  locale: "en-US",
  currency: "USD",
  brandSuffix: "Business",
  businessMode: "Business mode",
  switchRole: "Switch role",
  signOut: "Log out",
  signOutShort: "Log out",
  nav: {
    "/panel": "Overview",
    "/panel/kurulum-adimlari": "Setup",
    "/panel/paketler": "Packages",
    "/panel/kuponlar": "Coupons",
    "/panel/bu-aksam": "Tonight",
    "/panel/etkinlikler": "Events",
    "/panel/rezervasyonlar": "Reservations",
    "/panel/qr-dogrula": "Scan QR",
    "/panel/musteriler": "Customers",
    "/panel/yorumlar": "Reviews",
    "/panel/duyurular": "Announcements",
    "/panel/faturalandirma": "Billing",
    "/panel/tideline": "Tideline",
    "/panel/ayarlar": "Settings",
  },
  dashboard: {
    welcome: "Welcome back,",
    live: "Live",
    monthlySales: "Sales this month",
    redemptions: "Redemptions",
    redemptionsHint: "total QR scans",
    activePackages: "Active packages",
    activePackagesHint: "on sale",
    tonight: "Tonight",
    flashOn: "Flash deal live 🔥",
    flashOff: "No flash deal",
    view: "View",
    create: "Create",
    weeklyChart: "QR scans, last 7 days",
    quickActions: "Quick actions",
    createFlash: "🔥 Create tonight's flash deal",
    newPackage: "+ Add a package",
    sendAnnouncement: "📣 Send an announcement",
    recentActivity: "Recent activity",
    emptyActivity: "Add your first package — sales and activity will show up here.",
    justNow: "just now",
    minutesAgo: "{n} min ago",
    hoursAgo: "{n} h ago",
    daysAgo: "{n} d ago",
  },
  categories: {
    restoran: "Restaurant",
    kafe: "Café",
    otel: "Hotel",
    beach_club: "Beach club",
    aktivite: "Activity",
    diger: "Other",
  },
};

export function panelCopy(market: BusinessMarket): PanelCopy {
  return market === "US" ? en : tr;
}

// TR'de nav sözlüğü boş: etiket panelNavItems'taki (Türkçe) label'dan gelir.
export function navLabel(copy: PanelCopy, href: string, fallback: string) {
  return copy.nav[href] ?? fallback;
}
