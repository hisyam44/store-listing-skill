#!/usr/bin/env node
// Write the brief, or the design files in a chosen style.
//
//   node scaffold.mjs [projectDir] --init [--force]
//       write store-assets/brief.json from what the project and captures say (name, tagline,
//       colours, font, icon, one slide per capture with TODO headlines). Edit it, then:
//   node scaffold.mjs [projectDir] [--style bold-gradient] [--feature-style brand-fan] [--force]
//                     [--name ..] [--tagline ..] [--accent "#hex"] [--accent2 "#hex"] [--font ".."]
//                     [--targets "appstore-iphone-6.9 play-phone ..."]
//       write store-assets/design/: kit/ (always refreshed), assets/ (icon), screenshots.html
//       and feature.html in that style (existing files are kept unless --force).
//
// Values come from store-assets/brief.json when it exists, then the flags, then detection.
// `node scaffold.mjs --styles` lists the styles; gallery.mjs renders them all for comparison.

import fs from 'node:fs';
import path from 'node:path';
import { loadBrief, starterBrief, syncKit, copyAsset } from './lib/brief.mjs';
import { STYLES, FEATURE_STYLES, screenSections, featureSection, documentHtml } from './lib/styles.mjs';

const argv = process.argv.slice(2);
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const has = (name) => argv.includes(`--${name}`);
const BOOL = new Set(['--init', '--force', '--styles']);
const positional = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--') || BOOL.has(argv[i - 1])));

if (has('styles')) {
  for (const [id, s] of Object.entries(STYLES)) console.log(`${id.padEnd(16)} ${s.kind.padEnd(5)} ${s.bestFor}`);
  console.log('\nfeature graphic:');
  for (const [id, s] of Object.entries(FEATURE_STYLES)) console.log(`${id.padEnd(16)} ${s.bestFor}`);
  process.exit(0);
}

const projectDir = path.resolve(positional[0] || '.');
const overrides = {
  name: flag('name'), tagline: flag('tagline'), accent: flag('accent'), accent2: flag('accent2'), font: flag('font'),
  style: flag('style'), featureStyle: flag('feature-style'), targets: flag('targets'),
};
const b = loadBrief(projectDir, overrides);
const design = path.join(b.work, 'design');

if (has('init')) {
  fs.mkdirSync(b.work, { recursive: true });
  if (fs.existsSync(b.briefPath) && !has('force')) {
    console.log(JSON.stringify({ brief: path.relative(projectDir, b.briefPath), written: false, note: 'brief.json exists; edit it or pass --force to regenerate' }, null, 2));
  } else {
    fs.writeFileSync(b.briefPath, JSON.stringify(starterBrief(b), null, 2) + '\n');
    console.log(JSON.stringify({ brief: path.relative(projectDir, b.briefPath), written: true, captures: b.caps, ...starterBrief(b) }, null, 2));
  }
  process.exit(0);
}

if (!STYLES[b.style]) throw new Error(`Unknown style "${b.style}". Run with --styles to list them.`);
if (!FEATURE_STYLES[b.featureStyle]) throw new Error(`Unknown feature style "${b.featureStyle}". Run with --styles to list them.`);

syncKit(design);
const icon = copyAsset(b, design, b.icon, 'icon') || copyAsset(b, design, b.logo, 'logo');

const written = [];
const write = (file, content) => {
  const p = path.join(design, file);
  if (fs.existsSync(p) && !has('force')) return;
  fs.writeFileSync(p, content);
  written.push(path.relative(projectDir, p));
};

write('screenshots.html', documentHtml(b, {
  title: `${b.name} · store screenshots (${b.style})`,
  targets: b.targets,
  styles: [b.style],
  comment: `<!-- Style: ${b.style}. Each slide = one store image; data-name is the file name. Edit freely:\n     references/design.md documents the kit, references/styles.md the styles. -->\n`,
  body: screenSections(b, b.style, { icon }),
}));
write('feature.html', documentHtml(b, {
  title: `${b.name} · feature graphic (${b.featureStyle})`,
  targets: ['play-feature'],
  styles: [b.style],
  comment: '<!-- Google Play feature graphic, 1024x500: keep text away from the edges, no device bezels, badges or claims. -->\n',
  body: featureSection(b, b.featureStyle, { icon }),
}));

console.log(JSON.stringify({
  design: path.relative(projectDir, design),
  written,
  kept: ['screenshots.html', 'feature.html'].filter((f) => !written.some((w) => w.endsWith(f))),
  brief: b.fromFile ? path.relative(projectDir, b.briefPath) : 'none (defaults from detection; run --init to write one)',
  style: b.style, featureStyle: b.featureStyle,
  name: b.name, tagline: b.tagline, accent: b.accent, accent2: b.accent2, font: b.font, icon,
  targets: b.targets, slides: b.slides.map((s) => `${s.shot}: ${s.headline}${s.accent ? ' / ' + s.accent : ''}`),
  next: 'Polish the HTML, then: node <skill>/scripts/render.mjs store-assets/design',
}, null, 2));
