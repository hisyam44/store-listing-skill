#!/usr/bin/env node
// Drive the running app with Playwright and capture the raw screenshots (and optional screen
// recordings) that the store listing designs are built from.
//
//   node capture.mjs --plan store-assets/shots.json [--out store-assets/captures] [--url http://localhost:5173]
//                    [--only shotA,shotB] [--devices phone,tablet] [--headed]
//                    [--recorder auto|screencast|screenshot|playwright]
//   node capture.mjs --probe / [--device phone|tablet|...] [--select ".card,.chart"] [--url http://localhost:5173]
//
// --probe <path>  opens one page, saves probe.png and prints the visible interactive elements
//                 with suggested selectors (use it to write the shot plan). Every element (and
//                 everything matched by --select) gets `crop`: its box as fractions of the
//                 capture, ready for the design kit's data-crop.
//
// Devices: plan.devices (list) / plan.device / shot.devices / shot.device = "phone" (default,
// iPhone Pro Max class), "phone-android", "tablet" (iPad 13" class), "tablet-android", "desktop",
// or any Playwright device name ("Pixel 7", "iPad Mini"). Every shot is taken once per device.
// Mobile devices get touch input and a mobile user agent and are captured at full resolution.
// Shots are stills ("type": "screenshot") unless "type": "video".
// The shot plan format and every action are documented in references/capture.md.
// Output: captures/<device>/<shot>.png|mp4 plus captures/manifest.json describing them.

import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const has = (name) => argv.includes(`--${name}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error('[capture]', ...a);

// ---------------------------------------------------------------- devices
// Phone/tablet presets use the app's *content* area: the status bar is drawn by the design kit's
// device frame, so the capture excludes it (unless fullscreen: true, for games).
// Full screens match the stores' largest sizes: phone 440x956 @3 = 1320x2868 (App Store 6.9"),
// tablet 1032x1376 @2 = 2064x2752 (App Store iPad 13").
const PRESETS = {
  desktop: { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, statusBar: 0 },
  phone: { base: 'iPhone 17 Pro Max', viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, statusBar: 62, style: 'ios' },
  'phone-android': { base: 'Pixel 9 Pro', viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, statusBar: 32, style: 'android' },
  tablet: { base: 'iPad Pro 11', viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, statusBar: 24, style: 'ios' },
  'tablet-android': { base: 'Galaxy Tab S9', viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, statusBar: 28, style: 'android' },
};

function resolveDevice(name = 'phone', { orientation, fullscreen, viewport, deviceScaleFactor } = {}) {
  let d;
  if (PRESETS[name]) {
    const p = PRESETS[name];
    const base = p.base ? devices[p.base] || devices['iPhone 15 Pro'] : null;
    d = {
      viewport: { ...p.viewport },
      deviceScaleFactor: p.deviceScaleFactor,
      isMobile: name !== 'desktop',
      hasTouch: name !== 'desktop',
      userAgent: base?.userAgent,
      statusBar: p.statusBar,
      style: p.style || null,
      kind: name.startsWith('phone') ? 'phone' : name.startsWith('tablet') ? 'tablet' : 'desktop',
    };
  } else if (devices[name]) {
    const b = devices[name];
    const isTablet = /ipad|tab/i.test(name);
    d = { viewport: { ...b.viewport }, deviceScaleFactor: b.deviceScaleFactor, isMobile: b.isMobile, hasTouch: b.hasTouch, userAgent: b.userAgent, statusBar: 0, style: /iphone|ipad/i.test(name) ? 'ios' : 'android', kind: b.isMobile ? (isTablet ? 'tablet' : 'phone') : 'desktop' };
  } else {
    throw new Error(`Unknown device "${name}". Use desktop, phone, phone-android, tablet, tablet-android or a Playwright device name.`);
  }
  if (viewport) d.viewport = { ...viewport };
  if (deviceScaleFactor) d.deviceScaleFactor = deviceScaleFactor;
  const landscape = orientation === 'landscape';
  if (landscape && d.viewport.height > d.viewport.width) d.viewport = { width: d.viewport.height, height: d.viewport.width };
  // Landscape phones hide the status bar; fullscreen apps/games draw under it.
  if (fullscreen || (landscape && d.kind === 'phone')) d.statusBar = 0;
  if (d.kind !== 'desktop' && !viewport && d.statusBar) d.viewport.height -= d.statusBar;
  d.orientation = d.viewport.width >= d.viewport.height ? 'landscape' : 'portrait';
  return d;
}

// ---------------------------------------------------------------- pointer overlay
// Headless browsers draw no pointer. Desktop: an arrow cursor with a click ripple.
// Touch devices: a translucent fingertip that appears on touch, follows swipes and fades out.
const POINTER_SCRIPT = (mode) => {
  if (window.top !== window || window.__promoPointer) return;
  window.__promoPointer = true;
  const install = () => {
    if (!document.documentElement || document.getElementById('__promo_cursor')) return;
    const c = document.createElement('div');
    c.id = '__promo_cursor';
    const s = c.style;
    s.position = 'fixed'; s.left = '0'; s.top = '0'; s.pointerEvents = 'none'; s.zIndex = '2147483647';
    const place = (x, y) => {
      if (mode === 'touch') s.transform = `translate(${x - 22}px,${y - 22}px) scale(${c.dataset.down ? 1 : 0.6})`;
      else s.transform = `translate(${x - 6}px,${y - 3}px)`;
    };
    let last = null; try { last = JSON.parse(sessionStorage.getItem('__promo_cursor_pos')); } catch {}
    const remember = (x, y) => { try { sessionStorage.setItem('__promo_cursor_pos', JSON.stringify({ x, y })); } catch {} };
    const ripple = (x, y) => {
      const r = document.createElement('div');
      r.dataset.promoRipple = '1';
      const rs = r.style;
      const size = mode === 'touch' ? 60 : 36;
      rs.position = 'fixed'; rs.left = `${x - size / 2}px`; rs.top = `${y - size / 2}px`;
      rs.width = `${size}px`; rs.height = `${size}px`; rs.borderRadius = '50%'; rs.pointerEvents = 'none';
      rs.zIndex = '2147483646'; rs.background = 'rgba(255,255,255,.35)'; rs.border = '2px solid rgba(0,0,0,.18)';
      rs.transition = 'transform .5s ease-out, opacity .5s ease-out'; rs.transform = 'scale(.4)';
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { rs.transform = 'scale(1.7)'; rs.opacity = '0'; });
      setTimeout(() => r.remove(), 650);
    };
    if (mode === 'touch') {
      s.width = '44px'; s.height = '44px'; s.borderRadius = '50%';
      s.background = 'rgba(255,255,255,.55)'; s.border = '2px solid rgba(0,0,0,.22)';
      s.boxShadow = '0 4px 14px rgba(0,0,0,.25)'; s.opacity = '0';
      s.transition = 'opacity .18s ease-out';
      document.documentElement.appendChild(c);
      const pt = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
      window.addEventListener('touchstart', (e) => { const p = pt(e); c.dataset.down = '1'; place(p.clientX, p.clientY); s.opacity = '1'; ripple(p.clientX, p.clientY); }, true);
      window.addEventListener('touchmove', (e) => { const p = pt(e); place(p.clientX, p.clientY); }, true);
      const up = () => { delete c.dataset.down; s.opacity = '0'; };
      window.addEventListener('touchend', up, true);
      window.addEventListener('touchcancel', up, true);
    } else {
      s.width = '30px'; s.height = '30px'; s.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,.35))';
      c.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><path d="M6 3.5 L6 23 L11.2 18.2 L14.8 26.2 L18.6 24.6 L15 16.8 L22.2 16.8 Z" fill="#111" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      if (last) place(last.x, last.y); else s.transform = 'translate(-100px,-100px)';
      document.documentElement.appendChild(c);
      window.addEventListener('mousemove', (e) => { place(e.clientX, e.clientY); remember(e.clientX, e.clientY); }, true);
      window.addEventListener('mousedown', (e) => { ripple(e.clientX, e.clientY); s.transform += ' scale(.88)'; }, true);
      window.addEventListener('mouseup', () => { s.transform = s.transform.replace(' scale(.88)', ''); }, true);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
};

// ---------------------------------------------------------------- helpers

function resolveUrl(base, p) {
  if (!p) return base;
  if (/^https?:\/\//.test(p)) return p;
  return new URL(p, base.endsWith('/') ? base : base + '/').toString();
}

async function goto(page, url, settleMs = 800) {
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); }
  catch { await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await sleep(settleMs);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Seeded RNG so "mash" gameplay is repeatable between takes.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

class Driver {
  constructor(page, cdp, device, opts) {
    this.page = page;
    this.cdp = cdp;
    this.device = device;
    this.touch = device.hasTouch;
    this.opts = opts;
    this.mouse = { x: device.viewport.width / 2, y: device.viewport.height / 2 };
  }

  // Resolve a target to viewport coordinates. Targets: {selector}, {x,y} in px,
  // {at:[fx,fy]} as fractions of the selector's box (or of the viewport).
  async point(a) {
    if (a.selector) {
      const loc = this.page.locator(a.selector).first();
      await loc.waitFor({ state: 'visible', timeout: a.timeout ?? 10000 });
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const box = await loc.boundingBox();
      if (!box) throw new Error(`No bounding box for ${a.selector}`);
      const [fx, fy] = a.at || [0.5, 0.5];
      return { x: box.x + box.width * fx, y: box.y + box.height * fy };
    }
    const vp = this.page.viewportSize();
    if (a.at) return { x: vp.width * a.at[0], y: vp.height * a.at[1] };
    if (a.x != null && a.y != null) return { x: a.x, y: a.y };
    throw new Error(`Action needs selector, at, or x/y: ${JSON.stringify(a)}`);
  }

  async moveTo(p, duration = 650) {
    const from = { ...this.mouse };
    const steps = Math.max(2, Math.round(duration / 16));
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps);
      await this.page.mouse.move(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t);
      await sleep(duration / steps);
    }
    this.mouse = { ...p };
  }

  // Touch gestures go through CDP so touchstart/move/end fire like a real finger.
  async touchPath(points, duration) {
    const send = (type, p) => this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, radiusX: 11, radiusY: 11, force: 1 }] : [] });
    await send('touchStart', points[0]);
    const steps = Math.max(2, Math.round(duration / 16));
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps);
      const seg = t * (points.length - 1);
      const k = Math.min(points.length - 2, Math.floor(seg));
      const f = seg - k;
      const a = points[k], b = points[k + 1];
      await send('touchMove', { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      await sleep(duration / steps);
    }
    await send('touchEnd');
  }

  async tap(p, { holdMs = 90, taps = 1, interval = 120 } = {}) {
    for (let i = 0; i < taps; i++) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, radiusX: 11, radiusY: 11, force: 1 }] });
      await sleep(holdMs);
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (taps > 1) await sleep(interval);
    }
    this.mouse = { ...p };
  }

  async scroll(a) {
    const duration = a.duration ?? 1500;
    await this.page.evaluate(async ({ selector, to, by, duration }) => {
      const el = selector ? document.querySelector(selector) : document.scrollingElement || document.documentElement;
      if (!el) throw new Error('scroll container not found: ' + selector);
      const start = el.scrollTop;
      let target;
      if (to === 'bottom') target = el.scrollHeight - el.clientHeight;
      else if (to === 'top') target = 0;
      else if (typeof to === 'number') target = to;
      else if (typeof to === 'string') {
        const t = document.querySelector(to);
        target = t ? start + t.getBoundingClientRect().top - 80 : start;
      } else target = start + (by ?? window.innerHeight * 0.8);
      target = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
      const e = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      await new Promise((resolve) => {
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / duration);
          el.scrollTop = start + (target - start) * e(k);
          if (k < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }, { selector: a.container || null, to: a.to ?? null, by: a.by ?? null, duration });
  }

  async run(actions = [], ctx) {
    for (const a of actions) await this.action(a, ctx);
  }

  async action(a, ctx) {
    const page = this.page;
    const kb = page.keyboard;
    // Timestamps (seconds into the recording) let the storyboard pick precise `from` offsets.
    if (ctx.recStart && a.do !== 'repeat') ctx.marks.push({ t: Number(((Date.now() - ctx.recStart) / 1000).toFixed(2)), do: a.do, target: a.selector || a.key || a.keys?.join('+') || a.text || a.path || a.direction || undefined });
    switch (a.do) {
      case 'wait': await sleep(a.ms ?? 1000); break;
      case 'waitFor':
        if (a.selector) await page.locator(a.selector).first().waitFor({ state: a.state ?? 'visible', timeout: a.timeout ?? 15000 });
        if (a.text) await page.getByText(a.text).first().waitFor({ timeout: a.timeout ?? 15000 });
        if (a.js) await page.waitForFunction(a.js, null, { timeout: a.timeout ?? 15000 });
        break;
      case 'goto': await goto(page, resolveUrl(ctx.baseUrl, a.path), a.settleMs ?? 800); break;
      case 'reload': await page.reload({ waitUntil: 'load' }); await sleep(a.settleMs ?? 800); break;
      case 'move':
      case 'hover':
        if (this.touch) { this.mouse = await this.point(a); break; } // fingers don't hover
        await this.moveTo(await this.point(a), a.duration ?? 650); if (a.pause) await sleep(a.pause); break;
      case 'tap':
      case 'click': {
        const p = await this.point(a);
        const pressed = () => { if (ctx.recStart) ctx.marks.push({ t: Number(((Date.now() - ctx.recStart) / 1000).toFixed(2)), do: 'pressed', target: a.selector || undefined }); };
        if (this.touch) {
          await sleep(a.hoverMs ?? 150);
          pressed();
          await this.tap(p, { holdMs: a.holdMs ?? 90, taps: a.clicks ?? a.taps ?? 1, interval: a.interval ?? 120 });
          await sleep(a.after ?? 450);
          break;
        }
        if (this.opts.cursor !== false && a.move !== false) await this.moveTo(p, a.duration ?? 650);
        else this.mouse = p;
        await page.mouse.move(this.mouse.x, this.mouse.y);
        await sleep(a.hoverMs ?? 120);
        pressed();
        for (let i = 0; i < (a.clicks ?? 1); i++) {
          await page.mouse.down({ button: a.button ?? 'left' });
          await sleep(a.holdMs ?? 70);
          await page.mouse.up({ button: a.button ?? 'left' });
          if (a.clicks > 1) await sleep(a.interval ?? 90);
        }
        await sleep(a.after ?? 400);
        break;
      }
      case 'longPress':
      case 'touch': {
        // Press and hold, e.g. holding the left half of the screen in a mobile game.
        const p = await this.point(a);
        if (this.touch) await this.tap(p, { holdMs: a.ms ?? 800 });
        else { await this.moveTo(p, 300); await page.mouse.down(); await sleep(a.ms ?? 800); await page.mouse.up(); }
        await sleep(a.after ?? 200);
        break;
      }
      case 'swipe': {
        // {from, to} targets, or {direction: up|down|left|right, distance: 0..1 of viewport, at?}
        const vp = page.viewportSize();
        let from, to;
        if (a.from && a.to) { from = await this.point(a.from); to = await this.point(a.to); }
        else {
          const c = a.at || a.selector ? await this.point(a) : { x: vp.width / 2, y: vp.height / 2 };
          const d = (a.distance ?? 0.45) * (a.direction === 'left' || a.direction === 'right' ? vp.width : vp.height);
          const dx = a.direction === 'left' ? -d : a.direction === 'right' ? d : 0;
          const dy = a.direction === 'up' ? -d : a.direction === 'down' ? d : 0;
          from = { x: c.x - dx / 2, y: c.y - dy / 2 }; to = { x: c.x + dx / 2, y: c.y + dy / 2 };
        }
        if (this.touch) await this.touchPath([from, to], a.duration ?? 450);
        else { await this.moveTo(from, 300); await page.mouse.down(); await this.moveTo(to, a.duration ?? 450); await page.mouse.up(); }
        await sleep(a.after ?? 400);
        break;
      }
      case 'type':
        if (a.selector) await this.action({ do: 'click', selector: a.selector, after: 150 }, { ...ctx, recStart: null });
        if (a.clear) { await kb.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await kb.press('Backspace'); }
        await kb.type(a.text, { delay: a.delay ?? (this.touch ? 90 : 65) });
        if (a.enter) await kb.press('Enter');
        await sleep(a.after ?? 300);
        break;
      case 'fill': await page.locator(a.selector).first().fill(a.text); break;
      case 'select': await page.locator(a.selector).first().selectOption(a.value); await sleep(a.after ?? 300); break;
      case 'press':
        for (let i = 0; i < (a.times ?? 1); i++) { await kb.press(a.key, { delay: a.holdMs ?? 40 }); await sleep(a.interval ?? 120); }
        break;
      case 'hold': {
        const keys = Array.isArray(a.keys) ? a.keys : [a.key];
        for (const k of keys) await kb.down(k);
        await sleep(a.ms ?? 1000);
        for (const k of [...keys].reverse()) await kb.up(k);
        break;
      }
      case 'keyDown': await kb.down(a.key); break;
      case 'keyUp': await kb.up(a.key); break;
      case 'mouseDown': if (a.selector || a.at || a.x != null) await this.moveTo(await this.point(a), a.duration ?? 300); await page.mouse.down({ button: a.button ?? 'left' }); break;
      case 'mouseUp': await page.mouse.up({ button: a.button ?? 'left' }); break;
      case 'drag': {
        const from = await this.point(a.from), to = await this.point(a.to);
        if (this.touch) { await this.touchPath([from, to], a.dragMs ?? 900); await sleep(a.after ?? 300); break; }
        await this.moveTo(from, a.duration ?? 500);
        await page.mouse.down();
        await this.moveTo(to, a.dragMs ?? 900);
        await page.mouse.up();
        await sleep(a.after ?? 300);
        break;
      }
      case 'scroll': await this.scroll(a); await sleep(a.after ?? 300); break;
      case 'wheel': await page.mouse.wheel(a.dx ?? 0, a.dy ?? 400); await sleep(a.after ?? 300); break;
      case 'eval': await page.evaluate(a.js); break;
      case 'screenshot': await ctx.still(a.name, a); break;
      case 'burst': {
        // Several stills in a row (name-01.png, name-02.png, ...), e.g. during gameplay, so the
        // best moment can be picked afterwards.
        const n = a.count ?? 8;
        for (let i = 1; i <= n; i++) {
          await ctx.still(`${a.name}-${String(i).padStart(2, '0')}`, a);
          if (i < n) await sleep(a.interval ?? 500);
        }
        break;
      }
      case 'repeat':
        for (let i = 0; i < (a.times ?? 2); i++) await this.run(a.actions, ctx);
        break;
      case 'mash': {
        // Pseudo-random gameplay input for `ms`. Keys by default; with `taps` (list of targets)
        // it taps/holds random touch zones instead, for mobile games.
        const r = rng(a.seed ?? 7);
        const end = Date.now() + (a.ms ?? 5000);
        const hold = () => (a.minHold ?? 120) + r() * ((a.maxHold ?? 600) - (a.minHold ?? 120));
        const gap = () => (a.gap ?? 40) + r() * (a.gap ?? 40);
        if (a.taps) {
          while (Date.now() < end) {
            const p = await this.point(a.taps[Math.floor(r() * a.taps.length)]);
            if (this.touch) await this.tap(p, { holdMs: hold() }); else { await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(hold()); await page.mouse.up(); }
            await sleep(gap());
          }
          break;
        }
        const keys = a.keys || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'];
        while (Date.now() < end) {
          const k = keys[Math.floor(r() * keys.length)];
          await kb.down(k); await sleep(hold()); await kb.up(k);
          await sleep(gap());
        }
        break;
      }
      default:
        throw new Error(`Unknown action "${a.do}"`);
    }
  }
}

// ---------------------------------------------------------------- recorders

function ffmpeg(args, label) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${label} failed: ${r.stderr?.slice(-800)}`);
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  try {
    const j = JSON.parse(r.stdout);
    return { width: j.streams?.[0]?.width, height: j.streams?.[0]?.height, duration: Number(Number(j.format?.duration).toFixed(3)) };
  } catch { return {}; }
}

const encodeArgs = (fps, crf) => [
  '-vf', `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-movflags', '+faststart', '-an',
];

// Turn timestamped JPEG frames into constant-fps H.264.
function encodeFrames(frames, t0, tEnd, frameDir, outFile, { fps, crf }) {
  if (!frames.length) throw new Error('Recorder produced no frames (page never painted?)');
  frames.sort((a, b) => a.t - b.t);
  const lines = ['ffconcat version 1.0'];
  const first = Math.max(0, frames[0].t - t0);
  if (first > 0.02) lines.push(`file '${frames[0].file}'`, `duration ${first.toFixed(4)}`);
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : tEnd;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.join(frameDir, 'frames.ffconcat');
  fs.writeFileSync(list, lines.join('\n'));
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, ...encodeArgs(fps, crf), outFile], 'frame encode');
  const sourceFps = Number((frames.length / Math.max(0.001, tEnd - t0)).toFixed(1));
  if (!has('keep-frames')) fs.rmSync(frameDir, { recursive: true, force: true });
  return { sourceFrames: frames.length, sourceFps };
}

function freshDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

// screencast: Chromium pushes a JPEG whenever it paints. Smooth (up to 60 fps) but always at
// the viewport's CSS-pixel size, ignoring deviceScaleFactor.
async function screencastRecorder(cdp, frameDir, { quality, width, height }) {
  freshDir(frameDir);
  const frames = [];
  let n = 0;
  const onFrame = (ev) => {
    const file = path.join(frameDir, `f${String(n++).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(ev.data, 'base64'));
    frames.push({ file, t: ev.metadata.timestamp ?? Date.now() / 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return {
    t0,
    async stop(outFile, opts) {
      const tEnd = Date.now() / 1000;
      await cdp.send('Page.stopScreencast').catch(() => {});
      await sleep(150);
      cdp.off('Page.screencastFrame', onFrame);
      return encodeFrames(frames, t0, tEnd, frameDir, outFile, opts);
    },
  };
}

// screenshot: back-to-back Page.captureScreenshot at full device resolution (e.g. 1179x2556 for
// a 3x phone). ~20-30 fps on a phone viewport; used automatically when deviceScaleFactor > 1.
async function screenshotRecorder(cdp, frameDir, { quality, width, height, scale }) {
  freshDir(frameDir);
  const frames = [];
  let n = 0;
  let stopping = false;
  const t0 = Date.now() / 1000;
  const loop = (async () => {
    while (!stopping) {
      const a = Date.now() / 1000;
      try {
        // A scaled clip renders at device pixels (a plain capture comes back at CSS size).
        // Clip coordinates are document-relative, so offset them by the current scroll position.
        const lm = await cdp.send('Page.getLayoutMetrics');
        const vv = lm.cssVisualViewport || lm.visualViewport || { pageX: 0, pageY: 0 };
        const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true, clip: { x: vv.pageX, y: vv.pageY, width, height, scale } });
        const file = path.join(frameDir, `f${String(n++).padStart(6, '0')}.jpg`);
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
        frames.push({ file, t: (a + Date.now() / 1000) / 2 });
      } catch { await sleep(30); } // navigation in progress
    }
  })();
  return {
    t0,
    async stop(outFile, opts) {
      const tEnd = Date.now() / 1000;
      stopping = true;
      await loop;
      return encodeFrames(frames, t0, tEnd, frameDir, outFile, opts);
    },
  };
}

// ---------------------------------------------------------------- sessions (one per device)

async function openSession(browser, plan, deviceName, opts, recorderDir) {
  // plan.deviceOptions.<device> overrides orientation/fullscreen/viewport/deviceScaleFactor per device.
  // plan.viewport only applies to a single-device plan; plan.deviceScaleFactor applies to all.
  const per = plan.deviceOptions?.[deviceName] || {};
  const single = !plan.devices && deviceName === (plan.device || 'phone');
  const device = resolveDevice(deviceName, {
    orientation: per.orientation ?? plan.orientation,
    fullscreen: per.fullscreen ?? plan.fullscreen,
    viewport: per.viewport ?? (single ? plan.viewport : undefined),
    deviceScaleFactor: per.deviceScaleFactor ?? plan.deviceScaleFactor,
  });
  const contextOpts = {
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    colorScheme: plan.colorScheme || 'no-preference',
    locale: plan.locale || 'en-US',
    reducedMotion: 'no-preference',
  };
  if (device.userAgent) contextOpts.userAgent = device.userAgent;
  if (plan.storageState) contextOpts.storageState = plan.storageState;
  if (opts.recorder === 'playwright') {
    contextOpts.recordVideo = { dir: recorderDir, size: { width: Math.round(device.viewport.width * device.deviceScaleFactor), height: Math.round(device.viewport.height * device.deviceScaleFactor) } };
  }
  const context = await opts.browser.newContext(contextOpts);
  const pointer = plan.cursor === false ? null : device.hasTouch ? 'touch' : 'mouse';
  if (pointer) await context.addInitScript(POINTER_SCRIPT, pointer);
  if (plan.localStorage) {
    await context.addInitScript((items) => {
      for (const [k, v] of Object.entries(items)) { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {} }
    }, plan.localStorage);
  }
  if (plan.initScript) await context.addInitScript(plan.initScript);
  if (plan.hideSelectors?.length) {
    await context.addInitScript((sels) => {
      const css = sels.map((s) => `${s}{display:none!important}`).join('');
      const add = () => { const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
    }, plan.hideSelectors);
  }
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Separate session for input so touch dispatch never queues behind a screenshot.
  // (Don't set Emulation.setDeviceMetricsOverride on our sessions: in headless Chrome it makes
  // touches land at x/dpr, y/dpr while screenshots are being taken.)
  const inputCdp = await context.newCDPSession(page);
  const driver = new Driver(page, inputCdp, device, { cursor: plan.cursor });
  return { name: deviceName, device, context, page, cdp, driver, started: Date.now() };
}

// ---------------------------------------------------------------- probe mode

async function probeMode(browser, opts, plan) {
  const s = await openSession(browser, { ...plan, cursor: false }, flag('device') || plan.device || plan.devices?.[0] || 'phone', { ...opts, recorder: 'none', browser });
  const url = resolveUrl(opts.baseUrl, flag('probe') || '/');
  await goto(s.page, url, 1200);
  fs.mkdirSync(opts.out, { recursive: true });
  const shot = path.join(opts.out, 'probe.png');
  await s.page.screenshot({ path: shot });
  const elements = await s.page.evaluate((sels) => {
    const sel = (el) => {
      if (el.id && !/\d{3,}/.test(el.id)) return `#${CSS.escape(el.id)}`;
      for (const attr of ['data-testid', 'data-test', 'data-cy', 'aria-label', 'name', 'placeholder']) {
        const v = el.getAttribute(attr);
        if (v) return `${el.tagName.toLowerCase()}[${attr}="${v.replace(/"/g, '\\"')}"]`;
      }
      const text = (el.innerText || el.value || '').trim().split('\n')[0].slice(0, 40);
      if (text) return `${el.tagName.toLowerCase()}:has-text("${text.replace(/"/g, '\\"')}")`;
      return null;
    };
    // data-crop for the design kit: the element's box as fractions of the captured image.
    const f = (v) => Math.max(0, Math.min(1, v)).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    const crop = (r) => `${f(r.x / innerWidth)} ${f(r.y / innerHeight)} ${f(r.width / innerWidth)} ${f(r.height / innerHeight)}`;
    const out = [];
    const nodes = document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=tab],[role=link],[onclick],canvas,summary,[contenteditable=true]');
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight * 3) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        href: el.getAttribute('href') || undefined,
        type: el.getAttribute('type') || undefined,
        selector: sel(el),
        box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        crop: crop(r),
        inViewport: r.top < innerHeight && r.bottom > 0,
      });
      if (out.length >= 120) break;
    }
    // Make repeated selectors unique with Playwright's nth= suffix.
    const seen = {};
    for (const e of out) if (e.selector) seen[e.selector] = (seen[e.selector] || 0) + 1;
    const idx = {};
    for (const e of out) {
      if (e.selector && seen[e.selector] > 1) {
        const k = (idx[e.selector] = (idx[e.selector] ?? -1) + 1);
        e.selector = `${e.selector} >> nth=${k}`;
      }
    }
    // Horizontal overflow is the classic "this page isn't mobile-ready" sign.
    const overflowX = document.documentElement.scrollWidth > innerWidth + 2;
    // --select ".week, .card >> nth=0": crops for any elements (cards, charts, sections).
    const selected = sels.map((q) => [...document.querySelectorAll(q)].slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return { selector: q, text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], crop: crop(r) };
    }));
    return { title: document.title, viewport: [innerWidth, innerHeight], overflowX, scrollHeight: document.documentElement.scrollHeight, selected: selected.flat(), elements: out };
  }, (flag('select') || '').split(',').map((x) => x.trim()).filter(Boolean));
  await s.context.close();
  console.log(JSON.stringify({ url, device: s.name, screenshot: shot, ...elements }, null, 2));
}

// ---------------------------------------------------------------- main

async function main() {
  const planPath = flag('plan');
  const plan = planPath ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : {};
  const baseUrl = flag('url') || plan.baseUrl || (() => {
    try { return JSON.parse(fs.readFileSync('store-assets/.run/app.json', 'utf8')).url; } catch { return null; }
  })();
  if (!baseUrl) throw new Error('No URL: pass --url, set baseUrl in the plan, or start the app with run_app.mjs');

  const shots = plan.shots || [];
  const anyVideo = shots.some((s) => s.type === 'video');
  // Store screenshots must not show a cursor or fingertip; only recordings get the pointer overlay.
  if (plan.cursor === undefined && !anyVideo) plan.cursor = false;

  const opts = {
    baseUrl,
    out: path.resolve(flag('out') || plan.out || (planPath ? path.join(path.dirname(planPath), 'captures') : 'store-assets/captures')),
    fps: plan.fps ?? 30,
    crf: plan.crf ?? 17,
    jpegQuality: plan.jpegQuality ?? 92,
    recorder: flag('recorder') || plan.recorder || 'auto',
    headed: has('headed') || plan.headed === true,
  };
  if (opts.recorder === 'cdp') opts.recorder = 'screencast';

  const launchArgs = ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--disable-features=Translate'];
  if (plan.gpu || opts.headed) launchArgs.push('--enable-gpu-rasterization', '--ignore-gpu-blocklist');
  const browser = await chromium.launch({ headless: !opts.headed, args: launchArgs });
  opts.browser = browser;

  if (has('probe')) { await probeMode(browser, opts, plan); await browser.close(); return; }
  if (!planPath) throw new Error('--plan is required (or use --probe)');

  fs.mkdirSync(opts.out, { recursive: true });
  const only = flag('only') ? new Set(flag('only').split(',')) : null;
  const onlyDevices = flag('devices') ? new Set(flag('devices').split(',')) : null;
  const planDevices = plan.devices || [plan.device || 'phone'];
  const sessions = new Map();
  const consoleErrors = [];
  const manifest = { baseUrl, fps: opts.fps, capturedAt: new Date().toISOString(), devices: {}, captures: [], failures: [] };
  const pwSegments = [];
  const rel = (f) => path.relative(opts.out, f).split(path.sep).join('/');

  // One browser session per device (and per shot-level deviceScaleFactor, e.g. a lighter 2x
  // session for smooth game recordings next to 3x stills).
  const session = async (name, dpr) => {
    const key = dpr ? `${name}@${dpr}x` : name;
    if (sessions.has(key)) return sessions.get(key);
    const p = dpr ? { ...plan, deviceOptions: { ...plan.deviceOptions, [name]: { ...plan.deviceOptions?.[name], deviceScaleFactor: dpr } } } : plan;
    const s = await openSession(browser, p, name, opts, path.join(opts.out, `.pw-video-${key.replace('@', '-')}`));
    s.key = key;
    s.page.on('pageerror', (e) => consoleErrors.push(String(e.message || e).slice(0, 300)));
    s.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    if (!dpr || !manifest.devices[name]) manifest.devices[name] = { kind: s.device.kind, style: s.device.style, viewport: s.device.viewport, deviceScaleFactor: s.device.deviceScaleFactor, statusBar: s.device.statusBar, orientation: s.device.orientation };
    fs.mkdirSync(path.join(opts.out, name), { recursive: true });
    sessions.set(key, s);
    if (plan.setup?.length) {
      log(`setup (${name})…`);
      await goto(s.page, resolveUrl(baseUrl, plan.setupPath || '/'));
      await s.driver.run(plan.setup, makeCtx(s));
    }
    return s;
  };

  const deviceInfo = (s) => ({ device: s.name, deviceKind: s.device.kind, deviceStyle: s.device.style, statusBar: s.device.statusBar, viewport: s.device.viewport, orientation: s.device.orientation });

  function makeCtx(s, shot = {}) {
    const ctx = {
      baseUrl,
      marks: [],
      recStart: null,
      still: async (name, a = {}) => {
        const file = path.join(opts.out, s.name, `${name}.png`);
        const shotOpts = { path: file, fullPage: !!a.fullPage, animations: a.animations || shot.animations || 'allow' };
        if (a.selector) await s.page.locator(a.selector).first().screenshot({ path: file });
        else {
          if (a.clip) shotOpts.clip = a.clip;
          const hide = !a.showCursor;
          if (hide) await s.page.evaluate(() => {
            const c = document.getElementById('__promo_cursor'); if (c) c.style.visibility = 'hidden';
            document.querySelectorAll('[data-promo-ripple]').forEach((r) => r.remove());
          }).catch(() => {});
          await s.page.screenshot(shotOpts);
          if (hide) await s.page.evaluate(() => { const c = document.getElementById('__promo_cursor'); if (c) c.style.visibility = ''; }).catch(() => {});
        }
        const meta = { name, type: 'screenshot', file: rel(file), ...probe(file), ...deviceInfo(s), note: shot.note };
        delete meta.duration;
        manifest.captures.push(meta);
        log(`still  ${s.name}/${name}.png`);
      },
    };
    return ctx;
  }

  for (const shot of shots) {
    if (only && !only.has(shot.name)) continue;
    const type = shot.type || 'screenshot';
    const devs = (shot.devices || (shot.device ? [shot.device] : planDevices)).filter((d) => !onlyDevices || onlyDevices.has(d));
    for (const devName of devs) {
      let s;
      try { s = await session(devName, shot.deviceScaleFactor); } catch (err) { manifest.failures.push({ name: shot.name, device: devName, error: err.message }); log(`  FAILED: ${err.message}`); continue; }
      const ctx = makeCtx(s, shot);
      log(`${type === 'video' ? 'video ' : 'shot  '} ${shot.name} [${devName}]`);
      try {
        if (shot.fresh) {
          // Independent shot: wipe what earlier shots changed (storage + cookies) and force a full
          // page load, so the seeds re-apply and in-memory state is gone. (Going to a URL that
          // differs only by #hash would otherwise keep the same document.)
          const current = s.page.url();
          await s.context.clearCookies();
          await s.page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} }).catch(() => {});
          await s.page.goto('about:blank').catch(() => {});
          if (shot.path === undefined && /^https?:/.test(current)) await goto(s.page, current, shot.settleMs ?? 800);
        }
        if (shot.path !== undefined) await goto(s.page, resolveUrl(baseUrl, shot.path), shot.settleMs ?? 800);
        if (shot.before?.length) await s.driver.run(shot.before, ctx);

        if (type !== 'video') {
          await s.driver.run(shot.actions || [], ctx);
          if (type === 'screenshot') await ctx.still(shot.name, shot);
        } else {
          const outFile = path.join(opts.out, s.name, `${shot.name}.mp4`);
          if (opts.recorder === 'playwright') {
            const startS = (Date.now() - s.started) / 1000;
            ctx.recStart = Date.now();
            await s.driver.run(shot.actions || [], ctx);
            await sleep(shot.tailMs ?? 500);
            pwSegments.push({ shot, s, outFile, start: startS, end: (Date.now() - s.started) / 1000, marks: ctx.marks });
          } else {
            const vp = s.page.viewportSize();
            const kind = opts.recorder === 'auto' ? (s.device.deviceScaleFactor > 1 ? 'screenshot' : 'screencast') : opts.recorder;
            const frameDir = path.join(opts.out, `.frames-${s.name}-${shot.name}`);
            const rec = kind === 'screenshot'
              ? await screenshotRecorder(s.cdp, frameDir, { quality: opts.jpegQuality, width: vp.width, height: vp.height, scale: s.device.deviceScaleFactor })
              : await screencastRecorder(s.cdp, frameDir, { quality: opts.jpegQuality, width: vp.width, height: vp.height });
            ctx.recStart = rec.t0 * 1000;
            await sleep(shot.leadMs ?? 300);
            await s.driver.run(shot.actions || [], ctx);
            ctx.marks.push({ t: Number(((Date.now() - ctx.recStart) / 1000).toFixed(2)), do: 'end-of-actions' });
            await sleep(shot.tailMs ?? 500);
            ctx.recStart = null;
            const stats = await rec.stop(outFile, opts);
            manifest.captures.push({ name: shot.name, type: 'video', file: rel(outFile), ...probe(outFile), ...deviceInfo(s), recorder: kind, ...stats, marks: ctx.marks, note: shot.note });
            if (stats.sourceFps < 15) log(kind === 'screenshot'
              ? `  note: ${stats.sourceFps} fps captured. For animation/games lower "deviceScaleFactor" (e.g. 2) or free up CPU; static UI is fine.`
              : `  note: ${stats.sourceFps} fps captured. Fine for static UI (screencast only sends frames on change); for animation/games try --headed or a smaller viewport.`);
          }
        }
        if (shot.after?.length) await s.driver.run(shot.after, { ...ctx, recStart: null });
      } catch (err) {
        const errShot = path.join(opts.out, s.name, `${shot.name}.error.png`);
        await s.page.screenshot({ path: errShot }).catch(() => {});
        manifest.failures.push({ name: shot.name, device: devName, error: String(err.message || err).split('\n')[0], screenshot: rel(errShot) });
        log(`  FAILED: ${err.message?.split('\n')[0]}`);
        if (has('strict')) break;
      }
    }
  }

  const videos = new Map();
  for (const s of sessions.values()) { videos.set(s.key, s.page.video?.()); await s.context.close(); }
  await browser.close();

  for (const seg of pwSegments) {
    const full = await videos.get(seg.s.key)?.path();
    if (!full) continue;
    ffmpeg(['-ss', seg.start.toFixed(3), '-to', seg.end.toFixed(3), '-i', full, ...encodeArgs(opts.fps, opts.crf), seg.outFile], `cut ${seg.shot.name}`);
    manifest.captures.push({ name: seg.shot.name, type: 'video', file: rel(seg.outFile), ...probe(seg.outFile), ...deviceInfo(seg.s), recorder: 'playwright', marks: seg.marks, note: seg.shot.note });
  }
  if (pwSegments.length && !has('keep-frames')) for (const s of sessions.values()) fs.rmSync(path.join(opts.out, `.pw-video-${s.key.replace('@', '-')}`), { recursive: true, force: true });

  manifest.consoleErrors = [...new Set(consoleErrors)].slice(0, 20);
  // Merge with the existing manifest so --only / --devices retakes keep the other captures.
  const manifestFile = path.join(opts.out, 'manifest.json');
  if ((only || onlyDevices) && fs.existsSync(manifestFile)) {
    const prev = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const files = new Set(manifest.captures.map((c) => c.file));
    manifest.captures = [...prev.captures.filter((c) => !files.has(c.file)), ...manifest.captures];
    manifest.devices = { ...prev.devices, ...manifest.devices };
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    manifest: path.relative(process.cwd(), manifestFile),
    captures: manifest.captures.map((c) => `${c.file} ${c.width}x${c.height}${c.duration ? ` ${c.duration}s` : ''}`),
    failures: manifest.failures,
    consoleErrors: manifest.consoleErrors.length,
  }, null, 2));
  if (manifest.failures.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e.stack || String(e)); process.exit(1); });
