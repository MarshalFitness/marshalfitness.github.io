/* Marshal Fitness — holiday looks (version 21).
   On special days the site shows a greeting bar and a small drawing in the top
   section. It turns on and off by itself (Erbil time).
   Moon days (Ramadan, the Eids, Prophet's Birthday) use the Umm al-Qura calendar;
   in admin they can be moved by 1 day. Admin can also add an offer text or switch a day off.
   Test link: ?holiday=ramadan (or flag, women, fitr, nowruz, mother, adha, children, father, mawlid). */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;
  var el = M.el;
  function L(x) { var lg = M.lang(); return lg === "ar" ? x[1] : lg === "ckb" ? x[2] : x[0]; }

  var H = {
    flag: { g: ["Happy Kurdistan Flag Day", "يوم علم كوردستان — كل عام وأنتم بخير", "ڕۆژی ئاڵای کوردستان پیرۆز بێت"] },
    ramadan: { moon: true, g: ["Ramadan Kareem", "رمضان كريم", "ڕەمەزانتان پیرۆز بێت"] },
    women: { g: ["Happy International Women's Day", "يوم المرأة العالمي — كل عام وأنتِ بخير", "ڕۆژی جیهانی ئافرەتان پیرۆز بێت"] },
    fitr: { moon: true, g: ["Eid Mubarak", "عيد فطر مبارك", "جەژنی ڕەمەزانتان پیرۆز بێت"] },
    nowruz: { g: ["Happy Nowruz", "نوروز سعيد", "نەورۆزتان پیرۆز بێت"] },
    mother: { g: ["Happy Mother's Day", "عيد الأم سعيد", "ڕۆژی دایکان پیرۆز بێت"] },
    adha: { moon: true, g: ["Eid al-Adha Mubarak", "عيد أضحى مبارك", "جەژنی قوربانتان پیرۆز بێت"] },
    children: { g: ["Happy Children's Day", "يوم الطفل العالمي سعيد", "ڕۆژی منداڵان پیرۆز بێت"] },
    father: { g: ["Happy Father's Day", "عيد الأب سعيد", "ڕۆژی باوکان پیرۆز بێت"] },
    mawlid: { moon: true, g: ["Blessed Mawlid al-Nabi", "المولد النبوي الشريف — كل عام وأنتم بخير", "یادی لەدایکبوونی پێغەمبەر (د.خ) پیرۆز بێت"] }
  };
  M.HOLIDAYS = H;
  M.HOLIDAY_IDS = (window.MF_HOLIDAY_DATES && window.MF_HOLIDAY_DATES.order) || ["flag", "ramadan", "women", "fitr", "nowruz", "mother", "adha", "children", "father", "mawlid"];

  var DATES = window.MF_HOLIDAY_DATES || { fixed: {}, moon: { ramadan: [], fitr: [], adha: [], mawlid: [] }, length: {} };
  var FIXED = DATES.fixed, MOON = DATES.moon, LENGTH = DATES.length;

  // today's date in Erbil (UTC+3, no summer time)
  function erbilDay(shiftDays) {
    var now = new Date(Date.now() + 3 * 3600e3 - (shiftDays || 0) * 864e5);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  function days(a, b) { return Math.round((b - a) / 864e5); }

  // Islamic month/day from the phone, for years after the table
  var hijriFmt = null;
  try { hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", timeZone: "UTC" }); } catch (e) { hijriFmt = null; }
  function hijri(d) {
    if (!hijriFmt) return null;
    try {
      var p = {};
      hijriFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return [Number(p.month), Number(p.day)];
    } catch (e) { return null; }
  }

  var TABLE_END = new Date("2033-01-01T00:00:00Z");
  function moonActive(id, day) {
    if (day < TABLE_END) {
      var list = MOON[id];
      for (var i = 0; i < list.length; i++) {
        var start = new Date(list[i] + "T00:00:00Z"), len = LENGTH[id];
        if (id === "ramadan") {
          // Ramadan lasts until the day before Eid al-Fitr
          var f = MOON.fitr.filter(function (x) { return x > list[i]; })[0];
          len = f ? days(start, new Date(f + "T00:00:00Z")) : 30;
        }
        var k = days(start, day);
        if (k >= 0 && k < len) return true;
      }
      return false;
    }
    var h = hijri(day);
    if (!h) return false;
    if (id === "ramadan") return h[0] === 9;
    if (id === "fitr") return h[0] === 10 && h[1] <= 3;
    if (id === "adha") return h[0] === 12 && h[1] >= 10 && h[1] <= 13;
    if (id === "mawlid") return h[0] === 3 && h[1] === 12;
    return false;
  }

  function settings() { return window.HOLIDAY_EDIT || {}; }

  // which special days are today? (several can fall together, e.g. Nowruz + Mother's Day)
  function activeIds() {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get("holiday"); } catch (e) { /* ignore */ }
    if (q && H[q]) return q === "nowruz" ? ["nowruz", "mother"] : [q];
    var cfg = settings();
    if (cfg.off) return [];
    var skip = cfg.skip || {};
    var shift = Number(cfg.shift) || 0;
    var today = erbilDay(0), moonDay = erbilDay(shift);
    var on = [];
    M.HOLIDAY_IDS.forEach(function (id) {
      if (skip[id]) return;
      if (H[id].moon) { if (moonActive(id, moonDay)) on.push(id); return; }
      var f = FIXED[id], m = today.getUTCMonth() + 1, dd = today.getUTCDate();
      if (m === f[0] && dd >= f[1] && dd <= f[2]) on.push(id);
    });
    // the moon holiday wins the drawing; Ramadan ends when Eid starts
    if (on.indexOf("fitr") !== -1) on = on.filter(function (x) { return x !== "ramadan"; });
    return on;
  }
  M.holidaysToday = activeIds;

  /* ---------- drawings (top section, small, behind the text) ---------- */
  var ART = {
    ramadan:
      '<path class="hd-gold" d="M150 40a34 34 0 1 0 26 56 28 28 0 1 1-26-56z"/>' +
      '<g class="hd-swing"><line class="hd-line" x1="60" y1="0" x2="60" y2="58"/><path class="hd-lamp" d="M48 58h24l6 14-6 26H48l-6-26z"/><path class="hd-glow" d="M52 70h16l3 8-3 14H52l-3-14z"/></g>' +
      '<g class="hd-swing hd-d2"><line class="hd-line" x1="100" y1="0" x2="100" y2="98"/><path class="hd-lamp" d="M90 98h20l5 12-5 22H90l-5-22z"/><path class="hd-glow" d="M93 108h14l2 7-2 12H93l-2-12z"/></g>' +
      '<g class="hd-swing hd-d3"><line class="hd-line" x1="22" y1="0" x2="22" y2="30"/><path class="hd-lamp" d="M14 30h16l4 10-4 18H14l-4-18z"/></g>' +
      '<g class="hd-twinkle"><circle class="hd-star" cx="196" cy="30" r="2.6"/><circle class="hd-star" cx="126" cy="18" r="2"/><circle class="hd-star" cx="206" cy="112" r="2.2"/></g>',
    fitr: null, adha: null,
    eid:
      '<path class="hd-gold" d="M150 34a40 40 0 1 0 30 66 33 33 0 1 1-30-66z"/>' +
      '<g class="hd-twinkle"><path class="hd-star" d="M70 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path class="hd-star hd-d2" d="M40 100l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>' +
      '<path class="hd-star hd-d3" d="M110 130l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><circle class="hd-star" cx="205" cy="40" r="3"/><circle class="hd-star hd-d2" cx="20" cy="40" r="2.4"/></g>',
    flag:
      '<g class="hd-wave"><line class="hd-pole" x1="40" y1="6" x2="40" y2="200"/>' +
      '<rect x="42" y="12" width="150" height="34" fill="#ED2024"/><rect x="42" y="46" width="150" height="34" fill="#fff"/><rect x="42" y="80" width="150" height="34" fill="#278E43"/>' +
      '<circle cx="117" cy="63" r="12" fill="#FEBD11"/>' + (function () {
        var s = "";
        for (var i = 0; i < 21; i++) {
          var a = i / 21 * Math.PI * 2;
          s += '<line x1="' + (117 + Math.cos(a) * 12).toFixed(1) + '" y1="' + (63 + Math.sin(a) * 12).toFixed(1) + '" x2="' + (117 + Math.cos(a) * 17).toFixed(1) + '" y2="' + (63 + Math.sin(a) * 17).toFixed(1) + '" stroke="#FEBD11" stroke-width="2"/>';
        }
        return s;
      })() + "</g>",
    nowruz:
      '<g class="hd-flicker"><path fill="#ED2024" d="M110 200c-40 0-56-30-44-62 6 14 16 18 16 18-6-34 16-60 34-76-2 22 10 34 20 48 4-8 4-18 2-26 18 18 30 44 22 66-6 18-22 32-50 32z"/>' +
      '<path fill="#FEBD11" d="M112 200c-22 0-30-16-24-34 4 8 10 10 10 10-2-20 10-34 20-42 0 14 8 22 12 30 2-4 2-10 0-14 10 10 16 26 10 38-4 8-14 12-28 12z"/></g>' +
      '<g class="hd-twinkle"><circle cx="40" cy="60" r="5" fill="#278E43"/><circle cx="190" cy="50" r="4" fill="#278E43"/><circle cx="60" cy="150" r="3.5" fill="#FEBD11"/></g>',
    women:
      '<g class="hd-sway"><path class="hd-stem" d="M80 200C80 150 84 110 92 80"/><path fill="#a855f7" d="M92 80c-14-4-20-22-14-36 6 6 10 8 14 8 4 0 8-2 14-8 6 14 0 32-14 36z"/>' +
      '<path class="hd-stem" d="M130 200c0-40-2-74-8-100"/><path fill="#ec4899" d="M122 100c-12-4-18-20-12-32 5 5 9 7 12 7s7-2 12-7c6 12 0 28-12 32z"/>' +
      '<path class="hd-stem" d="M170 200c0-30 2-56 8-76"/><path fill="#a855f7" d="M178 124c-10-3-15-16-10-26 4 4 7 6 10 6s6-2 10-6c5 10 0 23-10 26z"/></g>',
    mother:
      '<g class="hd-pulse"><path fill="#ec4899" d="M120 160s-52-32-52-68c0-18 14-30 28-30 12 0 20 8 24 16 4-8 12-16 24-16 14 0 28 12 28 30 0 36-52 68-52 68z"/></g>' +
      '<g class="hd-twinkle"><path fill="#f9a8d4" d="M50 60s-14-9-14-18c0-5 4-8 7-8 3 0 6 2 7 4 1-2 4-4 7-4 3 0 7 3 7 8 0 9-14 18-14 18z"/></g>',
    children:
      '<g class="hd-float"><line class="hd-line" x1="70" y1="98" x2="94" y2="200"/><ellipse cx="70" cy="70" rx="22" ry="28" fill="#f59e0b"/></g>' +
      '<g class="hd-float hd-d2"><line class="hd-line" x1="128" y1="80" x2="104" y2="200"/><ellipse cx="128" cy="52" rx="22" ry="28" fill="#3b82f6"/></g>' +
      '<g class="hd-float hd-d3"><line class="hd-line" x1="182" y1="104" x2="112" y2="200"/><ellipse cx="182" cy="76" rx="20" ry="26" fill="#22c55e"/></g>',
    father:
      '<g class="hd-pulse"><path fill="#3b82f6" d="M120 150s-46-28-46-60c0-16 12-27 25-27 10 0 18 7 21 14 3-7 11-14 21-14 13 0 25 11 25 27 0 32-46 60-46 60z"/></g>' +
      '<path fill="#1e3a8a" d="M110 70h20l-4 8 8 44-14 14-14-14 8-44z" opacity=".85"/>',
    mawlid:
      '<path fill="#15803d" d="M60 200v-60c0-34 26-58 60-74 34 16 60 40 60 74v60z" opacity=".9"/>' +
      '<line x1="120" y1="66" x2="120" y2="40" stroke="#d4a017" stroke-width="3"/>' +
      '<path fill="#d4a017" d="M126 18a12 12 0 1 0 6 20 9 9 0 1 1-6-20z"/>' +
      '<g class="hd-twinkle"><circle class="hd-star" cx="40" cy="60" r="2.6"/><circle class="hd-star hd-d2" cx="200" cy="80" r="2.4"/><circle class="hd-star hd-d3" cx="180" cy="30" r="2"/></g>'
  };
  ART.fitr = ART.eid;
  ART.adha = ART.eid;

  /* ---------- show ---------- */
  var CLOSED_KEY = "mf-holiday-closed";
  var bar = null, art = null;

  function offerText(id) {
    var o = (settings().offer || {})[id];
    if (!o) return "";
    return String(o[M.lang()] || o.en || "").trim();
  }

  function render() {
    var ids = activeIds();
    var main = ids[0];
    if (main) document.documentElement.setAttribute("data-holiday", main);
    else document.documentElement.removeAttribute("data-holiday");
    var hero = document.getElementById("hero");
    if (art && art.parentNode) art.parentNode.removeChild(art);
    art = null;
    if (main && hero) {
      art = el("div", "hd-art hd-art-" + main);
      art.setAttribute("aria-hidden", "true");
      art.innerHTML = '<svg viewBox="0 0 220 200" width="100%" height="100%">' + (ART[main] || "") + "</svg>";
      hero.insertBefore(art, hero.querySelector(".hero-content"));
    }
    if (!bar) {
      bar = el("div", "hd-bar");
      bar.id = "holidayBar";
      bar.setAttribute("role", "note");
      var first = document.body.firstElementChild;
      document.body.insertBefore(bar, first);
    }
    var key = ids.join("+") + "|" + ids.map(offerText).join("|");
    var closed = false;
    try { closed = window.sessionStorage.getItem(CLOSED_KEY) === key; } catch (e) { /* ignore */ }
    if (!main || closed) { bar.hidden = true; return; }
    bar.className = "hd-bar hd-bar-" + main;
    bar.textContent = "";
    var txt = el("p", "hd-text");
    txt.setAttribute("dir", "auto");
    txt.appendChild(el("strong", "hd-greet", ids.map(function (id) { return L(H[id].g); }).join(" · ")));
    var offers = ids.map(offerText).filter(Boolean);
    if (offers.length) txt.appendChild(el("span", "hd-offer", offers.join(" · ")));
    bar.appendChild(txt);
    var x = el("button", "hd-close");
    x.type = "button";
    x.innerHTML = "&times;";
    x.setAttribute("aria-label", M.t().close);
    x.addEventListener("click", function () {
      bar.hidden = true;
      try { window.sessionStorage.setItem(CLOSED_KEY, key); } catch (e) { /* ignore */ }
    });
    bar.appendChild(x);
    bar.hidden = false;
  }

  render();
  M.onRender(render);
  M.refreshHoliday = render;
})();
