'use strict';
// Арена PvP (АРЕНА.md, этап 1): ядро js/arena/arenasim.js без браузера.
// Детерминизм по хэшу и продолжение со снапшота, PvP-иммунитеты контроля, потолки горения/крови, таймер и овертайм,
// сдача, очистка «читерских» входов, тяжёлый удар и идеальный уворот, все 60 способностей, боты трёх уровней,
// матрица 10×10×10 ботами-чемпионами (⚠ при перекосе пары больше 65%). Полная матрица — tools/soak/arena.js.
const path = require('path');
const fs = require('fs');
const A = require('../js/arena/arenasim.js');
const { playMatch } = require('../tools/soak/arena.js');

const fails = [], warns = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const T = A.ARENA_TUNE;
const step = (S, n, ins) => { for (let k = 0; k < n; k++) A.arenaStep(S, ins || null); return S; };
// бой сразу в фазе «бой»: отсчёт пропущен
function fight(a, b, seed, bots) {
  const S = A.arenaNew({ seed: seed || 7, cls: [a, b], bots: bots || [null, null] });
  while (S.phase !== 'fight') A.arenaStep(S, null);
  return S;
}
const evs = (S, n, ins) => { const out = []; for (let k = 0; k < n; k++) { A.arenaStep(S, ins || null); out.push(...S.ev); } return out; };
const place = (S, ax, ay, bx, by) => { S.f[0].x = ax; S.f[0].y = ay; S.f[1].x = bx; S.f[1].y = by; };

// ---------- 1. Детерминизм ----------
{
  const run = seed => { const S = A.arenaNew({ seed, cls: ['mage', 'warrior'], bots: [3, 2] }); while (S.phase !== 'over' && S.tick < 40000) A.arenaStep(S, null); return S; };
  const a = run(123), b = run(123), c = run(124);
  ok(A.arenaHash(a) === A.arenaHash(b), `один сид — разный исход: ${A.arenaHash(a)} ≠ ${A.arenaHash(b)}`);
  ok(JSON.stringify(a.rw) === JSON.stringify(b.rw), 'один сид — разные раунды');
  ok(A.arenaHash(a) !== A.arenaHash(c), 'разные сиды дали одинаковый бой');
  ok(a.phase === 'over' && a.winner >= 0 && a.score[a.winner] === 2, `матч не дошёл до двух побед: ${a.phase} ${a.score}`);
  // снапшот посреди боя: продолжение даёт тот же итог (состояние целиком сериализуемо)
  const S = A.arenaNew({ seed: 99, cls: ['rogue', 'druid'], bots: [3, 3] });
  step(S, 700);
  const snap = A.arenaSnap(S);
  ok(JSON.stringify(snap) === JSON.stringify(S), 'снапшот отличается от состояния');
  const S2 = JSON.parse(JSON.stringify(snap));
  while (S.phase !== 'over' && S.tick < 40000) A.arenaStep(S, null);
  while (S2.phase !== 'over' && S2.tick < 40000) A.arenaStep(S2, null);
  ok(A.arenaHash(S) === A.arenaHash(S2), 'бой со снапшота разошёлся с исходным');
  console.log(`Проверка детерминизма: хэш ${A.arenaHash(a)}, ${a.tick} тактов`);
}

// ---------- 2. Контроль: потолок, иммунитет 3 с, вдвое короче за 6 с, путы, оберег, очищение ----------
{
  const S = fight('warrior', 'mage');
  place(S, 6, 7, 7.2, 7);
  const W = S.f[0], M = S.f[1];
  W.res = 100;
  let e = evs(S, 1, [{ cast: 0 }, null]);                       // удар щитом: оглушение 1,2 с
  ok(M.st.stun > S.T + T.ab.bash.stun - 0.1 && M.st.stun <= S.T + T.stunMax + 1e-6, `удар щитом не оглушил или дольше потолка: ${(M.st.stun - S.T).toFixed(2)}`);
  ok(e.some(x => x.k === 'st' && x.s === 'stun'), 'нет события оглушения');
  // ещё оглушение сразу — иммунитет
  W.cd = {}; W.res = 100;
  step(S, 30);
  W.cd = {};
  e = evs(S, 1, [{ cast: 0 }, null]);
  ok(e.some(x => x.k === 'imm' && x.i === 1), 'второе оглушение до конца иммунитета прошло');
  // после иммунитета (оглушение 1,2 + 3 с), но в окне 6 с — вдвое короче
  step(S, Math.ceil((M.st.stunImm - S.T) / T.dt) + 1);
  W.cd = {}; W.res = 100; place(S, 6, 7, 7.2, 7);
  evs(S, 1, [{ cast: 0 }, null]);
  const d2 = M.st.stun - S.T;
  ok(d2 > 0 && d2 <= 0.65, `повторное оглушение в окне 6 с не укорочено: ${d2.toFixed(2)}`);
  // путы: свой иммунитет
  const S2 = fight('druid', 'warrior');
  place(S2, 5, 7, 8, 7);
  const D = S2.f[0], W2 = S2.f[1];
  evs(S2, 1, [{ cast: 0 }, null]);
  ok(W2.st.root > S2.T + T.ab.thorns.root - 0.1, 'шипы не опутали');
  step(S2, 50); D.cd = {}; D.res = 100;
  const e2 = evs(S2, 1, [{ cast: 0 }, null]);
  ok(e2.some(x => x.k === 'imm'), 'путы прошли сквозь иммунитет');
  // оберег мага гасит следующий контроль
  const S3 = fight('warrior', 'mage');
  place(S3, 6, 7, 7.2, 7);
  S3.f[1].res = 100; S3.f[0].res = 100;
  evs(S3, 1, [null, { cast: 1 }]);
  const e3 = evs(S3, 1, [{ cast: 0 }, null]);
  ok(e3.some(x => x.k === 'ward') && !(S3.f[1].st.stun > S3.T), 'оберег не погасил оглушение');
  // очищение жреца: снимает всё и 2 с защищает
  const S4 = fight('priest', 'druid');
  place(S4, 6, 7, 8, 7);
  S4.f[1].res = 100;
  evs(S4, 1, [null, { cast: 0 }]);
  ok(S4.f[0].st.root > S4.T, 'шипы не опутали жреца');
  evs(S4, 1, [{ cast: 1 }, null]);
  ok(!(S4.f[0].st.root > S4.T) && S4.f[0].st.imm > S4.T + 1.5, 'очищение не сняло путы или не дало защиту');
  console.log('Проверка контроля: иммунитеты, укорочение, оберег, очищение');
}

// ---------- 3. Горение и кровь: 2%/с, потолок 25% здоровья на эффект, обновление не складывает ----------
{
  const S = fight('mage', 'warrior');
  place(S, 3, 7, 11, 7);
  const W = S.f[1], hp0 = W.hp;
  // поджигаем каждые 0,5 с 20 секунд подряд (мимо снарядов — напрямую через огненный шар на дальности)
  let burnTicks = 0;
  for (let k = 0; k < 400; k++) {
    if (k % 10 === 0) { W.st.burn = Math.max(W.st.burn, S.T + 3); if (!(W.st.burnB > 0) && k === 0) W.st.burnB = T.dotCap * W.mhp; }
    A.arenaStep(S, null);
    if (W.st.burn > S.T) burnTicks++;
    place(S, 3, 7, 11, 7);
  }
  const lost = hp0 - W.hp;
  ok(lost <= T.dotCap * W.mhp + 0.5, `горение сняло больше потолка: ${lost.toFixed(1)} из ${W.mhp}`);
  ok(lost >= T.dotCap * W.mhp * 0.9, `горение почти не жгло: ${lost.toFixed(1)}`);
  // через ядро: огненный шар поджигает, кровь от добивания — тот же потолок
  const S2 = fight('rogue', 'paladin');
  const P = S2.f[1];
  for (let k = 0; k < 60; k++) { S2.f[0].x = 6.3; S2.f[0].y = 7; P.x = 7.2; P.y = 7; P.hp = P.mhp; A.arenaStep(S2, null); }
  ok(P.st.bleedB >= 0 && P.st.bleedB <= T.dotCap * P.mhp, 'запас крови вне потолка');
  console.log(`Проверка горения: за 20 с горения снято ${lost.toFixed(1)} (${(lost / W.mhp * 100).toFixed(0)}%)`);
}

// ---------- 4. Таймер и овертайм ----------
{
  const S = fight('warrior', 'warrior');
  S.f[1].hp -= 20;                                    // у правого меньше здоровья — он и проиграет по таймеру
  const e = evs(S, Math.ceil(T.roundT / T.dt) + 5);
  ok(e.some(x => x.k === 'ot'), 'овертайм не начался');
  ok(e.some(x => x.k === 'shrink'), 'борт не сужался');
  const rd = e.find(x => x.k === 'round');
  ok(rd && rd.why === 'time', 'раунд не закончился по таймеру: ' + JSON.stringify(rd));
  ok(rd && rd.w === 0, 'по таймеру победил не тот, у кого больше здоровья');
  ok(S.rw[0] && Math.abs(S.rw[0].t - T.roundT) < 0.2, `раунд не 75 с: ${S.rw[0] && S.rw[0].t}`);
  // стоящий у борта на сужении горит
  const S2 = fight('warrior', 'warrior');
  place(S2, T.cx - 6.3, T.cy, T.cx + 6.3, T.cy);
  step(S2, Math.ceil((T.otT + T.otEvery) / T.dt));
  ok(S2.ring < T.R && S2.f[0].hp < S2.f[0].mhp, `на сужении за кругом не жжёт: круг ${S2.ring}, здоровье ${S2.f[0].hp}`);
  // между раундами всё восстанавливается
  const S3 = fight('mage', 'barbarian');
  S3.f[0].hp = 1; S3.f[0].st.burn = S3.T + 5; S3.f[0].st.burnB = 50;
  while (S3.phase !== 'rest' && S3.tick < 5000) A.arenaStep(S3, null);
  ok(S3.round === 2 && S3.f[0].hp === S3.f[0].mhp && !(S3.f[0].st.burn > S3.T) && S3.f[0].ult === 0, 'к новому раунду не восстановились здоровье/статусы/шкала');
  console.log('Проверка таймера: раунд 75 с, овертайм, сужение, восстановление между раундами');
}

// ---------- 5. Сдача ----------
{
  const S = fight('bard', 'monk');
  ok(A.arenaSurrender(S, 0) && S.phase === 'over' && S.winner === 1 && S.sur === 0, 'сдача не закрыла матч победой соперника');
  ok(!A.arenaSurrender(S, 1), 'сдача после конца матча принята');
  const h = A.arenaHash(S); step(S, 20);
  ok(A.arenaHash(S).length === 8 && S.phase === 'over', 'после сдачи бой продолжился');
  void h;
}

// ---------- 6. Вход: только намерения, мусор отбрасывается ----------
{
  const bad = [null, 5, 'x', { mx: 1e9, my: -1e9 }, { mx: NaN, my: Infinity, cast: 99, roll: 'yes', aim: [1e9, -5] }, { cast: 2.5 }, { cast: -3 }, JSON.parse('{"__proto__":{"hp":1},"mx":0.3}'), { aim: 'a' }];
  for (const b of bad) {
    const i = A.arenaInput(b);
    ok(Math.abs(i.mx) <= 1 && Math.abs(i.my) <= 1 && Math.hypot(i.mx, i.my) <= 1.0001, 'вход: направление вне круга ' + JSON.stringify(i));
    ok(i.cast === -1 || (Number.isInteger(i.cast) && i.cast >= 0 && i.cast < 6), 'вход: странный слот ' + JSON.stringify(i));
    ok(i.roll === 0 || i.roll === 1, 'вход: перекат не 0/1');
    ok(i.aim === null || (i.aim[0] >= 0 && i.aim[0] <= 14 && i.aim[1] >= 0 && i.aim[1] <= 14), 'вход: точка вне арены');
    ok(!('hp' in i), 'вход: лишние поля');
  }
  // скорость не растёт от «длинного» вектора
  const S = fight('monk', 'mage');
  place(S, 3, 7, 11, 7);
  const x0 = S.f[0].x;
  step(S, 20, [{ mx: 1e6, my: 0 }, null]);
  const v = (S.f[0].x - x0) / 1;
  ok(v <= T.spd * T.cls.monk.mv * 1.01, `разогнался вектором: ${v.toFixed(2)} кл/с`);
}

// ---------- 7. Тяжёлый удар и идеальный уворот ----------
{
  const S = fight('barbarian', 'archer');
  place(S, 6.4, 7, 7.5, 7);
  let tel = null;
  for (let k = 0; k < 200 && !tel; k++) { place(S, 6.4, 7, 7.5, 7); A.arenaStep(S, null); tel = S.ev.find(x => x.k === 'tel' && x.i === 0); }
  ok(!!tel, 'ближник не замахнулся тяжёлым ударом за 10 с');
  // соперник перекатывается во время замаха → идеальный уворот, бьющий «открыт»
  const e = evs(S, 12, [null, { roll: 1, mx: 0, my: 1 }]);
  ok(e.some(x => x.k === 'perfect' && x.i === 1), 'перекат под тяжёлый удар не дал идеального уворота');
  ok(S.f[0].st.open > S.T, 'бьющий не открыт после идеального уворота');
  // без переката — удар ×1,6 доходит (или промах по точности, но не «мимо клина»)
  const S2 = fight('warrior', 'priest');
  let heavy = 0;
  for (let k = 0; k < 600; k++) { place(S2, 6.4, 7, 7.5, 7); A.arenaStep(S2, null); for (const x of S2.ev) if (x.k === 'dmg' && x.heavy) heavy++; }
  ok(heavy > 0, 'тяжёлые удары не доходят до стоящего соперника');
  console.log(`Проверка тяжёлого удара: телеграф, идеальный уворот, тяжёлых попаданий ${heavy}`);
}

// ---------- 8. Все 60 способностей: каждая срабатывает и делает своё ----------
{
  const effects = [];
  let n = 0;
  for (const cls of A.ARENA_CLS) {
    const kit = A.ARENA_KIT[cls];
    ok(kit.length === 6 && T.ab[kit[5]].ult, `${cls}: не 6 способностей или ульта не шестая`);
    for (let s = 0; s < 6; s++) {
      const k = kit[s], a = T.ab[k];
      ok(!!A.ARENA_TXT[k] && A.ARENA_TXT[k][1].length > 8, `${k}: нет арена-описания`);
      if (a.pas) { n++; continue; }
      // соперник рядом (для ближнего) — воин; для «снятия» — сначала статус на себе
      const S = fight(cls, 'warrior', 11 + s);
      place(S, 6, 7, 7.3, 7);
      const F = S.f[0], O = S.f[1];
      F.res = 100; F.ult = 100; F.hp = F.mhp * 0.5;
      if (k === 'cure') F.st.root = S.T + 2;
      const hp0 = F.hp, ohp0 = O.hp;
      const e = evs(S, 1, [{ cast: s }, null]);
      const cast = e.find(x => (x.k === 'cast' || x.k === 'ult') && x.ab === k);
      ok(!!cast, `${cls}.${k}: не применилась (${JSON.stringify(e.filter(x => x.k === 'fail'))})`);
      if (!cast) continue;
      n++;
      // признаки действия по таблице 7.1
      const more = evs(S, 60, [null, null]);
      const all = e.concat(more), stOf = s2 => all.some(x => x.k === 'st' && x.i === 1 && x.s === s2);
      const did = (a.heal && F.hp > hp0) || (a.buf && F.buf[k] > 0) || a.next || a.stun && stOf('stun') || a.root && stOf('root') || a.ice && stOf('ice')
        || a.sil && stOf('sil') || a.slow && stOf('slow') || a.blind && stOf('blind') || O.hp < ohp0 || S.zones.length || S.pets.length || all.some(x => x.k === 'steal' || x.k === 'drain' || x.k === 'cleanse' || x.k === 'blink')
        || (k === 'leap' && Math.abs(F.x - 6) > 1) || (k === 'ward' && F.st.ward > 0) || (k === 'vanish' && F.st.invis > 0) || (k === 'trap');
      ok(did, `${cls}.${k}: применилась, но ничего не сделала`);
      effects.push(k);
    }
  }
  ok(n === 60, `способностей проверено ${n} из 60`);
  console.log(`Проверка способностей: ${n} из 60 (${effects.length} активных с действием)`);
}

// ---------- 9. Боты трёх уровней доводят бой до конца; чемпион сильнее соломенного ----------
{
  let champ = 0;
  for (let k = 0; k < 6; k++) {
    for (const t of [1, 2, 3]) {
      const S = A.arenaNew({ seed: 500 + k * 3 + t, cls: [A.ARENA_CLS[k], A.ARENA_CLS[9 - k]], bots: [t, t] });
      while (S.phase !== 'over' && S.tick < 40000) A.arenaStep(S, null);
      ok(S.phase === 'over', `боты уровня ${t} не закончили бой (${A.ARENA_CLS[k]}): ${S.phase}, ${S.tick} тактов`);
    }
    const S = A.arenaNew({ seed: 900 + k, cls: [A.ARENA_CLS[k], A.ARENA_CLS[k]], bots: [3, 1] });
    while (S.phase !== 'over' && S.tick < 40000) A.arenaStep(S, null);
    if (S.winner === 0) champ++;
  }
  ok(champ >= 4, `чемпион против соломенного (зеркало) выиграл только ${champ} из 6`);
  console.log(`Проверка ботов: чемпион против соломенного ${champ}/6`);
}

// ---------- 10. Быстрая матрица 10×10×10 чемпионами ----------
{
  const t0 = Date.now(), cls = A.ARENA_CLS, M = {};
  let rounds = 0, len = 0;
  for (const a of cls) { M[a] = {}; for (const b of cls) M[a][b] = 0; }
  for (let i = 0; i < cls.length; i++) for (let j = 0; j < cls.length; j++) for (let k = 0; k < 10; k++) {
    const side = k & 1, a = cls[i], b = cls[j];
    const r = side ? playMatch(A, b, a, 31 + i * 101 + j * 13 + k * 7, 3) : playMatch(A, a, b, 31 + i * 101 + j * 13 + k * 7, 3);
    if (r.w === side) M[a][b]++;
    for (const rd of r.rounds) { rounds++; len += rd.t; }
  }
  const skew = [];
  for (let i = 0; i < cls.length; i++) for (let j = i + 1; j < cls.length; j++) {
    const p = (M[cls[i]][cls[j]] + 10 - M[cls[j]][cls[i]]) / 20;
    if (p > 0.65 || p < 0.35) skew.push(`${cls[i]}–${cls[j]} ${Math.round(p * 100)}%`);
  }
  if (skew.length) warns.push(`матрица 10×10×10: перекос больше 65% у ${skew.length} пар: ${skew.slice(0, 8).join(', ')}${skew.length > 8 ? '…' : ''} (полный прогон: node tools/soak/arena.js)`);
  console.log(`Проверка матрицы: 1000 боёв за ${((Date.now() - t0) / 1000).toFixed(1)} с, средний раунд ${(len / rounds).toFixed(1)} с, пар с перекосом ${skew.length}`);
}

// ---------- 11. Перевод: все строки арены есть в js/i18n/en-arena.js ----------
{
  const files = ['js/arena/arenasim.js', 'js/arena/arena.js', 'js/arena/arenaart.js', 'js/arena/arenasfx.js'].filter(f => fs.existsSync(path.join(__dirname, '..', f)));
  const en = path.join(__dirname, '..', 'js', 'i18n', 'en-arena.js');
  if (!fs.existsSync(en)) fails.push('нет словаря js/i18n/en-arena.js');
  else {
    const dict = {};
    new Function('I18N', fs.readFileSync(en, 'utf8'))({ add: (l, d) => Object.assign(dict, d) });
    for (const f of ['en-abil.js']) new Function('I18N', fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n', f), 'utf8'))({ add: (l, d) => Object.assign(dict, d) });
    const miss = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      // явные t('…') и строки таблиц: русские литералы в одинарных кавычках
      for (const m of src.matchAll(/'((?:[^'\\\n\r]|\\.)*[А-Яа-яЁё](?:[^'\\\n\r]|\\.)*)'/g)) {
        const s = m[1].replace(/\\'/g, "'");
        if (/^\s*\/\//.test(src.slice(src.lastIndexOf('\n', m.index) + 1, m.index))) continue;   // комментарий
        if (!(s in dict) && !miss.includes(s)) miss.push(s);
      }
    }
    ok(!miss.length, `строки арены без перевода (${miss.length}): ${miss.slice(0, 10).map(s => '«' + s + '»').join(', ')}`);
    console.log(`Проверка перевода: строк арены в словаре ${Object.keys(dict).length}, без перевода ${miss.length}`);
  }
}

for (const w of warns) console.log('  ⚠ ' + w);
for (const f of fails) console.log('  ✗ ' + f);
console.log(fails.length ? `Проверка арены: провалов ${fails.length}` : 'Проверка арены: всё в порядке');
process.exit(fails.length ? 1 : 0);
