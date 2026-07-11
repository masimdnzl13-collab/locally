// Sunucu (Vercel) UTC'de çalışır; işletme/kullanıcı tarafı hep İstanbul
// saatine göre düşünülür. Türkiye 2016'dan beri yaz saati uygulamıyor,
// bu yüzden sabit UTC+3 varsayımı güvenli.

export function istanbulHour(): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(formatted);
}

export function istanbulDateParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

export function istanbulDateString(date = new Date()): string {
  const { year, month, day } = istanbulDateParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function startOfIstanbulDayUtcIso(date = new Date()): string {
  const { year, month, day } = istanbulDateParts(date);
  // Yerel 00:00, UTC+3 sabit ofsetle UTC 21:00 bir önceki güne denk gelir.
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0)).toISOString();
}

export function isNightHoursIstanbul(): boolean {
  const hour = istanbulHour();
  return hour >= 21 || hour < 9;
}
