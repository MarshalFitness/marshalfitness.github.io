/* Marshal Fitness — version 22: "My Marshal" customer account.
   Free log in with a Google account or an email link (no password).
   Logged-in customers see their requests, their invoices (with PDF and warranty date)
   and their saved products on every phone.
   The Firebase log-in program loads only when it is needed (tap on the account
   button, or when this phone was logged in before), so the site stays fast.
   Database: users/{uid} = { name, phone, saved, email, lang, lastLogin };
   requests and invoices are read with the safety rules in firestore-rules.txt.
   The customer login is SEPARATE from the admin login: it uses its own Firebase app
   ("mf-customer"), so logging in here never logs in on admin.html, and the other way round.
   The shop admin account cannot be used as a customer account. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.makeWindow) return;
  var el = M.el;
  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  var AUTH_SRC = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
  var FLAG = "mf-acct", EMAIL_KEY = "mf-login-email", CUSTOMER = "marshal-customer";
  var user = null, profile = {}, auth = null, authPromise = null, busy = false;
  var reqs = null, invs = null, loadErr = null;
  var pendingLink = null; // an email link opened on a phone that does not know the email yet

  window.MF_USER = function () { return user ? { uid: user.uid, email: user.email || "", name: user.displayName || profile.name || "" } : null; };
  // the database as this customer (the price form saves the request with it)
  window.MF_USER_DB = function () { return user ? db() : null; };
  var APP_NAME = "mf-customer", cdb = null;
  function db() { return window.MF_DB ? (cdb || window.MF_DB) : null; }
  // our own Firebase app for customers: its login is kept apart from the admin login
  function customerApp() {
    var app = null;
    try { app = firebase.app(APP_NAME); } catch (e) {
      try { app = firebase.initializeApp(window.FIREBASE_CONFIG, APP_NAME); } catch (e2) { app = null; }
    }
    return app && app.auth && app.firestore ? app : null;
  }
  function store(k, v) { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function read(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- the log-in program ---------- */
  function loadAuth() {
    if (authPromise) return authPromise;
    authPromise = new Promise(function (resolve, reject) {
      if (!window.firebase || !db()) { reject(new Error("offline")); return; }
      var ready = function () {
        try {
          var app = customerApp();
          if (app) { auth = app.auth(); cdb = app.firestore(); }
          else { auth = firebase.auth(); cdb = null; }
          resolve(auth);
        } catch (e) { reject(e); }
      };
      if (firebase.auth) { ready(); return; }
      var s = document.createElement("script");
      s.src = AUTH_SRC;
      s.async = true;
      s.onload = ready;
      s.onerror = function () { reject(new Error("load")); };
      document.head.appendChild(s);
    });
    authPromise.then(function (a) { a.onAuthStateChanged(onUser); }, function () { authPromise = null; });
    return authPromise;
  }

  /* ---------- the shop admin is not a customer ---------- */
  // Only the admin may list all requests (database rules). A customer gets "no permission".
  var OK_KEY = "mf-acct-ok", checking = null, welcome = false;
  function isCustomer(u) {
    if (read(OK_KEY) === u.uid) return Promise.resolve(true);
    var d = db();
    if (!d) return Promise.resolve(true);
    return d.collection("requests").limit(1).get().then(function () { return false; }, function (e) {
      if (/permission/i.test(String((e && e.code) || "") + " " + String((e && e.message) || ""))) store(OK_KEY, u.uid);
      return true; // no internet: let the customer in
    });
  }
  function onUser(u) {
    var nu = u && !u.isAnonymous ? u : null;
    if (!nu) { checking = null; setUser(null); return; }
    checking = nu;
    isCustomer(nu).then(function (ok) {
      if (checking !== nu) return;
      checking = null;
      if (!ok) {
        welcome = false;
        store(FLAG, null);
        note = t().acAdminOnly;
        if (w.modal.hidden) M.toast(note);
        auth.signOut().catch(function () {}).then(function () { if (!w.modal.hidden) draw(); });
        return;
      }
      setUser(nu);
      if (welcome) { welcome = false; M.toast("\u2713 " + t().acWelcome); }
    });
  }
  function setUser(u) {
    user = u;
    reqs = invs = loadErr = null;
    if (user) {
      store(FLAG, "1");
      syncProfile();
    } else {
      store(FLAG, null);
      profile = {};
    }
    drawButton();
    if (!w.modal.hidden) draw();
  }

  /* ---------- profile + saved products ---------- */
  function userRef() { return db().collection("users").doc(user.uid); }
  function syncProfile() {
    var u = user;
    userRef().get().then(function (snap) {
      if (user !== u) return;
      profile = (snap && snap.exists ? snap.data() : {}) || {};
      if (Array.isArray(profile.saved) && M.mergeSaved) M.mergeSaved(profile.saved);
      var local = {};
      try { local = JSON.parse(read(CUSTOMER) || "{}") || {}; } catch (e) { local = {}; }
      var doc = { email: String(u.email || "").toLowerCase().slice(0, 120), lang: M.lang(), lastLogin: firebase.firestore.FieldValue.serverTimestamp() };
      if (!profile.name && (local.name || u.displayName)) doc.name = String(local.name || u.displayName).slice(0, 80);
      if (!profile.phone && local.phone) doc.phone = String(local.phone).slice(0, 30);
      if (M.savedItems) doc.saved = M.savedItems().slice(0, 60);
      Object.keys(doc).forEach(function (k) { if (k !== "lastLogin") profile[k] = doc[k]; });
      rememberCustomer();
      return userRef().set(doc, { merge: true });
    }).catch(function () { /* the account still works without the profile */ })
      .then(function () { if (!w.modal.hidden) draw(); });
  }
  // the price form remembers the name and phone of the account
  function rememberCustomer() {
    if (!profile.name && !profile.phone) return;
    var local = {};
    try { local = JSON.parse(read(CUSTOMER) || "{}") || {}; } catch (e) { local = {}; }
    if (profile.name) local.name = profile.name;
    if (profile.phone) local.phone = profile.phone;
    store(CUSTOMER, JSON.stringify(local));
  }
  var savedTimer = null;
  if (M.onSavedChange) M.onSavedChange(function (list) {
    if (!user || !db()) return;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { userRef().set({ saved: list.slice(0, 60) }, { merge: true }).catch(function () {}); }, 800);
  });

  /* ---------- requests + invoices ---------- */
  function ms(v) {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (v.seconds) return v.seconds * 1000;
    if (v.__time) return v.__time;
    return 0;
  }
  function loadLists() {
    if (!user || !db()) return;
    var u = user;
    var r1 = db().collection("requests").where("uid", "==", u.uid).get().then(function (snap) {
      var out = [];
      snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; out.push(x); });
      out.sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
      return out;
    });
    var email = String(u.email || "").toLowerCase();
    var r2 = u.emailVerified && email ? db().collection("invoices").where("email", "==", email).get().then(function (snap) {
      var out = [];
      snap.forEach(function (d) { var x = d.data() || {}; x.id = d.id; out.push(x); });
      out.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || ms(b.createdAt) - ms(a.createdAt); });
      return out;
    }) : Promise.resolve([]);
    Promise.all([r1, r2]).then(function (r) {
      if (user !== u) return;
      reqs = r[0]; invs = r[1];
      if (!w.modal.hidden) draw();
    }).catch(function (e) {
      if (user !== u) return;
      loadErr = e;
      reqs = reqs || []; invs = invs || [];
      if (!w.modal.hidden) draw();
    });
  }

  /* ---------- top bar button ---------- */
  var btn = document.getElementById("accountBtn");
  function drawButton() {
    if (!btn) return;
    var d = t();
    btn.setAttribute("aria-label", user ? d.acButtonIn(user.displayName || profile.name || user.email || "") : d.acButton);
    btn.classList.toggle("is-in", !!user);
    var dot = btn.querySelector(".acct-initial");
    var name = (user && (user.displayName || profile.name || user.email)) || "";
    if (dot) { dot.textContent = name ? name.trim().charAt(0).toUpperCase() : ""; dot.hidden = !user; }
    var ic = btn.querySelector("svg");
    if (ic) ic.style.display = user ? "none" : "";
    var bar = document.getElementById("barAccount");
    if (bar) {
      var dotEl = bar.querySelector(".acct-dot");
      if (dotEl) dotEl.hidden = !user;
      bar.setAttribute("aria-label", btn.getAttribute("aria-label"));
    }
  }
  if (btn) btn.addEventListener("click", function () { M.openAccount(btn); });

  /* ---------- the window ---------- */
  var w = M.makeWindow("accountModal", "ac-panel");
  var note = null;

  function kindName(k) { var d = t(); return (d.acKinds && d.acKinds[k]) || d.acKinds.product; }
  function dateText(v) {
    var m = ms(v);
    if (!m) return "";
    var dt = new Date(m);
    return dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2);
  }

  // the window is drawn again when something changes (log in, lists loaded):
  // the control that had the focus gets it back (data-k = its name)
  function draw() {
    var act = document.activeElement;
    var key = act && w.body.contains(act) ? act.getAttribute("data-k") : null;
    var had = !!(act && w.body.contains(act));
    drawNow();
    if (!had) return;
    var back = (key && w.body.querySelector('[data-k="' + key + '"]')) || w.body.querySelector("[data-k]");
    if (back) back.focus({ preventScroll: true });
  }
  function drawNow() {
    var d = t();
    w.title.textContent = d.acTitle;
    w.body.textContent = "";
    if (note) { var n = el("p", "ac-note", note); n.setAttribute("role", "status"); w.body.appendChild(n); }
    if (!user) { drawLogin(); return; }
    // who
    var who = el("div", "ac-who");
    var av = el("span", "ac-avatar");
    if (user.photoURL) { var im = el("img"); im.src = user.photoURL; im.alt = ""; im.referrerPolicy = "no-referrer"; av.appendChild(im); }
    else av.textContent = (user.displayName || profile.name || user.email || "?").trim().charAt(0).toUpperCase();
    who.appendChild(av);
    var info = el("div", "ac-who-info");
    info.appendChild(el("b", "", user.displayName || profile.name || d.acHello));
    info.appendChild(el("span", "ac-email", user.email || ""));
    who.appendChild(info);
    var out = el("button", "btn btn-outline btn-small ac-logout", d.acLogout);
    out.type = "button";
    out.setAttribute("data-k", "logout");
    out.addEventListener("click", function () { note = null; auth.signOut().then(function () { M.toast(d.acLoggedOut); }); });
    who.appendChild(out);
    w.body.appendChild(who);

    // profile
    var pf = el("details", "ac-box ac-profile");
    if (!profile.name || !profile.phone) pf.open = true;
    pf.appendChild(el("summary", "", d.acProfile));
    var grid = el("div", "gp-form");
    var nm = el("input", "in22"); nm.type = "text"; nm.maxLength = 80; nm.value = profile.name || user.displayName || ""; nm.autocomplete = "name";
    var ph = el("input", "in22"); ph.type = "tel"; ph.maxLength = 30; ph.value = profile.phone || ""; ph.autocomplete = "tel"; ph.dir = "ltr";
    grid.appendChild(M.field(d.acName, nm));
    grid.appendChild(M.field(d.acPhone, ph, d.acPhoneHint));
    pf.appendChild(grid);
    var saveP = el("button", "btn btn-small ac-save", d.acSave);
    saveP.type = "button";
    saveP.setAttribute("data-k", "save");
    nm.setAttribute("data-k", "name");
    ph.setAttribute("data-k", "phone");
    saveP.addEventListener("click", function () {
      var data = { name: nm.value.trim().slice(0, 80), phone: ph.value.trim().slice(0, 30) };
      userRef().set(data, { merge: true }).then(function () {
        profile.name = data.name; profile.phone = data.phone;
        rememberCustomer();
        M.toast("✓ " + d.acSaved);
      }).catch(function () { M.toast(d.acError); });
    });
    pf.appendChild(saveP);
    w.body.appendChild(pf);

    // invoices
    var ib = el("section", "ac-box");
    ib.appendChild(el("h3", "ac-h", d.acInvoices));
    if (invs === null) ib.appendChild(el("p", "f22-hint", d.acLoading));
    else if (!invs.length) ib.appendChild(el("p", "f22-hint", d.acNoInvoices(user.email || "")));
    else invs.forEach(function (inv) { ib.appendChild(invoiceRow(inv)); });
    w.body.appendChild(ib);

    // requests
    var rb = el("section", "ac-box");
    rb.appendChild(el("h3", "ac-h", d.acRequests));
    if (reqs === null) rb.appendChild(el("p", "f22-hint", d.acLoading));
    else if (!reqs.length) rb.appendChild(el("p", "f22-hint", d.acNoRequests));
    else reqs.slice(0, 30).forEach(function (r) {
      var row = el("div", "ac-row");
      var left = el("div", "ac-row-main");
      left.appendChild(el("b", "", (r.number || "") + " · " + kindName(r.kind)));
      var what = r.item || (Array.isArray(r.items) ? r.items.map(function (x) { return x.name + " × " + x.qty; }).join(", ") : "");
      if (what) left.appendChild(el("span", "ac-row-sub", what));
      left.appendChild(el("span", "ac-row-sub", dateText(r.createdAt)));
      row.appendChild(left);
      row.appendChild(el("span", "ac-badge" + (r.status === "done" ? " is-done" : ""), r.status === "done" ? d.acDone : d.acSent));
      rb.appendChild(row);
    });
    w.body.appendChild(rb);
    if (loadErr) w.body.appendChild(el("p", "err22", d.acListError));

    // saved
    var saved = (M.savedItems ? M.savedItems() : []).map(M.productByImage).filter(Boolean);
    var sb = el("section", "ac-box");
    sb.appendChild(el("h3", "ac-h", d.acSavedTitle(saved.length)));
    if (!saved.length) sb.appendChild(el("p", "f22-hint", d.acNoSaved));
    else {
      var strip = el("div", "ac-saved");
      saved.slice(0, 12).forEach(function (p) {
        var b = el("button", "ac-saved-item");
        b.type = "button";
        var im2 = el("img"); im2.src = M.imgSrc(p); im2.alt = ""; im2.loading = "lazy";
        b.appendChild(im2);
        b.appendChild(el("span", "", tr(p.name)));
        b.addEventListener("click", function () { M.openLightbox(p, b); });
        strip.appendChild(b);
      });
      sb.appendChild(strip);
    }
    w.body.appendChild(sb);

    // delete
    var del = el("details", "ac-box ac-delete");
    del.appendChild(el("summary", "", d.acDeleteTitle));
    del.appendChild(el("p", "f22-hint", d.acDeleteText));
    var delBtn = el("button", "btn btn-outline btn-small ac-del", d.acDeleteBtn);
    delBtn.type = "button";
    delBtn.addEventListener("click", function () {
      if (!window.confirm(d.acDeleteConfirm)) return;
      var u = user;
      // the shop admin login is shared with this page: never delete it here.
      // Only the admin may list all requests (database rules), so that tells us.
      db().collection("requests").limit(1).get().then(function () { return true; }, function () { return false; }).then(function (isAdmin) {
        if (isAdmin) { M.toast(d.acDeleteAdmin); return; }
        return userRef().delete().catch(function () {}).then(function () { return u.delete(); }).then(function () {
          note = d.acDeleted; draw();
        });
      }).catch(function (e) {
        M.toast(e && e.code === "auth/requires-recent-login" ? d.acDeleteRelogin : d.acError);
      });
    });
    del.appendChild(delBtn);
    w.body.appendChild(del);
    if (reqs === null) loadLists();
  }

  function invoiceRow(inv) {
    var d = t(), I = window.MF_INVOICE;
    var row = el("div", "ac-row ac-inv");
    var left = el("div", "ac-row-main");
    var tt = I ? I.totals(inv) : { grand: 0, left: 0 };
    left.appendChild(el("b", "", (inv.no || "") + " · " + (I ? I.money(tt.grand) : "")));
    left.appendChild(el("span", "ac-row-sub", (inv.date || "") + " · " + (tt.left > 0 ? d.acLeft(I.money(tt.left)) : d.acPaid)));
    var until = I && I.warrantyUntil ? I.warrantyUntil(inv) : "";
    if (until) left.appendChild(el("span", "ac-warranty", d.acWarranty(until)));
    var names = (inv.items || []).map(function (x) { return x.desc; }).filter(Boolean).join(", ");
    if (names) left.appendChild(el("span", "ac-row-sub", names));
    row.appendChild(left);
    var pdf = el("button", "btn btn-outline btn-small ac-pdf", "PDF");
    pdf.type = "button";
    pdf.setAttribute("data-k", "pdf-" + (inv.no || inv.id));
    pdf.setAttribute("aria-label", d.acPdf(inv.no || ""));
    pdf.addEventListener("click", function () {
      if (!I) return;
      pdf.disabled = true;
      I.pdf(inv).then(function (blob) {
        var name = (inv.no || "invoice") + ".pdf";
        if (window.MF_PDF.canShareFile(blob, name) && navigator.maxTouchPoints > 0) return window.MF_PDF.share(blob, name, "Marshal Fitness " + (inv.no || "")).catch(function () { window.MF_PDF.save(blob, name); });
        window.MF_PDF.save(blob, name);
      }).catch(function () { M.toast(d.acError); }).then(function () { pdf.disabled = false; });
    });
    row.appendChild(pdf);
    return row;
  }

  function drawLogin() {
    var d = t();
    if (pendingLink) { drawFinish(); return; }
    var intro = el("div", "ac-intro");
    var ul = el("ul", "ac-benefits");
    d.acBenefits.forEach(function (b) { ul.appendChild(el("li", "", b)); });
    intro.appendChild(el("p", "panel-note", d.acIntro));
    intro.appendChild(ul);
    w.body.appendChild(intro);
    var g = el("button", "btn ac-google");
    g.type = "button";
    g.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';
    g.appendChild(el("span", "", d.acGoogle));
    g.setAttribute("data-k", "google");
    g.addEventListener("click", function () { google(g); });
    w.body.appendChild(g);
    w.body.appendChild(el("p", "ac-or", d.acOr));
    var form = el("form", "ac-email-form");
    form.noValidate = true;
    var em = el("input", "in22");
    em.type = "email"; em.autocomplete = "email"; em.required = true; em.dir = "ltr"; em.maxLength = 120;
    em.value = read(EMAIL_KEY) || "";
    em.placeholder = "name@example.com";
    em.setAttribute("data-k", "email");
    form.appendChild(M.field(d.acEmail, em));
    var send = el("button", "btn btn-outline ac-send-link", d.acSendLink);
    send.type = "submit";
    send.setAttribute("data-k", "send");
    form.appendChild(send);
    var err = el("p", "err22");
    err.hidden = true;
    err.setAttribute("role", "alert");
    form.appendChild(err);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = em.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = d.acBadEmail; err.hidden = false; em.focus(); return; }
      err.hidden = true;
      sendLink(email, send);
    });
    w.body.appendChild(form);
    w.body.appendChild(el("p", "f22-hint ac-privacy", d.acPrivacy));
  }

  function fail(e) {
    var d = t(), code = (e && e.code) || "";
    busy = false;
    welcome = false;
    if (/popup-closed|cancelled-popup/.test(code)) return;
    if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(code)) note = d.acPopupBlocked;
    else if (/unauthorized-domain|operation-not-allowed|configuration-not-found/.test(code)) note = d.acNotReady;
    else if (/network/.test(code) || (e && e.message === "offline")) note = d.acOffline;
    else if (/invalid-action-code|expired-action-code/.test(code)) note = d.acLinkOld;
    else note = d.acError;
    draw();
  }

  function google(b) {
    if (busy) return;
    busy = true;
    b.disabled = true;
    note = null;
    loadAuth().then(function (a) {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      welcome = true; // said after the account check (onUser)
      return a.signInWithPopup(provider);
    }).then(function () { busy = false; }).catch(fail)
      .then(function () { b.disabled = false; });
  }

  function linkUrl() {
    var base = String(M.S.siteUrl || (location.origin + location.pathname)).replace(/\/?$/, "/");
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") base = location.origin + location.pathname;
    return base + "?login=email";
  }
  function sendLink(email, b) {
    if (busy) return;
    busy = true;
    b.disabled = true;
    note = null;
    loadAuth().then(function (a) {
      return a.sendSignInLinkToEmail(email, { url: linkUrl(), handleCodeInApp: true });
    }).then(function () {
      busy = false;
      store(EMAIL_KEY, email);
      note = t().acLinkSent(email);
      draw();
    }).catch(fail).then(function () { b.disabled = false; });
  }

  // the link was opened on another phone (or the email was forgotten): ask for the email once
  function drawFinish() {
    var d = t();
    var form = el("form", "ac-email-form");
    form.noValidate = true;
    form.appendChild(el("p", "panel-note", d.acConfirmEmail));
    var em = el("input", "in22");
    em.type = "email"; em.autocomplete = "email"; em.dir = "ltr"; em.maxLength = 120; em.placeholder = "name@example.com";
    em.setAttribute("data-k", "finish-email");
    form.appendChild(M.field(d.acEmail, em));
    var go = el("button", "btn ac-finish", d.acFinish);
    go.setAttribute("data-k", "finish");
    go.type = "submit";
    form.appendChild(go);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = em.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { em.focus(); return; }
      completeLink(email);
    });
    w.body.appendChild(form);
  }
  function completeLink(email) {
    var href = pendingLink;
    pendingLink = null;
    try { history.replaceState(history.state, "", window.location.pathname); } catch (e) { /* ignore */ }
    loadAuth().then(function (a) {
      welcome = true; // said after the account check (onUser)
      return a.signInWithEmailLink(email, href);
    }).then(function () {
      store(EMAIL_KEY, null);
      M.openAccount(null);
    }).catch(function (e) { fail(e); M.openAccount(null); });
  }
  // coming back from the email link
  function finishLink() {
    var href = window.location.href;
    if (!/[?&]oobCode=/.test(href)) return;
    loadAuth().then(function (a) {
      if (!a.isSignInWithEmailLink(href)) { try { history.replaceState(history.state, "", window.location.pathname); } catch (e) { /* ignore */ } return; }
      pendingLink = href;
      var email = read(EMAIL_KEY);
      if (email) completeLink(email);
      else M.openAccount(null);
    }).catch(function (e) { fail(e); M.openAccount(null); });
  }

  M.openAccount = function (opener) {
    draw();
    M.openModal(w.modal, opener || null, w.body.querySelector(".ac-google, .ac-logout, .ac-email-form input"));
    if (!user) loadAuth().catch(function () { note = t().acOffline; draw(); });
    else loadLists();   // fresh lists every time (new answers, new invoices)
  };
  w.modal.addEventListener("modal-close", function () { note = null; });
  M.onRender(function () { drawButton(); if (!w.modal.hidden) draw(); });
  drawButton();

  // logged in on this phone before, or back from the email link: start the log-in program quietly
  function start() {
    if (/[?&]oobCode=/.test(window.location.search)) {
      // wait until the whole site is ready, then finish the log in
      if (window.MF_IS_READY) setTimeout(finishLink, 0);
      else {
        var once = function () { document.removeEventListener("mf-ready", once); finishLink(); };
        document.addEventListener("mf-ready", once);
      }
      return;
    }
    if (read(FLAG) === "1") {
      var go = function () { loadAuth().catch(function () {}); };
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500);
    }
  }
  start();
})();
