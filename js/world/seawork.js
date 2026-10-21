'use strict';
// Море в хозяйстве (МОРЕ.md):
//  • Рыбацкая хижина (у воды) и рыбак: удит с берега (удочка как у досуга, pets.js), несёт рыбу, иной раз шкуру
//    морского котика или жемчужину; у хижины своя пристань и лодка — второй рыбак уходит на ней на глубину,
//    в шторм лодка у причала, осьминог может стащить улов, кракен — перевернуть лодку;
//  • Торговый корабль: на карте с морем часть караванов приходит морем — корабль встаёт на рейде у пристани,
//    купцы сходят на берег и идут к Торговому посту (trade.js, обёртка trSpawnCaravan);
//  • Шторм: сильный дождь над морем — волны выше (ocean.js), лодки у причала; после шторма — кораблекрушение:
//    обломки с грузом на пляже и дилемма «что делать с выжившими моряками» (dilemma.js).
// Лодки и корабль живут в Game.seaLife (seafauna.js) — уходят клиентам коопа тем же зеркалом. В сейв — только день
// последнего крушения; лодки и пристани выводятся из хижин.

const SW_BOAT_OUT = [40, 80];        // как часто лодка выходит в море, с
const SW_BOAT_FISH = 22;             // сколько удит на глубине
const SW_WRECK_GAP = 3;              // крушение не чаще раза в столько суток
const SW_SHIP_P = 0.4;               // доля караванов, что приходят морем (если есть пристань у моря)

// ---------- Рыбак и хижина ----------
GOODS.fish = GOODS.fish || { name: 'Рыба', color: '#8ab0c4', group: 'Еда' };
GOODS.pearl = GOODS.pearl || { name: 'Жемчуг', color: '#e8e4f0', group: 'Ценности' };
for (const g of ['fish', 'pearl']) if (!GOOD_KEYS.includes(g)) GOOD_KEYS.push(g);
UNIT_TYPES.fisher = { name: 'Рыбак', shirt: '#c8a040' };
if (!UNIT_KEYS.includes('fisher')) UNIT_KEYS.push('fisher');
if (!ALL_UNIT_KEYS.includes('fisher')) ALL_UNIT_KEYS.push('fisher');
if (typeof OUTFIT !== 'undefined') OUTFIT.fisher = { cap: '#2e5470', pants: '#4a3a2a', coat: '#d8b040' };   // синяя шапка, жёлтая непромокаемая куртка
BUILDINGS.fisherhut = {
  name: 'Рыбацкая хижина', cat: 'Еда', w: 2, h: 2, top: 58, cost: { trunk: 3, timber: 2 }, worker: 'fisher', need: 'water',
  outputs: { fish: 8, hide: 2, pearl: 2 },
  desc: 'Ставят у воды. Рыбак удит с берега, а с пристани уходит лодка: рыба — еда для трактира, бывает шкура морского котика и жемчуг. В шторм лодка у причала. С пристанью у моря сюда заходят торговые корабли.',
};
BUILD_ORDER.push('fisherhut');
UNLOCKS.push({ id: 'fish', items: ['fisherhut'], after: ['sawmill'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.fish = 'Рыбалка';
if (typeof SIGN_OF !== 'undefined') SIGN_OF.fisherhut = 'fish';
if (typeof DESCS !== 'undefined') DESCS.fisherhut = [BUILDINGS.fisherhut.desc, BUILDINGS.fisherhut.desc];
if (typeof TR_BASE !== 'undefined') { TR_BASE.fish = TR_BASE.fish || 1.8; TR_BASE.pearl = TR_BASE.pearl || 9; TR_GROUPS.farm.wants.push('fish'); TR_GROUPS.mage.wants.push('pearl'); }
if (typeof TR_GROUPS !== 'undefined') TR_GROUPS.sea = { name: 'Торговый корабль', sells: ['iron', 'croissant', 'darkbeer', 'leather', 'mana', 'sword', 'steak'], wants: ['fish', 'pearl', 'timber', 'bread', 'beer', 'hide'], lvl: 99 };

// вода в пяти клетках от входа
function swWaterNear(x, y, r) {
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_WATER) return true;
  return false;
}
{
  const _cp = checkPlacement;
  checkPlacement = function (type, x, y, rot = 0, quick = false) {
    const r = _cp(type, x, y, rot, quick);
    if (r || type !== 'fisherhut') return r;
    const d = bDims(type, rot);
    return swWaterNear(x + d.dx, y + d.dy, 5) ? null : 'Рыбацкую хижину ставят у воды (до 5 клеток от входа)';
  };
}

function* fisherWork(u, b) {
  if (outFull(b, 'fish')) { yield { wait: 3 }; return; }
  const sh = findShore(b.doorX, b.doorY, 7);
  if (!sh) { yield { wait: 4 }; return; }
  const ok = yield { walk: sh.stand };
  if (!ok) { yield { wait: 2 }; return; }
  const [sx, sy] = sh.stand, [dx, dy] = sh.dir, n = Math.min(sh.water, 3);
  const wx = sx + 0.5 + dx * (n - 0.3), wy = sy + 0.5 + dy * (n - 0.3);
  const total = 8 + slRand() * 5, bite = total * (0.55 + slRand() * 0.3), t0 = Game.time;
  u.face = dx || u.face;
  u.fun = { k: 'rod', t0, until: t0 + total + 1, wx, wy, bite: 0 };
  while (Game.time - t0 < total) {
    if (!u.fun || b.removed) return;
    if (!u.fun.bite && Game.time - t0 > bite) { u.fun.bite = Game.time + 1.4; floater(u.x, u.y - 1.3, '!', '#ffe060'); sfxAt('reel', u.x * TILE, u.y * TILE, 0.6); }
    yield { wait: 0.5 };
  }
  const stolen = u.fun && u.fun.stolen;          // цапля (beasts.js)
  u.fun = null;
  if (stolen) { yield { wait: 1 }; return; }
  const sea = typeof OCN !== 'undefined' && OCN.on && OCN.kind[idx(Math.min(MAP_W - 1, Math.max(0, wx | 0)), Math.min(MAP_H - 1, Math.max(0, wy | 0)))] === OC_SEA;
  const r = slRand();
  const got = r < 0.8 ? 'fish' : sea && r < 0.84 && !outFull(b, 'pearl') ? 'pearl' : sea && r < 0.9 && !outFull(b, 'hide') ? 'hide' : null;
  fxBurst(wx * TILE, wy * TILE, 8, ['#ffffff', '#c8e4f8', '#8ac0e8'], 30, 38, 0.5, 1.4, 150);
  if (!got) { floater(u.x, u.y - 1.3, 'Сорвалась…', '#e8e0c0'); yield { wait: 1.2 }; return; }
  floater(u.x, u.y - 1.3, got === 'fish' ? 'Есть!' : got === 'pearl' ? 'Жемчужина!' : 'Шкура котика!', got === 'fish' ? '#c8f0ff' : '#fff0c8');
  if (got !== 'fish') logEvent('gold', got === 'pearl' ? 'Рыбак выудил раковину с жемчужиной' : 'Рыбак вытащил шкуру морского котика', u.x, u.y);
  u.carry = got;
  if (!(yield* goHome(u, b))) return;
  if (u.carry) { gather(b, u.carry); u.carry = null; }
}
if (typeof WORK !== 'undefined') WORK.fisherhut = fisherWork;

// ---------- Пристань и лодка ----------
// Пристань: от ближнего к входу берега мостки на 2–3 клетки в воду; конец — причал лодки
const SW_PIER = new Map();   // id хижины → { tiles: [[x,y]…], moor: [x,y], dir, key }
function swPier(b) {
  const key = b.x + ':' + b.y + ':' + (typeof OCN !== 'undefined' ? OCN.key : '');
  const c = SW_PIER.get(b.id);
  if (c && c.key === key) return c.p;
  let best = null;
  for (let yy = b.doorY - 5; yy <= b.doorY + 5; yy++) for (let xx = b.doorX - 5; xx <= b.doorX + 5; xx++) {
    if (!inb(xx, yy) || World.terrain[idx(xx, yy)] === T_WATER || World.bmap[idx(xx, yy)]) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const tiles = [];
      for (let k = 1; k <= 3 && inb(xx + dx * k, yy + dy * k) && World.terrain[idx(xx + dx * k, yy + dy * k)] === T_WATER; k++) tiles.push([xx + dx * k, yy + dy * k]);
      if (tiles.length < 2) continue;
      const d = Math.hypot(xx - b.doorX, yy - b.doorY) - tiles.length * 0.4;
      if (!best || d < best.d) best = { d, tiles, root: [xx, yy], dir: [dx, dy] };
    }
  }
  const p = best ? { tiles: best.tiles, root: best.root, dir: best.dir, moor: best.tiles[best.tiles.length - 1] } : null;
  SW_PIER.set(b.id, { key, p });
  return p;
}
const swHuts = () => Game.buildings.filter(b => b.type === 'fisherhut' && b.state === 'done' && !b.removed);
const swSL = () => (typeof SL === 'function' ? SL() : null);
function swWaterLine(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (!inb(x | 0, y | 0) || World.terrain[idx(x | 0, y | 0)] !== T_WATER) return false; }
  return true;
}
function swBoatsTick(dt) {
  const S = swSL(); if (!S) return;
  const B = S.boats || (S.boats = []);
  const huts = swHuts(), storm = typeof oceanStorm === 'function' ? oceanStorm() : 0, ice = typeof SEA === 'function' ? SEA().ice || 0 : 0;
  for (let i = B.length - 1; i >= 0; i--) if (!huts.some(h => h.id === B[i].hid)) B.splice(i, 1);
  for (const h of huts) {
    const p = swPier(h);
    if (!p) continue;
    let bt = B.find(q => q.hid === h.id);
    if (!bt) { bt = { hid: h.id, x: p.moor[0] + 0.5, y: p.moor[1] + 0.5, st: 'moor', t: 10 + slRand() * 20, ph: 0, face: p.dir[0] || 1 }; B.push(bt); }
    bt.ph += dt;
    const mx = p.moor[0] + 0.5, my = p.moor[1] + 0.5;
    if (bt.st === 'sunk') { if ((bt.t -= dt) <= 0) { bt.st = 'moor'; bt.x = mx; bt.y = my; bt.t = 30; logEvent('people', 'Рыбаки починили перевёрнутую лодку', mx, my); } continue; }
    if ((storm > 0.3 || ice > 0.5) && bt.st !== 'moor') bt.st = 'back';   // в шторм и подо льдом — к причалу
    if (bt.st === 'moor') {
      bt.x = mx; bt.y = my;
      if (storm > 0.3 || ice > 0.5 || h.paused) continue;
      if ((bt.t -= dt) <= 0) {
        for (let k = 0; k < 12; k++) {
          const tx = mx + (slRand() - 0.5) * 14, ty = my + (slRand() - 0.5) * 14;
          if (!inb(tx | 0, ty | 0) || World.terrain[idx(tx | 0, ty | 0)] !== T_WATER || (OCN.on && OCN.dep[idx(tx | 0, ty | 0)] < 2) || !swWaterLine(mx, my, tx, ty)) continue;
          bt.st = 'out'; bt.tx = tx; bt.ty = ty; break;
        }
        if (bt.st === 'moor') bt.t = 15;
      }
      continue;
    }
    if (bt.st === 'out' || bt.st === 'back') {
      const tx = bt.st === 'out' ? bt.tx : mx, ty = bt.st === 'out' ? bt.ty : my;
      const dx = tx - bt.x, dy = ty - bt.y, d = Math.hypot(dx, dy), sp = 0.9 * dt;
      if (Math.abs(dx) > 0.05) bt.face = dx > 0 ? 1 : -1;
      if (Math.floor(bt.ph * 1.6) !== Math.floor((bt.ph - dt) * 1.6)) sfxAt('oar', bt.x * TILE, bt.y * TILE, 0.4);
      if (d <= sp) { bt.x = tx; bt.y = ty; if (bt.st === 'out') { bt.st = 'fish'; bt.t = SW_BOAT_FISH; } else { bt.st = 'moor'; bt.t = SW_BOAT_OUT[0] + slRand() * (SW_BOAT_OUT[1] - SW_BOAT_OUT[0]); if (bt.catch) { swLand(h, bt.catch); bt.catch = null; } } }
      else { bt.x += dx / d * sp; bt.y += dy / d * sp; }
      continue;
    }
    if (bt.st === 'fish' && (bt.t -= dt) <= 0) {
      const sea = OCN.on && OCN.kind[idx(bt.x | 0, bt.y | 0)] === OC_SEA;
      const octo = S.list.find(o => o.k === 'octo' && o.st !== 'die' && Math.hypot(o.x - bt.x, o.y - bt.y) < 3.5);
      if (octo) { floater(bt.x, bt.y - 1.4, 'Осьминог утащил улов!', '#f0c0c0'); octo.st = 'atk'; octo.t = 0.75; octo.ph = 0; fstat('octoSteal'); }
      else bt.catch = slRand() < 0.05 && sea ? 'pearl' : 'fish';
      if (bt.catch) floater(bt.x, bt.y - 1.4, bt.catch === 'pearl' ? 'Жемчуг со дна!' : 'Полная лодка!', '#c8f0ff');
      bt.st = 'back';
    }
  }
}
function swLand(h, g) {
  if (h.removed || outFull(h, g)) return;
  gather(h, g); if (g === 'fish' && !outFull(h, 'fish')) gather(h, 'fish');
  fstat('boatCatch');
}
// удар кракена рядом: лодку переворачивает
function seaWorkSlam(x, y) {
  const S = swSL(); if (!S || !S.boats) return;
  for (const bt of S.boats) if (bt.st !== 'sunk' && Math.hypot(bt.x - x, bt.y - y) < 2.2) {
    bt.st = 'sunk'; bt.t = 150; bt.catch = null;
    floater(bt.x, bt.y - 1.4, 'Лодку перевернуло!', '#a8d8ff');
    logEvent('raid', 'Кракен перевернул рыбацкую лодку — рыбаки выплыли, лодку чинят', bt.x, bt.y);
  }
}

// ---------- Торговый корабль ----------
function swShipPier() {
  for (const h of swHuts()) { const p = swPier(h); if (p && OCN.on && OCN.kind[idx(p.moor[0], p.moor[1])] === OC_SEA) return { h, p }; }
  return null;
}
if (typeof trSpawnCaravan === 'function') {
  const _sc = trSpawnCaravan;
  trSpawnCaravan = function (post) {
    const car = _sc(post);
    const hp = car && typeof oceanPrep === 'function' && oceanPrep() ? swShipPier() : null;
    if (!hp || slRand() > SW_SHIP_P || car.amb) return car;
    const root = hp.p.root;
    const path = findPath(root[0], root[1], post.doorX, post.doorY + 1, false, 0, 14000, 0.9) || findPath(root[0], root[1], post.doorX, post.doorY, false, 0, 14000, 0.9);
    if (!path || path.length < 3) return car;
    const W = trMakeWares('sea', car.fair, car.rare);
    Object.assign(car, { kind: 'sea', name: TR_GROUPS.sea.name, route: [root, ...path], pi: 0, x: root[0] + 0.5, y: root[1] + 0.5, sells: W.sells, wants: W.wants, ship: true });
    // корабль встаёт на рейде против пристани: глубже от причала
    const [dx, dy] = hp.p.dir;
    let ax = hp.p.moor[0] + 0.5, ay = hp.p.moor[1] + 0.5;
    for (let k = 0; k < 4 && inb((ax + dx) | 0, (ay + dy) | 0) && World.terrain[idx((ax + dx) | 0, (ay + dy) | 0)] === T_WATER; k++) { ax += dx; ay += dy; }
    const S = swSL();
    const sx = ax + dx * 18 + (slRand() - 0.5) * 6, sy = ay + dy * 18;
    S.ship = { car: car.id, x: sx, y: sy, ax, ay, sx, sy, st: 'in', ph: 0, face: ax > sx ? 1 : -1 };
    trLog('На горизонте парус: торговый корабль идёт к пристани', ax, ay);
    trSay('⛵ Торговый корабль встаёт на рейде у пристани — купцы идут к посту');
    return car;
  };
}
function swShipTick(dt) {
  const S = swSL(); if (!S || !S.ship) return;
  const sh = S.ship, T = Game.trade;
  sh.ph += dt;
  const car = T && T.car && T.car.id === sh.car ? T.car : null;
  if (sh.st !== 'out' && !car) { sh.st = 'out'; }
  const [tx, ty] = sh.st === 'out' ? [sh.sx, sh.sy] : [sh.ax, sh.ay];
  const dx = tx - sh.x, dy = ty - sh.y, d = Math.hypot(dx, dy), sp = (sh.st === 'out' ? 1.4 : 2.2) * dt;
  if (Math.abs(dx) > 0.05) sh.face = dx > 0 ? 1 : -1;
  if (d > sp) { sh.x += dx / d * sp; sh.y += dy / d * sp; }
  else if (sh.st === 'in') sh.st = 'anchor';
  else if (sh.st === 'out') S.ship = null;
}

// ---------- Шторм и кораблекрушение ----------
const swState = () => { const S = swSL(); return S ? (S.w || (S.w = { stormT: 0, wreckDay: -99 })) : null; };
function swSeaTiles() { if (!OCN.on) return 0; if (OCN._seaN == null || OCN._seaKey !== OCN.key) { let n = 0; for (let i = 0; i < OCN.kind.length; i++) if (OCN.kind[i] === OC_SEA) n++; OCN._seaN = n; OCN._seaKey = OCN.key; } return OCN._seaN; }
function swStormTick(dt) {
  const w = swState(); if (!w || swSeaTiles() < 200) return;
  const storm = oceanStorm();
  if (storm > 0.5) { if (w.stormT === 0 && slOnce('stormLog', 900)) logEvent('weather', 'Над морем шторм: волны бьют в берег, лодки у причала'); w.stormT += dt; return; }
  if (w.stormT < 20 || WX.k > 0.3) { if (WX.k <= 0.3) w.stormT = 0; return; }
  w.stormT = 0;
  const day = cycleAt(Game.time).k;
  if (day - w.wreckDay < SW_WRECK_GAP || slRand() > 0.6) return;
  const beach = slPick((x, y) => slBeach(x, y) && isWalkable(x, y), 200);
  if (!beach) return;
  w.wreckDay = day;
  const [bx, by] = beach;
  const loot = [['timber', 3 + ((slRand() * 4) | 0)], ['trunk', 2 + ((slRand() * 3) | 0)], ['iron', slRand() < 0.5 ? 1 + ((slRand() * 2) | 0) : 0], ['gold', 2 + ((slRand() * 4) | 0)]];
  for (const [g, n] of loot) if (n) { const s = slNearPick(bx, by, 3, (x, y) => isWalkable(x, y) && !slWet(x, y), 40) || beach; dropPile(Math.floor(s[0]), Math.floor(s[1]), g, n); }
  S_WRECKS.push({ x: bx, y: by, t0: Game.time });
  logEvent('weather', 'После шторма на пляж выбросило обломки корабля: доски, брёвна, груз', bx, by);
  toast('⚓ После шторма к берегу прибило обломки корабля! Доски и груз — на пляже. Среди обломков — выжившие моряки…', null, 'imp');
  fstat('shipwreck');
  if (typeof dilEnsure === 'function' && typeof DIL_BY_ID !== 'undefined' && DIL_BY_ID.shipwreck && startOpen('dilemma')) {
    const D = dilEnsure(), dd = typeof dilDay === 'function' ? dilDay() : day;
    if (!D.cur && !D.chain.some(c => c.id === 'shipwreck')) { D.chain.push({ id: 'shipwreck', day: dd }); D.next = Math.min(D.next, dd); }
  }
}
const S_WRECKS = [];   // обломки — только картинка, тает за полсуток
if (typeof DIL_EVENTS !== 'undefined' && !DIL_EVENTS.some(e => e.id === 'shipwreck')) {
  const e = { id: 'shipwreck', t: 'Кораблекрушение', ic: 'trade', r: 2, c: { chainOnly: true },
    d: 'Шторм разбил чужой корабль о скалы. На пляже — бочки, доски и двое промокших моряков. Один держит сундучок и смотрит так, будто сундучок держит его.',
    o: [{ t: 'Приютить моряков', cost: { bread: 4 }, fx: { people: 2, mood: 1, rel: { traders: 1 } }, out: 'Моряки остались. Один вяжет узлы, другой травит байки. Храпят оба — по-морскому, с качкой.' },
      { t: 'Забрать сундучок себе', fx: { res: { gold: 7, pearl: 2 }, mood: -1, rel: { traders: -2 } }, risk: { p: 0.3, fx: { mood: -1 }, out: 'Моряки ушли вдоль берега и рассказывают в каждой таверне, какие тут гостеприимные гномы.' }, out: 'В сундучке — золото и жемчуг. Совесть ворчит, кошель доволен.' },
      { t: 'Отправить груз владельцу с купцами', def: 1, fx: { rel: { traders: 2 }, caravan: true }, out: 'Купцы оценили честность: обещали заходить чаще. Моряки уплыли с первым же кораблём.' }] };
  DIL_EVENTS.push(e);
  if (typeof DIL_BY_ID !== 'undefined') DIL_BY_ID.shipwreck = e;
}

// ---------- Отрисовка: пристани, лодки, корабль, обломки ----------
if (typeof SEA_ART !== 'undefined') {
  // лодка с рыбаком: гребёт 8, удит 6
  SEA_ART.boat = { w: 24, h: 18, ax: 12, ay: 14, anims: { row: 8, fish: 6, moor: 6 }, draw(P, a, f, n) {
    const bob = a === 'moor' ? [0, 0, 1, 1, 0, 0][f] : a === 'fish' ? [0, 1, 1, 0, 0, 0][f] : 0;
    const y = 12 + bob;
    // корпус
    P.r(3, y - 1, 18, 1, '#a87040'); P.r(2, y - 2, 20, 1, '#c8905a'); P.r(4, y, 16, 1, '#7a4a24'); P.r(6, y + 1, 12, 1, '#5a3418');
    P.p(2, y - 3, '#c8905a'); P.p(21, y - 3, '#c8905a'); P.r(5, y - 1, 1, 1, '#5a3418'); P.r(12, y - 1, 1, 1, '#5a3418'); P.r(18, y - 1, 1, 1, '#5a3418');
    P.r(4, y + 2, 16, 1, '#d8eef4');                                  // кромка воды
    // рыбак: куртка, шапка, борода
    P.r(10, y - 6, 4, 4, '#d8b040'); P.r(10, y - 9, 4, 3, '#f0c8a0'); P.r(10, y - 10, 4, 1, '#2e5470'); P.r(11, y - 11, 2, 1, '#2e5470');
    P.r(10, y - 7, 4, 1, '#e8e2d4'); P.p(13, y - 9, '#14161a');
    if (a === 'row') {   // вёсла: замах — гребок
      const k = Math.sin(f / n * Math.PI * 2);
      P.l(9, y - 4, 4 - k * 3, y + 1 + Math.round(k), '#7a5230'); P.l(14, y - 4, 19 + k * 3, y + 1 + Math.round(k), '#7a5230');
      if (k < -0.6) { P.p(3, y + 2, '#ffffff'); P.p(20, y + 2, '#ffffff'); }
    } else if (a === 'fish') {   // удочка, леска, поплавок
      P.l(13, y - 5, 22, y - 13 + (f === 2 ? 1 : 0), '#7a5230'); P.l(22, y - 13, 23, y + 1, '#d8d8d8'); P.p(23, y + 1 + (f === 3 ? 1 : 0), '#e04030');
    } else { P.l(9, y - 3, 4, y - 1, '#7a5230'); P.l(14, y - 3, 19, y - 1, '#7a5230'); }
  } };
  // торговый корабль: парус в ветер 8
  SEA_ART.ship = { w: 48, h: 50, ax: 24, ay: 44, anims: { sail: 8 }, draw(P, a, f, n) {
    const k = Math.sin(f / n * Math.PI * 2), bob = Math.round(k * 0.6);
    const y = 42 + bob;
    P.r(6, y - 4, 36, 3, '#8a5a30'); P.r(4, y - 6, 40, 2, '#a87040'); P.r(9, y - 1, 30, 2, '#5a3418'); P.r(12, y + 1, 24, 1, '#3a2010');
    P.r(4, y - 9, 6, 3, '#a87040'); P.r(38, y - 10, 6, 4, '#a87040');      // нос и корма
    for (let x = 8; x < 40; x += 5) P.p(x, y - 5, '#e0b060');                // окошки-люки
    P.r(23, y - 40, 2, 34, '#5a3418');                                        // мачта
    const bell = Math.round(3 + k * 1.5);
    for (let j = 0; j < 22; j++) { const w = 12 + Math.round(Math.sin(j / 22 * Math.PI) * bell); P.r(24 - w + 1, y - 38 + j, w * 2 - 2, 1, j % 6 ? '#f0e8d4' : '#d8ccb0'); }
    P.r(16, y - 31, 16, 3, '#b8402c');                                        // полоса на парусе
    P.r(25, y - 46, 6, 3, '#d04a2a'); P.p(31 + (f % 2), y - 45, '#d04a2a');     // флажок
    P.r(2, y + 2, 44, 1, '#d8eef4'); if (k > 0.5) { P.p(1, y + 1, '#ffffff'); P.p(46, y + 1, '#ffffff'); }
  } };
}
function swDrawPier(c, p) {
  const [dx, dy] = p.dir;
  for (const [x, y] of p.tiles) {
    const px = x * TILE, py = y * TILE;
    if (dx) {   // мостки вдоль X
      c.fillStyle = '#5a3a1e'; c.fillRect(px, py + 10, TILE, 13);
      for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#a8784a' : '#b88a58'; c.fillRect(px + k * 4, py + 10, 3, 12); }
      c.fillStyle = '#3a2410'; c.fillRect(px + 2, py + 22, 2, 5); c.fillRect(px + 26, py + 22, 2, 5);
    } else {
      c.fillStyle = '#5a3a1e'; c.fillRect(px + 9, py, 14, TILE);
      for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#a8784a' : '#b88a58'; c.fillRect(px + 9, py + k * 4, 14, 3); }
      c.fillStyle = '#3a2410'; c.fillRect(px + 8, py + 28, 2, 4); c.fillRect(px + 22, py + 28, 2, 4);
    }
  }
  const [mx, my] = p.moor; c.fillStyle = '#3a2410'; c.fillRect(mx * TILE + 15, my * TILE + 6, 3, 8); c.fillStyle = '#6a4a2a'; c.fillRect(mx * TILE + 14, my * TILE + 5, 5, 2);   // кнехт
}
function seaWorkDrawList(list, c, x0, y0, x1, y1) {
  const S = Game.seaLife;
  const vis = (x, y) => x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 4;
  for (const h of swHuts()) { const p = swPier(h); if (p && vis(p.moor[0], p.moor[1])) list.push([p.tiles[0][1] - 0.45, () => swDrawPier(c, p)]); }
  if (!S) return;
  for (const bt of S.boats || []) {
    if (!vis(bt.x, bt.y)) continue;
    list.push([bt.y + 0.05, () => {
      if (bt.st === 'sunk') { seaBlit(c, 'boat', 'moor', 0, bt.x * TILE, bt.y * TILE + 6, bt.face, 0.5); return; }
      const a = bt.st === 'fish' ? 'fish' : bt.st === 'moor' ? 'moor' : 'row';
      seaBlit(c, 'boat', a, Math.floor(bt.ph * (a === 'row' ? 8 : 3)), bt.x * TILE, bt.y * TILE + 4, bt.face);
    }]);
  }
  const sh = S.ship;
  if (sh && vis(sh.x, sh.y)) list.push([sh.y + 0.1, () => seaBlit(c, 'ship', 'sail', Math.floor(sh.ph * 4), sh.x * TILE, sh.y * TILE, sh.face)]);
  for (let i = S_WRECKS.length - 1; i >= 0; i--) {
    const w = S_WRECKS[i];
    if (Game.time - w.t0 > CYCLE / 2) { S_WRECKS.splice(i, 1); continue; }
    if (!vis(w.x, w.y)) continue;
    list.push([w.y - 0.2, () => {   // мачта с обрывком паруса и доски
      const x = Math.round(w.x * TILE), y = Math.round(w.y * TILE);
      c.fillStyle = '#5a3418'; c.fillRect(x - 10, y + 2, 20, 3); c.fillRect(x + 6, y - 2, 12, 2);
      c.fillStyle = '#7a4a24'; c.fillRect(x - 14, y - 1, 2, 10); c.save(); c.translate(x - 13, y - 1); c.rotate(-0.5); c.fillRect(0, -18, 2, 18); c.fillStyle = '#e0d8c0'; c.fillRect(2, -16, 8, 9); c.restore();
      c.fillStyle = '#8a5a30'; c.fillRect(x + 12, y + 4, 5, 4); c.fillStyle = '#5a3418'; c.fillRect(x + 12, y + 5, 5, 1);
    }]);
  }
}

// ---------- Ход, сейв, подключение ----------
function seaWorkTick(dt) {
  if (typeof FAUNA_ON === 'function' && !FAUNA_ON()) { const S = Game.seaLife; if (S) { for (const b of S.boats || []) b.ph = (b.ph || 0) + dt; if (S.ship) S.ship.ph += dt; } return; }
  if (typeof oceanPrep !== 'function' || !oceanPrep()) return;
  swBoatsTick(dt);
  swShipTick(dt);
  swStormTick(dt);
}
{
  const _st = step;
  step = function (dt) { _st(dt); seaWorkTick(dt); };
  const _ser = serializeSeaLife;
  serializeSeaLife = function () { const o = _ser() || {}; const w = Game.seaLife && Game.seaLife.w; if (w && w.wreckDay > -99) o.wd = w.wreckDay; return Object.keys(o).length ? o : undefined; };
  const _app = applySeaLife;
  applySeaLife = function (d) { _app(d); if (d && d.wd != null) Game.seaLife.w = { stormT: 0, wreckDay: d.wd }; SW_PIER.clear(); S_WRECKS.length = 0; };
  const _mo = seaLifeMirrorOut;
  seaLifeMirrorOut = function () { const m = _mo(); if (m && Game.seaLife) { m.boats = Game.seaLife.boats || []; m.ship = Game.seaLife.ship || null; } return m; };
  const _mi = seaLifeMirrorIn;
  seaLifeMirrorIn = function (m) { _mi(m); if (m) { const S = SL(); S.boats = m.boats || []; S.ship = m.ship || null; } };
  const _dl = seaLifeDrawList;
  seaLifeDrawList = function (list, c, x0, y0, x1, y1) { _dl(list, c, x0, y0, x1, y1); if (OCN.on) seaWorkDrawList(list, c, x0, y0, x1, y1); };
}

// ---------- Модель хижины и вывеска ----------
if (typeof MODELS !== 'undefined') {
  MODELS.fisherhut = function (m) {
    m.box({
      x0: 8, x1: 52, y0: 12, y1: 48, h: 20, wall: 'plank', col: '#7a6a5a', beam: '#3a2a1a',
      roof: { type: 'gable', axis: 'X', rise: 16, mat: 'shingle', col: '#5a6a72', ov: 4 },
      decor: { S: [{ t: 'door', main: true, w: 10, h: 15 }, { t: 'win', at: 40, z: 9, w: 6, h: 6, o: { lit: true } }], E: [{ t: 'win', at: 28, z: 9, w: 5, h: 6 }], W: [] },
      chimneys: [{ x: 16, y: 30, h: 10, kind: 'stone', w: 4 }],
    });
    // сеть на кольях сушится
    m.prop((c, x, y) => {
      c.fillStyle = '#5a3a1e'; c.fillRect(x, y - 16, 1.4, 16); c.fillRect(x + 16, y - 16, 1.4, 16);
      c.strokeStyle = 'rgba(200,190,160,0.85)'; c.lineWidth = 0.5;
      for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(x + 1, y - 15 + k * 3); c.quadraticCurveTo(x + 8.5, y - 12 + k * 3, x + 16, y - 15 + k * 3); c.stroke(); }
      for (let k = 0; k <= 5; k++) { c.beginPath(); c.moveTo(x + 1 + k * 3, y - 15); c.lineTo(x + 1 + k * 3, y - 3); c.stroke(); }
      c.fillStyle = '#e0b040'; c.fillRect(x + 4, y - 9, 1.6, 1.6); c.fillRect(x + 11, y - 6, 1.6, 1.6);   // поплавки
    }, 56, 30);
    // перевёрнутая лодка у стены и бочонок
    m.prop((c, x, y) => {
      shadowAt(c, x + 8, y + 0.5, 10);
      c.fillStyle = '#7a4a24'; c.beginPath(); c.ellipse(x + 8, y - 3, 10, 4, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#a87040'; c.fillRect(x - 1, y - 3, 18, 1.4); c.fillStyle = '#5a3418'; c.fillRect(x + 3, y - 6, 1, 3); c.fillRect(x + 12, y - 6, 1, 3);
    }, 2, 4);
    m.prop((c, x, y) => barrel(c, x, y, 0.75), 58, 8);
    m.prop((c, x, y) => {   // связка рыбы на крюке
      c.fillStyle = '#5a3a1e'; c.fillRect(x, y - 14, 1, 6);
      for (let k = 0; k < 3; k++) { c.fillStyle = '#8ab0c4'; c.fillRect(x - 1 + k * 1.6, y - 8, 1.3, 5); c.fillStyle = '#4a5e74'; c.fillRect(x - 1 + k * 1.6, y - 3.4, 1.3, 1); }
    }, 46, 50);
  };
}
if (typeof signIcon === 'function') {
  const _si = signIcon;
  signIcon = function (c, cx, cy, kind) {
    if (kind !== 'fish') { _si(c, cx, cy, kind); return; }
    ellipse(c, cx - 0.4, cy, 3, 1.4, '#8ab0c4'); ellipse(c, cx - 1, cy - 0.4, 1.6, 0.6, '#d8e8f0');
    c.fillStyle = '#4a5e74'; c.fillRect(cx + 2.4, cy - 1.4, 1, 2.8); c.fillStyle = '#14161a'; c.fillRect(cx - 2.4, cy - 0.5, 0.7, 0.7);
  };
}
