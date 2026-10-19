'use strict';
// Времена года: длина сезона = SEASON_DAYS (8) из config.js, смена сезонов по суткам, переход старых сейвов (4 суток), снег по сезонам,
// сезон событий-дилемм, кооп-зеркало. Запуск: node tests/season-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(5), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));

ok(h.run('SEASON_DAYS') === 8, 'SEASON_DAYS должен быть 8');
ok(h.run('SEA().len') === 8, 'новая игра: длина сезона ' + h.run('SEA().len'));
ok(h.run('SEA_LEN_DEFAULT') === h.run('SEASON_DAYS'), 'SEA_LEN_DEFAULT не ссылается на SEASON_DAYS');

// сутки 0..70: сезон меняется ровно каждые 8 суток по кругу лето → осень → зима → весна
h.run('Game.sea.off = 0; Game.sea.fixed = null');
const rows = J('const out = []; const base = cycleAt(Game.time).k; for (let d = 0; d < 70; d++) { SEA().off = d - base; out.push([seaIdx(), seaDayIn(), seaYear(), dilSeason()]); } return out;');
rows.forEach((r, d) => {
  ok(r[0] === Math.floor(d / 8) % 4, `сутки ${d}: сезон ${r[0]}, ждали ${Math.floor(d / 8) % 4}`);
  ok(r[1] === d % 8, `сутки ${d}: день в сезоне ${r[1]}, ждали ${d % 8}`);
  ok(r[2] === Math.floor(d / 32), `сутки ${d}: год ${r[2]}`);
  ok(r[3] === (r[0] + 1) % 4, `сутки ${d}: сезон дилемм ${r[3]} не совпал с сезоном игры ${r[0]}`);
});

// подпись: «день N из 8»
h.run('SEA().off = 3 - cycleAt(Game.time).k;');
ok(/день 4 из 8/.test(h.run('seaChipText()')) || /4\/8/.test(h.run('seaChipText()')), 'в подписи нет счётчика дней: ' + h.run('seaChipText()'));

// сохранение: v2, длина 8
let s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(s.sea && s.sea.v === 2 && s.sea.len === 8, 'в сейве нет v:2/len:8: ' + JSON.stringify(s.sea && [s.sea.v, s.sea.len]));
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('SEA().len') === 8 && h.run('seaDayIn()') === 3, 'сейв v2 прыгнул: len=' + h.run('SEA().len') + ' день=' + h.run('seaDayIn()'));

// старый сейв (сезон 4 суток, без v): тот же год, сезон и день в нём, длина растёт до 8
for (const [day, idxWant, dayIn, yr] of [[0, 0, 0, 0], [6, 1, 2, 0], [9, 2, 1, 0], [13, 3, 1, 0], [17, 0, 1, 1], [27, 2, 3, 1]]) {
  const old = JSON.parse(JSON.stringify(s));
  const k = h.run('cycleAt(Game.time).k');
  old.sea = { off: day - k, len: 4, snow: 0, ice: 0, idx: Math.floor(day / 4) % 4, yr: Math.floor(day / 16), fy: Math.floor(day / 16), sy: -1, fx: null, lost: 0, pl: 0, fd: 0 };
  h.ctx.__s = old; h.run('applySave(__s)');
  const g = J('return [seaIdx(), seaDayIn(), seaYear(), SEA().len, SEA().idx]');
  ok(g[3] === 8, `старый сейв, сутки ${day}: длина ${g[3]}`);
  ok(g[0] === Math.floor(day / 4) % 4 && g[4] === g[0], `старый сейв, сутки ${day}: сезон прыгнул ${Math.floor(day / 4) % 4} → ${g[0]}`);
  ok(g[1] === day % 4, `старый сейв, сутки ${day}: день в сезоне прыгнул ${day % 4} → ${g[1]}`);
  ok(g[2] === Math.floor(day / 16), `старый сейв, сутки ${day}: год прыгнул ${Math.floor(day / 16)} → ${g[2]}`);
}
// совсем старый сейв (без sea): лето с текущих суток, 8 суток
const bare = JSON.parse(JSON.stringify(s)); delete bare.sea;
h.ctx.__s = bare; h.run('applySave(__s)');
ok(h.run('seaIdx()') === 0 && h.run('seaDayIn()') === 0 && h.run('SEA().len') === 8, 'сейв без sea не начался с лета/8 суток');


// зимняя кормёжка: запас «по расчёту» seaHayInfo() переживает всю зиму без потерь, половина запаса — потери есть, но не всё стадо
const feedWinter = frac => J(`
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  for (const b of Game.buildings.filter(b => b.type === 'swine')) { b.removed = true; Game.buildings.splice(Game.buildings.indexOf(b), 1); }
  let sw = null;
  for (let r = 4; r < 20 && !sw; r++) for (let a = 0; a < 16 && !sw; a++) {
    const x = Math.round(hub.doorX + Math.cos(a * 0.4) * r * 1.5), y = Math.round(hub.doorY + Math.sin(a * 0.4) * r);
    if (inb(x, y) && !checkPlacement('swine', x, y, 0)) sw = placeBuilding('swine', x, y, true, 0);
  }
  if (!sw) return { err: 'нет места' };
  sw.state = 'done'; sw.stock.pig = 16; sw.pigs = sw.pigs || []; Game.animals = Game.animals.filter(a => !SEA_WILD_KINDS.includes(a.kind) || a.owner || a.tamedBy);
  const S = SEA(); S.off = 16 - cycleAt(Game.time).k; S.lost = 0; S.pigsLost = 0;
  const need = seaHayInfo().need;
  sw.stock.hay = Math.round(need * ${frac});
  const rounds = Math.ceil(S.len * SEA_FEEDS_PER_DAY);
  for (let i = 0; i < rounds; i++) seaFeedRound();
  return { need, rounds, left: seaHerd(sw), lost: S.pigsLost };`);
const full = feedWinter(1.0), half = feedWinter(0.5);
ok(!full.err && full.rounds === 12, 'кормёжек за зиму из 8 суток должно быть 12: ' + JSON.stringify(full));
ok(full.lost === 0 && full.left === 16, 'расчётного запаса сена не хватает на зиму: ' + JSON.stringify(full));
ok(half.lost > 0 && half.left > 0, 'половина запаса: падёж должен быть частичным, не полным: ' + JSON.stringify(half));

// плавность: к концу осени припорошило (но земля ещё не «промёрзла»), зимой сугробы, весной тает за треть сезона
const sn = J(`const S = SEA(), base = cycleAt(Game.time).k, o = {};
  const at = (d, f) => { S.off = d - base; return seaSnowTarget(seaIdx()); };
  o.sum = at(2); o.autEarly = at(8 + 2); o.autLast = at(8 + 7); o.win = at(16 + 3); o.spr0 = at(24); o.sprMid = at(24 + 4);
  return o;`);
ok(sn.sum === 0 && sn.autEarly === 0, 'летом/ранней осенью снега быть не должно');
ok(sn.autLast <= 0.3 && sn.autLast >= 0, 'под конец осени снег <= порога промерзания: ' + sn.autLast);
ok(sn.win === 1, 'зимой цель снега 1');
ok(sn.spr0 <= 1 && sn.sprMid === 0, 'весной снег должен сойти к середине сезона: ' + JSON.stringify([sn.spr0, sn.sprMid]));

// симуляция: полный сезонный круг ускоренно без исключений; снег ложится не мгновенно
h.run('Game.sea = seaNew(); Game.time = 0; for (const b of Game.buildings) b.hold = false;');
let sawPre = false, maxStep = 0, prevSnow = 0, seen = new Set(), maxSnowAut = 0, ice0 = 0;
for (let i = 0; i < 4 * 8 * 570 / 5; i++) {
  h.run('Game.time += 5; seaTick(5);');   // грубый ход: только сезонная часть
  const st = J('return [seaIdx(), SEA().snow, SEA().ice]');
  seen.add(st[0]);
  if (st[0] === 1) maxSnowAut = Math.max(maxSnowAut, st[1]);
  maxStep = Math.max(maxStep, Math.abs(st[1] - prevSnow)); prevSnow = st[1];
}
ok(seen.size === 4, 'за 32 суток прошло не 4 сезона: ' + [...seen]);
ok(maxSnowAut > 0.05 && maxSnowAut <= 0.4, 'осенью перед зимой должна лечь лёгкая пороша: ' + maxSnowAut.toFixed(2));
ok(maxStep < 0.1, 'снег меняется скачком: ' + maxStep.toFixed(3) + ' за 5 с');
ok(sim.errors.length === 0, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));

console.log(fails.length ? `Времена года: ${fails.length} провалов` : 'Проверка сезонов: 8 суток на сезон, сейвы, снег — ок');
process.exit(fails.length ? 1 : 0);
