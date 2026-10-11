(() => {
  if (!window.maplibregl) {
    console.warn("Field mode tidak diinisialisasi karena MapLibre belum tersedia.");
    return;
  }

  const PREFIX = "webgis-field:";
  const SETTINGS_KEY = PREFIX + "settings";
  const QUEUE_KEY = PREFIX + "queue";
  let deferredInstall = null;
  let currentSurveyFeature = null;

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const settings = () => readJSON(SETTINGS_KEY, { surveyor: "", token: "" });
  const queue = () => readJSON(QUEUE_KEY, []);
  const noteKey = (id) => PREFIX + "note:" + id;
  const readNote = (id) => readJSON(noteKey(id), {});
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  function updatePending() {
    const el = document.getElementById("statPending");
    if (el) el.textContent = queue().length;
  }

  function updateOnline() {
    const el = document.getElementById("onlineBadge");
    if (!el) return;
    el.textContent = navigator.onLine ? "ONLINE" : "OFFLINE";
    el.className = "status-pill " + (navigator.onLine ? "online" : "offline");
  }

  function localProgress() {
    const total = sites?.features?.length || 0;
    let visited = 0;
    for (const f of sites?.features || []) {
      const id = siteId(f.properties || {});
      const n = readNote(id);
      if (n.status && n.status !== "Belum dikunjungi") visited++;
    }
    const v = document.getElementById("statVisited");
    const r = document.getElementById("statRemaining");
    const b = document.getElementById("progressBar");
    if (v) v.textContent = visited;
    if (r) r.textContent = Math.max(total - visited, 0);
    if (b) b.style.width = (total ? (visited / total) * 100 : 0) + "%";
  }

  async function refreshProgress() {
    if (navigator.onLine && C.dataMode !== "static") {
      try {
        const r = await fetch((C.apiBase || "/api") + "/progress");
        if (r.ok) {
          const x = await r.json();
          const visited = document.getElementById("statVisited");
          const remaining = document.getElementById("statRemaining");
          const bar = document.getElementById("progressBar");
          if (visited) visited.textContent = x.visited;
          if (remaining) remaining.textContent = x.remaining;
          if (bar) bar.style.width = (x.total ? (x.visited / x.total) * 100 : 0) + "%";
          return;
        }
      } catch (e) { console.info("progress fallback", e); }
    }
    localProgress();
  }

  async function sendRecord(rec) {
    const cfg = settings();
    const headers = { "Content-Type": "application/json" };
    if (cfg.token) headers["X-Field-Token"] = cfg.token;
    const r = await fetch((C.apiBase || "/api") + "/observations", {
      method: "POST",
      headers,
      body: JSON.stringify(rec)
    });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  }

  function buildRecord(feature) {
    const props = feature.properties || {};
    const id = siteId(props);
    const old = readNote(id);
    const clientId = old.client_id || uuid();
    const coords = feature.geometry?.coordinates || [null, null];
    return {
      client_id: clientId,
      site_id: id,
      surveyor_name: document.getElementById("surveySurveyor")?.value.trim() || settings().surveyor || null,
      survey_status: document.getElementById("surveyStatus")?.value || null,
      detection_status: document.getElementById("surveyDetection")?.value || null,
      effort_minutes: document.getElementById("surveyEffort")?.value ? Number(document.getElementById("surveyEffort").value) : null,
      notes: document.getElementById("surveyNotes")?.value.trim() || null,
      latitude: lastPosition?.coords?.latitude ?? Number(coords[1]),
      longitude: lastPosition?.coords?.longitude ?? Number(coords[0]),
      accuracy_m: lastPosition?.coords?.accuracy ?? null,
      payload: {
        source: "webgis-maplibre-pwa",
        local_saved_at: new Date().toISOString(),
        site_coordinate_used: !lastPosition
      }
    };
  }

  function persistLocal(rec) {
    writeJSON(noteKey(rec.site_id), {
      client_id: rec.client_id,
      status: rec.survey_status,
      detection: rec.detection_status,
      effort: rec.effort_minutes,
      surveyor: rec.surveyor_name,
      note: rec.notes,
      saved_at: rec.payload.local_saved_at
    });
    localProgress();
  }

  function setSurveySaveState(text, tone = "") {
    const el = document.getElementById("surveySaveStatus");
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
  }

  function closeSurveyWorkspace() {
    document.getElementById("surveyWorkspace")?.classList.remove("is-open");
    document.getElementById("surveyWorkspace")?.setAttribute("aria-hidden", "true");
    document.getElementById("surveyBackdrop").hidden = true;
    currentSurveyFeature = null;
  }

  window.openSurveyWorkspace = function(feature) {
    currentSurveyFeature = feature;
    const p = feature.properties || {};
    const id = siteId(p);
    const saved = readNote(id);
    const cfg = settings();

    document.getElementById("surveySiteId").textContent = id;
    document.getElementById("surveySiteMeta").innerHTML = [
      "HSI " + hsi(p),
      "Access " + access(p),
      String(surveyFunction(p)),
      String(changeClass(p))
    ].map(x => `<span class="site-chip">${esc(x)}</span>`).join("");

    document.getElementById("surveyStatus").value = saved.status || "Belum dikunjungi";
    document.getElementById("surveyDetection").value = saved.detection || "";
    document.getElementById("surveyEffort").value = saved.effort ?? "";
    document.getElementById("surveySurveyor").value = saved.surveyor || cfg.surveyor || "";
    document.getElementById("surveyNotes").value = saved.note || "";
    document.getElementById("surveyCoordinateHint").textContent = lastPosition
      ? `GPS perangkat tersedia · akurasi ±${Math.round(lastPosition.coords.accuracy || 0)} m`
      : "GPS perangkat belum tersedia · koordinat site akan dipakai.";
    setSurveySaveState(saved.saved_at ? "Tersimpan lokal sebelumnya" : "Belum disimpan");

    const drawer = document.getElementById("surveyWorkspace");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.getElementById("surveyBackdrop").hidden = false;
  };

  async function saveCurrentSurvey() {
    if (!currentSurveyFeature) return;
    const rec = buildRecord(currentSurveyFeature);
    persistLocal(rec);
    setSurveySaveState("Menyimpan…");

    try {
      if (!navigator.onLine) throw new Error("offline");
      await sendRecord(rec);
      const pending = queue().filter(x => x.client_id !== rec.client_id);
      writeJSON(QUEUE_KEY, pending);
      updatePending();
      setSurveySaveState("✓ Tersimpan di server + perangkat", "ok");
      await refreshProgress();
    } catch (e) {
      const pending = queue().filter(x => x.client_id !== rec.client_id);
      pending.push(rec);
      writeJSON(QUEUE_KEY, pending);
      updatePending();
      setSurveySaveState("⚠ Tersimpan lokal · menunggu sinkronisasi", "pending");
      console.info(e);
    }
  }

  async function syncQueue() {
    const statusEl = document.getElementById("syncStatus");
    if (!navigator.onLine) {
      if (statusEl) statusEl.textContent = "Offline — data tetap aman di perangkat.";
      return;
    }
    const pending = queue();
    if (!pending.length) {
      if (statusEl) statusEl.textContent = "Tidak ada data pending.";
      await refreshProgress();
      return;
    }
    if (statusEl) statusEl.textContent = "Sinkronisasi " + pending.length + " record…";
    let ok = 0;
    const failed = [];
    for (const rec of pending) {
      try { await sendRecord(rec); ok++; }
      catch (e) { failed.push(rec); console.info("sync failed", e); }
    }
    writeJSON(QUEUE_KEY, failed);
    updatePending();
    if (statusEl) statusEl.textContent = "Sinkron: " + ok + " berhasil, " + failed.length + " masih pending.";
    await refreshProgress();
  }

  function exportNotes() {
    const rows = [["Site_ID","Status","Detection","Effort_Minutes","Surveyor","Notes","Saved_at"]];
    for (const f of sites?.features || []) {
      const id = siteId(f.properties || {});
      const n = readNote(id);
      if (n.status || n.detection || n.effort || n.surveyor || n.note) {
        rows.push([id,n.status||"",n.detection||"",n.effort??"",n.surveyor||"",n.note||"",n.saved_at||""]);
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "field_notes.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearLocalNotes() {
    if (!confirm("Hapus catatan lokal yang sudah tersimpan di perangkat? Data server dan antrean sinkronisasi tidak dihapus.")) return;
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX + "note:")).forEach(k => localStorage.removeItem(k));
    localProgress();
    const status = document.getElementById("syncStatus");
    if (status) status.textContent = "Catatan lokal dihapus. Data server tidak berubah.";
  }

  function initFieldMode() {
    updateOnline();
    updatePending();
    localProgress();
    refreshProgress();

    const cfg = settings();
    const surveyor = document.getElementById("defaultSurveyor");
    const token = document.getElementById("fieldToken");
    if (surveyor) surveyor.value = cfg.surveyor || "";
    if (token) token.value = cfg.token || "";

    document.getElementById("saveDeviceSettings")?.addEventListener("click", () => {
      writeJSON(SETTINGS_KEY, {
        surveyor: surveyor?.value.trim() || "",
        token: token?.value.trim() || ""
      });
      const status = document.getElementById("syncStatus");
      if (status) status.textContent = "Pengaturan perangkat tersimpan.";
    });

    document.getElementById("syncBtn")?.addEventListener("click", syncQueue);
    document.getElementById("exportNotes")?.addEventListener("click", exportNotes);
    document.getElementById("clearNotes")?.addEventListener("click", clearLocalNotes);
    document.getElementById("closeSurveyBtn")?.addEventListener("click", closeSurveyWorkspace);
    document.getElementById("surveyBackdrop")?.addEventListener("click", closeSurveyWorkspace);
    document.getElementById("surveyForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      await saveCurrentSurvey();
    });

    window.addEventListener("online", () => { updateOnline(); syncQueue(); });
    window.addEventListener("offline", updateOnline);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstall = e;
      const install = document.getElementById("installBtn");
      if (install) install.hidden = false;
    });

    document.getElementById("installBtn")?.addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      document.getElementById("installBtn").hidden = true;
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.info);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFieldMode);
  } else {
    initFieldMode();
  }
})();
