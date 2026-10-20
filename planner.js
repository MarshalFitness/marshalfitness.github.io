/* Marshal Fitness — "Will it fit in my room?" planner.
   The customer types the room size, adds equipment and drags it around.
   Sizes come from the admin page (if set) or approximate sizes in content.js. */
(function () {
  "use strict";
  var M = window.MF;
  var modal = document.getElementById("plannerModal");
  var body = document.getElementById("plannerBody");
  if (!M || !modal || !body) return;

  var KEY = "mf-room";
  var GRID_CM = 50;
  var state = load();
  var selected = -1;
  var pickQuery = "";
  var built = false;
  var ui = {};
  var drawHooks = [];

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  function load() {
    var s = { W: 3, L: 4, items: [] };
    try {
      var raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") {
        if (raw.W >= 1 && raw.W <= 30) s.W = raw.W;
        if (raw.L >= 1 && raw.L <= 30) s.L = raw.L;
        if (Array.isArray(raw.items)) s.items = raw.items.filter(function (it) { return it && typeof it.id === "string"; }).slice(0, 40);
      }
    } catch (e) { /* ignore */ }
    return s;
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------- sizes ---------- */
  function sizeOf(p) {
    var w = Number(p.sizeW), l = Number(p.sizeL);
    if (w > 0 && l > 0) return [w, l];
    var table = window.PLANNER_SIZES || {};
    var name = String(typeof p.name === "string" ? p.name : (p.name.en || "")).toLowerCase();
    var kw = (table.byKeyword || []);
    for (var i = 0; i < kw.length; i++) {
      if (new RegExp("\\b" + kw[i][0]).test(name)) return [kw[i][1], kw[i][2]];
    }
    var c = (table.byCategory || {})[p.cat];
    if (c) return [c[0], c[1]];
    return table.fallback || [80, 120];
  }
  function dims(it) {
    var p = M.productByImage(it.id);
    var s = p ? sizeOf(p) : [80, 120];
    return it.rot ? [s[1], s[0]] : [s[0], s[1]];
  }

  /* ---------- checks ---------- */
  function overlaps(a, b) {
    var da = dims(a), db = dims(b);
    return a.x < b.x + db[0] - 1 && b.x < a.x + da[0] - 1 && a.y < b.y + db[1] - 1 && b.y < a.y + da[1] - 1;
  }
  function inside(it) {
    var d = dims(it);
    return it.x >= 0 && it.y >= 0 && it.x + d[0] <= state.W * 100 + 0.5 && it.y + d[1] <= state.L * 100 + 0.5;
  }
  function isShown(it) { return !!M.productByImage(it.id); }
  function shown() { return state.items.filter(isShown); }

  function problems() {
    var bad = {};
    state.items.forEach(function (a, i) {
      if (!isShown(a)) return;
      if (!inside(a)) bad[i] = true;
      state.items.forEach(function (b, j) {
        if (j > i && isShown(b) && overlaps(a, b)) { bad[i] = true; bad[j] = true; }
      });
    });
    return bad;
  }

  function freeSpot(it) {
    var d = dims(it);
    var maxX = state.W * 100 - d[0], maxY = state.L * 100 - d[1];
    if (maxX < 0 || maxY < 0) return { x: 0, y: 0 };
    for (var y = 0; y <= maxY; y += 10) {
      for (var x = 0; x <= maxX; x += 10) {
        var test = { id: it.id, rot: it.rot, x: x, y: y };
        var clash = state.items.some(function (o) { return o !== it && isShown(o) && overlaps(test, o); });
        if (!clash) return { x: x, y: y };
      }
    }
    return { x: 0, y: 0 };
  }

  function clampItem(it) {
    var d = dims(it);
    it.x = Math.max(0, Math.min(Math.max(0, state.W * 100 - d[0]), it.x));
    it.y = Math.max(0, Math.min(Math.max(0, state.L * 100 - d[1]), it.y));
  }

  /* ---------- build the window once ---------- */
  function build() {
    if (built) return;
    built = true;
    body.textContent = "";
    ui.intro = M.el("p", "panel-note");
    body.appendChild(ui.intro);

    var layout = M.el("div", "pl-layout");
    var left = M.el("div", "pl-left");
    var right = M.el("div", "pl-right");

    var size = M.el("div", "pl-size");
    function numField(key) {
      var label = M.el("label", "pl-field");
      var span = M.el("span");
      var input = document.createElement("input");
      input.type = "number";
      input.min = "1"; input.max = "30"; input.step = "0.1";
      input.inputMode = "decimal";
      input.value = state[key];
      input.dir = "ltr";
      input.addEventListener("change", function () {
        var v = Math.round(Math.max(1, Math.min(30, Number(input.value) || state[key])) * 10) / 10;
        input.value = v;
        state[key] = v;
        save();
        drawRoom();
      });
      label.appendChild(span);
      label.appendChild(input);
      size.appendChild(label);
      return { label: span, input: input };
    }
    ui.w = numField("W");
    ui.l = numField("L");
    left.appendChild(size);

    var stageWrap = M.el("div", "pl-stage-wrap");
    ui.stage = M.el("div", "pl-stage");
    ui.stage.dir = "ltr";
    ui.stage.tabIndex = -1;
    ui.stage.setAttribute("role", "application");
    stageWrap.appendChild(ui.stage);
    ui.empty = M.el("p", "pl-empty");
    stageWrap.appendChild(ui.empty);
    left.appendChild(stageWrap);

    ui.status = M.el("p", "pl-status");
    ui.status.setAttribute("role", "status");
    left.appendChild(ui.status);

    ui.tools = M.el("div", "pl-tools");
    ui.toolName = M.el("strong", "pl-tool-name");
    ui.rotate = M.el("button", "btn btn-outline pl-small");
    ui.rotate.type = "button";
    ui.rotate.addEventListener("click", function () { rotateSelected(); });
    ui.remove = M.el("button", "btn btn-outline pl-small");
    ui.remove.type = "button";
    ui.remove.addEventListener("click", function () { removeSelected(); });
    ui.tools.appendChild(ui.toolName);
    ui.tools.appendChild(ui.rotate);
    ui.tools.appendChild(ui.remove);
    left.appendChild(ui.tools);
    ui.hint = M.el("p", "panel-note pl-hint");
    left.appendChild(ui.hint);

    ui.addTitle = M.el("h3", "pl-add-title");
    right.appendChild(ui.addTitle);
    ui.search = document.createElement("input");
    ui.search.type = "search";
    ui.search.className = "search-input pl-search";
    ui.search.autocomplete = "off";
    ui.search.addEventListener("input", function () { pickQuery = ui.search.value; drawPicker(); });
    right.appendChild(ui.search);
    ui.list = M.el("div", "pl-list");
    right.appendChild(ui.list);

    layout.appendChild(left);
    layout.appendChild(right);
    body.appendChild(layout);

    var actions = M.el("div", "pl-actions");
    ui.toBasket = M.el("button", "btn");
    ui.toBasket.type = "button";
    ui.toBasket.addEventListener("click", function () {
      if (!state.items.length || !M.addToBasket) return;
      shown().forEach(function (it) { M.addToBasket(it.id, 1, true); });
      if (M.toast) M.toast(t().basketAdded, t().basketView, function (b) { M.openBasket(b); });
    });
    ui.clear = M.el("button", "btn btn-outline");
    ui.clear.type = "button";
    ui.clear.addEventListener("click", function () {
      state.items = [];
      selected = -1;
      save();
      drawRoom();
    });
    actions.appendChild(ui.toBasket);
    actions.appendChild(ui.clear);
    body.appendChild(actions);
    ui.note = M.el("p", "panel-note");
    body.appendChild(ui.note);
  }

  function texts() {
    var d = t();
    ui.intro.textContent = d.plannerIntro;
    ui.w.label.textContent = d.plannerWidth;
    ui.l.label.textContent = d.plannerLength;
    ui.rotate.textContent = "⟳ " + d.plannerRotate;
    ui.remove.textContent = d.plannerRemove;
    ui.hint.textContent = d.plannerHint;
    ui.addTitle.textContent = d.plannerAdd;
    ui.search.placeholder = d.plannerSearch;
    ui.search.setAttribute("aria-label", d.plannerSearch);
    ui.toBasket.textContent = d.plannerToBasket;
    ui.clear.textContent = d.plannerClear;
    ui.note.textContent = d.plannerNote;
    ui.empty.textContent = d.plannerEmpty;
    ui.stage.setAttribute("aria-label", d.plannerTitle);
  }

  /* ---------- drawing ---------- */
  var scale = 1; // pixels per cm

  function drawRoom() {
    if (!built) return;
    if (selected >= state.items.length) selected = -1;

    var wrap = ui.stage.parentNode;
    var cs = window.getComputedStyle(wrap);
    var wrapW = (wrap.clientWidth || 300) - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4;
    var maxH = Math.max(220, Math.min(window.innerHeight * 0.5, 460));
    scale = Math.min(wrapW / (state.W * 100), maxH / (state.L * 100));
    var pxW = Math.round(state.W * 100 * scale), pxH = Math.round(state.L * 100 * scale);
    ui.stage.style.width = pxW + "px";
    ui.stage.style.height = pxH + "px";
    ui.stage.style.backgroundSize = (GRID_CM * scale) + "px " + (GRID_CM * scale) + "px";
    ui.stage.textContent = "";

    var bad = problems();
    state.items.forEach(function (it, i) {
      var p = M.productByImage(it.id);
      if (!p) return; // not on the page right now; kept in the saved plan
      var d = dims(it);
      var b = M.el("button", "pl-item");
      b.type = "button";
      b.setAttribute("data-i", String(i));
      if (bad[i]) b.classList.add("is-bad");
      if (i === selected) b.classList.add("is-selected");
      b.style.left = (it.x * scale) + "px";
      b.style.top = (it.y * scale) + "px";
      b.style.width = Math.max(6, d[0] * scale) + "px";
      b.style.height = Math.max(6, d[1] * scale) + "px";
      var name = tr(p.name);
      var label = M.el("span", "pl-label", name);
      label.dir = "auto";
      b.appendChild(label);
      b.setAttribute("aria-label", name + " — " + d[0] + " × " + d[1] + " cm");
      b.title = name + " (" + d[0] + " × " + d[1] + " cm)";
      attachDrag(b, i);
      ui.stage.appendChild(b);
    });

    var d2 = t();
    var anyBad = Object.keys(bad).length > 0;
    var area = shown().reduce(function (sum, it) { var d = dims(it); return sum + d[0] * d[1]; }, 0);
    var used = Math.round(area / (state.W * state.L * 10000) * 100);
    var count = shown().length;
    ui.empty.hidden = count > 0;
    ui.status.textContent = count ? (anyBad ? d2.plannerBad : d2.plannerOk) + " · " + d2.plannerUsed(used) : "";
    ui.status.classList.toggle("is-bad", anyBad);
    ui.status.hidden = !count;

    ui.tools.hidden = selected < 0;
    if (selected >= 0) {
      var sp = M.productByImage(state.items[selected].id);
      var sd = dims(state.items[selected]);
      ui.toolName.textContent = tr(sp.name) + " (" + sd[0] + " × " + sd[1] + " cm)";
    }
    ui.toBasket.disabled = !count;
    ui.clear.disabled = !count;
    drawHooks.forEach(function (fn) { try { fn(); } catch (e) { /* the 3D view must never break the planner */ } });
  }

  function itemBox(i) { return ui.stage.querySelector('.pl-item[data-i="' + i + '"]'); }

  function attachDrag(node, i) {
    var start = null;
    node.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button > 0) return;
      var it = state.items[i];
      start = { px: e.clientX, py: e.clientY, x: it.x, y: it.y, moved: false };
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) {
      if (!start) return;
      var dx = (e.clientX - start.px) / scale, dy = (e.clientY - start.py) / scale;
      if (!start.moved && Math.abs(e.clientX - start.px) + Math.abs(e.clientY - start.py) < 5) return;
      start.moved = true;
      var it = state.items[i];
      it.x = Math.round((start.x + dx) / 5) * 5;
      it.y = Math.round((start.y + dy) / 5) * 5;
      clampItem(it);
      node.style.left = (it.x * scale) + "px";
      node.style.top = (it.y * scale) + "px";
    });
    function end() {
      if (!start) return;
      var moved = start.moved;
      start = null;
      if (!moved) selected = selected === i ? -1 : i;
      else selected = i;
      save();
      drawRoom();
      var again = itemBox(i);
      if (again) again.focus({ preventScroll: true });
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("click", function (e) {
      if (e.detail !== 0) return; // keyboard Enter / Space selects the item
      selected = selected === i ? -1 : i;
      drawRoom();
      var again = itemBox(i);
      if (again) again.focus({ preventScroll: true });
    });
    node.addEventListener("pointercancel", end);
    node.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 50 : 10;
      var it = state.items[i];
      var map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (map[e.key]) {
        e.preventDefault();
        it.x += map[e.key][0];
        it.y += map[e.key][1];
        clampItem(it);
        selected = i;
        save();
        drawRoom();
        var box = itemBox(i);
        if (box) box.focus();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        selected = i;
        removeSelected();
      } else if (e.key === "r" || e.key === "R") {
        selected = i;
        rotateSelected();
      }
    });
  }

  function rotateSelected() {
    if (selected < 0) return;
    var it = state.items[selected];
    var d = dims(it);
    var cx = it.x + d[0] / 2, cy = it.y + d[1] / 2;
    it.rot = it.rot ? 0 : 1;
    var nd = dims(it);
    it.x = Math.round(cx - nd[0] / 2);
    it.y = Math.round(cy - nd[1] / 2);
    clampItem(it);
    save();
    drawRoom();
  }

  function removeSelected() {
    if (selected < 0) return;
    state.items.splice(selected, 1);
    selected = -1;
    save();
    drawRoom();
    ui.stage.focus({ preventScroll: true }); // stay in the room (no phone keyboard pop-up)
  }

  function addItem(p) {
    if (state.items.length >= 40) return;
    var s = sizeOf(p);
    var it = { id: p.image, x: 0, y: 0, rot: 0 };
    // turn long things so they fit the room better
    if (s[1] > state.L * 100 && s[0] <= state.L * 100 && s[1] <= state.W * 100) it.rot = 1;
    var spot = freeSpot(it);
    it.x = spot.x; it.y = spot.y;
    state.items.push(it);
    selected = state.items.length - 1;
    save();
    drawRoom();
  }

  function drawPicker() {
    var d = t();
    ui.list.textContent = "";
    var q = M.normalize(pickQuery);
    var items = M.PRODUCTS.filter(function (p) { return !q || M.searchText(p).indexOf(q) !== -1; });
    if (!items.length) { ui.list.appendChild(M.el("p", "panel-note", d.noResults)); return; }
    items.forEach(function (p) {
      var s = sizeOf(p);
      var b = M.el("button", "pl-pick");
      b.type = "button";
      var img = document.createElement("img");
      img.src = p.imageData || (M.S.imageBase + (p.thumbnail || p.image));
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      b.appendChild(img);
      var txt = M.el("span", "pl-pick-text");
      txt.appendChild(M.el("span", "pl-pick-name", tr(p.name)));
      var sz = M.el("span", "pl-pick-size", s[0] + " × " + s[1] + " cm");
      sz.dir = "ltr";
      txt.appendChild(sz);
      b.appendChild(txt);
      b.appendChild(M.el("span", "pl-pick-plus", "+"));
      b.setAttribute("aria-label", d.plannerAdd + ": " + tr(p.name));
      b.addEventListener("click", function () { addItem(p); });
      ui.list.appendChild(b);
    });
  }

  function open(opener) {
    build();
    texts();
    M.openModal(modal, opener || null, document.getElementById("plannerClose"));
    ui.w.input.value = state.W;
    ui.l.input.value = state.L;
    drawPicker();
    drawRoom();
    requestAnimationFrame(drawRoom);
  }
  M.openPlanner = open;
  // version 20: add a product from outside (show page), and data for the 3D view
  M.plannerAdd = function (p) {
    build();
    if (!p) return;
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === p.image) { selected = i; drawRoom(); return; } // already in the room: just select it
    }
    addItem(p);
  };
  M.onPlannerDraw = function (fn) { drawHooks.push(fn); };
  // version 22: product floor size (cm), and load a whole room (ready gym rooms)
  M.plannerSize = sizeOf;
  M.plannerLoad = function (plan, opener) {
    if (!plan) return;
    if (plan.W >= 1 && plan.W <= 30) state.W = Math.round(plan.W * 10) / 10;
    if (plan.L >= 1 && plan.L <= 30) state.L = Math.round(plan.L * 10) / 10;
    state.items = (plan.items || []).filter(function (it) { return it && typeof it.id === "string"; }).slice(0, 40)
      .map(function (it) { return { id: it.id, x: Math.round(it.x || 0), y: Math.round(it.y || 0), rot: it.rot ? 1 : 0 }; });
    selected = -1;
    save();
    open(opener || null);
  };
  M.plannerData = function () {
    var bad = problems();
    var out = [];
    state.items.forEach(function (it, i) {
      var p = M.productByImage(it.id);
      if (!p) return;
      var d = dims(it);
      out.push({ p: p, x: it.x, y: it.y, w: d[0], l: d[1], rot: it.rot ? 1 : 0, bad: !!bad[i], selected: i === selected });
    });
    return { W: state.W, L: state.L, items: out, ui: built ? ui : null };
  };

  ["plannerOpen", "navPlannerOpen"].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { open(b); });
  });
  document.getElementById("plannerClose").addEventListener("click", function () { M.closeModal(); });
  window.addEventListener("resize", function () { if (!modal.hidden) drawRoom(); });
  M.onRender(function () {
    if (!built) return;
    texts();
    if (!modal.hidden) { drawPicker(); drawRoom(); }
  });
})();
