/* Marshal Fitness — product "show" page.
   A full-screen page for the star products: the product photo (without
   background) moves, turns and zooms while the customer scrolls, with big
   text and the buttons to try it (camera, room planner) and ask the price.
   Star products: ticked "Show page" in admin (or the "Popular" ones). */
(function () {
  "use strict";
  var M = window.MF;
  var stage = document.getElementById("showStage");
  if (!M || !stage || !M.openStage) return;

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function el(tag, cls, text) { return M.el(tag, cls, text); }

  var ui = {};
  var built = false;
  var product = null;
  var raf = 0;
  var observer = null;

  // where the photo is while scrolling: p = progress 0..1, x/y in % of the screen, s = size, r = turn
  var DESK = [
    { p: 0.00, x: 0, y: -9, s: 0.8, r: 0, ry: 0 },
    { p: 0.18, x: 0, y: -4, s: 1.0, r: 0, ry: 0 },
    { p: 0.40, x: -22, y: 0, s: 0.98, r: -3, ry: 18 },
    { p: 0.66, x: 22, y: 0, s: 1.0, r: 3, ry: -18 },
    { p: 0.88, x: -18, y: -2, s: 0.8, r: 0, ry: 8 },
    { p: 1.00, x: -18, y: -2, s: 0.78, r: 0, ry: 8 }
  ];
  var PHONE = [
    { p: 0.00, x: 0, y: 2, s: 0.92, r: 0, ry: 0 },
    { p: 0.18, x: 0, y: -6, s: 1.02, r: 0, ry: 0 },
    { p: 0.40, x: 0, y: -16, s: 0.84, r: -3, ry: 16 },
    { p: 0.66, x: 0, y: -16, s: 0.86, r: 3, ry: -16 },
    { p: 0.88, x: 0, y: -18, s: 0.7, r: 0, ry: 0 },
    { p: 1.00, x: 0, y: -18, s: 0.68, r: 0, ry: 0 }
  ];

  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function frameAt(path, p) {
    for (var i = 1; i < path.length; i++) {
      if (p <= path[i].p) {
        var a = path[i - 1], b = path[i];
        var k = ease((p - a.p) / ((b.p - a.p) || 1));
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k), r: lerp(a.r, b.r, k), ry: lerp(a.ry, b.ry, k) };
      }
    }
    return path[path.length - 1];
  }

  /* ---------- build ---------- */
  function build() {
    if (built) return;
    built = true;
    var d = t();

    ui.scroll = el("div", "show-scroll");
    ui.scroll.tabIndex = -1;
    ui.track = el("div", "show-track");

    ui.stick = el("div", "show-stick");
    ui.stick.setAttribute("aria-hidden", "true");
    ui.glow = el("div", "show-glow");
    ui.ghost = el("div", "show-ghost");
    ui.prod = el("div", "show-prod");
    ui.img = document.createElement("img");
    ui.img.alt = "";
    ui.img.decoding = "async";
    ui.img.draggable = false;
    ui.prod.appendChild(ui.img);
    ui.floor = el("div", "show-floor");
    ui.stick.appendChild(ui.glow);
    ui.stick.appendChild(ui.ghost);
    ui.stick.appendChild(ui.floor);
    ui.stick.appendChild(ui.prod);
    ui.track.appendChild(ui.stick);

    ui.content = el("div", "show-content");
    // 1. title
    ui.hero = el("section", "show-sec show-hero");
    ui.eyebrow = el("p", "show-eyebrow");
    ui.name = el("h2", "show-name");
    ui.name.id = "showStageTitle";
    ui.hint = el("p", "show-hint");
    ui.hint.setAttribute("aria-hidden", "true");
    ui.hero.appendChild(ui.eyebrow);
    ui.hero.appendChild(ui.name);
    ui.hero.appendChild(ui.hint);
    // 2. strong + facts
    ui.s1 = el("section", "show-sec show-s1");
    ui.card1 = el("div", "show-card");
    ui.line1 = el("p", "show-line");
    ui.facts = el("dl", "show-facts");
    ui.card1.appendChild(ui.line1);
    ui.card1.appendChild(ui.facts);
    ui.s1.appendChild(ui.card1);
    // 3. try it
    ui.s2 = el("section", "show-sec show-s2");
    ui.card2 = el("div", "show-card");
    ui.line2 = el("p", "show-line");
    ui.try = el("div", "show-btns");
    ui.card2.appendChild(ui.line2);
    ui.card2.appendChild(ui.try);
    ui.s2.appendChild(ui.card2);
    // 4. ask
    ui.s3 = el("section", "show-sec show-s3");
    ui.card3 = el("div", "show-card");
    ui.line3 = el("p", "show-line");
    ui.ask = el("div", "show-btns");
    ui.card3.appendChild(ui.line3);
    ui.card3.appendChild(ui.ask);
    ui.s3.appendChild(ui.card3);
    [ui.hero, ui.s1, ui.s2, ui.s3].forEach(function (s) { ui.content.appendChild(s); });
    ui.track.appendChild(ui.content);
    ui.scroll.appendChild(ui.track);

    // next product
    ui.next = el("section", "show-next");
    ui.nextBtn = el("button", "show-next-btn");
    ui.nextBtn.type = "button";
    ui.nextImg = document.createElement("img");
    ui.nextImg.alt = "";
    ui.nextLabel = el("span", "show-next-label");
    ui.nextName = el("span", "show-next-name");
    ui.nextBtn.appendChild(ui.nextImg);
    var nt = el("span", "show-next-text");
    nt.appendChild(ui.nextLabel);
    nt.appendChild(ui.nextName);
    ui.nextBtn.appendChild(nt);
    ui.next.appendChild(ui.nextBtn);
    ui.scroll.appendChild(ui.next);
    stage.appendChild(ui.scroll);

    ui.top = el("div", "show-top");
    ui.bar = el("div", "show-bar");
    ui.barFill = el("i");
    ui.bar.appendChild(ui.barFill);
    ui.close = M.iconButton("show-x", "close", d.close);
    ui.close.addEventListener("click", close);
    ui.top.appendChild(ui.bar);
    ui.top.appendChild(ui.close);
    stage.appendChild(ui.top);

    ui.scroll.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    window.addEventListener("resize", function () { if (!stage.hidden) frame(); });
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add("in"); });
      }, { root: ui.scroll, threshold: 0.25 });
      [ui.card1, ui.card2, ui.card3, ui.next].forEach(function (n) { observer.observe(n); });
    }
  }

  /* ---------- the moving photo ---------- */
  function frame() {
    raf = 0;
    if (stage.hidden) return;
    var max = ui.track.offsetHeight - ui.scroll.clientHeight;
    var p = max > 0 ? Math.max(0, Math.min(1, ui.scroll.scrollTop / max)) : 0;
    ui.barFill.style.transform = "scaleX(" + Math.max(0, Math.min(1, ui.scroll.scrollTop / Math.max(1, ui.scroll.scrollHeight - ui.scroll.clientHeight))).toFixed(3) + ")";
    if (M.reducedMotion()) return;
    var wide = ui.scroll.clientWidth >= 860;
    var f = frameAt(wide ? DESK : PHONE, p);
    var rtl = document.documentElement.dir === "rtl" ? -1 : 1;
    ui.prod.style.transform = "translate(" + (f.x * rtl).toFixed(2) + "vw," + f.y.toFixed(2) + "vh) rotate(" + (f.r * rtl).toFixed(2) + "deg) rotateY(" + (f.ry * rtl).toFixed(1) + "deg) scale(" + f.s.toFixed(3) + ")";
    ui.ghost.style.transform = "translate(" + (-p * 70 * rtl).toFixed(2) + "vw,-50%)";
    ui.glow.style.opacity = (0.55 + 0.45 * Math.sin(p * Math.PI)).toFixed(3);
    ui.floor.style.opacity = (1 - Math.min(1, Math.abs(f.y) / 14)).toFixed(3);
    ui.hint.style.opacity = Math.max(0, 1 - p * 8).toFixed(3);
  }

  /* ---------- content ---------- */
  function fact(label, value) {
    if (!value) return;
    var wrap = el("div", "show-fact");
    wrap.appendChild(el("dt", null, label));
    var dd = el("dd", null, value);
    dd.dir = "auto";
    wrap.appendChild(dd);
    ui.facts.appendChild(wrap);
  }

  function sizeText(p) {
    var w = Number(p.sizeW), l = Number(p.sizeL);
    if (w > 0 && l > 0) return w + " × " + l + " cm";
    return "";
  }

  function render(p) {
    var d = t();
    product = p;
    var name = tr(p.name);
    var c = M.cutout(p);
    stage.classList.toggle("no-cut", !c);
    ui.img.src = c ? c.src : M.bigSrc(p);
    var series = "";
    if (p.series) {
      var s = (window.GYM_SERIES || []).filter(function (x) { return x.id === p.series; })[0];
      series = s ? s.name : "";
    }
    ui.eyebrow.textContent = [M.catName(p.cat), series].filter(Boolean).join(" · ");
    ui.name.textContent = name;
    ui.ghost.textContent = (typeof p.name === "string" ? p.name : (p.name.en || name)).toUpperCase();
    ui.hint.textContent = d.showScroll;
    stage.setAttribute("aria-label", name);

    ui.line1.textContent = d.showLineA;
    ui.facts.textContent = "";
    fact(p.series ? d.showCode : d.itemNo, p.no || "");
    fact(d.showCategory, M.catName(p.cat));
    fact(d.showSeries, series);
    fact(d.showSize, sizeText(p));
    ui.facts.hidden = !ui.facts.children.length;

    ui.line2.textContent = d.showLineB;
    ui.try.textContent = "";
    if (c && M.openCamera) {
      var cam = M.iconButton("show-btn is-gold", "camera", d.camOpen, true);
      cam.addEventListener("click", function () { M.openCamera(p, cam); });
      ui.try.appendChild(cam);
    }
    if (M.openPlanner) {
      var fit = M.iconButton("show-btn", "ruler", d.plannerOpen, true);
      fit.addEventListener("click", function () {
        M.openPlanner(fit);
        if (M.plannerAdd) M.plannerAdd(p);
      });
      ui.try.appendChild(fit);
    }
    ui.s2.hidden = !ui.try.children.length;

    ui.line3.textContent = d.showLineC;
    ui.ask.textContent = "";
    var price = el("a", "price-btn show-btn show-price");
    price.href = M.waUrl(d.askProduct(M.waProductName(p, name), p.no));
    price.target = "_blank";
    price.rel = "noopener noreferrer";
    price.setAttribute("data-product", p.image);
    price.innerHTML = M.WA_ICON;
    price.appendChild(el("span", null, d.priceBtn));
    ui.ask.appendChild(price);
    if (M.addToBasket) {
      var add = M.iconButton("show-btn", "basket", d.addToBasket, true);
      add.addEventListener("click", function () { M.addToBasket(p.image, 1); });
      ui.ask.appendChild(add);
    }
    if (p.video) {
      var vid = el("a", "show-btn");
      vid.href = p.video;
      vid.target = "_blank";
      vid.rel = "noopener noreferrer";
      vid.innerHTML = M.icon("play");
      vid.appendChild(el("span", "ib-label", d.videoBtn));
      ui.ask.appendChild(vid);
    }
    var share = M.iconButton("show-btn", "share", d.shareBtn, true);
    share.addEventListener("click", function () { M.shareProduct(p); });
    ui.ask.appendChild(share);

    // next star product
    var stars = M.starProducts();
    var i = stars.indexOf(p);
    var nextP = stars.length > 1 ? stars[(i + 1) % stars.length] : null;
    ui.next.hidden = !nextP;
    if (nextP) {
      var nc = M.cutout(nextP);
      ui.nextImg.src = nc ? nc.src : M.imgSrc(nextP);
      ui.nextLabel.textContent = d.showNext;
      ui.nextName.textContent = tr(nextP.name);
      ui.nextBtn.onclick = function () { switchTo(nextP); };
    }
    [ui.card1, ui.card2, ui.card3, ui.next].forEach(function (n) { n.classList.toggle("in", !observer); });
    M.setIconButtonLabel(ui.close, d.close);
  }

  function switchTo(p) {
    stage.classList.add("is-switching");
    setTimeout(function () {
      render(p);
      ui.scroll.scrollTop = 0;
      frame();
      stage.classList.remove("is-switching");
      replay();
      ui.scroll.focus({ preventScroll: true });
    }, M.reducedMotion() ? 0 : 280);
  }

  function replay() {
    stage.classList.remove("is-entering");
    void stage.offsetWidth;
    stage.classList.add("is-entering");
  }

  /* ---------- open / close ---------- */
  function open(p, opener) {
    if (!p) return;
    build();
    render(p);
    M.openStage(stage, opener || null, ui.scroll);
    ui.scroll.scrollTop = 0;
    frame();
    replay();
  }
  function close() { M.closeStage(stage); }
  stage.addEventListener("stage-close", function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } });

  M.openShow = open;

  /* ---------- home page row of star products ---------- */
  function renderStars() {
    var section = document.getElementById("starSection");
    var row = document.getElementById("starRow");
    if (!section || !row) return;
    var d = t();
    var stars = M.starProducts();
    row.textContent = "";
    stars.forEach(function (p) {
      var c = M.cutout(p);
      var b = el("button", "star-card" + (c ? "" : " no-cut"));
      b.type = "button";
      var img = document.createElement("img");
      img.src = c ? c.src : M.bigSrc(p);
      img.alt = "";
      img.loading = "lazy";
      b.appendChild(img);
      b.appendChild(el("span", "star-name", tr(p.name)));
      var go = el("span", "star-go");
      go.innerHTML = M.icon("sparkle", 16);
      go.appendChild(el("span", null, d.showOpen));
      b.appendChild(go);
      b.addEventListener("click", function () { open(p, b); });
      row.appendChild(b);
    });
    section.hidden = !stars.length;
  }
  M.onRender(function () {
    renderStars();
    if (built && !stage.hidden && product) render(product);
  });
  renderStars();
})();
