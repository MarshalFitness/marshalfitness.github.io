/* Marshal Fitness — smart helper.
   Asks 3 quick questions (goal, place, space) and suggests products from the
   catalog. It is a guided helper with fixed rules, not real AI. */
(function () {
  "use strict";
  var M = window.MF;
  var modal = document.getElementById("helperModal");
  var chat = document.getElementById("helperChat");
  if (!M || !modal || !chat) return;

  var answers = {};
  var step = 0;
  var backToHelper = false; // after looking at a suggested product, come back to the results

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }
  function en(p) { return String(typeof p.name === "string" ? p.name : (p.name.en || "")).toLowerCase(); }
  function has(p, word) { return new RegExp("\\b" + word).test(en(p)); }

  /* ---------- which products to suggest ---------- */
  var M_ = {
    treadmill: function (p) { return p.cat === "treadmills"; },
    bike: function (p) { return p.cat === "bikes"; },
    bench: function (p) { return p.cat !== "gym-equipment" && has(p, "bench"); },
    dumbbell: function (p) { return has(p, "dumbbell"); },
    barbell: function (p) { return has(p, "barbell"); },
    plates: function (p) { return p.cat !== "gym-equipment" && has(p, "plate"); },
    mat: function (p) { return has(p, "mat"); },
    bands: function (p) { return has(p, "band"); },
    ball: function (p) { return has(p, "ball"); },
    handle: function (p) { return has(p, "handle"); },
    gym: function (word) { return function (p) { return p.cat === "gym-equipment" && has(p, word); }; },
    anyGym: function (p) { return p.cat === "gym-equipment"; },
    accessory: function (p) { return p.cat === "accessories"; },
    weights: function (p) { return p.cat === "free-weights"; }
  };

  function plan(a) {
    var g = a.goal, home = a.place === "home", sp = a.space;
    if (!home) {
      if (g === "cardio") return [M_.treadmill, M_.treadmill, M_.bike, M_.gym("leg press"), M_.gym("pull down"), M_.mat];
      if (g === "strength") return [M_.gym("chest press"), M_.gym("pull down"), M_.gym("leg press"), M_.gym("smith"), M_.gym("row"), M_.barbell, M_.plates];
      return [M_.treadmill, M_.bike, M_.gym("chest press"), M_.gym("pull down"), M_.gym("leg press"), M_.dumbbell];
    }
    if (g === "cardio") {
      if (sp === "small") return [M_.bike, M_.mat, M_.bands, M_.ball];
      if (sp === "medium") return [M_.treadmill, M_.bike, M_.mat, M_.bands];
      return [M_.treadmill, M_.treadmill, M_.bike, M_.mat, M_.bands];
    }
    if (g === "strength") {
      if (sp === "small") return [M_.dumbbell, M_.bands, M_.handle, M_.mat];
      if (sp === "medium") return [M_.bench, M_.dumbbell, M_.barbell, M_.plates, M_.mat];
      return [M_.bench, M_.barbell, M_.plates, M_.plates, M_.dumbbell, M_.mat];
    }
    if (sp === "small") return [M_.bike, M_.dumbbell, M_.bands, M_.mat];
    if (sp === "medium") return [M_.treadmill, M_.bench, M_.dumbbell, M_.mat, M_.bands];
    return [M_.treadmill, M_.bike, M_.bench, M_.dumbbell, M_.barbell, M_.plates];
  }

  function suggest(a) {
    var picks = [];
    plan(a).forEach(function (test) {
      if (picks.length >= 6) return;
      var p = M.PRODUCTS.filter(function (q) { return picks.indexOf(q) === -1 && test(q); })[0];
      if (p) picks.push(p);
    });
    if (picks.length < 3) {
      M.PRODUCTS.forEach(function (q) {
        if (picks.length < 4 && q.badge === "popular" && picks.indexOf(q) === -1) picks.push(q);
      });
    }
    return picks;
  }

  /* ---------- chat ---------- */
  function bubble(text, who) {
    var b = M.el("div", "hc-msg hc-" + (who || "bot"), text);
    chat.appendChild(b);
    return b;
  }

  function choices(list, onPick) {
    var row = M.el("div", "hc-choices");
    list.forEach(function (c) {
      var b = M.el("button", "hc-choice", c[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        row.remove();
        bubble(c[1], "me");
        onPick(c[0]);
      });
      row.appendChild(b);
    });
    chat.appendChild(row);
    var first = row.querySelector("button");
    if (first) first.focus({ preventScroll: true });
    scrollDown();
  }

  function scrollDown() {
    var panel = modal.querySelector(".lightbox-panel");
    if (panel) panel.scrollTop = panel.scrollHeight;
  }

  function ask() {
    var d = t();
    if (step === 0) {
      bubble(d.helperQ1);
      choices([["cardio", d.helperGoalCardio], ["strength", d.helperGoalStrength], ["both", d.helperGoalBoth]],
        function (v) { answers.goal = v; step = 1; ask(); });
    } else if (step === 1) {
      bubble(d.helperQ2);
      choices([["home", d.helperHome], ["gym", d.helperGym]],
        function (v) { answers.place = v; step = v === "gym" ? 3 : 2; if (v === "gym") answers.space = "large"; ask(); });
    } else if (step === 2) {
      bubble(d.helperQ3);
      choices([["small", d.helperSmall], ["medium", d.helperMedium], ["large", d.helperLarge]],
        function (v) { answers.space = v; step = 3; ask(); });
    } else {
      showResult();
    }
  }

  function showResult() {
    var d = t();
    var picks = suggest(answers);
    bubble(d.helperResult);
    var grid = M.el("div", "hc-results");
    picks.forEach(function (p) {
      var card = M.el("div", "hc-card");
      var view = M.el("button", "hc-view");
      view.type = "button";
      var img = document.createElement("img");
      img.src = p.imageData || (M.S.imageBase + (p.thumbnail || p.image));
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      view.appendChild(img);
      view.appendChild(M.el("span", "hc-name", tr(p.name)));
      view.setAttribute("aria-label", d.zoomAria(tr(p.name)));
      view.addEventListener("click", function () {
        backToHelper = true;
        M.openLightbox(p, document.getElementById("helperOpen"));
      });
      card.appendChild(view);
      var add = M.el("button", "hc-add", d.addToBasket);
      add.type = "button";
      add.addEventListener("click", function () {
        if (M.addToBasket) M.addToBasket(p.image, 1, true);
        add.textContent = "✓ " + d.inBasket;
        add.disabled = true;
      });
      card.appendChild(add);
      grid.appendChild(card);
    });
    chat.appendChild(grid);

    var actions = M.el("div", "hc-actions");
    var all = M.el("button", "btn", d.helperAddAll);
    all.type = "button";
    all.addEventListener("click", function () {
      picks.forEach(function (p) { if (M.addToBasket) M.addToBasket(p.image, 1, true); });
      grid.querySelectorAll(".hc-add").forEach(function (b) { b.textContent = "✓ " + d.inBasket; b.disabled = true; });
      M.closeModal();
      if (M.openBasket) M.openBasket(document.getElementById("basketBtn"));
    });
    actions.appendChild(all);

    var askBtn = M.el("button", "btn btn-outline", d.helperAsk);
    askBtn.type = "button";
    askBtn.addEventListener("click", function () {
      var lines = [d.helperWaIntro, ""];
      picks.forEach(function (p, i) {
        lines.push((i + 1) + ". " + M.waProductName(p, tr(p.name)) + (p.no ? " (" + d.itemNo + " " + p.no + ")" : ""));
      });
      var message = lines.join("\n");
      if (window.MF_REQUEST) {
        window.MF_REQUEST.open({
          kind: "helper", message: message, item: d.helperTitle,
          items: picks.map(function (p) { return { name: M.waProductName(p, tr(p.name)), no: p.no || "", qty: 1, image: p.image }; })
        }, askBtn);
      } else {
        window.open(M.waUrl(message), "_blank", "noopener");
      }
    });
    actions.appendChild(askBtn);

    var again = M.el("button", "hc-restart", d.helperRestart);
    again.type = "button";
    again.addEventListener("click", start);
    actions.appendChild(again);
    chat.appendChild(actions);
    chat.appendChild(M.el("p", "panel-note", d.helperNote));
    scrollDown();
  }

  function start() {
    answers = {};
    step = 0;
    chat.textContent = "";
    bubble(t().helperHi);
    ask();
    var panel = modal.querySelector(".lightbox-panel");
    if (panel) panel.scrollTop = 0;
  }

  function open(opener) {
    if (M.hideHelpBubble) M.hideHelpBubble();
    M.openModal(modal, opener || null, document.getElementById("helperClose"));
    start();
  }
  M.openHelper = open;

  var lb = document.getElementById("lightbox");
  var req = document.getElementById("reqModal");
  if (lb) lb.addEventListener("modal-close", function () {
    if (!backToHelper) return;
    setTimeout(function () {
      if (req && !req.hidden) return; // price form opened over the photo: decide when it closes
      backToHelper = false;
      // only if no other window (basket, camera, …) took its place
      var rootCls = document.documentElement.classList;
      if (!rootCls.contains("lb-open") && !rootCls.contains("stage-open")) {
        M.openModal(modal, null, document.getElementById("helperClose"));
        scrollDown();
      }
    }, 0);
  });
  if (req) req.addEventListener("modal-close", function () {
    if (!backToHelper) return;
    setTimeout(function () {
      // form cancelled -> the photo comes back (keep the flag); form sent -> forget it
      if (!lb || lb.hidden) backToHelper = false;
    }, 20);
  });

  ["helperOpen", "navHelperOpen"].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { open(b); });
  });
  document.getElementById("helperClose").addEventListener("click", function () { M.closeModal(); });
  M.onRender(function () { if (!modal.hidden) start(); });
})();
