#!/usr/bin/env node
// Detect what kind of web project lives in a directory and how to run it.
//
//   node detect_project.mjs [projectDir] [--pretty]
//
// Prints one JSON object to stdout: framework, package manager, install/dev/preview
// commands, expected port, whether it looks like a game (and which engine + input keys),
// routes, brand hints (colors, fonts, logo files) and product copy (title, description).
// Everything here is a heuristic starting point; read the source to confirm.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const pretty = args.includes('--pretty');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.output', '.turbo', '.vercel',
  '.cache', '.parcel-cache', 'coverage', 'promo', 'store-assets', 'vendor', '__pycache__',
  '.venv', 'venv', 'target', 'Pods', '.expo', '.angular',
]);
const BUILD_DIRS = new Set(['dist', 'build', 'out', 'public', 'static', 'www', 'docs']);
const SRC_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue', '.svelte', '.astro', '.html', '.css', '.scss', '.gd', '.py']);

const exists = (...p) => fs.existsSync(path.join(...p));
const readText = (p, max = 400_000) => {
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > max) return '';
    return fs.readFileSync(p, 'utf8');
  } catch { return ''; }
};
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

function walk(dir, { maxFiles = 4000, includeBuild = false } = {}) {
  const out = [];
  const stack = [dir];
  while (stack.length && out.length < maxFiles) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env.example') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        if (!includeBuild && d === dir && BUILD_DIRS.has(e.name) && e.name !== 'public' && e.name !== 'static') continue;
        stack.push(full);
      } else out.push(full);
    }
  }
  return out;
}

// ---------- package manager / framework ----------

function detectPackageManager(dir, pkg) {
  if (pkg?.packageManager) return pkg.packageManager.split('@')[0];
  if (exists(dir, 'pnpm-lock.yaml')) return 'pnpm';
  if (exists(dir, 'yarn.lock')) return 'yarn';
  if (exists(dir, 'bun.lockb') || exists(dir, 'bun.lock')) return 'bun';
  return 'npm';
}

// Order matters: meta-frameworks before the bundlers they use.
const FRAMEWORKS = [
  { id: 'next', deps: ['next'], port: 3000 },
  { id: 'nuxt', deps: ['nuxt', 'nuxt3'], port: 3000 },
  { id: 'sveltekit', deps: ['@sveltejs/kit'], port: 5173 },
  { id: 'astro', deps: ['astro'], port: 4321 },
  { id: 'remix', deps: ['@remix-run/dev', '@react-router/dev'], port: 5173 },
  { id: 'solid-start', deps: ['@solidjs/start', 'solid-start'], port: 3000 },
  { id: 'tanstack-start', deps: ['@tanstack/react-start', '@tanstack/start'], port: 3000 },
  { id: 'qwik', deps: ['@builder.io/qwik-city'], port: 5173 },
  { id: 'angular', deps: ['@angular/cli', '@angular/core'], port: 4200 },
  { id: 'gatsby', deps: ['gatsby'], port: 8000 },
  { id: 'docusaurus', deps: ['@docusaurus/core'], port: 3000 },
  { id: 'vitepress', deps: ['vitepress'], port: 5173 },
  { id: 'expo', deps: ['expo'], port: 8081, devCommand: 'npx expo start --web' },
  { id: 'create-react-app', deps: ['react-scripts'], port: 3000 },
  { id: 'vue-cli', deps: ['@vue/cli-service'], port: 8080 },
  { id: 'ember', deps: ['ember-cli'], port: 4200 },
  { id: 'eleventy', deps: ['@11ty/eleventy'], port: 8080 },
  { id: 'vite', deps: ['vite'], port: 5173 },
  { id: 'parcel', deps: ['parcel', 'parcel-bundler'], port: 1234 },
  { id: 'webpack-dev-server', deps: ['webpack-dev-server'], port: 8080 },
  { id: 'electron', deps: ['electron'], port: null, note: 'Electron desktop app: if it has a web renderer dev server (e.g. electron-vite), capture that URL instead.' },
];

const GAME_LIBS = {
  phaser: 'Phaser', 'pixi.js': 'PixiJS', pixi: 'PixiJS', three: 'three.js', '@react-three/fiber': 'React Three Fiber',
  '@babylonjs/core': 'Babylon.js', babylonjs: 'Babylon.js', kaboom: 'Kaboom', kaplay: 'KAPLAY', excalibur: 'Excalibur',
  playcanvas: 'PlayCanvas', 'matter-js': 'Matter.js', p5: 'p5.js', littlejsengine: 'LittleJS', melonjs: 'melonJS',
  '@dimforge/rapier2d': 'Rapier', '@dimforge/rapier3d': 'Rapier', 'cannon-es': 'cannon-es', ogl: 'OGL', 'aframe': 'A-Frame',
  'excalibur-tiled': 'Excalibur', 'planck-js': 'Planck', 'ct.js': 'ct.js', 'impact': 'Impact',
};

function pickDevScript(scripts = {}) {
  for (const k of ['dev', 'start', 'serve', 'develop', 'dev:web', 'web', 'watch']) if (scripts[k]) return k;
  return null;
}

function runCmd(pm, script) {
  if (!script) return null;
  if (pm === 'npm') return script === 'start' ? 'npm start' : `npm run ${script}`;
  if (pm === 'yarn') return `yarn ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return `pnpm ${script}`;
}

function portFromScript(s = '') {
  const m = s.match(/(?:--port[ =]|-p[ =]?|PORT=)(\d{2,5})/);
  return m ? Number(m[1]) : null;
}

function portFromConfig(dir) {
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts', 'astro.config.mjs', 'nuxt.config.ts', 'angular.json']) {
    const t = readText(path.join(dir, f));
    const m = t.match(/port\s*[:=]\s*(\d{2,5})/);
    if (m) return Number(m[1]);
  }
  return null;
}

// ---------- non-node projects ----------

function detectNonNode(dir) {
  if (exists(dir, 'manage.py')) return { framework: 'django', devCommand: 'python manage.py runserver 8000', port: 8000 };
  const req = readText(path.join(dir, 'requirements.txt')) + readText(path.join(dir, 'pyproject.toml'));
  if (/fastapi/i.test(req)) return { framework: 'fastapi', devCommand: 'uvicorn main:app --reload --port 8000', port: 8000, note: 'Check the module path of the FastAPI app.' };
  if (/flask/i.test(req)) return { framework: 'flask', devCommand: 'flask run --port 5000', port: 5000 };
  if (/streamlit/i.test(req)) return { framework: 'streamlit', devCommand: 'streamlit run app.py --server.headless true --server.port 8501', port: 8501 };
  if (exists(dir, 'Gemfile') && exists(dir, 'config', 'routes.rb')) return { framework: 'rails', devCommand: 'bin/rails server -p 3000', port: 3000 };
  if (exists(dir, 'artisan')) return { framework: 'laravel', devCommand: 'php artisan serve --port 8000', port: 8000 };
  // Exported game builds and static sites: serve with the bundled static server.
  const htmlRoots = ['', 'dist', 'build', 'public', 'www', 'docs', 'web', 'export', 'html5game']
    .filter((d) => exists(dir, d, 'index.html'));
  if (htmlRoots.length) {
    const sub = htmlRoots[0];
    const serveDir = path.join(dir, sub);
    const subFiles = walk(serveDir, { maxFiles: 3000, includeBuild: true }).map((f) => path.relative(serveDir, f).replace(/\\/g, '/'));
    const isGodot = subFiles.some((r) => r.endsWith('.pck')) || /godot/i.test(readText(path.join(serveDir, 'index.html')));
    const isUnity = subFiles.some((r) => /Build\/.*\.loader\.js$/.test(r));
    const flags = [];
    if (isGodot) flags.push('--coop');
    return {
      framework: isGodot ? 'godot-web-export' : isUnity ? 'unity-webgl' : 'static',
      serveDir,
      devCommand: `node "${path.join(SCRIPT_DIR, 'static_server.mjs')}" "${serveDir}" --port 8080 ${flags.join(' ')}`.trim(),
      port: 8080,
      engine: isGodot ? 'Godot' : isUnity ? 'Unity' : null,
    };
  }
  return null;
}

// ---------- code scanning ----------

function scanCode(dir, files) {
  const keyHits = new Map();
  const bump = (k) => keyHits.set(k, (keyHits.get(k) || 0) + 1);
  const features = { canvas2d: false, webgl: false, rAF: false, pointerLock: false, gamepad: false, touch: false, audio: false, fullscreen: false };
  const routes = new Set();
  const colors = new Map();
  const fonts = new Set();
  let scanned = 0;

  for (const f of files) {
    const ext = path.extname(f);
    if (!SRC_EXT.has(ext)) continue;
    const t = readText(f, 300_000);
    if (!t) continue;
    scanned++;
    if (/getContext\(\s*['"]2d/.test(t)) features.canvas2d = true;
    if (/getContext\(\s*['"](webgl2?|experimental-webgl|webgpu)/.test(t) || /WebGLRenderer|new\s+Engine\(/.test(t)) features.webgl = true;
    if (/requestAnimationFrame/.test(t)) features.rAF = true;
    if (/requestPointerLock/.test(t)) features.pointerLock = true;
    if (/getGamepads/.test(t)) features.gamepad = true;
    if (/touchstart|pointerdown/.test(t)) features.touch = true;
    if (/new\s+(Audio|AudioContext|Howl)\b/.test(t)) features.audio = true;
    if (/requestFullscreen/.test(t)) features.fullscreen = true;

    // Keyboard input hints (KeyboardEvent.key / .code comparisons, switch cases, engine helpers).
    for (const m of t.matchAll(/\.(?:key|code)\s*===?\s*['"]([^'"]{1,12})['"]/g)) bump(m[1]);
    for (const m of t.matchAll(/case\s+['"](Arrow\w+|Key[A-Z]|Digit\d|Space|Enter|Escape|Shift\w*|[a-zA-Z ])['"]\s*:/g)) bump(m[1]);
    for (const m of t.matchAll(/(?:\.has\(|\[)\s*['"](Arrow\w+|Key[A-Z]|Digit\d|Space|Enter|Escape|Shift\w*|Control\w*)['"]/g)) bump(m[1]);
    for (const m of t.matchAll(/addKeys?\(\s*['"]([A-Z_,\s]+)['"]/g)) m[1].split(',').forEach((k) => bump(k.trim()));
    for (const m of t.matchAll(/KeyCodes\.([A-Z_]+)/g)) bump(m[1]);
    if (/createCursorKeys\(\)/.test(t)) ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Shift'].forEach(bump);
    for (const m of t.matchAll(/(?:isKeyDown|onKeyPress|onKeyDown|isKeyPressed|keyIsDown)\(\s*['"]([^'"]{1,12})['"]/g)) bump(m[1]);

    // Hash routes (href="#/stats", location.hash = '#/x', router configs with '#/').
    for (const m of t.matchAll(/(?:href=|location\.hash\s*=\s*|navigate\(\s*)["'`]#(\/[\w\/-]*)["'`]/g)) routes.add('/#' + m[1]);
    // Routes (react-router, vue-router, angular, express-ish).
    for (const m of t.matchAll(/<Route[^>]*\spath=["']([^"']+)["']/g)) routes.add(m[1]);
    if (/createBrowserRouter|createRouter|RouterModule|Routes\s*=/.test(t)) {
      for (const m of t.matchAll(/path:\s*["'`]([^"'`]*)["'`]/g)) routes.add(m[1].startsWith('/') ? m[1] : '/' + m[1]);
    }

    // Brand colors: CSS custom properties and tailwind theme entries with brand-ish names.
    for (const m of t.matchAll(/--(?:color-)?(primary|brand|accent|secondary|background|bg|foreground)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) colors.set(m[1], colors.get(m[1]) || m[2]);
    for (const m of t.matchAll(/\b(primary|brand|accent)\s*:\s*['"](#[0-9a-fA-F]{3,8})['"]/g)) colors.set(m[1], colors.get(m[1]) || m[2]);

    // Fonts.
    for (const m of t.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^&"':]+)/g)) fonts.add(decodeURIComponent(m[1]).replace(/\+/g, ' '));
    for (const m of t.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](?:next\/font\/google|@next\/font\/google)['"]/g)) m[1].split(',').forEach((x) => fonts.add(x.trim().replace(/_/g, ' ')));
    for (const m of t.matchAll(/@fontsource(?:-variable)?\/([\w-]+)/g)) fonts.add(m[1].replace(/-/g, ' '));
    for (const m of t.matchAll(/font-family\s*:\s*['"]?([A-Z][\w ]+?)['"]?\s*[,;]/g)) if (!/system|inherit|sans|serif|mono/i.test(m[1])) fonts.add(m[1].trim());
  }

  const keys = [...keyHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k]) => (k === ' ' ? 'Space' : k));
  return { scanned, features, keys, routes: [...routes].filter((r) => r && !r.includes('*')).slice(0, 40), colors: Object.fromEntries(colors), fonts: [...fonts].slice(0, 6) };
}

function fileRoutes(dir) {
  const routes = new Set();
  const add = (base, f, strip) => {
    let r = '/' + path.relative(base, f).replace(/\\/g, '/').replace(strip, '');
    r = r.replace(/\/index$/, '/').replace(/\/page$/, '/').replace(/\/\+page$/, '/').replace(/\/\([^)]+\)/g, '').replace(/\/+/g, '/');
    if (/\[|_app|_document|_layout|layout|api\//.test(r)) return;
    routes.add(r.length > 1 ? r.replace(/\/$/, '') : '/');
  };
  const scan = (base, re, strip) => {
    if (!fs.existsSync(base)) return;
    for (const f of walk(base, { maxFiles: 800 })) if (re.test(f)) add(base, f, strip);
  };
  for (const b of ['app', 'src/app']) scan(path.join(dir, b), /\/page\.(tsx|jsx|js|ts|mdx)$/, /\.(tsx|jsx|js|ts|mdx)$/);
  for (const b of ['pages', 'src/pages']) scan(path.join(dir, b), /\.(tsx|jsx|js|ts|vue|astro|md|mdx)$/, /\.(tsx|jsx|js|ts|vue|astro|md|mdx)$/);
  scan(path.join(dir, 'src/routes'), /\+page\.svelte$/, /\.svelte$/);
  return [...routes].slice(0, 40);
}

function brandFromHtmlAndManifest(dir) {
  const out = { themeColor: null, backgroundColor: null, title: null, description: null };
  for (const p of ['index.html', 'public/index.html', 'src/index.html', 'src/app.html']) {
    const t = readText(path.join(dir, p));
    if (!t) continue;
    out.title ||= t.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    out.description ||= t.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i)?.[1] || null;
    out.themeColor ||= t.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)/i)?.[1] || null;
  }
  for (const p of ['public/manifest.json', 'public/site.webmanifest', 'public/manifest.webmanifest', 'static/manifest.json', 'manifest.json', 'manifest.webmanifest', 'site.webmanifest']) {
    const j = readJson(path.join(dir, p));
    if (!j) continue;
    out.themeColor ||= j.theme_color || null;
    out.backgroundColor ||= j.background_color || null;
    out.title ||= j.name || null;
  }
  return out;
}

function findLogos(dir, files) {
  return files
    .map((f) => path.relative(dir, f))
    .filter((r) => /(^|\/)(logo|icon|favicon|apple-touch-icon|brand|wordmark|og-image|opengraph-image|og)[\w.-]*\.(svg|png|jpe?g|webp|ico)$/i.test(r))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 10);
  function score(r) {
    let s = 0;
    if (/logo|wordmark|brand/i.test(r)) s += 5;
    if (/\.svg$/i.test(r)) s += 3;
    if (/og/i.test(r)) s += 1;
    if (/\.ico$/i.test(r)) s -= 3;
    return s;
  }
}

function readmeSummary(dir) {
  const f = ['README.md', 'readme.md', 'README.MD', 'Readme.md'].map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));
  if (!f) return null;
  const t = readText(f, 200_000);
  const heading = t.match(/^#\s+(.+)$/m)?.[1]?.trim() || null;
  const para = t.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('[!') && !s.startsWith('<') && !s.startsWith('![') && s.length > 40) || null;
  return { file: path.relative(dir, f), heading, firstParagraph: para?.slice(0, 500) || null };
}

function workspacePackages(dir, pkg) {
  let globs = [];
  if (Array.isArray(pkg?.workspaces)) globs = pkg.workspaces;
  else if (pkg?.workspaces?.packages) globs = pkg.workspaces.packages;
  const pnpmWs = readText(path.join(dir, 'pnpm-workspace.yaml'));
  if (pnpmWs) globs.push(...[...pnpmWs.matchAll(/-\s*['"]?([^'"\n]+)['"]?/g)].map((m) => m[1].trim()));
  const found = [];
  for (const g of globs) {
    const base = g.replace(/\/\*.*$/, '');
    const abs = path.join(dir, base);
    if (!fs.existsSync(abs)) continue;
    const candidates = g.includes('*') ? fs.readdirSync(abs).map((n) => path.join(abs, n)) : [abs];
    for (const c of candidates) {
      const p = readJson(path.join(c, 'package.json'));
      if (p?.scripts && pickDevScript(p.scripts)) found.push(path.relative(dir, c));
    }
  }
  return found;
}

// ---------- mobile target

function storeStatus(linked, readme, re) {
  if (linked) return 'listed';
  const m = readme.match(new RegExp(`.{0,80}(?:${re.source}).{0,80}`, 'i'));
  if (!m) return false;
  return /coming|soon|planned|upcoming|launching|will be|waitlist|beta/i.test(m[0]) ? 'coming-soon' : 'mentioned';
}


// Signals that the web app/game is meant for phones/tablets (or ships to the app stores via a
// wrapper). The video should then use phone/tablet frames and mobile-viewport captures.
function detectMobile(dir, pkg, files, features) {
  const signals = [];
  const storeLinks = new Set();
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const wrappers = {
    '@capacitor/core': 'Capacitor', '@capacitor/ios': 'Capacitor iOS', '@capacitor/android': 'Capacitor Android',
    'cordova-android': 'Cordova', 'cordova-ios': 'Cordova', '@ionic/core': 'Ionic', '@ionic/react': 'Ionic', '@ionic/angular': 'Ionic', '@ionic/vue': 'Ionic',
    'react-native-web': 'React Native Web', expo: 'Expo', 'framework7': 'Framework7', 'onsenui': 'Onsen UI', '@nativescript/core': 'NativeScript',
    'tauri-plugin-mobile': 'Tauri mobile', '@tauri-apps/cli': null,
  };
  for (const [d, label] of Object.entries(wrappers)) if (label && d in deps) signals.push(`dependency: ${label} (${d})`);
  for (const f of ['capacitor.config.ts', 'capacitor.config.json', 'capacitor.config.js', 'config.xml', 'app.json', 'eas.json', 'twa-manifest.json']) {
    if (!exists(dir, f)) continue;
    if (f === 'app.json' && !/"expo"/.test(readText(path.join(dir, f)))) continue;
    if (f === 'config.xml' && !/cordova|widget/i.test(readText(path.join(dir, f)))) continue;
    signals.push(`config: ${f}`);
  }
  for (const d of ['android', 'ios']) if (exists(dir, d) && fs.statSync(path.join(dir, d)).isDirectory()) signals.push(`native project folder: ${d}/`);

  let orientation = null;
  for (const p of ['public/manifest.json', 'public/site.webmanifest', 'public/manifest.webmanifest', 'static/manifest.json', 'manifest.json', 'manifest.webmanifest', 'src/manifest.json']) {
    const j = readJson(path.join(dir, p));
    if (!j) continue;
    if (['standalone', 'fullscreen'].includes(j.display)) signals.push(`PWA manifest display: ${j.display}`);
    if (j.orientation) { orientation = /landscape/.test(j.orientation) ? 'landscape' : /portrait/.test(j.orientation) ? 'portrait' : null; signals.push(`manifest orientation: ${j.orientation}`); }
  }
  for (const p of ['index.html', 'public/index.html', 'src/index.html', 'src/app.html']) {
    const t = readText(path.join(dir, p));
    if (!t) continue;
    if (/apple-mobile-web-app-capable/.test(t)) signals.push(`${p}: apple-mobile-web-app-capable`);
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(t)) signals.push(`${p}: zoom disabled in viewport meta (app-like)`);
    if (/screen\.orientation\.lock|orientation:\s*portrait/.test(t)) signals.push(`${p}: orientation lock`);
  }
  // Store links / mentions in README and source.
  const textFiles = files.filter((f) => /\.(md|html|tsx?|jsx?|vue|svelte|json)$/.test(f)).slice(0, 1500);
  for (const f of textFiles) {
    const t = readText(f, 200_000);
    for (const m of t.matchAll(/https?:\/\/(?:play\.google\.com\/store\/apps\/details\?id=[\w.]+|apps\.apple\.com\/[^\s"')<]+)/g)) storeLinks.add(m[0]);
  }
  if (storeLinks.size) signals.push('app store links found');
  const readme = readText(path.join(dir, 'README.md'));
  if (/\b(app store|play store|google play|ios and android|android and ios|mobile game|mobile app|iphone|ipad)\b/i.test(readme)) signals.push('README mentions mobile / app stores');
  if (features.touch && features.canvas2d) signals.push('canvas + touch input');

  const tablet = /\b(ipad|tablet)\b/i.test(readme) || signals.some((x) => /tablet/i.test(x));
  const strong = signals.filter((x) => !/canvas \+ touch|zoom disabled/.test(x)).length;
  return {
    likely: strong >= 1,
    signals,
    native: nativeInfo(dir),
    storeLinks: [...storeLinks].slice(0, 6),
    // listed = a real store URL was found; coming-soon = README says it's on the way;
    // mentioned = named but unclear. Only `listed` stores should get badges without asking.
    stores: {
      appStore: storeStatus([...storeLinks].some((l) => l.includes('apps.apple.com')), readme, /\bapp store\b|\bios\b|\biphone\b/i),
      googlePlay: storeStatus([...storeLinks].some((l) => l.includes('play.google.com')), readme, /\bplay store\b|\bgoogle play\b|\bandroid\b/i),
    },
    suggestedDevice: tablet ? 'tablet' : 'phone',
    orientation,
  };
}

// What the store listing needs to know about the native wrapper: app id/name, whether the iOS
// build also runs on iPad (then App Store Connect requires iPad screenshots), and icon sources.
function nativeInfo(dir) {
  const out = { wrapper: null, appId: null, appName: null, ios: false, android: false, iosSupportsIpad: null, orientations: null, iconCandidates: [] };
  for (const f of ['capacitor.config.json', 'capacitor.config.ts', 'capacitor.config.js']) {
    const t = readText(path.join(dir, f));
    if (!t) continue;
    out.wrapper = 'capacitor';
    out.appId = t.match(/appId['"]?\s*:\s*['"]([^'"]+)/)?.[1] || null;
    out.appName = t.match(/appName['"]?\s*:\s*['"]([^'"]+)/)?.[1] || null;
    break;
  }
  const cfg = readText(path.join(dir, 'config.xml'));
  if (!out.wrapper && /<widget/.test(cfg)) {
    out.wrapper = 'cordova';
    out.appId = cfg.match(/<widget[^>]*\sid=["']([^"']+)/)?.[1] || null;
    out.appName = cfg.match(/<name>([^<]+)<\/name>/)?.[1]?.trim() || null;
  }
  const twa = readJson(path.join(dir, 'twa-manifest.json'));
  if (!out.wrapper && twa) { out.wrapper = 'twa'; out.appId = twa.packageId || null; out.appName = twa.name || null; out.android = true; }
  const expo = readJson(path.join(dir, 'app.json'))?.expo;
  if (!out.wrapper && expo) {
    out.wrapper = 'expo'; out.appName = expo.name || null; out.appId = expo.ios?.bundleIdentifier || expo.android?.package || null;
    out.iosSupportsIpad = expo.ios?.supportsTablet ?? null;
  }
  out.android ||= exists(dir, 'android');
  out.ios = exists(dir, 'ios');

  // Xcode: TARGETED_DEVICE_FAMILY = "1,2" means iPhone + iPad (Capacitor's default).
  const findPbx = (base, depth = 0) => {
    if (depth > 3 || !fs.existsSync(base)) return null;
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'Pods' || e.name === 'node_modules') continue;
      const p = path.join(base, e.name);
      if (e.name.endsWith('.xcodeproj') && exists(p, 'project.pbxproj')) return path.join(p, 'project.pbxproj');
      const r = findPbx(p, depth + 1);
      if (r) return r;
    }
    return null;
  };
  const pbx = out.ios ? findPbx(path.join(dir, 'ios')) : null;
  if (pbx) {
    const fam = [...readText(pbx, 2_000_000).matchAll(/TARGETED_DEVICE_FAMILY\s*=\s*"?([\d,]+)"?/g)].map((m) => m[1]);
    if (fam.length) out.iosSupportsIpad = fam.some((f) => f.split(',').includes('2'));
    out.xcodeProject = path.relative(dir, pbx);
  }
  const plist = out.ios ? readText(path.join(dir, 'ios', 'App', 'App', 'Info.plist')) : '';
  const ori = plist.match(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1];
  if (ori) out.orientations = [...ori.matchAll(/UIInterfaceOrientation(\w+)/g)].map((m) => m[1]);
  const manifestXml = readText(path.join(dir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
  const so = manifestXml.match(/android:screenOrientation=["'](\w+)/)?.[1];
  if (so) out.androidOrientation = so;

  // Large source icons first: store icons are 1024 (App Store) and 512 (Google Play).
  const iconGlobs = [
    'resources/icon.png', 'resources/icon.svg', 'assets/icon.png', 'assets/icon.svg', 'assets/images/icon.png', 'icon.png', 'icon.svg',
    'public/icon-512.png', 'public/icon-512x512.png', 'public/pwa-512x512.png', 'public/android-chrome-512x512.png', 'public/icons/icon-512x512.png',
    'public/apple-touch-icon.png', 'public/logo.svg', 'public/favicon.svg',
  ];
  for (const g of iconGlobs) if (exists(dir, g)) out.iconCandidates.push(g);
  const appIconSet = path.join(dir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (fs.existsSync(appIconSet)) for (const f of fs.readdirSync(appIconSet)) if (/\.png$/i.test(f)) out.iconCandidates.push(path.relative(dir, path.join(appIconSet, f)));
  const mip = path.join(dir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi');
  if (fs.existsSync(mip)) for (const f of fs.readdirSync(mip)) if (/^ic_launcher(\.|_foreground)/.test(f)) out.iconCandidates.push(path.relative(dir, path.join(mip, f)));
  return out;
}

// ---------- main ----------

function detect(dir) {
  const result = { root: dir, name: path.basename(dir), kind: 'webapp', framework: 'unknown', warnings: [] };
  const pkg = readJson(path.join(dir, 'package.json'));
  const files = walk(dir);

  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const pm = detectPackageManager(dir, pkg);
    const fw = FRAMEWORKS.find((f) => f.deps.some((d) => d in deps));
    const devScript = pickDevScript(pkg.scripts);
    Object.assign(result, {
      name: pkg.name || result.name,
      description: pkg.description || null,
      packageManager: pm,
      framework: fw?.id || (devScript ? 'node-custom' : 'node-unknown'),
      installCommand: pm === 'npm' ? (exists(dir, 'package-lock.json') ? 'npm ci' : 'npm install') : `${pm} install`,
      needsInstall: !exists(dir, 'node_modules'),
      devScript,
      devCommand: fw?.devCommand || runCmd(pm, devScript),
      buildCommand: pkg.scripts?.build ? runCmd(pm, 'build') : null,
      previewCommand: pkg.scripts?.preview ? runCmd(pm, 'preview') : null,
      port: portFromScript(pkg.scripts?.[devScript]) || portFromConfig(dir) || fw?.port || 3000,
    });
    if (fw?.note) result.warnings.push(fw.note);
    const gameLibs = [...new Set(Object.keys(deps).filter((d) => d in GAME_LIBS).map((d) => GAME_LIBS[d]))];
    if (gameLibs.length) { result.kind = 'game'; result.engine = gameLibs.join(', '); }
    const ws = workspacePackages(dir, pkg);
    if (ws.length) {
      result.workspaces = ws;
      result.warnings.push(`Monorepo: run this script on the app package you want to capture (candidates: ${ws.join(', ')}).`);
    }
    if (!devScript && !fw) result.warnings.push('No dev/start script found; check README for how to run it.');
  } else {
    const nn = detectNonNode(dir);
    if (nn) {
      Object.assign(result, nn);
      if (nn.engine) { result.kind = 'game'; }
    } else {
      result.warnings.push('Could not determine how to run this project. Read the README and ask the user if unclear.');
    }
  }

  const code = scanCode(dir, files);
  if (result.kind !== 'game' && (code.features.canvas2d || code.features.webgl) && code.features.rAF && code.keys.length >= 2) {
    result.kind = 'game';
    result.engine ||= code.features.webgl ? 'custom WebGL' : 'custom canvas';
  }
  result.input = { keys: code.keys, pointerLock: code.features.pointerLock, gamepad: code.features.gamepad, touchOrPointer: code.features.touch };
  result.features = code.features;
  result.routes = [...new Set(['/', ...fileRoutes(dir), ...code.routes])].slice(0, 40);
  result.mobile = detectMobile(dir, pkg, files, code.features);

  const html = brandFromHtmlAndManifest(dir);
  result.title = html.title || result.title || null;
  result.description ||= html.description || null;
  result.readme = readmeSummary(dir);
  result.brand = {
    themeColor: html.themeColor,
    backgroundColor: html.backgroundColor,
    cssColors: code.colors,
    fonts: code.fonts,
    logoCandidates: findLogos(dir, files),
  };

  if (exists(dir, '.env.example') && !exists(dir, '.env') && !exists(dir, '.env.local')) {
    result.warnings.push('.env.example exists but no .env: the app may need environment variables before it runs.');
  }
  if (result.kind === 'game' && result.features?.webgl) {
    result.warnings.push('WebGL game: capture with --headed if headless frame rate is poor (see references/capture.md).');
  }
  if (result.kind === 'game' && result.previewCommand) {
    result.warnings.push('Games usually run smoother from a production build: consider buildCommand then previewCommand.');
  }
  return result;
}

const out = detect(root);
process.stdout.write(JSON.stringify(out, null, pretty ? 2 : 0) + '\n');
