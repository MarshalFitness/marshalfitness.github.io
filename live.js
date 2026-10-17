/* Marshal Fitness — live data loader.
   1. Tries to read products and site settings from the online database (Firebase).
   2. If the database answers, its data replaces the built-in data from content.js.
   3. If it is slow or offline, the site still opens with the built-in data.
   Then it starts the normal site scripts. */
(function () {
  "use strict";
  var APP_SCRIPTS = ["script.js", "features.js", "quotation.js", "request-form.js", "extras.js",
    "shop.js", "finder.js", "app.js", "helper.js", "planner.js",
    "cutouts.js", "v20.js", "tour.js", "camera.js", "show.js", "planner3d.js", "photosearch.js"];
  var WAIT_MS = 3500;
  var started = false;

  function loadScripts(list) {
    if (!list.length) {
      try { document.dispatchEvent(new Event("mf-ready")); } catch (e) { /* ignore */ }
      return;
    }
    var s = document.createElement("script");
    s.src = list[0];
    s.onload = s.onerror = function () { loadScripts(list.slice(1)); };
    document.body.appendChild(s);
  }

  function start() {
    if (started) return;
    started = true;
    loadScripts(APP_SCRIPTS.slice());
  }

  function applyProducts(snap) {
    if (!snap || snap.empty) return;
    var list = [];
    snap.forEach(function (doc) {
      var d = doc.data() || {};
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
        order: typeof d.order === "number" ? d.order : 9999
      });
    });
    if (!list.length) return;
    list.sort(function (a, b) { return a.order - b.order; });
    window.PRODUCTS = list;
  }

  var SITE_KEYS = ["phone", "phoneDisplay", "morePhones", "social", "mapsLink", "lat", "lng",
    "schedule", "hours", "foundedYear", "googleRating", "googleReviews", "heroImage"];

  function applyContent(snap) {
    if (!snap) return;
    snap.forEach(function (doc) {
      var d = doc.data() || {};
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
      }
    });
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
    setTimeout(start, WAIT_MS);
    Promise.all([db.collection("products").get(), db.collection("content").get()])
      .then(function (res) {
        if (started) return;
        try { applyProducts(res[0]); applyContent(res[1]); } catch (e) { /* keep built-in data */ }
        start();
      })
      .catch(start);
  } catch (e) {
    start();
  }
})();
