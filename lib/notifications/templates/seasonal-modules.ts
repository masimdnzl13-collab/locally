import type { BusinessMarket } from "@/lib/types";

// P7 — sezon geçişi bildirimleri. Metinler YALNIZCA burada tutulur: admin
// panelindeki elle geçiş de, 1 Ekim cron işi de bu dosyadan okur. Metni
// değiştirmek için yalnızca bu dosyayı düzenle.
//
// ABD işletmeleri İngilizce, TR işletmeleri Türkçe metin alır.

export interface ModuleNotificationTemplate {
  sms: string;
  emailSubject: string;
  emailHtml: string;
}

const WINTER_ACTIVATED: Record<BusinessMarket, ModuleNotificationTemplate> = {
  TR: {
    sms: "Locally'nin kış özelliği hesabınızda aktif edildi.",
    emailSubject: "Locally'nin kış özelliği aktif",
    emailHtml:
      "<p>Merhaba,</p><p>Locally'nin kış özelliği hesabınızda aktif edildi. Panelinize giriş yaparak hemen kullanmaya başlayabilirsiniz.</p><p>— Locally</p>",
  },
  US: {
    sms: "Locally's winter features are now active on your account.",
    emailSubject: "Locally's winter features are now active",
    emailHtml:
      "<p>Hi,</p><p>Locally's winter features are now active on your account. Sign in to your dashboard to start using them.</p><p>— Locally</p>",
  },
};

export function winterModuleActivatedTemplate(market: BusinessMarket): ModuleNotificationTemplate {
  return WINTER_ACTIVATED[market];
}
