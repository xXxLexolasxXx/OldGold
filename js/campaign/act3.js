'use strict';
// Кампания, акт 3 «Гости и рыба» (КАМПАНИЯ.md §3): беглецы из Подгорья у Кремнёвки — деревни гномов-соседей в предгорьях.
// Хозяйка Кремнёвки, старейшина Жмыха, пускает «на три дня». Игрок по сценарию строит маленькую деревню на пустом склоне
// за речкой (ресурсов в обрез), а дрязги с хозяевами решаются выборами — они двигают «Уважение Кремнёвки» (−5…+5).
// День 1: обустроиться, «Чья это борода», «Ягла поёт чужие песни». День 2: хозяйство, дуэль с Кремнем-младшим,
// «Общий колодец»; ночью гоблины Шныря выходят на след и бьют по Кремнёвке. Утро 3-го дня: «Пим пишет и про них»,
// развязка по уважению, Грум вспоминает дедову карту — путь в Долину Старого Золота.
// Здания Кремнёвки — чужие (b.foreign): стоят, но не работают и не принимают грузы; снос чужого дома — обида.

const CAMP3 = {
  W: 128, H: 96, seed: 300300,
  start: [34, 54],             // лагерь беглецов на склоне
  krem: [96, 50],              // центр Кремнёвки
  ford: [70, 50],              // брод через речку
  raid: [118, 20],             // откуда ночью приходят гоблины
  build: [['house', 3], ['woodcutter', 1], ['farm', 1], ['bakery', 1], ['well', 1]],
};

// ---------- Карта: предгорья, речка с бродом, лес на западе ----------

function camp3Map() {
  const { W, H } = CAMP3, m = meNew(W, H, 'mountain', 'Кремнёвка');
  m.seed = CAMP3.seed; m.nm = 'manual'; m.desc = 'Кампания, акт 3: предгорья у Кремнёвки';
  const n1 = camp1Noise(41, 8), n2 = camp1Noise(42, 5), nf = camp1Noise(43, 7);
  const rnd = mulberry32(CAMP3.seed);
  const at = (x, y) => y * W + x;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    const top = 9 + Math.sin(x * 0.11) * 3 + (n1(x, y) - 0.5) * 6, bot = H - 7 - (n2(x, y) - 0.5) * 4;
    if (y < top || y > bot || x < 3 || x > W - 4) m.t[i] = 2;
    const rx = 70 + Math.sin(y * 0.12) * 4;
    if (Math.abs(x - rx) < 1.3 && Math.abs(y - CAMP3.ford[1]) > 2 && m.t[i] === 0) m.t[i] = 1;     // речка с бродом
    const lx = (x - 104) / 7, ly = (y - 78) / 4;
    if (lx * lx + ly * ly < 1) m.t[i] = 1;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = at(x, y);
    if (m.t[i] === 2 && rnd() < 0.06) m.c[i] = 1;
    if (m.t[i] !== 0) continue;
    const near = (cx, cy, r) => Math.hypot(x - cx, y - cy) < r;
    if (near(...CAMP3.start, 12) || near(...CAMP3.krem, 16) || Math.abs(y - CAMP3.ford[1]) < 2 && x > 40 && x < 90) continue;
    const f = nf(x, y);
    if ((x < 24 ? f > 0.3 : f > 0.62) && rnd() < 0.75) m.o[i] = rnd() < 0.2 ? 2 : 1;
  }
  for (const [cx, cy, r] of [[22, 20, 3], [48, 18, 2.5], [40, 80, 2.5]]) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const i = at(x, y);
      if (m.t[i] === 0 && Math.hypot(x - cx, y - cy) <= r && rnd() < 0.8) m.o[i] = 3;
    }
  }
  m.start = CAMP3.start.slice();
  return m;
}

// ---------- Кремнёвка ----------

const CAMP3_KREM = [['library', 96, 44], ['inn', 104, 52], ['house', 88, 44], ['house', 88, 54], ['house', 104, 42], ['house', 92, 58],
  ['house', 100, 60], ['farm', 112, 46], ['mill', 84, 48], ['bakery', 110, 56], ['well', 96, 54], ['swine', 84, 60]];

function camp3Krem(C) {
  const [kx, ky] = CAMP3.krem;
  for (let x = kx - 14; x <= kx + 16; x++) if (canPlaceRoad(x, ky)) setRoad(x, ky, true);
  for (let y = ky - 10; y <= ky + 10; y++) if (canPlaceRoad(kx, y)) setRoad(kx, y, true);
  for (let x = CAMP3.ford[0] - 6; x < kx - 14; x++) if (canPlaceRoad(x, ky)) setRoad(x, ky, true);   // дорога к броду
  const out = [];
  for (const [type, ax, ay] of CAMP3_KREM) {
    if (!BUILDINGS[type]) continue;
    let b = null;
    for (let r = 0; r < 10 && !b; r++) for (let k = 0; k < Math.max(1, r * 8) && !b; k++) {
      const a = k / Math.max(1, r * 8) * Math.PI * 2, x = Math.round(ax + Math.cos(a) * r), y = Math.round(ay + Math.sin(a) * r * 0.8);
      if (!inb(x, y) || checkPlacement(type, x, y, 0)) continue;
      b = placeBuilding(type, x, y, true, 0);
    }
    if (!b) continue;
    b.foreign = 1; b.paused = true;
    if (b.def.worker) b.worker = { dead: false, home: b, inside: null, type: b.def.worker, look: 3, x: b.doorX, y: b.doorY, foreign: 1 };   // свой мастер у хозяев — наших работников не берут
    out.push(b);
  }
  const hall = out.find(b => b.type === 'library'), inn = out.find(b => b.type === 'inn');
  C.flags.zh = hall ? [hall.doorX + 1.6, hall.doorY + 1.2] : [kx, ky - 2];
  C.flags.kr = inn ? [inn.doorX - 1.4, inn.doorY + 1.4] : [kx + 6, ky + 2];
  C.flags.kremN = out.length;
}

// кремнёвцы ходят от дома к дому (только вид): маршруты строятся один раз по поиску пути и в сейв не идут
const CAMP3_KV = { C: null, n: -1, list: [] };
const CAMP3_KV_SPD = 1.1, CAMP3_KV_STAY = 4;   // клеток в секунду; секунд у двери
function camp3KvRoutes(C) {
  const homes = Game.buildings.filter(b => b.foreign && !b.removed && b.state === 'done');
  if (CAMP3_KV.C === C && CAMP3_KV.n === homes.length) return CAMP3_KV.list;
  const rnd = mulberry32(CAMP3.seed ^ 0x5EED), list = [];
  const stop = b => randomFreeNear(b.doorX, b.doorY + 1, 0, 3) || null;
  for (let v = 0; v < 6 && homes.length >= 3; v++) {
    const pick = [];
    while (pick.length < 3) { const b = homes[rnd() * homes.length | 0]; if (!pick.includes(b)) pick.push(b); }
    const stops = pick.map(stop);
    if (stops.some(s => !s)) continue;
    const segs = [];
    for (let k = 0; k < stops.length; k++) {
      const a = stops[k], b = stops[(k + 1) % stops.length], p = findPath(a[0], a[1], b[0], b[1]);
      if (!p || !p.length) { segs.length = 0; break; }
      segs.push([a].concat(p));
    }
    if (!segs.length) continue;
    const T = segs.reduce((s, p) => s + (p.length - 1) / CAMP3_KV_SPD + CAMP3_KV_STAY, 0);
    list.push({ v, segs, T, off: rnd() * T });
  }
  Object.assign(CAMP3_KV, { C, n: homes.length, list });
  return list;
}
// где кремнёвец сейчас: [x, y, фаза шага, идёт влево] — время раскладывается на стоянку и ходьбу по отрезкам пути
function camp3KvAt(r) {
  let t = (Game.time + r.off) % r.T;
  for (const p of r.segs) {
    if (t < CAMP3_KV_STAY) return [p[0][0], p[0][1], 0, r.v % 2 === 1];
    t -= CAMP3_KV_STAY;
    const len = (p.length - 1) / CAMP3_KV_SPD;
    if (t < len) {
      const q = t * CAMP3_KV_SPD, i = Math.min(p.length - 2, q | 0), f = q - i, a = p[i], b = p[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (q * 4 | 0) & 3, b[0] < a[0] || (b[0] === a[0] && r.v % 2 === 1)];
    }
    t -= len;
  }
  const e = r.segs[0][0];
  return [e[0], e[1], 0, false];
}

// беглецы: сколько дошло до перевала в акте 2 (наследие), кузнец Васька — если спасли
function camp3People(C) {
  const leg = (campProg().legacy || {}).a2 || {}, want = Math.max(8, Math.min(50, leg.saved || 20));
  C.flags.from2 = leg.saved || 0;
  const [sx, sy] = CAMP3.start;
  const extra = ['serf', 'farmer', 'baker', 'serf', 'builder', 'woodcutter', 'serf', 'brewer'];
  for (let k = 0; campPeople() < want && k < 60; k++) { const s = randomFreeNear(sx, sy + 2, 1, 8); if (s) spawnUnit(extra[k % extra.length], s[0], s[1]); }
  for (let i = Game.units.length - 1; i >= 0 && campPeople() > want; i--) {
    const u = Game.units[i];
    if (u.type !== 'serf') continue;
    Game.units.splice(i, 1); Game.unitMap.delete(u.id); if (u.releaseOcc) u.releaseOcc();
  }
  if (leg.vaska) { const s = randomFreeNear(sx + 3, sy + 2, 0, 6); if (s) { const u = spawnUnit('smelter', s[0], s[1]); if (u) u.cname = 'Васька'; } }
}

// ресурсов в обрез: ровно на сценарную стройку и чуть сверху; хлеб — что донесли из Подгорья
function camp3Stock() {
  const st = { timber: 4, stone: 3, trunk: 6, wheat: 10, gold: 10 };
  for (const [t, n] of CAMP3.build) for (const [g, v] of Object.entries((BUILDINGS[t] && BUILDINGS[t].cost) || {})) st[g] = (st[g] || 0) + v * n;
  st.bread = Math.max(8, ((campProg().legacy || {}).a2 || {}).bread || 12);
  return st;
}

const camp3Built = t => Game.buildings.filter(b => b.type === t && b.state === 'done' && !b.removed && !b.foreign).length;
const camp3Resp = (C, d) => { C.flags.resp = Math.max(-5, Math.min(5, (C.flags.resp || 0) + d)); if (d) floater(CAMP3.krem[0], CAMP3.krem[1] - 3, (d > 0 ? '+' : '') + d + ' уважения', d > 0 ? '#a8e080' : '#f08a6a'); };
const camp3Night = () => isNightNow() || isEveningNow();

// Кремень-младший: дуэль до «сдаюсь» — бьёт только героя
if (typeof FSPEC !== 'undefined') {
  FSPEC.kremen = { name: 'Кремень-младший', mhp: 140, dmg: [2, 4], cd: 1.6, rng: 1.4, spd: 2.1, parry: 0.15, xp: 60, sz: 10, drop: [],
    draw: (c, N) => { if (typeof campNpcSprite === 'function') { const s = campNpcSprite('kremen', 0); c.drawImage(s, -20, -44); } },
    ai(N, dt) { const h = campHero(); if (h && !h.dead) { N.tg = h.id; N.hunt = true; N.prov = Game.time; } rdMelee(N, dt); } };
}

CAMP_ACTS[3] = {
  id: 3, name: 'Гости и рыба', seed: CAMP3.seed, map: camp3Map,
  outro: 'Кремнёвка осталась позади. Впереди — дедова карта и дорога, которую никто не ходил сто лет.',
  setup(C) {
    camp3Krem(C);
    camp3People(C);
    const store = Game.buildings.find(b => b.type === 'storehouse' && !b.foreign);
    if (store) Object.assign(store.stock, this.stock = camp3Stock());
    C.flags.resp = 0; C.flags.lost0 = Game.lostGnomes || 0;
    C.meter = { key: 'resp', label: 'Уважение Кремнёвки' };
  },
  tick(C) {
    C.lost = Math.max(0, (Game.lostGnomes || 0) - (C.flags.lost0 || 0));
    // чужое не трогаем: остановленное — обратно на паузу; снесённое — обида (один раз за дом)
    for (const b of Game.buildings) if (b.foreign && !b.paused) b.paused = true;
    const kn = Game.buildings.filter(b => b.foreign && !b.removed).length;
    if (kn < (C.flags.kremN || 0)) { camp3Resp(C, -2 * (C.flags.kremN - kn)); C.flags.kremN = kn; campSay('Вы снесли дом Кремнёвки. Хозяева этого не забудут.'); }
    // дуэль: Кремень сдаётся, когда силы на исходе
    for (const N of campFoes('duel')) if (N.hp < N.mhp * 0.3 && !C.flags.duelWon) {
      C.flags.duelWon = 1; N.st = 'vanish'; N.vt = 0;
      floater(N.x, N.y - 2.5, 'Сдаюсь! Сдаюсь!', '#ffe080');
    }
    if (C.flags.duel && !C.flags.duelWon && C.flags.duelOn && !campFoes('duel').length) C.flags.duelWon = 1;
  },
  fail(C) { return campPeople() < 1 ? 'Беглецов из Подгорья не осталось.' : null; },
  stars(C) {
    const all = CAMP3.build.every(([t, n]) => camp3Built(t) >= n);
    return 1 + ((C.flags.resp || 0) >= 3 ? 1 : 0) + (all && C.flags.duelWon ? 1 : 0);
  },
  legacy(C) {
    const r = C.flags.resp || 0;
    return { a3: { resp: r, gift: r >= 3 ? { bread: 20, stone: 20, trade: 1 } : r >= 1 ? { bread: 20 } : {} } };
  },
  legacyText(C) {
    const r = C.flags.resp || 0;
    return r >= 3 ? 'Кремнёвка дарит в дорогу хлеб и камень и обещает торговать.' : r >= 1 ? 'Кремнёвка дарит в дорогу хлеб.' : 'Кремнёвка проводила вас без подарков.';
  },
  draw(list, c, x0, y0, x1, y1) {
    const C = Game.camp, F = C.flags;
    const npc = (k, p) => { if (p && p[0] > x0 - 2 && p[0] < x1 + 2 && p[1] > y0 - 2 && p[1] < y1 + 3) list.push([p[1] + 0.95, () => campDrawNpc(c, k, p[0], p[1])]); };
    npc('zhmykha', F.zh);
    if (!F.duelOn || F.duelWon) npc('kremen', F.kr);
    // хозяева ходят по деревне днём; вечером и ночью сидят по домам
    if (typeof campDrawKvAt === 'function' && !camp3Night() && Math.abs(CAMP3.krem[0] - (x0 + x1) / 2) < (x1 - x0) / 2 + 20)
      for (const r of camp3KvRoutes(C)) {
        const [x, y, ph, flip] = camp3KvAt(r);
        if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 3) list.push([y + 0.9, () => campDrawKvAt(c, r.v, ph, x, y, flip)]);
      }
  },
  steps: [
    { k: 'cut', pause: true, cam: [90, 50], label: 'Приют', lines: [
      ['note', 'Третий день пути. За речкой — Кремнёвка: дымки, огороды и очень недоверчивые занавески.'],
      ['zhmykha', 'Подгорные? Слыхали. Гости как рыба: на третий день начинают пахнуть. Вас тут, правда, целая толпа. Это много рыбы.'],
      ['grum', 'Нам бы угол на три дня. Мы тихие. Почти.'],
      ['zhmykha', 'Склон за речкой — ваш. Наше — не трогать. И гребни наши тоже.'],
      ['yagla', 'Гребни? Какие гребни?'],
      ['zhmykha', 'Узнаете.'],
    ] },
    { k: 'check' },
    { k: 'goal', label: 'День первый: обустроиться', hint: 'Ресурсов в обрез — ровно на сценарную стройку. Дома — меню «Основа». Чужое (за речкой) не сносить.',
      objs: [
        { id: 'house', t: 'Поставить дома', need: 3, cur: () => camp3Built('house') },
        { id: 'wood', t: 'Дом лесоруба', cur: () => camp3Built('woodcutter') },
      ] },
    { k: 'choice', id: 'comb', who: 'zhmykha', t: 'Чья это борода?',
      text: 'У Кремня-старшего пропал гребень для бороды — серебряный, дедовский. Видели, как наш трудяга крутился у их бани.',
      opts: [
        { t: 'Устроить честный розыск', fx: C => camp3Resp(C, 1), out: 'Гребень нашёлся… в бороде у самого Кремня-старшего. Все неловко посмеялись, Кремнёвка оттаяла.' },
        { t: 'Откупиться: 5 золота', fx: C => { const s = Game.buildings.find(b => b.type === 'storehouse' && !b.foreign); if (s) s.stock.gold = Math.max(0, (s.stock.gold || 0) - 5); camp3Resp(C, 1); }, out: 'Жмыха взяла золото и сказала, что гребень, конечно, найдётся. Нашёлся. Сразу.' },
        { t: 'Мы не брали — и точка', def: 1, fx: C => camp3Resp(C, -1), out: 'Кремнёвцы обиделись. Гребень потом нашёлся, но осадочек остался.' },
      ] },
    { k: 'wait', label: 'День первый: до вечера', until: () => camp3Night() },
    { k: 'choice', id: 'songs', who: 'yagla', t: 'Ягла поёт чужие песни',
      text: 'Бабушка Ягла у общего костра запела старую кремнёвскую песню — только слова у неё подгорные. Половина Кремнёвки слушает, половина хмурится.',
      opts: [
        { t: 'Пусть поёт — песни у гномов общие', fx: C => camp3Resp(C, 1), out: 'К третьему куплету подпевала и Жмыха. Фальшиво, но от души.' },
        { t: 'Попросить спеть нашу, про гору', def: 1, out: 'Ягла спела про Брюзгу. Плакали все, даже Кремень-младший — хотя потом говорил, что дым в глаза.' },
        { t: 'Разогнать посиделки — завтра работать', fx: C => camp3Resp(C, -1), out: 'Костёр затоптали. Кремнёвка решила, что подгорные — зануды.' },
      ] },
    { k: 'wait', label: 'Ночь в гостях', until: () => !camp3Night() },
    { k: 'goal', label: 'День второй: хозяйство', hint: 'Ферма, пекарня и колодец — меню «Еда» и «Основа».',
      objs: [
        { id: 'farm', t: 'Ферма', cur: () => camp3Built('farm') },
        { id: 'bakery', t: 'Пекарня', cur: () => camp3Built('bakery') },
        { id: 'well', t: 'Свой колодец', cur: () => camp3Built('well') },
      ],
      or: () => camp3Night() },
    { k: 'choice', id: 'duel', who: 'kremen', t: 'Кремень зовёт на дуэль',
      text: 'Кремень-младший стучит кулаком по столу: «Пусть ваш герой выйдет против меня. По-честному, до первого „сдаюсь“!»',
      opts: [
        { t: 'Принять вызов', fx: C => { C.flags.duel = 1; }, out: 'Площадь затихла. Кремень разминает кулаки размером с булыжник.' },
        { t: 'Отказаться', def: 1, fx: C => camp3Resp(C, -1), out: 'Кремень обозвал героя «подгорной поганкой». Кремнёвка хихикала до вечера.' },
      ] },
    { k: 'goal', label: 'Дуэль', when: C => !!C.flags.duel, hint: 'Кликните героем по Кремню. Бой до «сдаюсь» — никто не погибнет.',
      init(C) { if (!C.flags.duelOn) { C.flags.duelOn = 1; const [x, y] = C.flags.kr; campFoe('kremen', x, y + 1, 'duel', { hunt: true }); } },
      objs: [{ id: 'duel', t: 'Победить Кремня в честном бою', at: CAMP3.krem, cur: C => (C.flags.duelWon ? 1 : 0) }],
      after(C) { camp3Resp(C, 2); } },
    { k: 'say', when: C => !!C.flags.duelWon, lines: [
      ['kremen', 'Ладно, подгорный. Кулак у тебя есть. Мозгов не видно, но кулак — есть.'],
      ['grum', 'У нас это называется «комплимент». Принимаем.'],
    ] },
    { k: 'choice', id: 'well', who: 'zhmykha', t: 'Общий колодец',
      text: 'Кремнёвцы ворчат: подгорные вёдра у их колодца с утра до ночи, а очередь — до самой бани.',
      opts: [
        { t: 'Ходить только к своему колодцу', fx: C => camp3Resp(C, camp3Built('well') ? 1 : 0), out: 'Свой колодец — свои вёдра. Кремнёвцы одобрительно кивают — у кого он есть.' },
        { t: 'Ходить по очереди', def: 1, out: 'Очередь у колодца — лучшее место для сплетен. Теперь все знают всё. Даже лишнее.' },
        { t: 'Брать сколько надо', fx: C => camp3Resp(C, -1), out: 'Вода общая, обида — тоже. Особенно обида.' },
      ] },
    { k: 'wait', label: 'День второй: до вечера', until: () => camp3Night() },
    { k: 'check' },
    { k: 'do', fn(C) {
      if (C.flags.raid) return;
      C.flags.raid = 1;
      const [rx, ry] = CAMP3.raid;
      for (let k = 0; k < 6; k++) campFoe('goblin', rx + (k % 3) - 1, ry + (k / 3 | 0), 'kraid', { delay: k * 0.7, hunt: true });
      campFoe('goblinChamp', rx, ry + 2, 'kraid', { delay: 3, hunt: true });
      if (typeof campSnd === 'function') campSnd('gobHorn', rx, ry, 1.2);
    } },
    { k: 'cut', cam: [100, 40], label: 'Набег на Кремнёвку', lines: [
      ['zhmykha', 'Гоблины! К нам?! Мы сто лет никого не трогали — даже соседей, хотя очень хотелось!'],
      ['grum', 'Это не к вам. Это за нами. Шнырь не отстал.'],
      ['grum', 'Герой — за речку! Гостю положено отплатить за ночлег. Хотя бы гоблинами.'],
    ] },
    { k: 'goal', label: 'Набег на Кремнёвку', hint: 'Гоблины идут на Кремнёвку с северо-востока. Брод — посередине речки.',
      objs: [{ id: 'kraid', t: 'Отбить гоблинов от Кремнёвки', at: CAMP3.krem, cur: () => (campFoes('kraid').length ? 0 : 1) }],
      after(C) { camp3Resp(C, 2); } },
    { k: 'wait', label: 'Ночь после набега', until: () => !camp3Night() },
    { k: 'choice', id: 'pim', who: 'zhmykha', t: 'Пим пишет и про них',
      text: 'Жмыха нашла летопись Пима. Там и про Кремнёвку: кто сколько ест, кто храпит и где у кого погреб. «Сжечь!» — требует она, размахивая половником.',
      opts: [
        { t: 'Сжечь эту страницу', fx: C => camp3Resp(C, 1), out: 'Пим вырвал страницу сам — очень аккуратно, будто у него была ещё одна такая же.' },
        { t: 'Пусть Пим прочтёт её вслух', def: 1, out: 'Пим прочёл. Храпящие обиделись, остальные хохотали так, что проснулись храпящие.' },
        { t: 'Летопись не трогать', fx: C => camp3Resp(C, -1), out: 'Жмыха унесла половник и обиду. Половник потом вернула.' },
      ] },
    { k: 'cut', pause: true, cam: [70, 50], when: C => (C.flags.resp || 0) >= 2, label: 'Третье утро', lines: [
      ['zhmykha', 'Ну вот что, подгорные. Рыба вы, конечно, но… свежая. Оставайтесь. Место найдём.'],
      ['grum', 'Спасибо, Жмыха. Но гоблины пришли за нами — и придут ещё. Не хочу, чтобы Кремнёвка горела из-за нас.'],
    ] },
    { k: 'cut', pause: true, cam: [70, 50], when: C => (C.flags.resp || 0) < 2 && (C.flags.resp || 0) > -3, label: 'Третье утро', lines: [
      ['zhmykha', 'Три дня прошло. Гости — как рыба. Сами знаете.'],
      ['grum', 'Знаем. И гоблины, похоже, знают, где нас искать. Уходим.'],
    ] },
    { k: 'cut', pause: true, cam: [70, 50], when: C => (C.flags.resp || 0) <= -3, label: 'Третье утро', lines: [
      ['zhmykha', 'Вон! С гребнями, с песнями, с гоблинами — вон! Чтоб к полудню и духу не было!'],
      ['grum', 'Уходим, уходим. Без завтрака, видимо.'],
    ] },
    { k: 'say', lines: [
      ['yagla', 'Куда же теперь, Грум? Гор больше нет, соседи — такие.'],
      ['grum', 'Дед говорил про долину. Долину Старого Золота — откуда наши прадеды ушли сто лет назад. Карта где-то… а, вот она. В сапоге.'],
      ['pim', 'Долина Старого Золота? Я, кажется, знаю дорогу. Читал. В архиве.'],
      ['yagla', 'Пим, сынок, ты везде читал.'],
      ['grum', 'Тогда пойдёшь первым. С картой. И с летописью — на всякий случай.'],
    ] },
    { k: 'end' },
  ],
};
