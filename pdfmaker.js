/* Marshal Fitness — small PDF maker (version 21).
   Pages are drawn on a canvas (so Arabic and Kurdish letters join correctly),
   saved as JPEG pictures and put into a real PDF file, with clickable links.
   Used by the catalog (catalog.js) and by admin (invoices, posts). */
(function () {
  "use strict";
  var FONT = '"Inter","Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif';
  var FONT_AR = '"Noto Sans Arabic","Noto Kufi Arabic","Segoe UI",Tahoma,Arial,sans-serif';

  function enc(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
  }
  // only plain letters in PDF text (links are made safe first)
  function pdfStr(s) { return "(" + String(s).replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1") + ")"; }
  function safeUrl(u) { return String(u).replace(/[^\x21-\x7e]/g, function (c) { return encodeURIComponent(c); }); }

  /* pages: [{ jpeg: Uint8Array, w, h (pixels), links: [{x, y, w, h, url}] (pixels) }]
     size: [width, height] in PDF points (A4 = 595.28 x 841.89) */
  function build(pages, size, title) {
    var parts = [], offsets = [], pos = 0, n = 0;
    function push(chunk) { parts.push(chunk); pos += chunk.length; }
    function obj(body) {
      n += 1; offsets[n] = pos;
      if (typeof body === "string") push(enc(n + " 0 obj\n" + body + "\nendobj\n"));
      else { push(enc(n + " 0 obj\n" + body.head + "\nstream\n")); push(body.data); push(enc("\nendstream\nendobj\n")); }
      return n;
    }
    push(enc("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));
    var catalogId = 1, pagesId = 2;
    n = 2; // 1 and 2 are written at the end
    var kids = [];
    pages.forEach(function (pg) {
      var W = size[0], Hh = size[1];
      var img = obj({ head: "<< /Type /XObject /Subtype /Image /Width " + pg.w + " /Height " + pg.h +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + pg.jpeg.length + " >>", data: pg.jpeg });
      var draw = "q " + W.toFixed(2) + " 0 0 " + Hh.toFixed(2) + " 0 0 cm /Im0 Do Q";
      var content = obj({ head: "<< /Length " + draw.length + " >>", data: enc(draw) });
      var sx = W / pg.w, sy = Hh / pg.h;
      var annots = (pg.links || []).map(function (l) {
        var x1 = l.x * sx, x2 = (l.x + l.w) * sx, y1 = Hh - (l.y + l.h) * sy, y2 = Hh - l.y * sy;
        return obj("<< /Type /Annot /Subtype /Link /Rect [" + [x1, y1, x2, y2].map(function (v) { return v.toFixed(2); }).join(" ") +
          "] /Border [0 0 0] /A << /S /URI /URI " + pdfStr(safeUrl(l.url)) + " >> >>");
      });
      var page = obj("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + W.toFixed(2) + " " + Hh.toFixed(2) + "]" +
        " /Resources << /XObject << /Im0 " + img + " 0 R >> >> /Contents " + content + " 0 R" +
        (annots.length ? " /Annots [" + annots.map(function (a) { return a + " 0 R"; }).join(" ") + "]" : "") + " >>");
      kids.push(page);
    });
    var info = obj("<< /Title " + pdfStr(title || "Marshal Fitness") + " /Producer (Marshal Fitness website) >>");
    offsets[catalogId] = pos; push(enc(catalogId + " 0 obj\n<< /Type /Catalog /Pages " + pagesId + " 0 R >>\nendobj\n"));
    offsets[pagesId] = pos; push(enc(pagesId + " 0 obj\n<< /Type /Pages /Kids [" + kids.map(function (k) { return k + " 0 R"; }).join(" ") + "] /Count " + kids.length + " >>\nendobj\n"));
    var xref = pos;
    var x = "xref\n0 " + (n + 1) + "\n0000000000 65535 f \n";
    for (var i = 1; i <= n; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    x += "trailer\n<< /Size " + (n + 1) + " /Root " + catalogId + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    push(enc(x));
    return new Blob(parts, { type: "application/pdf" });
  }

  function toJpeg(canvas, q) {
    return new Promise(function (resolve, reject) {
      function fromDataUrl() {
        try {
          var s = atob(canvas.toDataURL("image/jpeg", q || 0.85).split(",")[1]);
          resolve(enc(s));
        } catch (e) { reject(e); }
      }
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (!b) { fromDataUrl(); return; }
          var r = new FileReader();
          r.onload = function () { resolve(new Uint8Array(r.result)); };
          r.onerror = fromDataUrl;
          r.readAsArrayBuffer(b);
        }, "image/jpeg", q || 0.85);
      } else fromDataUrl();
    });
  }

  function loadImg(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  // wait for the fonts the page uses (if they could not load, the phone's fonts are used)
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var list = ["400 20px Inter", "700 20px Inter", "800 20px Inter", "900 20px Inter",
      "400 20px 'Noto Sans Arabic'", "600 20px 'Noto Sans Arabic'", "800 20px 'Noto Sans Arabic'"];
    var all = Promise.all(list.map(function (f) { return document.fonts.load(f, "Aa ابت").catch(function () { return null; }); }));
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 2500); })]);
  }

  function font(weight, size, rtl) { return weight + " " + size + "px " + (rtl ? FONT_AR : FONT); }

  // split text into lines that fit maxWidth (keeps words whole)
  function wrap(ctx, text, maxWidth, maxLines) {
    var words = String(text || "").split(/\s+/).filter(Boolean), lines = [], line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }

  // draw text; o = { x, y, size, weight, color, align ("start"/"end"/"center"), rtl, maxWidth, lines, lh }
  function text(ctx, str, o) {
    ctx.save();
    ctx.font = font(o.weight || 400, o.size || 20, o.rtl);
    ctx.fillStyle = o.color || "#111";
    ctx.direction = o.rtl ? "rtl" : "ltr";
    ctx.textBaseline = "alphabetic";
    var align = o.align || "start";
    ctx.textAlign = align === "center" || align === "left" || align === "right" ? align :
      (align === "end" ? (o.rtl ? "left" : "right") : (o.rtl ? "right" : "left"));
    var lines = o.maxWidth ? wrap(ctx, str, o.maxWidth, o.lines) : [String(str)];
    var lh = o.lh || Math.round((o.size || 20) * 1.3);
    lines.forEach(function (ln, i) { ctx.fillText(ln, o.x, o.y + i * lh); });
    ctx.restore();
    return lines.length * lh;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // picture inside a box, keeping its shape
  function contain(ctx, img, x, y, w, h) {
    if (!img) return;
    var k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    var dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function cover(ctx, img, x, y, w, h) {
    if (!img) return;
    var k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  // share the file (phones: WhatsApp, Telegram, ...) — false if this phone cannot share files
  function canShareFile(blob, name) {
    try {
      var f = new File([blob], name, { type: blob.type });
      return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] }));
    } catch (e) { return false; }
  }
  function share(blob, name, title) {
    var f = new File([blob], name, { type: blob.type });
    return navigator.share({ files: [f], title: title || name });
  }

  window.MF_PDF = {
    A4: [595.28, 841.89], build: build, toJpeg: toJpeg, loadImg: loadImg, fontsReady: fontsReady,
    font: font, wrap: wrap, text: text, roundRect: roundRect, contain: contain, cover: cover,
    save: save, canShareFile: canShareFile, share: share
  };
})();
