// Visual styles for the store images: a registry (what each style suits) and HTML builders.
// scaffold.mjs writes one style into design/screenshots.html + feature.html; gallery.mjs
// writes every style side by side, with the real captures and copy, so the user can choose.
// The CSS lives in kit/styles.css, scoped per style (.s-<style>, .f-<style>).

import { inkOn, toHsl, fromHsl } from './brief.mjs';

export const STYLES = {
  'bold-gradient': { label: 'Bold gradient', kind: 'app', bestFor: 'lifestyle, food, habits, social, shopping', fonts: [], frames: { appstore: 'device', play: 'card' } },
  'clean-minimal': { label: 'Clean minimal', kind: 'app', bestFor: 'finance, productivity, utilities, health data, B2B', fonts: [], frames: { appstore: 'card', play: 'card' } },
  'dark-premium': { label: 'Dark premium', kind: 'app', bestFor: 'pro tools, AI, finance, fitness, music, photo and video', fonts: [], frames: { appstore: 'device', play: 'card' } },
  editorial: { label: 'Editorial', kind: 'app', bestFor: 'reading, journaling, recipes, travel, wellness, education', fonts: ['Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500'], frames: { appstore: 'card', play: 'card' } },
  'playful-pop': { label: 'Playful pop', kind: 'app', bestFor: 'kids, education, social, casual games, habits, pets', fonts: ['Fredoka:wght@500;600;700'], frames: { appstore: 'device', play: 'card' } },
  'neo-brutal': { label: 'Neo-brutal', kind: 'app', bestFor: 'productivity, dev and creator tools, Gen-Z social', fonts: ['Space Grotesk:wght@500;700'], frames: { appstore: 'card', play: 'card' } },
  'big-number': { label: 'Big number', kind: 'app', bestFor: 'finance, health, fitness, habits, analytics (needs real figures from the UI)', fonts: [], frames: { appstore: 'device', play: 'card' } },
  panoramic: { label: 'Panoramic', kind: 'app', bestFor: 'journeys and flows; stands out because few listings use it', fonts: [], frames: { appstore: 'device', play: 'card' } },
  'game-cinematic': { label: 'Game · cinematic', kind: 'game', bestFor: 'immersive games of any genre: full-bleed gameplay', fonts: ['Lilita One'], frames: { appstore: 'none', play: 'none' } },
  'game-banner': { label: 'Game · banner', kind: 'game', bestFor: 'casual, puzzle, idle, hyper-casual and kids\' games', fonts: ['Lilita One'], frames: { appstore: 'card', play: 'card' } },
};

export const FEATURE_STYLES = {
  'brand-fan': { label: 'Brand + screens', bestFor: 'apps: icon, name and tagline beside fanned screens' },
  'art-title': { label: 'Art + title', bestFor: 'games and visual apps: full-bleed art with the name' },
  collage: { label: 'Collage', bestFor: 'content apps: the name surrounded by pieces of the product' },
  'split-card': { label: 'Split card', bestFor: 'utilities: value proposition beside big screens' },
};

export const DEFAULT_GALLERY = {
  app: ['bold-gradient', 'clean-minimal', 'dark-premium', 'editorial', 'playful-pop', 'neo-brutal', 'big-number', 'panoramic'],
  game: ['game-cinematic', 'game-banner', 'playful-pop', 'dark-premium', 'bold-gradient', 'panoramic'],
};

// ---------------------------------------------------------------- helpers
export const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const h1 = (s, fit = 2) => `<h1 data-fit="${fit}">${esc(s.headline)}${s.accent ? `<br><span class="accent">${esc(s.accent)}</span>` : ''}</h1>`;
const sub = (s) => (s.sub ? `<p data-fit="2">${esc(s.sub)}</p>` : '');
const eyebrow = (t) => (t ? `<span class="eyebrow">${esc(t)}</span>` : '');
// Chips hang off the device's upper part, which stays visible on every aspect ratio.
const SPOTS = ['left: -6%; top: 24%;', 'right: -6%; top: 42%;', 'left: -5%; top: 58%;'];
const chips = (s, max = 3, cls = 'chip') => (s.chips || []).slice(0, max)
  .map((c, i) => `<span class="${cls}${i === 1 && cls === 'chip' ? ' solid' : ''}" style="${SPOTS[i]}">${esc(c)}</span>`).join('');
const device = (s, cls = 'bleed', inner = '', attrs = '') => `<div class="device${cls ? ' ' + cls : ''}" data-shot="${esc(s.shot)}"${s.zoom ? ` data-zoom="${s.zoom}"` : ''}${s.focus ? ` data-focus="${esc(s.focus)}"` : ''}${attrs}>${inner}</div>`;
const sticker = (s, pos = 'right: -5%; top: -3%;') => (s.sticker ? `<span class="sticker" style="${pos}">${esc(s.sticker)}</span>` : '');

// Bright per-slide colours for playful-pop: the brand colours, then hue steps around them.
function popPalette(b, n) {
  const [h, s] = toHsl(b.accent);
  const base = [b.accent, b.accent2, fromHsl(h + 150, Math.max(0.55, s), 0.58), fromHsl(h + 210, Math.max(0.5, s), 0.6), fromHsl(h + 60, Math.max(0.6, s), 0.62), fromHsl(h + 290, Math.max(0.45, s), 0.62)];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

// ---------------------------------------------------------------- screenshot styles
// Each builder returns the inside of a <section>, plus its extra classes / attributes.
const BUILD = {
  'bold-gradient': (s, i, c) => {
    if (i === 0) return { cls: 'hero', body: `<div class="caption">${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', sticker(s) + chips(s, 1))}</div>\n  <div class="dots" style="left: -8rem; top: 38%;"></div>` };
    const closer = i === c.n - 1 && c.n > 3;
    return { cls: closer ? 'hero layout-bottom' : '', body: `<div class="caption">${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, closer ? '' : 'bleed', chips(s, closer ? 1 : 3))}</div>` };
  },
  'clean-minimal': (s, i, c) => ({
    cls: i === 0 ? 'hero' : '',
    body: `<div class="caption">${i === 0 && c.icon ? `<img class="app-icon" src="${c.icon}" alt="">` : eyebrow(s.eyebrow)}${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, '', chips(s, 1))}</div>`,
  }),
  'dark-premium': (s, i) => ({
    cls: i === 0 ? 'hero' : '',
    body: `<div class="caption">${eyebrow(s.eyebrow)}${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', chips(s, 2))}</div>`,
  }),
  editorial: (s, i) => ({
    cls: i === 0 ? 'hero' : '',
    body: `<div class="caption">${eyebrow(`No. ${String(i + 1).padStart(2, '0')}${s.eyebrow ? ` · ${s.eyebrow}` : ''}`)}${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', chips(s, 1))}</div>`,
  }),
  'playful-pop': (s, i, c) => {
    const bg = c.palette[i];
    const ink = inkOn(bg);
    const muted = ink === '#ffffff' ? 'rgba(255,255,255,.92)' : 'rgba(23,21,31,.78)';
    return {
      cls: i === 0 ? 'hero' : '',
      style: `--bg: ${bg}; --ink: ${ink}; --muted: ${muted};`,
      body: `<i class="shape" style="width: 60rem; aspect-ratio: 1; left: -22rem; top: 46%;"></i><i class="shape" style="width: 34rem; aspect-ratio: 1; right: -10rem; top: 16%;"></i>\n  <div class="caption">${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, `bleed ${i % 2 ? 'tilt-right' : 'tilt-left'}`, (i === 0 ? sticker(s, 'right: -4%; top: 12%;') : '') + chips(s, 2))}</div>`,
    };
  },
  'neo-brutal': (s, i) => ({
    cls: i === 0 ? 'hero' : '',
    body: `<div class="caption">${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', (i === 0 ? sticker(s, 'right: -5%; top: 15%;') : '') + chips(s, 2))}</div>`,
  }),
  'big-number': (s, i) => ({
    cls: i === 0 ? 'hero' : '',
    body: `<div class="caption">${s.stat ? `<div class="stat"><b>${esc(s.stat.value)}</b><span>${esc(s.stat.label)}</span></div>` : h1(s) + sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', chips(s, 1))}</div>`,
  }),
  panoramic: (s, i, c) => ({
    cls: i === 0 ? 'hero' : '',
    attrs: ` data-pan="${c.panKey}"`,
    body: `<div class="caption">${h1(s)}${sub(s)}</div>\n  <div class="stage">${device(s, 'bleed', chips(s, 2))}</div>`,
  }),
  // Captions sit at the bottom by default: most games draw their HUD (score, coins) at the top.
  // "captionTop": true in the brief moves one up. A chip becomes a badge above the headline.
  'game-cinematic': (s) => {
    const badge = (s.chips || []).slice(0, 1).map((t) => `<span class="badge">${esc(t)}</span><br>`).join('');
    return {
      cls: `layout-full${s.captionTop ? '' : ' caption-bottom'}`,
      body: `<div class="stage"><img class="bg-shot" data-shot="${esc(s.shot)}"${s.focus ? ` data-focus="${esc(s.focus)}"` : ''} alt=""></div>\n  <div class="caption">${badge}${h1(s)}${sub(s)}</div>`,
    };
  },
  'game-banner': (s, i, c) => {
    const ribbon = i === 0 && s.headline === c.name ? { headline: s.sub || c.tagline } : s;
    return {
      cls: i === 0 ? 'hero' : '',
      body: `${i === 0 ? `<div class="game-logo">${esc(c.name)}</div>\n  ` : ''}<div class="stage">${device(s, '', '', ' data-frame="card" data-statusbar="off" data-allow-overlap')}</div>\n  <div class="caption ribbon">${h1(ribbon)}</div>`,
    };
  },
};

function panTemplate(key, n) {
  const orbs = Array.from({ length: n }, (_, k) => `<i class="orb" style="left: ${k * 100 + 68}vw; top: ${k % 2 ? 8 : 56}vh; width: 52vmin; height: 52vmin;"></i>`).join('');
  return `<div class="pan-bg p-panoramic" data-pan="${key}">
  <svg class="wave" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0 62 C 120 20, 260 96, 420 54 S 720 4, 860 46 S 980 70, 1000 52 L1000 100 L0 100 Z" fill="rgba(255,255,255,.16)"/><path d="M0 80 C 160 50, 330 104, 520 72 S 830 40, 1000 74 L1000 100 L0 100 Z" fill="rgba(255,255,255,.12)"/></svg>
  ${orbs}
</div>`;
}

const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'slide';

// The <section> elements for one style. opts.prefix namespaces slide names (gallery).
export function screenSections(b, style, { slides = b.slides, prefix = '', icon = null } = {}) {
  const S = STYLES[style];
  if (!S) throw new Error(`Unknown style "${style}". Styles: ${Object.keys(STYLES).join(', ')}`);
  const c = { name: b.name, tagline: b.tagline, icon, n: slides.length, palette: popPalette(b, slides.length), panKey: `${prefix}pan` };
  const used = new Set();
  const out = slides.map((s, i) => {
    let name = slug(s.name || (i === 0 ? 'hero' : s.shot));
    while (used.has(name)) name += '-2';
    used.add(name);
    const r = BUILD[style](s, i, c);
    return `<section class="slide s-${style}${r.cls ? ' ' + r.cls : ''}" data-name="${prefix}${name}" data-appstore-frame="${S.frames.appstore}" data-play-frame="${S.frames.play}"${r.attrs || ''}${r.style ? ` style="${r.style}"` : ''}>
  ${r.body}
</section>`;
  });
  if (style === 'panoramic') out.unshift(panTemplate(c.panKey, slides.length));
  return out.join('\n\n');
}

// ---------------------------------------------------------------- feature graphic styles
const SCATTER = [['-1%', '-14%', -12], ['5%', '54%', 9], ['80%', '-18%', 11], ['89%', '40%', -9]];

export function featureSection(b, style, { prefix = '', icon = null } = {}) {
  if (!FEATURE_STYLES[style]) throw new Error(`Unknown feature style "${style}". Styles: ${Object.keys(FEATURE_STYLES).join(', ')}`);
  const shots = b.slides.map((s) => s.shot);
  const card = (shot, attrs = '') => `<div class="device" data-frame="card" data-shot="${esc(shot)}"${attrs}></div>`;
  const mark = icon ? `<img class="app-icon" src="${icon}" alt="">` : '';
  const name = `<h1 data-fit="2">${esc(b.name)}</h1>`;
  const tag = `<p data-fit="2">${esc(b.tagline)}</p>`;
  const n = `${prefix}feature`;
  if (style === 'brand-fan') {
    return `<section class="slide feature f-brand-fan" data-name="${n}">
  <div class="brand">${mark}${name}${tag}</div>
  <div class="visual fan">${shots.slice(0, 3).map((x) => card(x)).join('')}</div>
  <div class="dots" style="right: -5rem; bottom: -8rem; --dots: rgba(255,255,255,.35)"></div>
</section>`;
  }
  if (style === 'art-title') {
    const art = b.featureArt ? `data-shot="${esc(b.featureArt)}" data-device="desktop"` : `data-shot="${esc(shots[0])}"`;
    return `<section class="slide feature f-art-title${b.featureArt ? '' : ' blur-art'}" data-name="${n}">
  <img class="bg-shot" ${art} data-focus="50% 60%" alt="">
  <div class="shade"></div>
  <div class="brand">${name}${tag}</div>
</section>`;
  }
  if (style === 'collage') {
    const cards = SCATTER.map(([l, t, r], k) => `<div class="device scatter" data-frame="card" data-shot="${esc(shots[k % shots.length])}" style="left: ${l}; top: ${t}; transform: rotate(${r}deg);"></div>`).join('');
    return `<section class="slide feature f-collage" data-name="${n}">
  ${cards}
  <div class="brand">${mark}${name}${tag}</div>
</section>`;
  }
  return `<section class="slide feature f-split-card" data-name="${n}">
  <div class="brand">${mark}${name}${tag}</div>
  <div class="visual">${shots.slice(0, 2).map((x) => card(x)).join('')}</div>
</section>`;
}

// ---------------------------------------------------------------- documents
// Google Fonts rejects a whole request if one family lacks a requested weight (e.g. Lilita One
// is 400 only), so the brand font gets its own link with weights plus a plain fallback link.
function fontLink(b, styles) {
  const css = (specs) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${specs.map((f) => { const [nm, ax] = f.split(':'); return `family=${nm.replace(/ /g, '+')}${ax ? ':' + ax : ''}`; }).join('&')}&display=block">`;
  const links = [];
  if (b.font) links.push(css([`${b.font}:wght@500;600;700;800`]), css([b.font]));
  const fams = [];
  for (const st of styles) for (const f of STYLES[st]?.fonts || []) if (!fams.includes(f) && f.split(':')[0] !== b.font) fams.push(f);
  if (fams.length) links.push(css(fams));
  if (!links.length) return '<!-- add a Google Fonts <link> here and put the family first in --font-display -->';
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n${links.join('\n')}`;
}

export function documentHtml(b, { title, targets, styles, body, locale = b.locale, comment = '' }) {
  const fontDisplay = `${b.font ? `"${b.font}", ` : ''}system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const lang = (locale || 'en').split('-')[0];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
${comment}<meta name="store-targets" content="${targets.join(' ')}">
${locale ? `<meta name="store-locale" content="${esc(locale)}">\n` : ''}${fontLink(b, styles)}
<link rel="stylesheet" href="kit/kit.css">
<link rel="stylesheet" href="kit/styles.css">
<style>
  :root {
    --accent: ${b.accent};
    --accent-2: ${b.accent2};
    --font-display: ${fontDisplay};
  }
  /* Your overrides go here: per-slide tweaks, per-target positions, e.g.
     html[data-form="tablet"] .callout.x { ... }   html[data-store="google-play"] .sticker { ... } */
</style>
</head>
<body>

${body}

<script src="kit/kit.js"></script>
</body>
</html>
`;
}
