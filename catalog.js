/* Marshal Fitness — "Catalog (PDF)" (version 21).
   One tap makes a PDF of all products (in the visitor's language), with the logo,
   WhatsApp number and address. On phones it can be shared straight to WhatsApp.
   Every "Ask price" button inside the PDF opens WhatsApp. */
(function () {
  "use strict";
  var M = window.MF, P = window.MF_PDF;
  if (!M || !P) return;
  var el = M.el, t = M.t;
  var W = 1240, H = 1754, MARGIN = 64;
  var RED = "#d31822", INK = "#111112", MUTED = "#6b6b70", LINE = "#e4e4df", WA = "#25d366";

  function plain(html) {
    var d = document.createElement("div");
    d.innerHTML = String(html || "").replace(/<br\s*\/?>/gi, ", ");
    return (d.textContent || "").replace(/\s+/g, " ").replace(/ ,/g, ",").trim();
  }
  function rtl() { return M.lang() !== "en"; }
  function X(x, w) { return rtl() ? W - x - (w || 0) : x; } // mirror for Arabic / Kurdish
  function seriesName(p) {
    var s = (window.GYM_SERIES || []).filter(function (x) { return x.id === p.series; })[0];
    return s ? (typeof s.name === "string" ? s.name : M.tr(s.name)) : "";
  }

  /* ---------- the window ---------- */
  var modal = el("div", "lightbox");
  modal.id = "catModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "catTitle");
  modal.hidden = true;
  var panel = el("div", "lightbox-panel panel-pad cat-panel");
  var close = el("button", "lightbox-close");
  close.type = "button";
  close.id = "catClose";
  close.innerHTML = "&times;";
  var title = el("h2", "panel-title");
  title.id = "catTitle";
  var body = el("div", "cat-body");
  body.setAttribute("aria-live", "polite");
  panel.appendChild(close);
  panel.appendChild(title);
  panel.appendChild(body);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  close.addEventListener("click", function () { M.closeModal(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) M.closeModal(); });

  var job = 0, ready = null; // ready = { blob, name, lang, pages }

  function showProgress(i, n) {
    var d = t();
    body.textContent = "";
    body.appendChild(el("p", "cat-note", d.catMaking));
    var bar = el("div", "cat-bar");
    var fill = el("span", "cat-fill");
    fill.style.width = Math.round(100 * i / Math.max(1, n)) + "%";
    bar.appendChild(fill);
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(n));
    bar.setAttribute("aria-valuenow", String(i));
    body.appendChild(bar);
    body.appendChild(el("p", "cat-small", n ? d.catPage(i, n) : ""));
  }

  function showReady() {
    var d = t();
    body.textContent = "";
    var card = el("div", "cat-ready");
    var ic = el("span", "cat-ic");
    ic.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>';
    card.appendChild(ic);
    var txt = el("div");
    txt.appendChild(el("p", "cat-ready-title", d.catReady));
    txt.appendChild(el("p", "cat-small", d.catInfo(ready.pages, (ready.blob.size / 1048576).toFixed(1))));
    card.appendChild(txt);
    body.appendChild(card);
    var btns = el("div", "cat-btns");
    if (P.canShareFile(ready.blob, ready.name)) {
      var sh = el("button", "btn cat-share");
      sh.type = "button";
      sh.innerHTML = M.WA_ICON;
      sh.appendChild(el("span", null, d.catShare));
      sh.addEventListener("click", function () { P.share(ready.blob, ready.name, d.catTitle).catch(function () { /* closed */ }); });
      btns.appendChild(sh);
    }
    var sv = el("button", "btn btn-outline cat-save");
    sv.type = "button";
    sv.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    sv.appendChild(el("span", null, d.catSave));
    sv.addEventListener("click", function () { P.save(ready.blob, ready.name); });
    btns.appendChild(sv);
    body.appendChild(btns);
    body.appendChild(el("p", "cat-small", d.catTip));
    var first = btns.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }

  function showError() {
    var d = t();
    body.textContent = "";
    body.appendChild(el("p", "cat-note", d.catError));
    var again = el("button", "btn");
    again.type = "button";
    again.textContent = d.catAgain;
    again.addEventListener("click", start);
    body.appendChild(again);
  }

  function open(opener) {
    var d = t();
    title.textContent = d.catTitle;
    close.setAttribute("aria-label", d.close);
    M.openModal(modal, opener || null, close);
    if (ready && ready.lang === M.lang() && ready.count === (M.PRODUCTS || []).length) showReady();
    else start();
  }
  M.openCatalog = open;

  function start() {
    var my = ++job;
    ready = null;
    showProgress(0, 0);
    make(function (i, n) { if (my === job) showProgress(i, n); }).then(function (r) {
      if (my !== job) return;
      ready = r;
      if (!modal.hidden) showReady();
    }).catch(function () {
      if (my === job && !modal.hidden) showError();
    });
  }
  modal.addEventListener("modal-close", function () { /* keep making it in the background */ });
  M.onRender(function () { if (!modal.hidden) { title.textContent = t().catTitle; if (ready && ready.lang !== M.lang()) start(); } });

  /* ---------- drawing the pages ---------- */
  function groups() {
    var prods = (M.PRODUCTS || []).slice();
    var order = (window.SERIES_ORDER || (window.GYM_SERIES || []).map(function (s) { return s.id; }));
    var out = [];
    (M.CATS || []).forEach(function (c) {
      var list = prods.filter(function (p) { return p.cat === c.id; });
      if (c.id === "gym-equipment") {
        list = list.map(function (p, i) { return { p: p, i: i, s: order.indexOf(p.series) }; })
          .sort(function (a, b) { return (a.s - b.s) || (a.i - b.i); }).map(function (x) { return x.p; });
      }
      if (list.length) out.push({ id: c.id, name: M.catName(c.id), items: list });
    });
    return out;
  }

  function imgFor(p) { return p.imageData || (M.S.imageBase + (p.thumbnail || p.image)); }

  function make(progress) {
    var d = t(), lang = M.lang(), R = rtl();
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    var gs = groups();
    var count = 0;
    gs.forEach(function (g) { count += g.items.length; });
    // fill the pages: a category title, then rows of 2 products; a new page when the space ends
    var TOP = 168, BOTTOM = H - 116, GAP = 22, TITLE_H = 70, ROW_H = 420;
    var pagesPlan = [{ kind: "cover" }];
    var cur = null, y = 0;
    function newPage() { cur = { kind: "items", blocks: [] }; pagesPlan.push(cur); y = TOP; }
    newPage();
    gs.forEach(function (g) {
      for (var i = 0; i < g.items.length; i += 2) {
        var row = g.items.slice(i, i + 2);
        var needTitle = i === 0;
        if (y + (needTitle ? TITLE_H : 0) + ROW_H > BOTTOM) { newPage(); needTitle = true; }
        if (needTitle) { cur.blocks.push({ kind: "title", name: g.name, y: y }); y += TITLE_H; }
        cur.blocks.push({ kind: "row", items: row, y: y });
        y += ROW_H + GAP;
      }
    });
    pagesPlan.push({ kind: "contact" });
    var total = pagesPlan.length;
    var out = [];
    var S = M.S;
    var site = String(S.siteUrl || location.origin + "/").replace(/\/$/, "");
    var waLink = "https://wa.me/" + S.phone;
    var logoP = P.loadImg(S.logo || "assets/logo.png");
    var heroP = P.loadImg("assets/hero-rooftop-1600.webp");

    function header(page, g) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, W, 132);
      ctx.fillStyle = RED; ctx.fillRect(0, 132, W, 6);
      return logoP.then(function (logo) {
        if (logo) ctx.drawImage(logo, X(MARGIN, 76), 28, 76, 76);
        ctx.save(); ctx.font = P.font(900, 38, false);
        var mw = ctx.measureText("MARSHAL").width, fw = ctx.measureText("FITNESS").width;
        ctx.restore();
        var bx = R ? W - MARGIN - 96 - mw - fw : MARGIN + 96; // brand name always reads left to right
        P.text(ctx, "MARSHAL", { x: bx, y: 80, size: 38, weight: 900, color: "#fff", align: "left" });
        P.text(ctx, "FITNESS", { x: bx + mw, y: 80, size: 38, weight: 900, color: RED, align: "left" });
        P.text(ctx, g.name, { x: R ? MARGIN : W - MARGIN, y: 82, size: 36, weight: 800, color: "#fff", rtl: R, align: R ? "left" : "right" });
        footer(page);
      });
    }
    function footer(page) {
      ctx.fillStyle = LINE; ctx.fillRect(MARGIN, H - 92, W - 2 * MARGIN, 2);
      P.text(ctx, site.replace(/^https?:\/\//, ""), { x: R ? W - MARGIN : MARGIN, y: H - 48, size: 24, weight: 600, color: MUTED, align: R ? "right" : "left" });
      P.text(ctx, page + " / " + total, { x: W / 2, y: H - 48, size: 24, weight: 700, color: MUTED, align: "center" });
      P.text(ctx, "WhatsApp " + S.phoneDisplay, { x: R ? MARGIN : W - MARGIN, y: H - 48, size: 24, weight: 700, color: INK, align: R ? "left" : "right" });
    }

    function itemsPage(plan, pageNo) {
      var links = [];
      return header(pageNo, { name: "" }).then(function () {
        var all = [];
        plan.blocks.forEach(function (b) { if (b.kind === "row") all = all.concat(b.items); });
        return Promise.all(all.map(function (p) { return P.loadImg(imgFor(p)); })).then(function (imgs) {
          var k = 0, gap = 26, cw = (W - 2 * MARGIN - gap) / 2, ch = ROW_H;
          plan.blocks.forEach(function (b) {
            if (b.kind === "title") {
              P.text(ctx, b.name, { x: X(MARGIN), y: b.y + 46, size: 42, weight: 900, color: INK, rtl: R, align: R ? "right" : "left" });
              ctx.fillStyle = RED; ctx.fillRect(X(MARGIN, 90), b.y + 58, 90, 6);
              return;
            }
            b.items.forEach(function (p, col) {
              var img = imgs[k++];
              var x = X(MARGIN + col * (cw + gap), cw), y = b.y;
              ctx.save();
              P.roundRect(ctx, x, y, cw, ch, 22);
              ctx.fillStyle = "#f7f7f4"; ctx.fill();
              ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
              ctx.restore();
              var ih = ch - 186;
              ctx.save();
              P.roundRect(ctx, x + 14, y + 14, cw - 28, ih, 16);
              ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.clip();
              if (img) P.contain(ctx, img, x + 30, y + 24, cw - 60, ih - 20);
              ctx.restore();
              var name = M.tr(p.name), sn = p.series ? seriesName(p) : "";
              var ty = y + ih + 56;
              if (sn) { P.text(ctx, sn, { x: R ? x + cw - 28 : x + 28, y: ty - 6, size: 22, weight: 800, color: RED, align: R ? "right" : "left" }); ty += 28; }
              P.text(ctx, name, { x: R ? x + cw - 28 : x + 28, y: ty, size: 30, weight: 800, color: INK, rtl: R, align: R ? "right" : "left", maxWidth: cw - 56, lines: sn ? 1 : 2, lh: 36 });
              if (p.no) P.text(ctx, (p.series && window.GYM_COPY ? window.GYM_COPY[lang].code : d.itemNo) + " " + p.no,
                { x: R ? x + cw - 28 : x + 28, y: y + ch - 32, size: 22, weight: 600, color: MUTED, rtl: R, align: R ? "right" : "left" });
              // "Ask price" button (opens WhatsApp)
              var bw = 220, bh = 54, bx = R ? x + 24 : x + cw - bw - 24, by = y + ch - bh - 16;
              ctx.save();
              P.roundRect(ctx, bx, by, bw, bh, 27);
              ctx.fillStyle = WA; ctx.fill();
              ctx.restore();
              P.text(ctx, d.catAsk, { x: bx + bw / 2, y: by + 36, size: 24, weight: 800, color: "#052e16", rtl: R, align: "center" });
              links.push({ x: bx, y: by, w: bw, h: bh, url: M.waUrl(d.askProduct(M.waProductName(p, name), p.no)) });
            });
          });
        });
      }).then(function () { return links; });
    }

    function coverPage() {
      var links = [];
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, W, H);
      return Promise.all([logoP, heroP]).then(function (r) {
        var logo = r[0], hero = r[1];
        if (logo) ctx.drawImage(logo, W / 2 - 110, 120, 220, 220);
        ctx.save(); ctx.font = P.font(900, 104, false);
        var a = ctx.measureText("MARSHAL").width, b = ctx.measureText("FITNESS").width;
        ctx.restore();
        var sx = W / 2 - (a + b) / 2;
        P.text(ctx, "MARSHAL", { x: sx, y: 470, size: 104, weight: 900, color: "#fff" });
        P.text(ctx, "FITNESS", { x: sx + a, y: 470, size: 104, weight: 900, color: RED });
        P.text(ctx, d.catTitle + " " + new Date().getFullYear(), { x: W / 2, y: 548, size: 44, weight: 700, color: "#d0d0d4", rtl: R, align: "center" });
        // photo
        ctx.save();
        P.roundRect(ctx, MARGIN, 620, W - 2 * MARGIN, 560, 34);
        ctx.clip();
        ctx.fillStyle = "#1b1b1e"; ctx.fillRect(MARGIN, 620, W - 2 * MARGIN, 560);
        if (hero) P.cover(ctx, hero, MARGIN, 620, W - 2 * MARGIN, 560);
        var grd = ctx.createLinearGradient(0, 860, 0, 1180);
        grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.82)");
        ctx.fillStyle = grd; ctx.fillRect(MARGIN, 860, W - 2 * MARGIN, 320);
        ctx.restore();
        P.text(ctx, d.catSub, { x: X(MARGIN + 44), y: 1112, size: 36, weight: 800, color: "#fff", rtl: R, align: R ? "right" : "left", maxWidth: W - 2 * MARGIN - 88, lines: 2, lh: 44 });
        // contact rows
        var rows = [
          [d.catWhatsApp, S.phoneDisplay, waLink, false],
          [d.hoursLabel, (S.hours && (S.hours[lang] || S.hours.en)) || "", null, R],
          [d.catAddress, plain(d.address), null, R],
          [d.catWeb, site.replace(/^https?:\/\//, ""), site + "/", false]
        ];
        var y = 1290;
        rows.forEach(function (row) {
          if (!row[1]) return;
          P.text(ctx, row[0], { x: X(MARGIN), y: y, size: 26, weight: 700, color: "#9a9aa0", rtl: R, align: R ? "right" : "left" });
          var hgt = P.text(ctx, row[1], { x: X(MARGIN), y: y + 44, size: 34, weight: 800, color: row[2] ? "#fff" : "#e8e8ec", rtl: row[3], align: R ? "right" : "left", maxWidth: W - 2 * MARGIN, lines: 2, lh: 42 });
          if (row[2]) {
            ctx.save(); ctx.font = P.font(800, 34, false); var tw = ctx.measureText(row[1]).width; ctx.restore();
            links.push({ x: X(MARGIN, tw), y: y + 10, w: tw, h: 46, url: row[2] });
            ctx.fillStyle = RED; ctx.fillRect(X(MARGIN, tw), y + 52, tw, 3);
          }
          y += 50 + hgt + 22;
        });
        P.text(ctx, d.catCount(count), { x: W / 2, y: H - 60, size: 26, weight: 700, color: "#9a9aa0", rtl: R, align: "center" });
        return links;
      });
    }

    function contactPage(pageNo) {
      var links = [];
      return header(pageNo, { name: d.catContact }).then(function () {
        var y = 260;
        P.text(ctx, d.catContact, { x: X(MARGIN), y: y, size: 64, weight: 900, color: INK, rtl: R, align: R ? "right" : "left" });
        y += 70;
        P.text(ctx, plain(d.address), { x: X(MARGIN), y: y + 30, size: 34, weight: 600, color: INK, rtl: R, align: R ? "right" : "left", maxWidth: W - 2 * MARGIN });
        y += 120;
        function block(label, value, url, ltr) {
          P.text(ctx, label, { x: X(MARGIN), y: y, size: 26, weight: 700, color: MUTED, rtl: R, align: R ? "right" : "left" });
          var h = P.text(ctx, value, { x: X(MARGIN), y: y + 46, size: 36, weight: 800, color: INK, rtl: !ltr && R, align: R ? "right" : "left", maxWidth: W - 2 * MARGIN, lines: 3, lh: 46 });
          if (url) {
            ctx.save(); ctx.font = P.font(800, 36, false); var tw = Math.min(W - 2 * MARGIN, ctx.measureText(value).width); ctx.restore();
            links.push({ x: X(MARGIN, tw), y: y + 8, w: tw, h: 50, url: url });
            ctx.fillStyle = RED; ctx.fillRect(X(MARGIN, tw), y + 56, tw, 3);
          }
          y += 60 + h + 26;
        }
        block(d.catWhatsApp, S.phoneDisplay, waLink, true);
        (S.morePhones || []).forEach(function (ph) { block(d.callBtn, ph, "tel:" + String(ph).replace(/[^\d+]/g, ""), true); });
        if (S.hours) block(d.hoursLabel, S.hours[lang] || S.hours.en || "", null, false);
        block(d.directionsBtn, "Google Maps", S.mapsLink || ("https://www.google.com/maps/dir/?api=1&destination=" + S.lat + "," + S.lng), true);
        (S.social || []).forEach(function (s) { block(s.name, s.url.replace(/^https?:\/\/(www\.)?/, ""), s.url, true); });
        block(d.catWeb, site.replace(/^https?:\/\//, ""), site + "/", true);
        return links;
      });
    }

    var chain = P.fontsReady();
    pagesPlan.forEach(function (plan, i) {
      chain = chain.then(function () {
        progress(i + 1, total);
        var job = plan.kind === "cover" ? coverPage() : plan.kind === "contact" ? contactPage(i + 1) : itemsPage(plan, i + 1);
        return job.then(function (links) {
          return P.toJpeg(canvas, 0.8).then(function (jpeg) { out.push({ jpeg: jpeg, w: W, h: H, links: links || [] }); });
        });
      }).then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }); // let the page breathe
    });
    return chain.then(function () {
      var blob = P.build(out, P.A4, "Marshal Fitness catalog");
      return { blob: blob, name: "Marshal-Fitness-Catalog-" + lang.toUpperCase() + ".pdf", lang: lang, pages: out.length, count: (M.PRODUCTS || []).length };
    });
  }
  M.makeCatalog = make;

  document.querySelectorAll("[data-open-catalog]").forEach(function (b) {
    b.addEventListener("click", function () {
      var nav = document.getElementById("navLinks");
      if (nav && nav.classList.contains("open")) { var mt = document.getElementById("menuToggle"); if (mt) mt.click(); }
      open(b);
    });
  });
})();
