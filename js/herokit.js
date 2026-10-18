'use strict';
// Снаряжение и способности классов героя, бой героя.
// · Каждому классу — простое оружие первого уровня в рюкзак (ржавое, треснутое, увядшее): небольшой бонус
//   к характеристикам; своё оружие герой надевает с первого раза.
// · По две классовые способности по мотивам D&D (вторая — с 4 уровня): перезарядка, значок, описание; клавиши Z и X.
// · Бой героя: выхватывает оружие из ножен, замах → удар → довод, парирует и морщится от ударов, победная стойка
//   (кадры — в people.js, здесь — когда какой показывать); на ходу в бою оружие в руке, потом снова в ножнах.
// · Нечисть ночи в бою с героем и рекрутами держит больше ударов и бьёт в ответ сильнее с каждой ночью (nightDiff).
// Подключается после neutrals.js. Рюкзак и способности — в одиночной игре (как herolife.js); облик оружия,
// кадры боя и крепость нечисти работают и в общей деревне: сервер грузит этот же файл.

// ---------- Оружие первого уровня ----------
// w — облик в people.js (WPN_STYLE), bonus — к характеристикам, atk — к удару, def — к защите
const KIT_ITEMS = {
  rustySword:   { slot: 'weapon', name: 'Ржавый меч', w: 'rsword', bonus: { str: 2 }, atk: 0.06 },
  woodShield:   { slot: 'off', name: 'Деревянный щит', w: 'wshield', bonus: { end: 2 }, def: 0.1 },
  rustyAxe2:    { slot: 'weapon', name: 'Ржавая двуручная секира', w: 'axe2', bonus: { str: 3, end: 1 }, atk: 0.08 },
  sparkStaff:   { slot: 'weapon', name: 'Искрящий посох', w: 'sstaff', bonus: { int: 3 }, atk: 0.06 },
  witherStaff:  { slot: 'weapon', name: 'Увядший посох', w: 'wstaff', bonus: { int: 2, end: 1 }, atk: 0.05 },
  rustyDagger:  { slot: 'weapon', name: 'Ржавый кинжал', w: 'rdagger', bonus: { agi: 2 }, atk: 0.05 },
  brokenDagger: { slot: 'off', name: 'Сломанный кинжал', w: 'bdagger', bonus: { agi: 1 }, atk: 0.02 },
  crookedBow:   { slot: 'weapon', name: 'Кривой лук', w: 'cbow', bonus: { agi: 2 }, atk: 0.06 },
  oldWraps:     { slot: 'weapon', name: 'Потёртые обмотки', w: 'fists', bonus: { agi: 1, end: 1 }, atk: 0.04 },
  crackedMace:  { slot: 'weapon', name: 'Треснувшая булава', w: 'cmace', bonus: { str: 1, int: 1 }, atk: 0.05 },
};
const KIT_OF = {
  warrior: ['rustySword', 'woodShield'], barbarian: ['rustyAxe2'], mage: ['sparkStaff'], druid: ['witherStaff'],
  rogue: ['rustyDagger', 'brokenDagger'], archer: ['crookedBow'], monk: ['oldWraps'], priest: ['crackedMace'],
};
// облик оружия из оружейной
const WPN_LOOK = { sword: 'sword', dagger: 'dagger', staff: 'staff', bow: 'bow' };
const STAT_RU = { str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' };

if (typeof HL_GEAR !== 'undefined') for (const k in KIT_ITEMS) HL_GEAR[k] = { slot: KIT_ITEMS[k].slot, name: KIT_ITEMS[k].name };
if (typeof GEAR_BONUS !== 'undefined') for (const k in KIT_ITEMS) GEAR_BONUS[k] = Object.assign({}, KIT_ITEMS[k].bonus, { atk: KIT_ITEMS[k].atk || 0, def: KIT_ITEMS[k].def || 0 });

const kitBonusText = k => Object.entries(KIT_ITEMS[k].bonus).map(([s, v]) => `${STAT_RU[s]} ${v > 0 ? '+' : ''}${v}`).join(', ');
// для окна гильдии: что выдадут в рюкзак
function heroKitText(cls) {
  const ks = KIT_OF[cls];
  return ks ? 'в рюкзак: ' + ks.map(k => KIT_ITEMS[k].name.toLowerCase()).join(' и ') : '';
}
const kitMine = (H, k) => !!(KIT_ITEMS[k] && H && KIT_OF[H.clsKey] && KIT_OF[H.clsKey].includes(k));

// Строка оружия для спрайта (people.js): 'основное|левая рука|1 — выхвачено'
function heroWpnOf(u) {
  const H = u.hero;
  if (!H) return '';
  const eq = H.equip || {};
  const look = k => (k && KIT_ITEMS[k] ? KIT_ITEMS[k].w : WPN_LOOK[k] || '');
  let m = look(eq.weapon), o = look(eq.off);
  // в общей деревне рюкзаки чужих героев не видны: облик — по оружию класса
  if (!m && !o && H.owner && KIT_OF[H.clsKey]) { const ks = KIT_OF[H.clsKey]; m = look(ks[0]); o = look(ks[1]); }
  if (!m && !o) return '';
  const now = Game.time;
  const out = u.combatUntil > now || (u.anim && FIGHT_ANIM_SET.has(u.anim)) || (u.hfx && u.hfx.t > now);
  return `${m}|${o}|${out ? 1 : 0}`;
}

// ---------- Способности классов ----------
// heal — лечит долю здоровья (+2% за уровень), team — и команду рядом; buf на dur секунд:
// atk — точность, dmg — урон, red — меньше урона по герою (минус — больше), dodge — уклонение, spd — удары чаще,
// regen — здоровья в секунду; shots — снаряды без промаха по врагам рядом; next — следующий удар без промаха ×mul
const HERO_ABIL = {
  warrior: [
    { k: 'wind', name: 'Второе дыхание', cd: 60, heal: 0.25, desc: 'Переводит дух: сразу +25% здоровья (и ещё +2% за каждый уровень)' },
    { k: 'surge', name: 'Всплеск действий', cd: 75, lvl: 4, dur: 8, buf: { spd: 0.5, atk: 0.25 }, desc: '8 с: бьёт вдвое чаще и на четверть точнее' },
  ],
  barbarian: [
    { k: 'rage', name: 'Ярость', cd: 70, dur: 15, buf: { dmg: 0.5, red: 0.4 }, desc: '15 с: урон +50%, а по нему — на 40% слабее' },
    { k: 'reckless', name: 'Безрассудная атака', cd: 40, lvl: 4, dur: 8, buf: { atk: 0.35, red: -0.25 }, desc: '8 с: попадает на 35% чаще, но и сам открыт: урон по нему +25%' },
  ],
  mage: [
    { k: 'missile', name: 'Магическая стрела', cd: 18, shots: { n: 3, kind: 'mdart', r: 8, mul: 1 }, desc: 'Три искры без промаха в ближайших врагов (до 8 клеток); урон растёт со смекалкой' },
    { k: 'shield', name: 'Щит', cd: 40, lvl: 4, dur: 6, buf: { red: 0.7 }, desc: '6 с: невидимая преграда — урон по магу меньше на 70%' },
  ],
  druid: [
    { k: 'wild', name: 'Дикий облик', cd: 90, dur: 20, buf: { dmg: 0.4, red: 0.3, regen: 1.5 }, desc: '20 с: медвежья сила — урон +40%, урон по нему −30%, раны затягиваются' },
    { k: 'mend', name: 'Целебное слово', cd: 35, lvl: 4, heal: 0.3, team: true, desc: 'Слово леса: +30% здоровья себе и команде рядом, снимает раны' },
  ],
  rogue: [
    { k: 'sneak', name: 'Скрытая атака', cd: 22, next: 3, desc: 'Следующий удар — без промаха и втрое сильнее; скелета или дерево — с одного удара' },
    { k: 'evade', name: 'Увёртливость', cd: 45, lvl: 4, dur: 10, buf: { dodge: 0.5 }, desc: '10 с: уходит от половины ударов' },
  ],
  archer: [
    { k: 'aimed', name: 'Меткий выстрел', cd: 22, next: 2.5, desc: 'Следующий выстрел — без промаха и в 2,5 раза сильнее' },
    { k: 'volley', name: 'Град стрел', cd: 50, lvl: 4, shots: { n: 5, kind: 'arrow', r: 8, mul: 0.8 }, desc: 'Пять стрел без промаха по всем врагам в 8 клетках' },
  ],
  monk: [
    { k: 'flurry', name: 'Шквал ударов', cd: 45, dur: 8, buf: { spd: 0.5 }, desc: '8 с: бьёт вдвое чаще' },
    { k: 'patience', name: 'Терпеливая оборона', cd: 45, lvl: 4, dur: 10, buf: { dodge: 0.4, red: 0.2 }, desc: '10 с: уходит от 40% ударов, остальные слабее на 20%' },
  ],
  priest: [
    { k: 'bless', name: 'Благословение', cd: 40, heal: 0.25, team: true, dur: 12, buf: { atk: 0.2 }, desc: '+25% здоровья себе и команде рядом, 12 с точность +20%' },
    { k: 'turn', name: 'Изгнание нежити', cd: 60, lvl: 4, turn: true, desc: 'Скелеты в 6 клетках рассыпаются (шанс растёт с уровнем), нечисть пятится' },
  ],
};
const ABIL_KEYS = ['KeyZ', 'KeyX'];
const kitOn = () => typeof hlOn === 'function' && hlOn();

function heroAbils(H) { return (H && HERO_ABIL[H.clsKey]) || null; }
function abReady(H, a) { return !((H.abCd || {})[a.k] > Game.time) && (H.level || 1) >= (a.lvl || 1); }
// сумма действующих усилений по ключу
function heroBuf(u, key) {
  const H = u && u.hero, as = heroAbils(H);
  if (!as || !H.abT) return 0;
  let s = 0;
  for (const a of as) if (a.buf && a.buf[key] && H.abT[a.k] > Game.time) s += a.buf[key];
  return s;
}

function heroUseAbility(i) {
  const h = Game.hero, H = h && h.hero, as = heroAbils(H);
  if (!kitOn() || !as || h.dead) return;
  const a = as[i];
  if (!a) return;
  if ((H.level || 1) < (a.lvl || 1)) { toast(`${a.name} — с ${a.lvl} уровня героя`); return; }
  if (!abReady(H, a)) return;
  if (H.stunUntil > Game.time) { toast(`${H.name} лежит — не до приёмов`); return; }
  const now = Game.time, col = (GCLS[H.clsKey] || {}).col || '#ffe070';
  if (a.shots || a.turn) {
    // нужны враги рядом — иначе приём не тратится
    const fs = foesNear(h.x, h.y, a.shots ? a.shots.r : 6);
    if (!fs.length) { floater(h.x, h.y - 1.6, 'Врагов рядом нет', '#e8e0c0'); return; }
    if (a.shots) {
      for (let n = 0; n < a.shots.n; n++) {
        const f = fs[n % fs.length], d = Math.hypot(f.o.x - h.x, f.o.y - h.y);
        G.shots.push({ kind: a.shots.kind, x: h.x, y: h.y - 0.7, f: { kind: f.kind, o: f.o, sure: a.shots.mul }, u: h, t: 0, dur: Math.max(0.25, d / 11) + n * 0.14 });
      }
      h.face = fs[0].o.x > h.x ? 1 : -1; h.vdir = 'E';
      h.hfx = { k: 'strike', t: now + 0.4 };
      sfxAt(a.shots.kind === 'arrow' ? 'thud' : 'chime', h.x * TILE, h.y * TILE, 0.7);
    } else {
      // изгнание нежити: скелеты рядом рассыпаются, ходячие деревья и камни пятятся
      let n = 0;
      for (const f of fs) {
        if (f.kind === 'skel' && Math.random() < 0.45 + 0.03 * H.level) { abForceKill(f, h); n++; }
        else if (f.kind === 'ent' && f.o.state === 'walk') { f.o.state = 'ghosted'; f.o.t = 0; f.o.gFrom = [h.x, h.y]; }
      }
      fxBurst(h.x * TILE, h.y * TILE - 14, 30, ['#fff6c0', '#ffe070', '#ffffff'], 120, 60, 1, 2, -20);
      floater(h.x, h.y - 2, n ? `Изгнано: ${n}` : 'Прочь, нежить!', '#fff2a0');
    }
  }
  if (a.heal) {
    const part = a.heal + 0.02 * ((H.level || 1) - 1);
    hlHeal(h, H.maxhp * part); h.injury = null;
    if (a.team) for (const m of Game.units) if (m.teamOf === h.id && Math.hypot(m.x - h.x, m.y - h.y) < 8) { m.injury = null; if (m.rec && m.rec.hp != null) m.rec.hp = Math.min(30 + 8 * m.rec.lvl, m.rec.hp + 15); }
    HL.fx.push({ kind: 'heal', x: h.x, y: h.y, t0: now, dur: 1.2 });
  }
  if (a.dur) (H.abT || (H.abT = {}))[a.k] = now + a.dur;
  if (a.next) H.abNext = a.next;
  (H.abCd || (H.abCd = {}))[a.k] = now + a.cd;
  KIT.fx.push({ k: a.k, u: h, t0: now, dur: a.dur || 1.2, col });
  floater(h.x, h.y - 1.9, a.name + '!', col);
  sfxAt('chime', h.x * TILE, h.y * TILE, 0.8);
  if (typeof track === 'function') track('abil-' + a.k, 'Способность героя: ' + a.name);
  updateUI(true);
}

// ---------- Значки способностей 12×12 (своя пиксельная графика) ----------
const ABIL_ICON = {
  wind: ['R:#e04a3a w:#fff6e0', '............', '.RRR....RRR.', 'RRRRR..RRRRR', 'RRRRRwwRRRRR', 'RRRRRwwRRRRR', 'RRRwwwwwwRRR', 'RRRwwwwwwRRR', '.RRRRwwRRRR.', '..RRRwwRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....'],
  surge: ['Y:#f6d458 o:#c89226', '.......YYYo.', '......YYYo..', '.....YYYo...', '....YYYo....', '...YYYYYYYo.', '..oooYYYYo..', '.....YYYo...', '....YYYo....', '...YYo......', '..YYo.......', '.Yo.........', '............'],
  rage: ['F:#c8302a O:#ff8a30 Y:#ffe070', '.....F......', '....FF......', '....FFF..F..', '...FFFF.FF..', '..FFFOFFFF..', '..FFOOOFFF..', '.FFOOYOOFFF.', '.FFOYYYOOFF.', '.FOOYYYYOFF.', '.FOYYYYYOOF.', '..FOYYYYOF..', '...FFFFFF...'],
  reckless: ['G:#c8ccd0 b:#8a5a30', 'GG........GG', 'GGG......GGG', 'GGGb....bGGG', '.G.bb..bb.G.', '....bbbb....', '.....bb.....', '....bbbb....', '...bb..bb...', '..bb....bb..', '.bb......bb.', 'bb........bb', 'b..........b'],
  missile: ['P:#a070ff W:#f4e8ff', '..P.....P...', '.PWP...PWP..', '..P.....P...', '............', '.....P......', '....PWP.....', '...PWWWP....', '....PWP.....', '.....P......', '..P.........', '.PWP........', '..P.........'],
  shield: ['B:#2c4a9a L:#7aa0ff W:#e8f0ff', '.BBBBBBBBBB.', 'BLLLLLLLLLLB', 'BLBBBBBBBBLB', 'BLBBBWWBBBLB', 'BLBBWBBWBBLB', 'BLBBBWWBBBLB', '.BLBBBBBBLB.', '.BLBBBBBBLB.', '..BLBBBBLB..', '...BLBBLB...', '....BLLB....', '.....BB.....'],
  wild: ['b:#7a4a24 p:#c89a70', '..bb....bb..', '.bppb..bppb.', '.bppb..bppb.', '..bb....bb..', 'bb........bb', 'bpb.bbbb.bpb', '.b.bbbbbb.b.', '..bbppppbb..', '..bppppppb..', '..bppppppb..', '...bppppb...', '....bbbb....'],
  mend: ['G:#5ab04a w:#f0fff0 b:#6a4a28', '........GG..', '......GGGG..', '....GGGGGG..', '...GGGwGGG..', '..GGGwwwGG..', '..GGGGwGGG..', '.GGGGGGGG...', '.GGGGGGG....', '.GGGGGG.....', '..GGG.......', '.b..........', 'b...........'],
  sneak: ['S:#8a909c W:#e8ecf0 g:#c89226 b:#3a2416', '..........SS', '.........SWS', '........SWS.', '.......SWS..', '......SWS...', '.....SWS....', '..g.SWS.....', '..ggWS......', '...gg.......', '..bbgg......', '.bb..g......', 'bb..........'],
  evade: ['W:#cfe8ff B:#7aa0c8', '............', '...WWWWW....', '..W.....B...', '........B...', '..WWWWWW....', '.W..........', '.W....WWWW..', '..BBBB....W.', '..........W.', '....WWWWWW..', '............', '............'],
  aimed: ['R:#c8302a W:#f4f0e4 Y:#f6d458', '....RRRR....', '..RRWWWWRR..', '.RWWRRRRWWR.', '.RWRRWWRRWR.', 'RWRRWRRWRRWR', 'RWRWRYYRWRWR', 'RWRWRYYRWRWR', 'RWRRWRRWRRWR', '.RWRRWWRRWR.', '.RWWRRRRWWR.', '..RRWWWWRR..', '....RRRR....'],
  volley: ['a:#a06840 H:#dcdcd4 r:#e04a3a', 'r...r...r...', '.a...a...a..', '..a...a...a.', '...a...a...a', '....H...H...', '...HHH.HHH..', '..r.........', '...a........', '....a.......', '.....a......', '......H.....', '.....HHH....'],
  flurry: ['F:#e4b08a w:#e8dcc0', '..FFFF..FFFF', '.FFFFFF.FFFF', '.FwwwwF.FwwF', '.FFFFFF.FFFF', '..FFFF...FF.', '............', 'FFFF..FFFF..', 'FFFFF.FFFFF.', 'FwwwF.FwwwF.', 'FFFFF.FFFFF.', '.FFF...FFF..', '............'],
  patience: ['P:#e8a0c0 p:#c86a9a G:#5a9a4a Y:#f6d458', '.....Y......', '....PPP.....', '..p.PPP.p...', '.pPPPPPPPp..', '..pPPPPPp...', '...pPPPp....', 'GGGGGGGGGGG.', '.GGGGGGGGG..', '............', '............', '............', '............'],
  bless: ['Y:#f6d458 W:#fff6c0', '.....Y......', '..Y..Y..Y...', '...Y.Y.Y....', '....YYY.....', 'YYYYYWYYYYY.', '....YYY.....', '...Y.Y.Y....', '..Y..Y..Y...', '.....Y......', '............', '............', '............'],
  turn: ['W:#e6dfc8 k:#2a2420 Y:#fff2a0', 'Y....YY....Y', '...WWWWWW...', '..WWWWWWWW..', '.WWWWWWWWWW.', '.WWkkWWkkWW.', '.WWkkWWkkWW.', '.WWWWkkWWWW.', '..WWWWWWWW..', '...WkWkWkW..', '...WWWWWW...', 'Y..........Y', '............'],
};
const ABIL_ICON_URL = {};
function abilIconURL(k) {
  if (ABIL_ICON_URL[k]) return ABIL_ICON_URL[k];
  const g = ABIL_ICON[k];
  if (!g || typeof document === 'undefined' || !document.createElement) return '';
  const pal = {};
  for (const p of g[0].split(' ')) { const [ch, col] = p.split(':'); pal[ch] = col; }
  const cv = mkCanvas(14, 14), c = cv.getContext('2d');
  const on = (x, y) => y >= 0 && y < 12 && x >= 0 && x < 12 && g[1 + y][x] !== '.';
  // тёмный контур вокруг силуэта — читается на любом фоне
  c.fillStyle = '#1a1008';
  for (let y = -1; y <= 12; y++) for (let x = -1; x <= 12; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) c.fillRect(x + 1, y + 1, 1, 1);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const ch = g[1 + y][x]; if (ch !== '.') { c.fillStyle = pal[ch] || '#fff'; c.fillRect(x + 1, y + 1, 1, 1); } }
  return (ABIL_ICON_URL[k] = cv.toDataURL());
}

// ---------- Значки вещей в рюкзаке: то же оружие, что в руке у героя ----------
{
  const _dgi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    const K = KIT_ITEMS[g];
    if (!K) return _dgi(c, g, x, y);
    c.save(); c.translate(x, y);
    const st = WPN_STYLE[K.w];
    if (K.w === 'wshield') { c.translate(8, 8); c.scale(1.5, 1.5); drawShield(c, 0, 0, 3.2, 3.9); }
    else if (st === 'bow') { c.translate(8, 8); c.scale(1.3, 1.3); drawBow(c, K.w, 0.6, 0, 0.78, null); }
    else if (st === 'fist') {
      c.translate(8, 8); c.scale(1.4, 1.4);
      for (const [fx, fy] of [[-2.2, 1.2], [2.2, -1.2]]) { ellipse(c, fx, fy, 2.4, 2.2, '#e4b08a'); for (const k of [-0.8, 0.5]) line(c, fx - 2.2, fy + k, fx + 2.2, fy + k, '#e8dcc0', 0.6); }
    } else {
      // клинки и древки — по диагонали снизу слева вверх направо
      const len = st === 'stab' ? 6 : st === 'heavy' ? 11 : st === 'staff' ? 13 : 10.5, sc = 18 / len;
      c.translate(3, 13); c.scale(sc * 0.72, sc * 0.72);
      const back = st === 'heavy' ? 3.4 : st === 'staff' ? 4.6 : 1.7;
      drawWeapon(c, K.w, back * 0.7071, -back * 0.7071, 0.7071, -0.7071);
    }
    c.restore();
  };
}

// ---------- Подключение: характеристики, удары, урон по герою ----------
const KIT = { fx: [], t: 0, hooked: false };

{
  // левая рука (щит, второй кинжал) тоже даёт бонус
  const _st = heroStats;
  heroStats = function (h) {
    const s = _st(h);
    const b = h && h.equip && GEAR_BONUS[h.equip.off];
    if (b) for (const k of ['str', 'agi', 'int', 'end']) if (b[k]) s[k] += b[k];
    return s;
  };
  // своё оружие первого уровня бьёт в полную силу, как оружие класса
  const _atk = heroAtk;
  heroAtk = function (u) {
    let p = _atk(u);
    const H = u.hero, w = H.equip && H.equip.weapon, o = H.equip && H.equip.off;
    if (kitMine(H, w)) p += KIT_ITEMS[w].atk * 0.5;
    if (o && GEAR_BONUS[o] && GEAR_BONUS[o].atk) p += GEAR_BONUS[o].atk;
    return Math.min(0.95, p);
  };
  const _def = heroDef;
  heroDef = function (u) { const o = u.hero.equip && GEAR_BONUS[u.hero.equip.off]; return _def(u) + (o && o.def ? o.def : 0); };
  // точность и урон под усилениями
  const _ua = unitAtk;
  unitAtk = function (u) { const a = _ua(u); return u.type === 'hero' && u.hero ? Math.min(0.97, a * (1 + heroBuf(u, 'atk'))) : a; };
  if (typeof neuDamageOf === 'function') {
    const _nd = neuDamageOf;
    neuDamageOf = function (u) { return _nd(u) * (u.type === 'hero' && u.hero ? 1 + heroBuf(u, 'dmg') : 1); };
  }

  // Крепость ночной нечисти в бою с героем и рекрутами: сколько попаданий держит скелет или ходячее дерево
  const foeHits = f => f.kind === 'skel' ? Math.max(1, Math.round(nightDiff() * 0.9)) : f.kind === 'ent' ? Math.max(1, Math.round(nightDiff())) : 1;
  const _kill = killFoe;
  killFoe = function (f, u) {
    const o = f && f.o;
    if (o && (f.kind === 'skel' || f.kind === 'ent') && !KIT.force) {
      if (o.nhp == null) o.nhp = foeHits(f);
      if (--o.nhp > 0) {
        floater(o.x, o.y - 1.8, `Держится! (${o.nhp})`, '#e8e0c0');
        fxBurst(o.x * TILE, o.y * TILE - 12, 8, f.kind === 'skel' ? ['#e6dfc8', '#c8c0a4'] : ['#8a6a3a', '#c8a070'], 55, 40, 0.5, 1.5, 200);
        sfxAt(f.kind === 'skel' ? 'rattle' : 'chop', o.x * TILE, o.y * TILE, 0.7);
        if (f.kind === 'ent') o.hitT = Game.time;
        return;
      }
    }
    _kill(f, u);
  };
  KIT.kill = killFoe;

  const _strike = strike;
  strike = function (u, f) {
    const H = u && u.type === 'hero' && u.hero;
    if (!H || !foeAlive(f)) return _strike(u, f);
    // без промаха: «скрытая атака», «меткий выстрел», искры и стрелы способностей
    const sure = f.sure || H.abNext || 0;
    if (sure) {
      if (!f.sure) H.abNext = 0;
      const o = f.o;
      floater(o.x, o.y - 2, sure >= 2 ? 'Точно в цель!' : 'В цель!', '#ffe070');
      if (f.kind === 'neu') neuHit(o, u, neuDamageOf(u) * sure * (0.9 + Math.random() * 0.2));
      else if (sure >= 2) abForceKill(f, u);
      else killFoe(f, u);
      if (f.sure) fxBurst(o.x * TILE, o.y * TILE - 12, 10, ['#c8a0ff', '#f4e8ff'], 60, 40, 0.5, 1.5, 120);
      return;
    }
    _strike(u, f);
    // поздней ночью нечисть отвечает и на попадания: чаще и больнее
    if (foeAlive(f) && (f.kind === 'skel' || f.kind === 'ent')) {
      const d = nightDiff(), C = GCLS[unitCls(u)];
      if (!(C && C.shot) && Math.random() < 0.1 * (d - 1)) heroHit(u, 3 + 2.5 * d, f.kind === 'skel' ? 'Скелет рубит!' : 'Ветвью наотмашь!');
    }
  };
}

// убить сразу, минуя «держится»
function abForceKill(f, u) { KIT.force = true; try { killFoe(f, u); } finally { KIT.force = false; } }

// Урон по герою от врагов: уклонение, щит, ослабление усилениями — и кадр «получил удар» / «парировал»
function heroDodge(u) {
  const H = u.hero;
  let p = heroBuf(u, 'dodge');
  if (H.equip && H.equip.off === 'woodShield') p += 0.08;      // щит иногда принимает удар на себя
  return Math.min(0.75, p);
}
function heroHit(u, n, say) {
  if (u.dead) return;
  if (Math.random() < heroDodge(u)) { heroParry(u); return; }
  n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
  if (say) floater(u.x, u.y - 2.1, say, '#ff9a80');
  if (typeof hlHurt === 'function' && kitOn()) { KIT.inHit = true; try { hlHurt(u, n, 'hit'); } finally { KIT.inHit = false; } }
  else if (u.hero.owner) { u.hero.hp = Math.max(0, u.hero.hp - n); floater(u.x, u.y - 1.8, '−' + Math.round(n), '#ff8a70'); }
  u.hfx = { k: 'hurt', t: Game.time + 0.35 };
}
function heroParry(u) {
  u.hfx = { k: 'parry', t: Game.time + 0.4 };
  floater(u.x, u.y - 1.9, u.hero.equip && u.hero.equip.off === 'woodShield' ? 'Щитом!' : 'Уклонился!', '#cfe8ff');
  fxBurst(u.x * TILE + (u.face || 1) * 6, u.y * TILE - 14, 6, ['#ffffff', '#cfe8ff'], 40, 20, 0.3, 1.3, 120);
  sfxAt('thud', u.x * TILE, u.y * TILE, 0.4);
}

{
  // удары нейтралов, скелетов (ответный удар в guilds.js) и прочие боевые раны: через уклонение и усиления
  if (typeof hlHurt === 'function') {
    const _hh = hlHurt;
    hlHurt = function (u, n, why) {
      if (why === 'hit' && u && u.hero && !KIT.inHit) {
        if (Math.random() < heroDodge(u)) { heroParry(u); return; }
        n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
        u.hfx = { k: 'hurt', t: Game.time + 0.35 };
      }
      KIT.inHit = true;
      try { _hh(u, n, why); } finally { KIT.inHit = false; }
    };
  }
  if (typeof neuHurtUnit === 'function') {
    const _nh = neuHurtUnit;
    neuHurtUnit = function (u, n) {
      if (u && u.hero && !u.dead) {
        if (Math.random() < heroDodge(u)) { heroParry(u); return; }
        n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
        if (n >= 1) u.hfx = { k: 'hurt', t: Game.time + 0.35 };
      }
      _nh(u, n);
    };
  }
  // увернулся от нейтрала сам (neutrals.js) — показать парирование
  if (typeof neuStrike === 'function') {
    const _ns = neuStrike;
    neuStrike = function (N, tg) {
      const hp = tg && tg.hero ? tg.hero.hp : null;
      _ns(N, tg);
      if (hp != null && tg.hero.hp === hp && !(tg.hfx && tg.hfx.t > Game.time)) tg.hfx = { k: 'parry', t: Game.time + 0.35 };
    };
  }

  // Анимация боя героя: выхватить оружие → замах → удар → довод → стойка … → победа
  const heroFightWrap = (inner, u, isAlive) => (function* () {
    const H = u.hero;
    const had = isAlive();
    if (!(u.combatUntil > Game.time) && had) { u.combatUntil = Game.time + 8; yield { wait: 0.32, anim: 'fdraw' }; }
    let r = inner.next(), after = 0;
    while (!r.done) {
      let v = r.value;
      u.combatUntil = Game.time + 8;
      if (v && v.wait != null && !v.walk) {
        const fast = 1 - Math.min(0.6, heroBuf(u, 'spd'));
        if (v.anim === 'chop' || v.anim === 'build') { v = Object.assign({}, v, { anim: 'fatk', wait: v.wait * fast }); after = 1; }
        else if (v.anim === 'duck') v = Object.assign({}, v, { anim: 'fparry' });
        else if (!v.anim) { v = Object.assign({}, v, { anim: after === 1 ? 'ffollow' : 'fready', wait: v.wait * fast }); after = 2; }
      }
      r = inner.next(yield v);
    }
    if (had && !isAlive() && !u.dead && !(H && H.hp <= 0) && !u.brk) {
      floater(u.x, u.y - 2, ['Ха!', 'Следующий!', 'Вот так!', 'За деревню!'][(Math.random() * 4) | 0], '#fff2a0');
      yield { wait: 1.3, anim: 'fwin' };
    }
  })();

  const _fg = fightGen;
  fightGen = function (u, f) {
    if (u.type !== 'hero' || !u.hero || !f || !f.kind) return _fg(u, f);
    return heroFightWrap(_fg(u, f), u, () => foeAlive(f));
  };
  // если героя затянуло в ночную драку как простого гнома — те же кадры
  if (typeof skelFightGen === 'function') {
    const _sf = skelFightGen;
    skelFightGen = function (u, s) { return u.type === 'hero' && u.hero ? heroFightWrap(_sf(u, s), u, () => s.state === 'fight' || s.state === 'roam') : _sf(u, s); };
  }
  if (typeof entFightGen === 'function') {
    const _ef = entFightGen;
    entFightGen = function (u, e) { return u.type === 'hero' && u.hero ? heroFightWrap(_ef(u, e), u, () => e.state === 'fight' || e.state === 'walk') : _ef(u, e); };
  }

  // своё оружие первого уровня надевается с первого раза
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'equip' && u.hero && u.hero.inv && u.hero.inv[c.slot] && kitMine(u.hero, u.hero.inv[c.slot].k) && typeof quickEquipGen === 'function') yield* quickEquipGen(u, c);
    else yield* _run(u, c);
  };

  // ускорение под способностями
  const _sm = teamSpeedMul;
  teamSpeedMul = function (u) { return _sm(u) * (u.type === 'hero' && heroBuf(u, 'regen') ? 1.1 : 1); };

  const _ab = heroAbility;
  heroAbility = function (k) {
    if (/^ab\d$/.test(k)) { heroUseAbility(+k.slice(2)); return; }
    if (k === 'uno') {
      const H = Game.hero && Game.hero.hero;
      if (H && H.equip.off) { if (hlAddItem(H, H.equip.off, 1)) { H.equip.off = null; updateUI(true); } else toast('Рюкзак полон'); }
      return;
    }
    _ab(k);
  };

  const _step = step;
  step = function (dt) { _step(dt); kitTick(dt); };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); KIT.fx.length = 0; };

  const _start = startGame;
  startGame = function () {
    _start();
    // клиент общей деревни: кадры «удар по нему / парировал» приходят вместе с жителями
    if (typeof COOP_UNIT_EX !== 'undefined' && !COOP_UNIT_EX.includes('hfx')) COOP_UNIT_EX.push('hfx');
    if (!KIT.keys && typeof window !== 'undefined' && window.addEventListener) {
      KIT.keys = true;
      window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const i = ABIL_KEYS.indexOf(e.code);
        if (i >= 0 && Game.hero) heroUseAbility(i);
      });
    }
  };

  // карточка героя: способности класса и левая рука
  const _hcu = heroCardUpdate;
  heroCardUpdate = function () {
    _hcu();
    const card = typeof document !== 'undefined' && document.getElementById && document.getElementById('hero-card');
    if (!card || card.style.display === 'none' || !Game.hero || !kitOn()) return;
    const H = Game.hero.hero;
    if (Mobile.on && !heroCardOpen) {
      // телефон, тонкая плашка: под ней строка из двух способностей (значок и название)
      const row = card.querySelector('.hc-row');
      if (!row) return;
      let el = card.querySelector('.hc-abm');
      if (!el) { el = document.createElement('div'); el.className = 'hc-abm'; row.after(el); el.dataset.h = ''; }
      const html = kitAbilButtons(H, true);
      if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
      return;
    }
    let el = card.querySelector('.hc-abil');
    if (!el) { el = document.createElement('div'); el.className = 'hc-abil'; const at = card.querySelector('.hc-guild') || card.querySelector('.tip'); at ? at.after(el) : card.appendChild(el); el.dataset.h = ''; }
    const html = kitAbilHTML(H);
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  };

  // в herolife.js панель строит строку «Оружие · Доспех»; левую руку добавляем рядом
  if (typeof heroPanel === 'function') {
    const _hp = heroPanel;
    const kitPanel = function () {
      let html = _hp();
      if (!kitOn()) return html;
      const H = Game.hero.hero;
      const off = H.equip.off ? `<div class="irow small"><span>Левая рука: <b>${hlName(H.equip.off)}</b></span> <button data-hero="uno" class="hp-sm">снять</button></div>` : '';
      if (off) html = html.replace(/(<div class="irow small">Оружие:[\s\S]*?<\/div>)/, `$1${off}`);
      return html;
    };
    heroPanel = kitPanel;
    const _sg = startGame;
    startGame = function () {
      _sg();
      const cur = heroPanel;
      if (cur !== kitPanel) heroPanel = function () { return (typeof Coop !== 'undefined' && Coop.on) ? cur() : kitPanel(); };
    };
  }

  // вспышки способностей поверх мира
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const t = Game.time;
    for (const f of KIT.fx) {
      const u = f.u;
      if (!u || u.dead || u.inside) continue;
      const p = Math.min(1, (t - f.t0) / Math.max(0.6, Math.min(1.2, f.dur))), px = u.x * TILE, py = u.y * TILE;
      c.save(); c.globalCompositeOperation = 'lighter';
      const rgb = hexRgbStr(f.col);
      if (f.dur > 1.3 && t - f.t0 > 1.2) {
        // идёт усиление: мерцающее кольцо у ног и искры
        const a = 0.35 + 0.15 * Math.sin(t * 7);
        c.strokeStyle = `rgba(${rgb},${a})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(px, py + 6, 11, 4.5, 0, 0, 7); c.stroke();
        if (Math.random() < 0.3) fxBurst(px + (Math.random() - 0.5) * 16, py - Math.random() * 20, 1, [f.col], 10, 20, 0.6, 1.2, -30);
      } else {
        c.strokeStyle = `rgba(${rgb},${0.8 * (1 - p)})`; c.lineWidth = 2;
        c.beginPath(); c.ellipse(px, py + 4, 6 + 20 * p, 2.5 + 8 * p, 0, 0, 7); c.stroke();
        glow(c, px, py - 12, 10 + 14 * p, rgb, 0.4 * (1 - p));
      }
      c.restore();
    }
  };
}

function hexRgbStr(hex) {
  const h = String(hex || '#ffe070').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function kitAbilButtons(H, mini) {
  const as = heroAbils(H);
  if (!as) return '';
  return as.map((a, i) => {
    const lock = (H.level || 1) < (a.lvl || 1), cd = Math.max(0, Math.ceil(((H.abCd || {})[a.k] || 0) - Game.time));
    const on = (H.abT || {})[a.k] > Game.time;
    const tip = `${a.name} (${ABIL_KEYS[i].slice(3)}): ${a.desc}. Перезарядка ${a.cd} с${a.lvl > 1 ? `, с ${a.lvl} уровня` : ''}`;
    const img = `<img src="${abilIconURL(a.k)}" alt="">`;
    if (mini) return `<button class="hp-ab hk-ab${on ? ' on' : ''}" data-hero="ab${i}" ${lock || cd ? 'disabled' : ''} title="${tip}">${img}<span>${lock ? `с ${a.lvl} ур.` : cd ? cd + ' с' : a.name}</span></button>`;
    return `<button class="hk-big${on ? ' on' : ''}" data-hero="ab${i}" ${lock || cd ? 'disabled' : ''} title="${tip}">${img}<span><b>${a.name}</b><small>${lock ? `с ${a.lvl} уровня` : cd ? `перезарядка ${cd} с` : on ? 'действует' : `${ABIL_KEYS[i].slice(3)} · ${a.desc}`}</small></span></button>`;
  }).join('');
}

function kitAbilHTML(H) {
  const C = GCLS[H.clsKey];
  if (!heroAbils(H)) return '<div class="irow small muted">Способности класса появятся, когда герой выучится в гильдии</div>';
  return `<div class="irow small muted">Способности: ${C ? C.name.toLowerCase() : ''}</div><div class="hk-list">${kitAbilButtons(H, false)}</div>`;
}

// ---------- Такт ----------

function kitTick(dt) {
  const now = Game.time;
  for (let i = KIT.fx.length - 1; i >= 0; i--) if (now - KIT.fx[i].t0 > KIT.fx[i].dur + 0.2) KIT.fx.splice(i, 1);
  // сервер общей деревни: кадры удара уходят игрокам; оружие класса — сразу в руках (рюкзака с надеванием там нет)
  if (typeof coop !== 'undefined' && coop.players) {
    if (!KIT.hooked && typeof COOP_UNIT_EX !== 'undefined') { KIT.hooked = true; if (!COOP_UNIT_EX.includes('hfx')) COOP_UNIT_EX.push('hfx'); }
    for (const u of coop.players.values()) {
      const H = u.hero, ks = H && KIT_OF[H.clsKey];
      if (!ks || H.kitEq === H.clsKey) continue;
      H.equip = H.equip || { weapon: null, armor: null };
      for (const k of ks) if (!H.equip[KIT_ITEMS[k].slot]) H.equip[KIT_ITEMS[k].slot] = k;
      H.kitEq = H.clsKey;
    }
  }
  const h = Game.hero;
  if (!kitOn() || !h || h.dead || !h.hero) return;
  const H = h.hero;
  // лечение под «Диким обликом»
  const rg = heroBuf(h, 'regen');
  if (rg && H.hp < H.maxhp) H.hp = Math.min(H.maxhp, H.hp + rg * dt);
  KIT.t += dt;
  if (KIT.t < 1) return;
  KIT.t = 0;
  // новый класс — новое оружие первого уровня в рюкзак (раз на класс; старые сохранения тоже получат)
  const ks = KIT_OF[H.clsKey];
  if (ks && H.mastery != null && !(H.kitGot || []).includes(H.clsKey)) {
    const free = H.inv.filter(s => !s).length;
    if (free < ks.length) { if (!KIT.fullT || now > KIT.fullT) { KIT.fullT = now + 60; toast(`${H.name}: освободите в рюкзаке ${ks.length} места — гильдия выдаст оружие`); } return; }
    for (const k of ks) hlAddItem(H, k, 1);
    (H.kitGot || (H.kitGot = [])).push(H.clsKey);
    const names = ks.map(k => KIT_ITEMS[k].name.toLowerCase()).join(' и ');
    toast(`${H.name} получил оружие ученика: ${names}. Кликните по вещи в рюкзаке, чтобы надеть (${ks.map(kitBonusText).join('; ')})`);
    logEvent('people', `${H.name} получил: ${names}`, h.x, h.y);
    floater(h.x, h.y - 2, 'Оружие ученика!', '#ffe070');
    updateUI(true);
  }
}

// стили: способности в карточке героя
if (typeof document !== 'undefined' && document.createElement && document.head && document.head.appendChild) {
  const st = document.createElement('style');
  st.textContent = `.hk-list{display:flex;flex-direction:column;gap:4px;margin:3px 0 6px}
  .hk-big{display:flex;align-items:center;gap:7px;text-align:left;padding:4px 7px;background:#2e2412;color:#f6e8c0;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font-size:12px;line-height:1.25}
  .hk-big img{width:28px;height:28px;image-rendering:pixelated;flex:none}
  .hk-big span{display:flex;flex-direction:column;min-width:0}.hk-big small{opacity:.75;font-size:10px}
  .hk-big:disabled{opacity:.5;cursor:default}.hk-big.on,.hk-ab.on{border-color:#f6d458;box-shadow:0 0 6px rgba(246,212,88,.5)}
  .hc-abm{display:flex;gap:4px;margin:3px 0 1px}
  #hero-card .hc-abm .hk-ab{flex:1;display:flex;flex-direction:row;align-items:center;gap:4px;min-height:24px;padding:1px 5px;font-size:10px;white-space:nowrap;overflow:hidden}
  .hk-ab img{width:18px;height:18px;image-rendering:pixelated;flex:none}`;
  document.head.appendChild(st);
}
