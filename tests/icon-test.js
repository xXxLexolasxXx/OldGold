'use strict';
// Значки способностей: у КАЖДОЙ способности каждого класса (HERO_ABIL) и у малых кнопок панели (AB_UTIL) есть свой
// пиксельный значок 12×12 (единая таблица abilIconGlyph: ABIL_ICON + HC_ICON + синонимы), название и описание;
// неизвестный ключ получает запасной значок, а не пустоту; базовая атака гильдии (GCLS.verb) не называется
// как способность (баг тестера: «второй огненный шар» без картинки); окно гильдии показывает значки способностей класса.
// Запуск: node tests/icon-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(3);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 5, 5, () => {});

// разбор значка: строка палитры «X:#rrggbb …» и 12 строк по 12 символов, все символы — из палитры или «.»
const glyphProblem = `function (g) {
  if (!Array.isArray(g) || g.length < 12 || g.length > 13) return 'не 11–12 строк';   // рисовалка (abilIcon16) берёт до 12 строк
  const pal = new Set(['.']);
  for (const p of String(g[0]).split(' ')) { const m = /^(.):#[0-9a-fA-F]{3,6}$/.exec(p); if (!m) return 'палитра: ' + p; pal.add(m[1]); }
  let px = 0;
  for (let y = 1; y < g.length; y++) {
    const row = g[y];
    if (typeof row !== 'string' || row.length !== 12) return 'строка ' + y + ' длиной ' + (row ? row.length : 0);
    for (const ch of row) { if (!pal.has(ch)) return 'символ «' + ch + '» не из палитры'; if (ch !== '.') px++; }
  }
  return px < 12 ? 'почти пустой (' + px + ' точек)' : '';
}`;
const R = J(`const bad = ${glyphProblem}, out = { abil: [], util: [], def: '', unknownSame: false, verbs: [] };
  const names = new Set();
  for (const cls in HERO_ABIL) for (const a of HERO_ABIL[cls]) {
    const own = ABIL_ICON[a.k] || HC_ICON[a.k] || null;
    names.add(a.name.toLowerCase());
    out.abil.push({ cls, k: a.k, own: !!own, bad: own ? bad(own) : 'нет своего значка', name: a.name || '', desc: (a.desc || '').length, glyph: abilIconGlyph(a.k) !== ABIL_ICON_DEF });
  }
  for (const u of AB_UTIL) out.util.push({ k: u.k, icon: u.icon, bad: bad(abilIconGlyph(u.icon)), own: abilIconGlyph(u.icon) !== ABIL_ICON_DEF, name: u.name, desc: (u.desc || '').length });
  out.def = bad(ABIL_ICON_DEF);
  out.unknownSame = abilIconGlyph('нет_такого_ключа') === ABIL_ICON_DEF;
  out.gstrike = abilIconGlyph('g_strike') !== ABIL_ICON_DEF;
  for (const k in GCLS) if (names.has(String(GCLS[k].verb).toLowerCase())) out.verbs.push(k + ': ' + GCLS[k].verb);
  return out;`);

let n = 0;
for (const a of R.abil) {
  n++;
  ok(a.own && !a.bad, `${a.cls}.${a.k}: значок — ${a.bad}`);
  ok(a.glyph, `${a.cls}.${a.k}: подставляется запасной значок`);
  ok(a.name.length >= 3, `${a.cls}.${a.k}: нет названия`);
  ok(a.desc >= 10, `${a.cls}.${a.k}: нет описания`);
}
for (const u of R.util) {
  ok(u.own && !u.bad, `кнопка ${u.k}: значок ${u.icon} — ${u.bad || 'запасной'}`);
  ok(u.name && u.desc >= 10, `кнопка ${u.k}: нет названия или описания`);
}
ok(!R.def, 'запасной значок испорчен: ' + R.def);
ok(R.unknownSame, 'неизвестный ключ не получает запасной значок');
ok(R.gstrike, 'базовая атака гильдии (g_strike) без значка');
ok(!R.verbs.length, 'базовая атака гильдии называется как способность (дубль): ' + R.verbs.join('; '));

// огненный шар — только у мага и только один
const fire = J(`const out = []; for (const cls in HERO_ABIL) for (const a of HERO_ABIL[cls]) if (/огненн/i.test(a.name)) out.push(cls + '.' + a.k);
  return { out, common: typeof HM_SPELLS !== 'undefined' || typeof hmCast === 'function' };`);
ok(fire.out.length === 1 && fire.out[0] === 'mage.fire' && !fire.common, 'огненный шар не один или не у мага: ' + JSON.stringify(fire));

// окно гильдии: при обучении видны значки способностей класса
const gw = J(`const out = {};
  for (const g of ['warrior', 'archer', 'rogue', 'mage']) {
    const html = abilRowHTML(g, Game.hero && Game.hero.hero);
    out[g] = { n: (html.match(/data-abi="/g) || []).length, need: HERO_ABIL[g].length };
  }
  return out;`);
for (const g in gw) ok(gw[g].n === gw[g].need, `окно гильдии (${g}): значков ${gw[g].n} из ${gw[g].need}`);
// и сама разметка окна гильдии зовёт ряд значков
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'guilds.js'), 'utf8');
ok(/abilRowHTML\(k, H\)/.test(src), 'guildHTML не показывает значки способностей');

ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 3).join(' | '));
console.log(fails.length ? `Проверка значков: провалов ${fails.length}` : `Проверка значков: всё в порядке (способностей ${n}, кнопок ${R.util.length})`);
process.exit(fails.length ? 1 : 0);
