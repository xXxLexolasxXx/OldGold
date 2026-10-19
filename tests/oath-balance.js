'use strict';
// Баланс Клятв (КЛАССЫ.md, порция 3): каждый из 10 классов на 1/5/10/15 уровне с оружием и доспехом своей гильдии
// и рангом мастерства по уровню. Считает точность по скелету, защиту, здоровье и «скелетов до падения» —
// грубая модель боя из guilds.js strike(): промах ближника — ответ врага (30% × (1 − защита), 6 урона).
// Стрелки (лучник, маг, друид) ответов не получают — у них счёт ограничен 99.
// Запуск: node tests/oath-balance.js [--json]
const S = require('./lib/sim');
const sim = S.newSim(3);
S.runFor(sim, 20, 10, () => {});
const rows = JSON.parse(sim.h.run(`JSON.stringify((() => {
  const h = Game.hero, H = h.hero, out = [];
  const save = JSON.stringify({ c: H.clsKey, m: H.mastery, l: H.level, e: H.equip });
  for (const k of Object.keys(OATHS)) for (const L of [1, 5, 10, 15]) {
    const C = GCLS[k];
    H.clsKey = k; H.cls = C.name; H.level = L; H.mastery = Math.min(MASTERY_MAX, Math.floor(L / 3));
    H.equip = { weapon: C.weapon, armor: C.armor, off: null };
    const hp = hlMaxHp(H), atk = heroAtk(h), def = heroDef(h), ranged = !!C.shot;
    // ночь по уровню героя: скелет держит round(0,9·d) попаданий, после попадания бьёт в ответ (10%·(d−1), 3+2,5·d)
    const d = nightDiff({ 1: 2, 5: 5, 10: 9, 15: 14 }[L]), hits = Math.max(1, Math.round(d * 0.9)), swings = hits / atk;
    const hurt = ranged ? 0 : swings * ((1 - atk) * 0.3 * (1 - def) * 6 + atk * 0.1 * (d - 1) * (3 + 2.5 * d) * (hits - 1) / hits);
    const kills = hurt ? Math.min(99, hp / (hurt * (1 - (typeof heroDodge === 'function' ? heroDodge(h) : 0)))) : 99, perMin = 60 / (swings * (ranged ? 1.6 : 1.15));
    const spd = teamSpeedMul(h);
    out.push({ k, L, pm: +perMin.toFixed(1), hp, atk: +atk.toFixed(3), def: +def.toFixed(2), kills: +kills.toFixed(1), spd: +spd.toFixed(2), ranged });
  }
  const o = JSON.parse(save); H.clsKey = o.c; H.mastery = o.m; H.level = o.l; H.equip = o.e;
  return out;
})())`));
if (process.argv.includes('--json')) { console.log(JSON.stringify(rows)); process.exit(0); }
const by = {};
for (const r of rows) (by[r.k] || (by[r.k] = [])).push(r);
console.log('класс      ур.:  здоровье   точность   защита  скелетов до падения  в минуту  скорость');
for (const k in by) for (const r of by[k]) console.log(`${(r.L === 1 ? k : '').padEnd(10)} ${String(r.L).padStart(2)}:  ${String(r.hp).padStart(5)}      ${r.atk.toFixed(2)}      ${r.def.toFixed(2)}   ${String(r.kills).padStart(5)}${r.ranged ? ' стрелок' : '        '}        ${String(r.pm).padStart(5)}    ×${r.spd}`);
// предупреждения: ближник с точностью ниже 0,4 на 5+ уровне или с «до падения» меньше половины медианы
const melee = rows.filter(r => !r.ranged);
for (const L of [1, 5, 10, 15]) {
  const ks = melee.filter(r => r.L === L).map(r => r.kills).sort((a, b) => a - b), med = ks[ks.length >> 1];
  for (const r of melee.filter(r => r.L === L)) {
    if (r.kills < med * 0.5) console.log(`  ⚠ ${r.k} на ${L} ур.: до падения ${r.kills} при медиане ${med}`);
    if (r.kills > med * 2.2) console.log(`  ⚠ ${r.k} на ${L} ур.: до падения ${r.kills} — вдвое выше медианы ${med}`);
    if (L >= 5 && r.atk < 0.4) console.log(`  ⚠ ${r.k} на ${L} ур.: точность ${r.atk}`);
  }
}
process.exit(0);
