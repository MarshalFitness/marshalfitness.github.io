/* Marshal Fitness — version 22: shared helpers and the "Plan your gym" tools.
   - M.readImage(file, maxSide, type, quality): photo file -> smaller picture (data URL)
   - M.makeWindow(id, cls): a pop-up window like the others on the site
   - the "Plan your gym" section (cards for every version 22 tool) and footer links */
(function () {
  "use strict";
  var M = window.MF;
  if (!M) return;
  var el = M.el;
  function t() { return M.t(); }

  /* ---------- photos from the phone: smaller, so they upload fast ---------- */
  M.readImage = function (file, maxSide, type, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || "")) { reject(new Error("not a picture")); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, (maxSide || 1000) / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        var ctx = c.getContext("2d");
        if ((type || "image/jpeg") === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { resolve(c.toDataURL(type || "image/jpeg", quality || 0.75)); } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad picture")); };
      img.src = url;
    });
  };

  /* ---------- a pop-up window ---------- */
  M.makeWindow = function (id, cls) {
    var modal = el("div", "lightbox");
    modal.id = id;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", id + "Title");
    modal.hidden = true;
    var panel = el("div", "lightbox-panel panel-pad " + (cls || ""));
    var close = el("button", "lightbox-close");
    close.type = "button";
    close.id = id + "Close";
    close.innerHTML = "&times;";
    var title = el("h2", "panel-title");
    title.id = id + "Title";
    var body = el("div", "w22-body");
    panel.appendChild(close);
    panel.appendChild(title);
    panel.appendChild(body);
    modal.appendChild(panel);
    document.body.appendChild(modal);
    close.addEventListener("click", function () { M.closeModal(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) M.closeModal(); });
    return { modal: modal, panel: panel, title: title, body: body, close: close };
  };

  // small helpers for forms
  M.field = function (labelText, input, hint) {
    var wrap = el("label", "f22");
    wrap.appendChild(el("span", "f22-label", labelText));
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el("span", "f22-hint", hint));
    return wrap;
  };
  M.chips = function (options, value, onPick, label) {
    var box = el("div", "chips22");
    box.setAttribute("role", "group");
    if (label) box.setAttribute("aria-label", label);
    options.forEach(function (o) {
      var b = el("button", "chip22", o[1]);
      b.type = "button";
      b.setAttribute("data-v", o[0]);
      b.setAttribute("aria-pressed", String(o[0] === value));
      b.addEventListener("click", function () {
        box.querySelectorAll(".chip22").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(o[0]);
      });
      box.appendChild(b);
    });
    return box;
  };
  M.money = function (n) { return Math.round(Number(n) || 0).toLocaleString("en-US"); };

  /* ---------- "Plan your gym" section ---------- */
  var ICONS = {
    gym: '<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9.5v5"/><path d="M21 9.5v5"/><path d="M6.5 12h11"/>',
    rooms: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h9"/><path d="M12 3v18"/><path d="M16 16h2"/>',
    paint: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
    trade: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15h4"/><path d="M8 19h.01"/><path d="M12 19h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 26) + '" height="' + (size || 26) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }
  M.icon22 = svg;

  // [id, icon, title key, text key, action]
  var TOOLS = [
    ["gym", "gym", "gpOpen", "gpCard", function (b) { if (M.openGymPlan) M.openGymPlan(b); }],
    ["rooms", "rooms", "roomsTitle", "roomsCard", function () {
      var s = document.getElementById("roomsSection");
      if (s) s.scrollIntoView({ behavior: M.reducedMotion && M.reducedMotion() ? "auto" : "smooth", block: "start" });
    }],
    ["paint", "paint", "dzOpen", "dzCard", function (b) { if (M.openDesigner) M.openDesigner(null, b); }],
    ["trade", "trade", "tiOpen", "tiCard", function (b) { if (M.openTradeIn) M.openTradeIn(b); }],
    ["calc", "calc", "svOpen", "svCard", function (b) { if (M.openSavings) M.openSavings(b); }],
    ["user", "user", "acOpen", "acCard", function (b) { if (M.openAccount) M.openAccount(b); }]
  ];
  var section = document.getElementById("toolsSection");
  var grid = document.getElementById("toolsGrid");
  function drawTools() {
    if (!grid) return;
    var d = t();
    var h = document.getElementById("toolsTitle"), sub = document.getElementById("toolsSub");
    if (h) h.textContent = d.toolsTitle;
    if (sub) sub.textContent = d.toolsSub;
    grid.textContent = "";
    TOOLS.forEach(function (tool) {
      var b = el("button", "tool22 tool22-" + tool[0]);
      b.type = "button";
      b.setAttribute("data-tool", tool[0]);
      var ic = el("span", "tool22-ic");
      ic.innerHTML = svg(tool[1], 26);
      var txt = el("span", "tool22-txt");
      txt.appendChild(el("b", "tool22-title", d[tool[2]]));
      txt.appendChild(el("span", "tool22-sub", d[tool[3]]));
      b.appendChild(ic);
      b.appendChild(txt);
      b.addEventListener("click", function () { tool[4](b); });
      grid.appendChild(b);
    });
    if (section) section.hidden = false;
  }
  drawTools();
  M.onRender(drawTools);

  // footer + menu buttons: data-v22="gym|paint|trade|calc|user|rooms"
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-v22]");
    if (!b) return;
    var id = b.getAttribute("data-v22");
    var tool = TOOLS.filter(function (x) { return x[0] === id; })[0];
    if (!tool) return;
    e.preventDefault();
    var nav = document.getElementById("navLinks");
    if (nav && nav.classList.contains("open")) { var mt = document.getElementById("menuToggle"); if (mt) mt.click(); }
    tool[4](b);
  });
})();
