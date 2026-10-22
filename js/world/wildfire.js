'use strict';
// Малые очаги огня: горящие куры и ходячие деревья, брошенные фонари, искры печей и котлов, удары молний.
// Большой пожар-бедствие остаётся в disasters.js; здесь — общие правила для всего, что горит «само по себе»:
//  • горит дерево и поле; пламя перекидывается на соседние клетки и на дома, но не вечно: клетка догорает за 9–14 с,
//    после сгорания остаётся пень (дерево) или голое поле, а головёшек не остаётся — всегда не больше WF_MAX очагов;
//  • колодец (радиус WELL_R, как в disasters.js) гасит вдвое быстрее и почти не даёт огню перекинуться, дождь — тоже;
//  • крыша решает всё: солома (ур. 1) занимается легко, дерево (ур. 2) вдвое реже, черепица (ур. 3) почти не горит;
//  • горящая курица мечется и поджигает всё рядом, гаснет в воде и у колодца, а любой гном рядом её ловит и тушит;
//  • горящее ходячее дерево мечется и поджигает лес; ходячие камни не горят: камень — это камень (молния его только колет);
//  • фонарь, упавший с гнома ночью, может поджечь траву; печь, котёл и костёр искрят, когда рядом ураган или земля дрожит;
//    молния в землю поджигает клетку, ломает фонарь и может поджечь крышу.
// Считает только тот, кто считает игру (в кооперативе — сервер); огонь рисуется как обычно через WX.fires (оно уже едет клиентам),
// горящие куры — флагом b в списке зверей. В сохранение не пишется: после загрузки очагов нет.

const WF_FLAM = new Set(['tree', 'field']);
const WF_MAX = 28;                // одновременно горящих клеток на всю карту
const WF_BMAX = 6;                // и одновременно горящих зданий
const WF_EP_MAX = 60;             // сколько клеток может загореться за один пожар, считая и поджоги, и перекидывание (потом огонь только догорает)
const WF_EP_TIME = 40;            // и сколько секунд пожар может перекидываться
const WF_LIFE_MAX = 30;           // ни один очаг не живёт дольше (страховка от «вечного» огня)
const WF_ROOF = [1, 1, 0.55, 0.25];   // шанс загореться по уровню здания (солома / дерево / черепица)
const WF_BURN = [1, 1, 0.8, 0.6];     // сколько здание горит по уровню
const WF_SRC_TYPES = new Set(['bonfire', 'bakery', 'inn', 'smithy', 'brewery', 'kiln', 'forge']);

const wfMirror = () => typeof isMirror === 'function' && isMirror();
const WFS = () => Game.wf || (Game.wf = { cells: [], bld: [], t: 0, sp: 0, rk: 0, n: 0, ever: 0, ep: 0 });
const wfRain = () => typeof WX !== 'undefined' && WX.k > 0.45;
const wfRoof = b => WF_ROOF[Math.max(1, Math.min(3, b.level || 1))];
const wfRnd = (a, b) => a + Math.random() * (b - a);
const wfWell = (x, y) => (typeof dzWellNear === 'function' ? dzWellNear(x, y) : null);

// ветер: ураган рядом (смерч в радиусе 7 клеток) — 1, иначе 0
function wfWind(x, y) {
  const D = Game.dz, c = D && D.cur;
  return c && c.k === 'wind' && c.px != null && Math.hypot(c.px - x, c.py - y) < 7 ? 1 : 0;
}

// есть ли у здания открытый огонь: печь, котёл, костёр, топка
const WF_SRC_CACHE = new Map();
function wfSource(b) {
  if (!b || b.state !== 'done') return false;
  if (b.type === 'bonfire' || (b.def && b.def.burn)) return true;
  const key = b.type + ':' + (b.level || 1);
  let v = WF_SRC_CACHE.get(key);
  if (v === undefined) {
    try { const s = buildingSprite(b.type, b.rot || 0, b.level); const A = Array.isArray; v = !!(s && (A(s.oven) || A(s.fire) || A(s.cauldron) || (A(s.glow) && !s.glowColor))) || WF_SRC_TYPES.has(b.type); } catch (e) { v = WF_SRC_TYPES.has(b.type); }
    WF_SRC_CACHE.set(key, v);
  }
  return v;
}

// зажечь клетку (дерево или поле); p — шанс, free — без поправки на дождь и колодец (прямое попадание молнии)
function wfIgnite(x, y, p = 1, free = false, spread = false) {
  const W = WFS();
  if (!W.cells.length && !W.bld.length) { W.ep = Game.time; W.n = 0; }   // новый пожар
  if (spread && (W.n >= WF_EP_MAX || Game.time - W.ep > WF_EP_TIME)) return false;
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y) || W.cells.length >= WF_MAX) return false;
  const i = idx(x, y), o = World.obj[i];
  if (!o || !WF_FLAM.has(o.t) || o.awake) return false;
  if (o.t === 'tree' ? !(o.g > 0.2) : (o.g < 0 || o.plan)) return false;
  for (const c of W.cells) if (c.i === i) return false;
  const w = wfWell(x + 0.5, y + 0.5);
  if (!free) p *= (wfRain() ? 0.2 : 1) * (w ? 0.3 : 1);
  if (Math.random() >= p) return false;
  const dur = wfRnd(9, 14) * (w ? 0.5 : 1);
  W.cells.push({ i, t0: Game.time, dur }); W.n++; W.ever++;
  WX.fires.push({ x: x + 0.5, y: y + 0.5, t0: Game.time, life: dur, wf: 1 });
  return true;
}

// поджечь здание: крыша решает шанс и срок; склад и колодец не горят
function wfIgniteB(b, p = 1, w0) {
  const W = WFS();
  if (!b || b.removed || b.state !== 'done' || b.type === 'storehouse' || b.type === 'well' || W.bld.length >= WF_BMAX) return false;
  if (W.bld.some(q => q.id === b.id) || Math.random() >= p * wfRoof(b) * (wfRain() ? 0.2 : 1)) return false;
  const w = w0 || wfWell(b.doorX + 0.5, b.doorY);
  const dur = wfRnd(11, 17) * WF_BURN[Math.max(1, Math.min(3, b.level || 1))] * (w ? 0.5 : 1);
  W.bld.push({ id: b.id, t0: Game.time, dur, w: !!w });
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  WX.fires.push({ x: cx, y: cy + 0.2, t0: Game.time, life: dur, wf: 1 });
  WX.fires.push({ x: cx + (b.w > 2 ? 0.8 : 0.3), y: cy - 0.1, t0: Game.time, life: dur * 0.8, wf: 1 });
  if (typeof dzSpoil === 'function') dzSpoil(b, w ? 0.08 : 0.2);
  if (typeof floater === 'function') floater(cx, b.y, 'Пожар!', '#ff9040');
  if (typeof logEvent === 'function') logEvent('weather', `Загорелось здание «${b.def.name}»`, b.doorX + 0.5, b.doorY);
  return true;
}

// все клетки, где сейчас пламя (малые очаги и пожар-бедствие)
function wfHeat() {
  const out = (Game.wf && Game.wf.cells.map(c => c.i)) || [];
  const D = Game.dz, c = D && D.cur;
  if (c && c.k === 'fire' && c.f) for (const q of c.f) out.push(q.i);
  return out;
}

// курица загорелась не от молнии
function wfLightHen(a, src) {
  if (a.dead || a.burn || a.kind !== 'chicken') return false;
  a.burn = { t: 0, die: Math.random() < 0.6, dir: Math.random() * 6.28, turn: 0, cl: 0, src: src || 'fire' };
  if (typeof addScorch === 'function') addScorch(a.x, a.y, 0.6);
  floater(a.x, a.y - 0.8, 'Ко-ко-ко!', '#ffd8a0');
  logEvent('weather', 'Курица загорелась и бегает в панике', a.x, a.y);
  return true;
}

// каждый кадр горящей курицы (из burnHenStep): гаснет в воде и у колодца; true — погасла
function wfHenStep(a, dt) {
  const b = a.burn;
  if (b.mirror) return false;
  const x = Math.floor(a.x), y = Math.floor(a.y);
  const inWater = inb(x, y) && World.terrain[idx(x, y)] === T_WATER;
  let well = false;
  for (const w of (typeof dzWells === 'function' ? dzWells() : [])) if (Math.hypot(w.doorX + 0.5 - a.x, w.doorY - a.y) < 2.2) { well = true; break; }
  const rain = wfRain() && b.t > 1.5 && Math.random() < dt * 0.5;
  if (!inWater && !well && !rain) return false;
  a.burn = null; a.moving = false; a.wait = 2;
  sfxAt('hiss', a.x * TILE, a.y * TILE);
  fxBurst(a.x * TILE, a.y * TILE - 4, 10, ['rgba(200,200,200,0.6)', 'rgba(150,150,150,0.5)'], 14, 18, 1.4, 3, -16);
  floater(a.x, a.y - 0.8, inWater ? 'Плюх!' : well ? 'Колодец!' : 'Дождь!', '#cfe8ff');
  logEvent('weather', inWater ? 'Курица потушилась в воде' : well ? 'Курица потушилась у колодца' : 'Курица потушилась под дождём', a.x, a.y);
  return true;
}

function wfPersonFree(u) { return !u.dead && !u.inside && isPerson(u) && u.type !== 'carter' && !u.brk && !(u.burn && u.burn.stage); }

// ---------- Ход огня ----------
function wfTick(dt) {
  if (wfMirror()) return;
  const W = Game.wf;
  const hot = (Game.animals && Game.animals.some(a => a.burn)) || (Game.ents && Game.ents.some(e => e.burnT)) || (Game.dz && Game.dz.cur);
  if (!W && !hot) return;
  const S = WFS();
  S.t += dt;
  if (S.t < 0.5) return;
  const d = S.t; S.t = 0;
  const now = Game.time, rain = wfRain();

  // 1. Источники: горящие куры и деревья-ходоки поджигают землю вокруг
  for (const a of Game.animals) {
    if (!a.burn || a.dead) continue;
    wfIgnite(a.x + wfRnd(-1.2, 1.2), a.y + wfRnd(-1.2, 1.2), 0.5, false, true);
    // любой гном рядом ловит и тушит курицу (вёдра, фартук)
    for (const u of Game.units) {
      if (!wfPersonFree(u) || Math.hypot(u.x - a.x, u.y - a.y) > 3.5 || Math.random() > 0.5) continue;
      a.burn = null; a.moving = false; a.wait = 2;
      sfxAt('hiss', a.x * TILE, a.y * TILE);
      floater(u.x, u.y - 1, 'Поймал и потушил!', '#cfe8ff'); floater(a.x, a.y - 0.8, 'Ко…', '#ffd8a0');
      logEvent('weather', 'Гном поймал горящую курицу и потушил', a.x, a.y);
      break;
    }
  }
  for (const e of Game.ents || []) {
    if (!e.burnT || e.state === 'dying' || e.state === 'gone') continue;
    for (let k = 0; k < 2; k++) wfIgnite(e.x + wfRnd(-1.6, 1.6), e.y + wfRnd(-1.6, 1.6), 0.45, false, true);
    // горящее дерево мечется, бросив цель
    if (e.state === 'walk' || e.state === 'return') {
      e.target = null; e.wait = 0;
      if (!e.goal || Math.random() < 0.5) { const x = e.x + wfRnd(-3, 3), y = e.y + wfRnd(-3, 3); if (isWalkable(Math.floor(x), Math.floor(y))) e.goal = [x, y]; }
    }
  }

  // 2. Очаги: догорают, гасятся колодцем и дождём
  for (let k = S.cells.length - 1; k >= 0; k--) {
    const c = S.cells[k], x = c.i % MAP_W, y = (c.i / MAP_W) | 0;
    if (rain) c.dur -= d * 2;
    const age = now - c.t0;
    if (age <= c.dur && age <= WF_LIFE_MAX) continue;
    S.cells.splice(k, 1);
    const o = World.obj[c.i];
    if (o && o.t === 'tree') { World.obj[c.i] = { t: 'stump', g: 0 }; World.growing.add(c.i); }
    else if (o && o.t === 'field' && o.g >= 0) o.g = -1;
    if (typeof sfxAt === 'function') sfxAt('hiss', (x + 0.5) * TILE, (y + 0.5) * TILE, 0.4);
  }
  for (let k = S.bld.length - 1; k >= 0; k--) {
    const q = S.bld[k], b = Game.buildings.find(o => o.id === q.id);
    if (!b || b.removed) { S.bld.splice(k, 1); continue; }
    if (typeof dzHit === 'function') dzHit(b, d * 0.03 * (q.w ? 0.35 : 1), 0.8);
    if (rain) q.dur -= d * 2;
    if (now - q.t0 > q.dur || now - q.t0 > WF_LIFE_MAX) S.bld.splice(k, 1);
  }

  if (!S.cells.length && !S.bld.length) S.n = 0;   // всё догорело — следующий пожар начинается с чистого листа

  // 3. Перекидывание (раз в 1,5 с)
  S.sp += d;
  if (S.sp >= 1.5) {
    S.sp = 0;
    const blds = Game.buildings.filter(b => b.state === 'done' && !b.removed && !b.isRoad);
    for (const c of S.cells.slice()) {
      const x = c.i % MAP_W, y = (c.i / MAP_W) | 0, wk = wfWell(x + 0.5, y + 0.5) ? 0.3 : 1, rk = rain ? 0.2 : 1, wd = 1 + wfWind(x, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy || !inb(x + dx, y + dy)) continue;
        const o = World.obj[idx(x + dx, y + dy)];
        if (o && (o.t === 'tree' || o.t === 'field')) wfIgnite(x + dx, y + dy, (o.t === 'tree' ? 0.12 : 0.1) * wk * rk * wd, true, true);
      }
      for (const b of blds) if (dzDistB(b, x + 0.5, y + 0.5) < 1.3) wfIgniteB(b, 0.2 * wk * wd);
    }
    // огонь пожара-бедствия и малых очагов заражает живность рядом
    const heat = wfHeat();
    if (heat.length) {
      const near = (px, py, r) => { for (const i of heat) if (Math.abs((i % MAP_W) + 0.5 - px) < r && Math.abs(((i / MAP_W) | 0) + 0.5 - py) < r) return true; return false; };
      for (const a of Game.animals) if (a.kind === 'chicken' && !a.burn && !a.dead && near(a.x, a.y, 1.1) && Math.random() < 0.3) wfLightHen(a, 'fire');
      for (const e of Game.ents || []) if (!e.burnT && !e.rock && !e.water && e.k > 0.5 && ['walk', 'return', 'fight'].includes(e.state) && near(e.x, e.y, 1.3) && Math.random() < 0.25) {
        e.burnT = now; floater(e.x, e.y - 3, 'Горит!', '#ffb060'); logEvent('weather', `Огонь перекинулся: ${entName(e).toLowerCase()} горит`, e.x, e.y);
      }
    }
  }

  // 4. Риск от искр печей и котлов (раз в 2 с): ураган рядом или земля дрожит
  S.rk += d;
  if (S.rk >= 2) {
    S.rk = 0;
    const D = Game.dz, c = D && D.cur;
    if (c && (c.k === 'wind' || c.k === 'quake')) {
      for (const b of Game.buildings) {
        if (b.removed || b.state !== 'done' || !wfSource(b)) continue;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        const p = c.k === 'wind' ? (wfWind(bx, by) ? 0.28 : 0) : (Math.hypot(bx - c.x, by - c.y) < c.r ? 0.1 : 0);
        if (p && wfIgniteB(b, p)) fxBurst(bx * TILE, by * TILE, 8, ['#ffcc50', '#ff8a30'], 30, 40, 0.8, 1.6, -60);
      }
      if (c.k === 'wind') {   // искры от фонарей уличных на лету
        for (let k = 0; k < 40; k++) {
          const x = Math.floor(c.px + wfRnd(-4, 4)), y = Math.floor(c.py + wfRnd(-4, 4));
          if (inb(x, y) && World.obj[idx(x, y)] && World.obj[idx(x, y)].t === 'lamp' && !World.obj[idx(x, y)].out && typeof lampsOn === 'function' && lampsOn()) {
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wfIgnite(x + ox, y + oy, 0.3)) break;
          }
        }
      }
    }
  }
}

// ---------- Крючки в чужие системы ----------
{
  // молния в землю: поджигает клетку, ломает фонарь рядом, может поджечь крышу
  const _gs = groundStrike;
  groundStrike = function (x, y) {
    _gs(x, y);
    if (wfMirror()) return;
    wfIgnite(x, y, 0.8, true);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) wfIgnite(x + ox, y + oy, 0.25, true);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.floor(x) + dx, yy = Math.floor(y) + dy;
      if (!inb(xx, yy)) continue;
      const o = World.obj[idx(xx, yy)];
      if (o && o.t === 'lamp' && !o.out) { o.out = true; fxBurst((xx + 0.5) * TILE, (yy + 0.5) * TILE, 10, ['#ffe090', '#ffffff'], 60, 40, 0.5, 1.4, 60); floater(xx + 0.5, yy, 'Фонарь лопнул!', '#ffd880'); }
    }
    for (const b of Game.buildings) if (!b.removed && b.state === 'done' && dzDistB(b, x, y) < 1.6) wfIgniteB(b, 0.5);
  };
  // горящий гном и упавший фонарь поджигают траву
  const _lf = lanternFall;
  lanternFall = function (u) {
    const lit = !!u.lantern && isNightNow() && typeof lampsOn === 'function' && lampsOn() && !u.inside;
    _lf(u);
    if (lit && !u.lantern && !wfMirror()) wfIgnite(u.x + wfRnd(-0.5, 0.5), u.y + wfRnd(-0.5, 0.5), 0.2);
  };
  // сброс: новая игра и загрузка начинаются без очагов
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.wf = null; };
  const _setup = setupStart;
  setupStart = function (...a) { _setup(...a); Game.wf = null; };
  const _apply = applySave;
  applySave = function (s) { _apply(s); Game.wf = null; };
  const _step = step;
  step = function (dt) { _step(dt); wfTick(dt); };
}
