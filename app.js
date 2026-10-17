/* Marshal Fitness — phone app bar (Home · Categories · Basket · WhatsApp),
   categories sheet, "Install app", help bubble and "Send location on WhatsApp". */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;
  var root = document.documentElement;

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  /* ---------- links that depend on the shop number / map (built from content.js or admin) ---------- */
  function renderLinks() {
    var d = t();
    var loc = document.getElementById("shareLocBtn");
    if (loc) loc.href = M.waShareUrl(d.shareLocMsg(M.S.mapsLink));
    var barWa = document.getElementById("barWa");
    if (barWa) barWa.href = M.waUrl(d.askGeneral);
    var helpChat = document.getElementById("helpChat");
    if (helpChat) helpChat.href = M.waUrl(d.askGeneral);
  }
  M.onRender(renderLinks);
  renderLinks();

  /* ---------- categories sheet (app bar) ---------- */
  var sheet = document.getElementById("catSheet");
  var sheetList = document.getElementById("catSheetList");

  function renderSheet() {
    if (!sheetList) return;
    var d = t();
    sheetList.textContent = "";
    var activeCat = M.activeCategory();
    var cats = [{ id: "all", label: d.all, count: M.PRODUCTS.length }];
    M.CATS.forEach(function (c) {
      var n = M.PRODUCTS.filter(function (p) { return p.cat === c.id; }).length;
      if (n) cats.push({ id: c.id, label: tr(c.name), count: n });
    });
    cats.forEach(function (c) {
      var b = M.el("button", "sheet-item");
      b.type = "button";
      b.setAttribute("aria-pressed", c.id === activeCat ? "true" : "false");
      b.appendChild(M.el("span", null, c.label));
      b.appendChild(M.el("b", null, String(c.count)));
      b.addEventListener("click", function () {
        M.closeModal();
        M.setCategory(c.id);
      });
      sheetList.appendChild(b);
    });
  }

  var barCats = document.getElementById("barCats");
  if (barCats && sheet) {
    barCats.addEventListener("click", function () {
      renderSheet();
      M.openModal(sheet, barCats);
    });
    document.getElementById("catSheetClose").addEventListener("click", function () { M.closeModal(); });
    M.onRender(function () { if (!sheet.hidden) renderSheet(); });
  }

  // hide the app bar while typing on a phone (the keyboard would push it over the form)
  document.addEventListener("focusin", function (e) {
    var n = e.target;
    if (n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT") &&
        n.type !== "checkbox" && n.type !== "radio" && n.type !== "button") {
      root.classList.add("typing");
    }
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      var n = document.activeElement;
      if (!n || !(n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT")) root.classList.remove("typing");
    }, 50);
  });

  /* ---------- install as an app ---------- */
  var triggers = Array.prototype.slice.call(document.querySelectorAll(".install-trigger"));
  var deferred = window.__mfInstall || null; // saved early by a small script in index.html
  var ua = navigator.userAgent || "";
  var isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Instagram / TikTok / Facebook / Snapchat open links in their own small browser,
  // where "Add to Home Screen" is not possible — do not offer it there
  var inAppBrowser = /FBAN|FBAV|Instagram|TikTok|musical_ly|Bytedance|Snapchat|Line\//i.test(ua);
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function showTriggers(on) {
    triggers.forEach(function (b) { b.hidden = !on; });
  }
  function refreshInstall() {
    showTriggers(!isStandalone() && (!!deferred || (isIos && !inAppBrowser)));
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    window.__mfInstall = e;
    refreshInstall();
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    window.__mfInstall = null;
    showTriggers(false);
  });

  var installModal = document.getElementById("installModal");
  function openInstallHelp(opener) {
    if (!installModal) return;
    document.getElementById("installText").textContent = isIos ? t().installIosText : t().installOtherText;
    M.openModal(installModal, opener);
  }
  if (installModal) document.getElementById("installClose").addEventListener("click", function () { M.closeModal(); });

  triggers.forEach(function (b) {
    b.addEventListener("click", function () {
      if (deferred) {
        var ev = deferred;
        deferred = null;
        window.__mfInstall = null;
        try {
          ev.prompt();
          if (ev.userChoice) ev.userChoice.then(function (r) {
            if (r && r.outcome === "accepted") showTriggers(false);
            else refreshInstall();
          }).catch(refreshInstall);
        } catch (err) { openInstallHelp(b); }
        refreshInstall();
      } else {
        openInstallHelp(b);
      }
    });
  });
  refreshInstall();

  /* ---------- help bubble after 20 seconds ---------- */
  var bubble = document.getElementById("helpBubble");
  var BUBBLE_KEY = "mf-help-shown";
  var hideTimer = null;

  function seen() {
    try { return window.sessionStorage.getItem(BUBBLE_KEY) === "1"; } catch (e) { return false; }
  }
  function markSeen() {
    try { window.sessionStorage.setItem(BUBBLE_KEY, "1"); } catch (e) { /* ignore */ }
  }
  function hideBubble() {
    if (!bubble) return;
    bubble.classList.remove("show");
    bubble.hidden = true;
    clearTimeout(hideTimer);
  }
  function showBubble() {
    if (!bubble || seen()) return;
    markSeen();
    bubble.hidden = false;
    void bubble.offsetWidth;
    bubble.classList.add("show");
    hideTimer = setTimeout(hideBubble, 30000);
  }
  function tryBubble(tries) {
    if (!bubble || seen()) return;
    var busy = root.classList.contains("lb-open") || root.classList.contains("typing") || root.classList.contains("stage-open");
    if (!busy) { showBubble(); return; }
    if (tries < 24) setTimeout(function () { tryBubble(tries + 1); }, 5000);
  }
  if (bubble) {
    document.getElementById("helpClose").addEventListener("click", hideBubble);
    document.getElementById("helpChat").addEventListener("click", hideBubble);
    document.getElementById("helpFind").addEventListener("click", function () {
      hideBubble();
      if (M.openHelper) M.openHelper(document.getElementById("helperOpen"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !bubble.hidden && !root.classList.contains("lb-open")) hideBubble();
    });
    if (!seen()) setTimeout(function () { tryBubble(0); }, 20000);
  }
  M.hideHelpBubble = hideBubble;
})();
