const CACHE="webgis-shell-v6";
const SHELL=[
  "/",
  "/index.html",
  "/style.css?v=ipad-1",
  "/bootstrap.js?v=ipad-1",
  "/config.js",
  "/app.js",
  "/field-mode.js",
  "/manifest.webmanifest",
  "/vendor/maplibre-gl.mjs",
  "/vendor/maplibre-gl-worker.mjs",
  "/vendor/maplibre-gl-shared.mjs",
  "/vendor/maplibre-gl.css?v=6.11.2"
];
self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});
self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    await caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  if(u.pathname.startsWith("/api/")||u.pathname.startsWith("/tiles/")||u.pathname.startsWith("/raster/"))return;
  e.respondWith(fetch(e.request).then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match("/index.html"))));
});
