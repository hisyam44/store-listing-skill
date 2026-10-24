# Visual styles

The skill ships 10 screenshot styles and 4 feature-graphic styles. Don't pick one blindly:
render the **gallery** with the user's own screens and headlines, show it, and let them choose
(or recommend one with a reason).

```bash
node $S/scaffold.mjs . --init           # brief.json: name, tagline, colours, slides + headlines (edit it first)
node $S/gallery.mjs .                   # every style → store-assets/out/_gallery/styles-*.png, features.png
node $S/gallery.mjs . --styles editorial,clean-minimal --target appstore-iphone-6.9   # compare a few, with iPhone frames
node $S/scaffold.mjs . --style editorial --feature-style collage --force             # write the chosen style
```

The gallery renders the first 3 slides of the brief per style at Google Play phone size by
default, so frames are Play-style (frameless cards). Use `--target appstore-iphone-6.9` to see
the App Store versions with iPhone frames. Show the sheets to the user: send or open the PNGs,
or describe them if the user can't see images. Then write the chosen style with
`scaffold.mjs --style … --force`. Every style is plain HTML and CSS afterwards, so polish it like
any other design.

## Contents
- What the research says
- Screenshot styles
- Feature graphic styles
- Choosing
- Customizing and mixing

## What the research says

These are directional findings from ASO practitioners (AppFollow, AppRadar, Apptamin, SplitMetrics
and others, 2022–2026), not laws. Store A/B tests (Apple Product Page Optimization, Play Store
listing experiments) are the real judge.
- **Captioned, benefit-led screenshots beat raw UI.** Outcome headlines ("Plan your week in
  minutes") beat feature names ("Calendar view"). Keep captions under about 5 words, large
  enough to pass the squint test. Users decide within seconds, mostly from the first 2–3
  images.
- **Tell a story across the set:** promise → core loop → differentiators → breadth or proof.
  Re-ordering alone has moved conversion in published tests.
- **Clarity first for trust categories** (finance, health, productivity): UI-only or minimal
  layouts. **Emotion first for lifestyle and social**: colour, people, outcomes.
- **Games: show gameplay in the first image.** Use the core loop for casual and puzzle games,
  and world, characters and progression for RPGs. Landscape and full-bleed suit immersive
  games. Keep the art style consistent with the icon.
- **Dark heroes are common** for apps with a real dark mode. Plain white backgrounds can look
  dated.
- **Device frames are optional.** Google advises against device imagery in Play graphics, and
  frameless cards look current. iPhone frames still read well on the App Store.
- **Panoramic sets are rare** (about 2–4% of top games), which is exactly why they stand out.
  They only work when the story is continuous.
- **Feature graphic (Play):** few words (name or name + short tagline), vivid colour (not white,
  black or dark grey), a centred focal point, nothing important at the edges, no devices or
  badges. It shouldn't duplicate the first screenshot. Top examples are character- or
  product-led (Marvel Snap, Candy Crush, Roblox), brand-element collages (Pandora, Poshmark)
  and split value-proposition layouts (GoodRx, Audible).

## Screenshot styles

| id | look | best for | notes |
|---|---|---|---|
| `bold-gradient` | brand-gradient hero, soft-tinted benefit slides, devices bleeding off the edge, chips, sticker | lifestyle, food, habits, social, shopping | the default for apps; warm and energetic |
| `clean-minimal` | near-white, left-aligned headline with a quiet grey second line, frameless screens, lots of air, app icon on the hero | finance, productivity, utilities, health data, B2B | trust and clarity; uses `eyebrow` labels |
| `dark-premium` | deep navy with a brand-colour glow, gradient accent words, dark chips | pro tools, AI, finance, fitness, music, photo/video | best when the app has a real dark mode (capture with `"colorScheme": "dark"`) |
| `editorial` | paper background, serif headline with an italic accent, "No. 01 · Section" eyebrow and rule | reading, journaling, recipes, travel, wellness, education | crafted and calm; the serif is Fraunces |
| `playful-pop` | a different bright colour per slide (brand hues), rounded chunky type (Fredoka), tilted devices, shapes, sticker | kids, education, social, casual games, habits, pets | text colour is picked per slide for contrast |
| `neo-brutal` | cream, heavy grotesk (Space Grotesk), black outlines and hard offset shadows, highlighter accent | productivity, dev and creator tools, Gen-Z social | strong personality; keep the copy punchy |
| `big-number` | a huge figure from the app leads the slide (`stat` in the brief), screen below | finance, health, fitness, habits, analytics | **only numbers the captured UI shows**; slides without a stat fall back to a headline |
| `panoramic` | one continuous gradient, wave and orbs running across the whole set | journeys and flows; anything that wants to stand out | order matters; keep slide count fixed per target |
| `game-cinematic` | full-bleed gameplay, chunky outlined captions (Lilita One) on a scrim, alternating top and bottom | immersive games of any genre | capture `fullscreen`, 9:16 `phone-android` for Play (see capture.md → Games) |
| `game-banner` | bright backdrop, the game's name as a logo, gameplay in a thick white card, caption on a ribbon | casual, puzzle, idle, hyper-casual, kids' games | RunTeam-style; strong at thumbnail size |

Brief fields each style uses (all optional except `shot` and `headline`):
- `accent`: second headline line, in the accent colour (every style)
- `sub`: subline (most styles; the hero uses it for the tagline)
- `chips`: 1–3 short labels hanging off the device (most styles; the first chip becomes a
  badge in `game-cinematic`)
- `sticker`: starburst / tag on the hero (`bold-gradient`, `playful-pop`, `neo-brutal`)
- `eyebrow`: small label above the headline (`clean-minimal`, `dark-premium`, `editorial`)
- `stat: { value, label }`: `big-number`
- `zoom`, `focus`: enlarge or re-anchor the capture inside the frame (any device style)

## Feature graphic styles

| id | look | best for |
|---|---|---|
| `brand-fan` | app icon, name and tagline left; three screen cards fanned out right; brand gradient | most apps (Honeydew style) |
| `art-title` | full-bleed art with the name centred over a soft shade (`right` class to put it on the right). Without landscape art (`featureArt` in the brief), a blurred, brand-tinted capture | games (Alto's Adventure style), visual apps |
| `collage` | name and icon centred, screen cards scattered around the edges on a radial brand gradient | content apps (music, shopping, recipes, social) |
| `split-card` | value proposition left, two big tilted screen cards right | utilities, finance, productivity |

For games, the strongest feature graphic is usually art: capture a landscape still for it
(`featureArt`), or use the game's own key art from the project (`<img class="bg-shot" src="assets/key-art.png">`).

## Choosing

Recommend a style from the category, then let the gallery confirm it:
- Is it a game? `game-cinematic` for immersive games, `game-banner` for casual ones.
- Is trust the main question (money, health data, work)? `clean-minimal`, or `dark-premium`
  if the app is dark.
- Is it about taste, food or calm? `editorial`. Fun, kids, pets or social? `playful-pop`.
- Is the brand loud and young? `neo-brutal`. Does it produce a striking number? `big-number`.
- Otherwise `bold-gradient`. Offer `panoramic` when the user wants to stand out.

Match the icon and the app's own UI. A style that fights the app's colours or tone looks
fake. When unsure, show 3 candidates instead of all of them.

## Customizing and mixing

- Brand tokens (`--accent`, `--accent-2`, `--font-display`) drive every style. Change them in
  the brief or the design's `:root`.
- A style is just the slide class `s-<style>` plus its markup, so slides can mix styles
  (e.g. a `dark-premium` slide for the "Dark mode" benefit in a `clean-minimal` set). Copy the
  section from `_gallery.html`.
- Override style rules in the design's `<style>` with the same selector, e.g.
  `.s-editorial { --bg: #eef3ee; }`.
- New styles: add `.s-<id>` rules to `kit/styles.css` and a builder in
  `scripts/lib/styles.mjs` (`STYLES` + `BUILD`), then it appears in the gallery.
