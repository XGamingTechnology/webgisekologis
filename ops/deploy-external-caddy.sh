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

echo "[1/6] Build + start services (without bundled Caddy)"
docker compose -f docker-compose.yml -f docker-compose.external.yml up -d --build db martin api titiler

echo "[2/6] Apply field-mode migration"
docker compose -f docker-compose.yml -f docker-compose.external.yml exec -T db   psql -U "${POSTGRES_USER:-webgis}"   -d "${POSTGRES_DB:-webgis}"   -f /docker-entrypoint-initdb.d/002_field_mode.sql

if find data/import -type f -name "Final_Sites_Access_Review.gpkg" -print -quit | grep -q .; then
  echo "[3/6] Import Final GIS Package"
  docker compose -f docker-compose.yml -f docker-compose.external.yml run --rm api     python import_gis.py /data/import
else
  echo "[3/6] SKIP import: Final_Sites_Access_Review.gpkg belum ada di data/import"
fi

echo "[4/6] Restart tile/API services"
docker compose -f docker-compose.yml -f docker-compose.external.yml restart martin api titiler

echo "[5/6] Local endpoint checks"
curl -fsS http://127.0.0.1:8010/api/health || true
echo
curl -fsS http://127.0.0.1:3010/ | head -c 500 || true
echo

echo "[6/6] Container status"
docker compose -f docker-compose.yml -f docker-compose.external.yml ps

echo
echo "External-Caddy deploy selesai."
echo "Selanjutnya tambahkan infra/Caddyfile.external.example ke Caddy host, sesuaikan DOMAIN, lalu reload Caddy."
