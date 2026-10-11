(() => {
  const PREFIX = "webgis-field:";
  const SETTINGS_KEY = PREFIX + "settings";
  const QUEUE_KEY = PREFIX + "queue";
  let deferredInstall = null;

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
    el.className = "badge " + (navigator.onLine ? "online" : "offline");
  }

  function localProgress() {
    const total = sites?.features?.length || 0;
    let visited = 0;
    for (const f of sites?.features || []) {
      const id = siteId(f.properties || {});
      const n = readNote(id);
      if (n.status && n.status !== "Belum dikunjungi") visited++;
    }
    if (document.getElementById("statVisited")) statVisited.textContent = visited;
    if (document.getElementById("statRemaining")) statRemaining.textContent = Math.max(total - visited, 0);
    if (document.getElementById("progressBar")) progressBar.style.width = (total ? (visited / total) * 100 : 0) + "%";
  }

  async function refreshProgress() {
    if (navigator.onLine && C.dataMode !== "static") {
      try {
        const r = await fetch((C.apiBase || "/api") + "/progress");
        if (r.ok) {
          const x = await r.json();
          statVisited.textContent = x.visited;
          statRemaining.textContent = x.remaining;
          progressBar.style.width = (x.total ? (x.visited / x.total) * 100 : 0) + "%";
          return;
        }
      } catch (e) { console.info("progress fallback", e); }
    }
    localProgress();
  }

  const originalPopupHtml = popupHtml;
  popupHtml = function(feature) {
    const p = feature.properties || {};
    const id = siteId(p);
    const saved = readNote(id);
    const html = originalPopupHtml(feature);
    return html.replace(
      '<label>Surveyor<input class="field-surveyor"',
      '<div class="two"><label>Detection<select class="field-detection">' +
        ["", "Detected", "Non-detected", "Not assessed"].map(x =>
          '<option ' + (saved.detection === x ? 'selected' : '') + '>' + (x || '– pilih –') + '</option>'
        ).join("") +
        '</select></label><label>Effort (menit)<input class="field-effort" type="number" min="0" step="1" value="' +
        (saved.effort ?? "") +
        '"/></label></div><label>Surveyor<input class="field-surveyor"'
    );
  };

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

  saveObservation = async function(node) {
    const id = node.dataset.site;
    const old = readNote(id);
    const clientId = old.client_id || uuid();
    const rec = {
      client_id: clientId,
      site_id: id,
      surveyor_name: node.querySelector(".field-surveyor")?.value || settings().surveyor || null,
      survey_status: node.querySelector(".field-status")?.value || null,
      detection_status: node.querySelector(".field-detection")?.value || null,
      effort_minutes: node.querySelector(".field-effort")?.value ? Number(node.querySelector(".field-effort").value) : null,
      notes: node.querySelector(".field-note")?.value || null,
      latitude: lastPosition?.coords?.latitude ?? Number(node.dataset.lat),
      longitude: lastPosition?.coords?.longitude ?? Number(node.dataset.lng),
      accuracy_m: lastPosition?.coords?.accuracy ?? null,
      payload: { source: "webgis-maplibre-pwa", local_saved_at: new Date().toISOString() }
    };

    writeJSON(noteKey(id), {
      client_id: clientId,
      status: rec.survey_status,
      detection: rec.detection_status,
      effort: rec.effort_minutes,
      surveyor: rec.surveyor_name,
      note: rec.notes,
      saved_at: rec.payload.local_saved_at
    });
    localProgress();

    const statusEl = node.querySelector(".save-status");
    try {
      if (!navigator.onLine) throw new Error("offline");
      await sendRecord(rec);
      statusEl.textContent = "✓ Tersimpan di server + perangkat";
      await refreshProgress();
    } catch (e) {
      const pending = queue().filter(x => x.client_id !== clientId);
      pending.push(rec);
      writeJSON(QUEUE_KEY, pending);
      updatePending();
      statusEl.textContent = "⚠ Tersimpan lokal, menunggu sinkronisasi";
      console.info(e);
    }
  };

  async function syncQueue() {
    const statusEl = document.getElementById("syncStatus");
    if (!navigator.onLine) {
      statusEl.textContent = "Offline — data tetap aman di perangkat.";
      return;
    }
    const pending = queue();
    if (!pending.length) {
      statusEl.textContent = "Tidak ada data pending.";
      await refreshProgress();
      return;
    }
    statusEl.textContent = "Sinkronisasi " + pending.length + " record…";
    let ok = 0;
    const failed = [];
    for (const rec of pending) {
      try { await sendRecord(rec); ok++; }
      catch (e) { failed.push(rec); console.info("sync failed", e); }
    }
    writeJSON(QUEUE_KEY, failed);
    updatePending();
    statusEl.textContent = "Sinkron: " + ok + " berhasil, " + failed.length + " masih pending.";
    await refreshProgress();
  }

  function initFieldMode() {
    updateOnline();
    updatePending();
    localProgress();
    refreshProgress();

    const cfg = settings();
    if (document.getElementById("defaultSurveyor")) defaultSurveyor.value = cfg.surveyor || "";
    if (document.getElementById("fieldToken")) fieldToken.value = cfg.token || "";

    document.getElementById("saveDeviceSettings")?.addEventListener("click", () => {
      writeJSON(SETTINGS_KEY, {
        surveyor: defaultSurveyor.value.trim(),
        token: fieldToken.value.trim()
      });
      syncStatus.textContent = "Pengaturan perangkat tersimpan.";
    });

    document.getElementById("syncBtn")?.addEventListener("click", syncQueue);

    window.addEventListener("online", () => { updateOnline(); syncQueue(); });
    window.addEventListener("offline", updateOnline);

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstall = e;
      installBtn.hidden = false;
    });

    document.getElementById("installBtn")?.addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      installBtn.hidden = true;
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