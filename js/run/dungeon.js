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
  const U = meta.ups || {};
  Run.hero.max = Run.hero.hp = 100 + 10 * (U.hp | 0); Run.hero.dmg = 12 * (1 + 0.08 * (U.dmg | 0));
  Run.weapon = meta.weapon || 'pick'; Run.choices = 3 + ((U.choice | 0) ? 1 : 0); Run.pal = null; Run.props = [];
  if (diff.id === 'curse') { const lvl = Math.max(1, Math.min(5, meta.wins)); Run.diff = Object.assign({}, diff, { mult: 1.3 + 0.2 * lvl, lvl, name: 'Проклятие ' + lvl }); }
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
  joy.addEventListener('pointerdown', e => { try { joy.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое событие */ } jm(e); });
  joy.addEventListener('pointermove', e => { if (e.buttons || e.pressure) jm(e); });
  const jend = () => { Run.joy = null; knob.style.left = '40px'; knob.style.top = '40px'; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  RSfx.ambStart('dungeon');
  runFloorBuild();
  let last = performance.now();
  const loop = now => {
    if (!Run.on) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { runUpdate(dt); RSfx.ambTick(dt); runDraw(); } catch (e) { console.error(e); }
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
  if (!R.pal) R.pal = { x: R.hero.x - 14, y: R.hero.y, hp: 60, max: 60, cd: 0, kind: R.meta.pal, hit: 0 };
  else { R.pal.x = R.hero.x - 14; R.pal.y = R.hero.y; }
  R.props = []; R.rescue = null;
  // комнаты-события: сундук, кузнец, шипы; на середине пути — закованный напарник, если свой пал
  for (let k = 1; k < rooms.length - (boss ? 1 : 0); k++) {
    const r = rooms[k], roll = rng();
    if (roll < 0.3) R.props.push({ k: 'chest', x: (r.cx + 0.5) * RT, y: (r.cy + 0.5) * RT, used: false });
    else if (roll < 0.45 && R.floor >= 1 && !R.props.some(p => p.k === 'smith')) R.props.push({ k: 'smith', x: (r.cx + 0.5) * RT, y: (r.cy + 0.5) * RT, used: false });
    else if (roll < 0.7) for (let q = 0; q < 4; q++) R.props.push({ k: 'spikes', x: (r.x + 1.5 + rng() * (r.w - 3)) * RT, y: (r.y + 1.5 + rng() * (r.h - 3)) * RT, ph: rng() * 3 });
  }
  if (R.floor === 2 && R.pal.dead && rooms.length > 2) {
    const r = rooms[(rooms.length / 2) | 0], used = [R.meta.pal, R.pal.kind], kinds = Object.keys(RUN_PALS).filter(x => !used.includes(x));
    R.rescue = { x: (r.cx + 0.5) * RT, y: (r.cy + 0.5) * RT, kind: kinds[(rng() * kinds.length) | 0] || 'archer' };
  }
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

function runDash() { const h = Run.hero; if (Run.over || Run.pick || h.dashCd > 0) return; RSfx.play('dash'); h.dash = 0.16; h.dashCd = 1.1 * (Run.dashMul || 1); h.inv = 0.2; }
function runSlam() {
  const h = Run.hero; if (Run.over || Run.pick || h.slamCd > 0) return;
  RSfx.play('slam'); h.slamCd = 4; Run.flash = 0.25; Run.slam = 0.3;
  for (const e of Run.enemies) if (Math.hypot(e.x - h.x, e.y - h.y) < 40) runHurt(e, h.dmg * 2.2);
}
function runHurt(e, d) {
  if (e.hp <= 0) return;
  e.hp -= d; e.hit = 0.12; e.awake = true; runPop(e.x, e.y - 10, Math.round(d), '#ffe680');
  if (e.hp > 0) RSfx.play(e.kind === 'raven' ? 'caw' : 'hit');
  if (e.hp <= 0) {
    RSfx.play(e.boss ? 'boom' : 'kill'); RSfx.play('coin');
    Run.kills++; Run.hero.gold += e.boss ? 40 : 2 + (Math.random() * 3 | 0);
    if (e.boss) { R.msg = 'Малгор: «Наконец-то… тишина.»'; R.msgT = 3; runEnd(true); }
    else if (Math.random() < 0.12) Run.drops.push({ x: e.x, y: e.y, heal: 20 });
  }
}
function runHurtHero(d) {
  const h = Run.hero; if (h.inv > 0 || Run.over) return;
  RSfx.play('heroHurt'); h.hp -= d; h.inv = 0.5; h.hit = 0.15; runPop(h.x, h.y - 10, Math.round(d), '#ff8a8a');
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
  h.moving = Math.hypot(ix, iy) > 0.1; if (h.moving) { h.stepT = (h.stepT || 0) - dt; if (h.stepT <= 0) { h.stepT = 0.28; RSfx.play('step', 0.7); } }
  runMove(h, ix * sp, iy * sp);
  // автоатака ближайшего
  const wp = R.weapon, tgt = runNearest(h, R.enemies, wp === 'xbow' ? 85 : wp === 'staff' ? 50 : 26);
  if (tgt && h.cd <= 0) {
    h.cd = wp === 'xbow' ? h.rate * 1.25 : h.rate; h.swing = 0.15;
    if (wp === 'xbow') { const dd = Math.hypot(tgt.x - h.x, tgt.y - h.y) || 1; RSfx.play('shoot'); R.shots.push({ x: h.x, y: h.y - 4, vx: (tgt.x - h.x) / dd * 190, vy: (tgt.y - h.y) / dd * 190, own: 'p', dmg: h.dmg * 0.9, t: 0.8, r: 0 }); }
    else if (wp === 'staff') { RSfx.play('bolt'); R.flash = Math.max(R.flash, 0.03); for (const z of R.enemies) if (z.hp > 0 && Math.hypot(z.x - tgt.x, z.y - tgt.y) < 22) runHurt(z, h.dmg * (z === tgt ? 0.8 : 0.5)); }
    else runHurt(tgt, h.dmg);
  }
  h.swing = Math.max(0, (h.swing || 0) - dt);
  // напарник
  const p = R.pal; p.cd -= dt; p.hit -= dt;
  const pd = Math.hypot(h.x - p.x, h.y - p.y);
  p.moving = pd > 22;
  if (pd > 22) runMove(p, (h.x - p.x) / pd * 58 * dt, (h.y - p.y) / pd * 58 * dt);
  const pr = p.kind === 'archer' || p.kind === 'bomber' ? 70 : 20, pt = runNearest(p, R.enemies, pr);
  if (p.kind === 'healer') { if (p.cd <= 0 && h.hp < h.max) { p.cd = 3; h.hp = Math.min(h.max, h.hp + 8); RSfx.play('heal'); runPop(h.x, h.y - 14, '+8', '#8aff9a'); } }
  else if (pt && p.cd <= 0) {
    p.cd = p.kind === 'bomber' ? 2.2 : p.kind === 'archer' ? 0.9 : 0.8; if (p.kind !== 'warrior') RSfx.play('shoot');
    if (p.kind === 'warrior') runHurt(pt, 9);
    else R.shots.push({ x: p.x, y: p.y, vx: (pt.x - p.x) / Math.hypot(pt.x - p.x, pt.y - p.y) * 150, vy: (pt.y - p.y) / Math.hypot(pt.x - p.x, pt.y - p.y) * 150, own: 'p', dmg: p.kind === 'bomber' ? 22 : 9, t: 1.2, r: p.kind === 'bomber' ? 14 : 0 });
  }
  // враги
  let alive = 0;
  for (const e of R.enemies) {
    if (e.hp <= 0) continue;
    alive++; e.hit -= dt; e.cd -= dt;
    const d = Math.hypot(h.x - e.x, h.y - e.y);
    if (!e.awake && d < 90) { e.awake = true; RSfx.play(e.boss ? 'boss' : e.kind === 'raven' ? 'caw' : 'rattle', 0.6); if (e.boss) { R.msg = 'Малгор: «Шум. Опять шум.»'; R.msgT = 2.6; } }
    if (!e.awake) continue;
    if (e.boss) {
      const ph = e.hp > e.max * 0.66 ? 0 : e.hp > e.max * 0.33 ? 1 : 2;
      if (d > 50) runMove(e, (h.x - e.x) / d * e.spd * dt, (h.y - e.y) / d * e.spd * dt, 6);
      if (e.cd <= 0) {
        e.cd = ph === 0 ? 1.6 : 1.1; RSfx.play('bolt');
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
      if (s.r) { RSfx.play('boom'); for (const z of R.enemies) if (Math.hypot(z.x - s.x, z.y - s.y) < s.r + 6) runHurt(z, s.dmg); }
      else runHurt(e, s.dmg);
      dead = true; break;
    }
    if (dead) R.shots.splice(i, 1);
  }
  for (let i = R.drops.length - 1; i >= 0; i--) { const d = R.drops[i]; if (Math.hypot(d.x - h.x, d.y - h.y) < 9) { h.hp = Math.min(h.max, h.hp + d.heal); RSfx.play('heal'); runPop(h.x, h.y - 12, '+' + d.heal, '#8aff9a'); R.drops.splice(i, 1); } }
  for (let i = R.pops.length - 1; i >= 0; i--) { R.pops[i].t -= dt; R.pops[i].y -= 14 * dt; if (R.pops[i].t <= 0) R.pops.splice(i, 1); }
  for (const q of R.props) {
    const dd = Math.hypot(h.x - q.x, h.y - q.y);
    if (q.k === 'chest' && !q.used && dd < 10) { q.used = true; const g = 12 + ((R.rng() * 18) | 0); h.gold += g; RSfx.play('coin'); runPop(q.x, q.y - 12, '+' + g + ' зол.', '#ffd84a'); if (R.rng() < 0.4) R.drops.push({ x: q.x + 8, y: q.y, heal: 25 }); }
    else if (q.k === 'smith' && dd < 12) {
      if (!q.used && h.gold >= 20) { q.used = true; h.gold -= 20; h.dmg *= 1.15; RSfx.play('pick'); runPop(q.x, q.y - 14, 'Заточка! +15% урона', '#8ad8ff'); }
      else if (!q.used && R.t - (q.say || -9) > 2.5) { q.say = R.t; runPop(q.x, q.y - 14, 'Кузнец: 20 золота', '#f1dfb0'); }
    } else if (q.k === 'spikes') {
      const on = ((R.t + q.ph) % 3) > 2.2; q.on = on;
      if (on && dd < 6) runHurtHero(8 * R.diff.mult);
    }
  }
  if (R.rescue && Math.hypot(h.x - R.rescue.x, h.y - R.rescue.y) < 11) {
    const k = R.rescue.kind; R.pal = { x: R.rescue.x, y: R.rescue.y, hp: 60, max: 60, cd: 0, kind: k, hit: 0 };
    R.meta.pal2 = k; RSfx.play('heal'); R.msg = 'Новый напарник: ' + RUN_PALS[k][0]; R.msgT = 2.4; R.rescue = null;
  }
  // лестница
  if (!R.stairs.open && !alive && !R.boss) { R.stairs.open = true; RSfx.play('stairs'); R.msg = 'Лестница открыта'; R.msgT = 1.8; }
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
  const opts = RUN_UPS.slice().sort(() => R.rng() - 0.5).slice(0, R.choices || 3), box = R.el.querySelector('#run-pick');
  R.pick = true; box.style.display = 'flex';
  box.innerHTML = '<div style="width:100%;text-align:center;color:#f1dfb0;font:700 22px sans-serif;margin-bottom:6px">Выберите награду</div>' + opts.map((u, i) =>
    `<button data-i="${i}" style="width:min(190px,44vw);padding:14px 10px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer"><b style="font-size:16px">${u.n}</b><br><small>${u.d}</small></button>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    RSfx.play('pick'); opts[+b.dataset.i].f(R.hero); R.ups.push(opts[+b.dataset.i].n);
    R.pick = null; box.style.display = 'none'; R.floor++; runFloorBuild();
  });
}

// ---------- конец забега ----------
function runEnd(win, quit) {
  const R = Run; if (R.over) return; R.over = true;
  RSfx.play(win ? 'win' : 'lose'); RSfx.ambStop();
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
  const R = Run; R.on = false; cancelAnimationFrame(R.raf); RSfx.ambStop();
  window.removeEventListener('keydown', R.kd); window.removeEventListener('keyup', R.ku);
  if (R.el) R.el.remove();
  try { setSpeed(R.prevSpeed || 1); } catch (e) { /* без паузы */ }
}

// ---------- рисование ----------
function runDraw() {
  const R = Run, cv = R.cv, Z = Math.min(innerWidth, innerHeight) < 520 ? 2 : 3;   // на телефоне видно больше мира
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
  for (const q of R.props) {
    const x = Math.round(q.x), y = Math.round(q.y);
    if (q.k === 'chest') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 6, y + 3, 12, 3); c.fillStyle = q.used ? '#4a3220' : '#8a5a2a'; c.fillRect(x - 6, y - 4, 12, 8); c.fillStyle = q.used ? '#3a2a1a' : '#a8702e'; c.fillRect(x - 6, y - 6, 12, 3); c.fillStyle = '#d8b050'; c.fillRect(x - 6, y - 1, 12, 1); c.fillRect(x - 1, y - 2, 2, 3); if (!q.used) { c.fillStyle = '#ffe680'; c.fillRect(x + 2, y - 8 + Math.sin(R.t * 4) , 1, 2); } }
    else if (q.k === 'smith') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 7, y + 3, 14, 3); c.fillStyle = '#3a3a44'; c.fillRect(x - 6, y - 2, 12, 4); c.fillRect(x - 3, y + 2, 6, 3); c.fillStyle = '#6a6a78'; c.fillRect(x - 6, y - 3, 12, 2); c.fillRect(x + 5, y - 2, 3, 1); c.fillStyle = q.used ? '#6a6a78' : '#ffb43c'; c.fillRect(x - 2, y - 5, 4, 2); }
    else if (q.k === 'spikes') { c.fillStyle = '#2a2234'; c.fillRect(x - 5, y - 2, 10, 5); c.fillStyle = q.on ? '#d8d0c0' : '#4a4258'; for (let k = -1; k <= 1; k++) c.fillRect(x + k * 3 - 1, q.on ? y - 5 : y - 2, 2, q.on ? 6 : 2); }
  }
  if (R.rescue) {
    const q = R.rescue; runDrawDwarf(c, q.x, q.y, '#6a6a70', 1, false, true, false, q.kind);
    c.fillStyle = '#9a9aa8'; c.fillRect(q.x - 6, q.y - 2, 12, 1); c.fillRect(q.x - 6, q.y + 1, 12, 1);
    c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#f1dfb0'; c.fillText('Спаси меня!', q.x, q.y - 20 + Math.sin(R.t * 3));
  }
  for (const d of R.drops) { c.fillStyle = '#c8402a'; c.fillRect(d.x - 3, d.y - 3, 6, 6); c.fillStyle = '#ffd0c0'; c.fillRect(d.x - 1, d.y - 2, 2, 4); }
  // сущности по глубине
  const ents = [];
  for (const e of R.enemies) if (e.hp > 0) ents.push({ y: e.y, f: () => runDrawEnemy(c, e) });
  if (!R.pal.dead) ents.push({ y: R.pal.y, f: () => runDrawDwarf(c, R.pal.x, R.pal.y, RUN_PALS[R.pal.kind][2], R.pal.x < h.x ? 1 : -1, R.pal.hit > 0, true, R.pal.moving, R.pal.kind) });
  ents.push({ y: h.y, f: () => runDrawDwarf(c, h.x, h.y, RUN_CLOAKS[R.meta.cloak % RUN_CLOAKS.length][1], h.face, h.hit > 0 || (h.inv > 0 && ((R.t * 20) | 0) % 2), false, h.moving) });
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

function runDrawDwarf(c, x, y, cloak, face, hit, pal, moving, kind) {
  const T = Run.t, step = moving ? Math.sin(T * 14 + x * 0.1) : 0, bob = moving ? Math.abs(step) * -1 : Math.sin(T * 3 + x) * 0.4;
  x = Math.round(x); y = Math.round(y);
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(x - 6, y + 4, 12, 3);
  // ноги шагают поочерёдно
  c.fillStyle = '#3a2a1a'; c.fillRect(x - 3, y + 1 + (step > 0 ? -1 : 0), 2, 4); c.fillRect(x + 1, y + 1 + (step < 0 ? -1 : 0), 2, 4);
  c.fillStyle = '#1a1008'; c.fillRect(x - 3, y + 4 + (step > 0 ? -1 : 0), 3, 1); c.fillRect(x + 1, y + 4 + (step < 0 ? -1 : 0), 3, 1);
  const by = Math.round(y + bob);
  // плащ и тело
  c.fillStyle = cloak; c.fillRect(x - 4, by - 6, 8, 8); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 4, by + 1, 8, 1); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x - 4, by - 6, 8, 1);
  c.fillStyle = '#6a4a1a'; c.fillRect(x - 4, by - 1, 8, 1); c.fillStyle = '#d8b050'; c.fillRect(x - 1, by - 1, 2, 1);   // пояс с пряжкой
  // голова и борода
  c.fillStyle = '#e8b890'; c.fillRect(x - 3, by - 11, 6, 5);
  const beard = pal ? ({ warrior: '#8a5a2a', archer: '#a0a0a8', healer: '#e8e0d0', bomber: '#c85a2a' })[kind] || '#8a5a2a' : '#c8663a';
  c.fillStyle = beard; c.fillRect(x - 3, by - 8, 6, 5); c.fillRect(x - 2, by - 3, 4, 1);
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 3, by - 5, 6, 1);
  c.fillStyle = '#1a1008'; c.fillRect(x + face - 1, by - 10, 1, 1); c.fillRect(x + face + 1, by - 10, 1, 1);
  // шлем или колпак
  if (kind === 'healer') { c.fillStyle = '#e8e0d0'; c.fillRect(x - 4, by - 14, 8, 4); c.fillStyle = '#c8402a'; c.fillRect(x - 1, by - 13, 2, 3); c.fillRect(x - 2, by - 12, 4, 1); }
  else if (kind === 'archer') { c.fillStyle = '#4a8a3a'; c.fillRect(x - 4, by - 13, 8, 3); c.fillRect(x - 2, by - 15, 5, 2); c.fillStyle = '#e8e0d0'; c.fillRect(x + 2, by - 16, 1, 3); }
  else if (kind === 'bomber') { c.fillStyle = '#5a4a3a'; c.fillRect(x - 4, by - 13, 8, 3); c.fillStyle = '#c8962a'; c.fillRect(x - 4, by - 12, 8, 1); c.fillStyle = '#7ad8ff'; c.fillRect(x - 3, by - 11, 2, 1); }
  else { c.fillStyle = '#8a929a'; c.fillRect(x - 4, by - 14, 8, 4); c.fillRect(x - 2, by - 15, 4, 1); c.fillStyle = '#c8d0d8'; c.fillRect(x - 4, by - 14, 8, 1); c.fillRect(x + face * 2, by - 13, 1, 3); }
  // оружие в руке
  const wx = x + face * 5, sw = Run.hero.swing > 0 && !pal ? -3 : 0;
  if (pal && kind === 'archer') { c.strokeStyle = '#8a5a2a'; c.lineWidth = 1; c.beginPath(); c.arc(wx - face * 2, by - 4, 5, face > 0 ? -1.2 : Math.PI - 1.2, face > 0 ? 1.2 : Math.PI + 1.2); c.stroke(); }
  else if (pal && kind === 'healer') { c.fillStyle = '#8a5a2a'; c.fillRect(wx, by - 9, 1, 11); c.fillStyle = '#8aff9a'; c.fillRect(wx - 1, by - 11, 3, 3); }
  else if (pal && kind === 'bomber') { c.fillStyle = '#4a3a2a'; c.fillRect(wx - 1, by - 5, 4, 4); c.fillStyle = '#ffb43c'; c.fillRect(wx + 1, by - 7, 1, 2); }
  else if (pal && kind === 'warrior') { c.fillStyle = '#6a4a2a'; c.fillRect(wx - face * 1, by - 8, 4, 7); c.fillStyle = '#c8a050'; c.fillRect(wx, by - 7, 2, 5); c.fillStyle = '#cfd4dc'; c.fillRect(x - face * 5, by - 7, 1, 7); }
  else { c.fillStyle = '#cfd4dc'; c.fillRect(wx, by - 9 + sw, 1, 8); c.fillStyle = '#8a5a2a'; c.fillRect(wx - 1, by - 2 + sw, 3, 1); c.fillStyle = '#fff'; c.fillRect(wx, by - 9 + sw, 1, 1); }
  if (hit) { c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillRect(x - 4, by - 15, 8, 20); }
}
function runDrawEnemy(c, e) {
  const T = Run.t, ph = T * 8 + e.x, x = Math.round(e.x), y = Math.round(e.y), fc = Run.hero.x < e.x ? -1 : 1;
  c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(x - 6, y + 4, 12, 3);
  const flash = () => { c.fillStyle = 'rgba(255,255,255,0.65)'; };
  if (e.kind === 'malgor') {
    const f = Math.sin(T * 2) * 2, y0 = y - 8 + f, phs = e.hp > e.max * 0.66 ? 0 : e.hp > e.max * 0.33 ? 1 : 2;
    const col = ['#6aff9a', '#b070ff', '#ff70c8'][phs];   // цвет магии по фазе
    const g = c.createRadialGradient(x, y0 - 10, 2, x, y0 - 10, 26); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); c.fillStyle = g; c.fillRect(x - 28, y0 - 38, 56, 56);
    // рваный подол мантии
    c.fillStyle = '#1e2250'; c.beginPath(); c.moveTo(x - 10, y0 + 8); for (let k = 0; k <= 5; k++) c.lineTo(x - 10 + k * 4, y0 + 8 + (k % 2) * 3 + Math.sin(T * 3 + k)); c.lineTo(x + 10, y0 - 12); c.lineTo(x - 10, y0 - 12); c.fill();
    c.fillStyle = '#3b4a9a'; c.fillRect(x - 8, y0 - 14, 16, 20); c.fillStyle = '#4a5ab0'; c.fillRect(x - 8, y0 - 14, 3, 20); c.fillStyle = '#2a2f6a'; c.fillRect(x + 2, y0 - 12, 4, 18);
    c.fillStyle = '#d8b050'; c.fillRect(x - 8, y0 - 3, 16, 1); for (const k of [-6, 0, 6]) c.fillRect(x + k - 1, y0 - 12, 2, 2);
    // капюшон, лицо, зелёные глаза, борода
    c.fillStyle = '#12142e'; c.fillRect(x - 6, y0 - 26, 12, 13); c.fillStyle = '#2a2f6a'; c.fillRect(x - 5, y0 - 30, 10, 5); c.fillRect(x - 3, y0 - 33, 6, 4);
    c.fillStyle = '#d8d0e8'; c.fillRect(x - 3, y0 - 22, 6, 7);
    c.fillStyle = '#6aff9a'; c.fillRect(x - 3, y0 - 21, 2, 2); c.fillRect(x + 1, y0 - 21, 2, 2);
    c.fillStyle = '#ffffff'; c.fillRect(x - 3, y0 - 21, 1, 1); c.fillRect(x + 1, y0 - 21, 1, 1);
    c.fillStyle = '#c8c0d8'; c.fillRect(x - 2, y0 - 15, 4, 4); c.fillRect(x - 1, y0 - 11, 2, 2);
    // посох с пульсирующим кристаллом
    const sx = x + 12 * fc; c.fillStyle = '#6a4a2a'; c.fillRect(sx, y0 - 26, 2, 36);
    const g2 = c.createRadialGradient(sx + 1, y0 - 30, 1, sx + 1, y0 - 30, 11); g2.addColorStop(0, col + 'cc'); g2.addColorStop(1, col + '00'); c.fillStyle = g2; c.globalAlpha = 0.6 + Math.sin(T * 5) * 0.3; c.fillRect(sx - 10, y0 - 41, 22, 22); c.globalAlpha = 1;
    c.fillStyle = col; c.fillRect(sx - 1, y0 - 33, 4, 6); c.fillStyle = '#fff'; c.fillRect(sx, y0 - 32, 1, 2);
    if (e.hit > 0) { flash(); c.fillRect(x - 9, y0 - 33, 18, 42); }
    return;
  }
  if (e.kind === 'raven') {
    const fy = y - 12 + Math.sin(T * 6 + e.x) * 2, w = Math.sin(T * 24 + e.x);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x - 3, y + 4, 6, 2);
    c.fillStyle = '#14141e'; c.fillRect(x - 4, fy - 2, 8, 5); c.fillRect(x + 3 * fc - (fc < 0 ? 3 : 0), fy - 4, 4, 4);
    c.fillStyle = '#d8a030'; c.fillRect(x + 7 * fc - (fc < 0 ? 2 : 0), fy - 2, 3, 1);
    c.fillStyle = '#6aff9a'; c.fillRect(x + 4 * fc, fy - 3, 1, 1);
    c.fillStyle = '#242436'; c.fillRect(x - 10, fy - 4 - w * 4, 7, 2); c.fillRect(x + 3, fy - 4 + w * 4, 7, 2);
    c.fillRect(x - 8, fy - 2 - w * 3, 4, 2); c.fillRect(x + 4, fy - 2 + w * 3, 4, 2);
    c.fillStyle = '#14141e'; c.fillRect(x - 6 * fc, fy + 1, 3, 2);
    if (e.hit > 0) { flash(); c.fillRect(x - 10, fy - 6, 20, 10); }
    return;
  }
  // скелет в индиго-доспехе: шагает, рёбра в разрыве, горящие глаза
  const st = Math.sin(ph * 1.1), by = y + (Math.abs(st) > 0.7 ? -1 : 0);
  c.fillStyle = '#d8d0c0'; c.fillRect(x - 3, y + 1 + (st > 0 ? -1 : 0), 2, 4); c.fillRect(x + 1, y + 1 + (st < 0 ? -1 : 0), 2, 4);
  c.fillStyle = '#2a3070'; c.fillRect(x - 5, by - 6, 10, 7); c.fillStyle = '#3b4a9a'; c.fillRect(x - 5, by - 6, 10, 2); c.fillStyle = '#1a1e48'; c.fillRect(x - 5, by, 10, 1);
  c.fillStyle = '#d8d0c0'; for (const k of [-2, 0, 2]) c.fillRect(x + k, by - 4, 1, 3);
  c.fillStyle = '#d8d0c0'; c.fillRect(x - 3, by - 12, 6, 6); c.fillRect(x - 2, by - 6, 4, 1);
  c.fillStyle = '#12142e'; c.fillRect(x - 2, by - 10, 2, 2); c.fillRect(x + 1, by - 10, 2, 2); c.fillRect(x - 1, by - 7, 3, 1);
  c.fillStyle = '#6aff9a'; c.fillRect(x - 2, by - 10, 1, 1); c.fillRect(x + 1, by - 10, 1, 1);
  c.fillStyle = '#2a3070'; c.fillRect(x - 4, by - 14, 8, 3);
  const aw = e.cd > 0.5 ? 0 : -2;
  c.fillStyle = '#a89a8a'; c.fillRect(x + fc * 6, by - 8 + aw, 1, 8); c.fillStyle = '#6a4a2a'; c.fillRect(x + fc * 5, by - 1 + aw, 3, 1);
  if (e.hit > 0) { flash(); c.fillRect(x - 5, by - 14, 10, 20); }
  if (e.hp < e.max) { c.fillStyle = '#000a'; c.fillRect(x - 6, by - 18, 12, 2); c.fillStyle = '#c8402a'; c.fillRect(x - 6, by - 18, 12 * e.hp / e.max, 2); }
}
