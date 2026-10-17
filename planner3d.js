/* Marshal Fitness — 3D view for "Will it fit?".
   The same room as the 2D plan, in 3D: the floor in the real size, every
   product on its real floor size with its photo (without background) standing
   on it. Drag to turn the room, two fingers or the mouse wheel to zoom.
   three.js (lib/three.module.min.js, MIT licence) loads only when 3D is opened. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.onPlannerDraw || !M.plannerData) return;

  var LIB = "lib/three.module.min.js";
  var THREE = null;
  var loading = null;
  var active = false;
  var ui = {};
  var g = null; // three.js things
  var texCache = {};
  var root = document.documentElement;

  function t() { return M.t(); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }

  /* ---------- heights (m) for the standing photos ---------- */
  var HEIGHTS = [
    ["treadmill", 1.45], ["bike", 1.25], ["rowing", 0.75], ["bench", 0.75], ["dumbbell", 0.22], ["plate", 0.46],
    ["ball", 0.65], ["band", 0.25], ["handle", 0.22], ["belt", 0.3], ["strap", 0.25], ["mat", 0.22],
    ["leg press", 1.55], ["hack squat", 1.6], ["smith", 2.2], ["squat", 1.9], ["multi flight", 2.2],
    ["pull down", 2.1], ["pulldown", 2.1], ["dip", 2.1], ["chin", 2.1], ["low row", 1.4], ["row", 1.6],
    ["press", 1.6], ["curl", 1.4], ["extension", 1.45], ["calf", 1.2], ["glute", 1.5], ["abductor", 1.5], ["adductor", 1.5]
  ];
  function heightOf(p) {
    var name = String(typeof p.name === "string" ? p.name : (p.name.en || "")).toLowerCase();
    for (var i = 0; i < HEIGHTS.length; i++) if (new RegExp("\\b" + HEIGHTS[i][0]).test(name)) return HEIGHTS[i][1];
    if (p.cat === "treadmills") return 1.45;
    if (p.cat === "bikes") return 1.25;
    if (p.cat === "free-weights") return 0.4;
    if (p.cat === "accessories") return 0.3;
    return 1.7;
  }
  function lying(p) {
    var name = String(typeof p.name === "string" ? p.name : (p.name.en || "")).toLowerCase();
    return /\bbarbell\b/.test(name);
  }

  /* ---------- the 2D / 3D switch inside the planner ---------- */
  function ensureUi() {
    var data = M.plannerData();
    var pui = data.ui;
    if (!pui || !pui.stage) return false;
    var wrap = pui.stage.parentNode; // .pl-stage-wrap
    if (ui.wrap === wrap && ui.box && document.contains(ui.box)) return true;
    ui.wrap = wrap;
    ui.status = pui.status;
    ui.tools = pui.tools;
    ui.hint2d = pui.hint;

    ui.switcher = el("div", "pl-view");
    ui.switcher.setAttribute("role", "group");
    ui.b2 = el("button", "pl-view-btn");
    ui.b2.type = "button";
    ui.b3 = el("button", "pl-view-btn");
    ui.b3.type = "button";
    ui.b2.addEventListener("click", function () { setActive(false); });
    ui.b3.addEventListener("click", function () { setActive(true); });
    ui.switcher.appendChild(ui.b2);
    ui.switcher.appendChild(ui.b3);
    wrap.parentNode.insertBefore(ui.switcher, wrap);

    ui.box = el("div", "pl-3d");
    ui.box.hidden = true;
    ui.canvasWrap = el("div", "pl-3d-canvas");
    ui.canvasWrap.tabIndex = 0;
    ui.canvasWrap.setAttribute("role", "img");
    ui.msg = el("p", "pl-3d-msg");
    ui.reset = el("button", "pl-3d-reset");
    ui.reset.type = "button";
    ui.reset.addEventListener("click", function () { resetView(true); });
    ui.hint = el("p", "panel-note pl-3d-hint");
    ui.box.appendChild(ui.canvasWrap);
    ui.box.appendChild(ui.msg);
    ui.box.appendChild(ui.reset);
    wrap.parentNode.insertBefore(ui.box, wrap.nextSibling);
    ui.box.parentNode.insertBefore(ui.hint, ui.box.nextSibling);
    texts();
    return true;
  }

  function texts() {
    if (!ui.b2) return;
    var d = t();
    ui.switcher.setAttribute("aria-label", d.pl3dLabel);
    ui.b2.textContent = d.pl2d;
    ui.b3.textContent = d.pl3d;
    ui.b2.setAttribute("aria-pressed", active ? "false" : "true");
    ui.b3.setAttribute("aria-pressed", active ? "true" : "false");
    ui.reset.textContent = d.pl3dReset;
    ui.hint.textContent = d.pl3dHint;
    ui.canvasWrap.setAttribute("aria-label", d.plannerTitle + " — 3D");
  }

  function setActive(on) {
    if (!ensureUi()) return;
    active = on;
    texts();
    ui.wrap.hidden = on;
    ui.box.hidden = !on;
    ui.hint.hidden = !on;
    if (ui.hint2d) ui.hint2d.hidden = on;
    if (!on) { stopLoop(); return; }
    ui.msg.textContent = t().pl3dLoading;
    ui.msg.hidden = false;
    load().then(function () {
      if (!active) return;
      ui.msg.hidden = true;
      setup();
      rebuild();
      resetView(false);
      introSwoop();
    }).catch(function () {
      ui.msg.textContent = t().pl3dError;
      ui.msg.hidden = false;
    });
  }

  function load() {
    if (THREE) return Promise.resolve(THREE);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        try {
          var c = document.createElement("canvas");
          var ok = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
          if (!ok) { reject(new Error("no webgl")); return; }
        } catch (e) { reject(e); return; }
        // dynamic import keeps the 3D library out of the normal page load
        (new Function("u", "return import(u)"))(new URL(LIB, document.baseURI).href).then(function (mod) {
          THREE = mod;
          resolve(mod);
        }, reject);
      });
      loading.catch(function () { loading = null; });
    }
    return loading;
  }

  /* ---------- scene ---------- */
  function themeColors() {
    var cs = getComputedStyle(root);
    var light = root.getAttribute("data-theme") === "light";
    return {
      bg: light ? 0xeeeeea : 0x101012,
      floor: light ? 0xf7f6f2 : 0x1d1d21,
      grid: light ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.12)",
      wall: light ? 0x9a9a94 : 0x6a6a72,
      ok: 0x2f6fde,
      bad: 0xe0392b,
      text: cs.getPropertyValue("--text") || "#fff"
    };
  }

  function setup() {
    if (g) { resize(); return; }
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    } catch (e) {
      ui.msg.textContent = t().pl3dError;
      ui.msg.hidden = false;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    ui.canvasWrap.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    var sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    g = { renderer: renderer, scene: scene, camera: camera, room: new THREE.Group(), things: new THREE.Group(), standees: [],
          view: { theta: 0.5, phi: 0.95, radius: 6, tx: 0, tz: 0 } };
    scene.add(g.room);
    scene.add(g.things);
    attachControls();
    resize();
    window.addEventListener("resize", function () { if (active) { resize(); render(); } });
  }

  function resize() {
    if (!g) return;
    var w = ui.canvasWrap.clientWidth || 300;
    var h = Math.max(240, Math.min(window.innerHeight * 0.55, 460));
    ui.canvasWrap.style.height = h + "px";
    g.renderer.setSize(w, h, false);
    g.renderer.domElement.style.width = "100%";
    g.renderer.domElement.style.height = h + "px";
    g.camera.aspect = w / h;
    g.camera.updateProjectionMatrix();
  }

  function clearGroup(group) {
    while (group.children.length) {
      var c = group.children.pop();
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
            if (m.map && !m.map.userData.cached) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
  }

  function gridTexture(W, L, col) {
    var px = 64; // pixels per metre
    var c = document.createElement("canvas");
    c.width = Math.min(2048, Math.max(64, Math.round(W * px)));
    c.height = Math.min(2048, Math.max(64, Math.round(L * px)));
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    var sx = c.width / W, sy = c.height / L;
    for (var x = 0; x <= W + 0.001; x += 0.5) {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.abs(x - Math.round(x)) < 0.01 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, c.height); ctx.stroke();
    }
    for (var y = 0; y <= L + 0.001; y += 0.5) {
      ctx.lineWidth = Math.abs(y - Math.round(y)) < 0.01 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(c.width, y * sy); ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function shadowTexture() {
    if (texCache.__shadow) return texCache.__shadow;
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, "rgba(0,0,0,.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.userData.cached = true;
    texCache.__shadow = tex;
    return tex;
  }

  function photoTexture(src, cb) {
    if (texCache[src]) { if (texCache[src].image && texCache[src].image.naturalWidth) cb(texCache[src]); else texCache[src].userData.waiting.push(cb); return; }
    var tex = new THREE.Texture();
    tex.userData.cached = true;
    tex.userData.waiting = [cb];
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    var img = new Image();
    img.onload = function () {
      tex.image = img;
      tex.needsUpdate = true;
      tex.userData.waiting.forEach(function (f) { f(tex); });
      tex.userData.waiting = [];
      render();
    };
    img.src = src;
    texCache[src] = tex;
  }

  function rebuild() {
    if (!g) return;
    var data = M.plannerData();
    var W = data.W, L = data.L;
    var col = themeColors();
    g.renderer.setClearColor(col.bg, 1);
    clearGroup(g.room);
    clearGroup(g.things);
    g.standees = [];

    // floor with a 50 cm grid
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ color: col.floor, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    g.room.add(floor);
    var grid = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshBasicMaterial({ map: gridTexture(W, L, col.grid), transparent: true, depthWrite: false }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.002;
    g.room.add(grid);

    // low glass walls + outline, so the room size is easy to see
    var wallH = 0.9;
    var wallMat = new THREE.MeshBasicMaterial({ color: col.wall, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    [[W, 0, -L / 2, 0], [W, 0, L / 2, 0], [L, -W / 2, 0, Math.PI / 2], [L, W / 2, 0, Math.PI / 2]].forEach(function (w) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w[0], wallH), wallMat.clone());
      m.position.set(w[1], wallH / 2, w[2]);
      m.rotation.y = w[3];
      g.room.add(m);
    });
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, wallH, L)), new THREE.LineBasicMaterial({ color: col.wall }));
    edges.position.y = wallH / 2;
    g.room.add(edges);

    // products
    data.items.forEach(function (it) {
      var w = it.w / 100, l = it.l / 100;
      var cx = it.x / 100 + w / 2 - W / 2;
      var cz = it.y / 100 + l / 2 - L / 2;
      var group = new THREE.Group();
      group.position.set(cx, 0, cz);
      // floor area of the product
      var foot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, l),
        new THREE.MeshStandardMaterial({ color: it.bad ? col.bad : col.ok, transparent: true, opacity: it.selected ? 0.6 : 0.38 }));
      foot.position.y = 0.01;
      group.add(foot);
      var outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, l)), new THREE.LineBasicMaterial({ color: it.bad ? col.bad : col.ok }));
      outline.position.y = 0.011;
      group.add(outline);
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, l * 1.1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.024;
      group.add(sh);

      var c = M.cutout(it.p);
      var hgt = heightOf(it.p);
      if (c) {
        photoTexture(c.src, function (tex) {
          if (!g || group.parent !== g.things) return; // the room was drawn again meanwhile
          var iw = tex.image.naturalWidth, ih = tex.image.naturalHeight;
          var aspect = iw / ih;
          var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
          var plane;
          if (lying(it.p)) {
            // a barbell lies on the floor along its long side
            var len = Math.max(w, l), thick = Math.min(w, l);
            plane = new THREE.Mesh(new THREE.PlaneGeometry(thick * 1.2, len), mat);
            plane.rotation.x = -Math.PI / 2;
            if (w > l) plane.rotation.z = Math.PI / 2;
            plane.position.y = 0.04;
            group.add(plane);
          } else {
            var h = hgt, pw = h * aspect;
            var maxW = Math.max(w, l) * 1.35, minW = Math.max(w, l) * 0.6;
            if (pw > maxW) { pw = maxW; h = pw / aspect; }
            if (pw < minW && aspect > 0.35) { pw = minW; h = pw / aspect; }
            plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, h), mat);
            plane.position.y = h / 2 + 0.02;
            group.add(plane);
            g.standees.push(plane);
          }
          faceCamera();
          render();
        });
      } else {
        var box = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, hgt, l * 0.9), new THREE.MeshStandardMaterial({ color: 0x8d8d95, roughness: 0.6 }));
        box.position.y = hgt / 2;
        group.add(box);
      }
      g.things.add(group);
    });
    g.size = Math.max(W, L);
    render();
  }

  /* ---------- camera that circles the room ---------- */
  function resetView(animate) {
    if (!g) return;
    var target = { theta: 0.55, phi: 0.98, radius: Math.max(3, g.size * 1.15 + 1.1) };
    if (animate && !M.reducedMotion()) tween(target, 500);
    else { Object.keys(target).forEach(function (k) { g.view[k] = target[k]; }); render(); }
  }

  function introSwoop() {
    if (!g || M.reducedMotion()) { render(); return; }
    var end = { theta: g.view.theta, phi: g.view.phi, radius: g.view.radius };
    g.view.phi = 0.12;
    g.view.theta = 0;
    g.view.radius = end.radius * 1.1;
    tween(end, 1100);
  }

  var tweenRaf = 0;
  function tween(to, ms) {
    var from = { theta: g.view.theta, phi: g.view.phi, radius: g.view.radius };
    var t0 = performance.now();
    cancelAnimationFrame(tweenRaf);
    function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      ["theta", "phi", "radius"].forEach(function (key) { g.view[key] = from[key] + (to[key] - from[key]) * e; });
      render();
      if (k < 1) tweenRaf = requestAnimationFrame(step);
    }
    tweenRaf = requestAnimationFrame(step);
  }

  function placeCamera() {
    var v = g.view;
    v.phi = Math.max(0.08, Math.min(1.45, v.phi));
    v.radius = Math.max(1.5, Math.min(40, v.radius));
    var x = v.tx + v.radius * Math.sin(v.phi) * Math.sin(v.theta);
    var y = v.radius * Math.cos(v.phi);
    var z = v.tz + v.radius * Math.sin(v.phi) * Math.cos(v.theta);
    g.camera.position.set(x, y, z);
    g.camera.lookAt(v.tx, 0.35, v.tz);
  }

  function faceCamera() {
    if (!g) return;
    var cam = g.camera.position;
    g.standees.forEach(function (s) {
      var wp = new THREE.Vector3();
      s.parent.getWorldPosition(wp);
      s.rotation.y = Math.atan2(cam.x - wp.x, cam.z - wp.z);
    });
  }

  var renderQueued = false;
  function render() {
    if (!g || !active || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      if (!g || !active) return;
      placeCamera();
      faceCamera();
      g.renderer.render(g.scene, g.camera);
    });
  }
  function stopLoop() { cancelAnimationFrame(tweenRaf); }

  function attachControls() {
    var c = ui.canvasWrap;
    var pts = {};
    var start = null;
    c.style.touchAction = "none";
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    function begin() {
      var ps = list();
      if (ps.length === 1) start = { type: "turn", x: ps[0].x, y: ps[0].y, theta: g.view.theta, phi: g.view.phi };
      else if (ps.length >= 2) start = { type: "zoom", d: Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y) || 1, radius: g.view.radius };
      else start = null;
    }
    c.addEventListener("pointerdown", function (e) {
      if (!g) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      cancelAnimationFrame(tweenRaf);
      begin();
    });
    c.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId] || !start) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ps = list();
      if (start.type === "turn" && ps.length === 1) {
        g.view.theta = start.theta - (ps[0].x - start.x) * 0.008;
        g.view.phi = start.phi - (ps[0].y - start.y) * 0.006;
      } else if (start.type === "zoom" && ps.length >= 2) {
        var d = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y) || 1;
        g.view.radius = start.radius * start.d / d;
      }
      render();
    });
    function end(e) { delete pts[e.pointerId]; begin(); }
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", function (e) {
      if (!g) return;
      e.preventDefault();
      g.view.radius *= e.deltaY > 0 ? 1.1 : 1 / 1.1;
      render();
    }, { passive: false });
    c.addEventListener("keydown", function (e) {
      if (!g) return;
      var map = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] };
      if (map[e.key]) {
        e.preventDefault();
        g.view.theta += map[e.key][0];
        g.view.phi += map[e.key][1];
        render();
      } else if (e.key === "+" || e.key === "=") { e.preventDefault(); g.view.radius /= 1.1; render(); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); g.view.radius *= 1.1; render(); }
    });
  }

  /* ---------- keep in step with the 2D plan ---------- */
  var rebuildTimer = null;
  M.onPlannerDraw(function () {
    if (!ensureUi()) return;
    if (!active) { if (ui.hint) ui.hint.hidden = true; return; }
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () { if (active && g) { resize(); rebuild(); } }, 30);
  });
  M.onRender(function () { texts(); if (active && g) rebuild(); });
  var modal = document.getElementById("plannerModal");
  if (modal) modal.addEventListener("modal-close", function () { if (active) stopLoop(); });
  if (modal) {
    // opening again: keep the view the customer chose, just redraw
    var obs = new MutationObserver(function () { if (!modal.hidden && active && g) { resize(); rebuild(); } });
    obs.observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }
  // theme change: new colours
  new MutationObserver(function () { if (active && g) rebuild(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
})();
