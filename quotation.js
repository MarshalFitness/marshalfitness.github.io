(function () {
  'use strict';
  var M = window.MF;
  if (!M) return;
  var copy = {
    en: {title:'My Equipment List',add:'Add to my list',added:'Added to my list',empty:'Your list is empty. Add equipment from the shop.',qty:'Quantity',remove:'Remove',send:'Request quotation on WhatsApp',note:'Your message includes product names, codes, quantities and picture links. Tap Send in WhatsApp to submit your request.',services:'Delivery, Installation & Warranty',delivery:'Complimentary delivery within Erbil. Delivery outside Erbil is available for a modest additional fee, depending on your location.',installation:'Professional installation is provided free of charge by our staff serving Erbil, the Kurdistan Region and the rest of Iraq.',warranty:'Five-year warranty covering all equipment parts, limited to one warranty claim during the five-year period.',repairs:'Our technicians provide on-site repairs at your home, gym or office.',labels:['Delivery','Free Installation','Five-Year Warranty','On-Site Repairs'],contact:'Contact Service & Repairs',intro:'Hello Marshal Fitness, could I get a quotation for the following equipment?',code:'Code',photo:'Picture',announce:'Added to your equipment list.'},
    ar: {title:'قائمة معدّاتي',add:'أضف إلى قائمتي',added:'تمت الإضافة إلى قائمتي',empty:'قائمتك فارغة. أضف المعدات من المتجر.',qty:'الكمية',remove:'إزالة',send:'طلب عرض سعر عبر واتساب',note:'تتضمن الرسالة أسماء المنتجات ورموزها والكميات وروابط الصور. اضغط إرسال في واتساب لإرسال الطلب.',services:'التوصيل والتركيب والضمان',delivery:'توصيل مجاني داخل أربيل. يتوفر التوصيل خارج أربيل مقابل رسوم إضافية بسيطة تُحدّد حسب الموقع.',installation:'تركيب احترافي مجاني على أيدي موظفينا الذين يخدمون أربيل وإقليم كردستان وبقية أنحاء العراق.',warranty:'ضمان لمدة خمس سنوات يشمل جميع أجزاء المعدات، ويقتصر على مطالبة واحدة بالضمان خلال هذه المدة.',repairs:'يقدم فنيونا خدمات الإصلاح في منزلك أو صالتك الرياضية أو مكتبك.',labels:['التوصيل','تركيب مجاني','ضمان خمس سنوات','الإصلاح في موقعك'],contact:'التواصل مع الصيانة والإصلاح',intro:'مرحباً مارشال فتنس، أرجو عرض سعر للمعدات التالية:',code:'الرمز',photo:'الصورة',announce:'تمت الإضافة إلى قائمة معداتك.'},
    ckb: {title:'لیستی ئامێرەکانم',add:'زیادکردن بۆ لیستەکەم',added:'زیادکرا بۆ لیستەکەم',empty:'لیستەکەت بەتاڵە. لە دوکان ئامێر زیاد بکە.',qty:'ژمارە',remove:'سڕینەوە',send:'داواکردنی نرخ لە واتساپ',note:'پەیامەکە ناو و کۆد و ژمارە و بەستەری وێنەکانی ئامێرەکان دەگرێتەوە. لە واتساپ دوگمەی ناردن دابگرە.',services:'گەیاندن، دامەزراندن و گەرەنتی',delivery:'گەیاندنی بەخۆڕایی لە ناو هەولێر. گەیاندن بۆ دەرەوەی هەولێر بە کرێیەکی کەم بە پێی شوێنەکە بەردەستە.',installation:'دامەزراندنی پیشەیی بەخۆڕایی لەلایەن ستافەکەمانەوە لە هەولێر، هەرێمی کوردستان و سەرجەم عێراق.',warranty:'گەرەنتی پێنج ساڵ بۆ هەموو پارچەکانی ئامێرەکان، تەنها بۆ یەک داواکاری گەرەنتی لە ماوەی ئەو پێنج ساڵەدا.',repairs:'تەکنیکییەکانمان لە ماڵ، هۆڵی وەرزش یان نووسینگەکەت چاککردنەوە ئەنجام دەدەن.',labels:['گەیاندن','دامەزراندنی بەخۆڕایی','گەرەنتی پێنج ساڵ','چاککردنەوە لە شوێنەکەت'],contact:'پەیوەندی بە خزمەتگوزاری و چاککردنەوە',intro:'سڵاو مارشاڵ فیتنس، تکایە نرخی ئەم ئامێرانەم بۆ بنێرن:',code:'کۆد',photo:'وێنە',announce:'زیادکرا بۆ لیستی ئامێرەکانت.'}
  };

  // The old "My Equipment List" is now the basket (shop.js). This file keeps the
  // "Delivery, Installation & Warranty" section and registers the offline/app support.
  var services = document.getElementById('delivery-info');
  function dict(){return copy[M.lang()] || copy.en;}
  function renderServices(){
    if (!services) return;
    var d=dict();services.textContent='';services.appendChild(M.el('h2',null,d.services));var grid=M.el('div','service-grid');
    [d.delivery,d.installation,d.warranty,d.repairs].forEach(function(text,i){var card=M.el('article','service-card');card.appendChild(M.el('h3',null,d.labels[i]));card.appendChild(M.el('p',null,text));grid.appendChild(card);});services.appendChild(grid);
    var contact=M.el('a','btn',d.contact+' · +964 750 425 5017');contact.href='https://wa.me/9647504255017';contact.target='_blank';contact.rel='noopener noreferrer';services.appendChild(contact);
  }
  M.onRender(renderServices);renderServices();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(function(){});
})();
