'use strict';
// Гномки и гномята (folk.js): пол при появлении, не курят, пиво реже, «Бах!» вместо похищения гномёнка,
// гномки и гномята не дерутся с нечистью, сохранение и старые сейвы. Запуск: node tests/folk-test.js [минуты]
const S = require('./lib/sim');
const MIN = +process.argv[2] || 4;
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

const sim = S.newSim(9);
const h = sim.h;
S.runFor(sim, 30, 10, () => S.botTurn(sim));

// пол и имя — сразу при появлении
ok(h.run('Game.units.filter(u => famOn(u)).every(u => u.fam && (u.fam.sx === "f" || u.fam.sx === "m"))'), 'не у всех жителей есть пол');
const fem = h.run('Game.units.filter(u => folkFem(u)).length'), all = h.run('Game.units.filter(u => famOn(u)).length');
console.log(`жителей ${all}, гномок ${fem}`);
ok(fem > 0 && fem < all, 'гномок нет или одни гномки');
ok(h.run('Game.units.filter(u => folkFem(u)).every(u => !u.smoker)'), 'гномка курит');
ok(Math.abs(h.run('folkBeerK(Game.units.find(u => folkFem(u)))') - 1 / 3) < 1e-9, 'гномка пьёт как мужик');
ok(h.run('folkBeerK(Game.units.find(u => famOn(u) && !folkFem(u)))') === 1, 'гном пьёт реже обычного');
h.run('if (typeof profCur !== "function") globalThis.profCur = () => ({ ach: {}, st: {}, lg: {} })');   // в симуляции профиля нет (legacy.js зовёт его из lookOf)
// облик: у гномки нет бороды и маленький нос, у официантки — тоже
ok(h.run('(() => { const L = lookOf({ type: "farmer", look: 5, sx: "f" }); return L.fem && L.noBeard && L.nose === 3 && L.hs >= 0 && L.hs < 6; })()'), 'облик гномки: борода или нос');
ok(h.run('(() => { const L = lookOf({ type: "kid", look: 5 }); return L.kid && L.noBeard && L.capStyle === 8; })()'), 'облик гномёнка: борода или шапочка');
ok(h.run('lookOf({ type: "farmer", look: 5 }).noBeard') === undefined, 'у гнома пропала борода');

// гномёнок
h.run(`{ const m = Game.units.filter(u => famOn(u) && u.type !== "kid"); m[0].fam.sx = "m"; m[1].fam.sx = "f"; m[1].fam.a = 10; famWed(m[0], m[1]); famBirth(m[1], m[0]);
  globalThis.__kid = Game.units.find(u => u.type === "kid"); __kid.food = 1; }`);
ok(h.run('!!__kid && !__kid.smoker'), 'гномёнок не родился или курит');
ok(h.run('lookOf({ type: "kid", look: __kid.look, sx: __kid.fam.sx }).noBeard'), 'гномёнок с бородой');

// «Бах!»: призрак пытается схватить — гномёнок стреляет, призрак удирает, гномёнок цел
h.run(`Game.time = Math.max(Game.time, 40); { const k = __kid; k.proc = null; k.action = null; k.brk = null; k.inside = null;
  globalThis.__g = { kind: 'ghost', x: k.x + 1.2, y: k.y, hx: k.x, hy: k.y, tx: k.x, ty: k.y, ph: 0, mode: 'drift', modeT: 9, retarget: 9, alpha: 1, rev: true, scan: 9, face: 1 };
  Game.ghosts = Game.ghosts || []; Game.ghosts.push(__g); }`);
ok(h.run('ghCanTake(__g, __kid)') === false, 'призрак может утащить гномёнка');
ok(h.run('folkBah(__kid, __g, "ghost")') === true, 'гномёнок не выхватил пистолет');
S.runFor(sim, 0.4, 0.1);
ok(h.run('!!(__kid.bah && __kid.brk && __kid.brk.kind === "bah")'), 'нет состояния «Бах!»');
S.runFor(sim, 4, 0.5);
ok(h.run('!__kid.dead && Game.units.includes(__kid)'), 'гномёнка утащили');
ok(h.run('__g.mode === "leave"'), 'призрак не удрал');
ok(h.run('Game.folk && Game.folk.st.bah') >= 1, 'выстрел не посчитан');
ok(h.run('Game.log.some(e => /пальнул из игрушечного пистолета/.test(e.text || e.t || e[1] || ""))'), 'нет записи в журнале');
ok(h.run('typeof ACH_BY === "undefined" || !!ACH_BY.bah'), 'нет ачивки «Бах!»');   // профиль в симуляции не грузится
S.runFor(sim, 3, 0.5);
ok(h.run('!__kid.bah'), 'гномёнок так и стоит с пистолетом');
// летучая мышь и скелет — тоже мимо
ok(h.run(`(() => { const b = { x: __kid.x, y: __kid.y, z: 0, state: 'fly', leave: false }; return batCanTake(b, __kid) === false; })()`), 'мышь может утащить гномёнка');
// с нечистью не дерутся: гномка от скелета бежит
h.run(`{ globalThis.__w = Game.units.find(u => folkFem(u) && interruptible(u)); globalThis.__s = { x: __w.x + 1, y: __w.y, hx: __w.x, hy: __w.y, seen: new Set(), state: 'roam', fighters: [] }; skelReact(__s, __w); }`);
ok(h.run('__s.state !== "fight" && !__s.fighters.includes(__w)'), 'гномка дерётся со скелетом');

// прогон: ничего не падает, гномята живы
S.runFor(sim, MIN * 60, 10, k => { if (k % 3 === 0) S.botTurn(sim); });
ok(h.run('Game.units.filter(u => u.type === "kid").every(u => !u.smoker && !u.rec)'), 'гномёнок курит или стал рекрутом');

// сейв: пол, счётчики
const s = JSON.parse(h.run('JSON.stringify(serializeGame())'));
const femBefore = h.run('Game.units.filter(u => folkFem(u)).length');
h.ctx.__s = s; h.run('applySave(__s)');
ok(h.run('Game.units.filter(u => folkFem(u)).length') === femBefore, 'пол не сохранился');
ok(h.run('Game.folk && Game.folk.st.bah') >= 1, 'счётчик «Бах!» не сохранился');
// старый сейв без семей — все мужчины
const old = JSON.parse(JSON.stringify(s));
delete old.fam; for (const d of old.units || []) delete d.fam;
h.ctx.__o = old; h.run('applySave(__o)');
ok(h.run('Game.units.filter(u => famOn(u)).every(u => u.fam && u.fam.sx === "m" && u.fam.a >= FAM_ADULT)'), 'старый сейв: не все взрослые мужчины');

console.log(fails.length ? `ПРОВАЛ: ${fails.length}` : 'OK');
process.exit(fails.length ? 1 : 0);
