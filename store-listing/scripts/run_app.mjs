#!/usr/bin/env node
// Start, check and stop the project's dev server in the background.
//
//   node run_app.mjs start  [projectDir] [--cmd "npm run dev"] [--port 5173] [--url http://localhost:5173/play]
//                           [--timeout 180] [--new]
//   node run_app.mjs status [projectDir]
//   node run_app.mjs stop   [projectDir]
//
// start: works out the command with detect_project.mjs unless --cmd is given, launches it
// detached (logs to store-assets/.run/app.log), waits until the URL answers, and prints JSON
// {url, pid, log, reused}. If something already answers on the expected port it is reused
// instead (pass --new to refuse that). State lives in <projectDir>/store-assets/.run/app.json.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const action = argv[0];
const flag = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes(`--${name}`);
const positional = argv.slice(1).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] || '').startsWith('--'));
const projectDir = path.resolve(positional[0] || '.');
const runDir = path.join(projectDir, 'store-assets', '.run');
const stateFile = path.join(runDir, 'app.json');
const logFile = path.join(runDir, 'app.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

async function answers(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(t);
    return res.status < 500;
  } catch { return false; }
}

function urlsFromLog() {
  let text = '';
  try { text = stripAnsi(fs.readFileSync(logFile, 'utf8')); } catch { return []; }
  const found = [...text.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::\d+)?[^\s'"),]*/g)].map((m) =>
    m[0].replace('0.0.0.0', 'localhost').replace(/[.,;]+$/, ''));
  return [...new Set(found)];
}

function isAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

function tailLog(n = 30) {
  try { return stripAnsi(fs.readFileSync(logFile, 'utf8')).trim().split('\n').slice(-n).join('\n'); } catch { return ''; }
}

async function start() {
  fs.mkdirSync(runDir, { recursive: true });
  if (fs.existsSync(stateFile)) {
    const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (st.pid && isAlive(st.pid) && (await answers(st.url))) {
      console.log(JSON.stringify({ ...st, reused: true }));
      return;
    }
  }

  let cmd = flag('cmd');
  let port = flag('port') ? Number(flag('port')) : null;
  let detected = null;
  if (!cmd) {
    detected = JSON.parse(execFileSync(process.execPath, [path.join(SCRIPT_DIR, 'detect_project.mjs'), projectDir], { encoding: 'utf8' }));
    cmd = detected.devCommand;
    port ||= detected.port;
    if (!cmd) {
      console.error(JSON.stringify({ error: 'No dev command detected. Pass --cmd.', warnings: detected.warnings }));
      process.exit(2);
    }
    if (detected.needsInstall) {
      console.error(JSON.stringify({ error: `Dependencies are not installed. Run "${detected.installCommand}" in ${projectDir} first.` }));
      process.exit(2);
    }
  }
  const explicitUrl = flag('url');
  const expected = explicitUrl || (port ? `http://localhost:${port}/` : null);

  if (expected && !has('new') && (await answers(expected))) {
    const st = { url: expected, pid: null, cmd: null, log: null, reused: true, note: 'Something was already serving this URL; verify it is the right app with a screenshot.' };
    fs.writeFileSync(stateFile, JSON.stringify(st, null, 2));
    console.log(JSON.stringify(st));
    return;
  }

  const out = fs.openSync(logFile, 'w');
  const env = { ...process.env, BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1' };
  if (port && !process.env.PORT) env.PORT = String(port);
  const child = spawn(cmd, { cwd: projectDir, shell: true, detached: true, stdio: ['ignore', out, out], env });
  child.unref();

  const timeoutMs = Number(flag('timeout', 180)) * 1000;
  const t0 = Date.now();
  let url = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(1000);
    if (!isAlive(child.pid)) {
      console.error(JSON.stringify({ error: 'Dev server exited before it became ready.', cmd, logTail: tailLog() }));
      process.exit(1);
    }
    const candidates = [...(explicitUrl ? [explicitUrl] : []), ...urlsFromLog(), ...(expected ? [expected] : [])];
    for (const c of candidates) {
      if (await answers(c)) { url = c; break; }
    }
    if (url) break;
  }
  if (!url) {
    console.error(JSON.stringify({ error: `Timed out after ${timeoutMs / 1000}s waiting for the dev server.`, cmd, pid: child.pid, logTail: tailLog() }));
    process.exit(1);
  }
  // Give HMR / first compile a moment so the first capture isn't a loading screen.
  await sleep(1500);
  const st = { url, pid: child.pid, cmd, log: logFile, startedAt: new Date().toISOString(), reused: false };
  fs.writeFileSync(stateFile, JSON.stringify(st, null, 2));
  console.log(JSON.stringify(st));
}

async function stop() {
  if (!fs.existsSync(stateFile)) { console.log(JSON.stringify({ stopped: false, reason: 'no state file' })); return; }
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (!st.pid) {
    fs.rmSync(stateFile);
    console.log(JSON.stringify({ stopped: false, reason: 'server was not started by this script; left running' }));
    return;
  }
  const kill = (sig) => { try { process.kill(-st.pid, sig); } catch { try { process.kill(st.pid, sig); } catch {} } };
  kill('SIGTERM');
  for (let i = 0; i < 20 && isAlive(st.pid); i++) await sleep(200);
  if (isAlive(st.pid)) kill('SIGKILL');
  fs.rmSync(stateFile);
  console.log(JSON.stringify({ stopped: true, pid: st.pid }));
}

async function status() {
  if (!fs.existsSync(stateFile)) { console.log(JSON.stringify({ running: false })); return; }
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log(JSON.stringify({ ...st, running: (st.pid ? isAlive(st.pid) : true) && (await answers(st.url)), logTail: tailLog(10) }));
}

if (action === 'start') await start();
else if (action === 'stop') await stop();
else if (action === 'status') await status();
else {
  console.error('usage: run_app.mjs start|status|stop [projectDir] [--cmd ...] [--port N] [--url URL] [--timeout s] [--new]');
  process.exit(64);
}
