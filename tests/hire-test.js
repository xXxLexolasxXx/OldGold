'use strict';
// Найм в окне здания (js/hire.js): блок «Работник» у каждого здания с мастером, «Сюда»/«Обмен» между зданиями,
// «Обучить» с бронью места под это здание (выпускник идёт именно сюда), подсказки «почему нельзя», сохранение, кооп.
// Запуск: node tests/hire-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const PLACE = `portraitURL = () => ''; buildingIconURL = () => ''; iconURL = () => '';
  const place = (type, near, far) => {
    const hub = near || Game.buildings.find(b => b.type === 'storehouse');
    for (let rr = far || 3; rr < 40; rr++) for (let k = 0; k < 28; k++) {
      const x = Math.round(hub.doorX + Math.cos(k * 0.5) * rr * 1.6), y = Math.round(hub.doorY + Math.sin(k * 0.5) * rr);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { const q = placeBuilding(type, x, y, true, 0); q.state = 'done'; q.hold = false; return q; }
    }
    throw new Error('нет места ' + type);
  };
  const clearType = t => { for (const u of Game.units) if (u.type === t) { if (u.home && u.home.worker === u) u.home.worker = null; u.home = null; u.type = 'serf'; } };`;

// 1) окно у всех зданий с мастером рисуется, есть «Работник · n/1» и кнопка/причина
{
  const sim = S.newSim(7);
  S.runFor(sim, 30, 10, () => {});
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${PLACE} ${code} })())`));
  const r = J(`const out = [];
    for (const t in BUILDINGS) {
      const d = BUILDINGS[t];
      if (!d.worker || d.hidden) continue;
      let b; try { b = place(t); } catch (e) { out.push(t + ': ' + e.message); continue; }
      const h = hireHTML(b);
      if (!/Работник · [01]\\/1/.test(h)) out.push(t + ': нет строки «Работник»');
      if (!hireStaffed(b) && !/data-act="hire"/.test(h)) out.push(t + ': нет кнопки «Обучить»');
      try { infoBuilding(b); } catch (e) { out.push(t + ': infoBuilding: ' + e.message); }
    }
    return out;`);
  for (const e of r) ok(false, 'окно: ' + e);
  console.log(`окно здания: ${r.length ? r.length + ' ошибок' : 'все типы OK'}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 2) «Сюда» и «Обмен»: перевод между двумя пекарнями, свободный мастер вместо работающего, запреты
{
  const sim = S.newSim(8);
  S.runFor(sim, 20, 10, () => {});
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${PLACE} ${code} })())`));
  const r = J(`clearType('baker');
    const A = place('bakery'), B = place('bakery', A, 4);
    const u = spawnUnit('baker', A.doorX, A.doorY), v = spawnUnit('baker', B.doorX, B.doorY), w = spawnUnit('baker', A.doorX, A.doorY + 1);
    const res = {};
    res.a1 = hireAssign(A, u); res.b1 = hireAssign(B, v);
    res.okA = A.worker === u && u.home === A; res.okB = B.worker === v && v.home === B;
    res.cands = hireCands(A).map(c => c.u.id).join(',');
    res.swap = hireAssign(A, v);
    res.swapped = A.worker === v && v.home === A && B.worker === u && u.home === B;
    res.free = hireAssign(A, w);
    res.freeOk = A.worker === w && w.home === A && v.home === null && B.worker === u;
    res.same = hireAssign(A, w);
    const s = spawnUnit('serf', A.doorX, A.doorY);
    res.wrong = hireAssign(A, s);
    v.brk = { kind: 'smoke' };
    res.brk = hireAssign(A, v);
    v.brk = null;
    res.html = /Обмен|Сюда/.test(hireHTML(A));
    res.ids = [u.id, v.id, w.id].join(',');
    return res;`);
  ok(r.a1 === null && r.b1 === null && r.okA && r.okB, 'не удалось поставить пекарей в пекарни');
  ok(r.swap === null && r.swapped, 'обмен между пекарнями не сработал');
  ok(r.free === null && r.freeOk, 'свободный пекарь не встал на место, прежний не освободился');
  ok(!!r.same && !!r.wrong && !!r.brk, `нет запретов: тот же ${r.same}, не та профессия ${r.wrong}, перекур ${r.brk}`);
  ok(r.html, 'в окне занятой пекарни нет списка «поставить другого»');
  S.runFor(sim, 20, 10, () => {});
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
  console.log(`перевод: обмен ${r.swapped ? 'OK' : '✗'}, свободный ${r.freeOk ? 'OK' : '✗'}`);
}

// 3) «Обучить»: бронь — выпускник идёт в дальнюю пекарню, где нажали, а не в ближнюю; повторно нельзя; сохранение
{
  const sim = S.newSim(9);
  S.runFor(sim, 20, 10, () => {});
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${PLACE} ${code} })())`));
  const r0 = J(`clearType('baker');
    let sc = Game.buildings.find(b => b.type === 'school' && b.state === 'done');
    if (!sc) sc = place('school');
    sc.queue.length = 0; sc.training = null; sc.stock.gold = 5;
    const near = place('bakery', sc, 3), far = place('bakery', sc, 14);
    Game.__near = near.id; Game.__far = far.id;
    const bad0 = hireTrainWhy(far);
    const t1 = hireTrain(far), t2 = hireTrain(far);
    return { bad0, t1, t2, req: far.hireReq, q: sc.queue.join(','), html: /учится в школе/.test(hireHTML(far)) };`);
  ok(r0.bad0 === null && r0.t1 === null, 'обучение запрещено без причины: ' + r0.bad0 + ' / ' + r0.t1);
  ok(!!r0.t2, 'вторая заявка в то же здание прошла (должно быть «уже учится»)');
  ok(r0.req === 1 && r0.q === 'baker', `бронь не поставлена: req ${r0.req}, очередь ${r0.q}`);
  ok(r0.html, 'окно не показывает «учится в школе»');
  // сохранение посреди учёбы
  const save = JSON.parse(sim.h.run('JSON.stringify(serializeGame())'));
  ok(save.buildings.some(b => b.id === sim.h.run('Game.__far') && b.hireReq === 1), 'бронь не попала в сохранение');
  sim.h.ctx.__s = save; sim.h.run('applySave(__s)');
  ok(sim.h.run('Game.buildings.find(b => b.id === Game.__far).hireReq') === 1, 'бронь потерялась после загрузки');
  sim.h.run(`for (const s of Game.buildings) if (s.type === 'school') s.stock.gold = Math.max(s.stock.gold, 5)`);
  let at = -1;
  for (let s = 1; s <= 90 && at < 0; s++) { S.runFor(sim, 1, 1, () => {}); if (sim.h.run('(() => { const b = Game.buildings.find(b => b.id === Game.__far); return !!(b && b.worker && b.worker.home === b); })()')) at = s; }
  ok(at > 0, 'выпускник не пришёл в здание с бронью за 90 с');
  const r1 = J(`const far = Game.buildings.find(b => b.id === Game.__far), near = Game.buildings.find(b => b.id === Game.__near);
    return { req: far.hireReq, type: far.worker && far.worker.type, near: hireStaffed(near) };`);
  ok(r1.type === 'baker' && r1.req === 0, `в здание с бронью пришёл не тот (${r1.type}) или бронь не снята (${r1.req})`);
  ok(!r1.near, 'ближняя пекарня без брони перехватила выпускника');
  console.log(`обучение с бронью: ${at > 0 ? `пришёл через ${at} с` : '✗'}`);
  ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 4) кооп: «hire» (право train) и «assign» (право manage) считает сервер, бронь уходит клиентам в пакете здания
{
  const sim = S.newSim(5, { coop: true });
  S.stepN(sim, 40);
  const h = sim.h;
  const J = code => JSON.parse(h.run(`JSON.stringify((() => { ${PLACE} ${code} })())`));
  const ids = J(`clearType('baker');
    let sc = Game.buildings.find(b => b.type === 'school' && b.state === 'done'); if (!sc) sc = place('school');
    sc.queue.length = 0;
    const A = place('bakery'), B = place('bakery', A, 4);
    const u = spawnUnit('baker', B.doorX, B.doorY); hireAssign(B, u);
    return { A: A.id, B: B.id, u: u.id };`);
  h.run(`coopCmd("хост", JSON.stringify({ t: "bact", id: ${ids.A}, act: "hire" }), true)`);
  ok(J(`return Game.buildings.find(b => b.id === ${ids.A}).hireReq`) === 1, 'кооп: «Обучить» не поставило бронь');
  ok(J(`return serializeBuilding(Game.buildings.find(b => b.id === ${ids.A})).hireReq`) === 1, 'кооп: бронь не уходит в пакете здания');
  h.run('coop.perms.manage = false');
  h.run(`coopCmd("гость", JSON.stringify({ t: "bact", id: ${ids.A}, act: "assign", u: ${ids.u} }), false)`);
  ok(J(`return Game.unitMap.get(${ids.u}).home.id`) === ids.B, 'кооп: гость без права «manage» перевёл гнома');
  h.run(`coopCmd("хост", JSON.stringify({ t: "bact", id: ${ids.A}, act: "assign", u: ${ids.u} }), true)`);
  ok(J(`return Game.unitMap.get(${ids.u}).home.id`) === ids.A, 'кооп: «Сюда» не перевело гнома');
  S.stepN(sim, 40);
  ok(!sim.errors.length, 'кооп: исключения: ' + sim.errors.slice(0, 2).join(' | '));
}

// 5) места по уровням (WORK_SLOTS): дом лесоруба 3-го уровня берёт второго лесничего, оба переживают сохранение;
//    сводка жителей в окне «Школа» считает их
{
  const sim = S.newSim(11);
  S.runFor(sim, 20, 10, () => {});
  const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${PLACE} ${code} })())`));
  const r = J(`clearType('woodcutter');
    const A = place('woodcutter');
    spawnUnit('woodcutter', A.doorX, A.doorY + 1); spawnUnit('woodcutter', A.doorX + 1, A.doorY + 1);
    const res = { s1: workSlots(A) };
    dispatchWorkers();
    res.n1 = bldStaff(A).length;
    upgradeBuilding(A, true); upgradeBuilding(A, true);
    res.lv = A.level; res.s3 = workSlots(A);
    dispatchWorkers();
    res.n3 = bldStaff(A).length; res.main = !!(A.worker && A.worker.home === A);
    res.html = /Работники · 2\\/2/.test(hireHTML(A));
    res.census = /Лесничий<\\/span><b>2/.test(wkCensusHTML());
    Game.__wc = A.id;
    return res;`);
  ok(r.s1 === 1 && r.n1 === 1, `ур.1: мест ${r.s1}, работает ${r.n1} (ждали 1/1)`);
  ok(r.lv === 3 && r.s3 === 2 && r.n3 === 2 && r.main, `ур.3: уровень ${r.lv}, мест ${r.s3}, работает ${r.n3}, первый ${r.main}`);
  ok(r.html, 'окно дома лесоруба 3-го уровня не показывает «Работники · 2/2»');
  ok(r.census, 'сводка жителей не насчитала двух лесничих');
  const save = JSON.parse(sim.h.run('JSON.stringify(serializeGame())'));
  sim.h.ctx.__s = save; sim.h.run('applySave(__s)');
  ok(sim.h.run('(() => { const b = Game.buildings.find(b => b.id === Game.__wc); return bldStaff(b).length + (b.worker && b.worker.home === b ? 10 : 0); })()') === 12, 'после загрузки в доме лесоруба не два работника');
  S.runFor(sim, 30, 10, () => {});
  ok(sim.h.run('bldStaff(Game.buildings.find(b => b.id === Game.__wc)).length') === 2, 'второй лесничий ушёл из дома за 30 с');
  ok(!sim.errors.length, 'места по уровням: исключения: ' + sim.errors.slice(0, 2).join(' | '));
  console.log(`места по уровням: ур.1 ${r.n1}/${r.s1}, ур.3 ${r.n3}/${r.s3}`);
}

console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nНайм в окне здания: OK');
process.exit(fails.length ? 1 : 0);
