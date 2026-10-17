/* Marshal Fitness — version 20 core.
   - "Stages": full-screen views (showroom tour, room camera, product show) that
     sit above the page. Pop-up windows (photo, price form, basket) can still open
     on top of them. The phone's back button closes the top stage.
   - Product photos without background ("cut-outs") for the camera, 3D and show.
   - Views number on each product (counted once per visit, shown after 10).
   - New buttons in the big photo window.
   Loaded after script.js (window.MF). Texts are in content.js. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;
  var root = document.documentElement;

  function t() { return M.t(); }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  M.reducedMotion = reducedMotion;

  /* =====================================================================
     STAGES (full-screen views)
     ===================================================================== */
  var stack = []; // [{ node, opener }]
  // a reload keeps the old history entry: forget it, so "back" never leaves the site by mistake
  try { if (history.state && history.state.mfStage) history.replaceState(null, ""); } catch (e) { /* ignore */ }
  var modalWasOpen = false;

  function topStage() { return stack.length ? stack[stack.length - 1].node : null; }
  // things the keyboard can reach: not hidden, not behind a cover (inert)
  function stageFocusables(node) {
    return M.focusables(node).filter(function (n) {
      if (n.closest("[inert]") || n.closest("[hidden]")) return false;
      var cs = window.getComputedStyle(n);
      return cs.visibility !== "hidden" && cs.display !== "none";
    });
  }
  M.stageFocusables = stageFocusables;
  function stageIndex(node) {
    for (var i = 0; i < stack.length; i++) if (stack[i].node === node) return i;
    return -1;
  }

  function openStage(node, opener, focusEl) {
    if (!node) return;
    if (root.classList.contains("lb-open")) M.closeModal(true);
    var i = stageIndex(node);
    if (i !== -1) stack.splice(i, 1);
    stack.push({ node: node, opener: opener || document.activeElement });
    stack.forEach(function (s, k) { s.node.classList.toggle("stage-under", k < stack.length - 1); });
    node.hidden = false;
    root.classList.add("stage-open");
    try {
      if (!(history.state && history.state.mfStage === node.id)) history.pushState({ mfStage: node.id }, "");
    } catch (e) { /* ignore */ }
    var f = focusEl || stageFocusables(node)[0];
    if (f) f.focus({ preventScroll: true });
    node.dispatchEvent(new Event("stage-open"));
  }

  // fromHistory: the browser already went back (do not go back again)
  function closeStage(node, fromHistory) {
    var i = stageIndex(node);
    if (i === -1) return;
    if (!fromHistory) {
      if (stack[i].closing) return; // already closing (double tap): never go back twice
      try {
        if (history.state && history.state.mfStage === node.id) {
          stack[i].closing = true;
          history.back(); // popstate finishes it
          setTimeout(function () { // safety net if the browser does not answer
            var k = stageIndex(node);
            if (k !== -1 && stack[k].closing) closeStage(node, true);
          }, 600);
          return;
        }
      } catch (e) { /* ignore */ }
    }
    var item = stack.splice(i, 1)[0];
    node.hidden = true;
    node.classList.remove("stage-under");
    if (stack.length) topStage().classList.remove("stage-under");
    else root.classList.remove("stage-open");
    node.dispatchEvent(new Event("stage-close"));
    var back = stack.length ? (item.opener && topStage().contains(item.opener) ? item.opener : null) : item.opener;
    if (back && back.focus && document.contains(back) && back.offsetParent !== null) back.focus({ preventScroll: true });
    else if (stack.length) { var f = stageFocusables(topStage())[0]; if (f) f.focus({ preventScroll: true }); }
  }

  window.addEventListener("popstate", function () {
    var top = topStage();
    if (!top) return;
    if (history.state && history.state.mfStage === top.id) return; // still on this stage
    var keep = function () { try { history.pushState({ mfStage: top.id }, ""); } catch (e) { /* ignore */ } };
    if (root.classList.contains("lb-open")) {
      // a pop-up is open over the stage: the back button closes the pop-up first
      M.closeModal();
      keep();
      return;
    }
    var closing = stack[stack.length - 1].closing;
    if (!closing) {
      // a small panel inside the stage (product list, taken photo…) closes first
      var ev = new CustomEvent("stage-escape", { cancelable: true, detail: "back" });
      if (!top.dispatchEvent(ev)) { keep(); return; }
    }
    closeStage(top, true);
  });

  // remember if a pop-up was open BEFORE script.js handles Escape (it closes the pop-up first)
  window.addEventListener("keydown", function (e) {
    modalWasOpen = root.classList.contains("lb-open");
  }, true);

  document.addEventListener("keydown", function (e) {
    var top = topStage();
    if (!top || modalWasOpen || root.classList.contains("lb-open")) return;
    if (e.key === "Escape") {
      var ev = new CustomEvent("stage-escape", { cancelable: true });
      if (top.dispatchEvent(ev)) closeStage(top);
      e.preventDefault();
    } else if (e.key === "Tab") {
      var items = stageFocusables(top);
      if (!items.length) return;
      var i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus(); }
    }
  });

  M.openStage = openStage;
  M.closeStage = closeStage;
  M.topStage = topStage;
  M.stageOpen = function (node) { return stageIndex(node) !== -1; };

  /* =====================================================================
     SMALL HELPERS
     ===================================================================== */
  var SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICONS = {
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    flip: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5V7z"/><path d="M16 7l5 5-5 5V7z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    snow: '<path d="M12 2v20"/><path d="m4.9 4.9 14.2 14.2"/><path d="M2 12h20"/><path d="m4.9 19.1 14.2-14.2"/>',
    video: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>',
    wa: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    map: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    basket: '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    sparkle: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4"/><path d="m6 12 3-3 4 1 3 3h3"/>'
  };
  function icon(name, size) {
    var s = size || 20;
    return "<svg " + SVG + ' width="' + s + '" height="' + s + '">' + (ICONS[name] || "") + "</svg>";
  }
  M.icon = icon;

  // a button with an icon and a (visible or hidden) label
  M.iconButton = function (cls, name, label, showLabel) {
    var b = M.el("button", cls);
    b.type = "button";
    b.innerHTML = icon(name);
    var span = M.el("span", showLabel ? "ib-label" : "sr-only", label);
    b.appendChild(span);
    if (!showLabel) b.setAttribute("aria-label", label);
    return b;
  };
  M.setIconButtonLabel = function (b, label, name) {
    if (name) { var svg = b.querySelector("svg"); if (svg) svg.outerHTML = icon(name); }
    var span = b.querySelector(".ib-label, .sr-only");
    if (span) span.textContent = label;
    if (span && span.classList.contains("sr-only")) b.setAttribute("aria-label", label);
  };

  M.imgSrc = function (p) { return p.imageData || (M.S.imageBase + (p.thumbnail || p.image)); };
  M.bigSrc = function (p) { return p.imageData || (M.S.imageBase + p.image); };

  /* =====================================================================
     CUT-OUTS (product photo without background)
     ===================================================================== */
  var CUT = window.CUTOUTS || {};
  M.cutout = function (p) {
    if (!p || p.cutOff) return null;
    if (p.cut) return { src: p.cut, w: 0, h: 0 };
    if (p.imageData) return null; // new admin photo without a camera photo
    var c = CUT[p.image];
    if (!c) return null;
    return { src: M.S.imageBase + "cut/" + c[0], w: c[1], h: c[2] };
  };

  /* =====================================================================
     STAR PRODUCTS (show page). Admin "Show page" box: yes = star, no = not a
     star. Products never set in admin: the "Popular" ones are stars.
     ===================================================================== */
  M.starProducts = function () {
    return M.PRODUCTS.filter(function (p) { return p.show === true || (p.show === undefined && p.badge === "popular"); });
  };

  /* =====================================================================
     VIEWS NUMBER
     ===================================================================== */
  var MIN_VIEWS = 10;
  var viewCache = {};
  var lbViews = document.getElementById("lbViews");
  var lbViewsText = document.getElementById("lbViewsText");
  var currentKey = null;

  function db() { return window.MF_DB && window.firebase ? window.MF_DB : null; }

  function showViews(key, n) {
    if (!lbViews || key !== currentKey) return;
    if (typeof n === "number" && n >= MIN_VIEWS) {
      lbViewsText.textContent = t().views(n);
      lbViews.hidden = false;
    } else {
      lbViews.hidden = true;
    }
  }

  function onProductOpened(p) {
    var key = M.productKey(p);
    currentKey = key;
    if (lbViews) lbViews.hidden = true;
    var d = db();
    if (!d || !key) return;
    var seenKey = "mf-viewed-" + key;
    var counted = false;
    try { counted = !!window.sessionStorage.getItem(seenKey); } catch (e) { counted = true; }
    var ref = d.collection("views").doc(key);
    if (typeof viewCache[key] === "number") showViews(key, viewCache[key]);
    // read the number AFTER this visit was counted, so it is never one too many or too few
    function read() {
      ref.get().then(function (snap) {
        var n = snap.exists ? Number((snap.data() || {}).n) || 0 : 0;
        viewCache[key] = Math.max(n, viewCache[key] || 0);
        showViews(key, viewCache[key]);
      }).catch(function () { /* no number shown */ });
    }
    if (counted) { read(); return; }
    try { window.sessionStorage.setItem(seenKey, "1"); } catch (e) { /* ignore */ }
    try {
      ref.set({ n: firebase.firestore.FieldValue.increment(1) }, { merge: true }).then(read, function () {
        try { window.sessionStorage.removeItem(seenKey); } catch (e2) { /* ignore */ }
        read();
      });
    } catch (e) { read(); /* counting must never break the site */ }
  }

  /* =====================================================================
     PHOTO WINDOW: camera + show buttons
     ===================================================================== */
  var lb = document.getElementById("lightbox");
  var lbExtra = document.getElementById("lbExtra");
  var lbCam = document.getElementById("lbCam");
  var lbShow = document.getElementById("lbShow");
  var lbProduct = null;

  M.onLightbox(function (p) {
    lbProduct = p;
    onProductOpened(p);
    var canCam = !!(M.cutout(p) && M.openCamera);
    var canShow = !!(M.openShow && M.starProducts().indexOf(p) !== -1);
    if (lbCam) lbCam.hidden = !canCam;
    if (lbShow) lbShow.hidden = !canShow;
    if (lbExtra) lbExtra.hidden = !canCam && !canShow;
  });
  if (lb) lb.addEventListener("modal-close", function () { currentKey = null; });
  if (lbCam) lbCam.addEventListener("click", function () {
    if (lbProduct && M.openCamera) M.openCamera(lbProduct, M.lightboxOrigin ? M.lightboxOrigin() : null);
  });
  if (lbShow) lbShow.addEventListener("click", function () {
    if (lbProduct && M.openShow) M.openShow(lbProduct, M.lightboxOrigin ? M.lightboxOrigin() : null);
  });
  M.onRender(function () {
    if (currentKey && typeof viewCache[currentKey] === "number") showViews(currentKey, viewCache[currentKey]);
  });

  /* =====================================================================
     LINKS: ?tour=1 opens the tour, ?show=<product> opens a show page
     ===================================================================== */
  document.addEventListener("mf-ready", function () { M.afterV20(); });
  M.afterV20 = function () {
    try {
      var q = new URLSearchParams(window.location.search);
      var wantTour = q.get("tour"), sk = q.get("show");
      if (wantTour || sk) {
        // so a reload or a shared address does not open it again by itself
        var u = new URL(window.location.href);
        u.searchParams.delete("tour");
        u.searchParams.delete("show");
        history.replaceState(null, "", u.toString());
      }
      if (wantTour && M.openTour) M.openTour(null);
      if (sk && M.openShow) {
        var p = M.PRODUCTS.filter(function (x) { return M.productKey(x) === sk; })[0];
        if (p) M.openShow(p, null);
      }
    } catch (e) { /* ignore */ }
  };
})();
