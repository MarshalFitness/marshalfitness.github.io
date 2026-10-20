/* Marshal Fitness — shopping basket, save (♥), share, "You may also like",
   and the big-photo behaviour (tap to close, two-finger zoom).
   Loaded after script.js (window.MF). Texts are in content.js. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;

  var BASKET_KEY = "marshal-equipment-list"; // same key as the old "My Equipment List", so old lists are kept
  var SAVED_KEY = "marshal-saved";
  var MAX_QTY = 99;
  var root = document.documentElement;

  var SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON = {
    basket: '<svg ' + SVG + ' width="18" height="18"><path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/></svg>',
    check: '<svg ' + SVG + ' width="18" height="18"><path d="M20 6 9 17l-5-5"/></svg>',
    heart: '<svg ' + SVG + ' width="18" height="18"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    share: '<svg ' + SVG + ' width="17" height="17"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>',
    trash: '<svg ' + SVG + ' width="18" height="18"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    minus: '<svg ' + SVG + ' width="16" height="16"><path d="M5 12h14"/></svg>',
    plus: '<svg ' + SVG + ' width="16" height="16"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    big: '<svg ' + SVG + ' width="56" height="56" stroke-width="1.4"><path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/></svg>',
    done: '<svg ' + SVG + ' width="56" height="56" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>'
  };

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }
  function imgSrc(p) { return p.imageData || (M.S.imageBase + (p.thumbnail || p.image)); }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* =====================================================================
     STORAGE
     ===================================================================== */

  // Products that are not on the page right now (for example when the online
  // database was slow and the built-in list was used) are kept in storage
  // untouched, so nothing a customer picked is ever lost.
  var hiddenBasket = {};
  var hiddenSaved = [];

  function loadBasket() {
    var map = new Map();
    try {
      var obj = JSON.parse(window.localStorage.getItem(BASKET_KEY) || "{}");
      Object.keys(obj || {}).forEach(function (id) {
        var q = Math.floor(Number(obj[id]));
        if (!(q > 0)) return;
        if (M.productByImage(id)) map.set(id, Math.min(q, MAX_QTY));
        else hiddenBasket[id] = Math.min(q, MAX_QTY);
      });
    } catch (e) { /* storage can be blocked */ }
    return map;
  }
  function saveBasket() {
    try {
      var obj = {};
      Object.keys(hiddenBasket).forEach(function (id) { obj[id] = hiddenBasket[id]; });
      basket.forEach(function (q, id) { obj[id] = q; });
      window.localStorage.setItem(BASKET_KEY, JSON.stringify(obj));
    } catch (e) { /* ignore */ }
  }
  function loadSaved() {
    try {
      var arr = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
      if (!Array.isArray(arr)) return [];
      arr = arr.filter(function (id) { return typeof id === "string"; });
      hiddenSaved = arr.filter(function (id) { return !M.productByImage(id); });
      return arr.filter(function (id) { return M.productByImage(id); });
    } catch (e) { return []; }
  }
  function storeSaved() {
    try {
      var all = saved.concat(hiddenSaved.filter(function (id) { return saved.indexOf(id) === -1; }));
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(all.slice(0, 60)));
    } catch (e) { /* ignore */ }
  }

  var basket = loadBasket();
  var saved = loadSaved();
  var lastSent = null; // { number, url } after a basket was sent

  function totalQty() {
    var n = 0;
    basket.forEach(function (q) { n += q; });
    return n;
  }

  /* =====================================================================
     TOAST (small message at the bottom)
     ===================================================================== */

  var toast = document.getElementById("toast");
  var toastText = document.getElementById("toastText");
  var toastAction = document.getElementById("toastAction");
  var toastTimer = null;

  function showToast(text, actionLabel, action) {
    if (!toast) return;
    toastText.textContent = text;
    if (actionLabel && action) {
      toastAction.textContent = actionLabel;
      toastAction.hidden = false;
      toastAction.onclick = function () { hideToast(); action(toastAction); };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }
    toast.hidden = false;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3800);
  }
  function hideToast() {
    if (!toast) return;
    toast.classList.remove("show");
    toast.hidden = true;
  }
  M.toast = showToast;

  /* =====================================================================
     BASKET ACTIONS
     ===================================================================== */

  function addToBasket(id, qty, quiet) {
    var p = M.productByImage(id);
    if (!p) return;
    var cur = basket.get(id) || 0;
    basket.set(id, Math.min(MAX_QTY, cur + (qty || 1)));
    lastSent = null;
    saveBasket();
    refreshBasketUi(true);
    if (!quiet) showToast("✓ " + t().basketAdded, t().basketView, function (btn) { openBasket(btn); });
  }

  function setQty(id, qty) {
    if (qty <= 0) basket.delete(id);
    else basket.set(id, Math.min(MAX_QTY, qty));
    saveBasket();
    refreshBasketUi(false);
  }

  function clearBasket(keepHidden) {
    basket.clear();
    if (!keepHidden) hiddenBasket = {};
    saveBasket();
    refreshBasketUi(false);
  }

  function refreshBasketUi(bump) {
    var n = totalQty();
    ["basketCount", "barBasketCount"].forEach(function (id) {
      var badge = document.getElementById(id);
      if (!badge) return;
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.hidden = n === 0;
      if (bump && !reducedMotion()) {
        badge.classList.remove("bump");
        void badge.offsetWidth;
        badge.classList.add("bump");
      }
    });
    var label = t().basketOpen + (n ? " (" + n + ")" : "");
    var head = document.getElementById("basketBtn");
    if (head) head.setAttribute("aria-label", label);
    var bar = document.getElementById("barBasket");
    if (bar) bar.setAttribute("aria-label", label);
    updateCardStates();
    updateLightboxBasket();
    if (drawer && !drawer.hidden) renderBasket();
  }

  /* =====================================================================
     PRODUCT CARDS: ♥ save + ↗ share on the photo, "Add to basket" button
     ===================================================================== */

  function decorateCard(card, p) {
    if (card.querySelector(".card-basket")) return;
    var d = t();
    var name = tr(p.name);

    var tools = el("div", "card-tools");
    var save = el("button", "card-icon card-save");
    save.type = "button";
    save.innerHTML = ICON.heart;
    save.setAttribute("aria-label", d.saveBtn + " — " + name);
    save.addEventListener("click", function () { toggleSaved(p.image, card); });
    var share = el("button", "card-icon card-share");
    share.type = "button";
    share.innerHTML = ICON.share;
    share.setAttribute("aria-label", d.shareBtn + " — " + name);
    share.addEventListener("click", function () { M.shareProduct(p); });
    tools.appendChild(save);
    tools.appendChild(share);
    card.appendChild(tools);

    var add = el("button", "card-basket");
    add.type = "button";
    add.addEventListener("click", function () {
      if (basket.has(p.image)) openBasket(add);
      else addToBasket(p.image, 1);
    });
    var info = card.querySelector(".product-info");
    var price = info ? info.querySelector(".price-btn") : null;
    if (price && price.nextSibling) info.insertBefore(add, price.nextSibling);
    else if (info) info.appendChild(add);
    setCardState(card, p);
  }

  function setCardState(card, p) {
    var d = t();
    var name = tr(p.name);
    var add = card.querySelector(".card-basket");
    if (add) {
      var inB = basket.has(p.image);
      add.setAttribute("aria-pressed", inB ? "true" : "false");
      add.innerHTML = inB ? ICON.check : ICON.basket;
      add.appendChild(el("span", null, inB ? d.inBasket : d.addToBasket));
      add.setAttribute("aria-label", (inB ? d.inBasket : d.addToBasket) + " — " + name);
    }
    var save = card.querySelector(".card-save");
    if (save) save.setAttribute("aria-pressed", saved.indexOf(p.image) !== -1 ? "true" : "false");
  }

  function updateCardStates() {
    document.querySelectorAll(".product-card").forEach(function (card) {
      var p = M.productByImage(card.dataset.product);
      if (p) setCardState(card, p);
    });
  }

  M.onCard(decorateCard);

  /* =====================================================================
     SAVED (♥) PRODUCTS ROW
     ===================================================================== */

  function toggleSaved(id, anchor) {
    var i = saved.indexOf(id);
    if (i === -1) saved.unshift(id);
    else saved.splice(i, 1);
    saved = saved.slice(0, 40);
    storeSaved();
    renderSaved(anchor);
    updateCardStates();
    savedHooks.forEach(function (fn) { try { fn(saved.slice()); } catch (e) { /* ignore */ } });
  }

  function renderSaved(anchor) {
    var section = document.getElementById("savedSection");
    if (!section) return;
    if (M.keepScroll) M.keepScroll(section, renderSavedNow, anchor);
    else renderSavedNow();
  }

  function renderSavedNow() {
    var box = document.getElementById("savedRow");
    var section = document.getElementById("savedSection");
    if (!box || !section) return;
    box.textContent = "";
    var items = saved.map(M.productByImage).filter(Boolean);
    items.forEach(function (p) { box.appendChild(M.productCard(p)); });
    section.hidden = !items.length;
    M.rowify(box);
  }

  /* =====================================================================
     BASKET DRAWER
     ===================================================================== */

  var drawer = document.getElementById("basketDrawer");
  var body = document.getElementById("basketBody");
  var foot = document.getElementById("basketFoot");
  var titleCount = document.getElementById("basketTitleCount");

  function openBasket(opener) {
    if (!drawer) return;
    hideToast();
    renderBasket();
    M.openModal(drawer, opener || null, document.getElementById("basketClose"));
  }

  function itemsForMessage() {
    var list = [];
    basket.forEach(function (q, id) {
      var p = M.productByImage(id);
      if (p) list.push({ p: p, qty: q });
    });
    return list;
  }

  function basketMessage(list) {
    var d = t();
    var lines = [d.basketIntro, ""];
    list.forEach(function (it, i) {
      var name = M.waProductName(it.p, tr(it.p.name));
      lines.push((i + 1) + ". " + name);
      if (it.p.no) lines.push("   " + d.basketLineCode + ": " + it.p.no);
      lines.push("   " + d.basketLineQty + ": " + it.qty);
      // product links only for short lists, so very long baskets still open in WhatsApp
      if (list.length <= 6) lines.push("   " + d.basketLineLink + ": " + M.productLink(it.p));
      lines.push("");
    });
    return lines.join("\n").replace(/\n+$/, "");
  }

  function sendBasket(btn) {
    var list = itemsForMessage();
    if (!list.length) return;
    if (!window.MF_REQUEST) return;
    var d = t();
    window.MF_REQUEST.open({
      kind: "basket",
      message: basketMessage(list),
      item: d.basketTitle + " (" + d.items(list.length) + ")",
      items: list.map(function (it) { return { name: M.waProductName(it.p, tr(it.p.name)), no: it.p.no || "", qty: it.qty, image: it.p.image }; }),
      onSent: function (number, url) {
        clearBasket(true); // only what was sent; products not on the page right now stay
        lastSent = { number: number, url: url };
        openBasket(document.getElementById("basketBtn"));
      }
    }, btn);
  }

  function renderBasket() {
    if (!drawer) return;
    var d = t();
    var list = itemsForMessage();
    var n = totalQty();
    titleCount.textContent = n ? "(" + n + ")" : "";
    body.textContent = "";
    foot.textContent = "";

    if (!list.length && lastSent) {
      var ok = el("div", "basket-state basket-done");
      ok.innerHTML = ICON.done;
      ok.appendChild(el("h3", null, d.basketSentTitle));
      ok.appendChild(el("p", null, lastSent.number ? d.basketSentText(lastSent.number) : d.basketNote));
      if (lastSent.number) {
        var num = el("p", "basket-number", lastSent.number);
        num.dir = "ltr";
        ok.insertBefore(num, ok.querySelector("p"));
      }
      body.appendChild(ok);
      var again = el("a", "btn btn-outline basket-again", d.basketSentAgain);
      again.href = lastSent.url;
      again.target = "_blank";
      again.rel = "noopener noreferrer";
      foot.appendChild(again);
      var browse = el("button", "btn basket-browse", d.basketBrowse);
      browse.type = "button";
      browse.addEventListener("click", function () { M.closeModal(); M.setCategory("all"); });
      foot.appendChild(browse);
      return;
    }

    if (!list.length) {
      var empty = el("div", "basket-state");
      empty.innerHTML = ICON.big;
      empty.appendChild(el("h3", null, d.basketEmpty));
      empty.appendChild(el("p", null, d.basketEmptyHint));
      var go = el("button", "btn", d.basketBrowse);
      go.type = "button";
      go.addEventListener("click", function () { M.closeModal(); M.setCategory("all"); });
      empty.appendChild(go);
      body.appendChild(empty);
      return;
    }

    var ul = el("ul", "basket-list");
    list.forEach(function (it) {
      var p = it.p;
      var name = tr(p.name);
      var li = el("li", "basket-item");

      var img = document.createElement("img");
      img.src = imgSrc(p);
      img.alt = "";
      img.width = 72; img.height = 72;
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      li.appendChild(img);

      var info = el("div", "basket-info");
      info.appendChild(el("strong", null, name));
      if (p.no) {
        var no = el("span", "basket-no", d.itemNo + " " + p.no);
        no.dir = "auto";
        info.appendChild(no);
      }
      if (p.price) info.appendChild(el("span", "basket-price", String(p.price)));

      var qty = el("div", "qty");
      qty.setAttribute("role", "group");
      qty.setAttribute("aria-label", d.basketQty + " — " + name);
      var minus = el("button", "qty-btn");
      minus.type = "button";
      minus.innerHTML = ICON.minus;
      minus.setAttribute("aria-label", d.basketLess + " — " + name);
      minus.disabled = it.qty <= 1;
      minus.addEventListener("click", function () { setQty(p.image, it.qty - 1); focusAfter(p.image, ".qty-btn"); });
      var val = el("output", "qty-val", String(it.qty));
      val.setAttribute("aria-live", "polite");
      var plus = el("button", "qty-btn");
      plus.type = "button";
      plus.innerHTML = ICON.plus;
      plus.setAttribute("aria-label", d.basketMore + " — " + name);
      plus.disabled = it.qty >= MAX_QTY;
      plus.addEventListener("click", function () { setQty(p.image, it.qty + 1); focusAfter(p.image, ".qty-btn:last-of-type"); });
      qty.appendChild(minus); qty.appendChild(val); qty.appendChild(plus);
      info.appendChild(qty);
      li.appendChild(info);

      var rm = el("button", "basket-remove");
      rm.type = "button";
      rm.innerHTML = ICON.trash;
      rm.setAttribute("aria-label", d.basketRemove + " — " + name);
      rm.addEventListener("click", function () {
        setQty(p.image, 0);
        var first = body.querySelector(".basket-remove") || document.getElementById("basketClose");
        if (first) first.focus();
      });
      li.appendChild(rm);
      li.setAttribute("data-id", p.image);
      ul.appendChild(li);
    });
    body.appendChild(ul);

    var send = el("button", "btn basket-send");
    send.type = "button";
    send.innerHTML = M.WA_ICON;
    send.appendChild(el("span", null, d.basketSend));
    send.addEventListener("click", function () { sendBasket(send); });
    foot.appendChild(send);
    foot.appendChild(el("p", "basket-note", d.basketNote));
    var clear = el("button", "basket-clear", d.basketClear);
    clear.type = "button";
    clear.addEventListener("click", function () {
      clearBasket();
      var close = document.getElementById("basketClose");
      if (close) close.focus();
    });
    foot.appendChild(clear);
  }

  // keep keyboard focus on the same row after + / − re-draws the list
  function focusAfter(id, selector) {
    var li = body.querySelector('.basket-item[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    var btn = li && li.querySelector(selector);
    if (btn && !btn.disabled) btn.focus();
    else if (li) { var any = li.querySelector(".qty-btn:not([disabled])"); if (any) any.focus(); }
  }

  if (drawer) {
    document.getElementById("basketClose").addEventListener("click", function () { M.closeModal(); });
    drawer.addEventListener("modal-close", function () { lastSent = null; });
  }
  var basketBtn = document.getElementById("basketBtn");
  if (basketBtn) basketBtn.addEventListener("click", function () { openBasket(basketBtn); });
  var barBasket = document.getElementById("barBasket");
  if (barBasket) barBasket.addEventListener("click", function () { openBasket(barBasket); });

  M.openBasket = openBasket;
  // version 22: read the basket / saved list, and merge saved items from the customer's account
  M.basketItems = function () { var out = []; basket.forEach(function (q, id) { out.push({ id: id, qty: q }); }); return out; };
  M.savedItems = function () { return saved.slice(); };
  var savedHooks = [];
  M.onSavedChange = function (fn) { savedHooks.push(fn); };
  M.mergeSaved = function (ids) {
    var changed = false;
    (ids || []).forEach(function (id) {
      if (typeof id === "string" && M.productByImage(id) && saved.indexOf(id) === -1) { saved.push(id); changed = true; }
    });
    if (!changed) return;
    saved = saved.slice(0, 40);
    storeSaved();
    renderSaved();
    updateCardStates();
  };
  M.lightboxOrigin = function () { return originOpener; };
  M.addToBasket = addToBasket;

  /* =====================================================================
     BIG PHOTO WINDOW: basket button, "You may also like", tap to close,
     two-finger zoom, and a small grow / shrink animation from the product.
     ===================================================================== */

  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbMedia = document.getElementById("lbMedia");
  var lbBasket = document.getElementById("lbBasket");
  var lbBasketText = document.getElementById("lbBasketText");
  var related = document.getElementById("lbRelated");
  var relatedRow = document.getElementById("lbRelatedRow");
  var current = null;      // product shown in the photo window
  var originOpener = null; // the card that first opened the window (to go back to it)

  function updateLightboxBasket() {
    if (!lbBasket || !current) return;
    var d = t();
    var inB = basket.has(current.image);
    lbBasket.setAttribute("aria-pressed", inB ? "true" : "false");
    lbBasketText.textContent = inB ? d.inBasket : d.addToBasket;
    var svg = lbBasket.querySelector("svg");
    if (svg) svg.outerHTML = inB ? ICON.check : ICON.basket;
  }
  if (lbBasket) lbBasket.addEventListener("click", function () {
    if (!current) return;
    if (basket.has(current.image)) openBasket(originOpener);
    else addToBasket(current.image, 1);
  });

  function relatedFor(p) {
    var all = M.PRODUCTS;
    var idx = all.indexOf(p);
    var ordered = all.slice(idx + 1).concat(all.slice(0, Math.max(idx, 0)));
    var picks = [];
    function take(test) {
      ordered.forEach(function (q) {
        if (picks.length >= 4 || q === p || picks.indexOf(q) !== -1) return;
        if (test(q)) picks.push(q);
      });
    }
    if (p.series) take(function (q) { return q.series === p.series; });
    take(function (q) { return q.cat === p.cat; });
    take(function (q) { return q.badge === "popular"; });
    take(function () { return true; });
    return picks;
  }

  function renderRelated(p) {
    if (!related || !relatedRow) return;
    relatedRow.textContent = "";
    var picks = relatedFor(p);
    picks.forEach(function (q) {
      var b = el("button", "rel-item");
      b.type = "button";
      var img = document.createElement("img");
      img.src = imgSrc(q);
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      b.appendChild(img);
      b.appendChild(el("span", null, tr(q.name)));
      b.addEventListener("click", function () { M.openLightbox(q, originOpener); });
      relatedRow.appendChild(b);
    });
    related.hidden = !picks.length;
  }

  // ----- zoom state -----
  var zoom = { s: 1, x: 0, y: 0 };
  var gesture = null;
  var suppressClickUntil = 0;

  function applyZoom() {
    lbImg.style.transform = zoom.s > 1 ? "translate(" + zoom.x + "px," + zoom.y + "px) scale(" + zoom.s + ")" : "";
    if (lbMedia) lbMedia.classList.toggle("is-zoomed", zoom.s > 1);
  }
  function resetZoom() { zoom = { s: 1, x: 0, y: 0 }; gesture = null; applyZoom(); }
  function clampPan() {
    var w = lbImg.clientWidth, h = lbImg.clientHeight;
    var mx = (w * zoom.s - w) / 2, my = (h * zoom.s - h) / 2;
    zoom.x = Math.max(-mx, Math.min(mx, zoom.x));
    zoom.y = Math.max(-my, Math.min(my, zoom.y));
  }
  function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function mid(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

  if (lbImg) {
    lbImg.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        var m = mid(e.touches[0], e.touches[1]);
        gesture = { type: "pinch", d: dist(e.touches[0], e.touches[1]), s: zoom.s, x: zoom.x, y: zoom.y, mx: m.x, my: m.y };
      } else if (e.touches.length === 1 && zoom.s > 1) {
        gesture = { type: "pan", sx: e.touches[0].clientX, sy: e.touches[0].clientY, x: zoom.x, y: zoom.y, moved: false };
      }
    }, { passive: true });

    lbImg.addEventListener("touchmove", function (e) {
      if (!gesture) return;
      if (gesture.type === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        var m = mid(e.touches[0], e.touches[1]);
        zoom.s = Math.max(1, Math.min(4, gesture.s * dist(e.touches[0], e.touches[1]) / gesture.d));
        zoom.x = gesture.x + (m.x - gesture.mx);
        zoom.y = gesture.y + (m.y - gesture.my);
        clampPan();
        applyZoom();
        suppressClickUntil = Date.now() + 500;
      } else if (gesture.type === "pan" && e.touches.length === 1) {
        e.preventDefault();
        var dx = e.touches[0].clientX - gesture.sx, dy = e.touches[0].clientY - gesture.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
        zoom.x = gesture.x + dx;
        zoom.y = gesture.y + dy;
        clampPan();
        applyZoom();
        if (gesture.moved) suppressClickUntil = Date.now() + 500;
      }
    }, { passive: false });

    lbImg.addEventListener("touchend", function (e) {
      if (!gesture) return;
      if (e.touches.length === 0) {
        if (zoom.s < 1.05) resetZoom();
        gesture = null;
      } else if (e.touches.length === 1 && gesture.type === "pinch") {
        gesture = zoom.s > 1 ? { type: "pan", sx: e.touches[0].clientX, sy: e.touches[0].clientY, x: zoom.x, y: zoom.y, moved: true } : null;
      }
    });

    // computer: trackpad pinch zooms; tap / click closes
    lbImg.addEventListener("wheel", function (e) {
      if (!e.ctrlKey) return; // normal mouse wheel keeps scrolling; trackpad pinch (ctrl + wheel) zooms
      e.preventDefault();
      zoom.s = Math.max(1, Math.min(4, zoom.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      if (zoom.s === 1) { zoom.x = 0; zoom.y = 0; }
      clampPan();
      applyZoom();
    }, { passive: false });

    lbImg.addEventListener("click", function () {
      if (Date.now() < suppressClickUntil) return;
      closeWithShrink();
    });
  }

  // ----- grow / shrink animation (photo goes back to its place) -----
  function openerRect() {
    var target = originOpener && document.contains(originOpener) ? originOpener : null;
    if (!target && current) {
      var esc = window.CSS && CSS.escape ? CSS.escape(current.image) : current.image;
      target = document.querySelector('.product-card[data-product="' + esc + '"] .product-media');
    }
    if (!target) return null;
    var r = target.getBoundingClientRect();
    if (r.width < 10 || r.bottom < 0 || r.top > window.innerHeight) return null;
    return r;
  }

  function panelOrigin(panel, r) {
    var pr = panel.getBoundingClientRect();
    return (r.left + r.width / 2 - pr.left) + "px " + (r.top + r.height / 2 - pr.top) + "px";
  }

  function growIn() {
    if (reducedMotion() || !lb || !lb.animate) return;
    var panel = lb.querySelector(".lightbox-panel");
    var r = openerRect();
    if (!panel || !r) return;
    panel.style.transformOrigin = panelOrigin(panel, r);
    panel.animate([{ transform: "scale(.35)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    lb.animate([{ backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "rgba(0,0,0,.8)" }], { duration: 240 });
  }

  var closing = false;
  function closeWithShrink() {
    if (closing || !lb || lb.hidden) return;
    var panel = lb.querySelector(".lightbox-panel");
    var r = openerRect();
    if (reducedMotion() || !lb.animate || !panel || !r) { M.closeModal(); return; }
    closing = true;
    panel.style.transformOrigin = panelOrigin(panel, r);
    var anim = panel.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.3)", opacity: 0 }],
      { duration: 220, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    lb.animate([{ backgroundColor: "rgba(0,0,0,.8)" }, { backgroundColor: "rgba(0,0,0,0)" }], { duration: 220, fill: "forwards" });
    var finish = function () {
      if (!closing) return;
      closing = false;
      if (!lb.hidden) M.closeModal(); // only if the photo window is still the one open
      cancelAnims(panel);
    };
    anim.onfinish = finish;
    setTimeout(finish, 400); // safety net
  }

  M.onLightbox(function (p, opener) {
    var fromInside = opener && lb && lb.contains(opener);
    if (!fromInside) originOpener = opener || null;
    current = p;
    resetZoom();
    updateLightboxBasket();
    renderRelated(p);
    var panel = lb && lb.querySelector(".lightbox-panel");
    if (panel) panel.scrollTop = 0;
    if (!fromInside) growIn();
  });

  function cancelAnims(panel) {
    if (panel && panel.getAnimations) panel.getAnimations().forEach(function (a) { a.cancel(); });
    if (lb && lb.getAnimations) lb.getAnimations().forEach(function (a) { a.cancel(); });
  }

  if (lb) lb.addEventListener("modal-close", function () {
    if (closing) { closing = false; cancelAnims(lb.querySelector(".lightbox-panel")); }
    resetZoom();
    current = null;
  });

  /* =====================================================================
     START
     ===================================================================== */

  function onLanguage() {
    renderSaved();
    refreshBasketUi(false);
  }
  M.onRender(onLanguage);
  onLanguage();
})();
