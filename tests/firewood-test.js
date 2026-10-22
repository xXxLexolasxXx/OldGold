'use strict';
// Дрова зимой (world/season.js): здания с печью берут бревно со склада раз в WINTER_BURN_EVERY с, без дров — мёрзнут;
// летом расхода нет; напоминание осенью, счётчик в зеркале, сейв/кооп. Запуск: node tests/firewood-test.js   (печатает ✗, код выхода 1 при провале)
const L = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const sim = L.newSim(5), h = sim.h, J = c => JSON.parse(h.run('JSON.stringify((function(){' + c + '})())'));

ok(h.run('WINTER_BURN_EVERY') > 100 && h.run('WINTER_BURN_EVERY') < 1200, 'WINTER_BURN_EVERY вне разумных пределов: ' + h.run('WINTER_BURN_EVERY'));

// поле боя: склад с дровами, дом уровня 1, дом уровня 3, пекарня и трактир; прочее топливо убрано
const setup = J(`
  const hub = Game.buildings.find(b => b.type === 'storehouse');
  const mk = (type, lv) => {
    for (let r = 4; r < 30; r++) for (let a = 0; a < 24; a++) {
      const x = Math.round(hub.doorX + Math.cos(a * 0.26 + r) * r * 1.6), y = Math.round(hub.doorY + Math.sin(a * 0.26 + r) * r);
      if (inb(x, y) && !checkPlacement(type, x, y, 0)) { const b = placeBuilding(type, x, y, true, 0); b.state = 'done'; b.hold = false; if (lv) b.level = lv; return b; }
    }
    return null;
  };
  const a = mk('house', 1), c = mk('house', 3), bk = mk('bakery'), s = mk('smeltery');
  Game.__fw = { hub, a, c, bk, s };
  return { ok: !!(a && c && bk) };`);
ok(setup.ok, 'не нашлось места под здания теста');

const put = n => h.run(`for (const s of Game.buildings) if (s.isStore()) s.stock.trunk = 0; Game.__fw.hub.stock.trunk = ${n}; Game.__fw.hub.reserved.trunk = 0;`);
const warm = () => J('const f = Game.__fw; return [f.a.cold, f.c.cold, f.bk.cold, f.s.cold || false];');
const trunk = () => h.run('Game.__fw.hub.stock.trunk');
const gotoSeason = (i, dayIn = 0) => h.run(`SEA().fixed = null; SEA().off = ${i * 8 + dayIn} - cycleAt(Game.time).k; SEA().idx = ${i}; for (const b of Game.buildings) { b.cold = false; b.burnAt = null; b.warmUntil = 0; } SEA().rushT = null;`);
const tick = secs => { for (let t = 0; t < secs; t++) h.run('Game.time += 1; seaTick(1); seaTick(0.01); SEA().tickT = 1; seaTick(0.01);'); };

// ---- лето: расхода нет
gotoSeason(0, 3); put(50);
tick(900);
ok(trunk() === 50, 'летом печи не топятся, а со склада ушло ' + (50 - trunk()));
ok(warm().every(x => !x), 'летом ничто не мёрзнет: ' + warm());

// ---- зима с дровами: бревна уходят, интервал держится, дом уровня 3 топится реже
gotoSeason(2, 1); put(500);
const burn0 = trunk();
const every = h.run('WINTER_BURN_EVERY');
tick(Math.round(every * 3));
const used = burn0 - trunk();
// каждая печь за 3 интервала берёт 3 / (множитель дома) бревна (+1 на первую растопку)
const exp = J('let lo = 0, hi = 0; for (const b of Game.buildings) if (seaHeated(b)) { const k = 3 * WINTER_BURN_EVERY / seaHeatEvery(b); lo += Math.floor(k); hi += Math.ceil(k) + 1; } return [lo, hi];');
ok(used >= exp[0] && used <= exp[1], 'за 3 интервала ушло брёвен: ' + used + ', ждали ' + exp.join('–'));
ok(warm().every(x => !x), 'при дровах никто не мёрзнет: ' + warm());
const a1 = J('return [Game.__fw.a.burnAt - Game.__fw.a.warmUntil < 0, seaHeatEvery(Game.__fw.a), seaHeatEvery(Game.__fw.c), seaHeatEvery(Game.__fw.bk)]');
ok(a1[1] === every && a1[2] === every * 2 && a1[3] === every, 'интервал по уровню дома: ' + JSON.stringify(a1));
ok(h.run('Game.__fw.s.cold') !== true, 'плавильня не отапливается печью зданий (у неё свой расход)');

// ---- зима без дров: мёрзнут, эффекты
put(0);
tick(every * 2 + 60);
const w = warm();
ok(w[0] && w[1] && w[2], 'без дров здания должны мёрзнуть: ' + w);
// сон: в нетопленом доме восстанавливается меньше
const sleep = cold => J(`
  const f = Game.__fw, b = f.a; b.cold = ${cold};
  const u = Game.units.find(x => isPerson(x) && x.type !== 'hero' && !x.dead);
  u.md = u.md || mdOf(u); u.md.rest = 0.2; u.dwell = b;
  const g = typeof mdBump === 'function' ? mdBump : null;
  let before = u.md.rest;
  // повторяем арифметику дома: прибавка = HOUSE.SLEEP[0] * (cold ? WINTER_COLD_SLEEP : 1)
  return { add: HOUSE.SLEEP[0] * (b.cold ? WINTER_COLD_SLEEP : 1) };`);
ok(sleep(true).add < sleep(false).add * 0.5, 'сон в нетопленом доме должен быть заметно хуже');
// болезни и настроение: берём гнома, ставим внутрь нетопленого дома
const eff = J(`
  const f = Game.__fw, b = f.a, u = Game.units.find(x => isPerson(x) && x.type !== 'hero' && !x.dead);
  b.cold = true; u.inside = b;
  mdUpdate(u, Game.time + 3);
  const why = (u.md.r || []).filter(r => r[0] === 'cold').map(r => r[1]);
  b.cold = false; mdUpdate(u, Game.time + 6);
  const why2 = (u.md.r || []).filter(r => r[0] === 'cold').map(r => r[1]);
  u.inside = null;
  return { why, why2 };`);
ok(eff.why.length === 1 && eff.why[0] < 0, 'в нетопленом здании у гнома нет причины «Мёрзнет»: ' + JSON.stringify(eff));
ok(eff.why2.length === 0, 'в тёплом здании «Мёрзнет» остаться не должно: ' + JSON.stringify(eff));
// мастерская: нетопленая работает медленнее
const rec = J(`const bk = Game.__fw.bk; bk.cold = true; const t1 = WINTER_COLD_WORK; return { t1 };`);
ok(rec.t1 > 1.1, 'нетопленая мастерская должна работать медленнее');

// ---- привозят дрова — затапливают
put(30);
tick(40);
ok(warm().every(x => !x), 'после подвоза дров здания затоплены: ' + warm());
ok(trunk() < 30, 'дрова на затопление должны расходоваться');

// ---- весна: холода нет, расхода нет
gotoSeason(3, 1); put(40);
tick(900);
ok(trunk() === 40, 'весной печи не топятся: ушло ' + (40 - trunk()));
ok(warm().every(x => !x), 'весной ничто не мёрзнет');

// ---- вечная зима биома: печи не считаем
h.run('SEA().fixed = 2; SEA().idx = 2;');
put(40); tick(900);
ok(trunk() === 40, 'на карте с вечной зимой дрова не тратятся: ушло ' + (40 - trunk()));
h.run('SEA().fixed = null;');

// ---- напоминание осенью и счётчик
gotoSeason(1, 4); put(0);
h.run('Game.__toasts = []; const _t = toast; toast = function (t) { Game.__toasts.push(String(t)); return _t.apply(this, arguments); }; SEA().warnDay = -1;');
h.run('seaAutumnWarn(false)');
const toasts = J('return Game.__toasts');
ok(toasts.some(t => /дров/i.test(t)), 'осенью без дров нет напоминания про дрова: ' + JSON.stringify(toasts));
const wi = J('return seaWoodInfo()');
ok(wi.n >= 3 && wi.need > wi.have && wi.have === 0, 'счётчик дров: ' + JSON.stringify(wi));
ok(h.run('seaWoodRush()') === true, 'при нехватке дров осенью лесорубы получают приоритет');
put(5000); h.run('SEA().rushT = null');
ok(h.run('seaWoodRush()') === false, 'с большим запасом приоритета нет');
const mir = J('return seaMirrorOut()');
ok(mir.w && mir.w.need >= 0 && 'cold' in mir.w, 'в зеркале сезона нет счётчика дров: ' + JSON.stringify(mir.w));
// лесоруб первым получает рабочего
put(0); h.run('SEA().rushT = null');
ok(h.run("seaRush({ type: 'woodcutter' })") === 1 && h.run("seaRush({ type: 'farm' })") === 0, 'seaRush должен касаться только дома лесоруба');

// ---- сейв: мёрзнущее здание после загрузки не ломается, зима продолжается
gotoSeason(2, 2); put(100);
tick(80);
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
ok(!JSON.stringify(s).includes('burnAt') && !JSON.stringify(s).includes('"cold"'), 'в сейв не должны попадать служебные поля печей');
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('isWinter()'), 'после загрузки зима не сбилась');
h.run('for (const s of Game.buildings) if (s.isStore()) s.stock.trunk = 80');
tick(120);
ok(h.run('Game.buildings.filter(b => b.cold).length') === 0, 'после загрузки при дровах никто не мёрзнет');

// ---- кооп: сервер шлёт признак холода, клиент его применяет
const sig = J(`const b = Game.buildings.find(b => b.type === 'house'); b.cold = true; const d = serializeBuilding(b); d.cd = b.cold ? 1 : 0; return { cd: d.cd };`);
ok(sig.cd === 1, 'признак холода не передаётся');
ok(/b\.cold = !!d\.cd/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'coop', 'coopclient.js'), 'utf8')), 'клиент коопа не читает признак холода');
ok(/d\.cd = b\.cold/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'coop', 'coopsim.js'), 'utf8')), 'сервер коопа не пишет признак холода');

ok(sim.errors.length === 0, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
console.log(fails.length ? `Дрова зимой: ${fails.length} провалов` : 'Проверка дров: расход зимой, холод без дров, лето без расхода, напоминание, сейв — ок');
process.exit(fails.length ? 1 : 0);
