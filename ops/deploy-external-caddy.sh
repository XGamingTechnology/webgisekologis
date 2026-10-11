#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env belum ada. Jalankan: cp .env.example .env"
  exit 1
fi

set -a
source .env
set +a

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD wajib diisi di .env}"

mkdir -p data/import data/rasters data/backups

compose=(docker compose -f docker-compose.yml -f docker-compose.external.yml)

echo "[0/7] Prepare self-hosted MapLibre assets"
bash ops/vendor-maplibre.sh

wait_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"
  local delay="${4:-2}"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS --max-time 4 "$url" >/dev/null 2>&1; then
      echo "  ✓ $name ready"
      return 0
    fi
    sleep "$delay"
  done

  echo "ERROR: $name belum ready setelah $((attempts * delay)) detik: $url" >&2
  return 1
}

echo "[1/7] Build + start services (without bundled Caddy)"
"${compose[@]}" up -d --build db martin api titiler

echo "[2/7] Apply field-mode migration"
"${compose[@]}" exec -T db   psql -U "${POSTGRES_USER:-webgis}"   -d "${POSTGRES_DB:-webgis}"   -f /docker-entrypoint-initdb.d/002_field_mode.sql

if find data/import -type f -name "Final_Sites_Access_Review.gpkg" -print -quit | grep -q .; then
  echo "[3/7] Import Final GIS Package"
  "${compose[@]}" run --rm api python import_gis.py /data/import
else
  echo "[3/7] SKIP import: Final_Sites_Access_Review.gpkg belum ada di data/import"
fi

echo "[4/7] Restart tile/API services"
"${compose[@]}" restart martin api titiler

echo "[5/7] Wait for service readiness"
wait_http "FastAPI" "http://127.0.0.1:8010/api/health"
wait_http "Martin" "http://127.0.0.1:3010/"
wait_http "TiTiler" "http://127.0.0.1:8011/"

echo "[6/7] Local endpoint checks"
curl -fsS http://127.0.0.1:8010/api/health
echo
curl -fsS http://127.0.0.1:3010/catalog | head -c 1000
echo

echo "[7/7] Container status"
"${compose[@]}" ps

echo
echo "External-Caddy deploy selesai."
echo "Jika host Caddy sudah dikonfigurasi, lanjutkan dengan: bash ops/smoke-test.sh"
