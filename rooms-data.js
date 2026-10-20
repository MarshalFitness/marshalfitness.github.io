/* Marshal Fitness — version 22: the built-in ready gym rooms.
   Used by rooms.js (website) and admin22.js (admin can change them; saved in content/rooms).
   items: [product image, how many]. W x L = room size in metres. */
window.ROOMS_BUILT_IN = [
  { id: "flat", W: 3, L: 3.5,
    name: { en: "Small flat gym", ar: "جيم شقة صغيرة", ckb: "هۆڵی وەرزشی شوقەی بچووک" },
    note: { en: "Cardio and strength in one small room.", ar: "كارديو وقوة في غرفة صغيرة واحدة.", ckb: "کاردیۆ و هێز لە یەک ژووری بچووکدا." },
    items: [["marshall-2260.webp", 1], ["standard-bench.webp", 1], ["standard-dumbbell.webp", 1], ["standard-yogamat.webp", 1], ["standard-bands.webp", 1]] },
  { id: "cardio", W: 3, L: 3,
    name: { en: "Cardio corner", ar: "ركن الكارديو", ckb: "گۆشەی کاردیۆ" },
    note: { en: "Walk, run and ride at home.", ar: "امشِ واركض واركب الدراجة في البيت.", ckb: "لە ماڵەوە بڕۆ، ڕابکە و بایسکل لێبخوڕە." },
    items: [["marshall-2260.webp", 1], ["standard-bike.webp", 1], ["standard-yogamat.webp", 1]] },
  { id: "ladies", W: 4, L: 4,
    name: { en: "Ladies' home gym", ar: "جيم منزلي للسيدات", ckb: "هۆڵی وەرزشی ماڵەوە بۆ ئافرەتان" },
    note: { en: "Cardio, toning and stretching.", ar: "كارديو وشد الجسم وإطالة.", ckb: "کاردیۆ، ڕێکخستنی لەش و کشاندن." },
    items: [["marshal-apollo.webp", 1], ["standard-bike.webp", 1], ["standard-yogamat.webp", 2], ["standard-ball.webp", 1], ["standard-bands.webp", 1], ["standard-dumbbell.webp", 1], ["standard-ankle.webp", 1]] },
  { id: "garage", W: 4, L: 5,
    name: { en: "Garage gym", ar: "جيم الكراج", ckb: "هۆڵی وەرزشی گەراج" },
    note: { en: "Real strength training at home.", ar: "تمارين قوة حقيقية في البيت.", ckb: "ڕاهێنانی هێزی ڕاستەقینە لە ماڵەوە." },
    items: [["gym/u3063.webp", 1], ["standard-bench.webp", 1], ["standard-barbell.webp", 1], ["standard-bumper.webp", 1], ["standard-dumbbell.webp", 1], ["standard-bike.webp", 1], ["standard-yogamat.webp", 1]] },
  { id: "hotel", W: 7, L: 8,
    name: { en: "Hotel gym", ar: "جيم الفندق", ckb: "هۆڵی وەرزشی هوتێل" },
    note: { en: "Two-in-one machines save space.", ar: "أجهزة اثنين في واحد توفّر المساحة.", ckb: "ئامێری دوو لە یەک شوێن دەگرێتەوە." },
    items: [["marshal-apollo.webp", 2], ["standard-bike.webp", 1], ["gym/u2084.webp", 1], ["gym/u2085.webp", 1], ["gym/u2086.webp", 1], ["gym/u2088.webp", 1], ["gym/u2021.webp", 1], ["standard-bench.webp", 1], ["standard-dumbbell.webp", 1], ["standard-yogamat.webp", 2], ["standard-ball.webp", 1]] },
  { id: "studio", W: 9, L: 10.5,
    name: { en: "Women's studio gym", ar: "جيم استوديو للسيدات", ckb: "هۆڵی وەرزشی ستۆدیۆ بۆ ئافرەتان" },
    note: { en: "Legs, glutes and cardio for a ladies' gym.", ar: "أرجل وأرداف وكارديو لصالة السيدات.", ckb: "قاچ، سمت و کاردیۆ بۆ هۆڵی ئافرەتان." },
    items: [["marshal-apollo.webp", 2], ["standard-bike.webp", 2], ["gym/u2021.webp", 1], ["gym/btm-016a.webp", 1], ["gym/u2003.webp", 1], ["gym/u2007.webp", 1], ["gym/u2012.webp", 1], ["gym/u2034.webp", 1], ["standard-yogamat.webp", 3], ["standard-ball.webp", 2], ["standard-bands.webp", 2]] },
  { id: "strength", W: 8, L: 9,
    name: { en: "Bodybuilding corner", ar: "ركن كمال الأجسام", ckb: "گۆشەی لەشجوانی" },
    note: { en: "Heavy machines for chest, back and legs.", ar: "أجهزة ثقيلة للصدر والظهر والأرجل.", ckb: "ئامێری قورس بۆ سنگ، پشت و قاچ." },
    items: [["gym/u3063.webp", 1], ["gym/u3056.webp", 1], ["gym/e3057.webp", 1], ["gym/y905za.webp", 1], ["gym/y920za.webp", 1], ["gym/y925za.webp", 1], ["standard-bench.webp", 2], ["standard-barbell.webp", 1], ["standard-bumper.webp", 1], ["standard-trigrip.webp", 1], ["standard-dumbbell.webp", 1]] }
];
