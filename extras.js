/* Marshal Fitness — extras: offer banner, brands strip, product links (?p=...). */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;

  /* ---------- offer banner ---------- */
  var bar = document.getElementById("offerBar");
  var OFFER_KEY = "mf-offer-closed";

  function offerActive(o) {
    if (!o || !o.on) return false;
    if (o.until) {
      var end = new Date(o.until + "T23:59:59");
      if (!isNaN(end) && end < new Date()) return false;
    }
    return true;
  }

  // the same offer in any language has the same id, so closing it once is enough
  function offerId(o) {
    if (!o) return "";
    var txt = o.text || {};
    return (o.until || "") + "|" + (txt.en || txt.ar || txt.ckb || "");
  }

  function offerText(o) {
    var txt = o.text || {};
    return (txt[M.lang()] || txt.en || "").trim();
  }

  /* countdown on the offer bar: "Ends in 2 days 05:30:12" (only when the offer has a last day) */
  var timer = null;
  var tick = null;

  function offerEnd(o) {
    if (!o || !o.until) return null;
    var end = new Date(o.until + "T23:59:59");
    return isNaN(end) ? null : end;
  }

  function two(n) { return (n < 10 ? "0" : "") + n; }

  function updateTimer() {
    var o = window.OFFER;
    var end = offerEnd(o);
    if (!timer || !end) return;
    var left = Math.floor((end - new Date()) / 1000);
    if (left <= 0) { stopTick(); bar.hidden = true; return; }
    var d = M.t();
    var days = Math.floor(left / 86400);
    var h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    timer.querySelector(".ot-label").textContent = d.offerEnds;
    var dayEl = timer.querySelector(".ot-days");
    dayEl.textContent = days > 0 ? d.offerDays(days) : "";
    dayEl.hidden = days <= 0;
    timer.querySelector(".ot-clock").textContent = two(h) + ":" + two(m) + ":" + two(s);
  }

  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function renderOffer() {
    if (!bar) return;
    var o = window.OFFER;
    var text = offerActive(o) ? offerText(o) : "";
    var closed = false;
    try { closed = window.sessionStorage.getItem(OFFER_KEY) === offerId(o); } catch (e) { /* ignore */ }
    if (!text || closed) { bar.hidden = true; stopTick(); return; }
    document.getElementById("offerText").textContent = text;
    if (offerEnd(o)) {
      if (!timer) {
        timer = document.createElement("p");
        timer.className = "offer-timer";
        timer.setAttribute("aria-live", "off");
        timer.innerHTML = '<span class="ot-label"></span> <span class="ot-days"></span> <span class="ot-clock" dir="ltr"></span>';
        bar.insertBefore(timer, document.getElementById("offerClose"));
      }
      timer.hidden = false;
      updateTimer();
      if (!tick) tick = setInterval(updateTimer, 1000);
    } else {
      if (timer) timer.hidden = true;
      stopTick();
    }
    bar.hidden = false;
  }
  if (bar) {
    document.getElementById("offerClose").addEventListener("click", function () {
      try { window.sessionStorage.setItem(OFFER_KEY, offerId(window.OFFER)); } catch (e) { /* ignore */ }
      bar.hidden = true;
      stopTick();
    });
  }

  /* ---------- brands strip ---------- */
  var strip = document.getElementById("brandsStrip");
  var row = document.getElementById("brandsRow");

  function renderBrands() {
    if (!strip || !row) return;
    var list = (window.BRANDS || []).filter(function (b) { return b && (b.name || b.logo); });
    row.textContent = "";
    list.forEach(function (b) {
      var item = document.createElement("div");
      item.className = "brand-chip";
      if (b.logo) {
        var img = document.createElement("img");
        img.src = b.logo;
        img.alt = b.name || "";
        img.loading = "lazy";
        item.appendChild(img);
      } else {
        item.textContent = b.name;
      }
      row.appendChild(item);
    });
    strip.hidden = !list.length;
  }

  renderOffer();
  renderBrands();
  M.onRender(renderOffer);

  /* ---------- open one product from a shared link: ?p=product-key ---------- */
  try {
    var key = new URLSearchParams(window.location.search).get("p");
    if (key && M.openLightbox && M.productKey) {
      var product = M.PRODUCTS.filter(function (p) { return M.productKey(p) === key; })[0];
      if (product) {
        var card = document.querySelector('.product-card[data-product="' + (window.CSS && CSS.escape ? CSS.escape(product.image) : product.image) + '"]');
        if (card) card.scrollIntoView({ block: "center" });
        setTimeout(function () { M.openLightbox(product, card ? card.querySelector(".product-media") : null); }, 250);
      }
    }
  } catch (e) { /* bad link: just show the site */ }
})();
