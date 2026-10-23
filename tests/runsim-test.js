'use strict';
// Ядро забега js/run/runsim.js (КООП_ЗАБЕГ.md, этап 1): детерминизм, бот проходит «Спуск» до Малгора,
// переигровка записи даёт те же очки, подделанная запись не проходит, отряд из 5 героев поднимает упавших
// и доходит до конца, в коопе награда выбирается сама по таймеру. Запуск: node tests/runsim-test.js
const fs = require('fs');
const path = require('path');
const R = require('../js/run/runsim.js');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const { play } = require('./lib/runbot');
const hash = S => JSON.stringify([S.step, S.floor, S.kills, S.over, S.heroes.map(h => [h.x, h.y, h.hp, h.gold, h.ups]), S.enemies.length]);
const DIVE = { id: 'dive', name: 'Спуск', floors: 5, mult: 1 };
const strong = { hp: 150, dmg: 12 * 1.4, weapon: 'pick', choices: 4, pal: 'healer' };   // прокачанный в мастерской герой

// 1. детерминизм: один сид + один ввод → одно и то же
const a = play({ seed: 4242, diff: DIVE, heroes: [strong] }), b = play({ seed: 4242, diff: DIVE, heroes: [strong] });
ok(hash(a.S) === hash(b.S), 'один сид и один ввод дали разные итоги');
ok(R.rsNew({ seed: 1, diff: DIVE }).rooms.length !== 0, 'этаж без комнат');

// 2. бот проходит «Спуск» до Малгора (прокачанный герой) хотя бы на 2 сидах из 4
let wins = 0, bossSeen = 0;
for (const seed of [11, 22, 33, 44]) {
  const r = play({ seed, diff: DIVE, heroes: [strong] });
  if (r.S.over && r.S.over.win) wins++;
  if (r.S.floor === 4) bossSeen++;
  console.log(`  · сид ${seed}: ${r.S.over ? (r.S.over.win ? 'победа' : 'пал') : 'не кончил'} на этаже ${r.S.floor + 1}, убито ${r.S.kills}, ${(r.S.t / 60).toFixed(1)} мин, очки ${R.rsScore(r.S)}`);
  // 3. переигровка записи даёт тот же итог
  const rp = R.rsReplay({ seed, diff: DIVE, heroes: [strong] }, r.rec);
  ok(!rp.err && rp.score === R.rsScore(r.S) && hash(rp.S) === hash(r.S), `сид ${seed}: переигровка разошлась: ${rp.err || rp.score + ' ≠ ' + R.rsScore(r.S)}`);
}
ok(wins >= 2, `бот победил Малгора только ${wins} раз из 4`);
ok(bossSeen >= 2, 'бот почти не доходит до босса');

// 4. подделки: другая прокачка, выкинутые шаги, лишний выбор награды
{
  const opts = { seed: 11, diff: DIVE, heroes: [strong] }, r = play(opts), good = R.rsReplay(opts, r.rec).score;
  const weak = R.rsReplay({ seed: 11, diff: DIVE, heroes: [{}] }, r.rec);
  ok(weak.err || weak.score !== good || !weak.S.over.win, 'запись с чужой прокачкой дала тот же результат');
  const cut = r.rec.filter((x, i) => i % 7 !== 3);
  const rc = R.rsReplay(opts, cut);
  ok(rc.err || rc.score !== good, 'обрезанная запись дала тот же результат');
  const extra = r.rec.slice(); extra.splice(5, 0, [extra[5][0], 0, 3, 1]);
  ok(R.rsReplay(opts, extra).err, 'выбор награды посреди этажа принят');
  const back = r.rec.slice(); back.splice(10, 0, [0, 0, 1]);
  ok(R.rsReplay(opts, back).err, 'запись не по порядку принята');
  ok(R.rsReplay(opts, 'мусор').err && R.rsReplay(opts, [[0, 9, 0, 1, 1]]).err, 'мусорная запись принята');
  // кривая строка в середине не должна крутить переигровку до предела шагов (нагрузка на сервер)
  const t0 = Date.now(), bad = r.rec.slice(); bad.splice(3, 0, 'x');
  ok(R.rsReplay(opts, bad).err === 'кривая запись' && Date.now() - t0 < 200, 'кривая строка в записи: переигровка не оборвалась сразу');
  ok(R.rsReplay(opts, [[1.5, 0, 1]]).err === 'кривая запись' && R.rsReplay(opts, [[-1, 0, 1]]).err, 'дробный/отрицательный шаг принят');
}

// 5. отряд из 5: масштаб врагов, упавшие поднимаются, забег кончается, награды с бонусом
{
  const five = [0, 1, 2, 3, 4].map(i => ({ id: 'p' + i, hp: 120, dmg: 14 }));
  const s1 = R.rsNew({ seed: 77, diff: DIVE, heroes: [five[0]] }), s5 = R.rsNew({ seed: 77, diff: DIVE, heroes: five });
  ok(s5.enemies.length > s1.enemies.length * 1.8, `впятером врагов должно быть заметно больше: ${s1.enemies.length} → ${s5.enemies.length}`);
  ok(s5.pals.length === 0, 'в отряде из 5 не должно быть ИИ-напарников');
  // упал и поднялся
  const h = s5.heroes[1]; h.hp = 1; h.inv = 0;
  s5.enemies.forEach(e => { e.hp = 0; });
  const hurt = s5.heroes[1]; hurt.inv = 0;
  // ударим напрямую через снаряд врага
  s5.shots.push({ x: hurt.x, y: hurt.y, vx: 0, vy: 0, own: 'e', dmg: 50, t: 1 });
  R.rsStep(s5, []);
  ok(hurt.down && !s5.over, 'герой в отряде должен упасть, а не закончить забег');
  for (let k = 0; k < 60 * 4; k++) R.rsStep(s5, []);
  ok(!hurt.down && hurt.hp > 0, 'товарищи рядом должны поднять упавшего за 3 с');
  // ИИ-напарник отряду — только после тяжёлого этажа, в выборе награды
  {
    const duo = R.rsNew({ seed: 9, diff: DIVE, heroes: [five[0], five[1]] });
    ok(duo.pals.length === 0, 'отряд из 2 стартует без ИИ-напарников');
    ok(!R.rsHardFloor(duo), 'свежий отряд не должен считаться «не вывозит»');
    duo.flDowns = 2; ok(R.rsHardFloor(duo), 'два падения за этаж — тяжёлый этаж');
    duo.flDowns = 0; duo.heroes.forEach(x => { x.hp = x.max * 0.2; }); ok(R.rsHardFloor(duo), 'мало здоровья у всех — тяжёлый этаж');
    duo.heroes.forEach(x => { x.hp = x.max; }); duo.t = duo.flT0 + 300; ok(R.rsHardFloor(duo), 'затянутый этаж — тяжёлый');
    duo.enemies.forEach(e => { e.hp = 0; }); duo.heroes.forEach(x => { x.x = duo.stairs.x; x.y = duo.stairs.y; });
    R.rsStep(duo, []); R.rsStep(duo, []);
    ok(duo.pick && duo.pick.opts[0][0] === 'pal' && duo.pick.opts[1][0] === 'pal', 'после тяжёлого этажа в награде должен быть «Позвать напарника»');
    R.rsChoose(duo, 0, 0); R.rsChoose(duo, 1, 1);
    ok(duo.pals.length === 1 && duo.pals[0].owner === 0 && !duo.pick, 'напарник появляется только у выбравшего');
    ok(R.rsUpInfo('pal').n && R.rsUpInfo('blade').n, 'описание награды «напарник»');
    const easy = R.rsNew({ seed: 9, diff: DIVE, heroes: [five[0], five[1]] });
    easy.enemies.forEach(e => { e.hp = 0; }); easy.heroes.forEach(x => { x.x = easy.stairs.x; x.y = easy.stairs.y; });
    R.rsStep(easy, []); R.rsStep(easy, []);
    ok(easy.pick && !easy.pick.opts.some(o => o.includes('pal')), 'лёгкий этаж — напарника не предлагают');
  }
  // кооп-забег ботами до конца
  const r = play({ seed: 77, diff: DIVE, heroes: five }, 40);
  console.log(`  · отряд из 5: ${r.S.over ? (r.S.over.win ? 'победа' : 'пали') : 'не кончил'}, этаж ${r.S.floor + 1}, убито ${r.S.kills}, ${(r.S.t / 60).toFixed(1)} мин`);
  ok(!!r.S.over, 'кооп-забег из 5 ботов не закончился за 40 минут');
  const rw = R.rsRewards(r.S), rw1 = R.rsRewards(Object.assign({}, r.S, { n: 1 }));
  ok(rw.stones > rw1.stones && rw.stones <= Math.round(rw1.stones * 1.4) + 1, `бонус отряда к камням: ${rw1.stones} → ${rw.stones}`);
  const malgor5 = R.rsNew({ seed: 5, diff: { id: 'dive', floors: 1, mult: 1 }, heroes: five });
  ok(malgor5, 'этаж-босс для отряда');
}

// 6. в коопе выбор награды закрывается таймером
{
  const S = R.rsNew({ seed: 9, diff: DIVE, heroes: [{}, {}, {}] });
  S.enemies.forEach(e => { e.hp = 0; });
  S.heroes.forEach(h => { h.x = S.stairs.x; h.y = S.stairs.y; });
  R.rsStep(S, []); R.rsStep(S, []);
  ok(!!S.pick, 'отряд на открытой лестнице должен перейти к выбору награды');
  R.rsChoose(S, 0, 1);
  for (let k = 0; k < 60 * 21 && S.pick; k++) R.rsStep(S, []);
  ok(!S.pick && S.floor === 1 && S.heroes.every(h => h.ups.length === 1), 'таймер выбора награды не сработал: ' + JSON.stringify(S.heroes.map(h => h.ups)));
}

// 7. сид дня одинаков у всех и меняется по датам
ok(R.rsSeedOfDay('2026-10-22') === R.rsSeedOfDay('2026-10-22') && R.rsSeedOfDay('2026-10-22') !== R.rsSeedOfDay('2026-10-23'), 'сид дня');

// 8. в ядре нет того, что ломает переигровку в другом браузере
{
  const src = fs.readFileSync(path.join(__dirname, '../js/run/runsim.js'), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'Math.sin', 'Math.cos', 'Math.atan2', 'Math.hypot', 'Math.pow', '**', 'Math.exp', 'Math.log', 'Date.now', '.sort(']) ok(!src.includes(bad), `в runsim.js нельзя ${bad} — переигровка разойдётся`);
}

console.log(fails.length ? `Проверка ядра забега: провалов ${fails.length}` : 'Проверка ядра забега: всё в порядке');
process.exit(fails.length ? 1 : 0);
