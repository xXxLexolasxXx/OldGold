'use strict';
// Ядро забега (КООП_ЗАБЕГ.md §2.1): чистая симуляция подземелья Малгора без DOM и звука.
// Одна и та же копия крутится в браузере (одиночный забег — js/run/dungeon.js рисует и озвучивает),
// на сервере (кооп-комната до 5 героев) и при проверке рекорда (переигровка записи ввода).
// Правила детерминизма: шаг всегда RS_DT, случайности только от сида (rsRand), никаких Math.random,
// sin/cos/atan2/hypot (в разных браузерах дают разные последние знаки) и sort со случайным сравнением.
// Звуки, всплывающие цифры и надписи — события в S.ev (разбирает и чистит тот, кто рисует).

const RS_DT = 1 / 60;
const RS_T = 16;                  // размер тайла
const RS_W = 52, RS_H = 38;       // размер этажа в тайлах
const RS_PAL_KINDS = ['warrior', 'archer', 'healer', 'bomber'];
const RS_UPS = [
  { id: 'blade', n: 'Острый клинок', d: '+30% урона' },
  { id: 'hands', n: 'Быстрые руки', d: 'Атака на 25% чаще' },
  { id: 'beard', n: 'Крепкая борода', d: '+30 здоровья и лечение на 30' },
  { id: 'boots', n: 'Лёгкие сапоги', d: '+20% скорости' },
  { id: 'flask', n: 'Хмельная фляга', d: 'Полное лечение' },
  { id: 'dash', n: 'Заговорённый рывок', d: 'Рывок чаще на 40%' },
];
const RS_COOP_PICK = 20;          // секунд на выбор награды в коопе
const RS_COOP_STAIRS = 15;        // через столько секунд после первого на лестнице отряд спускается
const RS_REVIVE = 3;              // секунд стоять рядом, чтобы поднять товарища
// поворот веера болтов Малгора на ±0,28 рад и вращение кольца на 0,4 рад — готовыми числами (без sin/cos)
const RS_C28 = 0.9610554383107709, RS_S28 = 0.2763556485641138;
const RS_RING = [[1, 0], [0.7071067811865476, 0.7071067811865476], [0, 1], [-0.7071067811865476, 0.7071067811865476], [-1, 0], [-0.7071067811865476, -0.7071067811865476], [0, -1], [0.7071067811865476, -0.7071067811865476]];
const RS_C40 = 0.9210609940028851, RS_S40 = 0.3894183423086505;

// генератор mulberry32: состояние — одно число в S, поэтому состояние забега целиком сериализуемо
function rsRand(S, k) { let a = S[k] = (S[k] + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rsLen = (x, y) => Math.sqrt(x * x + y * y);
function rsSeedOfDay(key) { let h = 2166136261; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619); return (h >>> 0) % 1000000000 + 1; }   // 'YYYY-MM-DD' → сид

function rsWeekOf(dayKey) { return Math.floor((Date.parse(dayKey + 'T00:00:00Z') / 86400000 + 3) / 7); }   // неделя с понедельника, по UTC
// Рекордные забеги (ежедневный и недельный): условия у всех одинаковые и считаются только от даты —
// сервер строит их сам этой же функцией, а от игрока берёт лишь запись ввода.
const RS_FAIR_HERO = { hp: 100, dmg: 12, weapon: 'pick', choices: 3, pal: 'warrior' };
function rsRankedOpts(kind, key) {
  if (kind === 'day') return { seed: rsSeedOfDay(String(key)), diff: { id: 'daily', name: 'Ежедневный', floors: 5, mult: 1.1 }, heroes: [Object.assign({}, RS_FAIR_HERO)] };
  return { seed: ((key | 0) * 7919 + 13) >>> 0, diff: { id: 'week', name: 'Недельный', floors: 5, mult: 1.2 }, heroes: [Object.assign({}, RS_FAIR_HERO)] };
}

// opts: { seed, diff: {id, name, floors, mult, lvl}, heroes: [{ id, hp, dmg, weapon, choices, pal, cloak, ap }], pals: bool }
function rsNew(opts) {
  const diff = Object.assign({ id: 'dive', name: 'Спуск', floors: 5, mult: 1 }, opts.diff);
  const hs = (opts.heroes && opts.heroes.length ? opts.heroes : [{}]).slice(0, 5);
  const S = {
    v: 1, seed: opts.seed >>> 0, diff, n: hs.length, step: 0, t: 0, floor: 0, over: null, kills: 0, pick: null, ev: [],
    fa: 0, ca: (opts.seed ^ 0x5bd1e995) >>> 0, msgT: 0,
    heroes: hs.map((o, i) => ({
      id: o.id != null ? o.id : i, x: 0, y: 0, max: o.hp || 100, hp: o.hp || 100, spd: 62, dmg: o.dmg || 12, cd: 0, rate: 0.55,
      dash: 0, dashCd: 0, dashMul: 1, slamCd: 0, slam: 0, face: 1, hit: 0, inv: 0, gold: 0, kills: 0, swing: 0, stepT: 0,
      weapon: o.weapon || 'pick', choices: o.choices || 3, cloak: o.cloak | 0, ap: o.ap || null, ups: [],
      down: false, rev: 0, away: false, gone: false, mx: 0, my: 0, moving: false,
    })),
    pals: [],
  };
  if (opts.pals !== false && S.n <= 2) S.heroes.forEach((h, i) => S.pals.push({ owner: i, x: 0, y: 0, hp: 60, max: 60, cd: 0, kind: RS_PAL_KINDS.includes(hs[i].pal) ? hs[i].pal : 'warrior', hit: 0, dead: false, moving: false, first: hs[i].pal }));
  rsFloor(S);
  return S;
}

function rsEv(S, e) { if (S.ev.length < 400) S.ev.push(e); }
function rsMsg(S, text, t) { S.msg = text; S.msgT = t; rsEv(S, { k: 'msg', text, t }); }
const rsActive = S => S.heroes.filter(h => !h.down && !h.gone && !h.away);

// ---------- генерация этажа ----------
function rsFloor(S) {
  S.fa = (S.seed + S.floor * 977) >>> 0;
  const rng = () => rsRand(S, 'fa'), boss = S.floor === S.diff.floors - 1 && S.diff.floors >= 5;
  const map = new Uint8Array(RS_W * RS_H), rooms = [];
  for (let n = 0; n < 60 && rooms.length < (boss ? 5 : 8); n++) {
    const w = 6 + ((rng() * 7) | 0), h = 5 + ((rng() * 5) | 0), x = 2 + ((rng() * (RS_W - w - 4)) | 0), y = 2 + ((rng() * (RS_H - h - 4)) | 0);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) map[j * RS_W + i] = 1;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < RS_W - 1 && y < RS_H - 1) map[y * RS_W + x] = 1; };
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) { carve(x, a.cy); carve(x, a.cy + 1); }
    for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) { carve(b.cx, y); carve(b.cx + 1, y); }
  }
  S.map = map; S.rooms = rooms; S.boss = boss;
  const s = rooms[0], e = rooms[rooms.length - 1];
  S.heroes.forEach((h, i) => {
    // отряд встаёт кучкой в первой комнате; лежавшие поднимаются с четвертью здоровья
    h.x = (s.cx + 0.5) * RS_T + ((i % 3) - 1) * 10; h.y = (s.cy + 0.5) * RS_T + ((i / 3) | 0) * 10;
    if (h.down) { h.down = false; h.hp = Math.max(1, Math.round(h.max * 0.25)); }
    h.rev = 0;
  });
  for (const p of S.pals) { const h = S.heroes[p.owner]; p.x = h.x - 14; p.y = h.y; }
  S.props = []; S.rescue = null;
  for (let k = 1; k < rooms.length - (boss ? 1 : 0); k++) {
    const r = rooms[k], roll = rng();
    if (roll < 0.3) S.props.push({ k: 'chest', x: (r.cx + 0.5) * RS_T, y: (r.cy + 0.5) * RS_T, used: false });
    else if (roll < 0.45 && S.floor >= 1 && !S.props.some(p => p.k === 'smith')) S.props.push({ k: 'smith', x: (r.cx + 0.5) * RS_T, y: (r.cy + 0.5) * RS_T, used: false, say: -9 });
    else if (roll < 0.7) for (let q = 0; q < 4; q++) S.props.push({ k: 'spikes', x: (r.x + 1.5 + rng() * (r.w - 3)) * RS_T, y: (r.y + 1.5 + rng() * (r.h - 3)) * RS_T, ph: rng() * 3, on: false });
  }
  // середина пути: закованный напарник другой специализации, если свой пал (только одиночка с напарником)
  const lost = S.pals.find(p => p.dead);
  if (S.floor === 2 && lost && rooms.length > 2) {
    const r = rooms[(rooms.length / 2) | 0], used = [lost.first, lost.kind], kinds = RS_PAL_KINDS.filter(x => !used.includes(x));
    S.rescue = { x: (r.cx + 0.5) * RS_T, y: (r.cy + 0.5) * RS_T, kind: kinds[(rng() * kinds.length) | 0] || 'archer', owner: lost.owner };
  }
  S.stairs = { x: (e.cx + 0.5) * RS_T, y: (e.cy + 0.5) * RS_T, open: false, wait: -1 };
  S.enemies = []; S.shots = []; S.drops = [];
  const N = S.n, m = S.diff.mult * (1 + S.floor * 0.28), hpN = 1 + 0.25 * (N - 1), cntN = 1 + 0.35 * (N - 1);
  for (let k = 1; k < rooms.length; k++) {
    const r = rooms[k], n0 = boss && k === rooms.length - 1 ? 0 : 2 + ((rng() * 3) | 0) + (S.floor >> 1), n = Math.round(n0 * cntN);
    for (let i = 0; i < n; i++) {
      const kind = rng() < 0.3 + S.floor * 0.08 ? 'raven' : 'skel', hp = (kind === 'skel' ? 30 : 18) * m * hpN;
      S.enemies.push({ kind, x: (r.x + 1 + rng() * (r.w - 2)) * RS_T, y: (r.y + 1 + rng() * (r.h - 2)) * RS_T, hp, max: hp, dmg: (kind === 'skel' ? 8 : 6) * m, spd: kind === 'skel' ? 26 : 38, cd: 0, hit: 0, awake: false });
    }
  }
  if (boss) {
    const r = rooms[rooms.length - 1], hp = 420 * S.diff.mult * (1 + 0.7 * (N - 1));
    S.enemies.push({ kind: 'malgor', x: (r.cx + 0.5) * RS_T, y: (r.cy - 1) * RS_T, hp, max: hp, dmg: 12 * S.diff.mult, spd: 18, cd: 2, hit: 0, awake: false, boss: true, vol: 0, ring: 0 });
    S.stairs.x = -999;   // у босса лестницы нет — победа после его гибели
  }
  rsMsg(S, boss ? 'Дно. Малгор ждёт.' : `Этаж ${S.floor + 1}`, 2.2);
}

const rsSolid = (S, x, y) => { const i = Math.floor(x / RS_T), j = Math.floor(y / RS_T); return i < 0 || j < 0 || i >= RS_W || j >= RS_H || !S.map[j * RS_W + i]; };
function rsMove(S, o, dx, dy, r) {
  r = r || 4;
  const ok = (x, y) => !(rsSolid(S, x - r, y - r) || rsSolid(S, x + r, y - r) || rsSolid(S, x - r, y + r) || rsSolid(S, x + r, y + r));
  if (ok(o.x + dx, o.y)) o.x += dx;
  if (ok(o.x, o.y + dy)) o.y += dy;
}
const rsNearest = (o, list, rng) => { let b = null, bd = rng * rng; for (const e of list) { if (e.hp <= 0) continue; const d = (e.x - o.x) ** 2 + (e.y - o.y) ** 2; if (d < bd) { bd = d; b = e; } } return b; };
const rsPop = (S, x, y, text, col) => rsEv(S, { k: 'pop', x, y, text, col: col || '#fff' });
const rsSfx = (S, n, vol) => rsEv(S, vol ? { k: 'sfx', n, vol } : { k: 'sfx', n });

// ---------- действия героя ----------
function rsDash(S, h) { if (S.over || S.pick || h.down || h.away || h.dashCd > 0) return; rsSfx(S, 'dash'); h.dash = 0.16; h.dashCd = 1.1 * h.dashMul; h.inv = 0.2; }
function rsSlam(S, h) {
  if (S.over || S.pick || h.down || h.away || h.slamCd > 0) return;
  rsSfx(S, 'slam'); h.slamCd = 4; h.slam = 0.3; rsEv(S, { k: 'flash', v: 0.25 });
  for (const e of S.enemies) if (rsLen(e.x - h.x, e.y - h.y) < 40) rsHurt(S, e, h.dmg * 2.2, h);
}
function rsHurt(S, e, d, by) {
  if (e.hp <= 0) return;
  e.hp -= d; e.hit = 0.12; e.awake = true; rsPop(S, e.x, e.y - 10, Math.round(d), '#ffe680');
  if (e.hp > 0) { rsSfx(S, e.kind === 'raven' ? 'caw' : 'hit'); return; }
  rsSfx(S, e.boss ? 'boom' : 'kill'); rsSfx(S, 'coin');
  S.kills++;
  const g = e.boss ? 40 : 2 + ((rsRand(S, 'ca') * 3) | 0);
  if (by) { by.kills++; by.gold += g; } else S.heroes[0].gold += g;
  if (e.boss) { rsMsg(S, 'Малгор: «Наконец-то… тишина.»', 3); rsEnd(S, true); }
  else if (rsRand(S, 'ca') < 0.12) S.drops.push({ x: e.x, y: e.y, heal: 20 });
}
function rsHurtHero(S, h, d) {
  if (h.inv > 0 || S.over || h.down || h.away || h.gone) return;
  rsSfx(S, 'heroHurt'); h.hp -= d; h.inv = 0.5; h.hit = 0.15; rsPop(S, h.x, h.y - 10, Math.round(d), '#ff8a8a');
  if (h.hp > 0) return;
  h.hp = 0;
  if (S.n === 1) { rsEnd(S, false); return; }
  h.down = true; h.rev = 0; rsPop(S, h.x, h.y - 16, 'Упал!', '#ffb0a0');
  if (!S.heroes.some(o => !o.down && !o.gone)) rsEnd(S, false);
}
function rsEnd(S, win, quit) { if (S.over) return; S.over = { win: !!win, quit: !!quit, floors: S.floor + (win ? 1 : 0), t: S.t }; rsSfx(S, win ? 'win' : 'lose'); }

// ---------- шаг ----------
// inputs[i] = { mx, my (−1..1), dash, slam } для героя i (нет записи — стоит). Нажатия — однократные.
function rsStep(S, inputs) {
  const dt = RS_DT;
  if (S.over) return;
  if (S.pick) {
    // одиночка: время стоит, пока не выбрал; кооп: таймер, потом награда выбирается сама
    if (S.n > 1) { S.pick.t -= dt; if (S.pick.t <= 0) S.heroes.forEach((h, i) => { if (S.pick && S.pick.got[i] == null) rsChoose(S, i, 0); }); }
    return;
  }
  S.step++; S.t += dt;
  if (S.msgT > 0) S.msgT -= dt;
  S.heroes.forEach((h, i) => {
    const inp = (inputs && inputs[i]) || null;
    h.cd -= dt; h.dashCd -= dt; h.slamCd -= dt; h.inv -= dt; h.hit -= dt; h.dash -= dt; h.slam = Math.max(0, h.slam - dt); h.swing = Math.max(0, h.swing - dt);
    if (h.gone || h.down || h.away) { h.moving = false; return; }
    let ix = 0, iy = 0;
    if (inp) {
      ix = Math.max(-1, Math.min(1, +inp.mx || 0)); iy = Math.max(-1, Math.min(1, +inp.my || 0));
      const d = rsLen(ix, iy); if (d > 1) { ix /= d; iy /= d; }
      if (inp.dash) rsDash(S, h);
      if (inp.slam) rsSlam(S, h);
    }
    const sp = (h.dash > 0 ? h.spd * 4 : h.spd) * dt;
    if (ix) h.face = ix > 0 ? 1 : -1;
    h.moving = rsLen(ix, iy) > 0.1;
    if (h.moving) { h.stepT -= dt; if (h.stepT <= 0) { h.stepT = 0.28; if (i === 0) rsSfx(S, 'step', 0.7); } }
    rsMove(S, h, ix * sp, iy * sp);
    // автоатака ближайшего
    const wp = h.weapon, tgt = rsNearest(h, S.enemies, wp === 'xbow' ? 85 : wp === 'staff' ? 50 : 26);
    if (tgt && h.cd <= 0) {
      h.cd = wp === 'xbow' ? h.rate * 1.25 : h.rate; h.swing = 0.15;
      if (wp === 'xbow') { const dd = rsLen(tgt.x - h.x, tgt.y - h.y) || 1; rsSfx(S, 'shoot'); S.shots.push({ x: h.x, y: h.y - 4, vx: (tgt.x - h.x) / dd * 190, vy: (tgt.y - h.y) / dd * 190, own: 'p', by: i, dmg: h.dmg * 0.9, t: 0.8, r: 0 }); }
      else if (wp === 'staff') { rsSfx(S, 'bolt'); rsEv(S, { k: 'flash', v: 0.03 }); for (const z of S.enemies) if (z.hp > 0 && rsLen(z.x - tgt.x, z.y - tgt.y) < 22) rsHurt(S, z, h.dmg * (z === tgt ? 0.8 : 0.5), h); }
      else rsHurt(S, tgt, h.dmg, h);
    }
  });
  if (S.over) return;
  // подъём упавших: живой товарищ стоит рядом RS_REVIVE секунд
  for (const h of S.heroes) {
    if (!h.down || h.gone) continue;
    if (rsActive(S).some(o => rsLen(o.x - h.x, o.y - h.y) < 14)) {
      h.rev += dt;
      if (h.rev >= RS_REVIVE) { h.down = false; h.rev = 0; h.hp = Math.round(h.max * 0.3); h.inv = 1; rsSfx(S, 'heal'); rsPop(S, h.x, h.y - 14, 'Снова в строю!', '#8aff9a'); }
    } else h.rev = Math.max(0, h.rev - dt * 0.5);
  }
  // напарники
  for (const p of S.pals) {
    if (p.dead) continue;
    const h = S.heroes[p.owner]; p.cd -= dt; p.hit -= dt;
    const pd = rsLen(h.x - p.x, h.y - p.y);
    p.moving = pd > 22;
    if (pd > 22) rsMove(S, p, (h.x - p.x) / pd * 58 * dt, (h.y - p.y) / pd * 58 * dt);
    const pr = p.kind === 'archer' || p.kind === 'bomber' ? 70 : 20, pt = rsNearest(p, S.enemies, pr);
    if (p.kind === 'healer') { if (p.cd <= 0 && h.hp < h.max && !h.down) { p.cd = 3; h.hp = Math.min(h.max, h.hp + 8); rsSfx(S, 'heal'); rsPop(S, h.x, h.y - 14, '+8', '#8aff9a'); } }
    else if (pt && p.cd <= 0) {
      p.cd = p.kind === 'bomber' ? 2.2 : p.kind === 'archer' ? 0.9 : 0.8; if (p.kind !== 'warrior') rsSfx(S, 'shoot');
      if (p.kind === 'warrior') rsHurt(S, pt, 9, h);
      else { const dd = rsLen(pt.x - p.x, pt.y - p.y) || 1; S.shots.push({ x: p.x, y: p.y, vx: (pt.x - p.x) / dd * 150, vy: (pt.y - p.y) / dd * 150, own: 'p', by: p.owner, dmg: p.kind === 'bomber' ? 22 : 9, t: 1.2, r: p.kind === 'bomber' ? 14 : 0 }); }
    }
  }
  // враги: каждый идёт к ближайшему стоящему герою
  const act = rsActive(S);
  let alive = 0;
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    alive++; e.hit -= dt; e.cd -= dt;
    let h = null, d = 1e9;
    for (const o of act) { const dd = rsLen(o.x - e.x, o.y - e.y); if (dd < d) { d = dd; h = o; } }
    if (!h) continue;
    if (!e.awake && d < 90) { e.awake = true; rsSfx(S, e.boss ? 'boss' : e.kind === 'raven' ? 'caw' : 'rattle', 0.6); if (e.boss) rsMsg(S, 'Малгор: «Шум. Опять шум.»', 2.6); }
    if (!e.awake) continue;
    if (e.boss) {
      const ph = e.hp > e.max * 0.66 ? 0 : e.hp > e.max * 0.33 ? 1 : 2;
      if (d > 50) rsMove(S, e, (h.x - e.x) / d * e.spd * dt, (h.y - e.y) / d * e.spd * dt, 6);
      if (e.cd <= 0) {
        e.cd = ph === 0 ? 1.6 : 1.1; rsSfx(S, 'bolt'); e.vol++;
        if (ph === 2) {
          // кольцо из 8 болтов, каждый залп повёрнут на 0,4 рад
          e.ring = (e.ring || 0) + 1;
          let c = 1, s = 0; for (let k = 0; k < e.ring % 16; k++) { const c2 = c * RS_C40 - s * RS_S40; s = s * RS_C40 + c * RS_S40; c = c2; }
          for (const [ux, uy] of RS_RING) { const vx = ux * c - uy * s, vy = ux * s + uy * c; S.shots.push({ x: e.x, y: e.y, vx: vx * 80, vy: vy * 80, own: 'e', dmg: e.dmg, t: 3 }); }
        } else {
          // веер из трёх болтов в героя; в отряде — по очереди в каждого
          const tg = act[e.vol % act.length], dd = rsLen(tg.x - e.x, tg.y - e.y) || 1, ux = (tg.x - e.x) / dd, uy = (tg.y - e.y) / dd;
          for (const sg of [-1, 0, 1]) { const vx = sg ? ux * RS_C28 - sg * uy * RS_S28 : ux, vy = sg ? uy * RS_C28 + sg * ux * RS_S28 : uy; S.shots.push({ x: e.x, y: e.y, vx: vx * 80, vy: vy * 80, own: 'e', dmg: e.dmg, t: 3 }); }
        }
        if (ph === 1 && S.enemies.filter(z => z.hp > 0).length < 6 + 2 * (S.n - 1)) S.enemies.push({ kind: 'skel', x: e.x + 10, y: e.y + 10, hp: 24, max: 24, dmg: 6, spd: 30, cd: 0, hit: 0, awake: true });
      }
      continue;
    }
    if (d > 8) rsMove(S, e, (h.x - e.x) / d * e.spd * dt, (h.y - e.y) / d * e.spd * dt);
    if (d < 11 && e.cd <= 0) { e.cd = 0.9; rsHurtHero(S, h, e.dmg); }
    for (const p of S.pals) if (!p.dead && rsLen(p.x - e.x, p.y - e.y) < 9 && e.cd <= 0.2) { p.hp -= e.dmg * 0.4 * dt * 4; p.hit = 0.1; }
  }
  for (const p of S.pals) if (p.hp <= 0 && !p.dead) { p.dead = true; rsPop(S, p.x, p.y - 10, 'Напарник пал', '#ffb0a0'); }
  // снаряды
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.t -= dt;
    let dead = s.t <= 0 || rsSolid(S, s.x, s.y);
    if (s.own === 'e') { for (const h of S.heroes) if (!h.down && !h.gone && !h.away && rsLen(s.x - h.x, s.y - h.y) < 6) { rsHurtHero(S, h, s.dmg); dead = true; break; } }
    else for (const e of S.enemies) if (e.hp > 0 && rsLen(s.x - e.x, s.y - e.y) < 8) {
      const by = S.heroes[s.by] || null;
      if (s.r) { rsSfx(S, 'boom'); for (const z of S.enemies) if (rsLen(z.x - s.x, z.y - s.y) < s.r + 6) rsHurt(S, z, s.dmg, by); }
      else rsHurt(S, e, s.dmg, by);
      dead = true; break;
    }
    if (dead) S.shots.splice(i, 1);
  }
  if (S.over) return;
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i], h = act.find(o => rsLen(d.x - o.x, d.y - o.y) < 9);
    if (h) { h.hp = Math.min(h.max, h.hp + d.heal); rsSfx(S, 'heal'); rsPop(S, h.x, h.y - 12, '+' + d.heal, '#8aff9a'); S.drops.splice(i, 1); }
  }
  for (const q of S.props) {
    if (q.k === 'spikes') { q.on = ((S.t + q.ph) % 3) > 2.2; if (q.on) for (const h of act) if (rsLen(h.x - q.x, h.y - q.y) < 6) rsHurtHero(S, h, 8 * S.diff.mult); continue; }
    for (const h of act) {
      const dd = rsLen(h.x - q.x, h.y - q.y);
      if (q.k === 'chest' && !q.used && dd < 10) { q.used = true; const g = 12 + ((rsRand(S, 'ca') * 18) | 0); h.gold += g; rsSfx(S, 'coin'); rsPop(S, q.x, q.y - 12, '+' + g + ' зол.', '#ffd84a'); if (rsRand(S, 'ca') < 0.4) S.drops.push({ x: q.x + 8, y: q.y, heal: 25 }); }
      else if (q.k === 'smith' && dd < 12 && !q.used) {
        if (h.gold >= 20) { q.used = true; h.gold -= 20; h.dmg *= 1.15; rsSfx(S, 'pick'); rsPop(S, q.x, q.y - 14, 'Заточка! +15% урона', '#8ad8ff'); }
        else if (S.t - q.say > 2.5) { q.say = S.t; rsPop(S, q.x, q.y - 14, 'Кузнец: 20 золота', '#f1dfb0'); }
      }
    }
  }
  if (S.rescue) {
    const r = S.rescue, h = S.heroes[r.owner];
    if (h && !h.down && rsLen(h.x - r.x, h.y - r.y) < 11) {
      const p = S.pals.find(x => x.owner === r.owner);
      Object.assign(p, { x: r.x, y: r.y, hp: 60, max: 60, cd: 0, kind: r.kind, hit: 0, dead: false });
      rsSfx(S, 'heal'); rsMsg(S, 'Новый напарник!', 2.4); S.rescue = null; rsEv(S, { k: 'pal', kind: r.kind });
    }
  }
  // лестница: спуск, когда все стоящие герои на ней (в отряде — или через 15 с после первого)
  if (!S.stairs.open && !alive && !S.boss) { S.stairs.open = true; rsSfx(S, 'stairs'); rsMsg(S, 'Лестница открыта', 1.8); }
  if (S.stairs.open) {
    const on = act.filter(h => rsLen(h.x - S.stairs.x, h.y - S.stairs.y) < 10).length;
    if (on && on === act.length) rsNext(S);
    else if (on && S.n > 1) { if (S.stairs.wait < 0) { S.stairs.wait = RS_COOP_STAIRS; rsMsg(S, 'Отряд, к лестнице!', 2); } S.stairs.wait -= dt; if (S.stairs.wait <= 0) rsNext(S); }
    else S.stairs.wait = -1;
  }
}

// ---------- награды между этажами ----------
function rsNext(S) {
  if (S.floor + 1 >= S.diff.floors) { rsEnd(S, true); return; }
  const opts = [], got = [];
  S.heroes.forEach((h, i) => {
    const ids = RS_UPS.map(u => u.id);
    for (let k = ids.length - 1; k > 0; k--) { const j = (rsRand(S, 'ca') * (k + 1)) | 0; const tmp = ids[k]; ids[k] = ids[j]; ids[j] = tmp; }
    opts[i] = ids.slice(0, h.choices); got[i] = h.gone ? -1 : null;
  });
  S.pick = { opts, got, t: RS_COOP_PICK };
  rsSfx(S, 'stairs');
}
function rsUp(h, id) {
  if (id === 'blade') h.dmg *= 1.3;
  else if (id === 'hands') h.rate *= 0.75;
  else if (id === 'beard') { h.max += 30; h.hp = Math.min(h.max, h.hp + 30); }
  else if (id === 'boots') h.spd *= 1.2;
  else if (id === 'flask') h.hp = h.max;
  else if (id === 'dash') { h.dashCd = 0; h.dashMul = 0.6; }
}
function rsChoose(S, i, k) {
  const P = S.pick; if (!P || P.got[i] != null || !P.opts[i]) return false;
  const id = P.opts[i][Math.max(0, Math.min(P.opts[i].length - 1, k | 0))];
  P.got[i] = id; const h = S.heroes[i]; rsUp(h, id); h.ups.push(id); rsSfx(S, 'pick');
  if (P.got.every(g => g != null)) { S.pick = null; S.floor++; rsFloor(S); }
  return true;
}

// ---------- итог ----------
function rsScore(S) {
  const gold = S.heroes.reduce((a, h) => a + h.gold, 0), win = !!(S.over && S.over.win);
  return Math.round((S.floor + (win ? 1 : 0)) * 100 + S.kills * 5 + gold + (win ? 500 + Math.max(0, 900 - S.t) : 0));
}
// награды в мету каждому герою: камни как в одиночке +10% за каждого товарища (до +40%), осколки — полностью
function rsRewards(S) {
  const win = !!(S.over && S.over.win), bonus = 1 + 0.1 * Math.min(4, S.n - 1);
  return { stones: Math.round((S.floor + (win ? 2 : 0) + S.kills / 5) * S.diff.mult * bonus), shards: win ? (S.diff.id === 'curse' ? 3 : 1) : 0, floors: S.floor + (win ? 1 : 0), win };
}

// ---------- запись ввода и переигровка ----------
// Запись — массив [шаг, герой, вид, a, b]: 0 — движение (a, b — направление ×8, целые), 1 — рывок, 2 — удар, 3 — выбор награды a, 4 — сдаться.
// Переигровка сама проверяет правила, поэтому подделать итог нельзя: сервер получает только запись и считает очки сам.
const RS_MAX_STEPS = 60 * 60 * 40;   // 40 минут игрового времени — дальше запись считается кривой
function rsReplay(opts, rec) {
  const S = rsNew(opts), inp = S.heroes.map(() => ({ mx: 0, my: 0, dash: false, slam: false }));
  let k = 0, prev = -1;
  if (!Array.isArray(rec)) return { S, err: 'нет записи' };
  while (!S.over) {
    let picked = false;
    while (k < rec.length && rec[k][0] === S.step) {
      const r = rec[k++];
      if (!Array.isArray(r) || r.length < 3) return { S, err: 'кривая запись' };
      const i = r[1] | 0, it = inp[i]; if (!it) return { S, err: 'нет героя ' + i };
      if (r[2] === 0) { it.mx = Math.max(-8, Math.min(8, r[3] | 0)) / 8; it.my = Math.max(-8, Math.min(8, r[4] | 0)) / 8; }
      else if (r[2] === 1) it.dash = true;
      else if (r[2] === 2) it.slam = true;
      else if (r[2] === 3) { if (!rsChoose(S, i, r[3])) return { S, err: 'выбор без награды' }; picked = true; }
      else if (r[2] === 4) { rsEnd(S, false, true); break; }
    }
    if (S.over) break;
    if (k < rec.length && rec[k][0] < S.step) return { S, err: 'записи не по порядку' };
    if (S.pick) { if (picked) continue; return { S, err: 'забег брошен на выборе награды' }; }
    if (S.step >= RS_MAX_STEPS) return { S, err: 'слишком длинный забег' };
    if (k >= rec.length && S.step === prev) return { S, err: 'запись кончилась' };
    prev = S.step;
    rsStep(S, inp); S.ev.length = 0;
    for (const it of inp) { it.dash = false; it.slam = false; }
    if (k >= rec.length && !S.over && S.step > (rec.length ? rec[rec.length - 1][0] : 0) + 60 * 60 * 5) return { S, err: 'запись кончилась до конца забега' };
  }
  return { S, err: null, score: rsScore(S) };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { RS_DT, RS_T, RS_W, RS_H, RS_UPS, RS_PAL_KINDS, rsNew, rsStep, rsChoose, rsEnd, rsScore, rsRewards, rsReplay, rsSeedOfDay, rsRand, rsActive, rsWeekOf, rsRankedOpts, RS_FAIR_HERO };
