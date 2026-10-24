# Store image specs

Checked against Apple's "Screenshot specifications" / "App preview specifications" and Google's
"Add preview assets to showcase your app" help pages (October 2026). Stores change these: if a
user reports a rejected size, re-check the official pages and update `TARGETS` in
`kit/kit.js`. That one registry drives the kit, `render.mjs` and its checks.

## Contents
- Render targets (what this skill produces)
- Apple App Store
- Google Play
- Content rules both stores enforce
- Where the files go

## Render targets

| Target id | Size (px) | Output folder | Store slot |
|---|---|---|---|
| `appstore-iphone-6.9` | 1320×2868 | `app-store/iphone-6.9/` | iPhone, Dynamic Island (large display) |
| `appstore-iphone-6.5` | 1284×2778 | `app-store/iphone-6.5/` | iPhone, Face ID (large display); only if asked for |
| `appstore-iphone-6.3` | 1206×2622 | `app-store/iphone-6.3/` | iPhone, Dynamic Island (medium display), **required** |
| `appstore-ipad-13` | 2064×2752 | `app-store/ipad-13/` | iPad 13", **required if the app runs on iPad** |
| `play-phone` | 1080×1920 | `google-play/phone/` | Phone screenshots |
| `play-tablet` | 1440×2560 | `google-play/tablet/` | 7-inch and 10-inch tablet screenshots (same set in both) |
| `play-chromebook` | 1920×1080 | `google-play/chromebook/` | Chromebook screenshots |
| `play-feature` | 1024×500 | `google-play/feature-graphic.png` | Feature graphic, **required** |
| `…-landscape` | swapped | `…-landscape/` | landscape variant of every portrait target |

Icons (`render.mjs icon`): `app-store/icon-1024.png`, `google-play/icon-512.png`.

## Apple App Store

**Screenshots**
- 1–10 per display size, `.png` / `.jpg` / `.jpeg`, **no alpha or transparency**.
- Required: at least one screenshot for **iPhone with Dynamic Island (medium display)**,
  1206×2622 or 1179×2556, and, if the app supports iPadOS, at least one for **iPad 13"**,
  2064×2752 or 2048×2732.
- Dynamic Island (large display) is 1320×2868, 1290×2796 or 1260×2736. Face ID (large display),
  1284×2778 or 1242×2688, is required when no Dynamic Island (large) set is given. Smaller
  classes are scaled down from these automatically.
- Upload 6.9" and 6.3" and every iPhone requirement is met, whichever way App Store Connect
  reads it. Their aspect ratios are nearly identical, so one design renders well to both.
- Portrait or landscape (sizes swapped) are both accepted. Keep one orientation per set.
- iPhone Duo (1398×2034 outer, 2007×2853 inner) becomes required in April 2027 for apps built
  with the iOS 27.1 SDK. It isn't a default target yet; add it to `TARGETS` when needed.

**App previews** (optional videos)
- Up to 3 per display size and language, **15–30 s**, max 500 MB, `.mov` / `.m4v` / `.mp4`.
- H.264 (High Profile up to Level 4.0, 10–12 Mbps target) or ProRes 422 HQ, **max 30 fps**,
  progressive.
- Audio: stereo, 256 kbps AAC, 44.1 or 48 kHz. `ff.sh preview` adds a silent track if there's
  no audio.
- Sizes: iPhone 886×1920 (landscape 1920×886) for every modern iPhone class; iPad 1200×1600
  (landscape 1600×1200).

**App icon**: 1024×1024 PNG, no alpha, square corners (iOS applies the mask).

## Google Play

**Feature graphic (required):** 1024×500, JPEG or 24-bit PNG, **no alpha**.
- Keep the logo, name, slogan and focal UI near the centre and away from the edges, which can
  be cropped. Keep background detail toward the edges.
- Use vibrant colours. Avoid pure white, black or dark grey backgrounds and fine detail.
- Avoid **device imagery**, store badges, ranking or price claims ("Best", "#1", "Top", "New",
  "Free", "Sale", "Million downloads"), time-sensitive content and third-party trademarks.
- Localize the text. The Play Console asks for alt text of 140 characters or less.

**Phone screenshots:** 2–8 (minimum 2 across device types to publish). JPEG or 24-bit PNG, no
alpha. Sides 320–3840 px, and the long side at most twice the short side. Max 8 MB each.
- Recommended, and needed to be featured: **4+ apps / 3+ games at 1080 px or more**, 9:16
  portrait (1080×1920) or 16:9 landscape (1920×1080). Game screenshots should show the in-game
  experience.

**Tablets (7" and 10") and Chromebooks:** 4–8 each, 16:9 or 9:16, sides 1080–7680 px.
Text that isn't part of the core app experience may be cut off on some screens, so keep
captions short and well inside the edges.

**Icon:** 512×512, 32-bit PNG (alpha allowed), max 1024 KB. No badges or text suggesting
ranking or price. Play applies its own rounded mask.

**Promo video:** a YouTube URL, not an upload.

**Other form factors** (only on request): Android XR 3840×2400 (8:5); Wear OS 1:1, min 384,
UI only with no frames or extra text; TV banner 1280×720.

## Content rules both stores enforce

- **Show the real app.** Apple guideline 2.3.3 says screenshots must show the app in use, not
  just title art, a login page or a splash screen. Google wants "the actual in-app or in-game
  experience". Overlays and captions are fine as long as the UI is there.
- **No misleading claims.** No rankings, awards, testimonials, prices or promotions ("#1",
  "Best", "Free", "50% off"), and no "Download now" calls to action (Google). Don't show
  features the app doesn't have.
- **No other platforms' devices or badges.** No Android phones in App Store images, and no
  store badges or icons on Google Play. That's why the kit uses iPhone/iPad frames for App
  Store targets and frameless cards (or Android frames) for Play.
- **No fingers or hands on the device** (Google). The capture script hides its touch pointer in
  stills.
- **Clean status bar:** the kit draws 9:41 with full signal, Wi-Fi and battery, and no
  notifications.
- **Readable:** Google says taglines should cover no more than 20% of the image. Use big text,
  few words, and no fine print. Put the strongest UI in the first three images.
- **Sharp:** no blurry, stretched or skewed captures. Capture at 3× (phone) / 2× (tablet) so
  frames are never upscaled. The phone preset is exactly 1320×2868.
- **Localize** captions per store listing language.
- **No real personal data** in any screenshot: use seeded demo content.

## Where the files go
- **App Store Connect** → the app version → *Previews and Screenshots*: drag
  `app-store/iphone-6.9/*` into the large iPhone display size, `app-store/iphone-6.3/*` into the
  medium Dynamic Island size, and `app-store/ipad-13/*` into iPad 13". The file order is the
  display order. App previews go into the same wells.
- **Play Console** → *Grow users → Store presence → Main store listing* → *Graphics*: app icon,
  feature graphic, phone screenshots (`google-play/phone/*`), 7-inch and 10-inch tablet
  screenshots (both from `google-play/tablet/*`) and Chromebook. Custom store listings and
  translations take their own sets (`out/<locale>/...`).
