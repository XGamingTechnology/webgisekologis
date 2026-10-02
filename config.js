window.WEBGIS_CONFIG = {
  // auto = coba API/PostGIS lebih dulu, lalu fallback ke GeoJSON lokal.
  dataMode: "auto",

  apiBase: "/api",
  martinBase: "/tiles",
  rasterBase: "/raster",

  map: {
    center: [110.3695, -7.7956],
    zoom: 13,
    minZoom: 10,
    maxZoom: 20
  },

  // Source IDs Martin mengikuti nama tabel hasil import ke schema gis.
  vectorSources: {
    roads: "gis.roads",
    occurrence: "gis.species_occurrence",
    hsi: "gis.hsi_class",
    change: "gis.habitat_change"
  },

  localFallback: {
    sites: "data/sites.geojson",
    aoi: "data/aoi.geojson",
    roads: "data/roads.geojson",
    occurrence: "data/occurrence.geojson",
    hsi: "data/hsi_classes.geojson",
    change: "data/habitat_change.geojson"
  }
};
