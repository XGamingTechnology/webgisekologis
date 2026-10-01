const map = L.map('map', {zoomControl:true}).setView([-7.7956, 110.3695], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const groups = {
  sites: L.layerGroup().addTo(map),
  aoi: L.layerGroup().addTo(map),
  roads: L.layerGroup().addTo(map),
  occurrence: L.layerGroup(),
  hsi: L.layerGroup(),
  change: L.layerGroup()
};

let siteGeojson = null;
let siteLayer = null;
let siteMarkers = {};
let userMarker = null;

const colors = {
  access: {A:'#2e7d32', B:'#f9a825', C:'#c62828'},
  hsi: {High:'#18823b', Moderate:'#f3c623', Low:'#d9342b'},
  function: {
    'Confirmatory presence':'circle',
    'Change verification':'square',
    'Candidate non-detection':'cross',
    'Exploratory high-potential':'triangle'
  }
};

function prop(p, ...names) {
  for (const n of names) if (p[n] !== undefined && p[n] !== null && p[n] !== '') return p[n];
  return '–';
}
function getSiteId(p){ return prop(p,'Site_ID','site_id','SITE_ID'); }
function getHSI(p){ return prop(p,'HabitatClass','HSI_Class_Name','HSI_Class','hsi_class'); }
function getFunction(p){ return prop(p,'Survey_Function','Survey_Function_Revised','survey_function'); }
function getAccess(p){ return String(prop(p,'Access_Priority','access_priority')).replace('Access ',''); }
function getTaxa(p){ return prop(p,'Survey_Taxon_Targets','Taxon_Targets','taxon_targets'); }

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function localKey(siteId){ return `field-note:${siteId}`; }
function getLocal(siteId){
  try { return JSON.parse(localStorage.getItem(localKey(siteId)) || '{}'); } catch { return {}; }
}
function saveLocal(siteId, obj){ localStorage.setItem(localKey(siteId), JSON.stringify(obj)); }

function markerFor(feature, latlng){
  const p = feature.properties || {};
  const access = getAccess(p);
  const color = colors.access[access] || '#2563eb';
  const fn = getFunction(p);
  const radius = fn === 'Candidate non-detection' ? 9 : 8;
  return L.circleMarker(latlng,{
    radius, color:'#111827', weight:1.2, fillColor:color, fillOpacity:.9
  });
}

function popupHtml(feature){
  const p = feature.properties || {};
  const siteId = getSiteId(p);
  const ll = feature.geometry.coordinates;
  const lng = ll[0], lat = ll[1];
  const saved = getLocal(siteId);
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return `
  <div class="site-popup" data-site="${escapeHtml(siteId)}">
    <h3>${escapeHtml(siteId)}</h3>
    <div class="kv">
      <b>HSI</b><span>${escapeHtml(getHSI(p))}</span>
      <b>Fungsi</b><span>${escapeHtml(getFunction(p))}</span>
      <b>Target takson</b><span>${escapeHtml(getTaxa(p))}</span>
      <b>LULC change</b><span>${escapeHtml(prop(p,'Integrated_Change_Class','Change_Class'))}</span>
      <b>Access</b><span>${escapeHtml(getAccess(p))} — ${escapeHtml(prop(p,'Access_Class'))}</span>
      <b>Jarak jalan</b><span>${escapeHtml(prop(p,'Dist_DriveRoad_m'))} m</span>
      <b>Nearest road</b><span>${escapeHtml(prop(p,'Nearest_Road_Class'))}</span>
      <b>Historical</b><span>${escapeHtml(prop(p,'Occurrence_Status_Current','Taxon_Record_Status'))}</span>
    </div>
    <div class="popup-actions">
      <a href="${nav}" target="_blank" rel="noopener">🧭 Navigasi</a>
      <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">🗺 Buka Maps</a>
    </div>
    <div class="field-editor">
      <label>Status kunjungan
        <select class="field-status">
          ${['Belum dikunjungi','Terverifikasi','Tidak dapat diakses','Perlu izin','Diganti'].map(x=>`<option ${saved.status===x?'selected':''}>${x}</option>`).join('')}
        </select>
      </label>
      <label>Catatan
        <textarea class="field-note" placeholder="akses, izin, kondisi habitat, catatan tim...">${escapeHtml(saved.note||'')}</textarea>
      </label>
      <button class="save-note">Simpan catatan</button>
    </div>
  </div>`;
}

function bindPopupEditor(layer, feature){
  layer.on('popupopen', () => {
    const node = document.querySelector('.site-popup');
    if(!node) return;
    const siteId = node.dataset.site;
    node.querySelector('.save-note').onclick = () => {
      saveLocal(siteId,{
        status: node.querySelector('.field-status').value,
        note: node.querySelector('.field-note').value,
        saved_at: new Date().toISOString()
      });
      node.querySelector('.save-note').textContent='✓ Tersimpan';
      setTimeout(()=>node.querySelector('.save-note').textContent='Simpan catatan',1000);
    };
  });
}

function renderSites(){
  groups.sites.clearLayers();
  siteMarkers = {};
  if(!siteGeojson) return;
  const hsi = document.getElementById('filterHSI').value;
  const fn = document.getElementById('filterFunction').value;
  const ac = document.getElementById('filterAccess').value;
  const search = document.getElementById('searchSite').value.trim().toLowerCase();

  const filtered = {
    type:'FeatureCollection',
    features:siteGeojson.features.filter(f=>{
      const p=f.properties||{};
      return (!hsi || String(getHSI(p))===hsi) &&
             (!fn || String(getFunction(p))===fn) &&
             (!ac || String(getAccess(p))===ac) &&
             (!search || String(getSiteId(p)).toLowerCase().includes(search));
    })
  };

  siteLayer=L.geoJSON(filtered,{
    pointToLayer:markerFor,
    onEachFeature:(f,l)=>{
      l.bindPopup(popupHtml(f),{maxWidth:340});
      bindPopupEditor(l,f);
      siteMarkers[getSiteId(f.properties||{})]=l;
    }
  }).addTo(groups.sites);
}

async function fetchJson(path){
  const r=await fetch(path);
  if(!r.ok) throw new Error(`${path}: ${r.status}`);
  return await r.json();
}
async function optionalGeoJSON(path, group, style, pointToLayer){
  try{
    const d=await fetchJson(path);
    const l=L.geoJSON(d,{style,pointToLayer}).addTo(group);
    return {data:d,layer:l};
  }catch(e){ console.info('Optional layer not loaded:',path); return null; }
}

async function init(){
  try{
    siteGeojson=await fetchJson('data/sites.geojson');
    renderSites();
    const counts={A:0,B:0,C:0};
    siteGeojson.features.forEach(f=>{ const a=getAccess(f.properties||{}); if(counts[a]!==undefined) counts[a]++; });
    document.getElementById('statTotal').textContent=siteGeojson.features.length;
    document.getElementById('statA').textContent=counts.A;
    document.getElementById('statB').textContent=counts.B;
    document.getElementById('statC').textContent=counts.C;
    const b=L.geoJSON(siteGeojson).getBounds();
    if(b.isValid()) map.fitBounds(b.pad(.08));
  }catch(e){
    alert('data/sites.geojson belum tersedia. Jalankan notebook builder untuk mengekspor data final.');
    console.error(e);
  }

  optionalGeoJSON('data/aoi.geojson',groups.aoi,{color:'#111',weight:2,fill:false});
  optionalGeoJSON('data/roads.geojson',groups.roads,{color:'#9ca3af',weight:1,opacity:.55});
  optionalGeoJSON('data/occurrence.geojson',groups.occurrence,null,(f,ll)=>L.circleMarker(ll,{radius:3,color:'#4b5563',weight:.7,fillOpacity:.45}));
  optionalGeoJSON('data/hsi_classes.geojson',groups.hsi,f=>({color:'transparent',weight:0,fillColor:colors.hsi[prop(f.properties||{},'HabitatClass','class')]||'#999',fillOpacity:.25}));
  optionalGeoJSON('data/habitat_change.geojson',groups.change,f=>{
    const c=prop(f.properties||{},'Integrated_Change_Class','Change_Class');
    const col=c==='Changed-Degraded'?'#d73027':c==='Recovery'?'#2a9d8f':'#bdbdbd';
    return {color:'transparent',weight:0,fillColor:col,fillOpacity:.28};
  });
}

['filterHSI','filterFunction','filterAccess'].forEach(id=>document.getElementById(id).addEventListener('change',renderSites));
document.getElementById('searchSite').addEventListener('input',renderSites);
document.getElementById('resetFilters').onclick=()=>{
  ['filterHSI','filterFunction','filterAccess','searchSite'].forEach(id=>document.getElementById(id).value='');
  renderSites();
};

function toggle(id,group){
  document.getElementById(id).onchange=e=>{
    if(e.target.checked) group.addTo(map); else map.removeLayer(group);
  };
}
toggle('toggleSites',groups.sites); toggle('toggleAOI',groups.aoi); toggle('toggleRoads',groups.roads);
toggle('toggleOccurrence',groups.occurrence); toggle('toggleHSI',groups.hsi); toggle('toggleChange',groups.change);

document.getElementById('locateBtn').onclick=()=>{
  map.locate({setView:true,maxZoom:18,enableHighAccuracy:true});
};
map.on('locationfound',e=>{
  if(userMarker) map.removeLayer(userMarker);
  userMarker=L.circleMarker(e.latlng,{radius:8,color:'#2563eb',fillColor:'#60a5fa',fillOpacity:1}).addTo(map).bindPopup(`Lokasi perangkat<br>Akurasi ±${Math.round(e.accuracy)} m`).openPopup();
});
map.on('locationerror',()=>alert('Lokasi perangkat tidak tersedia / izin lokasi belum diberikan.'));

document.getElementById('sidebarToggle').onclick=()=>document.getElementById('sidebar').classList.toggle('open');

document.getElementById('exportNotes').onclick=()=>{
  if(!siteGeojson) return;
  const rows=[['Site_ID','Status','Note','Saved_at']];
  siteGeojson.features.forEach(f=>{
    const id=getSiteId(f.properties||{}), n=getLocal(id);
    if(n.status||n.note) rows.push([id,n.status||'',n.note||'',n.saved_at||'']);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='field_notes.csv'; a.click(); URL.revokeObjectURL(a.href);
};
document.getElementById('clearNotes').onclick=()=>{
  if(!confirm('Hapus seluruh catatan lokal WebGIS ini?')) return;
  Object.keys(localStorage).filter(k=>k.startsWith('field-note:')).forEach(k=>localStorage.removeItem(k));
  alert('Catatan lokal dihapus.');
};

const legend=L.control({position:'bottomleft'});
legend.onAdd=()=>{
  const d=L.DomUtil.create('div','legend');
  d.innerHTML='<b>Akses</b><br><i style="background:#2e7d32"></i>A &nbsp; <i style="background:#f9a825"></i>B &nbsp; <i style="background:#c62828"></i>C';
  return d;
};
legend.addTo(map);

init();
