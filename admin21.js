/* Marshal Fitness — admin, version 21:
   1. Holiday looks (switch days on/off, offer text, move moon days by 1 day, preview)
   2. Post maker (Instagram post / WhatsApp Status picture of a product)
   3. Invoices in US dollars (saved in the "invoices" collection, PDF, WhatsApp)
   Uses helpers from admin.js (window.MF_ADMIN_API) and pdfmaker.js (window.MF_PDF). */
(function () {
  "use strict";
  var A = window.MF_ADMIN_API, P = window.MF_PDF;
  if (!A) return;
  var db = A.db, el = A.el, toast = A.toast, fail = A.fail, field = A.field, input = A.input;
  var LANGS = ["en", "ar", "ckb"], LANG_NAME = { en: "English", ar: "Arabic", ckb: "Kurdish" };
  function $(id) { return document.getElementById(id); }
  function I18(lang) { return (window.I18N && window.I18N[lang]) || window.I18N.en; }
  function nameOf(p, lang) { var n = p.name; return typeof n === "string" ? n : (n && (n[lang] || n.en)) || ""; }
  function S() { return window.SITE || {}; }
  window.MF_ADMIN_START = window.MF_ADMIN_START || [];

  // products: from the database (admin.js keeps them up to date), else the built-in list
  function allProducts() {
    var list = A.products();
    if (list && list.length) return list.filter(function (p) { return !p.hidden; });
    return (window.PRODUCTS || []).map(function (p, i) { var x = Object.assign({}, p); x.id = "b" + i; return x; });
  }
  function productImg(p) { return p.imageData || ("assets/" + p.image); }
  function cutImg(p) {
    if (p.cutOff) return null;
    if (p.cut) return p.cut;
    if (p.imageData) return null;
    var c = window.CUTOUTS && window.CUTOUTS[p.image];
    return c ? "assets/cut/" + c[0] : null;
  }

  /* =====================================================================
     1. HOLIDAY LOOKS
     ===================================================================== */
  var HD = window.MF_HOLIDAY_DATES;
  var hdState = { off: false, skip: {}, shift: 0, offer: {} };

  function nextDate(id) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var fmt = { day: "numeric", month: "short", year: "numeric" };
    if (HD.fixed[id]) {
      var f = HD.fixed[id], y = today.getFullYear();
      var end = new Date(y, f[0] - 1, f[2]);
      if (end < today) y += 1;
      var a = new Date(y, f[0] - 1, f[1]), b = new Date(y, f[0] - 1, f[2]);
      return a.toLocaleDateString("en-GB", fmt) + (f[1] !== f[2] ? " – " + b.toLocaleDateString("en-GB", fmt) : "");
    }
    var list = HD.moon[id] || [], shift = Number(hdState.shift) || 0;
    for (var i = 0; i < list.length; i++) {
      var s = new Date(list[i] + "T00:00:00");
      s.setDate(s.getDate() + shift);
      var len = id === "ramadan" ? 30 : (HD.length[id] || 1);
      var e = new Date(s); e.setDate(e.getDate() + len - 1);
      if (e >= today) {
        if (id === "ramadan") {
          var fi = (HD.moon.fitr || []).filter(function (x) { return x > list[i]; })[0];
          if (fi) { e = new Date(fi + "T00:00:00"); e.setDate(e.getDate() + shift - 1); }
        }
        return s.toLocaleDateString("en-GB", fmt) + (len > 1 ? " – " + e.toLocaleDateString("en-GB", fmt) : "") + " (about)";
      }
    }
    return "—";
  }

  function renderHolidays() {
    var box = $("hdBody");
    box.textContent = "";
    var offAll = el("input", { type: "checkbox" }); offAll.checked = !!hdState.off;
    offAll.addEventListener("change", function () { hdState.off = offAll.checked; });
    box.appendChild(el("label", { class: "check" }, [offAll, "Switch off ALL holiday looks"]));
    var shift = el("select");
    [["0", "Same as the calendar (Umm al-Qura)"], ["1", "Iraq starts 1 day LATER"], ["-1", "Iraq starts 1 day EARLIER"]].forEach(function (o) {
      var op = el("option", { value: o[0], text: o[1] }); if (String(hdState.shift || 0) === o[0]) op.selected = true; shift.appendChild(op);
    });
    shift.addEventListener("change", function () { hdState.shift = Number(shift.value); renderHolidays(); });
    box.appendChild(field("Moon days (Ramadan, both Eids, Prophet's Birthday)", shift));
    HD.order.forEach(function (id) {
      var on = el("input", { type: "checkbox" }); on.checked = !hdState.skip[id];
      on.addEventListener("change", function () { if (on.checked) delete hdState.skip[id]; else hdState.skip[id] = true; });
      var offer = hdState.offer[id] || {};
      var inputs = {};
      LANGS.forEach(function (l) {
        inputs[l] = input(offer[l] || "", { placeholder: "Offer text in " + LANG_NAME[l] + " (optional)", dir: l === "en" ? "ltr" : "rtl" });
        inputs[l].addEventListener("input", function () {
          hdState.offer[id] = hdState.offer[id] || {};
          hdState.offer[id][l] = inputs[l].value;
        });
      });
      var preview = el("a", { class: "btn light small", href: "index.html?holiday=" + id, target: "_blank", rel: "noopener", text: "Preview" });
      box.appendChild(el("div", { class: "hd-row" }, [
        el("div", { class: "row", style: "justify-content:space-between" }, [
          el("label", { class: "check", style: "margin:0" }, [on, el("b", { text: HD.names[id] })]),
          el("span", { class: "muted", text: nextDate(id) }),
          preview
        ]),
        el("div", { class: "grid3" }, [inputs.en, inputs.ar, inputs.ckb])
      ]));
    });
  }

  function loadHolidays() {
    db.collection("content").doc("holidays").get().then(function (snap) {
      var d = snap.exists ? snap.data() : {};
      hdState = { off: !!d.off, skip: d.skip || {}, shift: Number(d.shift) || 0, offer: d.offer || {} };
      renderHolidays();
    }).catch(function () { renderHolidays(); });
  }
  function saveHolidays() {
    var offer = {};
    Object.keys(hdState.offer).forEach(function (id) {
      var o = hdState.offer[id] || {}, keep = {};
      LANGS.forEach(function (l) { if (o[l] && o[l].trim()) keep[l] = o[l].trim(); });
      if (Object.keys(keep).length) offer[id] = keep;
    });
    db.collection("content").doc("holidays").set({ off: !!hdState.off, skip: hdState.skip, shift: Number(hdState.shift) || 0, offer: offer })
      .then(function () { toast("Holidays saved. The website is updated."); }).catch(fail);
  }

  /* =====================================================================
     2. POST MAKER (pictures for Instagram / WhatsApp Status)
     ===================================================================== */
  var POST_WORDS = {
    none: ["", "", ""],
    new: ["NEW", "جديد", "نوێ"],
    popular: ["POPULAR", "الأكثر طلباً", "بەناوبانگ"],
    offer: ["SPECIAL OFFER", "عرض خاص", "ئۆفەری تایبەت"],
    stock: ["AVAILABLE NOW", "متوفر الآن", "ئێستا بەردەستە"]
  };
  var STYLES = {
    dark: { bg: "#0b0b0c", bg2: "#1d1012", ink: "#ffffff", muted: "#b9b9bf", accent: "#d31822", onAccent: "#ffffff", card: "#ffffff" },
    gold: { bg: "#0a0a0a", bg2: "#2a2108", ink: "#ffffff", muted: "#cfc6a8", accent: "#f2b807", onAccent: "#111111", card: "#ffffff" },
    light: { bg: "#f5f5f2", bg2: "#ffffff", ink: "#111112", muted: "#55555b", accent: "#d31822", onAccent: "#ffffff", card: "#ffffff" }
  };
  var post = { id: null, size: "square", style: "dark", lang: "en", word: "none", custom: "", price: false };
  var postCanvas = null, drawing = 0;

  function buildPostUi() {
    var box = $("postBody");
    box.textContent = "";
    var prods = allProducts();
    if (!post.id && prods[0]) post.id = prods[0].id;
    var search = input("", { placeholder: "Search a product…", type: "search" });
    var sel = el("select", { size: "6" });
    function fillSel() {
      var q = search.value.trim().toLowerCase();
      sel.textContent = "";
      prods.forEach(function (p) {
        var label = nameOf(p, "en") + (p.no ? " · " + p.no : "");
        if (q && label.toLowerCase().indexOf(q) === -1) return;
        var o = el("option", { value: p.id, text: label });
        if (p.id === post.id) o.selected = true;
        sel.appendChild(o);
      });
    }
    fillSel();
    search.addEventListener("input", fillSel);
    sel.addEventListener("change", function () { post.id = sel.value; draw(); });
    function choice(key, opts) {
      var s = el("select");
      opts.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (post[key] === o[0]) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { post[key] = s.value; draw(); });
      return s;
    }
    var custom = input(post.custom, { placeholder: "Your own short line (optional), e.g. 10% off this week" });
    custom.addEventListener("input", function () { post.custom = custom.value; draw(); });
    var price = el("input", { type: "checkbox" }); price.checked = post.price;
    price.addEventListener("change", function () { post.price = price.checked; draw(); });
    postCanvas = el("canvas", { class: "post-canvas", width: "1080", height: "1080" });
    var dl = el("button", { class: "btn", text: "Download picture" });
    dl.addEventListener("click", function () { postBlob().then(function (b) { P.save(b, postName()); }); });
    var sh = el("button", { class: "btn green", text: "Share (WhatsApp / Instagram)" });
    sh.addEventListener("click", function () {
      postBlob().then(function (b) {
        if (P.canShareFile(b, postName())) P.share(b, postName(), "Marshal Fitness").catch(function () {});
        else { P.save(b, postName()); toast("This device cannot share files. The picture was downloaded."); }
      });
    });
    box.appendChild(el("div", { class: "post-grid" }, [
      el("div", null, [
        field("Product", search), sel,
        el("div", { class: "grid2", style: "margin-top:10px" }, [
          field("Size", choice("size", [["square", "Instagram post (square)"], ["story", "Story / WhatsApp Status (tall)"]])),
          field("Colors", choice("style", [["dark", "Black and red"], ["gold", "Black and gold"], ["light", "White and red"]]))
        ]),
        el("div", { class: "grid2" }, [
          field("Language", choice("lang", [["en", "English"], ["ar", "Arabic"], ["ckb", "Kurdish"]])),
          field("Label", choice("word", [["none", "No label"], ["new", "New"], ["popular", "Popular"], ["offer", "Special offer"], ["stock", "Available now"]]))
        ]),
        field("Extra line", custom),
        el("label", { class: "check" }, [price, "Show the price (only if the product has a price)"]),
        el("div", { class: "row", style: "margin-top:8px" }, [dl, sh])
      ]),
      el("div", { class: "post-prev" }, [postCanvas])
    ]));
    draw();
  }
  function postName() {
    var p = allProducts().filter(function (x) { return x.id === post.id; })[0];
    return "marshal-fitness-" + String(p ? nameOf(p, "en") : "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + post.size + ".png";
  }
  function postBlob() {
    return new Promise(function (resolve) { postCanvas.toBlob(function (b) { resolve(b); }, "image/png"); });
  }

  function draw() {
    if (!postCanvas) return;
    var my = ++drawing;
    var p = allProducts().filter(function (x) { return x.id === post.id; })[0];
    var W = 1080, H = post.size === "story" ? 1920 : 1080;
    postCanvas.width = W; postCanvas.height = H;
    var ctx = postCanvas.getContext("2d");
    var st = STYLES[post.style], lang = post.lang, R = lang !== "en", d = I18(lang);
    var cut = p ? cutImg(p) : null;
    Promise.all([P.fontsReady(), P.loadImg("assets/logo.png"), p ? P.loadImg(cut || productImg(p)) : Promise.resolve(null)]).then(function (r) {
      if (my !== drawing) return;
      var logo = r[1], img = r[2];
      // background with a soft glow
      ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
      var g = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W * 0.75);
      g.addColorStop(0, st.bg2); g.addColorStop(1, st.bg);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = st.accent; ctx.fillRect(0, 0, W, 12);
      // logo + name
      var top = post.size === "story" ? 120 : 56;
      if (logo) ctx.drawImage(logo, 60, top, 96, 96);
      ctx.save(); ctx.font = P.font(900, 52, false); var mw = ctx.measureText("MARSHAL").width; ctx.restore();
      P.text(ctx, "MARSHAL", { x: 176, y: top + 66, size: 52, weight: 900, color: st.ink, align: "left" });
      P.text(ctx, "FITNESS", { x: 176 + mw, y: top + 66, size: 52, weight: 900, color: st.accent, align: "left" });
      // label
      var word = post.word !== "none" ? POST_WORDS[post.word][LANGS.indexOf(lang)] : "";
      if (word) {
        ctx.save(); ctx.font = P.font(900, 40, R); var ww = ctx.measureText(word).width + 64; ctx.restore();
        P.roundRect(ctx, W - 60 - ww, top + 18, ww, 64, 32); ctx.fillStyle = st.accent; ctx.fill();
        P.text(ctx, word, { x: W - 60 - ww / 2, y: top + 64, size: 40, weight: 900, color: st.onAccent, rtl: R, align: "center" });
      }
      // product picture
      var pt = top + 150, ph = post.size === "story" ? 980 : 560;
      if (img) {
        if (cut) {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,.35)";
          ctx.beginPath(); ctx.ellipse(W / 2, pt + ph - 20, 360, 40, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          P.contain(ctx, img, 90, pt, W - 180, ph - 30);
        } else {
          ctx.save();
          P.roundRect(ctx, 90, pt, W - 180, ph, 40); ctx.fillStyle = st.card; ctx.fill(); ctx.clip();
          P.contain(ctx, img, 130, pt + 30, W - 260, ph - 60);
          ctx.restore();
        }
      }
      // name, series, number, price
      var y = pt + ph + (post.size === "story" ? 110 : 84);
      var name = p ? nameOf(p, lang) : "";
      var series = p && p.series ? A.seriesName(p.series) : "";
      if (series) { P.text(ctx, series, { x: W / 2, y: y - 50, size: 34, weight: 800, color: st.accent, align: "center" }); }
      var hName = P.text(ctx, name, { x: W / 2, y: y, size: 62, weight: 900, color: st.ink, rtl: R, align: "center", maxWidth: W - 160, lines: 2, lh: 72 });
      y += hName;
      if (p && p.no) { P.text(ctx, (series ? "Code " : (d.itemNo || "No.") + " ") + p.no, { x: W / 2, y: y + 4, size: 30, weight: 600, color: st.muted, rtl: R && !series, align: "center" }); y += 46; }
      if (post.custom.trim()) { P.text(ctx, post.custom.trim(), { x: W / 2, y: y + 16, size: 40, weight: 800, color: st.accent, rtl: R, align: "center", maxWidth: W - 160, lines: 2, lh: 50 }); y += 60; }
      if (post.price && p && p.price) { P.text(ctx, String(p.price), { x: W / 2, y: y + 30, size: 48, weight: 900, color: st.ink, align: "center" }); }
      // bottom bar: WhatsApp
      var bh = post.size === "story" ? 230 : 150;
      ctx.fillStyle = st.accent; ctx.fillRect(0, H - bh, W, bh);
      var ask = d.priceBtn || "Price on WhatsApp";
      var waNum = S().phoneDisplay || "";
      P.text(ctx, ask, { x: W / 2, y: H - bh + (post.size === "story" ? 92 : 62), size: 40, weight: 900, color: st.onAccent, rtl: R, align: "center" });
      P.text(ctx, "WhatsApp " + waNum, { x: W / 2, y: H - bh + (post.size === "story" ? 156 : 116), size: 40, weight: 800, color: st.onAccent, align: "center" });
      var site = String(S().siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (post.size === "story") P.text(ctx, site, { x: W / 2, y: H - 34, size: 28, weight: 700, color: st.onAccent, align: "center" });
    });
  }

  /* =====================================================================
     3. INVOICES (US dollars)
     ===================================================================== */
  var INV = {
    invoice: ["INVOICE", "فاتورة", "پسوولە"],
    no: ["Invoice no.", "رقم الفاتورة", "ژمارەی پسوولە"],
    date: ["Date", "التاريخ", "بەروار"],
    billTo: ["Customer", "الزبون", "کڕیار"],
    phone: ["Phone", "الهاتف", "تەلەفۆن"],
    address: ["Address", "العنوان", "ناونیشان"],
    item: ["Item", "المنتج", "کاڵا"],
    qty: ["Qty", "الكمية", "ژمارە"],
    price: ["Unit price", "سعر الوحدة", "نرخی دانە"],
    total: ["Total", "المجموع", "کۆ"],
    subtotal: ["Subtotal", "المجموع الفرعي", "کۆی سەرەتایی"],
    discount: ["Discount", "الخصم", "داشکاندن"],
    delivery: ["Delivery", "التوصيل", "گەیاندن"],
    grand: ["Total to pay", "الإجمالي", "کۆی گشتی"],
    paid: ["Paid", "المدفوع", "دراوە"],
    left: ["Remaining", "المتبقي", "ماوە"],
    notes: ["Notes", "ملاحظات", "تێبینی"],
    warranty: ["Warranty", "الضمان", "گەرەنتی"],
    thanks: ["Thank you for choosing Marshal Fitness.", "شكراً لاختياركم مارشال فتنس.", "سوپاس بۆ هەڵبژاردنی مارشاڵ فیتنس."]
  };
  function T(key, lang) { return INV[key][LANGS.indexOf(lang)] || INV[key][0]; }
  function money(v) {
    var n = Math.round((Number(v) || 0) * 100) / 100;
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function num(v) { var n = parseFloat(String(v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; }
  function totals(inv) {
    var sub = 0;
    (inv.items || []).forEach(function (it) { sub += num(it.qty) * num(it.price); });
    var grand = Math.max(0, sub - num(inv.discount) + num(inv.delivery));
    return { sub: sub, grand: grand, left: Math.max(0, grand - num(inv.paid)) };
  }
  function todayIso() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }

  var invoices = [], invLoaded = false, current = null;
  function loadInvoices() {
    db.collection("invoices").orderBy("createdAt", "desc").limit(500).get().then(function (snap) {
      invoices = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      invLoaded = true;
      renderInvoiceList();
    }).catch(function (e) {
      $("invList").textContent = "";
      $("invList").appendChild(el("p", { class: "err", text: "Could not load invoices. Please paste the new Firebase rules (firestore-rules.txt) once. (" + (e && e.message ? e.message : "") + ")" }));
    });
  }
  function nextNumber() {
    var y = new Date().getFullYear(), max = 0;
    invoices.forEach(function (i) {
      var m = /^INV-(\d{4})-(\d+)$/.exec(i.no || "");
      if (m && Number(m[1]) === y) max = Math.max(max, Number(m[2]));
    });
    return "INV-" + y + "-" + String(max + 1).padStart(4, "0");
  }
  function renderInvoiceList() {
    var box = $("invList"), q = $("invSearch").value.trim().toLowerCase();
    box.textContent = "";
    var list = invoices.filter(function (i) { return !q || [i.no, i.name, i.phone].join(" ").toLowerCase().indexOf(q) !== -1; });
    if (!list.length) { box.appendChild(el("p", { class: "muted", text: invLoaded ? "No invoices yet." : "Loading…" })); return; }
    list.forEach(function (i) {
      var tt = totals(i);
      box.appendChild(el("div", { class: "prow inv-row" }, [
        el("span", { class: "req-no", text: i.no || "—" }),
        el("div", null, [
          el("div", { style: "font-weight:600", text: (i.name || "(no name)") + " · " + money(tt.grand) }),
          el("div", { class: "muted", text: (i.date || "") + (tt.left > 0 ? " · remaining " + money(tt.left) : " · paid") })
        ]),
        el("button", { class: "btn light small", text: "Open", onclick: function () { openInvoice(i); } })
      ]));
    });
  }

  function openInvoice(inv) {
    current = JSON.parse(JSON.stringify(inv));
    if (!current.items || !current.items.length) current.items = [{ desc: "", qty: 1, price: "" }];
    renderInvoiceEditor();
    $("invEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function newInvoice(pre) {
    var lang = "en";
    openInvoice(Object.assign({
      no: nextNumber(), date: todayIso(), lang: lang, name: "", phone: "", address: "",
      items: [{ desc: "", qty: 1, price: "" }], discount: "", delivery: "", paid: "", notes: "",
      warranty: (I18(lang).warranty || "")
    }, pre || {}));
  }
  // from a customer request (admin.js: "Make invoice")
  window.MF_ADMIN_INVOICE = function (r) {
    var tab = document.querySelector('#tabs button[data-tab="invoices"]');
    if (tab) tab.click();
    var items = [];
    if (Array.isArray(r.items) && r.items.length) items = r.items.map(function (it) { return { desc: (it.name || "") + (it.no ? " (" + it.no + ")" : ""), qty: it.qty || 1, price: "" }; });
    else if (r.item) items = [{ desc: r.item, qty: 1, price: "" }];
    var go = function () { newInvoice({ name: r.name || "", phone: r.phone || "", email: r.email || "", items: items.length ? items : undefined, fromRequest: r.number || "" }); };
    if (invLoaded) go(); else setTimeout(go, 600);
  };

  function renderInvoiceEditor() {
    var box = $("invEditor"), inv = current;
    box.hidden = false;
    box.textContent = "";
    function bind(key, attrs, isNum) {
      var i = input(inv[key], attrs || {});
      i.addEventListener("input", function () { inv[key] = i.value; if (isNum) showTotals(); });
      return i;
    }
    var lang = el("select");
    LANGS.forEach(function (l) { var o = el("option", { value: l, text: LANG_NAME[l] }); if (inv.lang === l) o.selected = true; lang.appendChild(o); });
    lang.addEventListener("change", function () {
      var oldW = I18(inv.lang).warranty || "";
      inv.lang = lang.value;
      if (!inv.warranty || inv.warranty === oldW) { inv.warranty = I18(inv.lang).warranty || ""; warranty.value = inv.warranty; }
    });
    var notes = el("textarea"); notes.value = inv.notes || ""; notes.addEventListener("input", function () { inv.notes = notes.value; });
    var warrantySel = el("select");
    [["", "No date"], ["1", "1 year"], ["2", "2 years"], ["3", "3 years"], ["5", "5 years"]].forEach(function (o) {
      var op = el("option", { value: o[0], text: o[1] }); if (String(inv.warrantyYears || "") === o[0]) op.selected = true; warrantySel.appendChild(op);
    });
    warrantySel.addEventListener("change", function () { inv.warrantyYears = warrantySel.value; });
    var warranty = el("textarea"); warranty.value = inv.warranty || ""; warranty.addEventListener("input", function () { inv.warranty = warranty.value; });

    // items
    var itemsBox = el("div", { class: "inv-items" });
    var prods = allProducts();
    function drawItems() {
      itemsBox.textContent = "";
      itemsBox.appendChild(el("div", { class: "inv-item inv-head" }, [el("span", { text: "Product (choose or write)" }), el("span", { text: "Qty" }), el("span", { text: "Price $" }), el("span", { text: "Total" }), el("span")]));
      inv.items.forEach(function (it, idx) {
        var pick = el("select");
        pick.appendChild(el("option", { value: "", text: "— write your own —" }));
        prods.forEach(function (p) { pick.appendChild(el("option", { value: p.id, text: nameOf(p, "en") + (p.no ? " · " + p.no : "") })); });
        pick.addEventListener("change", function () {
          var p = prods.filter(function (x) { return x.id === pick.value; })[0];
          if (p) { it.desc = nameOf(p, inv.lang) + (p.no ? " (" + p.no + ")" : ""); desc.value = it.desc; }
        });
        var desc = input(it.desc, { placeholder: "Item name" });
        desc.addEventListener("input", function () { it.desc = desc.value; });
        var qty = input(it.qty, { type: "number", min: "0", step: "1", inputmode: "numeric" });
        var price = input(it.price, { type: "number", min: "0", step: "0.01", inputmode: "decimal", placeholder: "0" });
        var line = el("b", { text: money(num(it.qty) * num(it.price)) });
        qty.addEventListener("input", function () { it.qty = qty.value; line.textContent = money(num(it.qty) * num(it.price)); showTotals(); });
        price.addEventListener("input", function () { it.price = price.value; line.textContent = money(num(it.qty) * num(it.price)); showTotals(); });
        var del = el("button", { class: "btn light small", text: "×", title: "Remove", onclick: function () { inv.items.splice(idx, 1); if (!inv.items.length) inv.items.push({ desc: "", qty: 1, price: "" }); drawItems(); showTotals(); } });
        itemsBox.appendChild(el("div", { class: "inv-item" }, [el("div", null, [pick, desc]), qty, price, line, del]));
      });
      itemsBox.appendChild(el("button", { class: "btn light small", text: "+ Add item", onclick: function () { inv.items.push({ desc: "", qty: 1, price: "" }); drawItems(); } }));
    }
    drawItems();
    var tbox = el("div", { class: "inv-totals" });
    function showTotals() {
      var tt = totals(inv);
      tbox.textContent = "";
      [["Subtotal", tt.sub], ["Total to pay", tt.grand], ["Remaining", tt.left]].forEach(function (r, k) {
        tbox.appendChild(el("div", { class: k === 1 ? "inv-grand" : "" }, [el("span", { text: r[0] }), el("b", { text: money(r[1]) })]));
      });
    }
    showTotals();

    var save = el("button", { class: "btn", text: inv.id ? "Save changes" : "Save invoice" });
    save.addEventListener("click", function () { saveInvoice().then(function () { toast("Invoice saved."); }).catch(fail); });
    var pdf = el("button", { class: "btn green", text: "PDF" });
    pdf.addEventListener("click", function () {
      pdf.disabled = true;
      invoicePdf(inv).then(function (blob) { P.save(blob, inv.no + ".pdf"); }).catch(fail).then(function () { pdf.disabled = false; });
    });
    var share = el("button", { class: "btn green", text: "Send PDF (WhatsApp…)" });
    share.addEventListener("click", function () {
      share.disabled = true;
      invoicePdf(inv).then(function (blob) {
        var name = inv.no + ".pdf";
        if (P.canShareFile(blob, name)) return P.share(blob, name, "Marshal Fitness " + inv.no).catch(function () {});
        P.save(blob, name);
        var wa = A.waNumber(inv.phone);
        var msg = "Hello " + (inv.name || "") + ", this is Marshal Fitness. Your invoice " + inv.no + ": " + money(totals(inv).grand) + ".";
        window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
        toast("PDF downloaded. Attach it in the WhatsApp chat.");
      }).catch(fail).then(function () { share.disabled = false; });
    });
    var del = inv.id ? el("button", { class: "btn red", text: "Delete", onclick: function () {
      if (!confirm("Delete invoice " + inv.no + "?")) return;
      db.collection("invoices").doc(inv.id).delete().then(function () {
        invoices = invoices.filter(function (x) { return x.id !== inv.id; });
        box.hidden = true; box.textContent = ""; renderInvoiceList(); toast("Deleted.");
      }).catch(fail);
    } }) : null;
    var closeB = el("button", { class: "btn light", text: "Close", onclick: function () { box.hidden = true; box.textContent = ""; } });

    box.appendChild(el("div", { class: "card", style: "border-color:#18181b" }, [
      el("h3", { style: "margin-top:0", text: (inv.id ? "Invoice " : "New invoice ") + inv.no }),
      el("div", { class: "grid3" }, [field("Invoice number", bind("no")), field("Date", bind("date", { type: "date" })), field("Language of the invoice", lang)]),
      el("div", { class: "grid3" }, [field("Customer name", bind("name")), field("Phone", bind("phone", { type: "tel", dir: "ltr" })), field("Address (optional)", bind("address"))]),
      el("div", { class: "grid3" }, [field("Customer email (shows the invoice in \"My Marshal\")", bind("email", { type: "email", dir: "ltr", placeholder: "name@gmail.com" })), field("Warranty (years)", warrantySel), el("span")]),
      el("h3", { text: "Items (US dollars)" }),
      itemsBox,
      el("div", { class: "grid3", style: "margin-top:10px" }, [field("Discount $", bind("discount", { type: "number", min: "0", step: "0.01" }, true)), field("Delivery $", bind("delivery", { type: "number", min: "0", step: "0.01" }, true)), field("Paid $", bind("paid", { type: "number", min: "0", step: "0.01" }, true))]),
      tbox,
      el("div", { class: "grid2" }, [field("Notes (optional)", notes), field("Warranty note", warranty)]),
      el("div", { class: "row", style: "margin-top:12px" }, [save, pdf, share, del, closeB])
    ]));
  }

  function saveInvoice() {
    var inv = current;
    if (!inv.no || !inv.no.trim()) return Promise.reject(new Error("Please write the invoice number."));
    var doc = {
      no: inv.no.trim(), date: inv.date || todayIso(), lang: inv.lang || "en", name: (inv.name || "").trim(), phone: (inv.phone || "").trim(),
      address: (inv.address || "").trim(),
      items: inv.items.filter(function (it) { return (it.desc || "").trim() || num(it.price); }).map(function (it) { return { desc: (it.desc || "").trim(), qty: num(it.qty) || 1, price: num(it.price) }; }),
      discount: num(inv.discount), delivery: num(inv.delivery), paid: num(inv.paid),
      notes: inv.notes || "", warranty: inv.warranty || "", total: totals(inv).grand,
      email: String(inv.email || "").trim().toLowerCase().slice(0, 120), warrantyYears: Number(inv.warrantyYears) || 0,
      fromRequest: inv.fromRequest || "", updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    var ref = inv.id ? db.collection("invoices").doc(inv.id) : db.collection("invoices").doc();
    if (!inv.id) doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return ref.set(doc, { merge: true }).then(function () {
      inv.id = ref.id;
      var copy = JSON.parse(JSON.stringify(doc)); copy.id = ref.id;
      invoices = [copy].concat(invoices.filter(function (x) { return x.id !== ref.id; }));
      renderInvoiceList();
    });
  }

  // A4 page with the invoice -> PDF (invoicepdf.js, shared with "My Marshal")
  function invoicePdf(inv) { return window.MF_INVOICE.pdf(inv); }


  /* ---------- tabs + start ---------- */
  var postBuilt = false;
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (!b) return;
    var tab = b.getAttribute("data-tab");
    if (tab === "posts" && !postBuilt) { postBuilt = true; buildPostUi(); }
    if (tab === "invoices" && !invLoaded) loadInvoices();
  });
  function start21() {
    loadHolidays();
    $("saveHd").addEventListener("click", saveHolidays);
    $("newInvoice").addEventListener("click", function () { newInvoice(); });
    $("invSearch").addEventListener("input", renderInvoiceList);
  }
  // run now if the admin is already logged in, otherwise when the login is done
  if (window.MF_ADMIN_STARTED) start21(); else window.MF_ADMIN_START.push(start21);
})();
