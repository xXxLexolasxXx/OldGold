'use strict';
// Облик героя: цвет жилета, выбранный в редакторе, доходит до одежды (в т.ч. у базового героя и классов в мантиях),
// переживает сохранение/загрузку (JSON сейва) и виден при рисовании фигуры.
// Запуск: node tests/heroapp-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const OUTFIT = {
  hero: { cap: '#d4a018', pants: '#3a2a1c', coat: '#8a1c22', belt: 'hammer', apron: '#c8a030' },
  hero_warrior: { cap: 'cls:warrior', pants: '#3a3632', coat: '#6a6a76', vest: '#9aa0aa', rivets: true, belt: 'hammer' },
  hero_mage: { cap: 'cls:mage', pants: '#22284a', robe: true, robeCol: '#2c4a9a', staff: true },
  hero_druid: { cap: 'cls:druid', pants: '#3a3a20', robe: true, robeCol: '#4e6a2a', staff: true },
  hero_monk: { cap: 'cls:monk', pants: '#5a3a1c', robe: true, robeCol: '#c8641a' },
  hero_priest: { cap: 'cls:priest', pants: '#6a6458', robe: true, robeCol: '#e4e0d2', staff: true },
  hero_rogue: { cap: 'cls:rogue', pants: '#1e1e26', coat: '#2e2e3a', vest: '#44445a' },
};
const drawn = [];   // что «нарисовано»: цвет жилета фигуры
const ctx = {
  console, Math, Object, Array, String, Set, Map, JSON, Proxy, RegExp, Number,
  OUTFIT, FEM_HS_NAMES: [], HERO_NAMES_F: [], HERO_NAMES_M: [],
  document: { addEventListener() {}, getElementById: () => null },
  drawCap() {}, lookOf: () => ({}), portraitURL: () => '', personSex: () => '',
  personSprite(u) { const o = OUTFIT[u.type]; drawn.push(o && o.vest); return { width: 1, height: 1, vest: o && o.vest }; },
  heroPanel: () => '', spawnHero: () => ({ hero: {} }), resetGameState() {}, step() {}, Game: { hero: null },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'heroapp.js'), 'utf8') +
  '\n;this.COLS = HA_COAT_COLS; this.MAX = HA_MAX; this.clean = haClean; this.type = haType; this.body = haBodyFor; this.of = haOf; this.base = haBase;', ctx);

const classes = ['', 'warrior', 'mage', 'druid', 'monk', 'priest', 'rogue'];
for (const cls of classes) {
  for (const sex of [0, 1]) {
    for (let v = 0; v < ctx.COLS.length; v++) {
      const ap = Array(ctx.MAX.length).fill(-1); ap[9] = v; ap[10] = sex;
      // сейв: облик лежит в u.hero.app и проходит через JSON
      const u = { type: 'hero', hero: { clsKey: cls || undefined, app: ap } };
      const back = JSON.parse(JSON.stringify(u));
      const got = ctx.of(back);
      check(got && got[9] === v, `жилет ${v} (${cls || 'без класса'}, пол ${sex}) потерялся после сейва`);
      if (!got) continue;
      const key = ctx.type(ctx.base(back), got);
      check(OUTFIT[key].vest === ctx.COLS[v], `жилет ${v} (${cls || 'без класса'}, пол ${sex}) не попал в наряд: ${OUTFIT[key].vest}`);
      const spr = ctx.body(got, cls, 7);
      check(spr.vest === ctx.COLS[v], `жилет ${v} (${cls || 'без класса'}) не виден на фигуре`);
    }
  }
}
// разные цвета — разные наряды (кэш не склеивает)
const a = Array(12).fill(-1), b = a.slice(); a[9] = 0; b[9] = 5;
check(ctx.type('hero', a) !== ctx.type('hero', b), 'кэш одежды склеил разные цвета жилета');
// жилет не задан — наряд класса не меняется
const none = Array(12).fill(-1); none[1] = 2;
check(OUTFIT[ctx.type('hero_warrior', none)].vest === '#9aa0aa', 'без выбора жилет класса должен остаться прежним');

if (fails.length) { for (const f of fails.slice(0, 20)) console.log('✗ ' + f); process.exit(1); }
console.log('Проверка облика героя: жилет по всем классам, полам и цветам — в наряде, на фигуре и в сейве');
