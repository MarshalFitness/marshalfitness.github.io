/* Marshal Fitness — extra features: "Open now" badge, "Healthy weight check", "Compare products".
   Loaded after script.js (which provides window.MF). Texts are in content.js. */
(function () {
  "use strict";

  var MF = window.MF;
  if (!MF) return;
  var S = MF.S;
  var t = MF.t;
  var tr = MF.tr;
  var el = MF.el;

  /* =====================================================================
     1. OPEN NOW badge (Erbil time = UTC+3, no daylight saving)
     ===================================================================== */

  function hm(text) {
    var parts = String(text).split(":");
    return { h: +parts[0] || 0, m: +parts[1] || 0, total: (+parts[0] || 0) * 60 + (+parts[1] || 0) };
  }

  function erbilNow() {
    var d = new Date(Date.now() + 3 * 3600 * 1000);
    return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }

  function openStatus() {
    var sch = S.schedule;
    if (!sch) return null;
    var dict = t();
    var open = hm(sch.open);
    var close = hm(sch.close);
    var closed = sch.closedDays || [];
    var now = erbilNow();
    var fmt = function (o) { return dict.time(o.h, o.m); };

    var openToday = closed.indexOf(now.day) === -1;
    if (openToday && now.min >= open.total && now.min < close.total) {
      if (close.total - now.min <= 60) return { state: "soon", text: dict.closingSoon(fmt(close)) };
      return { state: "open", text: dict.openNow(fmt(close)) };
    }
    if (openToday && now.min < open.total) return { state: "closed", text: dict.opensToday(fmt(open)) };

    for (var i = 1; i <= 7; i++) {
      var day = (now.day + i) % 7;
      if (closed.indexOf(day) !== -1) continue;
      if (i === 1) return { state: "closed", text: dict.opensTomorrow(fmt(open)) };
      return { state: "closed", text: dict.opensDay(dict.days[day], fmt(open)) };
    }
    return null;
  }

  function renderOpenBadge() {
    var status = openStatus();
    document.querySelectorAll(".open-badge").forEach(function (badge) {
      if (!status) { badge.hidden = true; return; }
      badge.hidden = false;
      badge.setAttribute("data-state", status.state);
      var text = status.text;
      if (new Date().getTimezoneOffset() !== -180) text += " (" + t().erbilTime + ")";
      badge.querySelector(".open-text").textContent = text;
    });
  }

  MF.onRender(renderOpenBadge);
  renderOpenBadge();
  window.setInterval(renderOpenBadge, 60 * 1000);

  var quiz = document.getElementById("quiz");
  var quizBody = document.getElementById("quizBody");
  var quizOpenBtn = document.getElementById("quizOpen");
  var foodQuery = "";

  function foodRow(dict, food) {
    var row = el("div", "food-row");
    row.appendChild(el("h3", "food-name", tr(food.name)));
    var grid = el("div", "food-grid");
    [
      [dict.foodCalories, food.cal, ""],
      [dict.foodProtein, food.protein, "g"],
      [dict.foodFat, food.fat, "g"],
      [dict.foodCarbs, food.carbs, "g"],
      [dict.foodFiber, food.fiber, "g"]
    ].forEach(function (item) {
      var cell = el("div", "food-cell");
      cell.appendChild(el("span", "food-value", item[1] + item[2]));
      cell.appendChild(el("span", "food-label", item[0]));
      grid.appendChild(cell);
    });
    row.appendChild(grid);
    var ask = el("a", "text-link", dict.mealAsk);
    ask.target = "_blank"; ask.rel = "noopener noreferrer";
    ask.href = MF.waUrl(dict.foodWa(tr(food.name)));
    row.appendChild(ask);
    return row;
  }

  function renderFoodList() {
    var dict = t();
    quizBody.textContent = "";
    quizBody.appendChild(el("p", "panel-note", dict.mealIntro));

    var searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "search-input food-search";
    searchInput.autocomplete = "off";
    searchInput.placeholder = dict.foodSearchPlaceholder;
    searchInput.setAttribute("aria-label", dict.foodSearchPlaceholder);
    searchInput.value = foodQuery;
    quizBody.appendChild(searchInput);

    quizBody.appendChild(el("p", "food-per", dict.foodPer));

    var list = el("div", "food-list");
    quizBody.appendChild(list);

    function renderResults() {
      list.textContent = "";
      var q = foodQuery.trim().toLowerCase();
      var items = window.FOOD_DATA;
      if (q) {
        items = items.filter(function (f) { return tr(f.name).toLowerCase().indexOf(q) !== -1; });
      }
      if (!items.length) {
        list.appendChild(el("p", "panel-note", dict.foodNoResults));
        return;
      }
      items.slice(0, 25).forEach(function (f) { list.appendChild(foodRow(dict, f)); });
    }
    searchInput.addEventListener("input", function () {
      foodQuery = searchInput.value;
      renderResults();
    });
    renderResults();
  }

  if (quiz && quizBody) {
    if (quizOpenBtn) quizOpenBtn.addEventListener("click", function () {
      foodQuery = "";
      renderFoodList();
      MF.openModal(quiz, quizOpenBtn);
    });
    // on food.html, #quiz is a plain page section (not a modal), so render right away
    if (!quiz.classList.contains("lightbox")) renderFoodList();
    MF.onRender(function () { if (!quiz.hidden) renderFoodList(); });
  }

  /* =====================================================================
     3. COMPARE PRODUCTS — one button opens a picker; pick exactly 2;
        then see both side by side with photos and any matching specs.
     ===================================================================== */

  var cmp = document.getElementById("compare");
  var cmpBody = document.getElementById("cmpBody");
  var cmpOpenBtn = document.getElementById("compareOpen");
  var pickIds = [];
  var pickQuery = "";
  var pickCat = "all";

  function specValue(p, id) {
    var v = p.specs && p.specs[id];
    return v === undefined || v === "" ? "" : tr(v);
  }

  function renderPicker() {
    var dict = t();
    cmpBody.textContent = "";
    cmpBody.appendChild(el("p", "panel-note", dict.comparePickHint));

    var count = el("p", "compare-count", dict.compareSelected(pickIds.length));
    cmpBody.appendChild(count);

    var searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "search-input pick-search";
    searchInput.autocomplete = "off";
    searchInput.placeholder = dict.searchPlaceholder;
    searchInput.setAttribute("aria-label", dict.searchLabel);
    searchInput.value = pickQuery;
    searchInput.addEventListener("input", function () {
      pickQuery = searchInput.value;
      renderPickList();
    });
    cmpBody.appendChild(searchInput);

    var chipRow = el("div", "pick-cats");
    function catChip(id, label) {
      var b = el("button", "chip", label);
      b.type = "button";
      b.setAttribute("aria-pressed", id === pickCat ? "true" : "false");
      b.addEventListener("click", function () {
        pickCat = id;
        renderPicker();
      });
      chipRow.appendChild(b);
    }
    catChip("all", dict.all);
    MF.CATS.forEach(function (c) { catChip(c.id, tr(c.name)); });
    cmpBody.appendChild(chipRow);

    var list = el("div", "pick-list");
    cmpBody.appendChild(list);
    renderPickList();

    var row2 = el("div", "quiz-nav");
    var go = el("button", "btn", dict.compareConfirm);
    go.type = "button";
    go.disabled = pickIds.length !== 2;
    go.addEventListener("click", renderTable);
    row2.appendChild(go);
    cmpBody.appendChild(row2);

    function renderPickList() {
      list.textContent = "";
      var q = pickQuery.trim().toLowerCase();
      var matches = MF.PRODUCTS.filter(function (p) {
        if (pickCat !== "all" && p.cat !== pickCat) return false;
        if (!q) return true;
        var name = tr(p.name).toLowerCase();
        var no = (p.no || "").toLowerCase();
        return name.indexOf(q) !== -1 || no.indexOf(q) !== -1;
      });
      if (!matches.length) {
        list.appendChild(el("p", "panel-note", dict.noResults));
        return;
      }
      matches.forEach(function (p) {
        var name = tr(p.name);
        var row = el("button", "pick-row");
        row.type = "button";
        row.setAttribute("aria-pressed", pickIds.indexOf(p.image) !== -1 ? "true" : "false");

        var img = document.createElement("img");
        img.src = p.imageData || (S.imageBase + p.image);
        img.alt = "";
        img.loading = "lazy";
        img.addEventListener("error", function () { img.remove(); });
        row.appendChild(img);
        row.appendChild(el("span", "pick-name", name));
        row.appendChild(el("span", "pick-check", "✓"));

        row.addEventListener("click", function () {
          var i = pickIds.indexOf(p.image);
          if (i !== -1) pickIds.splice(i, 1);
          else if (pickIds.length < 2) pickIds.push(p.image);
          renderPickList();
          count.textContent = dict.compareSelected(pickIds.length);
          go.disabled = pickIds.length !== 2;
        });
        list.appendChild(row);
      });
    }
  }

  function productById(id) {
    return MF.PRODUCTS.filter(function (p) { return p.image === id; })[0];
  }

  function renderTable() {
    var dict = t();
    var items = pickIds.map(productById).filter(Boolean);
    cmpBody.textContent = "";

    var grid = el("div", "compare-grid");

    function cell(className, child) {
      var d = el("div", className);
      if (className === "cmp-value") d.dir = "auto";
      if (child) d.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      grid.appendChild(d);
      return d;
    }
    function row(label, values) {
      cell("cmp-label", label);
      values.forEach(function (v) { cell("cmp-value", v || "–"); });
    }

    cell("cmp-label", "");
    items.forEach(function (p) {
      var box = el("div", "cmp-head");
      var img = document.createElement("img");
      img.src = p.imageData || (S.imageBase + p.image);
      img.alt = tr(p.name);
      img.loading = "lazy";
      box.appendChild(img);
      box.appendChild(el("strong", null, tr(p.name)));
      cell("cmp-value", box);
    });

    var catName = function (p) {
      var c = MF.CATS.filter(function (x) { return x.id === p.cat; })[0];
      return c ? tr(c.name) : "";
    };
    row(dict.compareCategory, items.map(catName));
    if (items.some(function (p) { return p.no; })) {
      row(dict.itemNo, items.map(function (p) { return p.no || ""; }));
    }
    if (items.some(function (p) { return p.stock; })) {
      row(dict.compareAvail, items.map(function (p) { return p.stock ? dict.stock[p.stock] : ""; }));
    }

    var seen = {};
    var specRows = 0;
    items.forEach(function (p) {
      (window.SPEC_FIELDS[p.cat] || []).forEach(function (f) {
        if (seen[f.id]) return;
        seen[f.id] = true;
        if (items.some(function (q) { return specValue(q, f.id); })) {
          row(tr(f.label), items.map(function (q) { return specValue(q, f.id); }));
          specRows += 1;
        }
      });
    });

    cell("cmp-label", "");
    items.forEach(function (p) {
      var a = el("a", "price-btn");
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      var seriesInfo = p.series && window.GYM_SERIES ? window.GYM_SERIES.filter(function (x) { return x.id === p.series; })[0] : null;
      var cmpName = seriesInfo ? seriesInfo.name + " " + tr(p.name) : tr(p.name);
      a.href = MF.waUrl(dict.askProduct(cmpName, p.no));
      a.setAttribute("data-product", p.image);
      a.innerHTML = MF.WA_ICON;
      a.appendChild(el("span", null, dict.priceBtn));
      cell("cmp-value", a);
    });

    cmpBody.appendChild(grid);
    if (!specRows) cmpBody.appendChild(el("p", "panel-note", dict.compareNoSpecs));

    var back = el("button", "btn btn-outline", dict.compareChange);
    back.type = "button";
    back.addEventListener("click", renderPicker);
    var row3 = el("div", "quiz-nav");
    row3.appendChild(back);
    cmpBody.appendChild(row3);
  }

  if (cmp && cmpOpenBtn) {
    cmpOpenBtn.addEventListener("click", function () {
      pickIds = [];
      renderPicker();
      MF.openModal(cmp, cmpOpenBtn);
    });
    MF.onRender(function () { if (!cmp.hidden) renderPicker(); });
    // arriving from another page via "...#compare" opens the picker right away
    if (window.location.hash === "#compare") cmpOpenBtn.click();
  }

  /* =====================================================================
     4. PAYMENT METHODS (Contact page)
     ===================================================================== */

  var paymentBody = document.getElementById("paymentBody");
  function renderPayments() {
    if (!paymentBody || !window.PAYMENT_METHODS) return;
    var dict = t();
    paymentBody.textContent = "";
    paymentBody.appendChild(el("h2", null, dict.paymentTitle));
    var grid = el("div", "payment-grid");
    window.PAYMENT_METHODS.forEach(function (m) {
      var card = el("article", "payment-card");
      card.appendChild(el("h3", null, tr(m.name)));
      card.appendChild(el("p", null, tr(m.note)));
      grid.appendChild(card);
    });
    paymentBody.appendChild(grid);
  }
  if (paymentBody) { renderPayments(); MF.onRender(renderPayments); }

  /* =====================================================================
     5. FAQ (Contact page)
     ===================================================================== */

  var faqBody = document.getElementById("faqBody");
  function renderFaq() {
    if (!faqBody || !window.FAQ_DATA) return;
    var dict = t();
    faqBody.textContent = "";
    faqBody.appendChild(el("h2", null, dict.faqTitle));
    window.FAQ_DATA.forEach(function (item) {
      var details = document.createElement("details");
      details.className = "faq-item";
      var summary = document.createElement("summary");
      summary.textContent = tr(item.q);
      details.appendChild(summary);
      details.appendChild(el("p", null, tr(item.a)));
      faqBody.appendChild(details);
    });
  }
  if (faqBody) { renderFaq(); MF.onRender(renderFaq); }
})();
