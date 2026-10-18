/* Marshal Fitness — version 21 glue: logo screen, new footer.
   (Holiday looks: holidays.js. Exercises + muscle map: exfigure.js, exercises.js.
   Catalog PDF: pdfmaker.js, catalog.js. Colors: v21.css + script.js.) */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;
  var root = document.documentElement;

  /* ---------- logo screen: away as soon as the site is ready ---------- */
  var splash = document.getElementById("mfSplash");
  function hideSplash() {
    if (!splash || splash.classList.contains("is-done")) return;
    var shown = window.performance ? performance.now() : 1000;
    var wait = Math.max(0, 650 - shown); // at least a short moment, so it is not a flash
    setTimeout(function () {
      splash.classList.add("is-done");
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 450);
    }, wait);
  }
  if (root.classList.contains("no-splash")) { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }
  else {
    document.addEventListener("mf-ready", hideSplash);
    if (document.querySelector("#products .product-card")) hideSplash();
    setTimeout(hideSplash, 5000); // never longer than this
  }

  /* ---------- footer ---------- */
  function fillFooter() {
    var S = M.S, d = M.t(), lang = M.lang();
    var wa = document.getElementById("ftWa");
    if (wa) {
      wa.href = "https://wa.me/" + S.phone;
      var num = document.getElementById("ftWaNum");
      if (num) num.textContent = S.phoneDisplay || ("+" + S.phone);
    }
    var phones = document.getElementById("ftPhones");
    if (phones) {
      phones.textContent = "";
      (S.morePhones || []).forEach(function (n) {
        var a = M.el("a", null, n);
        a.href = "tel:" + String(n).replace(/[^\d+]/g, "");
        a.dir = "ltr";
        phones.appendChild(a);
      });
      phones.hidden = !(S.morePhones && S.morePhones.length);
    }
    var hours = document.getElementById("ftHours");
    if (hours) {
      var h = S.hours && (S.hours[lang] || S.hours.en);
      hours.textContent = h || "";
      hours.hidden = !h;
    }
    var dir = document.getElementById("ftDir");
    if (dir && S.lat && S.lng) dir.href = "https://www.google.com/maps/dir/?api=1&destination=" + S.lat + "," + S.lng;
    var rights = document.getElementById("ftRights");
    if (rights) rights.textContent = d.ftRights(new Date().getFullYear());
  }
  fillFooter();
  M.onRender(fillFooter);

  document.querySelectorAll("[data-ft]").forEach(function (b) {
    b.addEventListener("click", function () {
      var what = b.getAttribute("data-ft");
      if (what === "tour" && M.openTour) M.openTour(b);
      else if (what === "planner" && M.openPlanner) M.openPlanner(b);
      else if (what === "compare") { var c = document.getElementById("compareOpen"); if (c) c.click(); }
    });
  });
})();
