/* Marshal Fitness — "See it in your room" camera.
   The phone camera opens and the product (photo without background) appears
   over the room. One finger moves it, two fingers make it bigger / smaller and
   turn it. More products can be added, flipped, locked or deleted. "Freeze"
   stops the picture so the customer can put the phone down; "Take photo" saves
   or shares the result, or asks the price of everything on WhatsApp.
   Without a camera, a photo of the room can be used instead. */
(function () {
  "use strict";
  var M = window.MF;
  var stage = document.getElementById("camStage");
  if (!M || !stage || !M.openStage) return;

  var MAX_ITEMS = 12;
  var root = document.documentElement;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }
  function coarse() { return window.matchMedia && window.matchMedia("(pointer: coarse)").matches; }

  var ui = {};
  var built = false;
  var items = [];       // { p, fx, fy, w, s, r, flip, lock, node, img, z }
  var zTop = 0;
  var selected = null;
  var mode = "none";    // live | frozen | photo | none
  var stream = null;
  var cameraWorks = null;
  var shotUrl = null;
  var shotBlob = null;

  /* ---------- build ---------- */
  function build() {
    if (built) return;
    built = true;
    var d = t();

    ui.view = el("div", "cam-view");
    ui.video = document.createElement("video");
    ui.video.className = "cam-video";
    ui.video.setAttribute("playsinline", "");
    ui.video.setAttribute("muted", "");
    ui.video.muted = true;
    ui.video.autoplay = true;
    ui.still = document.createElement("canvas");
    ui.still.className = "cam-still";
    ui.still.hidden = true;
    ui.items = el("div", "cam-items");
    ui.view.appendChild(ui.video);
    ui.view.appendChild(ui.still);
    ui.view.appendChild(ui.items);
    stage.appendChild(ui.view);

    ui.top = el("div", "cam-top");
    ui.close = M.iconButton("cam-x", "close", d.close);
    ui.close.addEventListener("click", close);
    ui.title = el("h2", "cam-title");
    ui.title.id = "camStageTitle";
    ui.freeze = M.iconButton("cam-chip cam-freeze", "snow", d.camFreeze, true);
    ui.freeze.addEventListener("click", toggleFreeze);
    // use a photo of the room instead of the live camera (any time)
    ui.room = M.iconButton("cam-chip cam-room", "image", d.camUsePhoto);
    ui.room.addEventListener("click", function () { ui.file.click(); });
    ui.top.appendChild(ui.close);
    ui.top.appendChild(ui.title);
    ui.top.appendChild(ui.room);
    ui.top.appendChild(ui.freeze);
    stage.appendChild(ui.top);

    ui.hint = el("p", "cam-hint");
    ui.hint.setAttribute("aria-live", "polite");
    stage.appendChild(ui.hint);

    // tools for the chosen product
    ui.tools = el("div", "cam-tools");
    ui.tools.hidden = true;
    ui.toolName = el("p", "cam-tool-name");
    ui.toolName.dir = "auto";
    ui.toolRow = el("div", "cam-tool-row");
    ui.smaller = M.iconButton("cam-tool", "minus", d.camSmaller, true);
    ui.bigger = M.iconButton("cam-tool", "plus", d.camBigger, true);
    ui.turn = M.iconButton("cam-tool", "rotate", d.camTurn, true);
    ui.flip = M.iconButton("cam-tool", "flip", d.camFlip, true);
    ui.lock = M.iconButton("cam-tool", "lock", d.camLock, true);
    ui.del = M.iconButton("cam-tool cam-tool-del", "trash", d.camDelete, true);
    ui.smaller.addEventListener("click", function () { scaleSel(1 / 1.12); });
    ui.bigger.addEventListener("click", function () { scaleSel(1.12); });
    ui.turn.addEventListener("click", function () { if (selected && !selected.lock) { selected.r += 15; place(selected); } });
    ui.flip.addEventListener("click", function () { if (selected && !selected.lock) { selected.flip = !selected.flip; place(selected); } });
    ui.lock.addEventListener("click", function () { if (selected) { selected.lock = !selected.lock; place(selected); updateTools(); } });
    ui.del.addEventListener("click", function () { removeItem(selected); });
    [ui.smaller, ui.bigger, ui.turn, ui.flip, ui.lock, ui.del].forEach(function (b) { ui.toolRow.appendChild(b); });
    ui.tools.appendChild(ui.toolName);
    ui.tools.appendChild(ui.toolRow);
    stage.appendChild(ui.tools);

    ui.bottom = el("div", "cam-bottom");
    ui.add = M.iconButton("cam-side cam-add", "plus", d.camAdd, true);
    ui.add.addEventListener("click", openPicker);
    ui.shoot = el("button", "cam-shoot");
    ui.shoot.type = "button";
    ui.shoot.appendChild(el("span", "cam-shoot-ring"));
    ui.shoot.addEventListener("click", takePhoto);
    ui.ask = M.iconButton("cam-side cam-ask", "wa", d.camAskPrice, true);
    ui.ask.addEventListener("click", function () { askPrice(ui.ask); });
    ui.bottom.appendChild(ui.add);
    ui.bottom.appendChild(ui.shoot);
    ui.bottom.appendChild(ui.ask);
    stage.appendChild(ui.bottom);

    // camera not working: use a photo of the room
    ui.start = el("div", "cam-start");
    ui.start.hidden = true;
    ui.startIcon = el("div", "cam-start-icon");
    ui.startIcon.innerHTML = M.icon("camera", 40);
    ui.startText = el("p", "cam-start-text");
    ui.startBtns = el("div", "cam-start-btns");
    ui.retry = M.iconButton("btn", "camera", d.camAllow, true);
    ui.retry.addEventListener("click", function () { startCamera(true); });
    ui.usePhoto = M.iconButton("btn btn-outline", "image", d.camUsePhoto, true);
    ui.usePhoto.addEventListener("click", function () { ui.file.click(); });
    ui.startBtns.appendChild(ui.retry);
    ui.startBtns.appendChild(ui.usePhoto);
    ui.start.appendChild(ui.startIcon);
    ui.start.appendChild(ui.startText);
    ui.start.appendChild(ui.startBtns);
    stage.appendChild(ui.start);

    ui.file = document.createElement("input");
    ui.file.type = "file";
    ui.file.accept = "image/*";
    ui.file.hidden = true;
    ui.file.addEventListener("change", function () {
      var f = ui.file.files && ui.file.files[0];
      ui.file.value = "";
      if (f) useRoomPhoto(f);
    });
    stage.appendChild(ui.file);

    // product picker
    ui.pick = el("div", "cam-pick");
    ui.pick.hidden = true;
    ui.pick.setAttribute("role", "region");
    var ph = el("div", "cam-pick-head");
    ui.pickTitle = el("h3", "cam-pick-title");
    ui.pickTitle.id = "camPickTitle";
    ui.pick.setAttribute("aria-labelledby", "camPickTitle");
    ui.pickClose = M.iconButton("cam-x cam-pick-x", "close", d.close);
    ui.pickClose.addEventListener("click", closePicker);
    ph.appendChild(ui.pickTitle);
    ph.appendChild(ui.pickClose);
    ui.pick.appendChild(ph);
    ui.pickSearch = document.createElement("input");
    ui.pickSearch.type = "search";
    ui.pickSearch.className = "cam-pick-search";
    ui.pickSearch.autocomplete = "off";
    ui.pickSearch.addEventListener("input", drawPicker);
    ui.pick.appendChild(ui.pickSearch);
    ui.pickGrid = el("div", "cam-pick-grid");
    ui.pick.appendChild(ui.pickGrid);
    ui.pickNote = el("p", "cam-pick-note");
    ui.pick.appendChild(ui.pickNote);
    stage.appendChild(ui.pick);

    // photo result
    ui.shot = el("div", "cam-shot");
    ui.shot.hidden = true;
    ui.shotImg = document.createElement("img");
    ui.shotImg.className = "cam-shot-img";
    ui.shotImg.alt = "";
    ui.shotBtns = el("div", "cam-shot-btns");
    ui.save = el("a", "btn cam-save");
    ui.save.download = "marshal-fitness-my-room.jpg";
    ui.save.innerHTML = M.icon("download");
    ui.saveLabel = el("span");
    ui.save.appendChild(ui.saveLabel);
    ui.share = M.iconButton("btn btn-outline cam-share", "share", d.camShare, true);
    ui.share.addEventListener("click", sharePhoto);
    ui.shotAsk = M.iconButton("btn btn-outline cam-shot-ask", "wa", d.camAskPrice, true);
    ui.shotAsk.addEventListener("click", function () { askPrice(ui.shotAsk); });
    ui.back = M.iconButton("btn btn-outline cam-back", "camera", d.camRetake, true);
    ui.back.addEventListener("click", closeShot);
    [ui.save, ui.share, ui.shotAsk, ui.back].forEach(function (b) { ui.shotBtns.appendChild(b); });
    ui.shot.appendChild(ui.shotImg);
    ui.shot.appendChild(ui.shotBtns);
    stage.appendChild(ui.shot);

    attachGestures();
    stage.addEventListener("stage-escape", function (e) {
      if (!ui.shot.hidden) { e.preventDefault(); closeShot(); }
      else if (!ui.pick.hidden) { e.preventDefault(); closePicker(); }
      else if (selected && e.detail !== "back") { e.preventDefault(); select(null); }
    });
    window.addEventListener("resize", function () { if (!stage.hidden) { redrawStill(); items.forEach(place); } });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && mode === "live") stopStream();
      else if (!document.hidden && !stage.hidden && mode === "live" && !stream) startCamera(false);
    });
  }

  function texts() {
    var d = t();
    ui.title.textContent = d.camOpen;
    M.setIconButtonLabel(ui.close, d.close);
    M.setIconButtonLabel(ui.smaller, d.camSmaller);
    M.setIconButtonLabel(ui.bigger, d.camBigger);
    M.setIconButtonLabel(ui.turn, d.camTurn);
    M.setIconButtonLabel(ui.flip, d.camFlip);
    M.setIconButtonLabel(ui.del, d.camDelete);
    M.setIconButtonLabel(ui.add, d.camAdd);
    M.setIconButtonLabel(ui.ask, d.camAskPrice);
    M.setIconButtonLabel(ui.retry, d.camAllow);
    M.setIconButtonLabel(ui.usePhoto, d.camUsePhoto);
    M.setIconButtonLabel(ui.pickClose, d.close);
    M.setIconButtonLabel(ui.share, d.camShare);
    M.setIconButtonLabel(ui.shotAsk, d.camAskPrice);
    M.setIconButtonLabel(ui.back, mode === "photo" ? d.tourBack : d.camRetake, mode === "photo" ? "left" : "camera");
    M.setIconButtonLabel(ui.room, d.camUsePhoto);
    ui.shoot.setAttribute("aria-label", d.camPhoto);
    ui.saveLabel.textContent = d.camSave;
    ui.pickTitle.textContent = d.camPickTitle;
    ui.pickSearch.placeholder = d.plannerSearch;
    ui.pickSearch.setAttribute("aria-label", d.plannerSearch);
    ui.pickNote.textContent = d.camNote;
    ui.startText.textContent = cameraWorks === false ? d.camNoCamera : d.camIntro;
    updateFreeze();
    updateTools();
    updateHint();
    items.forEach(function (it) { it.node.setAttribute("aria-label", tr(it.p.name)); });
  }

  /* ---------- camera ---------- */
  function stopStream() {
    if (stream) stream.getTracks().forEach(function (tk) { try { tk.stop(); } catch (e) { /* ignore */ } });
    stream = null;
    if (ui.video) ui.video.srcObject = null;
  }

  var ticket = 0; // each camera start gets a number; only the newest one may switch the picture
  function startCamera(fromButton) {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { cameraFailed(); return; }
    var mine = ++ticket;
    ui.start.hidden = true;
    ui.hint.textContent = t().camIntro;
    md.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then(function (s) {
        if (stage.hidden || mine !== ticket) { s.getTracks().forEach(function (tk) { tk.stop(); }); return; }
        stopStream();
        stream = s;
        cameraWorks = true;
        ui.video.srcObject = s;
        var p = ui.video.play();
        if (p && p.catch) p.catch(function () { /* autoplay will still start */ });
        setMode("live");
      })
      .catch(function () { if (mine === ticket) cameraFailed(); });
  }

  function cameraFailed() {
    cameraWorks = false;
    stopStream();
    if (mode === "photo" || mode === "frozen") { updateFreeze(); return; }
    setMode("none");
    ui.startText.textContent = t().camNoCamera;
    ui.retry.hidden = !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    ui.start.hidden = false;
    (ui.retry.hidden ? ui.usePhoto : ui.retry).focus({ preventScroll: true });
  }

  function setMode(m) {
    mode = m;
    ui.video.hidden = m !== "live";
    ui.still.hidden = !(m === "frozen" || m === "photo");
    stage.classList.toggle("is-live", m === "live");
    if (m !== "none") ui.start.hidden = true;
    updateFreeze();
    updateHint();
  }

  function updateFreeze() {
    var d = t();
    if (mode === "live") {
      ui.freeze.hidden = false;
      M.setIconButtonLabel(ui.freeze, d.camFreeze, "snow");
    } else if ((mode === "frozen" || mode === "photo") && cameraWorks !== false && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      ui.freeze.hidden = false;
      M.setIconButtonLabel(ui.freeze, d.camLive, "video");
    } else {
      ui.freeze.hidden = true;
    }
    ui.freeze.setAttribute("aria-pressed", mode === "frozen" ? "true" : "false");
  }

  function toggleFreeze() {
    if (mode === "live") {
      var v = ui.video;
      if (!v.videoWidth) return;
      // keep a copy of the frame in full size, then draw it fitted to the screen
      frozenFrame = document.createElement("canvas");
      frozenFrame.width = v.videoWidth;
      frozenFrame.height = v.videoHeight;
      frozenFrame.getContext("2d").drawImage(v, 0, 0);
      stillSource = frozenFrame;
      ticket++;
      stopStream();
      setMode("frozen");
      redrawStill();
      ui.hint.textContent = t().camFrozen;
    } else {
      startCamera(true);
    }
  }

  var stillSource = null;
  var frozenFrame = null;

  // draw an image so it covers the whole screen (like the live video does)
  function coverRect(sw, sh, W, H) {
    var s = Math.max(W / sw, H / sh);
    var w = sw * s, h = sh * s;
    return { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  }

  function redrawStill() {
    if (!stillSource) return;
    var W = ui.view.clientWidth, H = ui.view.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    ui.still.width = Math.round(W * dpr);
    ui.still.height = Math.round(H * dpr);
    var ctx = ui.still.getContext("2d");
    var sw = stillSource.naturalWidth || stillSource.width, sh = stillSource.naturalHeight || stillSource.height;
    var r = coverRect(sw, sh, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(stillSource, r.x, r.y, r.w, r.h);
  }

  function useRoomPhoto(file) {
    ticket++; // a camera that is still starting must not replace this photo
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      stopStream();
      stillSource = img;
      setMode("photo");
      redrawStill();
      ui.hint.textContent = items.length ? (coarse() ? t().camHint : t().camHintPc) : t().camEmpty;
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ---------- products in the room ---------- */
  function defaultWidth(p) {
    var name = String(typeof p.name === "string" ? p.name : (p.name.en || "")).toLowerCase();
    if (p.cat === "accessories") return /bench/.test(name) ? 0.6 : 0.32;
    if (p.cat === "free-weights") return /barbell/.test(name) ? 0.3 : 0.4;
    return 0.68;
  }

  function addItem(p, quiet) {
    var c = M.cutout(p);
    if (!c) return null;
    if (items.length >= MAX_ITEMS) return null;
    var n = items.length;
    var it = {
      p: p, fx: 0.5 + ((n % 3) - 1) * 0.08, fy: 0.56 + (Math.floor(n / 3) % 2) * 0.06,
      w: defaultWidth(p), s: 1, r: 0, flip: false, lock: false
    };
    var b = el("button", "cam-item");
    b.type = "button";
    b.setAttribute("aria-label", tr(p.name));
    var img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.src = c.src;
    img.addEventListener("error", function () { removeItem(it); });
    img.addEventListener("load", function () { fitStart(it); });
    b.appendChild(img);
    it.node = b;
    it.img = img;
    b.addEventListener("focus", function () { if (selected !== it) select(it); });
    b.addEventListener("keydown", function (e) { keyMove(e, it); });
    ui.items.appendChild(b);
    items.push(it);
    place(it);
    select(it);
    if (!quiet) b.focus({ preventScroll: true });
    updateHint();
    return it;
  }

  function fitStart(it) {
    if (it.fitted || !it.img.naturalWidth) return;
    it.fitted = true;
    var W = ui.view.clientWidth || window.innerWidth, H = ui.view.clientHeight || window.innerHeight;
    var base = Math.min(W, H) * it.w;
    var h = base * it.img.naturalHeight / it.img.naturalWidth;
    if (h > H * 0.7) { it.w = it.w * (H * 0.7) / h; place(it); }
  }

  function place(it) {
    var W = ui.view.clientWidth || window.innerWidth, H = ui.view.clientHeight || window.innerHeight;
    var base = Math.min(W, H) * it.w;
    it.node.style.width = Math.round(base) + "px";
    var x = it.fx * W, y = it.fy * H;
    it.node.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%) rotate(" + it.r.toFixed(1) + "deg) scale(" + it.s.toFixed(3) + ")";
    it.img.style.transform = it.flip ? "scaleX(-1)" : "";
    it.node.classList.toggle("is-locked", it.lock);
  }

  function select(it) {
    selected = it;
    items.forEach(function (x) { x.node.classList.toggle("is-selected", x === it); x.node.setAttribute("aria-pressed", x === it ? "true" : "false"); });
    if (it) { it.z = ++zTop; it.node.style.zIndex = String(it.z); } // bring to front
    if (it && document.activeElement !== it.node && ui.items.contains(document.activeElement)) it.node.focus({ preventScroll: true });
    updateTools();
  }

  function removeItem(it) {
    if (!it) return;
    var i = items.indexOf(it);
    if (i === -1) return;
    items.splice(i, 1);
    it.node.remove();
    if (selected === it) select(items.length ? items[items.length - 1] : null);
    if (selected) selected.node.focus({ preventScroll: true }); else ui.add.focus({ preventScroll: true });
    updateHint();
  }

  function scaleSel(k) {
    if (!selected || selected.lock) return;
    selected.s = Math.max(0.15, Math.min(6, selected.s * k));
    place(selected);
  }

  function updateTools() {
    if (!built) return;
    var d = t();
    ui.tools.hidden = !selected;
    if (!selected) return;
    ui.toolName.textContent = tr(selected.p.name) + (selected.lock ? " · " + d.camLocked : "");
    M.setIconButtonLabel(ui.lock, selected.lock ? d.camUnlock : d.camLock, selected.lock ? "unlock" : "lock");
    ui.lock.setAttribute("aria-pressed", selected.lock ? "true" : "false");
    [ui.smaller, ui.bigger, ui.turn, ui.flip].forEach(function (b) { b.disabled = selected.lock; });
  }

  function updateHint() {
    if (!built) return;
    var d = t();
    ui.ask.hidden = !items.length;
    ui.shoot.disabled = mode === "none";
    if (mode === "none") return;
    ui.hint.textContent = items.length ? (coarse() ? d.camHint : d.camHintPc) : d.camEmpty;
  }

  function keyMove(e, it) {
    var step = e.shiftKey ? 40 : 10;
    var W = ui.view.clientWidth, H = ui.view.clientHeight;
    var map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) {
      e.preventDefault();
      if (it.lock) return;
      it.fx = clamp(it.fx + map[e.key][0] / W, 0, 1);
      it.fy = clamp(it.fy + map[e.key][1] / H, 0, 1);
      place(it);
    } else if (e.key === "+" || e.key === "=") { e.preventDefault(); select(it); scaleSel(1.08); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); select(it); scaleSel(1 / 1.08); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); if (!it.lock) { it.r += 15; place(it); } }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeItem(it); }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- touch: one finger moves, two fingers size + turn ---------- */
  function attachGestures() {
    var pts = {};
    var g = null;

    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }

    function begin() {
      var ps = list();
      if (!selected || selected.lock) { g = null; return; }
      var W = ui.view.clientWidth, H = ui.view.clientHeight;
      if (ps.length === 1) {
        g = { type: "move", sx: ps[0].x, sy: ps[0].y, fx: selected.fx, fy: selected.fy, W: W, H: H };
      } else if (ps.length >= 2) {
        var a = ps[0], b = ps[1];
        g = {
          type: "pinch", d: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
          mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: selected.s, r: selected.r, fx: selected.fx, fy: selected.fy, W: W, H: H
        };
      }
    }

    ui.view.addEventListener("pointerdown", function (e) {
      if (!ui.pick.hidden || !ui.shot.hidden) return;
      var itemNode = e.target.closest && e.target.closest(".cam-item");
      var count = Object.keys(pts).length;
      if (itemNode) {
        var it = items.filter(function (x) { return x.node === itemNode; })[0];
        if (it && count === 0) {
          select(it);
          if (document.activeElement !== it.node) it.node.focus({ preventScroll: true }); // keyboard keys work after a click
        }
      } else if (count === 0) {
        select(null);
        return;
      }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { ui.view.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      begin();
      e.preventDefault();
    });
    ui.view.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (!g || !selected) return;
      var ps = list();
      if (g.type === "move" && ps.length === 1) {
        selected.fx = clamp(g.fx + (ps[0].x - g.sx) / g.W, -0.1, 1.1);
        selected.fy = clamp(g.fy + (ps[0].y - g.sy) / g.H, -0.1, 1.1);
        place(selected);
      } else if (g.type === "pinch" && ps.length >= 2) {
        var a = ps[0], b = ps[1];
        var dd = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        var ang = Math.atan2(b.y - a.y, b.x - a.x);
        selected.s = clamp(g.s * dd / g.d, 0.15, 6);
        selected.r = g.r + (ang - g.ang) * 180 / Math.PI;
        selected.fx = clamp(g.fx + ((a.x + b.x) / 2 - g.mx) / g.W, -0.1, 1.1);
        selected.fy = clamp(g.fy + ((a.y + b.y) / 2 - g.my) / g.H, -0.1, 1.1);
        place(selected);
      }
    });
    function end(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      begin(); // continue with the fingers that are left
    }
    ui.view.addEventListener("pointerup", end);
    ui.view.addEventListener("pointercancel", end);
    ui.view.addEventListener("wheel", function (e) {
      if (!selected || selected.lock) return;
      e.preventDefault();
      if (e.shiftKey) { selected.r += e.deltaY > 0 ? 6 : -6; place(selected); }
      else scaleSel(e.deltaY < 0 ? 1.06 : 1 / 1.06);
    }, { passive: false });
  }

  /* ---------- product picker ---------- */
  function openPicker() {
    ui.pickSearch.value = "";
    drawPicker();
    ui.pick.hidden = false;
    stage.classList.add("pick-open");
    ui.pickSearch.focus({ preventScroll: true });
  }
  function closePicker() {
    if (ui.pick.hidden) return;
    ui.pick.hidden = true;
    stage.classList.remove("pick-open");
    ui.add.focus({ preventScroll: true });
  }
  function drawPicker() {
    var q = M.normalize(ui.pickSearch.value || "");
    ui.pickGrid.textContent = "";
    var list = M.PRODUCTS.filter(function (p) { return M.cutout(p) && (!q || M.searchText(p).indexOf(q) !== -1); });
    if (!list.length) { ui.pickGrid.appendChild(el("p", "cam-pick-empty", t().noResults)); return; }
    list.forEach(function (p) {
      var b = el("button", "cam-pick-item");
      b.type = "button";
      var img = document.createElement("img");
      img.src = M.cutout(p).src;
      img.alt = "";
      img.loading = "lazy";
      b.appendChild(img);
      b.appendChild(el("span", null, tr(p.name)));
      b.addEventListener("click", function () {
        closePicker();
        var it = addItem(p, true);
        if (it) it.node.focus({ preventScroll: true });
      });
      ui.pickGrid.appendChild(b);
    });
  }

  /* ---------- take a photo ---------- */
  function takePhoto() {
    if (mode === "none") return;
    var W = ui.view.clientWidth, H = ui.view.clientHeight;
    var scale = Math.min(2, Math.max(1, 1600 / Math.max(W, H)));
    var c = document.createElement("canvas");
    c.width = Math.round(W * scale);
    c.height = Math.round(H * scale);
    var ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    var src = mode === "live" ? ui.video : stillSource;
    if (src) {
      var sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
      if (sw && sh) { var r = coverRect(sw, sh, W, H); ctx.drawImage(src, r.x, r.y, r.w, r.h); }
    }
    // products, in the same order as on screen
    items.slice().sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (it) {
      if (!it.img.naturalWidth) return;
      var base = Math.min(W, H) * it.w;
      var w = base * it.s, h = w * it.img.naturalHeight / it.img.naturalWidth;
      ctx.save();
      ctx.translate(it.fx * W, it.fy * H);
      ctx.rotate(it.r * Math.PI / 180);
      if (it.flip) ctx.scale(-1, 1);
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 14;
      ctx.drawImage(it.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
    // small brand line
    var fs = Math.max(12, Math.round(Math.min(W, H) * 0.032));
    ctx.font = "800 " + fs + "px Inter, Arial, sans-serif";
    ctx.textBaseline = "bottom";
    var label = "MARSHAL FITNESS · Erbil";
    var tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(10, H - fs - 22, tw + 24, fs + 14);
    ctx.fillStyle = "#f2b807";
    ctx.fillText(label, 22, H - 15);

    c.toBlob(function (blob) {
      if (!blob) return;
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      shotBlob = blob;
      shotUrl = URL.createObjectURL(blob);
      ui.shotImg.src = shotUrl;
      ui.save.href = shotUrl;
      var file = null;
      try { file = new File([blob], "marshal-fitness-my-room.jpg", { type: "image/jpeg" }); } catch (e) { file = null; }
      ui.share.hidden = !(file && navigator.canShare && navigator.canShare({ files: [file] }));
      ui.shotAsk.hidden = !items.length;
      M.setIconButtonLabel(ui.back, mode === "photo" ? t().tourBack : t().camRetake, mode === "photo" ? "left" : "camera");
      ui.shot.hidden = false;
      stage.classList.add("shot-open");
      ui.save.focus({ preventScroll: true });
      if (!M.reducedMotion()) {
        var flash = el("div", "cam-flash");
        stage.appendChild(flash);
        setTimeout(function () { flash.remove(); }, 450);
      }
    }, "image/jpeg", 0.9);
  }

  function closeShot() {
    if (ui.shot.hidden) return;
    ui.shot.hidden = true;
    stage.classList.remove("shot-open");
    ui.shoot.focus({ preventScroll: true });
  }

  function sharePhoto() {
    if (!shotBlob || !navigator.share) return;
    var file = new File([shotBlob], "marshal-fitness-my-room.jpg", { type: "image/jpeg" });
    navigator.share({ files: [file], title: "Marshal Fitness", text: t().camShareText }).catch(function () { /* cancelled */ });
  }

  function askPrice(btn) {
    var d = t();
    var seen = [];
    var list = items.filter(function (it) { if (seen.indexOf(it.p) !== -1) return false; seen.push(it.p); return true; }).map(function (it) { return it.p; });
    if (!list.length) return;
    var lines = [d.camWaIntro, ""];
    list.forEach(function (p, i) {
      lines.push((i + 1) + ". " + M.waProductName(p, tr(p.name)) + (p.no ? " (" + d.itemNo + " " + p.no + ")" : ""));
    });
    var message = lines.join("\n");
    if (window.MF_REQUEST) {
      window.MF_REQUEST.open({
        kind: "camera", message: message, item: d.camOpen,
        items: list.map(function (p) { return { name: M.waProductName(p, tr(p.name)), no: p.no || "", qty: 1, image: p.image }; })
      }, btn);
    } else {
      window.open(M.waUrl(message), "_blank", "noopener");
    }
  }

  /* ---------- open / close ---------- */
  function open(p, opener) {
    build();
    texts();
    ui.shot.hidden = true;
    ui.pick.hidden = true;
    stage.classList.remove("shot-open", "pick-open");
    M.openStage(stage, opener || null, ui.close);
    if (p && M.cutout(p)) {
      var have = items.filter(function (x) { return x.p === p; })[0];
      if (have) select(have); else addItem(p, true);
    }
    items.forEach(place);
    if (mode === "frozen" || mode === "photo") { redrawStill(); setMode(mode); }
    else startCamera(false);
    if (selected) selected.node.focus({ preventScroll: true });
  }

  function close() { M.closeStage(stage); }

  stage.addEventListener("stage-close", function () {
    stopStream();
    if (mode === "live") mode = "none";
    closePicker();
    if (ui.shot) { ui.shot.hidden = true; stage.classList.remove("shot-open"); }
  });

  M.openCamera = open;
  M.onRender(function () { if (built) texts(); });
})();
