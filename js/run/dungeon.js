'use strict';
// Забег в подземелье Малгора (ЗАБЕГ.md): экран поверх ядра js/run/runsim.js — ввод, рисование, звук.
// Сама игра (этажи, бой, награды, босс) живёт в ядре и идёт ровными шагами RS_DT; здесь только
// ввод превращается в запись (по ней сервер переигрывает рекорды), а события ядра — в звуки и надписи.
// Полноэкранный оверлей поверх деревни; кампания на время забега стоит на паузе.

const Run = { on: false };

function runStart(diff, o) {
  if (Run.on) return;
  o = o || {};
  const meta = runMeta(), U = meta.ups || {}, fair = !!(diff.weekly || diff.daily);
  let d = diff;
  if (diff.id === 'curse') { const lvl = Math.max(1, Math.min(5, meta.wins)); d = Object.assign({}, diff, { mult: 1.3 + 0.2 * lvl, lvl, name: 'Проклятие ' + lvl }); }
  // ежедневный и недельный — честные условия: мета-прокачка и купленное оружие не действуют
  const hero = fair ? { hp: 100, dmg: 12, weapon: 'pick', choices: 3, pal: 'warrior' }
    : { hp: 100 + 10 * (U.hp | 0), dmg: 12 * (1 + 0.08 * (U.dmg | 0)), weapon: meta.weapon || 'pick', choices: 3 + ((U.choice | 0) ? 1 : 0), pal: meta.pal };
  hero.cloak = meta.cloak | 0;
  const seed = o.seed != null ? o.seed : diff.daily ? rsSeedOfDay(runDayKey()) : diff.weekly ? runWeekSeed() * 7919 + 13 : (Math.random() * 1e9) | 0;
  const opts = { seed, diff: { id: d.id, name: d.name, floors: d.floors, mult: d.mult, lvl: d.lvl }, heroes: [hero] };
  Object.assign(Run, {
    on: true, diff: d, meta, opts, S: rsNew(opts), me: 0, keys: {}, joy: null, prevSpeed: Game.speed || 1, flash: 0, pops: [], acc: 0,
    rec: [], lastMx: 0, lastMy: 0, press: { dash: false, slam: false }, ranked: !!o.ranked, shown: false,
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
  el.querySelector('#run-exit').onclick = () => runQuit();
  const touch = matchMedia('(pointer:coarse)').matches || (typeof Mobile !== 'undefined' && Mobile.on);
  if (touch) { el.querySelector('#run-joy').style.display = 'block'; el.querySelector('#run-btns').style.display = 'flex'; }
  Run.kd = e => { Run.keys[e.code] = true; if (e.code === 'Space') { Run.press.dash = true; e.preventDefault(); } if (e.code === 'KeyE') Run.press.slam = true; };
  Run.ku = e => { Run.keys[e.code] = false; };
  window.addEventListener('keydown', Run.kd); window.addEventListener('keyup', Run.ku);
  el.querySelectorAll('#run-btns button').forEach(b => { b.addEventListener('pointerdown', e => { e.stopPropagation(); Run.press[b.dataset.a] = true; }); });
  const joy = el.querySelector('#run-joy'), knob = el.querySelector('#run-knob');
  const jm = e => { const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + 60), dy = e.clientY - (r.top + 60), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 50); Run.joy = { x: dx / d * k, y: dy / d * k }; knob.style.left = 40 + dx / d * Math.min(d, 50) + 'px'; knob.style.top = 40 + dy / d * Math.min(d, 50) + 'px'; };
  joy.addEventListener('pointerdown', e => { try { joy.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое событие */ } jm(e); });
  joy.addEventListener('pointermove', e => { if (e.buttons || e.pressure) jm(e); });
  const jend = () => { Run.joy = null; knob.style.left = '40px'; knob.style.top = '40px'; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  RSfx.ambStart('dungeon');
  runEvents();
  let last = performance.now();
  const loop = now => {
    if (!Run.on) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    try { runFrame(dt); RSfx.ambTick(dt); runDraw(); } catch (e) { console.error(e); }
    Run.raf = requestAnimationFrame(loop);
  };
  Run.raf = requestAnimationFrame(loop);
}

const runDayKey = () => new Date().toISOString().slice(0, 10);   // ежедневный забег — по дате UTC, у всех одна

// ---------- ввод → запись → ядро ----------
function runInput() {
  const K = Run.keys;
  let ix = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), iy = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
  if (Run.joy) { ix = Run.joy.x; iy = Run.joy.y; }
  return [Math.round(ix * 8), Math.round(iy * 8)];   // направление ×8 целым — то же, что увидит переигровка
}
function runFrame(dt) {
  const S = Run.S;
  Run.flash = Math.max(0, Run.flash - dt);
  for (let i = Run.pops.length - 1; i >= 0; i--) { const p = Run.pops[i]; p.t -= dt; p.y -= 14 * dt; if (p.t <= 0) Run.pops.splice(i, 1); }
  if (!S.over && !S.pick) {
    Run.acc = Math.min(Run.acc + dt, RS_DT * 6);
    while (Run.acc >= RS_DT && !S.over && !S.pick) {
      Run.acc -= RS_DT;
      const [mx, my] = runInput(), me = Run.me, inp = [];
      if (mx !== Run.lastMx || my !== Run.lastMy) { Run.rec.push([S.step, me, 0, mx, my]); Run.lastMx = mx; Run.lastMy = my; }
      if (Run.press.dash) Run.rec.push([S.step, me, 1]);
      if (Run.press.slam) Run.rec.push([S.step, me, 2]);
      inp[me] = { mx: mx / 8, my: my / 8, dash: Run.press.dash, slam: Run.press.slam };
      Run.press.dash = Run.press.slam = false;
      rsStep(S, inp);
      runEvents();
    }
  } else Run.press.dash = Run.press.slam = false;
  if (S.pick && !Run.pickShown) runPickShow();
  if (S.over && !Run.shown) runEnd();
  runHud();
}
function runEvents() {
  const S = Run.S;
  for (const e of S.ev) {
    if (e.k === 'sfx') RSfx.play(e.n, e.vol);
    else if (e.k === 'pop') Run.pops.push({ x: e.x, y: e.y, text: e.text, col: e.col, t: 0.8 });
    else if (e.k === 'flash') Run.flash = Math.max(Run.flash, e.v);
    else if (e.k === 'msg') { Run.msg = e.text; Run.msgT = e.t; }
    else if (e.k === 'pal' && RUN_PALS[e.kind]) { Run.msg = 'Новый напарник: ' + RUN_PALS[e.kind][0]; Run.msgT = 2.4; }
  }
  S.ev.length = 0;
}

function runHud() {
  const S = Run.S, h = S.heroes[Run.me], el = Run.el.querySelector('#run-hud'), pal = S.pals.find(p => p.owner === Run.me);
  const bar = (v, m, col) => `<div style="width:150px;height:9px;background:#0008;border:1px solid #000a;border-radius:3px"><div style="width:${Math.max(0, v / m * 100)}%;height:100%;background:${col};border-radius:2px"></div></div>`;
  const boss = S.enemies.find(e => e.boss && e.hp > 0);
  el.innerHTML = `${S.diff.name} · этаж ${S.floor + 1}/${S.diff.floors} &nbsp; 💰${h.gold}<br>${bar(h.hp, h.max, '#c8402a')}${!pal || pal.dead ? '' : '<div style="margin-top:3px">' + bar(pal.hp, pal.max, '#4a8a3a') + '</div>'}`
    + (boss ? `<div style="margin-top:6px">Малгор</div>${bar(boss.hp, boss.max, '#8a5ad0')}` : '');
  Run.msgT = (Run.msgT || 0) - 1 / 60;
  Run.el.querySelector('#run-msg').textContent = Run.msgT > 0 ? Run.msg : '';
}

// ---------- выбор награды после этажа ----------
function runPickShow() {
  const S = Run.S, P = S.pick, box = Run.el.querySelector('#run-pick'), ids = P.opts[Run.me] || [];
  Run.pickShown = true; box.style.display = 'flex';
  box.innerHTML = '<div style="width:100%;text-align:center;color:#f1dfb0;font:700 22px sans-serif;margin-bottom:6px">Выберите награду</div>' + ids.map((id, i) => {
    const u = RS_UPS.find(x => x.id === id);
    return `<button data-i="${i}" style="width:min(190px,44vw);padding:14px 10px;background:#3a2410;color:#f1dfb0;border:2px solid #b8902c;border-radius:8px;cursor:pointer"><b style="font-size:16px">${u.n}</b><br><small>${u.d}</small></button>`;
  }).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    if (!Run.S.pick) return;
    Run.rec.push([Run.S.step, Run.me, 3, +b.dataset.i]);
    rsChoose(Run.S, Run.me, +b.dataset.i); runEvents();
    Run.pickShown = false; box.style.display = 'none';
  });
}

// ---------- конец забега ----------
function runQuit() {
  const S = Run.S;
  if (S.over) return;
  Run.rec.push([S.step, Run.me, 4]);
  rsEnd(S, false, true); runEvents();
}
function runEnd() {
  const S = Run.S, win = S.over.win, quit = S.over.quit; if (Run.shown) return; Run.shown = true;
  RSfx.ambStop();
  const meta = runMeta(), rw = rsRewards(S), score = rsScore(S), h = S.heroes[Run.me];
  meta.runs++; meta.stones += rw.stones; meta.shards += rw.shards;
  if (win) meta.wins++;
  meta.best = Math.max(meta.best, rw.floors);
  if (Run.diff.weekly) { const wk = runWeekSeed(); meta.weekBest[wk] = Math.max(meta.weekBest[wk] || 0, score); }
  if (Run.diff.daily) { const dk = runDayKey(); meta.dayBest = meta.dayBest || {}; meta.dayBest[dk] = Math.max(meta.dayBest[dk] || 0, score); }
  if (!win) meta.hurtUntil = Date.now() + 60000;   // герой в таверне «отлёживается»
  runMetaSave(meta);
  Run.result = { opts: Run.opts, rec: Run.rec, score, ranked: Run.ranked, day: Run.diff.daily ? runDayKey() : null, week: Run.diff.weekly ? runWeekSeed() : null };
  const box = Run.el.querySelector('#run-pick'); box.style.display = 'flex';
  box.innerHTML = `<div style="text-align:center;color:#f1dfb0;font-family:sans-serif"><div style="font-size:30px;font-weight:700">${win ? 'Малгор повержен!' : quit ? 'Вы вернулись в таверну' : 'Герой пал'}</div>
    <p style="font-size:15px">Этажей: ${rw.floors} · Убито: ${S.kills} · Золото: ${h.gold}${Run.diff.weekly || Run.diff.daily ? ` · Очки: ${score}` : ''}<br>Награда: 💎 ${rw.stones}${rw.shards ? ` ◆ ${rw.shards}` : ''}${win ? '' : '<br>Хозяин вернул вас в таверну с половиной здоровья'}</p>
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
  R.pickShown = false;
  try { setSpeed(R.prevSpeed || 1); } catch (e) { /* без паузы */ }
}

// ---------- рисование ----------
function runDraw() {
  const S = Run.S, cv = Run.cv, Z = Math.min(innerWidth, innerHeight) < 520 ? 2 : 3;   // на телефоне видно больше мира
  const W = Math.ceil(innerWidth / Z), H = Math.ceil(innerHeight / Z), T = RS_T;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const h = S.heroes[Run.me], cx = Math.round(h.x - W / 2), cy = Math.round(h.y - H / 2);
  c.fillStyle = '#07040c'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(-cx, -cy);
  const i0 = Math.max(0, cx / T | 0), i1 = Math.min(RS_W - 1, (cx + W) / T | 0), j0 = Math.max(0, cy / T | 0), j1 = Math.min(RS_H - 1, (cy + H) / T | 0);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i * T, y = j * T, f = S.map[j * RS_W + i], n = (i * 7 + j * 13) % 5;
    if (f) { c.fillStyle = n < 3 ? '#4a4258' : '#443d52'; c.fillRect(x, y, T, T); c.fillStyle = '#383244'; c.fillRect(x, y + T - 1, T, 1); c.fillRect(x + T - 1, y, 1, T); if (n === 0) { c.fillStyle = '#5a526a'; c.fillRect(x + 4, y + 5, 3, 2); } }
    else if (j < RS_H - 1 && S.map[(j + 1) * RS_W + i]) { c.fillStyle = '#2a2236'; c.fillRect(x, y, T, T); c.fillStyle = '#3a3048'; c.fillRect(x, y + T - 5, T, 5); c.fillStyle = '#1a1424'; c.fillRect(x, y + T - 1, T, 1); }
    else { c.fillStyle = '#120c1a'; c.fillRect(x, y, T, T); }
  }
  // лестница
  const st = S.stairs;
  if (st.x > 0) { c.fillStyle = st.open ? '#2a6a8a' : '#2a2a34'; c.fillRect(st.x - 7, st.y - 7, 14, 14); c.fillStyle = st.open ? '#7ad8ff' : '#444'; for (let k = 0; k < 4; k++) c.fillRect(st.x - 6 + k, st.y - 6 + k * 3, 12 - k * 2, 2); }
  for (const q of S.props) {
    const x = Math.round(q.x), y = Math.round(q.y);
    if (q.k === 'chest') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 6, y + 3, 12, 3); c.fillStyle = q.used ? '#4a3220' : '#8a5a2a'; c.fillRect(x - 6, y - 4, 12, 8); c.fillStyle = q.used ? '#3a2a1a' : '#a8702e'; c.fillRect(x - 6, y - 6, 12, 3); c.fillStyle = '#d8b050'; c.fillRect(x - 6, y - 1, 12, 1); c.fillRect(x - 1, y - 2, 2, 3); if (!q.used) { c.fillStyle = '#ffe680'; c.fillRect(x + 2, y - 8 + Math.sin(S.t * 4), 1, 2); } }
    else if (q.k === 'smith') { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 7, y + 3, 14, 3); c.fillStyle = '#3a3a44'; c.fillRect(x - 6, y - 2, 12, 4); c.fillRect(x - 3, y + 2, 6, 3); c.fillStyle = '#6a6a78'; c.fillRect(x - 6, y - 3, 12, 2); c.fillRect(x + 5, y - 2, 3, 1); c.fillStyle = q.used ? '#6a6a78' : '#ffb43c'; c.fillRect(x - 2, y - 5, 4, 2); }
    else if (q.k === 'spikes') { c.fillStyle = '#2a2234'; c.fillRect(x - 5, y - 2, 10, 5); c.fillStyle = q.on ? '#d8d0c0' : '#4a4258'; for (let k = -1; k <= 1; k++) c.fillRect(x + k * 3 - 1, q.on ? y - 5 : y - 2, 2, q.on ? 6 : 2); }
  }
  if (S.rescue) {
    const q = S.rescue; runDrawDwarf(c, q.x, q.y, '#6a6a70', 1, false, true, false, q.kind, 0);
    c.fillStyle = '#9a9aa8'; c.fillRect(q.x - 6, q.y - 2, 12, 1); c.fillRect(q.x - 6, q.y + 1, 12, 1);
    c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#f1dfb0'; c.fillText('Спаси меня!', q.x, q.y - 20 + Math.sin(S.t * 3));
  }
  for (const d of S.drops) { c.fillStyle = '#c8402a'; c.fillRect(d.x - 3, d.y - 3, 6, 6); c.fillStyle = '#ffd0c0'; c.fillRect(d.x - 1, d.y - 2, 2, 4); }
  // сущности по глубине
  const ents = [];
  for (const e of S.enemies) if (e.hp > 0) ents.push({ y: e.y, f: () => runDrawEnemy(c, e) });
  for (const p of S.pals) if (!p.dead) { const o = S.heroes[p.owner]; ents.push({ y: p.y, f: () => runDrawDwarf(c, p.x, p.y, RUN_PALS[p.kind][2], p.x < o.x ? 1 : -1, p.hit > 0, true, p.moving, p.kind, 0) }); }
  for (const o of S.heroes) {
    if (o.gone) continue;
    ents.push({ y: o.y, f: () => {
      if (o.down) { c.globalAlpha = 0.55; runDrawDwarf(c, o.x, o.y, RUN_CLOAKS[o.cloak % RUN_CLOAKS.length][1], o.face, false, false, false, null, 0); c.globalAlpha = 1; if (o.rev > 0) { c.fillStyle = '#000a'; c.fillRect(o.x - 8, o.y - 22, 16, 3); c.fillStyle = '#8aff9a'; c.fillRect(o.x - 8, o.y - 22, 16 * o.rev / 3, 3); } return; }
      runDrawDwarf(c, o.x, o.y, RUN_CLOAKS[o.cloak % RUN_CLOAKS.length][1], o.face, o.hit > 0 || (o.inv > 0 && ((S.t * 20) | 0) % 2), false, o.moving, null, o.swing);
    } });
  }
  ents.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const o of S.heroes) {
    if (o.gone || o.down) continue;
    if (o.swing > 0) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(o.x + o.face * 8, o.y - 4, 10, o.face > 0 ? -1 : Math.PI - 1, o.face > 0 ? 1 : Math.PI + 1); c.stroke(); }
    if (o.slam > 0) { c.strokeStyle = `rgba(255,200,80,${o.slam * 3})`; c.lineWidth = 3; c.beginPath(); c.arc(o.x, o.y, 40 * (1 - o.slam / 0.3 * 0.7), 0, 7); c.stroke(); }
  }
  for (const s of S.shots) { c.fillStyle = s.own === 'e' ? '#b070ff' : (s.r ? '#ff9a3a' : '#e8e0d0'); c.beginPath(); c.arc(s.x, s.y, s.own === 'e' ? 3 : s.r ? 3.5 : 2, 0, 7); c.fill(); if (s.own === 'e') { c.fillStyle = '#6aff9a'; c.fillRect(s.x - 1, s.y - 1, 2, 2); } }
  c.font = 'bold 8px sans-serif'; c.textAlign = 'center';
  for (const p of Run.pops) { c.fillStyle = '#000'; c.fillText(p.text, p.x + 0.5, p.y + 0.5); c.fillStyle = p.col; c.fillText(p.text, p.x, p.y); }
  c.restore();
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  if (Run.flash > 0) { c.fillStyle = `rgba(255,220,120,${Run.flash * 0.6})`; c.fillRect(0, 0, W, H); }
}

function runDrawDwarf(c, x, y, cloak, face, hit, pal, moving, kind, swing) {
  const T = Run.S.t, step = moving ? Math.sin(T * 14 + x * 0.1) : 0, bob = moving ? Math.abs(step) * -1 : Math.sin(T * 3 + x) * 0.4;
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
  const wx = x + face * 5, sw = swing > 0 && !pal ? -3 : 0;
  if (pal && kind === 'archer') { c.strokeStyle = '#8a5a2a'; c.lineWidth = 1; c.beginPath(); c.arc(wx - face * 2, by - 4, 5, face > 0 ? -1.2 : Math.PI - 1.2, face > 0 ? 1.2 : Math.PI + 1.2); c.stroke(); }
  else if (pal && kind === 'healer') { c.fillStyle = '#8a5a2a'; c.fillRect(wx, by - 9, 1, 11); c.fillStyle = '#8aff9a'; c.fillRect(wx - 1, by - 11, 3, 3); }
  else if (pal && kind === 'bomber') { c.fillStyle = '#4a3a2a'; c.fillRect(wx - 1, by - 5, 4, 4); c.fillStyle = '#ffb43c'; c.fillRect(wx + 1, by - 7, 1, 2); }
  else if (pal && kind === 'warrior') { c.fillStyle = '#6a4a2a'; c.fillRect(wx - face * 1, by - 8, 4, 7); c.fillStyle = '#c8a050'; c.fillRect(wx, by - 7, 2, 5); c.fillStyle = '#cfd4dc'; c.fillRect(x - face * 5, by - 7, 1, 7); }
  else { c.fillStyle = '#cfd4dc'; c.fillRect(wx, by - 9 + sw, 1, 8); c.fillStyle = '#8a5a2a'; c.fillRect(wx - 1, by - 2 + sw, 3, 1); c.fillStyle = '#fff'; c.fillRect(wx, by - 9 + sw, 1, 1); }
  if (hit) { c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillRect(x - 4, by - 15, 8, 20); }
}
function runDrawEnemy(c, e) {
  const S = Run.S, T = S.t, ph = T * 8 + e.x, x = Math.round(e.x), y = Math.round(e.y), me = S.heroes[Run.me], fc = me.x < e.x ? -1 : 1;
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
