#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env
set +a
BASE="https://${DOMAIN}"
echo "== API health =="
curl -fsS "${BASE}/api/health"; echo
echo "== Progress (total seharusnya 30 setelah data final diimport) =="
curl -fsS "${BASE}/api/progress"; echo
echo "== Martin catalog =="
curl -fsS "${BASE}/tiles/" | head -c 1000; echo
echo "== Frontend =="
curl -fsSI "${BASE}/" | head
echo
echo "Smoke test complete."
