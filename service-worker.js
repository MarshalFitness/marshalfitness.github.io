const CACHE = "marshal-fitness-v20";
const CORE = [
  "/",
  "/index.html",
  "/styles.css",
  "/features.css",
  "/content.js",
  "/gym-content.js",
  "/script.js",
  "/features.js",
  "/quotation.js",
  "/live.js",
  "/request-form.js",
  "/firebase-config.js",
  "/extras.js",
  "/shop.js",
  "/finder.js",
  "/app.js",
  "/helper.js",
  "/planner.js",
  "/v19.css",
  "/v20.css",
  "/cutouts.js",
  "/v20.js",
  "/tour.js",
  "/camera.js",
  "/show.js",
  "/planner3d.js",
  "/photosearch.js",
  "/manifest.webmanifest",
  "/favicon.png",
  "/assets/logo.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  // add files one by one, so one missing file never stops the app from installing
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
