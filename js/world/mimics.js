'use strict';
// Сундуки и мимики. По карте разбросаны сундуки 12 видов; часть из них — мимики, которые косят под сундук.
//  • настоящий сундук открывает герой (подошёл вплотную) — внутри добыча;
//  • мимик 10 видов выглядит почти как сундук, но иногда «палится»: моргает в замочной скважине, высовывает язык,
//    скалит зубы, скрипит крышкой, переступает; восемь явных поз «неумелой маскировки» показываются, когда ему кажется, что никто не смотрит;
//  • если подойти вплотную — бросается, кусает и гонится несколько секунд; герой его добивает, из мимика сыплется золото;
//  • расставляются по карте один раз, состояние (открыт, убит, вид) идёт в сохранение (поле ch).
// Спрайты — пиксель-арт, собираются в коде из палитры и параметров, чтобы не рисовать 40 карт вручную.

const CH_W = 26, CH_H = 24;      // холст спрайта; ступни сундука в (13, 22)

// 12 видов сундуков: цвет дерева, светлый, тёмный, обвязка/отделка, замок, форма крышки, число полос, украшение
const CHEST_STYLES = [
  { n: 'дубовый',      w: '#8a5a2e', l: '#b07a42', d: '#5a3a1c', t: '#3a3a44', k: '#e4b434', lid: 'flat',  bands: 2, deco: null },
  { n: 'ореховый',     w: '#5e3a22', l: '#80563a', d: '#3a2214', t: '#2c2c34', k: '#cfae58', lid: 'round', bands: 2, deco: null },
  { n: 'золочёный',    w: '#6a3a22', l: '#8c5636', d: '#40220f', t: '#e4b434', k: '#fff2a0', lid: 'round', bands: 3, deco: 'gems' },
  { n: 'замшелый',     w: '#6a5a3a', l: '#8a7a50', d: '#42381f', t: '#4a4a3a', k: '#a8944a', lid: 'flat',  bands: 2, deco: 'moss' },
  { n: 'каменный',     w: '#8a8a92', l: '#b0b0b8', d: '#585860', t: '#44444c', k: '#c8c8d0', lid: 'flat',  bands: 1, deco: 'rune' },
  { n: 'пиратский',    w: '#3a2a22', l: '#584034', d: '#1e1410', t: '#a8844a', k: '#f0d878', lid: 'round', bands: 2, deco: 'skull' },
  { n: 'шкатулка',     w: '#a0483a', l: '#c0665a', d: '#6a2a20', t: '#cfae58', k: '#fff2a0', lid: 'round', bands: 1, deco: null, small: true },
  { n: 'кованый',      w: '#5a5e68', l: '#80848e', d: '#363a42', t: '#2a2c32', k: '#a0a4ae', lid: 'flat',  bands: 3, deco: 'rivets' },
  { n: 'ледяной',      w: '#9ab8c8', l: '#c8e0ec', d: '#6a8aa0', t: '#e8f4fa', k: '#ffffff', lid: 'round', bands: 2, deco: 'frost' },
  { n: 'костяной',     w: '#c8b890', l: '#e4d8b4', d: '#8a7a56', t: '#5a4a38', k: '#3a2a1c', lid: 'flat',  bands: 2, deco: 'plates' },
  { n: 'волшебный',    w: '#4c3080', l: '#6c4ca8', d: '#2c1a50', t: '#bea4f6', k: '#fff2a0', lid: 'round', bands: 2, deco: 'star' },
  { n: 'плетёный',     w: '#b89a52', l: '#d8be74', d: '#7a6430', t: '#8a6a32', k: '#5a4020', lid: 'flat',  bands: 1, deco: 'weave' },
];
// какой вид сундука копирует каждый из 10 видов мимиков
const MIMIC_STYLE = [0, 1, 3, 5, 7, 2, 4, 9, 10, 11];
const CHEST_LOOT = [['gold', 3, 7], ['gold', 2, 5], ['magicstone', 1, 3], ['mana', 1, 2], ['iron', 2, 4], ['sword', 1, 1], ['bow', 1, 1], ['gold', 4, 9]];

const chSprCache = new Map();
function chSprite(key, draw) {
  let cv = chSprCache.get(key);
  if (cv) return cv;
  cv = mkCanvas(CH_W, CH_H);
  const c = cv.getContext('2d');
  draw(c);
  chSprCache.set(key, cv);
  return cv;
}
const R_ = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w, h); };

// Тело сундука. lift — на сколько пикселей приподнята крышка (щель), open — крышка откинута (только для мимика в атаке)
function chestBody(c, st, lift = 0) {
  const sm = !!st.small, bx = sm ? 6 : 3, bw = sm ? 14 : 20, bh = sm ? 8 : 10, by = 22 - bh, lh = sm ? 4 : 6;
  // тень под сундуком не рисуем — её рисует вызывающий
  R_(c, bx, by, bw, bh, st.w);
  R_(c, bx, by, bw, 2, st.l); R_(c, bx, by + bh - 2, bw, 2, st.d);
  R_(c, bx, by, 1, bh, st.l); R_(c, bx + bw - 1, by, 1, bh, st.d);
  const ly = by - lh - lift;
  // крышка
  if (st.lid === 'round') {
    R_(c, bx + 1, ly, bw - 2, lh, st.w); R_(c, bx, ly + 2, bw, lh - 2, st.w);
    R_(c, bx + 3, ly - 1, bw - 6, 1, st.w); R_(c, bx + 3, ly, bw - 6, 1, st.l); R_(c, bx + 1, ly + 1, 2, 1, st.l);
    R_(c, bx, ly + lh - 1, bw, 1, st.d);
  } else {
    R_(c, bx, ly, bw, lh, st.w); R_(c, bx, ly, bw, 1, st.l); R_(c, bx, ly + lh - 1, bw, 1, st.d);
    R_(c, bx, ly, 1, lh, st.l); R_(c, bx + bw - 1, ly, 1, lh, st.d);
  }
  // шов крышки (тёмная линия)
  R_(c, bx, by - 1 - lift, bw, 1 + lift, lift ? '#1a1008' : st.d);
  // полосы: вертикальные обвязки
  const xs = st.bands === 1 ? [bx + bw / 2 - 1] : st.bands === 2 ? [bx + 2, bx + bw - 4] : [bx + 2, bx + bw / 2 - 1, bx + bw - 4];
  for (const x of xs) { R_(c, x, ly + 1, 2, lh + bh - 1 - 1 + lift * 0, st.t); R_(c, x, ly + 1, 1, lh + bh - 3, st.l === st.t ? st.d : st.t); }
  if (lift) R_(c, xs[0], by - 1 - lift, 2, 1 + lift, '#1a1008');
  // замок
  const kx = bx + bw / 2 - 1, ky = by - 1;
  R_(c, kx - 1, ky - 1, 4, 5, st.k); R_(c, kx, ky + 1, 2, 2, '#14100c');
  // украшения
  switch (st.deco) {
    case 'gems': R_(c, bx + 3, ly + 2, 2, 2, '#d42c24'); R_(c, bx + bw - 5, ly + 2, 2, 2, '#2c8ad4'); R_(c, kx - 4, by + 4, 2, 2, '#3acd5a'); break;
    case 'moss': for (const [x, y, w] of [[bx + 1, ly, 5], [bx + bw - 7, ly + 1, 4], [bx + 4, by + 5, 3], [bx + bw - 4, by + 6, 3]]) { R_(c, x, y, w, 2, '#4a7a30'); R_(c, x + 1, y, w - 2, 1, '#6a9a44'); } break;
    case 'rune': R_(c, bx + 4, ly + 2, 1, 3, '#3a3a44'); R_(c, bx + 5, ly + 3, 2, 1, '#3a3a44'); R_(c, bx + bw - 6, ly + 2, 1, 3, '#7ab0ff'); R_(c, bx + bw - 7, ly + 3, 3, 1, '#7ab0ff'); break;
    case 'skull': R_(c, bx + 3, by + 3, 4, 4, '#f0ece0'); R_(c, bx + 4, by + 4, 1, 1, '#1e1410'); R_(c, bx + 6, by + 4, 1, 1, '#1e1410'); R_(c, bx + 4, by + 6, 3, 1, '#1e1410'); break;
    case 'rivets': for (let i = 0; i < 4; i++) { R_(c, bx + 2 + i * 5, ly + 2, 1, 1, st.k); R_(c, bx + 2 + i * 5, by + bh - 4, 1, 1, st.k); } break;
    case 'frost': R_(c, bx + 2, ly - 1, 6, 1, '#ffffff'); R_(c, bx + bw - 8, ly, 5, 1, '#ffffff'); R_(c, bx + 4, by + bh - 3, 2, 1, '#ffffff'); break;
    case 'plates': R_(c, bx + 4, by + 2, 4, 5, st.t); R_(c, bx + bw - 8, by + 2, 4, 5, st.t); break;
    case 'star': R_(c, bx + 4, ly + 1, 1, 3, '#fff2a0'); R_(c, bx + 3, ly + 2, 3, 1, '#fff2a0'); R_(c, bx + bw - 6, by + 3, 1, 3, '#fff2a0'); R_(c, bx + bw - 7, by + 4, 3, 1, '#fff2a0'); break;
    case 'weave': for (let y = ly; y < 22; y += 2) for (let x = bx + (y & 2 ? 0 : 1); x < bx + bw; x += 2) R_(c, x, y, 1, 1, st.d); break;
  }
  return { bx, bw, by, bh, ly, lh, kx, ky };
}

function drawChestSprite(c, v, opened) {
  const st = CHEST_STYLES[v], g = chestBody(c, st, 0);
  if (opened) {            // открытый: крышка откинута, внутри тёмно и блестит
    c.clearRect(0, 0, CH_W, CH_H);
    const sm = !!st.small, bx = sm ? 6 : 3, bw = sm ? 14 : 20, bh = sm ? 8 : 10, by = 22 - bh;
    R_(c, bx, 2, bw, 8, st.d); R_(c, bx + 1, 3, bw - 2, 6, st.w); R_(c, bx + 1, 3, bw - 2, 1, st.l); R_(c, bx + 3, 3, 2, 6, st.t); R_(c, bx + bw - 5, 3, 2, 6, st.t);               // откинутая назад крышка
    R_(c, bx, by, bw, bh, st.w); R_(c, bx, by, bw, 2, '#1a1008'); R_(c, bx + 1, by + 2, bw - 2, 1, '#0c0804');
    R_(c, bx, by + bh - 2, bw, 2, st.d); R_(c, bx, by, 1, bh, st.l); R_(c, bx + bw - 1, by, 1, bh, st.d);
    R_(c, bx + 2, by - 1, 3, 1, '#ffd700'); R_(c, bx + 7, by - 2, 3, 1, '#fff2a0'); R_(c, bx + bw - 6, by - 1, 3, 1, '#e4b434');
  }
}

// ---------- Мимик: тонкие недочёты маскировки (10 видов) ----------
function mimicFlaw(c, m, st, g, t) {
  const { bx, bw, by, bh, ly, kx, ky } = g;
  switch (m) {
    case 0: for (let x = bx + 2; x < bx + bw - 2; x += 3) R_(c, x, by, 1, 1, '#f4f0e0'); break;                      // зубы в шве
    case 1: R_(c, bx + bw - 5, by, 1, 4, '#9ad0e8'); R_(c, bx + bw - 5, by + 4, 1, 1, '#d0ecf8'); break;              // слюна
    case 2: R_(c, kx, ky + 1, 2, 2, t.eye ? '#f4e048' : '#3a2a10'); break;                                          // замок — глаз
    case 3: R_(c, bx + 1, by - 1, bw - 2, 1, '#0c0804'); break;                                                       // крышка чуть приоткрыта
    case 4: R_(c, bx + bw - 3, 22, 3, 2, '#5a4030'); R_(c, bx + bw - 1, 23, 1, 1, '#2a1a10'); break;                  // носок ноги из-под днища
    case 5: R_(c, kx, by, 2, t.tongue ? 4 : 1, '#e8909a'); break;                                                    // кончик языка
    case 6: for (let x = bx; x < bx + bw; x++) R_(c, x, by - 1 + ((x >> 1) & 1), 1, 1, '#0c0804'); break;             // шов волнистый
    case 7: R_(c, kx, ky + 1, 2, 2, '#14100c'); R_(c, kx + (t.eye ? 1 : 0), ky + 1, 1, 2, '#f4e048'); break;           // щелевой зрачок
    case 8: R_(c, bx, ly + 1, 2, 2, st.d); R_(c, bx + bw - 2, ly + 2, 2, 1, st.l); break;                             // петли неровные
    case 9: R_(c, bx + 1, by, 1, 2, '#f4f0e0'); R_(c, bx + bw - 2, by, 1, 2, '#f4f0e0'); break;                       // клыки по краям
  }
}

// ---------- 8 неумелых масок («палится») ----------
function mimicSloppy(c, k, st, g, ph) {
  const { bx, bw, by, bh, ly, lh, kx } = g;
  switch (k) {
    case 0:   // глаз выглядывает в щёлку
      R_(c, bx + 3, by - 3, bw - 6, 3, '#0c0804'); R_(c, kx - 2, by - 3, 3, 3, '#f4e048'); R_(c, kx - 1, by - 2, 1, 2, '#14100c'); break;
    case 1:   // язык высунут
      R_(c, kx - 1, by - 1, 3, 2, '#0c0804'); R_(c, kx - 1, by, 3, 5 + (ph & 1), '#e8909a'); R_(c, kx, by + 5, 1, 1, '#c4707a'); break;
    case 2:   // оскал: ряд зубов по шву
      R_(c, bx + 1, by - 2, bw - 2, 2, '#0c0804'); for (let x = bx + 2; x < bx + bw - 2; x += 2) { R_(c, x, by - 2, 1, 2, '#f4f0e0'); R_(c, x + 1, by, 1, 1, '#f4f0e0'); } break;
    case 3:   // ножки торчат из-под днища
      R_(c, bx + 2, 22, 3, 2, '#7a5a40'); R_(c, bx + bw - 5, 22, 3, 2, '#7a5a40'); R_(c, bx + 1, 23, 4, 1, '#3a281c'); R_(c, bx + bw - 6, 23, 4, 1, '#3a281c'); break;
    case 4:   // накрылся листом, глаз виден
      R_(c, bx + 3, ly - 3, 8, 3, '#4a7a30'); R_(c, bx + 5, ly - 4, 4, 1, '#6a9a44'); R_(c, bx + 8, ly - 2, 5, 3, '#3a6a28'); R_(c, kx - 1, by - 2, 3, 2, '#f4e048'); break;
    case 5:   // капли пота
      R_(c, bx + bw - 2, ly - 1, 1, 2, '#9ad0e8'); R_(c, bx - 1, ly + 3, 1, 2, '#9ad0e8'); R_(c, kx - 2, by - 2, 2, 2, '#f4e048'); R_(c, kx + 1, by - 2, 2, 2, '#f4e048'); break;
    case 6:   // слюна лужицей
      R_(c, bx + 4, by, 1, 5, '#9ad0e8'); R_(c, bx + 2, 23, 8, 1, '#9ad0e8'); R_(c, bx + 3, 22, 4, 1, '#bfe4f4'); R_(c, kx - 1, by - 1, 3, 1, '#0c0804'); break;
    case 7:   // подмигивает двумя глазами и клыком
      R_(c, bx + 2, ly + 1, 3, 3, '#f4e048'); R_(c, bx + 3, ly + 2, 1, 1, '#14100c'); R_(c, bx + bw - 5, ly + 1, 3, 3, '#f4e048'); R_(c, bx + bw - 4, ly + 2, 1, 1, '#14100c'); R_(c, kx, by, 1, 2, '#f4f0e0'); break;
  }
}

// ---------- Мимик в атаке (10 видов по цвету) ----------
function drawMimicAttack(c, m, frame) {
  const st = CHEST_STYLES[MIMIC_STYLE[m]], sm = !!st.small, bx = sm ? 6 : 3, bw = sm ? 14 : 20, bh = sm ? 8 : 10, by = 22 - bh - 1;
  const jump = frame ? 1 : 0;
  // ножки
  R_(c, bx + 2, 22 - jump, 3, 2 + jump, '#7a5a40'); R_(c, bx + bw - 5, 22 - (frame ? 0 : 1), 3, 2 + (frame ? 0 : 1), '#7a5a40');
  // нижняя часть
  R_(c, bx, by - jump, bw, bh, st.w); R_(c, bx, by - jump + bh - 2, bw, 2, st.d); R_(c, bx, by - jump, 1, bh, st.l); R_(c, bx + bw - 1, by - jump, 1, bh, st.d);
  // пасть: тёмно-красная, язык, зубы снизу
  R_(c, bx + 1, by - jump - 2, bw - 2, 3, '#5a1018'); R_(c, bx + 1, by - jump - 1, bw - 2, 1, '#8a2028');
  for (let x = bx + 2; x < bx + bw - 2; x += 3) R_(c, x, by - jump - 3, 1, 2, '#f4f0e0');
  R_(c, bx + 6, by - jump - 1 + (frame ? 0 : 1), 5, 2, '#e8909a'); R_(c, bx + 7, by - jump + 1, 3, 2 + frame, '#e8909a');
  // откинутая крышка — вверх и назад
  const lift = frame ? 11 : 8;
  R_(c, bx, by - jump - lift, bw, 5, st.w); R_(c, bx, by - jump - lift, bw, 1, st.l); R_(c, bx, by - jump - lift + 4, bw, 1, st.d);
  R_(c, bx, by - jump - lift + 5, bw, 2, '#5a1018');        // нутро крышки
  for (let x = bx + 2; x < bx + bw - 2; x += 3) { R_(c, x, by - jump - lift + 7, 1, 2, '#f4f0e0'); }    // верхние зубы
  // «жилки» крышки к петле
  R_(c, bx + 1, by - jump - lift + 5, 1, lift - 6, st.d); R_(c, bx + bw - 2, by - jump - lift + 5, 1, lift - 6, st.d);
  // глаза на крышке
  R_(c, bx + 4, by - jump - lift + 1, 3, 2, '#f4e048'); R_(c, bx + bw - 7, by - jump - lift + 1, 3, 2, '#f4e048');
  R_(c, bx + 5, by - jump - lift + 1, 1, 2, '#14100c'); R_(c, bx + bw - 6, by - jump - lift + 1, 1, 2, '#14100c');
  R_(c, bx + 3, by - jump - lift, 4, 1, '#14100c'); R_(c, bx + bw - 7, by - jump - lift, 4, 1, '#14100c');    // злые брови
  // замок-нос
  R_(c, bx + bw / 2 - 1, by - jump + 2, 3, 3, st.k);
}

// Спрайт по ключу: тип, вид, поза/кадр
function chSpr(kind, v, a = 0, b = 0, t = {}) {
  // kind: 'c' сундук (v 0..11, a=0 закрыт/1 открыт), 'm' мимик замаскирован (v 0..9, a=флоу-подсказка t), 's' неумелая поза (v 0..9, a 0..7), 'a' атака (v, a кадр)
  const key = [kind, v, a, b, t.eye ? 1 : 0, t.tongue ? 1 : 0].join('|');
  return chSprite(key, c => {
    if (kind === 'c') drawChestSprite(c, v, !!a);
    else if (kind === 'a') drawMimicAttack(c, v, a);
    else {
      const st = CHEST_STYLES[MIMIC_STYLE[v]], g = chestBody(c, st, t.lid ? 1 : 0);
      mimicFlaw(c, v, st, g, t);
      if (kind === 's') mimicSloppy(c, a, st, g, b);
    }
  });
}

// ---------- Состояние ----------
let lastMimicToast = -99;

function chestAt(i) { return Game.chests && Game.chests[i]; }

function spawnChests() {
  Game.chests = [];
  const n = Math.max(10, Math.round(MAP_W * MAP_H / 1100));
  const used = [];
  for (let k = 0; k < n; k++) {
    let s = null;
    for (let t = 0; t < 40 && !s; t++) {     // полянка: рядом ни дерева, ни камня, но лес неподалёку
      const q = wildSpot(13 + Math.random() * 14, true);
      if (!q) continue;
      let clear = true;
      for (let yy = q[1] - 1; yy <= q[1] + 1 && clear; yy++) for (let xx = q[0] - 1; xx <= q[0] + 1; xx++) if (!inb(xx, yy) || World.obj[idx(xx, yy)] || World.bmap[idx(xx, yy)] || !isWalkable(xx, yy)) { clear = false; break; }
      if (clear) s = q;
    }
    if (!s || used.some(u => Math.hypot(u[0] - s[0], u[1] - s[1]) < 7)) continue;
    used.push(s);
    const mimic = Math.random() < 0.5;
    Game.chests.push(newChest(s[0], s[1], mimic));
  }
}
function newChest(x, y, mimic) {
  const c = { x: x + 0.5, y: y + 0.5, hx: x + 0.5, hy: y + 0.5, mimic, v: (Math.random() * 12) | 0, m: (Math.random() * 10) | 0, sloppy: Math.random() < 0.3, state: mimic ? 'hide' : 'closed', ph: Math.random() * 9, tell: null, tellAt: 8 + Math.random() * 25, face: 1, loot: (Math.random() * CHEST_LOOT.length) | 0 };
  return c;
}

function serializeChests() { return (Game.chests || []).map(c => [Math.floor(c.hx), Math.floor(c.hy), c.mimic ? 1 : 0, c.v, c.m, c.sloppy ? 1 : 0, c.state === 'open' ? 1 : 0, c.loot]); }
function loadChests(a) {
  Game.chests = (a || []).map(([x, y, mimic, v, m, sl, open, loot]) => {
    const c = newChest(x, y, !!mimic); c.v = v; c.m = m; c.sloppy = !!sl; c.loot = loot || 0;
    if (open) c.state = 'open';
    return c;
  });
}

function chestDropLoot(c, big) {
  const [g, a, b] = CHEST_LOOT[c.loot % CHEST_LOOT.length];
  const n = a + ((Math.random() * (b - a + 1)) | 0) + (big ? 2 : 0);
  dropPile(Math.floor(c.x), Math.floor(c.y) + 1, g, n);
  if (big && g !== 'gold') { const gn = 3 + ((Math.random() * 5) | 0); dropPile(Math.floor(c.x), Math.floor(c.y) + 1, 'gold', gn); return `золото ×${gn}, ${GOODS[g].name.toLowerCase()} ×${n}`; }    // мимик всегда копит золото
  return `${GOODS[g].name.toLowerCase()} ×${n}`;
}

// Кто здесь герой
function heroNear(x, y, r) { return Game.units.find(u => u.type === 'hero' && !u.inside && !u.dead && Math.hypot(u.x - x, u.y - y) < r); }

function chestsTick(dt) {
  if (!FAUNA_ON()) return;
  if (!Game.chests) return;
  for (let i = Game.chests.length - 1; i >= 0; i--) {
    const c = Game.chests[i];
    c.ph += dt;
    if (c.state === 'open') continue;
    // настоящий сундук: герой подошёл вплотную — открыл
    if (!c.mimic) {
      const h = heroNear(c.x, c.y, 1.5);
      if (h) {
        c.state = 'open';
        const what = chestDropLoot(c, false);
        floater(c.x, c.y - 1, 'Сундук!', '#ffd700');
        logEvent('gold', `Герой открыл сундук: ${what}`, c.x, c.y);
        toast(`Герой открыл сундук: ${what}`);
        fstat('chest');
      }
      continue;
    }
    mimicStep(c, dt, i);
  }
}

function mimicStep(c, dt, i) {
  const near = nearestPerson(c, 1.15, u => isPerson(u) && u.type !== 'carter');
  if (c.state === 'hide') {
    // «палится»: время от времени короткий недочёт, иногда явная неумелая поза
    c.tellAt -= dt;
    const watchers = nearestPerson(c, 7, u => isPerson(u) && u.type !== 'carter' && u.type !== 'hero');
    if (!c.tell && c.tellAt <= 0) {
      const strong = (c.sloppy ? 0.7 : 0.22) + (watchers ? 0 : 0.2) > Math.random();
      c.tell = { t: 0, len: strong ? 2 + Math.random() * 2 : 0.8 + Math.random() * 0.8, k: (Math.random() * 8) | 0, strong };
      if (strong && Math.random() < 0.5) floater(c.x, c.y - 1.1, 'Скр-р…', '#c8b898');
    }
    if (c.tell) {
      c.tell.t += dt;
      // гном рядом на миг замечает неладное
      if (c.tell.strong && !c.tell.seen && watchers && Math.hypot(watchers.x - c.x, watchers.y - c.y) < 5) {
        c.tell.seen = true; floater(watchers.x, watchers.y - 1.2, '?!', '#fff2c0');
        watchers.gest = 'point'; watchers.gestUntil = Game.time + 1.4; watchers.gestFace = c.x > watchers.x ? 1 : -1;
        if (Math.random() < 0.5) { fstat('mimicSpotted'); logEvent('animal', 'Гном заподозрил, что сундук подозрительно дышит', c.x, c.y); }
      }
      if (c.tell.t > c.tell.len) { c.tell = null; c.tellAt = (c.sloppy ? 6 : 14) + Math.random() * 30; }
    }
    if (near) {
      c.state = 'reveal'; c.t = 0; c.tell = null; c.target = near.id; c.bites = 0; c.biteCD = 0.2; c.face = near.x > c.x ? 1 : -1;
      floater(c.x, c.y - 1.2, 'Гам!', '#ffb0a0');
      if (Game.time - lastMimicToast > 40) { lastMimicToast = Game.time; toast('Сундук оказался мимиком! Он бросился на гнома'); }
      logEvent('animal', `Мимик выскочил из сундука и бросился на: ${UNIT_TYPES[near.type].name.toLowerCase()}`, c.x, c.y);
      fstat('mimic');
    }
    return;
  }
  if (c.state === 'reveal') {
    c.t += dt;
    const t = Game.unitMap.get(c.target);
    const hero = heroNear(c.x, c.y, 2.2);
    if (hero) { c.state = 'dying'; c.t = 0; floater(c.x, c.y - 1.2, 'Хрясь!', '#ffffff'); hero.gest = 'fist'; hero.gestUntil = Game.time + 1.6; hero.gestFace = c.x > hero.x ? 1 : -1; return; }
    if (!t || t.inside || c.t > 9) { c.state = 'return'; return; }
    const d = Math.hypot(t.x - c.x, t.y - c.y);
    if (d > 0.7) {
      const dx = t.x - c.x, dy = t.y - c.y, s = Math.min(d, 2.3 * dt);
      const nx = c.x + dx / d * s, ny = c.y + dy / d * s;
      if (isWalkable(Math.floor(nx), Math.floor(ny)) || !World.bmap[idx(Math.floor(nx), Math.floor(ny))]) { c.x = nx; c.y = ny; c.face = dx > 0 ? 1 : -1; }
      if (Math.hypot(c.x - c.hx, c.y - c.hy) > 5) c.state = 'return';
    } else {
      c.biteCD -= dt;
      if (c.biteCD <= 0) {
        c.biteCD = 1.6; c.bites++;
        t.ouchUntil = Game.time + 2; floater(t.x, t.y - 1.4, 'Ай!', '#ffc8a0');
        if (!t.injury && Math.random() < 0.5) { injure(t, 'leg'); t.injuryUntil = Game.time + 45; }
        scare(t, c);
        if (c.bites >= 3) c.state = 'return';
      }
    }
    return;
  }
  if (c.state === 'return') {
    const dx = c.hx - c.x, dy = c.hy - c.y, d = Math.hypot(dx, dy);
    if (d < 0.15) { c.x = c.hx; c.y = c.hy; c.state = 'hide'; c.tell = null; c.tellAt = 25 + Math.random() * 40; c.sloppy = c.sloppy || Math.random() < 0.3; return; }
    const s = Math.min(d, 1.4 * dt); c.x += dx / d * s; c.y += dy / d * s; c.face = dx > 0 ? 1 : -1;
    return;
  }
  if (c.state === 'dying') {
    c.t += dt;
    if (c.t > 1.4) {
      const what = chestDropLoot(c, true);
      floater(c.x, c.y - 1, 'Золото!', '#ffd700');
      logEvent('gold', `Герой одолел мимика-сундук: ${what}`, c.x, c.y);
      toast(`Герой одолел мимика! Из него высыпалось: ${what}`);
      fstat('mimicKilled');
      Game.chests.splice(i, 1);
    }
  }
}

function drawChest(c, ch) {
  const px = ch.x * TILE, py = ch.y * TILE + 4;
  let spr, dy = 0, dx = 0, alpha = 1;
  if (!ch.mimic) spr = chSpr('c', ch.v, ch.state === 'open' ? 1 : 0);
  else if (ch.state === 'hide') {
    const tl = ch.tell;
    if (tl && tl.strong) spr = chSpr('s', ch.m, tl.k, (Math.floor(ch.ph * 4)) & 1);
    else {
      const on = tl ? Math.sin(tl.t / tl.len * Math.PI) > 0.2 : false;
      spr = chSpr('m', ch.m, 0, 0, { eye: on, tongue: on, lid: tl && tl.k === 1 && on });
      if (!tl && ch.sloppy) spr = chSpr('s', ch.m, [1, 3, 6][ch.m % 3], 0);       // «неумёха»: и без подсказки видно ножку, язык или лужицу
      if (tl && tl.k === 2 && on) dx = Math.sin(tl.t * 30) * 0.7;                  // переступает
      if (!tl) dy = 0; else if (on && tl.k === 3) dy = -1;
    }
  } else if (ch.state === 'dying') { spr = chSpr('a', ch.m, (Math.floor(ch.ph * 12)) & 1); alpha = Math.max(0, 1 - ch.t / 1.4); dx = Math.sin(ch.t * 40) * 0.8; }
  else spr = chSpr('a', ch.m, (Math.floor(ch.ph * 5)) & 1);
  if (ch.state === 'reveal') dy = -Math.abs(Math.sin(ch.ph * 9)) * 2;
  const w = spr.width, h = spr.height;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px, py, 10, 2.4, 0, 0, 7); c.fill();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = alpha;
  c.save(); c.translate(Math.round(px + dx), Math.round(py + dy));
  if (ch.face < 0 && ch.state !== 'hide') c.scale(-1, 1);
  c.drawImage(spr, -13, -22);
  c.restore();
  c.globalAlpha = 1; c.imageSmoothingEnabled = R.smooth;
}

function chestsDrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON() || !Game.chests) return;
  for (const ch of Game.chests) if (ch.x >= x0 - 2 && ch.x <= x1 + 2 && ch.y >= y0 - 2 && ch.y <= y1 + 3) list.push([ch.y + 0.1, () => drawChest(c, ch)]);
}
