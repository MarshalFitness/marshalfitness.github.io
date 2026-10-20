/* Marshal Fitness admin — version 22.
   - Requests: photos (trade-in, machine design), gym plan details, the customer's account email.
   - "Rooms & tools" tab: edit the ready gym rooms (content/rooms) and the calculator numbers (content/money).
   - "Customers" tab: people with a "My Marshal" account (users collection). */
(function () {
  "use strict";
  var A = window.MF_ADMIN_API;
  if (!A) return;
  var db = A.db, el = A.el, toast = A.toast, fail = A.fail;
  function $(id) { return document.getElementById(id); }
  function nameEn(p) { var n = p && p.name; return typeof n === "string" ? n : (n && (n.en || n.ar || n.ckb)) || ""; }
  function allProducts() {
    var list = A.products();
    if (list && list.length) return list.filter(function (p) { return !p.hidden; });
    return (window.PRODUCTS || []).map(function (p, i) { var x = Object.assign({}, p); x.id = "b" + i; return x; });
  }
  function byImage(img) { return allProducts().filter(function (p) { return p.image === img; })[0]; }
  var LANG_NAME = { en: "English", ar: "Arabic", ckb: "Kurdish" };

  /* =====================================================================
     1. REQUESTS: extra details
     ===================================================================== */
  var GYM_TYPES = { full: "Full gym", women: "Women's gym", hotel: "Hotel / compound gym", strength: "Bodybuilding gym" };
  var TI = { treadmill: "Treadmill", bike: "Exercise bike", elliptical: "Elliptical / cross trainer", machine: "Gym machine", weights: "Weights / bench", other: "Other" };
  var AGES = { "0-1": "Less than 1 year", "1-3": "1–3 years", "3-5": "3–5 years", "5+": "More than 5 years" };
  var CONDS = { good: "Works perfectly", small: "Works, small problems", repair: "Needs repair" };
  window.MF_ADMIN_REQ_EXTRA = function (r) {
    var parts = [];
    if (r.email) parts.push(el("div", { class: "muted" }, ["My Marshal account: ", el("b", { text: r.email })]));
    if (r.gym && typeof r.gym === "object") {
      var g = r.gym;
      var line = el("div", { class: "row" }, [
        g.logo ? el("img", { src: g.logo, alt: "", style: "width:44px;height:44px;object-fit:contain;background:#f4f4f5;border-radius:8px" }) : null,
        el("span", { text: "Gym: " + (g.name || "(no name)") + " · " + (GYM_TYPES[g.type] || g.type || "") + " · " + g.W + " × " + g.L + " m (" + Math.round(g.W * g.L) + " m²)" })
      ]);
      parts.push(line);
    }
    if (r.room && typeof r.room === "object") parts.push(el("div", { class: "muted", text: "Ready room: " + (r.item || r.room.id) + " · " + r.room.W + " × " + r.room.L + " m" }));
    if (r.tradein && typeof r.tradein === "object") {
      var ti = r.tradein;
      parts.push(el("div", { class: "msg" }, [
        "Old machine: " + (TI[ti.type] || ti.type) + (ti.brand ? " · " + ti.brand : "") + " · " + (AGES[ti.age] || ti.age) + " · " + (CONDS[ti.cond] || ti.cond) +
        (ti.want ? "\nWants instead: " + ti.want : "") + (ti.notes ? "\nNotes: " + ti.notes : "")
      ]));
    }
    if (r.design && typeof r.design === "object") {
      var dz = r.design, p = byImage(dz.product);
      parts.push(el("div", { class: "muted", text: "Design: " + (p ? nameEn(p) + (p.no ? " (" + p.no + ")" : "") : dz.product) + " · frame " + dz.frame + " · pads " + dz.pads + (dz.logo ? " · with logo" : "") }));
    }
    if (Array.isArray(r.photos) && r.photos.length) {
      var strip = el("div", { class: "req-photos" });
      r.photos.forEach(function (src, i) {
        if (typeof src !== "string" || src.indexOf("data:image/") !== 0) return;
        var im = el("img", { src: src, alt: "Photo " + (i + 1), tabindex: "0", role: "button", title: "Tap to make bigger" });
        var big = function () { im.classList.toggle("big"); };
        im.addEventListener("click", big);
        im.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); big(); } });
        strip.appendChild(im);
        var dl = el("a", { href: src, download: (r.number || "photo") + "-" + (i + 1) + ".jpg", class: "btn light small", text: "Save photo " + (i + 1) });
        strip.appendChild(dl);
      });
      parts.push(strip);
    }
    return parts.length ? el("div", { class: "req-extra" }, parts) : null;
  };

  /* =====================================================================
     2. ROOMS & CALCULATOR
     ===================================================================== */
  var rooms = null; // editable copy
  function builtIn() {
    var b = window.ROOMS_BUILT_IN || [];
    return JSON.parse(JSON.stringify(b)).map(function (r) {
      r.items = (r.items || []).map(function (x) { return Array.isArray(x) ? { id: x[0], qty: x[1] } : x; });
      return r;
    });
  }
  function loadRooms() {
    db.collection("content").doc("rooms").get().then(function (snap) {
      var d = snap && snap.exists ? snap.data() : null;
      rooms = d && Array.isArray(d.list) && d.list.length ? d.list : builtIn();
      drawRooms();
    }).catch(function () { rooms = builtIn(); drawRooms(); });
  }
  function drawRooms() {
    var box = $("roomsBody");
    if (!box) return;
    box.textContent = "";
    rooms.forEach(function (r, ri) {
      r.name = r.name || { en: "", ar: "", ckb: "" };
      r.note = r.note || { en: "", ar: "", ckb: "" };
      var card = el("div", { class: "hd-row room-ed" });
      var head = el("div", { class: "row", style: "justify-content:space-between" }, [
        el("b", { text: (ri + 1) + ". " + (r.name.en || "(new room)") + (r.hidden ? " (hidden)" : "") }),
        el("div", { class: "row" }, [
          el("button", { class: "btn light small", text: "↑", title: "Move up", onclick: function () { if (ri > 0) { rooms.splice(ri - 1, 0, rooms.splice(ri, 1)[0]); drawRooms(); } } }),
          el("button", { class: "btn light small", text: "↓", title: "Move down", onclick: function () { if (ri < rooms.length - 1) { rooms.splice(ri + 1, 0, rooms.splice(ri, 1)[0]); drawRooms(); } } }),
          el("button", { class: "btn light small", text: r.hidden ? "Show" : "Hide", onclick: function () { r.hidden = !r.hidden; drawRooms(); } }),
          el("button", { class: "btn red small", text: "Delete", onclick: function () { if (confirm("Delete this room?")) { rooms.splice(ri, 1); drawRooms(); } } })
        ])
      ]);
      card.appendChild(head);
      var names = el("div", { class: "grid3" });
      ["en", "ar", "ckb"].forEach(function (l) {
        var i = A.input(r.name[l] || "", { placeholder: "Name in " + LANG_NAME[l], dir: l === "en" ? "ltr" : "rtl" });
        i.addEventListener("input", function () { r.name[l] = i.value; });
        names.appendChild(i);
      });
      card.appendChild(names);
      var notes = el("div", { class: "grid3" });
      ["en", "ar", "ckb"].forEach(function (l) {
        var i = A.input(r.note[l] || "", { placeholder: "Short text in " + LANG_NAME[l], dir: l === "en" ? "ltr" : "rtl" });
        i.addEventListener("input", function () { r.note[l] = i.value; });
        notes.appendChild(i);
      });
      card.appendChild(notes);
      var wIn = A.input(r.W, { type: "number", min: "2", max: "30", step: "0.5" });
      var lIn = A.input(r.L, { type: "number", min: "2", max: "30", step: "0.5" });
      wIn.addEventListener("input", function () { r.W = Number(wIn.value) || r.W; });
      lIn.addEventListener("input", function () { r.L = Number(lIn.value) || r.L; });
      card.appendChild(el("div", { class: "grid3" }, [A.field("Width (m)", wIn), A.field("Length (m)", lIn), el("span")]));
      // products
      var list = el("div", { class: "room-items" });
      (r.items || []).forEach(function (it, ii) {
        var p = byImage(it.id);
        var q = A.input(it.qty, { type: "number", min: "1", max: "50", style: "width:70px" });
        q.addEventListener("input", function () { it.qty = Math.max(1, Number(q.value) || 1); });
        list.appendChild(el("div", { class: "row" }, [
          p ? el("img", { src: A.imgSrc(p), alt: "", style: "width:36px;height:36px;object-fit:cover;border-radius:6px" }) : null,
          el("span", { style: "flex:1;min-width:140px", text: p ? nameEn(p) + (p.no ? " · " + p.no : "") : it.id + " (not on the website now)" }),
          q,
          el("button", { class: "btn light small", text: "×", title: "Remove", onclick: function () { r.items.splice(ii, 1); drawRooms(); } })
        ]));
      });
      card.appendChild(list);
      var pick = el("select");
      pick.appendChild(el("option", { value: "", text: "+ Add a product…" }));
      allProducts().forEach(function (p) { pick.appendChild(el("option", { value: p.image, text: nameEn(p) + (p.no ? " · " + p.no : "") })); });
      pick.addEventListener("change", function () {
        if (!pick.value) return;
        r.items = r.items || [];
        var ex = r.items.filter(function (x) { return x.id === pick.value; })[0];
        if (ex) ex.qty += 1; else r.items.push({ id: pick.value, qty: 1 });
        drawRooms();
      });
      card.appendChild(pick);
      box.appendChild(card);
    });
  }
  function saveRooms() {
    var list = rooms.map(function (r, i) {
      return {
        id: String(r.id || ("room" + Date.now().toString(36) + i)).slice(0, 40),
        W: Math.max(2, Math.min(30, Number(r.W) || 4)), L: Math.max(2, Math.min(30, Number(r.L) || 4)),
        name: { en: (r.name.en || "").trim(), ar: (r.name.ar || "").trim(), ckb: (r.name.ckb || "").trim() },
        note: { en: (r.note.en || "").trim(), ar: (r.note.ar || "").trim(), ckb: (r.note.ckb || "").trim() },
        hidden: !!r.hidden,
        items: (r.items || []).filter(function (x) { return x.id && x.qty > 0; }).map(function (x) { return { id: x.id, qty: Math.round(x.qty) }; })
      };
    }).filter(function (r) { return r.name.en && r.items.length; });
    db.collection("content").doc("rooms").set({ list: list }).then(function () { toast("Rooms saved. The website is updated."); rooms = list; drawRooms(); }).catch(fail);
  }
  // calculator numbers
  function loadMoney() {
    db.collection("content").doc("money").get().then(function (snap) {
      var d = snap && snap.exists ? snap.data() : {};
      $("moneyRate").value = d.rate || "";
      $("moneyMember").value = d.member || "";
    }).catch(function () { /* empty fields */ });
  }
  function saveMoney() {
    var rate = Number($("moneyRate").value), member = Number($("moneyMember").value);
    var doc = {};
    if (rate > 0) doc.rate = Math.round(rate);
    if (member > 0) doc.member = Math.round(member);
    db.collection("content").doc("money").set(doc).then(function () { toast("Saved. The calculator uses these numbers now."); }).catch(fail);
  }

  /* =====================================================================
     3. CUSTOMERS (My Marshal accounts)
     ===================================================================== */
  var customers = null;
  function loadCustomers() {
    $("custList").textContent = "Loading…";
    db.collection("users").get().then(function (snap) {
      customers = snap.docs.map(function (d) { var x = d.data() || {}; x.id = d.id; return x; });
      customers.sort(function (a, b) { return tm(b.lastLogin) - tm(a.lastLogin); });
      drawCustomers();
    }).catch(function (e) {
      $("custList").textContent = "";
      $("custList").appendChild(el("p", { class: "err", text: "Could not load customers. Please paste the new Firebase rules (firestore-rules.txt) once. (" + (e && e.message ? e.message : "") + ")" }));
    });
  }
  function tm(v) { return !v ? 0 : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : v.__time || 0; }
  function drawCustomers() {
    var box = $("custList");
    var q = $("custSearch").value.trim().toLowerCase();
    box.textContent = "";
    var list = (customers || []).filter(function (c) { return !q || [c.name, c.email, c.phone].join(" ").toLowerCase().indexOf(q) !== -1; });
    $("custCount").textContent = (customers || []).length + " accounts";
    if (!list.length) { box.appendChild(el("p", { class: "muted", text: customers && customers.length ? "No match." : "No accounts yet." })); return; }
    list.forEach(function (c) {
      var last = tm(c.lastLogin) ? new Date(tm(c.lastLogin)).toLocaleString() : "";
      box.appendChild(el("div", { class: "prow cust" }, [
        el("span", { class: "cust-av", text: String(c.name || c.email || "?").trim().charAt(0).toUpperCase() }),
        el("div", null, [
          el("div", { style: "font-weight:600", text: (c.name || "(no name)") + (c.phone ? " · " + c.phone : "") }),
          el("div", { class: "muted", text: (c.email || "") + (last ? " · last visit " + last : "") + (Array.isArray(c.saved) && c.saved.length ? " · " + c.saved.length + " saved" : "") })
        ]),
        el("div", { class: "row" }, [
          c.phone ? el("a", { class: "btn green small", href: "https://wa.me/" + A.waNumber(c.phone), target: "_blank", rel: "noopener", text: "WhatsApp" }) : null,
          c.email ? el("button", { class: "btn light small", text: "New invoice", onclick: function () {
            if (window.MF_ADMIN_INVOICE) window.MF_ADMIN_INVOICE({ name: c.name || "", phone: c.phone || "", email: c.email || "" });
          } }) : null
        ])
      ]));
    });
  }

  /* ---------- tabs + start ---------- */
  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (!b) return;
    var tab = b.getAttribute("data-tab");
    if (tab === "rooms" && !rooms) { loadRooms(); loadMoney(); }
    if (tab === "customers") loadCustomers();
  });
  function start22() {
    $("saveRooms").addEventListener("click", saveRooms);
    $("addRoom").addEventListener("click", function () {
      rooms = rooms || [];
      rooms.push({ id: "room" + Date.now().toString(36), W: 4, L: 4, name: { en: "", ar: "", ckb: "" }, note: { en: "", ar: "", ckb: "" }, items: [] });
      drawRooms();
    });
    $("resetRooms").addEventListener("click", function () { if (confirm("Use the built-in rooms again? (Press Save after.)")) { rooms = builtIn(); drawRooms(); } });
    $("saveMoney").addEventListener("click", saveMoney);
    $("custSearch").addEventListener("input", drawCustomers);
  }
  if (window.MF_ADMIN_STARTED) start22(); else (window.MF_ADMIN_START = window.MF_ADMIN_START || []).push(start22);
})();
