#!/usr/bin/env node
// Render the store-listing designs (HTML + kit) to exact-size images and check them against the
// store specs.
//
//   node render.mjs [store-assets/design] [--targets play-phone,appstore-iphone-6.9] [--only hero,plan]
//                   [--files screenshots.html] [--out store-assets/out] [--jpeg]
//   node render.mjs serve [store-assets/design] [--port 4600]     live preview boards in a browser
//   node render.mjs icon <icon.svg|png> [--bg "#ffffff"] [--inset 0.1] [--out store-assets/out]
//   node render.mjs check [store-assets/out]                       re-check an output folder
//   node render.mjs targets                                        list every target and its size
//
// Every *.html in the design folder (except _*.html) is rendered for the targets in its
// <meta name="store-targets"> (or --targets). Output: out/<store>/<slot>/NN-<slide>.png,
// out/google-play/feature-graphic.png, contact sheets in out/_preview/ and out/report.json.
// A file with <meta name="store-locale" content="de-DE"> renders into out/de-DE/... instead.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_JS = path.join(SKILL_DIR, 'kit', 'kit.js');

const argv = process.argv.slice(2);
const COMMANDS = ['serve', 'icon', 'check', 'targets'];
const cmd = COMMANDS.includes(argv[0]) ? argv.shift() : 'render';
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const has = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const log = (...a) => console.error('[render]', ...a);
const rel = (p) => path.relative(process.cwd(), p) || '.';

// The target registry lives in kit.js (single source for the browser and for this script).
function loadTargets() {
  const window = {};
  const document = { querySelector: () => null, querySelectorAll: () => [], documentElement: {} };
  vm.runInNewContext(fs.readFileSync(KIT_JS, 'utf8'), { window, document, location: { search: '?kit=meta' }, URLSearchParams, console });
  return window.__kit.targets;
}
const TARGETS = loadTargets();

// ------------------------------------------------------------------ static server
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
// mounts: { '/': dir, '/__out/': dir2 }
function serve(mounts, port = 0) {
  const entries = Object.entries(mounts).sort((a, b) => b[0].length - a[0].length);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const [prefix, dir] = entries.find(([m]) => p.startsWith(m)) || [];
    if (!dir) { res.writeHead(404).end(); return; }
    let file = path.join(dir, p.slice(prefix.length));
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ------------------------------------------------------------------ image checks
function imageInfo(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20), alpha: b[25] === 4 || b[25] === 6, bytes: b.length };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length && b[i] === 0xff) {
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7), alpha: false, bytes: b.length };
      i += 2 + len;
    }
    return { type: 'jpeg', width: 0, height: 0, alpha: false, bytes: b.length };
  }
  return { type: 'unknown', width: 0, height: 0, alpha: false, bytes: b.length };
}

const isImage = (f) => /\.(png|jpe?g)$/i.test(f);
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;

// Check one slot (a target's files) against its store rules. Returns problems (strings).
function checkSlot(T, files) {
  const problems = [];
  if (T.min && files.length < T.min) problems.push(`${files.length} image(s); this slot needs at least ${T.min}`);
  if (T.max && files.length > T.max) problems.push(`${files.length} images; this slot takes at most ${T.max} (the extras won't upload)`);
  for (const f of files) {
    const i = imageInfo(f);
    const n = path.basename(f);
    if (i.width !== T.w || i.height !== T.h) problems.push(`${n} is ${i.width}x${i.height}, expected ${T.w}x${T.h}`);
    if (T.noAlpha && i.alpha) problems.push(`${n} has an alpha channel; the store wants flattened RGB`);
    if (T.maxBytes && i.bytes > T.maxBytes) problems.push(`${n} is ${mb(i.bytes)}, over the ${mb(T.maxBytes)} limit (try --jpeg)`);
  }
  return problems;
}

function slotFiles(out, T) {
  if (T.file) {
    const dir = path.join(out, path.dirname(T.file));
    const base = path.basename(T.file);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(base) && isImage(f)).sort().map((f) => path.join(dir, f)) : [];
  }
  const dir = path.join(out, T.folder);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(isImage).sort().map((f) => path.join(dir, f)) : [];
}

const ICONS = [
  { id: 'appstore-icon', file: 'app-store/icon-1024.png', size: 1024, noAlpha: true, note: 'App Store icon: 1024x1024, no alpha, square corners (iOS rounds them).' },
  { id: 'play-icon', file: 'google-play/icon-512.png', size: 512, maxBytes: 1024 * 1024, note: 'Google Play icon: 512x512, 32-bit PNG, max 1024 KB (Play applies the rounded mask).' },
];

const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})*$/;
const localeDirs = (out) => (fs.existsSync(out) ? fs.readdirSync(out, { withFileTypes: true }) : [])
  .filter((e) => e.isDirectory() && LOCALE_RE.test(e.name)).map((e) => e.name);

function checkAll(out) {
  const slots = [];
  for (const loc of [null, ...localeDirs(out)]) {
    const base = loc ? path.join(out, loc) : out;
    for (const [id, T] of Object.entries(TARGETS)) {
      const files = slotFiles(base, T);
      if (!files.length) continue;
      slots.push({ id: loc ? `${loc}/${id}` : id, locale: loc, label: T.label, size: `${T.w}x${T.h}`, folder: rel(T.file ? path.join(base, path.dirname(T.file)) : path.join(base, T.folder)), count: files.length, files: files.map(rel), problems: checkSlot(T, files) });
    }
  }
  for (const ic of ICONS) {
    const f = path.join(out, ic.file);
    if (!fs.existsSync(f)) continue;
    const i = imageInfo(f);
    const problems = [];
    if (i.width !== ic.size || i.height !== ic.size) problems.push(`${ic.file} is ${i.width}x${i.height}, expected ${ic.size}x${ic.size}`);
    if (ic.noAlpha && i.alpha) problems.push(`${ic.file} has an alpha channel`);
    if (ic.maxBytes && i.bytes > ic.maxBytes) problems.push(`${ic.file} is ${mb(i.bytes)}, over ${mb(ic.maxBytes)}`);
    slots.push({ id: ic.id, label: ic.note, size: `${ic.size}x${ic.size}`, folder: rel(path.dirname(f)), count: 1, files: [rel(f)], problems });
  }
  return slots;
}

function printSlots(slots) {
  if (!slots.length) { console.log('No store images found.'); return; }
  const w = Math.max(...slots.map((s) => s.folder.length));
  for (const s of slots) {
    console.log(`${s.problems.length ? 'FIX ' : 'ok  '} ${s.folder.padEnd(w)}  ${String(s.count).padStart(2)} × ${s.size}`);
    for (const p of s.problems) console.log(`       ↳ ${p}`);
  }
}

// ------------------------------------------------------------------ contact sheets
async function contactSheet(browser, base, out, id, T, files) {
  const portrait = T.h > T.w;
  const ih = portrait ? 560 : Math.round(380 * (T.h / T.w) * (T.w / T.h > 2 ? 1.2 : 1));
  const iw = Math.round((ih * T.w) / T.h);
  const cols = Math.max(1, Math.min(files.length, portrait ? 8 : 3));
  const width = cols * (iw + 20) + 60;
  const page = await browser.newPage({ viewport: { width, height: 400 } });
  const imgs = files.map((f) => `<figure><img src="${base}/__out/${path.relative(out, f).split(path.sep).join('/')}" style="width:${iw}px;height:${ih}px"><figcaption>${path.basename(f)}</figcaption></figure>`).join('');
  await page.setContent(`<html><body style="margin:0;padding:24px 30px;background:#1b1b1f;color:#ddd;font:14px system-ui">
    <div style="margin-bottom:14px"><b>${T.label}</b> · ${T.w}×${T.h} · ${files.length} image${files.length === 1 ? '' : 's'}</div>
    <div style="display:flex;flex-wrap:wrap;gap:20px">${imgs}</div>
    <style>figure{margin:0}img{display:block;border-radius:${portrait ? 12 : 6}px;background:#000}figcaption{margin-top:6px;color:#999;font-size:12px}</style></body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const file = path.join(out, '_preview', `${id}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  return file;
}

// ------------------------------------------------------------------ render
async function render() {
  const design = path.resolve(positional[0] || 'store-assets/design');
  if (!fs.existsSync(design)) throw new Error(`No design folder at ${rel(design)}. Run scaffold.mjs first.`);
  const rootDir = path.dirname(design);
  const out = path.resolve(flag('out') || path.join(rootDir, 'out'));
  const files = flag('files') ? flag('files').split(',') : fs.readdirSync(design).filter((f) => f.endsWith('.html') && !f.startsWith('_')).sort();
  const only = flag('only') ? new Set(flag('only').split(',')) : null;
  const flagTargets = flag('targets') ? flag('targets').split(',') : null;
  const jpeg = has('jpeg');
  for (const t of flagTargets || []) if (!TARGETS[t]) throw new Error(`Unknown target "${t}". Known: ${Object.keys(TARGETS).join(', ')}`);

  const { server, base } = await serve({ '/': rootDir, '/__out/': out });
  const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  const allWarnings = new Map(); // message -> Set(target)
  const rendered = new Map(); // target -> files
  const errors = [];

  try {
    for (const file of files) {
      const url = `${base}/${path.relative(rootDir, path.join(design, file)).split(path.sep).join('/')}`;
      const mp = await browser.newPage();
      const pageErrs = [];
      mp.on('pageerror', (e) => pageErrs.push(e.message));
      await mp.goto(`${url}?kit=meta`, { waitUntil: 'load' });
      const meta = await mp.evaluate(() => {
        const k = window.__kit;
        if (!k) return null;
        return { fileTargets: k.fileTargets, locale: k.locale, slidesFor: Object.fromEntries(Object.keys(k.targets).map((t) => [t, k.slidesFor(t)])) };
      });
      await mp.close();
      if (!meta) { errors.push(`${file}: kit.js did not load (is <script src="kit/kit.js"> in the page?) ${pageErrs.join('; ')}`); continue; }

      let targets = meta.fileTargets.length ? meta.fileTargets : ['appstore-iphone-6.9', 'appstore-iphone-6.3', 'play-phone'];
      const featureFile = targets.every((t) => TARGETS[t]?.kind === 'feature');
      if (flagTargets) targets = flagTargets.filter((t) => (TARGETS[t].kind === 'feature') === featureFile);
      for (const t of targets) if (!TARGETS[t]) errors.push(`${file}: unknown target "${t}" in store-targets`);
      targets = targets.filter((t) => TARGETS[t]);

      const outBase = meta.locale ? path.join(out, meta.locale) : out;
      for (const t of targets) {
        const T = TARGETS[t];
        const names = meta.slidesFor[t];
        const todo = names.filter((n) => !only || only.has(n));
        if (!todo.length) continue;
        const key = meta.locale ? `${meta.locale}/${t}` : t;
        const dir = T.file ? path.join(outBase, path.dirname(T.file)) : path.join(outBase, T.folder);
        fs.mkdirSync(dir, { recursive: true });
        if (!only && !rendered.has(key)) for (const f of slotFiles(outBase, T)) fs.rmSync(f); // no stale images from earlier runs
        log(`${key} (${T.w}x${T.h}) ← ${file}: ${todo.length} image${todo.length === 1 ? '' : 's'}`);

        const ctx = await browser.newContext({ viewport: { width: T.w, height: T.h }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${file} [${t}]: ${e.message}`));
        for (const name of todo) {
          await page.goto(`${url}?target=${encodeURIComponent(t)}&slide=${encodeURIComponent(name)}`, { waitUntil: 'load' });
          await page.evaluate(() => window.__kit?.ready);
          const warns = await page.evaluate(() => window.__kit?.warnings || []);
          for (const w of warns) { if (!allWarnings.has(w)) allWarnings.set(w, new Set()); allWarnings.get(w).add(t); }
          const ext = jpeg ? 'jpg' : 'png';
          const idx = String(names.indexOf(name) + 1).padStart(2, '0');
          const outName = T.file
            ? `${path.basename(T.file)}${names.length > 1 ? `-${name}` : ''}.${ext}`
            : `${idx}-${name}.${ext}`;
          const outFile = path.join(dir, outName);
          await page.screenshot({ path: outFile, type: jpeg ? 'jpeg' : 'png', ...(jpeg ? { quality: 92 } : {}) });
        }
        await ctx.close();
        rendered.set(key, { T, files: slotFiles(outBase, T) });
      }
    }

    const previews = [];
    for (const [key, r] of rendered) if (r.files.length) previews.push(rel(await contactSheet(browser, base, out, key.replace('/', '_'), r.T, r.files)));

    const slots = checkAll(out).filter((s) => rendered.has(s.id) || !only);
    const warnings = [...allWarnings].map(([m, ts]) => `${m}  [${[...ts].join(', ')}]`);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), slots, warnings, errors, previews }, null, 2));

    console.log('');
    printSlots(slots);
    if (warnings.length) { console.log('\nLayout warnings (fix in the design, then re-render):'); for (const w of warnings) console.log(`  - ${w}`); }
    if (errors.length) { console.log('\nErrors:'); for (const e of [...new Set(errors)]) console.log(`  - ${e}`); }
    if (previews.length) { console.log('\nContact sheets (look at these):'); for (const p of previews) console.log(`  ${p}`); }
    if (errors.length || slots.some((s) => s.problems.length)) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

// ------------------------------------------------------------------ serve
async function serveCmd() {
  const design = path.resolve(positional[0] || 'store-assets/design');
  const rootDir = path.dirname(design);
  const { base } = await serve({ '/': rootDir }, Number(flag('port', 4600)));
  const files = fs.readdirSync(design).filter((f) => f.endsWith('.html') && !f.startsWith('_')).sort();
  console.log(JSON.stringify({ serving: rel(rootDir), boards: files.map((f) => `${base}/${path.basename(design)}/${f}`) }, null, 2));
  console.error('[render] preview server running; stop it with Ctrl+C (or kill the process).');
}

// ------------------------------------------------------------------ icon
async function iconCmd() {
  const src = positional[0];
  if (!src || !fs.existsSync(src)) throw new Error('usage: render.mjs icon <icon.svg|png> [--bg "#fff"] [--inset 0.1] [--out store-assets/out]');
  const out = path.resolve(flag('out') || 'store-assets/out');
  const bg = flag('bg', '#ffffff');
  const inset = Number(flag('inset', 0));
  const ext = path.extname(src).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const data = `data:${mime};base64,${fs.readFileSync(src).toString('base64')}`;
  const browser = await chromium.launch();
  try {
    for (const ic of ICONS) {
      const page = await browser.newPage({ viewport: { width: ic.size, height: ic.size } });
      const pad = Math.round(ic.size * inset);
      await page.setContent(`<html><body style="margin:0;background:${bg}"><img src="${data}" style="position:absolute;left:${pad}px;top:${pad}px;width:${ic.size - 2 * pad}px;height:${ic.size - 2 * pad}px;object-fit:contain"></body></html>`);
      await page.waitForFunction(() => document.images[0]?.complete);
      const file = path.join(out, ic.file);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file });
      await page.close();
    }
  } finally { await browser.close(); }
  printSlots(checkAll(out).filter((s) => s.id.endsWith('icon')));
  for (const ic of ICONS) console.log(`  ${ic.note}`);
}

// ------------------------------------------------------------------ main
if (cmd === 'render') await render();
else if (cmd === 'serve') await serveCmd();
else if (cmd === 'icon') await iconCmd();
else if (cmd === 'check') {
  const slots = checkAll(path.resolve(positional[0] || 'store-assets/out'));
  printSlots(slots);
  if (slots.some((s) => s.problems.length)) process.exitCode = 1;
} else if (cmd === 'targets') {
  for (const [id, T] of Object.entries(TARGETS)) console.log(`${id.padEnd(32)} ${`${T.w}x${T.h}`.padEnd(10)} ${T.label}`);
}
