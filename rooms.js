/* Marshal Fitness — version 22: ready gym rooms ("shop the room").
   Each room is a set of real products that fit together in a given space.
   The customer can add the whole room to the basket, walk inside it in 3D,
   load it into "Will it fit?" with their own room size, or ask the price.
   Admin can change the rooms (content/rooms -> window.ROOMS_EDIT). */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.makeWindow || !M.gymLayout) return;
  var el = M.el;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  var BUILT_IN = window.ROOMS_BUILT_IN || [];
  M.ROOMS_BUILT_IN = BUILT_IN;

  // admin rooms (if any), else the built-in ones; only products that exist now
  function rooms() {
    var src = Array.isArray(window.ROOMS_EDIT) && window.ROOMS_EDIT.length ? window.ROOMS_EDIT : BUILT_IN;
    return src.filter(function (r) { return r && !r.hidden && r.name && Array.isArray(r.items); }).map(function (r) {
      var items = r.items.map(function (x) { return Array.isArray(x) ? { id: x[0], qty: x[1] } : { id: x.id, qty: x.qty }; })
        .filter(function (x) { return typeof x.id === "string" && x.qty > 0 && M.productByImage(x.id); });
      return { id: String(r.id || ""), W: Number(r.W) || 4, L: Number(r.L) || 4, name: r.name, note: r.note || "", items: items };
    }).filter(function (r) { return r.items.length; });
  }
  M.gymRooms = rooms;
  function count(r) { var n = 0; r.items.forEach(function (x) { n += x.qty; }); return n; }
  function tight(r) { return r.W * r.L < 60; }  // home rooms and small gyms: less space between things
  function layoutOf(r) { return M.gymLayout(r.W, r.L, r.items, { tight: tight(r) }); }

  /* ---------- section on the home page ---------- */
  var section = document.getElementById("roomsSection");
  var row = document.getElementById("roomsRow");
  function card(r) {
    var d = t();
    var b = el("button", "room-card");
    b.type = "button";
    b.setAttribute("data-room", r.id);
    var art = el("span", "room-art");
    art.setAttribute("aria-hidden", "true");
    r.items.slice(0, 3).forEach(function (x, i) {
      var p = M.productByImage(x.id);
      var c = M.cutout ? M.cutout(p) : null;
      var im = el("img", "room-art-" + i);
      im.src = c ? c.src : M.imgSrc(p);
      im.alt = "";
      im.loading = "lazy";
      art.appendChild(im);
    });
    b.appendChild(art);
    var txt = el("span", "room-txt");
    txt.appendChild(el("b", "room-name", tr(r.name)));
    txt.appendChild(el("span", "room-meta", d.roomMeta(count(r), r.W, r.L)));
    b.appendChild(txt);
    b.addEventListener("click", function () { openRoom(r.id, b); });
    return b;
  }
  function drawSection() {
    if (!section || !row) return;
    var d = t();
    var h = document.getElementById("roomsTitleH"), sub = document.getElementById("roomsSub");
    if (h) h.textContent = d.roomsTitle;
    if (sub) sub.textContent = d.roomsSubtitle;
    row.textContent = "";
    row.removeAttribute("aria-busy");
    var list = rooms();
    list.forEach(function (r) { row.appendChild(card(r)); });
    section.hidden = !list.length;
  }

  /* ---------- the room window ---------- */
  var w = M.makeWindow("roomModal", "room-panel");
  var current = null, backTo = null;
  // closing a product opened from a room: back to the room
  var lbox = document.getElementById("lightbox");
  if (lbox) lbox.addEventListener("modal-close", function () {
    if (!backTo) return;
    var id = backTo;
    backTo = null;
    setTimeout(function () { if (!document.documentElement.classList.contains("lb-open") && !document.documentElement.classList.contains("stage-open")) openRoom(id, null); }, 0);
  });
  function openRoom(id, opener) {
    var r = rooms().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    current = r.id;
    draw(r);
    M.openModal(w.modal, opener || null, w.body.querySelector(".room-add"));
  }
  M.openRoom = openRoom;

  function draw(r) {
    var d = t();
    w.title.textContent = tr(r.name);
    w.body.textContent = "";
    w.body.appendChild(el("p", "room-sub", d.roomMeta(count(r), r.W, r.L) + (r.note ? " · " + tr(r.note) : "")));
    var lay = layoutOf(r);
    // plan
    var fig = el("figure", "gp-plan room-plan");
    var cv = el("canvas", "gp-canvas");
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", d.gpPlanLabel(lay.items.length, r.W, r.L));
    fig.appendChild(cv);
    var nums = {};
    r.items.forEach(function (x, i) { nums[x.id] = i + 1; });
    requestAnimationFrame(function () {
      var cw = Math.min(fig.clientWidth || 300, 520), ch = Math.round(cw * Math.min(1.1, r.L / r.W));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      cv.style.width = cw + "px"; cv.style.height = ch + "px";
      var ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var dark = getComputedStyle(document.documentElement).colorScheme.indexOf("light") === -1;
      M.drawGymPlan(ctx, lay, 2, 2, cw - 4, ch - 4, nums, { floor: dark ? "#1d1d21" : "#f3f2ee", grid: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)", wall: dark ? "#e8e6df" : "#111", scale: 0.4 });
    });
    // actions
    var acts = el("div", "gp-actions");
    var add = el("button", "btn room-add", d.roomAdd);
    add.type = "button";
    add.addEventListener("click", function () {
      r.items.forEach(function (x) { M.addToBasket(x.id, x.qty, true); });
      M.toast("✓ " + d.roomAdded(count(r)), t().basketView, function (btn) { M.openBasket(btn); });
    });
    var see = el("button", "btn btn-outline room-3d");
    see.type = "button";
    see.innerHTML = M.icon22("gym", 18);
    see.appendChild(el("span", "", d.room3d));
    see.addEventListener("click", function () {
      M.openGym3d({ W: r.W, L: r.L, items: lay.items, logo: "", name: tr(r.name) }, see, function () { openRoom(r.id, null); });
    });
    var fit = el("button", "btn btn-outline room-fit", d.roomFit);
    fit.type = "button";
    fit.addEventListener("click", function () {
      if (!M.plannerLoad) return;
      M.plannerLoad({ W: r.W, L: r.L, items: lay.items.map(function (it) {
        var p = M.productByImage(it.id), s = M.plannerSize(p);
        return { id: it.id, x: it.x, y: it.y, rot: s[0] !== it.w ? 1 : 0 };
      }) }, null);
    });
    var ask = el("button", "btn btn-whatsapp room-ask");
    ask.type = "button";
    if (M.WA_ICON) ask.innerHTML = M.WA_ICON;
    ask.appendChild(el("span", "", d.roomAsk));
    ask.addEventListener("click", function () {
      var msg = d.roomMsg(tr(r.name), r.W, r.L) + "\n\n" + r.items.map(function (x, i) {
        var p = M.productByImage(x.id);
        return (i + 1) + ". " + M.waProductName(p) + (p.no ? " (" + p.no + ")" : "") + " × " + x.qty;
      }).join("\n");
      var items = r.items.map(function (x) { var p = M.productByImage(x.id); return { name: M.waProductName(p), no: p.no || "", qty: x.qty }; });
      if (window.MF_REQUEST) window.MF_REQUEST.open({ kind: "room", item: tr(r.name), message: msg, items: items, extra: { room: { id: r.id, W: r.W, L: r.L } } }, ask);
    });
    acts.appendChild(add); acts.appendChild(see); acts.appendChild(fit); acts.appendChild(ask);
    w.body.appendChild(acts);
    w.body.appendChild(fig);
    // products
    var list = el("div", "gp-list room-list");
    r.items.forEach(function (x, i) {
      var p = M.productByImage(x.id);
      var line = el("div", "gp-row");
      line.appendChild(el("span", "gp-num", String(i + 1)));
      var im = el("img", "gp-thumb");
      im.src = M.imgSrc(p); im.alt = ""; im.loading = "lazy";
      line.appendChild(im);
      var nm = el("button", "gp-name room-open");
      nm.type = "button";
      nm.appendChild(el("b", "", tr(p.name)));
      if (p.no) nm.appendChild(el("span", "gp-code", p.no));
      nm.addEventListener("click", function () { backTo = r.id; M.openLightbox(p, nm); });
      line.appendChild(nm);
      line.appendChild(el("span", "room-qty", "× " + x.qty));
      list.appendChild(line);
    });
    w.body.appendChild(list);
    if (Object.keys(lay.left).length) w.body.appendChild(el("p", "panel-note", d.roomBigger));
  }

  drawSection();
  M.onRender(function () {
    drawSection();
    if (!w.modal.hidden && current) { var r = rooms().filter(function (x) { return x.id === current; })[0]; if (r) draw(r); }
  });
})();
