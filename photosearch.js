/* Marshal Fitness — search with a photo.
   The customer takes or chooses a photo of a machine. A small picture model
   (ai/, runs in the background on the phone) makes a "fingerprint" of the photo
   and compares it with the fingerprints of all products (ai/emb.json).
   The 6 most similar products are shown. The photo is never uploaded. */
(function () {
  "use strict";
  var M = window.MF;
  var modal = document.getElementById("psModal");
  var body = document.getElementById("psBody");
  var openBtn = document.getElementById("photoSearchBtn");
  if (!M || !modal || !body) return;

  var supported = !!(window.Worker && window.fetch && window.Promise && document.createElement("canvas").getContext);
  if (!supported) return;
  if (openBtn) {
    openBtn.hidden = false;
    var box = document.getElementById("searchBox");
    if (box) box.classList.add("has-cam");
  }

  var SIZE = 224;
  var CACHE_KEY = "mf-emb-cache";
  var root = document.documentElement;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }

  /* ---------- background worker ---------- */
  var worker = null;
  var nextId = 1;
  var waiting = {};
  var modelReady = false;

  function getWorker() {
    if (worker) return worker;
    worker = new Worker("ai/worker.js");
    worker.onmessage = function (e) {
      var m = e.data || {};
      var w = waiting[m.id];
      if (!w) return;
      delete waiting[m.id];
      if (m.error) w.reject(new Error(m.error)); else w.resolve(m);
    };
    worker.onerror = function () {
      Object.keys(waiting).forEach(function (k) { waiting[k].reject(new Error("worker")); delete waiting[k]; });
      worker = null;
    };
    return worker;
  }
  function ask(cmd, data, transfer) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      waiting[id] = { resolve: resolve, reject: reject };
      var msg = { id: id, cmd: cmd };
      Object.keys(data || {}).forEach(function (k) { msg[k] = data[k]; });
      try { getWorker().postMessage(msg, transfer || []); } catch (e) { delete waiting[id]; reject(e); }
    });
  }

  /* ---------- pictures -> 224×224 pixels ---------- */
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // big phone photos: shrink in two steps for a clean small picture
  function shrink(img, maxSide) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s = Math.min(1, maxSide / Math.max(w, h));
    if (s >= 1) return img;
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    var x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function pixels(src, how) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    var c = document.createElement("canvas");
    c.width = c.height = SIZE;
    var x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.fillStyle = "#fff";
    x.fillRect(0, 0, SIZE, SIZE);
    if (how === "contain") {
      var s = SIZE / (Math.max(w, h) * 1.06);
      var dw = w * s, dh = h * s;
      x.drawImage(src, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    } else {
      var side = Math.min(w, h);
      x.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
    }
    return x.getImageData(0, 0, SIZE, SIZE).data.buffer;
  }

  /* ---------- product fingerprints ---------- */
  var library = null; // { mu: Float32Array, vecs: { image: Float32Array (centred, unit) } }
  var libLoading = null;

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function unit(v) {
    var s = 0;
    for (var i = 0; i < v.length; i++) s += v[i] * v[i];
    s = Math.sqrt(s) || 1;
    for (var j = 0; j < v.length; j++) v[j] /= s;
    return v;
  }
  function fromInt8(b64) {
    var b = b64ToBytes(b64);
    var q = new Int8Array(b.buffer, b.byteOffset, b.length);
    var v = new Float32Array(q.length);
    for (var i = 0; i < q.length; i++) v[i] = q[i];
    return unit(v);
  }
  function centre(raw) {
    var v = new Float32Array(raw.length);
    for (var i = 0; i < raw.length; i++) v[i] = raw[i] - library.mu[i];
    return unit(v);
  }

  function loadLibrary() {
    if (library) return Promise.resolve(library);
    if (!libLoading) {
      libLoading = fetch("ai/emb.json").then(function (r) { if (!r.ok) throw new Error("emb"); return r.json(); }).then(function (data) {
        var muB = b64ToBytes(data.mu);
        var mu = new Float32Array(muB.buffer.slice(muB.byteOffset, muB.byteOffset + muB.byteLength));
        var vecs = {};
        Object.keys(data.items || {}).forEach(function (k) { vecs[k] = fromInt8(data.items[k]); });
        library = { mu: mu, vecs: vecs };
        return library;
      });
      libLoading.catch(function () { libLoading = null; });
    }
    return libLoading;
  }

  var memo = {};
  function cacheKey(p) { return p.image + ":" + (p.imageData ? p.imageData.length : 0); }
  function readCache() {
    try { return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeCache(key, vec) {
    try {
      var c = readCache();
      var q = new Int8Array(vec.length), mx = 0;
      for (var i = 0; i < vec.length; i++) mx = Math.max(mx, Math.abs(vec[i]));
      for (var j = 0; j < vec.length; j++) q[j] = Math.round(vec[j] / (mx || 1) * 127);
      var bin = "";
      var u = new Uint8Array(q.buffer);
      for (var k = 0; k < u.length; k++) bin += String.fromCharCode(u[k]);
      c[key] = btoa(bin);
      var keys = Object.keys(c);
      while (keys.length > 60) { delete c[keys.shift()]; }
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* storage full or blocked */ }
  }

  // fingerprint of a product that was added in admin after this version was made
  function productVector(p) {
    if (p.emb) {
      try { return Promise.resolve(centre(fromInt8(p.emb))); } catch (e) { /* make it below */ }
    }
    // built-in fingerprint only while the product still uses its built-in photo
    if (!p.imageData && library.vecs[p.image]) return Promise.resolve(library.vecs[p.image]);
    var key = cacheKey(p);
    if (memo[key]) return Promise.resolve(memo[key]);
    var cached = readCache()[key];
    if (cached) { memo[key] = centre(fromInt8(cached)); return Promise.resolve(memo[key]); }
    return loadImage(M.bigSrc(p)).then(function (img) {
      var buf = pixels(shrink(img, 800), "contain");
      return ask("embed", { images: [buf] }, [buf]);
    }).then(function (m) {
      var raw = m.vecs[0];
      writeCache(key, raw);
      memo[key] = centre(raw);
      return memo[key];
    }).catch(function () { return null; });
  }

  /* ---------- search ---------- */
  function search(file) {
    var url = URL.createObjectURL(file);
    showWorking(url);
    var photo;
    var started = Date.now();
    Promise.all([loadImage(url), loadLibrary()]).then(function (res) {
      photo = shrink(res[0], 900);
      var a = pixels(photo, "contain"), b = pixels(photo, "square");
      return ask("embed", { images: [a, b] }, [a, b]);
    }).then(function (m) {
      modelReady = true;
      var q = new Float32Array(m.vecs[0].length);
      for (var i = 0; i < q.length; i++) q[i] = m.vecs[0][i] + m.vecs[1][i];
      q = centre(unit(q));
      var list = M.PRODUCTS.slice();
      return Promise.all(list.map(productVector)).then(function (vecs) {
        var scored = [];
        list.forEach(function (p, i) {
          var v = vecs[i];
          if (!v) return;
          var s = 0;
          for (var k = 0; k < v.length; k++) s += v[k] * q[k];
          scored.push({ p: p, s: s });
        });
        scored.sort(function (x, y) { return y.s - x.s; });
        return scored.slice(0, 6);
      });
    }).then(function (top) {
      var wait = Math.max(0, 500 - (Date.now() - started)); // let the progress be seen
      setTimeout(function () { showResults(url, top); }, wait);
    }).catch(function () {
      showError(url);
    });
  }

  /* ---------- screens ---------- */
  var lastUrl = null;
  var lastTop = null;

  function fileInputs() {
    var take = document.createElement("input");
    take.type = "file";
    take.accept = "image/*";
    take.setAttribute("capture", "environment");
    take.hidden = true;
    var choose = document.createElement("input");
    choose.type = "file";
    choose.accept = "image/*";
    choose.hidden = true;
    [take, choose].forEach(function (inp) {
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        inp.value = "";
        if (f) search(f);
      });
      body.appendChild(inp);
    });
    return { take: take, choose: choose };
  }

  function actions() {
    var d = t();
    var inputs = fileInputs();
    var row = el("div", "ps-actions");
    var take = M.iconButton("btn", "camera", d.psTake, true);
    take.addEventListener("click", function () { inputs.take.click(); });
    var choose = M.iconButton("btn btn-outline", "image", d.psChoose, true);
    choose.addEventListener("click", function () { inputs.choose.click(); });
    row.appendChild(take);
    row.appendChild(choose);
    return row;
  }

  function showIntro() {
    var d = t();
    lastTop = null;
    body.textContent = "";
    body.appendChild(el("p", "panel-note", d.psIntro));
    body.appendChild(actions());
    body.appendChild(el("p", "panel-note", d.psPrivate));
    if (!modelReady) body.appendChild(el("p", "panel-note", d.psFirst));
  }

  function preview(url) {
    var wrap = el("div", "ps-preview");
    var img = document.createElement("img");
    img.src = url;
    img.alt = "";
    wrap.appendChild(img);
    return wrap;
  }

  function showWorking(url) {
    var d = t();
    body.textContent = "";
    var pv = preview(url);
    var w = el("div", "ps-working");
    w.setAttribute("role", "status");
    w.appendChild(el("strong", null, d.psWorking));
    var bar = el("div", "ps-bar");
    bar.appendChild(el("i"));
    w.appendChild(bar);
    if (!modelReady) w.appendChild(el("span", "panel-note", d.psFirst));
    pv.appendChild(w);
    body.appendChild(pv);
  }

  function showError(url) {
    var d = t();
    body.textContent = "";
    body.appendChild(preview(url));
    var p = el("p", "req-err", d.psError);
    p.setAttribute("role", "alert");
    body.appendChild(p);
    body.appendChild(actions());
  }

  function showResults(url, top) {
    var d = t();
    if (lastUrl && lastUrl !== url) URL.revokeObjectURL(lastUrl);
    lastUrl = url;
    lastTop = top;
    body.textContent = "";
    var head = preview(url);
    head.appendChild(el("strong", "ps-title", d.psResults));
    body.appendChild(head);
    var grid = el("div", "ps-grid");
    top.forEach(function (it) {
      var p = it.p;
      var b = el("button", "ps-item");
      b.type = "button";
      var img = document.createElement("img");
      img.src = M.imgSrc(p);
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      b.appendChild(img);
      b.appendChild(el("span", null, tr(p.name)));
      b.setAttribute("aria-label", d.zoomAria(tr(p.name)));
      b.addEventListener("click", function () {
        backToPs = true;
        M.openLightbox(p, openBtn);
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    body.appendChild(el("p", "panel-note", d.psNote));
    var foot = el("div", "ps-foot");
    var inputs = fileInputs();
    var again = M.iconButton("btn btn-outline", "camera", d.psAgain, true);
    again.addEventListener("click", function () { inputs.choose.click(); });
    var wa = el("a", "btn");
    wa.href = M.waUrl(d.psWa);
    wa.target = "_blank";
    wa.rel = "noopener noreferrer";
    wa.innerHTML = M.WA_ICON;
    wa.appendChild(el("span", null, d.askBtn));
    foot.appendChild(again);
    foot.appendChild(wa);
    body.appendChild(foot);
    var first = grid.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- open / close ---------- */
  var backToPs = false;
  function open(opener) {
    if (!lastTop) showIntro();
    M.openModal(modal, opener || null, document.getElementById("psClose"));
    // start loading the model while the customer takes the photo
    ask("load", {}).then(function () { modelReady = true; }, function () { /* tried again on search */ });
    loadLibrary().catch(function () { /* tried again on search */ });
  }
  M.openPhotoSearch = open;
  if (openBtn) openBtn.addEventListener("click", function () { lastTop = null; open(openBtn); });
  document.getElementById("psClose").addEventListener("click", function () { M.closeModal(); });

  var lb = document.getElementById("lightbox");
  var req = document.getElementById("reqModal");
  if (lb) lb.addEventListener("modal-close", function () {
    if (!backToPs) return;
    setTimeout(function () {
      if (req && !req.hidden) return; // price form opened over the photo
      backToPs = false;
      if (!root.classList.contains("lb-open") && !root.classList.contains("stage-open") && lastTop) {
        M.openModal(modal, null, document.getElementById("psClose"));
        var first = body.querySelector(".ps-item");
        if (first) first.focus({ preventScroll: true });
      }
    }, 0);
  });
  if (req) req.addEventListener("modal-close", function () {
    if (!backToPs) return;
    setTimeout(function () { if (!lb || lb.hidden) backToPs = false; }, 20);
  });

  M.onRender(function () {
    if (modal.hidden) return;
    if (lastTop && lastUrl) showResults(lastUrl, lastTop);
    else showIntro();
  });
})();
