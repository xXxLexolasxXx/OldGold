'use strict';
// Пользовательские карты: формат (JSON v1), проверка файла и играбельности, запекание карты в мир,
// хранилище в localStorage, обмен файлом и кодом, правила цели. Интерфейс редактора — в mapeditui.js.
// Работает и на кооп-сервере (без DOM). Дизайн — КАРТЫ_РЕДАКТОР.md.
// Подключается обёртками (serializeGame, applySave, goalNew, goalTick, goalMakeView), чужие файлы почти не тронуты:
// world.js зовёт meGenWorld при MapOpt.custom, main.js setupStart принимает opts.custom, neutrals.js уважает ручные логова.

const ME_VERSION = 1;
const ME_FMT = 'oldgold-map';
const ME_MIN_W = 48, ME_MIN_H = 36, ME_MAX_W = 160, ME_MAX_H = 120;
const ME_MAX_BYTES = 400000;          // файл или код
const ME_MAX_LAIRS = 40, ME_MAX_RULES = 8, ME_MAX_MAPS = 12;
const ME_KEY = 'oldgold.maps';
const ME_START_R = 9;                 // поляна вокруг старта очищается при запуске
const ME_TER = 'gwrcs';               // буквы слоя рельефа: трава, вода, скала, скала с рудой, песок
const ME_OBJ = '.tys';                // пусто, дерево, молодое дерево, камни
const ME_LAIRS = {
  pixie: { name: 'Феи-цветочницы', ico: '🌸', col: '#f08ac8' },
  fairy: { name: 'Лесные феи', ico: '🧚', col: '#8ae0f0' },
  leshy: { name: 'Леший', ico: '🌿', col: '#7ac04a' },
  boar: { name: 'Кабаны', ico: '🐗', col: '#c08a58' },
  spore: { name: 'Чумные грибы', ico: '🍄', col: '#b87ae0' },
};
const ME_SIZES = {
  tiny: { name: 'Крошечная', w: 64, h: 48 },
  small: { name: 'Малая', w: 96, h: 72 },
  medium: { name: 'Средняя', w: 128, h: 96 },
  large: { name: 'Большая', w: 160, h: 120 },
};
const ME_RULE_KINDS = {
  build: 'Построить здание', pop: 'Жителей', nights: 'Пережить ночей', prod: 'Произвести товар', rank: 'Звание', lairs: 'Зачистить логова',
};

// ---------- Сжатие слоёв: «g12w3r» = 12 g, 3 w, 1 r ----------

function meRle(arr, alpha) {
  let s = '', i = 0;
  while (i < arr.length) {
    let j = i; while (j < arr.length && arr[j] === arr[i]) j++;
    s += alpha[arr[i]] + (j - i > 1 ? j - i : '');
    i = j;
  }
  return s;
}
// null — строка повреждена или не даёт ровно n клеток
function meUnrle(str, n, alpha) {
  if (typeof str !== 'string' || str.length > ME_MAX_BYTES) return null;
  const out = new Uint8Array(n);
  let p = 0, k = 0;
  while (k < str.length) {
    const a = alpha.indexOf(str[k++]);
    if (a < 0) return null;
    let cnt = 0, digits = 0;
    while (k < str.length && str.charCodeAt(k) >= 48 && str.charCodeAt(k) <= 57) { cnt = cnt * 10 + str.charCodeAt(k++) - 48; if (++digits > 6) return null; }
    if (!digits) cnt = 1;
    if (cnt < 1 || p + cnt > n) return null;
    out.fill(a, p, p + cnt); p += cnt;
  }
  return p === n ? out : null;
}

// ---------- Модель карты ----------
// В памяти: t — рельеф (0 трава, 1 вода, 2 скала, 3 песок), c — жила руды на скале, o — объекты (0 нет, 1 дерево, 2 молодое, 3 камни).

function meNew(w, h, biome, name) {
  const n = w * h;
  return {
    fmt: ME_FMT, v: ME_VERSION, name: name || 'Новая карта', desc: '', w, h, biome: BIOMES[biome] ? biome : 'meadow', seed: (Math.random() * 1e9) | 0, nm: 'manual',
    t: new Uint8Array(n), c: new Uint8Array(n), o: new Uint8Array(n),
    start: [w >> 1, h >> 1], lairs: [], title: '', rules: [],
  };
}

function meClone(m) {
  return Object.assign({}, m, { t: m.t.slice(), c: m.c.slice(), o: m.o.slice(), start: m.start && m.start.slice(), lairs: m.lairs.map(l => l.slice()), rules: m.rules.map(r => Object.assign({}, r)) });
}

// В файл: слои строками. id и время хранилища в файл не попадают
function meEncode(m) {
  const ter = new Uint8Array(m.w * m.h);
  for (let i = 0; i < ter.length; i++) ter[i] = m.t[i] === 2 && m.c[i] ? 3 : m.t[i] === 3 ? 4 : m.t[i];
  const o = { fmt: ME_FMT, v: ME_VERSION, name: m.name, desc: m.desc || '', w: m.w, h: m.h, biome: m.biome, seed: m.seed, nm: m.nm, ter: meRle(ter, ME_TER), obj: meRle(m.o, ME_OBJ) };
  if (m.start) o.start = m.start.slice();
  o.lairs = m.lairs.map(l => l.slice());
  if (m.rules.length || m.title) o.goal = { title: m.title || '', rules: m.rules.map(r => Object.assign({}, r)) };
  return o;
}

const meHas = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const meInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const meTxt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);

// Разбор чужого или своего файла. Возвращает { map } или { err: 'текст для игрока' }. Всё проверяется: файл не доверенный
function meParse(raw) {
  let o = raw;
  if (typeof raw === 'string') {
    if (raw.length > ME_MAX_BYTES) return { err: 'Файл слишком большой (больше 400 КБ)' };
    try { o = JSON.parse(raw); } catch (e) { return { err: 'Это не карта: файл не читается как JSON' }; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.fmt !== ME_FMT) return { err: 'Это не карта OldGold' };
  if (!meInt(o.v, 1, 1e6)) return { err: 'У карты нет версии формата' };
  if (o.v > ME_VERSION) return { err: `Карта сделана в более новой версии игры (формат ${o.v}) — обновите OldGold` };
  if (!meInt(o.w, ME_MIN_W, ME_MAX_W) || !meInt(o.h, ME_MIN_H, ME_MAX_H)) return { err: `Размер карты должен быть от ${ME_MIN_W}×${ME_MIN_H} до ${ME_MAX_W}×${ME_MAX_H}` };
  const n = o.w * o.h;
  const ter = meUnrle(o.ter, n, ME_TER), obj = meUnrle(o.obj, n, ME_OBJ);
  if (!ter) return { err: 'Слой рельефа повреждён' };
  if (!obj) return { err: 'Слой объектов повреждён' };
  const m = meNew(o.w, o.h, meHas(BIOMES, o.biome) ? o.biome : 'meadow', meTxt(o.name, 40) || 'Без названия');
  m.desc = meTxt(o.desc, 200);
  m.seed = meInt(o.seed, 0, 999999999) ? o.seed : 0;
  m.nm = o.nm === 'auto' ? 'auto' : 'manual';
  for (let i = 0; i < n; i++) {
    const c = ter[i];
    m.t[i] = c === 3 ? 2 : c === 4 ? 3 : c;
    m.c[i] = c === 3 ? 1 : 0;
    m.o[i] = obj[i];
  }
  m.start = Array.isArray(o.start) && meInt(o.start[0], 0, o.w - 1) && meInt(o.start[1], 0, o.h - 1) ? [o.start[0], o.start[1]] : null;
  const seen = new Set();
  if (Array.isArray(o.lairs)) for (const l of o.lairs.slice(0, ME_MAX_LAIRS)) {
    if (!Array.isArray(l) || !meHas(ME_LAIRS, l[0]) || !meInt(l[1], 0, o.w - 1) || !meInt(l[2], 0, o.h - 1)) continue;
    const key = l[1] + ',' + l[2];
    if (seen.has(key)) continue;
    seen.add(key); m.lairs.push([l[0], l[1], l[2]]);
  }
  const g = o.goal;
  if (g && typeof g === 'object') {
    m.title = meTxt(g.title, 40);
    if (Array.isArray(g.rules)) for (const r of g.rules.slice(0, ME_MAX_RULES)) { const c = meRule(r); if (c) m.rules.push(c); }
  }
  return { map: m };
}

// Одно правило цели → чистое правило или null. Здания и товары — только известные игре
function meRule(r) {
  if (!r || typeof r !== 'object') return null;
  if (r.k === 'build') return meHas(BUILDINGS, r.t) ? { k: 'build', t: r.t } : null;
  if (r.k === 'prod') return meHas(GOODS, r.g) && meInt(r.n, 1, 9999) ? { k: 'prod', g: r.g, n: r.n } : null;
  if (r.k === 'pop') return meInt(r.n, 1, 300) ? { k: 'pop', n: r.n } : null;
  if (r.k === 'nights') return meInt(r.n, 1, 100) ? { k: 'nights', n: r.n } : null;
  if (r.k === 'rank') return meInt(r.n, 1, 2) ? { k: 'rank', n: r.n } : null;
  if (r.k === 'lairs') return meInt(r.n, 1, ME_MAX_LAIRS) ? { k: 'lairs', n: r.n } : null;
  return null;
}

// ---------- Запекание: что реально окажется в мире ----------
// Поляна вокруг старта очищается, берега получают песок (как в обычной генерации), объекты живут только на траве.

function meBake(m) {
  const { w, h } = m, n = w * h;
  const ter = m.t.slice(), cry = new Uint8Array(n), ob = m.o.slice();
  const st = m.start ? { x: m.start[0], y: m.start[1] } : { x: w >> 1, y: h >> 1 };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x - st.x) ** 2 + (y - st.y) ** 2 > ME_START_R * ME_START_R) continue;
    const i = y * w + x;
    ter[i] = 0; ob[i] = 0;
  }
  const sand = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (ter[i] !== 0) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && ter[yy * w + xx] === 1) { near = true; break; }
    }
    if (near) sand.push(i);
  }
  for (const i of sand) ter[i] = 3;
  for (let i = 0; i < n; i++) {
    if (ter[i] !== 0) ob[i] = 0;
    if (ter[i] === 2 && m.c[i]) cry[i] = 1;
  }
  return { w, h, ter, cry, ob, st };
}

// ---------- Проверка играбельности ----------

function meValidate(m) {
  const errors = [], warnings = [], info = {};
  const { w, h } = m;
  if (!m.start) { errors.push('Не поставлена стартовая точка поселения'); return { errors, warnings, info }; }
  const sx = m.start[0], sy = m.start[1];
  if (sx < 14 || sy < 12 || sx > w - 15 || sy > h - 13) errors.push('Старт слишком близко к краю карты: вокруг нужна свободная поляна');
  const b = meBake(m), { ter, ob } = b;
  let trees = 0, stones = 0, water = 0, rock = 0, ore = 0;
  for (let i = 0; i < w * h; i++) {
    if (ob[i] === 1 || ob[i] === 2) trees++; else if (ob[i] === 3) stones++;
    if (ter[i] === 1) water++; else if (ter[i] === 2) rock++;
    if (b.cry[i]) ore++;
  }
  Object.assign(info, { trees, stones, water, rock, ore });
  // заливка пешком от старта: деревья, камни, вода и скалы — стены
  const seen = new Uint8Array(w * h), q = [sy * w + sx];
  seen[q[0]] = 1;
  for (let k = 0; k < q.length; k++) {
    const x = q[k] % w, y = (q[k] / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (seen[j] || (ter[j] !== 0 && ter[j] !== 3) || ob[j]) continue;
      seen[j] = 1; q.push(j);
    }
  }
  info.reach = q.length;
  const adj = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && seen[yy * w + xx]) return true;
    }
    return false;
  };
  let rt = 0, rs = 0, rw = 0, ro = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, tt = ter[i], oo = ob[i];
    if (!(oo || tt === 1 || tt === 2) || !adj(x, y)) continue;
    if (oo === 1 || oo === 2) rt++; else if (oo === 3 || tt === 2) rs++; else if (tt === 1) rw++;
    if (b.cry[i]) ro++;
  }
  Object.assign(info, { reachTrees: rt, reachStone: rs, reachWater: rw, reachOre: ro });
  if (q.length < 250) errors.push(`Вокруг старта мало свободной земли (достижимо ${q.length} клеток, нужно хотя бы 250)`);
  if (!rt) errors.push('От старта не достать ни одного дерева — деревне нечем строиться');
  else if (rt < 20) warnings.push(`Мало деревьев рядом со стартом (${rt})`);
  if (!rs) errors.push('От старта не достать камень: нужны скалы или камни у границы свободной земли');
  else if (rs < 12) warnings.push(`Мало камня и скал рядом со стартом (${rs})`);
  if (!rw) errors.push('От старта не добраться до воды — нужна река или озеро для колодцев и рыбы');
  else if (rw < 6) warnings.push(`Мало воды рядом со стартом (${rw})`);
  if (trees < 40) warnings.push(`Всего ${trees} деревьев на карте: лес быстро кончится (деревья ещё сажают лесорубы)`);
  if (!ore) warnings.push('Нет жил руды: шахты построить будет негде');
  if (Math.hypot(sx - (w >> 1), sy - (h >> 1)) > 16) warnings.push('Старт далеко от центра: звери и случайные события тяготеют к центру карты');
  let bad = 0, near = 0;
  for (const [, x, y] of m.lairs) {
    if (ter[y * w + x] !== 0) bad++;
    if (Math.hypot(x - sx, y - sy) < 14) near++;
  }
  if (bad) warnings.push(`Логова не на траве (${bad}) при запуске пропадут`);
  if (near) warnings.push(`Логова слишком близко к старту (${near}): гномы начнут игру в драке`);
  if (m.nm === 'manual' && !m.lairs.length) warnings.push('Нейтралов на карте нет: лес будет мирным (можно включить «Случайные логова»)');
  return { errors, warnings, info };
}

// ---------- Мир из карты ----------

function meSeedHash(x, y) { return ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0); }

// Вместо генерации: рельеф, руда и деревья берутся из карты. Возвращает старт поселения
function meGenWorld(seed) {
  const m = MapOpt.custom, b = meBake(m);
  const rng = mulberry32(seed);
  const nTint = makeNoise(rng, 7);
  World.obj.fill(null);
  World.growing.clear();
  World.road.fill(0); World.bmap.fill(0); World.door.fill(0);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = idx(x, y);
    World.noise[i] = nTint(x, y) * 0.85 + rng() * 0.15;
    World.terrain[i] = b.ter[i];
    World.crystal[i] = b.cry[i];
    const o = b.ob[i];
    if (o === 1) setTree(i, 1);
    else if (o === 2) setTree(i, 0.3 + (meSeedHash(x, y) % 50) / 100);
    else if (o === 3) setStone(i, 3 + (meSeedHash(x, y) % 4));
  }
  return { cx: b.st.x, cy: b.st.y };
}

// Логова из карты (вместо случайных): только на траве, не на постройках
function meSpawnLairs() {
  const m = MapOpt.custom;
  Game.neutrals = []; Game.lairs = [];
  Game.nstat = { kills: {}, lost: 0, lairs: 0, xp: 0 };
  const st = m.start || [MAP_W >> 1, MAP_H >> 1];
  for (const [k, x, y] of m.lairs) {
    const i = idx(x, y);
    if (!inb(x, y) || World.terrain[i] !== T_GRASS || World.bmap[i]) continue;
    neuAddLair(k, { x, y, ds: Math.hypot(x - st[0], y - st[1]) }, 24);
  }
}

// ---------- Хранилище ----------

function meStoreRead() {
  try {
    const a = JSON.parse(localStorage.getItem(ME_KEY));
    return Array.isArray(a) ? a.filter(e => e && typeof e.id === 'string' && e.map) : [];
  } catch (e) { return []; }
}
function meStoreWrite(list) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
// Список: [{ id, ts, map }] с уже разобранными картами; битые записи пропускаются
function meList() {
  const out = [];
  for (const e of meStoreRead()) { const r = meParse(e.map); if (r.map) out.push({ id: e.id, ts: e.ts || 0, map: r.map }); }
  return out.sort((a, b) => b.ts - a.ts);
}
// Сохраняет карту; id — чтобы заменить существующую. Возвращает { id } или { err }
function meSave(map, id) {
  const all = meStoreRead();
  const k = id ? all.findIndex(e => e.id === id) : -1;
  if (k < 0 && all.length >= ME_MAX_MAPS) return { err: `Можно хранить до ${ME_MAX_MAPS} карт — удалите ненужную` };
  const rec = { id: id && k >= 0 ? id : 'm' + Date.now().toString(36) + ((Math.random() * 1e4) | 0).toString(36), ts: Date.now(), map: meEncode(map) };
  if (k >= 0) all[k] = rec; else all.push(rec);
  return meStoreWrite(all) ? { id: rec.id } : { err: 'Браузер не дал сохранить карту (память заполнена?)' };
}
function meDelete(id) { return meStoreWrite(meStoreRead().filter(e => e.id !== id)); }

// ---------- Обмен кодом ----------
// OGM1.<base64url JSON> или OGM2.<base64url deflate-raw JSON> (если браузер умеет сжимать)

const meB64 = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  },
};
async function meStream(bytes, Ctor, fmt) {
  const st = new Blob([bytes]).stream().pipeThrough(new Ctor(fmt));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function meToCode(map) {
  const bytes = new TextEncoder().encode(JSON.stringify(meEncode(map)));
  if (typeof CompressionStream === 'function') { try { return 'OGM2.' + meB64.enc(await meStream(bytes, CompressionStream, 'deflate-raw')); } catch (e) { /* без сжатия */ } }
  return 'OGM1.' + meB64.enc(bytes);
}
// Принимает код, а также сырой JSON карты. Возвращает { map } или { err }
async function meFromCode(text) {
  const s = String(text || '').trim();
  if (!s) return { err: 'Пусто: вставьте код карты' };
  if (s.length > ME_MAX_BYTES * 1.4) return { err: 'Код слишком длинный' };
  if (s[0] === '{') return meParse(s);
  const m = /^OGM([12])\.([A-Za-z0-9_-]+)$/.exec(s);
  if (!m) return { err: 'Это не код карты (должен начинаться с OGM1. или OGM2.)' };
  try {
    let bytes = meB64.dec(m[2]);
    if (m[1] === '2') {
      if (typeof DecompressionStream !== 'function') return { err: 'Этот браузер не умеет распаковывать код — попросите файл карты' };
      bytes = await meStream(bytes, DecompressionStream, 'deflate-raw');
    }
    if (bytes.length > ME_MAX_BYTES) return { err: 'Карта слишком большая' };
    return meParse(new TextDecoder().decode(bytes));
  } catch (e) { return { err: 'Код повреждён: не получилось распаковать' }; }
}

// ---------- Цель карты ----------

function meObjective(r, S) {
  if (r.k === 'lairs') return { t: 'Зачистить логова нейтралов', cur: Math.min(r.n, (Game.nstat && Game.nstat.lairs) || 0), need: r.n };
  return goalObjective(r, S);
}

// ---------- Обёртки ----------

{
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    if (MapOpt.custom) s.cm = meEncode(MapOpt.custom);
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    let cm = null;
    if (s && s.cm) { const r = meParse(s.cm); if (r.map) cm = r.map; else console.error('карта из сохранения не прочиталась:', r.err); }
    MapOpt.custom = cm;
    _as(s);
  };
  const _gn = goalNew;
  goalNew = function (mode) {
    const m = MapOpt.custom, g = m && m.rules.length ? _gn('free') : _gn(m ? 'free' : mode);
    if (m && m.rules.length) { g.custom = { title: m.title || m.name, rules: m.rules.map(r => Object.assign({}, r)) }; Game.goalView = null; }
    return g;
  };
  const _gt = goalTick;
  goalTick = function (dt) {
    _gt(dt);
    if (typeof Coop !== 'undefined' && Coop.mirror) return;
    const g = Game.goal;
    if (!g || !g.custom || g.over) return;
    Game.meT = (Game.meT || 0) + dt;
    if (Game.meT < 1) return;
    Game.meT = 0;
    const S = goalStats();
    if (g.custom.rules.every(r => { const o = meObjective(r, S); return o.cur >= o.need; })) goalFinish('win', 'Цель карты «' + (g.custom.title || 'карта') + '» выполнена.');
  };
  const _mv = goalMakeView;
  goalMakeView = function () {
    const v = _mv(), g = Game.goal;
    if (g && g.custom) {
      const S = goalStats();
      v.custom = true; v.chName = g.custom.title || 'Цель карты'; v.hint = ''; v.objs = g.custom.rules.map(r => meObjective(r, S));
    }
    return v;
  };
}
