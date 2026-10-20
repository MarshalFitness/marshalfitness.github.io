# Marshal Fitness website: notes for Claude

Owner: Marshal Fitness, gym equipment shop on 60 Meter Road, Erbil, Iraq.
Live site: https://marshalfitness.github.io (GitHub Pages, published from the `main` branch, root folder).
This repository is PUBLIC. Everything in it can be seen by anyone.

## Working with the owner
- Use very basic, short English. Give steps one at a time.
- Never start new work until the owner says "start". Bundle changes into one version.
- Before reacting to a problem, check the live site first.
- Test everything twice before publishing. Look at screenshots (phone and desktop).
- Never write passwords, the admin email or other private data into this repository.
- Do not remove or change existing products, features, texts, photos, Firebase settings
  or admin functions unless the owner approves.
- Be calm and accountable if the owner is upset. No long apologies.

## Publishing
- Push to `main`. GitHub Pages publishes in about 1 minute.
  If a session cannot push to `main`, open a pull request into `main` and ask the owner to press "Merge".
- For every new version, change `CACHE` in service-worker.js (for example `marshal-fitness-v22`)
  and add new files to `CORE`, so phones get the new files.
- Firestore security rules are NOT in this repository (they contain the admin email).
  The owner keeps firestore-rules.txt and pastes it in Firebase -> Firestore -> Rules.

## How the site works
- Static HTML/CSS/vanilla JS. No build step. Jekyll ignores this `.claude` folder.
- index.html loads live.js. live.js loads Firebase compat 10.12.2, reads Firestore, then loads
  the scripts listed in index.html (window.MF_APP) in order and fires "mf-ready".
- Firestore collections: products, content, requests, stats, meta/counter, views, invoices (admin;
  a customer can read own invoices by verified email), users (customer accounts, version 22).
  Built-in fallback data: content.js (texts in en / ar / ckb, Western digits) and gym-content.js.
- script.js exposes `window.MF` (openModal/closeModal, onRender, onCard, onLightbox,
  productByImage, productKey, waUrl, tr, t, lang, shareProduct ...).
- Admin: admin.html + admin.js + admin21.js + admin22.js (tap the logo 5 times). Firebase email/password login (or Google, version 22).
- Version number: index.html (MF_V and every ?v= link), admin.html (?v= links) and service-worker.js (V)
  must all change together for a new version.

## Version 20 parts
- v20.js: "stages" (full-screen layers, z-index 55) with Back-button and Escape handling,
  focus trap, and the views number (views/{productKey}, +1 once per visit, shown at 10+).
- camera.js: "See it in your room" (cut-out photos in assets/cut, list in cutouts.js).
- tour.js: showroom walk, 18 photos in assets/tour, dots/captions editable in admin (content/tour).
- photosearch.js + ai/: photo search, MobileNetV2 int8 in a Web Worker, embeddings in ai/emb.json.
- planner.js + planner3d.js: "Will it fit?" 2D/3D (lib/three.module.min.js r160, MIT).
- show.js: show page for star products. Styles in v19.css and v20.css.

## Version 21 parts
- Faster site: live.js loads all scripts at once (list in index.html MF_APP), keeps the last
  database answer in IndexedDB (used when the internet is slow), thumbs.js (small card photos in
  assets/thumbs), responsive hero photo, service worker: saved copy first for our files.
- 9 color modes (dark, light, gold, cyber, lime, ice, army, royal, coffee): styles.css + v21.css, THEMES in script.js.
- Holiday looks: holiday-dates.js (dates) + holidays.js; admin tab "Holidays" (content/holidays). Test: ?holiday=ramadan
- Exercises: exfigure.js (moving stick figures, all drawings) + exercises.js (texts in 3 languages,
  machine type from the product name or the admin "Exercises" choice = product field "ex", muscle map).
- Catalog PDF: pdfmaker.js (canvas pages -> JPEG -> PDF with links) + catalog.js.
- Admin: Post maker and Invoices (US dollars, collection "invoices") in admin21.js.
- Logo screen (once per visit) and new footer: v21.js + index.html.

## Version 22 parts
- Load order: content.js -> content22.js (only the few texts the page shows at
  once + a catcher for taps before the tools are ready) -> Firebase -> live.js. live.js loads MF_APP, fires "mf-ready"
  (window.MF_IS_READY), then loads window.MF_LATE (texts22.js first, then the tools) and fires
  "mf-late" (window.MF_LATE_READY). This keeps the first visit as fast as version 21.
  The tool cards and grey room cards are already in index.html, so the page does not jump.
- v22.js: helpers (makeWindow, readImage, field, chips, money, icons), tool cards, [data-v22] buttons.
- gym3d.js (gymLayout + drawGymPlan + 3D gym walk with the owner's logo) and gymplan.js (Open a gym:
  size + type -> equipment list, floor plan, PDF offer, WhatsApp; saved in localStorage "mf-gymplan").
- rooms-data.js (7 built-in rooms) + rooms.js. Admin tab "Rooms & tools" saves content/rooms {list}
  and the calculator numbers content/money {rate, member}.
- designer.js (machine colors + logo on the product cut-out), tradein.js (photos -> offer),
  savings.js (home gym vs membership).
- account.js: "My Marshal" customer account. Google sign-in + email link (no password, no SMS).
  Collection users/{uid} (name, phone, saved, email, lang, lastLogin). Requests keep uid/email.
  Invoices show when invoices.email = the verified login email. Admin tab "Customers".
  Firebase setup: Authentication -> Google + Email link on; marshalfitness.github.io in Authorized domains.
  Customer login and admin login are SEPARATE: account.js uses its own Firebase app "mf-customer"
  (own login, own database connection; the price form saves with it via window.MF_USER_DB).
  The admin account is refused as a customer (it is the only login that may list all "requests").
  admin.js opens the tools only for that admin login; account.js never deletes it.
  Admin can also log in with Google on admin.html.
- invoicepdf.js: invoice PDF (used by admin and My Marshal), with "Warranty until".
- Requests from the tools: kind gymplan / room / tradein / design / savings; photos are small JPEG
  data URLs inside the request. admin22.js shows them (MF_ADMIN_REQ_EXTRA).

## Testing
- Serve locally: `python3 -m http.server 8934`.
- Earlier versions were tested with Playwright (Chromium is pre-installed in cloud sessions):
  Firebase scripts routed to a fake in-browser database, fake camera
  (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`), phone (390px) and
  desktop widths, languages en / ar / ckb, dark / light / gold themes, multi-touch via CDP.
- Check: no console errors, no horizontal scroll from 300px to 1500px, Back button closes
  layers one by one (product -> panel -> stage), buttons never covered.
- Since version 21 the service worker also serves the Firebase program files. When tests replace
  Firebase with a fake, set `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` (so the fake also
  reaches the service worker) or use `service_workers="block"`.
- Version 22 tests also fake Google sign-in and the email link (where(), signInWithPopup,
  sendSignInLinkToEmail, user.delete). Tools load after "mf-ready": wait for window.MF_LATE_READY.
- Speed test: slow 3G + 4x slower CPU, compare the first visit with the version before.
- admin21.js can load after the login is restored: admin.js sets `window.MF_ADMIN_STARTED`, and
  admin21.js runs its start code at once when it is set.
