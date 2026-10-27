'use strict';
// Туман войны кампании: карта акта поначалу тёмная, открывается там, где побывали гномы, герой и стройки.
// Это только вид (симуляцию не трогает): клиент считает «исследовано» сам по видимым юнитам и зданиям, поэтому
// в кооперативе синхронизировать нечего. Исследованное хранится в Game.camp.fog (строка из пар «пропуск/открыто»)
// и переживает сохранение. Акт может отказаться от тумана: fog: false.

const CFOG = { C: null, w: 0, h: 0, a: null, cv: null, ctx: null, img: null, dirty: true, t: -9, saved: -9, seq: -1 };
const CFOG_R = { hero: 11, unit: 7, build: 6, goal: 4, cam: 10 };

function campFogOn() {
  const C = Game.camp, A = C && CAMP_ACTS[C.act];
  return !!A && A.fog !== false && !A.scenario && typeof document !== 'undefined' && !(typeof window !== 'undefined' && window.__SERVER__);
}

// «0*12,1*5,…»: пары значение*длина по строкам карты
function campFogPack(a) {
  const out = [];
  let v = a[0] ? 1 : 0, n = 0;
  for (let i = 0; i < a.length; i++) {
    const b = a[i] ? 1 : 0;
    if (b === v) n++; else { out.push(v + '*' + n); v = b; n = 1; }
  }
  out.push(v + '*' + n);
  return out.join(',');
}
function campFogUnpack(s, a) {
  let i = 0;
  for (const p of String(s || '').split(',')) {
    const [v, n] = p.split('*').map(Number);
    if (!(n > 0)) continue;
    if (v) a.fill(255, i, Math.min(a.length, i + n));
    i += n;
    if (i >= a.length) break;
  }
}

function campFogInit(C) {
  CFOG.C = C; CFOG.w = MAP_W; CFOG.h = MAP_H;
  CFOG.a = new Uint8Array(MAP_W * MAP_H);
  if (typeof C.fog === 'string') campFogUnpack(C.fog, CFOG.a);
  CFOG.cv = document.createElement('canvas'); CFOG.cv.width = MAP_W; CFOG.cv.height = MAP_H;
  CFOG.ctx = CFOG.cv.getContext('2d');
  CFOG.img = CFOG.ctx.createImageData(MAP_W, MAP_H);
  CFOG.dirty = true; CFOG.t = -9; CFOG.saved = Game.time;
}

function campFogReveal(cx, cy, r) {
  const a = CFOG.a, w = CFOG.w, h = CFOG.h;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x;
    if (!a[i] && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { a[i] = 255; CFOG.dirty = true; }
  }
}

function campFogScan(C) {
  for (const u of Game.units) {
    if (u.dead || u.inside) continue;
    campFogReveal(u.x, u.y, u.type === 'hero' ? CFOG_R.hero : CFOG_R.unit);
  }
  for (const b of Game.buildings) if (!b.removed) campFogReveal(b.x + b.w / 2, b.y + b.h / 2, CFOG_R.build);
  // цели шага видны всегда: игрок должен знать, куда идти, а не гадать в темноте
  for (const o of C.objs || []) { const z = o.z; if (z && o.cur < o.need) campFogReveal(z[0] + 0.5, z[1] + 0.5, CFOG_R.goal); }
  const S = typeof campStepNow === 'function' ? campStepNow(C) : null;
  if (S && S.cam) campFogReveal(S.cam[0] + 0.5, S.cam[1] + 0.5, CFOG_R.cam);
}

function campFogUpdate() {
  const C = Game.camp;
  if (!C || !campFogOn()) { CFOG.C = null; return false; }
  if (CFOG.C !== C || CFOG.w !== MAP_W || CFOG.h !== MAP_H) campFogInit(C);
  if (Game.time - CFOG.t >= 0.35 || Game.time < CFOG.t) {
    CFOG.t = Game.time;
    campFogScan(C);
    if (CFOG.dirty) {
      const d = CFOG.img.data, a = CFOG.a;
      for (let i = 0, j = 0; i < a.length; i++, j += 4) { d[j] = 14; d[j + 1] = 11; d[j + 2] = 8; d[j + 3] = a[i] ? 0 : 242; }
      CFOG.ctx.putImageData(CFOG.img, 0, 0);
      CFOG.dirty = false;
      if (Game.time - CFOG.saved >= 4 || Game.time < CFOG.saved) { CFOG.saved = Game.time; C.fog = campFogPack(a); }
    }
  }
  return true;
}

// после мира и ночи, до значков и подсказок: прячет и местность, и юнитов в неисследованном
function campFogDraw(c) {
  if (!campFogUpdate()) return;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;                      // 1 пиксель на клетку, сглаживание даёт мягкую кромку
  c.drawImage(CFOG.cv, 0, 0, MAP_W * TILE, MAP_H * TILE);
  c.imageSmoothingEnabled = sm;
}

// точка в ещё не исследованном тумане (миникарта прячет там зверей и врагов)
function campFogHid(x, y) {
  if (!CFOG.C || CFOG.C !== Game.camp || !CFOG.a) return false;
  const tx = Math.floor(x), ty = Math.floor(y);
  return tx >= 0 && ty >= 0 && tx < CFOG.w && ty < CFOG.h && !CFOG.a[ty * CFOG.w + tx];
}

// миникарта: то же самое, поверх базы
function campFogMini(c, cv) {
  if (!campFogUpdate()) return;
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = true;
  c.drawImage(CFOG.cv, 0, 0, cv.width, cv.height);
  c.imageSmoothingEnabled = sm;
}
