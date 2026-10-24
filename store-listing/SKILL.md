---
name: store-listing
description: Create the Google Play and App Store listing for a web app, PWA or HTML5 game that ships as a mobile app (Capacitor, Cordova, Ionic, TWA/Bubblewrap, WebView, Expo web), straight from its codebase. Runs the app, captures real screens with Playwright on phone and tablet viewports, offers a gallery of 10 visual styles (gradient, minimal, dark, editorial, playful, neo-brutal, big-number, panoramic, game) and renders exact-size PNGs checked against store specs: App Store iPhone and iPad screenshots, Google Play phone/tablet screenshots, the 1024x500 feature graphic, icons, app preview video. Also writes the listing text (name, short and full description, subtitle, keywords) grounded in a feature inventory of the code and checked against store policy. Use whenever the user wants store screenshots, a feature graphic, Play Store or App Store graphics or descriptions, ASO, or is preparing to publish or update a web-based app or game on Google Play or the App Store, even without naming sizes, styles or tools.
---

# Store listing from a codebase

You'll go from a project folder to an upload-ready store listing (images and text):
**detect → inventory → brief → capture → choose a style → design → render → listing copy**.
Every stage leaves files in `<project>/store-assets/`, so any stage can be redone on its own:

```
store-assets/
  inventory.json      what the app really does, with evidence      (inventory.mjs)
  brief.json          name, tagline, colours, style, one entry per screenshot (you write it)
  shots.json          capture plan                                  (you write it)
  captures/           raw screens per device + manifest.json        (capture.mjs)
  design/             screenshots.html, feature.html (+ kit/, assets/, _gallery*.html)
  out/                upload-ready images, _preview/ contact sheets, _gallery/ style sheets
  listing/            <locale>.md listing copy, metadata/ export     (listing.mjs)
  .run/               dev-server pid + log
```

Scripts live in `scripts/` inside this skill's base directory (shown when the skill loads).
Below, `$S` stands for that `scripts` path. Run them with the user's project as the working
directory. Read the references when you reach their stage:
- `references/store-specs.md`: sizes, counts and content rules for both stores
- `references/capture.md`: shot plan, devices, seeding data, games, recordings, crop helper
- `references/styles.md`: the visual styles, what each suits, the gallery, the research behind them
- `references/design.md`: the design kit (layouts, frames, decorations, callouts, checks)
- `references/listing.md`: grounded listing copy, field rules, keywords, export

If the user only wants part of this (just the text, just a feature graphic, a restyle), do only
those stages.

## 0. Preflight (first use, or whenever something fails oddly)
`node $S/doctor.mjs`. If Playwright or Chromium is missing, run `npm install` in the skill
directory. ffmpeg is only needed for recordings and app preview videos.

## 1. Understand the product
```bash
node $S/detect_project.mjs . --pretty
node $S/inventory.mjs . --pretty --out store-assets/inventory.json
```
`detect` gives the framework, dev command, brand colours and fonts, routes (hash routes too),
and `mobile.native`: wrapper, app id and name, `iosSupportsIpad` (from the Xcode project),
orientations and icons. `inventory` lists capabilities with file:line evidence, monetization
(ads, in-app purchases, subscriptions), permissions, locales, the app's own UI vocabulary and
game traits. Read the README and the main screens; confirm what the inventory suggests.
Everything later (headlines, descriptions) may only claim what you confirmed here.

**Decide the slots:**

| Slot | Size | When |
|---|---|---|
| App Store iPhone 6.9" + 6.3" | 1320×2868 + 1206×2622 | always for iOS (6.3" class is required) |
| App Store iPad 13" | 2064×2752 | required if the iOS app runs on iPad (Capacitor's default does; see `iosSupportsIpad`) |
| Google Play phone | 1080×1920 | always for Android; 2–8 images, 4+ recommended |
| Google Play tablet | 1440×2560 | if it supports tablets (same set in the 7" and 10" slots) |
| Google Play feature graphic | 1024×500 | always, Play requires it |
| Listing text | | both stores, per locale |

## 2. Write the brief
```bash
node $S/scaffold.mjs . --init        # store-assets/brief.json from detection (+ captures, if any)
```
Edit `brief.json`: name, tagline, brand colours and font, and **one slide per screenshot**
(4–8): which capture it shows, the headline (benefit first, 2–5 words) plus an optional accent
line, and optional chips, sticker, eyebrow or stat. Order them as a story: promise and best
screen first, then the core loop, then differentiators (`references/design.md` → Story). Pick
captures you will take in step 4; the names must match.

**Agree on it with the user** before the heavy work, in one message with concrete defaults:
slots, the slide list with headlines, the style direction (step 5), languages. If they say
"just do it", proceed with your defaults.

## 3. Run the app
```bash
node $S/run_app.mjs start .            # prints {"url": ...}; log in store-assets/.run/app.log
```
Install dependencies first if detect says `needsInstall`. Override with
`--cmd "pnpm dev --port 4000" --port 4000` when detection is wrong. If something else already
answers on the port it's reused, so check the first probe shows the right app. Never invent
credentials: use a seed or demo account from the project, or ask.

## 4. Capture the screens
1. Probe each screen on the device you'll capture with:
   `node $S/capture.mjs --probe /route --device phone [--select ".card,.chart"]`. Look at
   `captures/probe.png`. The output lists elements, selectors and a ready-made `crop` for each
   (for callouts later).
2. Write `store-assets/shots.json` (`references/capture.md`): `"devices": ["phone"]`, plus
   `"tablet"` for iPad / Play tablet, plus `"phone-android"` when the UI differs on Android or
   for full-bleed games (9:16). Seed realistic content, hide web-only banners, and use
   `"fresh": true` for shots that must not inherit earlier state.
3. `node $S/capture.mjs --plan store-assets/shots.json`
4. **Look at every PNG** in `captures/<device>/`. No empty, loading or error states, no test
   data, no personal data. Retake with `--only name1,name2`.

**Already have screenshots** (a native app, or captures the user made)? Skip 3–4: put them in
`store-assets/captures/phone/<name>.png` (and `tablet/`). Without a `manifest.json`, the kit and
the brief find them by folder and show them full-screen in the frame, with no extra status bar.

## 5. Choose a visual style
```bash
node $S/gallery.mjs .                  # → store-assets/out/_gallery/styles-*.png + features.png
```
This renders every style (8 for apps, 6 for games) with the brief's first 3 slides and the
real captures, plus the 4 feature-graphic styles. **Show the sheets to the user** (send the
images, or describe them if they can't see images), recommend one with a reason from
`references/styles.md` → Choosing, and let them pick. Narrow it with
`--styles a,b,c` and see iPhone frames with `--target appstore-iphone-6.9`. Skip the gallery
only if the user already named a style.

## 6. Design
```bash
node $S/scaffold.mjs . --style <id> --feature-style <id> [--force]
```
This writes `design/screenshots.html` and `design/feature.html` in that style from the brief.
Then **polish them** (`references/design.md`): place chips and callouts on the feature the
headline promises (use the probe's `crop` values), add `data-zoom` where a screen has empty
space, and check every slide reads at thumbnail size. Rules that matter most:
- One idea per image; every image shows real app UI (Apple 2.3.3).
- No "#1", "best", "free", prices, "download now", awards or store badges.
- On Play, caption text under 20% of the image; no device bezels in the feature graphic.

Live preview while editing: run `node $S/render.mjs serve` in the background and open the
board URL.

## 7. Render and check
```bash
node $S/render.mjs                     # all design files → store-assets/out/
node $S/render.mjs --only hero,plan    # some slides;  --targets play-phone  some targets
```
1. Fix every **layout warning**: text cut off, decorations overlapping the headline, tiny text,
   the 20% rule. Scope per-shape fixes with `html[data-form="tablet"]`, `[data-store]` or
   `[data-orientation]` CSS, or a slide's `data-targets` / `data-skip`.
2. **Look at the contact sheets** in `out/_preview/`: each image makes one point at a glance,
   nothing important is cropped, frames and status bars look right, and the set reads as a
   sequence.
3. Iterate until every slot shows `ok`.

## 8. Write the listing copy
```bash
node $S/listing.mjs init . [--locale en-US] [--stores play,appstore]
node $S/listing.mjs check
node $S/listing.mjs export             # → store-assets/listing/metadata/ (fastlane layout) + JSON
```
Fill `store-assets/listing/<locale>.md` by the method in `references/listing.md`. Write the
**Evidence** list first: each feature you'll mention and where it lives in the code. Then write
the Play name (30), short description (80) and full description (4,000), and the App Store
name, subtitle (30), promotional text (170), description and keywords (100 bytes). Describe only
what this build does, by the app's own names for things. Disclose in-app purchases or
subscriptions if the inventory found them. Fix every ✗ the checker reports. Show the user the
copy with its evidence, and ask about anything you couldn't verify (pricing, support contact)
instead of guessing.

## 9. Optional extras
- **Icons:** `node $S/render.mjs icon path/to/icon.svg [--bg "#fff"] [--inset 0.1]` exports
  `app-store/icon-1024.png` (no alpha) and `google-play/icon-512.png`.
- **App Store app preview** (15–30 s): record a `"type": "video"` shot
  (`"deviceScaleFactor": 2`), then
  `bash $S/ff.sh preview store-assets/captures/phone/<clip>.mp4 store-assets/out/app-store/app-preview.mp4 iphone`.
  For a polished trailer, use the `promo-video` skill if it's installed.
- **Localized sets:** copy the design to `screenshots.<locale>.html` and translate it, with
  `<meta name="store-locale" content="de-DE">`, which renders into `out/de-DE/…`. Capture
  localized UI with `"locale": "de-DE"` into `captures-de/` and point the design at it with
  `<meta name="captures" content="../captures-de/">`. Write `listing/<locale>.md` natively.

## 10. Wrap up
- Stop the dev server: `node $S/run_app.mjs stop .`
- Suggest ignoring `store-assets/.run/`, `out/_preview/` and `out/_gallery/` in git. The brief,
  shot plan, captures, designs and listing are worth committing for the next update. Ask
  before editing `.gitignore`.
- Report per slot: folder, count and size, plus the listing fields with character counts and
  where to paste them (App Store Connect, Play Console, or fastlane). Say what's placeholder or
  unverified, what you skipped and why, and offer next steps: another locale, another style, a
  tablet or landscape set, icons, an app preview video.
