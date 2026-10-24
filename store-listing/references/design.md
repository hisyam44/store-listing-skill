# Designing the store images (`store-assets/design/*.html`)

Each design file is plain HTML: a list of `<section class="slide">`, styled with the kit
(`kit/kit.css` + `kit/kit.js`), the visual styles (`kit/styles.css`, see styles.md) and your
own `<style>`. `render.mjs` opens each slide at each target's exact pixel size and screenshots
it. `scaffold.mjs --style <id>` writes the files from the brief in one style; you polish them
by hand.

## Contents
- Story and copy
- File anatomy
- Units and tokens
- Layouts
- Devices
- Decorations
- Callouts (zoomed UI)
- Per-store / per-device content
- Feature graphic
- Patterns from strong listings
- Checks, preview and gotchas

## Story and copy

The set is read left to right, mostly as small thumbnails in search results and on the
listing page. Treat it as a short story:

1. **Hero:** the promise in a few words plus the best-looking screen. App name or wordmark
   optional (the store already shows it), brand colour background.
2. **2–5: one benefit each**, ordered by how much users care. Usually the core loop first
   (save, plan, track, play), then the differentiators, then the convenience features.
3. **Last:** breadth or trust, e.g. "Works offline", "Sync across devices", "Dark mode".

Copy rules:
- **Benefit, not feature:** "Plan your week in minutes", not "Calendar view". 2–5 words per
  headline, with an optional short subline. Put the key words on the second line in the
  accent colour (`<span class="accent">`).
- **Readable at thumbnail size:** the default `--h1` is 9.6% of the short side; don't go
  below about 7rem. No paragraphs and no fine print.
- **Truthful:** only show features that exist. No "#1", "best", "free", prices, discounts,
  awards, ratings or "download now". Google Play rejects them, Apple frowns on them.
- **Consistent:** same headline position, type and colour logic across the set, so it reads
  as one piece. Vary the composition (device bleeding off, callouts, a duo) rather than the
  style.
- **Localize** copy per listing language (see SKILL.md → Localized sets). German and French
  run about 30% longer, so keep `data-fit` on headlines.

## File anatomy
```html
<!doctype html>
<html lang="en" data-play-frame="card" data-appstore-frame="device">
<head>
  <meta charset="utf-8">
  <meta name="store-targets" content="appstore-iphone-6.9 appstore-iphone-6.3 play-phone">
  <!-- optional: <meta name="store-locale" content="de-DE">  <meta name="captures" content="../captures-de/"> -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=block">
  <link rel="stylesheet" href="kit/kit.css">
  <link rel="stylesheet" href="kit/styles.css">
  <style>
    :root { --accent: #ff5a36; --accent-2: #ffc55c; --font-display: "Plus Jakarta Sans", system-ui, sans-serif; }
    .hero { --bg: linear-gradient(165deg, var(--accent), var(--accent-2)); --ink: #fff; --muted: rgba(255,255,255,.9); }
  </style>
</head>
<body>
  <section class="slide s-bold-gradient hero" data-name="hero" data-appstore-frame="device" data-play-frame="card">
    <div class="caption"><h1 data-fit="2">Plateful</h1><p>Recipes, plans and groceries. One app.</p></div>
    <div class="stage"><div class="device bleed" data-shot="today"></div></div>
  </section>
  <!-- more slides -->
  <script src="kit/kit.js"></script>
</body>
</html>
```
- `data-name` becomes the file name (`01-hero.png`). Slides are numbered in document order.
- `s-<style>` applies a visual style (styles.md). Without one, the slide uses the plain kit
  look. `data-appstore-frame` / `data-play-frame` on a slide (or on `<html>`) choose the frames.
- Use `display=block` on Google Fonts links so text never renders in a fallback font. Put
  project images (logo, icon, art, product photos) in `design/assets/` and reference them
  relatively.
- Files starting with `_` are skipped (use them for experiments; `--files _try.html` renders one).

## Units and tokens

**1rem = 1% of the image's short side**, in every target. A 9.6rem headline is 9.6% of the
width on a portrait phone image and 9.6% of the height on a landscape one. Inside `.stage`,
`cqw`/`cqh` are percentages of the stage, and inside `.device` children, `%` refers to the
device box.

| token | default | use |
|---|---|---|
| `--bg` | `#fff` | slide background; any CSS background (gradients welcome) |
| `--ink` / `--muted` | dark / 64% ink | headline / subline colour. **Override both together**: `--muted` is computed where it's declared, so it won't follow a changed `--ink`. |
| `--accent`, `--accent-2` | brand | accent words, solid chips, gradients |
| `--soft` | 12% accent tint | calm background for benefit slides |
| `--on-accent` | `#fff` | text on accent fills |
| `--chip-bg`, `--chip-ink` | white / dark | chips, bubbles, panels (fixed, so slides with light ink still get readable chips) |
| `--font-display`, `--font-body` | system UI | headline / body font stacks |
| `--h1`, `--sub` | 9.6rem / 4.6rem | headline / subline size |
| `--pad` | 7 | outer padding, in rem |
| `--dw`, `--dh` | 80 / 100 | device width as % of the stage width; height cap as % of the stage height |
| `--shadow`, `--device-shadow` | soft | decoration / device shadows |
| `--scrim`, `--on-scrim` | dark 55% / white | caption backdrop on full-bleed slides |

## Layouts

Add a class to `.slide`:

| class | composition | good for |
|---|---|---|
| *(default)* | caption on top, device below in `.stage` | most app screenshots |
| `layout-bottom` | device on top, caption at the bottom | rhythm in a set, screens whose best part is at the top |
| `layout-full` | `<img class="bg-shot" data-shot="…">` fills the slide, caption on a scrim at the top (`caption-bottom` puts it at the bottom) | games, camera, maps, media, immersive UI |
| `layout-split` | caption left, device right | landscape images. Applied automatically on landscape targets. |
| `layout-free` | block layout, you position everything | anything bespoke |
| `feature` | brand block left, `.visual` right | the Play feature graphic (see below) |

`.stage` centres its devices. Variants:
- `.device.bleed`: sized to run off the bottom edge (top edge in `layout-bottom`) on every
  aspect ratio: at least `--dw` wide and about 15% taller than the stage (`--bleed: 115`),
  capped at `--bleed-max: 94` % of the width. The most common store look; shows more UI at a
  larger size.
- `.stage.duo` with two `.device`s: overlapping pair, the second lower. Add `tilt-left` /
  `tilt-right` for energy.
- Any `.device` can take `style="--dw: 70"` or a `transform` (`rotate(-6deg)`, perspective).

## Devices

```html
<div class="device bleed" data-shot="today" data-frame="auto"></div>
```
| attribute | values |
|---|---|
| `data-shot` | a capture name (resolved per target, see capture.md → Devices) or a path (`assets/photo.png`) |
| `data-frame` | `auto` (default), `device`, `iphone`, `android`, `ipad`, `android-tablet`, `card`, `none`, `browser` |
| `data-device` | force which capture device to use, e.g. `tablet`, `desktop` |
| `data-statusbar` | `off`, `light` (white icons), `dark`. Default: picked from the capture's top edge |
| `data-statusbar-bg` | strip colour override (default: sampled from the capture) |
| `data-home="off"` | hide the iPhone home indicator |
| `data-focus` | object-position for the capture, e.g. `50% 30%` |
| `data-zoom` | enlarge the UI inside the screen, e.g. `1.25` (crops the edges; anchored at `data-focus`, default top centre). Use it for screens with empty space below the content |
| `data-color` | device body colour, e.g. `#e3e4e6` for silver |

`auto` frames come from the `<html>` attributes:
- `data-appstore-frame`: `device` (default; iPhone or iPad frame) | `card` | `none`
- `data-play-frame`: `card` (default, Google's no-device-imagery advice) | `device` (Android
  phone or tablet frame) | `none`

Children of `.device` (chips, bubbles, callouts) are positioned against the device box, so
`style="left:-6%; top:30%"` hangs a chip off the device's left edge at 30% of its height,
whatever the target size. Keep them in the device's **upper ~60%** and within about 6% of
its sides. A bleeding device shows less of its bottom on 9:16 than on 9:19.5, and a wide
device leaves little room at the slide edge. To pin a chip to a piece of UI, put it inside a
`.callout` (positioned against the callout box).

## Decorations

| element | looks like | notes |
|---|---|---|
| `<span class="chip">🥗 Vegan</span>` | white pill with shadow | `chip solid` = accent fill. Absolutely positioned: give `left/right/top`. |
| `<span class="badge">20g protein</span>` | small accent pill | data points, tags |
| `<span class="sticker">Import, plan, cook</span>` | starburst | `--sticker-bg`, `--sticker-ink`; rotated −9°. Max 4–5 short words. |
| `<span class="bubble">❤️</span>` | round white button | emoji or an inline SVG icon |
| `<div class="panel">…</div>` | white card | a mini list or stat beside the device |
| `<div class="callout" …>` | zoomed piece of the UI | see below |
| `<div class="blob">` / `<div class="dots">` | blurred colour glow / dot grid | background texture; position with `left/top` |
| `<img class="app-icon" src="assets/icon.png">` / `<img class="logo">` | icon with iOS-style corners / wordmark | hero and feature graphic |
| `<span class="accent">` / `<span class="mark">` | accent text / highlighter underline | inside headlines |
| `<div class="stat"><b>1,160</b><span>kcal planned today</span></div>` | a huge figure as the headline | inside `.caption`; only numbers the UI shows |

Use at most two or three decorations per slide, and only where they point at the feature the
headline promises. Decorations are for emphasis, not clutter.

## Callouts (zoomed UI)

```html
<div class="device bleed" data-shot="recipe">
  <div class="callout" data-shot="recipe" data-crop="0 0.47 1 0.22" data-crop-tablet="0.53 0.26 0.45 0.15"
       style="left:-9%; width:118%; top:50%"></div>
</div>
```
`data-crop="x y w h"` is a rectangle in fractions of the capture image. The callout keeps that
aspect ratio, so set only its width. Get the numbers from the probe instead of measuring:
`capture.mjs --probe /route --device phone --select ".week,.nutrition"` prints a `crop` for
every matched element (and every interactive one). The values match the capture when the shot
shows the same state without scrolling. For a scrolled or acted-on state, measure on the
capture PNG (y = top of the region ÷ image height, and so on). Phone and tablet layouts differ, so give
`data-crop-tablet` (and `data-crop-desktop`) when the design also renders to iPad or Play tablet,
and position per form factor in CSS: `html[data-form="tablet"] .callout.x { … }`.

## Per-store / per-device content

- Slide filters: `data-targets="appstore-* play-phone"` (only these, `*` wildcards) or
  `data-skip="*ipad* play-tablet*"`.
- Classes: `.only-appstore`, `.only-play`, `.only-phone`, `.only-tablet`, `.only-portrait`,
  `.only-landscape`.
- CSS hooks on `<html>`: `data-target`, `data-store` (`app-store` / `google-play`),
  `data-platform` (`ios` / `android` / `chromeos`), `data-form` (`phone` / `tablet` / `desktop` /
  `feature`), `data-orientation`. For example
  `html[data-form="tablet"] .caption h1 { font-size: 7rem }`, or
  `html[data-store="google-play"] .sticker { display: none }`.
- Platform words: say "iPhone" only on App Store images and "Android" only on Play images.

## Feature graphic

`feature.html` holds one slide with `class="slide feature"` and
`<meta name="store-targets" content="play-feature">` (1024×500, so 1rem = 5 px). Google's
guidance: centred focal point, logo or name plus a short slogan, vibrant background (not pure
white or black), no device bezels, no badges or claims, and nothing important at the edges.

Patterns:
- **Brand + screens** (Honeydew style): `.brand` (app icon, name, tagline) left, `.visual.fan`
  right with three `data-frame="card"` devices fanned out. This is the scaffold's default.
- **Art + title** (Alto's Adventure style, best for games): `<img class="bg-shot" data-shot="feature-art" data-device="desktop">`
  full-bleed (capture a landscape still, see capture.md → Games), a soft radial shade, and the
  title big and centred (`class="slide feature centered"`), or right-aligned with
  `.feature { flex-direction: row-reverse }` when the hero character is on the left.
- **Bold type** (no imagery): brand gradient, oversized wordmark, a few product glyphs or
  stickers as texture.

## Patterns from strong listings

- **Brand-gradient hero with a sticker** (Recipe Keeper): warm gradient, white two-line
  headline, phone bleeding off the bottom, a starburst sticker summing up the loop ("Import,
  plan, shop, cook"), one or two badges with data points hanging off the device.
- **Soft benefit slides:** `--soft` background, dark headline with an accent second line,
  device bleeding off the bottom, chips naming the content types ("Breakfast", "Salads") and a
  bubble with an icon, all overlapping the device edge so they read as popping out.
- **How it works:** a row of the platforms or sources the app works with above a phone showing
  the step (e.g. a share sheet). Only use other companies' logos when the integration is real,
  and keep them small.
- **Collage header:** a strip of content tiles above the headline, e.g. recipe categories in a
  `layout-free` slide, to show breadth.
- **Game sets** (RunTeam): full-bleed gameplay (`layout-full`), a chunky display font with a
  thick outline (`-webkit-text-stroke` + `paint-order: stroke fill` + hard `text-shadow`), the
  caption on a band at the top or bottom, short verbs ("Dodge. Dash. Win."). The game logo goes
  on the first image. Captions at the top hide the HUD, so use `caption-bottom` or crop with
  `data-focus` when the score matters.
- **Panoramic sets:** one background spanning all images makes the gallery feel continuous.
  Put `<div class="pan-bg" data-pan="x">…</div>` once, outside the slides, and
  `data-pan="x"` on each slide. The kit clones it into every slide, shifted by the slide's
  position (`--pan-index`), so shapes placed in `vw` units (e.g. `left: 170vw`) cross the
  boundary between images 2 and 3. The `panoramic` style is a ready-made example.

## Checks, preview and gotchas

`render.mjs` prints per-slide warnings from the kit:
- text cut off by the slide edge or overflowing its box
- a decoration or device overlapping the caption text
- caption text smaller than about 2.8% of the short side (unreadable in thumbnails)
- caption text over 20% of a Google Play image
- a missing capture, or a fallback to another device's capture

Always open the contact sheets (`out/_preview/*.png`) too, because warnings can't judge
taste. Live preview: `node $S/render.mjs serve` and open the printed board URL.
`?target=<id>&slide=<name>` shows one slide at full size.

Gotchas:
- **Specificity:** your `<style>` comes after `kit.css`, so a selector of equal weight wins.
  The landscape auto-split is the strong one
  (`html[data-orientation="landscape"] .slide:where(…) .caption`). To restyle captions on
  landscape targets, write `html[data-orientation="landscape"] .slide .caption { … }`, or opt
  the slide out with `layout-free`.
- **Inherited tokens:** when a slide flips `--ink` to white, also set `--muted`. Chips use
  `--chip-ink` and stay dark.
- **Images** must be local (`design/assets/`) or from a CDN; the renderer waits for them, but
  slow remote images may time out after 20 s. Fonts from Google Fonts need network access.
- **Emoji** render with the system's emoji font (Apple Color Emoji on macOS, Noto on Linux),
  so they look different per machine. Use SVG icons when the exact look matters.
- **Don't edit `kit/`** in the project. `scaffold.mjs` refreshes it, so put overrides in the
  design file.
