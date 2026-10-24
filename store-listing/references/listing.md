# Store listing copy (names, descriptions, keywords)

`store-assets/listing/<locale>.md` holds the text fields for both stores. `listing.mjs` writes
the template, checks limits and store rules, and exports fastlane-style files. The copy has
one hard requirement: **it describes the app that's actually in the code**. A listing that
promises features the build doesn't have gets rejected by Apple (guideline 2.3.1), breaks
Google's metadata policy, and produces 1-star reviews.

## Contents
- Fields and limits
- Method: grounded copy
- Writing each field
- Games
- Store rules the checker enforces
- Localization and export

## Fields and limits

| Store | Field | Limit | Notes |
|---|---|---|---|
| Google Play | App name | 30 chars | Brand + descriptor. No emoji, ALL CAPS (unless the brand is), "free", "best", "#1", "new". |
| Google Play | Short description | 80 chars | Shown under the name; indexed for search. The main benefit in plain words. |
| Google Play | Full description | 4,000 chars | Indexed for search. Only the first ~3 lines show before "more". |
| Google Play | What's new | 500 chars | Release notes (optional here). |
| App Store | Name | 30 chars | Unique on the store; indexed. |
| App Store | Subtitle | 30 chars | Under the name; indexed. Don't repeat the name's words. |
| App Store | Promotional text | 170 chars | Above the description; editable without a new version; **not** indexed. |
| App Store | Description | 4,000 chars | Plain text, **not** indexed for search; it's for people. |
| App Store | Keywords | 100 bytes | Comma-separated, no spaces; indexed; invisible to users. |
| App Store | What's new | 4,000 chars | Required for updates, not for the first version. |

## Method: grounded copy

1. **Inventory:** `node $S/inventory.mjs . --pretty`. Capabilities with evidence (native
   plugins, libraries, code patterns), monetization (ads, in-app purchases, subscriptions),
   permissions, UI locales, routes, the app's own UI vocabulary, README feature bullets and game
   traits.
2. **Confirm:** read the code behind each lead and look at the captures. Keep only what a user
   can actually do in this build. Watch for look-alikes: a search *bar* that does nothing, a
   "Pro" screen with no purchase flow, an "export" button that's a stub, a sync library that's
   unused.
3. **Write the evidence list first** (the `## Evidence` section): one line per feature you'll
   mention, with where it lives (file / function / route / capture). Add a "NOT claimed" line
   for tempting things that aren't there. The checker wants at least three entries.
4. **Positioning:** who it's for, the job it does, and what's different, in one sentence. That
   sentence becomes the short description / subtitle and the first line of the description.
5. **Write the fields** using the app's own names for things (the inventory's vocabulary), so
   the listing matches the screenshots and the UI.
6. **Check:** `node $S/listing.mjs check`, fix every ✗ and consider every !.
7. **Show the user** the fields and the evidence. Ask about anything you couldn't verify
   (pricing, upcoming features, support email), and don't fill gaps with guesses.

Never invent numbers (recipes, users, levels, downloads, ratings), integrations, awards, press
quotes or testimonials. Mention data handling ("saved on your device", "no account needed",
"works offline") only when the code proves it. Disclose in-app purchases and subscriptions
when the inventory finds them (Apple 2.3.2), e.g. "Free to download; Pro unlocks unlimited
plans via an optional subscription." The Play Console's "Contains ads" / "In-app purchases"
labels are set in the console, not in the text, but the description still must not hide them.

## Writing each field

**App name / title (30):** `Brand: descriptor`, e.g. "Plateful: Recipes & Meal Plan". The
descriptor carries the most-searched words for the app's job. Use the same brand on both
stores; the descriptor may differ.

**Short description (Play, 80):** one sentence, the benefit plus how. "Plan your week's meals
and get a shopping list sorted by aisle, in one place." No emoji, no "free" or "best", and
don't repeat it word for word in the full description.

**Subtitle (App Store, 30):** the benefit in new words, since name and subtitle are both
indexed: "Recipes, plans & groceries".

**Full description / description (4,000):**
```
Hook: 1-2 sentences. What it is, for whom, the outcome. (This is all most people read.)

FEATURE HEADING (the benefit)
2-3 sentences on what the user can do, using the app's own names for things.

… 3–6 feature blocks, most important first, matching the screenshot order …

Details: offline / privacy / devices / languages (only what's true).
Pricing: free / one-time / subscription, and what the paid tier adds (if any).
Support: how to reach you (optional; App Store Connect has a support URL field).
```
- Aim for 1,500–3,000 characters. Plain text; ALL-CAPS section headings or "•" bullets are
  the usual formatting (no HTML on the App Store).
- On Play the description is search-indexed: mention the main job words naturally 2–4 times.
  Never use keyword lists, "Tags:" lines or repetition.
- The App Store description isn't indexed, so write it purely for people. Keywords go in the
  keyword field.

**Keywords (App Store, 100 bytes):** `cooking,dinner,food,grocery,list,nutrition,…`
- No spaces after commas; singular forms (Apple matches plurals); each over 2 characters.
- Don't repeat words already in the name or subtitle, and don't use "app", competitor or
  brand names, or category names.
- Think synonyms and jobs people search for ("meal prep", "grocery list" → `meal,prep,grocery`;
  multi-word phrases can be split into words).
- No tool gives you search volumes here. Suggest the user refine with an ASO tool (AppTweak,
  Appfigures, Sensor Tower), and keep the list honest.

**Promotional text (App Store, 170):** what's new or seasonal, editable any time. No prices.

**What's new:** real changes in this version, user-facing first.

## Games

- **Hook:** the fantasy plus the core loop in one line: "Hop across floating islands with one
  tap and chase the stars."
- **How to play:** the actual controls from the code (inventory → `game.input`): "Tap to
  jump", "Swipe to steer".
- **Features:** modes, level count (only if counted from the data), characters or unlocks,
  progression, offline play, controller support, leaderboards (only if wired to Game Center /
  Play Games).
- **Fair play:** say plainly if there are ads or purchases, and what they do.
- Mood words are fine ("relaxing", "fast-paced") when they match the gameplay. Superlatives
  aren't ("the most addictive game ever").

## Store rules the checker enforces

`listing.mjs check` reports ✗ (fix before submitting) and ! (review):
- ✗ over the limit; missing required fields; `TODO`/placeholder text
- ✗ in names, short description and keywords: emoji, repeated special characters, ranking or
  superlative claims (#1, best, top-rated, award-winning, editor's choice), price or promo words
  (free, sale, % off, no ads)
- ✗ another platform named (iPhone/App Store in Play text, Android/Google Play in App Store text)
- ✗ HTML in App Store text; App Store keywords of 2 characters or fewer
- ! the same claims in long descriptions (fine only as attributed facts or a plain pricing note);
  "download now" style CTAs; testimonials or star ratings in text; keyword stuffing
  (a word repeated far more than natural); keyword-list lines; a hook paragraph over ~320
  characters; descriptions under 600 characters
- ! Play short description repeated in the full description; App Store keywords with spaces,
  duplicates, "app", or words already in the name/subtitle; a subtitle that repeats the name
- ! fewer than 3 evidence lines

## Localization and export

- One file per locale: `listing.mjs init . --locale de-DE`. Write natively, not word for
  word; keywords especially should be local search terms. The screenshot captions should match
  (see SKILL.md → Localized sets).
- `listing.mjs export` writes `store-assets/listing/metadata/` in fastlane's layout
  (`<locale>/name.txt`, `subtitle.txt`, `description.txt`, `keywords.txt`, `promotional_text.txt`,
  `release_notes.txt` for deliver; `android/<locale>/title.txt`, `short_description.txt`,
  `full_description.txt` for supply) plus `<locale>.json`. Copy it into `fastlane/metadata/` if the
  project uses fastlane (ask first), or paste the fields into App Store Connect and the Play
  Console by hand.
