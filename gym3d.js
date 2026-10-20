/* Marshal Fitness — version 22: a whole gym in 3D.
   1. M.gymLayout(W, L, list): puts the machines on the floor in tidy rows
      (cardio first, then machines, free weights and a stretching corner).
   2. M.openGym3d(plan, opener): full-screen 3D gym with real walls, the
      customer's logo on the back wall and every machine standing on its floor
      size. "Walk" mode: walk inside like a visitor (joystick / keys, drag to
      look). "Fly over" mode: turn the whole gym with a finger.
   three.js (lib/three.module.min.js) is shared with planner3d.js and loads only here. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.three || !M.plannerSize) return;

  function t() { return M.t(); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }

  /* =====================================================================
     LAYOUT (all sizes in cm)
     ===================================================================== */
  var WALL0 = 30;                                  // free space along the walls
  var GAP0 = { cardio: 40, machine: 70, free: 60, stretch: 35 };
  var AISLE0 = 100;                                // walking space between rows
  var ZONES = ["cardio", "machine", "free", "stretch"];

  // which zone a product belongs to (small things like bands go on a shelf)
  function zoneOf(p) {
    var type = M.exerciseType ? M.exerciseType(p) : null;
    if (p.cat === "treadmills" || p.cat === "bikes" || type === "treadmill" || type === "bike" || type === "rower") return "cardio";
    if (type === "mat" || type === "ball") return "stretch";
    if (type === "bands" || type === "handle" || type === "belt" || type === "ankle") return "small";
    if (p.cat === "free-weights" || p.cat === "accessories") return "free";
    return "machine";
  }
  M.gymZone = zoneOf;

  // list: [{ id, qty }] -> { items: [{ id, x, y, w, l, zone }], left: { id: count }, small: [{ id, qty }] }
  // opts.tight: a home room (less space between things, zones may share a row)
  function layout(W, L, list, opts) {
    var tight = !!(opts && opts.tight);
    var WALL = tight ? 15 : WALL0, AISLE = tight ? 60 : AISLE0;
    var GAP = tight ? { cardio: 25, machine: 35, free: 25, stretch: 20 } : GAP0;
    var Wc = Math.round(W * 100), Lc = Math.round(L * 100);
    var units = [], small = [], left = {};
    (list || []).forEach(function (it) {
      var p = M.productByImage(it.id);
      if (!p || !(it.qty > 0)) return;
      var z = zoneOf(p);
      if (z === "small") { small.push({ id: it.id, qty: it.qty }); return; }
      var s = M.plannerSize(p);
      var w = s[0], l = s[1];
      if (z === "cardio" && w > l) { var tmp = w; w = l; l = tmp; }   // treadmills point into the room
      if ((z === "free" || z === "stretch") && w < l) { var tmp2 = w; w = l; l = tmp2; } // benches, bars and mats lie along the row
      for (var k = 0; k < Math.min(it.qty, 60); k++) units.push({ id: it.id, zone: z, w: w, l: l });
    });
    // keep the way in free: nothing stands in front of the door (middle of the front wall)
    var door = tight ? null : { x0: Wc / 2 - 90, x1: Wc / 2 + 90, y0: Lc - 170 };
    function hitsDoor(x, y0, w, l) { return !!door && y0 + l > door.y0 && x < door.x1 && x + w > door.x0; }
    // where can this go in the row? (-1 = it does not fit)
    function spot(rw, zone, w, l) {
      var x = rw.x;
      if (hitsDoor(x, rw.y, w, l)) x = door.x1 + GAP[zone];
      if (x + w > Wc - WALL || rw.y + l > Lc - WALL) return -1;
      return x;
    }
    var rows = [];
    var y = WALL;
    var row = null;
    ZONES.forEach(function (zone) {
      // gyms: cardio has its own row(s); machines start new rows and the free weights and
      // stretching corner fill the space left in the machine rows
      if (!tight && (zone === "cardio" || zone === "machine")) row = null;
      units.filter(function (u) { return u.zone === zone; }).forEach(function (u) {
        var w = u.w, l = u.l, x = -1, tmp;
        if (row) {
          x = spot(row, zone, w, l);
          if (x < 0 && l <= row.depth) { x = spot(row, zone, l, w); if (x >= 0) { tmp = w; w = l; l = tmp; } }  // turn it to fit the row
        }
        if (x < 0) {
          var before = row;
          row = { zone: zone, x: WALL, y: before ? before.y + before.depth + AISLE : y, depth: 0, items: [] };
          x = spot(row, zone, w, l);
          if (x < 0) { x = spot(row, zone, l, w); if (x >= 0) { tmp = w; w = l; l = tmp; } }
          if (x < 0) { row = before; left[u.id] = (left[u.id] || 0) + 1; return; }
          rows.push(row);
        }
        row.items.push({ id: u.id, zone: zone, x: x, y: row.y, w: w, l: l });
        row.x = x + w + GAP[zone];
        row.depth = Math.max(row.depth, l);
      });
      if (row && !tight) y = row.y + row.depth + AISLE;
    });
    // centre each row between the walls (not the row by the door: it keeps the way in free)
    var items = [];
    rows.forEach(function (row) {
      if (!row.items.length) return;
      var last = row.items[row.items.length - 1];
      var used = last.x + last.w - WALL;
      var nearDoor = door && row.y + row.depth > door.y0;
      var shift = nearDoor ? 0 : Math.max(0, Math.floor((Wc - 2 * WALL - used) / 2));
      row.items.forEach(function (it) { it.x += shift; items.push(it); });
    });
    var area = 0;
    items.forEach(function (it) { area += it.w * it.l; });
    return { W: W, L: L, items: items, left: left, small: small, cover: area / (Wc * Lc) };
  }
  M.gymLayout = layout;

  /* ---------- floor plan picture (screen and PDF) ---------- */
  var ZCOL = { cardio: "#2f6fde", machine: "#d31822", free: "#e0a800", stretch: "#2fa36b" };
  M.GYM_ZONE_COLORS = ZCOL;
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // nums: { productId: number shown on it }; o: { floor, grid, wall, scale }
  M.drawGymPlan = function (ctx, lay, x0, y0, wpx, hpx, nums, o) {
    o = o || {};
    nums = nums || {};
    var k = Math.min(wpx / (lay.W * 100), hpx / (lay.L * 100));
    var W = lay.W * 100 * k, H = lay.L * 100 * k;
    var ox = x0 + (wpx - W) / 2, oy = y0 + (hpx - H) / 2;
    ctx.save();
    ctx.fillStyle = o.floor || "#f3f2ee";
    ctx.fillRect(ox, oy, W, H);
    ctx.strokeStyle = o.grid || "rgba(0,0,0,.08)";
    ctx.lineWidth = 1;
    for (var gx = 100; gx < lay.W * 100; gx += 100) { ctx.beginPath(); ctx.moveTo(ox + gx * k, oy); ctx.lineTo(ox + gx * k, oy + H); ctx.stroke(); }
    for (var gy = 100; gy < lay.L * 100; gy += 100) { ctx.beginPath(); ctx.moveTo(ox, oy + gy * k); ctx.lineTo(ox + W, oy + gy * k); ctx.stroke(); }
    var lw = Math.max(2, 6 * (o.scale || 1));
    ctx.strokeStyle = o.wall || "#111";
    ctx.lineWidth = lw;
    ctx.strokeRect(ox, oy, W, H);
    // the door: middle of the front wall (bottom of the picture)
    var door = Math.min(W * 0.3, 160 * k);
    ctx.fillStyle = o.floor || "#f3f2ee";
    ctx.fillRect(ox + W / 2 - door / 2, oy + H - lw, door, lw * 2);
    lay.items.forEach(function (it) {
      var x = ox + it.x * k, y = oy + it.y * k, w = it.w * k, h = it.l * k;
      ctx.fillStyle = ZCOL[it.zone] || "#777";
      ctx.globalAlpha = 0.86;
      rr(ctx, x, y, w, h, Math.max(1, Math.min(6, w / 4, h / 4)));
      ctx.fill();
      ctx.globalAlpha = 1;
      var n = nums[it.id];
      if (n && Math.min(w, h) >= 11) {
        var fs = Math.max(9, Math.min(w, h, 34 * (o.scale || 1)) * 0.55);
        ctx.font = "800 " + fs + "px Inter, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n), x + w / 2, y + h / 2 + 1);
      }
      it.box = [x, y, w, h];
    });
    ctx.restore();
    return { ox: ox, oy: oy, W: W, H: H, k: k };
  };

  /* =====================================================================
     3D STAGE
     ===================================================================== */
  var THREE = null, g = null, plan = null, mode = "walk", built = false, ui = {};
  var stage = el("div", "stage g3-stage");
  stage.id = "gym3dStage";
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-modal", "true");
  stage.setAttribute("aria-labelledby", "g3Title");
  stage.hidden = true;
  document.body.appendChild(stage);
  var onClose = null;

  function build() {
    if (built) return;
    built = true;
    ui.canvas = el("div", "g3-canvas");
    ui.canvas.tabIndex = 0;
    ui.canvas.setAttribute("role", "img");
    ui.top = el("div", "g3-top");
    ui.title = el("h2", "g3-title");
    ui.title.id = "g3Title";
    ui.modes = el("div", "g3-modes");
    ui.modes.setAttribute("role", "group");
    ui.walk = el("button", "g3-mode");
    ui.walk.type = "button";
    ui.fly = el("button", "g3-mode");
    ui.fly.type = "button";
    ui.walk.addEventListener("click", function () { setMode("walk"); });
    ui.fly.addEventListener("click", function () { setMode("fly"); });
    ui.modes.appendChild(ui.walk);
    ui.modes.appendChild(ui.fly);
    ui.close = el("button", "tour-x g3-x");
    ui.close.type = "button";
    ui.close.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    ui.close.addEventListener("click", function () { M.closeStage(stage); });
    ui.top.appendChild(ui.title);
    ui.top.appendChild(ui.close);
    ui.joy = el("div", "g3-joy");
    ui.knob = el("span", "g3-knob");
    ui.joy.appendChild(ui.knob);
    ui.joy.setAttribute("aria-hidden", "true");
    ui.hint = el("p", "g3-hint");
    ui.msg = el("p", "g3-msg");
    ui.msg.setAttribute("role", "status");
    ui.bottom = el("div", "g3-bottom");
    ui.bottom.appendChild(ui.modes);
    stage.appendChild(ui.canvas);
    stage.appendChild(ui.top);
    stage.appendChild(ui.joy);
    stage.appendChild(ui.hint);
    stage.appendChild(ui.bottom);
    stage.appendChild(ui.msg);
    texts();
    attachControls();
    window.addEventListener("resize", function () { if (!stage.hidden) { resize(); render(); } });
  }

  function texts() {
    if (!built) return;
    var d = t();
    ui.title.textContent = (plan && plan.name) || d.g3Title;
    ui.walk.textContent = d.g3Walk;
    ui.fly.textContent = d.g3Fly;
    ui.modes.setAttribute("aria-label", d.g3Mode);
    ui.close.setAttribute("aria-label", d.close);
    ui.walk.setAttribute("aria-pressed", mode === "walk" ? "true" : "false");
    ui.fly.setAttribute("aria-pressed", mode === "fly" ? "true" : "false");
    ui.hint.textContent = mode === "walk" ? d.g3HintWalk : d.g3HintFly;
    ui.canvas.setAttribute("aria-label", d.g3Label((plan && plan.items.length) || 0, plan ? plan.W : 0, plan ? plan.L : 0));
  }

  function setMode(m) {
    mode = m;
    stage.classList.toggle("g3-is-walk", m === "walk");
    texts();
    if (g) { placeCamera(); updateWalls(); render(); }
  }

  /* ---------- scene ---------- */
  function setup() {
    if (g) return true;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    ui.canvas.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e);
    var camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a40, 1.5));
    var sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    g = { renderer: renderer, scene: scene, camera: camera, room: new THREE.Group(), things: new THREE.Group(),
          standees: [], walls: [], boxes: [], tex: {},
          walk: { x: 0, z: 0, yaw: 0, pitch: -0.05 }, fly: { theta: 0.6, phi: 0.95, radius: 10 } };
    scene.add(g.room);
    scene.add(g.things);
    return true;
  }

  function resize() {
    if (!g) return;
    var w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    g.renderer.setSize(w, h, false);
    g.renderer.domElement.style.width = w + "px";
    g.renderer.domElement.style.height = h + "px";
    g.camera.aspect = w / h;
    g.camera.updateProjectionMatrix();
  }

  function dispose(group) {
    while (group.children.length) {
      var c = group.children.pop();
      c.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
          if (m.map && !m.map.userData.keep) m.map.dispose();
          m.dispose();
        });
      });
    }
  }

  function canvasTex(c) {
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // rubber floor tiles (1 m)
  function floorTexture(W, L) {
    var px = 48, c = document.createElement("canvas");
    c.width = Math.min(2048, Math.round(W * px)); c.height = Math.min(2048, Math.round(L * px));
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#1b1c1f"; ctx.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < 2600; i++) {   // small rubber flecks
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.25)";
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 2;
    var sx = c.width / W, sy = c.height / L;
    for (var x = 0; x <= W; x += 1) { ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, c.height); ctx.stroke(); }
    for (var y = 0; y <= L; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(c.width, y * sy); ctx.stroke(); }
    return canvasTex(c);
  }

  // the gym name under the logo
  function nameTexture(text) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 160;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    var size = 96;
    ctx.font = "900 " + size + "px Inter, 'Noto Kufi Arabic', 'Noto Sans Arabic', sans-serif";
    while (ctx.measureText(text).width > 980 && size > 30) { size -= 4; ctx.font = "900 " + size + "px Inter, 'Noto Kufi Arabic', 'Noto Sans Arabic', sans-serif"; }
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.direction = /[؀-ۿ]/.test(text) ? "rtl" : "ltr";
    ctx.fillText(text, 512, 84);
    return canvasTex(c);
  }

  function photoTex(src, cb) {
    var tex = g.tex[src];
    if (tex) { if (tex.image && tex.image.naturalWidth) cb(tex); else tex.userData.waiting.push(cb); return; }
    tex = new THREE.Texture();
    tex.userData.keep = true;
    tex.userData.waiting = [cb];
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    var img = new Image();
    img.onload = function () {
      tex.image = img; tex.needsUpdate = true;
      tex.userData.waiting.forEach(function (f) { f(tex); });
      tex.userData.waiting = [];
      render();
    };
    img.src = src;
    g.tex[src] = tex;
  }

  var WALL_H = 3;
  function rebuild() {
    dispose(g.room); dispose(g.things);
    g.standees = []; g.walls = []; g.boxes = [];
    var W = plan.W, L = plan.L;
    // floor
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: floorTexture(W, L), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    g.room.add(floor);
    // ceiling with light panels (seen when walking)
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshBasicMaterial({ color: 0x2a2b30, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
    ceil.userData.ceiling = true;
    g.room.add(ceil);
    g.ceiling = ceil;
    for (var lx = -W / 2 + 1.5; lx < W / 2 - 0.5; lx += 3) {
      for (var lz = -L / 2 + 1.5; lz < L / 2 - 0.5; lz += 3) {
        // light panel, in the ceiling's own flat coordinates (x, z on the ceiling, a little below it)
        var panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xf4f1e8 }));
        panel.position.set(lx, lz, 0.01);
        ceil.add(panel);
      }
    }
    // walls: [width, x, z, rotation, inward normal x, z]
    var wallMat = function (col) { return new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }); };
    [[W, 0, -L / 2, 0, 0, 1, 0xd9d6cf], [W, 0, L / 2, Math.PI, 0, -1, 0xd9d6cf],
     [L, -W / 2, 0, Math.PI / 2, 1, 0, 0xcfccc4], [L, W / 2, 0, -Math.PI / 2, -1, 0, 0xcfccc4]].forEach(function (w, i) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w[0], WALL_H), wallMat(w[6]));
      m.position.set(w[1], WALL_H / 2, w[2]);
      m.rotation.y = w[3];
      m.userData.normal = [w[4], w[5]];
      g.room.add(m);
      g.walls.push(m);
      // a red stripe along every wall (shop colours)
      var stripe = new THREE.Mesh(new THREE.PlaneGeometry(w[0], 0.12), new THREE.MeshBasicMaterial({ color: 0xd31822, side: THREE.DoubleSide }));
      stripe.position.set(0, -WALL_H / 2 + 1.1, 0.01);
      m.add(stripe);
      if (i === 2) {
        // a mirror on the left wall, like a real gym
        var mirror = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(L - 1, 6), 1.8), new THREE.MeshStandardMaterial({ color: 0x9fb3c2, metalness: 0.6, roughness: 0.15, side: THREE.DoubleSide }));
        mirror.position.set(0, 0.15, 0.02);
        m.add(mirror);
      }
    });
    // logo + gym name on the back wall
    var back = g.walls[0];
    if (plan.logo) {
      var img = new Image();
      img.onload = function () {
        if (!g || g.walls[0] !== back) return;
        var tex = new THREE.Texture(img);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        var ar = img.naturalWidth / img.naturalHeight, h = 1.1, w = h * ar;
        if (w > Math.min(2.6, W - 1)) { w = Math.min(2.6, W - 1); h = w / ar; }
        var logo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
        logo.position.set(0, 2.05 - WALL_H / 2, 0.03);
        back.add(logo);
        render();
      };
      img.src = plan.logo;
    }
    if (plan.name) {
      var nm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.2, W - 0.6), Math.min(3.2, W - 0.6) * 160 / 1024),
        new THREE.MeshBasicMaterial({ map: nameTexture(plan.name), transparent: true, color: 0x111114 }));
      nm.position.set(0, (plan.logo ? 1.28 : 1.9) - WALL_H / 2, 0.03);
      back.add(nm);
    }
    // machines
    plan.items.forEach(function (it) {
      var p = M.productByImage(it.id);
      if (!p) return;
      var w = it.w / 100, l = it.l / 100;
      var cx = it.x / 100 + w / 2 - W / 2, cz = it.y / 100 + l / 2 - L / 2;
      var group = new THREE.Group();
      group.position.set(cx, 0, cz);
      var mat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, l), new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 1 }));
      mat.position.y = 0.008;
      group.add(mat);
      g.boxes.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - l / 2, z1: cz + l / 2 });
      var c = M.cutout(p), hgt = M.three.heightOf(p);
      if (c) {
        photoTex(c.src, function (tex) {
          if (!g || group.parent !== g.things) return;
          var aspect = tex.image.naturalWidth / tex.image.naturalHeight;
          var m2 = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
          var plane;
          if (M.three.lying(p)) {
            var len = Math.max(w, l), thick = Math.min(w, l);
            plane = new THREE.Mesh(new THREE.PlaneGeometry(thick * 1.2, len), m2);
            plane.rotation.x = -Math.PI / 2;
            if (w > l) plane.rotation.z = Math.PI / 2;
            plane.position.y = 0.04;
            group.add(plane);
          } else {
            var h = hgt, pw = h * aspect;
            var maxW = Math.max(w, l) * 1.35, minW = Math.max(w, l) * 0.6;
            if (pw > maxW) { pw = maxW; h = pw / aspect; }
            if (pw < minW && aspect > 0.35) { pw = minW; h = pw / aspect; }
            plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, h), m2);
            plane.position.y = h / 2 + 0.02;
            group.add(plane);
            g.standees.push(plane);
          }
          render();
        });
      } else {
        var box = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, hgt, l * 0.9), new THREE.MeshStandardMaterial({ color: 0x8d8d95, roughness: 0.6 }));
        box.position.y = hgt / 2;
        group.add(box);
      }
      g.things.add(group);
    });
  }

  /* ---------- cameras ---------- */
  function startView() {
    // walk: stand at the door (front wall), looking at the logo
    g.walk.x = 0;
    g.walk.z = plan.L / 2 - 0.6;
    g.walk.yaw = 0;
    g.walk.pitch = -0.04;
    g.fly.theta = 0.55; g.fly.phi = 0.92; g.fly.radius = Math.max(5, Math.max(plan.W, plan.L) * 1.05 + 2);
  }
  function placeCamera() {
    var cam = g.camera;
    if (mode === "walk") {
      var wk = g.walk;
      wk.pitch = Math.max(-0.9, Math.min(0.7, wk.pitch));
      cam.position.set(wk.x, 1.62, wk.z);
      cam.lookAt(wk.x - Math.sin(wk.yaw) * Math.cos(wk.pitch), 1.62 + Math.sin(wk.pitch), wk.z - Math.cos(wk.yaw) * Math.cos(wk.pitch));
      cam.fov = 62;
    } else {
      var v = g.fly;
      v.phi = Math.max(0.12, Math.min(1.42, v.phi));
      v.radius = Math.max(2.5, Math.min(60, v.radius));
      cam.position.set(v.radius * Math.sin(v.phi) * Math.sin(v.theta), v.radius * Math.cos(v.phi), v.radius * Math.sin(v.phi) * Math.cos(v.theta));
      cam.lookAt(0, 0.6, 0);
      cam.fov = 45;
    }
    cam.updateProjectionMatrix();
  }
  // walls between the camera and the gym are hidden when flying over it
  function updateWalls() {
    var cam = g.camera.position;
    g.walls.forEach(function (w) {
      if (mode === "walk") { w.visible = true; return; }
      var n = w.userData.normal;
      var dx = cam.x - w.position.x, dz = cam.z - w.position.z;
      w.visible = dx * n[0] + dz * n[1] > 0;
    });
    if (g.ceiling) g.ceiling.visible = mode === "walk";
  }
  function faceCamera() {
    var cam = g.camera.position;
    var wp = new THREE.Vector3();
    g.standees.forEach(function (s) {
      s.parent.getWorldPosition(wp);
      s.rotation.y = Math.atan2(cam.x - wp.x, cam.z - wp.z);
    });
  }
  var queued = false;
  function render() {
    if (!g || stage.hidden || queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      if (!g || stage.hidden) return;
      placeCamera();
      updateWalls();
      faceCamera();
      g.renderer.render(g.scene, g.camera);
    });
  }

  /* ---------- walking: stays inside the walls and does not go through machines ---------- */
  var R = 0.25;
  function blocked(x, z) {
    for (var i = 0; i < g.boxes.length; i++) {
      var b = g.boxes[i];
      if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) return true;
    }
    return false;
  }
  function moveBy(fwd, side) {
    var wk = g.walk;
    var dx = -Math.sin(wk.yaw) * fwd + Math.cos(wk.yaw) * side;
    var dz = -Math.cos(wk.yaw) * fwd - Math.sin(wk.yaw) * side;
    var lim = function (v, half) { return Math.max(-half + 0.3, Math.min(half - 0.3, v)); };
    var nx = lim(wk.x + dx, plan.W / 2), nz = lim(wk.z + dz, plan.L / 2);
    var inside = blocked(wk.x, wk.z); // started inside a machine: let the customer walk out
    if (inside || !blocked(nx, nz)) { wk.x = nx; wk.z = nz; }
    else if (!blocked(nx, wk.z)) wk.x = nx;      // slide along the machine
    else if (!blocked(wk.x, nz)) wk.z = nz;
  }

  var joy = { on: false, x: 0, y: 0 }, keys = {}, loopRaf = 0, lastT = 0;
  function loop(now) {
    loopRaf = 0;
    if (stage.hidden || !g) return;
    var dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;
    var fwd = 0, side = 0, turn = 0;
    if (joy.on) { fwd = -joy.y; side = joy.x; }
    if (keys.ArrowUp || keys.KeyW) fwd += 1;
    if (keys.ArrowDown || keys.KeyS) fwd -= 1;
    if (keys.ArrowLeft || keys.KeyA) turn += 1;
    if (keys.ArrowRight || keys.KeyD) turn -= 1;
    if (mode === "walk") {
      if (fwd || side) moveBy(fwd * 1.6 * dt, side * 1.2 * dt);
      if (turn) g.walk.yaw += turn * 1.6 * dt;
    } else {
      if (turn) g.fly.theta += turn * 1.2 * dt;
      if (fwd) g.fly.radius *= 1 - fwd * 0.9 * dt;
    }
    render();
    if (joy.on || Object.keys(keys).some(function (k) { return keys[k]; })) loopRaf = requestAnimationFrame(loop);
    else lastT = 0;
  }
  function kick() { if (!loopRaf) { lastT = 0; loopRaf = requestAnimationFrame(loop); } }

  function attachControls() {
    var c = ui.canvas, pts = {}, start = null;
    c.style.touchAction = "none";
    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }
    function begin() {
      var ps = list();
      if (ps.length === 1) start = { type: "look", x: ps[0].x, y: ps[0].y, yaw: g.walk.yaw, pitch: g.walk.pitch, theta: g.fly.theta, phi: g.fly.phi };
      else if (ps.length >= 2) start = { type: "zoom", d: Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y) || 1, radius: g.fly.radius, x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2, wx: g.walk.x, wz: g.walk.z };
      else start = null;
    }
    c.addEventListener("pointerdown", function (e) {
      if (!g) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      begin();
    });
    c.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId] || !start) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ps = list();
      if (start.type === "look" && ps.length === 1) {
        if (mode === "walk") {
          g.walk.yaw = start.yaw + (ps[0].x - start.x) * 0.006;
          g.walk.pitch = start.pitch + (ps[0].y - start.y) * 0.004;
        } else {
          g.fly.theta = start.theta - (ps[0].x - start.x) * 0.008;
          g.fly.phi = start.phi - (ps[0].y - start.y) * 0.006;
        }
      } else if (start.type === "zoom" && ps.length >= 2 && mode === "fly") {
        var d = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y) || 1;
        g.fly.radius = start.radius * start.d / d;
      }
      render();
    });
    function end(e) { delete pts[e.pointerId]; begin(); }
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", function (e) {
      if (!g) return;
      e.preventDefault();
      if (mode === "fly") g.fly.radius *= e.deltaY > 0 ? 1.1 : 1 / 1.1;
      else moveBy(e.deltaY > 0 ? -0.4 : 0.4, 0);
      render();
    }, { passive: false });
    // keyboard: arrows / WASD
    stage.addEventListener("keydown", function (e) {
      var k = e.code || e.key;
      if (/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(k)) {
        if (e.target.tagName === "BUTTON" && /Arrow(Left|Right)/.test(k) && e.target.parentNode === ui.modes) return;
        e.preventDefault();
        keys[k] = true;
        kick();
      }
    });
    stage.addEventListener("keyup", function (e) { keys[e.code || e.key] = false; });
    // joystick
    var jr = 0;
    ui.joy.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var r = ui.joy.getBoundingClientRect();
      jr = r.width / 2;
      joy.cx = r.left + jr; joy.cy = r.top + jr;
      joy.on = true;
      try { ui.joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      moveJoy(e);
      kick();
    });
    function moveJoy(e) {
      if (!joy.on) return;
      var dx = e.clientX - joy.cx, dy = e.clientY - joy.cy, d = Math.hypot(dx, dy), max = jr * 0.62;
      if (d > max) { dx *= max / d; dy *= max / d; }
      joy.x = dx / max; joy.y = dy / max;
      ui.knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    }
    ui.joy.addEventListener("pointermove", moveJoy);
    function stopJoy() { joy.on = false; joy.x = joy.y = 0; ui.knob.style.transform = ""; }
    ui.joy.addEventListener("pointerup", stopJoy);
    ui.joy.addEventListener("pointercancel", stopJoy);
  }

  /* ---------- open / close ---------- */
  function open(p, opener, closed) {
    plan = p;
    onClose = closed || null;
    build();
    mode = "walk";
    setMode("walk");
    texts();
    M.openStage(stage, opener || null, ui.close);
    ui.msg.textContent = t().g3Loading;
    ui.msg.hidden = false;
    M.three.load().then(function (mod) {
      THREE = mod;
      if (stage.hidden) return;
      if (!setup()) throw new Error("webgl");
      ui.msg.hidden = true;
      resize();
      rebuild();
      startView();
      render();
      ui.canvas.focus({ preventScroll: true });
    }).catch(function () {
      ui.msg.textContent = t().g3Error;
      ui.msg.hidden = false;
    });
  }
  stage.addEventListener("stage-close", function () {
    keys = {};
    joy.on = false;
    var cb = onClose;
    onClose = null;
    if (cb) setTimeout(cb, 0);
  });
  M.openGym3d = open;
  M.onRender(function () { texts(); });
})();
