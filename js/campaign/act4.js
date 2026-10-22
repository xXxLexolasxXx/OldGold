'use strict';
// Кампания, акт 4 «Игра не стоит свеч» (КАМПАНИЯ.md §3): дорога на запад по дедовой карте. Колонна идёт от стоянки
// к стоянке, на стоянке зажигается большой костёр (у огня гоблины гномов не трогают), герой днём разведывает путь,
// а ночью отбивает погоню Шныря. На третью ночь приходит сам король. У межевого камня с зелёным огнём погоня
// останавливается: дальше — земли Малгора. «Игра не стоит свеч. Буквально — он их гасит.»
// Дальше — сценарий «Тишина дороже золота» (акт 5, js/campaign/act5.js) с наследием кампании.

const CAMP4 = {
  W: 160, H: 72, seed: 400400,
  start: [150, 36],
  camps: [[118, 38], [84, 34], [50, 38]],     // стоянки по дням
  scouts: [[100, 30], [66, 44], [34, 32]],    // куда днём ходит герой на разведку
  stone: [26, 36],                            // межевой камень с зелёным огнём
  spire: [7, 28],                             // Чёрный шпиль вдали
  border: 30,                                 // западнее этой x — земли Малгора
};

// ---------- Карта: дорога с востока на запад, пустошь → луга ----------

function camp4Map() {
  const { W, H } = CAMP4, m = meNew(W, H, 'meadow', 'Дорога на запад');
  m.seed = CAMP4.seed; m.nm = 'manual'; m.desc = 'Кампания, акт 4: дорога к Долине Старого Золота';
  const n1 = camp1Noise(51, 9), n2 = camp1Noise(52, 6), nf = camp1Noise(53, 7);
  const rnd = mulberry32(CAMP4.seed);
  const at = (x, y) => y * W + x;
  const roadY = x => 36 + Math.sin(x * 0.07) * 4 + Math.sin(x * 0.19) * 1.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (y < 6 + (n1(x, y) - 0.5) * 6 || y > H - 7 + (n2(x, y) - 0.5) * 5) m.t[i] = 2;
    const rv = Math.abs(y - (20 + x * 0.05)) < 1.2 && x > 60 && x < 78;      // ручей
    if (rv && Math.abs(y - roadY(x)) > 2) m.t[i] = 1;
    if (x < 6 && y > 20 && y < 40) m.t[i] = 2;                                                   // скала под шпилем
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (m.t[i] === 2 && rnd() < 0.05) m.c[i] = 1;
    if (m.t[i] !== 0 || Math.abs(y - roadY(x)) < 3) continue;
    if (CAMP4.camps.concat([CAMP4.start, CAMP4.stone]).some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 9)) continue;
    const f = nf(x, y), west = x < 90;                       // восток — пустошь, запад — луга с перелесками
    if ((west ? f > 0.5 : f > 0.74) && rnd() < 0.7) m.o[i] = rnd() < 0.25 ? 2 : 1;
    else if (!west && rnd() < 0.02) m.o[i] = 3;
  }
  m.start = CAMP4.start.slice();
  return m;
}

// ---------- Колонна, стоянки, погоня ----------

const camp4Ppl = () => Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter');
const camp4Near = (p, r) => camp4Ppl().filter(u => Math.hypot(u.x - p[0], u.y - p[1]) <= r).length;
const camp4Night = () => isNightNow() || isEveningNow();

function camp4Go(C, p) { campMarch(camp4Ppl(), p[0], p[1], 3); C.flags.goal = p.slice(); }

// стоянка: большой костёр (у огня налётчики гномов не видят), рядом — колонна
function camp4Camp(C, k) {
  if ((C.flags.fires || []).includes(k)) return;
  const [x, y] = CAMP4.camps[k];
  for (let r = 0; r < 6; r++) for (let a = 0; a < Math.max(1, r * 8); a++) {
    const xx = Math.round(x + Math.cos(a) * r), yy = Math.round(y - 3 + Math.sin(a) * r * 0.6);
    if (checkPlacement('bonfire', xx, yy, 0)) continue;
    placeBuilding('bonfire', xx, yy, true, 0);
    (C.flags.fires || (C.flags.fires = [])).push(k);
    return;
  }
}

function camp4Chase(C, n, champs, king) {
  const col = C.flags.goal || CAMP4.start;
  const x = Math.min(CAMP4.W - 4, col[0] + 26), y = col[1];
  for (let k = 0; k < n; k++) campFoe('goblin', x + (k % 3), y - 2 + (k % 5), 'chase', { delay: k * 0.6, hunt: true });
  for (let k = 0; k < champs; k++) campFoe('goblinChamp', x + 2, y + k * 2, 'chase', { delay: 2 + k, hunt: true });
  if (king && !C.flags.kingOut) {
    C.flags.kingOut = 1;
    const N = campFoe('shnyr', x + 3, y, 'chase', { delay: 3, hunt: true });
    N.boss = 1;
  }
  if (typeof sfxAt === 'function') sfxAt('goblinCry', x * TILE, y * TILE, 1);
}

// король Шнырь в бою: крепок, но, получив своё, удирает (до межевого камня он ещё нужен)
if (typeof FSPEC !== 'undefined') {
  FSPEC.shnyr = { name: 'Король Шнырь Пороховой', mhp: 260, dmg: [6, 11], cd: 1.7, rng: 1.8, spd: 2.2, parry: 0.25, xp: 260, sz: 10,
    drop: [['gold', 6, 1]], draw: (c, N) => campDrawGoblin(c, N, 'shnyrKing'), ai: campGoblinAi,
    bar: (c, N, px, py) => { if (N.hp < N.mhp - 0.5) foeDrawBar(c, N, px, py - 62, true); } };
}

function camp4DrawStone(c) {
  const t = Game.time, [sx, sy] = CAMP4.stone, x = Math.round(sx * TILE + 16), y = Math.round(sy * TILE + 26);
  c.fillStyle = 'rgba(10,8,4,0.35)'; c.beginPath(); c.ellipse(x, y + 1, 12, 3.5, 0, 0, 7); c.fill();
  c.fillStyle = '#4a4a5a'; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 7, y - 26); c.lineTo(x, y - 32); c.lineTo(x + 7, y - 27); c.lineTo(x + 9, y); c.closePath(); c.fill();
  c.fillStyle = '#6a6a7e'; c.beginPath(); c.moveTo(x - 7, y - 26); c.lineTo(x, y - 32); c.lineTo(x - 1, y - 2); c.lineTo(x - 8, y); c.closePath(); c.fill();
  c.strokeStyle = '#9cf06a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y - 20); c.lineTo(x + 3, y - 14); c.moveTo(x + 3, y - 20); c.lineTo(x - 3, y - 14); c.stroke();   // знак
  // зелёный огонь на вершине: 5 кадров по времени
  const f = (t * 10 | 0) % 5, hs = [9, 11, 8, 12, 10][f];
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(120,255,90,0.35)'; c.beginPath(); c.ellipse(x, y - 36, 9, 12, 0, 0, 7); c.fill();
  c.fillStyle = '#9cf06a'; c.beginPath(); c.moveTo(x - 4, y - 32); c.quadraticCurveTo(x - 3 + f % 2, y - 32 - hs, x, y - 34 - hs); c.quadraticCurveTo(x + 3, y - 32 - hs * 0.6, x + 4, y - 32); c.closePath(); c.fill();
  c.fillStyle = '#e8ffc8'; c.fillRect(x - 1, y - 36, 2, 3);
  c.restore();
}

function camp4DrawSpire(c) {
  if (typeof foeTowerSprite !== 'function') return;
  const spr = foeTowerSprite(false), [sx, sy] = CAMP4.spire, t = Game.time;
  const ox = Math.round(sx * TILE - spr.cx), oy = Math.round(sy * TILE - spr.base);
  c.save(); c.globalAlpha = 0.85; c.drawImage(spr.cv, ox, oy); c.restore();
  c.save(); c.globalCompositeOperation = 'lighter';
  (spr.wins || []).forEach(([wx, wy, w, h], i) => { c.fillStyle = `rgba(150,255,100,${0.5 + 0.3 * Math.sin(t * 1.7 + i)})`; c.fillRect(ox + wx - w / 2, oy + wy - h / 2, w, h); });
  c.restore();
}

// ---------- Сценарий ----------

const camp4Leg = () => campProg().legacy || {};

CAMP_ACTS[4] = {
  id: 4, name: 'Игра не стоит свеч', seed: CAMP4.seed, map: camp4Map,
  outro: 'Погоня осталась у межевого камня. Впереди — Долина Старого Золота и башня с зелёными окнами.',
  setup(C) {
    const L = camp4Leg(), want = Math.max(8, Math.min(50, (L.a2 && L.a2.saved) || 20));
    const [sx, sy] = CAMP4.start, extra = ['serf', 'farmer', 'baker', 'builder', 'woodcutter', 'serf', 'brewer', 'stonemason'];
    for (let k = 0; campPeople() < want && k < 60; k++) { const s = randomFreeNear(sx, sy + 2, 1, 8); if (s) spawnUnit(extra[k % extra.length], s[0], s[1]); }
    for (let i = Game.units.length - 1; i >= 0 && campPeople() > want; i--) { const u = Game.units[i]; if (u.type === 'serf') { Game.units.splice(i, 1); Game.unitMap.delete(u.id); if (u.releaseOcc) u.releaseOcc(); } }
    if (L.a2 && L.a2.vaska) { const s = randomFreeNear(sx + 2, sy, 0, 6); if (s) { const u = spawnUnit('smelter', s[0], s[1]); if (u) u.cname = 'Васька'; } }
    const store = Game.buildings.find(b => b.type === 'storehouse');
    const gift = (L.a3 && L.a3.gift) || {};
    Object.assign(store.stock, { bread: 20 + (gift.bread || 0), stone: 10 + (gift.stone || 0), timber: 10, sausage: 6 });
    C.flags.lost0 = Game.lostGnomes || 0;
    C.flags.resp = L.a3 ? L.a3.resp : 0;
  },
  tick(C) {
    C.lost = Math.max(0, (Game.lostGnomes || 0) - (C.flags.lost0 || 0));
    // король, получив своё, удирает на восток — вернётся к межевому камню
    for (const N of campFoes('chase')) if (N.k === 'shnyr' && N.hp < N.mhp * 0.35 && !C.flags.kingFled) {
      C.flags.kingFled = 1; N.st = 'vanish'; N.vt = 0;
      floater(N.x, N.y - 3, 'Ай-ай! Не по-королевски!', '#ffe080');
    }
  },
  fail(C) { return campPeople() < 1 ? 'Колонна не дошла: в живых никого.' : null; },
  stars(C, S) { return 1 + (S.alive >= 18 ? 1 : 0) + ((C.flags.found || 0) >= 3 ? 1 : 0); },
  legacy(C, S) { return { a4: { arrived: S.alive, kingHit: !!C.flags.kingFled, found: C.flags.found || 0 } }; },
  legacyText(C) { return `до Долины дошли ${campPeople()} гномов — их и припасы обоза ждёт сценарий «Тишина дороже золота».`; },
  draw(list, c, x0, y0, x1, y1) {
    const [sx, sy] = CAMP4.stone, [px, py] = CAMP4.spire;
    if (sx > x0 - 3 && sx < x1 + 3 && sy > y0 - 3 && sy < y1 + 4) list.push([sy + 0.9, () => camp4DrawStone(c)]);
    if (px > x0 - 6 && px < x1 + 6 && py > y0 - 12 && py < y1 + 4) list.push([py + 0.5, () => camp4DrawSpire(c)]);
  },
  steps: [
    { k: 'cut', pause: true, cam: [140, 36], label: 'Дорога на запад', lines: [
      ['note', 'Дедова карта нарисована дедовой рукой: горы — треугольниками, реки — червячками, а Долина — большим жирным крестом.'],
      ['grum', 'Идём на запад. Три ночёвки — и мы на месте. Если крест не врёт.'],
      ['pim', 'Налево у сухого дуба, потом прямо до камня с огоньком. Я… читал.'],
      ['yagla', 'Пим, у тебя всё «читал». Ты что, и про нас читал, пока мы не пришли?'],
      ['pim', 'Ха-ха. Нет, конечно. Пошли?'],
    ] },
    { k: 'do', fn(C) { camp4Go(C, CAMP4.camps[0]); } },
    { k: 'check' },
    // ---- день 1
    { k: 'goal', label: 'День первый: в пути', hint: 'Колонна идёт сама. Герой — на разведку вперёд.',
      init(C) { if (!C.flags.march) camp4Go(C, CAMP4.camps[0]); },
      objs: [
        { id: 'camp', t: 'Дойти до первой стоянки', at: CAMP4.camps[0], need: 1, cur: () => (camp4Near(CAMP4.camps[0], 7) >= camp4Ppl().length * 0.8 ? 1 : 0) },
        { id: 'scout', t: 'Герой: разведать дорогу', zone: CAMP4.scouts[0].concat(2.6) },
      ] },
    { k: 'say', fx(C) { camp4Camp(C, 0); C.flags.found = (C.flags.found || 0) + 1; }, lines: [
      ['note', 'У дороги — старый верстовой камень. На нём клеймо: фонарь в круге.'],
      ['grum', 'Клеймо Фонарщиков. Сто лет назад они ставили такие вдоль всей дороги, чтобы гномы не плутали в темноте.'],
      ['grum', 'Слышишь, правнук? Это твои. Хорошо ставили — до сих пор стоит.'],
    ] },
    { k: 'wait', label: 'Стоянка у костра', until: () => camp4Night() },
    { k: 'do', fn(C) { if (!C.flags.n1) { C.flags.n1 = 1; camp4Chase(C, 5, 0, false); } } },
    { k: 'say', lines: [['grum', 'Погоня! Все к костру — у огня они нас не видят. Герой — встречай гостей.']] },
    { k: 'goal', label: 'Ночь первая', objs: [{ id: 'n1', t: 'Отбить погоню', cur: () => (campFoes('chase').length ? 0 : 1) }] },
    { k: 'wait', label: 'Ночь первая', until: () => !camp4Night() },
    // ---- день 2
    { k: 'do', fn(C) { camp4Go(C, CAMP4.camps[1]); } },
    { k: 'goal', label: 'День второй: в пути',
      init(C) { if (!C.flags.goal || C.flags.goal[0] !== CAMP4.camps[1][0]) camp4Go(C, CAMP4.camps[1]); },
      objs: [
        { id: 'camp', t: 'Дойти до второй стоянки', at: CAMP4.camps[1], cur: () => (camp4Near(CAMP4.camps[1], 7) >= camp4Ppl().length * 0.8 ? 1 : 0) },
        { id: 'scout', t: 'Герой: разведать брошенный лагерь', zone: CAMP4.scouts[1].concat(2.6) },
      ] },
    { k: 'say', fx(C) {
      camp4Camp(C, 1); C.flags.found = (C.flags.found || 0) + 1;
      const s = Game.buildings.find(b => b.type === 'storehouse' && !b.removed); if (s) s.stock.gold = (s.stock.gold || 0) + 10;
    }, lines: [
      ['note', 'В перелеске — заросший лагерь: обручи от бочек, ржавый котелок и истлевшая записка.'],
      ['yagla', '«Идём в горы. Долину оставляем Фонарщикам. Вернёмся, когда будет можно». Почерк прадеда Грума.'],
      ['grum', 'Сто лет «можно» не наступало. Ну что ж. Наступило без спросу. В котелке — десяток монет: прадед знал, что мы вернёмся.'],
    ] },
    { k: 'wait', label: 'Стоянка у костра', until: () => camp4Night() },
    { k: 'do', fn(C) { if (!C.flags.n2) { C.flags.n2 = 1; camp4Chase(C, 7, 1, false); } } },
    { k: 'goal', label: 'Ночь вторая', objs: [{ id: 'n2', t: 'Отбить погоню (с чемпионом)', cur: () => (campFoes('chase').length ? 0 : 1) }] },
    { k: 'wait', label: 'Ночь вторая', until: () => !camp4Night() },
    // ---- день 3
    { k: 'do', fn(C) { camp4Go(C, CAMP4.camps[2]); } },
    { k: 'goal', label: 'День третий: в пути',
      init(C) { if (!C.flags.goal || C.flags.goal[0] !== CAMP4.camps[2][0]) camp4Go(C, CAMP4.camps[2]); },
      objs: [
        { id: 'camp', t: 'Дойти до третьей стоянки', at: CAMP4.camps[2], cur: () => (camp4Near(CAMP4.camps[2], 7) >= camp4Ppl().length * 0.8 ? 1 : 0) },
        { id: 'scout', t: 'Герой: посмотреть, что за камень с огоньком', zone: CAMP4.scouts[2].concat(2.6) },
      ] },
    { k: 'say', fx(C) { camp4Camp(C, 2); C.flags.found = (C.flags.found || 0) + 1; }, lines: [
      ['note', 'Впереди, у самой дороги — межевой камень. На вершине горит огонь. Зелёный.'],
      ['grum', 'Огонь зелёный. Дрова, что ли, такие?'],
      ['pim', 'Это… граница. Дальше — чужие земли. Но там свободно. Совсем свободно. Я читал.'],
    ] },
    { k: 'wait', label: 'Последняя стоянка', until: () => camp4Night() },
    { k: 'do', fn(C) { if (!C.flags.n3) { C.flags.n3 = 1; camp4Chase(C, 8, 2, true); } } },
    { k: 'cut', cam: [64, 38], label: 'Ночь третья', lines: [
      ['shnyr', 'Бородатые! Король лично пришёл попрощаться! С фейерверком!'],
      ['grum', 'Сам Шнырь. В короне. На королевскую взбучку тоже, значит, лично.'],
    ] },
    { k: 'goal', label: 'Ночь третья', hint: 'Король крепок, но трусоват: поколотите его — удерёт.',
      objs: [{ id: 'n3', t: 'Отбить короля Шныря и его свиту', cur: () => (campFoes('chase').length ? 0 : 1) }] },
    { k: 'wait', label: 'Ночь третья', until: () => !camp4Night() },
    // ---- к межевому камню
    { k: 'do', fn(C) {
      camp4Go(C, [CAMP4.stone[0] - 2, CAMP4.stone[1] + 2]);
      if (!C.flags.last) { C.flags.last = 1; camp4Chase(C, 6, 1, false); C.flags.kingOut = 0; camp4Chase(C, 0, 0, true); }
    } },
    { k: 'goal', label: 'Межевой камень', hint: 'Погоня за спиной. Колонна — за камень, на запад.',
      objs: [{ id: 'cross', t: 'Довести колонну за межевой камень', at: CAMP4.stone, cur: () => (camp4Ppl().filter(u => u.x < CAMP4.border).length >= camp4Ppl().length * 0.8 ? 1 : 0) }],
      during() {
        // погоня у черты владений встаёт как вкопанная
        for (const N of campFoes('chase')) if (N.x < CAMP4.border + 8) N.halt = 1;
      } },
    { k: 'cut', pause: true, cam: [32, 36], fx(C) {
      for (const N of campFoes('chase')) N.halt = 1;
      C.flags.shnyrEnd = 1;
    }, lines: [
      ['note', 'Гоблины выбежали к камню — и встали. Даже самые глупые. Особенно самые глупые.'],
      ['shnyr', 'Стоять! Там Малгор. Игра не стоит свеч.'],
      ['gob', 'Каких свеч, ваше величество?'],
      ['shnyr', 'Любых. Буквально — он их гасит. Разворачиваемся!'],
      ['mrak', '…Шум. Опять шум.'],
      ['grum', 'Слыхали? Кто-то там не спит. Ну да ладно.'],
      ['grum', 'Земля свободна. Подозрительно свободна.'],
    ] },
    { k: 'do', fn(C) { for (const N of campFoes('chase')) { N.st = 'vanish'; N.vt = 0; } campMarchStop(); } },
    { k: 'end' },
  ],
};
