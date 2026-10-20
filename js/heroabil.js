'use strict';
// Способности классов, ресурсы и лечение героя (0.10.69). Подключается после durability.js — почти последним.
// Решение: общих скиллов больше нет (зелье лечения [E], банки маны [G] и огненный шар [F] для всех убраны).
// · Данные способностей — HERO_ABIL в herokit.js (до 5 на класс, открываются по уровням до 15, часть пассивные).
//   Здесь — особые действия ABIL_FX: оглушение, ловушки, дух-волк, освящение, воровство, рост полей…
// · Ресурс класса: мана, ярость (копится в бою), энергия (быстро копится сама), вера (медленно, у костра быстрее).
// · Лечение стало дольше и разнообразнее: само по себе медленно (hlRegen в herolife.js), у костра и в трактире быстрее,
//   привал (кнопка «Привал»: 15 с сидит у костерка), лазарет с лекарем, еда и пиво (малые бонусы), перевязки
//   (редкий расходник из кожи, варит лекарь в лазарете), классовое лечение только у жреца, друида и паладина.
//   Падение героя: очнётся у костра со «Слабостью» на 45 с (бьёт слабее), ярость сгорает — чувствительно, но без потерь.
// · Панель быстрых способностей (#ab-bar): крупные кнопки под большой палец в углу экрана, ровно по числу
//   способностей класса; касание — применить (цель выбирается сама: враг, которого бьёт герой, иначе ближайший;
//   лечение — себе, команде и выбранному гному), удержание — подсказка; перезарядка и ресурс видны на кнопках.
//   Ниже — малые кнопки: атака, еда/перевязка, привал, домой. На компьютере — клавиши 1–5 и Q.
// · Старые герои: банки маны превращаются в золото на складе (по 2 за банку), перезарядки сброшены.
// В общей деревне всё считает сервер (heroAbilityFor, abTick); игрок шлёт {t:'abil', i} и {t:'camp'}, видит u.rs/u.rsm.

const ABX = { hooked: false, stun: new Set(), uiT: 0, tip: null, migr: false };
const AB_CAMP_T = 15, AB_CAMP_CD = 40, AB_WEAK_T = 45;

// ---------- Перевязки: редкий расходник из кожи (варит лекарь в лазарете) ----------
GOODS.bandage = { name: 'Перевязки', color: '#e8e2d0', group: 'Ремесло' };
if (!GOOD_KEYS.includes('bandage')) GOOD_KEYS.push('bandage');
if (typeof BUILDINGS !== 'undefined' && BUILDINGS.infirmary && !BUILDINGS.infirmary.recipes.some(r => r.out.bandage)) {
  const B = BUILDINGS.infirmary;
  B.inputs.leather = 4; B.outputs.bandage = 6;
  B.recipes.push({ in: { leather: 1 }, out: { bandage: 2 }, time: 18 });
  B.desc += ' Из кожи режет перевязки — редкий расходник для героя: снимает рану и возвращает пятую часть здоровья.';
}
if (typeof TR_BASE !== 'undefined') TR_BASE.bandage = 5;
if (typeof drawGoodIcon === 'function') {
  const _dgi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    if (g !== 'bandage') return _dgi(c, g, x, y);
    const G = ABIL_ICON.u_band, pal = {};
    for (const p of G[0].split(' ')) { const [ch, col] = p.split(':'); pal[ch] = col; }
    for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 12; xx++) { const ch = G[1 + yy][xx]; if (ch !== '.') { c.fillStyle = pal[ch]; c.fillRect(x + 1 + xx, y + 1 + yy, 1, 1); } }
  };
}

// ---------- Значки 12×12 (в карточке и на панели — 16×16 с контуром, abilIcon16) ----------
Object.assign(ABIL_ICON, {
  bash: ['S:#8a909c W:#e8ecf0 B:#5a3a1a Y:#ffe070', 'Y.........Y.', '..BBBBBBB...', '.BWWWWWWWB.Y', '.BWSSSSSWB..', '.BWSWWWSWB.Y', '.BWSWYWSWB..', '.BWSWWWSWB.Y', '.BWSSSSSWB..', '..BWWWWWB...', '...BWWWB..Y.', '....BWB.....', '.....B......'],
  stand: ['G:#6a6e78 g:#a0a4ac k:#2a2420', '............', '.gggggggggg.', 'GGGGGGGGGGGG', '.GGGGGGGGGg.', '...GGGGGG...', '....GGGG....', '....GGGG....', '...GGGGGG...', '..GGGGGGGG..', '..kkkkkkkk..', '............', '............'],
  wall: ['B:#2c4a9a L:#7aa0ff W:#e8f0ff', '............', 'BBBBB..BBBBB', 'BLLLB..BLLLB', 'BLWLB..BLWLB', 'BLLLBBBBLLLB', 'BLLLBLLBLLLB', '.BLLBLWBLLB.', '.BLBBLLBBLB.', '..B.BLLB.B..', '....BLLB....', '.....BB.....', '............'],
  stomp: ['b:#6a4a28 B:#8a5a30 Y:#c8964a k:#2a2018', '...bbbb.....', '...bBBb.....', '...bBBb.....', '...bBBb.....', '...bBBbbbb..', '..bBBBBBBBb.', '..bbbbbbbbb.', '............', 'Y.k.Y..k..Y.', '.kk..kkk.k..', 'k..kk...kk.k', '............'],
  hide: ['p:#b08a5a d:#7a5a30', '.d........d.', 'ddd......ddd', '.dppppppppd.', '..pppppppp..', '..pppddppp..', '.ppppddpppp.', '.pppppppppp.', '..pppppppp..', '..pppppppp..', '.dpp....ppd.', 'ddd......ddd', '.d........d.'],
  trap: ['S:#8a909c W:#d8dce0 b:#5a3a1a', '............', '.S.S.S.S.S..', '.SWSWSWSWS..', '.SSSSSSSSSS.', 'S..........S', 'S....bb....S', 'S...bbbb...S', 'S..........S', '.SSSSSSSSSS.', '.SWSWSWSWS..', '.S.S.S.S.S..', '............'],
  eagle: ['Y:#f0d080 k:#2a2018 W:#fff6e0 b:#8a5a2a', '............', '............', '...bbbbbb...', '.bbWWWWWWbb.', 'bWWWYYYYWWWb', 'bWWYYkkYYWWb', 'bWWYYkkYYWWb', 'bWWWYYYYWWWb', '.bbWWWWWWbb.', '...bbbbbb...', '............', '............'],
  trip: ['b:#3a2416 B:#6a4a30 W:#c8b0e0', '............', '.......bb...', '......bbb...', '.....bbb....', '....bbb.....', '...bbbbbbb..', '...BBBBBBBB.', '............', 'W..W..W..W..', '.WW.WW.WW.W.', '............', '............'],
  steal: ['Y:#f6d458 o:#c89226 b:#8a5a2a', '....bbbb....', '.....bb.....', '....bbbb....', '...bbbbbb...', '..bbbYYbbb..', '.bbbYoYYbbb.', '.bbbbYYbbbb.', '.bbbbbbbbbb.', '..bbbbbbbb..', '...bbbbbb...', 'Y.........Y.', '.Y.Y...Y.Y..'],
  vanish: ['P:#8a8aa8 p:#5a5a78 W:#cfd0e8', '....WWW.....', '...WPPPW....', '...PPPPP....', '....PPP.....', '...PPPPP..p.', '..PPPPPPP...', '.p.PPPPP.p..', '...p.P.p....', '..p..p..p...', '.p..p..p..p.', 'p.........p.', '............'],
  nimble: ['W:#cfe8ff B:#7aa0c8', '..........WW', '.........WWW', '........WWBW', '.......WWBW.', '......WWBWW.', '.....WWBWW..', '....WWBWW...', '...WWBWW....', '...WBWW.....', '..BBW.......', '.B..........', 'B...........'],
  frost: ['C:#9ee0ff W:#ffffff B:#3a78c8', '............', '.....W......', '..W..C..W...', '...C.C.C....', '....CBC.....', '.WCCBWBCCW..', '....CBC.....', '...C.C.C....', '..W..C..W...', '.....W......', '............', '............'],
  spring: ['B:#3a68c8 L:#6aa6ff W:#e8f0ff', '.....L......', '....LLL.....', '....LLL.....', '...LLLLL....', '..LLLWLLL...', '..LLWLLLL...', '.LLLWLLLLL..', '.LLLLLLLLL..', '.BLLLLLLLB..', '..BBLLLBB...', '....BBB.....', '............'],
  thorns: ['G:#3a8a30 g:#8ae070 b:#6a4a28', '............', '..g.....g...', '..G.....G...', '.gG..g..Gg..', '..G.gG..G...', '.GG..G.GG...', '..GG.GG.G...', '...GGG.GG...', '....GGGG....', 'bbbbbGGbbbbb', '.bbbbbbbbbb.', '............'],
  grow: ['G:#5ab04a g:#a0e060 b:#6a4a28', '............', '.gg.....gg..', 'gGGg...gGGg.', 'gGGGg.gGGGg.', '.gGGGgGGGg..', '..ggGGGgg...', '.....G......', '.....G......', '.....G......', '..bbbbbbb...', '.bbbbbbbbb..', '............'],
  beast: ['G:#8a96a4 g:#c8d0d8 k:#1a1a22 W:#e8f0ff', '.G........G.', '.GG......GG.', '.GgG....GgG.', '.GggGGGGggG.', 'GGGGGGGGGGGG', 'GGkWGGGGWkGG', '.GGGGggGGGG.', '..GGggggGG..', '...GgkkgG...', '....gWWg....', '.....gg.....', '............'],
  cure: ['C:#3ab890 W:#f0fff8 Y:#fff6c0', 'Y.........Y.', '....CCCC....', '....CWWC....', '.CCCCWWCCCC.', '.CWWWWWWWWC.', '.CWWWWWWWWC.', '.CCCCWWCCCC.', '....CWWC....', '....CCCC....', 'Y.........Y.', '............', '............'],
  mercy: ['R:#e86a8a W:#fff6c0 Y:#ffe070', '...YYYYYY...', '..Y......Y..', '...YYYYYY...', '............', '.RRR...RRR..', 'RRRRR.RRRRR.', 'RRWRRRRRRRR.', 'RRRRRRRRRRR.', '.RRRRRRRRR..', '..RRRRRRR...', '...RRRRR....', '.....R......'],
  consecrate: ['Y:#ffe070 W:#fff6c0 O:#e0a030', '.....W......', '..Y..W..Y...', '...Y.W.Y....', '.....W......', '.WWW.Y.WWW..', '............', '...OOOOO....', '.OOYYYYYOO..', 'OYYWWWWWYYO.', '.OOYYYYYOO..', '...OOOOO....', '............'],
  faith: ['Y:#f0d880 W:#fff6e0 O:#b88a30', '.OOOOOOOOOO.', 'OYYYYWYYYYYO', 'OYYYYWYYYYYO', 'OYWWWWWWWWYO', 'OYYYYWYYYYYO', 'OYYYYWYYYYYO', '.OYYYWYYYYO.', '.OYYYWYYYYO.', '..OYYYYYYO..', '...OYYYYO...', '....OYYO....', '.....OO.....'],
  aura: ['Y:#ffd070 W:#fff6c0 F:#e4b08a', 'Y....Y....Y.', '.Y...Y...Y..', '..YWWWWWY...', '..WW.FF.WW..', 'YYW.FFFF.WYY', '..W..FF..W..', '..WW.FF.WW..', '..YWWWWWY...', '.Y...Y...Y..', 'Y....Y....Y.', '............', '............'],
  chord: ['k:#3a2416 P:#d8a0ff W:#f4e8ff', '......kkkk..', '......kkkk..', '......k..k..', '......k..k..', '......k..k..', '..P...k..k..', '.P..kkk.kkk.', 'P..kkkkkkkk.', 'P..kkkk.kkk.', '.P..kk..kk..', '..P.........', '............'],
  voice: ['o:#c88a4a b:#8a5a2a P:#f0a0d0', '........P...', '.......o..P.', '......oo....', '..bbooooo.P.', '.bboooooo...', '.bboooooo.PP', '.bboooooo...', '..bbooooo.P.', '......oo....', '.......o..P.', '........P...', '............'],
  palm: ['F:#e4b08a f:#b8845a Y:#ffe0c0', '..F.F.F.....', '..F.F.F.F...', '..F.F.F.F...', '..FFFFFFF...', 'F.FFFFFFF.Y.', 'FFFFFFFFF..Y', '.FFFFFFFF.Y.', '..FFFFFFF..Y', '..fFFFFFf...', '...fFFFf..Y.', '...ffff.....', '............'],
  calm: ['C:#c0e0ff B:#6a90c8', '....CCCC....', '..CC....CC..', '.C........C.', '.C...BB...C.', 'C...BCCB...C', 'C...BCCB...C', 'C....BB....C', '.C........B.', '.C.......B..', '..CC...BB...', '....CCB.....', '............'],
  // малые кнопки панели: атака, еда, перевязка, привал, домой
  u_eat: ['b:#c88a4a B:#8a5a2a W:#f0e0c0', '............', '............', '...BBBBBB...', '..BbbbbbbB..', '.BbbWbbWbbB.', '.BbbbbbbbbB.', '.BbWbbbbWbB.', '.BbbbbbbbbB.', '.BBBBBBBBBB.', '............', '............', '............'],
  u_band: ['W:#f0ece0 R:#d0405a g:#b8b0a0', '............', '......WWW...', '.....WWgWW..', '....WWgWWW..', '...WWgWRWW..', '..WWgWRRRW..', '..WgWWWRWW..', '..WWWWWWW...', '...WWWWW....', '............', '............', '............'],
  u_camp: ['b:#6a4a28 F:#c8302a O:#ff8a30 Y:#ffe070', '.....F......', '....FF......', '....FOF.F...', '...FOOFFF...', '...FOYOOF...', '..FOYYYOF...', '..FOYYYOF...', '...FOOOF....', '.bb.....bb..', '..bbb.bbb...', '....bbb.....', '..bbb.bbb...'],
});

// ---------- Цели ----------

const abAlive = f => f && (f.kind === 'neu' ? typeof neuAlive === 'function' && neuAlive(f.o) : foeAlive(f));
// враги рядом: нечисть, звери и лесные нейтралы, которые уже дерутся; первым — тот, кого герой бьёт сейчас
function abFoes(h, r) {
  const x = h.x, y = h.y, out = foesNear(x, y, r);
  // лесные жители — если уже дерутся; гоблины и тролли (neutrals2.js) — всегда враги
  const n2bad = N => typeof N2_TROLLS !== 'undefined' && (N.k === 'goblin' || N2_TROLLS[N.k]);
  if (typeof neuAlive === 'function') for (const N of Game.neutrals || []) if (neuAlive(N) && (N.tg || n2bad(N)) && Math.hypot(N.x - x, N.y - y) < r) out.push({ kind: 'neu', o: N });
  out.sort((p, q) => Math.hypot(p.o.x - x, p.o.y - y) - Math.hypot(q.o.x - x, q.o.y - y));
  const cur = h.cmd && h.cmd.kind === 'attack' && h.cmd.f;
  if (cur && abAlive(cur) && Math.hypot(cur.o.x - x, cur.o.y - y) < r) { const i = out.findIndex(f => f.o === cur.o); if (i > 0) out.unshift(out.splice(i, 1)[0]); }
  return out;
}
// удар способностью: mul ≥ 2 — скелета и дерево сразу, нейтралу — урон × mul
function abHit(f, h, mul) {
  if (!abAlive(f)) return;
  if (f.kind === 'neu') { neuHit(f.o, h, neuDamageOf(h) * (mul || 1)); return; }
  if ((mul || 1) >= 2) abForceKill(f, h); else killFoe(f, h);
}
const abStunned = o => !!(o && (o.abStun > Game.time || (o.fx && o.fx.stun > Game.time)));
function abStun(f, d, h, text, col) {
  if (!abAlive(f)) return;
  const o = f.o;
  if (f.kind === 'neu' && typeof cbFxSet === 'function') { cbFxSet(o, 'stun', d, h, text, col); return; }
  o.abStun = Math.max(o.abStun || 0, Game.time + d); ABX.stun.add(o);
  if (text) floater(o.x, o.y - 2.2, text, col || '#ffe070');
}
function abNoFoe(h) { floater(h.x, h.y - 1.6, 'Врагов рядом нет', '#e8e0c0'); return false; }
function abFace(h, o) { h.face = o.x > h.x ? 1 : -1; h.vdir = 'E'; }
function abCast(h) { if (!h.inside) { h.hfx = { k: 'cast', t: Game.time + 0.55, d: 0.55 }; h.vdir = 'E'; } }
function abBurstAt(o, cols, n) { fxBurst(o.x * TILE, o.y * TILE - 10, n || 14, cols, 70, 50, 0.6, 1.8, 120); }
const abList = () => Game.abz || (Game.abz = []);

// склад деревни: золото (в общей деревне — общий склад)
function abStore(g, n) {
  if (typeof oathStore === 'function') return oathStore(g, n);
  const b = Game.buildings.find(x => x.type === 'storehouse' && x.state === 'done' && !x.removed);
  if (!b) return false;
  b.stock[g] = (b.stock[g] || 0) + n;
  return true;
}

// ---------- Особые действия способностей ----------
const ABIL_FX = {
  bash(h) {
    const f = abFoes(h, 2.6)[0];
    if (!f) return abNoFoe(h);
    abFace(h, f.o); h.hfx = { k: 'strike', t: Game.time + 0.4 };
    abHit(f, h, 1); abStun(f, 3, h, 'Оглушён!');
    abBurstAt(f.o, ['#ffffff', '#cfe0ff', '#8aa0c8']);
  },
  cry(h) {
    let n = 0;
    for (const u of Game.units) if (u !== h && !u.dead && !u.isCourier && !u.inside && Math.hypot(u.x - h.x, u.y - h.y) < 9) { u.boostUntil = Game.time + 20; n++; }
    floater(h.x, h.y - 2.6, n ? `За мной! (${n})` : 'За мной!', '#ffb050');
    fxBurst(h.x * TILE, h.y * TILE - 16, 18, ['#ffe070', '#ff9a30'], 110, 40, 0.7, 1.8, -30);
  },
  wall(h) {
    for (const f of abFoes(h, 3)) abStun(f, 1.5, h, 'С ног!');
    fxBurst(h.x * TILE, h.y * TILE - 8, 20, ['#cfe0ff', '#8ac8ff'], 90, 20, 0.6, 1.8, 0);
  },
  stomp(h) {
    const fs = abFoes(h, 3);
    if (!fs.length) return abNoFoe(h);
    for (const f of fs) { abHit(f, h, 1); abStun(f, 2.5, h, 'Упал!'); }
    fxBurst(h.x * TILE, h.y * TILE + 4, 30, ['#8a6a3a', '#c8a070', '#5a4020'], 130, 30, 0.7, 2.2, 260);
    h.hfx = { k: 'strike', t: Game.time + 0.4 };
  },
  trap(h) {
    const L = abList(), mine = L.filter(z => z.k === 'trap' && z.own === h.id);
    if (mine.length >= 2) L.splice(L.indexOf(mine[0]), 1);
    L.push({ k: 'trap', own: h.id, x: h.x + (h.face || 1) * 0.6, y: h.y + 0.2, until: Game.time + 120 });
    floater(h.x, h.y - 1.6, 'Капкан поставлен', '#c8a070');
    h.hfx = { k: 'fparry', t: Game.time + 0.5 };
  },
  trip(h) {
    const f = abFoes(h, 2.2)[0];
    if (!f) return abNoFoe(h);
    abFace(h, f.o); h.hfx = { k: 'strike', t: Game.time + 0.35 };
    abStun(f, 3.5, h, 'Подножка!', '#c8b0e0');
    abBurstAt(f.o, ['#c8b0e0', '#8a6a4a'], 8);
  },
  steal(h, a, H) {
    const f = abFoes(h, 3).find(x => !x.o.robbed);
    if (!f) { floater(h.x, h.y - 1.6, abFoes(h, 3).length ? 'Уже обчищен' : 'Красть не у кого', '#e8e0c0'); return false; }
    f.o.robbed = true; abFace(h, f.o);
    const n = 1 + ((Math.random() * 3) | 0);
    if (Math.random() < 0.7 && abStore('gold', n)) floater(f.o.x, f.o.y - 2, `+${n} золота`, '#ffd060');
    else {
      const add = !H.owner && typeof hlAddItem === 'function' ? hlAddItem : typeof coopAddItem === 'function' ? coopAddItem : null;
      if (add && add(H, 'sausage', 1)) floater(f.o.x, f.o.y - 2, 'Колбаса!', '#ffd060');
      else { abStore('gold', 1); floater(f.o.x, f.o.y - 2, '+1 золото', '#ffd060'); }
    }
    abBurstAt(f.o, ['#ffd060', '#fff0a0'], 10);
  },
  vanish(h) {
    for (const N of Game.neutrals || []) if (N.tg === h.id) N.tg = 0;
    for (const s of Game.skels || []) if (Math.hypot(s.x - h.x, s.y - h.y) < 8 && s.state === 'roam') { s.scared = 6; s.goal = null; }
    fxBurst(h.x * TILE, h.y * TILE - 10, 22, ['#3a3448', '#5a5068', '#8a8aa8'], 50, 30, 1, 2.2, -20);
  },
  fire(h, a, H) {
    const f = abFoes(h, 9)[0];
    if (!f) return abNoFoe(h);
    abFace(h, f.o); abCast(h);
    hmBolt(h.x, h.y, f.o.x, f.o.y, ['#fff0a0', '#ff9a30', '#e04a18'], () => {
      const o = f.o;
      if (!abAlive(f)) return;
      fxBurst(o.x * TILE, o.y * TILE - 10, 22, ['#fff0a0', '#ff9a30', '#e04a18'], 90, 60, 0.7, 2.2, 160);
      if (f.kind === 'skel') { abForceKill(f, h); logEvent('tree', `${H.name} испепелил скелета огненным шаром`, o.x, o.y); }
      else if (f.kind === 'ent' && (o.rock || o.water)) { o.target = null; o.goal = null; o.state = 'ghosted'; o.t = 0; o.gFrom = [h.x, h.y]; floater(o.x, o.y - 1.8, 'Отступает!', '#ffd0a0'); }
      else if (f.kind === 'ent') { o.burnT = Game.time; floater(o.x, o.y - 3, 'Горит!', '#ffb060'); }
      else if (f.kind === 'neu' && typeof n2Fireball === 'function') n2Fireball(o, h, o.x, o.y);      // по лесным жителям — по площади (neutrals2.js)
      else { abHit(f, h, 2.5); if (f.kind === 'neu' && typeof cbFxSet === 'function' && abAlive(f)) cbFxSet(o, 'burn', 3, h, 'Горит!', '#ff9a40'); }
    });
  },
  ward(h, a, H) {
    let n = 0;
    for (const g of Game.ghosts || []) if (Math.hypot(g.x - h.x, g.y - h.y) < 12) { g.mode = 'leave'; g.modeT = 99; floater(g.x, g.y - 1.6, 'А-а-ай!', '#cfe6ff'); n++; }
    for (const s of Game.skels || []) if (Math.hypot(s.x - h.x, s.y - h.y) < 7 && s.state === 'roam') { s.scared = 8; s.goal = null; n++; }
    for (const e of Game.ents || []) if ((e.state === 'walk' || e.state === 'smash') && Math.hypot(e.x - h.x, e.y - h.y) < 7) {
      e.target = null; e.goal = null; e.state = 'ghosted'; e.t = 0; e.gFrom = [h.x, h.y]; n++;
    }
    // гоблины (neutrals2.js) боятся оберега: обожжены светом и разбегаются
    if (typeof n2SpellHit === 'function') for (const M of (Game.neutrals || []).slice()) {
      if (M.k !== 'goblin' || !neuAlive(M) || Math.hypot(M.x - h.x, M.y - h.y) > 7) continue;
      n2SpellHit(M, h, 8 + (H.level || 1), 'holy');
      if (neuAlive(M)) { M.tg = 0; M.st = 'home'; M.prov = Game.time - NEU_FORGET + 6; floater(M.x, M.y - 2.2, 'Ай, свет!', '#fff2a0'); }
      n++;
    }
    H.wardUntil = Game.time + 20;
    abCast(h);
    fxBurst(h.x * TILE, h.y * TILE - 12, 30, ['#fff6c0', '#ffe070', '#ffffff'], 110, 20, 0.9, 2, 0);
    if (!n) floater(h.x, h.y - 2.6, 'никого рядом', '#fff0a0');
  },
  frost(h) {
    const f = abFoes(h, 9)[0];
    if (!f) return abNoFoe(h);
    abFace(h, f.o); abCast(h);
    hmBolt(h.x, h.y, f.o.x, f.o.y, ['#ffffff', '#9ee0ff', '#3a78c8'], () => {
      if (!abAlive(f)) return;
      fxBurst(f.o.x * TILE, f.o.y * TILE - 10, 18, ['#ffffff', '#9ee0ff', '#3a78c8'], 70, 40, 0.8, 2, 60);
      abHit(f, h, 1); abStun(f, 4, h, 'Замёрз!', '#9ee0ff');
    }, 'frost');
  },
  thorns(h) {
    const fs = abFoes(h, 5).slice(0, 3);
    if (!fs.length) return abNoFoe(h);
    abCast(h);
    for (const f of fs) {
      fxBurst(f.o.x * TILE, f.o.y * TILE + 2, 14, ['#3a8a30', '#8ae070', '#6a4a28'], 60, 10, 0.7, 2, -120);
      abHit(f, h, 1); abStun(f, 2, h, 'В путах!', '#8ae070');
    }
  },
  grow(h) {
    if (typeof World === 'undefined' || !World.obj) return false;
    const r = 6, x0 = Math.floor(h.x), y0 = Math.floor(h.y);
    let n = 0;
    for (let y = Math.max(0, y0 - r); y <= Math.min(MAP_H - 1, y0 + r); y++) for (let x = Math.max(0, x0 - r); x <= Math.min(MAP_W - 1, x0 + r); x++) {
      const i = y * MAP_W + x, o = World.obj[i];
      if (o && o.t === 'field' && o.g >= 0 && o.g < 1 && (x - x0) ** 2 + (y - y0) ** 2 <= r * r) {
        o.g = Math.min(1, o.g + 0.25); if (World.growing) World.growing.add(i); n++;
        if (n % 3 === 0) fxBurst((x + 0.5) * TILE, (y + 0.5) * TILE, 3, ['#a0e060', '#5ab04a'], 20, 30, 0.8, 1.5, -40);
      }
    }
    if (!n) { floater(h.x, h.y - 1.6, 'Полей рядом нет', '#e8e0c0'); return false; }
    abCast(h);
    floater(h.x, h.y - 2.6, `Подросло: ${n}`, '#a0e060');
  },
  beast(h) {
    const L = abList();
    for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'beast' && L[i].own === h.id) L.splice(i, 1);
    L.push({ k: 'beast', own: h.id, x: h.x - 0.8, y: h.y + 0.3, until: Game.time + 25, bite: Game.time + 1, face: 1 });
    abCast(h);
    fxBurst((h.x - 0.8) * TILE, h.y * TILE - 6, 20, ['#c8d8e8', '#ffffff', '#8a96a4'], 60, 40, 0.8, 2, -40);
  },
  cure(h) {
    let n = 0;
    for (const u of Game.units) {
      if (u.dead || u.inside || Math.hypot(u.x - h.x, u.y - h.y) > 8) continue;
      let ok = false;
      if (u.ill && typeof sickCure === 'function') { sickCure(u, 'priest'); ok = true; }
      if (u.injury) { u.injury = null; u.injuryUntil = 0; ok = true; }
      if (ok) { n++; floater(u.x, u.y - 1.4, 'Здоров!', '#a0ffb0'); }
    }
    if (!n) { floater(h.x, h.y - 1.6, 'Рядом все здоровы', '#e8e0c0'); return false; }
    abCast(h);
  },
  bless(h, a) {
    for (const m of abTeam(h, 8)) { m.abShare = { t: Game.time + a.dur, atk: 0.2, red: 0.1 }; m.abbu = { k: a.k, s: Game.time }; }
    abCast(h);
  },
  consecrate(h) {
    abList().push({ k: 'holy', own: h.id, x: h.x, y: h.y + 0.2, r: 3, until: Game.time + 10, tick: Game.time + 1 });
    abCast(h);
  },
  faith(h, a) {
    for (const m of abTeam(h, 6)) { m.abShare = { t: Game.time + a.dur, red: 0.4 }; m.abbu = { k: a.k, s: Game.time }; }
  },
  chord(h) {
    const fs = abFoes(h, 4);
    if (!fs.length) return abNoFoe(h);
    for (const f of fs) abStun(f, 2.5, h, 'Оглушён!', '#d8a0ff');
    fxBurst(h.x * TILE, h.y * TILE - 14, 26, ['#f4e8ff', '#d8a0ff', '#a060e0'], 120, 30, 0.6, 2, 0);
    h.hfx = { k: 'win0', t: Game.time + 0.5 };
  },
  palm(h) {
    const f = abFoes(h, 2.2)[0];
    if (!f) return abNoFoe(h);
    abFace(h, f.o); h.hfx = { k: 'strike', t: Game.time + 0.35 };
    abHit(f, h, 1); abStun(f, 2.5, h, 'Оглушён!');
    abBurstAt(f.o, ['#ffffff', '#ffe0c0'], 10);
  },
};

// ---------- Ресурс, ловушки, освящение, дух-волк — такт ----------

function abHeroes() {
  const out = [];
  if (typeof coop !== 'undefined' && coop.players) { for (const u of coop.players.values()) if (u && u.hero && !u.dead) out.push(u); }
  else if (Game.hero && Game.hero.hero && !Game.hero.dead && kitOn()) out.push(Game.hero);
  return out;
}

function abResTick(h, dt) {
  const H = h.hero, k = abResKind(H), now = Game.time;
  if (!k || H.downT) return;
  const mul = abPassive(H, 'res', 1), max = abResMax(H);
  if (k === 'mana') abResAdd(H, max * 0.012 * mul * dt);
  else if (k === 'energy') abResAdd(H, 6 * mul * dt);
  else if (k === 'faith') abResAdd(H, (typeof nearBonfire === 'function' && nearBonfire(h.x, h.y, 6) ? 2 : 1) * mul * dt);
  else if (k === 'rage') {
    // ярость копится в бою (abRage), вне боя тает до 20, ниже 20 — понемногу набегает сама
    const v = abResGet(H), fight = h.combatUntil > now || (h._rgT || 0) > now - 6;
    if (v < 20) abResAdd(H, 1.2 * dt);
    else if (!fight) abResAdd(H, -3 * dt);
  }
}
function abRage(h, n) {
  const H = h && h.hero;
  if (!H || abResKind(H) !== 'rage') return;
  abResAdd(H, n); h._rgT = Game.time;
}

function abZoneTick(dt) {
  const L = Game.abz, now = Game.time;
  if (!L || !L.length) return;
  for (let i = L.length - 1; i >= 0; i--) {
    const z = L[i], own = Game.unitMap && Game.unitMap.get(z.own);
    if (now > z.until || !own || own.dead) { L.splice(i, 1); continue; }
    if (z.k === 'trap') {
      const f = abFoes({ x: z.x, y: z.y }, 0.9)[0];
      if (f) {
        abStun(f, 5, own, 'Попался!', '#c8a070'); abHit(f, own, 1);
        fxBurst(z.x * TILE, z.y * TILE, 12, ['#d8dce0', '#8a909c', '#c8a070'], 50, 20, 0.5, 1.6, 200);
        sfxAt('click', z.x * TILE, z.y * TILE, 0.8);
        L.splice(i, 1);
      }
    } else if (z.k === 'holy') {
      if (now < z.tick) continue;
      z.tick = now + 1;
      for (const f of abFoes({ x: z.x, y: z.y }, z.r)) {
        if (f.kind === 'skel' || f.kind === 'ent') { if (Math.random() < 0.5) abHit(f, own, 1); }
        else if (f.kind === 'neu') neuHit(f.o, own, neuDamageOf(own) * 0.4);
      }
      for (const m of [own, ...abTeam(own, 12)]) if (m.hero && m.hero.maxhp && Math.hypot(m.x - z.x, m.y - z.y) <= z.r) m.hero.hp = Math.min(m.hero.maxhp, m.hero.hp + m.hero.maxhp * 0.015);
    } else if (z.k === 'beast') {
      // дух-волк держится у хозяина и кусает ближайшего врага
      const f = abFoes(own, 6)[0], tx = f ? f.o.x - 0.6 * Math.sign(f.o.x - own.x || 1) : own.x - 0.9, ty = f ? f.o.y + 0.1 : own.y + 0.3;
      const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy), st = 7 * dt;
      if (d > 0.05) { z.x += dx / d * Math.min(d, st); z.y += dy / d * Math.min(d, st); z.face = dx > 0 ? 1 : -1; z.run = now; }
      if (f && now >= z.bite && Math.hypot(f.o.x - z.x, f.o.y - z.y) < 1.4) {
        z.bite = now + 2; z.bt = now; abHit(f, own, 1);
        floater(f.o.x, f.o.y - 1.8, 'Кусь!', '#c8d8e8');
      }
    }
  }
}

function abTick(dt) {
  const now = Game.time;
  if (ABX.stun.size) for (const o of ABX.stun) if (!(o.abStun > now)) ABX.stun.delete(o);
  // сервер общей деревни: свои поля жителя игрокам, просьба о привале
  if (typeof coop !== 'undefined' && coop.players && !ABX.hooked && typeof coopCmd === 'function') {
    ABX.hooked = true;
    if (typeof COOP_UNIT_EX !== 'undefined') for (const k of ['rs', 'rsm', 'abShare', 'campT']) if (!COOP_UNIT_EX.includes(k)) COOP_UNIT_EX.push(k);
    const _cc = coopCmd;
    coopCmd = function (name, json, admin) {
      let m = null;
      try { m = JSON.parse(json); } catch (e) { return; }
      if (m && m.t === 'camp') { const u = coop.players.get(name); if (u && !u.dead) abCampStart(u); return; }
      return _cc(name, json, admin);
    };
    if (typeof coopUseItem === 'function') {
      const _cu = coopUseItem;
      coopUseItem = function (u, slot) { const s = u.hero && u.hero.inv[slot]; if (s && s.k === 'bandage') { abBandage(u, slot); return; } _cu(u, slot); };
    }
  }
  for (const h of abHeroes()) {
    const H = h.hero;
    abMigrate(h);
    abResTick(h, dt);
    // здоровье под «Диким обликом», освящением и пассивками
    const rg = heroBuf(h, 'regen') + heroBuf(h, 'hpr');
    if (rg && !H.downT && H.maxhp && H.hp > 0 && H.hp < H.maxhp) H.hp = Math.min(H.maxhp, H.hp + rg * dt);
    if (H.owner) { h.rs = Math.round(abResGet(H)); h.rsm = abResMax(H); }
  }
  abZoneTick(dt);
}

// ---------- Привал, перевязка, еда, лазарет ----------

function abCampStart(h) {
  const H = h.hero, now = Game.time;
  if (!H || h.dead) return false;
  if ((H.campCd || 0) > now) { abSay(h, `Привал — через ${Math.ceil(H.campCd - now)} с`); return false; }
  if (abFoes(h, 8).length) { floater(h.x, h.y - 1.6, 'Не до привала — враги рядом', '#e8a070'); return false; }
  if (H.stunUntil > now || H.downT) return false;
  const rk = abResKind(H);
  if (H.hp >= H.maxhp && !h.injury && (!rk || rk === 'rage' || abResGet(H) >= abResMax(H) - 1)) { floater(h.x, h.y - 1.6, 'Отдыхать незачем', '#e8e0c0'); return false; }
  issueCmd(h, { kind: 'camp', tx: Math.floor(h.x), ty: Math.floor(h.y), label: 'Привал' });
  return true;
}
function* abCampGen(u) {
  const H = u.hero;
  u.campT = Game.time;
  floater(u.x, u.y - 1.8, 'Привал', '#ffd070');
  sfxAt('crackle', u.x * TILE, u.y * TILE, 0.6);
  try {
    for (let k = 0; k < AB_CAMP_T; k++) {
      if (abFoes(u, 7).length) { floater(u.x, u.y - 1.8, 'Тревога!', '#ff9a70'); break; }
      yield { wait: 1, anim: 'sit' };
      u.campT = Game.time;
      if (!H) { if (u.injury && k > 8) u.injury = null; continue; }
      H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.03);
      if (abResKind(H) && abResKind(H) !== 'rage') abResAdd(H, abResMax(H) * 0.04);
      if (k >= 8) u.injury = null;
      if (H.hp >= H.maxhp && (!abResKind(H) || abResKind(H) === 'rage' || abResGet(H) >= abResMax(H))) { floater(u.x, u.y - 1.8, 'Отдохнул!', '#a0ffb0'); break; }
    }
  } finally {
    u.campT = 0;
    if (H) H.campCd = Game.time + AB_CAMP_CD;
  }
}
function abBandage(h, slot) {
  const H = h.hero, s = H.inv[slot];
  if (!s || s.k !== 'bandage') return false;
  if (!h.injury && H.hp >= H.maxhp) { floater(h.x, h.y - 1.6, 'Перевязывать нечего', '#e8e0c0'); return false; }
  s.n--; if (s.n <= 0) H.inv[slot] = null;
  h.injury = null; h.injuryUntil = 0;
  H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.2);
  floater(h.x, h.y - 1.6, 'Перевязал', '#f0ece0');
  sfxAt('heal', h.x * TILE, h.y * TILE, 0.5);
  return true;
}
// кнопка «Еда»: раненому — перевязка, иначе самое сытное из рюкзака
function abEatSlot(h) {
  const H = h.hero, inv = H.inv || [];
  const hurt = h.injury || H.hp < H.maxhp * 0.6;
  if (hurt) { const i = inv.findIndex(s => s && s.k === 'bandage'); if (i >= 0) return i; }
  let best = -1, bv = 0;
  inv.forEach((s, i) => { const v = s && typeof HL_FOOD !== 'undefined' && HL_FOOD[s.k]; if (v && v > bv) { bv = v; best = i; } });
  return best;
}

// лазарет: герой ложится на койку, лекарь лечит быстро, без лекаря — медленно; зелье лазарета — сразу четверть здоровья
function* abWardGen(u, c) {
  const b = c.b, H = u.hero;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  yield { enter: b };
  const doc = () => Game.units.some(x => x.type === 'healer' && !x.dead && (x.inside === b || x.home === b));
  if (H.hp < H.maxhp * 0.6 && b.stock.potion > 0) { b.stock.potion--; H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.25); floater(u.x, u.y - 1.6, 'Зелье лекаря', '#ff9ab0'); }
  for (let k = 0; k < 30 && H.hp < H.maxhp && !b.removed; k++) {
    yield { wait: 1 };
    H.hp = Math.min(H.maxhp, H.hp + H.maxhp * (doc() ? 0.05 : 0.02));
  }
  u.injury = null; u.injuryUntil = 0;
  floater(u.x, u.y - 1.6, doc() ? 'Лекарь подлатал' : 'Отлежался', '#a0ffb0');
  yield { leave: true };
}

// ---------- Миграция старых героев ----------
function abMigrate(h) {
  const H = h.hero;
  if (H.abV === 2) return;
  H.abV = 2;
  const jars = H.jars | 0;
  let gold = 0;
  if (jars > 0) { gold = jars * 2; if (!abStore('gold', gold)) gold = 0; }
  for (const k of ['jars', 'cdHeal', 'cdFire', 'cdWard', 'cdCry']) delete H[k];
  H.abCd = {}; H.abT = {}; H.abNext = 0;
  if (abResKind(H) === 'rage') H.rs = 20;
  else if (abResKind(H) && abResKind(H) !== 'mana') H.rs = abResMax(H);
  if (!H.owner && Game.time > 1 && (H.level > 1 || jars)) {
    toast(`Обновление: у каждого класса теперь свои способности — до пяти, на панели в углу. Зелье лечения и общий огненный шар ушли: лечение — привалом, у костра, в трактире и лазарете.${gold ? ` За ${jars} банок маны — ${gold} золота на склад.` : ''}`);
  }
}

// ---------- Подключение к симуляции ----------
{
  const _step = step;
  step = function (dt) {
    // оглушённые враги стоят на месте: запоминаем, где были, и возвращаем после такта
    let snap = null;
    if (ABX.stun.size) { snap = []; for (const o of ABX.stun) if (o.abStun > Game.time) snap.push([o, o.x, o.y, o.t]); }
    _step(dt);
    if (snap) for (const [o, x, y, t] of snap) { o.x = x; o.y = y; if (t != null) o.t = t; o.moving = false; }
    abTick(dt);
  };

  const _rs = resetGameState;
  resetGameState = function () { _rs(); Game.abz = []; ABX.stun.clear(); };

  // по оглушённому не промахиваются, и он не отвечает; удар героя — ярость
  const _strike = strike;
  strike = function (u, f) {
    const hero = u && u.type === 'hero' && u.hero;
    if (hero) abRage(u, 6);
    if (hero && f && !f.sure && f.kind !== 'neu' && foeAlive(f) && abStunned(f.o)) {
      floater(f.o.x, f.o.y - 2, 'По лежачему!', '#ffe070');
      killFoe(f, u);
      return;
    }
    _strike(u, f);
  };
  // удар по герою — тоже ярость
  if (typeof hlHurt === 'function') {
    const _hh = hlHurt;
    hlHurt = function (u, n, why) { if (why === 'hit' && u && u.hero && n > 0) abRage(u, 5); _hh(u, n, why); };
  }
  if (typeof neuHurtUnit === 'function') {
    const _nh = neuHurtUnit;
    neuHurtUnit = function (u, n) { if (u && u.hero && n >= 1) abRage(u, 5); _nh(u, n); };
  }
  // после падения — «Слабость»: бьёт слабее 45 с, ярость сгорает
  if (typeof hlRespawn === 'function') {
    const _rp = hlRespawn;
    hlRespawn = function (u, why) {
      _rp(u, why);
      const H = u.hero;
      if (!H) return;
      H.weakUntil = Game.time + AB_WEAK_T;
      if (abResKind(H) === 'rage') H.rs = 0;
      toast(`${H.name}: слабость ${AB_WEAK_T} с — бьёт слабее. Отдохните у костра.`);
    };
  }
  const _ua = unitAtk;
  unitAtk = function (u) { const a = _ua(u); return u.hero && u.hero.weakUntil > Game.time ? a * 0.85 : a; };

  // привал и лазарет — приказы героя
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'camp') yield* abCampGen(u);
    else if (c.kind === 'hward') { if (u.type === 'hero' && u.hero) yield* abWardGen(u, c); else yield { wait: 0.8 }; }
    else yield* _run(u, c);
  };
  const _tt = teamThink;
  teamThink = function (u) {
    const h = heroOf(u);
    if (h && h.cmd && h.cmd.kind === 'hward') { u.idleFlag = false; u.job = null; return (function* () { yield { wait: 0.8 }; })(); }
    return _tt(u);
  };
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (kitOn() && !Game.hero.dead && inb(t[0], t[1])) {
      const b = buildingAt(t), H = Game.hero.hero;
      if (b && b.type === 'infirmary' && b.state === 'done' && !b.upg && !b.removed && (H.hp < H.maxhp || Game.hero.injury)) return { kind: 'hward', b, tx: b.doorX, ty: b.doorY, label: 'Лечиться в лазарете' };
    }
    return _rc(t);
  };

  // перевязка из рюкзака
  if (typeof hlUse === 'function') {
    const _use = hlUse;
    hlUse = function (i) {
      const h = Game.hero, s = h && h.hero && h.hero.inv[i];
      if (s && s.k === 'bandage' && kitOn()) { abBandage(h, i); updateUI(true); return; }
      _use(i);
    };
  }

  // малые кнопки панели и клавиши
  const _ab = heroAbility;
  heroAbility = function (k) {
    const h = Game.hero;
    if (k === 'u_camp') {
      if (!h || !h.hero) return;
      if (kitMirror()) { coopSend({ t: 'camp' }); return; }
      if (kitOn()) abCampStart(h);
      return;
    }
    if (k === 'u_eat') {
      if (!h || !h.hero) return;
      const i = abEatSlot(h);
      if (i < 0) { floater(h.x, h.y - 1.6, 'В рюкзаке нет еды', '#e8a070'); return; }
      if (kitMirror()) { coopSend({ t: 'use', slot: i }); return; }
      heroAbility('use' + i);
      return;
    }
    _ab(k);
  };

  // исчезновение: герой почти прозрачный
  if (typeof drawUnit === 'function') {
    const _du = drawUnit;
    drawUnit = function (c, u) {
      const fx = u.abfx;
      if (fx && fx.k === 'vanish' && fx.t > Game.time && !u.inside && !u.dead) { c.save(); c.globalAlpha = 0.28 + 0.06 * Math.sin(Game.time * 6); _du(c, u); c.restore(); return; }
      _du(c, u);
    };
  }

  // ловушки, освящённая земля, дух-волк, костерок привала, звёздочки над оглушёнными
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const t = Game.time;
    for (const z of Game.abz || []) abDrawZone(c, z, t);
    for (const u of Game.units) if (u.campT && !u.inside && !u.dead && t - u.campT < 2) abDrawCampfire(c, (u.x + 0.55) * TILE, u.y * TILE + 4, t);
    for (const o of ABX.stun) if (o.abStun > t) abDrawStars(c, o.x * TILE, o.y * TILE - 30, t);
  };
}

// ---------- Рисование (своя пиксельная графика; кадры — КАДРЫ.md) ----------

function abPx(c, x, y, s, col, a) { c.globalAlpha = Math.max(0, Math.min(1, a == null ? 1 : a)); c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), s, s); }

function abDrawStars(c, x, y, t) {
  c.save();
  for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.09; abPx(c, x + Math.cos(a) * 7 - 1, y + Math.sin(a) * 2.5 - 1, 2, i % 2 ? '#fff6c0' : '#ffe070', 0.95); }
  c.restore();
}

function abDrawCampfire(c, x, y, t) {
  c.save();
  // поленья крест-накрест и три языка пламени (4 кадра по 0,12 с)
  abPx(c, x - 5, y, 10, '#5a3a1a', 1); c.fillRect(Math.round(x - 5), Math.round(y), 10, 2);
  c.fillStyle = '#7a5028'; c.fillRect(Math.round(x - 4), Math.round(y - 1), 8, 1);
  const f = Math.floor(t / 0.12) % 4, hs = [[5, 7, 4], [6, 5, 6], [4, 8, 5], [7, 6, 4]][f];
  const cols = ['#c8302a', '#ff8a30', '#ffe070'];
  for (let k = 0; k < 3; k++) {
    const hx = x - 3 + k * 3, h = hs[k];
    for (let j = 0; j < h; j++) { c.globalAlpha = 1; c.fillStyle = cols[Math.min(2, Math.floor(j / h * 3))]; c.fillRect(Math.round(hx), Math.round(y - 1 - j), j > h - 2 ? 1 : 2, 1); }
  }
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y - 3, 1, x, y - 3, 16);
  g.addColorStop(0, 'rgba(255,170,60,0.35)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - 3, 16, 0, 7); c.fill();
  c.restore();
}

function abDrawZone(c, z, t) {
  const px = z.x * TILE, py = z.y * TILE;
  c.save();
  if (z.k === 'trap') {
    // капкан: стальные зубья, раскрытые на земле
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(px, py + 1, 6, 2.2, 0, 0, 7); c.fill();
    c.fillStyle = '#8a909c'; c.fillRect(Math.round(px - 6), Math.round(py - 1), 12, 1); c.fillRect(Math.round(px - 6), Math.round(py + 1), 12, 1);
    c.fillStyle = '#d8dce0';
    for (let i = 0; i < 5; i++) { c.fillRect(Math.round(px - 5 + i * 2.5), Math.round(py - 2), 1, 1); c.fillRect(Math.round(px - 5 + i * 2.5), Math.round(py + 2), 1, 1); }
    c.fillStyle = '#5a3a1a'; c.fillRect(Math.round(px - 1), Math.round(py), 2, 1);
  } else if (z.k === 'holy') {
    const left = z.until - t, a = left < 1.5 ? left / 1.5 : 1, r = z.r * TILE;
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, `rgba(255,236,150,${0.28 * a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(px, py, r, r * 0.55, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(255,230,140,${(0.55 + 0.2 * Math.sin(t * 4)) * a})`; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(px, py, r, r * 0.55, 0, 0, 7); c.stroke();
    for (let i = 0; i < 8; i++) { const an = t * 0.8 + i * 0.785; abPx(c, px + Math.cos(an) * r * 0.85 - 1, py + Math.sin(an) * r * 0.47 - 2 - ((t * 20 + i * 5) % 10), 2, '#fff6c0', 0.8 * a); }
  } else if (z.k === 'beast') {
    // дух-волк: полупрозрачный, бег — 4 кадра, укус — короткий выпад
    const run = t - (z.run || 0) < 0.2, fr = run ? Math.floor(t / 0.1) % 4 : 0, f = z.face || 1, bite = t - (z.bt || -9) < 0.25;
    const left = z.until - t, a = (left < 2 ? left / 2 : 1) * (0.72 + 0.1 * Math.sin(t * 5));
    c.translate(Math.round(px + (bite ? f * 2 : 0)), Math.round(py)); c.scale(f, 1);
    const B = '#c8d8e8', D = '#8a96a4', W = '#ffffff';
    c.globalAlpha = 0.25 * a; c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, 1, 8, 2, 0, 0, 7); c.fill();
    c.globalAlpha = a;
    const leg = [[0, 1, 0, 1], [1, 0, 1, 0], [0, -1, 0, -1], [-1, 0, -1, 0]][fr];
    c.fillStyle = D; for (let i = 0; i < 4; i++) c.fillRect(-5 + i * 3 + leg[i], -3, 1, 3);
    c.fillStyle = B; c.fillRect(-6, -8, 11, 5);                  // тело
    c.fillRect(4, -11, 4, 4); c.fillRect(7, -10, 2, 2);            // голова и морда
    c.fillStyle = D; c.fillRect(4, -13, 1, 2); c.fillRect(6, -13, 1, 2);   // уши
    c.fillRect(-9, -9 + (fr % 2), 3, 1);                           // хвост
    c.fillStyle = W; c.fillRect(6, -10, 1, 1);
    c.fillStyle = '#3a78c8'; c.fillRect(5, -10, 1, 1);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 * a;
    c.fillStyle = '#9ec8ff'; c.fillRect(-7, -12, 16, 10);
  }
  c.restore();
}

// ---------- Панель быстрых способностей (одно касание) ----------

const AB_UTIL = [
  { k: 'u_atk', run: 'g_strike', icon: 'strike', name: 'Атака', key: 'Q', desc: 'Бить ближайшего врага (или того, кого уже бьёт герой)' },
  { k: 'u_eat', run: 'u_eat', icon: 'u_eat', name: 'Еда', desc: 'Съесть самое сытное из рюкзака (+10% здоровья); раненому — перевязка (снимает рану, +20%)' },
  { k: 'u_camp', run: 'u_camp', icon: 'u_camp', name: 'Привал', desc: `Развести костерок и отдохнуть ${AB_CAMP_T} с: +3% здоровья в секунду, раны затягиваются. Не рядом с врагами` },
  { k: 'u_home', run: 'tp', icon: 'tp', name: 'Домой', desc: 'Телепорт на базу — к большому костру или складу', solo: true },
];

function abBarState() {
  const h = Game.hero, H = h && h.hero;
  if (!h || !H || h.dead) return null;
  const mir = kitMirror();
  if (mir) { H.abCd = h.abcd || {}; H.abT = h.abt || {}; }
  const as = heroAbils(H) || [], rk = abResKind(H), now = Game.time;
  const rv = rk ? (mir ? (h.rs != null ? h.rs : 0) : abResGet(H)) : 0, rm = rk ? (mir ? h.rsm || abResMax(H) : abResMax(H)) : 0;
  const slots = as.map((a, i) => {
    const lock = (H.level || 1) < (a.lvl || 1), left = Math.max(0, ((H.abCd || {})[a.k] || 0) - now);
    const cdFull = a.cd * abPassive(H, 'cd', 1);
    return { i, a, lock, left, pct: left && cdFull ? Math.min(1, left / cdFull) : 0, on: ((H.abT || {})[a.k] || 0) > now, lack: !lock && !a.passive && a.cost > rv };
  });
  const camp = Math.max(0, (H.campCd || 0) - now);
  return { h, H, rk, rv, rm, slots, camp, mir, eat: abEatSlot(h) >= 0, band: (H.inv || []).some(s => s && s.k === 'bandage') && (h.injury || H.hp < H.maxhp * 0.6) };
}

function abBarHTML(S) {
  if (!S) return '';
  const R = S.rk ? ABIL_RES[S.rk] : null;
  const res = R ? `<div class="ab-res" title="${R.name}: ${Math.round(S.rv)} из ${S.rm}"><i style="width:${Math.round(100 * S.rv / Math.max(1, S.rm))}%;background:${R.col}"></i><span>${R.name} ${Math.round(S.rv)}/${S.rm}</span></div>` : '';
  const slots = S.slots.map(s => {
    const cl = ['ab-s']; if (s.lock) cl.push('lock'); else if (s.a.passive) cl.push('pas'); else if (s.left > 0) cl.push('cd'); else if (s.lack) cl.push('lack'); if (s.on) cl.push('on');
    const ring = s.left > 0 ? `<b class="ab-cd" style="--p:${Math.round(s.pct * 360)}deg"></b><em>${Math.ceil(s.left)}</em>` : '';
    return `<button class="${cl.join(' ')}" data-ab="${s.i}" aria-label="${s.a.name}"><img src="${abilIcon16(s.a.k)}" alt="">${ring}`
      + (s.lock ? `<em class="ab-lk">ур.${s.a.lvl}</em>` : '')
      + (!s.lock && !s.a.passive && s.a.cost ? `<i class="ab-cost" style="color:${R ? R.col : '#fff'}">${s.a.cost}</i>` : '')
      + (s.a.passive && !s.lock ? '<i class="ab-cost ab-inf">∞</i>' : '')
      + `<i class="ab-key">${ABIL_KEYN[s.i]}</i></button>`;
  }).join('');
  const util = AB_UTIL.filter(u => !(u.solo && S.mir)).map(u => {
    const dis = (u.k === 'u_eat' && !S.eat) || (u.k === 'u_camp' && S.camp > 0) || (u.k === 'u_home' && (S.H.cdTp || 0) > Game.time);
    const icon = u.k === 'u_eat' && S.band ? 'u_band' : u.icon;
    return `<button class="ab-u${dis ? ' dim' : ''}" data-abu="${u.k}" aria-label="${u.name}"><img src="${abilIcon16(icon)}" alt="">${u.k === 'u_camp' && S.camp > 0 ? `<em>${Math.ceil(S.camp)}</em>` : ''}</button>`;
  }).join('');
  const none = S.slots.length ? '' : '<div class="ab-none">Способности даст гильдия</div>';
  return `${res}<div class="ab-util">${util}</div><div class="ab-slots">${slots}${none}</div>`;
}

function abTipFor(el) {
  const S = abBarState();
  if (!S) return '';
  if (el.dataset.ab != null) {
    const s = S.slots[+el.dataset.ab];
    if (!s) return '';
    const a = s.a, R = S.rk ? ABIL_RES[S.rk].name.toLowerCase() : '';
    const meta = a.passive ? 'пассивно, действует всегда' : [a.cost ? `${R} ${a.cost}` : '', `перезарядка ${a.cd} с`, `клавиша ${ABIL_KEYN[s.i]}`].filter(Boolean).join(' · ');
    const st = s.lock ? `откроется на ${a.lvl} уровне` : s.left > 0 ? `готово через ${Math.ceil(s.left)} с` : s.lack ? `не хватает: ${R}` : '';
    return `<b>${a.name}</b>${st ? ` <small>${st}</small>` : ''}<br>${a.desc}<br><small>${meta}</small>`;
  }
  const u = AB_UTIL.find(x => x.k === el.dataset.abu);
  return u ? `<b>${u.name}</b>${u.key ? ` <small>клавиша ${u.key}</small>` : ''}<br>${u.desc}` : '';
}

function abBarUse(el) {
  if (!Game.hero || Game.hero.dead) return;
  let ok = false;
  if (el.dataset.ab != null) ok = heroUseAbility(+el.dataset.ab);
  else { const u = AB_UTIL.find(x => x.k === el.dataset.abu); if (u) { heroAbility(u.run); ok = true; } }
  if (typeof Tut !== 'undefined' && Tut.on) Tut.cast = true;
  el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 160);
  if (ok && navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* нет вибрации */ }
  abBarUpdate(true);
}

function abBarUpdate(force) {
  const bar = typeof document !== 'undefined' && document.getElementById && document.getElementById('ab-bar');
  if (!bar) return;
  const S = abBarState();
  const show = !!S && !(typeof Run !== 'undefined' && Run.on);
  bar.classList.toggle('hidden', !show);
  if (!show) return;
  const html = abBarHTML(S);
  if (force || bar.dataset.h !== html) { bar.dataset.h = html; bar.innerHTML = html + (ABX.tip ? `<div class="ab-tip">${abTipFor(ABX.tip)}</div>` : ''); if (ABX.tip) ABX.tip = bar.querySelector(ABX.tip.dataset.ab != null ? `[data-ab="${ABX.tip.dataset.ab}"]` : `[data-abu="${ABX.tip.dataset.abu}"]`); }
}

function initAbBar() {
  const view = document.getElementById('view');
  if (!view || document.getElementById('ab-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'ab-bar'; bar.className = 'hidden';
  view.appendChild(bar);
  let hold = 0, held = false, down = null;
  const tipShow = el => { ABX.tip = el; abBarUpdate(true); };
  const tipHide = () => { if (ABX.tip) { ABX.tip = null; abBarUpdate(true); } };
  bar.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const el = e.target.closest('[data-ab],[data-abu]');
    if (!el) return;
    down = el; held = false;
    clearTimeout(hold);
    hold = setTimeout(() => { held = true; tipShow(el); }, 420);   // удержание — подсказка
  });
  const up = e => {
    clearTimeout(hold);
    const el = down; down = null;
    if (!el) return;
    if (held) { setTimeout(tipHide, 1600); return; }
    if (e && e.type === 'pointerup') abBarUse(el);
  };
  bar.addEventListener('pointerup', up);
  bar.addEventListener('pointercancel', () => { clearTimeout(hold); down = null; tipHide(); });
  bar.addEventListener('contextmenu', e => e.preventDefault());
  bar.addEventListener('click', e => e.stopPropagation());
  // мышь: наведение — подсказка
  bar.addEventListener('mouseover', e => {
    if (typeof Mobile !== 'undefined' && Mobile.on) return;
    const el = e.target.closest('[data-ab],[data-abu]');
    if (el && el !== ABX.tip) tipShow(el);
  });
  bar.addEventListener('mouseleave', tipHide);
  const st = document.createElement('style');
  st.textContent = `#ab-bar{position:absolute;right:10px;bottom:10px;z-index:7;display:flex;flex-direction:column;align-items:flex-end;gap:5px;pointer-events:none;
    --abs:52px;font-family:inherit;user-select:none;-webkit-user-select:none;touch-action:manipulation}
  #ab-bar.hidden{display:none}
  #ab-bar>*{pointer-events:auto}
  #ab-bar .ab-slots,#ab-bar .ab-util{display:flex;gap:6px;align-items:flex-end}
  #ab-bar button{position:relative;padding:0;border-radius:10px;cursor:pointer;overflow:hidden;flex:none;-webkit-tap-highlight-color:transparent}
  #ab-bar .ab-s{width:var(--abs);height:var(--abs);background:radial-gradient(circle at 50% 35%,#4a3818,#1e1509 75%);border:2px solid #b8902c;box-shadow:0 2px 0 #000,inset 0 0 0 1px rgba(255,230,160,.18)}
  #ab-bar .ab-s img{width:calc(var(--abs) - 16px);height:calc(var(--abs) - 16px);image-rendering:pixelated;display:block;margin:auto}
  #ab-bar .ab-s.on{border-color:#7fe0ff;box-shadow:0 0 10px rgba(127,224,255,.8),0 2px 0 #000}
  #ab-bar .ab-s.pas{border-style:dashed;border-color:#8a7a50;background:radial-gradient(circle at 50% 35%,#3a3020,#18120a 75%)}
  #ab-bar .ab-s.lock img,#ab-bar .ab-s.lack img{filter:grayscale(1) brightness(.55)}
  #ab-bar .ab-s.lack{border-color:#4a68a8}
  #ab-bar .ab-s.hit,#ab-bar .ab-u.hit{transform:scale(.9)}
  #ab-bar .ab-cd{position:absolute;inset:0;background:conic-gradient(rgba(0,0,0,.66) var(--p),rgba(0,0,0,0) 0);pointer-events:none}
  #ab-bar em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:bold;font-size:17px;color:#fff;text-shadow:0 1px 0 #000,0 0 3px #000;pointer-events:none}
  #ab-bar em.ab-lk{align-items:flex-end;padding-bottom:3px;font-size:11px;color:#e8d8b0;background:rgba(0,0,0,.4)}
  #ab-bar i{position:absolute;font-style:normal;font-size:11px;line-height:12px;font-weight:bold;text-shadow:0 1px 0 #000,0 0 2px #000;pointer-events:none}
  #ab-bar .ab-key{left:4px;top:2px;color:#ffe9a8}#ab-bar .ab-cost{right:4px;bottom:2px}#ab-bar .ab-inf{color:#f0d880;font-size:13px}
  body.mobile #ab-bar .ab-key{display:none}
  #ab-bar .ab-u{width:40px;height:40px;background:#241a0e;border:1px solid #8a6a28;box-shadow:0 2px 0 #000}
  #ab-bar .ab-u img{width:26px;height:26px;image-rendering:pixelated;display:block;margin:auto}
  #ab-bar .ab-u.dim img{filter:grayscale(1) brightness(.5)}#ab-bar .ab-u em{font-size:12px}
  #ab-bar .ab-res{position:relative;width:min(100%,180px);height:10px;background:#15100a;border:1px solid #0a0705;border-radius:4px;overflow:hidden}
  #ab-bar .ab-res i{position:static;display:block;height:100%}
  #ab-bar .ab-res span{position:absolute;inset:0;text-align:center;font-size:8px;line-height:10px;color:#fff;text-shadow:0 1px 0 #000}
  #ab-bar .ab-none{padding:6px 10px;font-size:11px;color:#c8b890;background:rgba(20,14,8,.8);border:1px dashed #6a5428;border-radius:6px}
  #ab-bar .ab-tip{position:absolute;right:0;bottom:calc(100% + 6px);width:min(260px,calc(100vw - 24px));padding:7px 9px;background:rgba(20,14,8,.96);color:#e8dcc0;border:1px solid #b8902c;border-radius:6px;font-size:12px;line-height:1.35;pointer-events:none}
  #ab-bar .ab-tip b{color:#f6d458}#ab-bar .ab-tip small{color:#9ec8ff;font-size:10.5px}
  body:not(.mobile):has(#tut-list:not(.hidden)) #ab-bar{right:216px}
  body.mobile #ab-bar{--abs:58px;right:calc(8px + env(safe-area-inset-right));bottom:calc(122px + env(safe-area-inset-bottom))}
  body.mobile.sheet-tab #ab-bar,body.mobile.sheet-info #ab-bar{display:none}
  body.mobile:not(.land):has(#tut-list:not(.hidden)) #ab-bar{bottom:calc(158px + env(safe-area-inset-bottom))}
  body.mobile:not(.land):has(#hero-card[style*="block"]) #ab-bar{display:none}
  body.mobile.land #ab-bar{--abs:54px;bottom:calc(var(--sb) + 8px);right:calc(var(--sr) + var(--mmw) + 16px);display:grid;grid-template-areas:"res res" "util slots";gap:5px 8px;align-items:end;justify-items:end}
  body.mobile.land #ab-bar .ab-res{grid-area:res}body.mobile.land #ab-bar .ab-slots{grid-area:slots}
  body.mobile.land #ab-bar .ab-util{grid-area:util;gap:4px}
  body.mobile.land #ab-bar .ab-u{width:40px;height:40px}
  body.mobile.land #ab-bar .ab-tip{bottom:calc(100% + 4px)}
  body.mobile.land.sheet-tab #ab-bar,body.mobile.land.sheet-info #ab-bar{display:flex}
  body.mobile.land.sheet-tab #ab-bar.hidden,body.mobile.land.sheet-info #ab-bar.hidden{display:none}`;
  document.head.appendChild(st);
  // обновление 5 раз в секунду — в кадре отрисовки (без таймеров: в тестах и на сервере кадров нет, процесс не держим)
  const loop = () => {
    const t = performance.now();
    if (t - ABX.uiT > 200) { ABX.uiT = t; try { abBarUpdate(false); } catch (e) { /* интерфейс ещё не готов */ } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // клавиатура: Q — атака уже в guilds.js; цифры 1–5 — herokit.js
}

if (typeof document !== 'undefined' && document.getElementById && document.createElement && typeof window !== 'undefined' && window.addEventListener && !(typeof coop !== 'undefined' && coop.players)) {
  const _sg = startGame;
  startGame = function () { _sg(); try { initAbBar(); abBarUpdate(true); } catch (e) { /* без интерфейса */ } };
}
