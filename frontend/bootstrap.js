import * as maplibregl from "./vendor/maplibre-gl.mjs";

window.maplibregl = maplibregl;

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    document.body.appendChild(script);
  });
}

await loadClassicScript("./config.js");
await loadClassicScript("./app.js");
await loadClassicScript("./field-mode.js");
