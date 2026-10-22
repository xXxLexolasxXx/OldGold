'use strict';
// Декор от игроков (кооп): клумбы, оградки, фонари, лавки и три новых вида — статуя, флаг, указатель.
// Каталог общий для сервера и клиента; ставит и убирает сервер (coopsim.js: команды decor/undecor, право decor).
// У предмета, поставленного игроком, есть подпись автора o.by: убрать его может только автор или хост.
// Лимиты: на игрока VD_PER и на деревню VD_MAX (чтобы не раздувать снимок мира). «Красота» — сколько такого
// декора рядом с гномом: mood.js берёт причину «decor» через vdMood. Автор сохраняется в сейве (s.vdby).

const VD_PER = 15, VD_MAX = 80;
const VD_CAT = {
  bed:    { n: 'Клумба',    beauty: 1 },
  fence:  { n: 'Оградка',   beauty: 0.5 },
  lamp:   { n: 'Фонарь',    beauty: 0.5 },
  bench:  { n: 'Лавка',     beauty: 1 },
  statue: { n: 'Статуя',    beauty: 2 },
  flag:   { n: 'Флаг',      beauty: 1.5 },
  sign:   { n: 'Указатель', beauty: 1 },
};
const VD_NEW = { statue: { gap: 6 }, flag: { gap: 3 }, sign: { gap: 4 } };
const vdOwn = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(VD_CAT, k);

// новые виды — тоже «уличное убранство»: дорога и дом их сдвигают, снос убирает
if (typeof STREET !== 'undefined') for (const k in VD_NEW) STREET[k] = VD_NEW[k];

function vdMake(k, x, y, by) {
  const o = { t: k, by, born: Game.time };
  if (k === 'bed') o.v = (Math.random() * 10) | 0;
  else if (k === 'bench') o.v = (Math.random() * 15) | 0;
  else if (k === 'fence') { o.v = (Math.random() * 5) | 0; o.vert = !!(inb(x - 1, y) && World.road[idx(x - 1, y)]) || !!(inb(x + 1, y) && World.road[idx(x + 1, y)]); }
  else if (k === 'statue' || k === 'sign') o.v = (Math.random() * 3) | 0;
  else if (k === 'flag') o.v = (Math.random() * 6) | 0;
  return o;
}

function vdCount(by) {
  let all = 0, mine = 0;
  for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.by) { all++; if (o.by === by) mine++; } }
  return { all, mine };
}

// Почему здесь нельзя ('' — можно)
function vdWhyNot(k, x, y, by) {
  if (!vdOwn(k)) return 'Такого украшения нет';
  if (!inb(x, y)) return 'За краем карты';
  if (!isFreeGrass(x, y)) return 'Сюда не поставить: нужна свободная трава';
  const c = vdCount(by);
  if (c.mine >= VD_PER) return `У тебя уже ${VD_PER} украшений — убери старое`;
  if (c.all >= VD_MAX) return `В деревне уже ${VD_MAX} украшений от игроков`;
  return '';
}

function vdPlace(k, x, y, by) {
  const why = vdWhyNot(k, x, y, by);
  if (why) return { ok: false, text: why };
  World.obj[idx(x, y)] = vdMake(k, x, y, by);
  if (typeof fxBurst === 'function') fxBurst((x + 0.5) * TILE, (y + 0.9) * TILE, 8, ['#ffe9a0', '#c8f0ff', '#ffffff'], 30, 50, 0.9, 1.6, 40);
  return { ok: true, text: `${VD_CAT[k].n}: поставлено` };
}

// убрать свой (хост — любой поставленный игроком)
function vdRemove(x, y, by, admin) {
  if (!inb(x, y)) return { ok: false, text: '' };
  const o = World.obj[idx(x, y)];
  if (!o || !o.by) return { ok: false, text: 'Здесь нет украшения от игрока' };
  if (o.by !== by && !admin) return { ok: false, text: `Это поставил ${o.by} — убрать может только автор или хост` };
  World.obj[idx(x, y)] = null;
  return { ok: true, text: 'Украшение убрано' };
}

// «Красота» вокруг гнома (зовёт mdSurround в mood.js): сумма весов декора игроков в радиусе 5
function vdBeautyAt(o) { return o && o.by && VD_CAT[o.t] ? VD_CAT[o.t].beauty : 0; }
function vdMood(b) { return b >= 6 ? 3 : b >= 3 ? 2 : b >= 1.5 ? 1 : 0; }
function vdVillage() { let b = 0; for (let i = 0; i < N_TILES; i++) b += vdBeautyAt(World.obj[i]); return Math.round(b); }

// ---------- Рисование новых видов (своя графика) ----------
const VD_FLAG_COL = ['#c8302a', '#2a6ac8', '#3a9a3a', '#e0b030', '#8a4ac0', '#e07ab0'];
function vdDraw(c, x, y, o) {
  const px = x * TILE, py = y * TILE, cx = px + 16, by = py + 26, v = o.v || 0;
  if (o.t === 'statue') {
    shadowAt(c, cx, by + 1, 9, 2.6);
    const st = ['#8e8a80', '#a89c86', '#6e7a72'][v % 3], dk = ['#5a564e', '#6e6452', '#46504a'][v % 3];
    c.fillStyle = dk; c.fillRect(cx - 8, by - 6, 16, 6); c.fillStyle = st; c.fillRect(cx - 7, by - 7, 14, 5);
    ellipse(c, cx, by - 13, 5.4, 6, st);                                     // тело в кафтане
    c.fillStyle = dk; c.fillRect(cx - 5.4, by - 10, 10.8, 1);
    ellipse(c, cx, by - 21, 3.6, 3.4, st);                                   // голова
    c.fillStyle = st; c.beginPath(); c.moveTo(cx - 4, by - 22); c.lineTo(cx, by - 31); c.lineTo(cx + 4, by - 22); c.fill();   // колпак
    c.fillStyle = '#d8d2c4'; c.beginPath(); c.moveTo(cx - 3.4, by - 20); c.lineTo(cx, by - 12 - v); c.lineTo(cx + 3.4, by - 20); c.fill();   // борода
    if (v === 1) { line(c, cx + 5, by - 8, cx + 8, by - 22, dk, 1.4); ellipse(c, cx + 8, by - 23, 2, 1.4, dk); }   // с киркой
    if (v === 2) ellipse(c, cx - 6, by - 14, 2.4, 2, '#7ab0c8');                                                  // с кружкой
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(cx - 3, by - 18, 1.2, 8);
  } else if (o.t === 'flag') {
    shadowAt(c, cx, by + 1, 5, 1.8);
    c.fillStyle = '#3a2412'; c.fillRect(cx - 1, by - 34, 2, 34);
    ellipse(c, cx, by - 35, 1.6, 1.6, '#e8c050');
    const col = VD_FLAG_COL[v % VD_FLAG_COL.length], t = Game.time * 3 + px * 0.1;
    c.fillStyle = col; c.beginPath(); c.moveTo(cx + 1, by - 33);
    for (let i = 0; i <= 6; i++) c.lineTo(cx + 1 + i * 2.2, by - 33 + Math.sin(t + i * 0.8) * 1.2);
    for (let i = 6; i >= 0; i--) c.lineTo(cx + 1 + i * 2.2, by - 24 + Math.sin(t + i * 0.8) * 1.2);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,200,0.55)'; c.fillRect(cx + 5, by - 30 + Math.sin(t + 2) * 1.2, 4, 3);   // герб — светлая плашка
  } else if (o.t === 'sign') {
    shadowAt(c, cx, by + 1, 5, 1.8);
    c.fillStyle = '#4a2c16'; c.fillRect(cx - 1.2, by - 26, 2.4, 26);
    const boards = [[-1, by - 24], [1, by - 18], [-1, by - 12]].slice(0, 2 + (v % 2));
    for (const [d, yy] of boards) {
      c.fillStyle = '#2a1a0c'; c.beginPath(); c.moveTo(cx, yy - 3); c.lineTo(cx + d * 10, yy - 3); c.lineTo(cx + d * 13, yy); c.lineTo(cx + d * 10, yy + 3); c.lineTo(cx, yy + 3); c.fill();
      c.fillStyle = v === 2 ? '#c09a5a' : '#a87a44'; c.beginPath(); c.moveTo(cx, yy - 2.2); c.lineTo(cx + d * 10, yy - 2.2); c.lineTo(cx + d * 12, yy); c.lineTo(cx + d * 10, yy + 2.2); c.lineTo(cx, yy + 2.2); c.fill();
      c.fillStyle = '#3a2410'; for (let k = 0; k < 3; k++) c.fillRect(cx + d * (3 + k * 2.4) - 0.6, yy - 0.5, 1.4, 1);
    }
  }
}

if (typeof drawDecorObj === 'function') {
  const _dd = drawDecorObj;
  drawDecorObj = function (c, x, y, o) {
    if (!VD_NEW[o.t]) return _dd(c, x, y, o);
    const age = o.born !== undefined ? Game.time - o.born : 99;
    if (age < 0) return;
    if (age < GROW_T) {
      const k = age / GROW_T, px = x * TILE, py = y * TILE;
      c.save(); c.beginPath(); c.rect(px - 10, py + 30 - 46 * k, TILE + 20, 46 * k + 4); c.clip(); c.translate(0, (1 - k) * 6); vdDraw(c, x, y, o); c.restore();
      return;
    }
    vdDraw(c, x, y, o);
  };
}

// ---------- Сохранение автора ----------
if (typeof serializeGame === 'function') {
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg(), by = [];
    for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.by) by.push([i, String(o.by)]); }
    if (by.length) s.vdby = by;
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    for (const r of (s && Array.isArray(s.vdby) ? s.vdby : [])) {
      if (!Array.isArray(r) || !Number.isInteger(r[0]) || r[0] < 0 || r[0] >= N_TILES) continue;
      const o = World.obj[r[0]];
      if (o && VD_CAT[o.t]) o.by = String(r[1]).slice(0, 24);
    }
  };
}
