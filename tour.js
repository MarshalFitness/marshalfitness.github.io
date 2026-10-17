/* Marshal Fitness — showroom walk tour.
   18 photos from the shop door to the office. The customer walks forward with
   a smooth "step inside" movement, looks around by moving the phone (or
   dragging), and taps gold dots to see the products. Photos: assets/tour.
   Dots and captions come from content.js (window.TOUR) and the admin page. */
(function () {
  "use strict";
  var M = window.MF;
  var stage = document.getElementById("tourStage");
  if (!M || !stage || !window.TOUR || !M.openStage) return;

  var BASE = "assets/tour/";
  var ASPECT = 3 / 4; // photo width / height
  var AUTO_MS = 4200;
  var root = document.documentElement;

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }
  function rtl() { return root.dir === "rtl"; }

  /* ---------- data ---------- */
  function stops() {
    var edit = window.TOUR_EDIT && Array.isArray(window.TOUR_EDIT.stops) ? window.TOUR_EDIT.stops : [];
    return window.TOUR.stops.map(function (s, i) {
      var e = edit.filter(function (x) { return x && x.img === s.img; })[0] || (edit[i] && !edit[i].img ? edit[i] : null);
      return {
        img: s.img, area: s.area,
        dots: e && Array.isArray(e.dots) ? e.dots : s.dots,
        cap: e && e.cap ? e.cap : null,
        hidden: !!(e && e.hidden)
      };
    }).filter(function (s) { return !s.hidden; });
  }

  function targetProducts(d) {
    if (d.p) { var one = M.productByImage(d.p); return one ? [one] : []; }
    if (d.series) return M.PRODUCTS.filter(function (p) { return p.series === d.series; });
    if (d.cat) return M.PRODUCTS.filter(function (p) { return p.cat === d.cat; });
    return [];
  }
  function targetName(d) {
    if (d.p) { var one = M.productByImage(d.p); return one ? tr(one.name) : ""; }
    if (d.series) {
      var s = (window.GYM_SERIES || []).filter(function (x) { return x.id === d.series; })[0];
      return s ? s.name : "";
    }
    return M.catName(d.cat);
  }

  /* ---------- state ---------- */
  var list = [];
  var index = 0;
  var built = false;
  var busy = false;
  var auto = null;
  var ui = {};
  var layers = [];
  var cur = 0; // which layer is in front
  var geo = { w: 0, h: 0, mode: "cover", rangeX: 0, rangeY: 0 };
  var pan = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }; // 0..1 inside the pan range
  var tilt = { on: false, base: null, x: 0 };
  var raf = 0;

  /* ---------- build ---------- */
  function build() {
    if (built) return;
    built = true;
    var d = t();

    ui.view = el("div", "tour-viewport");
    ui.bg = el("div", "tour-bg");
    ui.bg.setAttribute("aria-hidden", "true");
    ui.scene = el("div", "tour-scene");
    for (var i = 0; i < 2; i++) {
      var layer = el("div", "tour-layer");
      var kb = el("div", "tour-kb");
      var img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      kb.appendChild(img);
      var dots = el("div", "tour-dots");
      kb.appendChild(dots);
      layer.appendChild(kb);
      ui.scene.appendChild(layer);
      layers.push({ node: layer, img: img, dots: dots });
    }
    ui.view.appendChild(ui.bg);
    ui.view.appendChild(ui.scene);
    ui.walk = M.iconButton("tour-walk", "right", d.tourNext);
    ui.walk.addEventListener("click", function () { stopAuto(); go(index + 1); });
    ui.view.appendChild(ui.walk);
    ui.spinner = el("div", "tour-spinner");
    ui.spinner.setAttribute("aria-hidden", "true");
    ui.view.appendChild(ui.spinner);
    stage.appendChild(ui.view);

    // top bar
    ui.top = el("div", "tour-top");
    ui.close = M.iconButton("tour-x", "close", d.close);
    ui.close.addEventListener("click", close);
    ui.title = el("h2", "sr-only");
    ui.title.id = "tourStageTitle";
    ui.areas = el("div", "tour-areas");
    ui.areas.setAttribute("role", "group");
    ui.stepBox = el("div", "tour-stepbox");
    ui.step = el("p", "tour-step");
    ui.cap = el("p", "tour-cap");
    ui.cap.dir = "auto";
    ui.stepBox.appendChild(ui.step);
    ui.stepBox.appendChild(ui.cap);
    ui.top.appendChild(ui.title);
    ui.top.appendChild(ui.areas);
    ui.top.appendChild(ui.close);
    stage.appendChild(ui.top);
    stage.appendChild(ui.stepBox);

    // bottom bar
    ui.bottom = el("div", "tour-bottom");
    ui.hint = el("p", "tour-hint");
    ui.controls = el("div", "tour-controls");
    ui.back = M.iconButton("tour-btn tour-back", "left", d.tourBack, true);
    ui.back.addEventListener("click", function () { stopAuto(); go(index - 1); });
    ui.play = M.iconButton("tour-btn tour-play", "play", d.tourPlay, true);
    ui.play.addEventListener("click", function () { if (auto) stopAuto(); else startAuto(); });
    ui.next = M.iconButton("tour-btn tour-next", "right", d.tourNext, true);
    ui.next.addEventListener("click", function () { stopAuto(); go(index + 1); });
    ui.controls.appendChild(ui.back);
    ui.controls.appendChild(ui.play);
    ui.controls.appendChild(ui.next);
    ui.bottom.appendChild(ui.hint);
    ui.bottom.appendChild(ui.controls);
    stage.appendChild(ui.bottom);

    // welcome screen at the door
    ui.intro = el("div", "tour-intro");
    var logo = document.createElement("img");
    logo.className = "tour-logo";
    logo.alt = "";
    logo.src = M.S.logo || "assets/logo.png";
    logo.addEventListener("error", function () { logo.hidden = true; });
    ui.introLogo = logo;
    ui.introTitle = el("p", "tour-intro-title");
    ui.introSub = el("p", "tour-intro-sub");
    ui.enter = el("button", "tour-enter");
    ui.enter.type = "button";
    ui.enter.addEventListener("click", enter);
    ui.intro.appendChild(logo);
    ui.intro.appendChild(ui.introTitle);
    ui.intro.appendChild(ui.introSub);
    ui.intro.appendChild(ui.enter);
    stage.appendChild(ui.intro);

    // thank-you screen after the office
    ui.end = el("div", "tour-end");
    ui.end.hidden = true;
    ui.endTitle = el("p", "tour-end-title");
    ui.endText = el("p", "tour-end-text");
    ui.endBtns = el("div", "tour-end-btns");
    ui.end.appendChild(ui.endTitle);
    ui.end.appendChild(ui.endText);
    ui.end.appendChild(ui.endBtns);
    stage.appendChild(ui.end);

    // products for a gold dot
    ui.sheet = el("div", "tour-sheet");
    ui.sheet.hidden = true;
    ui.sheet.setAttribute("role", "region");
    var sheetHead = el("div", "tour-sheet-head");
    ui.sheetTitle = el("h3", "tour-sheet-title");
    ui.sheetTitle.id = "tourSheetTitle";
    ui.sheet.setAttribute("aria-labelledby", "tourSheetTitle");
    ui.sheetClose = M.iconButton("tour-sheet-x", "close", d.close);
    ui.sheetClose.addEventListener("click", closeSheet);
    sheetHead.appendChild(ui.sheetTitle);
    sheetHead.appendChild(ui.sheetClose);
    ui.sheet.appendChild(sheetHead);
    ui.sheetRow = el("div", "tour-sheet-row");
    ui.sheet.appendChild(ui.sheetRow);
    stage.appendChild(ui.sheet);

    ui.live = el("p", "sr-only");
    ui.live.setAttribute("aria-live", "polite");
    stage.appendChild(ui.live);

    attachLook();
    stage.addEventListener("stage-escape", function (e) {
      if (!ui.sheet.hidden) { e.preventDefault(); closeSheet(); }
    });
    stage.addEventListener("keydown", function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (root.classList.contains("lb-open")) return;
      var fwd = rtl() ? "ArrowLeft" : "ArrowRight", bwd = rtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd || e.key === "PageDown") { e.preventDefault(); stopAuto(); go(index + 1); }
      else if (e.key === bwd || e.key === "PageUp") { e.preventDefault(); stopAuto(); go(index - 1); }
    });
    window.addEventListener("resize", function () { if (!stage.hidden) layout(); });
  }

  /* ---------- texts ---------- */
  function texts() {
    var d = t();
    ui.title.textContent = d.tourOpen;
    stage.setAttribute("aria-label", d.tourOpen);
    M.setIconButtonLabel(ui.close, d.close);
    M.setIconButtonLabel(ui.back, d.tourBack);
    M.setIconButtonLabel(ui.next, d.tourNext);
    M.setIconButtonLabel(ui.walk, d.tourNext);
    M.setIconButtonLabel(ui.play, auto ? d.tourPause : d.tourPlay, auto ? "pause" : "play");
    M.setIconButtonLabel(ui.sheetClose, d.close);
    ui.areas.setAttribute("aria-label", d.tourOpen);
    ui.hint.textContent = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? d.tourLook : d.tourLookPc;
    ui.introTitle.textContent = d.tourWelcome;
    ui.introSub.textContent = d.tourSub;
    ui.enter.textContent = d.tourEnter;
    ui.endTitle.textContent = d.tourEndTitle;
    ui.endText.textContent = d.tourEndText;
    buildEndButtons();
    buildAreas();
    updateBars();
    // dot labels on the visible photo
    renderDots(layers[cur], list[index]);
  }

  function buildAreas() {
    ui.areas.textContent = "";
    var names = t().tourAreas || {};
    window.TOUR.areas.forEach(function (a) {
      var first = -1;
      for (var i = 0; i < list.length; i++) if (list[i].area === a) { first = i; break; }
      if (first === -1) return;
      var b = el("button", "tour-area", names[a] || a);
      b.type = "button";
      b.setAttribute("data-area", a);
      b.addEventListener("click", function () { stopAuto(); go(first); });
      ui.areas.appendChild(b);
    });
  }

  function buildEndButtons() {
    var d = t();
    ui.endBtns.textContent = "";
    function link(cls, ic, label, href, ext) {
      var a = el("a", "tour-end-btn " + cls);
      a.href = href;
      if (ext) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      a.innerHTML = M.icon(ic);
      a.appendChild(el("span", null, label));
      ui.endBtns.appendChild(a);
    }
    link("is-wa", "wa", d.waFloat, M.waUrl(d.askGeneral), true);
    link("", "phone", d.callBtn, "tel:+" + M.S.phone, false);
    link("", "map", d.directionsBtn, "https://www.google.com/maps/dir/?api=1&destination=" + M.S.lat + "," + M.S.lng, true);
    var again = M.iconButton("tour-end-btn", "rotate", d.tourAgain, true);
    again.addEventListener("click", function () {
      ui.end.hidden = true;
      covers();
      go(0, true);
      ui.next.focus({ preventScroll: true }); // the pressed button is gone: keep the keyboard in the tour
    });
    ui.endBtns.appendChild(again);
    var done = M.iconButton("tour-end-btn", "close", d.close, true);
    done.addEventListener("click", close);
    ui.endBtns.appendChild(done);
  }

  function updateBars() {
    if (!list.length) return;
    var d = t();
    var s = list[index];
    ui.step.textContent = d.tourStep(index + 1, list.length);
    var cap = s.cap ? (s.cap[M.lang()] || s.cap.en || "") : "";
    ui.cap.textContent = cap;
    ui.cap.hidden = !cap;
    ui.areas.querySelectorAll(".tour-area").forEach(function (b) {
      var on = b.getAttribute("data-area") === s.area;
      b.setAttribute("aria-current", on ? "step" : "false");
      if (on && b.scrollIntoView && ui.areas.scrollWidth > ui.areas.clientWidth) {
        var r = b.getBoundingClientRect(), pr = ui.areas.getBoundingClientRect();
        if (r.left < pr.left || r.right > pr.right) ui.areas.scrollLeft += (r.left + r.width / 2) - (pr.left + pr.width / 2);
      }
    });
    ui.back.disabled = index === 0;
    var areaName = (d.tourAreas || {})[s.area] || "";
    ui.live.textContent = areaName + " — " + d.tourStep(index + 1, list.length);
  }

  /* ---------- size of the photo on the screen ----------
     Phone (tall screen): the photo fills the height and is wider than the screen,
     so the customer can look left and right. Computer (wide screen): the whole
     photo is shown, with a soft blurred copy behind it. */
  function layout() {
    var W = ui.view.clientWidth || window.innerWidth, H = ui.view.clientHeight || window.innerHeight;
    var w, h;
    if (W / H > 1.02) { // wide: show all of it
      h = H; w = H * ASPECT;
      geo.mode = "contain";
    } else { // tall: fill the screen, look around inside it
      if (W / H < ASPECT) { h = H; w = H * ASPECT; } else { w = W; h = W / ASPECT; }
      geo.mode = "cover";
    }
    geo.w = w; geo.h = h;
    geo.rangeX = Math.max(0, w - W);
    geo.rangeY = Math.max(0, h - H);
    geo.W = W; geo.H = H;
    ui.scene.style.width = Math.round(w) + "px";
    ui.scene.style.height = Math.round(h) + "px";
    stage.classList.toggle("is-wide", geo.mode === "contain");
    applyPan(true);
  }

  // phone: start each photo looking at its gold dots (they can be near the sides)
  function startPan(s) {
    pan.tx = 0.5; pan.ty = 0.5;
    if (geo.mode !== "cover" || !s || !s.dots || !s.dots.length) return;
    var xs = s.dots.filter(function (d) { return targetProducts(d).length; }).map(function (d) { return Number(d.x) || 50; });
    if (!xs.length || !geo.rangeX) return;
    var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2 / 100 * geo.w;
    pan.tx = clamp01((cx - geo.W / 2) / geo.rangeX);
  }

  // put each dot's name on the side where there is room on the screen
  var labelTick = 0;
  function sideLabels() {
    var front = layers[cur];
    if (!front) return;
    var vw = geo.W || window.innerWidth;
    var isRtl = rtl();
    front.dots.querySelectorAll(".tour-dot").forEach(function (b) {
      var r = b.getBoundingClientRect();
      var label = b.querySelector(".tour-dot-label");
      var lw = label ? label.offsetWidth + 28 : 140;
      var roomEnd = isRtl ? r.left : vw - r.right;     // space after the dot (reading direction)
      var roomStart = isRtl ? vw - r.right : r.left;
      b.classList.toggle("label-start", roomEnd < lw && roomStart > roomEnd);
      b.classList.toggle("is-off", r.right < 4 || r.left > vw - 4); // dot outside the screen: hide its name
    });
  }

  function applyPan(now) {
    if (now) { pan.x = pan.tx; pan.y = pan.ty; }
    var x, y;
    if (geo.mode === "contain") {
      x = (geo.W - geo.w) / 2 + (pan.x - 0.5) * 24; // small movement only
      y = (pan.y - 0.5) * 16;
    } else {
      x = -geo.rangeX * pan.x;
      y = -geo.rangeY * pan.y;
    }
    ui.scene.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
    if (now || ++labelTick % 6 === 0) sideLabels();
  }

  function loop() {
    raf = 0;
    if (stage.hidden) return;
    var tx = pan.tx, ty = pan.ty;
    if (tilt.on && geo.mode === "cover") tx = clamp01(pan.tx + tilt.x);
    var dx = tx - pan.x, dy = ty - pan.y;
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
      pan.x += dx * 0.14;
      pan.y += dy * 0.14;
      applyPan(false);
    }
    raf = requestAnimationFrame(loop);
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  /* ---------- look around: drag, mouse, phone tilt ---------- */
  function attachLook() {
    var drag = null;
    ui.view.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      if (e.button !== undefined && e.button > 0) return;
      drag = { x: e.clientX, y: e.clientY, px: pan.tx, py: pan.ty, moved: false };
      try { ui.view.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    ui.view.addEventListener("pointermove", function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (geo.mode === "cover") {
          if (geo.rangeX) pan.tx = clamp01(drag.px - dx / geo.rangeX);
          if (geo.rangeY) pan.ty = clamp01(drag.py - dy / geo.rangeY);
        }
        if (drag.moved) stopAuto();
      } else if (geo.mode === "contain" && e.pointerType === "mouse") {
        // computer: the photo follows the mouse a little
        var r = ui.view.getBoundingClientRect();
        pan.tx = clamp01((e.clientX - r.left) / r.width);
        pan.ty = clamp01((e.clientY - r.top) / r.height);
      }
    });
    function end() { drag = null; }
    ui.view.addEventListener("pointerup", end);
    ui.view.addEventListener("pointercancel", end);

  }

  function onTilt(e) {
    if (stage.hidden || typeof e.gamma !== "number" || e.gamma === null) return;
    var g = e.gamma;
    if (tilt.base === null) tilt.base = g;
    var diff = g - tilt.base;
    if (diff > 60) diff -= 180;
    if (diff < -60) diff += 180;
    tilt.x = Math.max(-0.5, Math.min(0.5, diff / 50));
    tilt.on = true;
  }

  // the welcome / thank-you screens cover the photo: what is under them cannot be reached by keyboard
  function covers() {
    if (!built) return;
    var cover = stage.classList.contains("at-intro") || !ui.end.hidden;
    [ui.view, ui.bottom, ui.areas, ui.stepBox].forEach(function (n) {
      if (cover) n.setAttribute("inert", ""); else n.removeAttribute("inert");
    });
  }

  function askMotion() {
    // iPhone: moving the phone to look around needs a "yes" from the customer
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().catch(function () { /* drag still works */ });
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- gold dots ---------- */
  function renderDots(layer, s) {
    if (!layer || !s) return;
    layer.dots.textContent = "";
    (s.dots || []).forEach(function (d, i) {
      var items = targetProducts(d);
      if (!items.length) return;
      var name = targetName(d);
      var b = el("button", "tour-dot");
      b.type = "button";
      b.style.left = Math.max(2, Math.min(98, Number(d.x) || 50)) + "%";
      b.style.top = Math.max(2, Math.min(98, Number(d.y) || 50)) + "%";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", t().tourDotLabel + ": " + name);
      b.appendChild(el("span", "tour-dot-core"));
      var label = el("span", "tour-dot-label", name);
      label.dir = "auto";
      b.appendChild(label);
      b.addEventListener("click", function () {
        stopAuto();
        if (d.p) M.openLightbox(items[0], b);
        else openSheet(name, items, b);
      });
      layer.dots.appendChild(b);
    });
  }

  var sheetOpener = null;
  function openSheet(name, items, opener) {
    sheetOpener = opener;
    ui.sheetTitle.textContent = name;
    ui.sheetRow.textContent = "";
    items.slice(0, 24).forEach(function (p) {
      var b = el("button", "tour-prod");
      b.type = "button";
      var img = document.createElement("img");
      img.src = M.imgSrc(p);
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      b.appendChild(img);
      b.appendChild(el("span", null, tr(p.name)));
      b.addEventListener("click", function () { M.openLightbox(p, b); });
      ui.sheetRow.appendChild(b);
    });
    ui.sheet.hidden = false;
    stage.classList.add("sheet-open");
    ui.sheetRow.scrollLeft = 0;
    var first = ui.sheetRow.querySelector("button");
    (first || ui.sheetClose).focus({ preventScroll: true });
  }
  function closeSheet() {
    if (ui.sheet.hidden) return;
    ui.sheet.hidden = true;
    stage.classList.remove("sheet-open");
    if (sheetOpener && document.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true });
    sheetOpener = null;
  }

  /* ---------- walking ---------- */
  function srcOf(s) { return BASE + s.img + ".webp"; }
  function smallOf(s) { return BASE + s.img + "-s.webp"; }

  var preloaded = {};
  function preload(i) {
    if (i < 0 || i >= list.length) return;
    var src = srcOf(list[i]);
    if (preloaded[src]) return;
    var im = new Image();
    im.decoding = "async";
    im.src = src;
    preloaded[src] = im;
  }

  function loadInto(layer, s) {
    return new Promise(function (resolve) {
      var img = layer.img;
      var src = srcOf(s);
      layer.node.style.backgroundImage = "url('" + smallOf(s) + "')";
      if (img.getAttribute("src") === src && img.complete && img.naturalWidth) { resolve(); return; }
      var done = false;
      function finish() { if (done) return; done = true; resolve(); }
      img.onload = function () {
        if (img.decode) img.decode().then(finish, finish); else finish();
      };
      img.onerror = finish;
      img.src = src;
      setTimeout(finish, 6000); // never wait forever
    });
  }

  var session = 0;
  function go(i, fromStart) {
    if (busy || !list.length) return;
    if (i >= list.length) { showEnd(); return; }
    if (i < 0) return;
    closeSheet();
    hideIntroIfNeeded(i);
    if (i === index && !fromStart) return;
    var dir = i > index ? 1 : -1;
    if (fromStart) dir = -1;
    var from = layers[cur], to = layers[1 - cur];
    busy = true;
    var mine = session;
    var spin = setTimeout(function () { ui.spinner.classList.add("show"); }, 220);
    loadInto(to, list[i]).then(function () {
      clearTimeout(spin);
      ui.spinner.classList.remove("show");
      if (mine !== session) return; // the tour was closed (or opened again) meanwhile
      index = i;
      renderDots(to, list[i]);
      ui.end.hidden = true;
      covers();
      stage.classList.toggle("at-end", index === list.length - 1);
      startPan(list[i]);
      tilt.base = null;
      animate(from, to, dir).then(function () {
        if (mine !== session) return;
        cur = 1 - cur;
        busy = false;
        sideLabels();
        updateBars();
        ui.bg.style.backgroundImage = "url('" + srcOf(list[index]) + "')";
        preload(index + 1); preload(index + 2); preload(index - 1);
        if (auto) scheduleAuto();
      });
    });
  }

  function animate(from, to, dir) {
    return new Promise(function (resolve) {
      to.node.classList.add("is-front");
      from.node.classList.remove("is-front");
      var fast = M.reducedMotion() || !to.node.animate;
      if (fast) {
        to.node.style.opacity = "1";
        from.node.style.opacity = "0";
        resolve();
        return;
      }
      var dur = 820;
      var ease = "cubic-bezier(.45,.05,.25,1)";
      var leave = dir > 0
        ? [{ transform: "scale(1)", opacity: 1, filter: "blur(0px)" }, { transform: "scale(1.32)", opacity: 0, filter: "blur(6px)" }]
        : [{ transform: "scale(1)", opacity: 1, filter: "blur(0px)" }, { transform: "scale(.86)", opacity: 0, filter: "blur(6px)" }];
      var enter = dir > 0
        ? [{ transform: "scale(.9)", opacity: 0, filter: "blur(4px)" }, { transform: "scale(1)", opacity: 1, filter: "blur(0px)" }]
        : [{ transform: "scale(1.16)", opacity: 0, filter: "blur(4px)" }, { transform: "scale(1)", opacity: 1, filter: "blur(0px)" }];
      // where the customer "walks to": the middle of the screen
      var origin = originInScene();
      from.node.style.transformOrigin = origin;
      to.node.style.transformOrigin = origin;
      to.node.style.opacity = "1";
      from.node.animate(leave, { duration: dur, easing: ease, fill: "forwards" });
      var a = to.node.animate(enter, { duration: dur, easing: ease });
      var finished = false;
      function done() {
        if (finished) return;
        finished = true;
        from.node.getAnimations().forEach(function (an) { an.cancel(); });
        from.node.style.opacity = "0";
        resolve();
      }
      a.onfinish = done;
      setTimeout(done, dur + 400);
    });
  }

  function originInScene() {
    // centre of the screen, measured inside the photo (in %)
    var r = ui.scene.getBoundingClientRect(), v = ui.view.getBoundingClientRect();
    var cx = (v.left + v.width / 2 - r.left) / (r.width || 1) * 100;
    var cy = (v.top + v.height * 0.55 - r.top) / (r.height || 1) * 100;
    return Math.max(0, Math.min(100, cx)).toFixed(1) + "% " + Math.max(0, Math.min(100, cy)).toFixed(1) + "%";
  }

  /* ---------- welcome + end ---------- */
  function hideIntroIfNeeded() {
    if (!ui.intro.hidden) {
      ui.intro.classList.add("leaving");
      setTimeout(function () { ui.intro.hidden = true; ui.intro.classList.remove("leaving"); }, M.reducedMotion() ? 0 : 500);
      stage.classList.remove("at-intro");
      covers();
    }
  }

  var hintTimer = null;
  function enter() {
    askMotion();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { stage.classList.add("hint-done"); }, 7000);
    go(1);
    setTimeout(function () { if (!stage.hidden) ui.next.focus({ preventScroll: true }); }, 60);
  }

  function showEnd() {
    stopAuto();
    closeSheet();
    ui.end.hidden = false;
    covers();
    var first = ui.endBtns.querySelector("a,button");
    if (first) first.focus({ preventScroll: true });
    ui.live.textContent = t().tourEndTitle;
  }

  /* ---------- auto walk ---------- */
  var autoTimer = null;
  function startAuto() {
    auto = true;
    if (!ui.intro.hidden) { askMotion(); }
    M.setIconButtonLabel(ui.play, t().tourPause, "pause");
    ui.play.setAttribute("aria-pressed", "true");
    if (!ui.intro.hidden || index === 0) go(index + 1); else scheduleAuto(true);
  }
  function scheduleAuto(soon) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (!auto || stage.hidden) return;
      if (root.classList.contains("lb-open") || !ui.sheet.hidden) { scheduleAuto(); return; }
      go(index + 1);
    }, soon ? 1200 : AUTO_MS);
  }
  function stopAuto() {
    if (!auto) return;
    auto = null;
    clearTimeout(autoTimer);
    M.setIconButtonLabel(ui.play, t().tourPlay, "play");
    ui.play.setAttribute("aria-pressed", "false");
  }

  /* ---------- open / close ---------- */
  function open(opener) {
    build();
    list = stops();
    if (!list.length) return;
    session++;
    busy = false;
    ui.spinner.classList.remove("show");
    index = 0;
    cur = 0;
    ui.end.hidden = true;
    ui.sheet.hidden = true;
    stage.classList.remove("sheet-open", "at-end");
    stage.classList.add("at-intro");
    stage.classList.remove("hint-done");
    ui.intro.hidden = false;
    layers.forEach(function (l) { l.node.classList.remove("is-front"); l.node.style.opacity = "0"; });
    var first = layers[0];
    first.node.classList.add("is-front");
    first.node.style.opacity = "1";
    texts();
    covers();
    M.openStage(stage, opener || null, ui.enter);
    layout();
    pan.tx = 0.5; pan.ty = 0.5; // the shop door: straight on
    applyPan(true);
    loadInto(first, list[0]).then(function () {
      renderDots(first, list[0]);
      sideLabels();
      ui.bg.style.backgroundImage = "url('" + srcOf(list[0]) + "')";
    });
    updateBars();
    preload(1); preload(2);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function close() {
    stopAuto();
    M.closeStage(stage);
  }
  stage.addEventListener("stage-close", function () {
    stopAuto();
    closeSheet();
    session++;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    busy = false;
    ui.spinner.classList.remove("show");
    window.removeEventListener("deviceorientation", onTilt);
    tilt.on = false;
  });
  stage.addEventListener("stage-open", function () {
    if (!raf && built) raf = requestAnimationFrame(loop);
    window.addEventListener("deviceorientation", onTilt);
  });

  M.openTour = open;
  ["navTourOpen", "tourCard", "heroTourOpen"].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { open(b); });
  });
  M.onRender(function () { if (built && !stage.hidden) { list = stops(); texts(); } });
})();
