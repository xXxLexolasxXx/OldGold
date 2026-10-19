'use strict';
// Ярмарка: раз в 5–7 суток днём на площади у главного склада встают пять лавок.
// · Обмен с заезжими купцами: 6 предложений с ограниченным запасом (товары — со складов и на склад);
// · конкурсы по очереди (3 за ярмарку): метание молота, стрельба, загадки, пироги — герои против жителей и рекрутов;
// · призы: золото в казну, вещь герою, титул «Чемпион ярмарки», слава гильдии рекрута-победителя;
// · в общей деревне — лоты между игроками (вещь из рюкзака за вещь) и личное задание «Сыграть в конкурсе ярмарки».
// С «Праздником» (festival.js) не пересекается: в день ярмарки праздник не начинается и наоборот;
// удачная ярмарка (все конкурсы сыграны) зовёт праздник на следующий день.
// Game.fair = { id, on, x, y, offers, cs, ci, lots, res } — сегодняшняя ярмарка; Game.fairDay — номер дня следующей.
// fairOn() и Game.fair.id читает торговля (trade.js): в день ярмарки караван приходит сразу и выгоднее.

const FAIR_GAP = [5, 7];              // через сколько суток следующая
const FAIR_FIRST = 3;                 // первая — на 3–4-е сутки
const FAIR_OPEN = 35, FAIR_PAUSE = 22, FAIR_TRIES = 3, FAIR_NPC = 3;
const FAIR_CONTESTS = {
  hammer:  { n: 'Метание молота', st: 'str', unit: 'шагов', verb: 'Бросок', npc: 'warrior', say: ['Хэх!', 'Лети!', 'Ух!'] },
  archery: { n: 'Стрельба по мишени', st: 'agi', unit: 'очков', verb: 'Выстрел', npc: 'archer', say: ['В яблочко!', 'Почти!', 'Тетива поёт'] },
  riddle:  { n: 'Загадки звездочёта', st: 'int', unit: 'загадок', verb: 'Ответ', npc: 'mage', say: ['Эврика!', 'Это… гриб?', 'Знаю!'] },
  pies:    { n: 'Кто съест больше пирогов', st: 'end', unit: 'пирогов', verb: 'Пирог', npc: null, say: ['Ням!', 'Ещё один…', 'Уф!'] },
};
const FAIR_OFFERS = [
  { give: { hide: 3 }, get: { gold: 1 } }, { give: { bread: 4 }, get: { gold: 1 } }, { give: { beer: 3 }, get: { gold: 1 } },
  { give: { sausage: 3 }, get: { gold: 1 } }, { give: { gold: 2 }, get: { sword: 1 } }, { give: { gold: 2 }, get: { bow: 1 } },
  { give: { gold: 1 }, get: { mana: 1 } }, { give: { stone: 5 }, get: { iron: 1 } }, { give: { trunk: 4 }, get: { timber: 3 } },
  { give: { gold: 3 }, get: { magicstone: 2 } }, { give: { wheat: 5 }, get: { croissant: 2 } }, { give: { leather: 2 }, get: { leatherArmor: 1 } },
  { give: { magicstone: 2 }, get: { gold: 2 } }, { give: { hops: 4 }, get: { darkbeer: 2 } },
];
const FAIR_WANT = ['bread', 'sausage', 'chickenleg', 'steak', 'croissant'];
const FAIR_STALLS = [
  { dx: -3.2, dy: -0.6, col: '#c83a2a', goods: ['bread', 'croissant'], n: 'Хлебная лавка' },
  { dx: -1.6, dy: -1.9, col: '#2f6a9a', goods: ['beer', 'darkbeer'], n: 'Пивная' },
  { dx: 0.2, dy: -2.3, col: '#c89226', goods: ['sword', 'bow'], n: 'Оружейная' },
  { dx: 2.0, dy: -1.9, col: '#6a3aa8', goods: ['mana', 'magicstone'], n: 'Колдовская' },
  { dx: 3.4, dy: -0.6, col: '#3e7a3a', goods: ['hide', 'leather'], n: 'Шкуры и кожи' },
];
const FAIR_NPC_NAMES = ['Брок', 'Гунда', 'Тильми', 'Фрода', 'Хэм', 'Ода', 'Варди', 'Скегги', 'Ульма', 'Рун'];
const FR = { t: 0, bT: 0, hooked: false, cHooked: false, ui: null, open: false };

const frServer = () => typeof coop !== 'undefined' && !!coop.players;
const frMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const fairOn = () => !!(Game.fair && Game.fair.on);
const frDay = () => cycleAt(Game.time).k;
const frP = () => cycleAt(Game.time).p;
function frSay(text, to) { if (frServer()) { if (to) coopSay(to, text); else coop.out.push({ msg: { t: 'toast', text } }); } else toast(text); }
const frGoodName = g => (GOODS[g] ? GOODS[g].name : g).toLowerCase();
const frList = o => Object.entries(o).map(([g, n]) => `${n} ${frGoodName(g)}`).join(', ');
const frStore = () => Game.buildings.find(b => b.isStore() && !b.removed) || null;
function frHave(g) { let n = 0; for (const b of Game.buildings) if (b.isStore()) n += b.offer(g); return n; }
function frTake(g, n) { for (const b of Game.buildings) { if (!n) break; if (!b.isStore()) continue; const t = Math.min(n, b.offer(g)); b.stock[g] -= t; n -= t; } }

// ================= Начало и конец =================

function fairCanStart() {
  if (fairOn()) return 'Ярмарка уже идёт';
  if (Game.festival && (Game.festival.on || Game.festival.wait)) return 'Сегодня праздник — ярмарка подождёт';
  if (!frStore()) return 'Нужен склад: у него площадь';
  if (isNightNow() || isEveningNow()) return 'Ярмарку открывают днём';
  if (Game.units.filter(u => isPerson(u) && !u.dead).length < 5) return 'Мало жителей — некому торговать';
  return '';
}

function fairSquare() {
  const st = frStore();
  // под лавками (их рисуем поверх земли) — без зданий: полоса 9×4 клеток
  const free = (x, y, rx, ry) => { for (let dy = -ry; dy <= 1; dy++) for (let dx = -rx; dx <= rx; dx++) if (!inb(x + dx, y + dy) || World.bmap[idx(x + dx, y + dy)] || (dy >= 0 && !isWalkable(x + dx, y + dy))) return false; return true; };
  return randomFreeNear(st.doorX, st.doorY + 5, 1, 10, (x, y) => free(x, y, 4, 3)) || randomFreeNear(st.doorX, st.doorY + 4, 1, 8, (x, y) => free(x, y, 2, 1)) || randomFreeNear(st.doorX, st.doorY + 2, 0, 10, (x, y) => isWalkable(x, y)) || [st.doorX, st.doorY + 1];
}

function fairStart() {
  const bad = fairCanStart();
  if (bad) return bad;
  const [x, y] = fairSquare();
  // предложения: сначала те, что деревне по карману
  const pool = FAIR_OFFERS.filter(o => Object.keys(o.give).concat(Object.keys(o.get)).every(g => GOODS[g]));
  pool.sort((a, b) => (Object.entries(b.give).every(([g, n]) => frHave(g) >= n) - Object.entries(a.give).every(([g, n]) => frHave(g) >= n)) || Math.random() - 0.5);
  const offers = pool.slice(0, 6).map(o => ({ give: o.give, get: o.get, left: 3 }));
  const ks = Object.keys(FAIR_CONTESTS).sort(() => Math.random() - 0.5).slice(0, 3);
  Game.fairN = (Game.fairN || 0) + 1;
  Game.fair = { id: Game.fairN, on: true, x: x + 0.5, y: y + 0.5, offers, cs: ks.map(k => ({ k, st: 'wait', sc: [] })), ci: 0, next: Game.time + 20, lots: [], res: [], lotN: 1, t0: Game.time };
  frSay('Ярмарка открылась на площади у склада! Обмен с купцами и конкурсы — кнопка «Ярмарка» вверху');
  logEvent('festival', 'Открылась ярмарка: пять лавок и три конкурса', x + 0.5, y);
  if (typeof sfxAt === 'function') sfxAt('chime', x * TILE, y * TILE);
  return '';
}

function fairEnd() {
  const F = Game.fair;
  if (!F) return;
  for (const L of F.lots) frLotBack(L);
  const all = F.cs.every(c => c.st === 'done');
  Game.fair = null;
  Game.fairDay = frDay() + FAIR_GAP[0] + Math.floor(Math.random() * (FAIR_GAP[1] - FAIR_GAP[0] + 1));
  Game.fairAnn = false;
  if (all) {
    // удачная ярмарка — завтра, глядишь, и праздник (сам праздник — в festival.js)
    Game.festNext = Math.min(Game.festNext == null ? Infinity : Game.festNext, Game.time + 30);
    frSay('Ярмарка закрылась. Все конкурсы сыграны — завтра, глядишь, и праздник!');
  } else frSay('Ярмарка закрылась — лавки сворачивают навесы');
  logEvent('festival', 'Ярмарка закрылась', undefined, undefined);
}

// ================= Обмен с купцами =================

function fairTrade(i, who) {
  const F = Game.fair, o = F && F.offers[i];
  if (!o || o.left <= 0) return 'Этот товар уже разобрали';
  for (const [g, n] of Object.entries(o.give)) if (frHave(g) < n) return `На складах не хватает: ${frGoodName(g)} (${n})`;
  const st = frStore();
  if (!st) return 'Нет склада';
  for (const [g, n] of Object.entries(o.give)) frTake(g, n);
  for (const [g, n] of Object.entries(o.get)) st.stock[g] = (st.stock[g] || 0) + n;
  o.left--;
  floater(F.x, F.y - 2.2, `Обмен: ${frList(o.get)}`, '#ffe070');
  if (typeof sfxAt === 'function') sfxAt('mug', F.x * TILE, F.y * TILE, 0.7);
  logEvent('festival', `${who || 'Деревня'} выменял на ярмарке: ${frList(o.give)} → ${frList(o.get)}`, F.x, F.y);
  return '';
}

// ================= Конкурсы =================

function frHeroes() {
  if (frServer()) return [...coop.players.values()];
  return Game.hero && !Game.hero.dead ? [Game.hero] : [];
}
const frKey = h => (h.hero && h.hero.owner) || 'me';

function frHeroScore(h, C) {
  const H = h.hero, s = heroStats(H)[C.st] || 5;
  return Math.max(1, Math.round((s * 1.8 + (H.level || 1) * 1.5 + 3) * (0.55 + Math.random() * 0.7)));
}

function fairOpen(c) {
  const F = Game.fair, C = FAIR_CONTESTS[c.k];
  c.st = 'open'; c.end = Game.time + FAIR_OPEN; c.sc = [];
  // соперники: рекруты подходящего класса (за свою гильдию), иначе жители
  const recs = C.npc ? Game.units.filter(u => u.rec && !u.dead && !u.inside && u.rec.cls === C.npc && !(u.rec.train > 0)) : [];
  const folk = Game.units.filter(u => isPerson(u) && !u.dead && !u.inside && u.type !== 'hero' && !u.rec && !u.gm);
  const pick = recs.slice(0, 2);
  while (pick.length < FAIR_NPC && folk.length) pick.push(folk.splice((Math.random() * folk.length) | 0, 1)[0]);
  for (const u of pick) {
    const lv = u.rec ? u.rec.lvl : 0;
    c.sc.push({ who: 'u' + u.id, name: u.rec ? unitTitle(u) : FAIR_NPC_NAMES[(Math.random() * FAIR_NPC_NAMES.length) | 0], uid: u.id, npc: 1, rec: u.rec ? 1 : 0, n: 0, best: 0, at: Game.time + 4 + Math.random() * (FAIR_OPEN - 10), lv });
  }
  frSay(`Конкурс «${C.n}»! ${FAIR_OPEN} секунд, у каждого ${FAIR_TRIES} попытки — героям нужно стоять на площади`);
  floater(F.x, F.y - 2.6, C.n + '!', '#ffe070');
}

function fairJoin(h) {
  const F = Game.fair, c = F && F.cs[F.ci];
  if (!c || c.st !== 'open') return 'Сейчас конкурса нет — скоро следующий';
  if (Math.hypot(h.x - F.x, h.y - F.y) > 7) return 'Подойдите на площадь ярмарки';
  if (h.hero.downT || h.dead || h.inside) return 'Герою не до конкурсов';
  const key = frKey(h), C = FAIR_CONTESTS[c.k];
  let e = c.sc.find(x => x.who === key);
  if (!e) { e = { who: key, name: h.hero.name, n: 0, best: 0 }; c.sc.push(e); if (frServer() && h.hero.owner) frQuestJoin(h.hero); }
  if (e.n >= FAIR_TRIES) return 'Попытки кончились — ждём итогов';
  if ((e.cd || 0) > Game.time) return '';
  e.cd = Game.time + 1.2;
  e.n++;
  let v = frHeroScore(h, C);
  if (c.k === 'pies') v = Math.max(1, Math.round(v / 3));
  e.best = Math.max(e.best, v);
  h.face = F.x > h.x ? 1 : -1; h.vdir = 'E';
  h.hfx = { k: 'strike', t: Game.time + 0.45 };
  floater(h.x, h.y - 2, `${C.verb}: ${v} ${C.unit}`, '#ffe070');
  floater(h.x, h.y - 2.6, C.say[(Math.random() * C.say.length) | 0], '#f6e8b0');
  if (typeof sfxAt === 'function') sfxAt(c.k === 'archery' ? 'thud' : c.k === 'riddle' ? 'chime' : 'mug', h.x * TILE, h.y * TILE, 0.7);
  return '';
}

function fairNpcTick(c) {
  const C = FAIR_CONTESTS[c.k];
  for (const e of c.sc) {
    if (!e.npc || e.n >= FAIR_TRIES || Game.time < e.at) continue;
    e.n++; e.at = Game.time + 5 + Math.random() * 6;
    let v = Math.round((e.rec ? 9 + e.lv * 1.8 : 6 + Math.random() * 10) * (0.55 + Math.random() * 0.7));
    if (c.k === 'pies') v = Math.max(1, Math.round(v / 3));
    e.best = Math.max(e.best, v);
    const u = Game.unitMap.get(e.uid), F = Game.fair;
    const x = u && !u.dead ? u.x : F.x + (Math.random() - 0.5) * 3, y = u && !u.dead ? u.y : F.y;
    floater(x, y - 1.9, `${e.name}: ${v} ${C.unit}`, '#e8dcc0');
  }
}

function fairClose(c) {
  const F = Game.fair, C = FAIR_CONTESTS[c.k];
  c.st = 'done';
  const tab = c.sc.filter(e => e.n > 0).sort((a, b) => b.best - a.best);
  const w = tab[0];
  if (!w) { F.res.push({ k: c.k, name: '—', best: 0 }); return; }
  F.res.push({ k: c.k, name: w.name, best: w.best, hero: w.npc ? 0 : 1 });
  const st = frStore();
  if (st) st.stock.gold = (st.stock.gold || 0) + 2;
  if (!w.npc) {
    const h = frHeroes().find(x => frKey(x) === w.who);
    if (h) fairPrize(h, C);
    frSay(`«${C.n}»: побеждает ${w.name} — ${w.best} ${C.unit}! Приз герою и 2 золота в казну`);
  } else {
    const u = Game.unitMap.get(w.uid);
    if (u && u.rec && typeof gpGlory === 'function') gpGlory(guildOf(u), 6);
    frSay(`«${C.n}»: побеждает ${w.name} (${w.best} ${C.unit})${u && u.rec ? ' — слава его гильдии!' : ''}. Казне 2 золота`);
  }
  floater(F.x, F.y - 2.8, `Победитель: ${w.name}`, '#ffe070');
  fxBurst(F.x * TILE, F.y * TILE - 30, 30, ['#e84a4a', '#f0c030', '#4a9ae8', '#5cc060', '#e87ab8'], 90, 70, 1.2, 2, 120);
  if (typeof sfxAt === 'function') sfxAt('cheer', F.x * TILE, F.y * TILE);
}

function fairPrize(h, C) {
  const H = h.hero, item = ['steak', 'croissant', 'chickenleg'][(Math.random() * 3) | 0];
  if (frServer() && H.owner) {
    coopAddItem(H, item, 2);
    if (typeof coopGiveXp === 'function') coopGiveXp(H, 30);
    if (typeof coopGiveTitle === 'function') coopGiveTitle(H, 'Чемпион ярмарки');
    coopSay(H.owner, `Приз: ${frGoodName(item)} ×2, +30 опыта, титул «Чемпион ярмарки»`);
  } else {
    if (typeof hlOn === 'function' && hlOn() && Array.isArray(H.inv)) hlAddItem(H, item, 2);
    H.cxp = (H.cxp || 0) + 30;
    (H.titles || (H.titles = [])).includes('Чемпион ярмарки') || H.titles.push('Чемпион ярмарки');
  }
  floater(h.x, h.y - 2.4, 'Чемпион ярмарки!', '#ffe070');
}

// ================= Лоты между игроками (общая деревня) =================

function frLotBack(L) {
  const u = frServer() && coop.players.get(L.owner);
  if (u && coopAddItem(u.hero, L.give.k, L.give.n)) return;
  const ret = Game.fairRet || (Game.fairRet = {});
  (ret[L.owner] || (ret[L.owner] = [])).push(L.give);
}

function fairLot(name, slot, want, wn) {
  const F = Game.fair, u = coop.players.get(name);
  if (!F || !u) return;
  if (F.lots.filter(L => L.owner === name).length >= 3) { coopSay(name, 'Не больше трёх лотов на игрока'); return; }
  const s = u.hero.inv[slot];
  if (!s) { coopSay(name, 'В этой ячейке пусто'); return; }
  if (want && !FAIR_WANT.includes(want)) return;
  const n = Math.max(1, Math.min(5, wn | 0));
  u.hero.inv[slot] = null;
  F.lots.push({ id: F.lotN++, owner: name, give: { k: s.k, n: s.n }, want: want ? { k: want, n } : null });
  frSay(`${name} выставил на ярмарке: ${frGoodName(s.k)} ×${s.n}${want ? ` за ${frGoodName(want)} ×${n}` : ' — даром'}`);
}

function fairTake(name, id) {
  const F = Game.fair, u = coop.players.get(name), i = F ? F.lots.findIndex(L => L.id === id) : -1;
  if (i < 0 || !u) return;
  const L = F.lots[i], o = coop.players.get(L.owner);
  if (L.owner === name) { F.lots.splice(i, 1); frLotBack(L); coopSay(name, 'Лот снят — вещь вернулась в рюкзак'); return; }
  if (L.want) {
    if (!o) { coopSay(name, `${L.owner} сейчас не в деревне — обмен, когда вернётся`); return; }
    const H = u.hero, have = H.inv.reduce((a, s) => a + (s && s.k === L.want.k ? s.n : 0), 0);
    if (have < L.want.n) { coopSay(name, `Нужно: ${frGoodName(L.want.k)} ×${L.want.n}`); return; }
    let n = L.want.n;
    for (let j = 0; j < H.inv.length && n; j++) { const s = H.inv[j]; if (s && s.k === L.want.k) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (!s.n) H.inv[j] = null; } }
    if (!coopAddItem(o.hero, L.want.k, L.want.n)) { const ret = Game.fairRet || (Game.fairRet = {}); (ret[L.owner] || (ret[L.owner] = [])).push(L.want); }
  }
  if (!coopAddItem(u.hero, L.give.k, L.give.n)) { coopSay(name, 'Рюкзак полон'); if (L.want) coopAddItem(u.hero, L.want.k, L.want.n); return; }
  F.lots.splice(i, 1);
  coopSay(name, `Обмен состоялся: ${frGoodName(L.give.k)} ×${L.give.n}`);
  coopSay(L.owner, `${name} забрал ваш лот${L.want ? ` и отдал ${frGoodName(L.want.k)} ×${L.want.n}` : ''}`);
  if (typeof sfxAt === 'function') sfxAt('mug', F.x * TILE, F.y * TILE, 0.7);
}

function frQuestJoin(H) {
  if (typeof coopQEvent === 'function') coopQEvent(H, 'fair');
}

// ================= Тик =================

function fairTick(dt) {
  if (frMirror()) return;
  if (frServer() && !FR.hooked) frServerHook();
  FR.t += dt;
  if (FR.t < 0.5) return;
  const step = FR.t; FR.t = 0;
  const k = frDay(), p = frP();
  if (Game.fairDay == null) Game.fairDay = k + FAIR_FIRST + Math.floor(Math.random() * 2);
  const F = Game.fair;
  if (!F) {
    if (!startOpen('fair')) { if (Game.fairDay <= k + 1) Game.fairDay = k + 2; return; }      // рано: объявим, когда система откроется
    if (k > Game.fairDay) Game.fairDay = k + 1;
    if (k === Game.fairDay - 1 && !Game.fairAnn && isEveningNow()) { Game.fairAnn = true; frSay('Завтра на площади у склада ярмарка: лавки, обмен и конкурсы!'); }
    if (k === Game.fairDay && p > 6 && p < EVE_START - 90) { if (fairStart()) Game.fairDay = k + 1; }
    return;
  }
  if (p >= EVE_START || isNightNow()) { fairEnd(); return; }
  const c = F.cs[F.ci];
  if (c) {
    if (c.st === 'wait' && Game.time >= F.next) fairOpen(c);
    else if (c.st === 'open') {
      fairNpcTick(c);
      if (Game.time >= c.end) { fairClose(c); F.ci++; F.next = Game.time + FAIR_PAUSE; }
    }
  }
  // зеваки: свободные жители заглядывают к лавкам
  FR.bT += step;
  if (FR.bT >= 3) {
    FR.bT = 0;
    let n = Game.units.filter(u => u.fairAt > Game.time).length;
    for (const u of Game.units) {
      if (n >= 7) break;
      if (u.dead || u.inside || !u.idleFlag || u.carry || u.rec || u.gm || u.owner || u.teamOf || u.type === 'hero' || !isPerson(u) || u.brk || u.fairAt > Game.time - 40) continue;
      u.proc = null; u.action = null; u.anim = null; u.releaseOcc();
      u.fairAt = Game.time + 14; u.proc = fairBrowseGen(u); n++;
    }
  }
  if (frServer()) for (const h of coop.players.values()) {
    const H = h.hero;
    if (H.quests && H.quests.day === frDay() && !H.quests.list.some(q => q.id === 'fair')) H.quests.list.push({ id: 'fair', n: 0, need: 1, done: false });
  }
}

function* fairBrowseGen(u) {
  const F = Game.fair;
  if (!F) return;
  const S = FAIR_STALLS[(Math.random() * FAIR_STALLS.length) | 0];
  const tx = Math.floor(F.x + S.dx + (Math.random() - 0.5)), ty = Math.floor(F.y + S.dy + 1.2);
  const s = isWalkable(tx, ty) ? [tx, ty] : randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y));
  if (!s) return;
  u.idleFlag = false;
  const ok = yield { walk: s, offroad: true };
  if (!ok || !Game.fair) return;
  u.vdir = 'N';
  floater(u.x, u.y - 1.7, ['Почём хлеб?', 'Беру!', 'Дороговато…', 'А скидка?', 'Заверните!', 'Ох, красота'][(Math.random() * 6) | 0], '#f6e8b0');
  yield { wait: 2.5 + Math.random() * 3 };
}

// ================= Рисование: лавки, флажки, реквизит конкурса =================

function fairStall(c, x, y, S, seed) {
  const P = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, y + 1, 15, 4, 0, 0, 7); c.fill();
  // стойки и прилавок
  P(-13, -26, 2, 27, '#3a2414'); P(11, -26, 2, 27, '#3a2414');
  P(-14, -10, 28, 10, '#1a100a'); P(-13, -9, 26, 8, '#8a5a30'); P(-13, -9, 26, 2, '#b07a44'); P(-13, -3, 26, 1, '#5a3a1e');
  for (let k = -10; k < 12; k += 6) P(k, -6, 1, 4, '#6a4424');
  // товар на прилавке — значки товаров игры
  const ic = typeof iconCanvas === 'function' ? S.goods.map(g => iconCanvas('good', g)) : [];
  c.imageSmoothingEnabled = false;
  ic.forEach((cv, i) => { if (cv) c.drawImage(cv, Math.round(x - 11 + i * 11), Math.round(y - 19), 10, 10); });
  // навес в полоску с фестонами
  P(-16, -33, 32, 8, '#1a100a');
  for (let k = 0; k < 8; k++) P(-15 + k * 4, -32, 4, 6, k % 2 ? '#f0e6d0' : S.col);
  for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#f0e6d0' : S.col; c.beginPath(); c.arc(Math.round(x - 13 + k * 4), Math.round(y - 26), 2, 0, Math.PI); c.fill(); }
  P(-15, -33, 30, 1, shade(S.col, 0.3));
  // флажок на макушке
  const sw = Math.sin(Game.time * 3 + seed) * 1.5;
  P(-1, -40, 1, 7, '#3a2414'); c.fillStyle = S.col; c.beginPath(); c.moveTo(x, y - 40); c.lineTo(x + 6 + sw, y - 38); c.lineTo(x, y - 36); c.closePath(); c.fill();
}

function fairProp(c, x, y, k) {
  const P = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  if (k === 'archery' && typeof archeryTarget === 'function') { archeryTarget(c, x, y); return; }
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, y + 1, 9, 3, 0, 0, 7); c.fill();
  if (k === 'hammer') {
    // пень с молотом и меловая разметка
    P(-6, -7, 12, 8, '#1a100a'); P(-5, -6, 10, 7, '#7a4e2c'); P(-5, -6, 10, 2, '#c8a070'); P(-2, -5, 4, 1, '#8a5a30');
    P(1, -15, 2, 9, '#5a3a1e'); P(-2, -18, 8, 4, '#1a100a'); P(-1, -17, 6, 2, '#8a909c'); P(-1, -17, 6, 1, '#c8ccd4');
    for (let j = 1; j < 4; j++) P(8 + j * 6, 0, 3, 1, 'rgba(240,236,220,0.7)');
  } else if (k === 'riddle') {
    // кафедра звездочёта со свитком и свечой
    P(-1, -12, 3, 13, '#3a2414'); P(-7, -16, 14, 5, '#1a100a'); P(-6, -15, 12, 3, '#6a4424');
    P(-5, -18, 10, 3, '#f0e6c0'); P(-5, -18, 10, 1, '#c8b878'); P(-3, -17, 6, 1, '#5a4a3a');
    P(5, -22, 2, 4, '#f6f2e0'); const fl = Math.sin(Game.time * 9) > 0 ? 1 : 0; P(5, -25 - fl, 2, 3, '#ffd060');
    for (let j = 0; j < 3; j++) P(-8 + j * 7, -26 - (j % 2) * 3, 1, 1, '#ffe070');
  } else {
    // стол с горой пирогов
    P(-10, -9, 20, 3, '#1a100a'); P(-9, -8, 18, 2, '#a06a3a'); P(-8, -6, 2, 7, '#5a3a1e'); P(6, -6, 2, 7, '#5a3a1e');
    for (const [a, b] of [[-7, -12], [-2, -12], [3, -12], [-5, -15], [0, -15]]) { P(a - 1, b - 1, 6, 4, '#3a2414'); P(a, b, 4, 3, '#d8963a'); P(a, b, 4, 1, '#f0c070'); }
  }
}

function fairDrawList(list, c, x0, y0, x1, y1) {
  const F = Game.fair;
  if (!F || !F.on || F.x < x0 - 6 || F.x > x1 + 6 || F.y < y0 - 5 || F.y > y1 + 5) return;
  FAIR_STALLS.forEach((S, i) => {
    const sx = F.x + S.dx, sy = F.y + S.dy;
    list.push([sy, () => fairStall(c, Math.round(sx * TILE), Math.round(sy * TILE + 6), S, i)]);
  });
  // гирлянда флажков над лавками
  list.push([F.y - 2.5, () => {
    if (typeof festBunting !== 'function') return;
    for (let i = 0; i + 1 < FAIR_STALLS.length; i++) {
      const a = FAIR_STALLS[i], b = FAIR_STALLS[i + 1];
      festBunting(c, (F.x + a.dx) * TILE, (F.y + a.dy) * TILE - 32, (F.x + b.dx) * TILE, (F.y + b.dy) * TILE - 32, 5, i);
    }
  }]);
  const cur = F.cs[F.ci] || F.cs[F.cs.length - 1];
  if (cur) list.push([F.y + 0.6, () => fairProp(c, Math.round(F.x * TILE), Math.round((F.y + 0.6) * TILE + 6), cur.k)]);
}

// ================= Интерфейс =================

function frMyHero() { return Game.hero && !Game.hero.dead ? Game.hero : null; }
function frMyKey() { return frMirror() ? Coop.nick : 'me'; }

function fairPanelHTML() {
  const F = Game.fair;
  if (!F) return '';
  const c = F.cs[F.ci], key = frMyKey(), h = frMyHero();
  let x = '<div class="fr-h"><b>Ярмарка</b><button class="fr-x" data-fr="close" title="Свернуть">×</button></div>';
  if (c) {
    const C = FAIR_CONTESTS[c.k];
    if (c.st === 'wait') x += `<div class="fr-sec">Скоро конкурс: <b>${C.n}</b> (через ${Math.max(0, Math.round(F.next - Game.time))} с)</div>`;
    else {
      const me = c.sc.find(e => e.who === key), left = FAIR_TRIES - (me ? me.n : 0);
      const far = h && Math.hypot(h.x - F.x, h.y - F.y) > 7;
      x += `<div class="fr-sec">Конкурс: <b>${C.n}</b> · ещё ${Math.max(0, Math.round(c.end - Game.time))} с<br><small>решает ${({ str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' })[C.st]} героя и удача</small></div>`;
      if (h) x += far ? `<button class="fr-big" data-fr="go">Подойти на площадь</button>` : `<button class="fr-big" data-fr="join" ${left > 0 ? '' : 'disabled'}>${C.verb}! <small>(попыток: ${left})</small></button>`;
      const tab = c.sc.filter(e => e.n > 0).sort((a, b) => b.best - a.best).slice(0, 6);
      if (tab.length) x += '<div class="fr-tab">' + tab.map((e, i) => `<div${e.who === key ? ' class="me"' : ''}>${i + 1}. ${e.name}${e.rec ? ' <small>(рекрут)</small>' : ''} — <b>${e.best}</b> ${C.unit}</div>`).join('') + '</div>';
    }
  }
  if (F.res.length) x += '<div class="fr-sec small">Призы: ' + F.res.map(r => `${FAIR_CONTESTS[r.k].n} — <b>${r.name}</b>`).join('; ') + '</div>';
  x += '<div class="fr-sec"><b>Купцы меняют</b> <small>(со складов на склад)</small></div><div class="fr-offs">';
  F.offers.forEach((o, i) => {
    x += `<button class="fr-off" data-fr="trade:${i}" ${o.left > 0 ? '' : 'disabled'} title="Осталось: ${o.left}"><span>${Object.entries(o.give).map(([g, n]) => frIcon(g) + n).join(' ')}</span><span class="fr-ar">→</span><span>${Object.entries(o.get).map(([g, n]) => frIcon(g) + n).join(' ')}</span><small>×${o.left}</small></button>`;
  });
  x += '</div>';
  if (frMirror()) {
    x += '<div class="fr-sec"><b>Лоты игроков</b> <small>(вещь из рюкзака за вещь)</small></div>';
    for (const L of F.lots) {
      const mine = L.owner === key;
      x += `<div class="fr-lot">${frIcon(L.give.k)}${L.give.n} <small>от ${L.owner}</small> ${L.want ? `за ${frIcon(L.want.k)}${L.want.n}` : '<small>даром</small>'} <button data-fr="take:${L.id}">${mine ? 'Снять' : 'Взять'}</button></div>`;
    }
    const inv = (Coop.me && Coop.me.inv) || [];
    const opts = inv.map((s, i) => s ? `<option value="${i}">${GOODS[s.k] ? GOODS[s.k].name : s.k} ×${s.n}</option>` : '').join('');
    x += opts ? `<div class="fr-lot"><select id="fr-slot">${opts}</select> за <select id="fr-want"><option value="">даром</option>${FAIR_WANT.map(g => `<option value="${g}">${GOODS[g].name}</option>`).join('')}</select><input id="fr-wn" type="number" min="1" max="5" value="1"><button data-fr="lot">Выставить</button></div>` : '<div class="small muted">Рюкзак пуст — выставлять нечего</div>';
  }
  return x;
}

function frIcon(g) {
  const cv = typeof iconCanvas === 'function' && iconCanvas('good', g);
  let url = '';
  try { url = cv && cv.toDataURL ? (FR.icons || (FR.icons = {}))[g] || (FR.icons[g] = cv.toDataURL()) : ''; } catch (e) { url = ''; }
  return url ? `<img class="fr-ic" src="${url}" alt="" title="${GOODS[g] ? GOODS[g].name : g}">` : `${frGoodName(g)} `;
}

function fairAct(a, arg) {
  const h = frMyHero();
  if (frMirror()) {
    if (a === 'trade') coopSend({ t: 'fair', a: 'trade', i: +arg });
    else if (a === 'join') coopSend({ t: 'fair', a: 'join' });
    else if (a === 'take') coopSend({ t: 'fair', a: 'take', id: +arg });
    else if (a === 'go' && Game.fair) coopSend({ t: 'go', x: Math.floor(Game.fair.x), y: Math.floor(Game.fair.y) + 1 });
    else if (a === 'lot') {
      const s = document.getElementById('fr-slot'), w = document.getElementById('fr-want'), n = document.getElementById('fr-wn');
      if (s) coopSend({ t: 'fair', a: 'lot', slot: +s.value, want: w ? w.value : '', wn: n ? +n.value : 1 });
    }
    return;
  }
  let bad = '';
  if (a === 'trade') bad = fairTrade(+arg, 'Деревня');
  else if (a === 'join' && h) bad = fairJoin(h);
  else if (a === 'go' && h && Game.fair) { const c = resolveCmd([Math.floor(Game.fair.x), Math.floor(Game.fair.y) + 1]); if (c) issueCmd(h, c); }
  if (bad) toast(bad);
}

function fairUI() {
  if (typeof coop !== 'undefined') return;
  if (typeof document === 'undefined' || !document.getElementById || !document.getElementById('view')) return;
  let chip = document.getElementById('fair-chip'), pan = document.getElementById('fair-panel');
  if (!chip) {
    const st = document.createElement('style');
    st.textContent = `#fair-chip{position:absolute;top:52px;left:50%;transform:translateX(-50%);z-index:6;display:none;padding:3px 12px;background:linear-gradient(#7a2a20,#4a1a12);color:#ffe9b0;border:1px solid #f0c040;border-radius:12px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5)}
    #fair-chip b{color:#fff}
    #fair-panel{position:absolute;top:80px;left:50%;transform:translateX(-50%);width:min(340px,calc(100vw - 24px));max-height:calc(100dvh - 160px);overflow-y:auto;z-index:7;display:none;padding:6px 10px 10px;background:rgba(26,19,13,.95);color:#e8dcc0;border:1px solid #c89a3a;border-radius:6px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.6)}
    #fair-panel .fr-h{display:flex;justify-content:space-between;align-items:center;color:#f6d458;font-size:15px;border-bottom:1px dashed #6a5020;padding-bottom:3px}
    #fair-panel .fr-x{padding:0 6px}#fair-panel .fr-sec{margin:6px 0 3px;line-height:1.35}#fair-panel small{opacity:.75}
    #fair-panel .fr-big{width:100%;padding:6px;font-size:14px;margin:3px 0}
    #fair-panel .fr-tab div{padding:1px 4px}#fair-panel .fr-tab .me{background:rgba(255,220,140,.12);color:#ffe9a0}
    #fair-panel .fr-offs{display:grid;grid-template-columns:1fr 1fr;gap:4px}
    #fair-panel .fr-off{display:flex;align-items:center;gap:3px;justify-content:space-between;padding:3px 5px;font-size:12px}
    #fair-panel .fr-ar{opacity:.7}#fair-panel .fr-ic{width:16px;height:16px;image-rendering:pixelated;vertical-align:middle}
    #fair-panel .fr-lot{display:flex;align-items:center;gap:4px;margin:3px 0;flex-wrap:wrap}#fair-panel .fr-lot button{margin-left:auto}
    #fair-panel input{width:38px}
    body.mobile #fair-chip{top:calc(96px + env(safe-area-inset-top))}body.mobile #fair-panel{top:calc(124px + env(safe-area-inset-top))}`;
    document.head.appendChild(st);
    chip = document.createElement('div'); chip.id = 'fair-chip';
    pan = document.createElement('div'); pan.id = 'fair-panel';
    const v = document.getElementById('view'); v.appendChild(chip); v.appendChild(pan);
    chip.addEventListener('click', () => { FR.open = !FR.open; FR.html = null; fairUI(); });
    pan.addEventListener('click', e => {
      const el = e.target.closest('[data-fr]');
      if (!el || el.disabled) return;
      const [a, arg] = el.dataset.fr.split(':');
      if (a === 'close') { FR.open = false; fairUI(); return; }
      fairAct(a, arg);
      FR.html = null;
    });
  }
  const on = fairOn();
  chip.style.display = on ? 'block' : 'none';
  if (!on) { pan.style.display = 'none'; FR.open = false; return; }
  const c = Game.fair.cs[Game.fair.ci];
  chip.innerHTML = `<b>Ярмарка</b>${c && c.st === 'open' ? ' · конкурс идёт!' : ''} ▾`;
  pan.style.display = FR.open ? 'block' : 'none';
  if (!FR.open) return;
  // не перерисовываем, пока игрок выбирает лот
  if (pan.contains(document.activeElement) && /SELECT|INPUT/.test(document.activeElement.tagName)) return;
  const html = fairPanelHTML();
  if (html !== FR.html) { FR.html = html; pan.innerHTML = html; }
}

// ================= Сохранение, кооп, подключение =================

function fairMirror() {
  const F = Game.fair;
  if (!F) return null;
  const c = F.cs[F.ci];
  return { id: F.id, on: F.on, x: F.x, y: F.y, ci: F.ci, next: F.next, offers: F.offers, res: F.res, lots: F.lots,
    cs: F.cs.map(x => x === c ? { k: x.k, st: x.st, end: x.end, sc: x.sc.map(e => ({ who: e.who, name: e.name, n: e.n, best: e.best, rec: e.rec || 0 })) } : { k: x.k, st: x.st, sc: [] }) };
}

function frServerHook() {
  FR.hooked = true;
  if (typeof QDEF !== 'undefined' && !QDEF.fair) QDEF.fair = { name: 'Сыграть в конкурсе ярмарки', need: 1, xp: 30, item: ['croissant', 1], title: [3, 'Душа ярмарки'] };
  const _cc = coopCmd;
  coopCmd = function (name, json, admin) {
    let m = null;
    try { m = JSON.parse(json); } catch (e) { return; }
    if (!m || m.t !== 'fair') return _cc(name, json, admin);
    const u = coop.players.get(name);
    if (!u || !fairOn()) return;
    const ok = k => admin || coop.perms[k];
    if (m.a === 'trade' && Number.isInteger(m.i)) { if (!ok('manage')) { coopSay(name, 'Хост запретил: обмен со складов'); return; } const bad = fairTrade(m.i, name); if (bad) coopSay(name, bad); }
    else if (m.a === 'join') { const bad = fairJoin(u); if (bad) coopSay(name, bad); }
    else if (m.a === 'lot' && Number.isInteger(m.slot) && m.slot >= 0 && m.slot < u.hero.inv.length) fairLot(name, m.slot, typeof m.want === 'string' ? m.want : '', m.wn);
    else if (m.a === 'take' && Number.isInteger(m.id)) fairTake(name, m.id);
  };
  const _mir = coopMirror;
  coopMirror = function () { const m = _mir(); const f = fairMirror(); if (f) m.fair = f; return m; };
  // вещи с лотов, что не успели вернуть, — при входе игрока
  const _cj = coopJoin;
  coopJoin = function (name, json) {
    const id = _cj(name, json), u = coop.players.get(name), ret = Game.fairRet && Game.fairRet[name];
    if (u && ret) { for (const it of ret) coopAddItem(u.hero, it.k, it.n); delete Game.fairRet[name]; coopSay(name, 'Вещи с ярмарки вернулись в рюкзак'); }
    return id;
  };
  const _cl = coopLeave;
  coopLeave = function (name) {
    const F = Game.fair, u = coop.players.get(name);
    if (F && u) for (let i = F.lots.length - 1; i >= 0; i--) if (F.lots[i].owner === name) { coopAddItem(u.hero, F.lots[i].give.k, F.lots[i].give.n); F.lots.splice(i, 1); }
    return _cl(name);
  };
}

{
  // праздник не начинается в день ярмарки (и наоборот — см. fairCanStart)
  const _fcs = festCanStart;
  festCanStart = function () { if (fairOn()) return 'Сегодня ярмарка — праздник потом'; return _fcs(); };

  const _step = step;
  step = function (dt) { _step(dt); fairTick(dt); };

  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) { _ds(list, c, x0, y0, x1, y1); fairDrawList(list, c, x0, y0, x1, y1); };

  const _upd = updateUI;
  updateUI = function (force) { _upd(force); fairUI(); };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    s.fair = { day: Game.fairDay, ann: Game.fairAnn ? 1 : 0, n: Game.fairN || 0, f: Game.fair || null, ret: Game.fairRet || null };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const d = s.fair || {};
    Game.fairDay = d.day != null ? d.day : undefined; Game.fairAnn = !!d.ann; Game.fairN = d.n || 0;
    Game.fair = d.f && d.f.on ? d.f : null; Game.fairRet = d.ret || null;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.fair = null; Game.fairDay = undefined; Game.fairAnn = false; Game.fairRet = null; };

  const _start = startGame;
  startGame = function () {
    _start();
    if (FR.cHooked || typeof coopApplyInit !== 'function') return;
    FR.cHooked = true;
    const _cm = coopMirror;
    coopMirror = function (m) { _cm(m); Game.fair = m.fair || null; };
  };
  // панель живёт и между обновлениями интерфейса: таймеры конкурса тикают
  if (typeof setInterval === 'function' && typeof document !== 'undefined' && document.getElementById) setInterval(() => { if (fairOn() || FR.open) fairUI(); }, 500);
}
