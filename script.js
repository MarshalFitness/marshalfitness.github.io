/* Marshal Fitness catalog — logic.
   All texts, products and contact details are in content.js. */
(function () {
  "use strict";

  var S = window.SITE;
  var I18N = window.I18N;
  var CATS = window.CATEGORIES;
  var PRODUCTS = window.PRODUCTS;
  var LANG_KEY = "marshal-lang";
  var THEME_KEY = "marshal-theme";
  var THEMES = { dark: "#0b0b0c", light: "#ffffff", gold: "#0a0a0a",
    cyber: "#120a2a", lime: "#0a0f0a", ice: "#eef5fb", army: "#1f2318", royal: "#0b1a3a", coffee: "#2b1d16" };
  var root = document.documentElement;

  var WA_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  function productKey(p) {
    return String(p.image || "").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
  }

  // the built-in hero photo has small and big versions (same choice as in index.html)
  function heroSrc(src) {
    if (src !== "assets/hero-rooftop.jpg") return src;
    var w = Math.min(window.screen ? window.screen.width : 9999, window.innerWidth || 9999) * (window.devicePixelRatio || 1);
    return w > 1000 ? "assets/hero-rooftop-1600.webp" : "assets/hero-rooftop-800.webp";
  }

  var lang = pickLanguage();
  var activeCat = "all";
  var activeGymSeries = "all";
  var query = "";

  /* ---------- helpers ---------- */

  function pickLanguage() {
    try {
      var q = new URLSearchParams(window.location.search).get("lang");
      if (q && I18N[q]) return q;
    } catch (e) { /* ignore */ }
    try {
      var saved = window.localStorage.getItem(LANG_KEY);
      if (saved && I18N[saved]) return saved;
    } catch (e) { /* storage can be blocked */ }
    var nav = (navigator.language || "en").toLowerCase();
    if (nav.indexOf("ar") === 0) return "ar";
    if (nav.indexOf("ckb") === 0 || nav.indexOf("ku") === 0) return "ckb";
    return "en";
  }

  function t() { return I18N[lang]; }

  function tr(value) {
    if (typeof value === "string") return value;
    return value[lang] || value.en;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function waUrl(message) {
    return "https://wa.me/" + S.phone + "?text=" + encodeURIComponent(message);
  }

  // for sharing with a friend (no fixed number, opens the phone's own contact picker)
  function waShareUrl(message) {
    return "https://wa.me/?text=" + encodeURIComponent(message);
  }

  // makes Arabic / Kurdish / English search forgiving (case, accents, similar letters)
  function normalize(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
      .replace(/[\u0623\u0625\u0622]/g, "\u0627")
      .replace(/\u064a/g, "\u06cc")
      .replace(/\u0643/g, "\u06a9")
      .replace(/\s+/g, " ")
      .trim();
  }

  function searchText(p) {
    var parts = [];
    if (typeof p.name === "string") parts.push(p.name);
    else Object.keys(p.name).forEach(function (k) { parts.push(p.name[k]); });
    if (p.no) parts.push(p.no);
    // the category name in every language, so "treadmill" / "جهاز مشي" finds the treadmills
    var cat = CATS.filter(function (c) { return c.id === p.cat; })[0];
    if (cat && cat.name) Object.keys(cat.name).forEach(function (k) { parts.push(cat.name[k]); });
    if (p.series) {
      var series = (window.GYM_SERIES || []).find(function (s) { return s.id === p.series; });
      if (series) parts.push(series.name, series.group || "", window.GYM_COPY.en.title, window.GYM_COPY.ar.title, window.GYM_COPY.ckb.title);
    }
    return normalize(parts.join(" "));
  }

  /* ---------- static texts ---------- */

  function applyStaticTexts() {
    var dict = t();

    root.lang = dict.htmlLang;
    root.dir = dict.dir;
    document.title = dict.title;

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", dict.description);

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (typeof dict[key] === "string") node.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-html");
      if (typeof dict[key] === "string") node.innerHTML = dict[key]; // trusted text from content.js
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-aria");
      if (typeof dict[key] === "string") node.setAttribute("aria-label", dict[key]);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
      var key = node.getAttribute("data-i18n-placeholder");
      if (typeof dict[key] === "string") node.setAttribute("placeholder", dict[key]);
    });

    var byId = function (id) { return document.getElementById(id); };

    if (window.PAGE_TITLE && window.PAGE_TITLE[lang]) document.title = window.PAGE_TITLE[lang];

    var heroCount = byId("heroCount");
    if (heroCount) heroCount.textContent = dict.heroCount(PRODUCTS.length);

    // language buttons
    document.querySelectorAll(".lang button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-lang") === lang ? "true" : "false");
    });

    // contact links (built from content.js so there is one place to edit)
    var mapsBtn = byId("mapsBtn");
    if (mapsBtn) mapsBtn.href = S.mapsLink;
    var directionsBtn = byId("directionsBtn");
    if (directionsBtn) directionsBtn.href = "https://www.google.com/maps/dir/?api=1&destination=" + S.lat + "," + S.lng;
    var callBtn = byId("callBtn");
    if (callBtn) callBtn.href = "tel:+" + S.phone;
    var callIcon = byId("callIcon");
    if (callIcon) callIcon.href = "tel:+" + S.phone;
    var phoneLink = byId("phoneLink");
    if (phoneLink) { phoneLink.href = "https://wa.me/" + S.phone; phoneLink.textContent = S.phoneDisplay; }
    var waFloat = byId("waFloat");
    if (waFloat) waFloat.href = waUrl(dict.askGeneral);

    // opening hours (hidden until filled in)
    var hours = S.hours && (S.hours[lang] || S.hours.en);
    var row = byId("hoursRow");
    if (row) {
      row.hidden = !hours;
      var hoursText = byId("hoursText");
      if (hoursText) hoursText.textContent = hours || "";
    }

    // logo: shown next to the brand name; hidden if the file is missing
    var logoEl = byId("brandLogo");
    if (logoEl && S.logo && !logoEl.getAttribute("src")) {
      logoEl.addEventListener("error", function () { logoEl.hidden = true; });
      logoEl.src = S.logo;
      logoEl.hidden = false;
    }

    // trust bar: years in business, Google rating, warranty, brand — real numbers from content.js
    var yearsItem = byId("trustYearsItem");
    if (yearsItem) {
      if (S.foundedYear) {
        var years = new Date().getFullYear() - S.foundedYear;
        byId("trustYears").textContent = dict.trustYears(years);
        yearsItem.hidden = false;
      } else {
        yearsItem.hidden = true;
      }
    }

    var ratingItem = byId("trustRatingItem");
    if (ratingItem) {
      if (S.googleRating) {
        byId("trustRating").textContent = dict.trustRating(S.googleRating);
        byId("trustReviews").textContent = S.googleReviews ? dict.trustReviewsLabel(S.googleReviews) : "";
        ratingItem.href = S.mapsLink;
        ratingItem.hidden = false;
      } else {
        ratingItem.hidden = true;
      }
    }

    // hero background photo (optional) — a dark shade + white text are added via CSS
    var heroSection = byId("hero");
    var heroBg = byId("heroBg");
    if (heroSection && heroBg) {
      // remember the photo, so the next visit can start loading it at once (index.html)
      try { window.localStorage.setItem("mf-hero", S.heroImage || "none"); } catch (e) { /* ignore */ }
      if (S.heroImage) {
        heroBg.style.backgroundImage = "url('" + heroSrc(S.heroImage) + "')";
        heroSection.classList.add("hero-photo");
      } else {
        heroBg.style.backgroundImage = "none";
        heroSection.classList.remove("hero-photo");
      }
    }

    var trustLogo = byId("trustLogo");
    if (trustLogo && S.logo && !trustLogo.getAttribute("src")) {
      trustLogo.addEventListener("error", function () { trustLogo.hidden = true; });
      trustLogo.src = S.logo;
      trustLogo.hidden = false;
    }
  }

  /* ---------- phone and social links ---------- */

  function linkTo(href, label, external, ltr) {
    var a = el("a", null, label);
    a.href = href;
    if (external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    if (ltr) a.dir = "ltr";
    return a;
  }

  function renderLinks() {
    var phones = document.getElementById("morePhones");
    if (phones) {
      phones.textContent = "";
      (S.morePhones || []).forEach(function (num) {
        phones.appendChild(linkTo("tel:" + num.replace(/[^\d+]/g, ""), num, false, true));
      });
      var phoneRow = phones.closest(".info-row");
      if (phoneRow) phoneRow.hidden = !(S.morePhones && S.morePhones.length);
    }

    var social = document.getElementById("socialLinks");
    var footer = document.getElementById("footerSocial");
    if (social) {
      social.textContent = "";
      (S.social || []).forEach(function (item) { social.appendChild(linkTo(item.url, item.name, true, true)); });
      var socialRow = social.closest(".info-row");
      if (socialRow) socialRow.hidden = !(S.social && S.social.length);
    }
    if (footer) {
      footer.textContent = "";
      (S.social || []).forEach(function (item) { footer.appendChild(linkTo(item.url, item.name, true, true)); });
    }
  }

  /* ---------- category filter + search ---------- */

  function renderFilters() {
    var box = document.getElementById("catalog");
    if (!box) return;
    box.textContent = "";

    function chip(id, label, count) {
      var btn = el("button", "chip");
      btn.type = "button";
      btn.setAttribute("data-cat", id);
      btn.setAttribute("aria-pressed", id === activeCat ? "true" : "false");
      btn.appendChild(el("span", null, label));
      btn.appendChild(el("b", null, String(count)));
      return btn;
    }

    box.appendChild(chip("all", t().all, PRODUCTS.length));
    CATS.forEach(function (cat) {
      var count = PRODUCTS.filter(function (p) { return p.cat === cat.id; }).length;
      if (count) box.appendChild(chip(cat.id, tr(cat.name), count));
    });
  }

  function applyFilter() {
    if (!document.getElementById("products")) return;
    document.querySelectorAll("#catalog .chip").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-cat") === activeCat ? "true" : "false");
    });

    var q = normalize(query);
    var total = 0;
    var rows = activeCat === "all" && !q;
    var productsBox = document.getElementById("products");
    productsBox.classList.toggle("view-rows", rows);
    productsBox.classList.toggle("view-grid", !rows);

    document.querySelectorAll(".catalog-section").forEach(function (sec) {
      var inCategory = activeCat === "all" || sec.getAttribute("data-cat") === activeCat;
      var visible = 0;
      sec.querySelectorAll(".product-card").forEach(function (card) {
        var inSeries = sec.getAttribute("data-cat") !== "gym-equipment" || activeGymSeries === "all" || card.getAttribute("data-series") === activeGymSeries;
        var match = inCategory && inSeries && (!q || card.getAttribute("data-search").indexOf(q) !== -1);
        card.hidden = !match;
        if (match) visible += 1;
      });
      sec.hidden = visible === 0;
      var count = sec.querySelector(".section-heading span");
      if (count) count.textContent = t().items(visible);
      total += visible;
      sec.querySelectorAll(".gym-series-section").forEach(function (group) {
        var count = group.querySelectorAll(".product-card:not([hidden])").length;
        group.hidden = count === 0;
        group.querySelector(".gym-series-count").textContent = t().items(count);
      });
    });
    document.querySelectorAll("[data-gym-series]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-gym-series") === activeGymSeries ? "true" : "false");
    });

    requestAnimationFrame(updateAllArrows);

    var none = document.getElementById("noResults");
    if (none) {
      none.hidden = total !== 0;
      if (total === 0) {
        var noBtn = document.getElementById("noResultsBtn");
        if (noBtn) noBtn.href = waUrl(q ? t().askSearch(query.trim()) : t().askGeneral);
      }
    }
  }

  /* ---------- jump to a category ---------- */

  function scrollToCatalog() {
    var box = document.getElementById("products");
    if (!box) return;
    var topbar = document.getElementById("top");
    var filters = document.getElementById("catalog");
    var offset = (topbar ? topbar.offsetHeight : 0) + (filters ? filters.offsetHeight : 0) + 8;
    var y = box.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  function setCategory(id) {
    activeCat = id || "all";
    activeGymSeries = "all";
    applyFilter();
    scrollToCatalog();
  }

  /* ---------- products ---------- */

  var cardHooks = [];
  var lightboxHooks = [];

  function productByImage(id) {
    return PRODUCTS.filter(function (p) { return p.image === id; })[0];
  }

  function isRtl() { return root.dir === "rtl"; }

  // swipe rows: wraps a product grid with previous / next arrows (arrows show on computers)
  function rowify(grid) {
    if (!grid || !grid.parentNode) return;
    var wrap = grid.parentNode;
    if (!wrap.classList.contains("row-wrap")) {
      wrap = el("div", "row-wrap");
      grid.parentNode.insertBefore(wrap, grid);
      wrap.appendChild(grid);
      ["prev", "next"].forEach(function (dir) {
        var b = el("button", "row-arrow row-" + dir);
        b.type = "button";
        b.setAttribute("data-dir", dir);
        b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
        b.addEventListener("click", function () {
          var step = Math.max(grid.clientWidth * 0.85, 200);
          var sign = (dir === "next" ? 1 : -1) * (isRtl() ? -1 : 1);
          grid.scrollBy({ left: sign * step, behavior: "smooth" });
        });
        wrap.appendChild(b);
      });
      grid.addEventListener("scroll", function () { updateArrows(wrap); }, { passive: true });
    }
    var d = t();
    wrap.querySelector(".row-prev").setAttribute("aria-label", d.scrollPrev);
    wrap.querySelector(".row-next").setAttribute("aria-label", d.scrollNext);
    updateArrows(wrap);
  }

  function updateArrows(wrap) {
    var grid = wrap.querySelector(".product-grid");
    if (!grid) return;
    var pos = Math.abs(grid.scrollLeft);
    var max = grid.scrollWidth - grid.clientWidth;
    var prev = wrap.querySelector(".row-prev"), next = wrap.querySelector(".row-next");
    if (prev) prev.disabled = pos < 4;
    if (next) next.disabled = pos >= max - 4;
    wrap.classList.toggle("is-scrollable", max > 4);
  }

  function updateAllArrows() {
    document.querySelectorAll(".row-wrap").forEach(updateArrows);
  }

  function seriesName(p) {
    if (!p.series || !window.GYM_SERIES) return "";
    var s = window.GYM_SERIES.filter(function (x) { return x.id === p.series; })[0];
    return s ? s.name : "";
  }

  function waProductName(p, name) {
    var s = seriesName(p);
    return s ? s + " " + name : name;
  }

  function productCard(p) {
    var dict = t();
    var name = tr(p.name);

    var card = el("article", "product-card");
    card.dataset.product = p.image;
    if (p.series) card.setAttribute("data-series", p.series);
    card.setAttribute("data-search", searchText(p));

    var media = el("button", "product-media");
    media.type = "button";
    media.setAttribute("data-name", name);
    media.setAttribute("aria-label", dict.zoomAria(name));
    var img = document.createElement("img");
    img.src = p.imageData || (S.imageBase + (p.thumbnail || p.image));
    img.alt = "";
    img.width = 800;
    img.height = 800;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", function () {
      media.classList.add("is-missing");
      media.disabled = true;
      img.remove();
    });
    media.addEventListener("click", function () { openLightbox(p, media); });
    media.appendChild(img);
    if (p.badge === "new" || p.badge === "popular") {
      var badgeText = p.badge === "new" ? dict.badgeNew : dict.badgePopular;
      media.appendChild(el("span", "product-badge product-badge-" + p.badge, badgeText));
    }
    card.appendChild(media);

    var info = el("div", "product-info");
    var text = el("div", "product-text");
    text.appendChild(el("h3", null, name));
    if (p.no) {
      var code = el("p", "product-no", (p.series ? window.GYM_COPY[lang].code : dict.itemNo) + " " + p.no);
      code.dir = "auto";
      text.appendChild(code);
    }
    if (p.spec) text.appendChild(el("p", "product-spec", tr(p.spec)));
    if (p.price) text.appendChild(el("p", "product-price", String(p.price)));
    info.appendChild(text);

    if (p.stock && dict.stock[p.stock]) {
      info.appendChild(el("span", "stock stock-" + p.stock, dict.stock[p.stock]));
    }

    var btn = el("a", "price-btn");
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.href = waUrl(dict.askProduct(waProductName(p, name), p.no));
    btn.innerHTML = WA_ICON;
    btn.appendChild(el("span", null, dict.priceBtn));
    info.appendChild(btn);

    if (p.video) {
      var vid = el("a", "video-btn");
      vid.target = "_blank";
      vid.rel = "noopener noreferrer";
      vid.href = p.video;
      vid.innerHTML = PLAY_ICON;
      vid.appendChild(el("span", null, dict.videoBtn));
      info.appendChild(vid);
    }

    card.appendChild(info);
    cardHooks.forEach(function (fn) {
      try { fn(card, p); } catch (e) { /* a feature must never break a product card */ }
    });
    return card;
  }

  function renderProducts() {
    var box = document.getElementById("products");
    if (!box) return;
    box.textContent = "";

    CATS.forEach(function (cat) {
      var items = PRODUCTS.filter(function (p) { return p.cat === cat.id; });
      if (!items.length) return;

      var sec = el("section", "catalog-section");
      sec.id = "cat-" + cat.id;
      sec.setAttribute("data-cat", cat.id);

      var head = el("div", "section-heading");
      head.appendChild(el("h2", null, tr(cat.name)));
      head.appendChild(el("span", null, t().items(items.length)));
      var seeAll = el("button", "see-all");
      seeAll.type = "button";
      seeAll.setAttribute("data-see-all", cat.id);
      seeAll.appendChild(el("b", null, t().seeAll));
      seeAll.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>');
      seeAll.addEventListener("click", function () { setCategory(cat.id); });
      head.appendChild(seeAll);
      sec.appendChild(head);

      if (cat.id === "gym-equipment") {
        renderGymEquipment(sec, items);
        box.appendChild(sec);
        return;
      }

      var grid = el("div", "product-grid");
      items.forEach(function (p) { grid.appendChild(productCard(p)); });
      sec.appendChild(grid);

      box.appendChild(sec);
      rowify(grid);
    });
    box.querySelectorAll(".gym-series-section .product-grid").forEach(rowify);
  }

  function logoTile(name, box, className) {
    var tile = el("div", "gym-logo-tile " + (className || ""));
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", box.join(" "));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", name);
    var img = document.createElementNS(ns, "image");
    img.setAttribute("href", "assets/gym-logo-source.jpeg");
    img.setAttribute("width", "1290");
    img.setAttribute("height", "372");
    svg.appendChild(img);
    tile.appendChild(svg);
    return tile;
  }

  function renderGymEquipment(sec, items) {
    var copy = window.GYM_COPY[lang];
    var partners = el("div", "gym-partners");
    var brands = el("div", "gym-brand-row");
    brands.appendChild(logoTile("DHZ Fitness", [30, 38, 419, 109], "gym-brand"));
    brands.appendChild(logoTile("Marshal Fitness Germany", [678, 15, 537, 105], "gym-brand"));
    partners.appendChild(brands);
    var agency = el("p", "gym-agency", "الوكيل الحصري في إقليم كوردستان");
    agency.lang = "ar"; agency.dir = "rtl";
    partners.appendChild(agency);
    partners.appendChild(el("h3", "gym-customer-heading", copy.customers));
    var logos = el("div", "gym-customer-grid");
    [["gym80", [58,252,172,95]], ["Pure Kraft", [272,250,132,111]], ["Johnson", [470,262,178,80]], ["Powerhouse Gym", [688,247,156,108]], ["smart fit", [900,239,100,116]], ["REP", [1042,270,182,61]]].forEach(function (logo) {
      logos.appendChild(logoTile(logo[0], logo[1]));
    });
    partners.appendChild(logos);
    sec.appendChild(partners);
    var controls = el("div", "gym-series-controls");
    var label = el("p", "gym-series-label", copy.series);
    label.id = "gym-series-label";
    controls.appendChild(label);
    var filters = el("div", "gym-series-filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-labelledby", label.id);
    [{id:"all", name:copy.all}].concat(window.GYM_SERIES).forEach(function (series) {
      var count = items.filter(function (p) { return series.id === "all" || p.series === series.id; }).length;
      if (!count) return;
      var button = el("button", "chip");
      button.type = "button";
      button.setAttribute("data-gym-series", series.id);
      button.setAttribute("aria-controls", "gym-series-products");
      button.appendChild(el("span", null, series.name));
      button.appendChild(el("b", null, String(count)));
      button.addEventListener("click", function () {
        activeGymSeries = series.id;
        activeCat = "gym-equipment";
        applyFilter();
      });
      filters.appendChild(button);
    });
    controls.appendChild(filters);
    sec.appendChild(controls);
    var groups = el("div", "gym-series-products");
    groups.id = "gym-series-products";
    var knownSeries = window.GYM_SERIES.map(function (s) { return s.id; });
    var noSeries = items.filter(function (p) { return knownSeries.indexOf(p.series) === -1; });
    var seriesList = window.GYM_SERIES.slice();
    // products added in admin without a series get their own group, so they are never hidden
    if (noSeries.length) seriesList.push({ id: "__other", name: copy.other || copy.title });
    seriesList.forEach(function (series) {
      var products = series.id === "__other" ? noSeries : items.filter(function (p) { return p.series === series.id; });
      if (!products.length) return;
      var group = el("section", "gym-series-section");
      var titleId = "series-" + series.id;
      group.setAttribute("aria-labelledby", titleId);
      var heading = el("div", "gym-series-heading");
      var title = el("h3", null, series.name);title.id = titleId;
      heading.appendChild(title);
      heading.appendChild(el("span", "gym-series-count", t().items(products.length)));
      group.appendChild(heading);
      var grid = el("div", "product-grid");
      products.forEach(function (p) { grid.appendChild(productCard(p)); });
      group.appendChild(grid);
      groups.appendChild(group);
    });
    sec.appendChild(groups);
  }

  /* ---------- pop-up windows (photo zoom, weight check, compare) ---------- */

  var openNode = null;
  var returnFocus = null;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

  function focusables(node) {
    return Array.prototype.filter.call(node.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null || n === document.activeElement;
    });
  }

  function openModal(node, opener, focusEl) {
    if (openNode === node) {
      // the same window shows new content (e.g. "You may also like"): keep it open
      if (opener) returnFocus = opener;
      var again = focusEl || focusables(node)[0];
      if (again) again.focus();
      return;
    }
    if (openNode) closeModal(true);
    node.hidden = false;
    openNode = node;
    returnFocus = opener || document.activeElement;
    root.classList.add("lb-open");
    var first = focusEl || focusables(node)[0];
    if (first) first.focus();
  }

  function closeModal(silent) {
    if (!openNode) return;
    var node = openNode;
    openNode = null;
    node.hidden = true;
    root.classList.remove("lb-open");
    node.dispatchEvent(new Event("modal-close"));
    if (!silent && returnFocus && returnFocus.focus && document.contains(returnFocus)) returnFocus.focus();
  }

  document.querySelectorAll(".lightbox").forEach(function (node) {
    node.addEventListener("click", function (e) { if (e.target === node) closeModal(); });
  });
  ["lbClose", "quizClose", "cmpClose"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", function () { closeModal(); });
  });

  /* ---------- photo zoom ---------- */

  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbTitle = document.getElementById("lbTitle");
  var lbNo = document.getElementById("lbNo");
  var lbPrice = document.getElementById("lbPrice");
  var lbShare = document.getElementById("lbShare");
  var lbClose = document.getElementById("lbClose");

  function productLink(p) {
    return (S.siteUrl || location.href.split("?")[0].split("#")[0]).split("?")[0] + "?p=" + encodeURIComponent(productKey(p));
  }

  function shareProduct(p) {
    var name = tr(p.name);
    var link = productLink(p);
    var shareText = t().shareProduct(waProductName(p, name), link);
    if (navigator.share) {
      navigator.share({ title: name, text: shareText, url: link }).catch(function () {});
    } else {
      window.open(waShareUrl(shareText), "_blank", "noopener,noreferrer");
    }
  }

  function openLightbox(p, opener) {
    recordRecentView(p.image, opener && opener.closest ? (opener.closest(".product-card") || opener) : null);
    if (window.MF_TRACK) window.MF_TRACK("views", p);
    if (!lb) return;
    lb.setAttribute("data-product", p.image);
    var lbVideo = document.getElementById("lbVideo");
    if (lbVideo) {
      lbVideo.hidden = !p.video;
      if (p.video) lbVideo.href = p.video;
    }
    var dict = t();
    var name = tr(p.name);
    lbImg.src = p.imageData || (S.imageBase + p.image);
    lbImg.alt = name;
    lbTitle.textContent = name;
    lbNo.textContent = p.no ? dict.itemNo + " " + p.no : "";
    lbNo.hidden = !p.no;
    lbPrice.href = waUrl(dict.askProduct(waProductName(p, name), p.no));
    if (lbShare) {
      lbShare.onclick = function () { shareProduct(p); };
    }
    openModal(lb, opener, lbClose);
    lightboxHooks.forEach(function (fn) {
      try { fn(p, opener); } catch (e) { /* ignore */ }
    });
  }
  if (lb) lb.addEventListener("modal-close", function () { lbImg.removeAttribute("src"); });

  /* ---------- color modes ---------- */

  var themeToggle = document.getElementById("themeToggle");
  var themeMenu = document.getElementById("themeMenu");

  function currentTheme() {
    var name = root.getAttribute("data-theme");
    return THEMES[name] ? name : "dark";
  }

  function setTheme(name, save) {
    if (!THEMES[name]) name = "dark";
    root.setAttribute("data-theme", name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[name]);
    document.querySelectorAll("[data-theme-choice]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-theme-choice") === name ? "true" : "false");
    });
    if (save) {
      try { window.localStorage.setItem(THEME_KEY, name); } catch (e) { /* ignore */ }
    }
  }

  function closeThemeMenu() {
    if (!themeMenu || !themeToggle) return;
    themeMenu.hidden = true;
    themeToggle.setAttribute("aria-expanded", "false");
  }

  if (themeToggle && themeMenu) {
    themeToggle.addEventListener("click", function () {
      var open = themeMenu.hidden;
      themeMenu.hidden = !open;
      themeToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        var pressed = themeMenu.querySelector('[aria-pressed="true"]');
        if (pressed) pressed.focus();
      }
    });
    themeMenu.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-theme-choice]");
      if (!btn) return;
      setTheme(btn.getAttribute("data-theme-choice"), true);
      closeThemeMenu();
      themeToggle.focus();
    });
    document.addEventListener("click", function (e) {
      if (!themeMenu.hidden && !document.getElementById("themeBox").contains(e.target)) closeThemeMenu();
    });
  }

  /* ---------- mobile menu (hamburger) + header search icon ---------- */

  var menuToggle = document.getElementById("menuToggle");
  var navLinks = document.getElementById("navLinks");

  function closeMenu() {
    if (!navLinks || !menuToggle) return;
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      var open = !navLinks.classList.contains("open");
      navLinks.classList.toggle("open", open);
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.closest("a") || e.target.closest("button.nav-link")) closeMenu();
    });
    document.addEventListener("click", function (e) {
      if (navLinks.classList.contains("open") &&
          !navLinks.contains(e.target) && !menuToggle.contains(e.target)) closeMenu();
    });
  }

  var navMealOpen = document.getElementById("navMealOpen");
  var navCompareOpen = document.getElementById("navCompareOpen");
  if (navMealOpen) navMealOpen.addEventListener("click", function () {
    var btn = document.getElementById("quizOpen");
    if (btn) btn.click();
  });
  if (navCompareOpen) navCompareOpen.addEventListener("click", function (e) {
    var btn = document.getElementById("compareOpen");
    if (btn) { if (e.preventDefault) e.preventDefault(); btn.click(); }
  });
  window.addEventListener("resize", closeMenu);

  var searchIcon = document.getElementById("searchIcon");
  if (searchIcon) searchIcon.addEventListener("click", function () {
    closeMenu();
    var input = document.getElementById("search");
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
  });

  /* ---------- keyboard: Escape closes things, Tab stays inside a pop-up ---------- */

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (openNode) closeModal();
      else if (themeMenu && !themeMenu.hidden) { closeThemeMenu(); themeToggle.focus(); }
      else if (navLinks && navLinks.classList.contains("open")) { closeMenu(); menuToggle.focus(); }
      return;
    }
    if (e.key === "Tab" && openNode) {
      var items = focusables(openNode);
      if (!items.length) return;
      var i = items.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === items.length - 1 || i === -1)) { e.preventDefault(); items[0].focus(); }
    }
  });

  /* ---------- sizes used by the sticky bars ---------- */

  function measure() {
    var top = document.getElementById("top");
    if (top) root.style.setProperty("--topbar-h", top.offsetHeight + "px");
    var filters = document.getElementById("catalog");
    if (filters) root.style.setProperty("--filters-h", filters.offsetHeight + "px");
  }

  /* ---------- best-sellers + recently viewed ---------- */

  var RECENT_KEY = "marshal-recent-viewed";

  function recordRecentView(id, anchor) {
    try {
      var arr = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
      arr = arr.filter(function (x) { return x !== id; });
      arr.unshift(id);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, 8)));
    } catch (e) { /* ignore */ }
    renderRecent(anchor);
  }

  function renderBestsellers() {
    var box = document.getElementById("bestsellers");
    var section = document.getElementById("bestsellersSection");
    if (!box || !section) return;
    var items = PRODUCTS.filter(function (p) { return p.badge === "popular"; });
    box.textContent = "";
    items.forEach(function (p) { box.appendChild(productCard(p)); });
    section.hidden = !items.length;
  }

  // When a row above the visitor's view changes height (Recently viewed, Saved),
  // move the page by the same amount so what they are looking at does not jump.
  function nextVisible(node) {
    var n = node && node.nextElementSibling;
    while (n && n.offsetParent === null) n = n.nextElementSibling;
    return n;
  }
  // anchor = the thing the visitor just touched (a product card, a heart); it stays put
  function keepScroll(section, fn, anchor) {
    var a = anchor || document.activeElement;
    var useAnchor = a && a !== document.body && document.contains(a) && !section.contains(a) &&
      a.offsetParent !== null && (section.compareDocumentPosition(a) & 4); // 4 = comes after the section
    var ref = useAnchor ? a : nextVisible(section);
    var before = ref ? ref.getBoundingClientRect().top : null;
    var topbar = document.getElementById("top");
    var limit = topbar ? topbar.offsetHeight : 0;
    fn();
    if (!ref || before === null) return;
    if (!useAnchor && before >= limit) return;
    var delta = ref.getBoundingClientRect().top - before;
    if (Math.abs(delta) > 1) {
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollBy(0, delta);
      root.style.scrollBehavior = prev;
    }
  }

  function renderRecent(anchor) {
    var section = document.getElementById("recentSection");
    if (!section) return;
    keepScroll(section, renderRecentNow, anchor);
  }

  function renderRecentNow() {
    var box = document.getElementById("recentViewed");
    var section = document.getElementById("recentSection");
    if (!box || !section) return;
    var arr = [];
    try { arr = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { /* ignore */ }
    var items = arr.map(function (id) {
      return PRODUCTS.filter(function (p) { return p.image === id; })[0];
    }).filter(Boolean);
    box.textContent = "";
    items.forEach(function (p) { box.appendChild(productCard(p)); });
    section.hidden = !items.length;
    if (box.parentNode && box.parentNode.classList.contains("row-wrap")) updateArrows(box.parentNode);
  }

  /* ---------- render everything ---------- */

  var renderHooks = [];

  function render() {
    applyStaticTexts();
    renderLinks();
    renderFilters();
    renderProducts();
    renderBestsellers();
    renderRecent();
    ["bestsellers", "recentViewed", "savedRow"].forEach(function (id) { rowify(document.getElementById(id)); });
    applyFilter();
    measure();
    renderHooks.forEach(function (fn) { fn(); });
  }

  // used by features.js
  window.MF = {
    S: S,
    PRODUCTS: PRODUCTS,
    CATS: CATS,
    t: t,
    tr: tr,
    el: el,
    waUrl: waUrl,
    WA_ICON: WA_ICON,
    lang: function () { return lang; },
    openModal: openModal,
    openLightbox: openLightbox,
    productKey: productKey,
    productLink: function (p) { return productLink(p); },
    closeModal: closeModal,
    focusables: focusables,
    onRender: function (fn) { renderHooks.push(fn); },
    onCard: function (fn) {
      cardHooks.push(fn);
      document.querySelectorAll(".product-card").forEach(function (card) {
        var p = productByImage(card.dataset.product);
        if (p) { try { fn(card, p); } catch (e) { /* ignore */ } }
      });
    },
    onLightbox: function (fn) { lightboxHooks.push(fn); },
    productCard: function (p) { return productCard(p); },
    productByImage: productByImage,
    rowify: rowify,
    keepScroll: keepScroll,
    setCategory: setCategory,
    scrollToCatalog: scrollToCatalog,
    activeCategory: function () { return activeCat; },
    shareProduct: function (p) { shareProduct(p); },
    waShareUrl: waShareUrl,
    waProductName: waProductName,
    normalize: normalize,
    searchText: searchText,
    catName: function (id) {
      var c = CATS.filter(function (x) { return x.id === id; })[0];
      return c ? tr(c.name) : "";
    }
  };

  function setLanguage(next) {
    if (!I18N[next] || next === lang) return;
    lang = next;
    try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.history.replaceState(null, "", url.toString());
    } catch (e) { /* ignore */ }
    render();
  }

  document.querySelectorAll(".lang").forEach(function (box) {
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-lang]");
      if (btn) setLanguage(btn.getAttribute("data-lang"));
    });
  });

  var catalogBox = document.getElementById("catalog");
  if (catalogBox) catalogBox.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    setCategory(btn.getAttribute("data-cat"));
  });

  var searchInput = document.getElementById("search");
  if (searchInput) searchInput.addEventListener("input", function (e) {
    query = e.target.value;
    applyFilter();
  });

  window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------- back to top ---------- */
  var backToTop = document.getElementById("backToTop");
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", function () {
      backToTop.classList.toggle("show", window.scrollY > 600);
    }, { passive: true });
  }

  // links to "#top" (footer "Back to top", app bar Home, logo): the top bar is sticky,
  // so the browser thinks it is already visible and does not move — scroll by hand
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="#top"]');
    if (!a) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("resize", updateAllArrows);

  /* ---------- hidden admin entry: tap the logo 5 times quickly ---------- */
  var brandBox = document.querySelector(".brand-lockup");
  if (brandBox) {
    var taps = 0, tapTimer = null;
    brandBox.addEventListener("click", function () {
      taps += 1;
      clearTimeout(tapTimer);
      if (taps >= 5) { taps = 0; window.location.href = "admin.html"; return; }
      tapTimer = setTimeout(function () { taps = 0; }, 1500);
    });
  }

  setTheme(currentTheme(), false);
  render();
})();
