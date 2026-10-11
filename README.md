# WebGIS Ekologis — Kota Yogyakarta

Aplikasi lapangan untuk Kajian Habitat dan Strategi Konservasi Satwa Perkotaan Kota Yogyakarta.

## Arsitektur

- **MapLibre GL JS** — frontend peta.
- **PostGIS** — master vector dan observasi lapangan.
- **Martin** — vector tiles MVT dari PostGIS.
- **TiTiler** — raster/COG HSI, LULC, NDVI, dan habitat change.
- **FastAPI** — endpoint titik survei dan pencatatan hasil lapangan.
- **Caddy** — HTTPS dan reverse proxy.

Desain ekologis tidak dihitung ulang di aplikasi. WebGIS hanya mengonsumsi hasil final workflow analisis.

## Data final

Sumber yang disarankan adalah output **Notebook 06 — Final GIS Package**. Salin/ekstrak paket ke:

```text
data/import/
└── YYYYMMDD_FINAL_GIS_PACKAGE_D1/
```

Raster besar yang akan disajikan melalui TiTiler ditempatkan sebagai COG pada:

```text
data/rasters/
```

GeoJSON di repo hanya berfungsi sebagai fallback saat PostGIS/Martin belum tersedia.

## Deploy VPS

```bash
cp .env.example .env
# edit DOMAIN + password
docker compose up -d --build
docker compose run --rm api python import_gis.py /data/import
docker compose restart martin api
curl https://YOUR_DOMAIN/api/health
```

Setelah import, `/api/sites` membaca `gis.final_sites`. Martin otomatis mengekspos tabel spasial PostGIS sebagai sumber vector tile.

## Layer PostGIS

Importer mengenali produk Notebook 06 berikut:

- AOI_Kota_Yogyakarta.gpkg → `gis.aoi`
- HSI_Class_Final_Vector.gpkg → `gis.hsi_class`
- Species_Occurrence_Clean_All.gpkg → `gis.species_occurrence`
- Integrated_Habitat_Change_Vector.gpkg → `gis.habitat_change`
- Integrated_Candidate_Pool.gpkg → `gis.candidate_pool`
- Final_Ecological_Survey_Sites.gpkg → `gis.final_ecological_sites`
- Final_Sites_Access_Review.gpkg → `gis.final_sites`
- Road_Network_Operational.gpkg → `gis.roads`
- Replacement_Candidates_Access.gpkg → `gis.replacement_candidates`

## Prinsip metodologis

- HSI tetap baseline ekologis yang sudah dikunci.
- layer jalan pada WebGIS adalah akses operasional, bukan bobot ekologis baru.
- `NO_HISTORICAL_RECORD` bukan true absence.
- perubahan site di lapangan harus terdokumentasi melalui review akses, izin, keselamatan, dan replacement candidate.

## Development

Branch implementasi aktif: `feat/vps-maplibre-stack`.

Frontend mencoba API/PostGIS terlebih dahulu. Jika backend belum aktif, aplikasi tetap dapat membuka `data/sites.geojson` dan layer GeoJSON fallback.
