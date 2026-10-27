(function () {
  "use strict";

  var PRESETS = [
    { n: "Mid", c: [0.42, 0, 0.58, 1] },
    { n: "Tight", c: [0.08, 0, 0.1, 1] },
    { n: "Tight in", c: [0.7, 0, 0.9, 0.3] },
    { n: "Tight out", c: [0.1, 0.7, 0.2, 1] },
    { n: "Twin", c: [0.8, 0, 0.2, 1] },
    { n: "Straight", c: [0, 0, 1, 1] },
    { n: "In", c: [0.42, 0, 1, 1] },
    { n: "Out", c: [0, 0, 0.58, 1] },
    { n: "Soft", c: [0.25, 0.1, 0.25, 1] }
  ];
  var DEFAULT_PRESET = 1;     // what Reset goes back to
  var VISIBLE = 9;            // presets shown before "Show more"
  var MAX_ITEMS = 60;
  var NAME_MAX = 16;
  var HINT = "Select two or more keyframes in the timeline, then apply a curve."; 
  var INSTALLED_VERSION = "1.0.0";

  var PAD_L = 30, PAD_R = 12, PAD_T = 10, PAD_B = 20;
  var HIT = 16;

  // the MultiTool logo, traced from the original file, drawn faintly behind the graph
  var LOGO_GRAY = "M455 1530L329 1231L307 860L375 570L660 603L965 1290L1270 603L1555 570L1623 860L1601 1231L1475 1530";
  var LOGO_BLUE = "M245 463L620 463L965 410L1310 463L1685 463";

// =====================================================================
  // Optional online update notice. This only reads a public JSON manifest.
  // Users download and install updates manually from the configured Gumroad page.
  // =====================================================================
  function parseVersion(version) {
    if (typeof version !== "string" || !/^\d+(\.\d+){0,3}$/.test(version)) return null;
    var parts = version.split("."), out = [];
    for (var i = 0; i < parts.length; i++) out.push(parseInt(parts[i], 10));
    return out;
  }

  function isNewerVersion(latest, installed) {
    var a = parseVersion(latest), b = parseVersion(installed);
    if (!a || !b) return false;
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var av = a[i] || 0, bv = b[i] || 0;
      if (av !== bv) return av > bv;
    }
    return false;
  }

  function validWebUrl(value) {
    return typeof value === "string" && /^https:\/\//i.test(value);
  }

  function checkForUpdate() {
    var config = window.MULTITOOL_UPDATE_CONFIG || {};
    if (!validWebUrl(config.manifestUrl)) return;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", config.manifestUrl, true);
    xhr.timeout = 8000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;
      try {
        var data = JSON.parse(xhr.responseText);
        if (!data || !isNewerVersion(data.version, INSTALLED_VERSION)) return;
        var notice = $("updateNotice"), label = $("updateLabel"), button = $("updateBtn");
        label.textContent = "MultiTool update available · v" + data.version;
        notice.hidden = false;
        button.onclick = function () {
          var downloadUrl = validWebUrl(data.download_url) ? data.download_url : config.downloadUrl;
          if (!validWebUrl(downloadUrl)) {
            window.alert("The GitHub download link is missing from update-manifest.json.");
            return;
          }
          if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
            window.cep.util.openURLInDefaultBrowser(downloadUrl);
          } else {
            window.open(downloadUrl, "_blank");
          }
        };
      } catch (e) {}
    };
    xhr.send(null);
  }
  function $(id) { return document.getElementById(id); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round2(v) { return Math.round(v * 100) / 100; }
  function isNum(v) { return typeof v === "number" && isFinite(v); }

  // =====================================================================
  // Saved settings: the preset list, its order, and the last Solid/Camera choices.
  // Kept in After Effects' own preferences (and in the panel's storage as a backup).
  // =====================================================================
  function defaultOrder() {
    var o = [];
    for (var i = 0; i < PRESETS.length; i++) o.push("b" + i);
    return o;
  }

  function cleanCurve(c) {
    if (!(c instanceof Array) || c.length !== 4) return null;
    var out = [];
    for (var i = 0; i < 4; i++) {
      if (!isNum(c[i])) return null;
      out.push(round2(clamp(c[i], 0, 1)));
    }
    return out;
  }

  function cleanSolid(d) {
    var s = { hex: "#000000", comp: true, w: 0, h: 0 };
    if (d && typeof d.hex === "string" && /^#[0-9a-fA-F]{6}$/.test(d.hex)) s.hex = d.hex.toLowerCase();
    if (d && d.comp === false && isNum(d.w) && isNum(d.h) && d.w >= 1 && d.h >= 1 && d.w <= 30000 && d.h <= 30000) {
      s.comp = false; s.w = Math.round(d.w); s.h = Math.round(d.h);
    }
    return s;
  }

  function cleanCamera(d) {
    if (!d || !isNum(d.zoom) || d.zoom <= 0) return null;
    return {
      one: !!d.one,
      zoom: d.zoom,
      dof: !!d.dof,
      focus: isNum(d.focus) && d.focus >= 0 ? d.focus : 1,
      aperture: isNum(d.aperture) && d.aperture >= 0 ? d.aperture : 0.01,
      blur: isNum(d.blur) && d.blur >= 0 ? d.blur : 100
    };
  }

  function cleanSettings(raw) {
    var out = { order: [], open: false, solid: cleanSolid(null), camera: null };
    if (!raw || typeof raw !== "object") { out.order = defaultOrder(); return out; }
    var list = raw.order instanceof Array ? raw.order : defaultOrder();
    var seen = {};
    for (var i = 0; i < list.length && out.order.length < MAX_ITEMS; i++) {
      var e = list[i];
      if (typeof e === "string") {
        if (/^b\d+$/.test(e) && PRESETS[parseInt(e.slice(1), 10)] && !seen[e]) { seen[e] = 1; out.order.push(e); }
      } else if (e && typeof e.i === "string" && typeof e.n === "string") {
        var c = cleanCurve(e.c);
        if (c && !seen[e.i]) { seen[e.i] = 1; out.order.push({ i: e.i, n: e.n.slice(0, NAME_MAX), c: c }); }
      }
    }
    out.open = raw.open === true;
    out.solid = cleanSolid(raw.solid);
    out.camera = cleanCamera(raw.camera);
    return out;
  }

  function readLocal() {
    try {
      var v = window.localStorage.getItem("multitool.settings");
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  var S = cleanSettings(readLocal());

  function asciiJson(o) {
    return JSON.stringify(o).replace(/[\u007f-\uffff]/g, function (ch) {
      return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
    });
  }

  function persist(done) {
    var text = asciiJson(S);
    try { window.localStorage.setItem("multitool.settings", text); } catch (e) {}
    callHost("kfSaveSettings", text, function (res) { if (done) done(res); });
  }

  function itemsList() {
    var out = [];
    for (var i = 0; i < S.order.length; i++) {
      var e = S.order[i];
      if (typeof e === "string") {
        var p = PRESETS[parseInt(e.slice(1), 10)];
        out.push({ n: p.n, c: p.c, builtin: true });
      } else {
        out.push({ n: e.n, c: e.c, builtin: false });
      }
    }
    return out;
  }

  // =====================================================================
  // Curve graph (0% to 100%)
  // =====================================================================
  var state = { c: PRESETS[DEFAULT_PRESET].c.slice() };
  var W = 0, H = 0, drag = -1;
  var cv = $("graph"), ctx = cv.getContext("2d");
  var logoGray = null, logoBlue = null;
  try { logoGray = new Path2D(LOGO_GRAY); logoBlue = new Path2D(LOGO_BLUE); } catch (e) {}

  function toPx(x, y) {
    var pw = W - PAD_L - PAD_R, ph = H - PAD_T - PAD_B;
    return [PAD_L + x * pw, PAD_T + (1 - y) * ph];
  }
  function fromPx(px, py) {
    var pw = W - PAD_L - PAD_R, ph = H - PAD_T - PAD_B;
    return [(px - PAD_L) / pw, 1 - (py - PAD_T) / ph];
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = Math.max(200, cv.parentNode.clientWidth);
    H = Math.max(220, Math.round(W * 0.95));
    cv.style.height = H + "px";
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    draw();
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var tl = toPx(0, 1), br = toPx(1, 0);
    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);

    // logo: very faint, behind the grid and the curve
    if (logoGray) {
      var size = Math.min(br[0] - tl[0], br[1] - tl[1]) * 0.78;
      var sc = size / 1470;
      ctx.save();
      ctx.translate((tl[0] + br[0]) / 2, (tl[1] + br[1]) / 2);
      ctx.scale(sc, sc);
      ctx.translate(-965, -960);
      ctx.lineJoin = "miter";
      ctx.miterLimit = 4;
      ctx.lineCap = "butt";
      ctx.lineWidth = 72;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.stroke(logoGray);
      ctx.lineWidth = 70;
      ctx.strokeStyle = "rgba(38,128,235,0.2)";
      ctx.stroke(logoBlue);
      ctx.restore();
    }

    // grid + labels
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.fillStyle = "#6f6f76";
    ctx.lineWidth = 1;
    var i, p;
    ctx.textAlign = "center";
    for (i = 0; i <= 4; i++) {
      p = toPx(i / 4, 0);
      ctx.strokeStyle = i === 0 || i === 4 ? "#2a2a30" : "#18181b";
      ctx.beginPath(); ctx.moveTo(p[0] + 0.5, tl[1]); ctx.lineTo(p[0] + 0.5, br[1]); ctx.stroke();
      if (i > 0) ctx.fillText(i * 25 + "%", p[0], H - 6);
    }
    ctx.textAlign = "right";
    for (i = 0; i <= 4; i++) {
      p = toPx(0, i / 4);
      ctx.strokeStyle = i === 0 || i === 4 ? "#2a2a30" : "#18181b";
      ctx.beginPath(); ctx.moveTo(tl[0], p[1] + 0.5); ctx.lineTo(br[0], p[1] + 0.5); ctx.stroke();
      ctx.fillText(i * 25 + "%", PAD_L - 4, p[1] + 3);
    }

    // straight reference line
    var a = toPx(0, 0), b = toPx(1, 1);
    ctx.strokeStyle = "#35353b";
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();

    var c = state.c;
    var h1 = toPx(c[0], c[1]), h2 = toPx(c[2], c[3]);

    // handle arms
    ctx.strokeStyle = "#2680eb";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(h1[0], h1[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(h2[0], h2[1]); ctx.stroke();

    // curve with glow
    ctx.save();
    ctx.beginPath(); ctx.rect(tl[0] - 4, tl[1] - 4, br[0] - tl[0] + 8, br[1] - tl[1] + 8); ctx.clip();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(75,155,245,0.22)";
    ctx.lineWidth = 9;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.strokeStyle = "rgba(75,155,245,0.5)";
    ctx.lineWidth = 4;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1.5;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.restore();

    // end points and handles
    dot(a, 4, "#f0f0f0", null);
    dot(b, 4, "#f0f0f0", null);
    dot(h1, 6, "#0a0a0b", "#4b9bf5");
    dot(h2, 6, "#0a0a0b", "#4b9bf5");
  }

  function curvePath(a, h1, h2, b) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.bezierCurveTo(h1[0], h1[1], h2[0], h2[1], b[0], b[1]);
  }

  function dot(p, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function pointerPos(e) {
    var r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function nearestHandle(pos) {
    var h = [toPx(state.c[0], state.c[1]), toPx(state.c[2], state.c[3])];
    var best = -1, bd = HIT * HIT;
    for (var i = 0; i < 2; i++) {
      var dx = h[i][0] - pos[0], dy = h[i][1] - pos[1], d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }
  cv.addEventListener("pointerdown", function (e) {
    var h = nearestHandle(pointerPos(e));
    if (h < 0) return;
    drag = h;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  cv.addEventListener("pointermove", function (e) {
    var pos = pointerPos(e);
    if (drag < 0) { cv.style.cursor = nearestHandle(pos) >= 0 ? "grab" : "default"; return; }
    var v = fromPx(pos[0], pos[1]);
    state.c[drag * 2] = round2(clamp(v[0], 0, 1));
    state.c[drag * 2 + 1] = round2(clamp(v[1], 0, 1));
    sync();
  });
  function endDrag() { drag = -1; }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  function setCurve(c) {
    state.c = c;
    sync();
  }

  function sameCurve(a, b) {
    for (var j = 0; j < 4; j++) if (Math.abs(a[j] - b[j]) > 0.001) return false;
    return true;
  }

  // =====================================================================
  // Presets: delete, rename, reorder, expand / collapse
  // =====================================================================
  var presetBox = $("presets"), moreRow = $("moreRow"), moreBtn = $("moreBtn"), moreTxt = $("moreTxt");
  var editBtn = $("editBtn"), editTxt = $("editTxt"), restoreBtn = $("restoreBtn");
  var editMode = false, tileEls = [], dragInfo = null;

  var PENCIL = '<svg viewBox="0 0 24 24"><path d="M3 21l1.3-5 11.9-11.9a2 2 0 0 1 2.8 0l1.9 1.9a2 2 0 0 1 0 2.8L9 20.7z"/></svg>';

  function drawThumb(c, k) {
    var g = c.getContext("2d"), w = c.width, h = c.height, m = 8;
    function X(x) { return m + x * (w - 2 * m); }
    function Y(y) { return h - m - y * (h - 2 * m); }
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "#35353b"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.stroke();
    g.strokeStyle = "#d9d9d9"; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.moveTo(X(0), Y(0));
    g.bezierCurveTo(X(k[0]), Y(k[1]), X(k[2]), Y(k[3]), X(1), Y(1));
    g.stroke();
  }

  function renderPresets() {
    var items = itemsList();
    var show = (editMode || S.open) ? items.length : Math.min(VISIBLE, items.length);
    presetBox.innerHTML = "";
    tileEls = [];

    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No presets. Press Edit, then Restore defaults, or Save a curve.";
      presetBox.appendChild(empty);
    }

    for (var i = 0; i < show; i++) buildTile(items, i);

    var extra = items.length - VISIBLE;
    if (extra > 0 && !editMode) {
      moreRow.hidden = false;
      moreBtn.className = "more" + (S.open ? "" : " down");
      moreTxt.textContent = S.open ? "Show less" : "Show " + extra + " more";
    } else {
      moreRow.hidden = true;
    }

    editBtn.className = "mini" + (editMode ? " on" : "");
    editTxt.textContent = editMode ? "Done" : "Edit";
    restoreBtn.hidden = !editMode;
    document.body.className = editMode ? "editing" : "";
    markSelected();
  }

  function buildTile(items, i) {
    var item = items[i];
    var tile = document.createElement("div");
    tile.className = "ptile";
    tile.setAttribute("data-i", i);
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");

    var c = document.createElement("canvas");
    c.width = 160; c.height = 52;
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = item.n;
    tile.appendChild(c);
    tile.appendChild(name);
    drawThumb(c, item.c);

    if (editMode || !item.builtin) {
      var del = document.createElement("button");
      del.className = "del";
      del.textContent = "\u00d7";
      del.title = "Delete this preset";
      del.setAttribute("aria-label", "Delete " + item.n);
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        S.order.splice(i, 1);
        persist();
        renderPresets();
      });
      tile.appendChild(del);
    }
    if (!item.builtin) {
      var pen = document.createElement("button");
      pen.className = "pen";
      pen.innerHTML = PENCIL;
      pen.title = "Rename this preset";
      pen.setAttribute("aria-label", "Rename " + item.n);
      pen.addEventListener("click", function (e) {
        e.stopPropagation();
        startRename(i, tile, name);
      });
      tile.appendChild(pen);
    }

    tile.addEventListener("click", function (e) {
      if (editMode) return;
      if (e.target.closest && e.target.closest(".rename")) return;
      setCurve(items[i].c.slice());
    });
    tile.addEventListener("keydown", function (e) {
      if (!editMode && (e.key === "Enter" || e.key === " ") && e.target === tile) {
        e.preventDefault();
        setCurve(items[i].c.slice());
      }
    });
    tile.addEventListener("pointerdown", function (e) { onTileDown(e, i); });

    presetBox.appendChild(tile);
    tileEls.push(tile);
  }

  function markSelected() {
    var items = itemsList();
    for (var i = 0; i < tileEls.length; i++) {
      var on = items[i] && sameCurve(items[i].c, state.c);
      tileEls[i].classList[on ? "add" : "remove"]("on");
    }
  }

  function startRename(i, tile, nameEl) {
    var entry = S.order[i];
    if (!entry || typeof entry === "string") return;
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "rename";
    inp.maxLength = NAME_MAX;
    inp.value = entry.n;
    nameEl.parentNode.replaceChild(inp, nameEl);
    inp.focus();
    inp.select();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      if (save) {
        var v = inp.value.replace(/^\s+|\s+$/g, "");
        if (v) { entry.n = v.slice(0, NAME_MAX); persist(); }
      }
      renderPresets();
    }
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
      e.stopPropagation();
    });
    inp.addEventListener("blur", function () { finish(true); });
  }

  // ---- drag to reorder (in Edit mode) ----
  function onTileDown(e, i) {
    if (!editMode || e.button > 0) return;
    if (e.target.closest && e.target.closest(".del, .pen, .rename")) return;
    dragInfo = { from: i, x: e.clientX, y: e.clientY, active: false, to: -1, ghost: null };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
    document.addEventListener("pointercancel", onDragEnd);
    e.preventDefault();
  }

  function clearDrop() {
    for (var k = 0; k < tileEls.length; k++) tileEls[k].classList.remove("drop");
  }

  function onDragMove(e) {
    var d = dragInfo;
    if (!d) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 6) return;
      d.active = true;
      var g = document.createElement("div");
      g.className = "ghost";
      g.textContent = itemsList()[d.from].n;
      document.body.appendChild(g);
      d.ghost = g;
      if (tileEls[d.from]) tileEls[d.from].classList.add("dragging");
    }
    d.ghost.style.left = e.clientX + "px";
    d.ghost.style.top = e.clientY + "px";
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var t = el && el.closest ? el.closest(".ptile") : null;
    var to = t ? parseInt(t.getAttribute("data-i"), 10) : -1;
    if (to !== d.to) {
      clearDrop();
      d.to = to;
      if (to >= 0 && to !== d.from && tileEls[to]) tileEls[to].classList.add("drop");
    }
  }

  function onDragEnd() {
    var d = dragInfo;
    if (!d) return;
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    document.removeEventListener("pointercancel", onDragEnd);
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    dragInfo = null;
    if (d.active && d.to >= 0 && d.to !== d.from) {
      var moved = S.order.splice(d.from, 1)[0];
      S.order.splice(d.to, 0, moved);
      persist();
    }
    renderPresets();
  }

  editBtn.addEventListener("click", function () {
    editMode = !editMode;
    renderPresets();
    setStatus(editMode ? "Drag a preset to move it. Click x to delete. Click the pencil to rename a saved one." : HINT, "");
  });

  restoreBtn.addEventListener("click", function () {
    var have = {}, added = 0, i;
    for (i = 0; i < S.order.length; i++) if (typeof S.order[i] === "string") have[S.order[i]] = 1;
    for (i = 0; i < PRESETS.length; i++) {
      if (!have["b" + i] && S.order.length < MAX_ITEMS) { S.order.push("b" + i); added++; }
    }
    if (!added) { setStatus("All the default presets are already in the list.", ""); return; }
    persist();
    renderPresets();
    setStatus("Brought back " + added + " default preset" + (added === 1 ? "" : "s") + " at the end of the list.", "ok");
  });

  moreBtn.addEventListener("click", function () {
    S.open = !S.open;
    persist();
    renderPresets();
  });

  // ---- Reset, Random, Save ----
  $("resetBtn").addEventListener("click", function () { setCurve(PRESETS[DEFAULT_PRESET].c.slice()); });

  $("randomBtn").addEventListener("click", function () {
    function r(a, b) { return round2(a + Math.random() * (b - a)); }
    setCurve([r(0.05, 0.9), r(0, 1), r(0.1, 0.95), r(0, 1)]);
  });

  function nextName() {
    var used = {}, i;
    for (i = 0; i < S.order.length; i++) if (typeof S.order[i] !== "string") used[S.order[i].n] = 1;
    var k = 1;
    while (used["My " + k]) k++;
    return "My " + k;
  }

  $("saveBtn").addEventListener("click", function () {
    var items = itemsList(), i;
    for (i = 0; i < items.length; i++) {
      if (sameCurve(items[i].c, state.c)) { setStatus("That curve is already in the list (" + items[i].n + ").", ""); return; }
    }
    if (S.order.length >= MAX_ITEMS) { setStatus("The list is full. Delete a preset first.", "err"); return; }
    var name = nextName();
    S.order.push({
      i: "u" + new Date().getTime().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      n: name,
      c: state.c.slice()
    });
    if (S.order.length > VISIBLE) S.open = true;
    persist();
    renderPresets();
    setStatus("Saved as " + name + ". Use the pencil on it to rename.", "ok");
  });

  function sync() {
    markSelected();
    draw();
  }

  // =====================================================================
  // Talking to After Effects
  // =====================================================================
  var statusEl = $("status");
  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }
  function callHost(fn, arg, cb) {
    var script = fn + "(" + JSON.stringify(arg === undefined ? null : arg) + ")";
    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, cb);
    } else {
      cb("ERR|Open this panel inside After Effects (Window > Extensions > MultiTool).");
    }
  }
  // replies look like TAG|message  or  TAG|message|data
  function splitReply(res) {
    var s = String(res), a = s.indexOf("|");
    if (a < 0) return { tag: "ERR", msg: s === "EvalScript error." ? "Script error. Is MultiTool installed correctly?" : s, data: "" };
    var rest = s.slice(a + 1), b = rest.indexOf("|");
    return { tag: s.slice(0, a), msg: b < 0 ? rest : rest.slice(0, b), data: b < 0 ? "" : rest.slice(b + 1) };
  }
  function run(fn, arg, done) {
    callHost(fn, arg, function (res) {
      var r = splitReply(res);
      setStatus(r.msg, r.tag === "OK" ? "ok" : "err");
      if (done) done();
    });
  }

  var applyBtn = $("applyBtn");
  applyBtn.addEventListener("click", function () {
    applyBtn.disabled = true;
    setStatus("Applying...", "");
    run("kfApply", { x1: state.c[0], y1: state.c[1], x2: state.c[2], y2: state.c[3] }, function () {
      applyBtn.disabled = false;
    });
  });

  // ---- Copy / Paste ease ----
  var clip = null;   // the copied curve [x1, y1, x2, y2], kept while the panel is open
  var copyBtn = $("copyBtn"), pasteBtn = $("pasteBtn");

  copyBtn.addEventListener("click", function () {
    copyBtn.disabled = true;
    setStatus("Reading the ease...", "");
    callHost("kfCopy", null, function (res) {
      copyBtn.disabled = false;
      var r = splitReply(res), c = null;
      if (r.tag !== "OK") { setStatus(r.msg, "err"); return; }
      try { c = cleanCurve(JSON.parse(r.data)); } catch (err) { c = null; }
      if (!c) { setStatus("Could not read the copied ease.", "err"); return; }
      clip = c.slice();
      setCurve(c.slice());
      setStatus(r.msg + " It is in the graph: press Save to keep it, or Paste on other keyframes.", "ok");
    });
  });

  pasteBtn.addEventListener("click", function () {
    if (!clip) { setStatus("Nothing copied yet. Select keyframes with an ease you like and press Copy first.", "err"); return; }
    pasteBtn.disabled = true;
    setStatus("Pasting...", "");
    run("kfApply", { x1: clip[0], y1: clip[1], x2: clip[2], y2: clip[3], paste: true }, function () {
      pasteBtn.disabled = false;
    });
  });

  var anchors = document.querySelectorAll(".anc");
  for (var ai = 0; ai < anchors.length; ai++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        run("kfAnchor", { x: parseFloat(btn.getAttribute("data-x")), y: parseFloat(btn.getAttribute("data-y")) });
      });
    })(anchors[ai]);
  }

  var quick = document.querySelectorAll(".qbtn");
  for (var qi = 0; qi < quick.length; qi++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var axis = btn.getAttribute("data-axis");
        run(btn.getAttribute("data-task"), axis ? { axis: axis } : null);
      });
    })(quick[qi]);
  }

  // ---- Add layer: the plain button uses your last saved choice, the gear opens After Effects' own dialog ----
  var solidFill = $("solidFill"), solidBtn = $("solidBtn");
  function updateSolidIcon() {
    solidFill.style.fill = S.solid.hex;
    solidBtn.title = "Solid (" + S.solid.hex + "). Use the gear to change it.";
  }

  var lays = document.querySelectorAll(".lay");
  for (var li = 0; li < lays.length; li++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        run("kfAddLayer", { kind: btn.getAttribute("data-kind"), solid: S.solid, camera: S.camera });
      });
    })(lays[li]);
  }

  var gears = document.querySelectorAll(".gear");
  for (var gi = 0; gi < gears.length; gi++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-kind");
        if (kind === "SOL") {
          setStatus("Set the solid in After Effects, then click OK...", "");
          callHost("kfSolidNative", { solid: S.solid }, function (res) {
            var r = splitReply(res);
            if (r.tag !== "OK") {
              setStatus(r.msg || "No solid added.", r.tag === "NONE" ? "" : "err");
              return;
            }
            try {
              S.solid = cleanSolid(JSON.parse(r.data));
              updateSolidIcon();
            } catch (err) {
              setStatus(r.msg + " Its color could not be saved.", "err");
              return;
            }
            persist(function (saveReply) {
              var saved = splitReply(saveReply);
              setStatus(r.msg + (saved.tag === "OK" ? " Color saved for the Solid button." : " Color is active now, but After Effects could not save it."), saved.tag === "OK" ? "ok" : "err");
            });
          });
          return;
        }
        setStatus("Waiting for the After Effects " + (kind === "CAM" ? "Camera" : "Solid") + " dialog...", "");
        callHost("kfLayerDialog", { kind: kind }, function (res) {
          var r = splitReply(res);
          if (r.tag === "OK") {
            try {
              var d = JSON.parse(r.data);
              if (kind === "SOL") S.solid = cleanSolid(d); else S.camera = cleanCamera(d);
              persist();
              updateSolidIcon();
            } catch (err) {}
            setStatus(r.msg + " The normal button now uses these settings.", "ok");
          } else {
            setStatus(r.msg, r.tag === "NONE" ? "" : "err");
          }
        });
      });
    })(gears[gi]);
  }

  // =====================================================================
  // Start up
  // =====================================================================
  window.addEventListener("resize", resize);
  renderPresets();
  updateSolidIcon();
  resize();
  checkForUpdate();

  // the copy kept inside After Effects wins over the panel's own backup
  callHost("kfLoadSettings", null, function (res) {
    res = String(res);
    if (res.indexOf("OK|") !== 0) return;
    try {
      S = cleanSettings(JSON.parse(res.slice(3)));
      renderPresets();
      updateSolidIcon();
    } catch (e) {}
  });
})();
