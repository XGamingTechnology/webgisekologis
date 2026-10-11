const CACHE="webgis-shell-v4";
const SHELL=[
  "/",
  "/index.html",
  "/style.css",
  "/bootstrap.js",
  "/config.js",
  "/app.js",
  "/field-mode.js",
  "/manifest.webmanifest",
  "/vendor/maplibre-gl.mjs",
  "/vendor/maplibre-gl-worker.mjs",
  "/vendor/maplibre-gl-shared.mjs",
  "/vendor/maplibre-gl.css"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  if(u.pathname.startsWith("/api/")||u.pathname.startsWith("/tiles/")||u.pathname.startsWith("/raster/"))return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))));
});
