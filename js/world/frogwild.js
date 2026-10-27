'use strict';
// Жаболюды-рабовладельцы и дикие малыши (ЖАБОЛЮДЫ.md §«Рабовладение»).
// Дикие малыши — болотная улитка-тяжеловоз, водяной тритон, мотылёк-фонарик — бродят по карте ПО ОДНОМУ, без логова.
// Жаболюды порабощают всех, кто меньше них: ловят их по одному и уводят в свайную деревню (кабала: улитка таскает
// волокушу в загоне, тритоны плавают в пруду, мотыльки светят над мостками); гоблинов уводят из гоблинских лагерей.
// Игрок может освободить раба (клик по нему): жаболюды разозлятся. Гномёнка жаболюд тоже может попытаться схватить —
// но гномёнок выхватывает игрушечный пистолет («Бах!», folk.js) — и жаболюд удирает к себе в деревню.
// Всё считает симуляция (в кооперативе — сервер); клиент получает список Game.swp зеркалом (fwMirror).
// Подключается после frogs.js; чужие файлы не правятся — обёртки (resolveCmd, runCmd, folkScare, neuDrawList, сохранение).

Game.swp = [];
const FW = { sec: 0, spawnT: 0, hint: false };
const FW_SPEC = {
  snail: { name: 'Болотная улитка-тяжеловоз', spd: 0.4, led: 1.5, cap: 3, quota: 7, roam: 5 },
  newt: { name: 'Водяной тритон', spd: 1.1, led: 1.8, cap: 3, quota: 5, roam: 3 },
  moth: { name: 'Мотылёк-фонарик', spd: 1.0, led: 1.8, cap: 4, quota: 8, roam: 9, fly: true },
  goblin: { name: 'Гоблин', spd: 1.7, led: 2.0, cap: 5, quota: 0, roam: 3 },
};
const fwNow = () => Game.time;
const fwArt = W => (W.k === 'goblin' ? (W.alt ? 'goblinB' : 'goblin') : W.k);
const fwQuota = k => Math.max(1, Math.round(FW_SPEC[k].quota * (N_TILES / 19200)));
const fwStamp = () => FT.stamp || (FT.stamp = floodFrom(MAP_W >> 1, MAP_H >> 1));
const fwWet = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_WATER) return true; return false; };
const fwLairXY = L => [L.x + 0.5, L.y + 0.69];     // точка земли под началом рисунка деревни

function fwMake(k, x, y) {
  const id = Game.nextId++;
  return { id, k, x, y, face: ftRand() < 0.5 ? 1 : -1, st: 'idle', fr: 'i0', ph: ftRand() * 6, t: 1 + ftRand() * 4, tx: x, ty: y, hx: x, hy: y, own: 0, cap: 0, alt: id % 2, post: null, fl: 0 };
}

// ---------- Появление на карте ----------
function fwSite(k) {
  const stamp = fwStamp(), cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let t = 0; t < 400; t++) {
    const x = 5 + ((ftRand() * (MAP_W - 10)) | 0), y = 5 + ((ftRand() * (MAP_H - 10)) | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || !reachedIn(stamp, x, y)) continue;
    if (Math.hypot(x - cx, y - cy) < 12) continue;
    if (k === 'newt' && !fwWet(x + 0.5, y + 0.5, 1.6)) continue;
    if (k === 'moth' && !fwWet(x + 0.5, y + 0.5, 7) && t < 250) continue;
    if (Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 6)) continue;
    if (Game.lairs.some(l => l.k === 'ftvil' && Math.hypot(l.x - x, l.y - y) < 8)) continue;
    return [x + 0.5, y + 0.5];
  }
  return null;
}
function fwFree(k) { return Game.swp.filter(W => W.k === k && !W.own && !W.cap); }
function fwSpawnTo(k) {
  const s = fwSite(k);
  if (!s || Game.units.some(u => !u.dead && Math.hypot(u.x - s[0], u.y - s[1]) < 9)) return false;
  Game.swp.push(fwMake(k, s[0], s[1]));
  return true;
}
function fwSpawnInitial() {
  Game.swp = Game.swp.filter(W => W.k === 'goblin');
  for (const k of ['snail', 'newt', 'moth']) for (let i = 0, n = fwQuota(k); i < n; i++) { const s = fwSite(k); if (s) Game.swp.push(fwMake(k, s[0], s[1])); }
}

// ---------- Поведение ----------
function fwStep(W, tx, ty, spd, dt, fly) {
  const dx = tx - W.x, dy = ty - W.y, d = Math.hypot(dx, dy);
  if (d < 0.06) return true;
  const st = Math.min(d, spd * dt), nx = W.x + dx / d * st, ny = W.y + dy / d * st;
  const ok = (x, y) => (fly ? x > 0.5 && y > 0.5 && x < MAP_W - 0.5 && y < MAP_H - 0.5 : isWalkable(Math.floor(x), Math.floor(y)));
  if (ok(nx, ny)) { W.x = nx; W.y = ny; } else if (ok(nx, W.y)) W.x = nx; else if (ok(W.x, ny)) W.y = ny; else return true;
  if (Math.abs(dx) > 0.05) W.face = dx > 0 ? 1 : -1;
  W.ph += st * (W.k === 'snail' ? 7 : 3.4);
  return d - st < 0.08;
}
function fwFrame(W, moving, scared) {
  const t = fwNow();
  if (W.fl > t) return 'v' + [0, 1, 2, 3, 2, 1][Math.floor((t * 5) % 6)];        // радость освобождения
  if (scared) return 'h' + (Math.floor(t * 8 + W.id) % 4);
  if (W.k === 'moth') return (moving ? 'w' : 'i') + (Math.floor(t * (moving ? 10 : 6) + W.id) % (moving ? 8 : 6));
  return moving ? 'w' + (Math.floor(W.ph) % 8) : 'i' + (Math.floor(t * 5 + W.id) % 6);
}
const fwFear = W => Game.units.find(u => !u.dead && !u.inside && (u.hero || isPerson(u)) && Math.hypot(u.x - W.x, u.y - W.y) < (W.k === 'snail' ? 1.8 : 2.6));

function fwThink(W, dt) {
  const S = FW_SPEC[W.k], now = fwNow();
  // ведомый: идёт за захватчиком
  if (W.cap) {
    const C = Game.neutrals.find(N => N.id === W.cap);
    if (!C || !neuAlive(C) || !C.job) { W.cap = 0; W.st = 'idle'; W.t = 1; return; }
    const d = Math.hypot(C.x - W.x, C.y - W.y);
    if (d > 1.4) fwStep(W, C.x - Math.sign(C.x - W.x) * 0.6, C.y, S.led, dt, S.fly);
    W.fr = fwFrame(W, d > 1.5, false);
    return;
  }
  // раб: в кабале у деревни
  if (W.own) {
    const L = Game.lairs.find(l => l.id === W.own);
    if (!L || !Game.neutrals.some(N => N.lair === L.id && neuAlive(N) && ftIs(N))) { fwRelease(W, 'Хозяев не стало — раб разбежался', false); return; }
    W.t -= dt;
    const [bx, by] = fwLairXY(L);
    if (W.st === 'walk') { if (fwStep(W, W.tx, W.ty, S.spd * 0.8, dt, S.fly)) { W.st = 'idle'; W.t = 1 + ftRand() * 4; } }
    else if (W.t <= 0) {
      const a = W.anchor || [bx, by + 1.5, 2, 0.6];
      W.tx = bx + a[0] - 0 + (ftRand() - 0.5) * 2 * a[2]; W.ty = by + a[1] + (ftRand() - 0.5) * 2 * a[3];
      if (S.fly || isWalkable(Math.floor(W.tx), Math.floor(W.ty)) || W.k === 'newt') W.st = 'walk'; else W.t = 1;
    }
    W.fr = fwFrame(W, W.st === 'walk', false);
    return;
  }
  // освободившийся гоблин убегает и исчезает
  if (W.k === 'goblin' && W.gone) {
    W.gone -= dt; fwStep(W, W.x + W.face * 5, W.y, 2.4, dt, false); W.fr = fwFrame(W, true, false);
    if (W.gone <= 0) W.dead = true;
    return;
  }
  // дикий: бродит, пугается
  const scary = W.k !== 'goblin' && fwFear(W);
  if (scary && W.k !== 'moth') {
    W.st = 'flee';
    if (W.k === 'newt') { const a = Math.atan2(W.y - scary.y, W.x - scary.x); fwStep(W, W.x + Math.cos(a) * 3, W.y + Math.sin(a) * 3, 1.9, dt, false); }
    W.fr = fwFrame(W, W.k === 'newt', W.k === 'snail');
    return;
  }
  if (W.st === 'flee') { W.st = 'idle'; W.t = 1.5; }
  W.t -= dt;
  if (W.st === 'walk') {
    const sp = scary && W.k === 'moth' ? S.spd * 1.8 : S.spd;
    if (fwStep(W, W.tx, W.ty, sp, dt, S.fly)) { W.st = 'idle'; W.t = (W.k === 'snail' ? 4 : 1.5) + ftRand() * 6; }
  } else if (W.t <= 0) {
    const a = ftRand() * 6.283, r = 1 + ftRand() * S.roam;
    W.tx = Math.max(1, Math.min(MAP_W - 1, W.hx + Math.cos(a) * r)); W.ty = Math.max(1, Math.min(MAP_H - 1, W.hy + Math.sin(a) * r * 0.8));
    if (S.fly || isWalkable(Math.floor(W.tx), Math.floor(W.ty))) W.st = 'walk'; else W.t = 1;
  }
  W.fr = fwFrame(W, W.st === 'walk', false);
}

// где раб стоит и топчется в деревне (смещения от точки земли под рисунком, в клетках: [dx, dy, rx, ry])
function fwAnchor(k, L, W) {
  if (k === 'snail') return [3.15, 1.0, 0.7, 0.3];
  if (k === 'newt') return [0.4, 0.5, 2.3, 0.35];
  if (k === 'moth') { const A = [[0, -0.9], [-1.05, -0.5], [1.3, -0.5], [-1.8, 0], [2.0, 0]]; const a = A[W.id % A.length]; return [a[0], a[1], 0.7, 0.3]; }
  return [(W.id % 5 - 2) * 0.7, 1.6, 0.8, 0.5];                      // гоблины — на берегу перед мостками
}
function fwEnslave(W, L) {
  W.own = L.id; W.cap = 0; W.st = 'idle'; W.t = 1;
  W.anchor = fwAnchor(W.k, L, W);
  const [bx, by] = fwLairXY(L);
  W.post = W.k === 'snail' ? [bx + 2.4, by + 1.3] : W.k === 'goblin' ? [bx + W.anchor[0] * 0.5, by + 1.0] : null;
  W.hx = bx + W.anchor[0]; W.hy = by + W.anchor[1];
  if (W.k === 'newt' || W.k === 'moth') { W.x = bx + W.anchor[0]; W.y = by + W.anchor[1]; }
}
function fwRelease(W, text, quiet) {
  W.own = 0; W.cap = 0; W.st = 'idle'; W.t = 1; W.post = null; W.anchor = null; W.hx = W.x; W.hy = W.y; W.fl = fwNow() + 2.5;
  if (!quiet) floater(W.x, W.y - 1.6, 'Свобода!', '#bfe8ff');
  if (text) logEvent('animal', text, W.x, W.y);
}

// ---------- Захват: задания жаболюдов ----------
// N.job = { t: 'cap' | 'gob' | 'kid', id, ph: 'go' | 'back' | 'flee', exp }
function fwVillageTick(L, mem, now) {
  if (L.friend && false) return;
  if (!startOpen('neutrals') || ftWinter() || !Game.ft) return;
  const free = mem.filter(N => (N.k === 'ftG' || N.k === 'ftB') && !N.job && !N.tg && !N.tor && !N.jp && !N.pch && N.wet > 0.5 && !(now - N.prov < NEU_FORGET));
  if (!free.length) return;
  const [bx, by] = fwLairXY(L);
  // попытка схватить гномёнка (он ответит «Бах!»)
  if (!(L.kidT2 > now) && !L.friend) {
    const kid = Game.units.find(u => u.type === 'kid' && !u.dead && !u.inside && Math.hypot(u.x - bx, u.y - by) < 9);
    if (kid) {
      L.kidT2 = now + 150 + ftRand() * 100;
      const N = free[(ftRand() * free.length) | 0];
      N.job = { t: 'kid', id: kid.id, ph: 'go', exp: now + 40 };
      floater(N.x, N.y - 2, 'Хе-хе… малыш!', '#c0e080');
      return;
    }
  }
  if (L.capT > now) return;
  const mine = Game.swp.filter(W => W.own === L.id), cnt = k => mine.filter(W => W.k === k).length;
  let best = null, bd = 99;
  for (const k of ['snail', 'newt', 'moth']) {
    if (cnt(k) >= FW_SPEC[k].cap) continue;
    for (const W of Game.swp) { if (W.k !== k || W.own || W.cap || W.st === 'flee') continue; const d = Math.hypot(W.x - bx, W.y - by); if (d < 20 && d < bd) { bd = d; best = { t: 'cap', id: W.id, x: W.x, y: W.y }; } }
  }
  if (!best && Game.ft.nt >= 1 && cnt('goblin') < FW_SPEC.goblin.cap) {
    for (const M of Game.neutrals) {
      if (M.k !== 'goblin' || !neuAlive(M) || M.tg || now - M.prov < NEU_FORGET) continue;
      const d = Math.hypot(M.x - bx, M.y - by);
      if (d < 34 && d < bd + 8 && (!best || d < bd)) { bd = d; best = { t: 'gob', id: M.id, x: M.x, y: M.y }; }
    }
  }
  if (!best) { L.capT = now + 20; return; }
  free.sort((a, b) => Math.hypot(a.x - best.x, a.y - best.y) - Math.hypot(b.x - best.x, b.y - best.y));
  const N = free[0];
  N.job = { t: best.t, id: best.id, ph: 'go', exp: now + 120 };
  L.capT = now + 70 + ftRand() * 70;
  floater(N.x, N.y - 2, best.t === 'gob' ? 'За добычей! Гоблины — в кабалу!' : 'Поймаем малыша!', '#c0e080');
}

function ftFlee(N) {
  N.job = { t: 'kid', id: 0, ph: 'flee', exp: ftNow() + 40 };
  N.tg = 0; N.st = 'home';
}

// вызывается из neuThink квакуна; true — ход потрачен на задание
function ftJobThink(N, dt) {
  const J = N.job, now = ftNow(), S = NSPEC[N.k];
  if (now > J.exp || ftWinter()) { fwAbort(N); return false; }
  let tx, ty;
  if (J.ph === 'flee' || J.ph === 'back') { tx = N.hx + (N.id % 5 - 2) * 0.5; ty = N.hy + 1.6; }
  else if (J.t === 'cap') { const W = Game.swp.find(w => w.id === J.id); if (!W || W.own || W.cap) { fwAbort(N); return false; } tx = W.x; ty = W.y; }
  else if (J.t === 'gob') { const M = Game.neutrals.find(m => m.id === J.id); if (!M || !neuAlive(M) || M.tg) { fwAbort(N); return false; } tx = M.x; ty = M.y; }
  else { const u = Game.unitMap.get(J.id); if (!u || u.dead || u.inside) { fwAbort(N); return false; } tx = u.x; ty = u.y; }
  const d = Math.hypot(tx - N.x, ty - N.y), sp = S.spd * (J.ph === 'flee' ? 1.5 : 0.95);
  if (J.ph === 'back') {
    const W = Game.swp.find(w => w.id === J.id);
    if (W && W.cap === N.id && Math.hypot(W.x - N.x, W.y - N.y) > 3.6) { N.st = 'idle'; N.fr = 'i' + (Math.floor(now * 5 + N.id) % 6); return true; }       // ждёт ведомого
    if (d < 1.9) {
      const L = Game.lairs.find(l => l.id === N.lair);
      if (W && L && W.cap === N.id) {
        fwEnslave(W, L);
        floater(W.x, W.y - 1.8, W.k === 'goblin' ? 'Мамочки… кабала!' : '…', '#d8c8a0');
        if (!(L.slaveLog > now - 60)) { L.slaveLog = now; logEvent('animal', `Жаболюды взяли в кабалу: ${FW_SPEC[W.k].name}`, W.x, W.y); }
      }
      N.job = null; N.st = 'home'; return false;
    }
  } else if (J.ph === 'flee') {
    if (d < 1.9) { N.job = null; N.st = 'home'; N.cdA = 1; return false; }
  } else if (d < 1.5) {
    if (J.t === 'cap') {
      const W = Game.swp.find(w => w.id === J.id);
      W.cap = N.id; W.st = 'led'; J.ph = 'back'; N.face = W.x >= N.x ? 1 : -1;
      floater(N.x, N.y - 2, 'Хвать!', '#c0e080'); sfxAt('ftCroak', N.x * TILE, N.y * TILE, 0.5);
    } else if (J.t === 'gob') {
      const M = Game.neutrals.find(m => m.id === J.id), lair = Game.lairs.find(l => l.id === M.lair);
      const W = fwMake('goblin', M.x, M.y); W.alt = M.id % 2; W.cap = N.id; W.st = 'led'; W.face = M.face;
      Game.swp.push(W);
      Game.neutrals.splice(Game.neutrals.indexOf(M), 1);
      if (lair) { lair.alive = Math.max(0, (lair.alive || 1) - 1); if (!lair.alive) lair.respawn = now + NEU_RESPAWN * dif().neuResp; }
      J.ph = 'back'; J.id = W.id;
      floater(N.x, N.y - 2, 'Хвать! Этот — мой!', '#c0e080'); floater(W.x, W.y - 1.8, 'Мамочки! Пустите!', '#ffe9a0');
      sfxAt('ftCroak', N.x * TILE, N.y * TILE, 0.7); sfxAt('goblinCry', W.x * TILE, W.y * TILE, 0.5);
      logEvent('animal', 'Жаболюды увели гоблина из лагеря в кабалу', M.x, M.y);
    } else {
      const u = Game.unitMap.get(J.id);
      floater(N.x, N.y - 2, 'Ква! Идёшь со мной!', '#c0e080');
      if (typeof folkBah === 'function' && folkBah(u, N, 'frog')) { J.ph = 'flee'; J.exp = now + 30; }      // гномёнок: «Бах!» — жаболюд удирает
      else fwAbort(N);
    }
    return true;
  }
  N.st = 'roam';
  if (d > 6 && !(N.jpCd > now)) { N.jpCd = now + 2.5; if (ftLeap(N, N.x + (tx - N.x) / d * 4.5, N.y + (ty - N.y) / d * 4.5, { home: true })) return true; }
  neuMove(N, tx, ty, sp, dt);
  N.fr = neuFrame(N);
  if (N.stuck > 0.6 && !(N.jpCd > now)) { N.stuck = 0; N.jpCd = now + 2; ftLeap(N, N.x + (tx - N.x) / d * 3, N.y + (ty - N.y) / d * 3, { home: true }); }
  return true;
}
function fwAbort(N) {
  const J = N.job; N.job = null;
  if (J && J.id) { const W = Game.swp.find(w => w.id === J.id); if (W && W.cap === N.id) { W.cap = 0; W.st = 'idle'; } }
}

// «Бах!»: страх перед игрушечным пистолетом
if (typeof BAH_NAME !== 'undefined') BAH_NAME.frog = 'жаболюд';
if (typeof BAH_RUN !== 'undefined') BAH_RUN.frog = ['Ква-а-а! Не стреляй!', 'Ой-ква! Ухожу!', 'Это нечестно! Ква!', 'Мамочки-квак!'];
if (typeof folkScare === 'function') {
  const _fs = folkScare;
  folkScare = function (m, kind, u) {
    _fs(m, kind, u);
    if (kind === 'frog') {
      ftFlee(m); m.bahCD = ftNow() + 60;
      if (m.pch) m.pch = null;
      fxBurst(m.x * TILE, m.y * TILE - 14, 10, ['#eef6ff', '#cfe0f0'], 40, 26, 0.8, 2.2, -40);
      if (!m.jp && !(m.jpCd > ftNow())) { const L = Game.lairs.find(l => l.id === m.lair); if (L) { m.jpCd = ftNow() + 3; const d = Math.hypot(L.x + 0.5 - m.x, L.y + 1 - m.y) || 1, r = Math.min(7, d - 1); if (r > 1.5) ftLeap(m, m.x + (L.x + 0.5 - m.x) / d * r, m.y + (L.y + 1 - m.y) / d * r, { home: true }); } }
    }
  };
}

// ---------- Освобождение рабов ----------
{
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (inb(t[0], t[1])) {
      const W = Game.swp.find(w => w.own && !w.dead && Math.hypot(w.x - (t[0] + 0.5), w.y - (t[1] + 0.5)) < 1);
      if (W) return { kind: 'wfree', w: W, tx: Math.floor(W.x), ty: Math.floor(W.y), label: 'Освободить: ' + FW_SPEC[W.k].name + ' (жаболюды разозлятся)' };
    }
    return _rc(t);
  };
  const _run = runCmd;
  runCmd = function* (u, c) { if (c.kind === 'wfree') yield* fwFreeGen(u, c); else yield* _run(u, c); };
}
function* fwFreeGen(u, c) {
  const W = c.w;
  if (!u.hero) { floater(W.x, W.y - 1.8, 'Только герою позволено', '#ffe9a0'); return; }
  for (let k = 0; k < 8 && W.own && Math.hypot(W.x - u.x, W.y - u.y) > 1.8; k++) {
    const ok = yield { walk: [Math.floor(W.x), Math.floor(W.y)], offroad: true };
    if (!ok) return;
  }
  if (!W.own) return;
  u.face = W.x > u.x ? 1 : -1; u.vdir = 'E';
  yield { wait: 1.2, anim: 'build' };
  if (!W.own) return;
  const L = Game.lairs.find(l => l.id === W.own);
  const was = FW_SPEC[W.k].name;
  fwRelease(W, `${u.hero.name} освободил из кабалы: ${was}`, false);
  fxBurst(W.x * TILE, W.y * TILE - 10, 14, ['#bfe8ff', '#ffffff', '#ffe070'], 60, 60, 0.9, 1.6, -30);
  if (W.k === 'goblin') { W.gone = 8; floater(W.x, W.y - 2.2, 'Спасибо, герой!', '#ffe9a0'); const o = randomFreeNear(Math.floor(W.x), Math.floor(W.y), 0, 2, (x, y) => isWalkable(x, y)); if (o) dropPile(o[0], o[1], 'gold', 2); }
  else if (W.k === 'snail') { const o = randomFreeNear(Math.floor(W.x), Math.floor(W.y), 0, 2, (x, y) => isWalkable(x, y)); if (o) dropPile(o[0], o[1], 'slime', 2); }
  else if (W.k === 'moth') floater(W.x, W.y - 2.2, 'Фонарик светит герою!', '#d8ff70');
  if (L) {                                  // хозяева злы
    const mem = Game.neutrals.filter(N => N.lair === L.id && neuAlive(N) && ftIs(N));
    if (mem.length && Math.hypot(u.x - L.x, u.y - L.y) < 16) { L.friend = false; L.fr = 0; neuProvoke(mem[(ftRand() * mem.length) | 0], u); }
  }
}

// ---------- Тик ----------
function fwTick(dt) {
  if (Game.stress || !Game.swp) return;
  for (let i = Game.swp.length - 1; i >= 0; i--) { const W = Game.swp[i]; fwThink(W, dt); if (W.dead) Game.swp.splice(i, 1); }
  FW.spawnT += dt;
  if (FW.spawnT < 8) return;
  FW.spawnT = 0;
  const custom = typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto';
  if (custom) return;
  for (const k of ['snail', 'newt', 'moth']) if (Game.swp.filter(W => W.k === k && !W.own).length < fwQuota(k) && ftRand() < 0.4) { fwSpawnTo(k); break; }
  // старые гоблины-«вольные» не копятся
  const fg = Game.swp.filter(W => W.k === 'goblin' && !W.own && !W.cap);
  if (fg.length > 6) fg[0].dead = true;
}
{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) fwTick(dt); };
  const _setup = setupStart;
  setupStart = function (...a) {
    _setup(...a);
    Game.swp = [];
    const custom = typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto';
    if (Game.stress || custom || isMirror()) return;
    const mr = Math.random; Math.random = ftRand;
    try { fwSpawnInitial(); } finally { Math.random = mr; }
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.swp = []; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (s.nt) s.nt.wl = Game.swp.filter(W => !W.dead).map(W => ({ id: W.id, k: W.k, x: +W.x.toFixed(2), y: +W.y.toFixed(2), own: W.own || 0, alt: W.alt || 0 }));
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.swp = [];
    if (isMirror()) return;
    const nt = s && s.nt;
    if (nt && nt.wl) {
      for (const d of nt.wl) {
        if (!FW_SPEC[d.k]) continue;
        const W = fwMake(d.k, d.x, d.y); W.id = d.id; W.alt = d.alt || 0;
        Game.swp.push(W);
        const L = d.own && Game.lairs.find(l => l.id === d.own);
        if (L) { fwEnslave(W, L); W.x = d.x; W.y = d.y; }
      }
      Game.nextId = Math.max(Game.nextId, ...Game.swp.map(W => W.id + 1));
    } else if (!Game.stress) { const mr = Math.random; Math.random = ftRand; try { fwSpawnInitial(); } finally { Math.random = mr; } }       // старый сейв: малыши расселяются
    for (const N of Game.neutrals) N.job = null;
  };
}
function fwMirror() {
  const r = v => Math.round(v * 100) / 100;
  return Game.swp.filter(W => !W.dead).map(W => ({ __id: W.id, id: W.id, k: W.k, x: r(W.x), y: r(W.y), face: W.face, fr: W.fr, own: W.own || 0, cap: W.cap || 0, alt: W.alt || 0, post: W.post ? [r(W.post[0]), r(W.post[1])] : null }));
}

// ---------- Рисование ----------
{
  const _dl = neuDrawList;
  neuDrawList = function (list, c, x0, y0, x1, y1) {
    _dl(list, c, x0, y0, x1, y1);
    for (const W of Game.swp || []) {
      if (W.x < x0 - 3 || W.x > x1 + 3 || W.y < y0 - 3 || W.y > y1 + 4) continue;
      list.push([W.y + 0.15, () => fwDraw(c, W)]);
    }
  };
}
function fwDraw(c, W) {
  const sp = naFrame(fwArt(W), W.fr || 'i0'), t = Game.time;
  const px = Math.round(W.x * TILE), py = Math.round(W.y * TILE + 6);
  c.save();
  // верёвка-привязь к колышку (улитка, гоблин)
  if (W.own && W.post) {
    const qx = Math.round(W.post[0] * TILE), qy = Math.round(W.post[1] * TILE + 6);
    c.fillStyle = '#4a3220'; c.fillRect(qx - 1, qy - 7, 3, 8);
    c.strokeStyle = '#b09060'; c.lineWidth = 1; c.beginPath(); c.moveTo(qx, qy - 6); c.quadraticCurveTo((qx + px) / 2, Math.max(qy, py) - 2, px, py - (W.k === 'goblin' ? 12 : 6)); c.stroke();
  }
  // волокуша за улиткой-рабом
  if (W.own && W.k === 'snail') {
    const sx = px - W.face * 24;
    c.fillStyle = '#6a4a28'; c.fillRect(sx - 9, py - 4, 18, 3); c.fillStyle = '#8a6a3a'; c.fillRect(sx - 8, py - 7, 16, 3);
    c.fillStyle = '#a89060'; c.fillRect(sx - 6, py - 12, 7, 6); c.fillStyle = '#8a7048'; c.fillRect(sx + 2, py - 10, 6, 4);
    c.strokeStyle = '#b09060'; c.lineWidth = 1; c.beginPath(); c.moveTo(sx + W.face * 9, py - 5); c.lineTo(px - W.face * 12, py - 6); c.stroke();
  }
  if (W.k !== 'moth') { c.fillStyle = 'rgba(10,8,4,0.28)'; c.beginPath(); c.ellipse(px, py + 1, W.k === 'goblin' ? 6 : 10, 3, 0, 0, 7); c.fill(); }
  const bob = W.k === 'moth' ? Math.round(Math.sin(t * 3 + W.id) * 2) : 0;
  c.translate(px, py + bob);
  if (W.face < 0) c.scale(-1, 1);
  blitFine(c, sp.cv, -sp.ax, -sp.ay);
  c.restore();
  // свет мотылька-фонарика: ночью ярче
  if (W.k === 'moth') {
    const night = typeof nightAmt === 'function' ? nightAmt() : 0;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(px, py - 16 + bob, 1, px, py - 16 + bob, 30 + night * 26);
    g.addColorStop(0, `rgba(220,255,130,${0.18 + night * 0.34})`); g.addColorStop(1, 'rgba(220,255,130,0)');
    c.fillStyle = g; c.fillRect(px - 60, py - 76, 120, 120);
    c.restore();
  }
  // ошейник раба — красный огонёк над головой
  if (W.own && W.k !== 'moth') { c.fillStyle = '#1a1008'; c.fillRect(px - 2, py - (W.k === 'goblin' ? 30 : W.k === 'snail' ? 30 : 14), 5, 5); c.fillStyle = '#c84a3a'; c.fillRect(px - 1, py - (W.k === 'goblin' ? 29 : W.k === 'snail' ? 29 : 13), 3, 3); }
}

// ---------- Ачивки ----------
function fwAchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.nfree) return;
  const add = [
    { id: 'nfree', name: 'Долой кабалу!', desc: 'Герой освободил раба жаболюдов. Хозяева в бешенстве, раб — в восторге, хроника — в предвкушении.', ev: /освободил из кабалы/ },
    { id: 'nslave', name: 'Хозяева болота', desc: 'Жаболюды взяли в кабалу кого-то мельче себя. Улитки — тяжеловозы, мотыльки — фонарики, гоблины — «вот они, добрые соседи».', ev: /взяли в кабалу|увели гоблина/ },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', fwAchInit);
