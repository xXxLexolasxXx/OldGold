// Игровая часть пиксельных зданий (трактир, склад, дома): из модели собирает объект спрайта в формате buildingSprite
// (canvas/shadow/w/h/top/padx/…) и переводит точки модели (веранда, печь, окна, кучи груза…) в пиксели спрайта.
// Вклеивается в js/bldpx.js сборщиком build-runtime.js, внутри общей обёртки-IIFE.

// виды домов в игре: houseVar (0..7) → один из восьми пиксельных домов (нору заменили дом на сваях и дом в дубе)
const PX_HOUSES = [
  ...HOUSE_VARS.slice(0, 6).map((v, i) => (g, lv) => v.make(g, lv, i)),
  (g, lv) => HOUSE_ALT[0].make(g, lv, 4),   // дом на сваях: на 3-м уровне синяя черепица (как у варианта 4 в списке крыш)
  (g, lv) => HOUSE_ALT[2].make(g, lv, 6),   // дом в старом дубе
];
const PX_HOUSE_KINDS = PX_HOUSES.map((f, i) => i);
const PX_HOUSE_NAMES = ['Белёный коттедж', 'Высокий фахверк', 'Изба с крыльцом', 'Каменный домик', 'Круглый домик', 'Г-образный дом', 'Дом на сваях', 'Дом в старом дубе'];

function pxModel(type, g, d, lv, vr) {
  if (type === 'inn') { g.rot = 0; (d.rot ? buildInnProfile : buildInn)(g, lv, ROOF_LV[lv](STRAW1.olive)); return; }
  g.rot = d.rot ? 1 : 0;
  if (type === 'storehouse') { g.dynPiles = true; buildStore(g, lv, ROOF_ST[lv]()); return; }
  if (type === 'school') { buildSchool(g, lv); return; }
  if (type === 'sawmill') { buildSaw(g, lv); return; }
  if (type === 'woodcutter') { WOOD2_VARS[2].make(g, lv); return; }   // пень под соломенной шапкой с дровяным сараем
  if (type === 'quarry') { QUARRY2_VARS[0].make(g, lv); return; }     // скальный выход с забоем и сторожкой
  PX_HOUSES[vr](g, lv);
}

function pxBuild(type, rot, lv, vr) {
  const def = BUILDINGS[type], d = bDims(type, rot);
  const FW = d.w * TILE, FD = d.h * TILE, top = def.top + 34;
  const W = Math.ceil(FW + BPADX * 2 + FD * BSK), H = FD + top + BBOTTOM;
  BK = 1;
  const g = new BGrid(W, H, BPADX, top + FD);
  g.LD = type === 'inn' ? FD : def.h * TILE; g.noSmoke = true;
  pxModel(type, g, d, lv, vr);
  g.finish({ step: 1.6, ink: P1.ink });
  const M = g.meta || {};
  const scr = p => { const q = g.W3(p); return [g.sx(q[0], q[1]), g.sy(q[1], p[2] || 0)]; };
  // окна → [cx, cy, w, h, round] (как WIN_REC у старых зданий); у повёрнутой модели сторона меняется
  const sideW = s => (g.rot ? { S: 'E', W: 'S', E: 'N', N: 'W' }[s] : s);
  const wins = [];
  for (const w of M.wins || []) {
    const ws = sideW(w.side);
    if (ws !== 'S' && ws !== 'E') continue;
    const c = w.side === 'S' || w.side === 'N' ? [w.a + w.w / 2, w.at, w.z + w.h / 2] : [w.at, w.a + w.w / 2, w.z + w.h / 2];
    const [x, y] = scr(c);
    wins.push([x, y, ws === 'S' ? w.w : Math.max(3, w.w * 0.5), w.h, w.round]);
  }
  const shadow = mkCanvas(W, H), sc = shadow.getContext('2d');
  sc.filter = 'blur(2px)'; sc.fillStyle = 'rgba(30,22,12,0.3)';
  const LW = g.rot ? def.w * TILE : FW, LD = g.rot ? def.h * TILE : FD;
  const corners = [[0, 0, 0], [LW, 0, 0], [LW, LD, 0], [0, LD, 0]].map(scr);
  sc.beginPath(); corners.forEach((p, i) => (i ? sc.lineTo(p[0] + 3, p[1] - 2) : sc.moveTo(p[0] + 3, p[1] - 2))); sc.closePath(); sc.fill();
  const opt = p => p && scr(p), arr = a => (a || []).map(scr);
  const spr = {
    canvas: pxUp(g.toCanvas(), 3), shadow, w: W, h: H, top, padx: BPADX, fw: FW, baseY: top + FD - 2, doorCx: BPADX + (d.dx + 0.5) * TILE,
    px: type, pxLv: lv, k1: true,
    chimneys: (g.chim || []).map(scr), wins, doorPt: opt(M.doorPt),
    perches: [scr([LW / 2, LD * 0.7, 40])],
  };
  if (type === 'inn') Object.assign(spr, {
    pxInn: lv, noDeck: true,
    porch: opt(M.porch), oven: opt(M.oven), bar: opt(M.bar),
    perches: d.rot ? [scr([35, 92, 57]), scr([12, 95, 58])] : [scr([33, 69, 63]), scr([114, 78, 44])],
    fire: opt(M.fire), spit: opt(M.spit), chop: opt(M.chop), darts: opt(M.darts), stage: opt(M.stage),
    seats: arr(M.seats), tables: arr(M.tables), pantry: arr(M.pantry), stock: arr(M.stock),
  });
  if (type === 'school') { spr.play = {}; for (const k in M.play || {}) spr.play[k] = Array.isArray(M.play[k][0]) ? M.play[k].map(scr) : scr(M.play[k]); }
  if (type === 'sawmill') Object.assign(spr, { saw: opt(M.saw), sawR: M.sawR, sawSide: !!g.rot, logIn: opt(M.logIn), halves: opt(M.halves), dust: opt(M.dust), workers: arr(M.workers) });
  if (type === 'woodcutter' || type === 'quarry') spr.work = opt(M.work);
  if (type === 'storehouse') {
    spr.piles = {}; for (const k in M.piles || {}) spr.piles[k] = M.piles[k].map(scr);
    spr.runes = arr(M.glow); spr.drop = arr(M.drop); spr.circle = opt(M.circle);
  }
  return spr;
}

// ×3 ближайшим соседом: игра рисует здания со сглаживанием, а у холста ×3 пиксели остаются чёткими (как у прежних спрайтов)
function pxUp(src, k) { const cv = mkCanvas(src.width * k, src.height * k), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, cv.width, cv.height); return cv; }

// зеркало для входа с запада (rot 2): старые поля отражает mirrorSprite, новые — здесь
function pxMirror(s) {
  const m = mirrorSprite(s, s.fw), W = s.w, pt = p => p && [W - p[0], p[1], ...p.slice(2)];
  for (const k of ['fire', 'spit', 'chop', 'darts', 'stage', 'circle', 'saw', 'logIn', 'halves', 'dust', 'work']) m[k] = pt(s[k]);
  for (const k of ['seats', 'tables', 'pantry', 'stock', 'runes', 'drop', 'workers']) m[k] = (s[k] || []).map(pt);
  if (s.play) { m.play = {}; for (const k in s.play) m.play[k] = Array.isArray(s.play[k][0]) ? s.play[k].map(pt) : pt(s.play[k]); }
  if (s.piles) { m.piles = {}; for (const k in s.piles) m.piles[k] = s.piles[k].map(pt); }
  return m;
}

function pxSprite(type, rot, lv, vr = 0) {
  const d = bDims(type, rot), v = type === 'house' ? PX_HOUSE_KINDS[(vr >>> 0) % PX_HOUSE_KINDS.length] : 0;
  const key = type + ':px:' + d.rot + ':' + lv + ':' + v;
  if (SPR.buildings[key]) return SPR.buildings[key];
  const spr = d.rot === 2 ? pxMirror(pxSprite(type, 1, lv, vr)) : pxBuild(type, d.rot, lv, v);
  SPR.buildings[key] = spr;
  return spr;
}
const innPxSprite = (rot, lv) => pxSprite('inn', rot, lv);

// Картинка кучи груза для склада (в пикселях мира): kind — trunk/timber/stone/food/goods, f — заполнение 0..1 (4 ступени)
const PILE_CACHE = new Map();
function pxPile(kind, f) {
  const st = Math.max(1, Math.min(4, Math.ceil(f * 4))), key = kind + st;
  if (PILE_CACHE.has(key)) return PILE_CACHE.get(key);
  const S = 48, buf = new Map();
  PILE_DRAW[kind](st / 4)((x, y, c) => { if (c) buf.set(x + ',' + y, c); });
  const tmp = mkCanvas(S, S), tc = tmp.getContext('2d'), im = tc.createImageData(S, S), d = im.data;
  for (const [k, col] of buf) { const [x, y] = k.split(',').map(Number), X = x + S / 2, Y = y + S - 4; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const j = (Y * S + X) * 4; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255; }
  const out = [];   // обводка снаружи, как у зданий
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const j = (y * S + x) * 4; if (d[j + 3]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a, Y = y + b; return X >= 0 && Y >= 0 && X < S && Y < S && d[(Y * S + X) * 4 + 3]; })) out.push(j); }
  for (const j of out) { d[j] = P1.ink[0]; d[j + 1] = P1.ink[1]; d[j + 2] = P1.ink[2]; d[j + 3] = 255; }
  tc.putImageData(im, 0, 0);
  const r = { cv: pxUp(tmp, 3), w: S, h: S, ax: S / 2, ay: S - 4 };
  PILE_CACHE.set(key, r);
  return r;
}
