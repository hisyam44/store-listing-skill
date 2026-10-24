#!/usr/bin/env node
// Store listing copy: app name, short and full descriptions, App Store subtitle, keywords...
//
//   node listing.mjs init  [projectDir] [--locale en-US] [--stores play,appstore]
//        write store-assets/listing/<locale>.md, a fill-in template with every field and limit
//   node listing.mjs check [file.md | dir]        (default store-assets/listing/)
//        check limits and store rules; prints counts, errors and warnings (exit 1 on errors)
//   node listing.mjs export [dir] [--out store-assets/listing/metadata]
//        write per-field .txt files in fastlane's metadata layout (the contents of
//        fastlane/metadata/: <locale>/name.txt for deliver, android/<locale>/title.txt for
//        supply) plus <locale>.json next to the .md
//
// The listing file is Markdown with one "## Store · Field" heading per field (see init).
// Write it from the feature inventory (inventory.mjs) and the real screens: every claim must
// be true for the current build. references/listing.md has the method and the rules.

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const cmd = ['init', 'check', 'export'].includes(argv[0]) ? argv.shift() : 'check';
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const rel = (p) => path.relative(process.cwd(), p) || '.';

// heading (lower-case) -> field rules. max = characters, maxBytes = UTF-8 bytes.
const FIELDS = [
  { h: 'google play · app name', key: 'play.title', store: 'play', kind: 'title', max: 30, fastlane: 'android/{l}/title.txt' },
  { h: 'google play · short description', key: 'play.short', store: 'play', kind: 'short', max: 80, fastlane: 'android/{l}/short_description.txt' },
  { h: 'google play · full description', key: 'play.full', store: 'play', kind: 'long', max: 4000, fastlane: 'android/{l}/full_description.txt' },
  { h: "google play · what's new", key: 'play.whatsNew', store: 'play', kind: 'long', max: 500, optional: true, fastlane: 'android/{l}/changelogs/default.txt' },
  { h: 'app store · name', key: 'ios.name', store: 'ios', kind: 'title', max: 30, fastlane: '{l}/name.txt' },
  { h: 'app store · subtitle', key: 'ios.subtitle', store: 'ios', kind: 'title', max: 30, fastlane: '{l}/subtitle.txt' },
  { h: 'app store · promotional text', key: 'ios.promo', store: 'ios', kind: 'short', max: 170, optional: true, fastlane: '{l}/promotional_text.txt' },
  { h: 'app store · description', key: 'ios.description', store: 'ios', kind: 'long', max: 4000, fastlane: '{l}/description.txt' },
  { h: 'app store · keywords', key: 'ios.keywords', store: 'ios', kind: 'keywords', maxBytes: 100, fastlane: '{l}/keywords.txt' },
  { h: "app store · what's new", key: 'ios.whatsNew', store: 'ios', kind: 'long', max: 4000, optional: true, fastlane: '{l}/release_notes.txt' },
];

// ---------------------------------------------------------------- init
function template(locale, stores) {
  const play = stores.includes('play'), ios = stores.includes('appstore');
  const f = (title, limit, hint) => `## ${title}\n<!-- ${limit}. ${hint} -->\n\n`;
  return `<!-- Store listing copy · ${locale}
     Ground every claim in the code (node <skill>/scripts/inventory.mjs) and the real screens.
     Check: node <skill>/scripts/listing.mjs check   Rules: references/listing.md
     HTML comments like this one are ignored by the checker and the export. -->
# Listing · ${locale}

${play ? f('Google Play · App name', 'max 30 characters', 'Brand + what it is, e.g. "Plateful: Recipes & Meal Plan". No emoji, ALL CAPS, "free", "best", "#1".') +
f('Google Play · Short description', 'max 80 characters', 'The main benefit in plain words. Searchable, so use the words people search for. Not repeated in the full description.') +
f('Google Play · Full description', 'max 4000 characters', 'First 1-2 lines = the hook (only ~3 lines show before "more"). Then the features by benefit, details (offline, privacy, platforms), how it is paid for. No keyword lists, no unattributed testimonials.') +
f("Google Play · What's New", 'optional, max 500 characters', 'Release notes for this version.') : ''}${ios ? f('App Store · Name', 'max 30 characters', 'Brand + descriptor; must be unique on the App Store.') +
f('App Store · Subtitle', 'max 30 characters', 'The main benefit; do not repeat words from the name (both are indexed).') +
f('App Store · Promotional text', 'optional, max 170 characters', 'Shown above the description; can change without a new version. What is new or seasonal.') +
f('App Store · Description', 'max 4000 characters', 'Plain text. Hook first, then features, details, and in-app purchase / subscription disclosure (guideline 2.3.2).') +
f('App Store · Keywords', 'max 100 bytes', 'comma,separated,no,spaces; singular; no words already in the name or subtitle; no competitor names; each over 2 characters.') +
f("App Store · What's New", 'optional, max 4000 characters', 'Required for updates, not for the first version.') : ''}## Evidence
<!-- One line per feature you claim: the feature, then where it lives in the code or which
     capture shows it. The checker wants this list; reviewers (and you) will thank you. -->
-
`;
}

// ---------------------------------------------------------------- parse
function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const sections = {};
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) { cur = m[1].toLowerCase().replace(/\s*[·|:-]\s*/, ' · ').replace(/[’']/g, "'"); sections[cur] = []; continue; }
    if (cur) sections[cur].push(line);
  }
  const out = {};
  for (const [h, lines] of Object.entries(sections)) out[h] = lines.join('\n').replace(/^\s*\n+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
  return out;
}

// ---------------------------------------------------------------- rules
const chars = (s) => [...s].length;
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const EMOJI = /\p{Extended_Pictographic}/gu;
// "best" is a claim ("the best planner") but not in "your best score" / "personal best".
const RANKING = /(#\s?1\b|\bno\.?\s?1\b|\bnumber one\b|(?<!\b(?:your|my|personal|own|their|a new)\s)\bbest\b(?!\s+(?:scores?|times?|runs?|laps?|streaks?|records?|results?|friends?|practices?|of luck|moments?|shots?))|\btop[- ]?(rated|\d+|ranked|app|game)\b|\b(award|prize)[- ]winning\b|\beditor'?s'? choice\b|\bapp of the (day|year)\b|\bmost popular\b|\bmillions? of (users|downloads|players)\b|\bbestsell)/i;
const PROMO = /(\bfree\b|\bdiscount|\bsale\b|\d+\s?% off|\bcheap(est)?\b|\blimited[- ]time\b|\bno ads\b|\bcash ?back\b|\bdeal\b)/i;
const CTA = /\b(download|install|get) (it )?(now|today|for free)\b/i;
const OTHER = { play: /\b(iphone|ipad|ios|app store|apple watch|macos)\b/i, ios: /\b(android|google play|play store|galaxy|pixel|wear os)\b/i };
const STOP = new Set('a an and are as at be but by can for from has have in into is it its of on or our so that the their this to with you your we will all more one any app apps also just get use make like over each every not out up when what which who how than then there these they them was were do does'.split(' '));

function checkFile(file) {
  const L = parse(file);
  const locale = path.basename(file, '.md');
  const errors = [], warns = [], counts = [];
  const stores = new Set(FIELDS.filter((f) => f.h in L).map((f) => f.store));
  const val = (key) => { const f = FIELDS.find((x) => x.key === key); return (f && L[f.h]) || ''; };

  for (const f of FIELDS) {
    if (!stores.has(f.store)) continue;
    const v = L[f.h];
    const [st, fld] = f.h.split(' · ');
    const label = `${st.replace(/\b\w/g, (x) => x.toUpperCase())} · ${fld[0].toUpperCase()}${fld.slice(1)}`;
    if (v === undefined || !v.trim()) { if (!f.optional) errors.push(`${label}: missing`); continue; }
    if (/\bTODO\b|lorem ipsum|\[.*?\]\(#\)|^-\s*$/im.test(v)) errors.push(`${label}: still has placeholder text`);
    const n = f.maxBytes ? bytes(v) : chars(v);
    const lim = f.maxBytes || f.max;
    counts.push({ field: label, used: n, limit: lim, unit: f.maxBytes ? 'bytes' : 'chars' });
    if (n > lim) errors.push(`${label}: ${n}/${lim} ${f.maxBytes ? 'bytes' : 'characters'}, ${n - lim} over`);

    const emojis = v.match(EMOJI) || [];
    if (f.kind === 'title') {
      if (emojis.length) errors.push(`${label}: no emoji in names/titles (Play metadata policy, App Store 2.3.7)`);
      if (/([!?*~★☆✓✔#])\1|[!?]{2,}/.test(v)) errors.push(`${label}: repeated special characters`);
      if (/\b[A-Z]{4,}\b/.test(v)) warns.push(`${label}: ALL CAPS word; only fine if it's the brand`);
    } else if (f.kind === 'short' && emojis.length) warns.push(`${label}: emoji in a short description reads as spammy; prefer words`);
    else if (f.kind === 'long' && emojis.length > 8) warns.push(`${label}: ${emojis.length} emoji; keep them rare (a few as bullets at most)`);

    const strict = f.kind === 'title' || f.kind === 'short' || f.kind === 'keywords';
    const rank = v.match(RANKING);
    if (rank) (strict ? errors : warns).push(`${label}: "${rank[0]}" is a ranking/superlative claim${strict ? ' (not allowed)' : '; remove unless it is an attributed, verifiable fact'}`);
    const promo = v.match(PROMO);
    if (promo) (strict ? errors : warns).push(`${label}: "${promo[0]}" is price/promo language${strict ? ' (not allowed here)' : '; fine only as a factual pricing note, e.g. "Free to use, with an optional Pro upgrade"'}`);
    if (CTA.test(v)) warns.push(`${label}: "${v.match(CTA)[0]}" call to action; stores discourage it`);
    const other = v.match(OTHER[f.store]);
    if (other && f.kind !== 'keywords') errors.push(`${label}: mentions "${other[0]}", another platform (${f.store === 'ios' ? 'App Store 2.3.10' : 'confuses Play users'})`);
    if (/<\/?[a-z][^>]*>/i.test(v)) (f.store === 'ios' ? errors : warns).push(`${label}: HTML tags; ${f.store === 'ios' ? 'App Store text is plain text' : 'keep Play text plain'}`);

    if (f.kind === 'long') {
      const words = v.toLowerCase().match(/\p{L}[\p{L}'-]+/gu) || [];
      const freq = {};
      for (const w of words) if (!STOP.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1;
      const brandWords = new Set((val('play.title') + ' ' + val('ios.name')).toLowerCase().match(/\p{L}+/gu) || []);
      for (const [w, c] of Object.entries(freq)) if (!brandWords.has(w) && c >= Math.max(7, words.length * 0.018)) warns.push(`${label}: "${w}" appears ${c}×, reads like keyword stuffing`);
      // Word blocks: many comma-separated fragments of one or two words (a sentence with a
      // short series in it is fine).
      const block = v.split('\n').some((ln) => {
        const segs = ln.split(/[,|•;]/).map((x) => x.trim().split(/\s+/).filter(Boolean).length).filter(Boolean);
        if (segs.length < 7) return false;
        const sorted = [...segs].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)] <= 2;
      });
      if (block) warns.push(`${label}: a keyword list (many 1–2 word fragments); stores treat word blocks as spam`);
      if (/^\s*["“][^"”\n]{10,}["”]/m.test(v) || /["”]\s*[—–-]\s*[^\n]{0,40}\b(user|customer|player|reviewer|fan|parent|mom|dad)s?\b/i.test(v) || /★{3,}|⭐{3,}|\b[45](\.\d)? stars?\b/i.test(v)) warns.push(`${label}: looks like a testimonial or rating; Google requires attribution, and reviews belong in ratings`);
      const first = v.split(/\n\s*\n/)[0];
      if (chars(first) > 320) warns.push(`${label}: the first paragraph is ${chars(first)} characters; only about 3 lines show before "more", so lead with a 1-2 sentence hook`);
      if (chars(v) < 600 && !f.optional) warns.push(`${label}: only ${chars(v)} characters; a fuller description (1,500–3,000) helps search and conversion`);
    }
  }

  // Cross-field rules
  const short = val('play.short'), full = val('play.full');
  if (short && full && full.toLowerCase().includes(short.toLowerCase())) warns.push('Google Play: the short description is repeated word for word in the full description');
  const kw = val('ios.keywords');
  if (kw) {
    const list = kw.split(',');
    if (/,\s/.test(kw)) warns.push('App Store keywords: spaces after commas waste bytes');
    const items = list.map((k) => k.trim().toLowerCase()).filter(Boolean);
    const dup = items.filter((k, i) => items.indexOf(k) !== i);
    if (dup.length) warns.push(`App Store keywords: duplicates (${[...new Set(dup)].join(', ')})`);
    const short2 = items.filter((k) => k.length <= 2);
    if (short2.length) errors.push(`App Store keywords: each keyword must be longer than two characters (${short2.join(', ')})`);
    const indexed = new Set(`${val('ios.name')} ${val('ios.subtitle')}`.toLowerCase().match(/\p{L}+/gu) || []);
    const wasted = items.filter((k) => indexed.has(k));
    if (wasted.length) warns.push(`App Store keywords: already in the name/subtitle, so wasted: ${wasted.join(', ')}`);
    if (items.some((k) => k === 'app' || k === 'apps')) warns.push('App Store keywords: "app" is wasted, everything on the store is an app');
  }
  const name = val('ios.name'), subtitle = val('ios.subtitle');
  if (name && subtitle) {
    const nw = new Set(name.toLowerCase().match(/\p{L}+/gu) || []);
    const rep = (subtitle.toLowerCase().match(/\p{L}+/gu) || []).filter((w) => nw.has(w) && w.length > 2);
    if (rep.length) warns.push(`App Store subtitle repeats words from the name (${rep.join(', ')}); use new words, both are searchable`);
  }
  const ev = (L.evidence || '').split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l));
  if (ev.length < 3) warns.push(`Evidence: ${ev.length} item(s). List each claimed feature and where it lives in the code, so the copy can be verified.`);
  return { file, locale, stores: [...stores], counts, errors, warns, fields: L };
}

function listingFiles(target) {
  const p = path.resolve(target || 'store-assets/listing');
  if (!fs.existsSync(p)) throw new Error(`No listing at ${rel(p)}. Run: listing.mjs init`);
  return fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => /\.md$/.test(f)).sort().map((f) => path.join(p, f)) : [p];
}

function report(r) {
  console.log(`\n${rel(r.file)}  (${r.locale}; ${r.stores.map((s) => (s === 'ios' ? 'App Store' : 'Google Play')).join(' + ') || 'no store sections'})`);
  const w = Math.max(10, ...r.counts.map((c) => c.field.length));
  for (const c of r.counts) {
    const bar = c.used > c.limit ? 'OVER' : c.used / c.limit > 0.9 ? 'full' : '    ';
    console.log(`  ${c.field.padEnd(w)}  ${String(c.used).padStart(4)}/${c.limit} ${c.unit.padEnd(5)} ${bar}`);
  }
  for (const e of r.errors) console.log(`  ✗ ${e}`);
  for (const e of r.warns) console.log(`  ! ${e}`);
  if (!r.errors.length && !r.warns.length) console.log('  ✓ no problems found');
}

// ---------------------------------------------------------------- main
if (cmd === 'init') {
  const projectDir = path.resolve(positional[0] || '.');
  const locale = flag('locale', 'en-US');
  const stores = flag('stores', 'play,appstore').split(',');
  const file = path.join(projectDir, 'store-assets', 'listing', `${locale}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) { console.log(`${rel(file)} exists; edit it.`); process.exit(0); }
  fs.writeFileSync(file, template(locale, stores));
  console.log(`wrote ${rel(file)}`);
} else if (cmd === 'check') {
  const results = listingFiles(positional[0]).map(checkFile);
  results.forEach(report);
  const errs = results.reduce((n, r) => n + r.errors.length, 0);
  console.log(errs ? `\n${errs} error(s) to fix.` : '\nNo errors.');
  process.exitCode = errs ? 1 : 0;
} else if (cmd === 'export') {
  const files = listingFiles(positional[0]);
  const base = path.resolve(flag('out', path.join(path.dirname(files[0]), 'metadata')));
  const written = [];
  for (const file of files) {
    const r = checkFile(file);
    if (r.errors.length) { report(r); console.log(`\nNot exported: fix the errors in ${rel(file)} first.`); process.exitCode = 1; continue; }
    const json = {};
    for (const f of FIELDS) {
      const v = r.fields[f.h];
      if (!v || !r.stores.includes(f.store)) continue;
      json[f.key] = v;
      const out = path.join(base, f.fastlane.replace('{l}', r.locale));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, v + '\n');
      written.push(rel(out));
    }
    const jf = file.replace(/\.md$/, '.json');
    fs.writeFileSync(jf, JSON.stringify({ locale: r.locale, ...json }, null, 2) + '\n');
    written.push(rel(jf));
  }
  console.log(JSON.stringify({ metadata: rel(base), note: 'Same layout as fastlane/metadata/ (deliver + supply).', written }, null, 2));
}
