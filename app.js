const C = window.WEBGIS_CONFIG || {};
const local = C.localFallback || {};

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

map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

let sites = null;
let lastPosition = null;

const accessColor = ["match",
  ["coalesce",["get","Access_Priority"],["get","access_priority"],""],
  "A","#2e7d32","B","#f9a825","C","#c62828","#2563eb"
];

function p(obj,...names){
  for(const n of names) if(obj?.[n] !== undefined && obj?.[n] !== null && obj?.[n] !== "") return obj[n];
  return "–";
}
const siteId = x => p(x,"Site_ID","site_id","SITE_ID");
const hsi = x => p(x,"HabitatClass","habitatclass","habitat_class","HSI_Class_Name","hsi_class");
const surveyFunction = x => p(x,"Survey_Function","survey_function","Survey_Function_Revised");
const access = x => String(p(x,"Access_Priority","access_priority")).replace("Access ","");
const taxa = x => p(x,"Survey_Taxon_Targets","survey_taxon_targets","Taxon_Targets","taxon_targets");
const changeClass = x => p(x,"Integrated_Change_Class","integrated_change_class","Change_Class","class_name");
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function getJson(url){
  const r=await fetch(url,{headers:{Accept:"application/json"}});
  if(!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
function localKey(id){ return `field-note:${id}`; }
function readLocal(id){ try{return JSON.parse(localStorage.getItem(localKey(id))||"{}")}catch{return{}} }
function writeLocal(id,v){ localStorage.setItem(localKey(id),JSON.stringify(v)); }

async function loadSites(){
  if(C.dataMode !== "static"){
    try{
      const fc=await getJson(`${C.apiBase||"/api"}/sites`);
      if(fc?.features?.length){
        document.getElementById("dataMode").textContent="Data: PostGIS API + Martin";
        return fc;
      }
    }catch(e){ console.info("API fallback:",e); }
  }
  const fc=await getJson(local.sites||"data/sites.geojson");
  document.getElementById("dataMode").textContent="Data: GeoJSON lokal (fallback)";
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
  const H=document.getElementById("filterHSI").value;
  const F=document.getElementById("filterFunction").value;
  const A=document.getElementById("filterAccess").value;
  const Q=document.getElementById("searchSite").value.trim().toLowerCase();
  const all=["all"];
  if(H) all.push(["==",["coalesce",["get","HabitatClass"],["get","habitatclass"],["get","habitat_class"],""],H]);
  if(F) all.push(["==",["coalesce",["get","Survey_Function"],["get","survey_function"],""],F]);
  if(A) all.push(["==",["coalesce",["get","Access_Priority"],["get","access_priority"],""],A]);
  if(Q) all.push(["in",Q,["downcase",["to-string",["coalesce",["get","Site_ID"],["get","site_id"],["get","SITE_ID"],""]]]]);
  return all;
}
function applyFilter(){ if(map.getLayer("sites")) map.setFilter("sites",filterExpr()); }

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
      const tj=await getJson(`${C.martinBase||"/tiles"}/${sourceName}`);
      map.addSource(id+"-src",{type:"vector",url:`${C.martinBase||"/tiles"}/${sourceName}`});
      map.addLayer({id,type,source:id+"-src","source-layer":sourceName,layout:{visibility},paint});
      return;
    }catch(e){ console.info("Martin fallback "+id,e); }
  }
  await addGeoJsonOptional(id,fallback,type,paint,visibility);
}

function popupHtml(f){
  const q=f.properties||{}, id=siteId(q), [lng,lat]=f.geometry.coordinates, saved=readLocal(id);
  return `<div class="site-popup" data-site="${esc(id)}" data-lat="${lat}" data-lng="${lng}">
    <h3>${esc(id)}</h3>
    <div class="kv">
      <b>HSI</b><span>${esc(hsi(q))}</span>
      <b>Fungsi</b><span>${esc(surveyFunction(q))}</span>
      <b>Target takson</b><span>${esc(taxa(q))}</span>
      <b>Habitat change</b><span>${esc(changeClass(q))}</span>
      <b>Access</b><span>${esc(access(q))} — ${esc(p(q,"Access_Class","access_class"))}</span>
      <b>Jarak jalan</b><span>${esc(p(q,"Dist_DriveRoad_m","dist_driveroad_m"))} m</span>
      <b>Nearest road</b><span>${esc(p(q,"Nearest_Road_Class","nearest_road_class"))}</span>
    </div>
    <div class="popup-actions">
      <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">🧭 Navigasi</a>
      <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">🗺 Maps</a>
    </div>
    <div class="field-editor">
      <label>Status kunjungan<select class="field-status">
        ${["Belum dikunjungi","Terverifikasi","Tidak dapat diakses","Perlu izin","Diganti"].map(x=>`<option ${saved.status===x?"selected":""}>${x}</option>`).join("")}
      </select></label>
      <label>Surveyor<input class="field-surveyor" type="text" value="${esc(saved.surveyor||"")}" placeholder="Nama / inisial"/></label>
      <label>Catatan<textarea class="field-note" placeholder="akses, izin, effort, kondisi habitat, temuan...">${esc(saved.note||"")}</textarea></label>
      <button class="save-note">Simpan catatan</button>
      <small class="save-status muted"></small>
    </div>
  </div>`;
}

async function saveObservation(node){
  const id=node.dataset.site;
  const rec={
    status:node.querySelector(".field-status").value,
    surveyor:node.querySelector(".field-surveyor").value,
    note:node.querySelector(".field-note").value,
    saved_at:new Date().toISOString()
  };
  writeLocal(id,rec);
  const status=node.querySelector(".save-status");
  try{
    const body={
      site_id:id,surveyor_name:rec.surveyor||null,survey_status:rec.status,notes:rec.note||null,
      latitude:lastPosition?.coords?.latitude??Number(node.dataset.lat),
      longitude:lastPosition?.coords?.longitude??Number(node.dataset.lng),
      accuracy_m:lastPosition?.coords?.accuracy??null,
      payload:{source:"webgis-maplibre",local_saved_at:rec.saved_at}
    };
    const r=await fetch(`${C.apiBase||"/api"}/observations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok) throw new Error("API "+r.status);
    status.textContent="✓ Server + perangkat";
  }catch(e){
    status.textContent="⚠ Offline/API gagal — tersimpan lokal";
    console.info(e);
  }
}

function wireUi(){
  ["filterHSI","filterFunction","filterAccess"].forEach(id=>document.getElementById(id).addEventListener("change",applyFilter));
  document.getElementById("searchSite").addEventListener("input",applyFilter);
  document.getElementById("resetFilters").onclick=()=>{
    ["filterHSI","filterFunction","filterAccess","searchSite"].forEach(id=>document.getElementById(id).value="");
    applyFilter();
  };
  const layers={toggleSites:["sites"],toggleAOI:["aoi"],toggleRoads:["roads"],toggleOccurrence:["occurrence"],toggleHSI:["hsi"],toggleChange:["change"]};
  Object.entries(layers).forEach(([id,ls])=>document.getElementById(id).onchange=e=>ls.forEach(l=>map.getLayer(l)&&map.setLayoutProperty(l,"visibility",e.target.checked?"visible":"none")));
  document.getElementById("sidebarToggle").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("locateBtn").onclick=()=>{
    navigator.geolocation?.getCurrentPosition(pos=>{
      lastPosition=pos;
      const ll=[pos.coords.longitude,pos.coords.latitude];
      map.flyTo({center:ll,zoom:17});
      if(map.getSource("user-location")) map.getSource("user-location").setData({type:"Point",coordinates:ll});
      else{
        map.addSource("user-location",{type:"geojson",data:{type:"Point",coordinates:ll}});
        map.addLayer({id:"user-location",type:"circle",source:"user-location",paint:{"circle-radius":8,"circle-color":"#2563eb","circle-stroke-color":"#fff","circle-stroke-width":3}});
      }
    },()=>alert("Lokasi perangkat tidak tersedia / izin belum diberikan."),{enableHighAccuracy:true,timeout:12000});
  };
  document.getElementById("exportNotes").onclick=()=>{
    const rows=[["Site_ID","Status","Surveyor","Note","Saved_at"]];
    (sites?.features||[]).forEach(f=>{const id=siteId(f.properties||{}),n=readLocal(id);if(n.status||n.note||n.surveyor)rows.push([id,n.status||"",n.surveyor||"",n.note||"",n.saved_at||""])});
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="field_notes.csv";a.click();URL.revokeObjectURL(a.href);
  };
  document.getElementById("clearNotes").onclick=()=>{
    if(!confirm("Hapus seluruh catatan lokal?")) return;
    Object.keys(localStorage).filter(k=>k.startsWith("field-note:")).forEach(k=>localStorage.removeItem(k));
    alert("Catatan lokal dihapus. Data server tidak dihapus.");
  };
}

map.on("load",async()=>{
  wireUi();
  try{
    sites=await loadSites(); stats();
    addGeoJson("sites",sites,"circle",{"circle-radius":["interpolate",["linear"],["zoom"],10,5,15,9,18,12],"circle-color":accessColor,"circle-stroke-color":"#111827","circle-stroke-width":1.2,"circle-opacity":0.95});
    applyFilter();
    const b=new maplibregl.LngLatBounds();
    sites.features.forEach(f=>f.geometry?.type==="Point"&&b.extend(f.geometry.coordinates));
    if(!b.isEmpty()) map.fitBounds(b,{padding:55,maxZoom:15});
    map.on("click","sites",e=>{
      const f=e.features?.[0]; if(!f)return;
      new maplibregl.Popup({maxWidth:"360px"}).setLngLat(f.geometry.coordinates).setHTML(popupHtml(f)).addTo(map);
      setTimeout(()=>{const n=document.querySelector(".site-popup"); if(n)n.querySelector(".save-note").onclick=()=>saveObservation(n)},0);
    });
    map.on("mouseenter","sites",()=>map.getCanvas().style.cursor="pointer");
    map.on("mouseleave","sites",()=>map.getCanvas().style.cursor="");
  }catch(e){ console.error(e); document.getElementById("dataMode").textContent="Titik survei belum tersedia"; }

  await addGeoJsonOptional("aoi",local.aoi||"data/aoi.geojson","line",{"line-color":"#111827","line-width":2},"visible");
  const vs=C.vectorSources||{};
  await addMvtOrFallback("roads",vs.roads,local.roads||"data/roads.geojson","line",{"line-color":"#9ca3af","line-width":["interpolate",["linear"],["zoom"],11,0.5,16,1.5],"line-opacity":0.55},"visible");
  await addMvtOrFallback("occurrence",vs.occurrence,local.occurrence||"data/occurrence.geojson","circle",{"circle-radius":3.5,"circle-color":"#4b5563","circle-opacity":0.55},"none");
  await addMvtOrFallback("hsi",vs.hsi,local.hsi||"data/hsi_classes.geojson","fill",{"fill-color":["match",["coalesce",["get","class_name"],["get","HabitatClass"],["get","habitatclass"],""],"High","#18823b","Moderate","#f3c623","Low","#d9342b","#9ca3af"],"fill-opacity":0.34},"none");
  await addMvtOrFallback("change",vs.change,local.change||"data/habitat_change.geojson","fill",{"fill-color":["match",["coalesce",["get","class_name"],["get","Integrated_Change_Class"],["get","integrated_change_class"],""],"Changed-Degraded","#d73027","Recovery","#2a9d8f","Stable","#bdbdbd","#bdbdbd"],"fill-opacity":0.32},"none");
});
