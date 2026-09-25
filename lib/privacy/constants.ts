// İstemci bileşenleri de kullanır: sunucuya özgü import eklemeyin.
export const PRIVACY_STATUS_LABELS = {
  new: "Yeni",
  in_progress: "İşlemde",
  completed: "Tamamlandı",
  rejected: "Reddedildi",
} as const;
export type PrivacyRequestStatus = keyof typeof PRIVACY_STATUS_LABELS;
