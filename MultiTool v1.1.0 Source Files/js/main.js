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
  var VISIBLE = 10;           // presets shown before "Show more"
  var MAX_ITEMS = 60;
  var NAME_MAX = 16;
  var HINT = "Select two or more keyframes in the timeline, then apply a curve."; 
  var INSTALLED_VERSION = "1.1.0";

  var PAD_L = 30, PAD_R = 12, PAD_T = 10, PAD_B = 20;
  var HIT = 16;

  // ---- customize: colors and section order ----
  var DEFAULT_ACCENT = "#2680eb";
  var RECENT_MAX = 8;          // color circles kept; a new color pushes out the oldest
  var ACCENTS = ["#2680eb", "#06b6d4", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];
  var BASE_KEYS = ["graphite", "midnight", "plum", "black"];
  var BASES = {
    graphite: { n: "Graphite", bg: "#0a0a0b", surface: "#101011", line: "#1f1f23", lineHi: "#2c2c32", press: "#17171a", ink: "#dcdce0", dim: "#85858c" },
    midnight: { n: "Midnight", bg: "#080a12", surface: "#0d101b", line: "#1a2034", lineHi: "#272f4a", press: "#131827", ink: "#dde1ee", dim: "#8088a0" },
    plum:     { n: "Plum",     bg: "#0c0912", surface: "#120e1a", line: "#221b30", lineHi: "#31284a", press: "#19132a", ink: "#e2dcee", dim: "#8c85a0" },
    black:    { n: "Black",    bg: "#000000", surface: "#08080a", line: "#17171a", lineHi: "#232328", press: "#101012", ink: "#dcdce0", dim: "#7c7c83" }
  };
  // ---- Add layer buttons: what exists, what is on, and in which order ----
  var GEAR_SVG = '<svg viewBox="0 0 24 24"><path d="M10.5 4.7 L10.7 1.9 L13.3 1.9 L13.5 4.7 L16.1 5.8 L18.2 3.9 L20.1 5.8 L18.2 7.9 L19.3 10.5 L22.1 10.7 L22.1 13.3 L19.3 13.5 L18.2 16.1 L20.1 18.2 L18.2 20.1 L16.1 18.2 L13.5 19.3 L13.3 22.1 L10.7 22.1 L10.5 19.3 L7.9 18.2 L5.8 20.1 L3.9 18.2 L5.8 16.1 L4.7 13.5 L1.9 13.3 L1.9 10.7 L4.7 10.5 L5.8 7.9 L3.9 5.8 L5.8 3.9 L7.9 5.8Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var LAYER_KEYS = ["NUL", "TXT", "SOL", "SHP", "CAM", "LGT", "ADJ", "BOX", "CTL"];
  var LAYER_OFF = ["BOX", "CTL"];     // off until you turn them on in Customize
  var LAYER_DEFS = {
    NUL: { n: "Null", full: "Null object", t: "Null object", icon: '<rect x="5" y="5" width="14" height="14" rx="1.5" stroke-dasharray="3 2.4"/><path d="M12 9v6M9 12h6"/>' },
    TXT: { n: "Text", full: "Text layer", t: "Text layer", icon: '<path d="M6 8V5.5h12V8M12 5.5v13M9 18.5h6"/>' },
    SOL: { n: "Solid", full: "Solid", t: "Solid", gear: "Solid settings: opens After Effects' own Solid Settings dialog, adds the layer and remembers its color", icon: '<rect x="4" y="6" width="16" height="12" rx="1.8"/>' },
    SHP: { n: "Shape", full: "Shape layer", t: "Empty shape layer", icon: '<path d="M12 4l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.9 7 19.4l.9-5.6-4-3.9 5.6-.8z"/>' },
    CAM: { n: "Camera", full: "Camera", t: "Camera", gear: "Camera settings: opens After Effects' own dialog, then adds the layer", icon: '<rect x="3" y="7" width="12.5" height="10" rx="2"/><path d="M15.5 11l5-3v8l-5-3z"/>' },
    LGT: { n: "Light", full: "Light", t: "Light", gear: "Light settings: opens After Effects' own Light dialog, adds the layer and remembers its settings", icon: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.2 1 2.1h5c0-.9.3-1.5 1-2.1A6 6 0 0 0 12 3z"/>' },
    ADJ: { n: "Adjust", full: "Adjustment layer", t: "Adjustment layer", icon: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" class="knob"/><circle cx="15" cy="12" r="2" class="knob"/><circle cx="8" cy="17" r="2" class="knob"/>' },
    BOX: { n: "Box", full: "Paragraph text box", t: "Paragraph text box", icon: '<rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="3 2.4"/><path d="M8 9h8M8 12.5h8M8 16h5"/>' },
    CTL: { n: "Control", full: "Controller (3D null)", t: "3D null named Controller", icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>' }
  };
  var GEAR_NAME = { SOL: "Solid", CAM: "Camera", LGT: "Light" };

  var BLOCKS = [
    { k: "curve", n: "Curve editor" },
    { k: "anchor", n: "Anchor & quick buttons" },
    { k: "layers", n: "Quick layer add" }
  ];

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
        var msgEl = $("updateMsg"), msg = typeof data.message === "string" ? data.message.replace(/^\s+|\s+$/g, "").slice(0, 160) : "";
        msgEl.textContent = msg;
        msgEl.hidden = !msg;
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

  function cleanLight(d) {
    if (!d || typeof d !== "object") return null;
    if (d.type !== "parallel" && d.type !== "spot" && d.type !== "point" && d.type !== "ambient") return null;
    function num(v, lo, hi, dflt) { return isNum(v) ? Math.max(lo, Math.min(hi, v)) : dflt; }
    return {
      type: d.type,
      color: hexOk(d.color) ? d.color.toLowerCase() : "#ffffff",
      intensity: num(d.intensity, 0, 10000, 100),
      cone: num(d.cone, 0, 180, 90),
      feather: num(d.feather, 0, 100, 50),
      shadows: !!d.shadows,
      darkness: num(d.darkness, 0, 100, 100),
      diffusion: num(d.diffusion, 0, 500, 0)
    };
  }

  function cleanLayerBtns(d) {
    var order = [], hide = [], i;
    var list = d && d.order instanceof Array ? d.order : [];
    for (i = 0; i < list.length; i++) if (LAYER_DEFS[list[i]] && order.indexOf(list[i]) < 0) order.push(list[i]);
    for (i = 0; i < LAYER_KEYS.length; i++) if (order.indexOf(LAYER_KEYS[i]) < 0) order.push(LAYER_KEYS[i]);
    var hl = d && d.hide instanceof Array ? d.hide : LAYER_OFF;
    for (i = 0; i < hl.length; i++) if (order.indexOf(hl[i]) >= 0 && hide.indexOf(hl[i]) < 0) hide.push(hl[i]);
    if (hide.length >= order.length) hide = [];
    return { order: order, hide: hide };
  }

  function hexOk(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); }

  function pushRecent(t, hex) {
    if (t.recent.indexOf(hex) >= 0) return false;
    t.recent.push(hex);
    while (t.recent.length > RECENT_MAX) t.recent.shift();
    return true;
  }

  function cleanTheme(d) {
    var t = { accent: DEFAULT_ACCENT, base: "graphite", recent: ACCENTS.slice(), glow: 35 };
    if (d && hexOk(d.accent)) t.accent = d.accent.toLowerCase();
    if (d && typeof d.base === "string" && BASES[d.base]) t.base = d.base;
    if (d && typeof d.glow === "number" && isFinite(d.glow)) t.glow = Math.max(0, Math.min(100, Math.round(d.glow)));
    if (d && d.recent instanceof Array) {
      var r = [], i;
      for (i = 0; i < d.recent.length; i++) {
        if (hexOk(d.recent[i])) {
          var v = d.recent[i].toLowerCase();
          if (r.indexOf(v) < 0) r.push(v);
        }
      }
      r = r.slice(-RECENT_MAX);
      for (i = ACCENTS.length - 1; i >= 0 && r.length < RECENT_MAX; i--) if (r.indexOf(ACCENTS[i]) < 0) r.unshift(ACCENTS[i]);
      if (r.length) t.recent = r;
    }
    pushRecent(t, t.accent);
    return t;
  }

  function cleanLayout(d) {
    var order = [], hide = [], i;
    var list = d && d.order instanceof Array ? d.order : [];
    for (i = 0; i < list.length; i++) {
      for (var b = 0; b < BLOCKS.length; b++) {
        if (BLOCKS[b].k === list[i] && order.indexOf(list[i]) < 0) order.push(list[i]);
      }
    }
    for (i = 0; i < BLOCKS.length; i++) if (order.indexOf(BLOCKS[i].k) < 0) order.push(BLOCKS[i].k);
    var hl = d && d.hide instanceof Array ? d.hide : [];
    for (i = 0; i < hl.length; i++) if (order.indexOf(hl[i]) >= 0 && hide.indexOf(hl[i]) < 0) hide.push(hl[i]);
    if (hide.length >= order.length) hide = [];
    return { order: order, hide: hide };
  }

  function cleanSettings(raw) {
    var out = { order: [], open: false, solid: cleanSolid(null), camera: null, theme: cleanTheme(null), layout: cleanLayout(null), keys: true, layerBtns: cleanLayerBtns(null), light: null };
    if (!raw || typeof raw !== "object") { out.theme = cleanTheme(null); out.order = defaultOrder(); return out; }
    out.theme = cleanTheme(raw.theme);
    out.layout = cleanLayout(raw.layout);
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
    out.keys = raw.keys !== false;
    out.layerBtns = cleanLayerBtns(raw.layerBtns);
    out.light = cleanLight(raw.light);
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

  // ---- theme engine: colors live in CSS variables, the graph reads them from T ----
  var T = { bg: "#0a0a0b", dim: "#85858c", accent: DEFAULT_ACCENT, hi: "#4b9bf5", glow: 0.35 };

  function hexToRgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function rgbaOf(h, a) { var c = hexToRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mixHex(h, t) {
    var c = hexToRgb(h), o = "#";
    for (var i = 0; i < 3; i++) o += ("0" + Math.round(c[i] + (255 - c[i]) * t).toString(16)).slice(-2);
    return o;
  }
  function accentHi(h) { return h === DEFAULT_ACCENT ? "#4b9bf5" : mixHex(h, 0.22); }
  function onAccent(h) {
    var c = hexToRgb(h);
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.62 ? "#101011" : "#ffffff";
  }

  function rgbList(h) { return hexToRgb(h).join(","); }

  function computeTheme() {
    var b = BASES[S.theme.base], a = S.theme.accent, hi = accentHi(a);
    var st = document.documentElement.style;
    st.setProperty("--bg", b.bg);
    st.setProperty("--surface", b.surface);
    st.setProperty("--line", b.line);
    st.setProperty("--line-hi", b.lineHi);
    st.setProperty("--press", b.press);
    st.setProperty("--ink", b.ink);
    st.setProperty("--dim", b.dim);
    st.setProperty("--accent", a);
    st.setProperty("--accent-hi", hi);
    st.setProperty("--on-accent", onAccent(a));
    st.setProperty("--bg-rgb", rgbList(b.bg));
    st.setProperty("--surface-rgb", rgbList(b.surface));
    st.setProperty("--accent-rgb", rgbList(a));
    st.setProperty("--hi-rgb", rgbList(hi));
    st.setProperty("--glow", String(S.theme.glow / 100));
    st.setProperty("--glow-amb", String(Math.pow(S.theme.glow / 100, 0.6)));
    T = { bg: b.bg, dim: b.dim, accent: a, hi: hi, glow: S.theme.glow / 100 };
  }
  computeTheme();

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
  var W = 0, H = 0, drag = -1, hot = -1;
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

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var tl = toPx(0, 1), br = toPx(1, 0), pw = br[0] - tl[0], ph = br[1] - tl[1];
    var i, p, a = toPx(0, 0), b = toPx(1, 1);

    // plot surface: dark base with a faint accent wash from the top
    roundRectPath(tl[0], tl[1], pw, ph, 9);
    ctx.fillStyle = T.bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    var wash = ctx.createLinearGradient(0, tl[1], 0, br[1]);
    wash.addColorStop(0, rgbaOf(T.accent, 0.1 * T.glow));
    wash.addColorStop(1, rgbaOf(T.accent, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(tl[0], tl[1], pw, ph);

    // logo: very faint, behind the grid and the curve
    if (logoGray) {
      var size = Math.min(pw, ph) * 0.78;
      var sc = size / 1470;
      ctx.save();
      ctx.translate((tl[0] + br[0]) / 2, (tl[1] + br[1]) / 2);
      ctx.scale(sc, sc);
      ctx.translate(-965, -960);
      ctx.lineJoin = "miter";
      ctx.miterLimit = 4;
      ctx.lineCap = "butt";
      ctx.lineWidth = 72;
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.stroke(logoGray);
      ctx.lineWidth = 70;
      ctx.strokeStyle = rgbaOf(T.accent, 0.06);
      ctx.stroke(logoBlue);
      ctx.restore();
    }

    // grid
    ctx.lineWidth = 1;
    for (i = 1; i < 4; i++) {
      p = toPx(i / 4, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.moveTo(p[0] + 0.5, tl[1]); ctx.lineTo(p[0] + 0.5, br[1]); ctx.stroke();
      p = toPx(0, i / 4);
      ctx.beginPath(); ctx.moveTo(tl[0], p[1] + 0.5); ctx.lineTo(br[0], p[1] + 0.5); ctx.stroke();
    }

    // straight reference line
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    if (ctx.setLineDash) ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);

    var c = state.c;
    var h1 = toPx(c[0], c[1]), h2 = toPx(c[2], c[3]);

    // soft fill under the curve
    var fill = ctx.createLinearGradient(0, tl[1], 0, br[1]);
    fill.addColorStop(0, rgbaOf(T.hi, 0.2 * T.glow));
    fill.addColorStop(1, rgbaOf(T.hi, 0));
    curvePath(a, h1, h2, b);
    ctx.lineTo(b[0], a[1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // handle arms
    ctx.strokeStyle = rgbaOf(T.accent, 0.85);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(h1[0], h1[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(h2[0], h2[1]); ctx.stroke();

    // curve with glow
    ctx.lineCap = "round";
    ctx.strokeStyle = rgbaOf(T.hi, 0.18 * T.glow);
    ctx.lineWidth = 10;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.strokeStyle = rgbaOf(T.hi, 0.45 * T.glow);
    ctx.lineWidth = 4;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.strokeStyle = "#f4f4f6";
    ctx.lineWidth = 1.6;
    curvePath(a, h1, h2, b); ctx.stroke();
    ctx.restore();

    // plot border
    roundRectPath(tl[0] + 0.5, tl[1] + 0.5, pw - 1, ph - 1, 9);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // axis labels
    ctx.font = "9px Segoe UI, sans-serif";
    ctx.fillStyle = T.dim;
    ctx.textAlign = "center";
    for (i = 1; i <= 4; i++) ctx.fillText(i * 25 + "%", toPx(i / 4, 0)[0], H - 6);
    ctx.textAlign = "right";
    for (i = 0; i <= 4; i++) ctx.fillText(i * 25 + "%", PAD_L - 5, toPx(0, i / 4)[1] + 3);

    // end points and handles (a soft halo shows on hover and while dragging)
    dot(a, 4, "#f4f4f6", null);
    dot(b, 4, "#f4f4f6", null);
    var hs = [h1, h2];
    for (i = 0; i < 2; i++) {
      if (hot === i || drag === i) {
        ctx.beginPath();
        ctx.arc(hs[i][0], hs[i][1], 12, 0, Math.PI * 2);
        ctx.fillStyle = rgbaOf(T.hi, 0.2 * T.glow);
        ctx.fill();
      }
      dot(hs[i], 6, T.bg, T.hi);
    }
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
    draw();
  });
  cv.addEventListener("pointermove", function (e) {
    var pos = pointerPos(e);
    if (drag < 0) {
      var nh = nearestHandle(pos);
      cv.style.cursor = nh >= 0 ? "grab" : "default";
      if (nh !== hot) { hot = nh; draw(); }
      return;
    }
    var v = fromPx(pos[0], pos[1]);
    state.c[drag * 2] = round2(clamp(v[0], 0, 1));
    state.c[drag * 2 + 1] = round2(clamp(v[1], 0, 1));
    sync();
  });
  function endDrag() { drag = -1; draw(); }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("pointerleave", function () { if (drag < 0 && hot !== -1) { hot = -1; draw(); } });

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

  function drawThumb(c, k, on) {
    var g = c.getContext("2d"), w = c.width, h = c.height, m = 14;
    function X(x) { return m + x * (w - 2 * m); }
    function Y(y) { return h - m - y * (h - 2 * m); }
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.stroke();
    g.strokeStyle = on ? T.hi : "#d9d9d9"; g.lineWidth = 4; g.lineCap = "round";
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
    tile.title = item.n + (i < 9 ? "  (key " + (i + 1) + ")" : "");

    var c = document.createElement("canvas");
    c.width = 104; c.height = 80;
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = item.n;
    tile.appendChild(c);
    tile.appendChild(name);
    tile._c = c; tile._k = item.c; tile._on = null;

    if (editMode || !item.builtin) {
      var del = document.createElement("button");
      del.className = "del";
      del.innerHTML = '<svg viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9"/></svg>';
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
    tile.addEventListener("pointerdown", function (e) {
      if (!editMode) return;
      gridDrag(e, tile, presetBox, ".ptile", function (from, to) {
        var moved = S.order.splice(from, 1)[0];
        S.order.splice(to, 0, moved);
        persist();
        renderPresets();
      });
    });

    presetBox.appendChild(tile);
    tileEls.push(tile);
  }

  function markSelected() {
    var items = itemsList();
    for (var i = 0; i < tileEls.length; i++) {
      var on = !!(items[i] && sameCurve(items[i].c, state.c));
      tileEls[i].classList[on ? "add" : "remove"]("on");
      if (tileEls[i]._on !== on) { tileEls[i]._on = on; drawThumb(tileEls[i]._c, tileEls[i]._k, on); }
    }
  }

  function refreshThumbs() {
    for (var i = 0; i < tileEls.length; i++) tileEls[i]._on = null;
    markSelected();
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

  // ---- drag to reorder tiles (presets and layer buttons) ----
  // a copy of the tile follows the pointer, the original stays dim, and a bar shows where it will land
  function gridDrag(e, tile, box, sel, onDrop) {
    if (e.button > 0) return;
    if (e.target.closest && e.target.closest(".del, .pen, .rename, .eye")) return;
    e.preventDefault();
    var tiles = Array.prototype.slice.call(box.querySelectorAll(sel));
    var from = tiles.indexOf(tile), pos = from, active = false, ghost = null, bar = null;
    var sx = e.clientX, sy = e.clientY, r0 = tile.getBoundingClientRect();
    var ox = sx - r0.left, oy = sy - r0.top;

    function start() {
      active = true;
      ghost = tile.cloneNode(true);
      var src = tile.querySelectorAll("canvas"), dst = ghost.querySelectorAll("canvas");
      for (var k = 0; k < dst.length; k++) { try { dst[k].getContext("2d").drawImage(src[k], 0, 0); } catch (err) {} }
      ghost.className += " ghost-tile";
      ghost.style.width = r0.width + "px";
      ghost.style.height = r0.height + "px";
      document.body.appendChild(ghost);
      bar = document.createElement("div");
      bar.className = "dropbar";
      box.appendChild(bar);
      tile.classList.add("dragging");
    }

    function move(ev) {
      if (!active) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
        start();
      }
      ghost.style.left = (ev.clientX - ox) + "px";
      ghost.style.top = (ev.clientY - oy) + "px";
      var best = -1, bd = 1e12, bcx = 0, i;
      for (i = 0; i < tiles.length; i++) {
        var r = tiles[i].getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var d = (ev.clientX - cx) * (ev.clientX - cx) + (ev.clientY - cy) * (ev.clientY - cy);
        if (d < bd) { bd = d; best = i; bcx = cx; }
      }
      pos = best + (ev.clientX > bcx ? 1 : 0);
      var tr = tiles[best].getBoundingClientRect(), br = box.getBoundingClientRect();
      var after = pos > best;
      bar.style.left = ((after ? tr.right + 2 : tr.left - 5) - br.left) + "px";
      bar.style.top = (tr.top - br.top) + "px";
      bar.style.height = tr.height + "px";
      bar.style.display = (pos === from || pos === from + 1) ? "none" : "block";
    }

    function end() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      tile.classList.remove("dragging");
      if (active) {
        var to = pos > from ? pos - 1 : pos;
        if (to !== from) onDrop(from, to);
      }
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
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
  applyBtn.title = "Apply curve (Enter)";
  $("resetBtn").title = "Back to the default curve (R)";
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
  function updateSolidIcon() {
    var f = $("solidFill"), b = $("solidBtn");
    if (!f || !b) return;
    f.style.fill = S.solid.hex;
    b.title = "Solid (" + S.solid.hex + "). Use the gear to change it.";
  }

  var layerEdit = false, lastPer = 5;

  function layersPerRow() {
    var w = $("layerRow").parentNode.clientWidth;
    return !w ? 5 : w < 200 ? 3 : w < 250 ? 4 : 5;
  }
  window.addEventListener("resize", function () {
    if (layersPerRow() !== lastPer) renderLayers();
  });
  var EYE_SVG = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  // builds the buttons from S.layerBtns. Normal view: only the ones that are on.
  // Edit mode: all of them, the hidden ones dimmed, so you can drag them around or turn them on and off.
  function renderLayers() {
    var row = $("layerRow"), list = [], i;
    row.innerHTML = "";
    for (i = 0; i < S.layerBtns.order.length; i++) {
      var key = S.layerBtns.order[i];
      if (layerEdit || S.layerBtns.hide.indexOf(key) < 0) list.push(key);
    }
    // a grid of half-columns: every button spans two, so a short last row can be centered exactly
    var per = layersPerRow(), n = list.length, rowsN = Math.ceil(n / per);
    lastPer = per;
    row.className = "layer-row" + (layerEdit ? " edit" : "");
    row.style.gridTemplateColumns = "repeat(" + (per * 2) + ", minmax(0, 1fr))";
    for (i = 0; i < list.length; i++) {
      (function (k, idx) {
        var def = LAYER_DEFS[k], off = S.layerBtns.hide.indexOf(k) >= 0;
        var cell = mk("div", "lcell" + (off ? " off" : ""));
        var r = Math.floor(idx / per), c = idx % per;
        var inRow = (r === rowsN - 1) ? n - r * per : per;
        var shift = n > per ? per - inRow : 0;
        cell.style.gridRow = String(r + 1);
        cell.style.gridColumn = (1 + shift + 2 * c) + " / span 2";
        var btn = mk("button", "lay");
        btn.type = "button";
        btn.setAttribute("data-kind", k);
        btn.title = def.t;
        if (k === "SOL") btn.id = "solidBtn";
        btn.innerHTML = '<svg viewBox="0 0 24 24">' + (k === "SOL" ? def.icon.replace("<rect ", '<rect id="solidFill" ') : def.icon) + "</svg><span>" + def.n + "</span>";
        cell.appendChild(btn);
        if (layerEdit) {
          var eye = mk("button", "eye" + (off ? " off" : ""));
          eye.type = "button";
          eye.title = off ? "Show this button" : "Hide this button";
          eye.setAttribute("aria-label", (off ? "Show " : "Hide ") + def.full);
          eye.innerHTML = EYE_SVG;
          eye.addEventListener("click", function (e) { e.stopPropagation(); toggleLayerBtn(k); });
          cell.appendChild(eye);
          cell.addEventListener("pointerdown", function (e) {
            gridDrag(e, cell, row, ".lcell", function (from, to) {
              var moved = S.layerBtns.order.splice(from, 1)[0];
              S.layerBtns.order.splice(to, 0, moved);
              persist();
              renderLayers();
            });
          });
        } else if (def.gear) {
          var gear = mk("button", "gear");
          gear.type = "button";
          gear.setAttribute("data-kind", k);
          gear.title = def.gear;
          gear.innerHTML = GEAR_SVG;
          cell.appendChild(gear);
        }
        row.appendChild(cell);
      })(list[i], i);
    }
    updateSolidIcon();
  }

  $("layerEditBtn").addEventListener("click", function () {
    layerEdit = !layerEdit;
    $("layerEditBtn").className = "mini" + (layerEdit ? " on" : "");
    $("layerEditTxt").textContent = layerEdit ? "Done" : "Edit";
    renderLayers();
    setStatus(layerEdit ? "Drag a button to move it. Click the eye to hide or show it." : HINT, "");
  });

  function gearAction(kind) {
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
    setStatus("Waiting for the After Effects " + GEAR_NAME[kind] + " dialog...", "");
    callHost("kfLayerDialog", { kind: kind }, function (res) {
      var r = splitReply(res);
      if (r.tag === "OK") {
        try {
          var d = JSON.parse(r.data);
          if (kind === "CAM") S.camera = cleanCamera(d); else S.light = cleanLight(d);
          persist();
        } catch (err) {}
        setStatus(r.msg + " The normal button now uses these settings.", "ok");
      } else {
        setStatus(r.msg, r.tag === "NONE" ? "" : "err");
      }
    });
  }

  $("layerRow").addEventListener("click", function (e) {
    if (layerEdit) return;
    var t = e.target;
    var gear = t.closest && t.closest(".gear");
    if (gear) { gearAction(gear.getAttribute("data-kind")); return; }
    var btn = t.closest && t.closest(".lay");
    if (btn) run("kfAddLayer", { kind: btn.getAttribute("data-kind"), solid: S.solid, camera: S.camera, light: S.light });
  });

  // =====================================================================
  // Keyboard shortcuts (they work while the panel has focus)
  //   Enter apply curve | Ctrl/Cmd+Z undo | Ctrl/Cmd+Shift+Z or Ctrl+Y redo
  //   1-9 load that preset | R reset the curve
  // =====================================================================
  function registerKeys() {
    if (!window.__adobe_cep__ || !window.__adobe_cep__.registerKeyEventsInterest) return;
    var list = [], i;
    if (S.keys) {
      list.push({ keyCode: 13 }, { keyCode: 82 });
      for (i = 49; i <= 57; i++) list.push({ keyCode: i });
      list.push({ keyCode: 90, ctrlKey: true }, { keyCode: 90, ctrlKey: true, shiftKey: true }, { keyCode: 89, ctrlKey: true });
      list.push({ keyCode: 90, metaKey: true }, { keyCode: 90, metaKey: true, shiftKey: true }, { keyCode: 89, metaKey: true });
    }
    try { window.__adobe_cep__.registerKeyEventsInterest(JSON.stringify(list)); } catch (err) {}
  }

  document.addEventListener("keydown", function (e) {
    if (!S.keys) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    var mod = e.ctrlKey || e.metaKey, k = e.keyCode;
    if (mod && (k === 90 || k === 89)) {
      e.preventDefault();
      run(k === 89 || e.shiftKey ? "kfRedo" : "kfUndo", null);
      return;
    }
    if (mod || e.altKey) return;
    var onControl = t && t.closest && t.closest("button, [role=button]");
    if (k === 13 && !onControl) { e.preventDefault(); applyBtn.click(); return; }
    if (k === 82 && !editMode) { e.preventDefault(); $("resetBtn").click(); return; }
    if (k >= 49 && k <= 57 && !editMode) {
      var item = itemsList()[k - 49];
      if (item) { e.preventDefault(); setCurve(item.c.slice()); setStatus(item.n + " loaded. Press Enter to apply.", ""); }
    }
  });

  // =====================================================================
  // Customize: accent color, theme, and where each section sits
  // =====================================================================
  var cfgBtn = $("cfgBtn"), cfgPanel = $("cfgPanel"), dock = $("dock");
  var cfgColor = $("cfgColor"), cfgHex = $("cfgHex");
  var GRIP = '<svg viewBox="0 0 12 16"><circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/><circle cx="3" cy="8" r="1.4"/><circle cx="9" cy="8" r="1.4"/><circle cx="3" cy="13" r="1.4"/><circle cx="9" cy="13" r="1.4"/></svg>';

  function mk(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function applyLayout() {
    var first = true;
    for (var i = 0; i < S.layout.order.length; i++) {
      var k = S.layout.order[i];
      var blk = dock.querySelector('[data-blk="' + k + '"]');
      if (!blk) continue;
      dock.appendChild(blk);
      var hid = S.layout.hide.indexOf(k) >= 0;
      blk.hidden = hid;
      blk.classList.remove("sep");
      if (!hid) {
        if (!first) blk.classList.add("sep");
        first = false;
      }
    }
  }

  function themeChanged() {
    persist();
    computeTheme();
    draw();
    refreshThumbs();
    renderSettings();
  }

  function layoutChanged() {
    persist();
    applyLayout();
    renderSettings();
    resize();
  }

  function moveBlock(k, dir) {
    var o = S.layout.order, i = o.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return false;
    o.splice(i, 1);
    o.splice(j, 0, k);
    layoutChanged();
    return true;
  }

  function toggleBlock(k) {
    var h = S.layout.hide, i = h.indexOf(k);
    if (i >= 0) h.splice(i, 1);
    else {
      if (h.length >= S.layout.order.length - 1) { setStatus("Keep at least one section visible.", "err"); return; }
      h.push(k);
    }
    layoutChanged();
  }

  function blockName(k) {
    for (var i = 0; i < BLOCKS.length; i++) if (BLOCKS[i].k === k) return BLOCKS[i].n;
    return k;
  }

  // drag a row by its grip; the rows move live, the order is saved on release
  function startRowDrag(e, row, done) {
    if (e.button > 0) return;
    e.preventDefault();
    var list = row.parentNode, ghost = null;
    var rc = row.getBoundingClientRect(), oy = e.clientY - rc.top;
    function move(ev) {
      if (!ghost) {
        ghost = row.cloneNode(true);
        ghost.className += " ghost-row";
        ghost.style.width = rc.width + "px";
        ghost.style.left = rc.left + "px";
        document.body.appendChild(ghost);
        row.classList.add("drag");
      }
      ghost.style.top = (ev.clientY - oy) + "px";
      var before = null, kids = list.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] === row) continue;
        var r = kids[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { before = kids[i]; break; }
      }
      if (before !== row.nextSibling) list.insertBefore(row, before);
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      row.classList.remove("drag");
      var order = [], kids = list.children;
      for (var i = 0; i < kids.length; i++) order.push(kids[i].getAttribute("data-k"));
      done(order);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  function layersChanged() {
    persist();
    renderLayers();
  }

  function toggleLayerBtn(k) {
    var h = S.layerBtns.hide, i = h.indexOf(k);
    if (i >= 0) h.splice(i, 1);
    else {
      if (h.length >= S.layerBtns.order.length - 1) { setStatus("Keep at least one layer button on.", "err"); return; }
      h.push(k);
    }
    layersChanged();
  }

  function renderSettings() {
    var i, box;

    box = $("swatches");
    box.innerHTML = "";
    for (i = 0; i < S.theme.recent.length; i++) {
      (function (hex) {
        var sw = mk("button", "sw" + (S.theme.accent === hex ? " on" : ""));
        sw.type = "button";
        sw.style.background = hex;
        sw.title = hex;
        sw.addEventListener("click", function () { S.theme.accent = hex; themeChanged(); });
        box.appendChild(sw);
      })(S.theme.recent[i]);
    }
    cfgColor.value = S.theme.accent;
    if (document.activeElement !== cfgHex) cfgHex.value = S.theme.accent;

    box = $("bases");
    box.innerHTML = "";
    for (i = 0; i < BASE_KEYS.length; i++) {
      (function (key) {
        var base = BASES[key];
        var b = mk("button", "base" + (S.theme.base === key ? " on" : ""));
        b.type = "button";
        var prev = mk("span", "bprev");
        prev.style.background = base.bg;
        prev.style.borderColor = base.lineHi;
        var bar = mk("i");
        bar.style.background = base.surface;
        bar.style.borderColor = base.line;
        var dot = mk("b");
        dot.style.background = S.theme.accent;
        prev.appendChild(bar);
        prev.appendChild(dot);
        var nm = mk("span", "bname");
        nm.textContent = base.n;
        b.appendChild(prev);
        b.appendChild(nm);
        b.addEventListener("click", function () { S.theme.base = key; themeChanged(); });
        box.appendChild(b);
      })(BASE_KEYS[i]);
    }

    box = $("layoutList");
    box.innerHTML = "";
    for (i = 0; i < S.layout.order.length; i++) {
      (function (k) {
        var hid = S.layout.hide.indexOf(k) >= 0;
        var row = mk("div", "lrow" + (hid ? " off" : ""));
        row.setAttribute("data-k", k);
        var grip = mk("span", "grip");
        grip.innerHTML = GRIP;
        grip.title = "Drag to reorder (or use the up and down arrow keys)";
        grip.setAttribute("tabindex", "0");
        grip.addEventListener("pointerdown", function (e) {
          startRowDrag(e, row, function (order) {
            S.layout.order = cleanLayout({ order: order, hide: S.layout.hide }).order;
            layoutChanged();
          });
        });
        grip.addEventListener("keydown", function (e) {
          var dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          if (!dir) return;
          e.preventDefault();
          if (moveBlock(k, dir)) {
            var g = box.querySelector('[data-k="' + k + '"] .grip');
            if (g) g.focus();
          }
        });
        var nm = mk("span", "nm");
        nm.textContent = blockName(k);
        var tg = mk("button", "tgl" + (hid ? "" : " on"));
        tg.type = "button";
        tg.setAttribute("role", "switch");
        tg.setAttribute("aria-checked", hid ? "false" : "true");
        tg.setAttribute("aria-label", "Show " + blockName(k));
        tg.innerHTML = "<i></i>";
        tg.addEventListener("click", function () { toggleBlock(k); });
        row.appendChild(grip);
        row.appendChild(nm);
        row.appendChild(tg);
        box.appendChild(row);
      })(S.layout.order[i]);
    }

    $("cfgGlow").value = S.theme.glow;
    $("cfgGlow").style.setProperty("--pn", String(S.theme.glow / 100));
    $("glowOut").textContent = S.theme.glow + "%";
    var kt = $("keysTgl");
    kt.className = "tgl" + (S.keys ? " on" : "");
    kt.setAttribute("aria-checked", S.keys ? "true" : "false");
  }

  function setCfgOpen(open) {
    cfgPanel.hidden = !open;
    cfgBtn.className = "cfg" + (open ? " on" : "");
    if (open) renderSettings();
    resize();
  }
  cfgBtn.addEventListener("click", function () { setCfgOpen(cfgPanel.hidden); });
  $("cfgDone").addEventListener("click", function () { setCfgOpen(false); });

  // the color box previews live; the color joins the recent circles when you let go
  cfgColor.addEventListener("input", function () {
    S.theme.accent = cfgColor.value.toLowerCase();
    computeTheme();
    draw();
    refreshThumbs();
    renderSettings();
  });
  cfgColor.addEventListener("change", function () {
    pushRecent(S.theme, S.theme.accent);
    themeChanged();
  });

  function commitHex() {
    var v = cfgHex.value.replace(/\s+/g, "");
    if (v.charAt(0) !== "#") v = "#" + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) v = "#" + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2) + v.charAt(3) + v.charAt(3);
    if (hexOk(v)) {
      S.theme.accent = v.toLowerCase();
      pushRecent(S.theme, S.theme.accent);
      themeChanged();
    } else cfgHex.value = S.theme.accent;
  }
  cfgHex.addEventListener("change", commitHex);
  cfgHex.addEventListener("keydown", function (e) { if (e.key === "Enter") commitHex(); });

  var cfgGlow = $("cfgGlow");
  cfgGlow.addEventListener("input", function () {
    S.theme.glow = parseInt(cfgGlow.value, 10) || 0;
    cfgGlow.style.setProperty("--pn", String(S.theme.glow / 100));
    computeTheme();
    draw();
    $("glowOut").textContent = S.theme.glow + "%";
  });
  cfgGlow.addEventListener("change", function () { persist(); });

  $("keysTgl").addEventListener("click", function () {
    S.keys = !S.keys;
    persist();
    registerKeys();
    renderSettings();
    setStatus(S.keys ? "Keyboard shortcuts are on." : "Keyboard shortcuts are off.", "ok");
  });

  $("cfgReset").addEventListener("click", function () {
    S.theme = cleanTheme(null);
    S.layout = cleanLayout(null);
    S.layerBtns = cleanLayerBtns(null);
    persist();
    computeTheme();
    renderLayers();
    applyLayout();
    refreshThumbs();
    renderSettings();
    resize();
    setStatus("Colors and layout are back to default.", "ok");
  });

  $("ver").textContent = "MultiTool v" + INSTALLED_VERSION;

  // =====================================================================
  // Start up
  // =====================================================================
  window.addEventListener("resize", resize);
  renderPresets();
  updateSolidIcon();
  renderLayers();
  applyLayout();
  renderSettings();
  registerKeys();
  resize();
  checkForUpdate();

  // the copy kept inside After Effects wins over the panel's own backup
  callHost("kfLoadSettings", null, function (res) {
    res = String(res);
    if (res.indexOf("OK|") !== 0) return;
    try {
      S = cleanSettings(JSON.parse(res.slice(3)));
      computeTheme();
      renderPresets();
      updateSolidIcon();
      renderLayers();
      applyLayout();
      renderSettings();
      registerKeys();
      resize();
    } catch (e) {}
  });
})();
