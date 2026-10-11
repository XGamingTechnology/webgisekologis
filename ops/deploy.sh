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

: "${DOMAIN:?DOMAIN wajib diisi di .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD wajib diisi di .env}"

mkdir -p data/import data/rasters

echo "[0/5] Prepare self-hosted MapLibre assets"
bash ops/vendor-maplibre.sh

echo "[1/5] Build + start containers"
docker compose up -d --build

echo "[2/5] Apply field-mode migration"
docker compose exec -T db psql -U "${POSTGRES_USER:-webgis}" -d "${POSTGRES_DB:-webgis}" -f /docker-entrypoint-initdb.d/002_field_mode.sql

if find data/import -type f -name "Final_Sites_Access_Review.gpkg" -print -quit | grep -q .; then
  echo "[3/5] Import Final GIS Package"
  docker compose run --rm api python import_gis.py /data/import
else
  echo "[3/5] SKIP import: Final_Sites_Access_Review.gpkg belum ada di data/import"
fi

echo "[4/5] Restart tile/API services"
docker compose restart martin api

echo "[5/5] Container status"
docker compose ps

echo
echo "Deploy selesai. Cek https://${DOMAIN}/api/health dan https://${DOMAIN}/"
