/* Marshal Fitness — service worker (version 22).
   - The page (index.html): from the internet first; if the internet is slow or down,
     the saved copy is used after a short wait.
   - Our own files (scripts, styles, photos): the saved copy is shown at once and
     updated in the background, so the site opens fast on slow internet.
   - Fonts and the Firebase program files: saved once (their address never changes).
   Change CACHE for every new version, and keep the ?v= number the same as in index.html. */
const V = "22";
const CACHE = "marshal-fitness-v" + V;
const EXT = "marshal-fitness-ext";
const PAGE_WAIT = 3500;
const APP = ["script.js", "features.js", "quotation.js", "request-form.js", "extras.js",
  "shop.js", "finder.js", "app.js", "helper.js", "planner.js",
  "cutouts.js", "v20.js", "tour.js", "camera.js", "show.js", "planner3d.js", "photosearch.js",
  "v21.js", "holiday-dates.js", "holidays.js", "exfigure.js", "exercises.js", "pdfmaker.js", "catalog.js",
  "v22.js", "gym3d.js", "rooms-data.js", "rooms.js", "gymplan.js", "savings.js", "tradein.js", "designer.js", "invoicepdf.js", "account.js",
  "content.js", "content22.js", "texts22.js", "gym-content.js", "thumbs.js", "firebase-config.js", "live.js",
  "styles.css", "features.css", "v19.css", "v20.css", "v21.css", "v22.css"];
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/favicon.png", "/assets/logo.png", "/assets/icon-512.png"]
  .concat(APP.map((f) => "/" + f + "?v=" + V));

self.addEventListener("install", (event) => {
  // add files one by one, so one missing file never stops the app from installing
  event.waitUntil(caches.open(CACHE).then((cache) =>
    Promise.all(CORE.map((url) => cache.add(url).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== EXT).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

function saveCopy(cacheName, request, response) {
  if (response && (response.ok || response.type === "opaque")) {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => null);
  }
  return response;
}

// the page itself: internet first, saved copy if the internet is too slow or down
function pageFirst(request) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(request, { ignoreSearch: true })
      .then((hit) => hit || caches.match("/index.html") || caches.match("/"));
    const timer = setTimeout(() => {
      fallback().then((hit) => { if (hit && !done) { done = true; resolve(hit); } });
    }, PAGE_WAIT);
    fetch(request).then((response) => {
      saveCopy(CACHE, request, response);
      if (!done) { done = true; clearTimeout(timer); resolve(response); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then((hit) => { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  });
}

// our files: saved copy at once, fresh copy for next time
function savedFirst(request) {
  return caches.match(request).then((hit) => {
    const fresh = fetch(request).then((response) => saveCopy(CACHE, request, response)).catch(() => null);
    return hit || fresh.then((response) => response || caches.match(request, { ignoreSearch: true })
      .then((old) => old || Response.error()));
  });
}

// fonts and Firebase program files never change at the same address
function keepForever(request) {
  return caches.match(request).then((hit) => hit || fetch(request).then((response) => saveCopy(EXT, request, response)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
      event.respondWith(pageFirst(request));
    } else if (url.pathname.endsWith("service-worker.js")) {
      return;
    } else {
      event.respondWith(savedFirst(request));
    }
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" ||
      (url.hostname === "www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0)) {
    event.respondWith(keepForever(request));
  }
  // everything else (database, WhatsApp, maps) goes to the internet as normal
});
