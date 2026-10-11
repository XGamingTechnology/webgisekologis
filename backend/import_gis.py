#!/usr/bin/env python3
"""Import vector products from Notebook 06 Final GIS Package into PostGIS."""
import os
import re
import sys
from pathlib import Path

import geopandas as gpd
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["DATABASE_URL"]
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/data/import")

LAYER_MAP = {
    "AOI_Kota_Yogyakarta.gpkg": "aoi",
    "HSI_Class_Final_Vector.gpkg": "hsi_class",
    "Species_Occurrence_Clean_All.gpkg": "species_occurrence",
    "Integrated_Habitat_Change_Vector.gpkg": "habitat_change",
    "Integrated_Candidate_Pool.gpkg": "candidate_pool",
    "Final_Ecological_Survey_Sites.gpkg": "final_ecological_sites",
    "Final_Sites_Access_Review.gpkg": "final_sites",
    "Road_Network_Operational.gpkg": "roads",
    "Replacement_Candidates_Access.gpkg": "replacement_candidates",
}

def clean_column(name: str) -> str:
    name = re.sub(r"[^0-9A-Za-z_]+", "_", name).strip("_").lower()
    return name[:60] or "field"

def find_one(filename: str):
    hits = list(ROOT.rglob(filename))
    return hits[0] if hits else None

engine = create_engine(DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1))
with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS gis"))

loaded = []
missing = []
for filename, table in LAYER_MAP.items():
    path = find_one(filename)
    if not path:
        missing.append(filename)
        print("SKIP", filename)
        continue

    print("LOAD", path, "-> gis."+table)
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        raise RuntimeError(f"{filename}: CRS tidak tersedia")
    gdf = gdf[gdf.geometry.notna() & (~gdf.geometry.is_empty)].copy()
    geom_name = gdf.geometry.name
    gdf = gdf.rename(columns={c: clean_column(c) for c in gdf.columns if c != geom_name})
    if geom_name != "geometry":
        gdf = gdf.rename_geometry("geometry")
    gdf.to_postgis(table, engine, schema="gis", if_exists="replace", index=False, chunksize=2000)

    with engine.begin() as conn:
        conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{table}_geom_gix" ON gis."{table}" USING GIST (geometry)'))
        conn.execute(text(f'ANALYZE gis."{table}"'))
    loaded.append((filename, table, len(gdf)))

print("\nLoaded:")
for row in loaded:
    print("  ", row)
if missing:
    print("\nOptional/missing:")
    for name in missing:
        print("  ", name)

if not any(t == "final_sites" for _, t, _ in loaded):
    raise SystemExit("ERROR: Final_Sites_Access_Review.gpkg wajib tersedia")
print("\n✅ PostGIS import complete")
