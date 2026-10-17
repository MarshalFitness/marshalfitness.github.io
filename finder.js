/* Marshal Fitness — smart search (photo suggestions while typing) and voice search.
   The normal search filter in script.js keeps working; this adds a drop-down list. */
(function () {
  "use strict";
  var M = window.MF;
  var input = document.getElementById("search");
  var box = document.getElementById("searchSuggest");
  if (!M || !input || !box) return;

  var MAX = 6;
  var active = -1;
  var matches = [];

  function t() { return M.t(); }
  function tr(v) { return M.tr(v); }

  /* ---------- suggestions ---------- */

  function find(q) {
    var nq = M.normalize(q);
    if (!nq) return [];
    var scored = [];
    M.PRODUCTS.forEach(function (p) {
      var name = M.normalize(tr(p.name));
      var hay = M.searchText(p);
      var no = M.normalize(p.no || "");
      var score = -1;
      if (no && no === nq) score = 0;
      else if (name.indexOf(nq) === 0) score = 1;
      else if (name.indexOf(" " + nq) !== -1) score = 2;
      else if (name.indexOf(nq) !== -1) score = 3;
      else if (hay.indexOf(nq) !== -1) score = 4;
      if (score >= 0) scored.push({ p: p, s: score });
    });
    scored.sort(function (a, b) { return a.s - b.s; });
    return scored.slice(0, MAX).map(function (x) { return x.p; });
  }

  function close() {
    box.hidden = true;
    box.textContent = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
    matches = [];
  }

  function setActive(i) {
    var opts = box.querySelectorAll(".sg-item");
    opts.forEach(function (o, k) { o.setAttribute("aria-selected", k === i ? "true" : "false"); });
    active = i;
    if (i >= 0 && opts[i]) {
      input.setAttribute("aria-activedescendant", opts[i].id);
      opts[i].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  var skipNextFocus = false;

  function choose(p) {
    close();
    input.blur();
    // when the photo closes, go back to the product card (not the search box, which
    // would open the phone keyboard); if the card is not on screen, nothing is focused
    var esc = window.CSS && CSS.escape ? CSS.escape(p.image) : p.image;
    var card = document.querySelector('#products .product-card[data-product="' + esc + '"]:not([hidden]) .product-media');
    skipNextFocus = !card;
    M.openLightbox(p, card || input);
  }

  function render() {
    var q = input.value.trim();
    matches = q ? find(q) : [];
    box.textContent = "";
    active = -1;
    if (!matches.length) { close(); return; }
    var d = t();
    matches.forEach(function (p, i) {
      var opt = M.el("div", "sg-item");
      opt.id = "sg-opt-" + i;
      opt.setAttribute("role", "option");
      opt.setAttribute("aria-selected", "false");
      var img = document.createElement("img");
      img.src = p.imageData || (M.S.imageBase + (p.thumbnail || p.image));
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.style.visibility = "hidden"; });
      opt.appendChild(img);
      var text = M.el("span", "sg-text");
      text.appendChild(M.el("span", "sg-name", tr(p.name)));
      var meta = M.catName(p.cat) + (p.no ? " · " + (p.series ? window.GYM_COPY[M.lang()].code : d.itemNo) + " " + p.no : "");
      var metaEl = M.el("span", "sg-meta", meta);
      metaEl.dir = "auto";
      text.appendChild(metaEl);
      opt.appendChild(text);
      // mousedown (not click) so the input does not lose the list before the choice is made
      opt.addEventListener("mousedown", function (e) { e.preventDefault(); });
      opt.addEventListener("click", function () { choose(p); });
      opt.addEventListener("mousemove", function () { if (active !== i) setActive(i); });
      box.appendChild(opt);
    });
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  var lbox = document.getElementById("lightbox");
  if (lbox) lbox.addEventListener("modal-close", function () { setTimeout(function () { skipNextFocus = false; }, 60); });

  input.addEventListener("input", render);
  input.addEventListener("focus", function () {
    if (skipNextFocus) { skipNextFocus = false; return; }
    if (input.value.trim()) render();
  });
  input.addEventListener("blur", function () { setTimeout(close, 150); });
  input.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(matches.length - 1, active + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
    else if (e.key === "Enter") {
      if (active >= 0 && matches[active]) { e.preventDefault(); choose(matches[active]); }
      else close();
    } else if (e.key === "Escape") { e.stopPropagation(); close(); }
  });
  document.addEventListener("click", function (e) {
    if (!box.hidden && !document.getElementById("searchBox").contains(e.target)) close();
  });
  M.onRender(function () { if (!box.hidden) render(); });

  /* ---------- voice search ---------- */

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var mic = document.getElementById("voiceBtn");
  var status = document.getElementById("voiceStatus");
  if (!SR || !mic) return;
  mic.hidden = false;
  document.getElementById("searchBox").classList.add("has-mic");

  var rec = null;
  var listening = false;
  var statusTimer = null;
  var LANGS = { en: "en-US", ar: "ar-IQ", ckb: "ckb-IQ" };

  function say(text, keep) {
    if (!status) return;
    clearTimeout(statusTimer);
    status.textContent = text;
    status.hidden = !text;
    if (text && !keep) statusTimer = setTimeout(function () { status.hidden = true; }, 4500);
  }

  function stop() {
    listening = false;
    mic.classList.remove("is-listening");
    mic.setAttribute("aria-pressed", "false");
    if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } }
    rec = null;
  }

  function start(langCode, retried) {
    stop();
    var self;
    try { self = new SR(); } catch (e) { say(t().voiceError); return; }
    rec = self;
    rec.lang = langCode;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    var gotResult = false;
    rec.onresult = function (ev) {
      if (rec !== self) return;
      var text = "";
      for (var i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      text = text.replace(/[.?!،؟]+$/, "").trim();
      if (!text) return;
      gotResult = true;
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      if (ev.results[ev.results.length - 1].isFinal) {
        say("");
        input.focus({ preventScroll: true });
      }
    };
    rec.onerror = function (ev) {
      if (rec !== self) return;
      var code = ev && ev.error;
      if (code === "language-not-supported" && !retried) { start("ar-IQ", true); return; }
      stop();
      if (code === "aborted") return;
      say(code === "not-allowed" || code === "service-not-allowed" ? t().voiceDenied : t().voiceError);
    };
    rec.onend = function () {
      if (rec !== self || !listening) return;
      listening = false;
      mic.classList.remove("is-listening");
      mic.setAttribute("aria-pressed", "false");
      if (!gotResult) say(t().voiceError);
      else if (status && !status.hidden && status.textContent === t().voiceListening) say("");
    };
    try {
      rec.start();
      listening = true;
      mic.classList.add("is-listening");
      mic.setAttribute("aria-pressed", "true");
      say(t().voiceListening, true);
    } catch (e) {
      stop();
      say(t().voiceError);
    }
  }

  mic.setAttribute("aria-pressed", "false");
  mic.addEventListener("click", function () {
    if (listening) { stop(); say(""); return; }
    start(LANGS[M.lang()] || "en-US", false);
  });
  M.onRender(function () { if (listening) { stop(); say(""); } });
})();
