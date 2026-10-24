/* Store-listing design kit.
 *
 * A design file (screenshots.html, feature.html, ...) is a list of <section class="slide">
 * elements. This script turns it into exact-size store images:
 *
 *   design.html?target=play-phone&slide=hero   one slide, filling a viewport of the target's size
 *                                              (render.mjs screenshots exactly this)
 *   design.html?target=play-phone              board: every slide for that target, scaled down
 *   design.html?kit=meta                       nothing visual; window.__kit.meta for render.mjs
 *
 * It resolves data-shot="name" to captures/<device>/name.png for the target's platform, draws
 * device frames with a clean status bar, crops callouts, fits text and reports layout problems.
 * Everything it learns is on window.__kit (ready, target, slides, warnings).
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------ targets
  // Pixel sizes are the stores' accepted sizes (see references/store-specs.md).
  // min/max: how many images the store slot takes. noAlpha: flattened RGB only.
  const TARGETS = {
    'appstore-iphone-6.9': { label: 'App Store · iPhone 6.9"', store: 'app-store', platform: 'ios', form: 'phone', w: 1320, h: 2868, folder: 'app-store/iphone-6.9', min: 1, max: 10 },
    'appstore-iphone-6.5': { label: 'App Store · iPhone 6.5"', store: 'app-store', platform: 'ios', form: 'phone', w: 1284, h: 2778, folder: 'app-store/iphone-6.5', min: 1, max: 10 },
    'appstore-iphone-6.3': { label: 'App Store · iPhone 6.3"', store: 'app-store', platform: 'ios', form: 'phone', w: 1206, h: 2622, folder: 'app-store/iphone-6.3', min: 1, max: 10 },
    'appstore-ipad-13': { label: 'App Store · iPad 13"', store: 'app-store', platform: 'ios', form: 'tablet', w: 2064, h: 2752, folder: 'app-store/ipad-13', min: 1, max: 10 },
    'play-phone': { label: 'Google Play · Phone', store: 'google-play', platform: 'android', form: 'phone', w: 1080, h: 1920, folder: 'google-play/phone', min: 2, max: 8, maxBytes: 8e6 },
    'play-tablet': { label: 'Google Play · Tablet (7" + 10")', store: 'google-play', platform: 'android', form: 'tablet', w: 1440, h: 2560, folder: 'google-play/tablet', min: 4, max: 8, maxBytes: 8e6 },
    'play-chromebook': { label: 'Google Play · Chromebook', store: 'google-play', platform: 'chromeos', form: 'desktop', w: 1920, h: 1080, folder: 'google-play/chromebook', min: 4, max: 8, maxBytes: 8e6 },
    'play-feature': { label: 'Google Play · Feature graphic', store: 'google-play', platform: 'android', form: 'feature', kind: 'feature', w: 1024, h: 500, file: 'google-play/feature-graphic', min: 1, max: 1, maxBytes: 15e6 },
  };
  for (const [id, t] of Object.entries({ ...TARGETS })) {
    if (t.kind || t.w > t.h) continue;
    TARGETS[`${id}-landscape`] = { ...t, label: `${t.label} (landscape)`, w: t.h, h: t.w, folder: `${t.folder}-landscape` };
  }
  for (const t of Object.values(TARGETS)) t.noAlpha = true;

  // Which capture device to use for a target, best first.
  const DEVICE_ORDER = {
    'ios:phone': ['phone', 'phone-android'],
    'android:phone': ['phone-android', 'phone'],
    'ios:tablet': ['tablet', 'tablet-android'],
    'android:tablet': ['tablet-android', 'tablet'],
    'chromeos:desktop': ['desktop', 'tablet-android', 'tablet'],
    'android:feature': ['phone-android', 'phone', 'tablet-android', 'tablet'],
  };
  const ANY_DEVICE = ['phone', 'phone-android', 'tablet', 'tablet-android', 'desktop'];

  // Frame geometry in units of the screen's short side.
  const FRAMES = {
    iphone: { bezel: 0.034, radius: 0.13, body: '#1b1b1d', ring: '#56565c', cutout: 'island', status: 'ios' },
    android: { bezel: 0.024, radius: 0.09, body: '#1d1e21', ring: '#45464b', cutout: 'hole', status: 'android' },
    ipad: { bezel: 0.036, radius: 0.022, body: '#1b1b1d', ring: '#4d4d52', cutout: 'cam', status: 'ios-tablet' },
    'android-tablet': { bezel: 0.04, radius: 0.018, body: '#1d1e21', ring: '#45464b', cutout: 'cam', status: 'android' },
    card: { bezel: 0, radius: 0.07, shadow: true },
    none: { bezel: 0, radius: 0, flat: true },
    browser: { bezel: 0, radius: 0.012, bar: 0.032, shadow: true },
  };

  // ------------------------------------------------------------------ setup
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || '';
  const fileTargets = meta('store-targets').split(/[\s,]+/).filter(Boolean);
  const capturesBase = (meta('captures') || '../captures/').replace(/\/?$/, '/');
  const warnings = [];
  const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); console.warn('[kit]', m); };

  const slides = [...document.querySelectorAll('.slide')];
  slides.forEach((s, i) => { if (!s.dataset.name) s.dataset.name = `slide-${i + 1}`; });
  const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const list = (v) => (v || '').split(/[\s,]+/).filter(Boolean);
  const slideWants = (s, id) => {
    const inc = list(s.dataset.targets), exc = list(s.dataset.skip);
    if (inc.length && !inc.some((g) => globRe(g).test(id))) return false;
    return !exc.some((g) => globRe(g).test(id));
  };

  const kit = window.__kit = {
    targets: TARGETS,
    fileTargets,
    locale: meta('store-locale') || null,
    slides: slides.map((s) => ({ name: s.dataset.name, targets: s.dataset.targets || null, skip: s.dataset.skip || null })),
    warnings,
    slidesFor: (id) => slides.filter((s) => slideWants(s, id)).map((s) => s.dataset.name),
  };

  let targetId = params.get('target') || fileTargets[0] || 'appstore-iphone-6.9';
  if (!TARGETS[targetId]) { warn(`unknown target "${targetId}"`); targetId = 'appstore-iphone-6.9'; }
  const T = TARGETS[targetId];

  // ------------------------------------------------------------------ captures
  let manifestP = null;
  const manifest = () => (manifestP ||= fetch(capturesBase + 'manifest.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null));

  // Resolve data-shot to {src, info}. info carries the capture's device, viewport and status bar.
  async function resolveShot(value, preferDevice) {
    if (!value) return null;
    if (/[/.]/.test(value)) return { src: value, info: null };
    const m = await manifest();
    const order = preferDevice ? [preferDevice] : DEVICE_ORDER[`${T.platform}:${T.form}`] || ['phone'];
    if (m) {
      const caps = (m.captures || []).filter((c) => c.name === value && c.type !== 'video');
      const pick = (d) => caps.find((c) => c.device === d);
      for (const d of order) if (pick(d)) return { src: capturesBase + pick(d).file, info: { ...m.devices?.[d], ...pick(d) } };
      const other = [...ANY_DEVICE.map(pick).filter(Boolean), ...caps][0];
      if (other) {
        warn(`"${value}": no ${order[0]} capture for ${targetId}, using the ${other.device} one`);
        return { src: capturesBase + other.file, info: { ...m.devices?.[other.device], ...other } };
      }
      warn(`"${value}": no capture with that name in captures/manifest.json`);
      return { src: null, info: null, missing: value };
    }
    // No manifest (your own screenshots, or opened from disk): try each device folder in turn.
    const tries = [...new Set([...order, ...ANY_DEVICE])].map((d) => `${capturesBase}${d}/${value}.png`);
    for (const src of tries) if (await exists(src)) return { src, info: null };
    warn(`"${value}": not found in ${capturesBase}<device>/${value}.png`);
    return { src: null, info: null, missing: value };
  }
  const exists = (src) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(true); i.onerror = () => resolve(false); i.src = src; });

  const loadImg = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => { warn(`could not load ${src}`); resolve(null); };
    img.src = src;
  });

  // Average colour of the image's top and bottom edges: tints the status bar strip and picks
  // light or dark status icons / home indicator.
  function edges(img) {
    try {
      const w = 48, h = Math.max(8, Math.round((48 * img.naturalHeight) / img.naturalWidth));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const row = (y) => {
        const d = g.getImageData(0, y, w, 1).data;
        const px = [];
        for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
        return px;
      };
      const avg = (a) => a.reduce((t, c) => [t[0] + c[0], t[1] + c[1], t[2] + c[2]], [0, 0, 0]).map((v) => v / a.length);
      const spread = (a) => { const m = avg(a); return Math.sqrt(a.reduce((t, c) => t + (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2, 0) / a.length); };
      // A uniform edge row is the app's header / tab bar colour. A busy one (content scrolled
      // under the status bar) falls back to its outer margins, usually the page background.
      const pick = (y) => { const r = row(y); return spread(r) < 18 ? avg(r) : avg([...r.slice(0, 2), ...r.slice(-2)]); };
      return { top: pick(0), bottom: pick(h - 1) };
    } catch { return null; }
  }
  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const rgb = ([r, g, b]) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;

  // ------------------------------------------------------------------ status bars
  const ICON = {
    signal: '<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg>',
    wifi: '<svg viewBox="0 0 16 12"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.3A10.3 10.3 0 0 0 8 .8 10.3 10.3 0 0 0 .7 3.7L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.3A6.6 6.6 0 0 0 8 4.4c-1.8 0-3.4.7-4.7 1.8l1.3 1.3c.9-.8 2.1-1.3 3.4-1.3Zm0 3.5c-.5 0-1 .2-1.4.5L8 11.6l1.4-1.4c-.4-.3-.9-.5-1.4-.5Z"/></svg>',
    battery: '<svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2"/><path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1Z" fill-opacity=".45"/></svg>',
    aSignal: '<svg viewBox="0 0 14 14"><path d="M14 0v14H0Z"/></svg>',
    aWifi: '<svg viewBox="0 0 16 13"><path d="M8 13 0 3.3A12.6 12.6 0 0 1 8 .5c3 0 5.8 1 8 2.8Z"/></svg>',
    aBattery: '<svg viewBox="0 0 8 14"><rect x="2.5" y="0" width="3" height="1.6" rx=".5"/><rect x="0" y="1.4" width="8" height="12.6" rx="1.4"/></svg>',
  };
  function statusBar(style) {
    if (style === 'android') {
      return `<span class="sb-time">9:41</span><span class="sb-icons">${ICON.aWifi}${ICON.aSignal}${ICON.aBattery}</span>`;
    }
    if (style === 'ios-tablet') {
      return `<span class="sb-time">9:41 <span class="sb-date">Tue Sep 9</span></span><span class="sb-icons">${ICON.wifi}${ICON.battery}</span>`;
    }
    return `<span class="sb-time">9:41</span><span class="sb-icons">${ICON.signal}${ICON.wifi}${ICON.battery}</span>`;
  }

  // ------------------------------------------------------------------ devices
  function frameName(el, kind, platform) {
    const explicit = el.dataset.frame;
    if (explicit && explicit !== 'auto' && explicit !== 'device') return explicit;
    // Preference: the element, then its slide, then <html>, then the store default.
    const sl = el.closest('.slide')?.dataset || {};
    const pref = explicit === 'device' ? 'device'
      : (T.store === 'app-store' ? sl.appstoreFrame || root.dataset.appstoreFrame : sl.playFrame || root.dataset.playFrame) || (T.store === 'app-store' ? 'device' : 'card');
    if (pref === 'card' || pref === 'none') return kind === 'desktop' && pref === 'card' ? 'browser' : pref;
    const ios = platform === 'ios';
    if (kind === 'tablet') return ios ? 'ipad' : 'android-tablet';
    if (kind === 'desktop') return 'browser';
    return ios ? 'iphone' : 'android';
  }

  async function buildDevice(el) {
    const shot = await resolveShot(el.dataset.shot, el.dataset.device);
    const img = await loadImg(shot?.src);
    const info = shot?.info || {};
    const kind = info.deviceKind || (/tablet|ipad/i.test(el.dataset.device || '') ? 'tablet' : el.dataset.device === 'desktop' ? 'desktop' : T.form === 'tablet' ? 'tablet' : T.form === 'desktop' ? 'desktop' : 'phone');
    const platform = el.dataset.platform || (T.store === 'app-store' ? 'ios' : 'android');
    const name = frameName(el, kind, platform);
    const F = FRAMES[name] || FRAMES.card;

    // Screen = status bar strip + capture. Captures from capture.mjs leave the status bar out.
    const natW = img?.naturalWidth || 1179, natH = img?.naturalHeight || 2556;
    const wantBar = el.dataset.statusbar !== 'off' && !F.flat && name !== 'browser';
    const sbCss = wantBar ? (info.statusBar || 0) : 0;
    const vw = info.viewport?.width || natW, vh = info.viewport?.height || natH;
    const scrW = vw, scrH = vh + sbCss;
    const short = Math.min(scrW, scrH);
    const bezel = F.bezel * short, bar = (F.bar || 0) * scrW;
    const outW = scrW + 2 * bezel, outH = scrH + 2 * bezel + bar;
    const u = (x) => `${((x / outW) * 100).toFixed(4)}cqw`; // length in units of the device width
    const pctW = (x) => `${((x / outW) * 100).toFixed(4)}%`;
    const pctH = (x) => `${((x / outH) * 100).toFixed(4)}%`;

    const kids = [...el.childNodes];
    el.textContent = '';
    el.classList.add('dv', `dv-${name}`, `dv-${kind}`);
    el.style.setProperty('--ar', (outW / outH).toFixed(5));
    el.dataset.kitFrame = name;

    const body = document.createElement('div');
    body.className = 'dv-body';
    const radius = name === 'card' && kind !== 'phone' ? 0.025 * short : F.radius * short;
    body.style.borderRadius = u(radius + bezel);
    if (F.body) body.style.setProperty('--dv-body', el.dataset.color || F.body), body.style.setProperty('--dv-ring', F.ring);
    if (F.bezel) body.style.boxShadow = `inset 0 0 0 ${u(short * 0.004)} var(--dv-ring), inset 0 0 0 ${u(short * 0.009)} var(--dv-body), inset 0 0 0 ${u(short * 0.011)} rgba(255,255,255,.18), var(--device-shadow)`;
    el.appendChild(body);

    if (bar) {
      const b = document.createElement('div');
      b.className = 'dv-bar';
      Object.assign(b.style, { left: 0, top: 0, width: '100%', height: pctH(bar) });
      b.innerHTML = '<i></i><i></i><i></i><span></span>';
      body.appendChild(b);
    }

    const screen = document.createElement('div');
    screen.className = 'dv-screen';
    Object.assign(screen.style, {
      left: pctW(bezel), top: pctH(bezel + bar), width: pctW(scrW), height: pctH(scrH),
      borderRadius: name === 'browser' ? `0 0 ${u(radius)} ${u(radius)}` : u(radius),
    });
    body.appendChild(screen);

    const ed = img ? edges(img) : null;
    const topCol = el.dataset.statusbarBg || (ed ? rgb(ed.top) : '#fff');
    const topDark = el.dataset.statusbar === 'light' ? true : el.dataset.statusbar === 'dark' ? false : ed ? lum(ed.top) < 0.55 : false;
    const botDark = ed ? lum(ed.bottom) < 0.55 : false;
    screen.style.background = topCol;

    if (sbCss) {
      const sb = document.createElement('div');
      sb.className = `dv-status sb-${F.status || (platform === 'ios' ? (kind === 'tablet' ? 'ios-tablet' : 'ios') : 'android')}`;
      sb.style.height = `${((sbCss / scrH) * 100).toFixed(4)}%`;
      sb.style.color = topDark ? '#fff' : '#000';
      sb.innerHTML = statusBar(F.status || (platform === 'ios' ? (kind === 'tablet' ? 'ios-tablet' : 'ios') : 'android'));
      screen.appendChild(sb);
    }

    const pic = document.createElement('div');
    pic.className = 'dv-shot';
    pic.style.top = `${((sbCss / scrH) * 100).toFixed(4)}%`;
    if (img) {
      pic.appendChild(img);
      img.alt = '';
      if (el.dataset.focus) img.style.objectPosition = el.dataset.focus;
      // data-zoom="1.25": enlarge the UI inside the screen (crops the edges), anchored at
      // data-focus (default top centre), e.g. for screens with empty space below the content.
      if (Number(el.dataset.zoom) > 1) Object.assign(img.style, { transform: `scale(${Number(el.dataset.zoom)})`, transformOrigin: el.dataset.focus || '50% 0%' });
    } else {
      pic.classList.add('dv-missing');
      pic.textContent = shot?.missing || el.dataset.shot || 'no capture';
    }
    screen.appendChild(pic);

    if (F.cutout === 'island' && kind === 'phone' && !(info.orientation === 'landscape')) {
      const i = document.createElement('div');
      i.className = 'dv-island';
      Object.assign(i.style, { width: `${(126 / 440) * 100}%`, height: `${((37 / 440) * scrW / scrH) * 100}%`, top: `${((11 / 440) * scrW / scrH) * 100}%` });
      screen.appendChild(i);
    } else if (F.cutout === 'hole' && kind === 'phone') {
      const i = document.createElement('div');
      i.className = 'dv-hole';
      const d = (11 / 412) * scrW;
      Object.assign(i.style, { width: `${(d / scrW) * 100}%`, height: `${(d / scrH) * 100}%`, top: `${(((sbCss || 32) / 2 - d / 2) / scrH) * 100}%` });
      screen.appendChild(i);
    } else if (F.cutout === 'cam') {
      const c = document.createElement('div');
      c.className = 'dv-cam';
      const d = bezel * 0.32;
      const landscape = scrW > scrH;
      Object.assign(c.style, landscape
        ? { width: pctW(d), height: pctH(d), left: pctW(bezel / 2 - d / 2), top: pctH(outH / 2 - d / 2) }
        : { width: pctW(d), height: pctH(d), left: pctW(outW / 2 - d / 2), top: pctH(bezel / 2 - d / 2) });
      body.appendChild(c);
    }
    if (platform === 'ios' && kind === 'phone' && F.bezel && el.dataset.home !== 'off') {
      const h = document.createElement('div');
      h.className = 'dv-home';
      h.style.background = botDark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.82)';
      screen.appendChild(h);
    }

    // Children (chips, stickers, callouts) sit above the frame, positioned against the device box.
    if (kids.some((k) => k.nodeType === 1 || k.textContent.trim())) {
      const over = document.createElement('div');
      over.className = 'dv-over';
      kids.forEach((k) => over.appendChild(k));
      el.appendChild(over);
    }
    return img;
  }

  // <img data-shot="..."> and .bg-shot: just the capture, no frame.
  async function buildImage(el) {
    const shot = await resolveShot(el.dataset.shot, el.dataset.device);
    if (!shot?.src) { el.classList.add('dv-missing'); return null; }
    el.src = shot.src;
    if (el.dataset.focus) el.style.objectPosition = el.dataset.focus;
    await el.decode().catch(() => warn(`could not load ${shot.src}`));
    return el;
  }

  // .callout[data-shot][data-crop="x y w h"] (fractions of the capture): a magnified piece of the UI.
  // Phone and tablet layouts differ, so data-crop-tablet / data-crop-desktop override data-crop
  // when the capture used for this target comes from that kind of device.
  async function buildCallout(el) {
    const shot = await resolveShot(el.dataset.shot, el.dataset.device);
    const img = await loadImg(shot?.src);
    if (!img) { el.classList.add('dv-missing'); return null; }
    const kind = shot.info?.deviceKind || T.form;
    const crop = el.dataset[`crop${kind[0].toUpperCase()}${kind.slice(1)}`] || el.dataset.crop || '0 0 1 1';
    el.dataset.kitKind = kind;
    const [x, y, w, h] = list(crop).map(Number);
    el.style.backgroundImage = `url("${shot.src}")`;
    el.style.backgroundSize = `${100 / w}% auto`;
    el.style.backgroundPosition = `${w >= 1 ? 0 : (x / (1 - w)) * 100}% ${h >= 1 ? 0 : (y / (1 - h)) * 100}%`;
    el.style.aspectRatio = `${(w * img.naturalWidth) / (h * img.naturalHeight)}`;
    return img;
  }

  // ------------------------------------------------------------------ text fitting + checks
  // data-fit="2": shrink the font until the text fits in 2 lines and doesn't overflow sideways.
  function fitText(el) {
    const maxLines = Number(el.dataset.fit) || 99;
    const cs = getComputedStyle(el);
    let size = parseFloat(cs.fontSize);
    const lines = () => Math.round(el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).lineHeight) || size * 1.1));
    for (let i = 0; i < 40 && (lines() > maxLines || el.scrollWidth > el.clientWidth + 1); i++) {
      size *= 0.96;
      el.style.fontSize = `${size}px`;
    }
  }

  function checkSlide(slide) {
    const sr = slide.getBoundingClientRect();
    const name = slide.dataset.name;
    const textEls = slide.querySelectorAll('h1,h2,h3,p,.chip,.sticker,.badge,.caption li,.stat b,.stat span,.game-logo');
    let textArea = 0;
    const lines = []; // caption text line boxes, for the overlap check below
    for (const el of textEls) {
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
      const label = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${el.textContent.trim().slice(0, 30)}"`;
      if (r.left < sr.left - 1 || r.right > sr.right + 1 || r.top < sr.top - 1 || r.bottom > sr.bottom + 1) warn(`${name}: ${label} is cut off by the slide edge`);
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') warn(`${name}: ${label} overflows its box`);
      if ((/^H[1-3]$|^P$/.test(el.tagName) || el.closest('.stat')) && el.closest('.caption')) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const lr of range.getClientRects()) { textArea += lr.width * lr.height; lines.push(lr); }
      }
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (el.closest('.caption') && fs < Math.min(sr.width, sr.height) * 0.028) warn(`${name}: ${label} is small (${Math.round(fs)}px); it will be hard to read in store thumbnails`);
    }
    // Callouts and panels are meant to sit inside the image; a bigger device on a taller
    // target can push them past the edges.
    for (const el of slide.querySelectorAll('.callout,.panel')) {
      if (el.hasAttribute('data-free')) continue;
      const r = el.getBoundingClientRect();
      if (r.left < sr.left - 2 || r.right > sr.right + 2) warn(`${name}: ${el.className.split(' ')[0]}${el.dataset.shot ? ` "${el.dataset.shot}"` : ''} is cut off at the side (${Math.round(r.width / sr.width * 100)}% of the width); make it narrower or move it in`);
    }
    // Decorations placed for one aspect ratio often land on the headline in another.
    for (const el of slide.querySelectorAll('.chip,.sticker,.badge,.bubble,.callout,.panel,.device')) {
      if (el.closest('.caption') || el.hasAttribute('data-allow-overlap')) continue;
      const r = el.getBoundingClientRect();
      const hit = lines.some((l) => Math.min(r.right, l.right) - Math.max(r.left, l.left) > 2 && Math.min(r.bottom, l.bottom) - Math.max(r.top, l.top) > 2);
      if (hit) warn(`${name}: ${el.className.split(' ').filter((c) => !c.startsWith('dv-'))[0]}${el.dataset.shot ? ` "${el.dataset.shot}"` : ` "${el.textContent.trim().slice(0, 24)}"`} overlaps the caption text`);
    }
    const share = textArea / (sr.width * sr.height);
    if (T.store === 'google-play' && T.kind !== 'feature' && share > 0.2) warn(`${name}: caption text covers ${Math.round(share * 100)}% of the image; Google Play recommends at most 20%`);
    slide.dataset.textShare = share.toFixed(3);
  }

  const frames = (n = 2) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

  // Decorations placed against a device land in different spots per aspect ratio. Nudge any
  // that would stick out of the slide back inside (2.5% margin); data-free opts out.
  function keepInside(slide) {
    const sr = slide.getBoundingClientRect();
    const m = Math.min(sr.width, sr.height) * 0.025;
    for (const el of slide.querySelectorAll('.chip,.badge,.bubble,.sticker')) {
      if (el.hasAttribute('data-free')) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left < sr.left + m ? sr.left + m - r.left : r.right > sr.right - m ? sr.right - m - r.right : 0;
      const dy = r.top < sr.top + m ? sr.top + m - r.top : r.bottom > sr.bottom - m ? sr.bottom - m - r.bottom : 0;
      if (dx || dy) el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    }
  }

  // Panoramic sets: one <div class="pan-bg" data-pan="x"> outside the slides is cloned into
  // every slide with data-pan="x", shifted by the slide's position, so it runs across the set.
  function panLayer(slide) {
    const key = slide.dataset.pan;
    if (!key) return;
    const tpl = document.querySelector(`body > .pan-bg[data-pan="${key}"]`);
    if (!tpl) { warn(`${slide.dataset.name}: no <div class="pan-bg" data-pan="${key}"> in the page`); return; }
    const names = kit.slidesFor(targetId).filter((n) => slides.find((x) => x.dataset.name === n)?.dataset.pan === key);
    slide.style.setProperty('--pan-index', Math.max(0, names.indexOf(slide.dataset.name)));
    slide.style.setProperty('--pan-count', Math.max(1, names.length));
    slide.prepend(tpl.cloneNode(true));
  }

  async function renderSlide(slide) {
    panLayer(slide);
    const timeout = new Promise((r) => setTimeout(() => { warn(`${slide.dataset.name}: timed out waiting for images/fonts`); r(); }, 20000));
    const work = (async () => {
      await Promise.all([
        ...[...slide.querySelectorAll('.device')].map(buildDevice),
        ...[...slide.querySelectorAll('img[data-shot]')].map(buildImage),
        ...[...slide.querySelectorAll('.callout[data-shot]')].map(buildCallout),
      ]);
      await document.fonts.ready;
      await Promise.all([...slide.querySelectorAll('img')].map((i) => i.decode().catch(() => {})));
      await frames(2);
      slide.querySelectorAll('[data-fit]').forEach(fitText);
      await frames(1);
      keepInside(slide);
      await frames(2);
      checkSlide(slide);
    })();
    await Promise.race([work, timeout]);
    root.classList.add('kit-ready');
    return true;
  }

  // ------------------------------------------------------------------ board (preview in a browser)
  async function buildBoard() {
    root.classList.add('kit-board');
    const ui = document.createElement('div');
    ui.className = 'kit-boardui';
    const opts = Object.entries(TARGETS)
      .filter(([id, t]) => (fileTargets.length ? fileTargets.includes(id) || !!t.kind === fileTargets.some((f) => TARGETS[f]?.kind) : true))
      .map(([id, t]) => `<option value="${id}"${id === targetId ? ' selected' : ''}>${t.label} — ${t.w}×${t.h}${fileTargets.includes(id) ? '' : ' (not in store-targets)'}</option>`).join('');
    const names = kit.slidesFor(targetId);
    const scale = Math.min(1, (T.w >= T.h ? 900 : 620) / T.h, 1200 / T.w);
    ui.innerHTML = `<header><strong>${document.title || 'Store assets'}</strong><select>${opts}</select><span>${names.length} image${names.length === 1 ? '' : 's'} · ${T.w}×${T.h}px · shown at ${Math.round(scale * 100)}%</span></header>
      <main>${names.map((n, i) => {
        const src = `?target=${encodeURIComponent(targetId)}&slide=${encodeURIComponent(n)}`;
        return `<figure><div class="kit-cell" style="width:${T.w * scale}px;height:${T.h * scale}px"><iframe loading="lazy" src="${src}" style="width:${T.w}px;height:${T.h}px;transform:scale(${scale})"></iframe></div><figcaption><a href="${src}" target="_blank">${String(i + 1).padStart(2, '0')} · ${n}</a></figcaption></figure>`;
      }).join('')}</main>`;
    ui.querySelector('select').addEventListener('change', (e) => { location.search = `?target=${e.target.value}`; });
    document.body.appendChild(ui);
    return true;
  }

  // ------------------------------------------------------------------ start
  if (params.get('kit') === 'meta') { kit.ready = Promise.resolve(true); return; }
  kit.target = { id: targetId, ...T };
  Object.assign(root.dataset, { target: targetId, store: T.store, platform: T.platform, form: T.form, orientation: T.w >= T.h ? 'landscape' : 'portrait' });
  root.style.setProperty('--target-w', T.w);
  root.style.setProperty('--target-h', T.h);

  const slideName = params.get('slide');
  if (!slideName) { kit.ready = buildBoard(); return; }
  root.classList.add('kit-render');
  const active = slides.find((s) => s.dataset.name === slideName);
  if (!active) { warn(`no slide named "${slideName}"`); kit.ready = Promise.resolve(false); return; }
  active.classList.add('kit-active');
  kit.ready = renderSlide(active).catch((e) => { warn(`kit error: ${e.message}`); return false; });
})();
