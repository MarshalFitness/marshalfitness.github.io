/* Marshal Fitness — version 22: "Home gym vs gym membership" calculator.
   The family writes how many people train, the monthly gym price and the price
   of their home gym. The page shows when the home gym pays for itself, the money
   saved after 1, 3 and 5 years (with a small chart) and the time saved.
   Admin can set the dollar rate and the usual gym price (content/money). */
(function () {
  "use strict";
  var M = window.MF;
  if (!M || !M.makeWindow) return;
  var el = M.el;
  function t() { return M.t(); }

  var KEY = "mf-savings";
  function defaults() {
    var m = window.MONEY_EDIT || {};
    return { people: 2, member: Number(m.member) || 40000, cost: "", cur: "usd", rate: Number(m.rate) || 1400, minutes: 15, visits: 4, ride: 0 };
  }
  function load() {
    var s = defaults();
    try {
      var raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") Object.keys(s).forEach(function (k) { if (raw[k] !== undefined && raw[k] !== null) s[k] = raw[k]; });
    } catch (e) { /* ignore */ }
    if (s.cur !== "usd" && s.cur !== "iqd") s.cur = "usd";
    return s;
  }
  var s = load();
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
  function num(v) { var n = parseFloat(String(v).replace(/[^\d.]/g, "")); return isFinite(n) ? n : 0; }

  // all money in Iraqi dinar
  function calc() {
    var people = Math.max(1, Math.min(10, Math.round(num(s.people)) || 1));
    var monthly = people * num(s.member) + people * num(s.visits) * 4.33 * num(s.ride);
    var cost = num(s.cost) * (s.cur === "usd" ? Math.max(1, num(s.rate)) : 1);
    var months = monthly > 0 && cost > 0 ? cost / monthly : null;
    var hours = people * num(s.visits) * 4.33 * 2 * num(s.minutes) / 60;
    var save1 = monthly * 12 - cost, save3 = monthly * 36 - cost, save5 = monthly * 60 - cost;
    return { people: people, monthly: monthly, cost: cost, months: months, hours: hours, y: [[1, monthly * 12, save1], [3, monthly * 36, save3], [5, monthly * 60, save5]] };
  }
  function iqd(n) { return M.money(n) + " " + t().svIQD; }
  function short(n) {
    var d = t();
    if (Math.abs(n) >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString("en-US") + " " + d.svMillion;
    return M.money(n);
  }

  var w = M.makeWindow("savingsModal", "sv-panel");
  var out = null, ui = {};

  function input(key, attrs, onInput) {
    var i = el("input", "in22");
    Object.keys(attrs || {}).forEach(function (k) { i.setAttribute(k, attrs[k]); });
    i.value = s[key];
    i.addEventListener("input", function () { s[key] = i.value; save(); (onInput || show)(); });
    return i;
  }

  function draw() {
    var d = t();
    w.title.textContent = d.svTitle;
    w.body.textContent = "";
    w.body.appendChild(el("p", "panel-note", d.svIntro));
    var form = el("div", "gp-form sv-form");
    // people
    var pf = el("div", "f22");
    pf.appendChild(el("span", "f22-label", d.svPeople));
    var step = el("div", "gp-qty sv-people");
    var minus = el("button", "qty-btn", "−"), plus = el("button", "qty-btn", "+"), val = el("span", "qty-val", String(s.people));
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", d.svLess);
    plus.setAttribute("aria-label", d.svMore);
    var setP = function (n) { s.people = Math.max(1, Math.min(10, n)); val.textContent = String(s.people); save(); show(); };
    minus.addEventListener("click", function () { setP(num(s.people) - 1); });
    plus.addEventListener("click", function () { setP(num(s.people) + 1); });
    step.appendChild(minus); step.appendChild(val); step.appendChild(plus);
    pf.appendChild(step);
    form.appendChild(pf);
    form.appendChild(M.field(d.svMember, input("member", { type: "number", min: "0", step: "1000", inputmode: "numeric" }), d.svMemberHint));
    // home gym price + currency
    var cf = el("div", "f22");
    cf.appendChild(el("span", "f22-label", d.svCost));
    var crow = el("div", "sv-cost");
    var cost = input("cost", { type: "number", min: "0", step: "1", inputmode: "decimal", placeholder: d.svCostHint });
    cost.setAttribute("aria-label", d.svCost);
    var cur = el("select", "in22 sv-cur");
    cur.setAttribute("aria-label", d.svCurrency);
    [["usd", "$"], ["iqd", d.svIQD]].forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; if (s.cur === o[0]) op.selected = true; cur.appendChild(op); });
    cur.addEventListener("change", function () { s.cur = cur.value; save(); rateWrap.hidden = s.cur !== "usd"; show(); });
    crow.appendChild(cost); crow.appendChild(cur);
    cf.appendChild(crow);
    var ask = el("button", "sv-ask", d.svNoPrice);
    ask.type = "button";
    ask.addEventListener("click", function () { askPrice(ask); });
    cf.appendChild(ask);
    form.appendChild(cf);
    var rateWrap = M.field(d.svRate, input("rate", { type: "number", min: "1", step: "1", inputmode: "numeric" }));
    rateWrap.hidden = s.cur !== "usd";
    form.appendChild(rateWrap);
    // travel
    var more = el("details", "sv-more f22-wide");
    more.appendChild(el("summary", "", d.svTravel));
    var mg = el("div", "gp-form");
    mg.appendChild(M.field(d.svMinutes, input("minutes", { type: "number", min: "0", max: "240", step: "1", inputmode: "numeric" })));
    mg.appendChild(M.field(d.svVisits, input("visits", { type: "number", min: "0", max: "14", step: "1", inputmode: "numeric" })));
    mg.appendChild(M.field(d.svRide, input("ride", { type: "number", min: "0", step: "250", inputmode: "numeric" })));
    more.appendChild(mg);
    form.appendChild(more);
    w.body.appendChild(form);
    out = el("div", "sv-out");
    out.setAttribute("aria-live", "polite");
    w.body.appendChild(out);
    var acts = el("div", "gp-actions");
    var share = el("button", "btn btn-outline sv-share", d.svShare);
    share.type = "button";
    share.addEventListener("click", function () {
      var r = calc(), text = summary(r);
      if (navigator.share) navigator.share({ text: text + "\n" + M.S.siteUrl }).catch(function () {});
      else window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + M.S.siteUrl), "_blank", "noopener");
    });
    var rooms = el("button", "btn btn-outline sv-rooms", d.svRooms);
    rooms.type = "button";
    rooms.addEventListener("click", function () {
      M.closeModal(true);
      var sec = document.getElementById("roomsSection");
      if (sec) sec.scrollIntoView({ behavior: "auto", block: "start" });
      var first = sec && sec.querySelector(".room-card");
      if (first) first.focus({ preventScroll: true });
    });
    acts.appendChild(share); acts.appendChild(rooms);
    w.body.appendChild(acts);
    show();
  }

  function summary(r) {
    var d = t();
    if (r.months === null) return d.svShareNoCost(iqd(r.monthly));
    return d.svShareText(iqd(r.monthly), monthsText(r.months), iqd(Math.max(0, r.y[2][2])));
  }
  function monthsText(m) {
    var d = t();
    var whole = Math.max(1, Math.ceil(m));
    if (whole < 24) return d.svMonths(whole);
    return d.svYearsMonths(Math.floor(whole / 12), whole % 12);
  }

  function show() {
    if (!out) return;
    var d = t(), r = calc();
    out.textContent = "";
    var big = el("div", "sv-big");
    if (r.months !== null) {
      big.appendChild(el("span", "sv-big-label", d.svPays));
      big.appendChild(el("b", "sv-big-num", monthsText(r.months)));
    } else {
      big.appendChild(el("span", "sv-big-label", d.svNeedCost));
    }
    out.appendChild(big);
    var facts = el("ul", "sv-facts");
    var li = function (a, b) { var x = el("li"); x.appendChild(el("span", "", a)); x.appendChild(el("b", "", b)); facts.appendChild(x); };
    li(d.svMonthly, iqd(r.monthly));
    li(d.svYearly, iqd(r.monthly * 12));
    if (r.cost > 0) li(d.svHome, iqd(r.cost));
    if (r.hours > 0) li(d.svTime, d.svHours(Math.round(r.hours)));
    out.appendChild(facts);
    if (r.cost > 0) {
      // chart: gym membership (grows) vs home gym (paid once)
      var max = Math.max(r.y[2][1], r.cost) || 1;
      var chart = el("div", "sv-chart");
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", r.y.map(function (y) { return d.svAfter(y[0]) + ": " + d.svGym + " " + iqd(y[1]) + ", " + d.svHomeShort + " " + iqd(r.cost); }).join(". "));
      r.y.forEach(function (y) {
        var col = el("div", "sv-col");
        var bars = el("div", "sv-bars");
        var b1 = el("span", "sv-bar sv-bar-gym"); b1.style.height = Math.max(2, 100 * y[1] / max) + "%";
        var b2 = el("span", "sv-bar sv-bar-home"); b2.style.height = Math.max(2, 100 * r.cost / max) + "%";
        bars.appendChild(b1); bars.appendChild(b2);
        col.appendChild(bars);
        col.appendChild(el("span", "sv-col-label", d.svAfter(y[0])));
        var saveTxt = y[2] >= 0 ? d.svSave(short(y[2])) : d.svNotYet;
        col.appendChild(el("span", "sv-col-save" + (y[2] >= 0 ? "" : " sv-neg"), saveTxt));
        chart.appendChild(col);
      });
      out.appendChild(chart);
      var key = el("p", "sv-key");
      key.appendChild(el("span", "sv-dot sv-bar-gym"));
      key.appendChild(document.createTextNode(" " + d.svGym + "   "));
      key.appendChild(el("span", "sv-dot sv-bar-home"));
      key.appendChild(document.createTextNode(" " + d.svHomeShort));
      out.appendChild(key);
    }
    out.appendChild(el("p", "f22-hint", d.svNote));
  }

  function askPrice(opener) {
    var d = t();
    var items = M.basketItems ? M.basketItems() : [];
    var msg = d.svAskMsg + (items.length ? "\n\n" + items.map(function (x, i) {
      var p = M.productByImage(x.id);
      return p ? (i + 1) + ". " + M.waProductName(p) + (p.no ? " (" + p.no + ")" : "") + " × " + x.qty : "";
    }).filter(Boolean).join("\n") : "");
    if (window.MF_REQUEST) {
      window.MF_REQUEST.open({ kind: "savings", item: d.svTitle, message: msg,
        items: items.map(function (x) { var p = M.productByImage(x.id); return p ? { name: M.waProductName(p), no: p.no || "", qty: x.qty } : null; }).filter(Boolean) }, opener);
    }
  }

  M.openSavings = function (opener) {
    draw();
    M.openModal(w.modal, opener || null, w.body.querySelector(".sv-people .qty-btn:last-child"));
  };
  M.onRender(function () { if (!w.modal.hidden) draw(); });
})();
