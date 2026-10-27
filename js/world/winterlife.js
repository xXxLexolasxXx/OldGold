'use strict';
// Зимние забавы (season.js даёт сезон, snow.js — снег и лёд):
//  · снежки — скучающие гномы лепят и кидают их друг в друга (иногда попадают в героя — тот почти не страдает);
//    герой кидает снежок по команде: клавиша [B] или кнопка «Снежок» (только зимой, в одиночной игре);
//  · снеговики — гном скатывает три кома, ставит снеговика; весной снеговики тают;
//  · катание — гном выходит на замёрзшее озеро и скользит по льду кругами;
//  · Дед Мороз — в середине зимы (Новый год, согласован с «Праздником») на санях с оленями облетает деревню
//    и бросает подарки жителям: сытость, золото, хлеб, а герою — мана.
// Всё лежит в Game.wfx (снежки, подарки, снеговики, сани) и в кооперативе зеркалится списком 'wfx'.

const WFX_MAN_MAX = 28;
const SANTA_SPEED = 3.6, SANTA_GIFTS = 12;

const wfxPeople = u => Game.units.filter(v => v !== u && !v.dead && !v.inside && !v.glide && isPerson(v) && v.type !== 'carter');
function wfxNearest(u, r, list) {
  let best = null, bd = r;
  for (const v of list || wfxPeople(u)) { const d = Math.hypot(v.x - u.x, v.y - u.y); if (d < bd) { bd = d; best = v; } }
  return best;
}

// ---------- Снежки ----------

function wfxThrow(from, to, opts = {}) {
  if (!from || !to) return;
  const d = Math.hypot(to.x - from.x, to.y - from.y), dur = Math.max(0.45, d / 9);
  const b = { k: 'ball', id: Game.nextId++, x: from.x, y: from.y, z: 16, sx: from.x, sy: from.y, tx: to.x, ty: to.y, t: 0, dur, by: from.id, to: to.id, hero: !!(from.hero), gift: opts.gift ? 1 : 0, col: opts.col || 0, nr: opts.nr ? 1 : 0, arc: 8 + d * 2.2 };
  Game.wfx.push(b);
  from.face = to.x >= from.x ? 1 : -1;
  from.gest = 'wave'; from.gestUntil = Game.time + 0.6; from.gestFace = from.face;
  sfxAt('thud', from.x * TILE, from.y * TILE, 0.25);
  return b;
}

function wfxBallLand(b) {
  const to = Game.unitMap.get(b.to), by = Game.unitMap.get(b.by);
  const px = b.tx * TILE, py = b.ty * TILE - 8;
  if (b.gift) { wfxGiftLand(b, to); return; }
  fxBurst(px, py + 2, 9, ['#ffffff', '#e4f0ff', '#bcd4f0'], 38, 24, 0.5, 1.4, 160);
  if (!to || to.dead || to.inside || Math.hypot(to.x - b.tx, to.y - b.ty) > 1.0) { if (Math.random() < 0.5) floater(b.tx, b.ty - 1, 'Мимо!', '#cfe8ff'); return; }
  floater(to.x, to.y - 1.5, to.hero ? 'Снежок в героя!' : 'Ай! Холодно!', '#e8f4ff');
  sfxAt('thud', to.x * TILE, to.y * TILE, 0.4);
  to.ouchUntil = Game.time + 0.5;
  if (to.hero && to.hero.hp > 6 && by && !by.hero) neuHurtUnit(to, 1);
  // ответный снежок (один, чтобы драка не разрасталась)
  if (!b.nr && by && !by.dead && !by.inside && !to.hero && Math.random() < 0.6) {
    to.gest = 'fist'; to.gestUntil = Game.time + 0.8;
    fxLater(0.9, () => { if (!to.dead && !to.inside && !by.dead && !by.inside) wfxThrow(to, by, { nr: 1 }); });
  } else if (to.hero) { by && (by.gest = 'wave', by.gestUntil = Game.time + 1.5); }
}

const WFX_GIFT_COLS = ['#d83a3a', '#3a8ad8', '#f0c030', '#3aa860'];
function wfxGiftLand(b, to) {
  const px = b.tx * TILE, py = b.ty * TILE - 8;
  fxBurst(px, py, 12, ['#ffe070', '#ff8a6a', '#8ac8ff', '#ffffff'], 45, 40, 0.7, 1.5, 100);
  if (!to || to.dead || to.inside) { const x = Math.floor(b.tx), y = Math.floor(b.ty); if (isWalkable(x, y)) dropPile(x, y, 'bread', 1); return; }
  sfxAt('chime', to.x * TILE, to.y * TILE, 0.5);
  to.gest = 'wave'; to.gestUntil = Game.time + 1.6; to.gestFace = to.face;
  if (to.hero) {
    const H = to.hero;
    if (H.mana != null) H.mana = Math.min(H.mmax || H.mana + 6, H.mana + 6);
    floater(to.x, to.y - 1.8, 'Подарок! +6 маны', '#ffe070');
    return;
  }
  const r = Math.random();
  to.food = Math.min(1.1, (to.food || 0) + 0.2);
  if (r < 0.3) { floater(to.x, to.y - 1.8, 'Золото в носке!', '#ffe070', 'gold'); dropPile(Math.floor(to.x), Math.floor(to.y), 'gold', 1); }
  else if (r < 0.55) { floater(to.x, to.y - 1.8, 'Пряник!', '#ffd0a0', 'bread'); }
  else floater(to.x, to.y - 1.8, 'Подарок!', '#ffe070');
}

function* snowFightGen(u, id) {
  let tg = Game.unitMap.get(id);
  if (!tg || tg.dead || tg.inside) return;
  const dx = u.x - tg.x, dy = u.y - tg.y, d = Math.hypot(dx, dy) || 1;
  if (d > 5.5) {
    const s = [Math.floor(tg.x + dx / d * 4), Math.floor(tg.y + dy / d * 4)];
    if (isWalkable(s[0], s[1])) { if (!(yield { walk: s, offroad: true })) return; }
  }
  floater(u.x, u.y - 1.4, 'Держись!', '#e8f4ff');
  const n = 3 + ((Math.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    tg = Game.unitMap.get(id);
    if (!tg || tg.dead || tg.inside) break;
    u.face = tg.x >= u.x ? 1 : -1;
    yield { wait: 0.55, anim: 'duck' };        // лепит снежок
    tg = Game.unitMap.get(id);
    if (!tg || tg.dead || tg.inside) break;
    wfxThrow(u, tg);
    yield { wait: 0.9 };
  }
}

function* snowmanGen(u) {
  const ok = (x, y) => inb(x, y) && isWalkable(x, y) && !World.road[idx(x, y)] && !World.door[idx(x, y)] && !World.bmap[idx(x, y)] && !World.obj[idx(x, y)] && World.terrain[idx(x, y)] === T_GRASS
    && !Game.wfx.some(w => w.k === 'man' && Math.hypot(w.x - x - 0.5, w.y - y - 0.5) < 2.2);
  const s = randomFreeNear(Math.floor(u.x), Math.floor(u.y), 2, 8, ok);
  if (!s) return;
  if (!(yield { walk: s, offroad: true })) return;
  floater(u.x, u.y - 1.4, 'Лепим снеговика!', '#e8f4ff');
  for (let k = 0; k < 6; k++) { yield { wait: HIT_TIME * 1.3, anim: 'dig' }; fxBurst(u.x * TILE + 8, u.y * TILE + 4, 5, ['#ffffff', '#cfe0f4'], 24, 14, 0.4, 1.2, 100); }
  const men = Game.wfx.filter(w => w.k === 'man');
  if (men.length >= WFX_MAN_MAX) Game.wfx.splice(Game.wfx.indexOf(men[0]), 1);
  Game.wfx.push({ k: 'man', id: Game.nextId++, x: s[0] + 0.5, y: s[1] + 0.55, hat: (Math.random() * 3) | 0, scarf: (Math.random() * 4) | 0, face: Math.random() < 0.5 ? 1 : -1, born: Game.time });
  floater(s[0] + 0.5, s[1] - 0.6, 'Снеговик!', '#e8f4ff');
  u.gest = 'fist'; u.gestUntil = Game.time + 1.6; sfxUnit(u, 'hey');
  yield { wait: 1.4 };
}


// ---------- Берег и страховка от застревания ----------

// Ближайшая проходимая клетка суши; reg — нужная связная область (0 — любая)
function wfxLandNear(cx, cy, reg) {
  pfRegions();
  for (let r = 0; r <= 26; r++) {
    let best = null, bd = 1e9;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      if (!inb(x, y) || !isWalkable(x, y) || World.door[idx(x, y)] || World.road[idx(x, y)] === 2) continue;
      if (reg && PF.reg[idx(x, y)] !== reg) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) return best;
  }
  return null;
}
function wfxRegOf(p) { pfRegions(); const t = p && inb(p[0], p[1]) ? wfxLandNear(p[0], p[1], 0) : null; return t ? PF.reg[idx(t[0], t[1])] : 0; }
function wfxPlace(u, s) { u.x = s[0] + 0.5; u.y = s[1] + 0.5; u.fun = null; if (u.proc) { u.proc = null; u.action = null; } }

function wfxStrandCheck(S, step) {
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u)) continue;
    const x = Math.floor(u.x), y = Math.floor(u.y);
    if (!inb(x, y)) continue;
    const hb = u.home && !u.home.removed ? u.home : null;
    const ref = u.skateHome || (hb && hb.doorX != null ? [hb.doorX, hb.doorY] : null);
    if (World.terrain[idx(x, y)] === T_WATER) {
      if (u.fun && u.fun.k === 'skate' && u.fun.until > Game.time) continue;
      if (u.type === 'hero' && S.ice > 0.5) continue;      // герой может стоять на толстом льду
      const reg = ref ? wfxRegOf(ref) : 0;
      const s = wfxLandNear(x, y, reg) || wfxLandNear(x, y, 0);
      if (s) wfxPlace(u, s);
      continue;
    }
    // уже на суше, но не там: берег за рекой без пути назад — домой, не ждать весны
    if (!ref || u.type === 'hero' || (u.fun && u.fun.k === 'skate' && u.fun.until > Game.time)) { u.strandT = 0; continue; }
    const reg = wfxRegOf(ref), here = PF.reg[idx(x, y)];
    if (!reg || !here || here === reg) { u.strandT = 0; if (here === reg) u.skateHome = null; continue; }
    u.strandT = (u.strandT || 0) + step;
    if (u.strandT > (u.skateHome ? 3 : 12)) {
      const s = wfxLandNear(ref[0], ref[1], reg);
      u.strandT = 0; u.skateHome = null;
      if (s) { wfxPlace(u, s); fxBurst(u.x * TILE, u.y * TILE, 6, ['#ffffff', '#cfe8ff'], 20, 10, 0.4, 1, 60); }
    }
  }
}

function* skateGen(u, shore) {
  if (!(yield* toShore(u, shore))) return;
  const [sx, sy] = shore.stand, [dx, dy] = shore.dir, n = Math.min(shore.water, 7) - 0.6;
  const px = -dy, py = dx;           // поперёк движения
  u.skateHome = [sx, sy];            // свой берег: если катание оборвут, вернём именно сюда, а не на чужой
  floater(u.x, u.y - 1.4, 'На каток!', '#cfeaff');
  yield { wait: 0.5, anim: 'duck' };
  for (let lap = 0; lap < 2 + ((Math.random() * 2) | 0); lap++) {
    for (const dir of [1, -1]) {
      const T = 0.5 + n * 0.32, t0 = Game.time, from = lap === 0 && dir === 1 ? 0 : (dir === 1 ? 0 : n), to = dir === 1 ? n : 0;
      for (;;) {
        const p = Math.min(1, (Game.time - t0) / T), e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p) * 0.9 - 0.1 * (1 - p);
        const along = from + (to - from) * Math.min(1, e), side = Math.sin(p * Math.PI * 2) * 0.45 * (lap % 2 ? -1 : 1);
        u.x = sx + 0.5 + dx * (along + 0.5) + px * side; u.y = sy + 0.5 + dy * (along + 0.5) + py * side;
        u.face = dx !== 0 ? (dir * dx > 0 ? 1 : -1) : (Math.cos(p * Math.PI * 2) > 0 ? 1 : -1);
        u.fun = { k: 'skate', t0, until: Game.time + 1.2, lean: (p < 0.5 ? 1 : -1) * dir };
        if (Math.random() < 0.18) fxBurst(u.x * TILE, u.y * TILE + 6, 2, ['#ffffff', '#cfe8ff'], 16, 6, 0.35, 1, 40);
        if (p >= 1) break;
        yield { wait: 0.05 };
      }
    }
    if (Math.random() < 0.3) { floater(u.x, u.y - 1.4, 'Ух ты!', '#cfeaff'); u.gest = 'fist'; u.gestUntil = Game.time + 1; }
  }
  u.x = sx + 0.5; u.y = sy + 0.5; u.fun = null; u.skateHome = null;
  yield { wait: 0.6 };
}


// ---------- Герой на коньках ----------
// Лёд (S.ice > 0.8) держит героя: клик по замёрзшей воде или за рекой — он катится напрямик, втрое быстрее шага.
// Остальные гномы по воде сами не ходят (isWalkable не меняем), поэтому путь героя считаем отдельной заливкой.

const HERO_SKATE_SPEED = 3.6, HERO_SKATE_FRAMES = 5;
Object.assign(SFX_DEF, { iceglide: { pri: 0, gain: 0.32, poly: 2, cd: 0.28, len: 0.5 } });
Object.assign(SFX, {
  // шшшик: лезвие по льду — полоса шума с уходящей вниз частотой и тонкий звон
  iceglide: (d, t, v) => {
    noiseHit(d, 'bandpass', 3400 + v * 900, 1500, 2.2, t, 0.36, 0.2, 0.03);
    tone(d, 'triangle', 2100 + v * 400, 1500, t, 0.18, 0.04, 0.01);
  },
});

function wfxIceOk() { const S = SEA(); return S.ice > 0.8 && !isMirror(); }
function wfxIceTile(x, y) { return inb(x, y) && World.terrain[idx(x, y)] === T_WATER && !World.bmap[idx(x, y)]; }
function wfxSkatable(x, y) { return inb(x, y) && (wfxIceTile(x, y) || isWalkable(x, y)); }

// Путь по суше и льду (8 направлений без срезания углов); null — не добраться
function wfxIcePath(sx, sy, tx, ty, cap) {
  if (!wfxSkatable(tx, ty) || !wfxSkatable(sx, sy)) return null;
  const from = new Map(), q = [idx(sx, sy)];
  from.set(q[0], -1);
  const goal = idx(tx, ty);
  for (let h = 0; h < q.length && h < cap; h++) {
    const c = q[h];
    if (c === goal) break;
    const cx = c % MAP_W, cy = (c / MAP_W) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX8[k], ny = cy + DY8[k];
      if (!wfxSkatable(nx, ny) || from.has(idx(nx, ny))) continue;
      if (k > 3 && (!wfxSkatable(cx + DX8[k], cy) || !wfxSkatable(cx, cy + DY8[k]))) continue;
      from.set(idx(nx, ny), c); q.push(idx(nx, ny));
    }
  }
  if (!from.has(goal)) return null;
  const path = [];
  for (let c = goal; c !== q[0]; c = from.get(c)) path.push([c % MAP_W, (c / MAP_W) | 0]);
  return path.reverse();
}

function* heroSkateGen(u, tx, ty) {
  const path = wfxIcePath(Math.floor(u.x), Math.floor(u.y), tx, ty, 6000);
  if (!path || !path.length) return false;
  const t0 = Game.time;
  let last = Game.time, snd = 0, ph = 0;
  for (const [px, py] of path) {
    const gx = px + 0.5, gy = py + 0.5;
    for (;;) {
      if (!wfxIceOk() && wfxIceTile(Math.floor(u.x), Math.floor(u.y))) { u.fun = null; return false; }   // лёд растаял — страховка вернёт на берег
      const now = Game.time, dt = Math.max(0, now - last); last = now;
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy), st = HERO_SKATE_SPEED * dt;
      ph += st;
      if (Math.abs(dx) > 0.02) u.face = dx > 0 ? 1 : -1;
      u.vdir = Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy > 0 ? 'S' : 'N') : 'E';
      u.fun = { k: 'skate', hero: true, t0, ph, until: now + 0.25 };
      if (st >= d) { u.x = gx; u.y = gy; break; }
      u.x += dx / d * st; u.y += dy / d * st;
      snd -= dt;
      if (snd <= 0) { snd = 0.42; sfxAt('iceglide', u.x * TILE, u.y * TILE, 0.9); }
      if (Math.random() < dt * 9) fxBurst(u.x * TILE - u.face * 4, u.y * TILE + 6, 2, ['#ffffff', '#cfe8ff'], 14, 5, 0.3, 1, 40);
      yield { wait: 0.04 };
    }
  }
  u.fun = { k: 'skate', hero: true, t0, ph, until: Game.time + 0.1 };
  return true;
}

{
  const _rs = resolveCmd;
  resolveCmd = function (t) {
    const c = _rs(t);
    if (c || !wfxIceOk()) return c;
    const [x, y] = t;
    if (!wfxIceTile(x, y) || buildingAt(t)) return c;
    return { kind: 'move', x, y, tx: x, ty: y, label: 'Кататься' };
  };
  const _rc = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'move' && u.type === 'hero' && wfxIceOk()) {
      const sx = Math.floor(u.x), sy = Math.floor(u.y);
      pfRegions();
      const water = wfxIceTile(c.x, c.y), apart = !water && PF.reg[idx(sx, sy)] && PF.reg[idx(c.x, c.y)] && PF.reg[idx(sx, sy)] !== PF.reg[idx(c.x, c.y)];
      const onIce = wfxIceTile(sx, sy);
      if (water || apart || onIce) {
        // подойти по суше к ближайшему берегу, потом — по льду
        if (!(yield* heroSkateGen(u, c.x, c.y))) {
          const s = wfxLandNear(c.x, c.y, 0);
          if (s && !water) yield { walk: s };
        }
        return;
      }
    }
    yield* _rc(u, c);
  };
}

// 5 кадров катания героя: толчок левой, скольжение, толчок правой, скольжение, подсед; рисуем поверх обычного спрайта
const SKATE_FR = [
  { lift: 0, rot: 0.10, ox: -0.5, leg: [-3, 2] },     // толчок: задняя нога назад
  { lift: 0.6, rot: 0.18, ox: 0, leg: [-1, 3] },      // вынос вперёд
  { lift: 1.0, rot: 0.14, ox: 0.5, leg: [1.5, 2] },   // скольжение на одной ноге
  { lift: 0.4, rot: 0.08, ox: 0, leg: [2, -2] },      // смена ноги
  { lift: 0, rot: 0.16, ox: -0.5, leg: [0, 0] },      // подсед, руки вперёд
];
function drawHeroSkates(c, u, fr) {
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6), f = u.face || 1;
  c.save();
  for (let k = 0; k < 2; k++) {
    const bx = px + (k ? 2.5 : -2.5) * f + SKATE_FR[fr].leg[k] * f * 0.6, by = py - 0.5 - (k && fr === 2 ? 2.5 : 0);
    c.fillStyle = '#3a2a1a'; c.fillRect(Math.round(bx - 2), Math.round(by - 3), 4, 2);              // башмак
    c.fillStyle = '#cfd8e4'; c.fillRect(Math.round(bx - 3.5), Math.round(by - 1), 7, 1);            // лезвие
    c.fillStyle = '#8a96a8'; c.fillRect(Math.round(bx - 3.5 + (f > 0 ? 6 : 0)), Math.round(by - 2), 1, 1);   // завиток
    c.fillStyle = '#6a7482'; c.fillRect(Math.round(bx - 2), Math.round(by - 2), 1, 1); c.fillRect(Math.round(bx + 1), Math.round(by - 2), 1, 1);
  }
  c.restore();
}

{
  const _le = leisureExtra;
  leisureExtra = function (u) {
    const S = SEA();
    if (S.snow > 0.5 && !isMirror() && Math.random() < 0.55) {
      const opts = [];
      const near = wfxNearest(u, 12);
      if (near) opts.push('ball', 'ball', 'ball');
      opts.push('man');
      const shore = S.ice > 0.8 ? findShore(Math.floor(u.x), Math.floor(u.y), 16) : null;
      if (shore) opts.push('skate', 'skate', 'skate');
      const w = opts[(Math.random() * opts.length) | 0];
      if (w === 'ball') return snowFightGen(u, near.id);
      if (w === 'man') return snowmanGen(u);
      if (w === 'skate') return skateGen(u, shore);
    }
    return _le(u);
  };
}

// ---------- Герой: снежок по команде ----------

function wfxHeroThrow() {
  const u = Game.hero, H = u && u.hero;
  if (!u || !H || isMirror() || SEA().snow < 0.3 || u.dead || u.inside || H.hp <= 0) return false;
  if (H.snowCd > Game.time) return false;
  H.snowCd = Game.time + 0.8;
  const tg = wfxNearest(u, 10);
  if (tg) wfxThrow(u, tg);
  else { const f = u.face || 1, g = { x: u.x + f * 5, y: u.y + (Math.random() - 0.5) * 2, id: 0 }; wfxThrow(u, g); }
  if (tg && tg.type !== 'hero') { tg.gest = 'fist'; tg.gestUntil = Game.time + 1; }
  return true;
}
{
  const _ha = typeof heroAbility === 'function' ? heroAbility : null;
  if (_ha) heroAbility = function (k) { if (k === 'snow') { wfxHeroThrow(); return; } return _ha(k); };
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyB' && !e.ctrlKey && !e.altKey && !e.metaKey) wfxHeroThrow();
  });
}
let wfxBtn = null;
function wfxUiTick() {
  const show = !isMirror() && SEA().snow > 0.3 && Game.hero && Game.hero.hero && Game.hero.hero.hp > 0;
  if (!wfxBtn) {
    if (!show) return;
    const host = document.getElementById('view');
    if (!host) return;
    wfxBtn = document.createElement('button');
    wfxBtn.id = 'snow-btn'; wfxBtn.innerHTML = '❄ Снежок<span class="kb"> [B]</span>'; wfxBtn.title = 'Герой кидает снежок в ближайшего гнома';
    wfxBtn.style.display = 'none';   // положение и вид — в css/style.css (#snow-btn), чтобы не наезжать на нижнюю панель
    wfxBtn.addEventListener('click', e => { e.stopPropagation(); wfxHeroThrow(); });
    host.appendChild(wfxBtn);
  }
  const d = show ? '' : 'none';
  if (wfxBtn.style.display !== d) wfxBtn.style.display = d;
}

// ---------- Дед Мороз ----------

function santaCanStart() {
  const S = SEA();
  if (seaIdx() !== 2 || S.santaYr === seaYear() || S.snow < 0.5 || Game.time < 120) return false;
  if (seaDayIn() < Math.min(S.len - 1, Math.floor(S.len / 2))) return false;
  const c = cycleAt(Game.time);
  if (c.p < 30 || c.p > EVE_START - 120) return false;
  return Game.units.filter(isPerson).length >= 3;
}
function santaStart() {
  const S = SEA();
  S.santaYr = seaYear();
  const bad = typeof festCanStart === 'function' ? festCanStart() : 'x';
  let fest = false;
  if (!bad) { festivalStart('newyear', 1); fest = true; }
  const cy = MAP_H >> 1;
  const people = Game.units.filter(u => !u.dead && !u.inside && isPerson(u) && u.type !== 'carter');
  const it = { k: 'sleigh', id: Game.nextId++, x: 0.5, y: Math.max(3, Math.min(MAP_H - 4, cy + (Math.random() * 12 - 6))), z: 18, face: 1, ph: 0, hover: 0 };
  Game.wfx.push(it);
  S.santa = { id: it.id, ids: [], i: 0, given: 0, hover: 0, t0: Game.time, say: 0, out: false };
  // очередь: ближайший сосед от входа
  let cx = it.x, cyy = it.y; const pool = people.slice(), order = [];
  while (pool.length && order.length < SANTA_GIFTS) {
    pool.sort((a, b) => Math.hypot(a.x - cx, a.y - cyy) - Math.hypot(b.x - cx, b.y - cyy));
    const n = pool.shift(); order.push(n.id); cx = n.x; cyy = n.y;
  }
  S.santa.ids = order;
  toast(fest ? 'Новый год! Дед Мороз летит на оленях, а гномы уже у трактира' : 'Новый год! Дед Мороз летит на санях с подарками для всех гномов');
  logEvent('festival', 'Дед Мороз прилетел раздавать подарки');
  sfxAt('chime', it.x * TILE, it.y * TILE, 0.8);
}
function santaTick(dt) {
  const S = SEA(), st = S.santa;
  const it = st && Game.wfx.find(w => w.id === st.id);
  if (!st || !it) { if (st) S.santa = null; return; }
  it.ph += dt * 9;
  it.z = 18 + Math.sin(Game.time * 2) * 2;
  let tx, ty, spd = SANTA_SPEED;
  if (st.hover > 0) { st.hover -= dt; spd = 0.6; }
  let tg = null;
  while (!st.out && st.i < st.ids.length) {
    tg = Game.unitMap.get(st.ids[st.i]);
    if (tg && !tg.dead) break;
    st.i++; tg = null;
  }
  if (!st.out && !tg) { st.out = true; toast('Дед Мороз улетел: «С Новым годом, гномы!»'); }
  if (st.out) { tx = MAP_W + 6; ty = it.y - 3; }
  else { tx = tg.x; ty = tg.y - 0.3; }
  const dx = tx - it.x, dy = ty - it.y, d = Math.hypot(dx, dy) || 1;
  if (!st.out && d < 2.6 && st.hover <= 0) {
    // подарок с саней вниз, в гнома
    wfxThrow({ x: it.x, y: it.y - 0.4, id: it.id, face: it.face }, tg, { gift: 1, col: (Math.random() * 4) | 0 });
    st.given++; st.i++; st.hover = 0.7;
    if (st.given % 3 === 1) floater(it.x, it.y - 2, 'Хо-хо-хо!', '#ff9a8a');
    sfxAt('chime', it.x * TILE, it.y * TILE, 0.6);
  } else {
    const s = Math.min(d, spd * dt);
    it.x += dx / d * s; it.y += dy / d * s;
    if (Math.abs(dx) > 0.2) it.face = dx > 0 ? 1 : -1;
  }
  if (Game.time - st.t0 > 260 || (st.out && it.x > MAP_W + 4)) { Game.wfx.splice(Game.wfx.indexOf(it), 1); S.santa = null; }
}

// ---------- Ход ----------

function wfxTick(dt) {
  const S = SEA();
  // снежки и подарки в полёте
  for (let i = Game.wfx.length - 1; i >= 0; i--) {
    const b = Game.wfx[i];
    if (b.k !== 'ball') continue;
    b.t += dt;
    const p = Math.min(1, b.t / b.dur);
    b.x = b.sx + (b.tx - b.sx) * p; b.y = b.sy + (b.ty - b.sy) * p;
    b.z = 16 * (1 - p) + Math.sin(p * Math.PI) * b.arc;
    if (p >= 1) { Game.wfx.splice(i, 1); wfxBallLand(b); }
  }
  if (S.santa) santaTick(dt);
  S.wT = (S.wT || 0) + dt;
  if (S.wT < 0.5) return;
  const step = S.wT; S.wT = 0;
  if (!S.santa && santaCanStart()) santaStart();
  // снеговики тают с весной
  if (S.snow < 0.5) for (let i = Game.wfx.length - 1; i >= 0; i--) {
    const w = Game.wfx[i];
    if (w.k === 'man' && (S.snow < 0.06 || Math.random() < step * 0.25)) {
      fxBurst(w.x * TILE, w.y * TILE - 6, 12, ['#ffffff', '#cfe0f4', '#8ac0e8'], 30, 20, 0.6, 1.4, 120);
      Game.wfx.splice(i, 1);
    }
  }
  // страховка: гном на воде вне катания — на ТОТ ЖЕ берег, откуда выехал (иначе застрянет за рекой до весны)
  if (S.ice > 0.1) wfxStrandCheck(S, step);
}
{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) wfxTick(dt); };
}

// ---------- Рисование ----------

const WFX_CACHE = new Map();

function wfxSnowman(hat, scarf) {
  const key = 'm' + hat + scarf;
  let s = WFX_CACHE.get(key);
  if (s) return s;
  const W = 36, H = 52, ax = 18, ay = 46, [cv, c] = mkSprite(W, H, 3);
  c.translate(ax, ay);
  const ball = (x, y, r) => {
    ellipse(c, x, y, r, r * 0.95, '#cfe0f4');
    c.fillStyle = '#f6fbff'; c.beginPath(); c.ellipse(x - r * 0.22, y - r * 0.25, r * 0.78, r * 0.7, 0, 0, 7); c.fill();
    c.fillStyle = '#b4cbe6'; c.beginPath(); c.ellipse(x + r * 0.55, y + r * 0.5, r * 0.45, r * 0.4, 0, 0, 7); c.fill();
  };
  c.fillStyle = 'rgba(20,30,50,0.3)'; c.beginPath(); c.ellipse(0, 1, 11, 3, 0, 0, 7); c.fill();
  ball(0, -7, 8.5); ball(0, -19, 6.4); ball(0, -28.5, 4.8);
  // руки-веточки
  c.strokeStyle = '#5a3a1e'; c.lineWidth = 0.9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-5.4, -20); c.lineTo(-13, -25); c.moveTo(-10, -23.4); c.lineTo(-12, -28); c.moveTo(5.4, -20); c.lineTo(13, -22); c.moveTo(10, -21.2); c.lineTo(12.4, -26); c.stroke();
  // пуговицы, глаза, нос, рот
  c.fillStyle = '#20262e'; for (const y of [-9, -14, -20]) c.fillRect(-0.6, y, 1.4, 1.4);
  c.fillRect(-2.2, -30, 1.3, 1.3); c.fillRect(1.3, -30, 1.3, 1.3);
  for (let k = 0; k < 4; k++) c.fillRect(-2.2 + k * 1.5, -25.6 + (k === 0 || k === 3 ? -0.7 : 0), 0.9, 0.9);
  poly(c, [[0.4, -28.6], [6.6, -27.4], [0.4, -26.6]], '#f08a28');
  // шарф
  const SC = ['#d83a3a', '#3a8ad8', '#3aa860', '#f0c030'][scarf % 4];
  c.fillStyle = SC; c.fillRect(-5.4, -24.4, 10.8, 2.4); poly(c, [[-4, -22.2], [-1, -22.2], [-2, -14], [-5, -14]], SC);
  // головной убор
  if (hat === 0) { poly(c, [[-5, -32.6], [5, -32.6], [4.6, -41], [-4.6, -41]], '#20262e'); c.fillStyle = '#20262e'; c.fillRect(-7, -33.4, 14, 1.8); c.fillStyle = '#b02a2a'; c.fillRect(-4.8, -35.6, 9.6, 1.4); }
  else if (hat === 1) { poly(c, [[-5, -32.6], [5, -32.6], [3, -42], [-1, -43]], '#c83a3a'); ellipse(c, 2.6, -43, 1.9, 1.9, '#f6fbff'); c.fillStyle = '#f6fbff'; c.fillRect(-5.4, -33.8, 10.8, 1.8); }
  else { poly(c, [[-4.6, -32.2], [4.6, -32.2], [3.6, -37.6], [-3.6, -37.6]], '#7a8088'); c.fillStyle = '#5a6068'; c.fillRect(-5.4, -33.2, 10.8, 1.4); c.fillStyle = '#9aa0a8'; c.fillRect(-3.6, -38.6, 7.2, 1.2); }
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  s = { cv: out, ax, ay };
  WFX_CACHE.set(key, s);
  return s;
}

// сани с оленями и дедом: 4 кадра галопа, лицом вправо
function wfxSleigh(f) {
  const key = 's' + f;
  let s = WFX_CACHE.get(key);
  if (s) return s;
  const W = 150, H = 76, ax = 52, ay = 62, F = afFine() ? PX_FINE : 1, [cv, c] = mkSprite(W, H, F > 1 ? 2 * F : 3);   // олени упряжки — мелким пикселем ×3 (animalart.js)
  c.translate(ax, ay); c.lineCap = 'round'; c.lineJoin = 'round';
  const g = (f % 4) / 4 * 6.2832;
  // упряжь
  c.strokeStyle = '#6a4a22'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(14, -17); c.lineTo(36, -22); c.lineTo(58, -22); c.stroke();
  // олени
  const deer = (x, y0, ph, rudolph) => {
    const sw = Math.sin(g + ph), sw2 = Math.sin(g + ph + 3.1);
    const leg = (lx, a, back) => { const kx = lx + a * 5, ky = y0 + 8 - Math.max(0, -a) * 2.5; c.strokeStyle = '#6a4224'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, y0 + 2); c.lineTo(lx + a * 2.4, y0 + 6); c.lineTo(kx, ky + 3); c.stroke(); c.fillStyle = '#2a1a10'; c.fillRect(kx - 1.2, ky + 2.6, 2.4, 1.4); };
    leg(x - 6, sw, true); leg(x + 5, sw2, false);
    ellipse(c, x, y0, 9.4, 5, '#8c5a32'); ellipse(c, x - 0.5, y0 + 1.8, 7.4, 3, '#b88a58');
    c.fillStyle = '#f2ead8'; c.beginPath(); c.ellipse(x - 9, y0 - 1, 2.2, 2, 0, 0, 7); c.fill();   // хвостик
    leg(x - 4, -sw2, true); leg(x + 7, -sw, false);
    // шея и голова
    poly(c, [[x + 5, y0 - 2], [x + 9.6, y0 - 10], [x + 12.2, y0 - 9], [x + 9, y0 + 1]], '#8c5a32');
    poly(c, [[x + 9.4, y0 - 11], [x + 16.6, y0 - 10], [x + 17.6, y0 - 7.4], [x + 10.4, y0 - 6.4]], '#9c6a3c');
    ellipse(c, x + 17.4, y0 - 8.4, 1.5, 1.3, rudolph ? '#ff3a30' : '#2a1a10');
    c.fillStyle = '#1a1008'; c.fillRect(x + 13.4, y0 - 10.6, 1, 1);
    // рога
    c.strokeStyle = '#d8c090'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x + 11, y0 - 11); c.lineTo(x + 9, y0 - 17); c.lineTo(x + 6.4, y0 - 20); c.moveTo(x + 9.6, y0 - 15.4); c.lineTo(x + 12.4, y0 - 19); c.moveTo(x + 12.6, y0 - 11); c.lineTo(x + 14.6, y0 - 16.6); c.stroke();
    c.fillStyle = '#d83a3a'; c.fillRect(x + 6.4, y0 - 5.6, 2.4, 2.4);   // ошейник с бубенцом
    c.fillStyle = '#f0c030'; c.fillRect(x + 6.8, y0 - 3.2, 1.6, 1.6);
  };
  deer(60, -23, 3.1, false); deer(40, -22, 0, true);
  // сани: красный кузов, золотые полозья
  c.strokeStyle = '#e0b030'; c.lineWidth = 1.8;
  c.beginPath(); c.moveTo(-26, -3); c.lineTo(16, -3); c.quadraticCurveTo(24, -3, 23, -10); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.moveTo(-18, -4); c.lineTo(-18, -9); c.moveTo(8, -4); c.lineTo(8, -9); c.stroke();
  poly(c, [[-24, -9], [14, -9], [20, -14], [20, -22], [12, -22], [8, -17], [-20, -17], [-26, -22], [-27, -14]], '#c83030');
  poly(c, [[-24, -9], [14, -9], [20, -14], [-27, -14]], '#a02424');
  c.strokeStyle = '#f0d070'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-26, -13.6); c.lineTo(19, -13.6); c.stroke();
  // мешок с подарками
  poly(c, [[-26, -17], [-20, -30], [-10, -33], [-6, -24], [-8, -17]], '#a07a48');
  c.fillStyle = '#6a4a28'; c.fillRect(-17, -33.6, 6, 1.6);
  for (const [bx, by, col] of [[-20, -31, '#d83a3a'], [-14, -35, '#3a8ad8'], [-10, -32, '#f0c030']]) { c.fillStyle = col; c.fillRect(bx, by, 5, 4.4); c.fillStyle = '#f6f6e8'; c.fillRect(bx + 2.1, by, 0.9, 4.4); c.fillRect(bx, by + 1.8, 5, 0.9); }
  // Дед Мороз
  const bob = Math.sin(g * 2) * 0.5;
  poly(c, [[-5, -17], [7, -17], [7.4, -27 + bob], [-4, -28 + bob]], '#d83a3a');
  c.fillStyle = '#f6f6f0'; c.fillRect(-5, -19, 12.6, 1.6);
  ellipse(c, 1.4, -31 + bob, 4.4, 4.3, '#f2c9a0');
  poly(c, [[-3.4, -30.4 + bob], [5.6, -30.4 + bob], [4.4, -22.6 + bob], [1.2, -20.6 + bob], [-2.4, -22.6 + bob]], '#f6f6f2');   // борода
  poly(c, [[-3.4, -33.4 + bob], [5.4, -33.4 + bob], [3.8, -41 + bob], [-1, -42 + bob]], '#d83a3a');
  c.fillStyle = '#f6f6f2'; c.fillRect(-3.8, -34.4 + bob, 9.6, 2); ellipse(c, -1.4, -42.2 + bob + Math.sin(g * 2 + 1) * 0.6, 1.9, 1.9, '#f6f6f2');
  c.fillStyle = '#20262e'; c.fillRect(1.6, -32.2 + bob, 1.2, 1.2); c.fillRect(4, -32.2 + bob, 1.2, 1.2);
  c.strokeStyle = '#d83a3a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(5, -24); c.lineTo(11, -22); c.stroke();
  c.strokeStyle = '#6a4a22'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(11, -22); c.lineTo(15, -20.4); c.stroke();
  const out = F > 1 ? toPixelArt(cv, 2, { outline: true, outlineDark: 0.55, alphaCut: 100, clean: true }) : toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  out.fine = F;
  s = { cv: out, ax, ay };
  WFX_CACHE.set(key, s);
  return s;
}

function wfxDrawBall(c, b) {
  const px = Math.round(b.x * TILE), py = Math.round(b.y * TILE + 6);
  c.fillStyle = 'rgba(10,8,4,0.28)'; c.beginPath(); c.ellipse(px, py, 3, 1.2, 0, 0, 7); c.fill();
  const y = py - 12 - b.z;
  if (b.gift) {
    const col = WFX_GIFT_COLS[b.col & 3], r = Math.floor(Game.time * 6 + b.id) & 1;
    c.fillStyle = col; c.fillRect(px - 3, y - 3, 6, 6); c.fillStyle = '#f6f6e8'; c.fillRect(px - 0.5, y - 3, 1.2, 6); c.fillRect(px - 3, y - 0.5, 6, 1.2);
    c.fillStyle = '#f0c030'; c.fillRect(px - 1.5 + r, y - 5, 3, 1.6);
  } else {
    c.fillStyle = '#bcd4f0'; c.beginPath(); c.arc(px + 0.5, y + 0.5, 2.6, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px, y, 2.4, 0, 7); c.fill();
  }
}

function wfxDrawList(list, c, x0, y0, x1, y1) {
  for (const w of Game.wfx || []) {
    if (w.x < x0 - 6 || w.x > x1 + 6 || w.y < y0 - 3 || w.y > y1 + 5) continue;
    if (w.k === 'ball') list.push([w.y + 0.45, () => wfxDrawBall(c, w)]);
    else if (w.k === 'man') list.push([w.y + 0.1, () => {
      const S = SEA(), sp = wfxSnowman(w.hat | 0, w.scarf | 0), px = Math.round(w.x * TILE), py = Math.round(w.y * TILE + 6);
      const m = Math.min(1, Math.max(0.35, S.snow * 1.7));       // подтаивает по мере потепления
      c.save(); c.translate(px, py); if (w.face < 0) c.scale(-1, 1); c.scale(1, m);
      c.drawImage(sp.cv, -sp.ax, -sp.ay);
      c.restore();
    }]);
    else if (w.k === 'sleigh') list.push([w.y + 3, () => {
      const sp = wfxSleigh(Math.floor(w.ph) & 3), px = Math.round(w.x * TILE), py = Math.round(w.y * TILE + 6), z = w.z || 18;
      c.fillStyle = 'rgba(10,8,4,0.22)'; c.beginPath(); c.ellipse(px, py + 2, 40, 7, 0, 0, 7); c.fill();
      c.save(); c.translate(px, py - z); if (w.face < 0) c.scale(-1, 1);
      afBlit(c, sp.cv, -sp.ax, -sp.ay);
      c.restore();
      // искры волшебного следа
      for (let k = 0; k < 6; k++) {
        const a = ((Game.time * 1.4 + k / 6) % 1), sx = px - w.face * (30 + a * 50), sy = py - z + 2 + Math.sin(a * 9 + k) * 3 + a * 8;
        c.globalAlpha = 1 - a; c.fillStyle = k & 1 ? '#fff6b0' : '#ffffff'; c.fillRect(Math.round(sx), Math.round(sy), 2, 2);
      }
      c.globalAlpha = 1;
    }]);
  }
}

{
  const _wdl = weatherDrawList;
  weatherDrawList = function (list, c, x0, y0, x1, y1) { _wdl(list, c, x0, y0, x1, y1); wfxDrawList(list, c, x0, y0, x1, y1); };
  const _dw = drawWeather;
  drawWeather = function (c) { _dw(c); wfxUiTick(); };
  // катающийся гном наклоняется в сторону движения
  const _du = drawUnit;
  drawUnit = function (c, u) {
    const f = u.fun;
    if (f && f.k === 'skate' && f.hero && f.until > Game.time) {
      const fr = Math.floor(f.ph * 1.1) % HERO_SKATE_FRAMES, F = SKATE_FR[fr];
      drawUnitXform(c, u, F.lift, F.rot * (u.face || 1), F.ox * (u.face || 1), 1 - F.lift / 14);
      drawHeroSkates(c, u, fr);
      return;
    }
    if (f && f.k === 'skate' && f.until > Game.time) {
      const t = Game.time - f.t0;
      drawUnitXform(c, u, Math.abs(Math.sin(t * 5)) * 0.8, 0.14 * (f.lean || 1) + Math.sin(t * 3) * 0.05, 0, 1);
      return;
    }
    _du(c, u);
  };
}
