#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${MAPLIBRE_VERSION:-6.11.2}"
VENDOR_DIR="frontend/vendor"
TMP_DIR="$(mktemp -d)"
ZIP_FILE="${TMP_DIR}/dist.zip"
DIST_DIR="${TMP_DIR}/dist"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

mkdir -p "${VENDOR_DIR}"

download() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 10 "$url" -o "${ZIP_FILE}"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "${ZIP_FILE}" "$url"
  else
    echo "ERROR: curl atau wget diperlukan untuk mengambil MapLibre vendor assets" >&2
    return 1
  fi
}

echo "Vendor MapLibre GL JS v${VERSION}"
download "https://github.com/maplibre/maplibre-gl-js/releases/download/v${VERSION}/dist.zip"

python3 - "${ZIP_FILE}" "${TMP_DIR}" <<'PY'
import pathlib, sys, zipfile
zip_path = pathlib.Path(sys.argv[1])
dest = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(zip_path) as z:
    z.extractall(dest)
PY

find_asset() {
  local name="$1"
  find "${TMP_DIR}" -type f -name "$name" -print -quit
}

MJS="$(find_asset maplibre-gl.mjs)"
WORKER="$(find_asset maplibre-gl-worker.mjs)"
CSS="$(find_asset maplibre-gl.css)"

for f in "$MJS" "$WORKER" "$CSS"; do
  if [[ -z "$f" || ! -s "$f" ]]; then
    echo "ERROR: dist.zip tidak memuat asset MapLibre yang diharapkan" >&2
    exit 1
  fi
done

install -m 0644 "$MJS" "${VENDOR_DIR}/maplibre-gl.mjs"
install -m 0644 "$WORKER" "${VENDOR_DIR}/maplibre-gl-worker.mjs"
install -m 0644 "$CSS" "${VENDOR_DIR}/maplibre-gl.css"

echo "✓ MapLibre assets ready in ${VENDOR_DIR}"
ls -lh "${VENDOR_DIR}/maplibre-gl.mjs" "${VENDOR_DIR}/maplibre-gl-worker.mjs" "${VENDOR_DIR}/maplibre-gl.css"
