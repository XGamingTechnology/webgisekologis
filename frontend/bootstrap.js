import * as maplibregl from "./vendor/maplibre-gl.mjs";
window.maplibregl = maplibregl;

await import("./config.js");
await import("./app.js");
await import("./field-mode.js");
