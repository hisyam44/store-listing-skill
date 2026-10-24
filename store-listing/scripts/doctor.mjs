#!/usr/bin/env node
// Check that everything the store-listing skill needs is installed.
//   node doctor.mjs        human-readable report, exit 1 if something required is missing

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (name, ok, detail, fix, required = true) => checks.push({ name, ok, detail, fix, required });
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

const major = Number(process.versions.node.split('.')[0]);
add('Node.js >= 18', major >= 18, `v${process.versions.node}`, 'Install Node 20 or 22 LTS (https://nodejs.org or `brew install node@22`).');

let pw = null;
try { pw = await import(path.join(SKILL_DIR, 'node_modules', 'playwright', 'index.mjs')); } catch {}
add('playwright (skill dependency)', !!pw, pw ? 'installed' : 'missing', `cd "${SKILL_DIR}" && npm install`);
if (pw) {
  let exe = null;
  try { exe = pw.chromium.executablePath(); } catch {}
  add('Playwright Chromium', !!exe && fs.existsSync(exe), exe && fs.existsSync(exe) ? 'installed' : 'missing', `cd "${SKILL_DIR}" && npx playwright install chromium`);
}

// Only screen recordings (app preview videos, frame grabs) need ffmpeg; stills don't.
for (const bin of ['ffmpeg', 'ffprobe']) {
  const r = run(bin, ['-version']);
  add(`${bin} (only for videos)`, r.status === 0, r.status === 0 ? r.stdout.split('\n')[0].slice(0, 60) : 'not found',
    'macOS: `brew install ffmpeg` · Ubuntu: `sudo apt install ffmpeg` · Windows: `winget install ffmpeg`', false);
}

const df = run('df', ['-Pk', process.cwd()]);
const availKb = Number(df.stdout?.trim().split('\n').at(-1)?.split(/\s+/)[3]);
if (availKb) {
  const gb = availKb / 1024 / 1024;
  add('Free disk space >= 1 GB', gb >= 1, `${gb.toFixed(1)} GB free`, 'Free some disk space; captures and renders are a few hundred MB at most.', gb >= 0.3);
}

const width = Math.max(...checks.map((c) => c.name.length));
let failed = 0;
for (const c of checks) {
  const mark = c.ok ? 'ok  ' : c.required ? 'FAIL' : 'warn';
  if (!c.ok && c.required) failed++;
  console.log(`${mark}  ${c.name.padEnd(width)}  ${c.detail}`);
  if (!c.ok) console.log(`      ↳ fix: ${c.fix}`);
}
console.log(failed ? `\n${failed} required check(s) failed.` : '\nAll required checks passed.');
process.exit(failed ? 1 : 0);
