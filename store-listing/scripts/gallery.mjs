#!/usr/bin/env node
// Render every visual style with the project's own captures and copy, so the user can pick one.
//
//   node gallery.mjs [projectDir] [--styles a,b,...] [--feature-styles x,y] [--slides 3]
//                    [--target play-phone]
//
// Writes store-assets/design/_gallery.html and _gallery-feature.html (skipped by normal renders),
// renders them into store-assets/out/_gallery/, and composes the overview sheets:
//   out/_gallery/styles-1.png, styles-2.png, ...   one row per style (first N slides)
//   out/_gallery/features.png                      every feature-graphic style
// Copy and captures come from store-assets/brief.json (see `scaffold.mjs --init`).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { loadBrief, syncKit, copyAsset } from './lib/brief.mjs';
import { STYLES, FEATURE_STYLES, DEFAULT_GALLERY, screenSections, featureSection, documentHtml, esc } from './lib/styles.mjs';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const projectDir = path.resolve(positional[0] || '.');

const b = loadBrief(projectDir);
const design = path.join(b.work, 'design');
const out = path.join(b.work, 'out', '_gallery');
const styles = flag('styles') ? flag('styles').split(',') : DEFAULT_GALLERY[b.isGame ? 'game' : 'app'];
const featureStyles = flag('feature-styles') ? flag('feature-styles').split(',') : Object.keys(FEATURE_STYLES);
const nSlides = Number(flag('slides', 3));
const target = flag('target', 'play-phone');
for (const s of styles) if (!STYLES[s]) throw new Error(`Unknown style "${s}". Known: ${Object.keys(STYLES).join(', ')}`);

syncKit(design);
const icon = copyAsset(b, design, b.icon, 'icon') || copyAsset(b, design, b.logo, 'logo');
const slides = b.slides.slice(0, nSlides);
if (b.slides.some((s) => /^TODO/.test(s.headline || ''))) console.error('[gallery] note: the brief still has TODO headlines; write real ones in brief.json for a fair comparison.');

fs.writeFileSync(path.join(design, '_gallery.html'), documentHtml(b, {
  title: `${b.name} · style gallery`, targets: [target], styles,
  body: styles.map((st) => screenSections(b, st, { slides, prefix: `${st}--`, icon })).join('\n\n'),
}));
fs.writeFileSync(path.join(design, '_gallery-feature.html'), documentHtml(b, {
  title: `${b.name} · feature graphic gallery`, targets: ['play-feature'], styles: [],
  body: featureStyles.map((st) => featureSection(b, st, { prefix: `${st}--`, icon })).join('\n\n'),
}));

fs.rmSync(out, { recursive: true, force: true });
const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'render.mjs'), design, '--files', '_gallery.html,_gallery-feature.html', '--out', out], { encoding: 'utf8' });
const warnings = (r.stdout.split('Layout warnings')[1] || '').split('\n').filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2));
if (r.status !== 0 && !fs.existsSync(out)) { console.error(r.stdout, r.stderr); process.exit(1); }

// ---------------------------------------------------------------- overview sheets
const T = { 'play-phone': 'google-play/phone', 'appstore-iphone-6.9': 'app-store/iphone-6.9', 'appstore-iphone-6.3': 'app-store/iphone-6.3', 'play-tablet': 'google-play/tablet', 'appstore-ipad-13': 'app-store/ipad-13' }[target] || target;
const shotDir = path.join(out, T);
const files = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort() : [];
const featDir = path.join(out, 'google-play');
const feats = fs.existsSync(featDir) ? fs.readdirSync(featDir).filter((f) => f.startsWith('feature-graphic')).sort() : [];
const uri = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;

const browser = await chromium.launch();
const sheets = [];
const sheet = async (file, html, width) => {
  const page = await browser.newPage({ viewport: { width, height: 400 } });
  await page.setContent(`<html><body style="margin:0;padding:28px 32px;background:#18181b;color:#e4e4e7;font:15px/1.4 system-ui">${html}</body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  sheets.push(path.relative(process.cwd(), file));
};
const ROWS = 4;
const thumbH = 470;
for (let k = 0; k < styles.length; k += ROWS) {
  const rows = styles.slice(k, k + ROWS).map((st) => {
    const imgs = files.filter((f) => f.slice(3).startsWith(`${st}--`));
    return `<div style="display:flex;gap:18px;align-items:flex-start;margin-bottom:26px">
      <div style="width:230px;flex:none;padding-top:6px"><div style="font-size:21px;font-weight:700;color:#fff">${esc(STYLES[st].label)}</div>
      <div style="margin-top:4px;color:#a1a1aa;font-family:ui-monospace,monospace;font-size:13px">${st}</div>
      <div style="margin-top:10px;color:#c4c4cc">${esc(STYLES[st].bestFor)}</div></div>
      ${imgs.map((f) => `<img src="${uri(path.join(shotDir, f))}" style="height:${thumbH}px;border-radius:12px">`).join('')}
    </div>`;
  }).join('');
  await sheet(path.join(out, `styles-${k / ROWS + 1}.png`), rows, 290 + nSlides * (Math.round(thumbH * 9 / 16) + 20) + 60);
}
if (feats.length) {
  const cells = featureStyles.map((st) => {
    const f = feats.find((x) => x.includes(`-${st}--`));
    return f ? `<figure style="margin:0"><img src="${uri(path.join(featDir, f))}" style="width:620px;border-radius:8px;display:block"><figcaption style="margin-top:8px"><b style="color:#fff">${esc(FEATURE_STYLES[st].label)}</b> <span style="color:#a1a1aa;font-family:ui-monospace,monospace;font-size:13px">${st}</span><br><span style="color:#c4c4cc">${esc(FEATURE_STYLES[st].bestFor)}</span></figcaption></figure>` : '';
  }).join('');
  await sheet(path.join(out, 'features.png'), `<div style="display:grid;grid-template-columns:repeat(2,620px);gap:28px 24px">${cells}</div>`, 1340);
}
await browser.close();

console.log(JSON.stringify({ target, styles, featureStyles, sheets, warnings: warnings.slice(0, 20), next: 'Show the sheets to the user, agree on a style, then: scaffold.mjs --style <id> --feature-style <id>' }, null, 2));
