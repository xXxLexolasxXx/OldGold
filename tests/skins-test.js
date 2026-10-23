'use strict';
// Скины героя (КООП_ЗАБЕГ.md §2.4): открытие за достижения, надетое в мете, облик деревни (индексы 12–14 heroapp),
// рисунок в забеге и в деревне не падает ни на одной вещи, сервер чистит скины отряда. Запуск: node tests/skins-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
const OUTFIT = { hero: { cap: '#d4a018', pants: '#3a2a1c', coat: '#8a1c22', belt: 'hammer', apron: '#c8a030' } };
const calls = { n: 0 };
const cv = new Proxy({}, { get: (t, k) => k === 'fillStyle' || k === 'strokeStyle' ? '' : () => { calls.n++; }, set: () => true });
const ctx = { console, Math, Object, Array, String, Set, Map, JSON, Proxy, RegExp, Number, Date, OUTFIT, FEM_HS_NAMES: [], HERO_NAMES_F: [], HERO_NAMES_M: [],
  document: { addEventListener() {}, getElementById: () => null }, drawCap() {}, lookOf: () => ({}), portraitURL: () => '', personSex: () => '', personSprite: () => ({ width: 1, height: 1 }),
  heroPanel: () => '', spawnHero: () => ({ hero: {} }), resetGameState() {}, step() {}, Game: { hero: null } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'heroapp.js'), 'utf8') + '\n;this.MAX = HA_MAX; this.clean = haClean; this.type = haType;', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'run', 'skins.js'), 'utf8') +
  '\n;this.SL = SK_SLOTS; this.owned = skOwned; this.worn = skWorn; this.streak = skStreak; this.hat = skinHat; this.beard = skinBeard; this.cape = skinCape; this.run = skRun;', ctx);

const M = Object.assign;
check(ctx.MAX.length === 15 && ctx.MAX[12] >= ctx.SL[0][2].length - 1 && ctx.MAX[13] >= ctx.SL[1][2].length - 1 && ctx.MAX[14] >= ctx.SL[2][2].length - 1, 'HA_MAX не вмещает все скины');
// открытие
check(!ctx.owned({ wins: 0, runs: 0 }, 'hat', 0) && ctx.owned({ wins: 1, runs: 0 }, 'hat', 0), 'колпак Малгора открывается первой победой');
check(ctx.owned({ runs: 1 }, 'cape', 4) && !ctx.owned({ runs: 0 }, 'cape', 4), 'мешковина — за первый забег');
check(!ctx.owned({ shards: 99 }, 'hat', 2) && ctx.owned({ skinsBought: { hat2: 1 } }, 'hat', 2), 'вещь за осколки доступна только после покупки');
const days = {}; for (let i = 1; i <= 7; i++) days['2026-10-0' + i] = 1;
check(ctx.streak({ dayBest: days }) === 7 && ctx.owned({ dayBest: days }, 'hat', 4), '7 ежедневных подряд');
days['2026-10-03'] = undefined; delete days['2026-10-03'];
check(ctx.streak({ dayBest: days }) === 4 && !ctx.owned({ dayBest: days }, 'hat', 4), 'разрыв серии');
check(ctx.owned({ top10: 1 }, 'hat', 3) && ctx.owned({ coopMax: 5 }, 'hat', 5) && ctx.owned({ kills: 500 }, 'beard', 3) && ctx.owned({ flawless: true }, 'cape', 2), 'условия мета-полей');
// надетое: чужое и неоткрытое отбрасывается
const w = ctx.worn({ wins: 1, skin: { hat: 0, beard: 0, cape: 99 } });
check(w.hat === 0 && w.beard === -1 && w.cape === -1, 'worn: неоткрытое/кривое должно сниматься ' + JSON.stringify(w));
check(JSON.stringify(ctx.worn({ skin: 'x' })) === '{"hat":-1,"beard":-1,"cape":-1}', 'worn: мусор');
// облик деревни
const ap = Array(15).fill(-1); ap[12] = 2; ap[13] = 4; ap[14] = 5;
const cl = ctx.clean(ap); check(cl && cl[12] === 2 && cl[13] === 4 && cl[14] === 5, 'haClean потерял скины');
check(ctx.clean(Array(15).fill(-1).map((v, i) => i === 12 ? 99 : v)) === null, 'haClean пропустил индекс шапки вне диапазона');
const key = ctx.type('hero', cl); check(OUTFIT[key].skHat === 2 && OUTFIT[key].skBeard === 4 && OUTFIT[key].skCape === 5, 'haType не передал скины в наряд');
const key2 = ctx.type('hero', ctx.clean(M(Array(15).fill(-1), { 9: 1 }))); check(OUTFIT[key2].skHat === -1, 'без скина skHat = -1');
// рисование
for (const [s, , list] of ctx.SL) for (let i = 0; i < list.length; i++) {
  calls.n = 0;
  try {
    if (s === 'hat') for (const v of ['S', 'E']) ctx.hat(cv, i, v, 0, -16, 0.4);
    if (s === 'beard') for (const v of ['S', 'E']) ctx.beard(cv, i, v, 0, -16);
    if (s === 'cape') for (const v of ['S', 'E', 'N']) ctx.cape(cv, i, v, -12, -6, v === 'N');
    for (const f of [1, -1]) ctx.run(cv, { hat: -1, beard: -1, cape: -1, [s]: i }, 50, 50, f, s);
  } catch (e) { check(false, `рисунок ${s} ${i}: ${e.message}`); }
  check(calls.n > 3, `рисунок ${s} ${i} пустой`);
}
// сервер: чистка скинов отряда
const rr = require('../server/runroom.js');
const h = rr.heroFrom({ sk: { hat: 3, beard: 99, cape: -5 } });
check(h.sk && h.sk.hat === 3 && h.sk.beard === -1 && h.sk.cape === -1, 'heroFrom не вычистил скины: ' + JSON.stringify(h.sk));
check(rr.heroFrom({ sk: 'x' }).sk.hat === -1 && rr.heroFrom(null).sk.cape === -1, 'heroFrom: мусор в скинах');
// ядро: счётчик ударов по герою
const RS = require('../js/run/runsim.js');
const S = RS.rsNew({ seed: 5, heroes: [{ sk: { hat: 1, beard: -1, cape: -1 } }] });
check(S.heroes[0].sk.hat === 1 && S.heroes[0].hurts === 0, 'rsNew: скин и счётчик ударов');
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('skins-test: ок');
