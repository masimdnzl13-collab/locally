#!/usr/bin/env bash
# Yedekten geri yükleme tatbikatı (AQ). Bir Postgres veritabanının mantıksal yedeğini
# (pg_dump, custom format) alır, onu BOŞ bir Postgres örneğine geri yükler ve iki taraftaki
# her tablonun satır sayısını + son migration'ı karşılaştırır. Fark varsa çıkış kodu 1.
#
#   # Docker ile (hedef örneği betik açar ve siler):
#   SOURCE_DATABASE_URL=postgresql://... bash deploy/restore-drill.sh [--keep]
#
#   # Docker yoksa: yerel pg_dump/pg_restore/psql (PATH'te ya da PG_BIN=<bin klasörü>)
#   # ve senin açtığın BOŞ bir hedef veritabanı:
#   SOURCE_DATABASE_URL=postgresql://... TARGET_DATABASE_URL=postgresql://.../bos_db \
#     bash deploy/restore-drill.sh
#
# - Kaynak bağlantısı RLS'i aşabilen bir rol olmalı (sahip/superuser/BYPASSRLS; Fly MPG ve
#   Supabase'in yönetici bağlantı dizesi). Uygulama tabloları FORCE ROW LEVEL SECURITY
#   kullandığı için sıradan bir rolle pg_dump hata verir — ki bu da iyi: eksik yedek almaz.
# - Yedek dosyası BACKUP_DIR'de (varsayılan tideline/backups/, git'e girmez) KALIR; müşteri
#   verisi (telefon, transkript, sipariş) içerir. Paylaşma; işin bitince sil ya da şifreli sakla.
# - --keep (yalnız Docker modu): geri yüklenen örneği ayakta bırakır.
#
# Tideline (Fly) ve yerel geliştirme veritabanı için doğrudan çalışır. Locally'nin Supabase
# veritabanı auth/storage şemalarına bağlı; onun tatbikatı DEPLOYMENT.md "Disaster recovery"de.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL gerekli (yedeği alınacak veritabanı)}"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP=false
[[ "${1:-}" == "--keep" ]] && KEEP=true
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/tideline-$STAMP.dump"
NAME="tideline-restore-drill-$(date -u +%Y%m%d%H%M%S)"

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'HATA: %s\n' "$*" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

# Bağlantı dizeleri komut satırına yazılmaz (ps'te görünmesin): araçlar $SRC_URL / $DST_URL'i
# ortamdan okur.
export SRC_URL="$SOURCE_DATABASE_URL"
if [[ -n "${TARGET_DATABASE_URL:-}" ]]; then
  MODE=local
  export DST_URL="$TARGET_DATABASE_URL"
  [[ -n "${PG_BIN:-}" ]] && export PATH="$PG_BIN:$PATH"
  for tool in pg_dump pg_restore psql; do command -v "$tool" >/dev/null || die "$tool bulunamadı (PATH ya da PG_BIN)"; done
  on_src() { sh -c "$1"; }
  on_dst() { sh -c "$1"; }
else
  MODE=docker
  docker info >/dev/null 2>&1 || die "Docker çalışmıyor (ya da TARGET_DATABASE_URL ile yerel araçları kullan)."
  # Konteynerin içinden "localhost" ana makine değildir.
  SRC_URL="$(printf '%s' "$SRC_URL" | sed -E 's#@(localhost|127\.0\.0\.1)([:/])#@host.docker.internal\2#')"
  export DST_URL="postgresql://postgres:drill@localhost:5432/restored"
  on_src() { docker run --rm -i --add-host=host.docker.internal:host-gateway -e SRC_URL "$IMAGE" sh -c "$1"; }
  on_dst() { docker exec -i -e DST_URL "$NAME" sh -c "$1"; }
  cleanup() { $KEEP || docker rm -f "$NAME" >/dev/null 2>&1 || true; }
  trap cleanup EXIT
fi

step "1/4 Yedek alınıyor → $DUMP"
started=$(date +%s)
on_src 'pg_dump --format=custom --no-owner --no-privileges --dbname="$SRC_URL"' >"$DUMP"
[[ -s "$DUMP" ]] || die "yedek dosyası boş"
echo "   $(du -h "$DUMP" | cut -f1), $(( $(date +%s) - started )) sn"

step "2/4 Hedef örnek hazırlanıyor ($MODE)"
if [[ $MODE == docker ]]; then
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=restored "$IMAGE" >/dev/null
  for _ in $(seq 1 60); do on_dst 'psql --dbname="$DST_URL" -qAt -c "select 1"' >/dev/null 2>&1 && break; sleep 1; done
fi
tables_in_target="$(on_dst 'psql --dbname="$DST_URL" -qAt -c "select count(*) from information_schema.tables where table_schema = '"'"'public'"'"'"')" \
  || die "hedef veritabanına bağlanılamadı"
[[ "$tables_in_target" == "0" ]] || die "hedef veritabanı boş değil ($tables_in_target tablo) — boş bir veritabanı ver"

step "3/4 Geri yükleniyor"
started=$(date +%s)
on_dst 'pg_restore --no-owner --no-privileges --exit-on-error --dbname="$DST_URL"' <"$DUMP"
echo "   $(( $(date +%s) - started )) sn"

step "4/4 Karşılaştırılıyor (tablo başına satır sayısı, son migration)"
# row_security=off: pg_dump ile aynı görünüm (RLS filtresi yok), karşılaştırma adil olsun.
# İlk psql her tablo için bir "select 'tablo|' || count(*)" üretir, ikincisi onları çalıştırır.
COUNTS='psql --dbname="$URL" -qAt -v ON_ERROR_STOP=1 -c "select format('"'"'select %L || '"'"''"'"'|'"'"''"'"' || count(*) from %I.%I;'"'"', table_name, table_schema, table_name) from information_schema.tables where table_schema = '"'"'public'"'"' and table_type = '"'"'BASE TABLE'"'"' order by table_name" | { echo "set row_security = off;"; cat; } | psql --dbname="$URL" -qAt -v ON_ERROR_STOP=1 -f -'
src_counts="$(on_src "URL=\"\$SRC_URL\"; $COUNTS" | grep '|' | sort)"
dst_counts="$(on_dst "URL=\"\$DST_URL\"; $COUNTS" | grep '|' | sort)"
LATEST='psql --dbname="$URL" -qAt -c "select max(version) from schema_migrations"'
latest_src="$(on_src "URL=\"\$SRC_URL\"; $LATEST" 2>/dev/null || echo "?")"
latest_dst="$(on_dst "URL=\"\$DST_URL\"; $LATEST" 2>/dev/null || echo "?")"

mismatch=0
tables=0
rows=0
while IFS='|' read -r table n; do
  [[ -z "$table" ]] && continue
  tables=$((tables + 1)); rows=$((rows + n))
  restored="$(grep -E "^${table}\|" <<<"$dst_counts" | cut -d'|' -f2 || true)"
  if [[ "$restored" != "$n" ]]; then
    printf '   ✗ %-40s kaynak=%s geri-yüklenen=%s\n' "$table" "$n" "${restored:-YOK}"
    mismatch=1
  fi
done <<<"$src_counts"

echo "   $tables tablo, $rows satır; son migration kaynak=$latest_src geri-yüklenen=$latest_dst"
if ((mismatch)) || ((tables == 0)) || [[ "$latest_src" != "$latest_dst" ]]; then
  echo "SONUÇ: BAŞARISIZ — geri yüklenen veri kaynakla eşleşmiyor." >&2
  exit 1
fi
echo "SONUÇ: BAŞARILI — yedek eksiksiz geri yüklendi. Yedek: $DUMP"
if [[ $MODE == docker ]] && $KEEP; then
  echo "Örnek ayakta: docker exec -it $NAME psql -U postgres -d restored   (bitince: docker rm -f $NAME)"
fi
