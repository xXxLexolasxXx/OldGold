'use strict';
// Банши как призрак (js/world/ghosts.js, kind 'banshee'): выходит ночью с кладбища, сама нападает на героя рядом и ранит его,
// клик по ней — бой, её можно убить (опыт, запись в журнале); святая сила снимает ровно половину здоровья; гномов не уносит.
// Запуск: node tests/banshee-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(23);
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
  H.downT = 0; H.stunUntil = 0; H.drunkUntil = 0; h.cmd = null; h.ghostCD = 0; h.exoUntil = 0; }`);
const banshee = (dx, dy = 0) => sim.h.run(`{ const h = Game.hero, x = h.x + ${dx}, y = h.y + ${dy};
  Game.ghosts.push(ghInit({ kind: 'banshee', x, y, hx: x, hy: y, alpha: 1, ph: 0, face: 1, rev: true, fromGy: true, mode: 'drift', modeT: 0, tx: x, ty: y, retarget: 9, scan: 9 })); }`);

// ---------- 1. Здоровье больше, чем у призрака ----------
atNight(2); setup('warrior', 5); banshee(3);
const hp = J(`const g = Game.ghosts[0]; return { b: g.mhp, g: ghMaxHp() };`);
ok(hp.b > hp.g, 'у банши здоровья не больше, чем у призрака: ' + JSON.stringify(hp));

// ---------- 2. Сама нападает на героя рядом и ранит его ----------
const hp0 = J(`return Game.hero.hero.hp;`);
let hit = false;
for (let t = 0; t < 40 && !hit; t++) { S.stepN(sim, 10); hit = J(`return Game.hero.hero.hp < ${hp0};`); }
const ag = J(`const g = Game.ghosts[0]; return { tg: g && g.tg === Game.hero.id, hp: Game.hero.hero.hp };`);
ok(ag.tg, 'банши не нацелилась на героя рядом');
ok(hit, 'банши не ранила героя за 400 тиков: ' + JSON.stringify(ag));

// ---------- 3. Клик по ней — молитва и бой; герой её добивает ----------
atNight(2); setup('warrior', 8); banshee(2.5);
const c = J(`const g = Game.ghosts[0], c = resolveCmd([Math.floor(g.x), Math.floor(g.y)]); if (c) issueCmd(Game.hero, c); return c && { k: c.kind, l: c.label };`);
ok(c && c.k === 'exorcise' && c.l === 'Прогнать банши', 'клик по банши — не «Прогнать банши»: ' + JSON.stringify(c));
let slain = false;
for (let t = 0; t < 60 && !slain; t++) { S.stepN(sim, 20); slain = J(`const g = Game.ghosts.find(g => g.kind === 'banshee'); return !g || !!g.slain;`); J(`const H = Game.hero.hero; H.hp = H.maxhp; return 0;`); }
ok(slain, 'герой не одолел банши за 1200 тиков: ' + JSON.stringify(J(`const g = Game.ghosts.find(g => g.kind === 'banshee'); return g && { hp: g.hp, mhp: g.mhp, mode: g.mode };`)));
ok(J(`return Game.log.some(e => /упокоил банши/.test(e.text || e.t || e));`), 'нет записи в журнале «упокоил банши»');

// ---------- 4. Святая сила — ровно половина ----------
atNight(2); setup('priest', 10); banshee(2);
const half = J(`const g = Game.ghosts[0], h0 = g.hp; ghHoly(g, Game.hero, 'banish'); return { d: h0 - g.hp, need: Math.ceil(g.mhp / 2) };`);
ok(half.d === half.need, 'святая сила сняла не половину: ' + JSON.stringify(half));

// ---------- 5. Выходит ночью с кладбища, одна ----------
const sp = J(`const real = graveyardOf, gy = { x: ${FAR[0]}, y: ${FAR[1]}, w: 4, h: 3 }; graveyardOf = () => gy; Game.ghosts = []; const P = BAN.P; BAN.P = 1;
  ghostsSpawn(0); ghostsSpawn(0); BAN.P = P; graveyardOf = () => null; ghostsSpawn(0); graveyardOf = real;
  const b = Game.ghosts.filter(g => g.kind === 'banshee'); return { n: b.length, inGy: b.every(g => g.x >= gy.x && g.x <= gy.x + gy.w && g.y >= gy.y && g.y <= gy.y + gy.h) };`);
ok(sp.n === 1 && sp.inGy, 'банши выходит не одна или не с кладбища: ' + JSON.stringify(sp));

console.log(fails.length ? `Банши: ${fails.length} ошибок` : 'Проверка: банши нападает, ранит героя, умирает от оружия, святая сила — половина');
process.exit(fails.length ? 1 : 0);
