// Kritik ortam değişkenleri (Supabase URL/anon key) eksikse uygulama
// beyaz ekran vermek yerine bunu gösterir. Sadece sunucu tarafında,
// değer içermeyen bir liste alır — hiçbir sır ekrana yazılmaz.
export default function ConfigError({
  missingEnvVars,
}: {
  missingEnvVars: string[];
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-3xl text-danger-700">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Uygulama yapılandırılamadı
      </h1>
      <p className="mt-3 max-w-sm text-balance text-sm text-muted-foreground">
        Gerekli ortam değişkenleri eksik olduğu için site şu an açılamıyor.
        Bu genellikle Vercel proje ayarlarında bir değerin unutulduğu anlamına
        gelir.
      </p>
      <div className="mt-6 rounded-md border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground">
        Eksik değişkenler:
        <ul className="mt-1 list-inside list-disc font-mono">
          {missingEnvVars.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </div>
      <p className="mt-6 max-w-sm text-balance text-xs text-muted-foreground">
        Sistem durumunu görmek için{" "}
        <span className="font-mono">/api/health</span> adresine bakabilirsin.
      </p>
    </div>
  );
}
