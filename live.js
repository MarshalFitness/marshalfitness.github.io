/* Marshal Fitness — live data loader.
   1. Tries to read products and site settings from the online database (Firebase).
   2. If the database answers, its data replaces the built-in data from content.js.
   3. If it is slow or offline, the site still opens: first with the data saved on the
      phone from the last visit, otherwise with the built-in data.
   Then it starts the normal site scripts. The list of scripts is in index.html
   (window.MF_APP); they download together and run in order. */
(function () {
  "use strict";
  var V = window.MF_V || "21";
  var APP_SCRIPTS = (window.MF_APP || []).map(function (f) { return f + "?v=" + V; });
  var WAIT_MS = 3500;       // longest wait for the database
  var WAIT_CACHED_MS = 2000; // shorter wait when we have the data from the last visit
  var CACHE_DAYS = 30;
  var started = false;
  var t0 = Date.now();

  /* ---------- start the site scripts ---------- */
  function ready() {
    try { document.dispatchEvent(new Event("mf-ready")); } catch (e) { /* ignore */ }
  }

  function loadScripts(list) {
    var left = list.length;
    if (!left) { ready(); return; }
    list.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false; // download together, run in this order
      s.onload = s.onerror = function () { left -= 1; if (left === 0) ready(); };
      document.body.appendChild(s);
    });
  }

  // small photos for the product cards (thumbs.js)
  function useThumbs() {
    var T = window.THUMBS || {};
    (window.PRODUCTS || []).forEach(function (p) {
      if (p && !p.thumbnail && !p.imageData && T[p.image]) p.thumbnail = T[p.image];
    });
  }

  function start() {
    if (started) return;
    started = true;
    try { useThumbs(); } catch (e) { /* ignore */ }
    loadScripts(APP_SCRIPTS.slice());
  }

  /* ---------- database documents -> site data ---------- */
  function applyProducts(docs) {
    if (!docs || !docs.length) return;
    var list = [];
    docs.forEach(function (doc) {
      var d = doc.data || {};
      if (d.hidden || !d.cat || !d.image || !d.name) return;
      list.push({
        cat: d.cat, image: d.image, imageData: d.imageData || undefined,
        name: d.name, no: d.no || undefined, badge: d.badge || undefined,
        stock: d.stock || undefined, price: d.price || undefined,
        spec: d.spec || undefined, specs: d.specs || undefined,
        series: d.series || undefined, thumbnail: d.thumbnail || undefined,
        video: d.video || undefined,
        sizeW: Number(d.sizeW) > 0 ? Number(d.sizeW) : undefined,
        sizeL: Number(d.sizeL) > 0 ? Number(d.sizeL) : undefined,
        show: typeof d.show === "boolean" ? d.show : undefined,
        cut: typeof d.cut === "string" && d.cut.indexOf("data:image/") === 0 ? d.cut : undefined,
        cutOff: d.cutOff === true ? true : undefined,
        emb: typeof d.emb === "string" ? d.emb : undefined,
        ex: typeof d.ex === "string" ? d.ex : undefined,
        order: typeof d.order === "number" ? d.order : 9999
      });
    });
    if (!list.length) return;
    list.sort(function (a, b) { return a.order - b.order; });
    window.PRODUCTS = list;
  }

  var SITE_KEYS = ["phone", "phoneDisplay", "morePhones", "social", "mapsLink", "lat", "lng",
    "schedule", "hours", "foundedYear", "googleRating", "googleReviews", "heroImage"];

  function applyContent(docs) {
    if (!docs) return;
    docs.forEach(function (doc) {
      var d = doc.data || {};
      if (doc.id === "site") {
        SITE_KEYS.forEach(function (k) {
          if (d[k] !== undefined && d[k] !== null && d[k] !== "") window.SITE[k] = d[k];
        });
      } else if (doc.id === "texts") {
        ["en", "ar", "ckb"].forEach(function (lg) {
          var over = d[lg] || {};
          var base = window.I18N[lg];
          if (!base) return;
          Object.keys(over).forEach(function (k) {
            if (typeof base[k] === "string" && typeof over[k] === "string" && over[k].trim()) base[k] = over[k];
          });
        });
      } else if (doc.id === "faq" && Array.isArray(d.items) && d.items.length) {
        window.FAQ_DATA = d.items;
      } else if (doc.id === "payments" && Array.isArray(d.items) && d.items.length) {
        window.PAYMENT_METHODS = d.items;
      } else if (doc.id === "brands" && Array.isArray(d.items)) {
        window.BRANDS = d.items;
      } else if (doc.id === "offer") {
        window.OFFER = d;
      } else if (doc.id === "tour" && Array.isArray(d.stops)) {
        window.TOUR_EDIT = d;
      } else if (doc.id === "holidays") {
        window.HOLIDAY_EDIT = d;
      }
    });
  }

  function useData(data) {
    try { applyProducts(data.products); applyContent(data.content); } catch (e) { /* keep built-in data */ }
  }

  function toDocs(snap) {
    var out = [];
    if (snap) snap.forEach(function (doc) { out.push({ id: doc.id, data: doc.data() || {} }); });
    return out;
  }

  /* ---------- data from the last visit (saved on this phone) ---------- */
  var cached = null;
  function openDb(cb) {
    try {
      var r = window.indexedDB.open("mf-cache", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("data"); };
      r.onsuccess = function () { cb(r.result); };
      r.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  // the database failed fast (no internet): use the saved data, but only after we looked for it
  var cacheChecked = false, dbFailed = false;
  function fallbackNow() {
    if (started) return;
    if (cached) useCached(); else start();
  }
  function cacheDone() {
    if (cacheChecked) return;
    cacheChecked = true;
    if (dbFailed) fallbackNow();
  }
  function dbFail() {
    dbFailed = true;
    if (cacheChecked) fallbackNow();
  }
  function readCache() {
    openDb(function (db) {
      if (!db) { cacheDone(); return; }
      try {
        var q = db.transaction("data").objectStore("data").get("last");
        q.onsuccess = function () {
          var c = q.result;
          if (c && c.t && Date.now() - c.t < CACHE_DAYS * 864e5 && c.products && c.products.length) {
            cached = c;
            // we have the last data: do not wait long for the database
            setTimeout(useCached, Math.max(0, WAIT_CACHED_MS - (Date.now() - t0)));
          }
          cacheDone();
        };
        q.onerror = cacheDone;
      } catch (e) { cacheDone(); }
    });
  }
  function saveCache(data) {
    openDb(function (db) {
      if (!db) return;
      try {
        var clean = JSON.parse(JSON.stringify({ t: Date.now(), products: data.products, content: data.content }));
        db.transaction("data", "readwrite").objectStore("data").put(clean, "last");
      } catch (e) { /* too big or not allowed: never mind */ }
    });
  }
  function useCached() {
    if (started || !cached) return;
    useData(cached);
    start();
  }

  try {
    if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error("no firebase");
    firebase.initializeApp(window.FIREBASE_CONFIG);
    var db = firebase.firestore();
    window.MF_DB = db;
    window.MF_TRACK = function (kind, p) {
      try {
        var key = String(p.image || "").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
        if (!key) return;
        if (kind === "views") {
          var seenKey = "mf-seen-" + key;
          if (window.sessionStorage.getItem(seenKey)) return;
          window.sessionStorage.setItem(seenKey, "1");
        }
        var day = new Date().toISOString().slice(0, 10);
        var inc = {}; inc[kind] = {}; inc[kind][key] = firebase.firestore.FieldValue.increment(1);
        db.collection("stats").doc(day).set(inc, { merge: true }).catch(function () {});
      } catch (e) { /* counting must never break the site */ }
    };
    readCache();
    setTimeout(function () { if (cached) useCached(); else start(); }, WAIT_MS);
    Promise.all([db.collection("products").get(), db.collection("content").get()])
      .then(function (res) {
        var fresh = { products: toDocs(res[0]), content: toDocs(res[1]) };
        if (fresh.products.length) saveCache(fresh);
        if (started) return;
        useData(fresh);
        start();
      })
      .catch(dbFail);
  } catch (e) {
    // no database program (no internet): show the data saved on this phone, or the built-in data
    if (!started) {
      setTimeout(function () { if (!started) fallbackNow(); }, WAIT_MS);
      dbFailed = true;
      if (!cacheChecked && !window.MF_DB) readCache(); else fallbackNow();
    }
  }
})();
