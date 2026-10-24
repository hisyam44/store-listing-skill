# Capturing the screens (`store-assets/shots.json`)

`scripts/capture.mjs --plan store-assets/shots.json` drives Chromium through the app with
Playwright. Each shot is taken **once per device** and saved as
`store-assets/captures/<device>/<shot>.png`. `captures/manifest.json` records each capture's
size, viewport and status-bar height, so the design kit can frame it correctly and pick the
right device's capture for each store target.

## Contents
- Devices
- Top-level fields
- Shot fields
- Actions
- Making the screens look their best
- Examples: app, game
- Recordings (app previews, frame grabs)
- Troubleshooting

## Devices

| device | viewport (CSS px) | scale | full screen | used for |
|---|---|---|---|---|
| `phone` (default) | 440×956, minus a 62 px status bar | 3× | 1320×2868 | App Store iPhone, and Play phone unless `phone-android` exists |
| `phone-android` | 412×915, minus 32 px | 3× | 1236×2745 | Google Play phone (Android user agent) |
| `tablet` | 1032×1376, minus 24 px | 2× | 2064×2752 | App Store iPad 13", Play tablet |
| `tablet-android` | 800×1280, minus 28 px | 2× | 1600×2560 | Play tablet |
| `desktop` | 1440×810 | 2× | 2880×1620 | Chromebook, landscape feature-graphic art |
| any Playwright device | e.g. `"Pixel 8"`, `"iPad Mini"` | its own | | special cases |

- Phone and tablet captures **leave out the status bar**. The kit draws a clean 9:41 status bar
  in the frame, tinted to match the app's top edge. Use `"fullscreen": true` for games and
  fullscreen apps, which draw under the status bar themselves.
- Mobile devices get touch input (`tap`, `swipe`, `longPress`) and a mobile user agent, so
  frameworks that adapt per platform (Ionic, Framework7, Konsta) render iOS styling on `phone`
  and Material styling on `phone-android`. Capture both when the app looks different on each;
  the kit uses the iOS capture for App Store targets and the Android capture for Play.
- The kit picks captures per target: App Store iPhone → `phone`, Play phone → `phone-android`
  then `phone`, iPad → `tablet`, Play tablet → `tablet-android` then `tablet`, Chromebook →
  `desktop`. If a device is missing it falls back to another one and warns.

## Top-level fields

| field | default | notes |
|---|---|---|
| `baseUrl` | from `store-assets/.run/app.json` | `--url` overrides it |
| `devices` | `["phone"]` | Devices every shot is taken on. `device` (one name) also works. |
| `deviceOptions` | – | Per-device overrides: `{ "tablet": { "orientation": "landscape" }, "phone-android": { "viewport": {"width": 360, "height": 640} } }`. Keys: `viewport`, `deviceScaleFactor`, `orientation`, `fullscreen`. |
| `orientation` | `portrait` | `"landscape"` turns phones and tablets sideways (landscape phones have no status bar) |
| `fullscreen` | `false` | Include the status-bar area (games, fullscreen apps) |
| `viewport` | per device | Single-device plans only. With several devices, use `deviceOptions`. |
| `deviceScaleFactor` | per device | Applies to all devices. Lower it only for recordings (see below). |
| `colorScheme` | `no-preference` | `"dark"` / `"light"`. A dark-mode set is a nice extra for apps that support it. |
| `locale` | `en-US` | Browser locale, for localized UI captures (`"de-DE"`) |
| `localStorage` | – | `{key: value}` seeded before page scripts run: skip onboarding, load demo data, unlock levels |
| `storageState` | – | Path to a Playwright storage-state JSON for a logged-in test account |
| `initScript` | – | JS run before every page load, e.g. `"Math.random = () => 0.42"` or a demo-mode flag |
| `hideSelectors` | – | Hidden with `display:none`: cookie banners, install prompts, dev toolbars, chat widgets |
| `setup` / `setupPath` | – | Actions run once per device before any shot, e.g. logging in with a seed account |
| `cursor` | off for stills | Store screenshots never show a pointer. Recordings show a fingertip unless `false`. |
| `out` | `captures/` next to the plan | `--out` overrides it, e.g. `store-assets/captures-de` for a localized set |

## Shot fields

| field | notes |
|---|---|
| `name` | File stem, unique, kebab-case. The design refers to it as `data-shot="name"`. |
| `type` | `"screenshot"` (default) or `"video"` |
| `path` | Navigate here first (hash routes work: `"/#/recipes"`). Omit it to continue from the previous shot's state. |
| `devices` / `device` | Limit this shot to some devices, e.g. a landscape `desktop` art shot |
| `fresh` | Clear storage and cookies and reload the page first, so the seeds re-apply and no in-memory state leaks in (also on hash routes) |
| `before` / `actions` / `after` | Actions: before the shot (not recorded), during it, after it |
| `settleMs` | Wait after navigation (800 ms) |
| `animations` | `"disabled"` ends CSS animations and transitions before the still |
| `selector` / `fullPage` / `clip` | Capture only an element, the full scroll height, or a rectangle |
| `deviceScaleFactor` | Run this shot in its own session at this scale (e.g. 2 for smooth recordings) |
| `note` | Copied into the manifest |

## Actions

Every action is `{ "do": "<name>", ... }`. A target is a `selector` (Playwright syntax: CSS,
`text=Save`, `button:has-text("Play")`, `[data-testid=x]`), optionally with `at: [fx, fy]`
inside it, or just `at` (a fraction of the viewport), or `x`/`y` in pixels.

| action | fields | what it does |
|---|---|---|
| `wait` | `ms` | Pause |
| `waitFor` | `selector` / `text` / `js`, `timeout` | Wait for an element, text or JS condition, e.g. images loaded |
| `goto` / `reload` | `path`, `settleMs` | Navigate / reload |
| `tap` / `click` | target, `after` | A real touch tap on mobile devices, a click on desktop |
| `swipe` | `direction` + `distance` (0–1), or `from`/`to`; `duration` | Scroll feeds, flip carousels, game gestures |
| `longPress` | target, `ms` | Press and hold |
| `type` / `fill` | `selector`, `text` (`type` also takes `delay`, `clear`, `enter`) | Type like a person / fill instantly |
| `select` | `selector`, `value` | Pick a `<select>` option |
| `press` / `hold` / `keyDown` / `keyUp` | `key` / `keys`, `ms`, `times` | Keyboard |
| `drag` | `from`, `to`, `dragMs` | Drag and drop, sliders |
| `scroll` | `to` (`"bottom"`, px, selector) or `by`, `container` | Smooth scroll; use it to show a screen's best part |
| `eval` | `js` | Run JS in the page: open a modal, set app state, trigger a celebration |
| `screenshot` | `name`, `selector?`, `fullPage?` | An extra still in the middle of a shot |
| `burst` | `name`, `count` (8), `interval` (500 ms) | Several stills in a row, `name-01.png`…, to pick the best game moment |
| `mash` | `keys[]` or `taps[]`, `ms`, `seed` | Semi-random gameplay input (seeded, so it's repeatable) |
| `repeat` | `times`, `actions[]` | Loop |

## Making the screens look their best

Store screenshots are marketing. The app should look **lived-in, successful and calm**:
- **Real-looking content.** Use names, photos, numbers and text that feel real and match the
  audience: a recipe app full of appetizing recipes, a finance app with plausible balances, a
  streak counter at 12 rather than 0. Seed it through `localStorage`, `setup` actions, a demo
  or seed flag in the app (look for `demo`, `seed`, `fixtures`, `mock` in the code), or `eval`.
  Never show real users' personal data.
- **No empty, error or loading states**, no "test", "lorem ipsum" or placeholder avatars.
  Add `waitFor` on the content and its images.
- **Hide web-only chrome**: cookie banners, "Add to home screen" / install prompts, "open in
  app" bars, dev overlays, debug panels, beta ribbons. Native wrappers don't show them.
  Capacitor apps sometimes branch on `Capacitor.isNativePlatform()`; if the web build shows a
  different UI, use the app's own flag via `initScript`.
- **Show the moment of value**: a completed checklist, a chart with a good trend, a level
  cleared. Use `actions` to get there, then capture.
- **Same state across devices**: seeds apply to every device, so phone and tablet captures
  match.

## Example: app (phone + tablet)
```json
{
  "devices": ["phone", "tablet"],
  "localStorage": { "onboarded": "1", "demo": "true" },
  "hideSelectors": ["#cookie-banner", ".install-prompt"],
  "shots": [
    { "name": "home", "path": "/" },
    { "name": "library", "path": "/recipes", "actions": [{ "do": "waitFor", "selector": ".card img" }] },
    { "name": "detail", "path": "/recipes/ramen", "actions": [{ "do": "scroll", "by": 200 }] },
    { "name": "planner", "path": "/plan", "actions": [{ "do": "tap", "selector": "text=Tue" }] }
  ]
}
```

## Games

- `"fullscreen": true`: games draw edge to edge, with no status-bar gap.
- **Google Play needs 9:16** while iPhones are about 9:19.5. Capture `phone-android` at a 9:16
  viewport so Play images aren't cropped (cropping cuts HUDs and titles):
  `"deviceOptions": { "phone-android": { "viewport": { "width": 360, "height": 640 } } }`
  gives exactly 1080×1920 at 3×. `phone` gives exactly 1320×2868 for the App Store.
- **Landscape games**: set `"orientation": "landscape"` and render `…-landscape` targets.
- Use `burst` during gameplay to get several candidate frames, then pick the most dramatic
  (action mid-air, a combo, a boss) with the best composition.
- Make runs repeatable with `initScript` (seeded `Math.random`) and use `eval` to reach good
  states (a later level, a full combo meter) when the game exposes hooks.
- **Feature graphic art**: capture one landscape still with `"devices": ["desktop"]` and
  `"deviceOptions": { "desktop": { "viewport": { "width": 1024, "height": 640 }, "deviceScaleFactor": 2 } }`,
  then use it full-bleed in `feature.html` (`data-device="desktop"`). A taller-than-500 capture
  leaves room to crop the HUD with `data-focus`.
- WebGL games can be slow headless; add `--headed` if frames look stuck.

```json
{
  "devices": ["phone", "phone-android"],
  "fullscreen": true,
  "deviceOptions": {
    "phone-android": { "viewport": { "width": 360, "height": 640 } },
    "desktop": { "viewport": { "width": 1024, "height": 640 }, "deviceScaleFactor": 2 }
  },
  "shots": [
    { "name": "title", "path": "/", "actions": [{ "do": "wait", "ms": 1200 }] },
    { "name": "play", "path": "/", "actions": [
      { "do": "tap", "at": [0.5, 0.5] }, { "do": "wait", "ms": 1500 },
      { "do": "burst", "name": "play", "count": 6, "interval": 450 } ] },
    { "name": "feature-art", "devices": ["desktop"], "path": "/", "actions": [
      { "do": "click", "at": [0.5, 0.5] }, { "do": "wait", "ms": 2500 } ] }
  ]
}
```

## Recordings (app previews, frame grabs)

`"type": "video"` records an MP4 (`captures/<device>/<name>.mp4`). Recording at 3× runs at about
12 fps, so give video shots `"deviceScaleFactor": 2` (about 20–30 fps, 880 px wide, enough for
an 886×1920 app preview). Then:
- `bash $S/ff.sh frames <clip> <dir>`: a contact sheet, to check the take.
- `bash $S/ff.sh still <clip> <out.png> <seconds>`: pull a frame to use as a capture.
- `bash $S/ff.sh preview <clip> <out.mp4> iphone|ipad [pad-colour]`: an App Store app preview.
  15–30 s, so record 16–30 s of real use: open the app, do the main thing, show the result.
  Pass the app's header colour as `pad` to keep the whole UI instead of cropping its sides.

## Probe crops for callouts
`capture.mjs --probe /#/plan --device phone --select ".week,.ring"` prints, for every interactive
element and for everything matched by `--select`, a `crop` such as `"0.036 0.08 0.927 0.072"`:
the element's box as fractions of the captured image. Paste it into a callout's `data-crop`
(design.md → Callouts). Probe each device separately (`--device tablet`) because layouts
differ.

## Troubleshooting
- **Wrong app in the probe**: something else was already on the port. `run_app.mjs stop`, then
  start again with `--port`, or pass `--url`.
- **Fonts or images missing**: add a `waitFor` on them, or raise `settleMs`.
- **Layout looks like desktop on phone**: the viewport meta is missing or the CSS isn't
  responsive (`overflowX: true` in the probe). Tell the user. A `viewport` override can't fix
  it.
- **A shot failed**: `<name>.error.png` shows the page at the moment it failed. The others
  still ran.
