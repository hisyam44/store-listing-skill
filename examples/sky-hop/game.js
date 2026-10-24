// Sky Hop: tap (or Space) to jump between floating islands and collect stars.
const cv = document.getElementById('c');
const g = cv.getContext('2d');
let W, H, S, dpr;
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = innerWidth; H = innerHeight; S = H / 900; // world units scale with height
  cv.width = W * dpr; cv.height = H * dpr;
}
addEventListener('resize', resize); resize();

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const state = { mode: 'title', t: 0, x: 0, score: 0, best: 128, stars: 0 };
const hero = { y: 0, vy: 0, onGround: true };
const islands = [], stars = [], puffs = [];
// Islands are generated ahead of the player forever (old ones are dropped), so the run is endless.
let nextX = 0;
function addIsland() {
  const i = islands.length ? islands[islands.length - 1].i + 1 : 0;
  const w = 220 + rnd() * 180, y = 560 + (rnd() - 0.5) * 160;
  islands.push({ i, x: nextX, w, y, hue: [150, 28, 330, 190][i % 4] });
  if (i > 0) for (let k = 0; k < 3; k++) stars.push({ x: nextX + w * (0.25 + k * 0.25), y: y - 140 - Math.sin(k) * 40, got: false });
  nextX += w + 90 + rnd() * 70;
}
function reset() {
  seed = 7; islands.length = 0; stars.length = 0; nextX = 0;
  for (let i = 0; i < 12; i++) addIsland();
  state.x = 0; state.score = 0; state.stars = 0; hero.y = islands[0].y; hero.vy = 0; hero.onGround = true;
}
reset();

function jump() {
  if (state.mode !== 'play') { state.mode = 'play'; reset(); return; }
  if (hero.onGround) { hero.vy = -15.5; hero.onGround = false; for (let i = 0; i < 8; i++) puffs.push({ x: 0, y: hero.y, vx: (Math.random() - .5) * 4, vy: -Math.random() * 2, life: 1 }); }
}
addEventListener('pointerdown', jump);
addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') jump(); });

const heroX = () => W / S * 0.3;
function islandAt(x) { return islands.find((i) => x >= i.x && x <= i.x + i.w); }

function update() {
  state.t += 1 / 60;
  if (state.mode !== 'play') { state.x += 2.2; return; }
  state.x += 6.2;
  while (nextX < state.x + 4000) addIsland();
  while (islands.length > 40) islands.shift();
  while (stars.length > 120) stars.shift();
  hero.vy += 0.75; hero.y += hero.vy;
  const wx = state.x + 0; const isl = islandAt(wx);
  if (isl && hero.vy >= 0 && hero.y >= isl.y && hero.y - hero.vy <= isl.y + 4) { hero.y = isl.y; hero.vy = 0; hero.onGround = true; }
  else if (!isl || hero.y < isl.y - 1) hero.onGround = false;
  // autopilot near edges so recordings keep going
  const next = islandAt(wx + 60);
  if (hero.onGround && !next) jump();
  for (const s of stars) if (!s.got && Math.abs(s.x - wx) < 40 && Math.abs(s.y - (hero.y - 40)) < 60) { s.got = true; state.stars++; state.score += 10; }
  state.score += 0.05;
  if (hero.y > 1200) { state.mode = 'over'; state.best = Math.max(state.best, Math.floor(state.score)); }
}

function sky() {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#2b1d5c'); gr.addColorStop(0.55, '#ff6f91'); gr.addColorStop(1, '#ffc75f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,240,200,.95)'; g.beginPath(); g.arc(W * 0.72, H * 0.3, 70 * S, 0, 7); g.fill();
  for (const [k, col, amp, base] of [[0.15, '#7b4b94', 90, 0.62], [0.35, '#5a3a7e', 70, 0.72], [0.6, '#3d2a63', 50, 0.82]]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, H * base - Math.sin((x / S + state.x * k) / 180) * amp * S - Math.sin((x / S + state.x * k) / 67) * amp * 0.3 * S);
    g.lineTo(W, H); g.fill();
  }
}

function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  sky();
  g.save(); g.scale(S, S);
  const off = heroX() - state.x;
  for (const i of islands) {
    const x = i.x + off; if (x > W / S + 50 || x + i.w < -50) continue;
    g.fillStyle = `hsl(${i.hue} 70% 62%)`; g.beginPath(); g.roundRect(x, i.y, i.w, 36, 18); g.fill();
    g.fillStyle = `hsl(${i.hue} 45% 38%)`; g.beginPath(); g.moveTo(x + 14, i.y + 30); g.lineTo(x + i.w / 2, i.y + 150); g.lineTo(x + i.w - 14, i.y + 30); g.fill();
    g.fillStyle = '#7ee08a'; g.beginPath(); g.roundRect(x - 4, i.y - 8, i.w + 8, 18, 9); g.fill();
  }
  for (const s of stars) {
    if (s.got) continue; const x = s.x + off; if (x < -40 || x > W / S + 40) continue;
    g.save(); g.translate(x, s.y + Math.sin(state.t * 4 + s.x) * 6); g.rotate(state.t);
    g.fillStyle = '#ffe14d'; g.strokeStyle = '#ff9f1c'; g.lineWidth = 4; g.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 11 : 26, a = (k / 10) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  // hero: a round bird
  const hx = heroX(), hy = (state.mode === 'play' ? hero.y : islands[0].y + Math.sin(state.t * 3) * 6) - 38;
  g.fillStyle = '#4dd2ff'; g.beginPath(); g.arc(hx, hy, 34, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 12, hy - 8, 11, 0, 7); g.fill();
  g.fillStyle = '#1b1035'; g.beginPath(); g.arc(hx + 15, hy - 8, 5, 0, 7); g.fill();
  g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(hx + 30, hy); g.lineTo(hx + 50, hy + 6); g.lineTo(hx + 30, hy + 12); g.fill();
  g.fillStyle = '#2bb3e6'; g.beginPath(); g.ellipse(hx - 10, hy + 6, 18, 10, Math.sin(state.t * 20) * 0.6, 0, 7); g.fill();
  g.restore();

  // HUD
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 12 * S;
  if (state.mode === 'play') {
    g.font = `900 ${64 * S}px system-ui`; g.fillText(Math.floor(state.score), W / 2, 110 * S);
    g.font = `800 ${30 * S}px system-ui`; g.textAlign = 'left'; g.fillText(`⭐ ${state.stars}`, 30 * S, 70 * S);
  } else {
    g.font = `900 ${Math.min(110 * S, W * 0.16)}px system-ui`; g.fillText('SKY HOP', W / 2, H * 0.24);
    g.font = `800 ${34 * S}px system-ui`;
    g.fillText(state.mode === 'over' ? `Score ${Math.floor(state.score)} · Best ${state.best}` : `Best ${state.best}`, W / 2, H * 0.24 + 60 * S);
    g.globalAlpha = 0.6 + Math.sin(state.t * 4) * 0.4; g.fillText('Tap to play', W / 2, H * 0.86); g.globalAlpha = 1;
  }
  g.shadowBlur = 0;
}
(function loop() { update(); draw(); requestAnimationFrame(loop); })();
