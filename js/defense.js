'use strict';
// Оборона деревни: частокол и каменные стены, ворота, баррикады, ловушки (яма, шипы, огонь), факелы,
// сторожевая башня с дозорным и стражами из гильдий, ограда вокруг большого костра.
//
// Всё, что стоит на клетке (стены, ворота, баррикады, ловушки, факелы), — объект World.obj[i] с t === 'fort':
// он сам уезжает в кооперативные дельты клеток, а в сохранение идёт отдельным списком dfn (см. save.js).
// Стены и баррикады непроходимы для всех (isWalkable, path.js смотрит на o.blk), ворота пропускают жителей
// всегда, а нечисть — только когда открыты. Призраки и летуны стен не знают. Башня — обычное здание
// (стройка, достройка до уровня 2), а её дозорный и стражи считаются тут.
// Подключается после enemy.js и оборачивает функции врага (rdOk/rdStep) — файл врага не правится.

// ================= Данные =================

// cost[0] — цена постройки, cost[1] — цена достройки до уровня 2; hp — крепость (у ловушек charges — число срабатываний);
// time — секунд на стройку [ур.1, ур.2]
const FORTS = {
  wall_wood: {
    name: 'Частокол', blk: 1, drag: 1, cost: [{ trunk: 1 }, { trunk: 1, stone: 1 }], hp: [90, 220], time: [2.4, 3.2],
    sub: ['заострённые брёвна', 'на каменном цоколе, в железных скобах'],
    desc: ['Забор из заострённых брёвен. Нечисть упирается, гномы обходят, а лесоруб смотрит на него как на свой личный сорванный план.',
      'Частокол на каменном цоколе в железных скобах: ломать вдвое дольше. Лесоруб примирился — брёвен ушло столько же.'],
  },
  wall_stone: {
    name: 'Каменная стена', blk: 1, drag: 1, cost: [{ stone: 2 }, { stone: 2, trunk: 1 }], hp: [240, 480], time: [3.6, 4.6],
    sub: ['кладка из бутового камня', 'с зубцами и смотровой кромкой'],
    desc: ['Бутовая стена в рост гнома плюс шляпа. Дорого, зато сама стоит и никого не просит о помощи.',
      'Стена с зубцами: крепче вдвое и красивее вчетверо. Зубцы ничего не делают — просто внушают уважение.'],
  },
  gate: {
    name: 'Ворота', cost: [{ trunk: 3 }, { trunk: 1, stone: 2 }], hp: [140, 320], time: [3.6, 4.4], noMulti: 1,
    sub: ['откроются и закроются сами', 'окованные железом'],
    desc: ['Ставьте в стену или на дорогу. Курьеры и жители проходят всегда, нечисть — только когда открыто. Щёлкните по воротам: «автоматически» (ночью закрыты), «открыты», «закрыты».',
      'Ворота в железных полосах: бьются тяжело, скрипят громко. Курьеры по-прежнему проходят, нечисть по-прежнему расстраивается.'],
  },
  barricade: {
    name: 'Баррикада', blk: 1, drag: 1, cost: [{ trunk: 1 }, { trunk: 1, stone: 1 }], hp: [50, 130], time: [1.2, 2],
    sub: ['рогатка из брёвен', 'с шипами и мешками'],
    desc: ['Рогатка из пары брёвен: быстро, дёшево, держится на честном слове. Годится прикрыть дыру в стене, пока строится нормальная.',
      'Баррикада с шипами и мешками с землёй: уже не «на честном слове», а «на нескольких».'],
  },
  pit: {
    name: 'Волчья яма', charges: [3, 6], cost: [{ trunk: 1 }, { trunk: 1, stone: 1 }], time: [2, 3], drag: 1, trap: 1,
    sub: ['3 срабатывания', '6 срабатываний, колья на дне'],
    desc: ['Яма, замаскированная ветками. Жители знают, где она, и обходят без слов. Нечисть — не знает: вязнет и получает колом.',
      'Яма поглубже, с кольями на дне. Хватает на шесть непрошеных гостей, потом её надо перекопать.'],
  },
  spike: {
    name: 'Шипы', charges: [8, 14], cost: [{ stone: 1 }, { stone: 2 }], time: [1.6, 2.4], drag: 1, trap: 1,
    sub: ['8 срабатываний', '14, железные'],
    desc: ['Плита с торчащими вверх шипами. Лучшая обувь для нечисти — недолго, но запоминается надолго.',
      'Железные шипы заметно острее: на четырнадцать нечисти, на каждую — по персональному шипу.'],
  },
  fire: {
    name: 'Огненная ловушка', charges: [3, 6], cost: [{ trunk: 1, stone: 1 }, { trunk: 1, stone: 2 }], time: [2.4, 3.2], drag: 1, trap: 1,
    sub: ['3 вспышки', '6 вспышек, жарче'],
    desc: ['Чаша с маслом в каменном кольце: наступил — вспыхнуло. Жжёт и пугает, а ещё освещает округу, за что её любит ночной дозор.',
      'Чаша побольше, масла больше, обиды у нечисти — тоже. Хватает на шесть вспышек.'],
  },
  torch: {
    name: 'Факел', cost: [{ trunk: 1 }, { trunk: 1, stone: 1 }], hp: [40, 80], time: [1, 1.6], drag: 1, light: 1,
    sub: ['светит ночью', 'жаровня на камне, светит дальше'],
    desc: ['Столб с факелом. Тяните линию вдоль дороги: через клетку один, светло и нечисть шарахается. Скелеты факелов побаиваются.',
      'Жаровня на каменной ножке: светит вдвое дальше и греет тех, кто вышел на ночной дозор.'],
  },
};
const FORT_ORDER = ['wall_wood', 'wall_stone', 'gate', 'barricade', 'pit', 'spike', 'fire', 'torch'];
const FORT_REFUND = 0.5;          // сколько вернётся на склад при сносе
const TOWER_CAP = [2, 3];         // сколько стражей берёт башня (ур. 1 / ур. 2)
const TOWER_GZ = [36, 62];        // высота площадки дозорного над землёй (в пикселях модели)
const TOWER_H = [54, 62], TOWER_R = 26, TOWER_ROOF = 28;   // ствол башни: высота, радиус, высота крыши ур. 1

const DEF = { set: new Set(), prog: new Map(), t: 0, scanT: 0, pend: [], seen: new WeakMap(), alertT: -99, sel: -1, towers: new Map(), regenT: 0, bumpT: new WeakMap() };
const isDefMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const isDefServer = () => typeof coop !== 'undefined';

// сторожевая башня — обычное здание, но описано здесь
BUILDINGS.watchtower = {
  name: 'Сторожевая башня', cat: 'Оборона', w: 2, h: 2, top: 108, noRotate: true, cost: { trunk: 4, stone: 6 },
  desc: 'Каменная башня с дозорным-гномом: стреляет в нечисть и замечает её заранее. Свободные лучники и воины из гильдий сами идут служить на башню.',
};
const WT_DESCS = [BUILDINGS.watchtower.desc,
  'Башня с зубчатой площадкой и вымпелом: дальше видит, быстрее стреляет, берёт троих стражей. Дозорный получил подзорную трубу и важный вид.'];
BUILDINGS.watchtower.desc = WT_DESCS[0]; BUILDINGS.watchtower.desc2 = WT_DESCS[1];
BUILDINGS.watchtower.up = { cost: { trunk: 3, stone: 6 } };
BUILD_ORDER.push('watchtower');
if (!BUILD_CATS.includes('Оборона')) BUILD_CATS.push('Оборона');
UNLOCKS.push({ id: 'def', items: ['watchtower', ...FORT_ORDER.map(k => 'fort:' + k)], after: ['woodcutter', 'quarry'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.def = 'Оборона';
UNIT_TYPES.sentry = { name: 'Дозорный башни', shirt: '#7a3a2a', noTrain: true, animal: true };   // только для подписей в журнале

// ================= Клетка =================

const fortAt = (x, y) => { if (!inb(x, y)) return null; const o = World.obj[idx(x, y)]; return o && o.t === 'fort' ? o : null; };
const fortDone = o => o.bt === undefined;
const fortMax = o => { const F = FORTS[o.f]; return F.hp ? F.hp[o.lv - 1] : F.charges[o.lv - 1]; };
const fortIsWall = o => o && (o.f === 'wall_wood' || o.f === 'wall_stone' || o.f === 'gate');
const fortNight = () => isNightNow() || isEveningNow();

// Закрыто ли для нечисти (стена, баррикада, закрытые ворота)
function defFoeBlocked(x, y) {
  const o = fortAt(Math.floor(x), Math.floor(y));
  return !!o && fortDone(o) && (!!o.blk || (o.f === 'gate' && !o.open));
}

// ---------- Склады: цена ----------

const defStores = () => Game.buildings.filter(b => b.isStore());
function defHave(cost, n = 1) {
  const st = defStores();
  for (const g in cost) {
    let have = 0;
    for (const b of st) have += Math.max(0, b.stock[g] - (b.reserved[g] || 0));
    if (have < cost[g] * n) return g;
  }
  return null;
}
function defPay(cost, n = 1) {
  const st = defStores();
  for (const g in cost) {
    let need = cost[g] * n;
    for (const b of st) {
      const take = Math.min(need, Math.max(0, b.stock[g] - (b.reserved[g] || 0)));
      b.stock[g] -= take; need -= take;
      if (need <= 0) break;
    }
  }
}
function defRefund(cost, frac) {
  const st = defStores()[0];
  if (!st) return;
  for (const g in cost) { const n = Math.floor(cost[g] * frac); if (n > 0) st.stock[g] = Math.min(st.stock[g] + n, st.def.storeCap || 9999); }
}
const defCostSum = (a, b) => { const r = Object.assign({}, a); for (const g in b || {}) r[g] = (r[g] || 0) + b[g]; return r; };
const GOOD_RU = { trunk: 'брёвен', stone: 'камня' };
const defNeedText = g => `Не хватает ${GOOD_RU[g] || GOODS[g].name.toLowerCase()} на складе`;

// ---------- Проверка места ----------

// Отрежет ли клетка вход какого-нибудь здания от склада (стены не должны ломать логистику: ворота проходимы)
function defBlocksLogistics(i) {
  const hub = Game.buildings.find(b => b.isStore()) || Game.buildings[0];
  if (!hub) return false;
  const st0 = floodFrom(hub.doorX, hub.doorY);
  const before = Game.buildings.filter(b => reachedIn(st0, b.doorX, b.doorY));
  const old = World.bmap[i];
  World.bmap[i] = -1;
  const st1 = floodFrom(hub.doorX, hub.doorY);
  let bad = false;
  for (const b of before) if (!reachedIn(st1, b.doorX, b.doorY)) { bad = true; break; }
  World.bmap[i] = old;
  return bad;
}

// null — можно ставить, иначе причина. fast — без дорогой проверки заливкой (для подсветки под курсором)
function defCheck(f, x, y, fast) {
  const F = FORTS[f];
  if (!F) return 'Нет такой постройки';
  if (!inb(x, y)) return 'За краем карты';
  const i = idx(x, y), t = World.terrain[i];
  if (t !== T_GRASS && t !== T_SAND) return 'Строить можно только на земле';
  if (World.bmap[i] || World.door[i]) return 'Место занято';
  if (Game.roadSites.has(i)) return 'Мешает стройка дороги';
  const road = !!World.road[i];
  const old = fortAt(x, y);
  if (old) {
    if (f === 'gate' && fortIsWall(old) && old.f !== 'gate') { /* ворота вместо секции стены */ }
    else return old.f === f ? 'Здесь уже стоит' : 'Место занято';
  } else {
    const o = World.obj[i];
    if (o && o.t !== 'stump' && !isStreetObj(o)) return 'Мешают деревья, камни или поля';
  }
  if (road && !(F.trap || f === 'gate')) return 'Мешает дорога';
  if (f === 'torch' && road) return 'Мешает дорога';
  if (F.blk || f === 'gate') {
    for (const u of Game.units) if (!u.dead && !u.inside && Math.floor(u.x) === x && Math.floor(u.y) === y && f !== 'gate') return 'Здесь кто-то стоит — подождите';
    const p = Game.piles.get(i);
    if (p && !p.removed && F.blk) return 'Здесь лежит груз';
  }
  if (F.blk && !fast && defBlocksLogistics(i)) return 'Перекроет проход к зданиям — поставьте ворота';
  return null;
}

// ---------- Постройка ----------

function defMake(f, extra) {
  const F = FORTS[f];
  const o = { t: 'fort', f, lv: 1, bt: 0 };
  if (F.hp) o.hp = F.hp[0]; else o.hp = F.charges[0];
  if (f === 'gate') { o.mode = 'auto'; o.open = !fortNight(); o.m = 'wood'; }
  return Object.assign(o, extra || {});
}

function defPlace(f, x, y, free) {
  const F = FORTS[f], err = defCheck(f, x, y);
  if (err) return err;
  if (!free) {
    const lack = defHave(F.cost[0]);
    if (lack) return defNeedText(lack);
    defPay(F.cost[0]);
  }
  const i = idx(x, y), old = fortAt(x, y);
  const extra = {};
  if (f === 'gate' && old) { extra.m = old.f === 'wall_stone' ? 'stone' : 'wood'; if (old.lv >= 2) extra.m2 = 1; }
  else if (f === 'gate' && Game.buildings.length) {
    // рядом камень — ворота каменные
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = fortAt(x + dx, y + dy); if (n && n.f === 'wall_stone') { extra.m = 'stone'; break; } }
  }
  if (old && f === 'gate') { if (fortDone(old)) defRefund(FORTS[old.f].cost[0], FORT_REFUND); DEF.set.delete(i); }
  World.obj[i] = defMake(f, extra);
  if (f === 'gate' && !World.road[i]) setRoad(x, y, true);       // под воротами дорога: курьеры ходят только по дорогам
  World.growing.delete(i);
  DEF.set.add(i); DEF.prog.set(i, 0);
  if (free) { defFinish(i, true); }
  PF.regT = -1e9;
  return null;
}

// Ставит по списку клеток; возвращает { n, err }
function defPlaceMany(f, cells) {
  const F = FORTS[f];
  let n = 0, err = null;
  if (F.noMulti) cells = cells.slice(0, 1);
  const done = [];
  for (const [x, y] of cells.slice(0, 80)) {
    if (f === 'torch' && done.some(([a, b]) => Math.abs(a - x) < 2 && Math.abs(b - y) < 2)) continue;   // факелы через клетку
    const e = defPlace(f, x, y);
    if (e) { err = err || e; continue; }
    done.push([x, y]); n++;
  }
  if (n) { sfxAt('build', cells[0][0] * TILE, cells[0][1] * TILE, 0.7); }
  return { n, err };
}

function defFinish(i, silent) {
  const o = World.obj[i];
  if (!o || o.t !== 'fort') return;
  const F = FORTS[o.f];
  delete o.bt;
  o.hp = fortMax(o);
  if (F.blk) {
    o.blk = 1;
    // груз, упавший на клетку во время стройки, переезжает на соседнюю: под стеной ему не место
    const pile = Game.piles.get(i);
    if (pile && !pile.removed) {
      pile.removed = true; Game.piles.delete(i);
      for (const g of GOOD_KEYS) if (pile.stock[g] > 0) dropPile(i % MAP_W, (i / MAP_W) | 0, g, pile.stock[g]);
    }
  }
  DEF.prog.delete(i);
  const x = i % MAP_W, y = (i / MAP_W) | 0;
  if (!silent) { fxBurst(x * TILE + 16, y * TILE + 16, 10, ['#d8b070', '#a0703a', '#cfc7b4'], 50, 40, 0.6, 1.8, 220); sfxAt('build', x * TILE, y * TILE, 0.5); }
  PF.regT = -1e9;
}

function defUpgrade(x, y) {
  const o = fortAt(x, y);
  if (!o || !fortDone(o) || o.lv >= 2 || o.up !== undefined) return 'Нельзя улучшить';
  const F = FORTS[o.f], lack = defHave(F.cost[1]);
  if (lack) return defNeedText(lack);
  defPay(F.cost[1]);
  o.up = 0;
  DEF.set.add(idx(x, y)); DEF.prog.set(idx(x, y), 0);
  return null;
}

function defRepairCost(o) {
  const F = FORTS[o.f], mx = fortMax(o), miss = 1 - o.hp / mx, cost = {};
  const full = defCostSum(F.cost[0], o.lv >= 2 ? F.cost[1] : null);
  for (const g in full) { const n = Math.ceil(full[g] * miss * 0.5); if (n > 0) cost[g] = n; }
  return cost;
}
function defRepair(x, y) {
  const o = fortAt(x, y);
  if (!o || !fortDone(o) || o.hp >= fortMax(o)) return 'Чинить нечего';
  const cost = defRepairCost(o), lack = defHave(cost);
  if (lack) return defNeedText(lack);
  defPay(cost);
  o.hp = fortMax(o);
  fxBurst(x * TILE + 16, y * TILE + 14, 8, ['#d8b070', '#a0703a'], 40, 30, 0.5, 1.6, 200);
  sfxAt('build', x * TILE, y * TILE, 0.5);
  return null;
}

function defErase(x, y) {
  const o = fortAt(x, y);
  if (!o) return false;
  const F = FORTS[o.f], i = idx(x, y);
  const spent = o.bt !== undefined ? {} : defCostSum(F.cost[0], o.lv >= 2 ? F.cost[1] : null);
  defRefund(spent, FORT_REFUND);
  World.obj[i] = null; DEF.set.delete(i); DEF.prog.delete(i);
  PF.regT = -1e9;
  fxBurst(x * TILE + 16, y * TILE + 16, 8, ['#8a6a44', '#cfc7b4'], 40, 30, 0.5, 1.6, 200);
  return true;
}

function defGateMode(x, y, mode) {
  const o = fortAt(x, y);
  if (!o || o.f !== 'gate') return;
  o.mode = mode || ({ auto: 'open', open: 'closed', closed: 'auto' }[o.mode] || 'auto');
  o.open = o.mode === 'open' || (o.mode === 'auto' && !fortNight());
  sfxAt('creak', x * TILE, y * TILE, 0.6);
}

// Строка клеток тяни-и-ставь: по длинной оси, чтобы стена не имела щелей по диагонали
function defLine(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], cells = [];
  if (Math.abs(dx) >= Math.abs(dy)) { const s = Math.sign(dx) || 1; for (let x = a[0]; x !== b[0] + s; x += s) cells.push([x, a[1]]); }
  else { const s = Math.sign(dy); for (let y = a[1]; y !== b[1] + s; y += s) cells.push([a[0], y]); }
  return cells.slice(0, 60);
}

// ================= Ограда вокруг большого костра =================

function defRingBonfire(b) {
  if (!b || b.type !== 'bonfire' || b.state !== 'done' || b.removed) return 'Костёр ещё не достроен';
  const x0 = b.x - 2, y0 = b.y - 2, x1 = b.x + b.w + 1, y1 = b.y + b.h + 1;
  const cells = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x === x0 || x === x1 || y === y0 || y === y1) cells.push([x, y]);
  const total = {};
  for (const [x, y] of cells) { const f = World.road[idx(x, y)] ? 'gate' : 'wall_wood'; for (const g in FORTS[f].cost[0]) total[g] = (total[g] || 0) + FORTS[f].cost[0][g]; }
  const lack = defHave(total);
  if (lack) return defNeedText(lack) + ` (нужно ${Object.entries(total).map(([g, n]) => n + ' ' + (GOOD_RU[g] || g)).join(', ')})`;
  let n = 0, gaps = 0;
  // ворота против дверей костра: клетка ограды на продолжении входа
  const gates = new Set();
  for (const [dx, dy] of [[b.doorX, b.doorY], b.door2].filter(Boolean)) {
    const rx = dy < b.y || dy >= b.y + b.h ? dx : dx < b.x ? x0 : x1, ry = dy < b.y ? y0 : dy >= b.y + b.h ? y1 : dy;
    gates.add(rx + ',' + ry);
  }
  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  for (const [x, y] of cells) {
    if (!inb(x, y)) { gaps++; continue; }
    // перед дверью костра и на дорогах — ворота
    let f = World.road[idx(x, y)] || gates.has(x + ',' + y) ? 'gate' : 'wall_wood';
    let e = defPlace(f, x, y);
    if (e && f === 'wall_wood') { const e2 = defPlace('gate', x, y); if (!e2) e = null; }
    if (e) gaps++; else n++;
  }
  // факелы по углам внутри ограды
  for (const [cx, cy] of corners) { const tx = cx + Math.sign(b.x + b.w / 2 - cx), ty = cy + Math.sign(b.y + b.h / 2 - cy); defPlace('torch', tx, ty); }
  if (!n) return 'Вокруг костра негде ставить ограду';
  return gaps ? `Ограда поставлена, пролётов не хватает: ${gaps} (мешают деревья или здания)` : null;
}

// ================= Сохранение =================

// Список для save.js: [клетка, тип, ур., hp, bt, up, режим, материал]
function defSave() {
  const out = [];
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (!o || o.t !== 'fort') continue;
    out.push([i, o.f, o.lv, o.hp, o.bt === undefined ? -1 : o.bt, o.up === undefined ? -1 : o.up, o.mode || '', o.m || '']);
  }
  return out;
}
function defLoad(list) {
  DEF.set.clear(); DEF.prog.clear();
  for (const [i, f, lv, hp, bt, up, mode, m] of list || []) {
    if (!FORTS[f] || i < 0 || i >= N_TILES) continue;
    const o = { t: 'fort', f, lv: lv || 1, hp };
    if (bt >= 0) { o.bt = bt; DEF.prog.set(i, bt * FORTS[f].time[0]); }
    else if (FORTS[f].blk) o.blk = 1;
    if (up >= 0) { o.up = up; DEF.prog.set(i, up * FORTS[f].time[1]); }
    if (f === 'gate') { o.mode = mode || 'auto'; o.m = m || 'wood'; o.open = o.mode === 'open' || (o.mode === 'auto' && !fortNight()); }
    World.obj[i] = o;
    DEF.set.add(i);
  }
  PF.regT = -1e9;
}
function defRescan() {
  DEF.set.clear();
  for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'fort') DEF.set.add(i); }
}
