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
  report: {
    title: "Haftalık Rapor",
    intro: "Tideline sipariş asistanının son 7 günde senin için yaptıkları.",
    calls: "Gelen çağrı",
    callsHint: "son 7 gün",
    converted: "Siparişe / rezervasyona dönen",
    convertedHint: "{orders} sipariş · {reservations} rezervasyon",
    avgDuration: "Ortalama arama süresi",
    noDuration: "—",
    topIntents: "En çok sorulanlar",
    topIntentsEmpty: "Henüz yeterli konuşma yok.",
    callersAsked: "{n} arayan",
    empty: "Bu hafta henüz çağrı gelmedi. Asistanın numarası aktifse ilk çağrılar burada görünecek.",
    unavailable: "Rapor şu an yüklenemedi. Biraz sonra tekrar dene.",
    intents: {
      GENERAL_QUESTION: "Genel sorular", RESTAURANT_INFO: "Restoran bilgisi", HOURS: "Çalışma saatleri", LOCATION: "Adres / yol tarifi",
      PARKING: "Otopark", MENU: "Menü", MENU_ITEM: "Menüdeki bir ürün", ALLERGEN: "Alerjenler", DIETARY_QUESTION: "Beslenme tercihleri",
      SPECIALS: "Günün özel ürünleri", RESERVATION: "Rezervasyon", ORDER: "Sipariş", ORDER_STATUS: "Sipariş durumu",
      CANCELLATION: "İptal", MODIFICATION: "Değişiklik", HUMAN_REQUEST: "Bir çalışanla görüşmek", COMPLAINT: "Şikâyet",
    } as Record<string, string>,
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
    "/panel/rapor": "Weekly report",
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
  report: {
    title: "Weekly report",
    intro: "What your Tideline ordering assistant did for you in the last 7 days.",
    calls: "Calls answered",
    callsHint: "last 7 days",
    converted: "Turned into orders or reservations",
    convertedHint: "{orders} orders · {reservations} reservations",
    avgDuration: "Average call length",
    noDuration: "—",
    topIntents: "What callers asked about most",
    topIntentsEmpty: "Not enough conversations yet.",
    callersAsked: "{n} callers",
    empty: "No calls yet this week. Once your assistant's number is live, calls will show up here.",
    unavailable: "The report can't be loaded right now. Please try again in a moment.",
    intents: {
      GENERAL_QUESTION: "General questions", RESTAURANT_INFO: "Restaurant info", HOURS: "Opening hours", LOCATION: "Address & directions",
      PARKING: "Parking", MENU: "Menu", MENU_ITEM: "A specific dish", ALLERGEN: "Allergens", DIETARY_QUESTION: "Dietary needs",
      SPECIALS: "Specials", RESERVATION: "Reservations", ORDER: "Placing an order", ORDER_STATUS: "Order status",
      CANCELLATION: "Cancellations", MODIFICATION: "Changes", HUMAN_REQUEST: "Talking to a person", COMPLAINT: "Complaints",
    },
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
