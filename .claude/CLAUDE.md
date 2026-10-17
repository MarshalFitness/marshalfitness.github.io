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
- For every new version, change `CACHE` in service-worker.js (for example `marshal-fitness-v21`)
  and add new files to `CORE`, so phones get the new files.
- Firestore security rules are NOT in this repository (they contain the admin email).
  The owner keeps firestore-rules.txt and pastes it in Firebase -> Firestore -> Rules.

## How the site works
- Static HTML/CSS/vanilla JS. No build step. Jekyll ignores this `.claude` folder.
- index.html loads live.js. live.js loads Firebase compat 10.12.2, reads Firestore, then loads
  the scripts in APP_SCRIPTS in order and fires "mf-ready".
- Firestore collections: products, content, requests, stats, meta/counter, views.
  Built-in fallback data: content.js (texts in en / ar / ckb, Western digits) and gym-content.js.
- script.js exposes `window.MF` (openModal/closeModal, onRender, onCard, onLightbox,
  productByImage, productKey, waUrl, tr, t, lang, shareProduct ...).
- Admin: admin.html + admin.js (tap the logo 5 times). Firebase email/password login.

## Version 20 parts
- v20.js: "stages" (full-screen layers, z-index 55) with Back-button and Escape handling,
  focus trap, and the views number (views/{productKey}, +1 once per visit, shown at 10+).
- camera.js: "See it in your room" (cut-out photos in assets/cut, list in cutouts.js).
- tour.js: showroom walk, 18 photos in assets/tour, dots/captions editable in admin (content/tour).
- photosearch.js + ai/: photo search, MobileNetV2 int8 in a Web Worker, embeddings in ai/emb.json.
- planner.js + planner3d.js: "Will it fit?" 2D/3D (lib/three.module.min.js r160, MIT).
- show.js: show page for star products. Styles in v19.css and v20.css.

## Testing
- Serve locally: `python3 -m http.server 8934`.
- Earlier versions were tested with Playwright (Chromium is pre-installed in cloud sessions):
  Firebase scripts routed to a fake in-browser database, fake camera
  (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`), phone (390px) and
  desktop widths, languages en / ar / ckb, dark / light / gold themes, multi-touch via CDP.
- Check: no console errors, no horizontal scroll from 300px to 1500px, Back button closes
  layers one by one (product -> panel -> stage), buttons never covered.
