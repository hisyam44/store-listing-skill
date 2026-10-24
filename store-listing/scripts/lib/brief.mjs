// The brief: store-assets/brief.json holds the decisions behind the images (name, tagline,
// colours, font, style, and one entry per screenshot with its capture and headline). It is
// merged over defaults detected from the project and the captures manifest.
//
// {
//   "name": "Plateful", "tagline": "Recipes, plans and groceries. One app.",
//   "accent": "#ff5a36", "accent2": "#ffc55c", "font": "Plus Jakarta Sans", "icon": "icon.svg",
//   "style": "bold-gradient", "featureStyle": "brand-fan", "featureArt": "feature-art",
//   "targets": ["appstore-iphone-6.9", "appstore-iphone-6.3", "play-phone"],
//   "slides": [
//     { "shot": "today", "headline": "Plateful", "sub": "Recipes, plans and groceries. One app.", "sticker": "Save, plan, cook" },
//     { "shot": "recipes", "headline": "Every recipe,", "accent": "one place", "chips": ["🥞 Breakfast", "🥗 Vegan"] },
//     { "shot": "plan", "headline": "Plan your week", "accent": "in minutes", "stat": { "value": "1,160", "label": "kcal planned today" } }
//   ]
// }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- colours
export const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || '');
export const hex6 = (c) => (c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c).toLowerCase();
export function toHsl(hex) {
  const n = parseInt(hex6(hex).slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}
export function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
export function luminance(hex) {
  const n = parseInt(hex6(hex).slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
// White or near-black text, whichever reads better on this background.
export const inkOn = (hex) => (luminance(hex) > 0.42 ? '#17151f' : '#ffffff');

// ---------------------------------------------------------------- project defaults
export function detect(projectDir) {
  return JSON.parse(execFileSync(process.execPath, [path.join(SCRIPTS, 'detect_project.mjs'), projectDir], { encoding: 'utf8' }));
}

// captures/manifest.json from capture.mjs. Without one (your own screenshots dropped into
// captures/<device>/*.png), build an equivalent list from the folders.
export function readManifest(work) {
  const dir = path.join(work, 'captures');
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch {}
  if (!fs.existsSync(dir)) return null;
  const captures = [];
  for (const dev of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'))) {
    for (const f of fs.readdirSync(path.join(dir, dev.name)).filter((f) => /\.png$/i.test(f) && !/\.error\.png$/.test(f)).sort()) {
      captures.push({ name: f.replace(/\.png$/i, ''), type: 'screenshot', device: dev.name, file: `${dev.name}/${f}` });
    }
  }
  return captures.length ? { captures, devices: {}, synthetic: true } : null;
}

// Capture names in manifest order, from the main phone device. Burst frames (name-01) are
// skipped when their base still exists; feature art (desktop) is listed separately.
export function captureNames(manifest) {
  const stills = (manifest?.captures || []).filter((c) => c.type === 'screenshot' && c.name !== 'probe');
  const devices = [...new Set(stills.map((c) => c.device))];
  const main = ['phone', 'phone-android'].find((d) => devices.includes(d)) || devices[0];
  const names = [...new Set(stills.filter((c) => c.device === main).map((c) => c.name))]
    .filter((n, _, all) => !/-\d\d$/.test(n) || !all.includes(n.replace(/-\d\d$/, '')));
  const art = [...new Set(stills.filter((c) => c.device === 'desktop').map((c) => c.name))];
  return { devices, main, names, art, hasTablet: devices.some((d) => /tablet/.test(d)) };
}

export function loadBrief(projectDir, overrides = {}) {
  const work = path.join(projectDir, 'store-assets');
  let file = {};
  const briefPath = path.join(work, 'brief.json');
  if (fs.existsSync(briefPath)) file = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  const d = detect(projectDir);
  const manifest = readManifest(work);
  const caps = captureNames(manifest);
  const brand = d.brand || {};
  const native = d.mobile?.native || {};
  const css = brand.cssColors || {};
  const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== '');

  const accentCandidates = [overrides.accent, file.accent, css.primary, css.brand, css.accent, brand.themeColor].filter(isHex).map(hex6);
  const accent = accentCandidates.find((c) => { const l = toHsl(c)[2]; return l > 0.18 && l < 0.82; }) || '#ff5a3c';
  const accent2 = [overrides.accent2, file.accent2].filter(isHex).map(hex6)[0]
    || (() => { const [h, s, l] = toHsl(accent); return fromHsl(h + 18, Math.min(1, s * 1.05), Math.min(0.7, l + 0.12)); })();

  const name = pick(overrides.name, file.name, native.appName, d.title, d.readme?.heading, d.name, 'Your App');
  const tagline = pick(overrides.tagline, file.tagline, d.description, 'TODO: one-line promise');
  const font = pick(overrides.font, file.font, (brand.fonts || []).find((f) => !/icon|awesome|material symbols/i.test(f)), null);
  const icon = pick(overrides.icon, file.icon, (native.iconCandidates || []).find((p) => /\.(png|svg|webp|jpe?g)$/i.test(p)), null);
  const logo = pick(file.logo, (brand.logoCandidates || []).find((p) => /\.(svg|png|webp)$/i.test(p)), null);
  const isGame = d.kind === 'game';

  const shotNames = caps.names.length ? caps.names : ['screen-1', 'screen-2', 'screen-3', 'screen-4', 'screen-5'];
  const slides = (file.slides?.length ? file.slides : shotNames.slice(0, 8).map((n, i) => (i === 0
    ? { shot: n, headline: name, sub: tagline }
    : { shot: n, headline: 'TODO headline', accent: `for ${n}` })))
    .map((s) => ({ chips: [], ...s }));

  let targets = overrides.targets || file.targets;
  if (!targets) {
    targets = ['appstore-iphone-6.9', 'appstore-iphone-6.3', 'play-phone'];
    if (caps.hasTablet || native.iosSupportsIpad) targets.push('appstore-ipad-13');
    if (caps.hasTablet) targets.push('play-tablet');
  }
  if (typeof targets === 'string') targets = targets.split(/[\s,]+/).filter(Boolean);

  return {
    projectDir, work, briefPath, fromFile: fs.existsSync(briefPath), detected: d, manifest, caps,
    name, tagline, accent, accent2, font, icon, logo, isGame, targets, slides,
    style: pick(overrides.style, file.style, isGame ? 'game-cinematic' : 'bold-gradient'),
    featureStyle: pick(overrides.featureStyle, file.featureStyle, isGame ? 'art-title' : 'brand-fan'),
    featureArt: pick(overrides.featureArt, file.featureArt, caps.art[0], null),
    locale: pick(overrides.locale, file.locale, null),
  };
}

// The starter brief written by `scaffold.mjs --init`, for Claude to fill in.
export function starterBrief(b) {
  return {
    name: b.name, tagline: b.tagline, accent: b.accent, accent2: b.accent2, font: b.font, icon: b.icon,
    style: b.style, featureStyle: b.featureStyle, featureArt: b.featureArt, targets: b.targets,
    slides: b.slides,
  };
}

// Copy the kit into the design folder (always refreshed; projects shouldn't edit it).
export function syncKit(design) {
  const kit = path.join(SCRIPTS, '..', 'kit');
  fs.mkdirSync(path.join(design, 'assets'), { recursive: true });
  fs.cpSync(kit, path.join(design, 'kit'), { recursive: true });
}

// Copy the project's icon / logo into design/assets and return the relative path.
export function copyAsset(b, design, rel, as) {
  if (!rel) return null;
  const src = path.isAbsolute(rel) ? rel : path.join(b.projectDir, rel);
  if (!fs.existsSync(src)) return null;
  const dest = path.join(design, 'assets', as + path.extname(src).toLowerCase());
  fs.copyFileSync(src, dest);
  return `assets/${path.basename(dest)}`;
}
