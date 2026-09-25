#!/usr/bin/env bash
# Tideline'ı Fly.io'ya deploy eder (DEPLOYMENT.md "Option A: Fly.io" adımları,
# tek komut). Tekrar çalıştırmak güvenli: uygulamalar varsa yeniden
# oluşturulmaz, SESSION_SECRET bir kez üretilir.
#
# Gizli değerler dosyadan DEĞİL bu komutun ortamından okunur ve Fly'a stdin
# üzerinden (`fly secrets import`) gider — komut satırında/proses listesinde
# görünmez. Örnek:
#
#   export DATABASE_URL=postgres://...   REDIS_URL=rediss://...
#   export JWT_SECRET=...                # Locally'deki TIDELINE_JWT_SECRET ile AYNI
#   export TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+1...
#   export STT_API_KEY=...               # Deepgram (TTS_API_KEY verilmezse aynısı)
#   export AI_API_KEY=sk-ant-...
#   export LOCALLY_ORIGIN=https://locally.example.com   # CORS + iframe izni
#   bash deploy/fly-deploy.sh
#
# Opsiyonel: FLY_API_APP / FLY_WEB_APP (uygulama adları; Fly'da global benzersiz),
# FLY_ORG, FLY_REGION, API_DOMAIN / APP_DOMAIN (özel alan adı yoksa *.fly.dev),
# ALERT_WEBHOOK_URL, RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM.
set -euo pipefail

cd "$(dirname "$0")/.."

FLY="${FLY:-$(command -v fly || command -v flyctl || echo "$HOME/.fly/bin/flyctl")}"
API_APP="${FLY_API_APP:-locally-tideline-api}"
WEB_APP="${FLY_WEB_APP:-locally-tideline-web}"
REGION="${FLY_REGION:-iad}"
ORG="${FLY_ORG:-personal}"
API_DOMAIN="${API_DOMAIN:-$API_APP.fly.dev}"
APP_DOMAIN="${APP_DOMAIN:-$WEB_APP.fly.dev}"
TTS_API_KEY="${TTS_API_KEY:-${STT_API_KEY:-}}"

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'HATA: %s\n' "$*" >&2; exit 1; }

"$FLY" auth whoami >/dev/null 2>&1 || die "Fly'a giriş yapılmamış: önce 'fly auth login'."

missing=()
for var in DATABASE_URL REDIS_URL JWT_SECRET TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER STT_API_KEY AI_API_KEY LOCALLY_ORIGIN; do
  [[ -n "${!var:-}" ]] || missing+=("$var")
done
((${#missing[@]} == 0)) || die "eksik ortam değişkenleri: ${missing[*]}"
[[ "$JWT_SECRET" != *replace-with* ]] || die "JWT_SECRET yer tutucu; Locally'deki TIDELINE_JWT_SECRET değerini kullan."

ensure_app() {
  if "$FLY" status -a "$1" >/dev/null 2>&1; then
    echo "$1 zaten var"
  else
    "$FLY" apps create "$1" --org "$ORG"
  fi
}

step "Uygulamalar: $API_APP, $WEB_APP"
ensure_app "$API_APP"
ensure_app "$WEB_APP"

step "API gizli değerleri"
existing_secrets="$("$FLY" secrets list -a "$API_APP" 2>/dev/null || true)"
{
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
  printf 'REDIS_URL=%s\n' "$REDIS_URL"
  printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
  printf 'APP_URL=https://%s\n' "$APP_DOMAIN"
  printf 'API_URL=https://%s\n' "$API_DOMAIN"
  printf 'VOICE_PUBLIC_URL=https://%s\n' "$API_DOMAIN"
  printf 'CORS_ORIGINS=https://%s,%s\n' "$APP_DOMAIN" "$LOCALLY_ORIGIN"
  printf 'ALLOWED_FRAME_ANCESTORS=%s\n' "$LOCALLY_ORIGIN"
  printf 'TWILIO_ACCOUNT_SID=%s\n' "$TWILIO_ACCOUNT_SID"
  printf 'TWILIO_AUTH_TOKEN=%s\n' "$TWILIO_AUTH_TOKEN"
  printf 'TWILIO_PHONE_NUMBER=%s\n' "$TWILIO_PHONE_NUMBER"
  printf 'STT_API_KEY=%s\n' "$STT_API_KEY"
  printf 'TTS_API_KEY=%s\n' "$TTS_API_KEY"
  printf 'AI_API_KEY=%s\n' "$AI_API_KEY"
  # Oturumları geçersiz kılmamak için yalnızca ilk deploy'da üretilir.
  grep -q '^SESSION_SECRET' <<<"$existing_secrets" || printf 'SESSION_SECRET=%s\n' "$(openssl rand -base64 48 | tr -d '\n')"
  for opt in ALERT_WEBHOOK_URL RESEND_API_KEY ALERT_EMAIL_TO ALERT_EMAIL_FROM AI_MODEL; do
    [[ -n "${!opt:-}" ]] && printf '%s=%s\n' "$opt" "${!opt}"
  done
  true
} | "$FLY" secrets import -a "$API_APP" --stage

step "API + worker deploy ($REGION)"
# --ha=false: canlı arama durumu bellekte, "app" TEK makine olmalı.
"$FLY" deploy apps/api --config apps/api/fly.toml -a "$API_APP" --primary-region "$REGION" --ha=false --yes
"$FLY" scale count app=1 worker=1 -a "$API_APP" --region "$REGION" --yes

step "Web deploy"
printf 'ALLOWED_FRAME_ANCESTORS=%s\n' "$LOCALLY_ORIGIN" | "$FLY" secrets import -a "$WEB_APP" --stage
"$FLY" deploy apps/web --config apps/web/fly.toml -a "$WEB_APP" --primary-region "$REGION" --ha=false --yes \
  --build-arg "VITE_API_URL=https://$API_DOMAIN"

step "Dışarıdan erişim kontrolü"
ok=1
if curl -fsS --max-time 20 "https://$API_DOMAIN/ready"; then echo "  ← API hazır"; else echo "API /ready BAŞARISIZ"; ok=0; fi
if curl -fsS --max-time 20 -o /dev/null "https://$APP_DOMAIN/"; then echo "Web açılıyor: https://$APP_DOMAIN"; else echo "Web BAŞARISIZ"; ok=0; fi
((ok)) || die "deploy tamamlandı ama erişim kontrolü geçmedi: '$FLY logs -a $API_APP'"

cat <<EOF

Sıradaki adımlar (DEPLOYMENT.md "After any deploy"):
  1. Twilio → numara → Voice webhook (POST): https://$API_DOMAIN/api/v1/telephony/twilio/incoming
                       Status callback:     https://$API_DOMAIN/api/v1/telephony/twilio/status
  2. Locally ortamı: TIDELINE_API_URL=https://$API_DOMAIN  TIDELINE_WEB_URL=https://$APP_DOMAIN
  3. Numarayı ara, '$FLY logs -a $API_APP' ile izle (P0.6).
EOF
