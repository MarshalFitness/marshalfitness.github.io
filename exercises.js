/* Marshal Fitness — exercises for each machine + muscle map (version 21).
   1. Every product gets a machine type (from its name and category, or from the
      "Exercises" choice in admin). Each type has 3 exercises.
   2. The product window shows the 3 exercises with a moving drawing (exfigure.js).
   3. The muscle map: tap a muscle, see the machines that train it.
   Exercise texts are here in English, Arabic and Kurdish (Sorani). */
(function () {
  "use strict";
  var M = window.MF, FIG = window.MF_FIG;
  if (!M || !FIG) return;
  var el = M.el, t = M.t, root = document.documentElement;
  function L(x) { if (!x) return ""; var lg = M.lang(); return lg === "ar" ? x[1] : lg === "ckb" ? x[2] : x[0]; }

  /* ---------- exercises: a = drawing, m = muscles (first = main), d = amount, n = name, s = steps ---------- */
  var EX = {
    walk: { a: "walk", m: ["cardio", "calves", "quads"], d: { min: "20–30" },
      n: ["Brisk walk", "مشي سريع", "ڕۆیشتنی خێرا"],
      s: [["Stand tall. Hold the rails only for balance.", "قف مستقيماً وأمسك المقابض للتوازن فقط.", "ڕاست بوەستە و دەستگرەکان تەنها بۆ هاوسەنگی بگرە."],
        ["Walk at a speed where you can still talk.", "امشِ بسرعة تستطيع معها أن تتكلم.", "بە خێراییەک بڕۆ کە هێشتا بتوانیت قسە بکەیت."]] },
    incline_walk: { a: "walk_incline", m: ["glutes", "calves", "cardio"], d: { min: "15–20" },
      n: ["Incline walk", "مشي على منحدر", "ڕۆیشتن بە لێژی"],
      s: [["Raise the incline to 5–10%.", "ارفع الميل إلى 5–10%.", "لێژییەکە بەرز بکەوە بۆ 5–10%."],
        ["Take short steps and keep your back straight.", "خذ خطوات قصيرة وحافظ على استقامة ظهرك.", "هەنگاوی کورت بنێ و پشتت ڕاست ڕابگرە."]] },
    run_int: { a: "run", m: ["cardio", "quads", "hamstrings"], d: { min: "20" },
      n: ["Run intervals", "جري متقطع", "ڕاکردنی پچڕپچڕ"],
      s: [["Warm up for 5 minutes. Then run fast for 1 minute.", "أحمِ جسمك 5 دقائق، ثم اركض بسرعة دقيقة واحدة.", "5 خولەک خۆت گەرم بکە، پاشان یەک خولەک بە خێرایی ڕابکە."],
        ["Walk for 2 minutes. Repeat 6 times.", "امشِ دقيقتين، وكرّر 6 مرات.", "دوو خولەک بڕۆ و 6 جار دووبارەی بکەوە."]] },
    ride: { a: "bike", m: ["cardio", "quads", "calves"], d: { min: "20–40" },
      n: ["Steady ride", "ركوب ثابت", "پایدانی ئاسایی"],
      s: [["Set the seat so your knee is a little bent at the bottom.", "اضبط المقعد بحيث تبقى الركبة منثنية قليلاً في الأسفل.", "کورسییەکە ڕێک بخە تا ئەژنۆت لە خوارەوە کەمێک چەمابێتەوە."],
        ["Pedal at an easy, steady speed.", "دوّس بسرعة سهلة وثابتة.", "بە خێراییەکی ئاسان و یەکسان پایدان بدە."]] },
    climb: { a: "bike_stand", m: ["quads", "glutes", "cardio"], d: { x: 5, min: "1" },
      n: ["Standing climb", "صعود وقوفاً", "سەرکەوتن بە وەستان"],
      s: [["Add resistance and stand up on the pedals.", "زِد المقاومة وقف على الدواسات.", "بەرگری زیاد بکە و لەسەر پایدانەکان هەستە."],
        ["Keep your hips over the pedals. Ride 1 minute, rest 1 minute.", "أبقِ وركيك فوق الدواسات. دقيقة ركوب ودقيقة راحة.", "سمتت لە سەرووی پایدانەکان ڕابگرە. یەک خولەک پایدان، یەک خولەک پشوو."]] },
    sprint: { a: "bike_fast", m: ["cardio", "quads"], d: { x: 8, sec: "20" },
      n: ["Sprint intervals", "سرعات متقطعة", "خێرایی پچڕپچڕ"],
      s: [["Pedal as fast as you can for 20 seconds.", "دوّس بأقصى سرعة لمدة 20 ثانية.", "بۆ 20 چرکە بە خێراترین شێوە پایدان بدە."],
        ["Rest 40 seconds. Repeat 8 times.", "استرح 40 ثانية، وكرّر 8 مرات.", "40 چرکە پشوو بدە و 8 جار دووبارەی بکەوە."]] },
    row_full: { a: "rower", m: ["back", "quads", "biceps", "cardio"], d: { min: "10–20" },
      n: ["Full row", "تجديف كامل", "سەوڵلێدانی تەواو"],
      s: [["Push with your legs first, then pull the handle to your chest.", "ادفع بساقيك أولاً، ثم اسحب المقبض إلى صدرك.", "سەرەتا بە قاچەکانت پاڵ بنێ، پاشان دەسکەکە بۆ سنگت ڕابکێشە."],
        ["Go back slowly: arms, then body, then legs.", "ارجع ببطء: الذراعان ثم الجسم ثم الساقان.", "بە هێواشی بگەڕێوە: باسک، پاشان لەش، پاشان قاچ."]] },
    row_legs: { a: "rower_legs", m: ["quads", "glutes"], d: { s: 3, r: "15" },
      n: ["Legs-only row", "تجديف بالساقين فقط", "سەوڵلێدان تەنها بە قاچ"],
      s: [["Keep your arms straight.", "أبقِ ذراعيك مستقيمتين.", "باسکەکانت ڕاست ڕابگرە."],
        ["Push back with your legs, then slide forward slowly.", "ادفع للخلف بساقيك، ثم عُد للأمام ببطء.", "بە قاچەکانت بۆ دواوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە پێشەوە."]] },
    row_power: { a: "rower", m: ["cardio", "back"], d: { x: 5, min: "1" },
      n: ["Power rows", "تجديف قوي", "سەوڵلێدانی بەهێز"],
      s: [["Row hard for 1 minute.", "جدّف بقوة لمدة دقيقة.", "یەک خولەک بە هێز سەوڵ لێبدە."],
        ["Row easy for 1 minute. Repeat 5 times.", "جدّف بهدوء دقيقة، وكرّر 5 مرات.", "یەک خولەک بە ئاسانی سەوڵ لێبدە و 5 جار دووبارەی بکەوە."]] },
    squat_bar: { a: "squat_bar", m: ["quads", "glutes", "abs"], d: { s: 3, r: "8–10" },
      n: ["Back squat", "سكوات بالبار", "سکوات بە بار"],
      s: [["Bar on your upper back, feet shoulder-width apart.", "البار على أعلى الظهر، والقدمان بعرض الكتفين.", "بارەکە لەسەر سەرەوەی پشتت، پێیەکانت بە پانی شانەکانت."],
        ["Sit down until your thighs are level, then stand up.", "انزل حتى تصبح الفخذان أفقيتين، ثم قف.", "دابنیشە تا ڕانەکانت ئاسۆیی دەبن، پاشان هەستە."]] },
    deadlift: { a: "deadlift", m: ["hamstrings", "glutes", "lowerback", "back"], d: { s: 3, r: "6–8" },
      n: ["Deadlift", "الرفعة الميتة", "دێدلیفت"],
      s: [["Bar close to your legs, back flat.", "البار قريب من ساقيك، والظهر مستقيم.", "بارەکە نزیکی قاچەکانت، پشتت ڕاست."],
        ["Push the floor away and stand tall. Lower with control.", "ادفع الأرض بقدميك وقف مستقيماً، ثم أنزل البار بتحكم.", "زەوییەکە بە پێیەکانت پاڵ بنێ و ڕاست هەستە، پاشان بە کۆنترۆڵ دایبەزێنە."]] },
    ohp: { a: "ohp", m: ["shoulders", "triceps"], d: { s: 3, r: "8" },
      n: ["Overhead press", "ضغط فوق الرأس", "پاڵنانی سەرەوە"],
      s: [["Hold the bar at your shoulders. Tighten your belly.", "أمسك البار عند كتفيك وشدّ بطنك.", "بارەکە لە ئاستی شانەکانت بگرە و سکت توند بکە."],
        ["Press it straight up, then lower slowly.", "ادفعه للأعلى بشكل مستقيم، ثم أنزله ببطء.", "ڕاست بۆ سەرەوە پاڵی بنێ، پاشان بە هێواشی دایبەزێنە."]] },
    plate_raise: { a: "front_raise", m: ["shoulders"], d: { s: 3, r: "12" },
      n: ["Plate front raise", "رفع أمامي بالقرص", "بەرزکردنەوەی پێشەوە بە پلێت"],
      s: [["Hold the plate with both hands, arms straight.", "أمسك القرص بكلتا يديك والذراعان مستقيمتان.", "پلێتەکە بە هەردوو دەست بگرە، باسکەکانت ڕاست."],
        ["Raise it to eye level, then lower slowly.", "ارفعه إلى مستوى عينيك، ثم أنزله ببطء.", "تا ئاستی چاوەکانت بەرزی بکەوە، پاشان بە هێواشی دایبەزێنە."]] },
    plate_squat: { a: "squat_hold", m: ["quads", "glutes"], d: { s: 3, r: "12" },
      n: ["Plate squat", "سكوات بالقرص", "سکوات بە پلێت"],
      s: [["Hold the plate at your chest.", "أمسك القرص عند صدرك.", "پلێتەکە لە ئاستی سنگت بگرە."],
        ["Sit down and stand up. Keep your chest up.", "انزل ثم قف، وأبقِ صدرك مرفوعاً.", "دابنیشە و هەستە، سنگت بەرز ڕابگرە."]] },
    db_curl: { a: "curl_db", m: ["biceps", "forearms"], d: { s: 3, r: "12" },
      n: ["Dumbbell curl", "تمرين البايسبس بالدمبل", "چەماندنەوەی بایسێپس بە دەمبڵ"],
      s: [["Stand tall, elbows close to your body.", "قف مستقيماً والمرفقان قريبان من جسمك.", "ڕاست بوەستە، ئانیشکەکانت نزیک لەشت."],
        ["Curl the dumbbells up, then lower slowly.", "ارفع الدمبلز بثني المرفقين، ثم أنزلها ببطء.", "دەمبڵەکان بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    db_press: { a: "press_db", m: ["shoulders", "triceps"], d: { s: 3, r: "10" },
      n: ["Dumbbell shoulder press", "ضغط الكتف بالدمبل", "پاڵنانی شان بە دەمبڵ"],
      s: [["Dumbbells at shoulder height.", "الدمبلز بمستوى الكتفين.", "دەمبڵەکان لە ئاستی شانەکانت."],
        ["Press up, then lower slowly.", "ادفع للأعلى، ثم أنزل ببطء.", "بۆ سەرەوە پاڵ بنێ، پاشان بە هێواشی دایبەزێنە."]] },
    db_lunge: { a: "lunge", m: ["quads", "glutes"], d: { s: 3, r: "10", each: "leg" },
      n: ["Dumbbell lunge", "طعنة بالدمبل (لانج)", "لانج بە دەمبڵ"],
      s: [["Take a big step forward. Bend both knees.", "خذ خطوة كبيرة للأمام واثنِ الركبتين.", "هەنگاوێکی گەورە بۆ پێشەوە بنێ و هەردوو ئەژنۆت بچەمێنەوە."],
        ["Push back up. Change legs.", "ادفع لتعود للأعلى، ثم بدّل الساق.", "پاڵ بنێ و بەرز ببەوە، پاشان قاچ بگۆڕە."]] },
    db_bench: { a: "bench_press", m: ["chest", "triceps", "shoulders"], d: { s: 3, r: "10" },
      n: ["Dumbbell bench press", "ضغط الصدر بالدمبل", "پاڵنانی سنگ بە دەمبڵ"],
      s: [["Lie on the bench, feet flat on the floor.", "استلقِ على المقعد وقدماك على الأرض.", "لەسەر کورسییەکە ڕاکشێ، پێیەکانت لەسەر زەوی."],
        ["Press the dumbbells up, then lower to your chest.", "ادفع الدمبلز للأعلى، ثم أنزلها حتى صدرك.", "دەمبڵەکان بۆ سەرەوە پاڵ بنێ، پاشان تا سنگت دایانبەزێنە."]] },
    bench_row: { a: "bench_row", m: ["back", "biceps"], d: { s: 3, r: "10", each: "arm" },
      n: ["One-arm row", "سحب بذراع واحدة", "ڕاکێشان بە یەک دەست"],
      s: [["One knee and one hand on the bench, back flat.", "ركبة ويد على المقعد، والظهر مستقيم.", "ئەژنۆیەک و دەستێک لەسەر کورسییەکە، پشتت ڕاست."],
        ["Pull the dumbbell to your hip, then lower slowly.", "اسحب الدمبل نحو وركك، ثم أنزله ببطء.", "دەمبڵەکە بۆ لای سمتت ڕابکێشە، پاشان بە هێواشی دایبەزێنە."]] },
    step_up: { a: "step_up", m: ["quads", "glutes"], d: { s: 3, r: "10", each: "leg" },
      n: ["Step-up", "صعود على المقعد", "سەرکەوتن بۆ سەر کورسی"],
      s: [["Put one foot on the bench. Step up and stand tall.", "ضع قدماً على المقعد، واصعد وقف مستقيماً.", "پێیەک بخە سەر کورسییەکە، سەرکەوە و ڕاست بوەستە."],
        ["Step down slowly. Change legs.", "انزل ببطء، ثم بدّل الساق.", "بە هێواشی دابەزە، پاشان قاچ بگۆڕە."]] },
    plank: { a: "plank", m: ["abs", "shoulders"], d: { s: 3, sec: "30" },
      n: ["Plank", "بلانك", "پلانک"],
      s: [["Elbows under your shoulders, body in a straight line.", "المرفقان تحت الكتفين والجسم في خط مستقيم.", "ئانیشکەکانت لە ژێر شانەکانت، لەشت وەک هێڵێکی ڕاست."],
        ["Hold and breathe. Don't let your hips drop.", "اثبت وتنفّس، ولا تُنزل وركيك.", "ڕاوەستە و هەناسە بدە، مەهێڵە سمتت دابەزێت."]] },
    glute_bridge: { a: "glute_bridge", m: ["glutes", "hamstrings"], d: { s: 3, r: "15" },
      n: ["Glute bridge", "جسر الأرداف", "پردی سمت"],
      s: [["Lie on your back, knees bent, feet flat.", "استلقِ على ظهرك، الركبتان منثنيتان والقدمان على الأرض.", "لەسەر پشت ڕاکشێ، ئەژنۆکانت چەماوە و پێیەکانت لەسەر زەوی."],
        ["Lift your hips, squeeze, then lower.", "ارفع وركيك واضغط الأرداف، ثم أنزل.", "سمتت بەرز بکەوە و توندی بکە، پاشان دایبەزێنە."]] },
    crunch: { a: "crunch", m: ["abs"], d: { s: 3, r: "15" },
      n: ["Crunch", "تمرين البطن (كرانش)", "کرانچ"],
      s: [["Lie on your back, hands by your head.", "استلقِ على ظهرك واليدان بجانب رأسك.", "لەسەر پشت ڕاکشێ، دەستەکانت لە تەنیشت سەرت."],
        ["Lift your shoulders a little, then lower slowly.", "ارفع كتفيك قليلاً، ثم أنزلهما ببطء.", "شانەکانت کەمێک بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    ball_crunch: { a: "ball_crunch", m: ["abs"], d: { s: 3, r: "15" },
      n: ["Ball crunch", "كرانش على الكرة", "کرانچ لەسەر تۆپ"],
      s: [["Lie with your lower back on the ball, feet on the floor.", "استلقِ وأسفل ظهرك على الكرة، والقدمان على الأرض.", "خوارەوەی پشتت لەسەر تۆپەکە دابنێ، پێیەکانت لەسەر زەوی."],
        ["Lift your chest, then lower slowly.", "ارفع صدرك، ثم أنزل ببطء.", "سنگت بەرز بکەوە، پاشان بە هێواشی دایبەزێنە."]] },
    ball_wall_squat: { a: "ball_wall_squat", m: ["quads", "glutes"], d: { s: 3, r: "12" },
      n: ["Wall squat with ball", "سكوات على الحائط مع الكرة", "سکوات بە دیوار و تۆپ"],
      s: [["Put the ball between your back and the wall.", "ضع الكرة بين ظهرك والحائط.", "تۆپەکە بخە نێوان پشتت و دیوارەکە."],
        ["Sit down slowly, then stand up.", "انزل ببطء، ثم قف.", "بە هێواشی دابنیشە، پاشان هەستە."]] },
    ball_bridge: { a: "ball_bridge", m: ["glutes", "hamstrings"], d: { s: 3, r: "12" },
      n: ["Ball hip lift", "رفع الورك على الكرة", "بەرزکردنەوەی سمت لەسەر تۆپ"],
      s: [["Shoulders on the ball, feet on the floor.", "الكتفان على الكرة والقدمان على الأرض.", "شانەکانت لەسەر تۆپەکە، پێیەکانت لەسەر زەوی."],
        ["Lift your hips until your body is flat, then lower.", "ارفع وركيك حتى يستقيم جسمك، ثم أنزل.", "سمتت بەرز بکەوە تا لەشت ڕاست دەبێت، پاشان دایبەزێنە."]] },
    band_row: { a: "band_row", m: ["back", "biceps"], d: { s: 3, r: "15" },
      n: ["Band row", "سحب بالحبل المطاطي", "ڕاکێشان بە لاستیک"],
      s: [["Fix the band in front of you at chest height.", "ثبّت الحبل أمامك بمستوى الصدر.", "لاستیکەکە لە بەردەمت لە ئاستی سنگ جێگیر بکە."],
        ["Pull your elbows back, then return slowly.", "اسحب مرفقيك للخلف، ثم ارجع ببطء.", "ئانیشکەکانت بۆ دواوە ڕابکێشە، پاشان بە هێواشی بگەڕێوە."]] },
    band_press: { a: "band_press", m: ["chest", "triceps"], d: { s: 3, r: "15" },
      n: ["Band chest press", "ضغط الصدر بالحبل المطاطي", "پاڵنانی سنگ بە لاستیک"],
      s: [["Fix the band behind you at chest height.", "ثبّت الحبل خلفك بمستوى الصدر.", "لاستیکەکە لە پشتتەوە لە ئاستی سنگ جێگیر بکە."],
        ["Push forward until your arms are straight.", "ادفع للأمام حتى تستقيم ذراعاك.", "بۆ پێشەوە پاڵ بنێ تا باسکەکانت ڕاست دەبن."]] },
    band_curl: { a: "curl_band", m: ["biceps"], d: { s: 3, r: "15" },
      n: ["Band curl", "تمرين البايسبس بالحبل المطاطي", "بایسێپس بە لاستیک"],
      s: [["Stand on the band, elbows by your sides.", "قف على الحبل والمرفقان بجانبيك.", "لەسەر لاستیکەکە بوەستە، ئانیشکەکانت لە تەنیشتت."],
        ["Curl your hands up, then lower slowly.", "ارفع يديك بثني المرفقين، ثم أنزلهما ببطء.", "دەستەکانت بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    dips_w: { a: "dips_w", m: ["triceps", "chest"], d: { s: 3, r: "8" },
      n: ["Weighted dips", "تمرين الغطس بوزن إضافي", "دیپس بە کێش"],
      s: [["Hang a weight from the belt. Start with your arms straight.", "علّق وزناً بالحزام وابدأ والذراعان مستقيمتان.", "کێشێک بە پشتێنەکەوە هەڵبواسە و بە باسکی ڕاست دەست پێبکە."],
        ["Lower until your elbows bend 90°, then push up.", "انزل حتى ينثني المرفقان 90°، ثم ادفع للأعلى.", "دابەزە تا ئانیشکەکانت 90° دەچەمێنەوە، پاشان پاڵ بنێ بۆ سەرەوە."]] },
    pullup_w: { a: "pullup_w", m: ["back", "biceps"], d: { s: 3, r: "6" },
      n: ["Weighted pull-up", "عقلة بوزن إضافي", "بارفیکس بە کێش"],
      s: [["Hang a weight from the belt. Hang with straight arms.", "علّق وزناً بالحزام وتعلّق والذراعان مستقيمتان.", "کێشێک بە پشتێنەکەوە هەڵبواسە و بە باسکی ڕاست خۆت هەڵبواسە."],
        ["Pull your chest to the bar, then lower slowly.", "اسحب صدرك نحو البار، ثم انزل ببطء.", "سنگت بۆ لای بارەکە ڕابکێشە، پاشان بە هێواشی دابەزە."]] },
    belt_squat: { a: "squat_hang", m: ["quads", "glutes"], d: { s: 3, r: "12" },
      n: ["Belt squat", "سكوات بالحزام", "سکوات بە پشتێن"],
      s: [["Stand on two boxes. The weight hangs from the belt.", "قف على صندوقين والوزن معلّق بالحزام.", "لەسەر دوو سندوق بوەستە، کێشەکە بە پشتێنەکەوە هەڵواسراوە."],
        ["Sit down, then stand up. Keep your back straight.", "انزل ثم قف، وأبقِ ظهرك مستقيماً.", "دابنیشە و هەستە، پشتت ڕاست ڕابگرە."]] },
    kickback: { a: "cable_kickback", m: ["glutes", "hamstrings"], d: { s: 3, r: "12", each: "leg" },
      n: ["Cable glute kickback", "ركلة خلفية بالكابل", "لەقەی دواوە بە کێبڵ"],
      s: [["Strap on your ankle. Hold the machine.", "اربط الحزام بكاحلك وأمسك الجهاز.", "پشتێنەکە بە گوزنگتەوە ببەستە و ئامێرەکە بگرە."],
        ["Kick your leg back, then return slowly.", "حرّك ساقك للخلف، ثم ارجع ببطء.", "قاچت بۆ دواوە ببە، پاشان بە هێواشی بگەڕێوە."]] },
    cable_abduct: { a: "abduction_standing", m: ["abductors", "glutes"], d: { s: 3, r: "12", each: "leg" },
      n: ["Cable side leg raise", "رفع جانبي للساق بالكابل", "بەرزکردنەوەی لاتەنیشتی قاچ بە کێبڵ"],
      s: [["Strap on the outside ankle. Stand side-on to the machine.", "اربط الحزام بالكاحل البعيد وقف جانبياً للجهاز.", "پشتێنەکە بە گوزنگی دوورەوە ببەستە و بە لا لە ئامێرەکە بوەستە."],
        ["Lift your leg out to the side, then return slowly.", "ارفع ساقك جانباً، ثم ارجع ببطء.", "قاچت بۆ لاتەنیشت بەرز بکەوە، پاشان بە هێواشی بگەڕێوە."]] },
    leg_raise: { a: "leg_raise_front", m: ["quads", "abs"], d: { s: 3, r: "12", each: "leg" },
      n: ["Cable front leg raise", "رفع أمامي للساق بالكابل", "بەرزکردنەوەی پێشەوەی قاچ بە کێبڵ"],
      s: [["Strap on your ankle. Stand with your back to the machine.", "اربط الحزام بكاحلك وقف وظهرك للجهاز.", "پشتێنەکە بە گوزنگتەوە ببەستە، پشتت لە ئامێرەکە بێت."],
        ["Lift your straight leg forward, then lower slowly.", "ارفع ساقك مستقيمة للأمام، ثم أنزلها ببطء.", "قاچی ڕاستت بۆ پێشەوە بەرز بکەوە، پاشان بە هێواشی دایبەزێنە."]] },
    chest_press: { a: "seated_press", m: ["chest", "triceps", "shoulders"], d: { s: 3, r: "10–12" },
      n: ["Chest press", "ضغط الصدر", "پاڵنانی سنگ"],
      s: [["Set the seat so the handles are at chest height.", "اضبط المقعد ليكون المقبض بمستوى الصدر.", "کورسییەکە ڕێک بخە تا دەسکەکان لە ئاستی سنگت بن."],
        ["Push the handles forward, then return slowly.", "ادفع المقابض للأمام، ثم ارجع ببطء.", "دەسکەکان بۆ پێشەوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە."]] },
    incline_press: { a: "seated_press_incline", m: ["chest", "shoulders", "triceps"], d: { s: 3, r: "10–12" },
      n: ["Incline press", "ضغط الصدر العلوي (مائل)", "پاڵنانی سنگی سەرەوە (لێژ)"],
      s: [["Sit back against the pad. Handles at your upper chest.", "اسند ظهرك على المسند، والمقابض عند أعلى صدرك.", "پشتت بدە بە پشتگرەکە، دەسکەکان لە ئاستی سەرەوەی سنگت."],
        ["Press up and forward, then return slowly.", "ادفع للأعلى وللأمام، ثم ارجع ببطء.", "بۆ سەرەوە و پێشەوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە."]] },
    decline_press: { a: "seated_press_decline", m: ["chest", "triceps"], d: { s: 3, r: "10–12" },
      n: ["Decline press", "ضغط الصدر السفلي", "پاڵنانی سنگی خوارەوە"],
      s: [["Sit tall. Handles at your lower chest.", "اجلس مستقيماً والمقابض عند أسفل صدرك.", "ڕاست دابنیشە، دەسکەکان لە ئاستی خوارەوەی سنگت."],
        ["Press forward and down, then return slowly.", "ادفع للأمام وللأسفل، ثم ارجع ببطء.", "بۆ پێشەوە و خوارەوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە."]] },
    pec_fly: { a: "pec_fly", m: ["chest", "shoulders"], d: { s: 3, r: "12" },
      n: ["Pec fly", "تفتيح الصدر (فلاي)", "فلای سنگ"],
      s: [["Arms on the pads at shoulder height.", "ضع ذراعيك على المساند بمستوى الكتفين.", "باسکەکانت لەسەر پشتگرەکان لە ئاستی شانەکانت دابنێ."],
        ["Bring your arms together in front, then open slowly.", "اجمع ذراعيك أمامك، ثم افتحهما ببطء.", "باسکەکانت لە پێشەوە کۆ بکەوە، پاشان بە هێواشی بیانکەوە."]] },
    rear_fly: { a: "rear_fly", m: ["shoulders", "back"], d: { s: 3, r: "12" },
      n: ["Rear delt fly", "تفتيح الكتف الخلفي", "فلای پشتی شان"],
      s: [["Sit facing the pad. Hold the handles in front.", "اجلس ووجهك نحو المسند وأمسك المقابض أمامك.", "ڕووت لە پشتگرەکە دابنیشە و دەسکەکان لە پێشەوە بگرە."],
        ["Open your arms out wide, squeeze, then return.", "افتح ذراعيك إلى الجانبين واضغط، ثم ارجع.", "باسکەکانت بە پانی بکەوە و توندیان بکە، پاشان بگەڕێوە."]] },
    shoulder_press: { a: "seated_press_up", m: ["shoulders", "triceps"], d: { s: 3, r: "10" },
      n: ["Shoulder press", "ضغط الكتف", "پاڵنانی شان"],
      s: [["Handles at shoulder height, back on the pad.", "المقابض بمستوى الكتفين والظهر على المسند.", "دەسکەکان لە ئاستی شانەکانت، پشتت لەسەر پشتگرەکە."],
        ["Press up, then lower slowly.", "ادفع للأعلى، ثم أنزل ببطء.", "بۆ سەرەوە پاڵ بنێ، پاشان بە هێواشی دایبەزێنە."]] },
    lateral_raise: { a: "lateral_raise", m: ["shoulders"], d: { s: 3, r: "12" },
      n: ["Lateral raise", "رفع جانبي للكتف", "بەرزکردنەوەی لاتەنیشتی شان"],
      s: [["Pads on the outside of your arms.", "المساند على الجهة الخارجية لذراعيك.", "پشتگرەکان لە دەرەوەی باسکەکانت."],
        ["Lift your elbows to shoulder height, then lower.", "ارفع مرفقيك حتى مستوى الكتفين، ثم أنزلهما.", "ئانیشکەکانت تا ئاستی شان بەرز بکەوە، پاشان دایانبەزێنە."]] },
    lat_pulldown: { a: "pulldown", m: ["back", "biceps"], d: { s: 3, r: "10–12" },
      n: ["Lat pulldown", "سحب علوي", "ڕاکێشانی سەرەوە"],
      s: [["Knees under the pads. Hold the bar wide.", "الركبتان تحت المساند، وأمسك البار بقبضة واسعة.", "ئەژنۆکانت لە ژێر پشتگرەکان، بارەکە بە پانی بگرە."],
        ["Pull the bar to your upper chest, then let it up slowly.", "اسحب البار إلى أعلى صدرك، ثم اتركه يصعد ببطء.", "بارەکە بۆ سەرەوەی سنگت ڕابکێشە، پاشان بە هێواشی بەری بدە بۆ سەرەوە."]] },
    seated_row: { a: "seated_row", m: ["back", "biceps"], d: { s: 3, r: "10–12" },
      n: ["Seated row", "تجديف جالساً", "ڕاکێشانی دانیشتوو"],
      s: [["Sit tall, arms straight, chest up.", "اجلس مستقيماً، الذراعان ممدودتان والصدر مرفوع.", "ڕاست دابنیشە، باسکەکانت ڕاست، سنگت بەرز."],
        ["Pull your elbows back, squeeze, then return slowly.", "اسحب مرفقيك للخلف واضغط، ثم ارجع ببطء.", "ئانیشکەکانت بۆ دواوە ڕابکێشە و توندی بکە، پاشان بە هێواشی بگەڕێوە."]] },
    seated_dip: { a: "seated_dip", m: ["triceps", "chest"], d: { s: 3, r: "12" },
      n: ["Seated dip", "غطس جالساً", "دیپسی دانیشتوو"],
      s: [["Hold the handles at your sides.", "أمسك المقابض بجانبيك.", "دەسکەکان لە تەنیشتت بگرە."],
        ["Push down until your arms are straight, then return.", "ادفع للأسفل حتى تستقيم ذراعاك، ثم ارجع.", "بۆ خوارەوە پاڵ بنێ تا باسکەکانت ڕاست دەبن، پاشان بگەڕێوە."]] },
    assist_pullup: { a: "pullup_assisted", m: ["back", "biceps"], d: { s: 3, r: "8" },
      n: ["Assisted pull-up", "عقلة بالمساعدة", "بارفیکس بە یارمەتی"],
      s: [["Kneel on the pad. More weight gives more help.", "اركع على المسند. وزن أكثر يعني مساعدة أكثر.", "لەسەر پشتگرەکە چۆک دابدە. کێشی زیاتر یارمەتی زیاتر دەدات."],
        ["Pull your chin over the bar, then lower slowly.", "اسحب ذقنك فوق البار، ثم انزل ببطء.", "چەناگەت بۆ سەرووی بارەکە ڕابکێشە، پاشان بە هێواشی دابەزە."]] },
    assist_dip: { a: "dips", m: ["triceps", "chest"], d: { s: 3, r: "10" },
      n: ["Assisted dip", "غطس بالمساعدة", "دیپس بە یارمەتی"],
      s: [["Kneel on the pad. Hold the dip handles.", "اركع على المسند وأمسك مقابض الغطس.", "لەسەر پشتگرەکە چۆک دابدە و دەسکەکانی دیپس بگرە."],
        ["Lower until your elbows bend 90°, then push up.", "انزل حتى ينثني المرفقان 90°، ثم ادفع للأعلى.", "دابەزە تا ئانیشکەکانت 90° دەچەمێنەوە، پاشان پاڵ بنێ بۆ سەرەوە."]] },
    machine_curl: { a: "preacher_curl", m: ["biceps", "forearms"], d: { s: 3, r: "12" },
      n: ["Biceps curl", "تمرين البايسبس", "چەماندنەوەی بایسێپس"],
      s: [["Upper arms flat on the pad.", "ضع أعلى ذراعيك على المسند.", "سەرەوەی باسکەکانت لەسەر پشتگرەکە دابنێ."],
        ["Curl the handles up, then lower slowly.", "ارفع المقابض بثني المرفقين، ثم أنزلها ببطء.", "دەسکەکان بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    triceps_ext: { a: "triceps_ext", m: ["triceps"], d: { s: 3, r: "12" },
      n: ["Triceps extension", "تمديد الترايسبس", "درێژکردنەوەی ترایسێپس"],
      s: [["Elbows on the pad, hands up.", "المرفقان على المسند واليدان للأعلى.", "ئانیشکەکانت لەسەر پشتگرەکە، دەستەکانت بۆ سەرەوە."],
        ["Push the handles until your arms are straight, then return.", "ادفع المقابض حتى تستقيم ذراعاك، ثم ارجع.", "دەسکەکان پاڵ بنێ تا باسکەکانت ڕاست دەبن، پاشان بگەڕێوە."]] },
    leg_ext: { a: "leg_extension", m: ["quads"], d: { s: 3, r: "12" },
      n: ["Leg extension", "تمديد الساقين", "درێژکردنەوەی قاچ"],
      s: [["Pad on the front of your lower legs.", "المسند على مقدمة ساقيك من الأسفل.", "پشتگرەکە لەسەر پێشەوەی خوارەوەی قاچەکانت."],
        ["Straighten your legs, then lower slowly.", "افرد ساقيك، ثم أنزلهما ببطء.", "قاچەکانت ڕاست بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    prone_curl: { a: "prone_curl", m: ["hamstrings"], d: { s: 3, r: "12" },
      n: ["Lying leg curl", "ثني الساقين مستلقياً", "چەماندنەوەی قاچ بە ڕاکشان"],
      s: [["Lie face down. Pad just above your heels.", "استلقِ على بطنك والمسند فوق الكعبين.", "بە سکدا ڕاکشێ، پشتگرەکە لە سەرووی پاژنەکانت."],
        ["Bring your heels up, then lower slowly.", "ارفع كعبيك نحو الأرداف، ثم أنزلهما ببطء.", "پاژنەکانت بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    seated_curl: { a: "seated_leg_curl", m: ["hamstrings"], d: { s: 3, r: "12" },
      n: ["Seated leg curl", "ثني الساقين جالساً", "چەماندنەوەی قاچی دانیشتوو"],
      s: [["Pad behind your lower legs, thigh pad on top.", "المسند خلف ساقيك، ومسند الفخذ من الأعلى.", "پشتگرەکە لە پشت خوارەوەی قاچەکانت، پشتگری ڕان لە سەرەوە."],
        ["Pull your heels down and back, then return slowly.", "اسحب كعبيك للأسفل وللخلف، ثم ارجع ببطء.", "پاژنەکانت بۆ خوارەوە و دواوە ڕابکێشە، پاشان بە هێواشی بگەڕێوە."]] },
    leg_press: { a: "leg_press", m: ["quads", "glutes"], d: { s: 3, r: "10–12" },
      n: ["Leg press", "ضغط الساقين", "پاڵنانی قاچ"],
      s: [["Feet flat on the plate, shoulder-width apart.", "القدمان مسطحتان على اللوح وبعرض الكتفين.", "پێیەکانت ڕاست لەسەر تەختەکە، بە پانی شانەکانت."],
        ["Push the plate away. Don't lock your knees. Bend back slowly.", "ادفع اللوح بعيداً دون قفل الركبتين، ثم اثنِهما ببطء.", "تەختەکە پاڵ بنێ بەبێ قوفڵکردنی ئەژنۆ، پاشان بە هێواشی بیانچەمێنەوە."]] },
    hack_squat: { a: "hack_squat", m: ["quads", "glutes"], d: { s: 3, r: "10" },
      n: ["Machine squat", "سكوات على الجهاز", "سکوات لەسەر ئامێر"],
      s: [["Back flat on the pad, shoulders under the pads.", "الظهر على المسند والكتفان تحت المساند.", "پشتت لەسەر پشتگرەکە، شانەکانت لە ژێر پشتگرەکان."],
        ["Squat down, then push up through your heels.", "انزل، ثم ادفع للأعلى بكعبيك.", "دابنیشە، پاشان بە پاژنەکانت پاڵ بنێ بۆ سەرەوە."]] },
    smith_squat: { a: "smith_squat", m: ["quads", "glutes"], d: { s: 3, r: "10" },
      n: ["Smith machine squat", "سكوات على جهاز سميث", "سکوات لەسەر ئامێری سمیس"],
      s: [["Bar on your upper back. Feet a little in front.", "البار على أعلى ظهرك، والقدمان أمامك قليلاً.", "بارەکە لەسەر سەرەوەی پشتت، پێیەکانت کەمێک لە پێشەوە."],
        ["Squat down, then stand up.", "انزل، ثم قف.", "دابنیشە، پاشان هەستە."]] },
    smith_bench: { a: "smith_bench", m: ["chest", "triceps"], d: { s: 3, r: "10" },
      n: ["Smith machine bench press", "ضغط الصدر على جهاز سميث", "پاڵنانی سنگ لەسەر ئامێری سمیس"],
      s: [["Lie on a bench under the bar.", "استلقِ على مقعد تحت البار.", "لەسەر کورسییەک لە ژێر بارەکە ڕاکشێ."],
        ["Lower the bar to your chest, then press up.", "أنزل البار إلى صدرك، ثم ادفعه للأعلى.", "بارەکە تا سنگت دایبەزێنە، پاشان پاڵی بنێ بۆ سەرەوە."]] },
    seated_calf: { a: "seated_calf", m: ["calves"], d: { s: 3, r: "15" },
      n: ["Seated calf raise", "رفع السمانة جالساً", "بەرزکردنەوەی کاف بە دانیشتن"],
      s: [["Pad on your knees, balls of your feet on the step.", "المسند على ركبتيك ومقدمة القدمين على الدرجة.", "پشتگرەکە لەسەر ئەژنۆکانت، پێشەوەی پێیەکانت لەسەر پلەکە."],
        ["Raise your heels high, then lower slowly.", "ارفع كعبيك عالياً، ثم أنزلهما ببطء.", "پاژنەکانت بەرز بکەوە، پاشان بە هێواشی دایانبەزێنە."]] },
    adductor: { a: "hip_adduction", m: ["adductors"], d: { s: 3, r: "15" },
      n: ["Inner thigh machine", "جهاز الفخذ الداخلي", "ئامێری ناوەوەی ڕان"],
      s: [["Pads on the inside of your knees.", "المساند على الجهة الداخلية لركبتيك.", "پشتگرەکان لە ناوەوەی ئەژنۆکانت."],
        ["Squeeze your legs together, then open slowly.", "اضغط ساقيك معاً، ثم افتحهما ببطء.", "قاچەکانت پێکەوە بگوشە، پاشان بە هێواشی بیانکەوە."]] },
    abductor: { a: "hip_abduction", m: ["abductors", "glutes"], d: { s: 3, r: "15" },
      n: ["Outer hip machine", "جهاز الورك الخارجي", "ئامێری دەرەوەی سمت"],
      s: [["Pads on the outside of your knees.", "المساند على الجهة الخارجية لركبتيك.", "پشتگرەکان لە دەرەوەی ئەژنۆکانت."],
        ["Push your legs out, then return slowly.", "افتح ساقيك للخارج، ثم ارجع ببطء.", "قاچەکانت بۆ دەرەوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە."]] },
    glute_kick: { a: "glute_machine", m: ["glutes", "hamstrings"], d: { s: 3, r: "12", each: "leg" },
      n: ["Glute kickback", "ركلة الأرداف الخلفية", "لەقەی دواوەی سمت"],
      s: [["Chest on the pad. One foot on the plate.", "الصدر على المسند وقدم واحدة على اللوح.", "سنگت لەسەر پشتگرەکە، پێیەک لەسەر تەختەکە."],
        ["Push your leg back, then return slowly.", "ادفع ساقك للخلف، ثم ارجع ببطء.", "قاچت بۆ دواوە پاڵ بنێ، پاشان بە هێواشی بگەڕێوە."]] },
    ab_crunch: { a: "ab_machine", m: ["abs"], d: { s: 3, r: "15" },
      n: ["Ab crunch machine", "جهاز البطن", "ئامێری سک"],
      s: [["Hold the handles. Feet under the pads.", "أمسك المقابض والقدمان تحت المساند.", "دەسکەکان بگرە، پێیەکانت لە ژێر پشتگرەکان."],
        ["Curl your chest down, then return slowly.", "اثنِ صدرك للأسفل، ثم ارجع ببطء.", "سنگت بۆ خوارەوە بچەمێنەوە، پاشان بە هێواشی بگەڕێوە."]] },
    back_ext: { a: "back_extension", m: ["lowerback"], d: { s: 3, r: "12" },
      n: ["Back extension", "تمديد الظهر", "درێژکردنەوەی پشت"],
      s: [["Pad on your upper back. Arms on your chest.", "المسند على أعلى ظهرك والذراعان على صدرك.", "پشتگرەکە لەسەر سەرەوەی پشتت، باسکەکانت لەسەر سنگت."],
        ["Push back until you sit tall, then return slowly.", "ادفع للخلف حتى تجلس مستقيماً، ثم ارجع ببطء.", "بۆ دواوە پاڵ بنێ تا ڕاست دادەنیشیت، پاشان بە هێواشی بگەڕێوە."]] },
    cable_fly: { a: "cable_fly", m: ["chest"], d: { s: 3, r: "12" },
      n: ["Cable fly", "تفتيح بالكابل", "فلای بە کێبڵ"],
      s: [["Pulleys high. Step forward, arms wide.", "البكرات عالية. تقدّم خطوة والذراعان مفتوحتان.", "پوللییەکان بەرز. هەنگاوێک بۆ پێشەوە بنێ، باسکەکانت کراوە."],
        ["Bring your hands together low in front, then open slowly.", "اجمع يديك أمامك في الأسفل، ثم افتحهما ببطء.", "دەستەکانت لە پێشەوە لە خوارەوە کۆ بکەوە، پاشان بە هێواشی بیانکەوە."]] },
    cable_curl: { a: "curl_band", m: ["biceps"], d: { s: 3, r: "12" },
      n: ["Cable curl", "تمرين البايسبس بالكابل", "بایسێپس بە کێبڵ"],
      s: [["Pulley low. Stand tall, elbows by your sides.", "البكرة في الأسفل. قف مستقيماً والمرفقان بجانبيك.", "پوللییەکە لە خوارەوە. ڕاست بوەستە، ئانیشکەکانت لە تەنیشتت."],
        ["Curl the handle up, then lower slowly.", "ارفع المقبض بثني المرفقين، ثم أنزله ببطء.", "دەسکەکە بەرز بکەوە، پاشان بە هێواشی دایبەزێنە."]] }
  };

  /* ---------- machine types (3 exercises each; "~one" / "~slow" / "~pause" = the same move done another way) ---------- */
  var TYPES = {
    treadmill: ["walk", "incline_walk", "run_int"],
    bike: ["ride", "climb", "sprint"],
    rower: ["row_full", "row_legs", "row_power"],
    barbell: ["squat_bar", "deadlift", "ohp"],
    plates: ["plate_raise", "plate_squat", "squat_bar"],
    dumbbells: ["db_curl", "db_press", "db_lunge"],
    bench: ["db_bench", "bench_row", "step_up"],
    mat: ["plank", "glute_bridge", "crunch"],
    ball: ["ball_crunch", "ball_wall_squat", "ball_bridge"],
    bands: ["band_row", "band_press", "band_curl"],
    handle: ["band_press", "band_row", "band_curl"],
    belt: ["dips_w", "pullup_w", "belt_squat"],
    ankle: ["kickback", "cable_abduct", "leg_raise"],
    chestpress: ["chest_press", "chest_press~one", "chest_press~slow"],
    incline: ["incline_press", "incline_press~one", "incline_press~slow"],
    decline: ["decline_press", "decline_press~slow", "decline_press~pause"],
    pecfly: ["pec_fly", "rear_fly", "pec_fly~pause"],
    shoulderpress: ["shoulder_press", "shoulder_press~one", "shoulder_press~slow"],
    lateral: ["lateral_raise", "lateral_raise~pause", "lateral_raise~slow"],
    chestshoulder: ["chest_press", "shoulder_press", "chest_press~slow"],
    pulldown: ["lat_pulldown", "lat_pulldown~slow", "lat_pulldown~pause"],
    row: ["seated_row", "seated_row~one", "seated_row~pause"],
    pullrow: ["lat_pulldown", "seated_row", "seated_row~one"],
    dip: ["seated_dip", "seated_dip~slow", "seated_dip~pause"],
    assist: ["assist_pullup", "assist_dip", "assist_pullup~slow"],
    biceps: ["machine_curl", "machine_curl~one", "machine_curl~slow"],
    triceps: ["triceps_ext", "triceps_ext~one", "triceps_ext~pause"],
    bitri: ["machine_curl", "triceps_ext", "machine_curl~slow"],
    legext: ["leg_ext", "leg_ext~one", "leg_ext~pause"],
    legcurlprone: ["prone_curl", "prone_curl~one", "prone_curl~slow"],
    legcurlseated: ["seated_curl", "seated_curl~one", "seated_curl~slow"],
    legextcurl: ["leg_ext", "seated_curl", "leg_ext~one"],
    legpress: ["leg_press", "leg_press~one", "leg_press~slow"],
    squatmachine: ["hack_squat", "hack_squat~slow", "hack_squat~pause"],
    smith: ["smith_squat", "smith_bench", "smith_squat~slow"],
    calf: ["seated_calf", "seated_calf~pause", "seated_calf~slow"],
    adductor: ["adductor", "adductor~pause", "adductor~slow"],
    abductor: ["abductor", "abductor~pause", "abductor~slow"],
    addabd: ["adductor", "abductor", "adductor~pause"],
    glute: ["glute_kick", "glute_kick~pause", "glute_kick~slow"],
    abback: ["ab_crunch", "back_ext", "ab_crunch~slow"],
    abs: ["ab_crunch", "ab_crunch~slow", "ab_crunch~pause"],
    backext: ["back_ext", "back_ext~slow", "back_ext~pause"],
    cable: ["cable_fly", "cable_curl", "kickback"]
  };

  function nameEn(p) { var n = p.name; return String(typeof n === "string" ? n : (n && (n.en || n.ar || n.ckb)) || ""); }

  // which machine type is this product? (admin choice first, then name and category)
  function typeOf(p) {
    if (!p) return null;
    if (p.ex) return p.ex === "none" ? null : (TYPES[p.ex] ? p.ex : null);
    var n = nameEn(p).toLowerCase(), c = p.cat || "";
    if (c === "treadmills" || /treadmill/.test(n)) return "treadmill";
    if (c === "bikes" || /\bbike|cycle|spinning/.test(n)) return "bike";
    if (/rower|rowing machine/.test(n) && c !== "gym-equipment") return "rower";
    if (c === "free-weights" || c === "accessories") {
      if (/barbell|\bbar\b/.test(n)) return "barbell";
      if (/bumper|plate|tri-?grip/.test(n)) return "plates";
      if (/dumbbell|kettlebell/.test(n)) return "dumbbells";
      if (/bench/.test(n)) return "bench";
      if (/yoga|mat\b/.test(n)) return "mat";
      if (/ball/.test(n)) return "ball";
      if (/band/.test(n)) return "bands";
      if (/handle/.test(n)) return "handle";
      if (/belt/.test(n)) return "belt";
      if (/ankle/.test(n)) return "ankle";
      return null;
    }
    var rules = [
      [/smith/, "smith"],
      [/extension.*curl|curl.*extension/, "legextcurl"],
      [/abdominal.*back|ab.*back ext/, "abback"],
      [/pull ?down.*row|row.*pull ?down/, "pullrow"],
      [/chest.*shoulder/, "chestshoulder"],
      [/biceps.*triceps|triceps.*biceps/, "bitri"],
      [/add.*abd|abd.*add/, "addabd"],
      [/adductor/, "adductor"],
      [/abductor/, "abductor"],
      [/leg press/, "legpress"],
      [/hack|squat/, "squatmachine"],
      [/calf/, "calf"],
      [/leg extension/, "legext"],
      [/prone.*curl|lying.*curl/, "legcurlprone"],
      [/leg curl/, "legcurlseated"],
      [/glute|rear kick|kickback/, "glute"],
      [/\bassist|\bchin\b/, "assist"],
      [/dip/, "dip"],
      [/triceps/, "triceps"],
      [/biceps|curl/, "biceps"],
      [/lateral/, "lateral"],
      [/multi ?flight|crossover|cable/, "cable"],
      [/fly|flight|rear delt|pec/, "pecfly"],
      [/row/, "row"],
      [/pull ?down|lat /, "pulldown"],
      [/deltoid|shoulder/, "shoulderpress"],
      [/incline/, "incline"],
      [/decline/, "decline"],
      [/press/, "chestpress"],
      [/abdominal|crunch/, "abs"],
      [/back extension/, "backext"]
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(n)) return rules[i][1];
    return null;
  }
  M.exerciseType = typeOf;
  M.EXERCISE_TYPES = Object.keys(TYPES);

  // one exercise (with its variant) ready to show
  function exercise(id) {
    var parts = id.split("~"), base = EX[parts[0]];
    if (!base) return null;
    var vr = parts[1] || "", d = t();
    var limb = /legs?/.test(base.a) || ["leg_extension", "seated_leg_curl", "prone_curl", "leg_press", "hack_squat", "seated_calf", "hip_adduction", "hip_abduction", "glute_machine"].indexOf(base.a) !== -1 ? "leg" : "arm";
    var name = L(base.n), steps = base.s.map(L);
    if (vr === "one") { name = d.exOne(name, limb); steps.push(d.exStepOne(limb)); }
    if (vr === "slow") { name = d.exSlow(name); steps.push(d.exStepSlow); }
    if (vr === "pause") { name = d.exPause(name); steps.push(d.exStepPause); }
    return { id: id, a: base.a, vr: vr, m: base.m, d: base.d, name: name, steps: steps };
  }
  function exercisesFor(p) {
    var ty = typeOf(p);
    return ty ? TYPES[ty].map(exercise).filter(Boolean) : [];
  }
  M.exercisesFor = exercisesFor;
  function musclesOf(p) {
    var out = {};
    exercisesFor(p).forEach(function (ex) {
      ex.m.forEach(function (m, i) { out[m] = (out[m] || 0) + (i === 0 ? 3 : i === 1 ? 2 : 1); });
    });
    return out;
  }

  /* ---------- product window: 3 exercises ---------- */
  var lb = document.getElementById("lightbox");
  var related = document.getElementById("lbRelated");
  var box = el("div", "lb-ex");
  box.id = "lbEx";
  box.hidden = true;
  var exTitle = el("p", "lb-ex-title");
  var exRow = el("div", "lb-ex-row");
  var detail = el("div", "ex-detail");
  detail.hidden = true;
  box.appendChild(exTitle);
  box.appendChild(exRow);
  box.appendChild(detail);
  if (related && related.parentNode) related.parentNode.insertBefore(box, related);
  var current = null, list = [];

  function doseChip(dd) { return el("span", "ex-dose", t().exDose(dd)); }

  function showList() {
    detail.hidden = true;
    detail.textContent = "";
    exRow.hidden = false;
    exTitle.hidden = false;
    exRow.querySelectorAll(".fx").forEach(function (s, i) { if (list[i]) FIG.play(s, list[i].a, list[i].vr); });
  }

  function showDetail(i, opener) {
    var ex = list[i], d = t();
    if (!ex) return;
    FIG.stop(exRow);
    exRow.hidden = true;
    exTitle.hidden = true;
    detail.textContent = "";
    detail.hidden = false;
    var fig = el("div", "ex-big");
    fig.innerHTML = FIG.svg(ex.a, ex.vr, 0, ex.name);
    detail.appendChild(fig);
    var info = el("div", "ex-info");
    var h = el("h4", "ex-name", ex.name);
    h.tabIndex = -1;
    info.appendChild(h);
    info.appendChild(doseChip(ex.d));
    var works = el("p", "ex-works");
    works.appendChild(el("span", "ex-works-label", d.exWorks + ": "));
    ex.m.forEach(function (m, k) {
      var b = el("button", "ex-muscle" + (k === 0 ? " is-main" : ""), d.muscles[m] || m);
      b.type = "button";
      b.addEventListener("click", function () { openMap(m, b, current); });
      works.appendChild(b);
    });
    info.appendChild(works);
    info.appendChild(el("p", "ex-how", d.exHow));
    var ol = el("ol", "ex-steps");
    ex.steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
    info.appendChild(ol);
    info.appendChild(el("p", "ex-safe", d.exSafety));
    var btns = el("div", "ex-btns");
    var back = M.iconButton ? M.iconButton("btn btn-outline ex-back", "left", d.exBack, true) : el("button", "btn btn-outline ex-back", d.exBack);
    back.type = "button";
    back.addEventListener("click", function () {
      showList();
      var c = exRow.children[i];
      if (c) c.focus({ preventScroll: true });
    });
    var map = el("button", "btn btn-outline ex-map", d.mmOpen);
    map.type = "button";
    map.addEventListener("click", function () { openMap(ex.m[0], map, current); });
    btns.appendChild(back);
    btns.appendChild(map);
    info.appendChild(btns);
    detail.appendChild(info);
    FIG.play(fig.querySelector(".fx"), ex.a, ex.vr);
    h.focus({ preventScroll: true });
    try { detail.scrollIntoView({ block: "nearest" }); } catch (e) { /* ignore */ }
  }

  function fill(p) {
    current = p;
    FIG.stop(box);
    list = exercisesFor(p);
    exRow.textContent = "";
    detail.hidden = true;
    detail.textContent = "";
    box.hidden = !list.length;
    if (!list.length) return;
    var d = t();
    exTitle.textContent = d.exTitle;
    exTitle.hidden = false;
    exRow.hidden = false;
    list.forEach(function (ex, i) {
      var b = el("button", "ex-card");
      b.type = "button";
      b.setAttribute("aria-label", ex.name + ". " + d.exDose(ex.d));
      var fig = el("span", "ex-fig");
      fig.innerHTML = FIG.svg(ex.a, ex.vr, 0);
      b.appendChild(fig);
      b.appendChild(el("span", "ex-card-name", ex.name));
      b.appendChild(doseChip(ex.d));
      b.addEventListener("click", function () { showDetail(i, b); });
      exRow.appendChild(b);
      FIG.play(fig.querySelector(".fx"), ex.a, ex.vr);
    });
  }
  M.onLightbox(function (p) { try { fill(p); } catch (e) { box.hidden = true; } });
  if (lb) lb.addEventListener("modal-close", function () { FIG.stop(box); });
  M.onRender(function () { if (lb && !lb.hidden && current) fill(current); });

  /* ---------- muscle map ---------- */
  var MUSCLES = ["chest", "shoulders", "biceps", "triceps", "forearms", "abs", "back", "lowerback", "glutes", "quads", "hamstrings", "adductors", "abductors", "calves", "cardio"];
  // body drawn as left half, mirrored for the right half (viewBox 200 x 400)
  var OUTLINE = [[90, 70], [76, 76], [62, 80], [54, 92], [50, 106], [46, 124], [44, 142], [41, 166], [38, 190], [40, 199], [46, 201], [50, 193], [54, 171], [58, 151], [62, 133], [66, 119], [68, 140], [68, 166], [66, 186], [64, 214], [64, 250], [66, 282], [64, 300], [64, 330], [66, 362], [64, 378], [60, 388], [84, 391], [84, 376], [86, 350], [88, 320], [90, 290], [92, 262], [96, 226], [100, 214]];
  function outlinePath() {
    var left = OUTLINE.map(function (p) { return p[0] + "," + p[1]; });
    var right = OUTLINE.slice().reverse().map(function (p) { return (200 - p[0]) + "," + p[1]; });
    return '<polygon class="mm-skin" points="' + left.concat(right).join(" ") + '"/>' +
      '<ellipse class="mm-skin" cx="100" cy="40" rx="19" ry="24"/><rect class="mm-skin" x="90" y="58" width="20" height="16" rx="4"/>';
  }
  var FRONT = {
    shoulders: "M76,78 Q58,80 54,98 Q56,110 64,108 Q68,92 80,84 Z",
    chest: "M98,80 L82,82 Q70,90 70,104 Q74,116 86,118 Q96,118 98,112 Z",
    biceps: "M54,104 Q48,122 50,140 Q56,144 62,138 Q66,122 64,108 Z",
    forearms: "M50,146 Q42,170 42,190 L51,192 Q60,172 61,146 Z",
    abs: "M72,112 Q78,120 85,122 L86,170 Q78,166 72,150 Q70,130 72,112 Z",
    quads: "M72,186 Q62,220 66,262 Q74,276 86,272 Q95,240 95,202 Q86,192 72,186 Z",
    adductors: "M97,200 L100,206 L99,240 Q95,258 90,266 Q94,236 97,200 Z",
    calves: "M70,288 Q64,318 68,352 L78,354 Q86,320 84,290 Z"
  };
  var FRONT_MID = { abs: "M88,120 L112,120 L111,172 Q100,180 89,172 Z" };
  var BACK = {
    shoulders: "M76,78 Q58,80 54,98 Q56,110 64,108 Q68,92 80,84 Z",
    triceps: "M54,104 Q48,122 50,140 Q56,144 62,138 Q66,122 64,108 Z",
    forearms: "M50,146 Q42,170 42,190 L51,192 Q60,172 61,146 Z",
    back: "M82,98 Q70,106 70,124 Q76,150 92,158 L99,150 L99,122 Q92,104 82,98 Z",
    abductors: "M69,180 Q63,194 67,212 Q70,203 74,196 Q77,187 83,181 Z",
    glutes: "M99,184 Q82,182 74,196 Q70,213 82,222 Q95,224 99,212 Z",
    hamstrings: "M72,226 Q66,250 70,276 L86,278 Q94,252 96,228 Q84,230 72,226 Z",
    calves: "M68,290 Q60,312 66,340 Q74,346 82,340 Q88,312 84,290 Z"
  };
  var BACK_MID = {
    back: "M100,64 L80,79 L88,95 L100,118 L112,95 L120,79 Z",
    lowerback: "M91,158 L100,151 L109,158 L108,181 L92,181 Z"
  };
  function bodySvg(side, sel, counts) {
    var parts = side === "front" ? FRONT : BACK, mid = side === "front" ? FRONT_MID : BACK_MID, d = t();
    var s = '<svg class="mm-body" viewBox="0 0 200 400" role="group" aria-label="' + (side === "front" ? d.mmFront : d.mmBack) + '">' + outlinePath();
    var seen = {};
    function shape(m, path, mirror) {
      var cls = "mm-m" + (m === sel ? " is-on" : "") + (counts[m] ? "" : " is-none");
      return '<path class="' + cls + '" data-m="' + m + '" d="' + path + '"' + (mirror ? ' transform="matrix(-1 0 0 1 200 0)"' : "") + "/>";
    }
    Object.keys(parts).forEach(function (m) { s += shape(m, parts[m], false) + shape(m, parts[m], true); });
    Object.keys(mid).forEach(function (m) { s += shape(m, mid[m], false); });
    // one invisible button per muscle for keyboard and screen readers
    Object.keys(parts).concat(Object.keys(mid)).forEach(function (m) { seen[m] = 1; });
    s += "</svg>";
    return { svg: s, muscles: Object.keys(seen) };
  }

  var modal = el("div", "lightbox");
  modal.id = "mmModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "mmTitle");
  modal.hidden = true;
  var panel = el("div", "lightbox-panel panel-pad mm-panel");
  var closeBtn = el("button", "lightbox-close");
  closeBtn.type = "button";
  closeBtn.id = "mmClose";
  closeBtn.innerHTML = "&times;";
  var mmTitle = el("h2", "panel-title");
  mmTitle.id = "mmTitle";
  var mmIntro = el("p", "panel-note");
  var bodies = el("div", "mm-bodies");
  var chips = el("div", "mm-chips");
  chips.setAttribute("role", "group");
  var result = el("div", "mm-result");
  result.setAttribute("aria-live", "polite");
  panel.appendChild(closeBtn);
  panel.appendChild(mmTitle);
  panel.appendChild(mmIntro);
  panel.appendChild(bodies);
  panel.appendChild(chips);
  panel.appendChild(result);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  modal.addEventListener("click", function (e) { if (e.target === modal) M.closeModal(); });
  closeBtn.addEventListener("click", function () { M.closeModal(); });

  var selected = null, backToMap = false, fromProduct = null;

  function productsFor(m) {
    var out = [];
    (window.MF.PRODUCTS || window.PRODUCTS || []).forEach(function (p, i) {
      var sc = musclesOf(p)[m];
      if (sc) out.push({ p: p, s: sc, i: i });
    });
    out.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return out.map(function (x) { return x.p; });
  }
  function countAll() {
    var c = {};
    MUSCLES.forEach(function (m) { c[m] = productsFor(m).length; });
    return c;
  }

  function drawMap() {
    var d = t(), counts = countAll();
    mmTitle.textContent = d.mmTitle;
    closeBtn.setAttribute("aria-label", d.close);
    mmIntro.textContent = d.mmIntro;
    bodies.textContent = "";
    ["front", "back"].forEach(function (side) {
      var fig = el("figure", "mm-fig");
      var b = bodySvg(side, selected, counts);
      fig.innerHTML = b.svg;
      fig.appendChild(el("figcaption", null, side === "front" ? d.mmFront : d.mmBack));
      bodies.appendChild(fig);
    });
    chips.setAttribute("aria-label", d.mmPick);
    chips.textContent = "";
    MUSCLES.forEach(function (m) {
      var c = el("button", "mm-chip" + (m === "cardio" ? " mm-chip-cardio" : ""), d.muscles[m]);
      c.type = "button";
      c.setAttribute("data-m", m);
      c.setAttribute("aria-pressed", m === selected ? "true" : "false");
      if (!counts[m]) c.classList.add("is-none");
      chips.appendChild(c);
    });
    drawResult();
  }

  function drawResult() {
    var d = t();
    result.textContent = "";
    if (!selected) { result.appendChild(el("p", "mm-hint", d.mmIntro)); return; }
    var items = productsFor(selected);
    var head = el("div", "mm-res-head");
    head.appendChild(el("h3", "mm-res-title", d.muscles[selected]));
    head.appendChild(el("span", "mm-res-count", items.length ? d.mmCount(items.length) : ""));
    result.appendChild(head);
    if (!items.length) {
      result.appendChild(el("p", "mm-hint", d.mmNone));
      return;
    }
    var grid = el("div", "mm-grid");
    items.forEach(function (p) {
      var b = el("button", "mm-item");
      b.type = "button";
      var img = document.createElement("img");
      img.src = M.imgSrc ? M.imgSrc(p) : (p.imageData || (M.S.imageBase + (p.thumbnail || p.image)));
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      var name = M.tr(p.name);
      var exs = exercisesFor(p).filter(function (ex) { return ex.m.indexOf(selected) !== -1; });
      b.appendChild(img);
      b.appendChild(el("span", "mm-item-name", name));
      if (exs[0]) b.appendChild(el("span", "mm-item-ex", exs[0].name));
      b.addEventListener("click", function () {
        fromProduct = null; // going to a new product: closing it comes back here
        backToMap = true;
        M.openLightbox(p, b);
      });
      grid.appendChild(b);
    });
    result.appendChild(grid);
  }

  function pick(m, focusChip) {
    selected = m;
    bodies.querySelectorAll(".mm-m").forEach(function (n) { n.classList.toggle("is-on", n.getAttribute("data-m") === m); });
    chips.querySelectorAll(".mm-chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-m") === m ? "true" : "false"); });
    drawResult();
    if (focusChip) { var c = chips.querySelector('[data-m="' + m + '"]'); if (c) c.focus({ preventScroll: true }); }
    if (window.matchMedia && window.matchMedia("(max-width: 680px)").matches) {
      try { result.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* ignore */ }
    }
  }
  bodies.addEventListener("click", function (e) {
    var n = e.target.closest && e.target.closest(".mm-m");
    if (n) pick(n.getAttribute("data-m"), true);
  });
  chips.addEventListener("click", function (e) {
    var c = e.target.closest(".mm-chip");
    if (c) pick(c.getAttribute("data-m"), false);
  });

  function openMap(m, opener, fromP) {
    selected = m || selected;
    fromProduct = fromP || null;
    drawMap();
    M.openModal(modal, opener || null, closeBtn);
    if (m) { var c = chips.querySelector('[data-m="' + m + '"]'); if (c) c.focus({ preventScroll: true }); }
  }
  M.openMuscleMap = openMap;

  // after a product from the map is closed: back to the map
  var req = document.getElementById("reqModal");
  if (lb) lb.addEventListener("modal-close", function () {
    if (!backToMap) return;
    setTimeout(function () {
      if (req && !req.hidden) return;
      backToMap = false;
      if (!root.classList.contains("lb-open") && !root.classList.contains("stage-open")) {
        drawMap();
        M.openModal(modal, null, closeBtn);
        var first = result.querySelector(".mm-item");
        if (first) first.focus({ preventScroll: true });
      }
    }, 0);
  });
  if (req) req.addEventListener("modal-close", function () {
    if (!backToMap) return;
    setTimeout(function () { if (!lb || lb.hidden) backToMap = false; }, 20);
  });
  // the map opened from a product: closing it goes back to that product
  modal.addEventListener("modal-close", function () {
    var p = fromProduct;
    fromProduct = null;
    if (!p) return;
    setTimeout(function () {
      if (!root.classList.contains("lb-open") && !root.classList.contains("stage-open")) M.openLightbox(p, null);
    }, 0);
  });

  document.querySelectorAll("[data-open-muscles]").forEach(function (b) {
    b.addEventListener("click", function () {
      var nav = document.getElementById("navLinks");
      if (nav && nav.classList.contains("open")) { var mt = document.getElementById("menuToggle"); if (mt) mt.click(); }
      openMap(null, b, null);
    });
  });
  M.onRender(function () { if (!modal.hidden) drawMap(); });
})();
