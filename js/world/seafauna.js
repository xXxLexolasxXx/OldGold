'use strict';
// Морские обитатели (МОРЕ.md). Спрайты — seaart.js, вода и виды водоёмов — ocean.js (OCN).
//  • косяки кильки (море, озеро) разлетаются от героя, лодок и чаек; лосось прыгает (море, река, озеро);
//  • крабы бегают боком по морскому пляжу, щиплют гнома, от героя прячутся в песок, ночью их больше;
//  • морские звёзды и ежи лежат у кромки моря — гномята собирают звёзды; ракушки на пляже, в иной — жемчужина;
//  • медузы дрейфуют, ночью светятся, иную выносит на берег — жалит гнома, что пройдёт рядом;
//  • черепаха летом выходит на пляж, откладывает яйца (кладка сохраняется), через сутки детёныши бегут к воде;
//  • чайки кружат над морем, ныряют за килькой, тащат хлеб из куч у берега; баклан сушит крылья на кекуре и ныряет;
//  • дельфины (редко) идут стайкой и прыгают; кит (очень редко) пускает фонтан и поёт;
//  • осьминог и морской змей (редкие нейтралы) — в глубине; змея герой может одолеть с берега;
//  • КРАКЕН — редкий морской босс-нейтрал: глаз над водой, щупальца бьют по берегу (пугают и калечат гномов,
//    смывают товары из куч в воду, ломают лодки); герой рубит щупальца, гномы втроём помогают; добыча — жемчуг и золото.
// Зимой подо льдом жизнь уходит вглубь: косяки, крабы, медузы, чайки исчезают; звёзды «вмерзают» (не видны).
// Гномёнок может приручить чайку (кормит у воды) или дельфина (машет с берега) — у ручных свои радости.
// В сейв идут кладки черепах, приручённые и счётчики кракена (поле sl). Считает тот, кто считает игру (в коопе — сервер):
// клиенты получают Game.seaLife зеркалом (seaLifeMirrorOut/In) и только рисуют.

const SL_CAP = { shoal: 4, salmon: 3, crab: 5, star: 6, urchin: 3, jelly: 4, turtle: 2, gull: 3, corm: 2, shell: 8 };
const SL_KRAKEN_MIN_DAY = 6;           // кракен не раньше 6-х суток
const SL_KRAKEN_GAP = 900;             // и не чаще раза в 15 минут игры
const SL_TENT_HP = 26;

const SL = () => Game.seaLife || (Game.seaLife = slNew());
function slNew() { return { list: [], t: {}, nests: [], tame: {}, kr: 0, krT: -1e9, krWon: 0, seen: {} }; }

// Свой генератор случайных чисел (от сида карты): море не сдвигает общий Math.random — остальная симуляция
// идёт так же, как без моря, а одинаковый сид даёт одинаковое море
function slRand() {
  const S = SL();
  if (S.rs == null) S.rs = ((Game.seed | 0) ^ 0x5EA11FE) >>> 0;
  const a = S.rs = (S.rs + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const slOn = () => typeof FAUNA_ON === 'function' && FAUNA_ON() && typeof oceanPrep === 'function';
const slR = (a, b) => a + slRand() * (b - a);
const slFr = (o, anim, fps) => Math.floor((o.ph || 0) * fps) % seaFrames(o.sk || o.k, anim);
const slIce = () => (typeof SEA === 'function' ? SEA().ice || 0 : 0);
const slNight = () => (typeof nightAmt === 'function' ? nightAmt() : 0);
const slOnce = (k, gap) => { const S = SL(); if (Game.time - (S.seen[k] ?? -1e9) < gap) return false; S.seen[k] = Game.time; return true; };

// ---------- Где что живёт ----------
function slKind(x, y) { const O = OCN; if (!O.on || !inb(x, y)) return 0; return O.kind[idx(x, y)]; }
function slDep(x, y) { const O = OCN; if (!O.on || !inb(x, y)) return 0; return O.dep[idx(x, y)]; }
const slSea = (x, y) => slKind(x | 0, y | 0) === OC_SEA;
const slWet = (x, y) => slKind(x | 0, y | 0) > 0;
// морской пляж: песок у морской воды
function slBeach(x, y) {
  if (!inb(x, y)) return false;
  const i = idx(x, y);
  return World.terrain[i] === T_SAND && OCN.near[i] === OC_SEA && !World.bmap[i] && !World.road[i];
}
function slPick(test, tries = 60) {
  for (let k = 0; k < tries; k++) {
    const x = (slRand() * MAP_W) | 0, y = (slRand() * MAP_H) | 0;
    if (test(x, y)) return [x + 0.5, y + 0.5];
  }
  return null;
}
function slNearPick(cx, cy, r, test, tries = 30) {
  for (let k = 0; k < tries; k++) {
    const x = Math.round(cx + slR(-r, r)), y = Math.round(cy + slR(-r, r));
    if (inb(x, y) && test(x, y)) return [x + 0.5, y + 0.5];
  }
  return null;
}
function slHas(k) { let n = 0; for (const o of SL().list) if (o.k === k) n++; return n; }
const slHero = () => { const h = Game.hero; return h && !h.dead && !h.inside ? h : null; };
function slPeopleNear(x, y, r, pred) {
  const out = [];
  for (const u of Game.units) {
    if (u.inside || u.dead || !isPerson(u) || u.type === 'carter') continue;
    if (Math.hypot(u.x - x, u.y - y) < r && (!pred || pred(u))) out.push(u);
  }
  return out;
}
// куда идёт по воде: та же вода (тест), иначе разворот
function slSwim(o, sp, dt, test) {
  const nx = o.x + Math.cos(o.a) * sp * dt, ny = o.y + Math.sin(o.a) * sp * dt;
  if (test(nx | 0, ny | 0)) { o.x = nx; o.y = ny; } else o.a += Math.PI * (0.6 + slRand() * 0.8);
  if (slRand() < dt * 0.25) o.a += slR(-1, 1);
  o.face = Math.cos(o.a) >= 0 ? 1 : -1;
}
function slWalk(o, tx, ty, sp, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.08) return true;
  const s = Math.min(d, sp * dt);
  o.x += dx / d * s; o.y += dy / d * s;
  return false;
}
function slAdd(o) { o.ph = slRand() * 10; o.face = o.face || 1; SL().list.push(o); return o; }

// ---------- Появление ----------
function slSpawnTick() {
  const S = SL(), O = OCN, ice = slIce(), night = slNight(), sum = seaIdx() === 0;
  const cap = k => SL_CAP[k] * (k === 'crab' && night > 0.5 ? 1.4 : 1);
  if (ice > 0.5) return;   // под льдом никто не появляется
  const want = (k, test) => { if (slHas(k) >= cap(k)) return null; return slPick(test); };
  let p;
  if ((p = want('shoal', (x, y) => (slKind(x, y) === OC_SEA || slKind(x, y) === OC_LAKE) && slDep(x, y) >= 2))) slAdd({ k: 'shoal', x: p[0], y: p[1], a: slRand() * 6.28, n: 6 + ((slRand() * 4) | 0), seed: slRand() * 99, scat: 0 });
  if ((p = want('salmon', (x, y) => slKind(x, y) && slKind(x, y) !== OC_SWAMP && slDep(x, y) >= 2))) slAdd({ k: 'salmon', x: p[0], y: p[1], a: slRand() * 6.28, st: 'swim', t: slR(4, 12) });
  if ((p = want('crab', slBeach))) slAdd({ k: 'crab', x: p[0], y: p[1], st: 'idle', t: slR(2, 6), tx: p[0], ty: p[1] });
  if ((p = want('star', (x, y) => slSea(x, y) && slDep(x, y) === 1))) slAdd({ k: slRand() < 0.7 ? 'star' : 'urchin', x: p[0] + slR(-0.3, 0.3), y: p[1] + slR(-0.3, 0.3), face: slRand() < 0.5 ? 1 : -1 });
  if ((p = want('jelly', (x, y) => slSea(x, y) && slDep(x, y) >= 2))) slAdd({ k: 'jelly', x: p[0], y: p[1], a: slRand() * 6.28, st: 'swim' });
  if ((p = want('shell', slBeach))) slAdd({ k: 'shell', x: p[0] + slR(-0.3, 0.3), y: p[1] + slR(-0.3, 0.3), v: slRand() < 0.5 ? 0 : 1, pearl: slRand() < 0.12 });
  if (night < 0.5 && (p = want('gull', (x, y) => slSea(x, y)))) slAdd({ k: 'gull', x: p[0], y: p[1], z: 40, st: 'fly', a: slRand() * 6.28, t: slR(8, 20), cx: p[0], cy: p[1] });
  if ((p = want('corm', (x, y) => World.terrain[idx(x, y)] === T_ROCK && (slSea(x + 1, y) || slSea(x - 1, y) || slSea(x, y + 1) || slSea(x, y - 1))))) slAdd({ k: 'corm', x: p[0], y: p[1] + 0.2, hx: p[0], hy: p[1] + 0.2, z: 0, st: 'idle', t: slR(12, 30) });
  if (sum && slHas('turtle') < 1 && slRand() < 0.25 && (p = slPick((x, y) => slSea(x, y) && slDep(x, y) === 1))) slAdd({ k: 'turtle', x: p[0], y: p[1], st: 'swim', a: slRand() * 6.28, t: slR(20, 40), lay: S.nests.length < 3 });
  // редкие: дельфины, кит, осьминог, змей
  if (night < 0.6 && !slHas('dolphin') && slRand() < 0.06 && (p = slPick((x, y) => slSea(x, y) && slDep(x, y) >= 4))) {
    const n = 2 + ((slRand() * 2) | 0), a = slRand() * 6.28;
    for (let k = 0; k < n; k++) slAdd({ k: 'dolphin', x: p[0] + k * 0.9, y: p[1] + k * 0.6, a, st: 'swim', t: slR(1, 4), life: 75 });
    if (slOnce('dolphLog', 300)) logEvent('animal', 'В море резвятся дельфины', p[0], p[1]);
  }
  if (!slHas('whale') && slRand() < 0.012 && (p = slPick((x, y) => slSea(x, y) && slDep(x, y) >= 6, 120))) {
    slAdd({ k: 'whale', x: p[0], y: p[1], a: slRand() * 6.28, st: 'swim', t: 6, life: 110 });
    logEvent('animal', 'У горизонта всплыл кит — видите фонтан?', p[0], p[1]);
    if (slOnce('whaleToast', 900)) toast('🐋 В море кит! Над водой бьёт фонтан, слышна песня.');
    fstat('whale');
  }
  if (!slHas('octo') && slRand() < 0.02 && (p = slPick((x, y) => slSea(x, y) && slDep(x, y) >= 3))) slAdd({ k: 'octo', x: p[0], y: p[1], a: slRand() * 6.28, st: 'idle', t: slR(5, 10), life: 50, hp: 8 });
  if (!slHas('serpent') && cycleAt(Game.time).k >= 3 && slRand() < 0.01 && (p = slPick((x, y) => slSea(x, y) && slDep(x, y) >= 4))) {
    slAdd({ k: 'serpent', x: p[0], y: p[1], a: slRand() * 6.28, st: 'swim', t: 4, life: 140, hp: 40 });
    logEvent('animal', 'В море мелькнули зелёные горбы — морской змей', p[0], p[1]);
    if (slOnce('serpToast', 900)) toast('🐍 В море плавает морской змей. Герой на берегу может с ним сразиться.');
  }
  slKrakenTry();
}

// ---------- Ход ----------
function slTick(dt) {
  const S = SL();
  if (!slOn()) return;
  if (!oceanPrep()) { if (S.list.length) S.list.length = 0; return; }
  S.t.sp = (S.t.sp ?? 3) - dt;
  if (S.t.sp <= 0) { S.t.sp = 4 + slRand() * 3; if (startOpen('critters')) slSpawnTick(); }
  const ice = slIce(), night = slNight(), hero = slHero();
  for (let i = S.list.length - 1; i >= 0; i--) {
    const o = S.list[i];
    o.ph += dt;
    if (o.gone || (o.life != null && (o.life -= dt) <= 0 && o.st !== 'die')) { S.list.splice(i, 1); continue; }
    if (ice > 0.6 && (o.k === 'shoal' || o.k === 'crab' || o.k === 'jelly' || o.k === 'gull' || o.k === 'salmon' || o.k === 'turtle')) { S.list.splice(i, 1); continue; }   // зимой уходят вглубь и на юг
    const fn = SL_TICK[o.k];
    if (fn && fn(o, dt, hero, night) === false) S.list.splice(S.list.indexOf(o), 1);
  }
  slNestsTick(dt);
  slKrakenTick(dt);
}

const SL_TICK = {
  shoal(o, dt, hero) {
    const scared = (hero && Math.hypot(hero.x - o.x, hero.y - o.y) < 2.5) || o.scatT > Game.time;
    o.scat += (scared ? 1 : -0.4) * dt * 2; o.scat = Math.max(0, Math.min(1, o.scat));
    slSwim(o, 0.5 + o.scat * 1.4, dt, (x, y) => slDep(x, y) >= 2);
  },
  salmon(o, dt) {
    if (o.st === 'jump') { if ((o.t -= dt) <= 0) { o.st = 'swim'; o.t = slR(6, 14); slSplash(o.x + o.face * 0.4, o.y, 0.7); } return; }
    slSwim(o, 0.45, dt, (x, y) => slDep(x, y) >= 2);
    if ((o.t -= dt) <= 0) { o.st = 'jump'; o.t = 0.9; o.ph = 0; slSplash(o.x, o.y, 0.6); }
  },
  crab(o, dt, hero, night) {
    if (o.st === 'die' || o.st === 'hide') { if ((o.t -= dt) <= 0) return false; return; }
    if (hero && Math.hypot(hero.x - o.x, hero.y - o.y) < 2.2) {
      if (slRand() < 0.3 && Math.hypot(hero.x - o.x, hero.y - o.y) < 1.1) {   // поймал
        o.st = 'die'; o.t = 1; o.ph = 0; dropPile(o.x | 0, o.y | 0, 'fish', 1); floater(o.x, o.y - 1, 'Краб!', '#ffd0a0'); fstat('crabCaught');
      } else { o.st = 'hide'; o.t = 1; o.ph = 0; floater(o.x, o.y - 0.8, 'Шмыг!', '#f4e0c0'); }
      return;
    }
    if (o.st === 'atk') { if ((o.t -= dt) <= 0) { o.st = 'idle'; o.t = slR(2, 5); } return; }
    const g = slPeopleNear(o.x, o.y, 0.9, u => u.type !== 'hero' && u.type !== 'kid' && !u.fun)[0];   // гномят и рыбаков с удочкой не щиплет
    if (g && slOnce('crab' + (g.id || ''), 20)) {
      o.st = 'atk'; o.t = 9 / 12; o.ph = 0; o.face = g.x > o.x ? 1 : -1;
      floater(g.x, g.y - 1.4, 'Ай! Щип!', '#ffb090'); faunaSfx('crabSnap', o.x, o.y);
      if (!g.injury) scare(g, o); fstat('crabPinch');
      return;
    }
    if (o.st === 'walk') { if (slWalk(o, o.tx, o.ty, 1.3, dt)) { o.st = 'idle'; o.t = slR(1.5, 5) * (night > 0.5 ? 0.6 : 1); } return; }
    if ((o.t -= dt) <= 0) {
      const p = slNearPick(o.x, o.y, 2.5, (x, y) => slBeach(x, y) || (slSea(x, y) && slDep(x, y) === 1));
      if (p) { o.st = 'walk'; o.tx = p[0] + slR(-0.3, 0.3); o.ty = p[1] + slR(-0.3, 0.3); o.face = o.tx > o.x ? 1 : -1; }
      else o.t = 3;
    }
  },
  star(o) { return slPickup(o, 'Звёздочка!', 'starPick'); },
  urchin() {},
  shell(o) { return slPickup(o, o.pearl ? 'Жемчужина!' : 'Ракушка!', 'shellPick'); },
  jelly(o, dt) {
    if (o.st === 'die') { if (o.ph > 0.8) return false; return; }
    if (o.st === 'beach') {   // вынесло на берег: жалит, кто рядом пройдёт; сохнет
      o.dry = (o.dry || 0) + dt;
      const g = slPeopleNear(o.x, o.y, 0.8, u => u.type !== 'kid')[0];
      if (g && slOnce('jel' + (g.id || ''), 30)) { o.st = 'atk'; o.t = 0.75; o.ph = 0; floater(g.x, g.y - 1.4, 'Ай, медуза!', '#f0c0ff'); faunaSfx('jellyZap', o.x, o.y); if (g.type === 'hero') hlHurt(g, 2, true); else if (!g.injury) scare(g, o); fstat('jellySting'); }
      if (o.dry > 60) { o.st = 'die'; o.ph = 0; }
      return;
    }
    if (o.st === 'atk') { if ((o.t -= dt) <= 0) o.st = o.dry != null ? 'beach' : 'swim'; return; }
    slSwim(o, 0.12, dt, (x, y) => slSea(x, y));
    if (slDep(o.x | 0, o.y | 0) === 1 && slRand() < dt * 0.01) { o.st = 'beach'; o.dry = 0; }
  },
  turtle(o, dt) {
    if (o.st === 'swim') {
      slSwim(o, 0.25, dt, (x, y) => slSea(x, y));
      if ((o.t -= dt) <= 0) {
        if (o.lay) { const p = slNearPick(o.x, o.y, 4, (x, y) => slBeach(x, y) && !slSea(x, y)); if (p) { o.st = 'walk'; o.tx = p[0]; o.ty = p[1]; o.face = o.tx > o.x ? 1 : -1; return; } }
        return false;
      }
      return;
    }
    if (o.st === 'walk') { if (slWalk(o, o.tx, o.ty, 0.35, dt)) { o.st = 'lay'; o.t = 18; } return; }
    if (o.st === 'lay') {
      if ((o.t -= dt) <= 0) {
        SL().nests.push({ x: +o.x.toFixed(2), y: +o.y.toFixed(2), t0: Game.time });
        logEvent('animal', 'Черепаха отложила яйца на пляже — детёныши вылупятся через сутки', o.x, o.y);
        if (slOnce('turtToast', 600)) toast('🐢 Черепаха отложила яйца на пляже. Не ставьте там дорогу — через сутки вылупятся черепашата!');
        fstat('turtleNest');
        o.st = 'back'; o.lay = false;
        const w = slNearPick(o.x, o.y, 4, (x, y) => slSea(x, y)); o.tx = w ? w[0] : o.x; o.ty = w ? w[1] : o.y;
      }
      return;
    }
    if (o.st === 'back') { if (slWalk(o, o.tx, o.ty, 0.35, dt)) { o.st = 'swim'; o.t = 10; } o.face = o.tx > o.x ? 1 : -1; }
  },
  hatch(o, dt) { if (slWalk(o, o.tx, o.ty, 0.6, dt)) { slSplash(o.x, o.y, 0.3); return false; } },
  gull(o, dt, hero, night) {
    const S = SL();
    if (o.st === 'die') { o.z = Math.max(0, o.z - 30 * dt); if (o.ph > 1) return false; return; }
    if (night > 0.6 && o.st === 'fly') { o.st = 'leave'; o.a = slRand() * 6.28; }
    if (o.st === 'leave') { o.x += Math.cos(o.a) * 3 * dt; o.y += Math.sin(o.a) * 3 * dt; o.z += 10 * dt; o.face = Math.cos(o.a) >= 0 ? 1 : -1; if (!inb(o.x | 0, o.y | 0) || o.z > 140) return false; return; }
    if (o.st === 'fly') {   // круги над морем
      o.a += dt * 0.6;
      const r = 2.5;
      const tx = o.cx + Math.cos(o.a) * r, ty = o.cy + Math.sin(o.a) * r * 0.6;
      o.face = tx > o.x ? 1 : -1; o.x += (tx - o.x) * Math.min(1, dt * 2); o.y += (ty - o.y) * Math.min(1, dt * 2);
      o.z += (40 - o.z) * dt;
      if (slRand() < dt * 0.04) { const c = slNearPick(o.cx, o.cy, 7, (x, y) => slSea(x, y)); if (c) { o.cx = c[0]; o.cy = c[1]; } }
      if ((o.t -= dt) <= 0) {
        o.t = slR(10, 22);
        const sh = S.list.find(q => q.k === 'shoal' && Math.hypot(q.x - o.x, q.y - o.y) < 6);
        const steal = night < 0.3 && S.tame.gull !== true && slStealPile(o);
        if (steal) { o.st = 'steal'; o.tgt = steal; o.d0 = Math.hypot(steal.x - o.x, steal.y - o.y) || 1; }
        else if (sh) { o.st = 'dive'; o.tgt = sh; }
        else if (slRand() < 0.3) { const b = slNearPick(o.x, o.y, 6, slBeach); if (b) { o.st = 'land'; o.tx = b[0]; o.ty = b[1]; } }
        if (slRand() < 0.2) faunaSfx('gull', o.x, o.y, 0.7);
      }
      return;
    }
    if (o.st === 'dive') {
      const sh = o.tgt;
      if (!sh || !S.list.includes(sh)) { o.st = 'fly'; return; }
      o.face = sh.x > o.x ? 1 : -1; slWalk(o, sh.x, sh.y, 4, dt); o.z = Math.max(0, o.z - 50 * dt);
      if (o.z <= 0) {
        slSplash(o.x, o.y, 0.6); sh.scatT = Game.time + 3;
        if (sh.n > 3 && slRand() < 0.6) { sh.n--; o.fish = true; fstat('gullFish'); }
        o.st = 'fly'; o.t = slR(8, 16);
      }
      return;
    }
    if (o.st === 'steal') {
      const p = o.tgt;
      if (!p || p.removed || !(p.stock.bread - p.reserved.bread > 0)) { o.st = 'fly'; return; }
      o.face = p.x + 0.5 > o.x ? 1 : -1; slWalk(o, p.x + 0.5, p.y + 0.5, 4, dt);
      o.z = 40 * Math.min(1, Math.hypot(p.x + 0.5 - o.x, p.y + 0.5 - o.y) / o.d0);
      const sh = shooersNear(o.x, o.y, 2.5, 3);
      if (sh) { o.st = 'fly'; o.cx = o.x + slR(-5, 5); o.cy = o.y - 4; floater(o.x, o.y - 1.5, 'Кыш!', '#fff2c0'); faunaSfx('gull', o.x, o.y); if (sh.hero && slRand() < 0.25) { o.st = 'die'; o.ph = 0; fstat('gullDown'); } return; }
      if (o.z < 2) {
        p.stock.bread--; o.bread = true; fstat('gullBread');
        floater(p.x + 0.5, p.y - 0.5, 'Хлеб утащила!', '#ffe0a0'); faunaSfx('gull', o.x, o.y, 1);
        if (slOnce('gullLog', 240)) logEvent('animal', 'Чайка утащила хлеб из кучи у берега — держите склад подальше от воды', p.x, p.y);
        o.st = 'fly'; o.cx = o.x; o.cy = o.y - 3; o.t = slR(15, 30);
      }
      return;
    }
    if (o.st === 'land') { o.face = o.tx > o.x ? 1 : -1; if (slWalk(o, o.tx, o.ty, 2.5, dt)) { o.z = Math.max(0, o.z - 40 * dt); if (o.z <= 0) { o.st = 'stand'; o.t = slR(8, 20); } } return; }
    if (o.st === 'stand') {
      const near = slPeopleNear(o.x, o.y, 1.8)[0];
      if (near || (o.t -= dt) <= 0 || night > 0.6) { o.st = 'fly'; o.cx = o.x; o.cy = o.y - 2; o.t = slR(6, 12); if (near) faunaSfx('gull', o.x, o.y, 0.6); }
    }
  },
  corm(o, dt) {
    if (o.st === 'idle') { if ((o.t -= dt) <= 0) { const w = slNearPick(o.hx, o.hy, 5, (x, y) => slSea(x, y) && slDep(x, y) >= 2); if (w) { o.st = 'fly'; o.tx = w[0]; o.ty = w[1]; } else o.t = 10; } return; }
    if (o.st === 'fly') { o.face = o.tx > o.x ? 1 : -1; o.z = Math.min(26, o.z + 30 * dt); if (slWalk(o, o.tx, o.ty, 3, dt)) { o.st = 'dive'; o.ph = 0; o.t = 0.8; } return; }
    if (o.st === 'dive') { o.z = Math.max(0, o.z - 40 * dt); if ((o.t -= dt) <= 0) { slSplash(o.x, o.y, 0.6); o.st = 'under'; o.t = slR(2, 4); } return; }
    if (o.st === 'under') { if ((o.t -= dt) <= 0) { o.st = 'home'; slSplash(o.x, o.y, 0.4); o.fish = slRand() < 0.6; if (o.fish) fstat('cormFish'); } return; }
    if (o.st === 'home') { o.face = o.hx > o.x ? 1 : -1; o.z = Math.min(20, o.z + 30 * dt); if (slWalk(o, o.hx, o.hy, 3, dt)) { o.z = 0; o.fish = false; o.st = 'idle'; o.t = slR(15, 35); } }
  },
  dolphin(o, dt) {
    if (o.st === 'jump') { if ((o.t -= dt) <= 0) { o.st = 'swim'; o.t = slR(2, 5); slSplash(o.x + o.face, o.y, 0.8); } return; }
    slSwim(o, 1.1, dt, (x, y) => slSea(x, y) && slDep(x, y) >= 3);
    if ((o.t -= dt) <= 0) { o.st = 'jump'; o.t = 1.1; o.ph = 0; slSplash(o.x, o.y, 0.8); faunaSfx('dolphin', o.x, o.y, 0.7); slTameTry('dolphin', o); }
  },
  whale(o, dt) {
    slSwim(o, 0.28, dt, (x, y) => slSea(x, y) && slDep(x, y) >= 5);
    if ((o.t -= dt) <= 0) {
      if (o.st === 'swim') { o.st = 'spout'; o.t = 1.4; o.ph = 0; faunaSfx('spout', o.x, o.y); if (slRand() < 0.5) faunaSfx('whaleSong', o.x, o.y, 0.9, 0.5); }
      else { o.st = 'swim'; o.t = slR(9, 14); }
    }
  },
  octo(o, dt, hero) {
    if (o.st === 'die') { if (o.ph > 1) return false; return; }
    if (hero && Math.hypot(hero.x - o.x, hero.y - o.y) < 2.6) { o.st = 'die'; o.ph = 0; floater(o.x, o.y - 1, 'Пшш! (чернила)', '#c8c0e0'); slSplash(o.x, o.y, 0.6); fstat('octoInk'); if (slRand() < 0.3) slLootShore(o.x, o.y, 'pearl', 1); return; }
    if (o.st === 'atk') { if ((o.t -= dt) <= 0) { o.st = 'idle'; o.t = slR(4, 8); } return; }
    if (o.st === 'swim') { slSwim(o, 0.7, dt, (x, y) => slSea(x, y) && slDep(x, y) >= 2); if ((o.t -= dt) <= 0) { o.st = 'idle'; o.t = slR(4, 8); } return; }
    if ((o.t -= dt) <= 0) { o.st = slRand() < 0.3 ? 'atk' : 'swim'; o.t = o.st === 'atk' ? 0.75 : slR(3, 6); o.ph = 0; }
  },
  serpent(o, dt, hero) {
    if (o.st === 'die') { if (o.ph > 1.2) return false; return; }
    const hd = hero ? Math.hypot(hero.x - (o.x + o.face * 0.9), hero.y - o.y) : 99;
    if (o.st === 'atk') {
      if ((o.t -= dt) <= 0) {
        o.st = 'swim'; o.t = slR(2, 4);
        if (hero && hd < 2.2) { hlHurt(hero, 6, true); faunaSfx('serpHiss', o.x, o.y); }
      }
      if (hero && hd < 2.4) {   // герой рубит голову, пока змей вздымается
        o.hp -= dt * 9; hero.gest = 'fist'; hero.gestUntil = Game.time + 0.6; hero.gestFace = o.x > hero.x ? 1 : -1;
        if (o.hp <= 0) {
          o.st = 'die'; o.ph = 0; o.life = null;
          slLootShore(o.x, o.y, 'hide', 3); slLootShore(o.x, o.y, 'gold', 4);
          logEvent('gold', 'Герой одолел морского змея: шкура и золото на берегу', o.x, o.y); toast('Герой одолел морского змея! Шкура и золото — на берегу.'); fstat('serpentWon');
        }
      }
      return;
    }
    // к берегу, если герой там стоит
    if (hero && hd < 6 && slDep(hero.x | 0, hero.y | 0) === 0) { o.a = Math.atan2(hero.y - o.y, hero.x - o.x); }
    slSwim(o, 0.8, dt, (x, y) => slSea(x, y) && slDep(x, y) >= 2);
    if ((o.t -= dt) <= 0) { o.t = slR(3, 6); if (hero && hd < 3) { o.st = 'atk'; o.t = 0.9; o.ph = 0; faunaSfx('serpHiss', o.x, o.y); } }
  },
};

function slPickup(o, text, stat) {
  const kid = slPeopleNear(o.x, o.y, 1.2, u => u.type === 'kid' || u.type === 'hero')[0];
  if (!kid) return;
  floater(o.x, o.y - 1, text, '#fff0c8'); fstat(stat);
  if (o.k === 'shell' && o.pearl) { dropPile(Math.floor(kid.x), Math.floor(kid.y), 'pearl', 1); logEvent('gold', 'В ракушке на пляже нашлась жемчужина', o.x, o.y); }
  return false;
}
// куча с хлебом у морского берега (чайки тащат)
function slStealPile(o) {
  for (const p of Game.piles.values()) {
    if (p.removed || !(p.stock.bread - p.reserved.bread > 0)) continue;
    if (Math.hypot(p.x - o.x, p.y - o.y) > 9) continue;
    if (OCN.near[idx(p.x, p.y)] !== OC_SEA && !(slSea(p.x + 1, p.y) || slSea(p.x - 1, p.y) || slSea(p.x, p.y + 2) || slSea(p.x, p.y - 2))) continue;
    return p;
  }
  return null;
}
function slLootShore(x, y, g, n) {
  const s = slNearPick(x, y, 4, (xx, yy) => isWalkable(xx, yy) && !slWet(xx, yy), 60) || [Game.hero ? Game.hero.x : x, Game.hero ? Game.hero.y : y];
  dropPile(Math.floor(s[0]), Math.floor(s[1]), g, n);
}
function slSplash(x, y, k = 1) {
  const sp = Game.splash || (Game.splash = []);
  sp.push({ x, y, t0: Game.time }); if (sp.length > 24) sp.shift();
  if (k >= 0.5) faunaSfx('splash', x, y, k);
}

// ---------- Кладки черепах ----------
function slNestsTick() {
  const S = SL();
  for (let i = S.nests.length - 1; i >= 0; i--) {
    const n = S.nests[i];
    if (World.road[idx(n.x | 0, n.y | 0)] || World.bmap[idx(n.x | 0, n.y | 0)]) { S.nests.splice(i, 1); logEvent('animal', 'Кладку черепахи раздавили стройкой', n.x, n.y); continue; }
    if (Game.time - n.t0 < CYCLE) continue;
    S.nests.splice(i, 1);
    const w = slNearPick(n.x, n.y, 5, (x, y) => slSea(x, y), 60);
    if (!w) continue;
    for (let k = 0; k < 3; k++) slAdd({ k: 'hatch', x: n.x + slR(-0.3, 0.3), y: n.y + slR(-0.2, 0.2), tx: w[0] + slR(-0.4, 0.4), ty: w[1] + slR(-0.4, 0.4) }).face = w[0] > n.x ? 1 : -1;
    logEvent('animal', 'Вылупились черепашата и бегут к морю', n.x, n.y); fstat('turtleHatch');
    const kids = slPeopleNear(n.x, n.y, 8, u => u.type === 'kid');
    if (kids[0]) floater(kids[0].x, kids[0].y - 1.4, 'Черепашки!!!', '#d0ffd0');
  }
}

// ---------- Приручение детьми: чайку кормят, дельфину машут ----------
function slTameTry(kind, o) {
  const S = SL();
  if (S.tame[kind]) {   // уже ручной: дельфин приносит со дна жемчужину ребёнку на берегу
    if (kind === 'dolphin' && slRand() < 0.05) { const k = slPeopleNear(o.x, o.y, 7, u => u.type === 'kid')[0]; if (k) { slLootShore(k.x, k.y, 'pearl', 1); floater(k.x, k.y - 1.4, 'Подарок от дельфина!', '#c8f0ff'); fstat('dolphinGift'); } }
    return;
  }
  const kid = slPeopleNear(o.x, o.y, 6, u => u.type === 'kid')[0];
  if (!kid || (kind === 'dolphin' && slRand() > 0.25)) return;
  S.tame[kind] = kid.fam ? kid.fam.n : 'гномёнок';
  floater(kid.x, kid.y - 1.4, kind === 'dolphin' ? 'Он мне помахал!' : 'Моя чайка!', '#d0f0ff');
  logEvent('people', `${S.tame[kind]} подружился с ${kind === 'dolphin' ? 'дельфином: тот теперь приплывает к нему' : 'чайкой: она больше не ворует хлеб'}`, kid.x, kid.y);
  toast(kind === 'dolphin' ? '🐬 Гномёнок подружился с дельфином!' : '🕊 Гномёнок приручил чайку — она больше не ворует хлеб.');
  fstat(kind + 'Tame');
}
// гномёнок у моря кормит стоящую на пляже чайку (раз в 20 с проверка)
function slKidsTick() {
  const S = SL();
  if (S.tame.gull) return;
  for (const o of S.list) if (o.k === 'gull' && o.st === 'stand') {
    const k = slPeopleNear(o.x, o.y, 3, u => u.type === 'kid')[0];
    if (k && slRand() < 0.3) { floater(k.x, k.y - 1.4, 'На, крошки!', '#fff0c0'); slTameTry('gull', o); }
    return;
  }
}

// ---------- Кракен ----------
function slKrakenTry() {
  const S = SL();
  if (S.kr || Game.time - S.krT < SL_KRAKEN_GAP || cycleAt(Game.time).k < SL_KRAKEN_MIN_DAY || !startOpen('raid')) return;
  if (slRand() > 0.04) return;
  // глубокая вода у населённого пляжа
  const homes = Game.buildings.filter(b => b.state === 'done' && !b.removed);
  let spot = null;
  for (let t = 0; t < 80 && !spot; t++) {
    const b = homes.length && slRand() < 0.7 ? homes[(slRand() * homes.length) | 0] : null;
    const p = b ? slNearPick(b.x + b.w / 2, b.y + b.h / 2, 12, (x, y) => slSea(x, y) && slDep(x, y) >= 3 && slDep(x, y) <= 5, 20) : slPick((x, y) => slSea(x, y) && slDep(x, y) === 3, 20);
    if (p) spot = p;
  }
  if (!spot) return;
  S.krT = Game.time;
  const tents = [];
  for (let k = 0; k < 5; k++) {
    const p = slNearPick(spot[0], spot[1], 4, (x, y) => slSea(x, y) && slDep(x, y) <= 2, 40);
    if (p) tents.push({ x: p[0] + slR(-0.3, 0.3), y: p[1] + slR(-0.3, 0.3), st: 'rise', ph: 0, t: slR(0.5, 3), hp: SL_TENT_HP, face: 1 });
  }
  if (tents.length < 2) return;
  S.kr = { x: spot[0], y: spot[1], tents, life: 200, ph: 0, st: 'up', loot: false };
  logEvent('raid', 'Из моря поднялся КРАКЕН! Щупальца бьют по берегу', spot[0], spot[1]);
  toast('🦑 КРАКЕН! Щупальца бьют по берегу. Уводите гномов от воды, герой — руби щупальца!', null, 'imp');
  faunaSfx('krakenRoar', spot[0], spot[1], 1);
  fstat('kraken');
}
function slKrakenTick(dt) {
  const S = SL(), K = S.kr;
  if (!K) return;
  K.ph += dt; K.life -= dt;
  const hero = slHero();
  let alive = 0;
  for (const t of K.tents) {
    t.ph += dt;
    if (t.st === 'dead') continue;
    if (t.st === 'die') { if (t.ph > 1.1) t.st = 'dead'; continue; }
    alive++;
    if (t.st === 'rise') { if (t.ph > 0.6) { t.st = 'idle'; t.ph = 0; t.t = slR(2, 5); } continue; }
    // герой рубит щупальце, толпа гномов отбивается
    const hd = hero ? Math.hypot(hero.x - t.x, hero.y - t.y) : 99;
    if (hd < 2.2) { t.hp -= dt * 8; hero.gest = 'fist'; hero.gestUntil = Game.time + 0.6; hero.gestFace = t.x > hero.x ? 1 : -1; hero.combatUntil = Game.time + 3; }
    const crowd = slPeopleNear(t.x, t.y, 2.4, u => u.type !== 'hero' && u.type !== 'kid');
    if (crowd.length >= 3) t.hp -= dt * 2.5;
    if (t.hp <= 0) { t.st = 'die'; t.ph = 0; slSplash(t.x, t.y, 1); faunaSfx('krakenRoar', t.x, t.y, 0.6); floater(t.x, t.y - 2, 'Щупальце отрублено!', '#f0c0e0'); continue; }
    if (t.st === 'atk') {
      if (t.ph >= 5 / 12 && !t.hit) { t.hit = true; slTentSlam(t, hero); }
      if (t.ph > 0.75) { t.st = 'idle'; t.ph = 0; t.t = slR(3, 6); t.hit = false; }
      continue;
    }
    if ((t.t -= dt) <= 0) {
      const tgt = slPeopleNear(t.x, t.y, 3)[0] || [...Game.piles.values()].find(p => !p.removed && Math.hypot(p.x + 0.5 - t.x, p.y + 0.5 - t.y) < 3);
      if (tgt) { t.st = 'atk'; t.ph = 0; t.face = (tgt.x + (tgt.stock ? 0.5 : 0)) > t.x ? 1 : -1; }
      else t.t = slR(1.5, 3);
    }
  }
  if (!alive && !K.loot) {   // побеждён
    K.loot = true; K.st = 'die'; K.ph = 0; K.life = 3; S.krWon++;
    slLootShore(K.x, K.y, 'pearl', 3 + ((slRand() * 3) | 0)); slLootShore(K.x, K.y, 'gold', 6 + ((slRand() * 5) | 0));
    logEvent('gold', 'Кракен повержен! На берег вынесло жемчуг и золото', K.x, K.y);
    toast('🦑 Кракен повержен! На берег вынесло жемчуг и золото.', null, 'imp');
    faunaSfx('krakenRoar', K.x, K.y, 0.8); fstat('krakenWon');
  }
  if (K.life <= 0) {
    if (!K.loot) { logEvent('raid', 'Кракен ушёл в глубину', K.x, K.y); toast('Кракен ушёл в глубину. Он вернётся…'); }
    S.kr = null;
  }
}
// удар щупальца по берегу: гномы рядом разбегаются (иной покалечен), товары из кучи смывает в воду, герою больно
function slTentSlam(t, hero) {
  const fx = t.x + t.face * 1.2, fy = t.y;
  slSplash(fx, fy, 1); faunaSfx('tentSlam', fx, fy, 1);
  if (typeof shake === 'function') shake(3);
  for (const u of slPeopleNear(fx, fy, 1.8)) {
    if (u.type === 'hero') { hlHurt(u, 7, true); continue; }
    if (!u.injury) scare(u, t);
    if (!u.injury && slRand() < 0.3) { injure(u, slRand() < 0.5 ? 'arm' : 'leg'); u.injuryUntil = Game.time + 45; floater(u.x, u.y - 1.4, 'Ох!', '#ffb0a0'); }
  }
  for (const p of Game.piles.values()) {
    if (p.removed || Math.hypot(p.x + 0.5 - fx, p.y + 0.5 - fy) > 1.8) continue;
    let lost = 0;
    for (const g of GOOD_KEYS) { const free = p.stock[g] - p.reserved[g]; if (free > 0) { const n = Math.min(free, 2); p.stock[g] -= n; lost += n; } if (lost >= 3) break; }
    if (lost) { floater(p.x + 0.5, p.y - 0.5, 'Смыло в море!', '#a8d8ff'); fstat('krakenWashed', lost); }
  }
  if (typeof buildingHit === 'function') for (const b of Game.buildings) {   // постройки у самой воды трещат (чинят, как после нечисти)
    if (b.removed || b.state !== 'done') continue;
    const nx = Math.max(b.x, Math.min(b.x + b.w, fx)), ny = Math.max(b.y, Math.min(b.y + b.h, fy));
    if (Math.hypot(nx - fx, ny - fy) < 1.6) buildingHit({ water: true }, b);
  }
  if (typeof seaWorkSlam === 'function') seaWorkSlam(fx, fy);   // лодки и пристани (seawork.js)
}

// ---------- Отрисовка ----------
function slDraw(c, o) {
  const px = o.x * TILE, py = o.y * TILE;
  switch (o.k) {
    case 'shoal': {
      const f = Math.floor(o.ph * 8);
      for (let j = 0; j < o.n; j++) {
        const a = o.seed + j * 2.39, r = (2 + (j % 3) * 2.5) * (1 + o.scat * 1.5);
        const sx = px + Math.cos(a + o.ph * 0.3) * r, sy = py + Math.sin(a + o.ph * 0.3) * r * 0.55;
        seaBlit(c, 'sprat', 'swim', f + j, sx, sy, o.face, 0.9);
        if (((f + j * 3) % 23) === 0) { c.fillStyle = '#e8f4f8'; c.fillRect(Math.round(sx), Math.round(sy) - 2, 1, 1); }   // серебряный блик
      }
      return;
    }
    case 'salmon': return o.st === 'jump' ? seaBlit(c, 'salmon', 'jump', Math.min(5, Math.floor((0.9 - o.t) / 0.9 * 6)), px, py, o.face) : seaBlit(c, 'salmon', 'swim', Math.floor(o.ph * 10), px, py, o.face);
    case 'crab': {
      const a = o.st === 'walk' ? 'walk' : o.st === 'atk' ? 'atk' : o.st === 'die' ? 'die' : o.st === 'hide' ? 'hide' : 'idle';
      const fps = a === 'walk' ? 14 : a === 'idle' ? 5 : 8;
      const f = a === 'die' || a === 'hide' || a === 'atk' ? Math.min(seaFrames('crab', a) - 1, Math.floor(o.ph * (a === 'atk' ? 12 : 6))) : Math.floor(o.ph * fps);
      c.fillStyle = 'rgba(30,20,10,0.25)'; c.fillRect(Math.round(px) - 5, Math.round(py) + 1, 10, 2);
      return seaBlit(c, 'crab', a, f, px, py + 2, o.face);
    }
    case 'star': case 'urchin': return slIce() > 0.5 ? null : seaBlit(c, o.k, 'idle', Math.floor(o.ph * 1.5), px, py, o.face, 0.92);
    case 'shell': return seaBlit(c, o.pearl && Math.floor(o.ph * 2) % 9 === 0 ? 'pearl' : 'shell', o.pearl && Math.floor(o.ph * 2) % 9 === 0 ? 'idle' : 'idle', o.pearl ? 2 : o.v, px, py, 1);
    case 'jelly': {
      const a = o.st === 'atk' ? 'atk' : o.st === 'die' ? 'die' : 'swim';
      const f = a === 'swim' ? Math.floor(o.ph * 6) : Math.min(seaFrames('jelly', a) - 1, Math.floor(o.ph * 10));
      return seaBlit(c, 'jelly', a, f, px, py + (o.st === 'beach' ? 3 : 0), 1, o.st === 'beach' ? 0.85 : 0.75);
    }
    case 'turtle': {
      const a = o.st === 'swim' ? 'swim' : o.st === 'lay' ? 'idle' : 'walk';
      return seaBlit(c, 'turtle', a, Math.floor(o.ph * (a === 'swim' ? 6 : a === 'walk' ? 7 : 3)), px, py + 2, o.face);
    }
    case 'hatch': return seaBlit(c, 'hatch', 'walk', Math.floor(o.ph * 12), px, py + 1, o.face);
    case 'gull': {
      const ground = o.st === 'stand' || (o.z < 2 && o.st !== 'dive');
      if (o.z > 2) { c.fillStyle = 'rgba(10,20,30,0.18)'; c.beginPath(); c.ellipse(px, py + 2, 4, 1.4, 0, 0, 7); c.fill(); }
      if (o.st === 'die') return seaBlit(c, 'gull', 'die', Math.min(5, Math.floor(o.ph * 6)), px, py - o.z, o.face);
      if (o.st === 'dive') return seaBlit(c, 'gull', 'atk', 2, px, py - o.z, o.face);
      if (ground) return seaBlit(c, 'gull', 'idle', Math.floor(o.ph * 3), px, py + 2, o.face);
      seaBlit(c, 'gull', 'fly', Math.floor(o.ph * 9), px, py - o.z, o.face);
      if (o.bread) { c.fillStyle = '#c8843c'; c.fillRect(Math.round(px + o.face * 5), Math.round(py - o.z - 6), 3, 2); }
      else if (o.fish) { c.fillStyle = '#c8d8e4'; c.fillRect(Math.round(px + o.face * 5), Math.round(py - o.z - 6), 3, 1); }
      return;
    }
    case 'corm': {
      if (o.st === 'under') return;
      if (o.st === 'dive') return seaBlit(c, 'corm', 'dive', Math.min(8, Math.floor(o.ph * 11)), px, py, o.face);
      if (o.st === 'fly' || o.st === 'home') { c.fillStyle = 'rgba(10,20,30,0.18)'; c.fillRect(Math.round(px) - 4, Math.round(py) + 1, 8, 1); return seaBlit(c, 'corm', 'fly', Math.floor(o.ph * 9), px, py - o.z, o.face); }
      return seaBlit(c, 'corm', 'idle', Math.floor(o.ph * 3), px, py - 6, o.face);
    }
    case 'dolphin': return o.st === 'jump' ? seaBlit(c, 'dolphin', 'jump', Math.min(8, Math.floor((1.1 - o.t) / 1.1 * 9)), px, py, o.face) : seaBlit(c, 'dolphin', 'swim', Math.floor(o.ph * 5), px, py, o.face);
    case 'whale': return o.st === 'spout' ? seaBlit(c, 'whale', 'spout', Math.min(5, Math.floor((1.4 - o.t) / 1.4 * 6)), px, py, o.face) : seaBlit(c, 'whale', 'swim', Math.floor(o.ph * 1.6), px, py, o.face);
    case 'octo': {
      const a = o.st === 'die' ? 'die' : o.st === 'atk' ? 'atk' : o.st === 'swim' ? 'swim' : 'idle';
      const f = a === 'die' || a === 'atk' ? Math.min(seaFrames('octo', a) - 1, Math.floor(o.ph * 10)) : Math.floor(o.ph * 6);
      return seaBlit(c, 'octo', a, f, px, py, o.face, 0.85);
    }
    case 'serpent': {
      const a = o.st === 'die' ? 'die' : o.st === 'atk' ? 'atk' : 'swim';
      const f = a === 'swim' ? Math.floor(o.ph * 6) : Math.min(seaFrames('serpent', a) - 1, Math.floor(o.ph * 10));
      return seaBlit(c, 'serpent', a, f, px, py, o.face);
    }
  }
}
function slDrawKraken(list, c, vis) {
  const K = SL().kr;
  if (!K) return;
  if (vis(K.x, K.y)) list.push([K.y - 0.2, () => {
    const up = K.st === 'die' ? Math.max(0, 1 - K.ph / 2) : Math.min(1, K.ph / 2);
    seaBlit(c, 'kraeye', 'idle', Math.floor(K.ph * 2), K.x * TILE, K.y * TILE + (1 - up) * 10, 1, up);
  }]);
  for (const t of K.tents) {
    if (t.st === 'dead' || !vis(t.x, t.y)) continue;
    list.push([t.y + 0.15, () => {
      const a = t.st, n = seaFrames('tent', a === 'rise' ? 'rise' : a);
      const f = a === 'idle' ? Math.floor(t.ph * 5) : Math.min(n - 1, Math.floor(t.ph * (a === 'atk' ? 12 : a === 'die' ? 8 : 10)));
      seaBlit(c, 'tent', a, f, t.x * TILE, t.y * TILE + 4, t.face);
      if (t.st !== 'die' && t.hp < SL_TENT_HP) { const w = 14 * t.hp / SL_TENT_HP; c.fillStyle = '#2a0a18'; c.fillRect(Math.round(t.x * TILE) - 7, Math.round(t.y * TILE) - 44, 14, 2); c.fillStyle = '#e05a8a'; c.fillRect(Math.round(t.x * TILE) - 7, Math.round(t.y * TILE) - 44, Math.round(w), 2); }
    }]);
  }
}
function seaLifeDrawList(list, c, x0, y0, x1, y1) {
  const S = Game.seaLife;
  if (!S || !OCN.on) return;
  const vis = (x, y) => x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 4;
  for (const o of S.list) {
    if (!vis(o.x, o.y)) continue;
    const air = (o.k === 'gull' && o.z > 2) || ((o.k === 'corm') && o.z > 2);
    const under = o.k === 'shoal' || o.k === 'sprat' || (o.k === 'salmon' && o.st !== 'jump') || o.k === 'star' || o.k === 'urchin' || o.k === 'shell';
    list.push([o.y + (air ? 2 : under ? -0.4 : 0.1), () => slDraw(c, o)]);
  }
  for (const n of S.nests) if (vis(n.x, n.y)) list.push([n.y - 0.3, () => { const x = Math.round(n.x * TILE), y = Math.round(n.y * TILE); c.fillStyle = '#b89868'; c.fillRect(x - 4, y, 8, 2); c.fillStyle = '#f4ecd8'; c.fillRect(x - 3, y - 1, 2, 2); c.fillRect(x, y - 1, 2, 2); c.fillRect(x + 2, y, 2, 1); }]);
  slDrawKraken(list, c, vis);
}
// ночью, поверх темноты: медузы светятся (ocean.js → oceanGlow)
function seaLifeGlow(c, x0, y0, x1, y1, k0) {
  const S = Game.seaLife;
  if (!S) return;
  const t = Game.time, ga = c.globalAlpha;
  for (const o of S.list) {
    if (o.k !== 'jelly' || o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 2) continue;
    const s = 0.6 + 0.4 * Math.sin(t * 2 + o.x);
    const x = Math.round(o.x * TILE), y = Math.round(o.y * TILE) - 7;
    c.globalAlpha = k0 * 0.22 * s; c.fillStyle = '#d090ff'; c.fillRect(x - 6, y - 4, 13, 9);
    c.globalAlpha = k0 * 0.5 * s; c.fillStyle = '#f0c8ff'; c.fillRect(x - 3, y - 2, 7, 4);
    c.globalAlpha = k0 * 0.9 * s; c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 1, 2, 1);
  }
  c.globalAlpha = ga;
}

// ---------- Сохранение и кооп ----------
function seaLifeReset() { Game.seaLife = slNew(); }
function serializeSeaLife() {
  const S = Game.seaLife;
  if (!S) return undefined;
  const out = {};
  if (S.nests.length) out.n = S.nests.map(n => [n.x, n.y, Math.round(n.t0)]);
  if (Object.keys(S.tame).length) out.tm = S.tame;
  if (S.krWon) out.kw = S.krWon;
  if (S.krT > 0) out.kt = Math.round(S.krT);
  return Object.keys(out).length ? out : undefined;
}
function applySeaLife(d) {
  const S = Game.seaLife = slNew();
  if (!d) return;
  for (const [x, y, t0] of d.n || []) if (inb(x | 0, y | 0)) S.nests.push({ x, y, t0 });
  if (d.tm && typeof d.tm === 'object') S.tame = d.tm;
  S.krWon = d.kw || 0; S.krT = d.kt || -1e9;
}
function seaLifeMirrorOut() {
  const S = Game.seaLife;
  if (!S) return null;
  const pl = o => { const p = {}; for (const k in o) { const v = o[k]; if (k === 'tgt') continue; p[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v; } return p; };
  return { list: S.list.map(pl), nests: S.nests, kr: S.kr ? { ...pl(S.kr), tents: S.kr.tents.map(pl) } : null };
}
function seaLifeMirrorIn(m) {
  if (!m) return;
  const S = SL();
  S.list = m.list || []; S.nests = m.nests || []; S.kr = m.kr || null;
}
function seaLifeTick(dt) {
  if (!slOn()) { const S = Game.seaLife; if (S) { for (const o of S.list) o.ph = (o.ph || 0) + dt; if (S.kr) { S.kr.ph += dt; for (const t of S.kr.tents) t.ph += dt; } } return; }   // клиент коопа: только анимация между пакетами
  slTick(dt);
  const S = SL();
  S.t.kid = (S.t.kid ?? 30) - dt;
  if (S.t.kid <= 0) { S.t.kid = 20; if (slOn() && OCN.on) slKidsTick(); }
}
