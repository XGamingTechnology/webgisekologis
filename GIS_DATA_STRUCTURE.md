# Struktur Paket GIS yang Direkomendasikan

```text
GIS_Deliverable1/
├── 00_METADATA/
│   ├── README_GIS.md
│   ├── data_dictionary.csv
│   └── processing_log.md
├── 01_AOI_BOUNDARY/
│   ├── AOI_KotaYogyakarta.gpkg
│   └── administrasi_reference.gpkg
├── 02_BASELINE_ENVIRONMENT/
│   ├── landcover/
│   ├── ndvi/
│   ├── river/
│   ├── rth_park/
│   └── road_ecological_pressure/
├── 03_HSI/
│   ├── HSI_continuous_final.tif
│   ├── HSI_class_final.tif
│   └── HSI_class_vector.gpkg
├── 04_SPECIES_OCCURRENCE/
│   ├── occurrence_clean_all.gpkg
│   ├── occurrence_burung.gpkg
│   ├── occurrence_reptil.gpkg
│   ├── occurrence_amfibi.gpkg
│   └── occurrence_mamalia.gpkg
├── 05_HABITAT_CHANGE/
│   ├── LULC_T1.tif
│   ├── LULC_T2.tif
│   ├── NDVI_T1.tif
│   ├── NDVI_T2.tif
│   ├── Delta_NDVI.tif
│   └── Integrated_Habitat_Change.gpkg
├── 06_SURVEY_DESIGN/
│   ├── candidate_pool_v3.gpkg
│   ├── final_ecological_sites_v3.gpkg
│   ├── no_record_taxon_layers.gpkg
│   └── survey_design_metadata.json
├── 07_ACCESSIBILITY/
│   ├── road_network_operational.gpkg
│   ├── final_sites_access_review.gpkg
│   └── replacement_candidates.gpkg
├── 08_FIELD_PACKAGE/
│   ├── final_field_sites.gpkg
│   ├── final_field_sites.xlsx
│   ├── maps/
│   └── webgis/
└── 99_ARCHIVE/
    └── legacy_outputs/
```

## Prinsip versioning
Jangan overwrite output lama. Gunakan:
`YYYYMMDD_layername_vNN.ext`

Contoh:
`20261001_final_ecological_sites_v03.gpkg`

## CRS
Master analisis: `EPSG:32749`.
WebGIS: ekspor GeoJSON ke `EPSG:4326`.
