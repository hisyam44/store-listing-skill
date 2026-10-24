# Plateful (example)

A recipe keeper and meal planner: browse recipes, plan the week, and turn the plan into a
shopping list. It's a plain HTML/JS PWA with a Capacitor config, the kind of web app that ships
to the App Store and Google Play. It's the sample project for the
[store-listing](../../README.md) skill.

| File | What it is |
|---|---|
| `store-assets/brief.json` | name, tagline, colours, style and one entry (capture + headline) per screenshot |
| `store-assets/shots.json` | capture plan: phone + tablet, seeded shopping list |
| `store-assets/captures/` | the raw Playwright captures (phone 1320×2682 content, tablet 2064×2704) |
| `store-assets/design/screenshots.html` | the hand-polished `bold-gradient` design (callouts, chips, sticker, duo) |
| `store-assets/design/feature.html` | the `brand-fan` feature graphic |
| `store-assets/listing/en-US.md` | the listing text with its evidence list |

Run the app with any static server, e.g. `node ../../store-listing/scripts/run_app.mjs start .`
(port 8080). See the repo README for how to regenerate the images.
