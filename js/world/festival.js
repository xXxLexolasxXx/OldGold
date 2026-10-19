'use strict';
// Праздник: все бросают работу, идут к трактиру и кострам, пьют эль, пляшут и орут «ура».
// Game.festival = { on, until, left, why }: on — гуляют сейчас, until — когда кончится сегодняшний гуляй,
// left — сколько ещё дней праздника впереди (ночью гулянка прерывается и с утра продолжается).
// {on:false, wait:true} — ночная пауза многодневного праздника. Музыка слушает Game.festival.on.
// Прерывается нечистью (скелеты, призраки, ожившие деревья) и вечером. После — похмелье и пауза до следующего.

const FEST_FIRST = CYCLE * 2.2;          // не раньше чем через ~2 суток после начала игры
const FEST_GAP = [CYCLE * 4, CYCLE * 7]; // как часто случается сам (в сутках)
const FEST_MIN_LEFT = 70;                // меньше этого до вечера — праздник уже не начинаем
const FEST_MUGS = 4;                     // сколько эля нужно в трактирах, чтобы устроить праздник
const FEST_FOOD_MUL = 1;                 // дополнительный расход сытости (поверх обычного)
const HANG_TIME = 60;                    // похмелье, с (пара игровых часов)
let festSeen = new WeakSet();

function festOn() { return !!(Game.festival && Game.festival.on); }
function festDayLeft() { const c = cycleAt(Game.time); return EVE_START - c.p; }
function festDayEnd() { const c = cycleAt(Game.time); return Game.time - c.p + EVE_START; }
function festIsDay() { return !isNightNow() && !isEveningNow(); }

function festMugs() {
  let n = 0;
  for (const b of Game.buildings) if (b.type === 'inn' && b.state === 'done') n += Math.max(0, b.stock.beer - b.reserved.beer) + Math.max(0, b.stock.darkbeer - b.reserved.darkbeer);
  return n;
}
function festInns() { return Game.buildings.filter(b => b.type === 'inn' && b.state === 'done' && !b.removed); }
function festSpots() {
  const s = [];
  for (const b of Game.buildings) if ((b.type === 'inn' || b.type === 'bonfire') && b.state === 'done' && !b.removed) s.push(b);
  return s;
}

// можно ли устроить праздник сейчас; why — причина отказа
function festCanStart() {
  if (Game.festival && (Game.festival.on || Game.festival.wait)) return 'Праздник уже идёт';
  if (!festInns().length) return 'Нужен трактир';
  if (!festIsDay()) return 'Праздник устраивают только днём';
  if (festDayLeft() < FEST_MIN_LEFT) return 'Скоро вечер — праздник лучше начать с утра';
  if (festThreat()) return 'Нечисть рядом — не до праздника';
  if (festMugs() < FEST_MUGS) return 'В трактирах мало эля (нужно хотя бы ' + FEST_MUGS + ' кружки)';
  return '';
}

function festivalStart(why, days) {
  const bad = festCanStart();
  if (bad) return bad;
  if (!days) days = Math.random() < 0.35 ? 2 : 1;
  Game.festival = { on: true, until: festDayEnd(), left: days - 1, why: why || 'timer', t0: Game.time };
  Game.festWish = false;
  const txt = why === 'newyear' ? 'Новый год! Все бросили работу: гуляем у трактира, Дед Мороз уже в пути' : why === 'victory' ? 'Победа! Трактирщик ставит бочку: в деревне праздник!' : why === 'manual' ? 'Праздник! Все бросили работу и несут кружки' : 'Сегодня праздник! Все бросили дела и тянутся к трактиру';
  toast(txt + (days > 1 ? ' (два дня)' : ''));
  logEvent('festival', txt, ...festPoint());
  festCheers();
  return '';
}

function festPoint() {
  const b = festInns()[0] || festSpots()[0];
  return b ? [b.doorX + 0.5, b.doorY] : [undefined, undefined];
}

function festCheers() {
  if (Game.paused) return;
  sfxApplause(0.8);
}

function festEnd(why) {
  const f = Game.festival;
  if (!f) return;
  const drank = [];
  for (const u of Game.units) {
    if (u.festDrunk) { if (u.drunkAt === 1e9) u.drunkAt = 0; u.festDrunk = false; }
    if (u.fdrinks >= 2) { u.hangUntil = Game.time + HANG_TIME * (0.7 + Math.random() * 0.6); drank.push(u); }
    u.fdrinks = 0; u.festB = null;
  }
  Game.festival = null;
  Game.festNext = Game.time + FEST_GAP[0] + Math.random() * (FEST_GAP[1] - FEST_GAP[0]);
  const txt = why === 'evil' ? 'Нечисть испортила праздник! Гуляки разбежались по делам' : why === 'night' ? 'Стемнело — праздник окончен, гномы разбредаются' : 'Праздник кончился. Голова гудит, работа ждёт';
  toast(txt + (drank.length && why !== 'evil' ? ' (похмелье)' : ''));
  logEvent('festival', txt, ...festPoint());
  for (const u of drank.slice(0, 6)) floater(u.x, u.y - 1.3, 'Голова…', '#d8c8a0');
}

// нечисть: скелеты, видимые призраки, проснувшиеся деревья
function festThreat() {
  for (const s of Game.skels || []) if (!s.dead && s.state !== 'dead') return true;
  for (const g of Game.ghosts || []) if (!g.exo && g.alpha >= 0.3 && g.mode !== 'leave' && g.mode !== 'calm') return true;
  for (const e of Game.ents || []) if (e.state && !['sleep', 'root', 'done', 'gone', 'dying'].includes(e.state)) return true;
  return false;
}

// победа над нечистью: в следующий светлый день устроим праздник
function festScanVictory() {
  for (const s of Game.skels || []) if (s.state === 'dead' && !festSeen.has(s)) { festSeen.add(s); Game.festKills = (Game.festKills || 0) + 1; }
  for (const n of Game.neutrals || []) if (n.st === 'die' && !festSeen.has(n)) { festSeen.add(n); Game.festKills = (Game.festKills || 0) + 1; }
  if ((Game.festKills || 0) >= 3 && !Game.festWish) { Game.festWish = true; Game.festKills = 0; }
}

function festPeople() { return Game.units.filter(u => isPerson(u) && u.type !== 'hero' && u.type !== 'carter' && !u.teamOf).length; }

function festivalTick(dt) {
  Game.festT = (Game.festT || 0) + dt;
  if (Game.festT < 0.5) return;
  const step = Game.festT; Game.festT = 0;
  let f = Game.festival;
  festScanVictory();
  if (!f) {
    if (Game.festNext === undefined) Game.festNext = Math.max(Game.time, FEST_FIRST) + Math.random() * CYCLE;   // старые сохранения и новая игра
    if (festPeople() < 6 || !festIsDay()) return;
    if ((Game.festWish && Game.time > 120) || Game.time >= Game.festNext) {
      if (!festCanStart()) festivalStart(Game.festWish ? 'victory' : 'timer');
      else Game.festNext = Game.time + 60;       // не вышло (мало эля, нечисть) — попробуем чуть позже
    }
    return;
  }
  // ночная пауза: с утра многодневный праздник продолжается
  if (f.wait) {
    if (festIsDay() && festDayLeft() >= FEST_MIN_LEFT && !festThreat()) {
      Game.festival = { on: true, until: festDayEnd(), left: f.left, why: f.why, t0: Game.time };
      toast('Утро второго дня праздника: гуляем дальше!');
      logEvent('festival', 'Второй день праздника', ...festPoint());
    } else if (festDayLeft() > 0 && festDayLeft() < FEST_MIN_LEFT) festEnd('night');
    return;
  }
  if (Game.time >= f.until || !festIsDay()) {
    if (f.left > 0) { Game.festival = { on: false, wait: true, left: f.left - 1, why: f.why }; toast('Вечереет: гулянка стихает, продолжим завтра'); }
    else festEnd('night');
    festRelease();
    return;
  }
  if (festThreat()) { festEnd('evil'); return; }
  // расход: гуляки едят вдвое быстрее, на ногах все свободные
  for (const u of Game.units) {
    if (u.dead || !isPerson(u) || u.type === 'carter') continue;
    if (!u.inside && !u.brk && u.type !== 'hero') festDraft(u);
    if (u.brk && u.brk.kind === 'feast' && FEST_FOOD_MUL) u.food = Math.max(0, u.food - step / (FOOD_TIME * dif().food) * FEST_FOOD_MUL);
  }
}

function festRelease() {
  for (const u of Game.units) {
    if (u.festDrunk) { if (u.drunkAt === 1e9) u.drunkAt = 0; u.festDrunk = false; }
    if (u.fdrinks >= 2) u.hangUntil = Game.time + HANG_TIME * (0.7 + Math.random() * 0.6);
    u.fdrinks = 0; u.festB = null;
  }
}

// зазвать жителя на праздник, если он сейчас просто идёт или ждёт и ничего не несёт
function festDraft(u) {
  if (u.type === 'hero' || u.teamOf || u.carry || u.dlv || u.eat || u.hero) return;
  if (u.fleeUntil > Game.time || u.panicUntil > Game.time || u.burn || u.glide) return;
  if (!interruptible(u)) return;
  startBreak(u, 'feast', null);
  u.proc = festGen(u);
  u.fdrinks = u.fdrinks || 0;
}

// ---------- Поведение гуляки ----------

// куда тянет гуляку: трактир втрое охотнее костра, ближайшее место — чаще дальнего
function festPick(u) {
  const spots = festSpots();
  if (!spots.length) return null;
  let best = null, bs = -1;
  for (const b of spots) {
    const d = Math.hypot(b.x + b.w / 2 - u.x, b.y + b.h / 2 - u.y);
    const sc = (b.type === 'inn' ? 3 : 1) * (0.5 + Math.random()) / (1 + d / 12);
    if (sc > bs) { bs = sc; best = b; }
  }
  return best;
}

function festSpotNear(u) {
  const b = u.festB && !u.festB.removed ? u.festB : (u.festB = festPick(u));
  if (!b) return null;
  const cx = b.type === 'inn' ? b.doorX : b.x + b.w / 2, cy = b.type === 'inn' ? b.doorY + 1.5 : b.y + b.h + 1;
  return randomFreeNear(Math.floor(cx), Math.floor(cy), 1, 4.5, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)] && !World.door[idx(x, y)]);
}

function festTakeMug(u) {
  let best = null, bd = 1e9;
  for (const b of festInns()) {
    const dark = b.stock.darkbeer - b.reserved.darkbeer > 0, light = b.stock.beer - b.reserved.beer > 0;
    if (!dark && !light) continue;
    const d = Math.hypot(b.doorX - u.x, b.doorY - u.y);
    if (d < bd) { bd = d; best = [b, dark && (!light || Math.random() < 0.3) ? 'darkbeer' : 'beer']; }
  }
  if (!best) return false;
  best[0].stock[best[1]]--;
  u.food = Math.min(1.2, u.food + (best[1] === 'darkbeer' ? 0.1 : 0.05));
  u.fdrinks = (u.fdrinks || 0) + 1;
  if (u.fdrinks >= 2 && !u.drunkAt) { u.drunkAt = 1e9; u.festDrunk = true; }       // метка для походки и «ик!»
  return true;
}

function* festGen(u) {
  let first = true, tries = 0;
  while (festOn() && !u.dead && tries++ < 200) {
    // голодному — сначала поесть по-настоящему
    if (u.food < HUNGRY && Game.time >= (u.nextEatTry || 0)) {
      const inn = findInn(u);
      if (inn) { yield* eatGen(u, inn); continue; }
      u.nextEatTry = Game.time + 15;
    }
    const fb = u.festB && !u.festB.removed ? u.festB : null;
    const near = fb && Math.hypot((fb.x + fb.w / 2) - u.x, (fb.y + fb.h / 2) - u.y) < 7;
    if (first || !near || Math.random() < 0.15) {
      if (!first && Math.random() < 0.3) u.festB = null;
      first = false;
      const s = festSpotNear(u);
      if (s) yield { walk: s, offroad: true };
      if (!festOn()) return;
    }
    const tip = u.fdrinks || 0;
    const r = Math.random();
    if (r < 0.34 && tip < 7 && festMugs() > 0) yield* festDrinkGen(u);
    else if (r < 0.58) yield* festDanceGen(u);
    else if (r < 0.70) yield* festCheerGen(u);
    else if (r < 0.80) yield* festFiveGen(u);
    else if (r < 0.88 && tip >= 3) yield* festStumbleGen(u);
    else if (r < 0.94) yield* festSingGen(u);
    else yield { wait: 1 + Math.random() * 2 };
  }
}

function* festDrinkGen(u) {
  if (!festTakeMug(u)) { yield { wait: 1 }; return; }
  u.flaskT = Game.time + 6; u.flaskClinkAt = 0;
  yield { wait: 0.9, anim: 'flaskout' };
  let mate = null;
  for (const o of Game.units) {
    if (o === u || o.dead || o.inside || !(o.flaskT > Game.time) || o.flaskClinkAt > Game.time - 3) continue;
    if (Math.hypot(o.x - u.x, o.y - u.y) <= 1.6) { mate = o; break; }
  }
  if (mate) {
    u.face = mate.x > u.x ? 1 : -1; u.vdir = 'E';
    yield { wait: 0.3 };
    u.flaskClinkAt = mate.flaskClinkAt = Game.time;
    const mx = (u.x + mate.x) / 2, my = (u.y + mate.y) / 2 - 1.1;
    fxBurst(mx * TILE, my * TILE, 7, ['#fff2a0', '#e8b030', '#ffffff'], 40, 30, 0.3, 1.2, 100);
    floater(mx, my - 0.4, 'Чин-чин!', '#fff2a0');       // звон кружек — по надписи (FLOAT_SFX), чтобы слышали и в коопе
  } else sfxAt('mug', u.x * TILE, u.y * TILE, 0.6);
  yield { wait: 1.6 + Math.random() * 0.6, anim: 'drink' };
  u.flaskT = 0;
  if (u.fdrinks >= 3 && Math.random() < 0.5) floater(u.x, u.y - 1.2, 'Ик!', '#e8d890');
}

function* festDanceGen(u) {
  const beats = 10 + ((Math.random() * 8) | 0);
  u.fun = { k: 'dance', t0: Game.time, until: Game.time + beats * 0.5 + 0.5 };
  floater(u.x, u.y - 1.4, Math.random() < 0.5 ? 'Тра-ля-ля!' : 'Эх, раз!', '#ffd0f0');
  for (let k = 0; k < beats && festOn(); k++) {
    u.face = -u.face;
    if (k % 3 === 0) floater(u.x + (k % 2 ? 0.5 : -0.5), u.y - 1.6, '♪', '#fff2a0');
    if (k % 2 === 0) sfxAt('five', u.x * TILE, u.y * TILE, 0.3);        // топот и хлопки
    yield { wait: 0.5 };
  }
  u.fun = null;
}

function* festCheerGen(u) {
  u.gest = 'clap'; u.gestUntil = Game.time + 2.4;
  floater(u.x, u.y - 1.3, ['Ура!', 'Хо-хо!', 'За деревню!', 'Эля!'][(Math.random() * 4) | 0], '#fff2a0');
  yield { wait: 1.2 };
  fxBurst(u.x * TILE, u.y * TILE - 24, 8, ['#ff7aa8', '#ffe060', '#8ac8ff', '#9be070'], 34, 40, 0.8, 1.4, 140);   // конфетти
  yield { wait: 1.2 };
}

function* festFiveGen(u) {
  for (const o of Game.units) {
    if (o === u || o.dead || o.inside || !isPerson(o) || o.type === 'carter' || (o.fiveCD || 0) > Game.time || (u.fiveCD || 0) > Game.time) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d > 0.3 && d < 2.2) { highFive(u, o); yield { wait: 1.5 }; return; }
  }
  yield { wait: 0.8 };
}

function* festStumbleGen(u) {
  floater(u.x, u.y - 1.2, 'Бух!', '#d8c8a0');
  u.ouchUntil = Game.time + 1.2;
  yield { wait: 1.5, anim: 'knocked' };
  u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;
  yield { wait: 1.2 };
}

function* festSingGen(u) {
  floater(u.x, u.y - 1.4, '♪ ♫', '#fff2a0');
  u.gest = 'wave'; u.gestUntil = Game.time + 2.4;
  yield { wait: 2.4 };
}

// ---------- Звук ----------

if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined') {
  // звон кружек
  SFX.mug = (d, t, v) => {
    const f0 = 2700 + v * 500;
    tone(d, 'sine', f0, f0 * 0.99, t, 0.4, 0.2, 0.001);
    tone(d, 'sine', f0 * 1.52, f0 * 1.5, t, 0.28, 0.12, 0.001);
    tone(d, 'sine', f0 * 2.1, f0 * 2.08, t, 0.18, 0.07, 0.001);
  };
  SFX_DEF.mug = { pri: 1, gain: 0.4, poly: 3, cd: 0.1, len: 0.45 };
  // «Ура!» и застольная песня — голосом гнома; идут от надписей над головой (FLOAT_SFX), поэтому слышны и клиентам коопа
  SFX.cheer = (d, t, v) => gnomeVoice(d, t, [[300 + v * 60, 520, 0.1], [520, 470, 0.22]], 0.4, 1050);
  SFX_DEF.cheer = { pri: 1, gain: 0.4, poly: 2, cd: 0.3, len: 0.5 };
  SFX.sing = (d, t, v) => gnomeVoice(d, t, [[260 + v * 40, 330, 0.3], [330, 390, 0.3], [390, 300, 0.45]], 0.35, 900);
  SFX_DEF.sing = { pri: 1, gain: 0.35, poly: 1, cd: 0.8, len: 1.2 };
  if (typeof FLOAT_SFX !== 'undefined') {
    for (const t of ['Ура!', 'Хо-хо!', 'За деревню!', 'Эля!']) FLOAT_SFX[t] = 'cheer';
    FLOAT_SFX['♪ ♫'] = 'sing'; FLOAT_SFX['Чин-чин!'] = 'mug'; FLOAT_SFX['Ик!'] = 'hic';
  }
}

// ---------- Сохранение и кооп ----------

function serializeFestival() {
  const f = Game.festival;
  if (!f && Game.festNext === undefined && !Game.festWish) return undefined;
  return { f: f ? { on: !!f.on, wait: !!f.wait, until: f.until || 0, left: f.left || 0, why: f.why || '' } : null, nx: Game.festNext, wish: Game.festWish ? 1 : 0 };
}

function applyFestival(s) {
  Game.festival = null; Game.festNext = undefined; Game.festWish = false; Game.festKills = 0;
  if (!s) return;
  Game.festNext = s.nx;
  Game.festWish = !!s.wish;
  if (s.f && (s.f.on || s.f.wait)) Game.festival = { on: !!s.f.on, wait: !!s.f.wait, until: s.f.until, left: s.f.left || 0, why: s.f.why, t0: Game.time };
}

// ---------- Украшения ----------
// Гирлянды с флажками между фонарями, у трактира — флажки на крыше и бочки, над ним сыплется конфетти.

const FEST_COLS = ['#e84a4a', '#f0c030', '#4a9ae8', '#5cc060', '#e87ab8', '#f08a30'];
let festDeco = { at: -99, lamps: [] };

function festLampPairs() {
  if (Game.time - festDeco.at < 8 && Game.time >= festDeco.at) return festDeco.lamps;
  const lamps = [];
  for (let i = 0; i < N_TILES; i++) {
    const o = World.obj[i];
    if (o && o.t === 'lamp' && (o.born === undefined || Game.time - o.born > GROW_T)) lamps.push([i % MAP_W, (i / MAP_W) | 0]);
  }
  const pairs = [], used = new Set();
  for (const a of lamps) {
    let best = null, bd = 1e9;
    for (const b of lamps) {
      if (a === b) continue;
      const k = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? a[0] + ',' + a[1] + '|' + b[0] + ',' + b[1] : b[0] + ',' + b[1] + '|' + a[0] + ',' + a[1];
      if (used.has(k)) continue;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d >= 1.5 && d <= 7 && d < bd) { bd = d; best = [b, k]; }
    }
    if (best) { used.add(best[1]); pairs.push([a, best[0]]); }
  }
  festDeco = { at: Game.time, lamps: pairs };
  return pairs;
}

// верёвка со складкой и флажками между точками (мировые пиксели)
function festBunting(c, x1, y1, x2, y2, sag, seed) {
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(len / 9));
  c.strokeStyle = '#3a2a1c'; c.lineWidth = 1;
  c.beginPath();
  const pt = k => [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k + Math.sin(k * Math.PI) * sag];
  c.moveTo(x1, y1);
  for (let k = 1; k <= 20; k++) { const p = pt(k / 20); c.lineTo(p[0], p[1]); }
  c.stroke();
  for (let k = 0; k < n; k++) {
    const q = (k + 0.5) / n, p = pt(q), sw = Math.sin(Game.time * 3 + k + seed) * 0.7;
    c.fillStyle = FEST_COLS[(k + seed) % FEST_COLS.length];
    c.beginPath(); c.moveTo(p[0] - 2.2, p[1]); c.lineTo(p[0] + 2.2, p[1]); c.lineTo(p[0] + sw, p[1] + 5); c.closePath(); c.fill();
  }
}

function festDrawBarrel(c, px, py) {
  shadowAt(c, px, py, 7);
  c.fillStyle = '#6a4220'; c.fillRect(px - 5, py - 11, 10, 11);
  c.fillStyle = '#8a5a30'; c.fillRect(px - 5, py - 11, 3, 11);
  c.fillStyle = '#3a3a40'; c.fillRect(px - 5, py - 8, 10, 1); c.fillRect(px - 5, py - 3, 10, 1);
  c.fillStyle = '#e8b030'; c.fillRect(px + 1, py - 6, 2, 2);             // кран с пивом
}

function festDrawList(list, c, x0, y0, x1, y1) {
  if (!festOn() || typeof World === 'undefined') return;
  // гирлянды между фонарями — поверх всего
  const pairs = festLampPairs();
  list.push([1e5, () => {
    for (const [a, b] of pairs) {
      if (a[0] < x0 - 8 && b[0] < x0 - 8 || a[0] > x1 + 8 && b[0] > x1 + 8 || a[1] < y0 - 8 && b[1] < y0 - 8 || a[1] > y1 + 8 && b[1] > y1 + 8) continue;
      festBunting(c, a[0] * TILE + 22, a[1] * TILE - 8, b[0] * TILE + 22, b[1] * TILE - 8, 7, a[0] + a[1]);
    }
  }]);
  for (const b of Game.buildings) {
    if (b.type !== 'inn' || b.state !== 'done' || b.x + b.w < x0 - 2 || b.x > x1 + 2 || b.y > y1 + 2 || b.y + b.h < y0 - 2) continue;
    const wx = b.x * TILE, wy = (b.y + b.h) * TILE;
    // флажки по фасаду и над входом
    list.push([1e5, () => {
      festBunting(c, wx + 4, wy - 52, wx + b.w * TILE - 4, wy - 52, 9, b.id);
      festBunting(c, wx + 4, wy - 30, wx + b.w * TILE - 4, wy - 30, 7, b.id + 2);
      // конфетти падает над трактиром
      for (let k = 0; k < 16; k++) {
        const ph = (Game.time * (0.5 + (k % 5) * 0.12) + k * 0.37) % 1;
        const cx = wx + ((k * 53 + Math.sin(Game.time + k) * 6) % (b.w * TILE + 30)) - 10, cy = wy - 78 + ph * 78;
        c.fillStyle = FEST_COLS[k % FEST_COLS.length];
        c.fillRect(Math.round(cx), Math.round(cy), 2, 2);
      }
    }]);
    // бочки у входа
    list.push([b.y + b.h + 0.3, () => { festDrawBarrel(c, (b.doorX - 1) * TILE + 8, (b.doorY + 1) * TILE + 6); festDrawBarrel(c, (b.doorX + 2) * TILE + 12, (b.doorY + 1) * TILE + 8); }]);
  }
}
