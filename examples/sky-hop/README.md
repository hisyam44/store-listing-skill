# Sky Hop (example)

A one-tap endless hopper: tap to jump between floating islands, grab stars (+10 each) and beat
your best score. It's an HTML5 canvas game for phones, and the game sample for the
[store-listing](../../README.md) skill.

| File | What it is |
|---|---|
| `store-assets/brief.json` | headlines per capture, `game-cinematic` style, `art-title` feature graphic |
| `store-assets/shots.json` | fullscreen captures: `phone` (1320×2868, App Store) and `phone-android` at 9:16 (1080×1920, Google Play), a `burst` of gameplay frames, a landscape `desktop` still for the feature graphic, and a recording for an App Store preview |
| `store-assets/design/` | generated `game-cinematic` screenshots + hand-tuned `art-title` feature graphic |
| `store-assets/listing/en-US.md` | the listing text with its evidence list |

Run it with any static server, e.g. `node ../../store-listing/scripts/run_app.mjs start .`.
