'use strict';
// Сохранения переживают обновления. Запуск: node tests/save-test.js [игровых минут после загрузки, по умолчанию 4]
//  1. «золотые» сейвы tests/saves/*.json.gz (по одному-два на версию игры 0.9.5 … текущую, одиночка и мир коопа):
//     каждый грузится в ТЕКУЩИЙ код — без ошибок, здания/жители/запасы/герой на месте, игра идёт без исключений и с целыми инвариантами,
//     повторное сохранение даёт тот же сейв (ничего не теряется на втором круге), версия формата и игры проставляются;
//  2. повреждённые, обрезанные, огромные и «подпорченные» файлы: понятное сообщение, не пустой экран, игра живая;
//  3. копия «до обновления», откат на резервную копию, экспорт/импорт файлом, нехватка места в браузере;
//  4. миграции формата (цепочка, сейв из будущего), закрытие вкладки на телефоне;
//  5. мир коопа (server/worldio.js): загрузка после обновления, копия до обновления, откат на .bak / снимок, мир из будущего не затирается.
// Как пополнять библиотеку: tests/saves/README.md.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const L = require('./lib/sim');
const { createWorldIO } = require('../server/worldio');

const MIN = +process.argv[2] || 4;
const SAVES = path.join(__dirname, 'saves');
const fails = [];
let section = '';
const ok = (c, m) => { if (!c) { fails.push(`${section}: ${m}`); console.log(`  ✗ ${section}: ${m}`); } };
const quiet = sim => { sim.h.ctx.console = { ...console, warn() {}, error() {}, log() {} }; return sim; };

function diffObj(a, b, p = '', out = []) {
  if (out.length > 8) return out;
  if (a === b) return out;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { out.push(`${p || '(корень)'}: ${JSON.stringify(a)?.slice(0, 70)} ≠ ${JSON.stringify(b)?.slice(0, 70)}`); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffObj(a[k], b[k], p ? p + '.' + k : k, out);
  return out;
}
const sumStock = bs => { const t = {}; for (const b of bs) for (const g in b.stock || {}) t[g] = (t[g] || 0) + (b.stock[g] || 0); return t; };
const byType = bs => { const t = {}; for (const b of bs) { const k = b.type + (b.level > 1 ? ':L' + b.level : ''); t[k] = (t[k] || 0) + 1; } return t; };

// ---------- 1. Золотые сейвы
const files = fs.existsSync(SAVES) ? fs.readdirSync(SAVES).filter(f => /\.json(\.gz)?$/.test(f)).sort() : [];
if (files.length < 10) ok(false, `в tests/saves/ только ${files.length} сейвов, нужно не меньше 10 (см. README.md)`);
const vers = new Set(files.map(f => (f.match(/^v([\d.]+)-/) || [])[1]));
for (const v of ['0.9.5', '0.10.0', '0.10.25', '0.10.50', '0.10.70', '0.10.90']) if (!vers.has(v)) ok(false, `в библиотеке нет сейва версии ${v}`);
let latest = null, latestFile = null, heroChecked = 0, ultChecked = 0;
for (const f of files) {
  section = f.replace(/\.json(\.gz)?$/, '');
  const raw = fs.readFileSync(path.join(SAVES, f));
  const text = /\.gz$/.test(f) ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
  const src = JSON.parse(text);
  const coop = /-coop-/.test(f);
  const t0 = Date.now();
  const sim = quiet(L.newSim(4242, { coop }));
  sim.h.ctx.__t = text;
  const err = sim.h.run('loadSaveText(__t)');
  ok(!err, `не загрузился: ${err}`);
  if (err) continue;
  if (coop) sim.h.run('coopDropHeroes(); coopInitUnlocks();');
  const notes = sim.h.run('loadSaveText.notes.join(", ")');
  ok(!notes, `при загрузке пропущено: ${notes}`);
  // здания, запасы, жители на месте
  const bs = JSON.parse(sim.h.run('JSON.stringify(Game.buildings.map(b => ({ type: b.type, level: b.level || 1, state: b.state, stock: b.stock })))'));
  ok(bs.length === src.buildings.length, `зданий ${bs.length}, было ${src.buildings.length}`);
  const t1 = byType(src.buildings.map(b => ({ type: b.type, level: b.level || 1 }))), t2 = byType(bs);
  ok(JSON.stringify(t1) === JSON.stringify(t2), `состав зданий изменился: ${JSON.stringify(diffObj(t1, t2))}`);
  const g1 = sumStock(src.buildings), g2 = sumStock(bs);
  for (const g of new Set([...Object.keys(g1), ...Object.keys(g2)])) if (Math.abs((g1[g] || 0) - (g2[g] || 0)) > 1e-6) ok(false, `запас «${g}» на складах: ${g2[g] || 0}, было ${g1[g] || 0}`);
  const nu = sim.h.run('Game.units.length');
  const heroes = src.units.filter(u => u.h);
  ok(nu === src.units.length, `жителей ${nu}, было ${src.units.length}`);
  ok(sim.h.run('Math.abs(Game.time - ' + src.time + ') < 1e-6'), 'время игры не совпало');
  // герой: класс, уровень, снаряжение, умения, ульта, гильдия
  if (heroes.length && !coop) {
    const H = src.units.find(u => u.h).h;
    const got = JSON.parse(sim.h.run('JSON.stringify(Game.hero && Game.hero.hero || null)'));
    ok(!!got, 'герой не найден после загрузки');
    if (got) {
      heroChecked += H.clsKey ? 1 : 0;
      ok(got.level === H.level && got.clsKey === H.clsKey && got.cls === H.cls, `герой: ${got.clsKey}/${got.level}, было ${H.clsKey}/${H.level}`);
      ok(JSON.stringify(got.equip) === JSON.stringify(H.equip), `снаряжение героя изменилось: ${JSON.stringify(got.equip)} ≠ ${JSON.stringify(H.equip)}`);
      if (H.clsKey) {
        const ab = sim.h.run(`typeof HERO_ABIL !== 'undefined' && HERO_ABIL[${JSON.stringify(H.clsKey)}] ? HERO_ABIL[${JSON.stringify(H.clsKey)}].length : -1`);
        if (ab >= 0) ok(ab >= 5, `у класса ${H.clsKey} умений ${ab}`);
        if (H.level >= 13 && ab >= 0) { ultChecked++; ok(sim.h.run(`HERO_ABIL[${JSON.stringify(H.clsKey)}].some(a => a.ult)`) === true, `у класса ${H.clsKey} на ${H.level} уровне нет ульты`); }
      }
    }
  }
  // повторное сохранение = тот же сейв (второй круг ничего не теряет)
  const s1 = JSON.parse(sim.h.run('JSON.stringify(serializeGame())'));
  ok(s1.sv === sim.h.run('SAVE_REV') && s1.gv === sim.h.run('GAME_VERSION'), `serializeGame без sv/gv: ${s1.sv}/${s1.gv}`);
  const sim2 = quiet(L.newSim(4243, { coop }));
  sim2.h.ctx.__t = JSON.stringify(s1);
  const e2 = sim2.h.run('loadSaveText(__t)');
  ok(!e2, `повторная загрузка: ${e2}`);
  if (!e2) {
    const s2 = JSON.parse(sim2.h.run('JSON.stringify(serializeGame())'));
    delete s1.nextId; delete s2.nextId;
    if (s1.wgs) delete s1.wgs.day; if (s2.wgs) delete s2.wgs.day;   // день поселений диких гномов у старого сейва вычисляется при загрузке
    const d = diffObj(s1, s2);
    ok(!d.length, `второй круг отличается: ${d.slice(0, 4).join('; ')}`);
  }
  // игра идёт
  const people0 = sim.h.run('Game.units.filter(u => !u.dead).length');
  L.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0 && !coop) { try { L.botTurn(sim); } catch (e) { /* бот на чужой карте может не найти места */ } } });
  ok(!sim.errors.length, `исключения за ${MIN} мин: ${sim.errors.slice(0, 2).join(' | ')}`);
  const inv = L.checkInvariants(sim, 'после ' + MIN + ' мин'); for (const p of inv.problems) ok(false, p);
  const people1 = sim.h.run('Game.units.filter(u => !u.dead).length');
  ok(people1 > 0 || people0 === 0, `за ${MIN} мин все жители пропали (было ${people0})`);
  // сохранение живой игры снова читается
  sim.h.run('saveGame("manual")');
  const again = sim.h.run('localStorage.getItem(SAVE_KEY + "manual")');
  ok(!!again, 'повторный saveGame ничего не записал');
  if (again) { const s3 = quiet(L.newSim(5, { coop })); s3.h.ctx.__t = again; const e3 = s3.h.run('loadSaveText(__t)'); ok(!e3, `сейв после ${MIN} мин игры не читается: ${e3}`); }
  console.log(`  ✓ ${f}: игра ${src.gv || '<0.10.25 без gv'}, ${src.buildings.length} зд., ${src.units.length} жит. (${((Date.now() - t0) / 1000).toFixed(1)} с)`);
  if (!coop && /^v0.10.110-solo-meadow/.test(f)) { latest = text; latestFile = f; }
}
section = 'библиотека';
const solo = files.filter(f => !/-coop-/.test(f)).length, coopN = files.filter(f => /-coop-/.test(f)).length;
ok(heroChecked >= 5 && ultChecked >= 2, `слишком мало героев с классом в библиотеке (${heroChecked}/${ultChecked})`);
  ok(coopN >= 3, `миров коопа в библиотеке ${coopN}, нужно не меньше 3`);
console.log(`Проверка сейвов: ${files.length} файлов (одиночка ${solo}, кооп ${coopN}), версии ${[...vers].join(', ')}; героев с классом проверено ${heroChecked}, с ультой ${ultChecked}`);

// ---------- 2. Повреждённые, огромные, подпорченные
const fresh = () => quiet(L.newSim(77));
const sample = latest || zlib.gunzipSync(fs.readFileSync(path.join(SAVES, files[files.length - 1]))).toString('utf8');
const sampleObj = () => JSON.parse(sample);
section = 'битые сейвы';
{
  const sim = fresh();
  const tryLoad = (name, text, wantErr = true) => {
    sim.h.ctx.__t = text;
    let e;
    try { e = sim.h.run('loadSaveText(__t)'); } catch (x) { ok(false, `${name}: уронил загрузку исключением ${x.message}`); return; }
    if (wantErr) {
      ok(typeof e === 'string' && e.length > 3, `${name}: принят как нормальный`);
      if (e) ok(/[а-яё]/i.test(e), `${name}: сообщение не по-русски: ${e}`);
    } else ok(!e, `${name}: отвергнут: ${e}`);
  };
  tryLoad('пустой', '');
  tryLoad('мусор', 'не json');
  tryLoad('массив', '[]');
  tryLoad('null', 'null');
  tryLoad('{"v":2}', '{"v":2}');
  for (const frac of [0.02, 0.3, 0.7, 0.999]) tryLoad(`обрезан на ${Math.round(frac * 100)}%`, sample.slice(0, Math.floor(sample.length * frac)));
  tryLoad('из будущего', JSON.stringify({ ...sampleObj(), sv: 999 }));
  const big = 'x'.repeat(50e6);
  const tb = Date.now();
  tryLoad('50 МБ мусора', big);
  ok(Date.now() - tb < 2000, 'огромный файл отвергается дольше 2 секунд');
  { const o = sampleObj(); o.units = new Array(30000).fill(o.units[0]); tryLoad('30 000 жителей', JSON.stringify(o)); }
  { const o = sampleObj(); o.buildings = new Array(7000).fill(o.buildings[0]); tryLoad('7 000 зданий', JSON.stringify(o)); }
  { const o = sampleObj(); o.mw = 100000; tryLoad('карта 100000 клеток', JSON.stringify(o)); }
  { const o = sampleObj(); o.buildings = []; tryLoad('без зданий', JSON.stringify(o)); }
  { const o = sampleObj(); o.buildings = 'x'; tryLoad('buildings — строка', JSON.stringify(o)); }
  { const o = sampleObj(); o.obj = null; tryLoad('obj — null', JSON.stringify(o)); }
  { const o = sampleObj(); delete o.seed; tryLoad('нет зерна', JSON.stringify(o)); }
  // допустимо, но подпорчено: игра грузится, лишнее выкидывает и живёт дальше
  const nb = sampleObj().buildings.length;
  const tolerant = (name, mut, check) => {
    const o = sampleObj(); mut(o);
    sim.h.ctx.__t = JSON.stringify(o);
    let e; try { e = sim.h.run('loadSaveText(__t)'); } catch (x) { ok(false, `${name}: исключение ${x.message}`); return; }
    ok(!e, `${name}: отвергнут, а можно было загрузить: ${e}`);
    if (e) return;
    if (check) ok(check(), `${name}: проверка после загрузки не прошла`);
    try { L.stepN(sim, 600); } catch (x) { ok(false, `${name}: упал шаг игры: ${x.message}`); }
    ok(!sim.errors.length, `${name}: исключения в игре: ${sim.errors.splice(0).slice(0, 2).join(' | ')}`);
  };
  tolerant('здание неизвестного вида', o => { o.buildings.push({ ...o.buildings[0], id: 99999, type: 'zzz_from_future' }); }, () => sim.h.run('Game.buildings.length') === nb && /неизвестного/.test(sim.h.run('loadSaveText.notes.join()')));
  tolerant('житель неизвестного вида', o => { o.units.push({ ...o.units[0], type: 'zzz_future_unit' }); }, () => sim.h.run('Game.units.length') === sampleObj().units.length);
  tolerant('здание с NaN-координатами', o => { o.buildings[1].x = null; o.buildings[2].y = 'a'; }, () => sim.h.run('Game.buildings.length') === nb - 2);
  tolerant('здание вне карты', o => { o.buildings[1].x = 9999; });
  tolerant('повторяющиеся id зданий', o => { o.buildings[2].id = o.buildings[1].id; }, () => sim.h.run('Game.buildings.length') === nb - 1);
  tolerant('житель с NaN', o => { o.units[0].x = null; o.units[1].food = 'много'; });
  tolerant('мусор в объектах карты', o => { o.obj.push(null, [], ['x'], [-5, 'tree'], [1e9, 'tree']); });
  tolerant('мусорные дороги и стройки дорог', o => { o.road.push(-1, 1e9, 'a', null); o.roadSites = [null, { x: 5000, y: 1 }, ...o.roadSites]; });
  tolerant('нет необязательных полей', o => { for (const k of ['pets', 'piles', 'mined', 'rockHp', 'night', 'fest', 'brawl', 'be', 'sl', 'ch', 'fy', 'f2', 'dfn', 'storeBlock', 'cam', 'produced']) delete o[k]; });
  tolerant('необязательные поля не того типа', o => { o.pets = 'x'; o.piles = {}; o.mined = 5; o.rockHp = 'a'; });
  tolerant('нет времени и следующего id', o => { delete o.time; delete o.nextId; });
  // питомцы и напарники переживают вычёркивание жителей
  { const o = sampleObj(); o.units.unshift({ ...o.units[0], type: 'zzz_future_unit' }); o.pets = [['dog', 5, 5, 1], ['dog', 6, 6, 0]];
    sim.h.ctx.__t = JSON.stringify(o); ok(!sim.h.run('loadSaveText(__t)'), 'питомцы после вычёркивания жителей: не загрузился'); }
  // случайные порчи (стабильный генератор): загрузка либо честно отвергает, либо игра идёт дальше без исключений
  const rnd = L.mulberry(2026);
  const junk = [null, 'x', -1, 1e12, {}, [], true, NaN, 0.5];
  let bad = 0, rejected = 0, loaded = 0;
  for (let k = 0; k < 60; k++) {
    const o = sampleObj();
    // выбираем случайное место: верхний ключ → (если контейнер) случайный элемент → его поле
    const top = Object.keys(o)[Math.floor(rnd() * Object.keys(o).length)];
    let holder = o, key = top;
    if (o[top] && typeof o[top] === 'object') {
      const ks = Object.keys(o[top]); if (ks.length) { holder = o[top]; key = ks[Math.floor(rnd() * ks.length)]; }
      if (holder[key] && typeof holder[key] === 'object') { const ks2 = Object.keys(holder[key]); if (ks2.length) { holder = holder[key]; key = ks2[Math.floor(rnd() * ks2.length)]; } }
    }
    const v = junk[Math.floor(rnd() * junk.length)];
    if (rnd() < 0.2) delete holder[key]; else holder[key] = v;
    sim.h.ctx.__t = JSON.stringify(o);
    let e;
    try { e = sim.h.run('loadSaveText(__t)'); } catch (x) { bad++; ok(false, `порча #${k} (${top}.${key} = ${JSON.stringify(v)}): исключение ${x.message}`); continue; }
    if (e) { rejected++; continue; }
    loaded++;
    try { L.stepN(sim, 200); } catch (x) { bad++; ok(false, `порча #${k} (${top}.${key} = ${JSON.stringify(v)}): игра упала после загрузки: ${x.message}`); }
    if (sim.errors.length) { bad++; ok(false, `порча #${k} (${top}.${key} = ${JSON.stringify(v)}): исключения: ${sim.errors.splice(0).slice(0, 2).join(' | ')}`); }
  }
  console.log(`Проверка порчи: 60 случайных повреждений — отвергнуто ${rejected}, загружено и пережито ${loaded}, сбоев ${bad}`);
}

// ---------- 3. loadGame: копии, откат, новая игра, копия до обновления, экспорт/импорт, нехватка места
section = 'loadGame';
{
  const sim = fresh();
  const R = code => sim.h.run(code);
  const put = (slot, text) => { sim.h.ctx.__t = text; R(`localStorage.setItem(SAVE_KEY + ${JSON.stringify(slot)}, __t)`); };
  const get = slot => R(`localStorage.getItem(SAVE_KEY + ${JSON.stringify(slot)})`);
  const nbSample = sampleObj().buildings.length;
  const gv = R('GAME_VERSION');
  // а) битый автосейв + хорошая копия → копия, игрок предупреждён
  put('auto', sample.slice(0, 5000)); put('auto.bak', sample);
  R('saveBrokenNotice.last = ""');
  ok(R('loadGame("auto")') === true && R('Game.buildings.length') === nbSample, 'резервная копия не подхватилась');
  ok(/резервная копия/.test(R('saveBrokenNotice.last')), 'игрок не получил сообщения о копии');
  // б) битый и нет копий → новая игра, живой мир (не пустой экран), битый файл отложен, понятное сообщение
  put('auto', sample.slice(0, 5000)); sim.h.run('localStorage.removeItem(SAVE_KEY + "auto.bak")');
  R('saveBrokenNotice.last = ""');
  ok(R('loadGame("auto")') === false, 'loadGame с битым сейвом и без копий вернул true');
  ok(R('Game.buildings.length > 0 && Game.units.length > 0'), 'после битого сейва пустой мир (нет зданий/жителей)');
  ok(/новая игра/i.test(R('saveBrokenNotice.last')) && /повреждён|обрезан|испорчен/.test(R('saveBrokenNotice.last')), 'сообщение о битом сейве непонятное: ' + R('saveBrokenNotice.last'));
  ok(get('auto.broken') === sample.slice(0, 5000), 'повреждённый файл не отложен в сторону');
  L.stepN(sim, 400); ok(!sim.errors.length, 'новая игра после битого сейва: исключения ' + sim.errors.slice(0, 2));
  // в) битый + копия «до обновления» (старая версия) → поднимается она
  R('localStorage.removeItem(SAVE_KEY + "auto.bak")');
  put('auto', '{"v":2,'); put('auto.pre', sample);
  ok(R('loadGame("auto")') === true && /копия до обновления/.test(R('saveBrokenNotice.last')), 'копия до обновления не подхватилась');
  R('localStorage.removeItem(SAVE_KEY + "auto.pre")');
  // г) копия «до обновления»: сейв другой версии откладывается при первой загрузке, повторно не затирается
  const old = JSON.parse(sample); old.gv = '0.0.1'; old.sv = 0;
  const oldText = JSON.stringify(old);
  put('manual', oldText);
  ok(R('loadGame("manual")') === true, 'сейв старой версии не загрузился');
  ok(get('manual.pre') === oldText, 'копия до обновления не создана');
  ok(JSON.parse(R('localStorage.getItem(SAVE_KEY + "manual.pre.meta")')).gv === '0.0.1', 'в метке копии нет версии, записавшей сейв');
  R('saveGame("manual")');
  ok(JSON.parse(get('manual')).gv === gv && JSON.parse(get('manual')).sv === R('SAVE_REV'), 'saveGame не проставил sv/gv');
  R('loadGame("manual")');
  ok(get('manual.pre') === oldText, 'копия до обновления затёрта новым сейвом той же версии');
  // д) экспорт/импорт
  const check = t => R(`saveCheckText(${JSON.stringify(t)})`);
  ok(check('') && check('abc') && check('{}') && check(JSON.stringify({ ...JSON.parse(sample), sv: 99 })), 'saveCheckText пропустил мусор');
  ok(/более новой/.test(check(JSON.stringify({ ...JSON.parse(sample), sv: 99 }))), 'сейв из будущего: сообщение не про версию игры');
  ok(check(sample) === null, 'saveCheckText отверг хороший сейв: ' + check(sample));
  put('manual', oldText);
  const bad = R(`saveImportText(${JSON.stringify(sample.slice(0, 900))}, "manual")`);
  ok(bad.ok === false && get('manual') === oldText, 'битый файл при импорте затёр ячейку');
  const good = R(`saveImportText(${JSON.stringify(sample)}, "manual")`);
  ok(good.ok === true && get('manual') === sample && get('manual.bak') === oldText, 'импорт не записал файл или не сохранил прежнее в .bak: ' + good.msg);
  ok(R('loadGame("manual")') === true && R('Game.buildings.length') === nbSample, 'импортированное не загрузилось');
  ok(R('saveMeta("manual").time') === JSON.parse(sample).time, 'после импорта в метке нет времени игры');
  ok(R('saveExport("nope")') === false, 'экспорт пустой ячейки вернул true');
  // е) нехватка места: новый сейв вытесняет копии, а не теряется; совсем нет места — старый сейв цел
  R(`(function () {
    const m = new Map(); let lim = Infinity;
    globalThis.__setLim = v => { lim = v; };
    localStorage.getItem = k => (m.has(k) ? m.get(k) : null);
    localStorage.removeItem = k => { m.delete(k); };
    localStorage.setItem = (k, v) => { let n = 0; for (const [kk, vv] of m) if (kk !== k) n += vv.length; if (n + String(v).length > lim) throw new Error('QuotaExceededError'); m.set(k, String(v)); };
  })()`);
  for (const k of ['auto', 'auto.bak', 'auto.pre', 'manual.bak', 'auto.broken']) put(k, sample);
  R('localStorage.removeItem(SAVE_KEY + "auto.bak.meta")');
  R(`__setLim(${Math.floor(sample.length * 3.4)})`);
  R('saveGame("manual")');   // чтобы в хранилище лежал текущий мир (размер ≈ sample)
  const okQ = R('saveGame("auto")');
  ok(okQ === true, 'при нехватке места автосейв не записался, хотя копии можно было вытеснить');
  ok(get('auto') && JSON.parse(get('auto')).sv === R('SAVE_REV'), 'после вытеснения копий в auto лежит не свежий сейв');
  R(`__setLim(10)`);
  const cur = get('auto');
  ok(R('saveGame("auto")') === false, 'при полном отсутствии места saveGame вернул true');
  ok(get('auto') === cur, 'при неудачной записи старый сейв повреждён');
}

// ---------- 4. Миграции формата и закрытие вкладки
section = 'миграции';
{
  const sim = fresh();
  const R = code => sim.h.run(code);
  ok(R('SAVE_MIGRATIONS.length') === R('SAVE_REV'), 'число миграций ≠ SAVE_REV: у каждой ревизии должна быть миграция');
  ok(R('Number.isInteger(SAVE_REV) && SAVE_REV >= 1'), 'SAVE_REV не целое ≥ 1');
  // цепочка: 0→1→2→3 по порядку, sv обновляется, данные доходят
  R('globalThis.__steps = [s => { s.log = ["a"]; return s; }, s => { s.log.push("b"); }, s => { s.log.push("c"); return s; }]');
  const r = JSON.parse(R('JSON.stringify(migrateSave({ v: 2 }, 3, __steps))'));
  ok(JSON.stringify(r.log) === '["a","b","c"]' && r.sv === 3, `цепочка миграций: ${JSON.stringify(r)}`);
  const r2 = JSON.parse(R('JSON.stringify(migrateSave({ v: 2, sv: 2, log: [] }, 3, __steps))'));
  ok(JSON.stringify(r2.log) === '["c"]', `миграция с середины цепочки: ${JSON.stringify(r2)}`);
  ok(R('(() => { try { migrateSave({ v: 2, sv: 5 }, 3, __steps); return "принят"; } catch (e) { return e.message; } })()').includes('более новой'), 'сейв из будущего не отвергнут');
  // все золотые сейвы старше или равны текущей ревизии
  const rev = R('SAVE_REV');
  for (const f of files) { const o = JSON.parse(/\.gz$/.test(f) ? zlib.gunzipSync(fs.readFileSync(path.join(SAVES, f))) : fs.readFileSync(path.join(SAVES, f))); ok((o.sv | 0) <= rev, `${f}: ревизия ${o.sv} новее игры`); }
  // закрытие вкладки (телефон): сохранение на скрытии, pagehide и freeze
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  ok(/visibilitychange[\s\S]{0,120}saveOnLeave/.test(main) && /'pagehide', saveOnLeave/.test(main) && /'freeze', saveOnLeave/.test(main), 'main.js: сохранение при скрытии/закрытии/заморозке вкладки не подключено');
  ok(/saveGame\('auto'\)/.test(main.slice(main.indexOf('const saveOnLeave'), main.indexOf('const saveOnLeave') + 700)), 'saveOnLeave не вызывает saveGame');
}

// ---------- 5. Мир коопа на сервере
section = 'мир коопа';
{
  const worlds = files.filter(f => /-coop-/.test(f));
  const load = f => { const b = fs.readFileSync(path.join(SAVES, f)); return /\.gz$/.test(f) ? zlib.gunzipSync(b).toString('utf8') : b.toString('utf8'); };
  const mk = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oldgold-world-'));
    const sim = quiet(L.newSim(31, { coop: true }));
    const logs = [];
    const io = createWorldIO({ host: sim.h, dir, log: (...a) => logs.push(a.join(' ')) });
    return { dir, sim, io, logs, W: path.join(dir, 'world.json') };
  };
  const rm = dir => fs.rmSync(dir, { recursive: true, force: true });
  // а) каждый мир старых версий поднимается, копия «до обновления» создаётся, второй запуск её не плодит
  for (const f of worlds) {
    section = 'мир коопа ' + f.replace(/\.json(\.gz)?$/, '');
    const t = load(f), src = JSON.parse(t), w = mk();
    fs.writeFileSync(w.W, t);
    const r = w.io.load();
    ok(r.ok && r.from === 'world.json', `не поднялся: ${JSON.stringify(r.tried)}`);
    if (!r.ok) { rm(w.dir); continue; }
    ok(w.sim.h.run('Game.buildings.length') === src.buildings.length && w.sim.h.run('Game.units.length') === src.units.length, 'состав мира изменился');
    ok(w.sim.h.run('Game.units.every(u => u.type !== "hero")'), 'в мире коопа появились одиночные герои');
    const cur = w.sim.h.run('GAME_VERSION');
    if ((src.gv || '?') !== cur) {
      const pre = fs.readdirSync(w.dir).filter(x => x.startsWith('world-pre-'));
      ok(pre.length === 1 && fs.readFileSync(path.join(w.dir, pre[0]), 'utf8') === t, `копия до обновления: ${pre.join()}`);
      ok(r.migratedFrom === (src.gv || '?'), `migratedFrom=${r.migratedFrom}`);
    }
    L.stepN(w.sim, MIN * 60 * 20);
    ok(!w.sim.errors.length, `исключения: ${w.sim.errors.slice(0, 2).join(' | ')}`);
    const inv = L.checkInvariants(w.sim, 'кооп'); for (const p of inv.problems) ok(false, p);
    // запись и повторный запуск: мир тот же, копий до обновления не прибавилось
    w.io.write(w.sim.h.run('JSON.stringify(serializeGame())'));
    const w2 = { sim: quiet(L.newSim(32, { coop: true })) };
    const io2 = createWorldIO({ host: w2.sim.h, dir: w.dir, log() {} });
    const r2 = io2.load();
    ok(r2.ok && r2.migratedFrom === null, `повторный запуск: ${JSON.stringify(r2)}`);
    ok(fs.readdirSync(w.dir).filter(x => x.startsWith('world-pre-')).length <= 1, 'копий до обновления стало больше');
    ok(fs.readdirSync(w.dir).some(x => x.startsWith('world-snap-')), 'снимок мира не создан при первой записи');
    rm(w.dir);
  }
  section = 'откат мира';
  const t0 = load(worlds[worlds.length - 1]);
  // б) основной файл обрезан → поднимается .bak, повреждённый сохранён, не затёрт
  { const w = mk(); fs.writeFileSync(w.W, t0.slice(0, 4000)); fs.writeFileSync(w.W + '.bak', t0);
    const r = w.io.load();
    ok(r.ok && r.from === 'world.json.bak', `откат на .bak: ${JSON.stringify(r)}`);
    ok(fs.readdirSync(w.dir).some(x => x.startsWith('world-broken-')), 'нечитаемый world.json не сохранён');
    rm(w.dir); }
  // в) оба повреждены → снимок
  { const w = mk(); fs.writeFileSync(w.W, '{'); fs.writeFileSync(w.W + '.bak', 'мусор');
    fs.writeFileSync(path.join(w.dir, 'world-snap-2026-01-01T00-00-00-000Z.json'), t0);
    const r = w.io.load(); ok(r.ok && /snap/.test(r.from), `откат на снимок: ${JSON.stringify(r)}`); rm(w.dir); }
  // г) оба повреждены, снимка нет, есть копия до обновления → она
  { const w = mk(); fs.writeFileSync(w.W, ''); fs.writeFileSync(path.join(w.dir, 'world-pre-0.0.1.json'), t0);
    const r = w.io.load(); ok(r.ok && /pre/.test(r.from), `откат на копию до обновления: ${JSON.stringify(r)}`); rm(w.dir); }
  // д) ничего не читается → не ок, но файлы целы (новый мир не затрёт их: они переехали в world-broken-*)
  { const w = mk(); fs.writeFileSync(w.W, 'мусор');
    const r = w.io.load(); ok(!r.ok && !r.fatal, 'мусорный мир принят'); ok(fs.readdirSync(w.dir).some(x => x.startsWith('world-broken-')), 'мусорный мир не сохранён для разбора'); rm(w.dir); }
  // е) мир из будущего: остановка, файл не тронут
  { const w = mk(); const fut = JSON.stringify({ ...JSON.parse(t0), sv: 999 }); fs.writeFileSync(w.W, fut);
    const r = w.io.load(); ok(!r.ok && r.fatal === 'newer', `мир из будущего: ${JSON.stringify(r)}`);
    ok(fs.readFileSync(w.W, 'utf8') === fut && fs.readdirSync(w.dir).length === 1, 'мир из будущего тронут или скопирован'); rm(w.dir); }
  // ж) без файла: новый мир создаётся самим сервером (load → не ок, tried пуст)
  { const w = mk(); const r = w.io.load(); ok(!r.ok && r.tried.length === 0, 'без файла load не вернул «пусто»'); rm(w.dir); }
  // з) снимки: не больше SNAP_KEEP, самые свежие
  { const { SNAP_KEEP } = require('../server/worldio'); const w = mk();
    for (let i = 0; i < SNAP_KEEP + 4; i++) fs.writeFileSync(path.join(w.dir, `world-snap-2026-01-${String(10 + i).padStart(2, '0')}T00-00-00-000Z.json`), 'x');
    w.io.write(t0);
    const sn = fs.readdirSync(w.dir).filter(x => x.startsWith('world-snap-')).sort();
    ok(sn.length === SNAP_KEEP && !sn.includes('world-snap-2026-01-10T00-00-00-000Z.json'), `снимков ${sn.length} (должно ${SNAP_KEEP}), старые не вычищены`);
    rm(w.dir); }
}

section = '';
console.log(fails.length ? `\nПровалено: ${fails.length}` : '\nСохранения: OK');
process.exit(fails.length ? 1 : 0);
