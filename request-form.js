/* Marshal Fitness — customer request form + request numbers.
   Before WhatsApp opens, the customer types a name and phone number. The request
   is saved for the admin page with its own number (like MF-1042), then WhatsApp
   opens with the ready message. Used by every "Price on WhatsApp" button, the
   basket and the smart helper (window.MF_REQUEST.open). */
(function () {
  "use strict";
  var M = window.MF;
  var modal = document.getElementById("reqModal");
  if (!M || !modal) return;

  var KEY = "marshal-customer";
  var COPY = {
    en: { title: "Ask for the price", intro: "Leave your name and number so we can reply fast. WhatsApp opens next.",
          name: "Your name", phone: "Your phone number", send: "Continue to WhatsApp", skip: "Skip, just open WhatsApp",
          errName: "Please write your name.", errPhone: "Please write a correct phone number.", from: "Name" },
    ar: { title: "اسأل عن السعر", intro: "اكتب اسمك ورقمك لنرد عليك بسرعة. بعدها يُفتح واتساب.",
          name: "اسمك", phone: "رقم هاتفك", send: "متابعة إلى واتساب", skip: "تخطَّ وافتح واتساب مباشرة",
          errName: "يرجى كتابة اسمك.", errPhone: "يرجى كتابة رقم هاتف صحيح.", from: "الاسم" },
    ckb: { title: "پرسیاری نرخ بکە", intro: "ناو و ژمارەکەت بنووسە تا خێرا وەڵامت بدەینەوە. دواتر واتساپ دەکرێتەوە.",
          name: "ناوت", phone: "ژمارەی مۆبایلەکەت", send: "بەردەوام بە بۆ واتساپ", skip: "تێپەڕە و ڕاستەوخۆ واتساپ بکەرەوە",
          errName: "تکایە ناوت بنووسە.", errPhone: "تکایە ژمارەیەکی دروست بنووسە.", from: "ناو" }
  };

  var form = document.getElementById("reqForm");
  var nameIn = document.getElementById("reqName");
  var phoneIn = document.getElementById("reqPhone");
  var err = document.getElementById("reqErr");
  var pending = null;   // { message, item, image, items, kind, onSent }
  var reserved = null;  // { number } — filled in when the database answers

  function c() { return COPY[M.lang()] || COPY.en; }
  function setText(id, txt) { var n = document.getElementById(id); if (n) n.textContent = txt; }

  function applyTexts() {
    var d = c();
    var isBasket = pending && pending.kind === "basket";
    setText("reqTitle", isBasket ? M.t().basketSend : d.title);
    setText("reqIntro", d.intro);
    setText("reqNameLabel", d.name); setText("reqPhoneLabel", d.phone);
    setText("reqSendText", d.send); setText("reqSkip", d.skip);
  }
  applyTexts();
  M.onRender(applyTexts);
  var sendBtn = document.getElementById("reqSend");
  if (sendBtn && M.WA_ICON) sendBtn.insertAdjacentHTML("afterbegin", M.WA_ICON);

  function remembered() {
    try { return JSON.parse(window.localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function remember(n, p) {
    try { window.localStorage.setItem(KEY, JSON.stringify({ name: n, phone: p })); } catch (e) { /* ignore */ }
  }

  /* ---------- request numbers: MF-1001, MF-1002 ... ----------
     A counter in the database goes up by one for each request form that opens.
     If the database is slow or offline, a backup number is made from the clock. */
  function reserveNumber() {
    var holder = { number: null };
    reserved = holder;
    if (!window.MF_DB || !window.firebase || !window.MF_DB.runTransaction) return;
    var db = window.MF_DB;
    var ref = db.collection("meta").doc("counter");
    try {
      db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          var cur = snap.exists ? (snap.data() || {}).n : 0;
          var n = (typeof cur === "number" && cur >= 0 ? cur : 0) + 1;
          if (snap.exists) tx.update(ref, { n: n }); else tx.set(ref, { n: n });
          return n;
        });
      }).then(function (n) {
        holder.number = "MF-" + (1000 + n);
      }).catch(function () { /* backup number will be used */ });
    } catch (e) { /* backup number will be used */ }
  }

  // 6 digits, so it can never look like a counter number (MF-1001 … MF-99999)
  function backupNumber() {
    var x = Math.floor(Date.now() / 1000) % 1000000;
    return "MF-" + ("000000" + x).slice(-6);
  }

  // ٠١٢٣ (Arabic) and ۰۱۲۳ (Kurdish/Persian) digits -> 0123
  function latinDigits(text) {
    return String(text).replace(/[\u0660-\u0669]/g, function (ch) { return String(ch.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (ch) { return String(ch.charCodeAt(0) - 0x06F0); });
  }

  function messageFrom(href) {
    try { return new URL(href).searchParams.get("text") || ""; } catch (e) { return ""; }
  }

  function itemFrom(link) {
    var pid = link.getAttribute("data-product");
    var linked = pid && M.productByImage ? M.productByImage(pid) : null;
    if (linked) return M.tr(linked.name) + (linked.no ? " (" + linked.no + ")" : "");
    var card = link.closest(".product-card");
    if (card) {
      var h = card.querySelector("h3"), no = card.querySelector(".product-no");
      return (h ? h.textContent : "") + (no ? " (" + no.textContent + ")" : "");
    }
    if (link.id === "lbPrice") {
      var t = document.getElementById("lbTitle");
      return t ? t.textContent : "";
    }
    return "";
  }

  function isShopLink(a) {
    if (!a || !a.href) return false;
    return a.href.indexOf("https://wa.me/" + M.S.phone) === 0;
  }

  // If the form was opened from another window (basket, photo, helper, planner)
  // and the customer closes it without sending, that window comes back.
  var cameFrom = null;
  var finished = false;

  function rememberWindow() {
    var open = document.querySelector(".lightbox:not([hidden])");
    if (!open || open === modal) return null;
    if (open.id === "lightbox") {
      var p = M.productByImage(open.getAttribute("data-product") || "");
      var origin = M.lightboxOrigin ? M.lightboxOrigin() : null;
      return p ? function () { M.openLightbox(p, origin && document.contains(origin) ? origin : null); } : null;
    }
    if (open.id === "basketDrawer" && M.openBasket) return function () { M.openBasket(null); };
    return function () { M.openModal(open, null); };
  }

  function open(opts, opener) {
    cameFrom = rememberWindow();
    finished = false;
    pending = {
      message: opts.message || "",
      item: opts.item || "",
      image: opts.image || "",
      items: opts.items || null,
      extra: opts.extra || null,
      kind: opts.kind || "product",
      onSent: typeof opts.onSent === "function" ? opts.onSent : null
    };
    reserveNumber();
    applyTexts();
    var r = remembered();
    nameIn.value = r.name || "";
    phoneIn.value = r.phone || "";
    err.hidden = true;
    M.openModal(modal, opener || null, nameIn.value ? sendBtn : nameIn);
  }

  window.MF_REQUEST = { open: open };

  // every "Price on WhatsApp" button (cards, photo window, compare) goes through the form
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.price-btn");
    if (!a || !isShopLink(a) || modal.contains(a)) return;
    e.preventDefault();
    var holder = a.closest(".product-card") || (a.id === "lbPrice" ? document.getElementById("lightbox") : null);
    var image = a.getAttribute("data-product") || (holder ? (holder.getAttribute("data-product") || "") : "");
    open({ message: messageFrom(a.href), item: itemFrom(a), image: image, kind: "product" }, a);
  }, true);

  document.getElementById("reqClose").addEventListener("click", function () { M.closeModal(); });

  function countAsks() {
    if (!pending || !window.MF_TRACK) return;
    if (pending.items) {
      pending.items.forEach(function (it) { if (it.image) window.MF_TRACK("asks", { image: it.image }); });
    } else if (pending.image) {
      window.MF_TRACK("asks", { image: pending.image });
    }
  }

  function waLink(text) {
    return "https://wa.me/" + M.S.phone + "?text=" + encodeURIComponent(text);
  }

  document.getElementById("reqSkip").addEventListener("click", function () {
    if (!pending) { M.closeModal(); return; }
    countAsks();
    var url = waLink(pending.message);
    window.open(url, "_blank", "noopener");
    var done = pending;
    finished = true;
    M.closeModal();
    if (done.onSent) done.onSent(null, url);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!pending) return;
    var d = c();
    var n = nameIn.value.trim();
    var p = latinDigits(phoneIn.value.trim());
    var digits = p.replace(/[^0-9]/g, "");
    if (n.length < 2) { err.textContent = d.errName; err.hidden = false; nameIn.focus(); return; }
    if (digits.length < 7 || digits.length > 15) { err.textContent = d.errPhone; err.hidden = false; phoneIn.focus(); return; }
    remember(n, p);
    countAsks();

    var number = (reserved && reserved.number) || backupNumber();
    var msg = M.t().reqNoLabel + ": " + number + "\n\n" + pending.message + "\n\n" + d.from + ": " + n;
    var url = waLink(msg);
    window.open(url, "_blank", "noopener");

    if (window.MF_DB && window.firebase) {
      var doc = {
        name: n.slice(0, 80),
        phone: p.slice(0, 25),
        number: number,
        kind: pending.kind,
        item: (pending.item || "").slice(0, 300),
        message: (pending.message || "").slice(0, 3000),
        lang: M.lang(),
        status: "new",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // version 22: logged-in customers see their requests in "My Marshal"
      var user = window.MF_USER && window.MF_USER();
      var userDb = user && user.uid && window.MF_USER_DB ? window.MF_USER_DB() : null;
      if (userDb) { doc.uid = user.uid; if (user.email) doc.email = String(user.email).toLowerCase().slice(0, 120); }
      if (pending.extra && typeof pending.extra === "object") {
        Object.keys(pending.extra).forEach(function (k) {
          if (/^(photos|design|plan|tradein|room|gym)$/.test(k)) doc[k] = pending.extra[k];
        });
      }
      if (pending.items) {
        doc.items = pending.items.slice(0, 60).map(function (it) {
          return { name: String(it.name || "").slice(0, 120), no: String(it.no || "").slice(0, 40), qty: Number(it.qty) || 1 };
        });
      }
      try {
        // with the customer login (so it shows in "My Marshal"); if that fails, save it without the account
        var plain = function () {
          var d2 = {};
          Object.keys(doc).forEach(function (k) { if (k !== "uid" && k !== "email") d2[k] = doc[k]; });
          return window.MF_DB.collection("requests").add(d2);
        };
        var save = userDb && userDb !== window.MF_DB ? userDb.collection("requests").add(doc).catch(plain) : window.MF_DB.collection("requests").add(doc);
        save.catch(function () { /* WhatsApp already opened */ });
      }
      catch (e2) { /* WhatsApp already opened */ }
    }
    var done = pending;
    finished = true;
    M.closeModal();
    if (done.onSent) done.onSent(number, url);
  });

  modal.addEventListener("modal-close", function () {
    var back = finished ? null : cameFrom;
    cameFrom = null;
    setTimeout(function () {
      if (modal.hidden) pending = null;
      // closed without sending: go back to the window the customer came from
      if (back && !document.documentElement.classList.contains("lb-open")) back();
    }, 0);
  });
})();
