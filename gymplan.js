/* Marshal Fitness — version 22: "Open a gym" planner.
   The customer writes the size and type of the gym (and can add the gym name and logo).
   The planner chooses real Marshal Fitness machines, puts them on a floor plan,
   shows them in 3D (gym3d.js), makes a PDF offer and sends the list on WhatsApp.
   Everything is kept on the phone (localStorage "mf-gymplan"). */
(function () {
  "use strict";
  var M = window.MF, P = window.MF_PDF;
  if (!M || !M.gymLayout || !M.makeWindow) return;
  var el = M.el;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  var KEY = "mf-gymplan";
  var MIN = 4, MAX = 40;

  /* ---------- what each type of gym needs ---------- */
  // cardio / machines: one per this many square metres; order: machine types, most important first
  var KINDS = {
    full: { cardio: 22, machines: 11, tread: 0.6,
      order: ["chestpress", "pulldown", "legpress", "legext", "legcurlseated", "shoulderpress", "row", "pecfly", "smith", "squatmachine",
        "biceps", "triceps", "addabd", "calf", "glute", "abback", "assist", "incline", "lateral", "dip", "legcurlprone", "cable", "decline"],
      free: { bench: 60, dumbbells: 110, barbell: 90, plates: 90, mat: 45, ball: 90, bands: 70, handle: 90, belt: 160, ankle: 120 } },
    women: { cardio: 17, machines: 13, tread: 0.55,
      order: ["addabd", "glute", "legpress", "legext", "legcurlseated", "pecfly", "pulldown", "row", "chestpress", "shoulderpress", "abback",
        "cable", "lateral", "smith", "legcurlprone", "calf", "assist", "biceps", "triceps", "squatmachine"],
      free: { bench: 90, dumbbells: 110, mat: 25, ball: 45, bands: 35, handle: 70, ankle: 60 } },
    hotel: { cardio: 9, machines: 16, tread: 0.6,
      order: ["chestshoulder", "pullrow", "legextcurl", "bitri", "addabd", "abback", "legpress", "cable", "pecfly", "assist", "glute", "calf"],
      free: { bench: 60, dumbbells: 60, mat: 25, ball: 45, bands: 45 } },
    strength: { cardio: 40, machines: 9, tread: 0.6,
      order: ["chestpress", "incline", "pulldown", "row", "legpress", "squatmachine", "smith", "shoulderpress", "legext", "legcurlseated",
        "pecfly", "decline", "lateral", "legcurlprone", "calf", "biceps", "triceps", "dip", "assist", "glute", "addabd", "abback", "cable"],
      free: { bench: 35, dumbbells: 70, barbell: 45, plates: 40, mat: 70, belt: 70 } }
  };
  // a two-in-one machine also does the work of these
  var COVERS = {
    chestshoulder: ["chestpress", "shoulderpress"], pullrow: ["pulldown", "row"], legextcurl: ["legext", "legcurlseated"],
    bitri: ["biceps", "triceps"], addabd: ["adductor", "abductor"], abback: ["abs", "backext"]
  };
  var SERIES_ORDER = {
    normal: ["prestige", "btm", "evost", "titan-mechanix", "titan-xtreme"],
    strength: ["titan-xtreme", "titan-mechanix", "evost", "prestige", "btm"]
  };

  function nameEn(p) { return String(typeof p.name === "string" ? p.name : (p.name.en || "")); }
  function typeOf(p) { return M.exerciseType ? M.exerciseType(p) : null; }

  // best product for a machine type (customer's machine line first)
  function pickFor(type, kind, line) {
    var list = M.PRODUCTS.filter(function (p) { return typeOf(p) === type; });
    if (!list.length) return null;
    var order = (line && line !== "mix" ? [line] : []).concat(SERIES_ORDER[kind === "strength" ? "strength" : "normal"]);
    list.sort(function (a, b) {
      var ia = order.indexOf(a.series || ""), ib = order.indexOf(b.series || "");
      if (ia === -1) ia = 99;
      if (ib === -1) ib = 99;
      return ia - ib || M.PRODUCTS.indexOf(a) - M.PRODUCTS.indexOf(b);
    });
    return list[0];
  }
  function alternatives(p) {
    var type = typeOf(p);
    if (!type) return [p];
    return M.PRODUCTS.filter(function (x) { return typeOf(x) === type; });
  }

  // make the list and keep only what fits in the hall
  function generate(s) {
    var kind = KINDS[s.type] || KINDS.full;
    var A = s.W * s.L;
    var wanted = [];      // [{ id, qty }] in order of importance
    var add = function (p, qty) {
      if (!p || !(qty > 0)) return;
      var found = wanted.filter(function (w) { return w.id === p.image; })[0];
      if (found) found.qty += qty; else wanted.push({ id: p.image, qty: qty });
    };
    // cardio
    var cardio = Math.min(s.type === "hotel" ? 16 : 40, Math.max(s.type === "hotel" ? 2 : 1, Math.round(A / kind.cardio)));
    var treads = M.PRODUCTS.filter(function (p) { return typeOf(p) === "treadmill"; });
    var bikes = M.PRODUCTS.filter(function (p) { return typeOf(p) === "bike"; });
    var nTread = bikes.length ? Math.max(1, Math.round(cardio * kind.tread)) : cardio;
    var nBike = cardio - nTread;
    var cardioUnits = [];
    for (var i = 0; i < nTread; i++) cardioUnits.push(treads[i % Math.max(1, treads.length)]);
    for (var j = 0; j < nBike; j++) cardioUnits.push(bikes[j % Math.max(1, bikes.length)]);
    // machines (two-in-one machines count for the types they cover)
    var nMach = Math.min(50, Math.max(1, Math.round(A / kind.machines)));
    var machines = [], done = {};
    kind.order.forEach(function (type) {
      if (machines.length >= nMach || done[type]) return;
      var p = pickFor(type, s.type, s.line);
      if (!p) return;
      machines.push(p);
      done[type] = true;
      (COVERS[type] || []).forEach(function (c) { done[c] = true; });
    });
    // big gyms: a second one of the busiest machines
    var busy = ["chestpress", "pulldown", "legpress", "row", "legext", "shoulderpress", "smith", "pecfly", "legcurlseated", "addabd", "glute"];
    for (var k = 0; machines.length < nMach && k < busy.length * 2; k++) {
      var p2 = pickFor(busy[k % busy.length], s.type, s.line);
      if (p2 && machines.indexOf(p2) !== -1) machines.push(p2);
    }
    // free weights and accessories
    var free = [];
    Object.keys(kind.free).forEach(function (type) {
      var p = pickFor(type, s.type, s.line);
      if (!p) return;
      var qty = Math.min(type === "mat" || type === "bands" ? 20 : 10, Math.max(1, Math.round(A / kind.free[type])));
      if (type === "plates") {
        // both kinds of plates when there are two
        M.PRODUCTS.filter(function (x) { return typeOf(x) === "plates"; }).forEach(function (x) { free.push([x, qty]); });
      } else free.push([p, qty]);
    });
    // add one by one and keep only what still fits
    var plan = [];
    var tryAdd = function (p) {
      if (!p) return;
      var copy = plan.map(function (x) { return { id: x.id, qty: x.qty }; });
      var f = copy.filter(function (x) { return x.id === p.image; })[0];
      if (f) f.qty += 1; else copy.push({ id: p.image, qty: 1 });
      var lay = M.gymLayout(s.W, s.L, copy);
      if (Object.keys(lay.left).length) return false;
      plan = copy;
      return true;
    };
    // order: cardio, the basic free weights every gym needs (bench, dumbbells),
    // the machines, then the other free weights and the extra ones
    var core = function (f) {
      var ty = typeOf(f[0]);
      if (ty === "bench" || ty === "dumbbells") return true;
      if ((ty === "barbell" || ty === "plates") && (s.type === "full" || s.type === "strength") && A >= 80) return true;
      return ty === "mat" && s.type !== "strength" && A >= 60;
    };
    cardioUnits.forEach(tryAdd);
    free.filter(core).forEach(function (f) { tryAdd(f[0]); });
    machines.forEach(tryAdd);
    free.filter(function (f) { return !core(f); }).forEach(function (f) { tryAdd(f[0]); });
    free.forEach(function (f) { for (var q = 1; q < f[1]; q++) if (tryAdd(f[0]) === false) break; });
    return plan;
  }

  /* ---------- saved state ---------- */
  function load() {
    var s = { name: "", logo: "", type: "full", W: 12, L: 10, line: "mix", lines: [] };
    try {
      var raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") {
        ["name", "logo", "type", "line"].forEach(function (k) { if (typeof raw[k] === "string") s[k] = raw[k]; });
        if (raw.W >= MIN && raw.W <= MAX) s.W = raw.W;
        if (raw.L >= MIN && raw.L <= MAX) s.L = raw.L;
        if (Array.isArray(raw.lines)) s.lines = raw.lines.filter(function (x) { return x && typeof x.id === "string" && x.qty > 0; }).slice(0, 80);
      }
    } catch (e) { /* ignore */ }
    if (!KINDS[s.type]) s.type = "full";
    return s;
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) {
      // logo too big for this phone's storage: keep the rest
      try { var c = JSON.parse(JSON.stringify(state)); c.logo = ""; window.localStorage.setItem(KEY, JSON.stringify(c)); } catch (e2) { /* ignore */ }
    }
  }
  var state = load();
  function shownLines() { return state.lines.filter(function (x) { return M.productByImage(x.id); }); }

  /* ---------- window ---------- */
  var w = M.makeWindow("gymPlan", "gp-panel");
  var ui = {};

  function kindName(k) { return t().gpTypes[k]; }
  function lineOptions() {
    var out = [["mix", t().gpLineMix]];
    (window.GYM_SERIES || []).forEach(function (s) { out.push([s.id, typeof s.name === "string" ? s.name : tr(s.name)]); });
    return out;
  }

  function drawForm() {
    var d = t();
    w.title.textContent = d.gpTitle;
    w.body.textContent = "";
    w.body.appendChild(el("p", "panel-note", d.gpIntro));
    var form = el("div", "gp-form");
    // name + logo
    var name = el("input", "in22");
    name.type = "text"; name.maxLength = 60; name.value = state.name; name.autocomplete = "organization";
    name.placeholder = d.gpNameHint;
    name.addEventListener("input", function () { state.name = name.value.trim(); save(); });
    form.appendChild(M.field(d.gpName, name));
    var logoBox = el("div", "gp-logo");
    var logoImg = el("img", "gp-logo-img");
    logoImg.alt = "";
    var logoIn = el("input");
    logoIn.type = "file"; logoIn.accept = "image/*"; logoIn.className = "sr-only"; logoIn.id = "gpLogoFile";
    var logoBtn = el("label", "btn btn-outline btn-small", d.gpLogoAdd);
    logoBtn.setAttribute("for", "gpLogoFile");
    var logoDel = el("button", "btn btn-outline btn-small", d.gpLogoRemove);
    logoDel.type = "button";
    function showLogo() {
      logoImg.hidden = !state.logo;
      if (state.logo) logoImg.src = state.logo;
      logoDel.hidden = !state.logo;
      logoBtn.textContent = state.logo ? d.gpLogoChange : d.gpLogoAdd;
    }
    logoIn.addEventListener("change", function () {
      var f = logoIn.files && logoIn.files[0];
      if (!f) return;
      M.readImage(f, 420, "image/png").then(function (data) { state.logo = data; save(); showLogo(); })
        .catch(function () { M.toast(d.gpLogoBad); });
      logoIn.value = "";
    });
    logoDel.addEventListener("click", function () { state.logo = ""; save(); showLogo(); });
    logoBox.appendChild(logoImg);
    logoBox.appendChild(logoIn);
    logoBox.appendChild(logoBtn);
    logoBox.appendChild(logoDel);
    var logoField = el("div", "f22");
    logoField.appendChild(el("span", "f22-label", d.gpLogo));
    logoField.appendChild(logoBox);
    form.appendChild(logoField);
    showLogo();
    // type
    var typeField = el("div", "f22 f22-wide");
    typeField.appendChild(el("span", "f22-label", d.gpType));
    typeField.appendChild(M.chips(Object.keys(KINDS).map(function (k) { return [k, kindName(k)]; }), state.type,
      function (v) { state.type = v; save(); }, d.gpType));
    form.appendChild(typeField);
    // size
    var sizeField = el("div", "f22 f22-wide");
    sizeField.appendChild(el("span", "f22-label", d.gpSize));
    var row = el("div", "gp-size");
    var wIn = el("input", "in22"), lIn = el("input", "in22");
    [wIn, lIn].forEach(function (inp) { inp.type = "number"; inp.min = MIN; inp.max = MAX; inp.step = "0.5"; inp.inputMode = "decimal"; });
    wIn.value = state.W; lIn.value = state.L;
    wIn.setAttribute("aria-label", d.gpWidth); lIn.setAttribute("aria-label", d.gpLength);
    var area = el("span", "gp-area");
    function showArea() {
      var a = (parseFloat(wIn.value) || 0) * (parseFloat(lIn.value) || 0);
      area.textContent = a > 0 ? d.gpArea(Math.round(a)) : "";
    }
    [wIn, lIn].forEach(function (inp) { inp.addEventListener("input", showArea); });
    var wl = el("label", "gp-dim"); wl.appendChild(el("span", "", d.gpWidth)); wl.appendChild(wIn);
    var ll = el("label", "gp-dim"); ll.appendChild(el("span", "", d.gpLength)); ll.appendChild(lIn);
    row.appendChild(wl); row.appendChild(el("span", "gp-x", "×")); row.appendChild(ll); row.appendChild(area);
    sizeField.appendChild(row);
    var quick = el("div", "chips22 gp-quick");
    [[8, 8], [12, 10], [16, 13], [22, 18]].forEach(function (q) {
      var b = el("button", "chip22", d.gpArea(q[0] * q[1]));
      b.type = "button";
      b.addEventListener("click", function () { wIn.value = q[0]; lIn.value = q[1]; showArea(); });
      quick.appendChild(b);
    });
    sizeField.appendChild(quick);
    form.appendChild(sizeField);
    showArea();
    // machine line
    var line = el("select", "in22");
    lineOptions().forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; if (o[0] === state.line) op.selected = true; line.appendChild(op); });
    line.addEventListener("change", function () { state.line = line.value; save(); });
    form.appendChild(M.field(d.gpLine, line));
    w.body.appendChild(form);
    var err = el("p", "err22");
    err.hidden = true;
    err.setAttribute("role", "alert");
    w.body.appendChild(err);
    var make = el("button", "btn gp-make", d.gpMake);
    make.type = "button";
    make.addEventListener("click", function () {
      var W = parseFloat(wIn.value), L = parseFloat(lIn.value);
      if (!(W >= MIN && L >= MIN && W <= MAX && L <= MAX)) { err.textContent = d.gpSizeErr(MIN, MAX); err.hidden = false; wIn.focus(); return; }
      state.W = Math.round(W * 10) / 10;
      state.L = Math.round(L * 10) / 10;
      state.lines = generate(state);
      save();
      drawResult(true);
    });
    w.body.appendChild(make);
    ui.make = make;
  }

  /* ---------- floor plan drawing (screen and PDF) ---------- */
  var ZCOL = M.GYM_ZONE_COLORS;
  function numbering(lay) {
    // one number per product line (same as the list)
    var nums = {};
    shownLines().forEach(function (x, i) { nums[x.id] = i + 1; });
    return nums;
  }
  /* ---------- result ---------- */
  function layoutNow() { return M.gymLayout(state.W, state.L, shownLines()); }
  function counts(lay) {
    var c = { cardio: 0, machine: 0, free: 0, stretch: 0, small: 0 };
    lay.items.forEach(function (it) { c[it.zone] += 1; });
    lay.small.forEach(function (s) { c.small += s.qty; });
    return c;
  }

  function drawResult(scroll) {
    var d = t();
    w.title.textContent = state.name ? d.gpTitleFor(state.name) : d.gpTitle;
    w.body.textContent = "";
    var lay = layoutNow();
    var c = counts(lay);
    var top = el("div", "gp-head");
    if (state.logo) { var lg = el("img", "gp-head-logo"); lg.src = state.logo; lg.alt = ""; top.appendChild(lg); }
    var info = el("div", "gp-head-info");
    info.appendChild(el("p", "gp-head-line", kindName(state.type) + " · " + d.gpDims(state.W, state.L) + " · " + d.gpArea(Math.round(state.W * state.L))));
    var chips = el("div", "gp-stats");
    [["cardio", d.gpCardio, c.cardio], ["machine", d.gpMachines, c.machine], ["free", d.gpFree, c.free], ["stretch", d.gpStretch, c.stretch]].forEach(function (z) {
      if (!z[2]) return;
      var s = el("span", "gp-stat gp-z-" + z[0]);
      s.appendChild(el("b", "", String(z[2])));
      s.appendChild(document.createTextNode(" " + z[1]));
      chips.appendChild(s);
    });
    info.appendChild(chips);
    var people = c.cardio + c.machine + Math.round(c.free / 2) + c.stretch;
    info.appendChild(el("p", "gp-people", d.gpPeople(people)));
    top.appendChild(info);
    w.body.appendChild(top);

    var leftN = 0;
    Object.keys(lay.left).forEach(function (k) { leftN += lay.left[k]; });
    if (leftN) {
      var warn = el("p", "err22", d.gpNoFit(leftN));
      warn.setAttribute("role", "alert");
      w.body.appendChild(warn);
    }

    // actions
    var acts = el("div", "gp-actions");
    var b3 = el("button", "btn gp-3d");
    b3.type = "button";
    b3.innerHTML = M.icon22("gym", 18);
    b3.appendChild(el("span", "", d.gp3d));
    b3.addEventListener("click", function () { open3d(b3); });
    var send = el("button", "btn btn-whatsapp gp-send");
    send.type = "button";
    if (M.WA_ICON) send.innerHTML = M.WA_ICON;
    send.appendChild(el("span", "", d.gpSend));
    send.addEventListener("click", function () { sendPlan(send); });
    var pdf = el("button", "btn btn-outline gp-pdf", d.gpPdf);
    pdf.type = "button";
    pdf.addEventListener("click", function () { makePdf(pdf); });
    var bask = el("button", "btn btn-outline gp-basket", d.gpBasket);
    bask.type = "button";
    bask.addEventListener("click", function () {
      shownLines().forEach(function (x) { M.addToBasket(x.id, x.qty, true); });
      M.toast("✓ " + d.gpAdded, t().basketView, function (btn) { M.openBasket(btn); });
    });
    acts.appendChild(b3); acts.appendChild(send); acts.appendChild(pdf); acts.appendChild(bask);
    w.body.appendChild(acts);

    // floor plan
    var planBox = el("figure", "gp-plan");
    var cv = el("canvas", "gp-canvas");
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", d.gpPlanLabel(lay.items.length, state.W, state.L));
    planBox.appendChild(cv);
    var tip = el("p", "gp-tip");
    tip.setAttribute("aria-live", "polite");
    var legend = el("figcaption", "gp-legend");
    [["cardio", d.gpCardio], ["machine", d.gpMachines], ["free", d.gpFree], ["stretch", d.gpStretch]].forEach(function (z) {
      var s = el("span", "gp-leg gp-z-" + z[0], z[1]);
      legend.appendChild(s);
    });
    legend.appendChild(el("span", "gp-leg gp-door", d.gpEntrance));
    planBox.appendChild(tip);
    planBox.appendChild(legend);
    w.body.appendChild(el("h3", "gp-h", d.gpPlan));
    w.body.appendChild(planBox);
    var paint = function () {
      var cw = Math.min(planBox.clientWidth || 320, 720);
      var ch = Math.round(cw * Math.min(1.1, Math.max(0.45, state.L / state.W)));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      cv.style.width = cw + "px"; cv.style.height = ch + "px";
      var ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var dark = getComputedStyle(document.documentElement).colorScheme.indexOf("light") === -1;
      M.drawGymPlan(ctx, lay, 2, 2, cw - 4, ch - 4, numbering(lay), { floor: dark ? "#1d1d21" : "#f3f2ee", grid: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", wall: dark ? "#e8e6df" : "#111", scale: 0.4 });
    };
    requestAnimationFrame(paint);
    cv.addEventListener("click", function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var hit = lay.items.filter(function (it) { var b = it.box; return b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]; })[0];
      var p = hit && M.productByImage(hit.id);
      tip.textContent = p ? (numbering(lay)[hit.id] + ". " + tr(p.name) + (p.no ? " (" + p.no + ")" : "")) : "";
    });

    // list
    w.body.appendChild(el("h3", "gp-h", d.gpList));
    var list = el("div", "gp-list");
    var nums = numbering(lay);
    var groups = [["cardio", d.gpCardio], ["machine", d.gpMachines], ["free", d.gpFree], ["stretch", d.gpStretch], ["small", d.gpSmall]];
    groups.forEach(function (gz) {
      var lines = shownLines().filter(function (x) { return M.gymZone(M.productByImage(x.id)) === gz[0]; });
      if (!lines.length) return;
      list.appendChild(el("h4", "gp-zone gp-z-" + gz[0], gz[1]));
      lines.forEach(function (x) {
        var p = M.productByImage(x.id);
        var rowEl = el("div", "gp-row");
        rowEl.appendChild(el("span", "gp-num", String(nums[x.id] || "")));
        var im = el("img", "gp-thumb");
        im.src = M.imgSrc(p); im.alt = ""; im.loading = "lazy";
        rowEl.appendChild(im);
        var nm = el("div", "gp-name");
        nm.appendChild(el("b", "", tr(p.name)));
        if (p.no) nm.appendChild(el("span", "gp-code", p.no));
        if (lay.left[x.id]) nm.appendChild(el("span", "gp-nofit", d.gpNoFitItem(lay.left[x.id])));
        var alts = alternatives(p);
        if (alts.length > 1) {
          var sel = el("select", "in22 gp-alt");
          sel.setAttribute("aria-label", d.gpChange + ": " + tr(p.name));
          alts.forEach(function (a) {
            var op = el("option", "", tr(a.name) + (a.no ? " · " + a.no : ""));
            op.value = a.image;
            if (a === p) op.selected = true;
            sel.appendChild(op);
          });
          sel.addEventListener("change", function () {
            var other = state.lines.filter(function (y) { return y.id === sel.value; })[0];
            if (other && other !== x) { other.qty += x.qty; state.lines.splice(state.lines.indexOf(x), 1); }
            else x.id = sel.value;
            save(); drawResult(false);
          });
          nm.appendChild(sel);
        }
        rowEl.appendChild(nm);
        var qty = el("div", "gp-qty");
        var minus = el("button", "qty-btn", "−"), plus = el("button", "qty-btn", "+");
        minus.type = plus.type = "button";
        minus.setAttribute("aria-label", d.gpLess + ": " + tr(p.name));
        plus.setAttribute("aria-label", d.gpMore + ": " + tr(p.name));
        var val = el("span", "qty-val", String(x.qty));
        minus.addEventListener("click", function () {
          x.qty -= 1;
          if (x.qty <= 0) state.lines.splice(state.lines.indexOf(x), 1);
          save(); drawResult(false);
          focusRow(p.image, "minus");
        });
        plus.addEventListener("click", function () { x.qty = Math.min(99, x.qty + 1); save(); drawResult(false); focusRow(p.image, "plus"); });
        qty.appendChild(minus); qty.appendChild(val); qty.appendChild(plus);
        rowEl.appendChild(qty);
        rowEl.setAttribute("data-id", p.image);
        list.appendChild(rowEl);
      });
    });
    w.body.appendChild(list);
    var again = el("button", "btn btn-outline gp-again", d.gpRemake);
    again.type = "button";
    again.addEventListener("click", function () { drawForm(); var f = w.body.querySelector("input"); if (f) f.focus(); });
    w.body.appendChild(again);
    if (scroll) { w.panel.scrollTop = 0; b3.focus({ preventScroll: true }); }
  }
  function focusRow(id, which) {
    var r = w.body.querySelector('.gp-row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    var b = r && r.querySelectorAll(".qty-btn")[which === "minus" ? 0 : 1];
    if (b) b.focus({ preventScroll: true });
    else { var l = w.body.querySelector(".gp-list .qty-btn"); if (l) l.focus({ preventScroll: true }); }
  }

  /* ---------- 3D ---------- */
  function open3d(opener) {
    var lay = layoutNow();
    var plan = { W: state.W, L: state.L, items: lay.items, logo: state.logo, name: state.name };
    M.openGym3d(plan, opener, function () { openWindow(null, true); });
  }

  /* ---------- WhatsApp ---------- */
  function lineText(x, i) {
    var p = M.productByImage(x.id);
    return (i + 1) + ". " + M.waProductName(p) + (p.no ? " (" + p.no + ")" : "") + " × " + x.qty;
  }
  function sendPlan(opener) {
    var d = t();
    var lines = shownLines();
    var msg = d.gpMsgIntro + "\n\n" +
      (state.name ? d.gpMsgGym + ": " + state.name + "\n" : "") +
      d.gpMsgType + ": " + kindName(state.type) + "\n" +
      d.gpMsgSize + ": " + d.gpDims(state.W, state.L) + " (" + d.gpArea(Math.round(state.W * state.L)) + ")\n\n" +
      lines.map(lineText).join("\n");
    var items = lines.map(function (x) { var p = M.productByImage(x.id); return { name: M.waProductName(p), no: p.no || "", qty: x.qty }; });
    var gym = { name: state.name.slice(0, 60), type: state.type, W: state.W, L: state.L, line: state.line };
    if (state.logo && state.logo.length < 120000) gym.logo = state.logo;
    if (window.MF_REQUEST) {
      window.MF_REQUEST.open({ kind: "gymplan", item: d.gpTitle + ": " + (state.name || kindName(state.type)) + " · " + d.gpDims(state.W, state.L),
        message: msg, items: items, extra: { gym: gym } }, opener);
    } else window.open(M.waUrl(msg), "_blank", "noopener");
  }

  /* ---------- PDF offer ---------- */
  function makePdf(btn) {
    if (!P) return;
    var d = t(), lang = M.lang(), R = lang !== "en";
    var W = 1240, H = 1754, MG = 70, RED = "#d31822", INK = "#111112", MUTED = "#6b6b70", LINE = "#e4e4df";
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = d.gpMaking;
    var lay = layoutNow();
    var lines = shownLines();
    var al = R ? "right" : "left", ar = R ? "left" : "right";
    var X = function (x) { return R ? W - x : x; };
    var pages = [];
    function header(ctx, logo) {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, W, 170);
      ctx.fillStyle = RED; ctx.fillRect(0, 170, W, 8);
      if (logo) ctx.drawImage(logo, R ? W - MG - 100 : MG, 35, 100, 100);
      ctx.save(); ctx.font = P.font(900, 44, false); var mw = ctx.measureText("MARSHAL").width; ctx.restore();
      var bx = R ? W - MG - 120 - mw - 190 : MG + 120;
      P.text(ctx, "MARSHAL", { x: bx, y: 100, size: 44, weight: 900, color: "#fff", align: "left" });
      P.text(ctx, "FITNESS", { x: bx + mw, y: 100, size: 44, weight: 900, color: RED, align: "left" });
      P.text(ctx, d.gpPdfTitle, { x: X(W - MG), y: 104, size: 46, weight: 900, color: "#fff", rtl: R, align: ar });
    }
    function footer(ctx, n, total) {
      ctx.fillStyle = LINE; ctx.fillRect(MG, H - 110, W - 2 * MG, 2);
      var s = M.S;
      P.text(ctx, s.phoneDisplay + "  ·  " + String(s.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, ""), { x: X(MG), y: H - 60, size: 24, weight: 700, color: INK, align: al });
      P.text(ctx, d.catPage ? d.catPage(n, total) : n + "/" + total, { x: X(W - MG), y: H - 60, size: 22, weight: 600, color: MUTED, rtl: R, align: ar });
    }
    var srcs = lines.map(function (x) { return M.imgSrc(M.productByImage(x.id)); });
    Promise.all([P.fontsReady(), P.loadImg("assets/logo.png"), P.loadImg(state.logo || "")].concat(srcs.map(P.loadImg))).then(function (r) {
      var logo = r[1], gymLogo = r[2], thumbs = r.slice(3);
      var perPage = 12, listPages = Math.max(1, Math.ceil(lines.length / perPage)), total = 1 + listPages;
      // page 1: the plan
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var ctx = c.getContext("2d");
      header(ctx, logo);
      var y = 250;
      if (gymLogo) { P.contain(ctx, gymLogo, R ? MG : W - MG - 180, 205, 180, 130); }
      P.text(ctx, state.name || kindName(state.type), { x: X(MG), y: y + 20, size: 50, weight: 900, color: INK, rtl: R, align: al, maxWidth: W - 2 * MG - 220, lines: 1 });
      P.text(ctx, kindName(state.type) + "  ·  " + d.gpDims(state.W, state.L) + "  ·  " + d.gpArea(Math.round(state.W * state.L)), { x: X(MG), y: y + 74, size: 28, weight: 700, color: MUTED, rtl: R, align: al });
      var cn = counts(lay);
      var stats = [[d.gpCardio, cn.cardio, ZCOL.cardio], [d.gpMachines, cn.machine, ZCOL.machine], [d.gpFree, cn.free, ZCOL.free], [d.gpStretch, cn.stretch, ZCOL.stretch]];
      var sx = MG, bw = (W - 2 * MG - 3 * 20) / 4;
      stats.forEach(function (st, i) {
        var bx2 = R ? W - MG - (i + 1) * bw - i * 20 : sx + i * (bw + 20);
        ctx.fillStyle = "#f4f3ef"; P.roundRect(ctx, bx2, y + 110, bw, 110, 16); ctx.fill();
        ctx.fillStyle = st[2]; ctx.fillRect(R ? bx2 + bw - 10 : bx2, y + 110, 10, 110);
        P.text(ctx, String(st[1]), { x: bx2 + bw / 2, y: y + 168, size: 46, weight: 900, color: INK, align: "center" });
        P.text(ctx, st[0], { x: bx2 + bw / 2, y: y + 204, size: 22, weight: 700, color: MUTED, rtl: R, align: "center" });
      });
      var planTop = y + 260, planH = H - planTop - 200;
      M.drawGymPlan(ctx, lay, MG, planTop, W - 2 * MG, planH, numbering(lay), { floor: "#f3f2ee", grid: "rgba(0,0,0,.08)", wall: "#111", scale: 1 });
      // legend
      var lx = MG, ly = H - 170;
      [[d.gpCardio, ZCOL.cardio], [d.gpMachines, ZCOL.machine], [d.gpFree, ZCOL.free], [d.gpStretch, ZCOL.stretch]].forEach(function (z, i) {
        var xx = R ? W - MG - i * 280 - 28 : lx + i * 280;
        ctx.fillStyle = z[1]; ctx.fillRect(xx, ly - 22, 28, 28);
        P.text(ctx, z[0], { x: R ? xx - 12 : xx + 40, y: ly, size: 24, weight: 700, color: INK, rtl: R, align: al });
      });
      footer(ctx, 1, total);
      return P.toJpeg(c, 0.88).then(function (jpeg) {
        pages.push({ jpeg: jpeg, w: W, h: H, links: [] });
        // list pages
        var chain = Promise.resolve();
        for (var pg = 0; pg < listPages; pg++) {
          (function (pg) {
            chain = chain.then(function () {
              var c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
              var cx = c2.getContext("2d");
              header(cx, logo);
              var yy = 240;
              P.text(cx, d.gpList, { x: X(MG), y: yy, size: 40, weight: 900, color: INK, rtl: R, align: al });
              yy += 40;
              var nums = numbering(lay);
              lines.slice(pg * perPage, pg * perPage + perPage).forEach(function (x, i) {
                var idx = pg * perPage + i, p = M.productByImage(x.id), rowH = 104;
                if (i % 2 === 0) { cx.fillStyle = "#f6f6f3"; cx.fillRect(MG, yy, W - 2 * MG, rowH); }
                var zc = ZCOL[M.gymZone(p)] || "#999";
                cx.fillStyle = zc; P.roundRect(cx, R ? W - MG - 70 : MG + 14, yy + 30, 52, 44, 10); cx.fill();
                P.text(cx, String(nums[x.id] || idx + 1), { x: R ? W - MG - 44 : MG + 40, y: yy + 62, size: 26, weight: 900, color: "#fff", align: "center" });
                if (thumbs[idx]) P.contain(cx, thumbs[idx], R ? W - MG - 180 : MG + 84, yy + 8, 88, 88);
                P.text(cx, tr(p.name), { x: R ? W - MG - 200 : MG + 196, y: yy + 48, size: 28, weight: 800, color: INK, rtl: R, align: al, maxWidth: 700, lines: 1 });
                P.text(cx, (p.no ? p.no + "  ·  " : "") + (M.catName ? M.catName(p.cat) : ""), { x: R ? W - MG - 200 : MG + 196, y: yy + 84, size: 22, weight: 600, color: MUTED, rtl: R, align: al, maxWidth: 700, lines: 1 });
                P.text(cx, "× " + x.qty, { x: X(W - MG - 30), y: yy + 64, size: 34, weight: 900, color: INK, align: ar });
                yy += rowH;
              });
              var box = null;
              if (pg === listPages - 1) {
                yy += 40;
                box = { x: MG, y: yy, w: W - 2 * MG, h: 150, url: M.waUrl(d.gpMsgIntro + "\n\n" + lines.map(lineText).join("\n")) };
                cx.fillStyle = "#0b0b0c"; P.roundRect(cx, MG, yy, W - 2 * MG, 150, 20); cx.fill();
                P.text(cx, d.gpPdfPrices, { x: X(MG + 36), y: yy + 64, size: 30, weight: 900, color: "#fff", rtl: R, align: al, maxWidth: W - 2 * MG - 72, lines: 1 });
                P.text(cx, "WhatsApp: " + M.S.phoneDisplay, { x: X(MG + 36), y: yy + 114, size: 28, weight: 700, color: "#25d366", align: al });
              }
              footer(cx, pg + 2, total);
              return P.toJpeg(c2, 0.88).then(function (j2) {
                pages.push({ jpeg: j2, w: W, h: H, links: box ? [box] : [] });
              });
            });
          })(pg);
        }
        return chain;
      });
    }).then(function () {
      var name = "Marshal-Fitness-Gym-Plan" + (state.name ? "-" + state.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") : "") + ".pdf";
      var blob = P.build(pages, P.A4, "Marshal Fitness — " + d.gpPdfTitle);
      if (P.canShareFile(blob, name) && navigator.maxTouchPoints > 0) return P.share(blob, name, d.gpPdfTitle).catch(function () { P.save(blob, name); });
      P.save(blob, name);
    }).catch(function () { M.toast(d.catError || "Error"); })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- open ---------- */
  function openWindow(opener, keep) {
    if (state.lines.length && shownLines().length) drawResult(!keep); else drawForm();
    M.openModal(w.modal, opener || null, keep ? null : (state.lines.length ? w.body.querySelector(".gp-3d") : w.body.querySelector("input")));
  }
  M.openGymPlan = function (opener) { openWindow(opener, false); };
  M.gymPlanState = function () { return JSON.parse(JSON.stringify(state)); };
  M.onRender(function () {
    if (w.modal.hidden) return;
    if (state.lines.length && w.body.querySelector(".gp-list")) drawResult(false); else drawForm();
  });
})();
