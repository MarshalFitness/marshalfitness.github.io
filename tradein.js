/* Marshal Fitness — version 22: trade-in ("Sell us your old machine").
   The customer says what the old machine is, adds up to 4 photos and (if they want)
   what they would like instead. The photos are made small on the phone and saved
   with the request, so the shop sees them in admin and sends an offer on WhatsApp. */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.makeWindow || !M.readImage) return;
  var el = M.el;
  function t() { return M.t(); }

  var MAX_PHOTOS = 4;
  var w = M.makeWindow("tradeModal", "ti-panel");
  var st = { type: "treadmill", brand: "", age: "1-3", cond: "good", want: "", notes: "", photos: [] };

  function select(options, value, label, onChange) {
    var s = el("select", "in22");
    s.setAttribute("aria-label", label);
    options.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; if (o[0] === value) op.selected = true; s.appendChild(op); });
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }
  function pairs(obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); }

  function draw() {
    var d = t();
    w.title.textContent = d.tiTitle;
    w.body.textContent = "";
    w.body.appendChild(el("p", "panel-note", d.tiIntro));
    var steps = el("ol", "ti-steps");
    d.tiSteps.forEach(function (x) { steps.appendChild(el("li", "", x)); });
    w.body.appendChild(steps);
    var form = el("div", "gp-form");
    form.appendChild(M.field(d.tiType, select(pairs(d.tiTypes), st.type, d.tiType, function (v) { st.type = v; })));
    var brand = el("input", "in22");
    brand.type = "text"; brand.maxLength = 60; brand.value = st.brand; brand.placeholder = d.tiBrandHint;
    brand.addEventListener("input", function () { st.brand = brand.value; });
    form.appendChild(M.field(d.tiBrand, brand));
    form.appendChild(M.field(d.tiAge, select(pairs(d.tiAges), st.age, d.tiAge, function (v) { st.age = v; })));
    form.appendChild(M.field(d.tiCond, select(pairs(d.tiConds), st.cond, d.tiCond, function (v) { st.cond = v; })));
    // photos
    var pf = el("div", "f22 f22-wide");
    pf.appendChild(el("span", "f22-label", d.tiPhotos));
    var thumbs = el("div", "ti-thumbs");
    var file = el("input");
    file.type = "file"; file.accept = "image/*"; file.multiple = true; file.className = "sr-only"; file.id = "tiFile";
    var add = el("label", "ti-add");
    add.setAttribute("for", "tiFile");
    add.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
    add.appendChild(el("span", "", d.tiAddPhoto));
    var status = el("p", "f22-hint");
    status.setAttribute("aria-live", "polite");
    function showThumbs() {
      thumbs.textContent = "";
      st.photos.forEach(function (src, i) {
        var box = el("div", "ti-thumb");
        var im = el("img"); im.src = src; im.alt = d.tiPhotoN(i + 1);
        var del = el("button", "ti-del", "×");
        del.type = "button";
        del.setAttribute("aria-label", d.tiRemovePhoto(i + 1));
        del.addEventListener("click", function () { st.photos.splice(i, 1); showThumbs(); add.focus(); });
        box.appendChild(im); box.appendChild(del);
        thumbs.appendChild(box);
      });
      add.hidden = st.photos.length >= MAX_PHOTOS;
      if (st.photos.length < MAX_PHOTOS) thumbs.appendChild(add);
      status.textContent = d.tiPhotoCount(st.photos.length, MAX_PHOTOS);
    }
    file.addEventListener("change", function () {
      var files = Array.prototype.slice.call(file.files || [], 0, MAX_PHOTOS - st.photos.length);
      file.value = "";
      status.textContent = d.tiReading;
      files.reduce(function (chain, f) {
        return chain.then(function () {
          return M.readImage(f, 900, "image/jpeg", 0.72).then(function (data) { if (st.photos.length < MAX_PHOTOS) st.photos.push(data); })
            .catch(function () { M.toast(d.tiBadPhoto); });
        });
      }, Promise.resolve()).then(showThumbs);
    });
    pf.appendChild(file);
    pf.appendChild(thumbs);
    pf.appendChild(status);
    form.appendChild(pf);
    showThumbs();
    // what they want instead
    var want = el("input", "in22");
    want.type = "text"; want.maxLength = 120; want.value = st.want; want.placeholder = d.tiWantHint;
    want.setAttribute("list", "tiProducts");
    var dl = el("datalist"); dl.id = "tiProducts";
    M.PRODUCTS.forEach(function (p) { var op = el("option"); op.value = M.tr(p.name) + (p.no ? " (" + p.no + ")" : ""); dl.appendChild(op); });
    want.addEventListener("input", function () { st.want = want.value; });
    var wf = M.field(d.tiWant, want);
    wf.appendChild(dl);
    form.appendChild(wf);
    var notes = el("textarea", "in22");
    notes.rows = 2; notes.maxLength = 500; notes.value = st.notes; notes.placeholder = d.tiNotesHint;
    notes.addEventListener("input", function () { st.notes = notes.value; });
    var nf = M.field(d.tiNotes, notes);
    nf.classList.add("f22-wide");
    form.appendChild(nf);
    w.body.appendChild(form);
    var err = el("p", "err22");
    err.hidden = true;
    err.setAttribute("role", "alert");
    w.body.appendChild(err);
    var send = el("button", "btn btn-whatsapp ti-send");
    send.type = "button";
    if (M.WA_ICON) send.innerHTML = M.WA_ICON;
    send.appendChild(el("span", "", d.tiSend));
    send.addEventListener("click", function () {
      if (!st.photos.length) { err.textContent = d.tiNeedPhoto; err.hidden = false; add.focus(); return; }
      err.hidden = true;
      submit(send);
    });
    w.body.appendChild(send);
    w.body.appendChild(el("p", "f22-hint", d.tiPrivacy));
  }

  function submit(opener) {
    var d = t();
    var type = d.tiTypes[st.type], age = d.tiAges[st.age], cond = d.tiConds[st.cond];
    var lines = [d.tiMsgIntro, "", d.tiType + ": " + type, d.tiBrand + ": " + (st.brand.trim() || "—"), d.tiAge + ": " + age, d.tiCond + ": " + cond];
    if (st.want.trim()) lines.push(d.tiWant + ": " + st.want.trim());
    if (st.notes.trim()) lines.push(d.tiNotes + ": " + st.notes.trim());
    lines.push("", d.tiMsgPhotos(st.photos.length));
    // keep the request under the database limit (about 1 MB): make big photos smaller, do not drop them
    fitPhotos(st.photos, PHOTO_LIMIT).then(function (photos) {
      window.MF_REQUEST.open({
        kind: "tradein",
        item: d.tiTitle + ": " + type + (st.brand.trim() ? " (" + st.brand.trim() + ")" : ""),
        message: lines.join("\n"),
        extra: { photos: photos, tradein: { type: st.type, brand: st.brand.trim().slice(0, 60), age: st.age, cond: st.cond, want: st.want.trim().slice(0, 120), notes: st.notes.trim().slice(0, 500) } },
        onSent: function () { st.photos = []; st.notes = ""; }
      }, opener);
    });
  }

  /* ---------- photos must fit in one database request ---------- */
  var PHOTO_LIMIT = 850000; // characters of all photos together
  function shrink(src, side, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        var x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        var out = src;
        try { out = c.toDataURL("image/jpeg", quality); } catch (e) { /* keep it */ }
        resolve(out.length < src.length ? out : src);
      };
      img.onerror = function () { resolve(src); };
      img.src = src;
    });
  }
  function total(list) { return list.reduce(function (n, p) { return n + p.length; }, 0); }
  var STEPS = [[760, 0.66], [640, 0.6], [520, 0.55], [420, 0.5]];
  function fitPhotos(list, limit) {
    function step(a, i) {
      if (total(a) <= limit || i >= STEPS.length) return Promise.resolve(a);
      return Promise.all(a.map(function (p) { return shrink(p, STEPS[i][0], STEPS[i][1]); })).then(function (b) { return step(b, i + 1); });
    }
    return step(list.slice(), 0).then(function (a) {
      var out = [], size = 0; // last safety: never more than the limit
      a.forEach(function (p) { if (size + p.length <= limit) { out.push(p); size += p.length; } });
      return out;
    });
  }

  M.openTradeIn = function (opener) {
    draw();
    M.openModal(w.modal, opener || null, w.body.querySelector("select"));
  };
  M.onRender(function () { if (!w.modal.hidden) draw(); });
})();
