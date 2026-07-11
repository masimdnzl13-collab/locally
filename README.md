# Locally

Sezonluk turizm kasabalarında (ilk hedef: Bodrum) sezon dışı dönemde
işletmeleri ve yerel halkı buluşturan platform.

## Teknoloji

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS — marka renkleri `primary` (turkuaz), `dark` (petrol), `accent` (turuncu)
- Supabase (Auth + Postgres + Storage)
- PWA (manifest + service worker, `next-pwa` ile)
- Vercel deploy

## Başlarken

```bash
npm install
cp .env.example .env.local   # Supabase URL/anon key değerlerini doldur
npm run dev
```

http://localhost:3000 adresini aç.

## Klasör yapısı

- `app/` — sayfalar (public: `/`, `/kesfet`, `/bu-aksam`, `/etkinlikler`, `/hesabim`; işletme tarafı: `/panel`)
- `components/` — paylaşılan UI bileşenleri
- `lib/` — Supabase client'ları ve yardımcı fonksiyonlar
- `supabase/migrations/` — veritabanı şeması ve güvenlik kuralları

## Ortam değişkenleri

`.env.example` dosyasına bakın. Supabase projesi kurulana kadar bu değerler
boş bırakılabilir; istemci yalnızca env değişkenleri ayarlandığında canlı
bağlantı kurar.
