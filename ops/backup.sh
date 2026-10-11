#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env
set +a
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="data/backups/${STAMP}"
mkdir -p "${OUT}"
echo "Backing up PostGIS to ${OUT}"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-webgis}" -d "${POSTGRES_DB:-webgis}" -Fc > "${OUT}/webgis.dump"
cp .env.example "${OUT}/env.example.snapshot"
if [[ -f data/import/README.md ]]; then cp data/import/README.md "${OUT}/import_README.snapshot"; fi
sha256sum "${OUT}/webgis.dump" > "${OUT}/SHA256SUMS"
echo "Backup complete: ${OUT}"
