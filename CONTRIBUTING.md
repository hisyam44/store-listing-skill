# Contributing

Thanks for helping. The most useful contributions are **new visual styles**, **store-spec
updates** when Apple or Google change their rules, and **fixes from real projects** (a framework
that isn't detected, a layout that breaks on some size, a false positive in the listing
checker).

## Setup

```bash
git clone https://github.com/hisyam44/store-listing-skill.git
cd store-listing-skill
./install.sh                  # npm install + symlink into ~/.claude/skills/store-listing
node store-listing/scripts/doctor.mjs
```

The installed skill is a symlink to `store-listing/`, so edits apply immediately. Start a new
Claude Code session to pick up changes to `SKILL.md`.

## Test against the examples

Both examples are complete projects with a brief, shot plan, captures, designs and listing:

```bash
cd examples/plateful            # or examples/sky-hop
S=../../store-listing/scripts
node $S/run_app.mjs start .     # static server on :8080
node $S/capture.mjs --plan store-assets/shots.json
node $S/scaffold.mjs .          # refresh design/kit (designs are kept)
node $S/render.mjs              # every target, with checks and contact sheets
node $S/gallery.mjs .           # every style
node $S/listing.mjs check
node $S/run_app.mjs stop .
```

Before opening a PR, render both examples. Check that every slot reports `ok`, there are no new
layout warnings, and the contact sheets in `store-assets/out/_preview/` and
`out/_gallery/` still look right. Include before/after images for visual changes.

## Adding a style

1. Add scoped CSS to `store-listing/kit/styles.css` as `.s-<id> { … }` (or `.f-<id>` for a
   feature graphic). Use the brand tokens (`--accent`, `--accent-2`, `--font-display`) rather
   than fixed colours, so the style adapts to every app.
2. Register it in `store-listing/scripts/lib/styles.mjs`: an entry in `STYLES` (label,
   `bestFor`, Google Fonts, frame preferences) and a builder in `BUILD` that returns the
   slide markup. For feature graphics, use `FEATURE_STYLES` and `featureSection`.
3. Add it to `DEFAULT_GALLERY` if it should appear in the gallery by default.
4. Document it in `store-listing/references/styles.md` (look, best for, brief fields used).
5. Run `gallery.mjs` on both examples. The style must render without warnings on iPhone,
   Google Play phone and tablet targets.

## Updating store specs

All sizes, counts and file-size limits live in one registry: `TARGETS` in
`store-listing/kit/kit.js`, used by both the kit and `render.mjs`. Text-field limits and policy
rules live in `store-listing/scripts/listing.mjs` (`FIELDS` and the rule regexes). Update
`references/store-specs.md` / `references/listing.md` with the source and date.

## Style of the code

- Node 18+ ESM, no dependencies beyond Playwright. Scripts print JSON or short reports, and
  log to stderr.
- Comments explain *why*, not *what*.
- Keep `SKILL.md` short. Details go in `references/`, which Claude reads when it reaches
  that stage.
