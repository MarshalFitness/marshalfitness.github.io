/* Marshal Fitness — version 22: the few texts the page needs at once (menu, footer, bottom bar, tool cards).
   All other version 22 texts are in texts22.js (loaded with the tools, after the site is ready). */
(function () {
  "use strict";
  var I = window.I18N;
  if (!I) return;
  function add(lang, obj) { var d = I[lang]; if (!d) return; Object.keys(obj).forEach(function (k) { d[k] = obj[k]; }); }
  add("en", {
    toolsTitle: "Plan your gym",
    gpOpen: "Open a gym",
    roomsTitle: "Ready gym rooms",
    dzOpen: "Design your machine",
    tiOpen: "Trade in your old machine",
    svOpen: "Home gym vs gym membership",
    acOpen: "My Marshal",
    acBar: "Account",
    dzDesignBtn: "Design its colors",
    acButton: "My Marshal account",
    toolsSub: "Free tools to plan, design and save. Then ask us on WhatsApp.",
    gpCard: "Equipment list, floor plan and 3D for your new gym",
    roomsCard: "Complete rooms. Add a whole room in one tap",
    roomsSubtitle: "Machines that fit together. Add the whole room to your basket, or see it in 3D.",
    dzCard: "Choose frame and seat colors, add your logo",
    tiCard: "Send photos and get an offer for a new one",
    svCard: "See when a home gym pays for itself",
    acCard: "Your requests, invoices and warranty on any phone"
  });
  add("ar", {
    toolsTitle: "خطّط لصالتك الرياضية",
    gpOpen: "افتح صالة رياضية",
    roomsTitle: "غرف رياضية جاهزة",
    dzOpen: "صمّم جهازك",
    tiOpen: "استبدل جهازك القديم",
    svOpen: "جيم منزلي أم اشتراك نادي؟",
    acOpen: "حسابي في مارشال",
    acBar: "حسابي",
    dzDesignBtn: "صمّم ألوانه",
    acButton: "حسابي في مارشال",
    toolsSub: "أدوات مجانية للتخطيط والتصميم والتوفير. ثم اسألنا على واتساب.",
    gpCard: "قائمة الأجهزة ومخطط الأرضية وعرض ثلاثي الأبعاد لصالتك الجديدة",
    roomsCard: "غرف كاملة. أضف الغرفة كلها بلمسة واحدة",
    roomsSubtitle: "أجهزة تناسب بعضها. أضف الغرفة كلها إلى سلتك، أو شاهدها بالأبعاد الثلاثية.",
    dzCard: "اختر لون الهيكل والمقعد، وأضف شعارك",
    tiCard: "أرسل الصور واحصل على عرض لجهاز جديد",
    svCard: "اعرف متى يسدّد الجيم المنزلي ثمنه",
    acCard: "طلباتك وفواتيرك والضمان على أي هاتف"
  });
  add("ckb", {
    toolsTitle: "پلانی هۆڵی وەرزشەکەت دابنێ",
    gpOpen: "هۆڵێکی وەرزش بکەرەوە",
    roomsTitle: "ژووری وەرزشی ئامادە",
    dzOpen: "ئامێرەکەت دیزاین بکە",
    tiOpen: "ئامێرە کۆنەکەت بگۆڕەوە",
    svOpen: "هۆڵی ماڵەوە یان بەشداری هۆڵ؟",
    acOpen: "هەژماری مارشاڵم",
    acBar: "هەژمار",
    dzDesignBtn: "ڕەنگەکانی دیزاین بکە",
    acButton: "هەژماری مارشاڵم",
    toolsSub: "ئامرازی بێبەرامبەر بۆ پلاندانان، دیزاین و پاشەکەوت. پاشان لە واتساپ پرسیارمان لێ بکە.",
    gpCard: "لیستی ئامێر، نەخشەی زەوی و سێ ڕەهەندی بۆ هۆڵە نوێیەکەت",
    roomsCard: "ژووری تەواو. بە یەک دەستلێدان هەموو ژوورەکە زیاد بکە",
    roomsSubtitle: "ئامێرانێک کە پێکەوە دەگونجێن. هەموو ژوورەکە بخە سەبەتەکەت، یان بە سێ ڕەهەندی بیبینە.",
    dzCard: "ڕەنگی چوارچێوە و کورسی هەڵبژێرە، لۆگۆکەت زیاد بکە",
    tiCard: "وێنە بنێرە و ئۆفەرێک بۆ ئامێرێکی نوێ وەربگرە",
    svCard: "بزانە کەی هۆڵی ماڵەوە پارەی خۆی دەداتەوە",
    acCard: "داواکاری، پسوولە و گەرەنتییەکانت لە هەر مۆبایلێک"
  });

  /* A tap on a new button before the tools have loaded (slow internet):
     remember it, show that it is waiting, and do it when the tools are ready. */
  var waiting = null;
  document.addEventListener("click", function (e) {
    if (window.MF_LATE_READY) return;
    var b = e.target.closest && e.target.closest("[data-v22], #accountBtn, #lbDesign");
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (waiting) waiting.classList.remove("v22-wait");
    waiting = b;
    b.classList.add("v22-wait");
    b.setAttribute("aria-busy", "true");
  }, true);
  document.addEventListener("mf-late", function () {
    // the rooms could not load (no internet): hide the grey cards
    var row = document.getElementById("roomsRow");
    if (row && row.querySelector(".room-skel")) { var sec = document.getElementById("roomsSection"); if (sec) sec.hidden = true; }
    var b = waiting;
    waiting = null;
    if (!b) return;
    b.classList.remove("v22-wait");
    b.removeAttribute("aria-busy");
    if (document.contains(b) && b.getClientRects().length) b.click();
  });
})();
