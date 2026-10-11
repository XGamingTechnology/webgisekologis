# Architecture — WebGIS Ekologis

## Tujuan
Menjaga aplikasi ringan di browser, sementara data GIS besar dilayani dari VPS.

## Komponen

```text
Browser / Mobile
   |
   v
Caddy (HTTPS + static frontend)
   |--------------------------|
   |             |            |
   v             v            v
FastAPI       Martin       TiTiler
(field API)   (MVT tiles)  (COG raster tiles)
   |             |
   |             v
   |          PostGIS
   |             ^
   ---------------

Large GeoTIFF/COG files -> /data/rasters
```

## Pembagian data

### PostGIS
Gunakan untuk data vektor yang perlu query/filter:
- AOI;
- 30 final survey sites;
- candidate pool;
- species occurrence;
- road network;
- replacement candidates;
- habitat-change polygons bila ukuran masih wajar;
- catatan/hasil survei lapangan.

### COG / raster files
Gunakan untuk raster besar:
- HSI continuous;
- HSI class raster;
- LULC 2018/2025;
- NDVI 2018/2025;
- Delta NDVI;
- Integrated Habitat Change raster.

Jangan masukkan raster 10 m ke GeoJSON.

## Frontend
Target frontend: MapLibre GL JS.

Layer vector besar dibaca sebagai MVT dari Martin. Raster dibaca dari TiTiler/COG. GeoJSON hanya dipertahankan untuk layer kecil atau fallback offline.

## CRS
- Master analysis: EPSG:32749.
- Database dapat menyimpan master geometry EPSG:32749.
- Martin melakukan tile output WebMercator untuk browser.
- GeoJSON/fallback: EPSG:4326.

## Deployment

1. Clone repo ke `/opt/webgisekologis`.
2. Copy `.env.example` menjadi `.env` dan isi password/domain.
3. Simpan raster COG di `data/rasters/` (folder ini tidak perlu masuk Git).
4. Import GPKG ke PostGIS menggunakan `ogr2ogr`.
5. Jalankan `docker compose up -d --build`.
6. Cek `/api/health`, Martin catalog, dan raster endpoints.

## Prinsip keamanan
- Jangan commit `.env` atau password.
- Jangan expose port Postgres ke internet.
- HTTPS terminasi di Caddy.
- Untuk mode client/field, autentikasi dapat ditambah setelah MVP.
