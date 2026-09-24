// İstemci bileşenleri de kullanır: sunucuya özgü import eklemeyin.
// WAT saha turu hedefi: Ekim sonuna kadar 50 ABD işletmesi.
export const PIPELINE_GOAL = 50;
export const PIPELINE_DEADLINE = "2026-10-31";

export type SalesLeadStatus = "tanitildi" | "ilgileniyor" | "kaydoldu" | "reddetti";
export const SALES_LEAD_STATUS_LABELS: Record<SalesLeadStatus, string> = {
  tanitildi: "Tanıtıldı",
  ilgileniyor: "İlgileniyor",
  kaydoldu: "Kaydoldu",
  reddetti: "Reddetti",
};
export const SALES_LEAD_STATUSES = Object.keys(SALES_LEAD_STATUS_LABELS) as SalesLeadStatus[];
