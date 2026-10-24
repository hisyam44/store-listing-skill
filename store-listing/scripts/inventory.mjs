#!/usr/bin/env node
// Feature inventory: what the app or game can actually do, with evidence, to ground the store
// listing copy (and the screenshot headlines) in the code instead of guesses.
//
//   node inventory.mjs [projectDir] [--pretty] [--out store-assets/inventory.json]
//
// Reports capabilities found in dependencies, native plugins and code patterns (each with
// file:line evidence), monetization (ads, in-app purchases, subscriptions), native permissions,
// UI locales, routes, the app's own UI vocabulary (headings, buttons, i18n strings), README
// feature bullets and game traits. It's a lead list: confirm each item in the code before
// writing it into the listing, and drop anything that isn't shipped.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const root = path.resolve(positional[0] || '.');

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', '.output', 'coverage', 'store-assets', 'promo', 'Pods', '.gradle', 'www', 'out', '.angular', '.expo', 'vendor', 'target']);
const SRC = /\.(js|jsx|ts|tsx|mjs|vue|svelte|astro|html|css|scss|json|gd|cs)$/;
const read = (f, max = 600_000) => { try { const st = fs.statSync(f); return st.size > max ? '' : fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const rel = (f) => path.relative(root, f);

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(dir === root && ['android', 'ios'].includes(e.name))) walk(p, out); }
    else if (SRC.test(e.name) && !/\.min\.|lock\.json$|package-lock/.test(e.name)) out.push(p);
    if (out.length > 5000) break;
  }
  return out;
}

const detect = JSON.parse(execFileSync(process.execPath, [path.join(SCRIPTS, 'detect_project.mjs'), root], { encoding: 'utf8' }));
const pkg = readJson(path.join(root, 'package.json')) || {};
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const files = walk(root);
const texts = new Map(files.map((f) => [f, read(f)]));

// ---------------------------------------------------------------- capability rules
// deps: package names (prefix match with *); code: regexes searched in source files.
const RULES = [
  ['camera', 'Camera / photo capture', { deps: ['@capacitor/camera', 'cordova-plugin-camera', 'expo-camera', 'expo-image-picker'], code: [/getUserMedia\s*\(/, /capture=["'](user|environment)/] }],
  ['photos', 'Photo library import', { code: [/type=["']file["'][^>]*accept=["']image/, /accept=["']image\/\*/] }],
  ['scan', 'Barcode / QR scanning', { deps: ['@capacitor-mlkit/barcode-scanning', '@capacitor/barcode-scanner', '@capacitor-community/barcode-scanner', 'html5-qrcode', '@zxing/*', 'jsqr', 'quagga*'], code: [/BarcodeDetector/] }],
  ['location', 'Location / maps', { deps: ['@capacitor/geolocation', '@capacitor/google-maps', 'leaflet', 'mapbox-gl', 'maplibre-gl', '@react-google-maps/*', 'expo-location'], code: [/navigator\.geolocation/] }],
  ['push', 'Push notifications', { deps: ['@capacitor/push-notifications', '@capacitor-firebase/messaging', 'onesignal-cordova-plugin', 'firebase/messaging'], code: [/PushNotifications\./, /getMessaging\(/] }],
  ['reminders', 'Reminders / local notifications', { deps: ['@capacitor/local-notifications', 'expo-notifications'], code: [/LocalNotifications\.schedule/, /new Notification\(/, /Notification\.requestPermission/] }],
  ['offline', 'Works offline (service worker / local data)', { deps: ['vite-plugin-pwa', 'workbox-*', '@angular/service-worker', 'next-pwa', '@vite-pwa/*'], code: [/serviceWorker\.register/] }],
  ['local-storage', 'Saves data on the device', { deps: ['@capacitor/preferences', '@capacitor-community/sqlite', 'dexie', 'idb', 'localforage', '@ionic/storage', 'pouchdb*'], code: [/localStorage\.setItem/, /indexedDB\.open/] }],
  ['accounts', 'Accounts / sign-in', { deps: ['firebase', '@firebase/auth', '@supabase/supabase-js', 'aws-amplify', '@auth0/*', 'next-auth', '@clerk/*', '@capacitor-firebase/authentication', '@capacitor-community/apple-sign-in', '@codetrix-studio/capacitor-google-auth'], code: [/signInWith\w+\(/, /createUserWithEmailAndPassword/] }],
  ['sync', 'Cloud sync across devices', { deps: ['firebase', '@supabase/supabase-js', 'pouchdb*', '@react-native-firebase/firestore', 'convex', '@instantdb/*', 'replicache'], code: [/onSnapshot\(/, /\.channel\(["']/] }],
  ['share', 'Share to other apps', { deps: ['@capacitor/share'], code: [/navigator\.share\(/, /Share\.share\(/] }],
  ['export', 'Export (PDF / CSV / files)', { deps: ['jspdf', 'pdfmake', 'html2pdf.js', 'papaparse', 'xlsx', 'exceljs', 'file-saver', '@capacitor/filesystem'], code: [/new Blob\(\[[^\]]*\][^)]*type:\s*["'](text\/csv|application\/pdf|application\/json)/, /download\s*=\s*["'`][^"'`]+\.(csv|pdf|json|txt)/] }],
  ['import', 'Import from files or other apps', { code: [/FileReader\(\)/, /\.readAsText\(/, /type=["']file["']/] }],
  ['charts', 'Charts and stats', { deps: ['chart.js', 'react-chartjs-2', 'recharts', 'apexcharts', 'echarts', 'd3', 'victory*', '@nivo/*', 'uplot', 'lightweight-charts'] }],
  ['calendar', 'Calendar / scheduling', { deps: ['@fullcalendar/*', 'react-big-calendar', 'v-calendar', '@capacitor-community/calendar'] }],
  ['dark-mode', 'Dark mode', { code: [/prefers-color-scheme:\s*dark/, /data-theme=["']dark/, /\.dark\s+[.#\w]|class(Name)?=["'][^"']*\bdark:/] }],
  ['i18n', 'Multiple languages', { deps: ['i18next', 'react-i18next', 'vue-i18n', '@ngx-translate/core', '@angular/localize', 'react-intl', 'svelte-i18n', '@lingui/*', 'next-intl'] }],
  ['search', 'Search', { deps: ['fuse.js', 'minisearch', 'flexsearch', 'algoliasearch', 'meilisearch'], code: [/type=["']search["']/, /placeholder=["'][^"']*[Ss]earch/] }],
  ['editor', 'Rich text / notes editor', { deps: ['@tiptap/*', 'quill', 'lexical', '@lexical/*', 'slate', 'prosemirror-*', 'draft-js', 'easymde', 'codemirror', '@codemirror/*'] }],
  ['ai', 'AI features', { deps: ['openai', '@anthropic-ai/sdk', 'ai', '@ai-sdk/*', '@google/generative-ai', '@google/genai', '@mlc-ai/*', '@tensorflow/*', 'onnxruntime-web', '@huggingface/*'] }],
  ['ocr', 'Text recognition (OCR)', { deps: ['tesseract.js', '@capacitor-mlkit/text-recognition'] }],
  ['audio', 'Audio / music / sound', { deps: ['howler', 'tone', 'wavesurfer.js', '@capacitor-community/native-audio', 'expo-av'], code: [/new (Audio|AudioContext)\(/] }],
  ['voice', 'Voice input / speech', { deps: ['@capacitor-community/speech-recognition', '@capacitor-community/text-to-speech'], code: [/SpeechRecognition|webkitSpeechRecognition/, /speechSynthesis\.speak/] }],
  ['video', 'Video', { deps: ['video.js', 'hls.js', 'plyr', 'react-player', 'shaka-player'], code: [/<video[\s>]/] }],
  ['haptics', 'Haptic feedback', { deps: ['@capacitor/haptics'], code: [/navigator\.vibrate\(/] }],
  ['biometrics', 'Face ID / fingerprint lock', { deps: ['capacitor-native-biometric', '@aparajita/capacitor-biometric-auth', '@capgo/capacitor-native-biometric', 'expo-local-authentication'] }],
  ['health', 'Apple Health / Health Connect', { deps: ['capacitor-health', '@perfood/capacitor-healthkit', '@capgo/capacitor-health', 'capacitor-health-connect'] }],
  ['widgets', 'Home-screen widgets', { deps: ['@capacitor-community/widget*', 'capacitor-widgetsbridge-plugin'] }],
  ['realtime', 'Real-time / multiplayer', { deps: ['socket.io-client', 'colyseus.js', 'peerjs', 'ably', 'pusher-js', '@supabase/realtime-js', 'partysocket', 'yjs'], code: [/new WebSocket\(/] }],
  ['collab', 'Collaboration / sharing with others', { deps: ['yjs', 'liveblocks', '@liveblocks/*', 'automerge*'] }],
  ['payments', 'Payments (Stripe etc.)', { deps: ['@stripe/*', 'stripe', '@capacitor-community/stripe', 'braintree-web', '@paypal/*'] }],
  ['gamepad', 'Controller support', { code: [/getGamepads\(/] }],
  ['fullscreen', 'Fullscreen play', { code: [/requestFullscreen\(/] }],
  ['leaderboards', 'Leaderboards / achievements', { deps: ['@openforge/capacitor-game-connect', 'capacitor-game-services', '@capgo/capacitor-game-center'], code: [/leaderboard/i, /achievement/i] }],
  ['review-prompt', 'In-app review prompt', { deps: ['@capacitor-community/in-app-review', '@capacitor-community/app-review'] }],
];
const MONEY = [
  ['ads', 'Ads', { deps: ['@capacitor-community/admob', 'admob-plus-cordova', 'cordova-plugin-admob*', 'react-native-google-mobile-ads', '@capacitor-community/appodeal', 'applovin*', 'unity-ads*'], code: [/adsbygoogle/, /AdMob\./, /googletag\./] }],
  ['iap', 'In-app purchases', { deps: ['cordova-plugin-purchase', '@revenuecat/purchases-capacitor', '@capgo/native-purchases', 'capacitor-plugin-purchase', 'react-native-iap', 'expo-in-app-purchases'], code: [/CdvPurchase|InAppPurchase|purchasePackage\(/] }],
  ['subscriptions', 'Subscriptions', { deps: ['@revenuecat/purchases-capacitor'], code: [/subscription|entitlement|PAID_SUBSCRIPTION|\bpremium\b|\bpro plan\b/i] }],
];

const depMatch = (want) => Object.keys(deps).filter((d) => (want.endsWith('*') ? d.startsWith(want.slice(0, -1)) : d === want));
function evidence(rule) {
  const ev = [];
  for (const w of rule.deps || []) for (const d of depMatch(w)) ev.push(`package.json: ${d}`);
  for (const re of rule.code || []) {
    for (const [f, t] of texts) {
      if (!t || /\.json$/.test(f)) continue;
      const m = t.match(re);
      if (!m) continue;
      const line = t.slice(0, m.index).split('\n').length;
      const snippet = t.split('\n')[line - 1].trim().slice(0, 90);
      ev.push(`${rel(f)}:${line}  ${snippet}`);
      if (ev.length >= 4) break;
    }
  }
  return [...new Set(ev)].slice(0, 4);
}
const run = (rules) => rules.map(([id, label, rule]) => ({ id, label, evidence: evidence(rule) })).filter((c) => c.evidence.length);

// ---------------------------------------------------------------- permissions
function permissions() {
  const out = { android: [], ios: [] };
  const man = read(path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
  for (const m of man.matchAll(/uses-permission[^>]*android:name="android\.permission\.(\w+)"/g)) out.android.push(m[1]);
  const plist = read(path.join(root, 'ios', 'App', 'App', 'Info.plist'));
  for (const m of plist.matchAll(/<key>(NS\w+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g)) out.ios.push({ key: m[1], text: m[2] });
  const cfg = readJson(path.join(root, 'config.xml')) ? null : read(path.join(root, 'config.xml'));
  if (cfg) for (const m of cfg.matchAll(/<edit-config[^>]*target="(NS\w+UsageDescription)"/g)) out.ios.push({ key: m[1] });
  return out;
}

// ---------------------------------------------------------------- locales
function locales() {
  const found = new Set();
  for (const f of files) {
    const m = rel(f).match(/(?:^|\/)(?:locales?|i18n|lang|translations|messages)\/([a-z]{2}(?:[-_][A-Za-z]{2,4})?)(?:\/|\.json$|\.js$|\.ts$|\.ya?ml$)/);
    if (m) found.add(m[1].replace('_', '-'));
  }
  return [...found].sort();
}

// ---------------------------------------------------------------- UI vocabulary
// The words the app itself uses (headings, buttons, tabs, titles, i18n strings): the listing
// should talk about features by these names.
function vocabulary() {
  const seen = new Map();
  const add = (s, where) => {
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length < 3 || s.length > 60 || /[{}<>$=;]|^\W+$|^[a-z0-9_.-]+$/.test(s) || /lorem|todo|xxx/i.test(s)) return;
    if (!seen.has(s)) seen.set(s, where);
  };
  for (const [f, t] of texts) {
    if (!t) continue;
    if (/\.json$/.test(f) && /(?:^|\/)(?:locales?|i18n|lang|translations|messages)\/(en|en-US)/.test(rel(f))) {
      const walkJ = (o) => { for (const v of Object.values(o || {})) typeof v === 'string' ? add(v, rel(f)) : typeof v === 'object' && walkJ(v); };
      try { walkJ(JSON.parse(t)); } catch {}
      continue;
    }
    for (const m of t.matchAll(/<(h[1-3]|button|label|th|legend|summary)\b[^>]*>([^<${}]{3,60})</g)) add(m[2], `${rel(f)} <${m[1]}>`);
    for (const m of t.matchAll(/<(\w+)\b[^>]*class=["'][^"']*\b(btn|button|tab|chip|cta|title|heading)\b[^"']*["'][^>]*>([^<${}]{3,60})</g)) add(m[3], `${rel(f)} .${m[2]}`);
    for (const m of t.matchAll(/\b(?:title|label|heading|placeholder|aria-label|tooltip)\s*[:=]\s*["'`]([^"'`$]{3,60})["'`]/g)) add(m[1], rel(f));
    for (const m of t.matchAll(/fillText\(\s*["'`]([^"'`$]{3,40})["'`]/g)) add(m[1], `${rel(f)} canvas`);
  }
  return [...seen.entries()].slice(0, 80).map(([text, where]) => ({ text, where }));
}

function readmeFeatures() {
  const f = ['README.md', 'readme.md'].map((n) => path.join(root, n)).find((p) => fs.existsSync(p));
  if (!f) return [];
  const t = read(f);
  const sec = t.match(/^#{1,3}\s*(features|what it does|highlights|key features)[^\n]*\n([\s\S]*?)(?=^#{1,3}\s|\Z)/im);
  return sec ? [...sec[2].matchAll(/^\s*[-*]\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 30) : [];
}

function gameTraits() {
  if (detect.kind !== 'game') return null;
  const all = [...texts.values()].join('\n');
  const levelFiles = files.filter((f) => /(^|\/)levels?\//i.test(rel(f))).length;
  return {
    engine: detect.engine || null,
    input: detect.input,
    levelFiles,
    highScore: /high[\s_-]?score|best[\s_-]?score|\bbest\b\s*[:=]/i.test(all),
    levels: /\blevel\s*\d|levels\s*[:=]\s*\[|currentLevel|levelIndex/i.test(all),
    powerUps: /power[\s_-]?ups?|boosters?/i.test(all),
    characters: /skins?\b|characters?\s*[:=]\s*\[|unlock(ed|able)?/i.test(all),
    dailyRewards: /daily[\s_-]?(reward|bonus|challenge)/i.test(all),
    tutorial: /tutorial|how to play/i.test(all),
    sound: detect.features?.audio || false,
  };
}

const result = {
  app: {
    name: detect.mobile?.native?.appName || detect.title || pkg.name || path.basename(root),
    appId: detect.mobile?.native?.appId || null,
    wrapper: detect.mobile?.native?.wrapper || null,
    kind: detect.kind, engine: detect.engine || null,
    description: detect.description || null,
    readme: detect.readme || null,
  },
  capabilities: run(RULES),
  monetization: run(MONEY),
  permissions: permissions(),
  locales: locales(),
  routes: detect.routes || [],
  vocabulary: vocabulary(),
  readmeFeatures: readmeFeatures(),
  game: gameTraits(),
  note: 'Leads, not facts: confirm each capability in the code and on screen before you claim it. Absent monetization means none was detected, so check before writing "no ads" or "free".',
};

const json = JSON.stringify(result, null, argv.includes('--pretty') ? 2 : 0);
if (flag('out')) { fs.mkdirSync(path.dirname(path.resolve(flag('out'))), { recursive: true }); fs.writeFileSync(path.resolve(flag('out')), JSON.stringify(result, null, 2)); }
process.stdout.write(json + '\n');
