'use strict';
// Железо, оружие и гильдии.
// Цепочка: железный рудник → плавильня металла (руда + брёвна → слитки) → оружейная (мечи, луки, кинжалы)
// и мастерская доспехов (железный доспех). Четыре гильдии — воинов, лучников, разбойников и магов:
// в каждую сама приходит глава гильдии. Он учит героя классу (и поднимает ранг мастерства),
// набирает рекрутов из свободных трудяг, тренирует их. Рекрутами можно командовать:
// клик по рекруту — выбрать, клик по земле — встать там, по врагу — атаковать.
// Подключается после hero.js/herolife.js и оборачивает их функции. Модели зданий — здесь же.

const GCLS = {
  warrior: { name: 'Воин', gm: 'gm_warrior', weapon: 'sword', armor: 'ironArmor', bonus: { str: 6, end: 6 }, stat: 'str', range: 1.5, col: '#e0704a', verb: 'Удар мечом' },
  archer:  { name: 'Лучник', gm: 'gm_archer', weapon: 'bow', armor: 'leatherArmor', bonus: { agi: 7, str: 2 }, stat: 'agi', range: 7, shot: 'arrow', col: '#7ac85a', verb: 'Выстрел' },
  rogue:   { name: 'Разбойник', gm: 'gm_rogue', weapon: 'dagger', armor: 'leatherArmor', bonus: { agi: 6, int: 3 }, stat: 'agi', range: 1.4, col: '#a88ad0', verb: 'Удар в спину' },
  mage:    { name: 'Маг', gm: 'gm_mage', weapon: 'staff', armor: 'mageArmor', bonus: { int: 8 }, stat: 'int', range: 6, shot: 'bolt', col: '#7aa0ff', verb: 'Огненный шар' },
};
const GM_NAMES = { warrior: ['Бранд Железнобокий', 'Ульфгар Щит', 'Хродгар Молот'], archer: ['Эльвин Зоркий', 'Тилла Тетива', 'Фенрик Ястреб'],
  rogue: ['Шныр Тихоступ', 'Мэг Ловкие Пальцы', 'Крюк Одноглазый'], mage: ['Альдрик Звездочёт', 'Мирра Пепельная', 'Озрик Седобород'] };
const GM_SAY = {
  warrior: ['Щит выше!', 'Не маши — бей!', 'Железо любит упрямых.', 'Ещё раз, и с душой!'],
  archer: ['Дыши ровно…', 'Ветер слева!', 'Целься в яблочко, а не в меня.', 'Лук — продолжение руки.'],
  rogue: ['Тише, тише…', 'Кошелёк — не цель, а повод.', 'Тень — твой лучший друг.', 'Видел? Вот и никто не видел.'],
  mage: ['Сосредоточься.', 'Мана не любит суеты.', 'Не сожги бороду!', 'Звёзды подскажут.'],
};
const REC_MAX = 4, REC_LVL_MAX = 10, MASTERY_MAX = 5;
const G = { shots: [], t: 0 };

// ================= Снаряжение для героя (herolife.js) =================
if (typeof HL_GEAR !== 'undefined') {
  HL_GEAR.sword = { slot: 'weapon', name: 'Меч' };
  HL_GEAR.bow = { slot: 'weapon', name: 'Лук' };
  HL_GEAR.dagger = { slot: 'weapon', name: 'Кинжал' };
  HL_GEAR.ironArmor = { slot: 'armor', name: 'Железный доспех' };
}
const GEAR_BONUS = {
  sword: { str: 4, atk: 0.18 }, bow: { agi: 4, atk: 0.16 }, dagger: { agi: 3, atk: 0.14 }, staff: { int: 4, atk: 0.16 },
  leatherArmor: { end: 3, def: 0.25 }, ironArmor: { end: 7, def: 0.5 }, mageArmor: { int: 3, end: 2, def: 0.2 },
};
if (typeof UNLOCK_NAMES !== 'undefined') Object.assign(UNLOCK_NAMES, { iron: 'Железо и оружие', guilds: 'Гильдии' });
if (typeof INSIDE_TOOL !== 'undefined') Object.assign(INSIDE_TOOL, { smeltery: 'hammer', weaponsmith: 'hammer' });

// ================= Иконки товаров 16×16 =================
{
  const _dgi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    const P = (a, b, w, h, col) => px(c, x + a, y + b, w, h, col);
    const L = (a, b, a2, b2, col, w) => pline(c, x + a, y + b, x + a2, y + b2, col, w);
    switch (g) {
      case 'ironore':
        P(2, 6, 12, 8, '#5c564f'); P(3, 5, 9, 1, '#867e74'); P(2, 6, 4, 3, '#867e74'); P(11, 7, 3, 7, '#45403a');
        P(5, 8, 2, 2, '#b8582e'); P(9, 10, 2, 1, '#c86a3a'); P(10, 7, 1, 1, '#e08a54'); P(4, 11, 1, 1, '#8a3a22'); P(7, 12, 2, 1, '#a8502a');
        break;
      case 'iron':
        for (let k = 0; k < 3; k++) {
          const yy = 12 - k * 3, xx = 2 + (k % 2);
          P(xx, yy, 11, 3, '#7a808c'); P(xx + 1, yy, 9, 1, '#c8ccd4'); P(xx + 10, yy, 1, 3, '#4a4e58');
        }
        P(9, 3, 4, 2, '#5a606c'); P(9, 3, 3, 1, '#dce0e6');
        break;
      case 'sword':
        L(5, 11, 13, 3, '#8a909c', 2); L(5, 11, 13, 3, '#e4e8ee', 1); P(13, 2, 2, 2, '#f4f6f8');
        L(3, 9, 7, 13, '#c89226', 1); P(4, 9, 1, 1, '#f6d458');
        L(2, 14, 4, 12, '#6e432a', 2); P(1, 14, 2, 2, '#e4b434');
        break;
      case 'bow':
        for (let t = 0; t <= 14; t++) { const xx = Math.round(10 - 6.5 * Math.sin(Math.PI * t / 14)); P(xx, 1 + t, 2, 1, t % 4 ? '#a06840' : '#6e432a'); }
        L(11, 1, 11, 15, '#efe6d0', 1);
        L(2, 8, 13, 8, '#875434', 1); P(13, 7, 2, 3, '#cec6ba'); P(15, 8, 1, 1, '#cec6ba'); P(1, 7, 2, 3, '#e04a3a');
        break;
      case 'dagger':
        L(6, 10, 12, 4, '#8a909c', 2); L(6, 10, 12, 4, '#e4e8ee', 1); P(12, 3, 2, 2, '#ffffff');
        L(4, 8, 8, 12, '#6a6a76', 1); L(3, 13, 5, 11, '#45291a', 2); P(2, 13, 2, 2, '#8a5a30');
        break;
      case 'ironArmor':
        P(3, 3, 10, 11, '#7a808c'); P(1, 3, 3, 5, '#5a606c'); P(12, 3, 3, 5, '#5a606c'); P(1, 3, 3, 1, '#9aa0aa'); P(12, 3, 3, 1, '#9aa0aa');
        P(6, 2, 4, 2, '#2e3038'); P(4, 4, 2, 7, '#b8bec8'); P(4, 7, 8, 1, '#4a4e58'); P(4, 10, 8, 1, '#4a4e58'); P(11, 4, 1, 9, '#4a4e58');
        P(5, 5, 1, 1, '#e4b434'); P(10, 5, 1, 1, '#e4b434'); P(7, 12, 2, 1, '#c89226');
        break;
      default: _dgi(c, g, x, y);
    }
  };
}

// ================= Ноша курьера =================
{
  const _dl = drawLoad;
  drawLoad = function (c, g) {
    const ol = 'rgba(20,10,4,0.75)';
    if (g === 'iron') {
      for (let k = 0; k < 3; k++) { poly(c, [[-5 + k * 0.6, 2.4 - k * 1.8], [4 + k * 0.6, 2.4 - k * 1.8], [3 + k * 0.6, 0.8 - k * 1.8], [-4 + k * 0.6, 0.8 - k * 1.8]], k % 2 ? '#8a909c' : '#a8aeb8', ol, 0.3); }
    } else if (g === 'ironore') {
      _dl(c, 'goldore');
      for (let k = -2; k <= 2; k++) { c.fillStyle = '#c0602e'; c.fillRect(k * 1.6 - 0.3, -1.4, 0.7, 0.6); }
    } else if (g === 'sword' || g === 'dagger') {
      for (const k of [-1.4, 1.4]) { line(c, k - 2, 4, k + 2, -4.6, '#d8dce4', 0.9); line(c, k - 2.6, 1.6, k - 0.4, 2.8, '#c89226', 0.6); }
    } else if (g === 'bow') {
      c.strokeStyle = '#8a5a30'; c.lineWidth = 0.9; c.beginPath(); c.arc(-1, 0, 4.6, -1.2, 1.2); c.stroke();
      line(c, -1 + 4.6 * Math.cos(1.2), -4.3, -1 + 4.6 * Math.cos(1.2), 4.3, '#efe6d0', 0.3);
    } else if (g === 'ironArmor') {
      poly(c, [[-3.6, -3.4], [3.6, -3.4], [3.2, 3], [-3.2, 3]], '#8a909c', ol, 0.35);
      poly(c, [[-5, -3.4], [-3.4, -3.4], [-3.6, 0], [-5.2, -0.6]], '#6a707c'); poly(c, [[5, -3.4], [3.4, -3.4], [3.6, 0], [5.2, -0.6]], '#6a707c');
      c.fillStyle = '#4a4e58'; c.fillRect(-3.4, -0.6, 6.8, 0.5); c.fillRect(-3.2, 1.2, 6.4, 0.5);
    } else _dl(c, g);
  };
}

// ================= Вывески =================
Object.assign(SIGN_OF, { ironmine: 'pick', smeltery: 'iron', weaponsmith: 'sword', guild_warrior: 'swords', guild_archer: 'bow', guild_rogue: 'mask', guild_mage: 'orb' });
{
  const _si = signIcon;
  signIcon = function (c, cx, cy, kind) {
    if (kind === 'sword' || kind === 'swords') {
      const one = s => { line(c, cx - 2.8 * s, cy + 3, cx + 2.6 * s, cy - 3.2, '#dce0e6', 0.9); line(c, cx - 2.6 * s, cy + 0.6, cx - 0.6 * s, cy + 2.6, '#c89226', 0.7); };
      one(1); if (kind === 'swords') one(-1);
    } else if (kind === 'bow') {
      c.strokeStyle = '#7a4a24'; c.lineWidth = 0.9; c.beginPath(); c.arc(cx + 1.6, cy, 3.6, Math.PI * 0.62, Math.PI * 1.38); c.stroke();
      line(c, cx - 0.2, cy - 3.3, cx - 0.2, cy + 3.3, '#efe6d0', 0.3); line(c, cx - 3, cy, cx + 3.4, cy, '#5a3a1e', 0.5);
      poly(c, [[cx + 3.4, cy - 0.9], [cx + 4.6, cy], [cx + 3.4, cy + 0.9]], '#cec6ba');
    } else if (kind === 'mask') {
      c.fillStyle = '#26222c'; c.beginPath(); c.moveTo(cx - 3.4, cy - 1.6); c.quadraticCurveTo(cx, cy - 3.2, cx + 3.4, cy - 1.6); c.lineTo(cx + 2.6, cy + 1.4); c.quadraticCurveTo(cx, cy + 0.4, cx - 2.6, cy + 1.4); c.closePath(); c.fill();
      ellipse(c, cx - 1.4, cy - 0.8, 0.8, 0.5, '#f0e6c0'); ellipse(c, cx + 1.4, cy - 0.8, 0.8, 0.5, '#f0e6c0');
      line(c, cx + 3.2, cy - 1.4, cx + 4.4, cy + 2.6, '#26222c', 0.5);
    } else if (kind === 'orb') {
      ellipse(c, cx, cy - 0.4, 2.8, 2.8, '#5a7ae0'); ellipse(c, cx - 0.9, cy - 1.3, 1, 0.9, '#d8e4ff');
      c.fillStyle = '#c89226'; c.fillRect(cx - 2.2, cy + 2.2, 4.4, 1);
      c.fillStyle = '#f6d458'; c.fillRect(cx + 2.6, cy - 3.4, 0.7, 0.7); c.fillRect(cx - 3.4, cy - 2.4, 0.6, 0.6);
    } else if (kind === 'iron') {
      poly(c, [[cx - 3.2, cy + 1.8], [cx + 3.2, cy + 1.8], [cx + 2.2, cy - 1], [cx - 2.2, cy - 1]], '#9aa0aa', '#3a3e48', 0.4);
      c.fillStyle = '#e4e8ee'; c.fillRect(cx - 1.8, cy - 0.6, 3.2, 0.5);
    } else _si(c, cx, cy, kind);
  };
}

// ================= Реквизит для моделей =================

function trainingDummy(c, x, y) {
  shadowAt(c, x + 1, y + 0.5, 4);
  c.fillStyle = '#4a2c14'; c.fillRect(x - 0.6, y - 16, 1.2, 16);
  line(c, x - 5, y - 12, x + 5, y - 12, '#5a3a1e', 1.1);
  c.fillStyle = lingrad(c, x - 3.4, 0, x + 3.4, 0, [[0, '#e0c878'], [1, '#9a7a38']]);
  c.beginPath(); c.moveTo(x - 3.2, y - 13); c.quadraticCurveTo(x - 4, y - 6, x - 2.4, y - 4); c.lineTo(x + 2.4, y - 4); c.quadraticCurveTo(x + 4, y - 6, x + 3.2, y - 13); c.closePath(); c.fill();
  c.strokeStyle = '#7a5a20'; c.lineWidth = 0.4; for (const k of [-1.4, 0, 1.4]) { c.beginPath(); c.moveTo(x + k, y - 12.6); c.lineTo(x + k * 1.2, y - 4.4); c.stroke(); }
  line(c, x - 3.4, y - 9, x + 3.4, y - 9, '#8a3a22', 0.6);
  ellipse(c, x, y - 15.6, 2.4, 2.2, '#d8bc6a'); ellipse(c, x - 0.6, y - 16.2, 0.8, 0.6, '#f0dc94');
  c.fillStyle = '#3a2414'; c.fillRect(x - 1.2, y - 15.8, 0.6, 0.6); c.fillRect(x + 0.6, y - 15.8, 0.6, 0.6);
}

function archeryTarget(c, x, y) {
  shadowAt(c, x + 2, y + 0.5, 5);
  line(c, x - 3, y, x, y - 14, '#5a3a1e', 0.9); line(c, x + 3, y, x, y - 14, '#5a3a1e', 0.9); line(c, x + 1, y + 0.4, x + 0.6, y - 10, '#3e2410', 0.8);
  const cy = y - 10;
  ellipse(c, x, cy, 6, 6.2, '#c8b878'); ellipse(c, x, cy, 5, 5.2, '#f0ece0'); ellipse(c, x, cy, 3.7, 3.9, '#c83a2a');
  ellipse(c, x, cy, 2.5, 2.6, '#f0ece0'); ellipse(c, x, cy, 1.2, 1.3, '#e4b434');
  for (const [dx, dy] of [[-1.6, -1], [2, 1.4], [0.6, -2.6]]) { line(c, x + dx, cy + dy, x + dx + 3, cy + dy - 1.6, '#6e4428', 0.5); c.fillStyle = '#e04a3a'; c.fillRect(x + dx + 2.6, cy + dy - 2.2, 1, 1); }
}

function weaponRack(c, x, y, kind = 'sword') {
  shadowAt(c, x + 5, y + 0.5, 8);
  for (const k of [0, 12]) { c.fillStyle = '#4a2c14'; c.fillRect(x + k - 0.6, y - 14, 1.2, 14); }
  line(c, x - 1, y - 12, x + 13, y - 12, '#6a4424', 1); line(c, x - 1, y - 3, x + 13, y - 3, '#6a4424', 1);
  for (let k = 0; k < 4; k++) {
    const sx = x + 2 + k * 2.8;
    if (kind === 'bow' && k % 2) { c.strokeStyle = '#8a5a30'; c.lineWidth = 0.7; c.beginPath(); c.arc(sx - 2, y - 8, 6, -0.9, 0.9); c.stroke(); }
    else { line(c, sx, y - 2, sx + 0.4, y - 16, '#d8dce4', 0.8); line(c, sx - 1.2, y - 4.6, sx + 1.4, y - 4.6, '#c89226', 0.6); }
  }
}

function bellows(c, x, y) {
  shadowAt(c, x + 1, y + 0.4, 6);
  poly(c, [[x - 6, y - 2], [x + 4, y - 5], [x + 4, y - 1], [x - 6, y - 1]], '#7a4a24', '#2e1a0a', 0.4);
  poly(c, [[x - 6, y - 2], [x + 4, y - 5], [x + 3, y - 7], [x - 6, y - 3]], '#5a3a1e', '#2e1a0a', 0.4);
  line(c, x + 4, y - 6, x + 9, y - 9, '#6a4424', 0.8); line(c, x - 6, y - 2, x - 9, y - 2.4, '#3a3632', 1);
}

function orePile(c, x, y, col = '#7a6a5a', fleck = '#c0602e') {
  shadowAt(c, x + 1, y + 0.5, 7);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI, r = 5.6 - (k % 3);
    const ex = x + Math.cos(a) * r * 0.9 - 0.5, ey = y - Math.sin(a) * r * 0.6 - 1;
    ellipse(c, ex, ey, 2, 1.5, shade(col, (k % 3 - 1) * 0.15));
    if (k % 2) { c.fillStyle = fleck; c.fillRect(ex - 0.4, ey - 0.6, 0.8, 0.6); }
  }
  ellipse(c, x, y - 4.4, 2.2, 1.6, shade(col, 0.2));
}

function ingotStack(c, x, y) {
  shadowAt(c, x + 2, y + 0.4, 5);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) {
    const bx = x - 4 + k * 3.2 + r * 1.6, by = y - r * 1.6;
    poly(c, [[bx, by], [bx + 3, by], [bx + 2.5, by - 1.6], [bx + 0.5, by - 1.6]], r % 2 ? '#8a909c' : '#a8aeb8', '#3a3e48', 0.3);
  }
}

function grindstone(c, x, y) {
  shadowAt(c, x + 1, y + 0.5, 5);
  line(c, x - 4, y, x - 3, y - 6, '#4a2c14', 1); line(c, x + 4, y, x + 3, y - 6, '#4a2c14', 1);
  ellipse(c, x, y - 7, 1.6, 4.6, '#6a6458'); ellipse(c, x - 0.3, y - 7, 1.1, 4.1, '#9a9286');
  line(c, x + 1, y - 7, x + 5, y - 5, '#5a3a1e', 0.7);
}

function runeRing(c, mm, x, y, r) {
  const pts = [];
  for (let k = 0; k <= 32; k++) { const a = k / 32 * Math.PI * 2; pts.push(mm.at(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
  c.strokeStyle = 'rgba(150,120,255,0.75)'; c.lineWidth = 1.2; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.stroke();
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const q = mm.at(x + Math.cos(a) * r, y + Math.sin(a) * r); ellipse(c, q[0], q[1], 1.2, 0.8, '#d8ccff'); }
}

// ================= Модели зданий =================
DWARF_TYPES.add('smeltery');
REDROOF_TYPES.add('weaponsmith');

Object.assign(MODELS, {
  ironmine(m) {
    m.custom(c => {
      drawMineBody(c, m.g, false);
      const { fx, fy, fw } = m.g;
      // ржавые потёки и жилы на скале — железо, а не золото
      for (const [x, y] of [[fx + 8, fy - 6], [fx + 22, fy - 18], [fx + fw - 18, fy - 10], [fx + fw - 6, fy + 2]]) {
        for (let k = 0; k < 5; k++) ellipse(c, x + rnd(-3, 3), y + rnd(-2, 2), rnd(0.8, 1.6), rnd(0.6, 1.2), ['#a8502a', '#c86a3a', '#7a3a22'][k % 3]);
        line(c, x, y + 2, x + rnd(-1, 1), y + rnd(6, 10), 'rgba(150,70,30,0.55)', 0.8);
      }
      orePile(c, fx + fw + 4, m.g.base + 2);
    }, 0, 60);
  },

  smeltery(m) {
    m.box({
      x0: 4, x1: 60, y0: 12, y1: 56, h: 28, wall: 'stone', col: '#8e867a',
      roof: { type: 'gable', axis: 'X', rise: 18, mat: 'slate', col: '#3e4248', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 17, o: { frame: 'stone' } }, { t: 'win', at: 16, z: 11, w: 6, h: 7, o: { lit: true, stone: true } }], E: [], W: [{ t: 'win', at: 30, z: 11, w: 6, h: 7, o: { stone: true } }] },
    });
    // домница: толстая каменная башня, сверху пышет огнём
    m.tower({ x: 79, y: 34, r: 14, h: 50, taper: 0.78, col: '#6e665c', decor: [] });
    m.custom((c, mm) => {
      const [x, y] = mm.at(79, 34, 50);
      ellipse(c, x, y, 8.4, 3.4, '#3a342e'); ellipse(c, x, y, 6.4, 2.4, '#1a0a04');
      c.fillStyle = radgrad(c, x, y, 0.5, 7, [[0, 'rgba(255,240,160,1)'], [0.5, 'rgba(255,130,30,0.9)'], [1, 'rgba(200,50,10,0)']]);
      c.beginPath(); c.ellipse(x, y, 6, 2.2, 0, 0, Math.PI * 2); c.fill();
      // железные обручи
      for (const z of [14, 30, 44]) { const a = mm.at(68 + z * 0.06, 21, z), b = mm.at(90 - z * 0.06, 21, z); line(c, a[0], a[1], b[0], b[1], '#3a3632', 1.2); }
      (mm.g.spr.chimneys = mm.g.spr.chimneys || []).push([x, y - 2]);
    }, 79, 19.5);
    m.custom((c, mm) => {
      // устье домницы с жидким железом
      const [x, y] = mm.at(79, 20, 0);
      c.fillStyle = '#3a342e'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x - 6, y - 7); c.arc(x, y - 7, 6, Math.PI, 0); c.lineTo(x + 6, y); c.fill();
      c.fillStyle = '#120604'; c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 4, y - 6); c.arc(x, y - 6, 4, Math.PI, 0); c.lineTo(x + 4, y); c.fill();
      c.fillStyle = radgrad(c, x, y - 2, 0.5, 5, [[0, '#fff0a0'], [0.5, '#ff8a20'], [1, 'rgba(160,40,10,0.2)']]); c.fillRect(x - 4, y - 6, 8, 6);
      // жёлоб и форма для слитков
      line(c, x + 3, y, x + 9, y + 3, '#4a4440', 1.6); line(c, x + 3, y - 0.4, x + 9, y + 2.6, '#ff9a30', 0.6);
      c.fillStyle = '#3a3632'; c.fillRect(x + 8, y + 2, 8, 3); c.fillStyle = '#ffb040'; c.fillRect(x + 9, y + 2.6, 6, 1.2);
    }, 79, 18);
    m.g.spr.glow = PL(m, 79, 18, 4);
    m.prop((c, x, y) => bellows(c, x, y), 64, 6);
    m.prop((c, x, y) => orePile(c, x, y), 88, 4);
    m.prop((c, x, y) => logPile(c, x, y, 2, 9), 4, 2);
    m.prop((c, x, y) => ingotStack(c, x, y), 28, 2);
  },

  weaponsmith(m) {
    m.box({
      x0: 4, x1: 60, y0: 14, y1: 56, h: 26, wall: 'plaster', col: '#e6d4b0', frame: true, beam: BEAM,
      roof: { type: 'gable', axis: 'X', rise: 18, mat: 'tiles', col: '#a8432a', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 16, o: { square: true } }, { t: 'win', at: 16, z: 10, w: 7, h: 8, o: { shutter: '#3a3a44', lit: true } }, { t: 'shield', at: 30, z: 20, col: '#5a606c' }], E: [{ t: 'win', at: 28, z: 10, w: 6, h: 7 }], W: [] },
      chimneys: [{ x: 50, y: 40, h: 12, kind: 'stone', w: 5 }],
    });
    m.box({
      x0: 60, x1: 94, y0: 12, y1: 46, h: 22, open: true,
      roof: { type: 'lean', down: 'S', rise: 8, mat: 'shingle', col: '#5a4a3a', ov: 3 },
      inside: (c, mm) => {
        const f = mm.at(84, 34, 0);
        c.fillStyle = '#5a5048'; c.fillRect(f[0] - 6, f[1] - 9, 12, 9);
        c.fillStyle = radgrad(c, f[0], f[1] - 5, 0.5, 6, [[0, 'rgba(255,220,120,1)'], [1, 'rgba(255,80,10,0.2)']]); c.fillRect(f[0] - 4, f[1] - 7, 8, 5);
        const a = mm.at(70, 22); anvil(c, a[0], a[1]);
        const w = mm.at(66, 34); weaponRack(c, w[0], w[1], 'bow');
      },
    });
    m.g.spr.glow = PL(m, 84, 30, 6);
    m.prop((c, x, y) => weaponRack(c, x, y, 'sword'), 6, 4);
    m.prop((c, x, y) => grindstone(c, x, y), 66, 4);
    m.prop((c, x, y) => barrel(c, x, y, 0.85), 92, 6);
    m.prop((c, x, y) => crate(c, x, y, 6, '#6a4a2a'), 26, 2);
  },

  guild_warrior(m) {
    // учебный двор, утоптанный песком
    m.ground((c, mm) => {
      groundPoly(c, mm, [[4, 2], [92, 2], [92, 32], [4, 32]], 'rgba(176,152,104,0.75)');
      for (let k = 0; k < 40; k++) { const q = mm.at(rnd(8, 88), rnd(4, 30)); ellipse(c, q[0], q[1], rnd(1, 3), rnd(0.6, 1.2), srand() < 0.5 ? 'rgba(130,108,70,0.6)' : 'rgba(210,190,140,0.6)'); }
    });
    m.box({
      x0: 4, x1: 66, y0: 34, y1: 86, h: 34, wall: 'stone', col: '#9a907e',
      roof: { type: 'gable', axis: 'X', rise: 24, mat: 'slate', col: '#4a4e58', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, w: 14, h: 20, o: { frame: 'stone', double: true, col: '#5a3a1e' } }, { t: 'win', at: 16, z: 14, w: 6, h: 10, o: { arch: true, stone: true, lit: true } },
          { t: 'shield', at: 30, z: 26, col: '#8c2c20' }, { t: 'shield', at: 62, z: 26, col: '#3a5a8a' }],
        E: [{ t: 'win', at: 50, z: 14, w: 6, h: 10, o: { arch: true, stone: true } }], W: [],
      },
      chimneys: [{ x: 14, y: 70, h: 12, kind: 'stone', w: 6 }],
    });
    // дозорная башня с зубцами
    m.box({
      _g: true, moss: true, x0: 66, x1: 92, y0: 44, y1: 70, h: 64, wall: 'stone', col: '#a49a88', finial: true,
      roof: { type: 'pyramid', rise: 22, mat: 'slate', col: '#4a4e58', ov: 3 },
      decor: { S: [{ t: 'win', at: 79, z: 44, w: 5, h: 10, o: { arch: true, stone: true } }, { t: 'win', at: 79, z: 22, w: 4, h: 8, o: { arch: true, stone: true } }, { t: 'shield', at: 79, z: 58, col: '#8c2c20' }],
        E: [{ t: 'win', at: 13, z: 44, w: 5, h: 10, o: { arch: true, stone: true, lit: true } }] },
    });
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#8c2c20', 36), 30, 30);
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#8c2c20', 36), 64, 32);
    m.prop((c, x, y) => trainingDummy(c, x, y), 18, 16);
    m.prop((c, x, y) => trainingDummy(c, x, y), 34, 10);
    m.prop((c, x, y) => weaponRack(c, x, y, 'sword'), 74, 12);
    m.prop((c, x, y) => { shield(c, x, y - 4, '#8c2c20'); shield(c, x + 7, y - 3, '#3a5a8a'); }, 86, 26);
  },

  guild_archer(m) {
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [94, 2], [94, 30], [2, 30]], 'rgba(96,130,56,0.45)');
      for (let k = 0; k < 30; k++) { const q = mm.at(rnd(6, 90), rnd(4, 28)); line(c, q[0], q[1], q[0] + rnd(-1, 1), q[1] - rnd(1.5, 3), '#5c8236', 0.6); }
    });
    // лесная ложа из брёвен под замшелой дранкой
    m.box({
      x0: 4, x1: 62, y0: 32, y1: 82, h: 26, wall: 'logs', col: '#7a4e2c',
      roof: { type: 'gable', axis: 'X', rise: 22, mat: 'moss', col: '#6a5034', ov: 5 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 16 }, { t: 'win', at: 16, z: 10, w: 7, h: 7, o: { shutter: '#3e6a3a', lit: true } }, { t: 'antlers', at: 34, z: 22 }],
        E: [{ t: 'win', at: 30, z: 10, w: 6, h: 7 }], W: [] },
      chimneys: [{ x: 12, y: 64, h: 10, kind: 'stone', w: 5 }],
    });
    // дозорная вышка на сваях с будкой наверху
    m.box({ _g: true, x0: 68, x1: 90, y0: 48, y1: 70, h: 42, open: true, canopy: true, noShadow: true });
    m.box({
      _g: true, moss: false, x0: 66, x1: 92, y0: 46, y1: 72, z0: 42, h: 14, wall: 'plank', col: '#6e4a2c', beam: '#3a2414', noPlinth: true,
      roof: { type: 'pyramid', rise: 16, mat: 'moss', col: '#6a5034', ov: 3 },
      decor: { S: [{ t: 'hatch', at: 79, z: 3, w: 12, h: 6 }], E: [{ t: 'hatch', at: 13, z: 3, w: 10, h: 6 }] },
    });
    m.prop((c, x, y) => ladder(c, x, y, 42), 70, 46);
    m.prop((c, x, y) => archeryTarget(c, x, y), 20, 8);
    m.prop((c, x, y) => archeryTarget(c, x, y), 42, 4);
    m.prop((c, x, y) => hayBale(c, x, y, 0.8), 88, 12);
    m.prop((c, x, y) => weaponRack(c, x, y, 'bow'), 62, 20);
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#2f6a3a', 32), 8, 28);
  },

  guild_rogue(m) {
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [94, 2], [94, 26], [2, 26]], 'rgba(70,56,44,0.45)');
      for (const [x, y] of [[20, 12], [70, 18]]) { const q = mm.at(x, y); ellipse(c, q[0], q[1], 7, 2.4, 'rgba(40,36,44,0.6)'); ellipse(c, q[0] - 1, q[1] - 0.6, 4, 1, 'rgba(140,160,190,0.4)'); }
    });
    // кособокий тёмный дом с глухими окнами
    m.box({
      _g: true, moss: true, x0: 6, x1: 68, y0: 28, y1: 80, h: 32, wall: 'plank', col: '#4a3a32', beam: '#1e1612',
      roof: { type: 'gable', axis: 'X', rise: 26, mat: 'shingle', col: '#3a3440', ov: 5 },
      decor: {
        S: [{ t: 'door', main: true, w: 9, h: 15, o: { col: '#2a2228' } }, { t: 'win', at: 18, z: 12, w: 5, h: 6, o: { shutter: '#1e1612' } }, { t: 'win', at: 62, z: 20, w: 4, h: 5, o: { lit: true } }, { t: 'lantern', at: 36, z: 20 }],
        E: [{ t: 'win', at: 26, z: 16, w: 4, h: 5 }], W: [],
      },
      dormers: [{ x: 22, w: 11, h: 8 }],
      chimneys: [{ x: 58, y: 56, h: 14, kind: 'stone', w: 4 }],
    });
    // пристройка-погреб с люком
    m.box({
      _g: true, moss: true, x0: 68, x1: 92, y0: 32, y1: 64, h: 16, wall: 'fieldstone', col: '#5e5850', beam: '#1e1612',
      roof: { type: 'lean', down: 'S', rise: 8, mat: 'shingle', col: '#3a3440', ov: 3 },
      decor: { S: [{ t: 'hatch', at: 80, z: 1, w: 10, h: 8 }], E: [] },
    });
    m.prop((c, x, y) => barrel(c, x, y, 0.9), 72, 26);
    m.prop((c, x, y) => barrel(c, x, y, 0.75), 80, 24);
    m.prop((c, x, y) => crate(c, x, y, 7, '#5a4030'), 14, 14);
    m.prop((c, x, y) => sack(c, x, y, '#6a6050'), 24, 10);
    m.prop((c, x, y) => { sack(c, x, y, '#a89060'); c.fillStyle = '#e4b434'; c.fillRect(x - 1, y - 6, 1.2, 1.2); c.fillRect(x + 1.2, y - 5, 1, 1); }, 88, 6);
    m.prop((c, x, y) => dwarfBanner(c, x, y, '#3a2a4a', 30), 4, 26);
  },

  guild_mage(m) {
    m.ground((c, mm) => {
      groundPoly(c, mm, [[2, 2], [94, 2], [94, 28], [2, 28]], 'rgba(120,110,140,0.35)');
      runeRing(c, mm, 24, 14, 10);
    });
    // библиотека под фиолетовым сланцем
    m.box({
      _g: true, moss: true, x0: 4, x1: 40, y0: 34, y1: 80, h: 28, wall: 'stone', col: '#a49c90',
      roof: { type: 'hip', axis: 'Y', rise: 18, mat: 'slate', col: '#3e2e78', ov: 4 },
      decor: { S: [{ t: 'win', at: 14, z: 10, w: 6, h: 10, o: { magic: true, arch: true, stone: true } }, { t: 'win', at: 30, z: 10, w: 6, h: 10, o: { magic: true, arch: true, stone: true } }],
        E: [{ t: 'win', at: 24, z: 10, w: 5, h: 9, o: { magic: true, arch: true, stone: true } }] },
    });
    // звёздная башня
    m.tower({
      x: 62, y: 52, r: 20, h: 86, taper: 0.86, col: '#9a94a8', finial: 'crystal',
      roof: { h: 38, mat: 'slate', col: '#3e2e78', ov: 4 }, gallery: 62,
      decor: [{ t: 'door', a: -24, z: 0, w: 10, h: 16, o: { frame: 'stone', col: '#3e2e78' } },
        { t: 'win', a: 10, z: 30, w: 6, h: 11, o: { magic: true, arch: true, stone: true } }, { t: 'win', a: -14, z: 66, w: 6, h: 10, o: { magic: true, arch: true, stone: true } },
        { t: 'win', a: 60, z: 44, w: 5, h: 9, o: { magic: true, arch: true, stone: true } }],
    });
    m.custom((c, mm) => {
      // звёзды на крыше и вывеска со сферой у дорожки
      for (const [dx, dz] of [[-6, 96], [5, 104], [-2, 112], [8, 92]]) { const [x, y] = mm.at(62 + dx, 40, dz); c.fillStyle = '#f6d458'; c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); c.fillRect(x - 1.6, y - 0.2, 3.2, 0.4); c.fillRect(x - 0.2, y - 1.6, 0.4, 3.2); }
      if (mm.sign) { const [sx, sy] = mm.at(84, 6); SIGN_QUEUE.list.push({ x: sx, y: sy, kind: mm.sign, dir: 1 }); }
    }, 62, 30);
    for (const [x, y, s] of [[8, 8, 1.1], [42, 6, 0.9], [88, 14, 1.2], [92, 30, 0.8]]) m.prop((c, sx, sy) => crystal(c, sx, sy, s), x, y);
    m.prop((c, x, y) => potionShelf(c, x - 6, y), 46, 30);
    m.prop((c, x, y) => cauldron(c, x, y, '#4a6ae0'), 24, 12);
    m.g.spr.glow = PL(m, 24, 12, 6); m.g.spr.glowColor = '120,140,255';
  },
});

// ================= Классы героя =================

{
  const _st = heroStats;
  heroStats = function (h) {
    const s = _st(h);
    const C = h && h.clsKey && GCLS[h.clsKey];
    if (C) { const m = 1 + 0.25 * (h.mastery || 0); for (const k in C.bonus) s[k] += Math.round(C.bonus[k] * m); }
    if (h && h.equip) for (const sl of ['weapon', 'armor']) { const b = GEAR_BONUS[h.equip[sl]]; if (b) for (const k of ['str', 'agi', 'int', 'end']) if (b[k]) s[k] += b[k]; }
    return s;
  };
}

function heroAtk(u) {
  const H = u.hero, s = heroStats(H), C = H.clsKey && GCLS[H.clsKey];
  const w = H.equip && H.equip.weapon, wb = GEAR_BONUS[w];
  let p = 0.28 + (C ? 0.12 + 0.04 * (H.mastery || 0) : 0) + (s[C ? C.stat : 'str'] || 0) / 220;
  if (wb && wb.atk) p += C && C.weapon === w ? wb.atk : wb.atk * 0.5;
  return Math.min(0.95, p);
}
function heroDef(u) { const a = u.hero.equip && GEAR_BONUS[u.hero.equip.armor]; return a ? a.def || 0 : 0; }

function recAtk(u) { const R = u.rec; return Math.min(0.92, 0.3 + 0.06 * R.lvl + (R.armor ? 0.04 : 0)); }
function unitCls(u) { return u.rec ? u.rec.cls : u.type === 'hero' && u.hero && u.hero.clsKey ? u.hero.clsKey : null; }
function unitAtk(u) { return u.type === 'hero' && u.hero ? heroAtk(u) : u.rec ? recAtk(u) : 0.3; }
function unitRange(u) { const k = unitCls(u); return k ? GCLS[k].range : 1.5; }

// ================= Враги =================

const ENT_HIT = new Set(['walk', 'fight', 'smash', 'emerge']);
function foeAlive(f) {
  const o = f.o;
  if (f.kind === 'skel') return (Game.skels || []).includes(o) && (o.state === 'roam' || o.state === 'fight' || o.state === 'rise') && o.k > 0.5;
  if (f.kind === 'ent') return (Game.ents || []).includes(o) && ENT_HIT.has(o.state);
  if (f.kind === 'beast') return !o.dead && Game.animals.includes(o);
  return false;
}
function foesNear(x, y, r) {
  const out = [];
  for (const s of Game.skels || []) { const f = { kind: 'skel', o: s }; if (foeAlive(f) && Math.hypot(s.x - x, s.y - y) < r) out.push(f); }
  for (const e of Game.ents || []) { const f = { kind: 'ent', o: e }; if (foeAlive(f) && Math.hypot(e.x - x, e.y - y) < r) out.push(f); }
  for (const a of Game.animals || []) if ((a.kind === 'wolf' || a.kind === 'fox') && !a.owner && !a.tamedBy && !a.dead && Math.hypot(a.x - x, a.y - y) < r) out.push({ kind: 'beast', o: a });
  out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
  return out;
}
const foeName = f => f.kind === 'skel' ? 'скелета' : f.kind === 'ent' ? entName(f.o).toLowerCase() : f.o.kind === 'wolf' ? 'волка' : 'лису';
const foeToughness = f => f.kind === 'skel' ? 1 : f.kind === 'beast' ? 0.85 : f.o.rock ? 0.35 : 0.45;

function killFoe(f, u) {
  const o = f.o;
  if (f.kind === 'skel') {
    o.state = 'dead'; o.t = 0; o.moving = false; o.resolved = true;
    sfxAt('rattle', o.x * TILE, o.y * TILE, 1.3);
    fxBurst(o.x * TILE, o.y * TILE - 10, 24, ['#e6dfc8', '#c8c0a4', '#8a6a3a'], 80, 50, 1.2, 2.2, 260);
    floater(o.x, o.y - 1.6, 'Клац…', '#e8e8d0');
  } else if (f.kind === 'ent') entFell(o, u);
  else {
    removeAnimal(o);
    dropPile(Math.floor(o.x), Math.floor(o.y), 'hide', o.kind === 'wolf' ? 2 : 1);
    fxBurst(o.x * TILE, o.y * TILE - 6, 10, ['#8a6a4a', '#c8a880'], 50, 40, 0.8, 1.6, 200);
  }
  logEvent('tree', `${unitTitle(u)} одолел ${foeName(f)}`, o.x, o.y);
  if (u.rec) recXp(u, f.kind === 'ent' ? 50 : 30);
}

function unitTitle(u) {
  if (u.type === 'hero' && u.hero) return u.hero.name;
  if (u.rec) return `${UNIT_TYPES[u.type].name} ${u.rec.name || ''}`.trim();
  return UNIT_TYPES[u.type].name;
}

// Удар или выстрел: шанс по силе атакующего и крепости врага
function strike(u, f) {
  if (!foeAlive(f)) return;
  const p = unitAtk(u) * foeToughness(f), o = f.o;
  const cls = unitCls(u);
  const crit = cls === 'rogue' && Math.random() < 0.25;
  if (crit || Math.random() < p) {
    if (crit) floater(o.x, o.y - 1.8, 'Крит!', '#e0b0ff');
    killFoe(f, u);
  } else {
    floater(o.x, o.y - 1.6, 'Мимо!', '#e8e0c0');
    fxBurst(o.x * TILE, o.y * TILE - 12, 5, ['#f6f2ea', '#c8c0a4'], 40, 30, 0.4, 1.2, 200);
    // враг отвечает тому, кто подошёл вплотную
    if (!GCLS[cls] || !GCLS[cls].shot) {
      const def = u.type === 'hero' && u.hero ? heroDef(u) : u.rec && u.rec.armor ? 0.3 : 0;
      if (Math.random() < 0.3 * (1 - def)) {
        if (u.type === 'hero' && typeof hlHurt === 'function' && hlOn()) hlHurt(u, 6, 'hit');
        else injure(u, Math.random() < 0.5 ? 'arm' : 'leg');
        floater(u.x, u.y - 1.6, 'Ай!', '#ff9a80');
      }
    }
  }
}

function* fightGen(u, f) {
  const cls = unitCls(u), C = cls && GCLS[cls], range = unitRange(u);
  for (let round = 0; round < 8 && foeAlive(f); round++) {
    const o = f.o, d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d > range + 0.3) {
      // подойти: лучник и маг — на дистанцию выстрела, остальные — вплотную
      const keep = C && C.shot ? range * 0.7 : 0.9;
      let tx = Math.floor(o.x + (u.x - o.x) / d * keep), ty = Math.floor(o.y + (u.y - o.y) / d * keep);
      if (!isWalkable(tx, ty)) { const s = randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)); if (!s) return; [tx, ty] = s; }
      const ok = yield { walk: [tx, ty], offroad: true };
      if (!ok) return;
      continue;
    }
    u.face = o.x > u.x ? 1 : -1; u.vdir = 'E';
    yield { wait: 0.8, anim: C && C.shot ? 'build' : 'chop' };
    if (!foeAlive(f)) break;
    if (C && C.shot) {
      const sh = { kind: C.shot, x: u.x, y: u.y - 0.7, f, u, t: 0, dur: Math.max(0.25, d / (C.shot === 'arrow' ? 14 : 8)) };
      G.shots.push(sh);
      sfxAt(C.shot === 'arrow' ? 'thud' : 'chime', u.x * TILE, u.y * TILE, 0.6);
      yield { wait: sh.dur + 0.15 };
    } else strike(u, f);
    yield { wait: 0.35 };
  }
}

// ================= Гильдии и их главы =================

const guildOf = u => u.rec ? Game.buildings.find(b => b.id === u.rec.guild && !b.removed) || null : null;
function masterOf(b) { return Game.units.find(u => u.gm === b.id && !u.dead) || null; }
function recruitsOf(b) { return Game.units.filter(u => u.rec && u.rec.guild === b.id && !u.dead); }
const isGuild = b => b && !b.isRoad && b.def && b.def.guild && b.state === 'done' && !b.removed;

function spawnMaster(b) {
  const cls = b.def.guild, C = GCLS[cls];
  const u = spawnUnit(C.gm, b.doorX, b.doorY);
  u.gm = b.id; u.smoker = false;
  u.look = 32 + ((Math.random() * 30) | 0) * 64;           // длинная борода: (look >> 5) % 2 === 1
  const names = GM_NAMES[cls];
  u.gmName = names[(Math.random() * names.length) | 0];
  toast(`В ${b.def.name.toLowerCase()} пришёл глава: ${u.gmName}`, b);
  logEvent('people', `${UNIT_TYPES[C.gm].name} ${u.gmName} возглавил ${b.def.name.toLowerCase()}`, b.doorX + 0.5, b.doorY);
  floater(u.x, u.y - 1.6, 'Ученики есть?', '#f6d458');
  return u;
}

function guildYardSpot(b) {
  return randomFreeNear(b.doorX, b.doorY, 1, 3, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)] && !World.bmap[idx(x, y)]);
}

function* masterGen(u) {
  const b = Game.buildings.find(x => x.id === u.gm && !x.removed);
  u.idleFlag = false;
  if (!b) { u.gm = null; yield { wait: 1 }; return; }
  const m = u.meet;
  if (m && !m.dead && (m.meetB === b)) {
    if (Math.hypot(m.x - u.x, m.y - u.y) > 1.8) {
      const s = randomFreeNear(Math.floor(m.x), Math.floor(m.y), 1, 1, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
      if (s) yield { walk: s, offroad: true };
    }
    u.face = m.x > u.x ? 1 : -1; u.vdir = 'E';
    u.gest = 'point'; u.gestUntil = Game.time + 1; u.gestFace = u.face;
    if (Math.random() < 0.3) { const L = GM_SAY[b.def.guild]; floater(u.x, u.y - 1.7, L[(Math.random() * L.length) | 0], '#f6e8b0'); }
    yield { wait: 1 };
    return;
  }
  u.meet = null;
  const s = guildYardSpot(b);
  if (s) yield { walk: s, offroad: true };
  const r = Math.random();
  if (r < 0.25) { u.gest = 'fist'; u.gestUntil = Game.time + 1.4; u.gestFace = u.face; }
  else if (r < 0.4) { u.gest = 'wave'; u.gestUntil = Game.time + 1.4; u.gestFace = u.face; }
  yield { wait: 2.5 + Math.random() * 3 };
}

// Оплата: сначала из казны гильдии, потом со склада
function payGold(b, n) {
  let have = b.stock.gold;
  for (const s of Game.buildings) if (s.isStore()) have += s.offer('gold');
  if (have < n) return false;
  const a = Math.min(n, b.stock.gold); b.stock.gold -= a; n -= a;
  for (const s of Game.buildings) { if (!n) break; if (!s.isStore()) continue; const t = Math.min(n, s.offer('gold')); s.stock.gold -= t; n -= t; }
  return true;
}

// ---------- Герой учится у главы гильдии ----------

function heroGuildPrice(H, cls) { return H.clsKey === cls ? 2 + (H.mastery || 0) : 3; }

function* heroGuildGen(u, c) {
  const b = c.b, H = u.hero, cls = b.def.guild, C = GCLS[cls];
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  const gm = masterOf(b);
  if (!gm) { floater(u.x, u.y - 1.6, 'Главы гильдии нет', '#e8a070'); return; }
  if (H.clsKey === cls && (H.mastery || 0) >= MASTERY_MAX) { floater(gm.x, gm.y - 1.7, 'Мне больше нечему тебя учить!', '#f6e8b0'); return; }
  if (H.clsKey === cls && H.level < ((H.mastery || 0) + 1) * 2) { floater(gm.x, gm.y - 1.7, `Подрасти до ${((H.mastery || 0) + 1) * 2} уровня`, '#f6e8b0'); return; }
  const price = heroGuildPrice(H, cls);
  if (!payGold(b, price)) { floater(gm.x, gm.y - 1.7, `Урок стоит ${price} золота`, '#f6e8b0'); toast(`${b.def.name}: нужно ${price} золота`, b); return; }
  u.meetB = b; gm.meet = u; gm.proc = null; gm.action = null;
  for (let k = 0; k < 8 && Math.hypot(gm.x - u.x, gm.y - u.y) > 2.2; k++) yield { wait: 0.5 };
  b.working = true;
  floater(gm.x, gm.y - 1.8, H.clsKey === cls ? 'Продолжим урок.' : `Стань ${C.name.toLowerCase()}ом!`, '#f6e8b0');
  const anims = C.shot ? ['build', 'duck', 'build'] : ['chop', 'duck', 'chop'];
  for (let k = 0; k < 7; k++) {
    u.face = gm.x > u.x ? 1 : -1; u.vdir = 'E';
    yield { wait: 0.9, anim: anims[k % 3] };
    if (b.removed) break;
  }
  b.working = false; gm.meet = null; u.meetB = null;
  if (b.removed) return;
  if (H.clsKey !== cls) {
    const was = H.clsKey && GCLS[H.clsKey];
    H.clsKey = cls; H.cls = C.name; H.mastery = 0;
    toast(`${H.name} теперь ${C.name.toLowerCase()}${was ? ` (был ${was.name.toLowerCase()})` : ''}! Атака — клавиша Q или клик по врагу`);
    logEvent('people', `${H.name} обучился в гильдии: ${C.name}`, u.x, u.y);
    floater(u.x, u.y - 1.9, C.name + '!', '#ffe070');
  } else {
    H.mastery = (H.mastery || 0) + 1;
    toast(`${H.name}: мастерство «${C.name}» — ранг ${H.mastery}`);
    floater(u.x, u.y - 1.9, `Ранг ${H.mastery}!`, '#ffe070');
  }
  if (H.maxhp && typeof hlMaxHp === 'function') H.maxhp = hlMaxHp(H);
  fxBurst(u.x * TILE, u.y * TILE - 12, 18, ['#ffe070', '#fff6c0', C.col], 70, 60, 1, 1.8, 120);
  sfxAt('chime', u.x * TILE, u.y * TILE);
  // подарок главы: оружие класса из запасов гильдии
  if (H.equip && !H.equip.weapon && b.stock[C.weapon] > 0 && typeof hlAddItem === 'function' && Array.isArray(H.inv) && hlAddItem(H, C.weapon, 1)) {
    b.stock[C.weapon]--;
    floater(gm.x, gm.y - 1.6, 'Держи — пригодится!', '#f6e8b0');
    toast(`${gm.gmName || 'Глава'} подарил герою: ${HL_GEAR[C.weapon].name.toLowerCase()}. Наденьте из рюкзака`);
  }
  u._spr = null;
}

// Своё оружие и доспех мастер класса надевает с первого раза
function* quickEquipGen(u, c) {
  const H = u.hero, s = H.inv[c.slot];
  if (!s) return;
  const g = HL_GEAR[s.k];
  u.vdir = 'S';
  yield { wait: 0.7, anim: 'duck' };
  const old = H.equip[g.slot];
  s.n--; if (s.n <= 0) H.inv[c.slot] = null;
  H.equip[g.slot] = s.k;
  if (old) hlAddItem(H, old, 1);
  fxBurst(u.x * TILE, u.y * TILE - 10, 14, ['#ffe070', '#fff6c0', '#ffd040'], 70, 60, 0.9, 1.8, 120);
  sfxAt('chime', u.x * TILE, u.y * TILE);
  floater(u.x, u.y - 1.7, 'Как родное!', '#ffe070');
}

// ---------- Рекруты ----------

const REC_NAMES = ['Борк', 'Гунн', 'Тильда', 'Фрам', 'Хьяль', 'Скегг', 'Ода', 'Варди', 'Кнут', 'Рагна', 'Эйнар', 'Бруни', 'Сигрид', 'Тор', 'Ульф', 'Ингрид'];

function freeSerf(b) {
  let best = null, bd = 1e9;
  for (const u of Game.units) {
    if (u.type !== 'serf' || u.dead || u.carry || u.dlv || u.brk || u.teamOf || u.inside) continue;
    const d = Math.abs(u.x - b.doorX) + Math.abs(u.y - b.doorY) + (u.idleFlag ? 0 : 40);   // сначала бездельники
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function hireCheck(b) {
  const C = GCLS[b.def.guild];
  if (!masterOf(b)) return 'Главы гильдии ещё нет';
  const q = b.hireQ || 0;
  if (recruitsOf(b).length + q >= REC_MAX) return `Не больше ${REC_MAX} рекрутов на гильдию`;
  if (Game.units.filter(u => u.type === 'serf' && !u.dead).length - q <= 4) return 'Трудяг и так мало (нужно больше 4)';
  if (b.stock[C.weapon] < 1 + q) return `Нужно оружие: ${GOODS[C.weapon].name.toLowerCase()} в гильдии`;
  if (b.stock.gold < 1 + q) return 'Нужно 1 золото в казне гильдии';
  if (b.def.guild === 'mage' && b.stock.mana < 1 + q) return 'Нужна банка маны';
  return null;
}

// Набор: гильдия ставит заявку и забирает первого трудягу, который освободится
function hireRecruit(b) {
  const bad = hireCheck(b);
  if (bad) { toast(`${b.def.name}: ${bad}`, b); return; }
  b.hireQ = (b.hireQ || 0) + 1;
  if (!tryHire(b)) toast(`${b.def.name}: ждём, пока освободится трудяга`, b);
}

function tryHire(b) {
  const cls = b.def.guild, C = GCLS[cls], u = freeSerf(b);
  if (!u) return false;
  b.hireQ = Math.max(0, (b.hireQ || 0) - 1);
  if (b.stock[C.weapon] < 1 || b.stock.gold < 1 || (cls === 'mage' && b.stock.mana < 1)) { toast(`${b.def.name}: заявка снята — не хватает снаряжения`, b); return true; }
  b.stock[C.weapon]--; b.stock.gold--;
  if (cls === 'mage') b.stock.mana--;
  const armor = b.stock[C.armor] > 0;
  if (armor) b.stock[C.armor]--;
  u.proc = null; u.action = null; u.anim = null; u.releaseOcc();
  u.type = cls; u.smoker = false; u.idleFlag = false; u._spr = null;
  u.rec = { cls, lvl: 1, xp: 0, guild: b.id, order: 'guard', train: 12, armor, name: REC_NAMES[(Math.random() * REC_NAMES.length) | 0] };
  floater(u.x, u.y - 1.6, 'В гильдию? Я мигом!', '#f6d458');
  logEvent('people', `Трудяга записался в ${b.def.name.toLowerCase()}`, b.doorX + 0.5, b.doorY);
  toast(`${b.def.name}: новобранец ${u.rec.name} идёт на обучение`, b);
  return true;
}

function dismissRecruit(u) {
  const b = guildOf(u), C = GCLS[u.rec.cls];
  if (b) { b.stock[C.weapon] = (b.stock[C.weapon] || 0) + 1; if (u.rec.armor) b.stock[C.armor] = (b.stock[C.armor] || 0) + 1; }
  heroStopUnit(u);
  floater(u.x, u.y - 1.6, 'Ну и ладно, потаскаю мешки', '#e8e0c0');
  u.type = 'serf'; u.rec = null; u._spr = null; u.smoker = Math.random() < 0.7;
  if (Game.selUnit === u) Game.selUnit = null;
}

function recXp(u, n) {
  const R = u.rec;
  if (R.lvl >= REC_LVL_MAX) return;
  R.xp += n;
  while (R.lvl < REC_LVL_MAX && R.xp >= 60 * R.lvl) {
    R.xp -= 60 * R.lvl; R.lvl++;
    floater(u.x, u.y - 1.9, `Уровень ${R.lvl}!`, '#ffe070');
    fxBurst(u.x * TILE, u.y * TILE - 12, 12, ['#ffe070', GCLS[R.cls].col], 60, 50, 0.9, 1.6, 120);
    logEvent('people', `${unitTitle(u)} достиг уровня ${R.lvl}`, u.x, u.y);
  }
}

function recAnchor(u) {
  const R = u.rec, h = Game.hero;
  if (R.order === 'follow' && h && !h.dead) return [h.x, h.y, 6];
  if (R.order === 'hold' && R.pt) return [R.pt[0] + 0.5, R.pt[1] + 0.5, 5];
  const b = guildOf(u);
  return b ? [b.doorX + 0.5, b.doorY + 0.5, 7] : [u.x, u.y, 5];
}

function setOrder(u, order, pt) {
  const R = u.rec;
  if (!R) return;
  if (order === 'drill') {
    const b = guildOf(u);
    if (!b) { toast('Гильдии больше нет'); return; }
    if (!payGold(b, 1)) { toast('Тренировка стоит 1 золото'); return; }
    R.back = R.order === 'drill' ? 'guard' : R.order;
  }
  R.order = order; R.pt = pt || null; R.target = null;
  if (!u.brk) { heroStopUnit(u); }
}

function* recruitGen(u) {
  const R = u.rec, b = guildOf(u);
  u.idleFlag = false;
  // первичное обучение в гильдии
  if (R.train > 0) {
    if (!b) { R.train = 0; return; }
    const ok = yield { walk: [b.doorX, b.doorY] };
    if (!ok) { yield { wait: 2 }; return; }
    yield { enter: b };
    b.working = true;
    yield { wait: R.train };
    b.working = false;
    R.train = 0;
    yield { leave: true };
    floater(u.x, u.y - 1.7, `${GCLS[R.cls].name} к бою готов!`, '#ffe070');
    toast(`${unitTitle(u)} закончил обучение`, b);
    return;
  }
  // приказ «атаковать»
  if (R.target) { const f = R.target; R.target = null; if (foeAlive(f)) { yield* fightGen(u, f); return; } }
  // враги рядом с точкой, которую охраняет
  const [ax, ay, rr] = recAnchor(u);
  const f = foesNear(ax, ay, rr)[0];
  if (f && Math.hypot(f.o.x - u.x, f.o.y - u.y) < rr + 3) { floater(u.x, u.y - 1.6, ['За гильдию!', 'Ко мне, тварь!', 'Вижу цель!'][(Math.random() * 3) | 0], GCLS[R.cls].col); yield* fightGen(u, f); return; }
  if (R.order === 'drill' && b) {
    const ok = yield { walk: [b.doorX, b.doorY] };
    if (!ok) { R.order = R.back || 'guard'; return; }
    const s = guildYardSpot(b);
    if (s) yield { walk: s, offroad: true };
    const gm = masterOf(b);
    if (gm) { u.meetB = b; gm.meet = u; }
    b.working = true;
    for (let k = 0; k < 8; k++) { yield { wait: 0.9, anim: GCLS[R.cls].shot ? 'build' : k % 3 === 2 ? 'duck' : 'chop' }; }
    b.working = false;
    if (gm && gm.meet === u) gm.meet = null;
    u.meetB = null;
    recXp(u, 25);
    floater(u.x, u.y - 1.7, '+25 опыта', '#ffe8a0');
    R.order = R.back || 'guard';
    return;
  }
  if (R.order === 'follow') {
    const h = Game.hero;
    if (!h || h.dead) { R.order = 'guard'; return; }
    if (Math.hypot(u.x - h.x, u.y - h.y) > 2.6) {
      const s = randomFreeNear(Math.floor(h.x), Math.floor(h.y), 1, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
      if (s) yield { walk: s, offroad: true };
    }
    yield { wait: 0.6 };
    return;
  }
  if (R.order === 'hold' && R.pt) {
    if (Math.hypot(u.x - R.pt[0] - 0.5, u.y - R.pt[1] - 0.5) > 0.8) { const ok = yield { walk: R.pt, offroad: true }; if (!ok) R.order = 'guard'; }
    yield { wait: 1 };
    return;
  }
  // охрана гильдии: прохаживается по двору
  if (b) {
    if (Math.hypot(u.x - b.doorX, u.y - b.doorY) > 4 || Math.random() < 0.3) { const s = guildYardSpot(b); if (s) yield { walk: s, offroad: true }; }
    if (Math.random() < 0.3) yield { wait: 1.8, anim: GCLS[R.cls].shot ? 'build' : 'chop' };
  }
  yield { wait: 2 + Math.random() * 2 };
}

// ================= Тик =================

function guildsTick(dt) {
  // снаряды
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    s.t += dt;
    if (s.t >= s.dur) { G.shots.splice(i, 1); strike(s.u, s.f); if (s.kind === 'bolt' && s.f.o) fxBurst(s.f.o.x * TILE, s.f.o.y * TILE - 12, 14, ['#ffb040', '#ff6020', '#fff0a0'], 70, 50, 0.7, 1.8, 120); }
  }
  G.t += dt;
  if (G.t < 1) return;
  G.t = 0;
  for (const b of Game.buildings) {
    if (!isGuild(b)) continue;
    if (b.hireQ > 0 && masterOf(b)) tryHire(b);
    if (!masterOf(b) && (b.gmT || 0) <= Game.time) {
      if (b.gmT === undefined) b.gmT = Game.time + 4;       // глава приходит через пару секунд после стройки
      else { spawnMaster(b); b.gmT = Game.time + 60; }
    }
  }
  // осиротевшие рекруты: гильдию снесли — охраняют место, где стоят
  for (const u of Game.units) if (u.rec && !guildOf(u) && u.rec.order === 'guard') { u.rec.order = 'hold'; u.rec.pt = [Math.floor(u.x), Math.floor(u.y)]; }
}

// ================= Интерфейс =================

function guildHTML(b) {
  const cls = b.def.guild, C = GCLS[cls], gm = masterOf(b), h = Game.hero, H = h && h.hero;
  let x = `<div class="isec">Глава гильдии</div>`;
  x += gm ? `<div class="irow"><img class="portrait" src="${portraitURL(C.gm, gm.look)}" alt=""><div><div><b>${gm.gmName || UNIT_TYPES[C.gm].name}</b></div><div class="small muted">${UNIT_TYPES[C.gm].name} · учит героя и рекрутов</div></div></div>`
    : `<div class="irow muted">Глава гильдии скоро придёт…</div>`;
  if (H) {
    x += '<div class="isec">Герой</div>';
    const mine = H.clsKey === cls, price = heroGuildPrice(H, cls);
    const st = mine ? `${C.name}, ранг мастерства ${H.mastery || 0} из ${MASTERY_MAX}` : H.clsKey ? `сейчас ${GCLS[H.clsKey].name.toLowerCase()}` : 'без класса';
    x += `<div class="irow small">${H.name}: ${st}</div>`;
    if (!(mine && (H.mastery || 0) >= MASTERY_MAX))
      x += `<button class="g-wide" data-gd="hero:${b.id}" ${gm ? '' : 'disabled'}><b>${mine ? `Урок мастерства — ${price} золота` : `${H.clsKey ? 'Переучиться' : 'Обучиться'}: ${C.name.toLowerCase()} — ${price} золота`}</b><small>${mine ? `нужен ${((H.mastery || 0) + 1) * 2} уровень героя` : `+${Object.entries(C.bonus).map(([k, v]) => ({ str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' })[k] + ' ' + v).join(', ')}; ${C.verb.toLowerCase()} (Q)`}</small></button>`;
  }
  const rs = recruitsOf(b), bad = hireCheck(b);
  x += `<div class="isec">Рекруты · ${rs.length}/${REC_MAX}</div>`;
  for (const u of rs) {
    const R = u.rec, need = 60 * R.lvl;
    const ord = R.train > 0 ? 'учится' : { guard: 'охраняет гильдию', follow: 'идёт за героем', hold: 'стоит на посту', drill: 'тренируется' }[R.order] || '';
    x += `<div class="irow g-rec" data-gd="sel:${u.id}"><img class="portrait" src="${portraitURL(u.type, u.look)}" alt=""><div style="flex:1"><div>${R.name || ''} · ур. ${R.lvl}${R.armor ? ' · в доспехе' : ''}</div><div class="g-xp"><i style="width:${R.lvl >= REC_LVL_MAX ? 100 : Math.round(R.xp / need * 100)}%"></i></div><div class="small muted">${ord}</div></div><button data-gd="drill:${u.id}" title="Тренировка с главой: 1 золото, +25 опыта">⚔</button></div>`;
  }
  if (b.hireQ > 0) x += `<div class="irow small warn">Ждут свободного трудягу: ${b.hireQ}</div>`;
  x += `<button class="g-wide" data-gd="hire:${b.id}" ${bad ? 'disabled' : ''}><b>Набрать рекрута</b><small>${bad || `трудяга + ${GOODS[C.weapon].name.toLowerCase()} + 1 золото${cls === 'mage' ? ' + мана' : ''}; ${GOODS[C.armor].name.toLowerCase()} — если есть`}</small></button>`;
  x += '<div class="tip small">Клик по рекруту на карте — выбрать и командовать. Оружие и доспехи везут сюда трудяги из оружейной и мастерской доспехов.</div>';
  return x;
}

function recCardHTML(u) {
  const R = u.rec, C = GCLS[R.cls], need = 60 * R.lvl;
  const btn = (k, t, on) => `<button class="hp-ab${on ? ' on' : ''}" data-rc="${k}">${t}</button>`;
  return `<div class="ihead"><img class="bpic" src="${portraitURL(u.type, u.look)}" alt=""><div><h3 style="color:${C.col}">${R.name || C.name}</h3><span class="muted small">${C.name} · уровень ${R.lvl}${R.armor ? ' · в доспехе' : ''}</span></div></div>
    <div class="hp-xp"><i style="width:${R.lvl >= REC_LVL_MAX ? 100 : Math.round(R.xp / need * 100)}%"></i></div>
    <div class="irow small">Сила удара: <b>${Math.round(recAtk(u) * 100)}%</b> · дальность: <b>${C.range}</b></div>
    <div class="hp-abs">${btn('follow', 'За героем', R.order === 'follow')}${btn('guard', 'Охранять гильдию', R.order === 'guard')}</div>
    <div class="hp-abs">${btn('drill', 'Тренировка (1 зол.)', R.order === 'drill')}${btn('dismiss', 'Распустить', false)}</div>
    <div class="tip">Клик по земле — встать там на пост, по скелету, ходячему дереву или волку — атаковать. Esc — снять выбор.</div><button class="hc-x" title="Закрыть (Esc)">×</button>`;
}

function recCardUpdate() {
  let card = document.getElementById('rec-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'rec-card';
    document.getElementById('view').appendChild(card);
    card.addEventListener('click', e => {
      const u = Game.selUnit;
      if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); return; }
      const el = e.target.closest('[data-rc]');
      if (!el || !u || !u.rec) return;
      const k = el.dataset.rc;
      if (k === 'dismiss') { if (confirm('Распустить рекрута? Он снова станет трудягой, оружие вернётся в гильдию.')) dismissRecruit(u); }
      else setOrder(u, k);
      updateUI(true);
    });
  }
  const u = Game.selUnit;
  if (!u || !u.rec || u.dead) { card.style.display = 'none'; return; }
  const html = recCardHTML(u);
  if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
  card.style.display = 'block';
}

function heroGuildBlock() {
  const h = Game.hero, H = h && h.hero;
  if (!H) return '';
  const C = H.clsKey && GCLS[H.clsKey];
  const squad = Game.units.filter(u => u.rec && !u.dead && !(u.rec.train > 0));
  let x = '';
  if (C) x += `<div class="hp-abs"><button class="hp-ab" data-hero="g_strike" title="Ближайший враг в радиусе ${C.range + 3} (Q)"><b>${C.verb}</b><small>${C.name}, ранг ${H.mastery || 0} · сила ${Math.round(heroAtk(h) * 100)}%</small></button></div>`;
  else x += '<div class="irow small muted">Класс: нет — обучитесь в гильдии воинов, лучников, разбойников или магов</div>';
  if (squad.length) x += `<div class="irow small">Отряд: <b>${squad.length}</b> <button class="hp-sm" data-hero="g_follow">За мной</button><button class="hp-sm" data-hero="g_guard">По гильдиям</button></div>`;
  return x;
}

function initGuildUI() {
  const st = document.createElement('style');
  st.textContent = `#rec-card{position:absolute;top:58px;right:10px;width:250px;z-index:6;padding:8px 10px 10px;background:rgba(26,19,13,.94);color:#e8dcc0;border:1px solid #8a8ac0;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.6);font-size:13px;display:none}
  #rec-card .hc-x{position:absolute;top:3px;right:5px;padding:0 6px;font-size:13px;line-height:18px}
  #rec-card .hp-ab.on{border-color:#f6d458;background:#5a4418}
  body.mobile #rec-card{top:calc(92px + env(safe-area-inset-top));right:auto;left:6px;width:min(300px,calc(100vw - 12px));max-height:min(40vh,calc(100dvh - 150px));overflow-y:auto}
  .g-wide{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;margin:4px 0;padding:5px 8px}
  .g-wide small{opacity:.75;font-size:11px}
  .g-rec{cursor:pointer}.g-rec:hover{background:rgba(255,220,140,.06)}
  .g-xp{height:4px;background:#2a2014;border-radius:2px;overflow:hidden;margin:2px 0}.g-xp i{display:block;height:100%;background:#f6d458}
  #hero-card .hc-guild{margin-top:4px}`;
  document.head.appendChild(st);
  document.getElementById('info').addEventListener('click', e => {
    const el = e.target.closest('[data-gd]');
    if (!el) return;
    const [k, v] = el.dataset.gd.split(':');
    const b = Game.buildings.find(x => x.id === +v);
    const u = Game.unitMap.get(+v);
    if (k === 'hire' && b) hireRecruit(b);
    else if (k === 'hero' && b && Game.hero) {
      const c = { kind: 'guild', b, tx: b.doorX, ty: b.doorY, label: 'Учиться' };
      issueCmd(Game.hero, c);
      floater(b.doorX + 0.5, b.doorY - 0.4, 'Учиться', '#f6d458');
    } else if (k === 'drill' && u) setOrder(u, 'drill');
    else if (k === 'sel' && u && !e.target.closest('button')) { Game.selected = null; Game.selUnit = u; centerOn(u.x * TILE, u.y * TILE); }
    updateUI(true);
  });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyQ' && Game.hero) heroAbility('g_strike');
  });
}

// ================= Подключение =================

{
  const _think = Unit.prototype.think;
  Unit.prototype.think = function () {
    if (this.gm || this.rec) {
      if (this.wantsEat()) { const inn = findInn(this); if (inn) { this.idleFlag = false; return eatGen(this, inn); } this.nextEatTry = Game.time + 15; }
      if (this.rec) return recruitGen(this);
      return masterGen(this);
    }
    // рекрут из старого сохранения без данных — делаем по умолчанию
    if (GCLS[this.type] && UNIT_TYPES[this.type].recruit) {
      this.rec = { cls: this.type, lvl: 1, xp: 0, guild: 0, order: 'hold', pt: [Math.floor(this.x), Math.floor(this.y)], train: 0 };
      return recruitGen(this);
    }
    return _think.call(this);
  };

  const _hcj = heroCanJoin;
  heroCanJoin = function (u) { return !u.rec && !u.gm && _hcj(u); };

  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const h = Game.hero;
    if (h && !h.dead && inb(t[0], t[1])) {
      const f = foesNear(t[0] + 0.5, t[1] + 0.5, 1.4)[0];
      if (f) return { kind: 'attack', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Атаковать' };
      const b = buildingAt(t);
      if (isGuild(b) && !b.upg) return { kind: 'guild', b, tx: b.doorX, ty: b.doorY, label: 'Учиться у главы' };
    }
    return _rc(t);
  };

  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'attack') yield* fightGen(u, c.f);
    else if (c.kind === 'guild') { if (u.type === 'hero') yield* heroGuildGen(u, c); }
    else if (c.kind === 'equip' && u.hero && u.hero.clsKey && u.hero.inv && u.hero.inv[c.slot] && typeof HL_GEAR !== 'undefined') {
      const k = u.hero.inv[c.slot].k, C = GCLS[u.hero.clsKey];
      if (HL_GEAR[k] && (k === C.weapon || k === C.armor)) yield* quickEquipGen(u, c);
      else yield* _run(u, c);
    } else yield* _run(u, c);
  };

  const _tt = teamThink;
  teamThink = function (u) {
    const h = heroOf(u);
    if (h && h.cmd && h.cmd.kind === 'guild') { u.idleFlag = false; u.job = null; return (function* () { yield { wait: 0.8 }; })(); }
    return _tt(u);
  };

  const _ab = heroAbility;
  heroAbility = function (k) {
    const h = Game.hero;
    if (k === 'g_strike') {
      if (!h || h.dead || !h.hero) return;
      const C = h.hero.clsKey && GCLS[h.hero.clsKey];
      const f = foesNear(h.x, h.y, (C ? C.range : 1.5) + 3)[0];
      if (!f) { floater(h.x, h.y - 1.6, 'Врагов рядом нет', '#e8e0c0'); return; }
      issueCmd(h, { kind: 'attack', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Атаковать' });
      return;
    }
    if (k === 'g_follow' || k === 'g_guard') {
      for (const u of Game.units) if (u.rec && !u.dead && !(u.rec.train > 0)) setOrder(u, k.slice(2));
      toast(k === 'g_follow' ? 'Отряд идёт за героем' : 'Рекруты вернулись охранять гильдии');
      updateUI(true);
      return;
    }
    _ab(k);
  };

  const _click = onLeftClickTile;
  onLeftClickTile = function (t) {
    if (!Game.tool && inb(t[0], t[1])) {
      let near = null, bd = 0.8;
      for (const u of Game.units) {
        if (u.inside || u.dead) continue;
        const d = Math.hypot(u.x - (t[0] + 0.5), u.y - (t[1] + 0.5));
        if (d < bd) { bd = d; near = u; }
      }
      if (near && near.rec) { Game.selected = null; Game.selUnit = near; updateUI(true); return; }
      if (near && near.gm && Game.selUnit !== Game.hero) {
        const b = Game.buildings.find(x => x.id === near.gm);
        if (b) { floater(near.x, near.y - 1.7, near.gmName || UNIT_TYPES[near.type].name, '#f6d458'); focusBuilding(b); return; }
      }
      const s = Game.selUnit;
      if (s && s.rec && near !== Game.hero) {
        const f = foesNear(t[0] + 0.5, t[1] + 0.5, 1.4)[0];
        if (f) { setOrder(s, 'hold', [Math.floor(s.x), Math.floor(s.y)]); s.rec.target = f; floater(f.o.x, f.o.y - 1.6, 'Атаковать', '#ff9a70'); return; }
        const b = buildingAt(t);
        if (b && b.id === s.rec.guild) { setOrder(s, 'guard'); floater(b.doorX + 0.5, b.doorY - 0.4, 'Охранять', '#f6d458'); updateUI(true); return; }
        const tx = b ? b.doorX : t[0], ty = b ? b.doorY : t[1];
        if (!isWalkable(tx, ty)) { toast('Сюда не пройти'); return; }
        setOrder(s, 'hold', [tx, ty]);
        floater(tx + 0.5, ty - 0.4, 'Встать здесь', '#f6d458');
        updateUI(true);
        return;
      }
    }
    _click(t);
  };

  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (isGuild(b) && !b.upg) {
      const i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + guildHTML(b) + h.slice(i) : h + guildHTML(b);
    }
    return h;
  };

  const _hcu = heroCardUpdate;
  heroCardUpdate = function () {
    _hcu();
    const card = document.getElementById('hero-card');
    if (!card || card.style.display === 'none' || !Game.hero) return;
    if (Mobile.on && !heroCardOpen) return;
    let el = card.querySelector('.hc-guild');
    if (!el) { el = document.createElement('div'); el.className = 'hc-guild'; const tip = card.querySelector('.tip'); tip ? tip.before(el) : card.appendChild(el); el.dataset.h = ''; }
    const html = heroGuildBlock();
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  };

  const _upd = updateUI;
  updateUI = function (force) { _upd(force); if (typeof document !== 'undefined' && document.getElementById && document.getElementById('view')) recCardUpdate(); };

  const _pu = portraitURL;
  portraitURL = function (type, look) {
    if (type === 'hero' && !(typeof Coop !== 'undefined' && Coop.on) && Game.hero && Game.hero.hero && Game.hero.hero.clsKey && look === Game.hero.look) type = 'hero_' + Game.hero.hero.clsKey;
    return _pu(type, look);
  };

  const _step = step;
  step = function (dt) { _step(dt); guildsTick(dt); };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); G.shots.length = 0; };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    Game.units.forEach((u, k) => {
      const d = s.units[k];
      if (!d) return;
      if (u.rec) d.rc = u.rec;
      if (u.gm) { d.gm = u.gm; d.gmn = u.gmName; }
    });
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    (s.units || []).forEach((d, k) => {
      const u = Game.units[k];
      if (!u || u.type !== d.type && !(UNIT_TYPES[d.type] && UNIT_TYPES[d.type].legacy)) return;
      if (d.rc) { u.rec = d.rc; u.smoker = false; }
      if (d.gm) { u.gm = d.gm; u.gmName = d.gmn; u.smoker = false; }
    });
  };

  const _start = startGame;
  startGame = function () { _start(); initGuildUI(); updateUI(true); };

  // одежда глав гильдий и рекрутов: те же шапки классов, что у героев кооператива (coopclient.js)
  Object.assign(OUTFIT, {
    gm_warrior: { cap: 'cls:warrior', pants: '#2a2830', coat: '#5a5a66', vest: '#c8ccd4', rivets: true, belt: 'hammer', apron: '#8c2c20' },
    gm_archer:  { cap: 'cls:archer',  pants: '#3a2a1a', coat: '#2a5a1e', vest: '#8a5a30', staff: true },
    gm_rogue:   { cap: 'cls:rogue',   pants: '#141418', coat: '#24242e', vest: '#5a2a4a' },
    gm_mage:    { cap: 'cls:mage',    pants: '#1a1e3a', robe: true, robeCol: '#3a2a8a', staff: true },
    warrior:    { cap: 'cls:warrior', pants: '#3a3632', coat: '#6a6a76', vest: '#9aa0aa', rivets: true, belt: 'hammer' },
    archer:     { cap: 'cls:archer',  pants: '#4a3a24', coat: '#3a7a2a', vest: '#6a4a28' },
    rogue:      { cap: 'cls:rogue',   pants: '#1e1e26', coat: '#2e2e3a', vest: '#44445a' },
    mage:       { cap: 'cls:mage',    pants: '#22284a', robe: true, robeCol: '#2c4a9a', staff: true },
  });

  // оружие в руке, уровни рекрутов, кольцо выбора, стрелы и огненные шары
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const t = Game.time;
    const ring = (u, col, r) => { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.ellipse(u.x * TILE, u.y * TILE + 6, r, r * 0.5, 0, 0, Math.PI * 2); c.stroke(); };
    for (const u of Game.units) {
      if (u.dead || u.inside) continue;
      const w = u.rec ? GCLS[u.rec.cls].weapon : u.type === 'hero' && u.hero && u.hero.equip ? u.hero.equip.weapon : null;
      if (w && GOODS[w] && !u.anim) {
        const ic = iconCanvas('good', w), f = u.face || 1;
        c.save(); c.translate(Math.round(u.x * TILE + f * 6), Math.round(u.y * TILE - 6)); if (f < 0) c.scale(-1, 1);
        c.imageSmoothingEnabled = false; c.drawImage(ic, -5, -9, 11, 11); c.restore();
      }
      if (u.rec) {
        if (Game.selUnit === u) ring(u, `rgba(170,170,255,${0.7 + 0.3 * Math.sin(t * 6)})`, 12);
        c.font = 'bold 7px sans-serif'; c.textAlign = 'center';
        const lbl = `${GCLS[u.rec.cls].name} ${u.rec.lvl}`, px = u.x * TILE, py = u.y * TILE - 34;
        c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(lbl, px, py);
        c.fillStyle = GCLS[u.rec.cls].col; c.fillText(lbl, px, py); c.textAlign = 'start';
      } else if (u.gm) {
        c.font = 'bold 7px sans-serif'; c.textAlign = 'center';
        const px = u.x * TILE, py = u.y * TILE - 36;
        c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText('★ ' + (u.gmName || ''), px, py);
        c.fillStyle = '#f6d458'; c.fillText('★ ' + (u.gmName || ''), px, py); c.textAlign = 'start';
      }
    }
    for (const s of G.shots) {
      const o = s.f.o, p = Math.min(1, s.t / s.dur);
      const x0 = s.x * TILE, y0 = s.y * TILE, x1 = o.x * TILE, y1 = o.y * TILE - 12;
      const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * (s.kind === 'arrow' ? 10 : 4);
      if (s.kind === 'arrow') {
        const q = Math.min(1, p + 0.03), xq = x0 + (x1 - x0) * q, yq = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 10;
        const a = Math.atan2(yq - y, xq - x);
        c.save(); c.translate(x, y); c.rotate(a);
        line(c, -6, 0, 4, 0, '#8a5a30', 1); poly(c, [[4, -1.4], [7, 0], [4, 1.4]], '#cec6ba'); c.fillStyle = '#e04a3a'; c.fillRect(-7, -1.2, 2, 2.4);
        c.restore();
      } else {
        c.save(); c.globalCompositeOperation = 'lighter';
        glow(c, x, y, 10, '255,140,40', 0.5);
        for (let k = 1; k < 5; k++) { const q = Math.max(0, p - k * 0.05); ellipse(c, x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 4, 3 - k * 0.5, 3 - k * 0.5, `rgba(255,${120 + k * 20},40,${0.6 - k * 0.1})`); }
        ellipse(c, x, y, 3, 3, '#fff0a0');
        c.restore();
      }
    }
  };
}
