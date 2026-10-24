#!/usr/bin/env node
// Zero-dependency static file server for plain HTML sites and exported web games.
//
//   node static_server.mjs <dir> [--port 8080] [--coop]
//
// --coop  adds Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers, which
//         Godot 4 web exports (SharedArrayBuffer / threads) need.
// Unity WebGL builds with pre-compressed .br/.gz files get the right Content-Encoding.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) || '.');
const portArg = args.indexOf('--port');
const port = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 8080);
const coop = args.includes('--coop');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.xml': 'application/xml',
  '.pck': 'application/octet-stream', '.data': 'application/octet-stream', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  if (!fs.existsSync(file)) {
    // SPA fallback: unknown paths without an extension get index.html.
    if (!path.extname(rel) && fs.existsSync(path.join(root, 'index.html'))) file = path.join(root, 'index.html');
    else { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
  }
  const headers = { 'Cache-Control': 'no-cache' };
  let ext = path.extname(file);
  if (ext === '.br' || ext === '.gz') {
    headers['Content-Encoding'] = ext === '.br' ? 'br' : 'gzip';
    ext = path.extname(file.slice(0, -ext.length));
  }
  headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
  if (coop) {
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Serving ${root}`);
  console.log(`  Local: http://localhost:${port}/`);
});
