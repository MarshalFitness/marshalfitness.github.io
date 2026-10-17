/* Marshal Fitness — admin page logic (login, requests, products, shop info, texts, FAQ). */
(function () {
  "use strict";

  var LANGS = ["en", "ar", "ckb"];
  var LANG_NAME = { en: "English", ar: "Arabic", ckb: "Kurdish" };
  var DEFAULT_I18N = JSON.parse(JSON.stringify(window.I18N, function (k, v) { return typeof v === "function" ? undefined : v; }));
  var DEFAULT_PRODUCTS = window.PRODUCTS.slice();
  var CATS = window.CATEGORIES;

  firebase.initializeApp(window.FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function field(label, input) { return el("label", null, [label, input]); }
  function input(value, attrs) {
    var i = el("input", attrs || {});
    i.value = value == null ? "" : value;
    return i;
  }
  function textarea(value) { var t = el("textarea"); t.value = value || ""; return t; }
  var toastTimer;
  function toast(msg, bad) {
    var t = $("toast");
    t.textContent = msg;
    t.style.background = bad ? "#e0392b" : "#18181b";
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = "none"; }, 3000);
  }
  function fail(e) { console.error(e); toast("Error: " + (e && e.message ? e.message : "could not save"), true); }
  function multi(v) {
    if (!v) return { en: "", ar: "", ckb: "" };
    if (typeof v === "string") return { en: v, ar: v, ckb: v };
    return { en: v.en || "", ar: v.ar || "", ckb: v.ckb || "" };
  }
  function slug(s) { return String(s).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "item"; }
  function catName(id) { var c = CATS.filter(function (x) { return x.id === id; })[0]; return c ? c.name.en : id; }

  /* ---------- login ---------- */
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("loginErr").hidden = true;
    auth.signInWithEmailAndPassword($("email").value.trim(), $("password").value)
      .catch(function () { $("loginErr").textContent = "Wrong email or password."; $("loginErr").hidden = false; });
  });
  $("logout").addEventListener("click", function () { auth.signOut(); });

  var started = false;
  auth.onAuthStateChanged(function (user) {
    $("loginBox").hidden = !!user;
    $("app").hidden = !user;
    $("logout").hidden = !user;
    if (user && !started) { started = true; startApp(); }
    if (!user && started) location.reload();
  });

  /* ---------- tabs ---------- */
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (!b) return;
    document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
    document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
  });

  function startApp() {
    watchRequests();
    watchProducts();
    loadShop();
    loadTexts();
    loadFaqAndPay();
    loadOfferAndBrands();
    loadTour();
    seedViews();
  }

  /* ---------- 1. customer requests ---------- */
  var requests = [];
  function waNumber(phone) {
    var d = String(phone || "").replace(/[^\d]/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (d.indexOf("0") === 0 && d.length === 11) d = "964" + d.slice(1);
    if (d.length === 10 && d.indexOf("7") === 0) d = "964" + d;
    return d;
  }
  var firstLoad = true;
  var audioCtx = null;
  document.addEventListener("click", function () {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) { /* no sound */ }
  });
  function beep() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach(function (t) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = t ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.16);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.18);
      });
    } catch (e) { /* no sound */ }
  }
  function watchRequests() {
    db.collection("requests").orderBy("createdAt", "desc").limit(300).onSnapshot(function (snap) {
      var fresh = firstLoad ? [] : snap.docChanges().filter(function (ch) { return ch.type === "added" && (ch.doc.data() || {}).status !== "done"; });
      requests = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      if (fresh.length) { beep(); toast("New customer request!"); }
      firstLoad = false;
      renderRequests();
    }, function (e) { $("reqList").textContent = "Could not load requests: " + e.message; });
  }
  $("reqFilter").addEventListener("change", renderRequests);
  $("reqSearch").addEventListener("input", renderRequests);
  function renderRequests() {
    var box = $("reqList");
    var f = $("reqFilter").value;
    var newCount = requests.filter(function (r) { return r.status !== "done"; }).length;
    $("newCount").textContent = newCount;
    $("newCount").hidden = !newCount;
    document.title = (newCount ? "(" + newCount + ") " : "") + "Marshal Fitness Admin";
    var q = $("reqSearch").value.trim().toLowerCase();
    var list = requests.filter(function (r) { return f === "all" || (f === "new" ? r.status !== "done" : r.status === "done"); });
    if (q) list = list.filter(function (r) {
      return [r.number, r.name, r.phone, r.item].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    box.textContent = "";
    if (!list.length) { box.appendChild(el("p", { class: "muted", text: "No requests yet." })); return; }
    list.forEach(function (r) {
      var when = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : "";
      var done = r.status === "done";
      var reply = "https://wa.me/" + waNumber(r.phone) + "?text=" + encodeURIComponent("Hello " + (r.name || "") + ", this is Marshal Fitness about your request" + (r.number ? " " + r.number : "") + (r.item && !r.items ? ": " + r.item : "") + ".");
      var kindLabel = r.kind === "basket" ? "Basket" : r.kind === "helper" ? "Smart helper" : r.kind === "camera" ? "Room camera" : "Product";
      var itemsList = null;
      if (Array.isArray(r.items) && r.items.length) {
        itemsList = el("ol", { class: "req-items" });
        r.items.forEach(function (it) {
          itemsList.appendChild(el("li", { text: (it.name || "") + (it.no ? " (No. " + it.no + ")" : "") + " × " + (it.qty || 1) }));
        });
      }
      box.appendChild(el("div", { class: "req" + (done ? "" : " new") }, [
        el("div", { class: "row", style: "justify-content:space-between" }, [
          el("div", { class: "row" }, [
            r.number ? el("span", { class: "req-no", text: r.number }) : null,
            el("b", { text: r.name || "(no name)" }),
            el("span", { class: "req-kind", text: kindLabel })
          ]),
          el("span", { class: "muted", text: when })
        ]),
        el("div", { dir: "ltr", style: "text-align:left" }, [el("a", { href: "tel:" + r.phone, text: r.phone || "" })]),
        itemsList || (r.item ? el("div", { text: "Product: " + r.item }) : null),
        r.message ? el("details", null, [el("summary", { class: "muted", text: "Full WhatsApp message" }), el("div", { class: "msg", text: r.message })]) : null,
        el("div", { class: "row" }, [
          el("a", { class: "btn green small", href: reply, target: "_blank", rel: "noopener", text: "Reply on WhatsApp" }),
          el("button", { class: "btn light small", text: done ? "Mark as new" : "Mark as done", onclick: function () {
            db.collection("requests").doc(r.id).update({ status: done ? "new" : "done" }).catch(fail);
          } }),
          el("button", { class: "btn light small", text: "Delete", onclick: function () {
            if (confirm("Delete this request?")) db.collection("requests").doc(r.id).delete().catch(fail);
          } })
        ])
      ]));
    });
  }

  /* ---------- 2. products ---------- */
  var products = [];
  function watchProducts() {
    db.collection("products").onSnapshot(function (snap) {
      products = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      products.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      $("importBox").hidden = products.length > 0;
      renderProducts();
    }, fail);
  }

  $("importBtn").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    var batch = db.batch();
    DEFAULT_PRODUCTS.forEach(function (p, i) {
      var doc = { cat: p.cat, image: p.image, name: p.name, order: (i + 1) * 10, hidden: false };
      ["no", "badge", "stock", "spec", "specs", "price", "series", "thumbnail"].forEach(function (k) { if (p[k] !== undefined) doc[k] = p[k]; });
      batch.set(db.collection("products").doc(slug(p.image)), doc);
    });
    batch.commit().then(function () { toast("Products copied. You can edit them now."); })
      .catch(function (e) { btn.disabled = false; fail(e); });
  });

  function imgSrc(p) { return p.imageData || ("assets/" + p.image); }

  function seriesName(id) { var s = (window.GYM_SERIES || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name : ""; }
  $("pSearch").addEventListener("input", renderProducts);
  function renderProducts() {
    var box = $("plist");
    var q = $("pSearch").value.trim().toLowerCase();
    box.textContent = "";
    products.forEach(function (p) {
      var name = multi(p.name).en;
      if (q && (name + " " + (p.no || "") + " " + seriesName(p.series)).toLowerCase().indexOf(q) < 0) return;
      box.appendChild(el("div", { class: "prow" + (p.hidden ? " hid" : "") }, [
        el("img", { src: imgSrc(p), alt: "" }),
        el("div", null, [
          el("div", { style: "font-weight:600", text: name + (p.hidden ? " (hidden)" : "") }),
          el("div", { class: "muted", text: catName(p.cat) + (p.series ? " · " + seriesName(p.series) : "") + (p.no ? " · No. " + p.no : "") + (p.price ? " · " + p.price : " · no price shown") + (p.badge ? " · " + p.badge : "") })
        ]),
        el("button", { class: "btn light small", text: "Edit", onclick: function () { openEditor(p); } })
      ]));
    });
  }

  $("addProduct").addEventListener("click", function () {
    openEditor({ cat: CATS[0].id, name: { en: "", ar: "", ckb: "" }, order: (products.length + 1) * 10, hidden: false });
  });

  function resizeImage(file, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("This file is not a photo.")); };
        img.onload = function () {
          var max = opts.max || 900, w = img.width, h = img.height;
          if (w > max || h > max) { var s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          var ctx = c.getContext("2d");
          if (opts.png) { ctx.drawImage(img, 0, 0, w, h); resolve(c.toDataURL("image/png")); return; }
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          var q = 0.82, out = c.toDataURL("image/jpeg", q);
          while (out.length > 600000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openEditor(p) {
    var box = $("editor");
    var isNew = !p.id;
    var name = multi(p.name);
    var newImage = null;

    var nm = {}; LANGS.forEach(function (l) { nm[l] = input(name[l]); });
    var cat = el("select");
    CATS.forEach(function (c) { var o = el("option", { value: c.id, text: c.name.en }); if (c.id === p.cat) o.selected = true; cat.appendChild(o); });
    var no = input(p.no);
    var series = el("select");
    [{ id: "", name: "No series" }].concat(window.GYM_SERIES || []).forEach(function (s) { var o = el("option", { value: s.id, text: s.name }); if ((p.series || "") === s.id) o.selected = true; series.appendChild(o); });
    var price = input(p.price, { placeholder: "e.g. 450,000 IQD (leave empty to hide)" });
    var video = input(p.video, { placeholder: "https://youtube.com/... or https://tiktok.com/... (optional)", type: "url" });
    var sizeW = input(p.sizeW, { type: "number", min: "1", max: "1000", placeholder: "e.g. 85 (empty = automatic)" });
    var sizeL = input(p.sizeL, { type: "number", min: "1", max: "1000", placeholder: "e.g. 195 (empty = automatic)" });
    var badge = el("select");
    [["", "None"], ["new", "New"], ["popular", "Popular"]].forEach(function (b) { var o = el("option", { value: b[0], text: b[1] }); if ((p.badge || "") === b[0]) o.selected = true; badge.appendChild(o); });
    var stock = el("select");
    [["", "Not shown"], ["in", "In stock"], ["out", "Out of stock"], ["order", "On request"]].forEach(function (b) { var o = el("option", { value: b[0], text: b[1] }); if ((p.stock || "") === b[0]) o.selected = true; stock.appendChild(o); });
    var order = input(p.order, { type: "number" });
    var hidden = el("input", { type: "checkbox" }); hidden.checked = !!p.hidden;
    var preview = el("img", { class: "preview", alt: "" });
    if (!isNew) preview.src = imgSrc(p);
    var file = el("input", { type: "file", accept: "image/*" });
    // version 20: star product (show page) + camera photo
    var starBefore = p.show === true || (p.show !== false && p.badge === "popular");
    var star = el("input", { type: "checkbox" }); star.checked = starBefore;
    var cam = cameraBox(p);
    file.addEventListener("change", function () {
      if (!file.files[0]) return;
      resizeImage(file.files[0]).then(function (data) { newImage = data; preview.src = data; cam.onNewPhoto(data); }).catch(fail);
    });

    var save = el("button", { class: "btn", text: isNew ? "Add product" : "Save changes" });
    save.addEventListener("click", function () {
      var names = { en: nm.en.value.trim(), ar: nm.ar.value.trim(), ckb: nm.ckb.value.trim() };
      if (!names.en) { toast("Please write the English name.", true); return; }
      if (!names.ar) names.ar = names.en;
      if (!names.ckb) names.ckb = names.en;
      if (isNew && !newImage) { toast("Please choose a photo.", true); return; }
      if (video.value.trim() && !/^https?:\/\//i.test(video.value.trim())) { toast("The video link must start with https://", true); return; }
      var sw = Number(sizeW.value), sl = Number(sizeL.value);
      if ((sizeW.value && !(sw > 0 && sw <= 1000)) || (sizeL.value && !(sl > 0 && sl <= 1000))) { toast("Size must be a number in cm (1 - 1000).", true); return; }
      if ((sizeW.value && !sizeL.value) || (!sizeW.value && sizeL.value)) { toast("Please fill both size boxes, or leave both empty.", true); return; }
      var ref = isNew ? db.collection("products").doc() : db.collection("products").doc(p.id);
      var doc = {
        cat: cat.value, name: names, no: no.value.trim(), price: price.value.trim(), video: video.value.trim(),
        sizeW: sizeW.value ? Math.round(sw) : 0, sizeL: sizeL.value ? Math.round(sl) : 0,
        badge: badge.value, stock: stock.value, series: cat.value === "gym-equipment" ? series.value : "", order: Number(order.value) || 0, hidden: hidden.checked,
        image: isNew ? "db-" + ref.id : p.image
      };
      if (newImage) doc.imageData = newImage;
      // star product: only write it when it is different from what the website does now
      var starAfter = p.show === true || (p.show !== false && badge.value === "popular");
      if (star.checked !== starAfter) doc.show = star.checked;
      var cs = cam.state;
      doc.cutOff = !!cs.off;
      if (cs.cut) doc.cut = cs.cut;
      else if (cs.removeCut || newImage) doc.cut = firebase.firestore.FieldValue.delete();
      save.disabled = true;
      var ready = newImage ? photoFingerprint(newImage).then(function (emb) {
        doc.emb = emb || firebase.firestore.FieldValue.delete();
      }) : Promise.resolve();
      if (newImage) toast("Saving… preparing the photo search for this product");
      ready.then(function () { return ref.set(doc, { merge: true }); }).then(function () {
        toast(isNew ? "Product added. It is on the website now." : "Saved. The website is updated.");
        box.hidden = true; box.textContent = "";
      }).catch(function (e) { save.disabled = false; fail(e); });
    });

    var del = isNew ? null : el("button", { class: "btn red", text: "Delete product", onclick: function () {
      if (!confirm("Delete \"" + name.en + "\" from the website?")) return;
      db.collection("products").doc(p.id).delete().then(function () { toast("Deleted."); box.hidden = true; }).catch(fail);
    } });
    var cancel = el("button", { class: "btn light", text: "Cancel", onclick: function () { box.hidden = true; box.textContent = ""; } });

    box.textContent = "";
    box.appendChild(el("div", { class: "card", style: "border-color:#18181b" }, [
      el("h3", { style: "margin-top:0", text: isNew ? "New product" : "Edit: " + name.en }),
      el("div", { class: "grid3" }, [field("Name (English)", nm.en), field("Name (Arabic)", nm.ar), field("Name (Kurdish)", nm.ckb)]),
      el("div", { class: "grid3" }, [field("Category", cat), field("Item number", no), field("Price (shown on website)", price)]),
      el("div", { class: "grid3" }, [field("Badge", badge), field("Stock label", stock), field("Order (small number = first)", order)]),
      el("div", { class: "grid2" }, [field("Gym series (only for Gym Equipment)", series), field("Video link (YouTube or TikTok) - leave empty for no video", video)]),
      el("div", { class: "grid2" }, [field("Room planner size: width in cm", sizeW), field("Room planner size: length in cm", sizeL)]),
      el("label", { style: "display:flex;gap:8px;align-items:center;color:inherit" }, [hidden, "Hide this product from the website"]),
      el("label", { style: "display:flex;gap:8px;align-items:center;color:inherit" }, [star, "Show page: this is a star product (big moving page + home page row)"]),
      el("h3", { text: "Camera photo (\"See it in your room\")" }),
      cam.node,
      el("div", { class: "row", style: "align-items:flex-end" }, [preview, field("Photo" + (isNew ? "" : " (choose only to change it)"), file)]),
      el("div", { class: "row", style: "margin-top:12px" }, [save, cancel, del])
    ]));
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- 3. shop info ---------- */
  function loadShop() {
    db.collection("content").doc("site").get().then(function (snap) {
      var S = Object.assign({}, window.SITE, snap.exists ? snap.data() : {});
      var social = S.social || [];
      function soc(n) { var s = social.filter(function (x) { return x.name === n; })[0]; return s ? s.url : ""; }
      var sched = S.schedule || {};
      var hours = multi(S.hours);
      var f = {
        phoneDisplay: input(S.phoneDisplay), phone: input(S.phone, { inputmode: "numeric" }),
        morePhones: input((S.morePhones || []).join(", ")), mapsLink: input(S.mapsLink),
        insta: input(soc("Instagram")), tiktok: input(soc("TikTok")),
        open: input(sched.open, { type: "time" }), close: input(sched.close, { type: "time" }),
        closedDays: el("select", { multiple: "", size: "7" }),
        hen: input(hours.en), har: input(hours.ar), hckb: input(hours.ckb),
        founded: input(S.foundedYear, { type: "number" }), rating: input(S.googleRating), reviews: input(S.googleReviews, { type: "number" })
      };
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].forEach(function (d, i) {
        var o = el("option", { value: i, text: d });
        if ((sched.closedDays || []).indexOf(i) >= 0) o.selected = true;
        f.closedDays.appendChild(o);
      });
      var form = $("shopForm");
      form.textContent = "";
      [
        el("h3", { text: "Phone & WhatsApp" }),
        el("div", { class: "grid2" }, [field("Phone as shown (e.g. +964 750 473 4400)", f.phoneDisplay), field("WhatsApp number, digits only (e.g. 9647504734400)", f.phone)]),
        field("Other phone numbers (separate with commas)", f.morePhones),
        el("h3", { text: "Location & social" }),
        field("Google Maps link", f.mapsLink),
        el("div", { class: "grid2" }, [field("Instagram link", f.insta), field("TikTok link", f.tiktok)]),
        el("h3", { text: "Opening hours" }),
        el("div", { class: "grid3" }, [field("Opens at", f.open), field("Closes at", f.close), field("Closed days (hold Ctrl to pick more)", f.closedDays)]),
        el("div", { class: "grid3" }, [field("Hours text (English)", f.hen), field("Hours text (Arabic)", f.har), field("Hours text (Kurdish)", f.hckb)]),
        el("h3", { text: "Trust bar" }),
        el("div", { class: "grid3" }, [field("Year you started", f.founded), field("Google rating (e.g. 4.9)", f.rating), field("Number of Google reviews", f.reviews)]),
        el("button", { class: "btn", type: "submit", text: "Save shop info" })
      ].forEach(function (n) { form.appendChild(n); });

      form.onsubmit = function (e) {
        e.preventDefault();
        var phone = f.phone.value.replace(/[^\d]/g, "");
        if (phone.length < 10) { toast("WhatsApp number looks wrong.", true); return; }
        var socialOut = [];
        if (f.insta.value.trim()) socialOut.push({ name: "Instagram", url: f.insta.value.trim() });
        if (f.tiktok.value.trim()) socialOut.push({ name: "TikTok", url: f.tiktok.value.trim() });
        var closed = Array.prototype.filter.call(f.closedDays.options, function (o) { return o.selected; }).map(function (o) { return Number(o.value); });
        db.collection("content").doc("site").set({
          phoneDisplay: f.phoneDisplay.value.trim(), phone: phone,
          morePhones: f.morePhones.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean),
          mapsLink: f.mapsLink.value.trim(), social: socialOut,
          schedule: { open: f.open.value || "09:00", close: f.close.value || "22:00", closedDays: closed },
          hours: { en: f.hen.value.trim(), ar: f.har.value.trim(), ckb: f.hckb.value.trim() },
          foundedYear: Number(f.founded.value) || window.SITE.foundedYear,
          googleRating: f.rating.value.trim(), googleReviews: Number(f.reviews.value) || 0
        }).then(function () { toast("Shop info saved. The website is updated."); }).catch(fail);
      };
    }).catch(fail);
  }

  /* ---------- 4. website texts ---------- */
  var SKIP_TEXT = { htmlLang: 1, dir: 1, switcherLabel: 1, noscript: 1, erbilTime: 1 };
  var textInputs = {};
  function loadTexts() {
    db.collection("content").doc("texts").get().then(function (snap) {
      var saved = snap.exists ? snap.data() : {};
      var box = $("textList");
      box.textContent = "";
      Object.keys(DEFAULT_I18N.en).forEach(function (key) {
        if (SKIP_TEXT[key] || typeof DEFAULT_I18N.en[key] !== "string") return;
        textInputs[key] = {};
        var grid = el("div", { class: "grid3" });
        LANGS.forEach(function (l) {
          var def = (DEFAULT_I18N[l] && DEFAULT_I18N[l][key]) || "";
          var i = input((saved[l] && saved[l][key]) || "", { placeholder: def.replace(/<br>/g, " / ").replace(/<[^>]+>/g, "") });
          if (l !== "en") i.dir = "rtl";
          textInputs[key][l] = i;
          grid.appendChild(field(el("span", { class: "lang-tag", text: LANG_NAME[l] }), i));
        });
        box.appendChild(el("div", { class: "text-item", "data-search": (key + " " + DEFAULT_I18N.en[key]).toLowerCase() }, [
          el("div", { style: "font-weight:600;margin:10px 0 4px", text: DEFAULT_I18N.en[key].replace(/<[^>]+>/g, " ") }),
          grid
        ]));
      });
    }).catch(fail);
  }
  $("textSearch").addEventListener("input", function () {
    var q = this.value.toLowerCase();
    document.querySelectorAll(".text-item").forEach(function (n) { n.hidden = q && n.getAttribute("data-search").indexOf(q) < 0; });
  });
  $("saveTexts").addEventListener("click", function () {
    var out = { en: {}, ar: {}, ckb: {} };
    Object.keys(textInputs).forEach(function (key) {
      LANGS.forEach(function (l) { var v = textInputs[key][l].value.trim(); if (v) out[l][key] = v; });
    });
    db.collection("content").doc("texts").set(out).then(function () { toast("Texts saved. The website is updated."); }).catch(fail);
  });

  /* ---------- 5. FAQ & payment methods ---------- */
  var faqItems = [], payItems = [];
  function loadFaqAndPay() {
    Promise.all([db.collection("content").doc("faq").get(), db.collection("content").doc("payments").get()]).then(function (r) {
      faqItems = (r[0].exists && r[0].data().items) || JSON.parse(JSON.stringify(window.FAQ_DATA || []));
      payItems = (r[1].exists && r[1].data().items) || JSON.parse(JSON.stringify(window.PAYMENT_METHODS || []));
      renderList($("faqList"), faqItems, "q", "a", "Question", "Answer");
      renderList($("payList"), payItems, "name", "note", "Name", "Note");
    }).catch(fail);
  }
  function renderList(box, items, k1, k2, l1, l2) {
    box.textContent = "";
    items.forEach(function (it, idx) {
      it[k1] = multi(it[k1]); it[k2] = multi(it[k2]);
      var parts = [];
      LANGS.forEach(function (l) {
        var a = input(it[k1][l]); a.oninput = function () { it[k1][l] = a.value; };
        var b = textarea(it[k2][l]); b.oninput = function () { it[k2][l] = b.value; };
        if (l !== "en") { a.dir = "rtl"; b.dir = "rtl"; }
        parts.push(el("div", null, [field(l1 + " (" + LANG_NAME[l] + ")", a), field(l2 + " (" + LANG_NAME[l] + ")", b)]));
      });
      box.appendChild(el("details", { class: "card", style: "padding:10px" }, [
        el("summary", { text: it[k1].en || "(new)" }),
        el("div", { class: "grid3" }, parts),
        el("button", { class: "btn light small", text: "Remove", onclick: function () {
          if (!confirm("Remove this?")) return;
          items.splice(idx, 1); renderList(box, items, k1, k2, l1, l2);
        } })
      ]));
    });
  }
  function newItem(k1, k2) { var o = { id: "i" + Date.now() }; o[k1] = { en: "", ar: "", ckb: "" }; o[k2] = { en: "", ar: "", ckb: "" }; return o; }
  $("addFaq").addEventListener("click", function () {
    faqItems.push(newItem("q", "a")); renderList($("faqList"), faqItems, "q", "a", "Question", "Answer");
    $("faqList").lastChild.open = true;
  });
  $("addPay").addEventListener("click", function () {
    payItems.push(newItem("name", "note")); renderList($("payList"), payItems, "name", "note", "Name", "Note");
    $("payList").lastChild.open = true;
  });
  function cleanList(items, k1) { return items.filter(function (it) { return it[k1] && it[k1].en && it[k1].en.trim(); }); }
  $("saveFaq").addEventListener("click", function () {
    db.collection("content").doc("faq").set({ items: cleanList(faqItems, "q") }).then(function () { toast("FAQ saved."); }).catch(fail);
  });
  $("savePay").addEventListener("click", function () {
    db.collection("content").doc("payments").set({ items: cleanList(payItems, "name") }).then(function () { toast("Payment methods saved."); }).catch(fail);
  });

  /* ---------- 6. offer banner & brands ---------- */
  var brandItems = [];
  function loadOfferAndBrands() {
    Promise.all([db.collection("content").doc("offer").get(), db.collection("content").doc("brands").get()]).then(function (r) {
      var o = r[0].exists ? r[0].data() : { on: false, text: {}, until: "" };
      var t = multi(o.text);
      var on = el("input", { type: "checkbox" }); on.checked = !!o.on;
      var te = {}; LANGS.forEach(function (l) { te[l] = input(t[l]); if (l !== "en") te[l].dir = "rtl"; });
      var until = input(o.until, { type: "date" });
      var form = $("offerForm");
      form.textContent = "";
      [
        el("label", { style: "display:flex;gap:8px;align-items:center;color:inherit;font-size:15px" }, [on, "Show the offer bar on the website"]),
        el("div", { class: "grid3" }, [field("Offer text (English)", te.en), field("Offer text (Arabic)", te.ar), field("Offer text (Kurdish)", te.ckb)]),
        el("div", { class: "grid3" }, [field("Last day of the offer (empty = no end)", until)]),
        el("button", { class: "btn", type: "submit", text: "Save offer" })
      ].forEach(function (n) { form.appendChild(n); });
      form.onsubmit = function (e) {
        e.preventDefault();
        var text = { en: te.en.value.trim(), ar: te.ar.value.trim(), ckb: te.ckb.value.trim() };
        if (on.checked && !text.en) { toast("Please write the offer in English.", true); return; }
        if (!text.ar) text.ar = text.en;
        if (!text.ckb) text.ckb = text.en;
        db.collection("content").doc("offer").set({ on: on.checked, text: text, until: until.value || "" })
          .then(function () { toast(on.checked ? "Offer is on the website now." : "Offer is turned off."); }).catch(fail);
      };

      brandItems = (r[1].exists && r[1].data().items) || JSON.parse(JSON.stringify(window.BRANDS || []));
      renderBrandsAdmin();
    }).catch(fail);
  }
  function renderBrandsAdmin() {
    var box = $("brandList");
    box.textContent = "";
    brandItems.forEach(function (b, idx) {
      var nm = input(b.name); nm.oninput = function () { b.name = nm.value; };
      var prev = el("img", { class: "preview", alt: "", style: "width:90px;height:60px;object-fit:contain;background:#fff" });
      if (b.logo) prev.src = b.logo; else prev.style.visibility = "hidden";
      var file = el("input", { type: "file", accept: "image/*" });
      file.addEventListener("change", function () {
        if (!file.files[0]) return;
        resizeImage(file.files[0], { max: 300, png: true }).then(function (d) { b.logo = d; prev.src = d; prev.style.visibility = "visible"; }).catch(fail);
      });
      box.appendChild(el("div", { class: "prow", style: "grid-template-columns:90px 1fr auto" }, [
        prev,
        el("div", { class: "grid2" }, [field("Brand name", nm), field("Logo (optional)", file)]),
        el("div", { style: "display:grid;gap:6px" }, [
          b.logo ? el("button", { class: "btn light small", text: "Remove logo", onclick: function () { delete b.logo; renderBrandsAdmin(); } }) : null,
          el("button", { class: "btn light small", text: "Remove", onclick: function () { brandItems.splice(idx, 1); renderBrandsAdmin(); } })
        ])
      ]));
    });
  }
  $("addBrand").addEventListener("click", function () { brandItems.push({ name: "" }); renderBrandsAdmin(); });
  $("saveBrands").addEventListener("click", function () {
    var items = brandItems.filter(function (b) { return (b.name && b.name.trim()) || b.logo; })
      .map(function (b) { var o = { name: (b.name || "").trim() }; if (b.logo) o.logo = b.logo; return o; });
    db.collection("content").doc("brands").set({ items: items }).then(function () { toast("Brands saved. The website is updated."); }).catch(fail);
  });

  /* ---------- version 20: camera photo (product without background) ---------- */
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Automatic cut: removes a plain background (white / grey wall) around the product.
  // ok = false when the background is not plain (then the owner uploads a PNG).
  function autoCut(src) {
    return loadImg(src).then(function (img) {
      var max = 600, w = img.naturalWidth, h = img.naturalHeight, sc = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d");
      x.drawImage(img, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h), px = d.data;
      var border = [];
      for (var i = 0; i < w; i++) { border.push(i, (h - 1) * w + i); }
      for (var j = 0; j < h; j++) { border.push(j * w, j * w + w - 1); }
      function med(ch) { var a = border.map(function (k) { return px[k * 4 + ch]; }).sort(function (u, v) { return u - v; }); return a[a.length >> 1]; }
      var br = med(0), bgc = med(1), bb = med(2);
      var TOL = 36 * 36, STEP = 22 * 22;
      function farBg(k) { var o = k * 4; if (px[o + 3] < 20) return 0; var a = px[o] - br, b = px[o + 1] - bgc, e = px[o + 2] - bb; return a * a + b * b + e * e; }
      function near(k, m) { var o = k * 4, q = m * 4; var a = px[o] - px[q], b = px[o + 1] - px[q + 1], e = px[o + 2] - px[q + 2]; return a * a + b * b + e * e; }
      var bg = new Uint8Array(w * h), queue = new Int32Array(w * h), qh = 0, qt = 0, borderBg = 0;
      border.forEach(function (k) { if (!bg[k] && farBg(k) < TOL) { bg[k] = 1; queue[qt++] = k; } });
      border.forEach(function (k) { if (bg[k]) borderBg++; });
      while (qh < qt) {
        var k = queue[qh++], kx = k % w, ky = (k - kx) / w;
        var nb = [kx > 0 ? k - 1 : -1, kx < w - 1 ? k + 1 : -1, ky > 0 ? k - w : -1, ky < h - 1 ? k + w : -1];
        for (var n = 0; n < 4; n++) {
          var m = nb[n];
          if (m < 0 || bg[m]) continue;
          if (farBg(m) < TOL && near(m, k) < STEP) { bg[m] = 1; queue[qt++] = m; }
        }
      }
      var removed = qt / (w * h);
      var ok = borderBg / border.length > 0.85 && removed > 0.12 && removed < 0.96;
      // soft edge: a product pixel next to the background is half see-through
      var minx = w, miny = h, maxx = 0, maxy = 0;
      for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
        var kk = y * w + xx, o = kk * 4;
        if (bg[kk]) { px[o + 3] = 0; continue; }
        var edge = (xx > 0 && bg[kk - 1]) || (xx < w - 1 && bg[kk + 1]) || (y > 0 && bg[kk - w]) || (y < h - 1 && bg[kk + w]);
        if (edge) px[o + 3] = Math.min(px[o + 3], 150);
        if (xx < minx) minx = xx; if (xx > maxx) maxx = xx; if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      x.putImageData(d, 0, 0);
      if (maxx <= minx || maxy <= miny) return { ok: false };
      var out = document.createElement("canvas");
      out.width = maxx - minx + 1; out.height = maxy - miny + 1;
      out.getContext("2d").drawImage(c, minx, miny, out.width, out.height, 0, 0, out.width, out.height);
      return { ok: ok, url: smallCut(out) };
    }).catch(function () { return { ok: false }; });
  }

  // a product with its photo AND camera photo must stay under the database limit (1 MB):
  // the camera photo is kept under 160 KB (WebP when the browser can make it, else PNG)
  var CUT_MAX = 160000;
  function smallCut(canvas) {
    var c = canvas, url = "";
    for (var tries = 0; tries < 8; tries++) {
      url = c.toDataURL("image/webp", 0.85);
      if (url.indexOf("data:image/webp") !== 0) url = c.toDataURL("image/png");
      if (url.length <= CUT_MAX) return url;
      var k = Math.max(0.5, Math.sqrt(CUT_MAX / url.length) * 0.95);
      var n = document.createElement("canvas");
      n.width = Math.max(1, Math.round(c.width * k)); n.height = Math.max(1, Math.round(c.height * k));
      n.getContext("2d").drawImage(c, 0, 0, n.width, n.height);
      c = n;
    }
    return url;
  }
  function limitCut(dataUrl) {
    return loadImg(dataUrl).then(function (img) {
      var c = document.createElement("canvas");
      var k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return smallCut(c);
    });
  }

  function cameraBox(p) {
    var st = { cut: null, off: !!p.cutOff, removeCut: false };
    var builtIn = !p.imageData && window.CUTOUTS && window.CUTOUTS[p.image] ? "assets/cut/" + window.CUTOUTS[p.image][0] : null;
    var current = p.cut || builtIn;
    var photo = p.imageData || (p.image && p.image.indexOf("db-") !== 0 ? "assets/" + p.image : null);
    var light = el("div", { class: "cam-prev checker" }), dark = el("div", { class: "cam-prev dark" });
    var info = el("p", { class: "muted", style: "margin:0;flex:1 1 220px" });
    var auto = el("button", { class: "btn light small", type: "button", text: "Make it automatically" });
    var upFile = el("input", { type: "file", accept: "image/png,image/webp", hidden: "" });
    var up = el("button", { class: "btn light small", type: "button", text: "Upload my own PNG (no background)" });
    var off = el("button", { class: "btn light small", type: "button" });
    function pic(box, src) {
      box.textContent = "";
      if (src) box.appendChild(el("img", { src: src, alt: "" }));
      else box.appendChild(el("span", { class: "muted", text: "none", style: dark === box ? "color:#a1a1aa" : "" }));
    }
    function refresh() {
      var src = st.cut || (st.removeCut ? null : current);
      pic(light, st.off ? null : src);
      pic(dark, st.off ? null : src);
      info.textContent = st.off ? "The camera button is OFF for this product."
        : !src ? "No camera photo yet, so the camera button does not show. Press \"Make it automatically\" or upload a PNG without background."
        : "Customers see this photo in their room. If it does not look clean, upload your own PNG without background.";
      off.textContent = st.off ? "Turn the camera button on" : "Turn the camera button off";
      auto.disabled = !photo;
    }
    auto.addEventListener("click", function () {
      if (!photo) return;
      auto.disabled = true;
      autoCut(photo).then(function (r) {
        if (r.ok) { st.cut = r.url; st.off = false; toast("Camera photo made. Check it, then save."); }
        else toast("The background is not plain. Please upload a PNG without background.", true);
        refresh();
      });
    });
    up.addEventListener("click", function () { upFile.click(); });
    upFile.addEventListener("change", function () {
      if (!upFile.files[0]) return;
      resizeImage(upFile.files[0], { max: 800, png: true }).then(limitCut).then(function (data) { st.cut = data; st.off = false; refresh(); }).catch(fail);
    });
    off.addEventListener("click", function () { st.off = !st.off; refresh(); });
    refresh();
    return {
      state: st,
      node: el("div", { class: "cam-box" }, [light, dark, info, el("div", { class: "row" }, [auto, up, off, upFile])]),
      onNewPhoto: function (data) {
        photo = data; current = null; st.cut = null; st.removeCut = true;
        refresh();
        autoCut(data).then(function (r) {
          if (r.ok) { st.cut = r.url; toast("New photo: camera photo made automatically. Check it."); }
          else toast("New photo: the background is not plain, so no camera photo. You can upload a PNG without background.", true);
          refresh();
        });
      }
    };
  }

  /* ---------- version 20: photo search fingerprint for new photos ---------- */
  var aiWorker = null, aiId = 1, aiWait = {};
  function photoFingerprint(src) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      setTimeout(function () { finish(null); }, 25000);
      try {
        if (!aiWorker) {
          aiWorker = new Worker("ai/worker.js");
          aiWorker.onmessage = function (e) { var w = aiWait[e.data.id]; if (w) { delete aiWait[e.data.id]; w(e.data); } };
          aiWorker.onerror = function () { Object.keys(aiWait).forEach(function (k) { aiWait[k]({ error: "worker" }); delete aiWait[k]; }); aiWorker = null; };
        }
      } catch (e) { finish(null); return; }
      loadImg(src).then(function (img) {
        var S = 224, c = document.createElement("canvas");
        c.width = c.height = S;
        var x = c.getContext("2d");
        x.imageSmoothingQuality = "high";
        x.fillStyle = "#fff"; x.fillRect(0, 0, S, S);
        var w = img.naturalWidth, h = img.naturalHeight, k = S / (Math.max(w, h) * 1.06);
        x.drawImage(img, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
        var buf = x.getImageData(0, 0, S, S).data.buffer;
        var id = aiId++;
        aiWait[id] = function (m) {
          if (m.error || !m.vecs) { finish(null); return; }
          var v = m.vecs[0], mx = 0, i;
          for (i = 0; i < v.length; i++) mx = Math.max(mx, Math.abs(v[i]));
          var q = new Int8Array(v.length);
          for (i = 0; i < v.length; i++) q[i] = Math.round(v[i] / (mx || 1) * 127);
          var u = new Uint8Array(q.buffer), bin = "";
          for (i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
          finish(btoa(bin));
        };
        aiWorker.postMessage({ id: id, cmd: "embed", images: [buf] }, [buf]);
      }).catch(function () { finish(null); });
    });
  }

  /* ---------- version 20: showroom tour (gold dots) ---------- */
  var tourStops = [], tourSel = 0, tourDot = -1, lastDrag = 0;
  function tourDefaults() {
    return window.TOUR.stops.map(function (s) {
      return { img: s.img, area: s.area, dots: JSON.parse(JSON.stringify(s.dots || [])), cap: { en: "", ar: "", ckb: "" }, hidden: false };
    });
  }
  function loadTour() {
    db.collection("content").doc("tour").get().then(function (snap) {
      tourStops = tourDefaults();
      var saved = snap.exists && Array.isArray(snap.data().stops) ? snap.data().stops : [];
      tourStops.forEach(function (s) {
        var e = saved.filter(function (x) { return x && x.img === s.img; })[0];
        if (!e) return;
        if (Array.isArray(e.dots)) s.dots = e.dots;
        if (e.cap) s.cap = multi(e.cap);
        s.hidden = !!e.hidden;
      });
      renderTour();
    }).catch(fail);
  }
  function tourTargetOptions(type) {
    if (type === "series") return (window.GYM_SERIES || []).map(function (x) { return [x.id, x.name]; });
    if (type === "p") return (products.length ? products : DEFAULT_PRODUCTS).map(function (x) { return [x.image, multi(x.name).en + (x.no ? " (" + x.no + ")" : "")]; });
    return CATS.map(function (c) { return [c.id, c.name.en]; });
  }
  function dotType(d) { return d.p ? "p" : d.series ? "series" : "cat"; }
  function renderTour() {
    var thumbs = $("tourThumbs");
    thumbs.textContent = "";
    tourStops.forEach(function (s, i) {
      var b = el("button", { class: "tour-thumb" + (i === tourSel ? " on" : "") + (s.hidden ? " hid" : ""), type: "button", title: "Photo " + (i + 1) }, [
        el("img", { src: "assets/tour/" + s.img + "-s.webp", alt: "" }), el("span", { text: String(i + 1) })
      ]);
      b.addEventListener("click", function () { tourSel = i; tourDot = -1; renderTour(); });
      thumbs.appendChild(b);
    });
    renderTourEditor();
  }
  function renderTourEditor() {
    var box = $("tourEditor");
    var s = tourStops[tourSel];
    if (!s) { box.textContent = ""; return; }
    box.textContent = "";
    var pic = el("div", { class: "tour-pic" }, [el("img", { src: "assets/tour/" + s.img + ".webp", alt: "Photo " + (tourSel + 1) })]);
    s.dots.forEach(function (d, i) {
      var dot = el("button", { class: "tdot" + (i === tourDot ? " on" : ""), type: "button", text: String(i + 1), style: "left:" + d.x + "%;top:" + d.y + "%" });
      var drag = null;
      dot.addEventListener("pointerdown", function (e) { e.stopPropagation(); drag = true; tourDot = i; try { dot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
      dot.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var r = pic.getBoundingClientRect();
        d.x = Math.round(Math.max(2, Math.min(98, (e.clientX - r.left) / r.width * 100)));
        d.y = Math.round(Math.max(2, Math.min(98, (e.clientY - r.top) / r.height * 100)));
        dot.style.left = d.x + "%"; dot.style.top = d.y + "%";
      });
      dot.addEventListener("pointerup", function () { drag = null; lastDrag = Date.now(); renderTourEditor(); });
      pic.appendChild(dot);
    });
    pic.addEventListener("click", function (e) {
      if (e.target.closest(".tdot") || Date.now() - lastDrag < 400) return;
      var r = pic.getBoundingClientRect();
      s.dots.push({ x: Math.round((e.clientX - r.left) / r.width * 100), y: Math.round((e.clientY - r.top) / r.height * 100), cat: CATS[0].id });
      tourDot = s.dots.length - 1;
      renderTourEditor();
    });
    var side = el("div");
    side.appendChild(el("h3", { style: "margin-top:0", text: "Photo " + (tourSel + 1) + " of " + tourStops.length }));
    if (!s.dots.length) side.appendChild(el("p", { class: "muted", text: "No gold dots yet. Tap on the photo to add one." }));
    s.dots.forEach(function (d, i) {
      var type = el("select");
      [["cat", "Category"], ["series", "Gym series"], ["p", "One product"]].forEach(function (o) {
        var opt = el("option", { value: o[0], text: o[1] }); if (dotType(d) === o[0]) opt.selected = true; type.appendChild(opt);
      });
      var val = el("select");
      var cur = d.p || d.series || d.cat;
      tourTargetOptions(dotType(d)).forEach(function (o) { var opt = el("option", { value: o[0], text: o[1] }); if (o[0] === cur) opt.selected = true; val.appendChild(opt); });
      type.addEventListener("change", function () {
        delete d.cat; delete d.series; delete d.p;
        var first = tourTargetOptions(type.value)[0];
        d[type.value] = first ? first[0] : "";
        renderTourEditor();
      });
      val.addEventListener("change", function () { delete d.cat; delete d.series; delete d.p; d[type.value] = val.value; });
      var del = el("button", { class: "btn light small", type: "button", text: "Delete" });
      del.addEventListener("click", function () { s.dots.splice(i, 1); tourDot = -1; renderTourEditor(); });
      side.appendChild(el("div", { class: "tdot-row" }, [el("b", { text: String(i + 1) }), type, val, del]));
    });
    side.appendChild(el("h3", { text: "Caption (optional)" }));
    LANGS.forEach(function (l) {
      var inp = input(s.cap[l], { placeholder: l === "en" ? "e.g. Our treadmills" : "" });
      if (l !== "en") inp.dir = "rtl";
      inp.addEventListener("input", function () { s.cap[l] = inp.value; });
      side.appendChild(field(LANG_NAME[l], inp));
    });
    var hid = el("input", { type: "checkbox" }); hid.checked = s.hidden;
    hid.addEventListener("change", function () { s.hidden = hid.checked; renderTour(); });
    side.appendChild(el("label", { style: "display:flex;gap:8px;align-items:center;color:inherit" }, [hid, "Hide this photo from the tour"]));
    box.appendChild(el("div", { class: "tour-edit" }, [pic, side]));
  }
  $("saveTour").addEventListener("click", function () {
    var out = tourStops.map(function (s) {
      return {
        img: s.img,
        dots: s.dots.filter(function (d) { return d.cat || d.series || d.p; }).map(function (d) {
          var o = { x: Math.round(d.x), y: Math.round(d.y) };
          if (d.p) o.p = d.p; else if (d.series) o.series = d.series; else o.cat = d.cat;
          return o;
        }),
        cap: { en: (s.cap.en || "").trim(), ar: (s.cap.ar || "").trim(), ckb: (s.cap.ckb || "").trim() },
        hidden: !!s.hidden
      };
    });
    if (out.every(function (s) { return s.hidden; })) { toast("Please keep at least one photo in the tour.", true); return; }
    db.collection("content").doc("tour").set({ stops: out }).then(function () { toast("Tour saved. The website is updated."); }).catch(fail);
  });
  $("resetTour").addEventListener("click", function () {
    if (!confirm("Use the original gold dots and remove your changes?")) return;
    db.collection("content").doc("tour").delete().then(function () { tourSel = 0; loadTour(); toast("Original tour is back."); }).catch(fail);
  });

  /* ---------- version 20: views number starts from the old numbers ---------- */
  function seedViews() {
    db.collection("content").doc("flags").get().then(function (snap) {
      if (snap.exists && (snap.data() || {}).viewsSeeded) return null;
      return Promise.all([db.collection("stats").get(), db.collection("views").get()]).then(function (r) {
        var totals = {}, have = {};
        r[0].forEach(function (d) {
          var v = (d.data() || {}).views || {};
          Object.keys(v).forEach(function (k) { totals[k] = (totals[k] || 0) + (Number(v[k]) || 0); });
        });
        r[1].forEach(function (d) { have[d.id] = Number((d.data() || {}).n) || 0; });
        var batch = db.batch(), count = 0;
        Object.keys(totals).forEach(function (k) {
          if (!/^[A-Za-z0-9_-]{1,120}$/.test(k) || count >= 450) return;
          if (totals[k] > (have[k] || 0)) { batch.set(db.collection("views").doc(k), { n: totals[k] }); count++; }
        });
        batch.set(db.collection("content").doc("flags"), { viewsSeeded: true });
        return batch.commit();
      });
    }).catch(function () { /* will try again next time */ });
  }

  /* ---------- 7. numbers (most viewed / most asked) ---------- */
  function keyOf(image) { return String(image || "").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9_-]+/gi, "-"); }
  function loadNumbers() {
    var days = $("numRange").value;
    var box = $("numBody");
    box.textContent = "Loading…";
    var q = db.collection("stats");
    q.get().then(function (snap) {
      var cutoff = days === "all" ? "" : new Date(Date.now() - (Number(days) - 1) * 86400000).toISOString().slice(0, 10);
      var views = {}, asks = {};
      snap.forEach(function (d) {
        if (cutoff && d.id < cutoff) return;
        var x = d.data() || {};
        Object.keys(x.views || {}).forEach(function (k) { views[k] = (views[k] || 0) + x.views[k]; });
        Object.keys(x.asks || {}).forEach(function (k) { asks[k] = (asks[k] || 0) + x.asks[k]; });
      });
      var names = {};
      (products.length ? products : DEFAULT_PRODUCTS).forEach(function (p) {
        names[keyOf(p.image)] = multi(p.name).en + (p.no ? " (" + p.no + ")" : "");
      });
      box.textContent = "";
      box.appendChild(el("div", { class: "grid2" }, [
        topList("Most viewed products (photo opened)", views, names),
        topList("Most price requests", asks, names)
      ]));
    }).catch(function (e) { box.textContent = "Could not load numbers: " + e.message; });
  }
  function topList(title, counts, names) {
    var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 15);
    var total = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0);
    var max = keys.length ? counts[keys[0]] : 1;
    var wrap = el("div", { class: "card", style: "margin:0" }, [
      el("h3", { style: "margin-top:0", text: title }),
      el("p", { class: "muted", style: "margin-top:0", text: "Total: " + total })
    ]);
    if (!keys.length) wrap.appendChild(el("p", { class: "muted", text: "No data yet. Numbers start counting after the new website is uploaded." }));
    keys.forEach(function (k, i) {
      wrap.appendChild(el("div", { style: "margin:8px 0" }, [
        el("div", { class: "row", style: "justify-content:space-between;font-size:14px" }, [
          el("span", { text: (i + 1) + ". " + (names[k] || k) }), el("b", { text: String(counts[k]) })
        ]),
        el("div", { style: "height:8px;border-radius:99px;background:#f1f1f1;overflow:hidden" }, [
          el("div", { style: "height:100%;background:#e0392b;width:" + Math.max(4, Math.round(counts[k] / max * 100)) + "%" })
        ])
      ]));
    });
    return wrap;
  }
  $("numRange").addEventListener("change", loadNumbers);
  $("numRefresh").addEventListener("click", loadNumbers);
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (b && b.getAttribute("data-tab") === "numbers") loadNumbers();
  });
})();
