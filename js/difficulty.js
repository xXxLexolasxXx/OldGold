'use strict';
// Сложность новой игры: «Спокойный» / «Обычный» / «Выживание». Хранится в Game.diff и в сохранении (df),
// у кооператива — в мире сервера (его выбирает хост). «Обычный» — прежний баланс: все множители 1.
// Читают: night.js (длина ночи, число и сила нечисти), entities.js и life.js (голод), neutrals.js (нейтралы),
// herolife.js (возрождение героя), main.js (стартовый набор), save.js, startmenu.js, coopclient.js.

const DIFF_ORDER = ['calm', 'normal', 'survival'];
const DIFFS = {
  calm: {
    name: 'Спокойный', short: 'Спокойно', color: '#8ad06a',
    desc: 'Строй и разведка без потерь: ночи мягче и короче, гномы не гибнут и не падают от голода.',
    nightN: 0.4,        // сколько нечисти выходит за ночь
    foe: 0.7,           // сила нечисти и частота набегов (множитель nightDiff)
    nightLen: 0.6,      // длина ночи
    food: 2,            // во сколько раз дольше гном сыт
    noStarve: true,     // голод не валит с ног и не бьёт героя
    starve: 1,          // во сколько раз быстрее копится слабость от голода (обморок, урон герою)
    noLoss: true,       // нечисть, совы и прочие не уносят гномов насмерть
    lossW: 0,           // сколько «потерь» копит гибель гнома (от них больше призраков и скелетов)
    neuDmg: 0.4, neuHp: 0.8, neuResp: 2,    // нейтралы: урон, здоровье, время возрождения логова
    heroDown: 1.2, heroHp: 1,               // герой: сколько лежит повержённым и с каким здоровьем встаёт
    stock: 1.5, serfs: 0,                   // старт: множитель припасов, прибавка к трудягам
  },
  normal: {
    name: 'Обычный', short: 'Обычный', color: '#e8c850',
    desc: 'Задуманный баланс: ночи растут с каждым днём, гномы устают, едят и иногда гибнут.',
    nightN: 1, foe: 1, nightLen: 1, food: 1, noStarve: false, starve: 1, noLoss: false, lossW: 1,
    neuDmg: 1, neuHp: 1, neuResp: 1, heroDown: 2.6, heroHp: 0.5, stock: 1, serfs: 0,
  },
  survival: {
    name: 'Выживание', short: 'Выживание', color: '#e0645a',
    desc: 'Злые ночи, быстрый голод, тощий склад: каждая потеря — это призраки и скелеты на следующую ночь.',
    nightN: 1.5, foe: 1.25, nightLen: 1.3, food: 0.75, noStarve: false, starve: 1.6, noLoss: false, lossW: 1.5,
    neuDmg: 1.5, neuHp: 1.3, neuResp: 0.6, heroDown: 8, heroHp: 0.25, stock: 0.7, serfs: -2,
  },
};
const DIFF_STOCK = { timber: 30, stone: 35, bread: 20, gold: 30, trunk: 4 };   // стартовые припасы «Обычного»

function dif() { return DIFFS[Game.diff] || DIFFS.normal; }
function diffKey(k) { return DIFFS[k] ? k : 'normal'; }

// Стартовый набор: припасы на складе и число трудяг. Вызывается один раз для новой игры (и из меню — после выбора режима)
function diffApplyStart(k) {
  Game.diff = diffKey(k);
  const d = dif(), store = Game.buildings.find(b => b.type === 'storehouse');
  if (store) for (const g in DIFF_STOCK) store.stock[g] = Math.max(1, Math.round(DIFF_STOCK[g] * d.stock));
  if (d.serfs < 0) {
    let n = -d.serfs;
    for (let i = Game.units.length - 1; i >= 0 && n > 0; i--) {
      const u = Game.units[i];
      if (u.type !== 'serf' || u.dead) continue;
      Game.units.splice(i, 1); Game.unitMap.delete(u.id); u.releaseOcc && u.releaseOcc(); n--;
    }
  }
}
