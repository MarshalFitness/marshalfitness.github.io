/* Marshal Fitness — invoice PDF (version 22: shared by admin and "My Marshal").
   window.MF_INVOICE.pdf(invoice) -> Promise<Blob> (A4 PDF in the invoice's language). */
(function () {
  "use strict";
  var P = window.MF_PDF;
  if (!P) return;
  var LANGS = ["en", "ar", "ckb"];
  function I18(lang) { return (window.I18N && window.I18N[lang]) || window.I18N.en; }
  function S() { return window.SITE || {}; }
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
    until: ["Warranty until", "الضمان حتى", "گەرەنتی تا"],
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
  // A4 page with the invoice -> PDF
  function invoicePdf(inv) {
    var lang = inv.lang || "en", R = lang !== "en", d = I18(lang);
    var W = 1240, H = 1754, M = 70, RED = "#d31822", INK = "#111112", MUTED = "#6b6b70", LINE = "#e4e4df";
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    var sx = function (x) { return R ? W - x : x; };           // mirror for Arabic / Kurdish
    var al = R ? "right" : "left", ar = R ? "left" : "right";
    return Promise.all([P.fontsReady(), P.loadImg("assets/logo.png")]).then(function (r) {
      var logo = r[1];
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, W, 200);
      ctx.fillStyle = RED; ctx.fillRect(0, 200, W, 8);
      if (logo) ctx.drawImage(logo, R ? W - M - 120 : M, 40, 120, 120);
      ctx.save(); ctx.font = P.font(900, 48, false); var mw = ctx.measureText("MARSHAL").width, fw = ctx.measureText("FITNESS").width; ctx.restore();
      var bx = R ? W - M - 140 - mw - fw : M + 140;
      P.text(ctx, "MARSHAL", { x: bx, y: 100, size: 48, weight: 900, color: "#fff", align: "left" });
      P.text(ctx, "FITNESS", { x: bx + mw, y: 100, size: 48, weight: 900, color: RED, align: "left" });
      var s = S();
      var addr = (function () { var t = document.createElement("div"); t.innerHTML = String(d.address || "").replace(/<br\s*\/?>/gi, ", "); return t.textContent; })();
      P.text(ctx, addr, { x: R ? W - M - 140 : M + 140, y: 146, size: 24, weight: 600, color: "#cfcfd4", rtl: R, align: al });
      P.text(ctx, T("invoice", lang), { x: sx(W - M), y: 112, size: 56, weight: 900, color: "#fff", rtl: R, align: ar });
      // number + date
      var y = 280;
      P.text(ctx, T("no", lang), { x: sx(M), y: y, size: 24, weight: 700, color: MUTED, rtl: R, align: al });
      P.text(ctx, inv.no || "", { x: sx(M), y: y + 40, size: 34, weight: 900, color: INK, align: al });
      P.text(ctx, T("date", lang), { x: sx(W - M), y: y, size: 24, weight: 700, color: MUTED, rtl: R, align: ar });
      P.text(ctx, inv.date || "", { x: sx(W - M), y: y + 40, size: 34, weight: 800, color: INK, align: ar });
      // customer
      y = 410;
      P.text(ctx, T("billTo", lang), { x: sx(M), y: y, size: 24, weight: 700, color: MUTED, rtl: R, align: al });
      P.text(ctx, inv.name || "", { x: sx(M), y: y + 42, size: 36, weight: 900, color: INK, rtl: R, align: al });
      var cy = y + 82;
      if (inv.phone) { P.text(ctx, inv.phone, { x: sx(M), y: cy, size: 28, weight: 600, color: INK, align: al }); cy += 38; }
      if (inv.address) { P.text(ctx, inv.address, { x: sx(M), y: cy, size: 28, weight: 600, color: INK, rtl: R, align: al, maxWidth: 700 }); cy += 38; }
      // shop contacts on the other side
      var sy = y + 42;
      [s.phoneDisplay, (s.morePhones || [])[0], String(s.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean).forEach(function (line) {
        P.text(ctx, line, { x: sx(W - M), y: sy, size: 26, weight: 600, color: MUTED, align: ar }); sy += 36;
      });
      // table
      y = Math.max(cy, sy) + 50;
      var cols = R ? [{ k: "item", x: W - M - 20, a: "right", w: 0 }, { k: "qty", x: 560, a: "center" }, { k: "price", x: 380, a: "center" }, { k: "total", x: M + 20, a: "left" }]
        : [{ k: "item", x: M + 20, a: "left" }, { k: "qty", x: 680, a: "center" }, { k: "price", x: 860, a: "center" }, { k: "total", x: W - M - 20, a: "right" }];
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(M, y, W - 2 * M, 62);
      cols.forEach(function (col) { P.text(ctx, T(col.k, lang), { x: col.x, y: y + 41, size: 24, weight: 800, color: "#fff", rtl: R, align: col.a }); });
      y += 62;
      var items = (inv.items || []).filter(function (it) { return (it.desc || "").trim() || num(it.price); });
      items.forEach(function (it, i) {
        var rowH = 70;
        ctx.save(); ctx.font = P.font(700, 26, R); var lines = P.wrap(ctx, it.desc || "", 520, 2); ctx.restore();
        if (lines.length > 1) rowH = 100;
        if (i % 2) { ctx.fillStyle = "#f6f6f3"; ctx.fillRect(M, y, W - 2 * M, rowH); }
        P.text(ctx, it.desc || "", { x: cols[0].x, y: y + 44, size: 26, weight: 700, color: INK, rtl: R, align: cols[0].a, maxWidth: 520, lines: 2, lh: 32 });
        P.text(ctx, String(num(it.qty) || 1), { x: cols[1].x, y: y + 44, size: 26, weight: 700, color: INK, align: "center" });
        P.text(ctx, money(it.price), { x: cols[2].x, y: y + 44, size: 26, weight: 600, color: INK, align: "center" });
        P.text(ctx, money(num(it.qty) * num(it.price)), { x: cols[3].x, y: y + 44, size: 26, weight: 800, color: INK, align: cols[3].a });
        y += rowH;
        ctx.fillStyle = LINE; ctx.fillRect(M, y - 1, W - 2 * M, 2);
      });
      // totals
      var tt = totals(inv);
      y += 30;
      var lx = R ? M + 380 : W - M - 380, vx = R ? M + 20 : W - M - 20;
      var rows = [["subtotal", tt.sub]];
      if (num(inv.discount)) rows.push(["discount", -num(inv.discount)]);
      if (num(inv.delivery)) rows.push(["delivery", num(inv.delivery)]);
      rows.push(["grand", tt.grand]);
      if (num(inv.paid)) { rows.push(["paid", num(inv.paid)]); rows.push(["left", tt.left]); }
      rows.forEach(function (row) {
        var big = row[0] === "grand";
        if (big) { ctx.fillStyle = RED; ctx.fillRect(R ? M : W - M - 420, y - 6, 420, 64); }
        P.text(ctx, T(row[0], lang), { x: lx, y: y + 36, size: big ? 30 : 26, weight: big ? 900 : 700, color: big ? "#fff" : MUTED, rtl: R, align: R ? "right" : "left" });
        P.text(ctx, (row[1] < 0 ? "−" : "") + money(Math.abs(row[1])), { x: vx, y: y + 36, size: big ? 32 : 26, weight: 900, color: big ? "#fff" : INK, align: R ? "left" : "right" });
        y += big ? 76 : 50;
      });
      // notes + warranty
      y += 30;
      [["notes", inv.notes], ["warranty", inv.warranty], ["until", warrantyUntil(inv)]].forEach(function (b) {
        if (!b[1] || !String(b[1]).trim()) return;
        P.text(ctx, T(b[0], lang), { x: sx(M), y: y, size: 24, weight: 800, color: MUTED, rtl: R, align: al });
        y += 10 + P.text(ctx, String(b[1]).trim(), { x: sx(M), y: y + 38, size: 26, weight: 600, color: INK, rtl: R, align: al, maxWidth: W - 2 * M, lines: 4, lh: 34 });
        y += 40;
      });
      // thank you
      ctx.fillStyle = LINE; ctx.fillRect(M, H - 130, W - 2 * M, 2);
      P.text(ctx, T("thanks", lang), { x: W / 2, y: H - 80, size: 28, weight: 800, color: INK, rtl: R, align: "center" });
      return P.toJpeg(c, 0.9);
    }).then(function (jpeg) {
      return P.build([{ jpeg: jpeg, w: W, h: H, links: [] }], P.A4, "Marshal Fitness " + (inv.no || "invoice"));
    });
  }

  // the date the warranty ends (invoice date + years), "" if none
  function warrantyUntil(inv) {
    var y = Number(inv && inv.warrantyYears);
    if (!(y > 0) || !inv.date) return "";
    var d = new Date(inv.date + "T00:00:00Z");
    if (isNaN(d.getTime())) return "";
    d.setUTCFullYear(d.getUTCFullYear() + y);
    return d.toISOString().slice(0, 10);
  }
  window.MF_INVOICE = { pdf: invoicePdf, totals: totals, money: money, num: num, warrantyUntil: warrantyUntil };
  window.MF_INVOICE_PDF = invoicePdf;
})();
