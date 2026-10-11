#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env belum ada"
  exit 1
fi

set -a
source .env
set +a

BASE="https://${DOMAIN}"

echo "== Public frontend =="
curl -fsSI "${BASE}/" | head
echo

echo "== API health =="
curl -fsS "${BASE}/api/health"
echo

echo "== Progress =="
PROGRESS=$(curl -fsS "${BASE}/api/progress" || true)
if [[ -n "${PROGRESS}" ]]; then
  echo "${PROGRESS}"
else
  echo "Progress belum tersedia (normal jika Final GIS Package belum diimport)."
fi
echo

echo "== Martin catalog =="
curl -fsS "${BASE}/tiles/catalog" | head -c 1500
echo

echo "== Required Martin sources =="
for source in roads species_occurrence hsi_class habitat_change; do
  curl -fsS "${BASE}/tiles/${source}" >/dev/null
  echo "  ✓ ${source}"
done
echo

echo "== Site detail API =="
curl -fsS "${BASE}/api/site/V3-001" | head -c 1000
echo

echo "== TiTiler =="
curl -fsS "${BASE}/raster/" | head -c 1000
echo

echo "Smoke test complete."
