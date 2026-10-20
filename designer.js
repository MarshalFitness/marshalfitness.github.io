/* Marshal Fitness — version 22: "Design your machine" (colors + logo).
   Works on the cut-out photos (assets/cut). The frame color is found by itself
   (the strongest color on the machine, or the silver metal when there is none)
   and changed in one tap. Seats and pads: the customer picks a color and taps the
   pad on the picture (the touching pad area is painted). A logo can be added and
   moved. The design can be saved as a picture or sent to the shop (with the picture). */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.makeWindow || !M.cutout) return;
  var el = M.el;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  var FRAME = [["orig", ""], ["black", "#1c1c1f"], ["white", "#efefeb"], ["silver", "#b7bac0"], ["red", "#d31822"], ["orange", "#f07b14"],
    ["yellow", "#f5c518"], ["green", "#2f9e4f"], ["blue", "#1f5fd6"], ["navy", "#1d2a55"], ["pink", "#ec5c9a"], ["purple", "#7b3fc4"], ["gold", "#c9a227"]];
  var PADS = [["black", "#1c1c1f"], ["brown", "#6b4423"], ["red", "#b3141c"], ["blue", "#1f4fb3"], ["grey", "#80838b"], ["white", "#ecebe6"], ["beige", "#cdb48e"], ["pink", "#d9608f"]];

  /* ---------- colour maths ---------- */
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hue2(p, q, x) { if (x < 0) x += 1; if (x > 1) x -= 1; if (x < 1 / 6) return p + (q - p) * 6 * x; if (x < 1 / 2) return q; if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6; return p; }
  function hslRgb(h, s, l) {
    h /= 360;
    if (!s) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(hue2(p, q, h + 1 / 3) * 255), Math.round(hue2(p, q, h) * 255), Math.round(hue2(p, q, h - 1 / 3) * 255)];
  }
  function hueDist(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  /* ---------- state ---------- */
  var w = M.makeWindow("designModal", "dz-panel");
  var st = { id: null, frame: "orig", pad: "black", logo: "", lx: 0.5, ly: 0.32, ls: 0.22 };
  var img = null, work = null; // work = { w, h, data (original), H, S, L, A, frame: Uint8Array, pads: Uint8Array, history: [] }
  var ui = {};

  function products() {
    return M.PRODUCTS.filter(function (p) { return p.cat === "gym-equipment" && M.cutout(p); });
  }

  function analyse(image) {
    var maxSide = 760, k = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    var cw = Math.round(image.naturalWidth * k), ch = Math.round(image.naturalHeight * k);
    var c = document.createElement("canvas"); c.width = cw; c.height = ch;
    var ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0, cw, ch);
    var id = ctx.getImageData(0, 0, cw, ch), px = id.data, n = cw * ch;
    var H = new Float32Array(n), S = new Float32Array(n), L = new Float32Array(n), A = new Uint8Array(n);
    var bins = new Float32Array(36), opaque = 0;
    for (var i = 0; i < n; i++) {
      var hsl = rgbHsl(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      H[i] = hsl[0]; S[i] = hsl[1]; L[i] = hsl[2]; A[i] = px[i * 4 + 3];
      if (A[i] > 128) {
        opaque++;
        if (hsl[1] > 0.3 && hsl[2] > 0.15 && hsl[2] < 0.9) bins[Math.floor(hsl[0] / 10) % 36] += hsl[1];
      }
    }
    // the strongest colour = the frame colour
    var best = 0;
    for (var b = 1; b < 36; b++) if (bins[b] > bins[best]) best = b;
    var sum = 0, wsum = 0;
    for (var d = -1; d <= 1; d++) { var bi = (best + d + 36) % 36; sum += bins[bi] * ((best + d) * 10 + 5); wsum += bins[bi]; }
    var center = wsum ? ((sum / wsum) + 360) % 360 : 0;
    var frame = new Uint8Array(n), count = 0;
    for (var j = 0; j < n; j++) {
      if (A[j] > 40 && S[j] > 0.26 && L[j] > 0.1 && L[j] < 0.93 && hueDist(H[j], center) < 26) { frame[j] = 1; count++; }
    }
    var colored = count > opaque * 0.03;
    if (!colored) {
      // no strong colour: the frame is the silver / grey metal
      count = 0;
      for (var m = 0; m < n; m++) {
        frame[m] = A[m] > 40 && S[m] < 0.16 && L[m] > 0.3 && L[m] < 0.9 ? 1 : 0;
        if (frame[m]) count++;
      }
    }
    var lsum = 0;
    for (var q = 0; q < n; q++) if (frame[q]) lsum += L[q];
    return { w: cw, h: ch, data: px, H: H, S: S, L: L, A: A, frame: frame, frameL: count ? lsum / count : 0.5, colored: colored,
      pads: new Uint8Array(n), padL: 0.15, history: [] };
  }

  // a tap on a pad: paint the touching area of the same shade
  function fillPad(x, y) {
    if (!work) return 0;
    var W = work.w, Hh = work.h, start = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= Hh || work.A[start] < 40 || work.frame[start]) return -1;
    var seedL = work.L[start], limit = Math.round(W * Hh * 0.35);
    var seen = new Uint8Array(W * Hh), stack = [start], added = [];
    seen[start] = 1;
    while (stack.length && added.length < limit) {
      var i = stack.pop();
      added.push(i);
      var cx = i % W, cy = (i - cx) / W;
      var nb = [cx > 0 ? i - 1 : -1, cx < W - 1 ? i + 1 : -1, cy > 0 ? i - W : -1, cy < Hh - 1 ? i + W : -1];
      for (var k = 0; k < 4; k++) {
        var j = nb[k];
        if (j < 0 || seen[j]) continue;
        seen[j] = 1;
        if (work.A[j] < 40 || work.frame[j]) continue;
        if (Math.abs(work.L[j] - seedL) > 0.11 || Math.abs(work.L[j] - work.L[i]) > 0.05 || work.S[j] > 0.45) continue;
        stack.push(j);
      }
    }
    var fresh = added.filter(function (i2) { return !work.pads[i2]; });
    fresh.forEach(function (i3) { work.pads[i3] = 1; });
    work.history.push(fresh);
    var ls = 0, c = 0;
    for (var p = 0; p < work.pads.length; p++) if (work.pads[p]) { ls += work.L[p]; c++; }
    work.padL = c ? ls / c : 0.15;
    return fresh.length;
  }

  function recolor(out, mask, hex, srcL, k) {
    var hsl = rgbHsl.apply(null, hexRgb(hex)), th = hsl[0], ts = hsl[1], tl = hsl[2];
    var gain = tl > 0.8 || tl < 0.15 ? 0.6 : k;
    for (var i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      var nl = Math.max(0.03, Math.min(0.97, tl + (work.L[i] - srcL) * gain));
      var rgb = hslRgb(th, ts, nl);
      out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2];
    }
  }

  // the finished picture (machine with new colours + logo) on a canvas of width cw
  var logoImg = null;
  function compose(canvas, cw) {
    if (!work) return;
    var scale = cw / work.w, chh = Math.round(work.h * scale) + Math.round(cw * 0.12);
    canvas.width = cw; canvas.height = chh;
    var ctx = canvas.getContext("2d");
    var gr = ctx.createLinearGradient(0, 0, 0, chh);
    gr.addColorStop(0, "#f4f3ef"); gr.addColorStop(1, "#d9d7d0");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, chh);
    // soft floor shadow
    var top = Math.round(cw * 0.06);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(cw / 2, top + work.h * scale - 6, cw * 0.38, cw * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // the new colours are worked out once and kept until something changes (moving the logo is fast)
    var key = st.frame + "|" + st.pad + "|" + work.history.length + "|" + work.history.reduce(function (a, h) { return a + h.length; }, 0);
    if (work.key !== key) {
      var data = new Uint8ClampedArray(work.data);
      var f = FRAME.filter(function (x) { return x[0] === st.frame; })[0];
      if (f && f[1]) recolor(data, work.frame, f[1], work.frameL, 1);
      var pc = PADS.filter(function (x) { return x[0] === st.pad; })[0];
      if (pc) recolor(data, work.pads, pc[1], work.padL, 1.5);
      var cv = document.createElement("canvas"); cv.width = work.w; cv.height = work.h;
      cv.getContext("2d").putImageData(new ImageData(data, work.w, work.h), 0, 0);
      work.key = key;
      work.canvas = cv;
    }
    var tmp = work.canvas;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tmp, 0, top, cw, work.h * scale);
    if (logoImg) {
      var lw = cw * st.ls, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
      ctx.drawImage(logoImg, st.lx * cw - lw / 2, top + st.ly * work.h * scale - lh / 2, lw, lh);
    }
    canvas.dataset.top = top;
    canvas.dataset.scale = scale;
  }

  /* ---------- window ---------- */
  function swatches(list, value, onPick, label, names) {
    var box = el("div", "dz-swatches");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", label);
    list.forEach(function (c) {
      var b = el("button", "dz-sw" + (c[1] ? "" : " dz-sw-orig"));
      b.type = "button";
      if (c[1]) b.style.setProperty("--sw", c[1]);
      b.setAttribute("aria-label", names[c[0]]);
      b.title = names[c[0]];
      b.setAttribute("aria-pressed", String(c[0] === value));
      if (!c[1]) b.textContent = names[c[0]];
      b.addEventListener("click", function () {
        box.querySelectorAll(".dz-sw").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(c[0]);
      });
      box.appendChild(b);
    });
    return box;
  }

  function draw() {
    var d = t();
    w.title.textContent = d.dzTitle;
    w.body.textContent = "";
    var list = products();
    if (!st.id || !M.productByImage(st.id)) st.id = list.length ? list[0].image : null;
    var sel = el("select", "in22 dz-product");
    var groups = {};
    list.forEach(function (p) {
      var sid = p.series || "";
      if (!groups[sid]) {
        var s = (window.GYM_SERIES || []).filter(function (x) { return x.id === sid; })[0];
        groups[sid] = el("optgroup");
        groups[sid].label = s ? (typeof s.name === "string" ? s.name : tr(s.name)) : d.gpMachines;
        sel.appendChild(groups[sid]);
      }
      var op = el("option", "", tr(p.name) + (p.no ? " · " + p.no : ""));
      op.value = p.image;
      if (p.image === st.id) op.selected = true;
      groups[sid].appendChild(op);
    });
    sel.addEventListener("change", function () { st.id = sel.value; loadProduct(); });
    w.body.appendChild(M.field(d.dzProduct, sel));
    var stage = el("div", "dz-stage");
    ui.canvas = el("canvas", "dz-canvas");
    ui.canvas.setAttribute("role", "img");
    stage.appendChild(ui.canvas);
    ui.loading = el("p", "dz-loading", d.dzLoading);
    stage.appendChild(ui.loading);
    w.body.appendChild(stage);
    ui.hint = el("p", "f22-hint dz-hint", d.dzTapHint);
    ui.hint.setAttribute("aria-live", "polite");
    w.body.appendChild(ui.hint);
    var cols = el("div", "dz-cols");
    var fbox = el("div", "f22");
    fbox.appendChild(el("span", "f22-label", d.dzFrame));
    fbox.appendChild(swatches(FRAME, st.frame, function (v) { st.frame = v; paint(); }, d.dzFrame, d.dzColors));
    cols.appendChild(fbox);
    var pbox = el("div", "f22");
    pbox.appendChild(el("span", "f22-label", d.dzPads));
    pbox.appendChild(swatches(PADS, st.pad, function (v) { st.pad = v; paint(); }, d.dzPads, d.dzColors));
    var prow = el("div", "dz-row");
    var undo = el("button", "btn btn-outline btn-small", d.dzUndo);
    undo.type = "button";
    undo.addEventListener("click", function () {
      if (!work || !work.history.length) return;
      work.history.pop().forEach(function (i) { work.pads[i] = 0; });
      paint();
    });
    var clear = el("button", "btn btn-outline btn-small", d.dzClear);
    clear.type = "button";
    clear.addEventListener("click", function () { if (work) { work.pads.fill(0); work.history = []; paint(); } });
    prow.appendChild(undo); prow.appendChild(clear);
    pbox.appendChild(prow);
    cols.appendChild(pbox);
    w.body.appendChild(cols);
    // logo
    var lbox = el("div", "f22 dz-logo");
    lbox.appendChild(el("span", "f22-label", d.dzLogo));
    var lrow = el("div", "dz-row");
    var file = el("input");
    file.type = "file"; file.accept = "image/*"; file.className = "sr-only"; file.id = "dzLogoFile";
    var add = el("label", "btn btn-outline btn-small", st.logo ? d.gpLogoChange : d.gpLogoAdd);
    add.setAttribute("for", "dzLogoFile");
    var del = el("button", "btn btn-outline btn-small", d.gpLogoRemove);
    del.type = "button";
    del.hidden = !st.logo;
    var size = el("input", "dz-size");
    size.type = "range"; size.min = "8"; size.max = "45"; size.value = String(Math.round(st.ls * 100));
    size.setAttribute("aria-label", d.dzLogoSize);
    size.hidden = !st.logo;
    size.addEventListener("input", function () { st.ls = Number(size.value) / 100; paint(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      M.readImage(f, 500, "image/png").then(function (data) { st.logo = data; setLogo(); draw(); var sz = w.body.querySelector(".dz-size"); if (sz) sz.focus(); })
        .catch(function () { M.toast(d.gpLogoBad); });
    });
    del.addEventListener("click", function () { st.logo = ""; logoImg = null; draw(); });
    lrow.appendChild(file); lrow.appendChild(add); lrow.appendChild(del); lrow.appendChild(size);
    lbox.appendChild(lrow);
    if (st.logo) lbox.appendChild(el("span", "f22-hint", d.dzLogoMove));
    w.body.appendChild(lbox);
    w.body.appendChild(el("p", "panel-note dz-note", d.dzNote));
    var acts = el("div", "gp-actions");
    var send = el("button", "btn btn-whatsapp dz-send");
    send.type = "button";
    if (M.WA_ICON) send.innerHTML = M.WA_ICON;
    send.appendChild(el("span", "", d.dzSend));
    send.addEventListener("click", function () { sendDesign(send); });
    var savePic = el("button", "btn btn-outline dz-save", d.dzSave);
    savePic.type = "button";
    savePic.addEventListener("click", function () { picture(1000, "image/png").then(function (blob) {
      var p = M.productByImage(st.id), name = "Marshal-Fitness-" + String(p && p.no || "design").replace(/[^A-Za-z0-9]+/g, "-") + ".png";
      if (window.MF_PDF && window.MF_PDF.canShareFile(blob, name) && navigator.maxTouchPoints > 0) window.MF_PDF.share(blob, name, "Marshal Fitness").catch(function () {});
      else if (window.MF_PDF) window.MF_PDF.save(blob, name);
    }); });
    acts.appendChild(send); acts.appendChild(savePic);
    w.body.appendChild(acts);
    attachCanvas();
    if (work && img && img.dataset.id === st.id) paint(); else loadProduct();
  }

  function setLogo() {
    if (!st.logo) { logoImg = null; return; }
    logoImg = new Image();
    logoImg.onload = paint;
    logoImg.src = st.logo;
  }

  function loadProduct() {
    var p = M.productByImage(st.id);
    if (!p) return;
    var c = M.cutout(p);
    work = null;
    ui.loading.hidden = false;
    ui.loading.textContent = t().dzLoading;
    var im = new Image();
    im.dataset.id = st.id;
    im.onload = function () {
      if (im.dataset.id !== st.id) return;
      img = im;
      try { work = analyse(im); } catch (e) { ui.loading.textContent = t().dzError; return; }
      ui.loading.hidden = true;
      paint();
    };
    im.onerror = function () { ui.loading.textContent = t().dzError; };
    im.src = c.src;
  }

  function paint() {
    if (!work || !ui.canvas) return;
    var d = t(), p = M.productByImage(st.id);
    var box = ui.canvas.parentNode;
    var cw = Math.min(560, (box && box.clientWidth) || 320);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    compose(ui.canvas, Math.round(cw * dpr));
    ui.canvas.style.width = cw + "px";
    ui.canvas.style.height = Math.round(ui.canvas.height / dpr) + "px";
    ui.canvas.setAttribute("aria-label", d.dzLabel(tr(p.name), d.dzColors[st.frame], d.dzColors[st.pad]));
  }

  function picture(width, type) {
    return new Promise(function (resolve) {
      var c = document.createElement("canvas");
      compose(c, width);
      c.toBlob(function (b) { resolve(b); }, type || "image/jpeg", 0.85);
    });
  }

  // tap = paint a pad; drag on the logo = move the logo
  function attachCanvas() {
    var c = ui.canvas, drag = null;
    c.style.touchAction = "none";
    function pos(e) {
      var r = c.getBoundingClientRect();
      var top = Number(c.dataset.top || 0), scale = Number(c.dataset.scale || 1), k = c.width / r.width;
      var cx = (e.clientX - r.left) * k, cy = (e.clientY - r.top) * k;
      return { cx: cx, cy: cy, x: Math.floor(cx / scale), y: Math.floor((cy - top) / scale), top: top, scale: scale };
    }
    function onLogo(q) {
      if (!logoImg) return false;
      var lw = c.width * st.ls, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
      var lx = st.lx * c.width, ly = q.top + st.ly * work.h * q.scale;
      return Math.abs(q.cx - lx) < lw / 2 + 8 && Math.abs(q.cy - ly) < lh / 2 + 8;
    }
    c.addEventListener("pointerdown", function (e) {
      if (!work) return;
      var q = pos(e);
      if (onLogo(q)) { drag = { id: e.pointerId }; try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } return; }
      drag = null;
      var n = fillPad(q.x, q.y);
      var d = t();
      ui.hint.textContent = n === -1 ? d.dzTapFrame : n > 0 ? d.dzPainted : d.dzTapHint;
      paint();
    });
    c.addEventListener("pointermove", function (e) {
      if (!drag || !work) return;
      var q = pos(e);
      st.lx = Math.max(0.05, Math.min(0.95, q.cx / c.width));
      st.ly = Math.max(0.02, Math.min(0.98, (q.cy - q.top) / (work.h * q.scale)));
      paint();
    });
    var end = function () { drag = null; };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  function sendDesign(opener) {
    var d = t(), p = M.productByImage(st.id);
    if (!p || !work) return;
    var padsUsed = work.pads.some ? Array.prototype.some.call(work.pads, function (v) { return v; }) : true;
    var msg = d.dzMsg(M.waProductName(p) + (p.no ? " (" + p.no + ")" : ""), d.dzColors[st.frame], padsUsed ? d.dzColors[st.pad] : d.dzColors.orig, !!st.logo);
    picture(720, "image/jpeg").then(function (blob) {
      var fr = new FileReader();
      fr.onload = function () {
        window.MF_REQUEST.open({
          kind: "design", item: d.dzTitle + ": " + M.waProductName(p) + (p.no ? " (" + p.no + ")" : ""),
          message: msg,
          items: [{ name: M.waProductName(p), no: p.no || "", qty: 1 }],
          extra: { photos: [fr.result], design: { product: p.image, frame: st.frame, pads: padsUsed ? st.pad : "orig", logo: !!st.logo } }
        }, opener);
      };
      fr.readAsDataURL(blob);
    });
  }

  M.openDesigner = function (p, opener) {
    if (p && M.cutout(p) && p.cat === "gym-equipment") st.id = p.image;
    setLogo();
    draw();
    M.openModal(w.modal, opener || null, w.body.querySelector(".dz-product"));
  };
  M.onRender(function () { if (!w.modal.hidden) draw(); });

  // product window: "Design its colors" button for machines
  var lbDesign = document.getElementById("lbDesign");
  var lbExtra = document.getElementById("lbExtra");
  var lbP = null;
  M.onLightbox(function (p) {
    lbP = p;
    var ok = !!(lbDesign && p.cat === "gym-equipment" && M.cutout(p));
    if (lbDesign) lbDesign.hidden = !ok;
    if (ok && lbExtra) lbExtra.hidden = false;
  });
  if (lbDesign) lbDesign.addEventListener("click", function () { if (lbP) M.openDesigner(lbP, M.lightboxOrigin ? M.lightboxOrigin() : null); });
})();
