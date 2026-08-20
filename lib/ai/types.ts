export type CampaignTone = "samimi" | "sik" | "esprili";

export const TONE_LABELS: Record<CampaignTone, string> = {
  samimi: "Samimi",
  sik: "Şık",
  esprili: "Esprili",
};

export interface PackageCopyResult {
  title: string;
  salesCopy: string;
  sms: string;
  instagram: string;
  demo: boolean;
}

export interface AnnouncementCopyResult {
  message: string;
  demo: boolean;
}
