'use strict';
// Изгнание нечисти (js/world/banish.js): обычных призраков снова можно прогнать молитвой героя (призрак замирает,
// герой не пугается), в общей деревне — тоже; изгнание нежити жреца, оберег мага отпускают призраков и гонят банши;
// банши прогоняется кликом, до конца ночи не воет; жнец по-прежнему сопротивляется; ночи без вмешательства прежние.
// Запуск: node tests/banish-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(17);
const J = code => JSON.parse(sim.h.run(`JSON.stringify((() => { ${code} })())`));
S.runFor(sim, 10, 10, () => {});
const atNight = (n, p = 360) => sim.h.run(`{ let t = 0; for (let k = 0; k < ${n}; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA; Game.time = t + ${p}; }`);
sim.h.run('skelReact = function () {};');
const FAR = J(`for (let k = 0; k < 6000; k++) { const x = 8 + Math.floor(Math.random() * (MAP_W - 16)), y = 8 + Math.floor(Math.random() * (MAP_H - 16));
  if (isWalkable(x, y) && isWalkable(x + 3, y) && !nearBonfire(x, y, 16) && !foesNear(x + 0.5, y + 0.5, 14).length) return [x, y]; } return null;`);
ok(FAR, 'не нашлось места вдали от костра');
const setup = (cls, lvl) => sim.h.run(`{ const h = Game.hero, H = h.hero; heroStopUnit(h); h.x = ${FAR[0]} + 0.5; h.y = ${FAR[1]} + 0.5; h.brk = null;
  for (const a of Game.animals) if (Math.hypot(a.x - h.x, a.y - h.y) < 15) a.x += 40;
  for (const N of Game.neutrals || []) if (Math.hypot(N.x - h.x, N.y - h.y) < 15) N.x += 40;
  Game.skels = []; Game.ents = []; Game.ghosts = []; if (Game.fairy2) Game.fairy2.ban = [];
  H.clsKey = '${cls}'; H.cls = GCLS['${cls}'].name; H.mastery = 3; H.level = ${lvl}; H.maxhp = hlMaxHp(H); H.hp = H.maxhp; H.abCd = {}; H.abT = {};
  H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; H.rs = abResKind(H) === 'rage' ? 100 : abResMax(H); if (abResKind(H) === 'mana') H.mana = abResMax(H); h.cmd = null; h.ghostCD = 0; h.exoUntil = 0; }`);
const ghost = (dx, dy = 0, extra = '') => sim.h.run(`{ const h = Game.hero, x = h.x + ${dx}, y = h.y + ${dy};
  Game.ghosts.push(Object.assign({ x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: 0 }, { ${extra} })); }`);
const banshee = (dx, dy = 0) => sim.h.run(`{ const h = Game.hero, F = fz(); const b = fzMakeBanshee(h.x + ${dx}, h.y + ${dy}, false); b.alpha = 0.75; b.wailT = 99; F.ban.push(b); }`);

// ---------- 1. Молитва героя по клику: из 12 попыток удаются почти все ----------
let good = 0;
for (let n = 0; n < 12; n++) {
  atNight(2 + (n % 3), 340 + n * 7); setup('warrior', 3);
  ghost(3 + (n % 3) * 0.7, (n % 2) ? 0.8 : -0.6, '__t: 1');
  const c = J(`const g = Game.ghosts.find(g => g.__t), c = resolveCmd([Math.floor(g.x), Math.floor(g.y)]); if (c) issueCmd(Game.hero, c); return c && c.kind;`);
  ok(c === 'exorcise', `попытка ${n}: клик по призраку — не «Прогнать призрака» (${c})`);
  let done = false;
  for (let t = 0; t < 30 && !done; t++) { S.stepN(sim, 20); done = J(`const g = (Game.ghosts || []).find(g => g.__t); return !g || !!g.exo;`); }
  if (done) good++;
}
console.log(`Проверка: молитвой прогнано ${good} призраков из 12`);
ok(good >= 11, `молитва героя удаётся редко: ${good} из 12`);
// во время молитвы герой не пугается и не бросает приказ
atNight(2); setup('warrior', 3); ghost(2.5);
const scared = J(`const g = Game.ghosts[0], c = resolveCmd([Math.floor(g.x), Math.floor(g.y)]); issueCmd(Game.hero, c); return 0;`);
S.stepN(sim, 10);
ok(J(`return !interruptible(Game.hero);`), 'герой, идущий изгонять, остаётся прерываемым — призрак его спугнёт');

// ---------- 2. Изгнание нежити жреца: без скелетов, только духи ----------
atNight(2); setup('priest', 10); ghost(2); ghost(-2.5, 1); banshee(1.5, -1.5);
const turn = J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === 'turn'); const r = heroAbilityFor(h, i);
  return { r, ghosts: Game.ghosts.filter(g => g.mode !== 'leave').length, ban: fz().ban.filter(b => !b.gone).length, away: fz().banAway > Game.time };`);
ok(turn.r === true, 'изгнание нежити без скелетов не срабатывает рядом с духами');
ok(turn.ghosts === 0, `изгнание нежити не отпустило призраков: осталось ${turn.ghosts}`);
ok(turn.ban === 0 && turn.away, 'изгнание нежити не прогнало банши: ' + JSON.stringify(turn));
// без духов и врагов — способность не тратится
atNight(2); setup('priest', 10);
ok(J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === 'turn'); return heroAbilityFor(h, i) === false;`), 'изгнание нежити тратится впустую');

// ---------- 3. Оберег мага гонит и банши ----------
atNight(2); setup('mage', 5); ghost(3); banshee(-3);
const ward = J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === 'ward'); heroAbilityFor(h, i);
  return { g: Game.ghosts.filter(g => g.mode !== 'leave').length, b: fz().ban.filter(b => !b.gone).length };`);
ok(ward.g === 0 && ward.b === 0, 'оберег мага: ' + JSON.stringify(ward));

// ---------- 4. Банши кликом; не возвращается до конца ночи ----------
atNight(2); setup('warrior', 3); banshee(3);
const bc = J(`const b = fz().ban[0], c = resolveCmd([Math.floor(b.x), Math.floor(b.y)]); if (c) issueCmd(Game.hero, c); return c && { k: c.kind, l: c.label };`);
ok(bc && bc.k === 'banshee' && bc.l === 'Прогнать банши', 'клик по банши: ' + JSON.stringify(bc));
let gone = false;
for (let t = 0; t < 25 && !gone; t++) { S.stepN(sim, 20); gone = J(`return fz().ban.every(b => b.gone);`); }
ok(gone, 'банши не прогнана кликом героя');
ok(J(`return Game.log.some(e => /прогнал банши/.test(e.text || e.t || e));`), 'нет записи в журнале о банши');
S.stepN(sim, 20 * 30);
ok(J(`return !fz().ban.some(b => !b.gone && !b.omen);`), 'плакальщица вернулась сразу после изгнания');

// ---------- 5. Жнец изгнанию сопротивляется ----------
atNight(3, 420); setup('priest', 10);
sim.h.run(`{ const h = Game.hero, x = h.x + 2, y = h.y; Game.ghosts.push({ kind: 'reaper', x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 9, scan: 9, var: 0 }); rpInit(Game.ghosts[0]); }`);
ghost(-2);
const rp = J(`const h = Game.hero, as = heroAbils(h.hero), i = as.findIndex(a => a.k === 'turn'), g = Game.ghosts[0], hp0 = g.hp; RPF.wide = true; const pre = foesNear(h.x, h.y, 6).map(f => f.kind); RPF.wide = false; const nf = (Game.floaters || []).length; let said = []; const _t = toast; toast = m => said.push(m); const r = heroAbilityFor(h, i); toast = _t;
  return { said, fl: (Game.floaters || []).slice(nf).map(f => f.text || f.t), r, pre, inside: !!h.inside, dead: h.dead, lvl: h.hero.level, mode: g.mode, dmg: hp0 - g.hp, ghost: Game.ghosts[1].mode, cd: JSON.stringify(h.hero.abCd), rs: h.hero.rs, fs: foesNear(h.x, h.y, 6).map(f => f.kind) };`);
ok(rp.mode !== 'leave' && rp.dmg > 10, 'жнец: ' + JSON.stringify(rp));
ok(rp.ghost === 'leave', 'рядом со жнецом обычный призрак не отпущен');
ok(J(`const g = Game.ghosts[0]; return !hlGhostAt([Math.floor(g.x), Math.floor(g.y)]) && resolveCmd([Math.floor(g.x), Math.floor(g.y)]).kind === 'attack';`), 'клик по жнецу — не бой');

// ---------- 6. Общая деревня: молитва по клику работает ----------
{
  const srv = S.newSim(41, { coop: true });
  const R = js => srv.h.run(js);
  R(`coopJoin('Ая', JSON.stringify({ cls: 'warrior' }));`);
  S.stepN(srv, 40);
  R(`{ let t = 0; for (let k = 0; k < 2; k++) t += cycleAt(t).nl === NIGHT_LEN ? CYCLE : CYCLE + LONG_EXTRA; Game.time = t + 360;
    const u = coop.players.get('Ая'); heroStopUnit(u); u.cmd = null; Game.ghosts = []; const x = u.x + 2.5, y = u.y;
    Game.ghosts.push({ x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 0, scan: 0, __t: 1 });
    coopGo(u, Math.floor(x), Math.floor(y)); }`);
  const kind = R(`coop.players.get('Ая').cmd && coop.players.get('Ая').cmd.kind`);
  ok(kind === 'exorcise', 'кооп: клик по призраку не даёт молитвы: ' + kind);
  let ex = false;
  for (let t = 0; t < 30 && !ex; t++) { S.stepN(srv, 20); ex = R(`(() => { const g = Game.ghosts.find(g => g.__t); return !g || !!g.exo; })()`); }
  ok(ex, 'кооп: призрак не прогнан');
  if (srv.errors.length) for (const e of srv.errors.slice(0, 3)) ok(false, 'кооп, исключение: ' + e);
}

if (sim.errors.length) for (const e of sim.errors.slice(0, 5)) ok(false, 'исключение: ' + e);
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ изгнание: молитва по клику (и в коопе), изгнание нежити и оберег гонят призраков и банши, жнец сопротивляется');
process.exit(0);
