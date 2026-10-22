'use strict';
// Кампания, акт 2 «Гора ложится» (КАМПАНИЯ.md §3): то же Подгорье наутро после взрыва — трещины, валуны, рухнувшие дома.
// Сборы под таймером «гора держится»: откопать кузнеца Ваську (его сторожат ожившие глыбы), запасти хлеба в дорогу,
// расчистить завал у школы, проститься с Таном. Потом гора ложится: волна обвала идёт с севера на юг, рушит дома
// и засыпает всех, кто не успел; колонна бежит к Южным воротам, а в тоннеле ждёт засада гоблинов Шныря.
// Карта и город — как в акте 1 (camp1Map, camp1Town), руины накладываются поверх. Жителей — сколько спаслось в акте 1.

const CAMP2 = {
  vaska: [50, 31],             // кузнец под завалом (у северной стены)
  exit: [64, 92],              // выход тоннеля — Узкий перевал
  ambush: [64, 85],            // засада в тоннеле
  timer: 720,                  // столько секунд гора держится на сборах
  waveSpd: 0.32,               // скорость обвала, клеток в секунду
  waveY0: 14, waveEnd: 88,
  bread: 30,
};

// ---------- Руины ----------

function camp2Ruins(C) {
  const rnd = mulberry32(CAMP1.seed ^ 0x2A2A);
  // трещины в каждом доме, северные дома рухнули
  for (const b of Game.buildings.slice()) {
    if (b.removed || b.type === 'storehouse' || b.type === 'school' || b.type === 'inn') continue;
    if (b.type === 'house' && b.y < 52 && rnd() < 0.6) { (C.flags.ruins || (C.flags.ruins = [])).push([b.x, b.y, b.w, b.h, (b.x + b.y) % 3]); removeBuilding(b); continue; }
    b.dmg = Math.min(0.8, 0.2 + rnd() * 0.45); b.dzFix = 1;
  }
  // валуны по северному кварталу и у кузнеца
  const busy = new Set(Game.units.map(u => idx(Math.floor(u.x), Math.floor(u.y))));
  let n = 0;
  for (let tries = 0; tries < 3000 && n < 70; tries++) {
    const x = 20 + (rnd() * 88 | 0), y = 22 + (rnd() * 26 | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || World.obj[i] || busy.has(i)) continue;
    setStone(i, 2 + (rnd() * 3 | 0)); n++;
  }
  // завал у школы: валуны вокруг входа
  const sc = Game.buildings.find(b => b.type === 'school' && !b.removed);
  C.flags.school = sc ? [sc.doorX, sc.doorY + 1] : CAMP1.start.slice();
  let k = 0;
  for (let r = 2; r <= 4 && k < 7; r++) for (let a = 0; a < 12 && k < 7; a++) {
    const x = Math.round(C.flags.school[0] + Math.cos(a * 0.52) * r), y = Math.round(C.flags.school[1] + Math.sin(a * 0.52) * r * 0.7);
    if (!inb(x, y)) continue;
    const i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || World.obj[i] || busy.has(i)) continue;
    setStone(i, 2); k++;
  }
  C.flags.rubble0 = k;
  // каменная «клетка» вокруг кузнеца
  const [vx, vy] = CAMP2.vaska;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2 || dy === 2 && dx === 0) continue;
    const i = idx(vx + dx, vy + dy);
    if (World.terrain[i] === T_GRASS && !World.bmap[i] && !World.road[i]) setStone(i, 3);
  }
  for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) { const i = idx(vx + dx, vy + dy); if (World.obj[i] && World.obj[i].t === 'stone') World.obj[i] = null; }
}

// жителей столько, сколько вывел из праздника игрок (наследие акта 1); лишних трудяг не будет
function camp2Trim(C) {
  const leg = campProg().legacy || {}, want = Math.max(15, Math.min(60, leg.a1 ? leg.a1.alive : 40));
  C.flags.from1 = leg.a1 ? leg.a1.alive : 0;
  const order = ['serf', 'builder', 'goat'];
  for (const t of order) for (let i = Game.units.length - 1; i >= 0 && campPeople() > want; i--) {
    const u = Game.units[i];
    if (u.type !== t || u.dead) continue;
    Game.units.splice(i, 1); Game.unitMap.delete(u.id); if (u.releaseOcc) u.releaseOcc();
  }
}

function camp2StonesNear(p, r) {
  let n = 0;
  for (let y = Math.floor(p[1] - r); y <= p[1] + r; y++) for (let x = Math.floor(p[0] - r); x <= p[0] + r; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'stone' && Math.hypot(x - p[0], y - p[1]) <= r) n++;
  }
  return n;
}

// ---------- Волна обвала ----------

function camp2WaveTick(C, dt) {
  const W = C.flags.wave;
  if (!W || W.y >= CAMP2.waveEnd) return;
  W.y = Math.min(CAMP2.waveEnd, W.y + dt * CAMP2.waveSpd);
  C.tilt = Math.min(0.32, 0.12 + (W.y - CAMP2.waveY0) / (CAMP2.waveEnd - CAMP2.waveY0) * 0.2);
  W.tk = (W.tk || 0) + dt;
  if (W.tk < 0.5) return;
  W.tk = 0;
  const y = W.y;
  if (Math.random() < 0.5 && typeof campSnd === 'function') campSnd('campRockfall', null, y, 0.9);
  // дома, оказавшиеся под волной, проваливаются
  for (const b of Game.buildings.slice()) {
    if (b.removed || b.y + b.h > y) continue;
    fxBurst((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 26, ['#8a7a6a', '#5a4a3a', '#c8b898', '#3a3028'], 90, 80, 1.2, 3, 160);
    removeBuilding(b);
  }
  // кто не успел — засыпало; герой выскакивает из-под камней
  for (const u of Game.units) {
    if (u.dead || !isPerson(u) || u.y > y - 0.4) continue;
    if (u.type === 'hero') { u.x = Math.min(MAP_W - 2, Math.max(1, u.x)); u.y = y + 2; u.proc = null; u.action = null; floater(u.x, u.y - 2, 'Еле успел!', '#ffd070'); continue; }
    floater(u.x, u.y - 1.5, 'Засыпало!', '#c8b898');
    removeUnit(u);
    C.flags.buried = (C.flags.buried || 0) + 1;
  }
  for (const N of Game.raiders) if (N.st !== 'die' && N.y < y - 0.4) { N.st = 'vanish'; N.vt = 0; }
  // за волной — груды камня
  for (let k = 0; k < 6; k++) {
    const x = 8 + (Math.random() * (MAP_W - 16) | 0), yy = Math.floor(y - 1 - Math.random() * 2), i = idx(x, yy);
    if (inb(x, yy) && World.terrain[i] === T_GRASS && !World.bmap[i] && !World.obj[i]) setStone(i, 3);
  }
}

function camp2DrawWave(c, x0, y0, x1, y1) {
  const W = Game.camp.flags.wave;
  if (!W) return;
  const t = Game.time, yw = W.y * TILE;
  if (y0 * TILE > yw + 40) return;
  // за волной — сплошная осыпь
  c.fillStyle = 'rgba(34,28,24,0.88)';
  c.fillRect(x0 * TILE - 64, y0 * TILE - 64, (x1 - x0 + 4) * TILE, Math.max(0, yw - y0 * TILE + 64 - 10));
  // фронт волны: клубы пыли и падающие камни
  for (let x = x0 - 2; x <= x1 + 2; x++) {
    const h = Math.sin(x * 1.7 + t * 2.1) * 6 + Math.sin(x * 0.6 - t * 1.3) * 5;
    c.fillStyle = `rgba(120,108,92,${0.55 + Math.sin(x + t * 3) * 0.12})`;
    c.beginPath(); c.ellipse(x * TILE + 16, yw - 6 + h, 26, 16, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(70,60,50,0.9)';
    const fy = (t * 140 + x * 37) % 60;
    c.fillRect(x * TILE + ((x * 13) % 24), yw - 60 + fy, 4, 4);
  }
}

// ---------- Ожившие глыбы и кузнец ----------

if (typeof FSPEC !== 'undefined') {
  FSPEC.rockling = { name: 'Ожившая глыба', mhp: 36, dmg: [3, 6], cd: 1.8, rng: 1.4, spd: 1.3, parry: 0.2, xp: 36, sz: 9,
    drop: [['stone', 2, 1], ['ironore', 1, 0.4]], draw: (c, N) => camp2DrawRockling(c, N), ai: campGoblinAi };
}
function camp2DrawRockling(c, N) {
  const t = Game.time, atk = N.st === 'atk' ? Math.sin(Math.min(1, N.atkT / 0.4) * Math.PI) : 0;
  const bob = N.st === 'chase' ? Math.abs(Math.sin(t * 8 + N.id)) * 2 : 0;
  c.fillStyle = '#4a4440'; c.fillRect(-6, -4 - bob, 3, 4); c.fillRect(3, -4 - bob, 3, 4);              // ножки-обломки
  c.fillStyle = '#6a625a';
  c.beginPath(); c.moveTo(-9, -6 - bob); c.lineTo(-7, -16 - bob); c.lineTo(-1, -20 - bob); c.lineTo(6, -17 - bob); c.lineTo(9 + atk * 3, -9 - bob); c.lineTo(5, -4 - bob); c.lineTo(-6, -4 - bob); c.closePath(); c.fill();
  c.fillStyle = '#8a8278'; c.beginPath(); c.moveTo(-7, -15 - bob); c.lineTo(-1, -19 - bob); c.lineTo(4, -16 - bob); c.lineTo(-2, -12 - bob); c.closePath(); c.fill();
  c.strokeStyle = '#2a2420'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, -18 - bob); c.lineTo(0, -12 - bob); c.lineTo(-2, -7 - bob); c.stroke();
  c.fillStyle = N.st === 'die' ? '#4a3a2a' : '#ffb040';
  c.fillRect(1, -14 - bob, 2, 2); c.fillRect(5, -13 - bob, 2, 2);                                          // глаза-угольки
  if (N.st !== 'die') { c.globalAlpha = 0.35; c.fillRect(0, -15 - bob, 8, 4); c.globalAlpha = 1; }
}

function camp2Vaska(C) {
  if (C.flags.vaska) return;
  C.flags.vaska = 1;
  const [vx, vy] = CAMP2.vaska;
  for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) { const i = idx(vx + dx, vy + dy); if (inb(vx + dx, vy + dy) && World.obj[i] && World.obj[i].t === 'stone') World.obj[i] = null; }
  const u = spawnUnit('smelter', vx, vy + 1);
  if (u) u.cname = 'Васька';
  floater(vx, vy - 1, 'Васька спасён!', '#ffe080');
  fxBurst((vx + 0.5) * TILE, vy * TILE, 20, ['#8a7a6a', '#c8b898'], 80, 60, 1, 2.6, 160);
}

// ---------- Сценарий ----------

const camp2Exit = () => Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.y >= CAMP2.exit[1] - 3 && Math.abs(u.x - CAMP2.exit[0]) < 6).length;

CAMP_ACTS[2] = {
  id: 2, name: 'Гора ложится', seed: CAMP1.seed, map: () => Object.assign(camp1Map(), { name: 'Подгорье: руины', desc: 'Кампания, акт 2: Подгорье после взрыва' }),
  tiltY: 40, tiltX: CAMP1.mine[0],
  stock: { bread: 8, flour: 12, wheat: 40, timber: 30, stone: 30, trunk: 30, sausage: 6, gold: 20 },
  cave: { shafts: C => CAMP1.shafts.concat(CAMP1.cracks).filter(s => !C.flags.wave || s[1] > C.flags.wave.y + 2) },
  outro: 'Гора Брюзга легла. Подгорья больше нет — есть те, кто из него вышел.',
  setup(C) {
    camp1Town(C);
    const store = Game.buildings.find(b => b.type === 'storehouse');
    Object.assign(store.stock, this.stock);
    camp2Ruins(C);
    camp2Trim(C);
    C.tilt = CAMP1_TILT;
    C.flags.lost0 = Game.lostGnomes || 0;
    const [vx, vy] = CAMP2.vaska;
    for (let k = 0; k < 3; k++) campFoe('rockling', vx - 2 + k * 2, vy + 3.5, 'rock', { hold: true });
    const h = campHero();
    if (h) { const s = randomFreeNear(CAMP1.start[0] + 2, CAMP1.start[1] + 2, 0, 5) || CAMP1.start; h.x = s[0] + 0.5; h.y = s[1] + 0.5; }
  },
  onLoad(C) {
    if (!C.flags.vaska && !campFoes('rock').length && !C.flags.march) { const [vx, vy] = CAMP2.vaska; for (let k = 0; k < 3; k++) campFoe('rockling', vx - 2 + k * 2, vy + 3.5, 'rock', { hold: true }); }
  },
  tick(C, dt) {
    C.lost = Math.max(0, (Game.lostGnomes || 0) - (C.flags.lost0 || 0));
    camp2WaveTick(C, dt);
    // кузнец: глыбы разбиты и герой у завала — откапывают
    if (!C.flags.vaska && !campFoes('rock').length && campIn(campHero(), CAMP2.vaska.concat(3))) camp2Vaska(C);
  },
  fail(C) {
    if (campPeople() < 1) return 'Под горой не осталось никого.';
    if (C.flags.wave && C.flags.wave.y >= CAMP2.waveEnd - 0.5 && !camp2Exit()) return 'Гора легла, а до перевала не дошёл никто.';
    return null;
  },
  stars(C) { return 1 + ((C.flags.saved || 0) >= 20 ? 1 : 0) + (C.flags.vaska && !(C.flags.missed || []).length ? 1 : 0); },
  legacy(C) { return { a2: { saved: C.flags.saved || camp2Exit(), bread: C.flags.breadOut || 0, vaska: !!C.flags.vaska } }; },
  legacyText(C) { return `до перевала дошли ${C.flags.saved || 0} гномов` + (C.flags.vaska ? ', с ними кузнец Васька' : '') + `; хлеба в дорогу — ${C.flags.breadOut || 0}.`; },
  draw(list, c, x0, y0, x1, y1) {
    const C = Game.camp;
    const hall = C.flags.hall;
    if (hall && !C.flags.tanGone && hall[0] > x0 - 2 && hall[0] < x1 + 2 && hall[1] > y0 - 2 && hall[1] < y1 + 3) list.push([hall[1] + 0.95, () => campDrawNpc(c, 'tan', hall[0] + 1.6, hall[1] + 0.2)]);
    if (!C.flags.vaska) { const [vx, vy] = CAMP2.vaska; if (vx > x0 - 2 && vx < x1 + 2 && vy > y0 - 2 && vy < y1 + 3) list.push([vy + 0.9, () => campDrawNpc(c, 'vaska', vx, vy)]); }
    for (const m of C.flags.shrooms || []) if (m[0] > x0 - 1 && m[0] < x1 + 1 && m[1] > y0 - 1 && m[1] < y1 + 2 && (!C.flags.wave || m[1] > C.flags.wave.y)) list.push([m[1], () => caveDrawShroom(c, m)]);
    // руины рухнувших домов: пока на их месте ничего не построили и их не накрыл обвал
    if (typeof campDrawRuin === 'function') for (const r of C.flags.ruins || []) {
      if (r[0] + r[2] < x0 - 1 || r[0] > x1 + 1 || r[1] > y1 + 2 || r[1] + r[3] < y0 - 2 || (C.flags.wave && C.flags.wave.y > r[1] + r[3])) continue;
      let built = false;
      for (let y = r[1]; y < r[1] + r[3] && !built; y++) for (let x = r[0]; x < r[0] + r[2]; x++) if (inb(x, y) && World.bmap[idx(x, y)]) { built = true; break; }
      if (!built) list.push([r[1] + r[3] - 0.2, () => campDrawRuin(c, r)]);
    }
    if (C.flags.wave) list.push([C.flags.wave.y + 0.5, () => camp2DrawWave(c, x0, y0, x1, y1)]);
  },
  steps: [
    { k: 'cut', pause: true, cam: [64, 36], label: 'Утро после', lines: [
      ['note', 'Утро. Гора скрипит так, будто кто-то медленно открывает очень большую дверь.'],
      ['tan', 'Слушайте все! Гора стоит, но недолго. Берём хлеб, инструменты и друг друга. Уходим через Южные ворота.'],
      ['grum', 'Кузнеца Ваську завалило у северной стены. Без кузнеца на новом месте мы — просто бородатые туристы.'],
      ['pim', 'Я запишу: «ушли организованно».'],
      ['grum', 'Запиши: «ушли быстро». Это важнее.'],
    ] },
    { k: 'do', fn(C) { if (!C.timer) C.timer = { t: Game.time + CAMP2.timer, label: 'Гора держится' }; } },
    { k: 'check' },
    { k: 'goal', label: 'Сборы', hint: 'Глыбы бьёт герой (клик по ним). Валуны у школы разбивает герой или каменотёсы. Хлеб пекут мельница и пекарня.',
      objs: [
        { id: 'vaska', t: 'Откопать кузнеца Ваську', at: CAMP2.vaska, cur: C => (C.flags.vaska ? 1 : 0) },
        { id: 'bread', t: 'Запасти хлеба в дорогу', need: CAMP2.bread, cur: () => campStock('bread') },
        { id: 'rubble', t: 'Расчистить завал у школы', need: 1, cur: C => (camp2StonesNear(C.flags.school, 4.5) ? 0 : 1) },
        { id: 'tan', t: 'Герой: проститься с Таном', zone: C => C.flags.hall.concat(2.4) },
      ],
      during(C) { for (const N of campFoes('rock')) if (N.hold) { const h = campHero(); if (h && Math.hypot(h.x - N.x, h.y - N.y) < 6) { N.hold = 0; N.tg = h.id; N.prov = Game.time; } } },
      or: C => Game.time >= C.timer.t },
    { k: 'say', fx(C) { C.flags.breadOut = campStock('bread'); }, lines: [
      ['tan', 'Ну, ступайте. Таны уходят последними — а я ещё и самый медленный.'],
      ['grum', 'Тан, гора вот-вот…'],
      ['tan', 'Знаю, Грум. Я с ней сто лет прожил — дай попрощаться по-человечески. То есть по-гномьи.'],
    ] },
    { k: 'cut', cam: [64, 26], min: 4, label: 'Гора ложится', fx(C) {
      C.flags.tanGone = 1;
      C.timer = null;
      if (!C.flags.wave) C.flags.wave = { y: CAMP2.waveY0 };
      C.vfx = { t: Game.time, dur: 8, amp: 9 };
      if (typeof campSnd === 'function') { campSnd('campBoom', 64, 20, 1.1); campSnd('campRockfall', null, 20, 1.2); }
    }, lines: [
      ['note', 'Свод застонал, и гора начала складываться — ряд за рядом, с севера на юг.'],
      ['grum', 'БЕГОМ! Все к Южным воротам! Не оглядываться — гора за нами не гонится, она просто падает!'],
    ] },
    { k: 'goal', label: 'Бегство', hint: 'Колонна идёт сама. Герой — вперёд, в тоннель: там засада.',
      init(C, s) {
        if (!C.flags.ambush) { C.flags.ambush = 1; const [ax, ay] = CAMP2.ambush; for (let k = 0; k < 4; k++) campFoe('goblin', ax - 2 + k * 1.3, ay + (k % 2), 'amb', { hold: true }); campFoe('goblinChamp', ax, ay + 2, 'amb', { hold: true }); }
        const ppl = Game.units.filter(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter');
        campMarch(ppl, CAMP2.exit[0], CAMP2.exit[1], 2);
        C.flags.need = Math.max(1, Math.min(12, ppl.length));
      },
      objs: [
        { id: 'amb', t: 'Разбить засаду в тоннеле', at: CAMP2.ambush, cur: () => (campFoes('amb').length ? 0 : 1) },
        { id: 'out', t: 'Вывести гномов к перевалу', need: 12, cur: C => Math.min(C.flags.need || 12, camp2Exit()) },
      ],
      during(C) {
        this.objs[1].need = C.flags.need || 12;
        // засада просыпается, когда к ней подходят
        for (const N of campFoes('amb')) if (N.hold) for (const u of Game.units) if (!u.dead && isPerson(u) && Math.hypot(u.x - N.x, u.y - N.y) < 7) { N.hold = 0; N.hunt = true; N.tg = u.id; N.prov = Game.time; break; }
      },
      or: C => C.flags.wave && C.flags.wave.y >= CAMP2.waveEnd - 0.5 },
    { k: 'wait', label: 'Бегство', until: C => !C.flags.wave || C.flags.wave.y >= CAMP2.waveEnd - 0.5 || !Game.units.some(u => !u.dead && isPerson(u) && u.type !== 'hero' && u.y < CAMP2.exit[1] - 3) },
    { k: 'cut', cam: [64, 86], fx(C) { C.flags.saved = camp2Exit(); campMarchStop(); }, lines: [
      ['note', 'За спиной громыхнуло в последний раз — и стало тихо. Брюзга легла.'],
      ['grum', 'Выбрались. Не все. Но выбрались.'],
      ['yagla', 'Тан?'],
      ['grum', 'Таны уходят последними. Он ушёл… вместе с горой.'],
      ['pim', 'Это я тоже запишу. Красиво.'],
      ['grum', 'Это не красиво, Пим. Это грустно. Пиши «грустно».'],
    ] },
    { k: 'end' },
  ],
};
