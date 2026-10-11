const C = window.WEBGIS_CONFIG || {};
const local = C.localFallback || {};
let sites = null;
let lastPosition = null;
let activeSurveyFeature = null;

if (!window.maplibregl) {
  const mode = document.getElementById("dataMode");
  if (mode) mode.textContent = "MapLibre gagal dimuat dari aset lokal — jalankan deploy ulang.";
  throw new Error("MapLibre GL JS gagal dimuat dari aset lokal");
}

const map = new maplibregl.Map({
  container: "map",
  center: C.map?.center || [110.3695, -7.7956],
  zoom: C.map?.zoom || 13,
  minZoom: C.map?.minZoom || 10,
  maxZoom: C.map?.maxZoom || 20,
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors"
      }
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }]
  }
});

map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

const mapContainer = document.getElementById("mapWrap");
const resizeMap = () => requestAnimationFrame(() => map.resize());
if ("ResizeObserver" in window && mapContainer) {
  new ResizeObserver(resizeMap).observe(mapContainer);
}
window.addEventListener("resize", resizeMap, { passive: true });
window.addEventListener("orientationchange", () => setTimeout(resizeMap, 150));

const accessColor = ["match",
  ["coalesce",["get","Access_Priority"],["get","access_priority"],""],
  "A","#1f9d74","B","#e0a21a","C","#d84a3a","#2563eb"
];

function p(obj,...names){
  for(const n of names) if(obj?.[n] !== undefined && obj?.[n] !== null && obj?.[n] !== "") return obj[n];
  return "–";
}
const siteId = x => p(x,"Site_ID","site_id","SITE_ID");
const hsi = x => p(x,"HabitatClass","habitatclass","habitat_class","HSI_Class_Name","hsi_class");
const surveyFunction = x => p(x,"Survey_Function","survey_function","Survey_Function_Revised");
const access = x => String(p(x,"Access_Priority","access_priority")).replace("Access ","");
const accessClass = x => p(x,"Access_Class","access_class");
const taxa = x => p(x,"Survey_Taxon_Targets","survey_taxon_targets","Taxon_Targets","taxon_targets");
const changeClass = x => p(x,"Integrated_Change_Class","integrated_change_class","Change_Class","class_name");
const roadDistance = x => p(x,"Dist_DriveRoad_m","dist_driveroad_m","dist_drive_road_m");
const nearestRoad = x => p(x,"Nearest_Road_Class","nearest_road_class");
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:"application/json"}});
  if(!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function loadSites(){
  if(C.dataMode !== "static"){
    try{
      const fc=await getJson(`${C.apiBase||"/api"}/sites`);
      if(fc?.features?.length){
        document.getElementById("dataMode").textContent="Live · PostGIS API + Martin";
        return fc;
      }
    }catch(e){ console.info("API fallback:",e); }
  }
  const fc=await getJson(local.sites||"data/sites.geojson");
  document.getElementById("dataMode").textContent="Fallback · GeoJSON lokal";
  return fc;
}

function stats(){
  const c={A:0,B:0,C:0};
  (sites?.features||[]).forEach(f=>{const a=access(f.properties||{}); if(c[a]!==undefined)c[a]++});
  document.getElementById("statTotal").textContent=sites?.features?.length||0;
  document.getElementById("statA").textContent=c.A;
  document.getElementById("statB").textContent=c.B;
  document.getElementById("statC").textContent=c.C;
}

function filterExpr(){
  const H=document.getElementById("filterHSI")?.value || "";
  const F=document.getElementById("filterFunction")?.value || "";
  const A=document.getElementById("filterAccess")?.value || "";
  const Q=(document.getElementById("searchSite")?.value || "").trim().toLowerCase();
  const all=["all"];
  if(H) all.push(["==",["coalesce",["get","HabitatClass"],["get","habitatclass"],["get","habitat_class"],""],H]);
  if(F) all.push(["==",["coalesce",["get","Survey_Function"],["get","survey_function"],["get","Survey_Function_Revised"],""],F]);
  if(A) all.push(["==",["coalesce",["get","Access_Priority"],["get","access_priority"],""],A]);
  if(Q) all.push(["in",Q,["downcase",["to-string",["coalesce",["get","Site_ID"],["get","site_id"],["get","SITE_ID"],""]]]]);
  return all;
}

function applyFilter(){
  if(map.getLayer("sites")) map.setFilter("sites",filterExpr());
}

function addGeoJson(id,data,type,paint,visibility="visible"){
  map.addSource(id+"-src",{type:"geojson",data});
  map.addLayer({id,type,source:id+"-src",layout:{visibility},paint});
}
async function addGeoJsonOptional(id,url,type,paint,visibility="none"){
  try{
    const data=await getJson(url);
    if(data?.features?.length) addGeoJson(id,data,type,paint,visibility);
  }catch(e){ console.info(id+" unavailable",e); }
}
async function addMvtOrFallback(id,sourceName,fallback,type,paint,visibility="none"){
  if(C.dataMode !== "static" && sourceName){
    try{
      await getJson(`${C.martinBase||"/tiles"}/${sourceName}`);
      map.addSource(id+"-src",{type:"vector",url:`${C.martinBase||"/tiles"}/${sourceName}`});
      map.addLayer({id,type,source:id+"-src","source-layer":sourceName,layout:{visibility},paint});
      return;
    }catch(e){ console.info("Martin fallback "+id,e); }
  }
  await addGeoJsonOptional(id,fallback,type,paint,visibility);
}

function closePanels(){
  document.querySelectorAll(".floating-panel").forEach(x=>x.classList.remove("is-open"));
  document.querySelectorAll(".map-tool").forEach(x=>x.classList.remove("active"));
  document.getElementById("panelBackdrop").hidden=true;
}

function openPanel(id){
  const target=document.getElementById(id);
  const already=target?.classList.contains("is-open");
  closePanels();
  if(already || !target) return;
  target.classList.add("is-open");
  document.querySelector(`.map-tool[data-panel="${id}"]`)?.classList.add("active");
  if(window.matchMedia("(max-width:1400px) and (pointer:coarse)").matches || window.matchMedia("(max-width:820px)").matches) document.getElementById("panelBackdrop").hidden=false;
}

function focusSiteByQuery(){
  const q=(document.getElementById("searchSite")?.value||"").trim().toLowerCase();
  if(!q || !sites?.features?.length) return;
  const feature=sites.features.find(f=>String(siteId(f.properties||{})).toLowerCase()===q)
    || sites.features.find(f=>String(siteId(f.properties||{})).toLowerCase().includes(q));
  if(!feature?.geometry?.coordinates) return;
  map.flyTo({center:feature.geometry.coordinates,zoom:17,duration:800});
  showSiteCard(feature);
}

function showSiteCard(feature){
  activeSurveyFeature=feature;
  const card=document.getElementById("siteCard");
  const q=feature.properties||{};
  const id=siteId(q);
  const [lng,lat]=feature.geometry.coordinates;
  card.innerHTML=`
    <div class="site-card-head">
      <div><span class="eyebrow">Selected survey site</span><h3>${esc(id)}</h3></div>
      <button class="icon-btn site-card-close" type="button" aria-label="Tutup">×</button>
    </div>
    <div class="site-chips">
      <span class="site-chip">HSI ${esc(hsi(q))}</span>
      <span class="site-chip">Access ${esc(access(q))}</span>
      <span class="site-chip">${esc(changeClass(q))}</span>
    </div>
    <div class="site-grid">
      <div><small>Fungsi survei</small><strong>${esc(surveyFunction(q))}</strong></div>
      <div><small>Target takson</small><strong>${esc(taxa(q))}</strong></div>
      <div><small>Kelas akses</small><strong>${esc(accessClass(q))}</strong></div>
      <div><small>Jarak jalan</small><strong>${esc(roadDistance(q))} m · ${esc(nearestRoad(q))}</strong></div>
    </div>
    <div class="site-actions">
      <a class="btn" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Lihat Maps</a>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">Navigasi</a>
      <button class="btn btn-primary start-survey" type="button">Buka survey workspace</button>
    </div>
  `;
  card.hidden=false;
  card.querySelector(".site-card-close").onclick=()=>{card.hidden=true;activeSurveyFeature=null};
  card.querySelector(".start-survey").onclick=()=>{
    if(typeof window.openSurveyWorkspace==="function") window.openSurveyWorkspace(feature);
  };
}

function wireUi(){
  document.querySelectorAll(".map-tool").forEach(btn=>btn.addEventListener("click",()=>openPanel(btn.dataset.panel)));
  document.querySelectorAll(".panel-close").forEach(btn=>btn.addEventListener("click",closePanels));
  document.getElementById("panelBackdrop").addEventListener("click",closePanels);

  ["filterHSI","filterFunction","filterAccess"].forEach(id=>document.getElementById(id)?.addEventListener("change",applyFilter));
  document.getElementById("searchSite")?.addEventListener("input",applyFilter);
  document.getElementById("searchSite")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();focusSiteByQuery()}});
  document.getElementById("searchFocusBtn")?.addEventListener("click",focusSiteByQuery);
  document.getElementById("resetFilters")?.addEventListener("click",()=>{
    ["filterHSI","filterFunction","filterAccess","searchSite"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
    applyFilter();
  });

  const layers={toggleSites:["sites"],toggleAOI:["aoi"],toggleRoads:["roads"],toggleOccurrence:["occurrence"],toggleHSI:["hsi"],toggleChange:["change"]};
  Object.entries(layers).forEach(([id,ls])=>document.getElementById(id)?.addEventListener("change",e=>{
    ls.forEach(l=>map.getLayer(l)&&map.setLayoutProperty(l,"visibility",e.target.checked?"visible":"none"));
  }));

  document.getElementById("locateBtn")?.addEventListener("click",()=>{
    navigator.geolocation?.getCurrentPosition(pos=>{
      lastPosition=pos;
      const ll=[pos.coords.longitude,pos.coords.latitude];
      map.flyTo({center:ll,zoom:17});
      if(map.getSource("user-location")) map.getSource("user-location").setData({type:"Point",coordinates:ll});
      else{
        map.addSource("user-location",{type:"geojson",data:{type:"Point",coordinates:ll}});
        map.addLayer({id:"user-location",type:"circle",source:"user-location",paint:{"circle-radius":8,"circle-color":"#0f766e","circle-stroke-color":"#fff","circle-stroke-width":3}});
      }
    },()=>alert("Lokasi perangkat tidak tersedia atau izin lokasi belum diberikan."),{enableHighAccuracy:true,timeout:12000});
  });
}

map.on("load",async()=>{
  resizeMap();
  wireUi();
  try{
    sites=await loadSites();
    stats();
    addGeoJson("sites",sites,"circle",{
      "circle-radius":["interpolate",["linear"],["zoom"],10,5,15,9,18,12],
      "circle-color":accessColor,
      "circle-stroke-color":"#0b1220",
      "circle-stroke-width":1.2,
      "circle-opacity":0.95
    });
    applyFilter();
    const b=new maplibregl.LngLatBounds();
    sites.features.forEach(f=>f.geometry?.type==="Point"&&b.extend(f.geometry.coordinates));
    if(!b.isEmpty()) map.fitBounds(b,{padding:{top:55,bottom:55,left:55,right:55},maxZoom:15});
    map.on("click","sites",e=>{const f=e.features?.[0];if(f)showSiteCard(f)});
    map.on("mouseenter","sites",()=>map.getCanvas().style.cursor="pointer");
    map.on("mouseleave","sites",()=>map.getCanvas().style.cursor="");
  }catch(e){
    console.error(e);
    document.getElementById("dataMode").textContent="Titik survei belum tersedia";
  }

  await addGeoJsonOptional("aoi",local.aoi||"data/aoi.geojson","line",{"line-color":"#0b1220","line-width":2},"visible");
  const vs=C.vectorSources||{};
  await addMvtOrFallback("roads",vs.roads,local.roads||"data/roads.geojson","line",{
    "line-color":"#8391a4","line-width":["interpolate",["linear"],["zoom"],11,0.5,16,1.6],"line-opacity":0.5
  },"visible");
  await addMvtOrFallback("occurrence",vs.occurrence,local.occurrence||"data/occurrence.geojson","circle",{
    "circle-radius":3.5,"circle-color":"#475569","circle-opacity":0.55
  },"none");
  await addMvtOrFallback("hsi",vs.hsi,local.hsi||"data/hsi_classes.geojson","fill",{
    "fill-color":["match",["coalesce",["get","class_name"],["get","HabitatClass"],["get","habitatclass"],""],
      "High","#178447","Moderate","#e5b626","Low","#d94b3f","#94a3b8"],
    "fill-opacity":0.32
  },"none");
  await addMvtOrFallback("change",vs.change,local.change||"data/habitat_change.geojson","fill",{
    "fill-color":["match",["coalesce",["get","class_name"],["get","Integrated_Change_Class"],["get","integrated_change_class"],""],
      "Changed-Degraded","#d73027","Recovery","#159487","Stable","#aab4c2","#aab4c2"],
    "fill-opacity":0.31
  },"none");
});
