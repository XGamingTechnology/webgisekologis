# Runtime data directory

This directory is intentionally kept almost empty in Git.

Production data belongs in:
- data/import/ — extracted Notebook 06 Final GIS Package
- data/rasters/ — large COG / GeoTIFF products for TiTiler
- data/backups/ — database backups

These paths are ignored by Git. Do not commit generated GIS products or secrets.

Small browser fallback layers live under frontend/data/.
