export interface AnnouncementTemplate {
  key: string;
  label: string;
  subject: string;
  body: string;
}

export const ANNOUNCEMENT_TEMPLATES: AnnouncementTemplate[] = [
  {
    key: "yeni_paket",
    label: "Yeni paket duyurusu",
    subject: "Yeni bir paketimiz var!",
    body: "Merhaba {{isim}}, sana özel yeni bir paket hazırladık. Kaçırmadan Locally'den göz at!",
  },
  {
    key: "bu_aksam",
    label: "Bu akşam flaşı",
    subject: "Bu akşama özel fırsat",
    body: "Merhaba {{isim}}, bu akşam sana özel bir fırsatımız var. Kontenjan sınırlı, yerini şimdi ayırt!",
  },
  {
    key: "etkinlik",
    label: "Etkinlik daveti",
    subject: "Seni etkinliğimize bekliyoruz",
    body: "Merhaba {{isim}}, bu hafta düzenlediğimiz etkinliğe seni de bekleriz. Detaylar Locally'de.",
  },
  {
    key: "seni_ozledik",
    label: "Seni özledik",
    subject: "Seni özledik!",
    body: "Merhaba {{isim}}, seni bir süredir aramızda görmedik. Seni tekrar ağırlamak isteriz!",
  },
];

export function personalize(body: string, name: string | null) {
  return body.replaceAll("{{isim}}", name || "değerli müşterimiz");
}
