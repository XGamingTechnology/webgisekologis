# Field WebGIS — Kajian Habitat & Satwa Perkotaan Kota Yogyakarta

WebGIS statis berbasis Leaflet untuk mendukung reconnaissance dan survei lapangan.

## Fungsi utama
- menampilkan titik survei final;
- filter HSI, fungsi survei, dan kelas akses;
- menampilkan AOI, jalan, observasi historis, HSI, dan perubahan habitat bila layer tersedia;
- lokasi perangkat (GPS browser);
- tombol navigasi ke Google Maps;
- catatan lapangan lokal per Site_ID;
- export catatan lapangan ke CSV.

## Deploy
Folder ini bisa di-host langsung melalui GitHub Pages, Netlify, Cloudflare Pages, atau web server statis.

Jangan membuka `index.html` langsung dengan `file://` jika browser memblokir `fetch`.
Gunakan web server lokal, misalnya:

```bash
python -m http.server 8000
```

lalu buka `http://localhost:8000`.

## Data minimum
Wajib:
- `data/sites.geojson`

Opsional:
- `data/aoi.geojson`
- `data/roads.geojson`
- `data/occurrence.geojson`
- `data/hsi_classes.geojson`
- `data/habitat_change.geojson`

Gunakan `05_BUILD_FIELD_WEBGIS.ipynb` untuk mengekspor layer dari Google Drive ke struktur ini.

## Catatan penting
Layer akses adalah layer operasional, bukan komponen penilaian ekologis HSI.
Status no-historical-record bukan true absence. Hasil lapangan harus mencatat effort dan deteksi/non-detection.
