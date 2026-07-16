import { Ticket, QrCode, Percent, Store, RefreshCcw, Mail } from "lucide-react";

const FAQ = [
  {
    icon: Ticket,
    q: "Paket satın aldıktan sonra ne oluyor?",
    a: "Satın aldığın paket hesabındaki Paketlerim'e düşer. Her paketin bir kullanım hakkı ve son kullanım tarihi vardır; bunları paket detayında görebilirsin.",
  },
  {
    icon: QrCode,
    q: "Paketimi işletmede nasıl kullanırım?",
    a: "Paketlerim sayfasından ilgili paketi aç, çıkan QR kodunu işletmedeki görevliye okut. Kullanım hakkın anında düşer.",
  },
  {
    icon: Percent,
    q: "Bu Akşam'daki flaş fırsatlar nasıl çalışır?",
    a: "Flaş fırsatlar belirli bir gün ve saat aralığında geçerli, sınırlı kontenjanlı kampanyalardır. Yerini ayırdığında sana bir onay kodu verilir; süre veya kontenjan dolduğunda fırsat kapanır.",
  },
  {
    icon: RefreshCcw,
    q: "İade talep edebilir miyim?",
    a: "Uygun paketlerde iade talebini paket detayından başlatabilirsin. İşletme ve/veya Locally ekibi talebini inceler, sonucu hesabından takip edebilirsin.",
  },
  {
    icon: Store,
    q: "İşletmemi Locally'e nasıl eklerim?",
    a: "Kayıt ol ekranında \"İşletme sahibiyim\" seçeneğini seçip işletme bilgilerini gir. Başvurun onaylandıktan sonra işletme panelinden paket, flaş fırsat ve etkinlik yayınlayabilirsin.",
  },
];

export default function YardimPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Yardım</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sık sorulan sorular. Aradığını bulamazsan bize e-posta atabilirsin.
      </p>

      <div className="mt-8 space-y-5">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <item.icon size={16} strokeWidth={1.75} />
              </span>
              <p className="font-semibold text-foreground">{item.q}</p>
            </div>
            <p className="mt-2 pl-[calc(2rem+0.625rem)] text-sm text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2.5 rounded-lg border border-border bg-muted p-4 text-sm">
        <Mail size={16} className="shrink-0 text-muted-foreground" />
        <a href="mailto:merhaba@locally.app" className="font-medium text-teal-700 hover:underline">
          merhaba@locally.app
        </a>
      </div>
    </div>
  );
}
