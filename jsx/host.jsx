// MultiTool - After Effects host script (ExtendScript)
// Talks to the panel. Every function returns "OK|message" or "ERR|message".

var KF_UNDO = "MultiTool: ";
var KF_SOLID_DIALOG = null;

function kfClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function kfComp() {
    var c = app.project.activeItem;
    return (c instanceof CompItem) ? c : null;
}

function kfPlural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

// ---------- keyframe curve ----------

function kfCollect(group, out) {
    if (!group) return;
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (!p) continue;
        if (p.propertyType === PropertyType.PROPERTY) {
            try { if (p.selectedKeys && p.selectedKeys.length > 0) out.push(p); } catch (e) {}
        } else {
            try { kfCollect(p, out); } catch (e2) {}
        }
    }
}

function kfSegments(prop) {
    var sel = prop.selectedKeys.slice(0).sort(function (a, b) { return a - b; });
    var has = {}, i, segs = [];
    for (i = 0; i < sel.length; i++) has[sel[i]] = true;
    if (sel.length === 1) {
        if (sel[0] < prop.numKeys) segs.push([sel[0], sel[0] + 1]);
        return segs;
    }
    for (i = 0; i < sel.length; i++) {
        if (has[sel[i] + 1]) segs.push([sel[i], sel[i] + 1]);
    }
    return segs;
}

// Returns 1 if the segment was eased, 0 if not
function kfEaseSegment(prop, k1, k2, c) {
    var t0 = prop.keyTime(k1), t1 = prop.keyTime(k2), dT = t1 - t0;
    if (dT <= 0) return 0;

    var x1 = c[0], y1 = c[1], x2 = c[2], y2 = c[3];
    var straight = Math.abs(y1 - x1) < 0.000001 && Math.abs(y2 - x2) < 0.000001;
    if (straight) {
        prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), KeyframeInterpolationType.LINEAR);
        prop.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.LINEAR, prop.keyOutInterpolationType(k2));
        return 1;
    }

    var v0 = prop.keyValue(k1), v1 = prop.keyValue(k2);
    var n = prop.keyInTemporalEase(k1).length;
    var isArr = (v0 instanceof Array);
    var avg = [], d;
    if (n === 1 && isArr) {
        var sum = 0;
        for (d = 0; d < v0.length; d++) sum += Math.pow(v1[d] - v0[d], 2);
        avg.push(Math.sqrt(sum) / dT);
    } else if (n === 1) {
        avg.push((v1 - v0) / dT);
    } else {
        for (d = 0; d < n; d++) avg.push((v1[d] - v0[d]) / dT);
    }

    var inf1 = kfClamp(x1 * 100, 0.1, 100);
    var inf2 = kfClamp((1 - x2) * 100, 0.1, 100);
    var outRatio = y1 / Math.max(x1, 0.001);
    var inRatio = (1 - y2) / Math.max(1 - x2, 0.001);

    var outNew = [], inNew = [];
    for (d = 0; d < n; d++) {
        outNew.push(new KeyframeEase(outRatio * avg[d], inf1));
        inNew.push(new KeyframeEase(inRatio * avg[d], inf2));
    }

    var inEase1 = prop.keyInTemporalEase(k1);
    var outEase2 = prop.keyOutTemporalEase(k2);
    var B = KeyframeInterpolationType.BEZIER;

    prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), B);
    prop.setInterpolationTypeAtKey(k2, B, prop.keyOutInterpolationType(k2));
    try {
        prop.setTemporalEaseAtKey(k1, inEase1, outNew);
    } catch (e) {
        prop.setInterpolationTypeAtKey(k1, B, B);
        prop.setTemporalEaseAtKey(k1, inEase1, outNew);
    }
    try {
        prop.setTemporalEaseAtKey(k2, inNew, outEase2);
    } catch (e2) {
        prop.setInterpolationTypeAtKey(k2, B, B);
        prop.setTemporalEaseAtKey(k2, inNew, outEase2);
    }
    return 1;
}

// o = {x1,y1,x2,y2}
function kfApply(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var props = [], l;
    for (l = 0; l < comp.selectedLayers.length; l++) kfCollect(comp.selectedLayers[l], props);
    if (!props.length) return "ERR|Select two or more keyframes in the timeline first.";

    var c = [kfClamp(o.x1, 0, 1), kfClamp(o.y1, 0, 1), kfClamp(o.x2, 0, 1), kfClamp(o.y2, 0, 1)], segs = 0, fail = 0, firstErr = "";
    app.beginUndoGroup(KF_UNDO + (o.paste ? "Paste ease" : "Apply curve"));
    try {
        for (var i = 0; i < props.length; i++) {
            var list = kfSegments(props[i]);
            for (var s = 0; s < list.length; s++) {
                try {
                    if (kfEaseSegment(props[i], list[s][0], list[s][1], c)) segs++;
                } catch (err) {
                    fail++;
                    if (!firstErr) firstErr = String(err);
                }
            }
        }
    } finally {
        app.endUndoGroup();
    }
    if (segs === 0) return "ERR|Nothing eased. Select at least two keyframes on a property." + (firstErr ? " (" + firstErr + ")" : "");
    var msg = (o.paste ? "Pasted the ease on " : "Eased ") + kfPlural(segs, "segment") + ".";
    if (fail) msg += " " + fail + " could not be changed: " + firstErr;
    return "OK|" + msg;
}

// ---------- copy an ease from keyframes ----------
// Reads the ease between two keyframes and turns it back into the 4 numbers of the curve
// (the exact reverse of kfEaseSegment). Returns {c:[x1,y1,x2,y2], clipped:bool} or {err:"..."}.
function kfReadSegment(prop, k1, k2) {
    var dT = prop.keyTime(k2) - prop.keyTime(k1);
    if (dT <= 0) return { err: "Those two keyframes are at the same time." };
    var LIN = KeyframeInterpolationType.LINEAR, HOLD = KeyframeInterpolationType.HOLD;
    var oType = prop.keyOutInterpolationType(k1), iType = prop.keyInInterpolationType(k2);
    if (oType === HOLD || iType === HOLD) return { err: "Hold keyframes have no curve to copy." };

    var outE = prop.keyOutTemporalEase(k1), inE = prop.keyInTemporalEase(k2);
    var n = Math.min(outE.length, inE.length), v0 = prop.keyValue(k1), v1 = prop.keyValue(k2);
    var isArr = (v0 instanceof Array), avg = [], d;
    if (n === 1 && isArr) {
        var sum = 0;
        for (d = 0; d < v0.length; d++) sum += Math.pow(v1[d] - v0[d], 2);
        avg.push(Math.sqrt(sum) / dT);
    } else if (n === 1) {
        avg.push((v1 - v0) / dT);
    } else {
        for (d = 0; d < n; d++) avg.push((v1[d] - v0[d]) / dT);
    }
    var best = 0;
    for (d = 1; d < avg.length; d++) if (Math.abs(avg[d]) > Math.abs(avg[best])) best = d;
    if (!(Math.abs(avg[best]) > 0.000000001)) return { err: "These keyframes have the same value, so there is no ease to read. Pick two keyframes where the value changes." };

    var x1, y1, x2, y2, inf;
    if (oType === LIN) { x1 = 1 / 3; y1 = 1 / 3; }
    else { x1 = outE[best].influence / 100; y1 = (outE[best].speed / avg[best]) * x1; }
    if (iType === LIN) { x2 = 2 / 3; y2 = 2 / 3; }
    else { inf = inE[best].influence / 100; x2 = 1 - inf; y2 = 1 - (inE[best].speed / avg[best]) * inf; }

    var raw = [x1, y1, x2, y2], c = [], clipped = false;
    for (d = 0; d < 4; d++) {
        if (!(raw[d] === raw[d]) || Math.abs(raw[d]) === Infinity) return { err: "Could not read the ease on these keyframes." };
        if (raw[d] < -0.005 || raw[d] > 1.005) clipped = true;
        c.push(Math.round(kfClamp(raw[d], 0, 1) * 100) / 100);
    }
    return { c: c, clipped: clipped };
}

// Copies the ease of the first selected keyframe pair. Returns "OK|message|[x1,y1,x2,y2]".
function kfCopy() {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var props = [], l, i, s, firstErr = "";
    for (l = 0; l < comp.selectedLayers.length; l++) kfCollect(comp.selectedLayers[l], props);
    if (!props.length) return "ERR|Select the keyframes you want to copy the ease from (two or more) first.";
    for (i = 0; i < props.length; i++) {
        var list = kfSegments(props[i]);
        for (s = 0; s < list.length; s++) {
            try {
                var r = kfReadSegment(props[i], list[s][0], list[s][1]);
                if (r.err) { if (!firstErr) firstErr = r.err; continue; }
                var msg = "Copied the ease from " + props[i].name + (r.clipped ? " (overshoot was cut to fit the graph)." : ".");
                return "OK|" + msg + "|[" + r.c.join(",") + "]";
            } catch (err) {
                if (!firstErr) firstErr = String(err);
            }
        }
    }
    return "ERR|" + (firstErr || "Select two or more keyframes on a property first.");
}

// ---------- transform helpers (anchor, flips, center) ----------

function kfVec(v) {
    if (v instanceof Array) return [v[0], v.length > 1 ? v[1] : 0, v.length > 2 ? v[2] : 0];
    return [v, 0, 0];
}

function kfRot(v, axis, deg) {
    if (!deg) return v;
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), x = v[0], y = v[1], z = v[2];
    if (axis === 0) return [x, y * c - z * s, y * s + z * c];
    if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
    return [x * c - y * s, x * s + y * c, z];
}

function kfProp(tr, name) {
    try { return tr.property(name); } catch (e) { return null; }
}

function kfAt(prop, t) { return prop ? prop.valueAtTime(t, false) : null; }

// Where an offset from the anchor point lands in the parent's space:
// scale first, then orientation, then X, Y, Z rotation (After Effects' own order).
function kfMap(layer, t, d) {
    var tr = layer.property("ADBE Transform Group");
    var s = kfAt(kfProp(tr, "ADBE Scale"), t) || [100, 100, 100];
    var v = [d[0] * s[0] / 100, d[1] * s[1] / 100, d[2] * (s.length > 2 ? s[2] : 100) / 100];
    if (layer.threeDLayer) {
        var o = kfAt(kfProp(tr, "ADBE Orientation"), t);
        if (o) { v = kfRot(v, 0, o[0]); v = kfRot(v, 1, o[1]); v = kfRot(v, 2, o[2]); }
        var rx = kfAt(kfProp(tr, "ADBE Rotate X"), t);
        var ry = kfAt(kfProp(tr, "ADBE Rotate Y"), t);
        if (rx) v = kfRot(v, 0, rx);
        if (ry) v = kfRot(v, 1, ry);
    }
    var rz = kfAt(kfProp(tr, "ADBE Rotate Z"), t);
    if (rz) v = kfRot(v, 2, rz);
    return v;
}

function kfPositionAt(tr, layer, t) {
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        var p = [tr.property("ADBE Position_0").valueAtTime(t, false), tr.property("ADBE Position_1").valueAtTime(t, false), 0];
        if (layer.threeDLayer) p[2] = tr.property("ADBE Position_2").valueAtTime(t, false);
        return p;
    }
    return kfVec(pos.valueAtTime(t, false));
}

function kfAdd(v, d, axis) {
    if (axis >= 0) return v + d[axis];
    var out = [], i;
    for (i = 0; i < v.length; i++) out.push(v[i] + d[i]);
    return out;
}

function kfShiftProp(p, axis, t, deltaAt) {
    var n = p.numKeys, k;
    if (n > 0) {
        for (k = 1; k <= n; k++) p.setValueAtKey(k, kfAdd(p.keyValue(k), deltaAt(p.keyTime(k)), axis));
    } else {
        p.setValue(kfAdd(p.value, deltaAt(t), axis));
    }
}

// Moves the layer's position by deltaAt(time) (a 3-number offset in parent space).
// Works when Position is plain, keyframed, or split into X / Y / Z.
function kfShift(tr, layer, t, deltaAt) {
    var pos = tr.property("ADBE Position");
    if (pos.dimensionsSeparated) {
        kfShiftProp(tr.property("ADBE Position_0"), 0, t, deltaAt);
        kfShiftProp(tr.property("ADBE Position_1"), 1, t, deltaAt);
        if (layer.threeDLayer) kfShiftProp(tr.property("ADBE Position_2"), 2, t, deltaAt);
    } else {
        kfShiftProp(pos, -1, t, deltaAt);
    }
}

function kfLocked(tr, layer) {
    var pos = tr.property("ADBE Position");
    var names = ["ADBE Anchor Point", "ADBE Scale", "ADBE Rotate Z", "ADBE Rotate X", "ADBE Rotate Y", "ADBE Orientation"];
    var i, p;
    if (pos.dimensionsSeparated) {
        if (tr.property("ADBE Position_0").expressionEnabled || tr.property("ADBE Position_1").expressionEnabled) return true;
        if (layer.threeDLayer && tr.property("ADBE Position_2").expressionEnabled) return true;
    } else if (pos.expressionEnabled) {
        return true;
    }
    for (i = 0; i < names.length; i++) {
        p = kfProp(tr, names[i]);
        if (p && p.expressionEnabled) return true;
    }
    return false;
}

function kfRotScaleAnimated(tr) {
    var names = ["ADBE Scale", "ADBE Rotate Z", "ADBE Rotate X", "ADBE Rotate Y", "ADBE Orientation"];
    for (var i = 0; i < names.length; i++) {
        var p = kfProp(tr, names[i]);
        if (p && p.numKeys > 0) return true;
    }
    return false;
}

function kfBounds(layer, time) {
    var rect;
    try {
        rect = layer.sourceRectAtTime(time, false);
        if (rect && rect.width >= 0 && rect.height >= 0) return rect;
    } catch (e) {}
    try { return { left: 0, top: 0, width: layer.width, height: layer.height }; } catch (e2) {}
    return null;
}

// ---------- anchor point ----------

// o = {x: 0..1, y: 0..1}
function kfAnchor(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var sel = comp.selectedLayers;
    if (!sel || !sel.length) return "ERR|Select one or more layers first.";

    var t = comp.time, done = 0, skipped = 0, skippedAnchor = 0, approx = 0;
    app.beginUndoGroup(KF_UNDO + "Anchor point");
    try {
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            try {
                var tr = layer.property("ADBE Transform Group");
                var anchor = tr.property("ADBE Anchor Point");
                if (!anchor || !tr.property("ADBE Position")) { skipped++; continue; }
                if (anchor.numKeys > 0) { skippedAnchor++; continue; }
                if (kfLocked(tr, layer)) { skipped++; continue; }
                var b = kfBounds(layer, t);
                if (!b || b.width === 0 || b.height === 0) { skipped++; continue; }

                var oldA = kfVec(anchor.value);
                var newA = [b.left + b.width * o.x, b.top + b.height * o.y, oldA[2]];
                var dA = [newA[0] - oldA[0], newA[1] - oldA[1], 0];

                kfShift(tr, layer, t, function (tt) { return kfMap(layer, tt, dA); });
                anchor.setValue(layer.threeDLayer ? newA : [newA[0], newA[1]]);
                if (kfRotScaleAnimated(tr)) approx++;
                done++;
            } catch (err) { skipped++; }
        }
    } finally {
        app.endUndoGroup();
    }
    var msg = "Anchor moved on " + kfPlural(done, "layer") + ".";
    if (skippedAnchor) msg += " Skipped " + kfPlural(skippedAnchor, "layer") + " whose anchor point is animated.";
    if (skipped) msg += " Skipped " + kfPlural(skipped, "layer") + " (cameras, lights, expressions or locked layers).";
    if (approx) msg += " Scale or rotation is animated on " + kfPlural(approx, "layer") + ", so check the in-between frames.";
    return (done ? "OK|" : "ERR|") + msg;
}

// ---------- flips ----------

function kfNegate(scale, axis) {
    var n = scale.numKeys, k, v;
    if (n > 0) {
        for (k = 1; k <= n; k++) {
            v = scale.keyValue(k);
            v[axis] = -v[axis];
            scale.setValueAtKey(k, v);
        }
    } else {
        v = scale.value;
        v[axis] = -v[axis];
        scale.setValue(v);
    }
}

// o = {axis: "x" | "y"}. Flips each layer in place around its own visual center.
function kfFlip(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var sel = comp.selectedLayers;
    if (!sel || !sel.length) return "ERR|Select one or more layers first.";

    var axis = (o && o.axis === "y") ? 1 : 0;
    var t = comp.time, done = 0, skipped = 0, approx = 0;
    app.beginUndoGroup(KF_UNDO + (axis === 0 ? "Flip horizontal" : "Flip vertical"));
    try {
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            try {
                var tr = layer.property("ADBE Transform Group");
                var scale = tr.property("ADBE Scale"), anchor = tr.property("ADBE Anchor Point");
                if (!scale || !anchor || !tr.property("ADBE Position")) { skipped++; continue; }
                if (kfLocked(tr, layer)) { skipped++; continue; }
                var b = kfBounds(layer, t);
                if (!b) { skipped++; continue; }

                var a = kfVec(anchor.valueAtTime(t, false));
                var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
                var off = axis === 0 ? [2 * (cx - a[0]), 0, 0] : [0, 2 * (cy - a[1]), 0];

                // move first (uses the scale from before the flip), then flip the scale
                kfShift(tr, layer, t, function (tt) { return kfMap(layer, tt, off); });
                kfNegate(scale, axis);
                if (kfRotScaleAnimated(tr)) approx++;
                done++;
            } catch (err) { skipped++; }
        }
    } finally {
        app.endUndoGroup();
    }
    var msg = "Flipped " + kfPlural(done, "layer") + (axis === 0 ? " horizontally." : " vertically.");
    if (skipped) msg += " Skipped " + kfPlural(skipped, "layer") + " (cameras, lights, expressions or locked layers).";
    if (approx) msg += " Scale or rotation is animated on " + kfPlural(approx, "layer") + ", so check the in-between frames.";
    return (done ? "OK|" : "ERR|") + msg;
}

// ---------- add layer ----------

function kfRgb(hex) {
    var h = String(hex || "#000000").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = "000000";
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
}

function kfHex(rgb) {
    var out = "#", i, v, h;
    for (i = 0; i < 3; i++) {
        v = Math.max(0, Math.min(255, Math.round(rgb[i] * 255)));
        h = v.toString(16);
        out += (h.length < 2 ? "0" : "") + h;
    }
    return out;
}

function kfNum(v) { return (typeof v === "number" && isFinite(v)) ? String(v) : "0"; }

// Applies the camera choices saved from the last time the camera dialog was used.
function kfApplyCamera(layer, comp, c) {
    if (!c) return;
    try { if (c.one) layer.autoOrient = AutoOrientType.NO_AUTO_ORIENT; } catch (e) {}
    var og = null;
    try { og = layer.property("ADBE Camera Options Group"); } catch (e2) {}
    if (!og) return;
    function setp(name, val) {
        try { var p = og.property(name); if (p && isFinite(val)) p.setValue(val); } catch (e3) {}
    }
    var zoom = c.zoom * comp.width;
    setp("ADBE Camera Zoom", zoom);
    try {
        var pos = layer.property("ADBE Transform Group").property("ADBE Position");
        var pv = pos.value;
        pv[2] = -zoom;
        pos.setValue(pv);
    } catch (e4) {}
    setp("ADBE Camera Depth of Field", c.dof ? 1 : 0);
    if (c.dof) {
        setp("ADBE Camera Focus Distance", c.focus * comp.width);
        setp("ADBE Camera Aperture", c.aperture * comp.width);
        setp("ADBE Camera Blur Level", c.blur);
    }
}

// o = {kind: NUL TXT SOL SHP CAM ADJ, solid: {hex, comp, w, h}, camera: {...}}
function kfAddLayer(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var kind = o && o.kind;
    app.beginUndoGroup(KF_UNDO + "Add " + kind);
    try {
        var old = comp.selectedLayers, j, layer;
        for (j = 0; j < old.length; j++) old[j].selected = false;

        if (kind === "NUL") { layer = comp.layers.addNull(); layer.name = "Null"; }
        else if (kind === "TXT") { layer = comp.layers.addText("Text"); }
        else if (kind === "SOL") {
            var s = o.solid || {};
            var w = (s.comp === false && s.w > 0) ? s.w : comp.width;
            var h = (s.comp === false && s.h > 0) ? s.h : comp.height;
            layer = comp.layers.addSolid(kfRgb(s.hex), "Solid", w, h, comp.pixelAspect, comp.duration);
        }
        else if (kind === "SHP") { layer = comp.layers.addShape(); layer.name = "Shape Layer"; }
        else if (kind === "CAM") {
            layer = comp.layers.addCamera("Camera", [comp.width / 2, comp.height / 2]);
            kfApplyCamera(layer, comp, o.camera);
        }
        else if (kind === "ADJ") {
            layer = comp.layers.addSolid([1, 1, 1], "Adjustment Layer", comp.width, comp.height, comp.pixelAspect, comp.duration);
            layer.adjustmentLayer = true;
        }
        if (layer) layer.selected = true;
        return "OK|Added " + (layer ? layer.name : kind) + ".";
    } catch (err) {
        return "ERR|Could not add that layer: " + err;
    } finally {
        app.endUndoGroup();
    }
}

// o = {solid: {hex, comp, w, h}}. Opens After Effects' own color picker, then adds the
// solid straight into the active comp using the chosen color. Returns "OK|msg|json".
function kfSolidPick(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var s = (o && o.solid) || {};
    var rgb = kfRgb(s.hex);
    var initial = (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);
    var picked = $.colorPicker(initial);
    if (picked < 0) return "NONE|Color picker cancelled, no solid added.";
    var hex = kfHex([((picked >> 16) & 255) / 255, ((picked >> 8) & 255) / 255, (picked & 255) / 255]);
    var res = kfAddLayer({ kind: "SOL", solid: { hex: hex, comp: s.comp, w: s.w, h: s.h } });
    if (res.indexOf("OK|") !== 0) return res;
    var json = '{"hex":"' + hex + '","w":' + kfNum(s.w) + ',"h":' + kfNum(s.h) + ',"comp":' + (s.comp === false ? "false" : "true") + "}";
    return res + "|" + json;
}

// ---- native Solid Settings dialog (the gear) ----
// Opens After Effects' own Solid Settings dialog and waits for it to close. Then it works out
// exactly which solid the dialog made (by comparing project item ids from before and after),
// makes sure that solid is a layer in the active comp with the right color, and returns its
// settings as "OK|message|json" so the panel can remember them.
function kfIsSolidItem(item) {
    try { return (item instanceof FootageItem) && (item.mainSource instanceof SolidSource); } catch (e) { return false; }
}

function kfSolidNative(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var cmd = 0;
    try { cmd = app.findMenuCommandId("Solid..."); } catch (e) {}
    if (!cmd) return kfSolidPick(o);   // other language: fall back to the color picker

    var i, ids = {}, itemsBefore = app.project.numItems, layersBefore = comp.numLayers;
    for (i = 1; i <= app.project.numItems; i++) { try { ids[app.project.item(i).id] = true; } catch (e1) {} }

    try { app.executeCommand(cmd); }
    catch (err) { return "ERR|Could not open Solid Settings: " + err; }

    // which solids are new since before the dialog opened?
    var fresh = [], newest = null, it;
    for (i = 1; i <= app.project.numItems; i++) {
        try {
            it = app.project.item(i);
            if (!ids[it.id] && kfIsSolidItem(it)) { fresh.push(it); if (!newest || it.id > newest.id) newest = it; }
        } catch (e2) {}
    }
    var layersAfter = comp.numLayers;
    if (!newest && layersAfter <= layersBefore) return "NONE|Solid Settings closed without creating a solid.";

    var layer = null, sel = comp.selectedLayers;
    app.beginUndoGroup(KF_UNDO + "Solid");
    try {
        // is the intended solid already a layer in this comp?
        if (newest) {
            for (i = 1; i <= comp.numLayers; i++) {
                try { if (comp.layer(i).source && comp.layer(i).source.id === newest.id) { layer = comp.layer(i); break; } } catch (e3) {}
            }
        }
        if (newest && !layer) {
            if (layersAfter > layersBefore && sel.length && sel[0].source && kfIsSolidItem(sel[0].source)) {
                // After Effects added a layer, but it points at a different (wrong color) solid: repoint it
                layer = sel[0];
                layer.replaceSource(newest, false);
            } else {
                // the solid only reached the Project panel: put it in the comp
                for (i = 0; i < sel.length; i++) { try { sel[i].selected = false; } catch (e4) {} }
                layer = comp.layers.add(newest);
            }
        }
        if (!newest && sel.length) layer = sel[0];
        if (!layer) return "ERR|The solid was made but I could not find it in the composition (items " + itemsBefore + " > " + app.project.numItems + ", layers " + layersBefore + " > " + layersAfter + ").";
        try { layer.selected = true; } catch (e5) {}

        // tidy: remove stray unused solids the dialog made along the way
        for (i = 0; i < fresh.length; i++) {
            try { if (fresh[i].id !== layer.source.id && fresh[i].usedIn.length === 0) fresh[i].remove(); } catch (e6) {}
        }
    } finally {
        app.endUndoGroup();
    }

    var json = "";
    try {
        var src = layer.source, col = src.mainSource.color;
        json = '{"hex":"' + kfHex(col) + '","w":' + kfNum(src.width) + ',"h":' + kfNum(src.height) +
               ',"comp":' + ((src.width === comp.width && src.height === comp.height) ? "true" : "false") + "}";
    } catch (e7) {}
    if (!json) return "ERR|The solid was added, but its color could not be read.";
    return "OK|Added " + layer.name + " to the composition.|" + json;
}

// o = {kind: "SOL" | "CAM"}. The native Solid Settings dialog creates the
// layer itself. The panel polls after the dialog closes, then saves that layer's settings.
function kfLayerDialog(o) {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var isCam = (o && o.kind === "CAM");
    var id = 0;
    try { id = app.findMenuCommandId(isCam ? "Camera..." : "Solid..."); } catch (e) {}
    if (!id) return "ERR|Could not find After Effects' " + (isCam ? "Camera" : "Solid") + " dialog (its menu name depends on the language). Use the normal button.";

    var before = comp.numLayers;
    if (!isCam) {
        var token = "solid_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 1000000);
        KF_SOLID_DIALOG = { token: token, comp: comp, before: before, beforeItems: app.project.numItems, deadline: new Date().getTime() + 600000 };
        try { app.executeCommand(id); }
        catch (solidErr) { KF_SOLID_DIALOG = null; return "ERR|Could not open Solid Settings: " + solidErr; }
        KF_SOLID_DIALOG.dialogReturned = true;
        return "PENDING|" + token;
    }

    app.executeCommand(id);
    if (comp.numLayers <= before) return "NONE|No camera was added. If you did not cancel, click the composition once and try again.";

    var layer = comp.selectedLayers.length ? comp.selectedLayers[0] : null;
    if (!layer) return "OK|Layer added.|";
    var json = "";
    try {
        var og = layer.property("ADBE Camera Options Group");
        var w = comp.width;
        var zoom = og.property("ADBE Camera Zoom").value;
        var dof = og.property("ADBE Camera Depth of Field").value;
        var focus = og.property("ADBE Camera Focus Distance").value;
        var ap = og.property("ADBE Camera Aperture").value;
        var blur = og.property("ADBE Camera Blur Level").value;
        json = '{"one":' + (layer.autoOrient === AutoOrientType.NO_AUTO_ORIENT ? "true" : "false") +
               ',"zoom":' + kfNum(zoom / w) + ',"dof":' + (dof ? "true" : "false") +
               ',"focus":' + kfNum(focus / w) + ',"aperture":' + kfNum(ap / w) + ',"blur":' + kfNum(blur) + "}";
    } catch (err) { json = ""; }
    return "OK|Added " + layer.name + ".|" + json;
}

function kfSolidDialogPoll(o) {
    var pending = KF_SOLID_DIALOG;
    if (!pending || !o || o.token !== pending.token) return "ERR|No Solid Settings dialog is waiting.";
    var comp = pending.comp;
    var layer = null, footage = null, i;

    // If AE created the solid directly in the active comp, use that timeline layer.
    if (comp.numLayers > pending.before) {
        try { layer = comp.layer(1); } catch (e) {}
    } else {
        // Some AE focus states create the confirmed solid in the Project panel only.
        // Find that new solid footage item and add it to the active composition.
        try {
            for (i = app.project.numItems; i > pending.beforeItems; i--) {
                var item = app.project.item(i);
                if (item instanceof FootageItem && item.mainSource && item.mainSource.color) {
                    footage = item;
                    break;
                }
            }
        } catch (findErr) {}
        if (footage) {
            try {
                for (i = 0; i < comp.selectedLayers.length; i++) comp.selectedLayers[i].selected = false;
                layer = comp.layers.add(footage);
                layer.selected = true;
            } catch (addErr) {
                KF_SOLID_DIALOG = null;
                return "ERR|The solid was created, but could not be added to the active composition: " + addErr;
            }
        }
    }

    if (layer) {
        var json = "";
        try {
            var src = layer.source, main = src.mainSource, col = main.color;
            json = '{"hex":"' + kfHex(col) + '","w":' + kfNum(src.width) + ',"h":' + kfNum(src.height) +
                   ',"comp":' + ((src.width === comp.width && src.height === comp.height) ? "true" : "false") + "}";
        } catch (err) { json = ""; }
        KF_SOLID_DIALOG = null;
        if (!json) return "ERR|The solid was added, but its color could not be read.";
        return "OK|Added " + layer.name + " to the composition.|" + json;
    }

    if (pending.dialogReturned || new Date().getTime() > pending.deadline) {
        KF_SOLID_DIALOG = null;
        return "NONE|Solid Settings closed without creating a solid.";
    }
    return "PENDING|Waiting for Solid Settings.";
}

// ---------- saved settings (kept in After Effects' own preferences) ----------

function kfLoadSettings() {
    try {
        if (app.settings.haveSetting("MultiTool", "data")) return "OK|" + app.settings.getSetting("MultiTool", "data");
    } catch (e) {}
    return "NONE|";
}

function kfSaveSettings(text) {
    try {
        app.settings.saveSetting("MultiTool", "data", String(text));
        try { app.preferences.saveToDisk(); } catch (e2) {}
        return "OK|Saved.";
    } catch (e) {
        return "ERR|Could not save settings: " + e;
    }
}

// ---------- quick tasks ----------

function kfPrecomp() {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var sel = comp.selectedLayers;
    if (!sel.length) return "ERR|Select the layers to pre-compose.";
    var idx = [];
    for (var i = 0; i < sel.length; i++) idx.push(sel[i].index);
    app.beginUndoGroup(KF_UNDO + "Pre-comp");
    try {
        var name = sel.length === 1 ? sel[0].name + " Comp" : "Pre-comp";
        comp.layers.precompose(idx, name, true);
        return "OK|Pre-composed " + kfPlural(idx.length, "layer") + ".";
    } catch (err) {
        return "ERR|Could not pre-compose: " + err;
    } finally {
        app.endUndoGroup();
    }
}

// Puts the visual center of each layer at the center of the comp (keyframes keep their shape).
function kfCenter() {
    var comp = kfComp();
    if (!comp) return "ERR|Open a composition first.";
    var sel = comp.selectedLayers;
    if (!sel.length) return "ERR|Select one or more layers first.";

    var t = comp.time, done = 0, skipped = 0, parented = 0;
    app.beginUndoGroup(KF_UNDO + "Center in comp");
    try {
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            try {
                if (layer.parent) { parented++; continue; }
                var tr = layer.property("ADBE Transform Group");
                var anchor = tr.property("ADBE Anchor Point");
                if (!anchor || !tr.property("ADBE Position")) { skipped++; continue; }
                if (kfLocked(tr, layer)) { skipped++; continue; }
                var b = kfBounds(layer, t);
                if (!b) { skipped++; continue; }

                var a = kfVec(anchor.valueAtTime(t, false));
                var p = kfPositionAt(tr, layer, t);
                var m = kfMap(layer, t, [b.left + b.width / 2 - a[0], b.top + b.height / 2 - a[1], 0]);
                var delta = [comp.width / 2 - (p[0] + m[0]), comp.height / 2 - (p[1] + m[1]), 0];

                kfShift(tr, layer, t, function (tt) { return delta; });
                done++;
            } catch (err) { skipped++; }
        }
    } finally {
        app.endUndoGroup();
    }
    var msg = "Centered " + kfPlural(done, "layer") + ".";
    if (parented) msg += " Skipped " + kfPlural(parented, "layer") + " that have a parent.";
    if (skipped) msg += " Skipped " + kfPlural(skipped, "layer") + " (cameras, lights, expressions or locked layers).";
    return (done ? "OK|" : "ERR|") + msg;
}
