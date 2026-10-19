'use strict';
// Забег в подземелье Малгора (ЗАБЕГ.md): процедурные этажи, один герой + напарник-ИИ,
// автоатака, рывок и удар по кругу, выбор улучшения после этажа, на дне — босс Малгор.
// Полноэкранный оверлей поверх деревни; кампания на время забега стоит на паузе.

const Run = { on: false };
const RT = 16;                 // размер тайла, пикселей
const RMW = 52, RMH = 38;      // размер этажа в тайлах

function rngMake(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function runStart(diff) {
  if (Run.on) return;
  const meta = runMeta();
  Object.assign(Run, {
    on: true, diff, meta, floor: 0, t: 0, keys: {}, joy: null, prevSpeed: Game.speed || 1, over: false, pick: null, flash: 0,
    seed: diff.weekly ? runWeekSeed() * 7919 + 13 : (Math.random() * 1e9) | 0,
    hero: { x: 0, y: 0, hp: 100, max: 100, spd: 62, dmg: 12, cd: 0, rate: 0.55, dash: 0, dashCd: 0, slamCd: 0, face: 1, hit: 0, inv: 0, gold: 0 },
    kills: 0, ups: [],
  });
  try { setSpeed(0); } catch (e) { /* без паузы */ }
  const el = document.createElement('div');
  el.id = 'run-ui';
  el.style.cssText = 'position:fixed;inset:0;z-index:9100;background:#05030a;touch-action:none;user-select:none;-webkit-user-select:none;';
  el.innerHTML = `<canvas id="run-cv" style="width:100%;height:100%;image-rendering:pixelated;display:block"></canvas>
    <div id="run-hud" style="position:absolute;left:10px;top:8px;color:#f1dfb0;font:600 14px/1.3 sans-serif;text-shadow:0 1px 2px #000;pointer-events:none"></div>
    <button id="run-exit" style="position:absolute;right:8px;top:8px;background:#3a2410cc;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;padding:4px 10px;cursor:pointer">Сдаться</button>
    <div id="run-joy" style="position:absolute;left:18px;bottom:24px;width:120px;height:120px;border-radius:50%;background:#ffffff14;border:2px solid #ffffff30;display:none"><div id="run-knob" style="position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:#ffffff40"></div></div>
    <div id="run-btns" style="position:absolute;right:16px;bottom:24px;display:none;gap:12px">
      <button data-a="slam" style="width:64px;height:64px;border-radius:50%;background:#7a3a1caa;color:#fff;border:2px solid #ffffff50;font-size:22px">💥</button>
      <button data-a="dash" style="width:64px;height:64px;border-radius:50%;background:#1c4a7aaa;color:#fff;border:2px solid #ffffff50;font-size:22px">⚡</button></div>
    <div id="run-pick" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:10px;background:#000a;flex-wrap:wrap;padding:10px"></div>
    <div id="run-msg" style="position:absolute;left:0;right:0;top:36%;text-align:center;color:#f1dfb0;font:700 28px sans-serif;text-shadow:0 2px 6px #000;pointer-events:none"></div>`;
  document.body.appendChild(el);
  Run.el = el; Run.cv = el.querySelector('#run-cv');
  el.querySelector('#run-exit').onclick = () => runEnd(false, true);
  const touch = matchMedia('(pointer:coarse)').matches || (typeof Mobile !== 'undefined' && Mobile.on);
  if (touch) { el.querySelector('#run-joy').style.display = 'block'; el.querySelector('#run-btns').style.display = 'flex'; }
  Run.kd = e => { Run.keys[e.code] = true; if (e.code === 'Space') { runDash(); e.preventDefault(); } if (e.code === 'KeyE') runSlam(); };
  Run.ku = e => { Run.keys[e.code] = false; };
  window.addEventListener('keydown', Run.kd); window.addEventListener('keyup', Run.ku);
  el.querySelectorAll('#run-btns button').forEach(b => { b.addEventListener('pointerdown', e => { e.stopPropagation(); b.dataset.a === 'dash' ? runDash() : runSlam(); }); });
  const joy = el.querySelector('#run-joy'), knob = el.querySelector('#run-knob');
  const jm = e => { const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + 60), dy = e.clientY - (r.top + 60), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 50); Run.joy = { x: dx / d * k, y: dy / d * k }; knob.style.left = 40 + dx / d * Math.min(d, 50) + 'px'; knob.style.top = 40 + dy / d * Math.min(d, 50) + 'px'; };
  joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); jm(e); });
  joy.addEventListener('pointermove', e => { if (e.buttons || e.pressure) jm(e); });
  const jend = () => { Run.joy = null; knob.style.left = '40px'; knob.style.top = '40px'; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  runFloorBuild();
  let last = performance.now();
  const loop = now => {
    if (!Run.on) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { runUpdate(dt); runDraw(); } catch (e) { console.error(e); }
    Run.raf = requestAnimationFrame(loop);
  };
  Run.raf = requestAnimationFrame(loop);
}

// ---------- генерация этажа ----------
function runFloorBuild() {
  const R = Run, rng = rngMake(R.seed + R.floor * 977), boss = R.floor === R.diff.floors - 1 && R.diff.floors >= 5;
  const map = new Uint8Array(RMW * RMH);       // 0 стена, 1 пол
  const rooms = [];
  for (let n = 0; n < 60 && rooms.length < (boss ? 5 : 8); n++) {
    const w = 6 + ((rng() * 7) | 0), h = 5 + ((rng() * 5) | 0), x = 2 + ((rng() * (RMW - w - 4)) | 0), y = 2 + ((rng() * (RMH - h - 4)) | 0);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) map[j * RMW + i] = 1;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < RMW - 1 && y < RMH - 1) map[y * RMW + x] = 1; };
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) { carve(x, a.cy); carve(x, a.cy + 1); }
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) { carve(b.cx, y); carve(b.cx + 1, y); }
  }
  R.map = map; R.rooms = rooms; R.rng = rng; R.boss = boss;
  const s = rooms[0], e = rooms[rooms.length - 1];
  R.hero.x = (s.cx + 0.5) * RT; R.hero.y = (s.cy + 0.5) * RT;
  R.pal = { x: R.hero.x - 14, y: R.hero.y, hp: 60, max: 60, cd: 0, kind: R.meta.pal, hit: 0 };
  R.stairs = { x: (e.cx + 0.5) * RT, y: (e.cy + 0.5) * RT, open: false };
  R.enemies = []; R.shots = []; R.pops = []; R.drops = [];
  const m = R.diff.mult * (1 + R.floor * 0.28);
  for (let k = 1; k < rooms.length; k++) {
    const r = rooms[k], n = boss && k === rooms.length - 1 ? 0 : 2 + ((rng() * 3) | 0) + (R.floor >> 1);
    for (let i = 0; i < n; i++) {
      const kind = rng() < 0.3 + R.floor * 0.08 ? 'raven' : 'skel';
      R.enemies.push({ kind, x: (r.x + 1 + rng() * (r.w - 2)) * RT, y: (r.y + 1 + rng() * (r.h - 2)) * RT, hp: (kind === 'skel' ? 30 : 18) * m, max: (kind === 'skel' ? 30 : 18) * m, dmg: (kind === 'skel' ? 8 : 6) * m, spd: kind === 'skel' ? 26 : 38, cd: 0, hit: 0, awake: false });
    }
  }
  if (boss) {
    const r = rooms[rooms.length - 1];
    R.enemies.push({ kind: 'malgor', x: (r.cx + 0.5) * RT, y: (r.cy - 1) * RT, hp: 420 * R.diff.mult, max: 420 * R.diff.mult, dmg: 12 * R.diff.mult, spd: 18, cd: 2, hit: 0, awake: false, boss: true });
    R.stairs.x = -999;   // у босса лестницы нет — победа после его гибели
  }
  R.msg = boss ? 'Дно. Малгор ждёт.' : `Этаж ${R.floor + 1}`; R.msgT = 2.2;
}

const runSolid = (x, y) => { const i = Math.floor(x / RT), j = Math.floor(y / RT); return i < 0 || j < 0 || i >= RMW || j >= RMH || !Run.map[j * RMW + i]; };
function runMove(o, dx, dy, r) {
  r = r || 4;
  const ok = (x, y) => !(runSolid(x - r, y - r) || runSolid(x + r, y - r) || runSolid(x - r, y + r) || runSolid(x + r, y + r));
  if (ok(o.x + dx, o.y)) o.x += dx;
  if (ok(o.x, o.y + dy)) o.y += dy;
}
const runNearest = (o, list, rng) => { let b = null, bd = rng * rng; for (const e of list) { const d = (e.x - o.x) ** 2 + (e.y - o.y) ** 2; if (d < bd) { bd = d; b = e; } } return b; };
function runPop(x, y, text, col) { Run.pops.push({ x, y, text, col: col || '#fff', t: 0.8 }); }

function runDash() { const h = Run.hero; if (Run.over || Run.pick || h.dashCd > 0) return; h.dash = 0.16; h.dashCd = 1.1 * (Run.dashMul || 1); h.inv = 0.2; }
function runSlam() {
  const h = Run.hero; if (Run.over || Run.pick || h.slamCd > 0) return;
  h.slamCd = 4; Run.flash = 0.25; Run.slam = 0.3;
  for (const e of Run.enemies) if (Math.hypot(e.x - h.x, e.y - h.y) < 40) runHurt(e, h.dmg * 2.2);
}
function runHurt(e, d) {
  if (e.hp <= 0) return;
  e.hp -= d; e.hit = 0.12; e.awake = true; runPop(e.x, e.y - 10, Math.round(d), '#ffe680');
  if (e.hp <= 0) {
    Run.kills++; Run.hero.gold += e.boss ? 40 : 2 + (Math.random() * 3 | 0);
    if (e.boss) runEnd(true);
    else if (Math.random() < 0.12) Run.drops.push({ x: e.x, y: e.y, heal: 20 });
  }
}
function runHurtHero(d) {
  const h = Run.hero; if (h.inv > 0 || Run.over) return;
  h.hp -= d; h.inv = 0.5; h.hit = 0.15; runPop(h.x, h.y - 10, Math.round(d), '#ff8a8a');
  if (h.hp <= 0) runEnd(false);
}

// ---------- обновление ----------
function runUpdate(dt) {
  const R = Run, h = R.hero; R.t += dt;
  if (R.msgT > 0) R.msgT -= dt;
  R.flash = Math.max(0, R.flash - dt); R.slam = Math.max(0, (R.slam || 0) - dt);
  if (R.over || R.pick) return;
  // ввод
  let ix = (R.keys.KeyD || R.keys.ArrowRight ? 1 : 0) - (R.keys.KeyA || R.keys.ArrowLeft ? 1 : 0), iy = (R.keys.KeyS || R.keys.ArrowDown ? 1 : 0) - (R.keys.KeyW || R.keys.ArrowUp ? 1 : 0);
  if (R.joy) { ix = R.joy.x; iy = R.joy.y; } else { const d = Math.hypot(ix, iy); if (d > 1) { ix /= d; iy /= d; } }
  h.cd -= dt; h.dashCd -= dt; h.slamCd -= dt; h.inv -= dt; h.hit -= dt; h.dash -= dt;
  const sp = (h.dash > 0 ? h.spd * 4 : h.spd) * dt;
  if (ix) h.face = ix > 0 ? 1 : -1;
  runMove(h, ix * sp, iy * sp);
  // автоатака ближайшего
  const tgt = runNearest(h, R.enemies, 26);
  if (tgt && h.cd <= 0) { h.cd = h.rate; h.swing = 0.15; runHurt(tgt, h.dmg); }
  h.swing = Math.max(0, (h.swing || 0) - dt);
  // напарник
  const p = R.pal; p.cd -= dt; p.hit -= dt;
  const pd = Math.hypot(h.x - p.x, h.y - p.y);
  if (pd > 22) runMove(p, (h.x - p.x) / pd * 58 * dt, (h.y - p.y) / pd * 58 * dt);
  const pr = p.kind === 'archer' || p.kind === 'bomber' ? 70 : 20, pt = runNearest(p, R.enemies, pr);
  if (p.kind === 'healer') { if (p.cd <= 0 && h.hp < h.max) { p.cd = 3; h.hp = Math.min(h.max, h.hp + 8); runPop(h.x, h.y - 14, '+8', '#8aff9a'); } }
  else if (pt && p.cd <= 0) {
    p.cd = p.kind === 'bomber' ? 2.2 : p.kind === 'archer' ? 0.9 : 0.8;
    if (p.kind === 'warrior') runHurt(pt, 9);
    else R.shots.push({ x: p.x, y: p.y, vx: (pt.x - p.x) / Math.hypot(pt.x - p.x, pt.y - p.y) * 150, vy: (pt.y - p.y) / Math.hypot(pt.x - p.x, pt.y - p.y) * 150, own: 'p', dmg: p.kind === 'bomber' ? 22 : 9, t: 1.2, r: p.kind === 'bomber' ? 14 : 0 });
  }
  // враги
  let alive = 0;
  for (const e of R.enemies) {
    if (e.hp <= 0) continue;
    alive++; e.hit -= dt; e.cd -= dt;
    const d = Math.hypot(h.x - e.x, h.y - e.y);
    if (!e.awake && d < 90) e.awake = true;
    if (!e.awake) continue;
    if (e.boss) {
      const ph = e.hp > e.max * 0.66 ? 0 : e.hp > e.max * 0.33 ? 1 : 2;
      if (d > 50) runMove(e, (h.x - e.x) / d * e.spd * dt, (h.y - e.y) / d * e.spd * dt, 6);
      if (e.cd <= 0) {
        e.cd = ph === 0 ? 1.6 : 1.1;
        const n = ph === 2 ? 8 : 3, base = Math.atan2(h.y - e.y, h.x - e.x);
        for (let k = 0; k < n; k++) { const a = ph === 2 ? k / n * Math.PI * 2 + R.t : base + (k - 1) * 0.28; R.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, own: 'e', dmg: e.dmg, t: 3 }); }
        if (ph === 1 && R.enemies.filter(z => z.hp > 0).length < 6) R.enemies.push({ kind: 'skel', x: e.x + 10, y: e.y + 10, hp: 24, max: 24, dmg: 6, spd: 30, cd: 0, hit: 0, awake: true });
      }
      continue;
    }
    if (d > 8) runMove(e, (h.x - e.x) / d * e.spd * dt, (h.y - e.y) / d * e.spd * dt);
    if (d < 11 && e.cd <= 0) { e.cd = 0.9; runHurtHero(e.dmg); }
    const pd2 = Math.hypot(p.x - e.x, p.y - e.y);
    if (pd2 < 9 && e.cd <= 0.2) { p.hp -= e.dmg * 0.4 * dt * 4; p.hit = 0.1; }
  }
  if (p.hp <= 0 && !p.dead) { p.dead = true; runPop(p.x, p.y - 10, 'Напарник пал', '#ffb0a0'); }
  // снаряды
  for (let i = R.shots.length - 1; i >= 0; i--) {
    const s = R.shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
    let dead = s.t <= 0 || runSolid(s.x, s.y);
    if (s.own === 'e' && Math.hypot(s.x - h.x, s.y - h.y) < 6) { runHurtHero(s.dmg); dead = true; }
    if (s.own === 'p') for (const e of R.enemies) if (e.hp > 0 && Math.hypot(s.x - e.x, s.y - e.y) < 8) {
      if (s.r) { for (const z of R.enemies) if (Math.hypot(z.x - s.x, z.y - s.y) < s.r + 6) runHurt(z, s.dmg); }
      else runHurt(e, s.dmg);
      dead = true; break;
    }
    if (dead) R.shots.splice(i, 1);
  }
  for (let i = R.drops.length - 1; i >= 0; i--) { const d = R.drops[i]; if (Math.hypot(d.x - h.x, d.y - h.y) < 9) { h.hp = Math.min(h.max, h.hp + d.heal); runPop(h.x, h.y - 12, '+' + d.heal, '#8aff9a'); R.drops.splice(i, 1); } }
  for (let i = R.pops.length - 1; i >= 0; i--) { R.pops[i].t -= dt; R.pops[i].y -= 14 * dt; if (R.pops[i].t <= 0) R.pops.splice(i, 1); }
  // лестница
  if (!R.stairs.open && !alive && !R.boss) { R.stairs.open = true; R.msg = 'Лестница открыта'; R.msgT = 1.8; }
  if (R.stairs.open && Math.hypot(h.x - R.stairs.x, h.y - R.stairs.y) < 10) runUpgrade();
  runHud();
}

function runHud() {
  const R = Run, h = R.hero, el = R.el.querySelector('#run-hud');
  const bar = (v, m, col) => `<div style="width:150px;height:9px;background:#0008;border:1px solid #000a;border-radius:3px"><div style="width:${Math.max(0, v / m * 100)}%;height:100%;background:${col};border-radius:2px"></div></div>`;
  const boss = R.enemies.find(e => e.boss && e.hp > 0);
  el.innerHTML = `${R.diff.name} · этаж ${R.floor + 1}/${R.diff.floors} &nbsp; 💰${h.gold}<br>${bar(h.hp, h.max, '#c8402a')}${R.pal.dead ? '' : '<div style="margin-top:3px">' + bar(R.pal.hp, R.pal.max, '#4a8a3a') + '</div>'}`
    + (boss ? `<div style="margin-top:6px">Малгор</div>${bar(boss.hp, boss.max, '#8a5ad0')}` : '');
  R.el.querySelector('#run-msg').textContent = R.msgT > 0 ? R.msg : '';
}

// ---------- улучшения ----------
const RUN_UPS = [
  { n: 'Острый клинок', d: '+30% урона', f: h => { h.dmg *= 1.3; } },
  { n: 'Быстрые руки', d: 'Атака на 25% чаще', f: h => { h.rate *= 0.75; } },
  { n: 'Крепкая борода', d: '+30 здоровья и лечение на 30', f: h => { h.max += 30; h.hp = Math.min(h.max, h.hp + 30); } },
  { n: 'Лёгкие сапоги', d: '+20% скорости', f: h => { h.spd *= 1.2; } },
  { n: 'Хмельная фляга', d: 'Полное лечение', f: h => { h.hp = h.max; } },
  { n: 'Заговорённый рывок', d: 'Рывок чаще на 40%', f: h => { h.dashCd = 0; Run.dashMul = 0.6; } },
];
function runUpgrade() {
  const R = Run;
  if (R.floor + 1 >= R.diff.floors) { runEnd(true); return; }
  const opts = RUN_UPS.slice().sort(() => R.rng() - 0.5).slice(0, 3), box = R.el.querySelector('#run-pick');
  R.pick = true; box.style.display = 'flex';
  box.innerHTML = '<div style="width:100%;text-align:center;color:#f1dfb0;font:700 22px sans-serif;margin-bottom:6px">Выберите награду</div>' + opts.map((u, i) =>
    `<button data-i="${i}" style="width:190px;padding:14px 10px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer"><b style="font-size:16px">${u.n}</b><br><small>${u.d}</small></button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    opts[+b.dataset.i].f(R.hero); R.ups.push(opts[+b.dataset.i].n);
    R.pick = null; box.style.display = 'none'; R.floor++; runFloorBuild();
  });
}

// ---------- конец забега ----------
function runEnd(win, quit) {
  const R = Run; if (R.over) return; R.over = true;
  const meta = runMeta(), stones = Math.round((R.floor + (win ? 2 : 0) + R.kills / 5) * R.diff.mult), shards = win ? (R.diff.id === 'curse' ? 3 : 1) : 0;
  meta.runs++; meta.stones += stones; meta.shards += shards;
  if (win) meta.wins++;
  meta.best = Math.max(meta.best, R.floor + (win ? 1 : 0));
  if (R.diff.weekly) { const wk = runWeekSeed(), sc = R.hero.gold + R.floor * 50 + (win ? 200 : 0); meta.weekBest[wk] = Math.max(meta.weekBest[wk] || 0, sc); }
  if (!win) meta.hurtUntil = Date.now() + 60000;   // герой в таверне «отлёживается»
  runMetaSave(meta);
  const box = R.el.querySelector('#run-pick'); box.style.display = 'flex';
  box.innerHTML = `<div style="text-align:center;color:#f1dfb0;font-family:sans-serif"><div style="font-size:30px;font-weight:700">${win ? 'Малгор повержен!' : quit ? 'Вы вернулись в таверну' : 'Герой пал'}</div>
    <p style="font-size:15px">Этажей: ${R.floor + (win ? 1 : 0)} · Убито: ${R.kills} · Золото: ${R.hero.gold}<br>Награда: 💎 ${stones}${shards ? ` ◆ ${shards}` : ''}${win ? '' : '<br>Хозяин вернул вас в таверну с половиной здоровья'}</p>
    <button id="run-back" style="padding:10px 22px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer;font-size:16px">В таверну</button></div>`;
  box.querySelector('#run-back').onclick = () => {
    runClose();
    tavernOpen();
  };
}
function runClose() {
  const R = Run; R.on = false; cancelAnimationFrame(R.raf);
  window.removeEventListener('keydown', R.kd); window.removeEventListener('keyup', R.ku);
  if (R.el) R.el.remove();
  try { setSpeed(R.prevSpeed || 1); } catch (e) { /* без паузы */ }
}

// ---------- рисование ----------
function runDraw() {
  const R = Run, cv = R.cv, Z = 3;
  const W = Math.ceil(innerWidth / Z), H = Math.ceil(innerHeight / Z);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const h = R.hero, cx = Math.round(h.x - W / 2), cy = Math.round(h.y - H / 2);
  c.fillStyle = '#07040c'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(-cx, -cy);
  const i0 = Math.max(0, cx / RT | 0), i1 = Math.min(RMW - 1, (cx + W) / RT | 0), j0 = Math.max(0, cy / RT | 0), j1 = Math.min(RMH - 1, (cy + H) / RT | 0);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i * RT, y = j * RT, f = R.map[j * RMW + i], n = (i * 7 + j * 13) % 5;
    if (f) { c.fillStyle = n < 3 ? '#4a4258' : '#443d52'; c.fillRect(x, y, RT, RT); c.fillStyle = '#383244'; c.fillRect(x, y + RT - 1, RT, 1); c.fillRect(x + RT - 1, y, 1, RT); if (n === 0) { c.fillStyle = '#5a526a'; c.fillRect(x + 4, y + 5, 3, 2); } }
    else if (j < RMH - 1 && R.map[(j + 1) * RMW + i]) { c.fillStyle = '#2a2236'; c.fillRect(x, y, RT, RT); c.fillStyle = '#3a3048'; c.fillRect(x, y + RT - 5, RT, 5); c.fillStyle = '#1a1424'; c.fillRect(x, y + RT - 1, RT, 1); }
    else { c.fillStyle = '#120c1a'; c.fillRect(x, y, RT, RT); }
  }
  // лестница
  const st = R.stairs;
  if (st.x > 0) { c.fillStyle = R.stairs.open ? '#2a6a8a' : '#2a2a34'; c.fillRect(st.x - 7, st.y - 7, 14, 14); c.fillStyle = R.stairs.open ? '#7ad8ff' : '#444'; for (let k = 0; k < 4; k++) c.fillRect(st.x - 6 + k, st.y - 6 + k * 3, 12 - k * 2, 2); }
  for (const d of R.drops) { c.fillStyle = '#c8402a'; c.fillRect(d.x - 3, d.y - 3, 6, 6); c.fillStyle = '#ffd0c0'; c.fillRect(d.x - 1, d.y - 2, 2, 4); }
  // сущности по глубине
  const ents = [];
  for (const e of R.enemies) if (e.hp > 0) ents.push({ y: e.y, f: () => runDrawEnemy(c, e) });
  if (!R.pal.dead) ents.push({ y: R.pal.y, f: () => runDrawDwarf(c, R.pal.x, R.pal.y, RUN_PALS[R.pal.kind][2], R.pal.x < h.x ? 1 : -1, R.pal.hit > 0, true) });
  ents.push({ y: h.y, f: () => runDrawDwarf(c, h.x, h.y, RUN_CLOAKS[R.meta.cloak % RUN_CLOAKS.length][1], h.face, h.hit > 0 || (h.inv > 0 && ((R.t * 20) | 0) % 2), false) });
  ents.sort((a, b) => a.y - b.y).forEach(o => o.f());
  if (h.swing > 0) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(h.x + h.face * 8, h.y - 4, 10, h.face > 0 ? -1 : Math.PI - 1, h.face > 0 ? 1 : Math.PI + 1); c.stroke(); }
  if (R.slam > 0) { c.strokeStyle = `rgba(255,200,80,${R.slam * 3})`; c.lineWidth = 3; c.beginPath(); c.arc(h.x, h.y, 40 * (1 - R.slam / 0.3 * 0.7), 0, 7); c.stroke(); }
  for (const s of R.shots) { c.fillStyle = s.own === 'e' ? '#b070ff' : (s.r ? '#ff9a3a' : '#e8e0d0'); c.beginPath(); c.arc(s.x, s.y, s.own === 'e' ? 3 : s.r ? 3.5 : 2, 0, 7); c.fill(); if (s.own === 'e') { c.fillStyle = '#6aff9a'; c.fillRect(s.x - 1, s.y - 1, 2, 2); } }
  c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
  for (const p of R.pops) { c.fillStyle = '#000'; c.fillText(p.text, p.x + 0.5, p.y + 0.5); c.fillStyle = p.col; c.fillText(p.text, p.x, p.y); }
  c.restore();
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  if (R.flash > 0) { c.fillStyle = `rgba(255,220,120,${R.flash * 0.6})`; c.fillRect(0, 0, W, H); }
}

function runDrawDwarf(c, x, y, cloak, face, hit, pal) {
  const bob = Math.sin(Run.t * 10 + x) * 0.5;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 5, y + 4, 10, 3);
  c.fillStyle = cloak; c.fillRect(x - 4, y - 5 + bob, 8, 9);
  c.fillStyle = '#e8b890'; c.fillRect(x - 3, y - 10 + bob, 6, 5);
  c.fillStyle = pal ? '#b08a50' : '#c8663a'; c.fillRect(x - 3, y - 6 + bob, 6, 5);
  c.fillStyle = '#7a8088'; c.fillRect(x - 4, y - 13 + bob, 8, 4);
  c.fillStyle = '#1a1008'; c.fillRect(x + face * 1 - 1, y - 9 + bob, 1, 1);
  c.fillStyle = '#cfd4dc'; c.fillRect(x + face * 5 - (face < 0 ? 1 : 0), y - 5 + bob, 1, 7);
  if (hit) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x - 4, y - 13, 8, 17); }
}
function runDrawEnemy(c, e) {
  const bob = Math.sin(Run.t * 8 + e.x) * 0.6;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(e.x - 5, e.y + 4, 10, 3);
  if (e.kind === 'malgor') {
    c.fillStyle = '#2a2f6a'; c.fillRect(e.x - 8, e.y - 22 + bob, 16, 28);
    c.fillStyle = '#3b4a9a'; c.fillRect(e.x - 6, e.y - 20 + bob, 12, 24);
    c.fillStyle = '#d8d0e8'; c.fillRect(e.x - 4, e.y - 30 + bob, 8, 9);
    c.fillStyle = '#6aff9a'; c.fillRect(e.x - 3, e.y - 27 + bob, 2, 2); c.fillRect(e.x + 1, e.y - 27 + bob, 2, 2);
    c.fillStyle = '#2a2f6a'; c.fillRect(e.x - 6, e.y - 36 + bob, 12, 7);
    c.fillStyle = '#6a4a2a'; c.fillRect(e.x + 10, e.y - 30 + bob, 2, 34);
    c.fillStyle = '#b070ff'; c.beginPath(); c.arc(e.x + 11, e.y - 32 + bob, 3, 0, 7); c.fill();
  } else if (e.kind === 'raven') {
    c.fillStyle = '#1a1a2a'; c.fillRect(e.x - 4, e.y - 8 + bob, 8, 5);
    const w = Math.sin(Run.t * 25 + e.x) * 3; c.fillRect(e.x - 8, e.y - 9 + bob - w, 5, 2); c.fillRect(e.x + 3, e.y - 9 + bob + w, 5, 2);
    c.fillStyle = '#6aff9a'; c.fillRect(e.x + 2, e.y - 8 + bob, 1, 1);
  } else {
    c.fillStyle = '#3b4a9a'; c.fillRect(e.x - 4, e.y - 5 + bob, 8, 9);
    c.fillStyle = '#d8d0c0'; c.fillRect(e.x - 3, e.y - 11 + bob, 6, 6);
    c.fillStyle = '#6aff9a'; c.fillRect(e.x - 2, e.y - 9 + bob, 1, 1); c.fillRect(e.x + 1, e.y - 9 + bob, 1, 1);
  }
  if (e.hit > 0) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(e.x - 5, e.y - (e.boss ? 36 : 11), 10, e.boss ? 40 : 15); }
  if (!e.boss && e.hp < e.max) { c.fillStyle = '#000a'; c.fillRect(e.x - 6, e.y - 15, 12, 2); c.fillStyle = '#c8402a'; c.fillRect(e.x - 6, e.y - 15, 12 * e.hp / e.max, 2); }
}
