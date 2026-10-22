'use strict';
// Генератор «золотых» сейвов для tests/saves/ (см. tests/saves/README.md).
// Запускается из ТЕКУЩЕГО репозитория, но берёт игру из рабочей копии нужной версии (git worktree):
//   node tools/gen-golden-save.js --root D:/wt-saves-gen/v0.10.25 --out tests/saves/v0.10.25-meadow-s11.json.gz --seed 11 --minutes 20
// Параметры: --biome meadow|forest|…, --size small|medium|large, --diff <ключ режима>, --hero warrior|mage|…
// (класс и снаряжение героя ставятся прямо в данные — на версиях без классов пропускается), --guilds 1 (построить гильдии),
// --level N (уровень героя), --kind coop (мир кооп-сервера: без героев, как world.json), --raw (без gzip).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.join(__dirname, '..')));
const OUT = arg('out');
const SEED = +arg('seed', 11), MINUTES = +arg('minutes', 15);
const BIOME = arg('biome', 'meadow'), SIZE = arg('size', 'small'), DIFF = arg('diff', ''), HERO = arg('hero', ''), LEVEL = +arg('level', 0);
const KIND = arg('kind', 'solo');
if (!OUT) { console.error('нужен --out'); process.exit(2); }

const { createHost } = require(path.join(ROOT, 'server', 'simhost'));
const errors = [];
const h = createHost(m => errors.push(m));

function mulberry(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
h.ctx.__rnd = mulberry(SEED);
h.run('Math.random = __rnd');
const coop = KIND === 'coop';
h.run("if (typeof profCur === 'undefined') { globalThis.profCur = () => (globalThis.__prof = globalThis.__prof || { name: 'Тест', meta: {}, ach: {}, st: {} }); globalThis.ACHS = globalThis.ACHS || []; globalThis.ACH_BY = globalThis.ACH_BY || {}; }");
h.run(`setupStart(${SEED}, { biome: ${JSON.stringify(BIOME)}, size: ${JSON.stringify(SIZE)} }); Game.heroAsk = false;
  if (${coop} && typeof coopDropHeroes === 'function') { coopDropHeroes(); if (typeof coopInitUnlocks === 'function') coopInitUnlocks(); }
  for (const b of Game.buildings) b.hold = false; Game.unlocked = typeof allUnlocked === 'function' ? allUnlocked() : Game.unlocked;`);
if (DIFF) h.run(`if (typeof diffApplyStart === 'function' && DIFFS[${JSON.stringify(DIFF)}]) diffApplyStart(${JSON.stringify(DIFF)}); else if (typeof DIFFS !== 'undefined' && DIFFS[${JSON.stringify(DIFF)}]) Game.diff = ${JSON.stringify(DIFF)};`);

// бот-игрок — тот же, что в тестах (берём из ТЕКУЩЕГО tests/lib/sim.js: он работает на старых версиях)
const L = require('../tests/lib/sim');
const sim = { h, errors, coop: false };
let seen = 0;
const step = n => {
  for (let i = 0; i < n; i++) {
    try { h.ctx.step(0.05); if (coop) h.run('typeof coopTick === "function" && coopTick(0.05)'); }
    catch (e) { if (seen++ < 5) console.log('  исключение шага:', String(e && e.message).slice(0, 120)); }
  }
};
const total = MINUTES * 60;
for (let t = 0; t < total; t += 30) {
  step(600);
  if ((t / 30) % 2 === 0) { try { L.botTurn(sim); } catch (e) { /* на старых версиях часть API другая */ } }
}

// принудительно достроенные гильдии (для проверки классов/оружия) — вокруг склада
if (argv.includes('--guilds')) {
  h.run(`(function () {
    const hub = Game.buildings.find(b => b.type === 'storehouse'); if (!hub) return;
    for (const type of Object.keys(BUILDINGS).filter(t => /^guild_/.test(t) || ['weaponsmith', 'smeltery', 'armory'].includes(t))) {
      let done = false;
      for (let r = 4; r < 30 && !done; r++) for (let a = 0; a < 30 && !done; a++) {
        const x = Math.round(hub.doorX + Math.cos(a * 0.21) * r * 1.5), y = Math.round(hub.doorY + Math.sin(a * 0.21) * r);
        if (!inb(x, y) || checkPlacement(type, x, y, 0)) continue;
        try { placeBuilding(type, x, y, true, 0); done = true; } catch (e) { /* дальше */ }
      }
    }
  })()`);
  step(1200);
}
if (HERO || LEVEL) {
  h.run(`(function () {
    const u = Game.hero; if (!u || !u.hero) return;
    const H = u.hero;
    ${LEVEL ? `H.level = ${LEVEL};` : ''}
    const k = ${JSON.stringify(HERO)};
    if (k && typeof GCLS !== 'undefined' && GCLS[k]) {
      const C = GCLS[k]; H.clsKey = k; H.cls = C.name; H.mastery = 3;
      H.equip = H.equip || {}; H.equip.weapon = C.weapon; H.equip.armor = C.armor;
    }
  })()`);
  step(600);
}

h.run('saveGame("manual")');
let text = h.run('localStorage.getItem(SAVE_KEY + "manual")');
if (!text) { console.error('saveGame ничего не записал'); process.exit(1); }
const info = h.run('({ v: typeof GAME_VERSION === "undefined" ? "?" : GAME_VERSION, b: Game.buildings.length, u: Game.units.length, t: Math.round(Game.time) })');
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, argv.includes('--raw') ? text : zlib.gzipSync(text, { level: 9 }));
console.log(`${path.basename(OUT)}: игра ${info.v}, ${info.b} зданий, ${info.u} жителей, ${info.t} с, ${(text.length / 1024).toFixed(0)} КБ → ${(fs.statSync(OUT).size / 1024).toFixed(0)} КБ${errors.length ? ', ошибок в логе: ' + errors.length : ''}`);
process.exit(0);
