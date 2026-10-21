'use strict';
// Вольная живность (js/world/wildlife.js) и меньше фей (neutrals.js): частоты появления по сидам, открытие видов с днями,
// потолки на экран и на карту, сохранение, зеркало кооператива, обрезка лишних логов фей в старых сейвах.
// Запуск: node tests/wildlife-test.js [сиды через запятую]
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const SEEDS = (process.argv[2] || '3,7,11,22,33').split(',').map(Number);

const tot = {};      // вид → в скольких сидах встречен
const table = [];
for (const seed of SEEDS) {
  const sim = L.newSim(seed), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));

  // феи: не больше трёх логов на карту, а прочих видов логов — хотя бы три
  const lz = J(`const o = {}; for (const l of Game.lairs) o[l.k] = (o[l.k] || 0) + 1;
    return { o, fairies: Game.neutrals.filter(N => N.k === 'fairy' || N.k === 'pixie').length, all: Game.neutrals.length };`);
  ok((lz.o.pixie || 0) <= NEU_CAP('pixie') && (lz.o.fairy || 0) <= NEU_CAP('fairy'), `сид ${seed}: логов фей сверх потолка ${JSON.stringify(lz.o)}`);
  ok((lz.o.pixie || 0) >= 1, `сид ${seed}: нет ни одного селения цветочных фей`);
  ok(Object.keys(lz.o).filter(k => k !== 'pixie' && k !== 'fairy').length >= 3, `сид ${seed}: мало видов логов ${JSON.stringify(lz.o)}`);
  ok(lz.fairies <= lz.all * 0.25, `сид ${seed}: фей больше четверти нейтралов (${lz.fairies} из ${lz.all})`);

  // прогон: кто выходит в 1-й день, 3-ю ночь, 10-й день и 10-ю ночь
  const phase = (d, night) => J(`
    while (startDay() < ${d}) Game.time += 5;
    while (${night ? 'nightAmt() < 0.85' : 'nightAmt() > 0.05'}) Game.time += 5;
    Game.wild = []; Game.wlN = {};
    let maxAll = 0, maxBox = 0;
    const A = wlAnchors();
    for (let i = 0; i < 600; i++) {
      wlTick(0.5);
      maxAll = Math.max(maxAll, Game.wild.length);
      for (const a of A) maxBox = Math.max(maxBox, Game.wild.filter(o => !o.fade && wlInBox(o, a)).length);
    }
    return { n: Game.wlN, maxAll, maxBox, open: wlOpenKinds().map(x => x[0]) };`);
  const p1 = phase(1, false), p3 = phase(3, true), p10 = phase(10, false), p10n = phase(10, true);
  // магические существа: дракон и грифон гнездятся на любой карте, единорог выходит у родника недалеко от взгляда игрока,
  // первые логова гоблинов, троллей, броненосца и гномтавров — не на краю карты
  const mg = J(`
    const F = fyState(); fyNests(F);
    let uni = 0, uniD = [];
    for (let d = 3; d <= 6; d++) {
      while (!(startDay() >= d && isEveningNow() && !isDawnNow() && nightAmt() > 0.05 && nightAmt() < 0.3)) Game.time += 2;
      F.uni = null; F.uT = 0;
      unicornTick(0.1, F);
      if (F.uni) { uni++; uniD.push(Math.round(Math.hypot(F.uni.x - (MAP_W >> 1), F.uni.y - (MAP_H >> 1)))); fstat('uniSeen'); }
      F.uni = null; Game.time += 300;
    }
    for (let n = 1; n <= 4; n++) n2Night(n);
    const far = {}, cx = MAP_W >> 1, cy = MAP_H >> 1;
    for (const l of Game.lairs) if (/^(goblin|troll|armad|gnomtaur)/.test(l.k)) { const d = Math.round(Math.hypot(l.x - cx, l.y - cy)); far[l.k] = Math.min(far[l.k] || 999, d); }
    const fy = fyMirrorOut ? JSON.stringify(Object.keys(fyMirrorOut() || {})) : '';
    return { dr: !!F.dr, gr: !!F.gr, uni, uniD, far, fy, minStart: mapIsLegacy() ? 20 : 24 };`);
  ok(mg.dr && mg.gr, `сид ${seed}: нет гнезда дракона или грифона ${JSON.stringify(mg)}`);
  ok(mg.uni >= 2, `сид ${seed}: единорог вышел лишь в ${mg.uni} из 4 вечеров`);
  for (const k in mg.far) ok(mg.far[k] <= mg.minStart + 24, `сид ${seed}: первое логово ${k} слишком далеко (${mg.far[k]})`);
  const kinds1 = Object.keys(p1.n);
  ok(kinds1.every(k => J(`return WL_SPEC['${k}'].day`) <= 1), `сид ${seed}: в 1-й день вышли поздние виды ${kinds1}`);
  ok(kinds1.length >= 1, `сид ${seed}: в 1-й день никого (${JSON.stringify(p1)})`);
  ok(!Object.keys(p3.n).some(k => J(`return WL_SPEC['${k}'].t`) === 'day'), `сид ${seed}: ночью вышли дневные ${Object.keys(p3.n)}`);
  for (const p of [p1, p3, p10, p10n]) {
    ok(p.maxAll <= 12, `сид ${seed}: больше WL_MAX зверья разом (${p.maxAll})`);
    ok(p.maxBox <= 6, `сид ${seed}: больше WL_SCREEN на экран (${p.maxBox})`);
  }
  const all = Object.assign({}, p1.n);
  for (const p of [p3, p10, p10n]) for (const k in p.n) all[k] = (all[k] || 0) + p.n[k];
  for (const k in all) tot[k] = (tot[k] || 0) + 1;
  table.push(`сид ${seed}: ` + Object.entries(all).map(([k, v]) => `${k} ${v}`).join(', ') + ` | феи ${lz.fairies}/${lz.all} | единорог ${mg.uni}/4, логова ${JSON.stringify(mg.far)}`);

  if (seed === SEEDS[0]) {
    // обычный шаг игры с живностью не падает
    L.stepN(sim, 200);
    ok(!sim.errors.length, 'ошибки при шаге: ' + sim.errors.slice(0, 3).join(' | '));
    // рисование всех кадров всех видов не падает
    const dr = J(`const c = mkCanvas(64, 64).getContext('2d'); let n = 0;
      for (const k of WL_KINDS) for (const st of ['idle', 'walk', 'react', 'flee']) for (const t of [0, 0.3, 0.7, 1.1, 2.5]) {
        const o = wlMake(k, [10.5, 10.5]); o.st = st; o.mv = st === 'walk' || st === 'flee' ? 1 : 0; o.rt = t; Game.time += 0.13;
        wlDraw(c, o); if (k === 'otter') { o.sw = 1; wlDraw(c, o); } n++;
      }
      return n;`);
    ok(dr > 100, 'рисование кадров: ' + dr);
    // сохранение: увиденные виды переживают сейв, сама живность — нет
    const sv = J(`Game.wlSeen = { starfox: 1, stag: 1 }; Game.wild = [wlMake('hare', [10.5, 10.5])];
      const s = JSON.parse(JSON.stringify(serializeGame())); applySave(s);
      return { seen: Object.keys(Game.wlSeen).sort(), wild: Game.wild.length };`);
    ok(sv.seen.join() === 'stag,starfox' && sv.wild === 0, 'сейв живности: ' + JSON.stringify(sv));
    // зеркало кооператива
    const cm = J(`Game.wild = [wlMake('stag', [10.5, 10.5])];
      if (typeof coopMirror !== 'function') return { skip: 1 };
      const m = coopMirror(); return { n: (m.wild || []).length, k: m.wild && m.wild[0] && m.wild[0].k };`);
    if (cm.skip) console.log('  · зеркало кооператива: пропуск (нет coopMirror)');
    else ok(cm.n === 1 && cm.k === 'stag', 'зеркало кооператива не несёт живность: ' + JSON.stringify(cm));
    ok(/'wild'\]/.test(require('fs').readFileSync(__dirname + '/../js/coop/coopclient.js', 'utf8')), 'в COOP_LISTS клиента нет списка wild');
    // старый сейв с кучей селений фей: лишние логова заселяют звери
    const tr = J(`const s = JSON.parse(JSON.stringify(serializeGame()));
      for (let i = 0; i < 6; i++) s.nt.lairs.push({ id: 900000 + i, k: i % 2 ? 'fairy' : 'pixie', x: 5 + i, y: 5, lv: 1, fr: 0, fd: 0, rs: 0 });
      for (let i = 0; i < 6; i++) s.nt.mem.push({ id: 910000 + i, k: i % 2 ? 'fairy' : 'pixie', lair: 900000 + i, x: 5 + i, y: 5, hp: 10, lv: 1 });
      applySave(s);
      const o = {}; for (const l of Game.lairs) o[l.k] = (o[l.k] || 0) + 1;
      return { o, fairies: Game.neutrals.filter(N => N.k === 'fairy' || N.k === 'pixie').length };`);
    ok((tr.o.pixie || 0) <= 2 && (tr.o.fairy || 0) <= 1, 'старый сейв: лишние логова фей не обрезаны ' + JSON.stringify(tr));
  }
}
function NEU_CAP(k) { return 1; }
// доли фей и кабанов на картах всех размеров: на старте и к 4-й ночи — не больше 15 % нейтралов и 5 % всех существ
const C = require('./lib/census');
for (const size of ['small', 'medium', 'large']) for (const seed of SEEDS.slice(0, 3)) {
  const sim = L.newSim(seed), h = sim.h;
  if (size !== 'large') h.run(`setupStart(${seed}, { size: '${size}' }); Game.heroAsk = false;`);
  const at = when => {
    const s = C.shares(C.census(h));
    ok(s.fairyNeu <= 0.15 && s.fairyAll <= 0.05, `${size} сид ${seed} ${when}: фей ${s.fairies} из ${s.neu} нейтралов (${Math.round(s.fairyNeu * 100)} %)`);
    ok(s.boarNeu <= 0.15 && s.boarAll <= 0.05, `${size} сид ${seed} ${when}: кабанов ${s.boars} из ${s.neu} нейтралов (${Math.round(s.boarNeu * 100)} %)`);
    return s;
  };
  const s0 = at('старт');
  h.run(`(function(){ for (let n = 1; n <= 4; n++) { while (startNights() < n) Game.time += 5; n2Night(n); } })()`);
  const s4 = at('4-я ночь');
  ok(s4.neu > s0.neu, `${size} сид ${seed}: к 4-й ночи лес не пополнился новыми народами`);
  // старый сейв с лёжками кабанов на каждом шагу: лишние заселяют лешие
  if (size === 'large' && seed === SEEDS[0]) {
    const tr = JSON.parse(h.run(`JSON.stringify((function(){ const s = JSON.parse(JSON.stringify(serializeGame()));
      for (let i = 0; i < 6; i++) s.nt.lairs.push({ id: 920000 + i, k: 'boar', x: 5 + i, y: 7, lv: 1, fr: 0, fd: 0, rs: 0 });
      applySave(s); return Game.lairs.filter(l => l.k === 'boar').length; })())`));
    ok(tr <= 2, 'старый сейв: лишние лёжки кабанов не обрезаны (' + tr + ')');
  }
}
for (const l of table) console.log('  ' + l);
// каждый обычный открытый вид встречается хотя бы в половине сидов (кроме зависящих от рельефа: сурок у скал, выдра у воды)
for (const k of ['hare', 'bird', 'pheasant', 'moth']) ok((tot[k] || 0) >= Math.ceil(SEEDS.length / 2), `вид ${k} редко выходит: в ${tot[k] || 0} из ${SEEDS.length} сидов`);
ok(Object.keys(tot).length >= 6, 'мало видов за все сиды: ' + Object.keys(tot));
console.log(fails.length ? `Проверка живности: ${fails.length} провал(ов)` : `Проверка живности: всё в порядке (${SEEDS.length} сидов, видов ${Object.keys(tot).length})`);
process.exit(fails.length ? 1 : 0);
