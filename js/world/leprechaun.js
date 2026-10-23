'use strict';
// Лепреконы: нейтралы у золотых рудников. Неуязвимы (удар проходит насквозь, магия отскакивает), обожают золото.
// Ошиваются у рудника, пляшут ирландскую джигу под скрипку и флейту, а завидев гнома с золотом (или героя с кошельком),
// предлагают «перетянуть слиток». Исход решает бросок — шанс гнома растёт с силой и ловкостью героя, у плута он выше всех:
//   (а) лепрекон выиграл: прыжок, из воздуха возникает горшок с радугой, он ныряет внутрь, горшок и радуга исчезают;
//   (б) выиграл гном: звонкая пощёчина «ПЛЯК», лепрекон держится за щёку и грустно растворяется в зелёных искрах.
// Золото берётся только в малых долях: ≤ LEP_STAKE за раз, ≤ LEP_WIN_CAP за 10 минут; со склада — не ниже LEP_KEEP
// и только если школе не нужно золото; у героя — из кошеля (рюкзака). Пощёчина возвращает украденное.
// Симуляция — там же, где вся игра (в кооперативе — сервер); клиенты получают лепреконов зеркалом (lepMirror).
// Своя архитектура, как у neutrals.js: подключается после него, оборачивает resolveCmd/runCmd/step/сохранение/рисование.
// Кадры — leprechaunart.js (лист: leprechaun.html).

const LEP_STAKE = 3;            // больше стольких монет за один спор не уходит
const LEP_KEEP = 2;             // на складе всегда остаётся не меньше
const LEP_WIN_CAP = 9;          // за окно LEP_WIN_SEC украдено не больше
const LEP_WIN_SEC = 600;
const LEP_SENSE = 11;           // с какого расстояния видит золото
const LEP_HOME_R = 4.5;         // как далеко отходит от рудника
const LEP_CD = [160, 300];      // отдых рудника без лепрекона после ухода
const LEP_SPEED = 2.7;
const LEP_DUEL_MAX = 25;        // спор длится ~6 с; дольше — застрял, исчезает в радуге
const LEP_GONE_MAX = 8;         // «ушёл», а горшок не растаял
const LEP_STUCK_MAX = 12;       // идёт к цели или бродит, а с места не сдвинулся
const LEP_GOLD_LOAD = new Set(['gold', 'goldore']);

Game.lepr = [];
Game.lepMine = {};
const lepStatNew = () => ({ steals: 0, slaps: 0, stolen: 0, returned: 0, owed: 0, dances: 0, teases: 0, winT: 0, winAmt: 0 });
Game.lepStat = lepStatNew();

const lepRand = (a, b) => a + Math.random() * (b - a);
const lepMirrorOn = () => typeof isMirror === 'function' && isMirror();
const lepName = u => (u.hero ? u.hero.name : typeof unitTitle === 'function' ? unitTitle(u) : 'гном');

// ---------- Исходы: сценарий спора ----------
// [кадр, секунд, событие в начале шага]
const LEP_SEQ_TUG = [['x0', 0.4, 'lunge'], ['t0', 0.2, 'tug'], ['t1', 0.2], ['t2', 0.22], ['t1', 0.2], ['t0', 0.2], ['t2', 0.22], ['t1', 0.2], ['t2', 0.3]];
const LEP_SEQ_STEAL = [['x1', 0.55, 'steal'], ['i3', 0.55, 'ha'], ['x2', 0.45, 'dive'], ['x3', 0.35, 'plop'], ['x3', 0.2, 'hide'], ['', 1.0, 'poof']];
const LEP_SEQ_SLAP = [['l0', 0.5, 'windup'], ['l1', 0.3, 'slap'], ['l2', 0.28], ['l3', 0.28], ['l4', 0.5, 'sad'], ['l5', 0.6], ['l4', 0.3], ['l6', 0.35, 'melt'], ['l7', 0.35], ['l8', 0.4]];
const lepSum = seq => seq.reduce((a, s) => a + s[1], 0);

// ---------- Рождение у рудника ----------

function lepMineList() { return Game.buildings.filter(b => b.type === 'goldmine' && b.state === 'done' && !b.removed); }

function lepMake(b) {
  let x = b.doorX + 0.5 + lepRand(-1.5, 1.5), y = b.doorY + 1.6 + lepRand(0, 1);
  if (!isWalkable(Math.floor(x), Math.floor(y))) { x = b.doorX + 0.5; y = b.doorY + 1.5; }
  return {
    id: Game.nextId++, mine: b.id, x, y, hx: b.doorX + 0.5, hy: b.doorY + 1.6, face: Math.random() < 0.5 ? 1 : -1, st: 'idle', t: lepRand(1, 3),
    fr: 'i0', ph: Math.random() * 6, tg: 0, cd: Game.time + lepRand(8, 25), scanT: 1, wx: 0, wy: 0, dEnd: 0, jigT: 0, dT0: 0,
    seq: null, si: 0, sT: 0, d: null, ev: '', evN: 0, hide: false, z: 0, sink: 0, potX: 0, potY: 0, potT: 0, potA: 0, rbP: 0, rbA: 0, rbD: 1, tug: 0, gx: 0, gy: 0, born: Game.time,
  };
}

function lepSpawnTick() {
  const mines = lepMineList(), st = Game.lepStat;
  for (const b of mines) {
    if (Game.lepr.some(L => L.mine === b.id)) continue;
    if (Game.lepMine[b.id] === undefined) Game.lepMine[b.id] = Game.time + lepRand(20, 70);
    if (Game.time < Game.lepMine[b.id]) continue;
    const L = lepMake(b);
    Game.lepr.push(L);
    fxBurst(L.x * TILE, L.y * TILE - 10, 14, ['#7ae070', '#fff6b0', '#3aa850'], 50, 50, 0.7, 1.5, 40);
    sfxAt('chime', L.x * TILE, L.y * TILE, 0.5);
    logEvent('gold', 'У золотого рудника завёлся лепрекон: гномам — приглядывать за золотом, лепрекону — за гномами', L.x, L.y);
  }
  // рудник снесён — лепрекон уходит в радугу
  for (const L of Game.lepr) if (!Game.buildings.some(b => b.id === L.mine && !b.removed) && L.st !== 'duel' && L.st !== 'gone') { L.st = 'gone'; L.hide = true; fxBurst(L.x * TILE, L.y * TILE - 10, 14, ['#7ae070', '#fff6b0'], 50, 50, 0.7, 1.5, 40); }
  if (Game.time - st.winT > LEP_WIN_SEC) { st.winT = Game.time; st.winAmt = 0; }
}

// ---------- Золото: сколько можно взять ----------

const lepPurse = H => (H && H.inv ? H.inv.reduce((a, s) => a + (s && s.k === 'gold' ? s.n : 0), 0) : 0);
function lepPurseTake(H, n) {
  let got = 0;
  for (let i = 0; i < (H.inv || []).length && got < n; i++) {
    const s = H.inv[i];
    if (!s || s.k !== 'gold') continue;
    const t = Math.min(s.n, n - got); s.n -= t; got += t;
    if (s.n <= 0) H.inv[i] = null;
  }
  return got;
}
function lepSchoolNeedsGold() { return Game.buildings.some(b => b.type === 'school' && b.state === 'done' && b.queue && b.queue.length && b.stock.gold < 2); }
function lepStoreFree() {
  if (lepSchoolNeedsGold()) return 0;            // золото критично: школа и найм не должны голодать
  let have = 0;
  for (const s of Game.buildings) if (!s.removed && s.isStore && s.isStore()) have += Math.max(0, s.offer('gold'));
  return Math.max(0, have - LEP_KEEP);
}
function lepStoreTake(n) {
  const free = lepStoreFree();
  n = Math.min(n, free);
  let left = n;
  const stores = Game.buildings.filter(s => !s.removed && s.isStore && s.isStore()).sort((a, b) => b.offer('gold') - a.offer('gold'));
  for (const s of stores) { if (left <= 0) break; const t = Math.min(left, Math.max(0, s.offer('gold'))); s.stock.gold -= t; left -= t; }
  return n - left;
}
// доля, которую можно поставить на кон при споре с u (0 — спорить не из-за чего)
function lepStakeFor(u) {
  const st = Game.lepStat, room = LEP_WIN_CAP - st.winAmt;
  if (room <= 0) return 0;
  const avail = u.hero ? lepPurse(u.hero) : lepStoreFree();
  return Math.max(0, Math.min(LEP_STAKE, room, avail));
}
const lepCarries = u => !!u.carry && LEP_GOLD_LOAD.has(u.carry);
function lepTargetOk(u) {
  if (u.dead || u.inside || !isPerson(u) || !interruptible(u)) return false;
  if (u.hero) return lepPurse(u.hero) > 0 && u.hero.hp > 0;
  if (u.rec && u.rec.hp != null && u.rec.hp <= 0) return false;
  return lepCarries(u);
}

// Шанс, что выиграет ГНОМ (пощёчина): сила и ловкость героя, класс (плут чаще всех), уровень рекрута, размер ставки
function lepGnomeWin(u, stake) {
  let p = 0.34 + 0.02 * Math.min(3, stake);        // гномы тоже любят золото: чем больше ставка, тем упрямее
  const cls = unitCls(u);
  if (u.hero) { const s = heroStats(u.hero); p += s.str * 0.011 + s.agi * 0.006; }
  else if (u.rec) p += 0.03 * Math.min(8, u.rec.lvl || 1);
  else if (u.lvl) p += 0.02 * Math.min(6, u.lvl - 1);
  const CB = { rogue: 0.2, bard: 0.12, monk: 0.07, warrior: 0.05, barbarian: 0.05, archer: 0.03, paladin: 0.02, mage: -0.03, druid: -0.02, priest: 0.0 };
  if (cls && CB[cls] !== undefined) p += CB[cls];
  return Math.max(0.15, Math.min(0.88, p));
}

function lepFindTarget(L) {
  if (Game.lepStat.winAmt >= LEP_WIN_CAP) return null;
  let best = null, bd = LEP_SENSE;
  for (const u of Game.units) {
    if (!lepTargetOk(u)) continue;
    const d = Math.hypot(u.x - L.x, u.y - L.y);
    if (d < bd && lepStakeFor(u) > 0) { bd = d; best = u; }
  }
  return best;
}

// ---------- Движение ----------

// препятствие на пути: пробуем шаг под углом 45° и 90° в обе стороны (простой обход стены и забора без поиска пути)
function lepSidestep(L, ux, uy, st, ok) {
  const side = L.sideDir || (L.sideDir = Math.random() < 0.5 ? 1 : -1);
  for (const a of [0.8, 1.57, 2.4]) for (const sg of [side, -side]) {
    const c = Math.cos(a * sg), s = Math.sin(a * sg);
    const nx = L.x + (ux * c - uy * s) * st * 1.5, ny = L.y + (ux * s + uy * c) * st * 1.5;
    if (ok(nx, ny)) { L.x = nx; L.y = ny; L.sideDir = sg; L.ph += st * 3.4; return true; }
  }
  return false;
}

// Страховка: лепрекон не должен застревать ни в споре, ни в уходе, ни внутри стены. Не вышло по-хорошему — растворяется в радуге.
function lepVanish(L, why) {
  fxBurst(L.x * TILE, L.y * TILE - 10, 16, ['#7ae070', '#fff6b0', '#ffffff', '#4ab4ff'], 60, 60, 0.8, 1.6, 20);
  sfxAt('chime', L.x * TILE, L.y * TILE, 0.5);
  L.st = 'gone'; L.hide = true; L.d = null; L.seq = null; L.tug = 0; L.potOn = false; L.potFade = false; L.potA = 0; L.rbA = 0; L.dead = true;
  Game.lepMine[L.mine] = Game.time + lepRand(LEP_CD[0], LEP_CD[1]) * (dif().neuResp || 1);
  Game.lepStat.vanished = (Game.lepStat.vanished || 0) + 1;
  if (Game.lepStat.vanished <= 3) logEvent('gold', 'Лепрекон растворился в радуге — видимо, надоело', L.x, L.y);
  void why;
}

function lepWatchdog(L, dt) {
  if (L.wdSt !== L.st) { L.wdSt = L.st; L.wdT = 0; L.wdX = L.x; L.wdY = L.y; return false; }
  const moving = L.st === 'go' || L.st === 'roam';
  if (moving && Math.hypot(L.x - L.wdX, L.y - L.wdY) > 0.5) { L.wdT = 0; L.wdX = L.x; L.wdY = L.y; return false; }
  L.wdT += dt;
  const lim = L.st === 'duel' ? LEP_DUEL_MAX : L.st === 'gone' ? LEP_GONE_MAX : moving ? LEP_STUCK_MAX : 1e9;
  if (L.wdT > lim) { lepVanish(L, L.st); return true; }
  // оказался в непроходимой клетке (на него поставили дом, сдвинулось препятствие) — на место, у рудника
  if (!L.hide && L.st !== 'duel' && !isWalkable(Math.floor(L.x), Math.floor(L.y))) {
    const near = randomFreeNear(Math.floor(L.hx), Math.floor(L.hy), 0, 3, (x, y) => isWalkable(x, y));
    if (near) { L.x = near[0] + 0.5; L.y = near[1] + 0.5; L.st = 'idle'; L.t = 2; }
    else { lepVanish(L, 'wall'); return true; }
  }
  return false;
}

function lepMove(L, tx, ty, spd, dt) {
  const dx = tx - L.x, dy = ty - L.y, d = Math.hypot(dx, dy);
  if (d < 0.06) return true;
  const st = Math.min(d, spd * dt), nx = L.x + dx / d * st, ny = L.y + dy / d * st;
  const ok = (x, y) => isWalkable(Math.floor(x), Math.floor(y));
  if (ok(nx, ny)) { L.x = nx; L.y = ny; }
  else if (ok(nx, L.y)) L.x = nx;
  else if (ok(L.x, ny)) L.y = ny;
  else if (lepSidestep(L, dx / d, dy / d, st, ok)) { /* обошёл препятствие боком */ }
  else { L.stuck = (L.stuck || 0) + dt; if (L.stuck > 0.8) { L.stuck = 0; return true; } return false; }
  if (Math.abs(dx) > 0.05) L.face = dx > 0 ? 1 : -1;
  L.ph += st * 3.4;
  return d - st < 0.08;
}

// ---------- События (звук и блеск; на клиентах — тот же код по счётчику evN) ----------

function lepEvent(L, ev) { L.ev = ev; L.evN = (L.evN || 0) + 1; lepFx(L, ev); }

function lepFx(L, ev) {
  const px = L.x * TILE, py = L.y * TILE - 12, gold = ['#fff6a0', '#ffd84a', '#ffffff'];
  switch (ev) {
    case 'lunge': floater(L.x, L.y - 2.3, ['Моё!', 'Золотишко!', 'Дай подержать!'][(L.id + Math.floor(Game.time)) % 3], '#9af070'); sfxAt('coins', px, py, 0.8); break;
    case 'tug': sfxAt('coins', px, py, 0.55); break;
    case 'steal': floater(L.x, L.y - 2.4, 'Ха-ха-ха!', '#ffe070'); sfxAt('coins', px, py, 1); sfxAt('lepHa', px, py, 0.9, 0.15); fxBurst(px, py - 4, 18, gold, 70, 90, 0.9, 1.8, 150); break;
    case 'ha': fxBurst(L.potX * TILE, L.potY * TILE - 8, 22, ['#ffffff', '#ffe84a', '#4ab4ff', '#ff9ad8', '#7ae070'], 60, 70, 1.0, 1.6, 0); sfxAt('chime', L.potX * TILE, L.potY * TILE, 0.7); break;
    case 'dive': sfxAt('whoosh', px, py, 0.6); break;
    case 'plop': sfxAt('coins', L.potX * TILE, L.potY * TILE, 0.9); fxBurst(L.potX * TILE, L.potY * TILE - 14, 14, gold, 50, 70, 0.8, 1.6, 200); break;
    case 'poof': fxBurst(L.potX * TILE, L.potY * TILE - 12, 26, ['#ffffff', '#ffe84a', '#4ab4ff', '#ff9ad8', '#7ae070', '#b05aff'], 90, 90, 1.2, 1.6, -10); sfxAt('chime', L.potX * TILE, L.potY * TILE, 0.8); break;
    case 'windup': sfxAt('whoosh', px, py, 0.7); break;
    case 'slap': floater(L.x, L.y - 2.5, 'ПЛЯК!', '#ffe070'); sfxAt('slap', px, py, 1); fxBurst(px + L.face * 4, py - 6, 14, ['#ffffff', '#fff6a0', '#ffd84a'], 80, 40, 0.5, 1.8, 120); break;
    case 'sad': floater(L.x, L.y - 2.2, 'Ну вот…', '#cfe8c0'); break;
    case 'melt': sfxAt('chime', px, py, 0.5); fxBurst(px, py + 2, 24, ['#7ae070', '#b8ffb0', '#3aa850', '#e8ffe0'], 40, 60, 1.3, 1.6, -40); break;
    case 'jig': sfxAt('jig', px, py, 1); break;
    case 'tease': floater(L.x, L.y - 2.3, ['Мимо!', 'Щекотно!', 'Хи-хи!'][(L.id + Math.floor(Game.time)) % 3], '#9af070'); sfxAt('lepHa', px, py, 0.7); break;
    case 'click': fxBurst(px, py + 10, 4, ['#fff6b0', '#ffffff'], 30, 20, 0.3, 1.2, 100); break;
  }
}

// ---------- Спор ----------

function lepStartDuel(L, u) {
  const stake = lepStakeFor(u);
  if (stake <= 0 || !interruptible(u)) { L.st = 'idle'; L.t = 2; L.cd = Game.time + 20; return; }
  const gnomeWins = Math.random() < lepGnomeWin(u, stake);
  L.st = 'duel'; L.tg = u.id;
  L.face = u.x >= L.x ? 1 : -1; u.face = -L.face; u.vdir = 'E';
  // встали вплотную: лепрекон — с той стороны, откуда пришёл
  const dx = L.x - u.x, dy = L.y - u.y, d = Math.hypot(dx, dy) || 1;
  const nx = u.x + dx / d * 1.0, ny = u.y + dy / d * 1.0;
  if (isWalkable(Math.floor(nx), Math.floor(ny))) { L.x = nx; L.y = ny; }
  L.d = { u: u.id, slap: gnomeWins, stake, got: 0 };
  L.seq = LEP_SEQ_TUG.concat(gnomeWins ? LEP_SEQ_SLAP : LEP_SEQ_STEAL);
  L.si = -1; L.sT = 99; L.tug = 0; L.hide = false; L.z = 0; L.sink = 0;
  const tugT = lepSum(LEP_SEQ_TUG), total = lepSum(L.seq) - (gnomeWins ? 0 : 1.0);   // горшок тает уже без гнома
  startBreak(u, 'lep', lepGnomeGen(u, gnomeWins, tugT, total));
  L.gx = u.x; L.gy = u.y;
}

function* lepGnomeGen(u, gnomeWins, tugT, total) {
  yield { wait: tugT, anim: 'build' };                                                  // перетягивают слиток
  if (gnomeWins) { yield { wait: 0.8, anim: 'chop' }; yield { wait: Math.max(0.1, total - tugT - 0.8) }; }    // замах и пощёчина
  else yield { wait: Math.max(0.1, total - tugT) };                                      // стоит с пустыми руками
}

function lepGnomeUnit(L) { return L.d ? Game.unitMap.get(L.d.u) || null : null; }

// шаг сценария: кадры берутся из таблицы, события — один раз при входе в шаг
function lepSeqStep(L, dt) {
  const u = lepGnomeUnit(L);
  if (!u || u.dead || (u.hero && u.hero.hp <= 0 && L.d && !L.d.slap)) { lepAbort(L); return; }
  L.sT += dt;
  while (L.si < 0 || L.sT >= L.seq[L.si][1]) {
    if (L.si >= 0) L.sT -= L.seq[L.si][1];
    L.si++;
    if (L.si >= L.seq.length) { lepFinish(L, u); return; }
    const s = L.seq[L.si];
    L.fr = s[0] || L.fr;
    if (s[2]) lepSeqEvent(L, u, s[2]);
    if (L.si === 0) L.sT = Math.max(0, L.sT - 99);          // первый шаг стартует с нуля
  }
  const s = L.seq[L.si], k = L.sT / s[1];
  L.fr = s[0] || L.fr;
  L.gx = u.x; L.gy = u.y;
  // нырок: дуга от места победы к горшку; потом погружение
  if (s[2] === 'dive') { const e = k * k * (3 - 2 * k); L.x = L.dx0 + (L.potX - L.dx0) * e; L.y = L.dy0 + (L.potY - L.dy0) * e; L.z = Math.sin(Math.min(1, k) * Math.PI) * 24; }
  else if (s[2] === 'plop') { L.z = 0; L.sink = k * 0.9; }
  else if (s[2] === 'hide') L.sink = 0.9 + k * 0.1;
  // горшок вырастает, радуга тянется, затем всё тает
  if (L.potOn && !L.potFade) {
    L.potT = Math.min(1, L.potT + dt / 0.9); L.potA = 1;
    L.rbP = Math.min(1, L.rbP + dt / 1.3); L.rbA = 1;
  }
  if (L.potFade) { L.potA = Math.max(0, L.potA - dt / 0.9); L.rbA = Math.max(0, L.rbA - dt / 0.7); }
  // щелчки каблуков — не в споре
}

function lepSeqEvent(L, u, ev) {
  const d = L.d;
  switch (ev) {
    case 'lunge': lepEvent(L, 'lunge'); break;
    case 'tug': L.tug = 1; lepEvent(L, 'tug'); break;
    case 'steal': {
      L.tug = 0;
      // золото уходит: у героя — из кошеля, у гнома — со склада (не ниже LEP_KEEP, и только если школе не нужно)
      d.got = u.hero ? lepPurseTake(u.hero, d.stake) : lepStoreTake(d.stake);
      const st = Game.lepStat; st.steals++; st.stolen += d.got; st.owed += d.got; st.winAmt += d.got;
      L.potOn = true; L.potT = 0; L.potA = 0.01; L.rbP = 0; L.rbA = 0.01; L.potFade = false; L.hide = false;
      L.rbD = -L.face; L.potX = L.x - L.face * 1.15; L.potY = L.y + 0.12;
      if (!isWalkable(Math.floor(L.potX), Math.floor(L.potY))) { L.potX = L.x; L.potY = L.y + 0.9; }
      L.dx0 = L.x; L.dy0 = L.y;
      u.gest = 'fist'; u.gestUntil = Game.time + 2.6; u.gestFace = u.face;
      lepEvent(L, 'steal');
      if (d.got > 0) {
        const who = lepName(u);
        logEvent('gold', `Лепрекон выиграл спор за слиток у ${who}: золото ×${d.got} утекло в горшок на конце радуги`, L.x, L.y);
        floater(u.x, u.y - 2.2, '−' + d.got + ' золота', '#ff8a70');
        if (typeof chronAdd === 'function') chronAdd('animal', `${chronWhen()} лепрекон у золотого рудника перетянул слиток у ${who} и скрылся в горшке с радугой (золото ×${d.got}). Горшок так и не нашли — искали, как всегда, не там.`, 1);
      } else logEvent('gold', `Лепрекон выиграл спор у ${lepName(u)}, но слиток оказался пустышкой — ушёл по радуге ни с чем`, L.x, L.y);
      break;
    }
    case 'ha': lepEvent(L, 'ha'); break;
    case 'dive': L.dx0 = L.x; L.dy0 = L.y; lepEvent(L, 'dive'); break;
    case 'plop': L.x = L.potX; L.y = L.potY; lepEvent(L, 'plop'); break;
    case 'hide': L.hide = true; break;
    case 'poof': L.potFade = true; lepEvent(L, 'poof'); break;
    case 'windup': L.tug = 0; lepEvent(L, 'windup'); break;
    case 'slap': {
      L.hide = false;
      const st = Game.lepStat; st.slaps++;
      // пощёчина возвращает украденное: что лепрекон наворовал раньше — выпадает из карманов (и одна монета «за моральный ущерб»)
      const ret = Math.min(Math.max(0, st.owed), 1 + d.stake) || 1;
      st.owed = Math.max(0, st.owed - ret); st.returned += ret;
      const tx = Math.floor(L.x), ty = Math.floor(L.y);
      dropPile(tx, ty, 'gold', ret);
      u.gest = 'clap'; u.gestUntil = Game.time + 3; u.gestFace = u.face;
      if (u.hero) u.hero.cxp = (u.hero.cxp || 0) + 6;
      lepEvent(L, 'slap');
      floater(u.x, u.y - 2.2, '+' + ret + ' золота', '#ffe070');
      logEvent('gold', `${lepName(u)} отвесил лепрекону пощёчину — золото вернулось (×${ret}), лепрекон растворился в зелёных искрах`, L.x, L.y);
      if (typeof chronAdd === 'function') chronAdd('animal', `${chronWhen()} ${lepName(u)} отвесил лепрекону такую пощёчину, что звон слышали на складе. Золото вернулось (×${ret}), лепрекон ушёл в зелёные искры и в обиду.`, 1);
      break;
    }
    case 'sad': lepEvent(L, 'sad'); break;
    case 'melt': lepEvent(L, 'melt'); break;
  }
}

function lepFinish(L, u) {
  L.st = 'gone'; L.hide = true; L.tug = 0; L.potOn = false;
  Game.lepMine[L.mine] = Game.time + lepRand(LEP_CD[0], LEP_CD[1]) * (dif().neuResp || 1);
}
function lepAbort(L) {
  // свидетеля не стало: лепрекон бросает затею
  L.st = 'idle'; L.d = null; L.seq = null; L.tug = 0; L.hide = false; L.z = 0; L.sink = 0; L.potOn = false; L.potFade = false; L.potA = 0; L.rbA = 0; L.cd = Game.time + 30; L.t = 2; L.x = L.hx; L.y = L.hy;
}

// ---------- Жизнь ----------

function lepFrameIdle(L) { return 'i' + (Math.floor(Game.time * 5 + L.id) % 6); }

function lepThink(L, dt) {
  const now = Game.time;
  if (!L.dead && lepWatchdog(L, dt)) return;
  if (L.st === 'gone') {
    // сценарий кончился: убираем лепрекона, пока горшок ещё тает — он остаётся «призраком» до конца затухания
    if (L.potA > 0 || L.rbA > 0) {
      if (L.potFade) { L.potA = Math.max(0, L.potA - dt / 0.9); L.rbA = Math.max(0, L.rbA - dt / 0.7); }
      return;
    }
    L.dead = true; return;
  }
  if (L.st === 'duel') { lepSeqStep(L, dt); return; }
  // кто-то ударил по лепрекону: смеётся и пляшет
  if (L.mock && now < L.mock && L.st !== 'dance' && L.st !== 'go') { L.st = 'dance'; L.dT0 = now; L.dEnd = now + lepRand(4, 7); L.jigT = now + 99; }
  // золото на горизонте
  L.scanT -= dt;
  if (L.scanT <= 0) {
    L.scanT = lepRand(0.8, 1.6);
    if (now >= L.cd && (L.st === 'idle' || L.st === 'roam' || L.st === 'dance')) {
      const u = lepFindTarget(L);
      if (u) { L.st = 'go'; L.tg = u.id; L.goT = now; floater(L.x, L.y - 2.2, ['Золотишко!', 'Чую монетку!', 'Моё будет!'][(L.id + Math.floor(now)) % 3], '#ffe070'); }
    }
  }
  if (L.st === 'go') {
    const u = Game.unitMap.get(L.tg);
    if (!u || !lepTargetOk(u) || now - L.goT > 16 || Math.hypot(u.x - L.hx, u.y - L.hy) > LEP_SENSE + 6) { L.st = 'idle'; L.t = 2; L.cd = now + 25; L.fr = lepFrameIdle(L); return; }
    const near = lepMove(L, u.x, u.y, LEP_SPEED, dt);
    if (Math.hypot(u.x - L.x, u.y - L.y) < 1.2) lepStartDuel(L, u);
    else if (near) { L.st = 'idle'; L.t = 2; L.cd = now + 20; L.fr = lepFrameIdle(L); return; }     // упёрся в препятствие и не дошёл — бросает затею
    L.fr = 'w' + (Math.floor(L.ph) % 8);
    return;
  }
  if (L.st === 'dance') {
    L.fr = 'p' + (Math.floor((now - L.dT0) * 12) % 16);
    L.face = L.face || 1;
    if (now >= L.jigT) { L.jigT = now + 4.3; if (!lepMirrorOn()) { lepEvent(L, 'jig'); Game.lepStat.dances++; } }
    // щелчок каблуков — на кадрах p1, p6, p9, p14
    const fi = Math.floor((now - L.dT0) * 12) % 16;
    if ((fi === 1 || fi === 6 || fi === 9 || fi === 14) && L.lastClick !== Math.floor((now - L.dT0) * 12)) { L.lastClick = Math.floor((now - L.dT0) * 12); lepFx(L, 'click'); }
    if (now >= L.dEnd) { L.st = 'idle'; L.t = lepRand(3, 8); }
    return;
  }
  const home = Math.hypot(L.x - L.hx, L.y - L.hy);
  if (L.st === 'roam') {
    if (lepMove(L, L.wx, L.wy, LEP_SPEED * 0.4, dt)) { L.st = 'idle'; L.t = lepRand(3, 8); }
    L.fr = 'w' + (Math.floor(L.ph) % 8);
    return;
  }
  // покой
  L.fr = lepFrameIdle(L);
  L.t -= dt;
  if (home > LEP_HOME_R + 1.5) { L.wx = L.hx + lepRand(-1, 1); L.wy = L.hy + lepRand(-0.6, 0.6); L.st = 'roam'; return; }
  if (L.t <= 0) {
    const r = Math.random();
    if (r < 0.4) { L.st = 'dance'; L.dT0 = now; L.dEnd = now + lepRand(8, 13); L.jigT = now; }
    else {
      const a = Math.random() * 6.283, rr = 0.8 + Math.random() * LEP_HOME_R;
      L.wx = L.hx + Math.cos(a) * rr; L.wy = L.hy + Math.sin(a) * rr * 0.7;
      if (isWalkable(Math.floor(L.wx), Math.floor(L.wy))) L.st = 'roam'; else L.t = 2;
    }
  }
}

function lepTick(dt) {
  if (!Game.lepr) return;
  Game.lepT = (Game.lepT || 0) + dt;
  if (Game.lepT >= 1) { Game.lepT = 0; if (!Game.stress) lepSpawnTick(); }
  for (let i = Game.lepr.length - 1; i >= 0; i--) {
    const L = Game.lepr[i];
    lepThink(L, dt);
    if (L.dead) Game.lepr.splice(i, 1);
  }
}

// ---------- Неуязвимость: удары проходят насквозь, магия отскакивает ----------

const lepAt = (x, y, r = 0.9) => (Game.lepr || []).find(L => !L.hide && Math.hypot(L.x - x, L.y - y - 0.4) < r);

function* lepSwingGen(u, c) {
  const L = c.L, cls = unitCls(u), C = cls && GCLS[cls], range = unitRange(u);
  for (let k = 0; k < 10 && Game.lepr.includes(L) && Math.hypot(L.x - u.x, L.y - u.y) > range + 0.3; k++) {
    const d = Math.hypot(L.x - u.x, L.y - u.y) || 1;
    const keep = C && C.shot ? range * 0.7 : 0.9;
    const tx = Math.floor(L.x + (u.x - L.x) / d * keep), ty = Math.floor(L.y + (u.y - L.y) / d * keep);
    const ok = yield { walk: [isWalkable(tx, ty) ? tx : Math.floor(u.x), isWalkable(tx, ty) ? ty : Math.floor(u.y)], offroad: true };
    if (!ok) return;
  }
  if (!Game.lepr.includes(L)) return;
  u.face = L.x > u.x ? 1 : -1; u.vdir = 'E';
  yield { wait: 0.55, anim: C && C.shot ? 'build' : 'chop' };
  if (!Game.lepr.includes(L)) return;
  const px = L.x * TILE, py = L.y * TILE - 14;
  if (C && C.shot) {
    // заклинание или стрела отскакивают от радужной ауры лепрекона
    fxBurst(px, py, 14, ['#ffffff', '#cfe8ff', '#b05aff', '#4ab4ff'], 90, 60, 0.6, 1.6, 120);
    floater(L.x, L.y - 2.2, 'Отскочило!', '#cfe8ff'); sfxAt('chime', px, py, 0.8);
  } else {
    fxBurst(px, py, 8, ['#ffffff', '#c8ffb0'], 50, 30, 0.4, 1.4, 60);
    floater(L.x, L.y - 2.2, 'Сквозь!', '#cfe8ff'); sfxAt('whoosh', px, py, 0.7);
  }
  Game.lepStat.teases++;
  L.mock = Game.time + 6;
  lepEvent(L, 'tease');
  if (Game.lepStat.teases % 3 === 1) logEvent('gold', `${lepName(u)} махал оружием по лепрекону — тому щекотно: удары проходят насквозь, магия отскакивает`, L.x, L.y);
  yield { wait: 0.4 };
}

// ---------- Подключение ----------

{
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (inb(t[0], t[1])) {
      const L = lepAt(t[0] + 0.5, t[1] + 0.5);
      if (L) return { kind: 'lepswing', L, tx: Math.floor(L.x), ty: Math.floor(L.y), label: 'Ударить лепрекона (неуязвим)' };
    }
    return _rc(t);
  };
  const _run = runCmd;
  runCmd = function* (u, c) { if (c.kind === 'lepswing') yield* lepSwingGen(u, c); else yield* _run(u, c); };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.lepr = []; Game.lepMine = {}; Game.lepStat = lepStatNew(); };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) lepTick(dt); };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    s.lp = {
      st: Game.lepStat, mine: Object.fromEntries(Object.entries(Game.lepMine).map(([k, v]) => [k, Math.round(v - Game.time)])),
      list: Game.lepr.filter(L => L.st !== 'gone').map(L => ({ id: L.id, mine: L.mine, x: +L.x.toFixed(2), y: +L.y.toFixed(2), hx: L.hx, hy: L.hy, face: L.face })),
    };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.lepr = []; Game.lepMine = {}; Game.lepStat = lepStatNew();
    if (!s.lp) return;
    Game.lepStat = Object.assign(lepStatNew(), s.lp.st);
    for (const k in s.lp.mine || {}) Game.lepMine[k] = Game.time + s.lp.mine[k];
    for (const m of s.lp.list || []) {
      const b = Game.buildings.find(x => x.id === m.mine && x.type === 'goldmine');
      if (!b) continue;
      const L = lepMake(b);
      L.id = m.id; L.x = m.x; L.y = m.y; L.hx = m.hx; L.hy = m.hy; L.face = m.face || 1;
      Game.lepr.push(L);
    }
    Game.nextId = Math.max(Game.nextId, ...Game.lepr.map(L => L.id + 1), 0);
  };
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    for (const L of Game.lepr || []) {
      if (L.x < x0 - 6 || L.x > x1 + 6 || L.y < y0 - 6 || L.y > y1 + 6) continue;
      list.push([Math.max(L.y, L.potA > 0 ? L.potY : 0) + 0.25, () => lepDraw(c, L)]);
    }
  };
}

// ---------- Рисование ----------

const lepEase = k => 1 - Math.pow(1 - k, 3) + Math.sin(k * 3.14159) * 0.12 * (1 - k);

function lepDraw(c, L) {
  // клиент кооператива: события приходят счётчиком — играем звук и блеск у себя
  if (lepMirrorOn() && L.evSeen !== L.evN) { if (L.evSeen !== undefined) lepFx(L, L.ev); L.evSeen = L.evN; }
  const px = Math.round(L.x * TILE), py = Math.round(L.y * TILE + 6);
  const hasPot = L.potA > 0.01;
  const ppx = Math.round(L.potX * TILE), ppy = Math.round(L.potY * TILE + 6);
  // радуга — позади всего, растёт из горшка
  if (hasPot) lepDrawRainbow(c, ppx, ppy - 16, L.rbD || 1, L.rbP, L.rbA);
  // задняя стенка горшка с золотом
  const pk = hasPot ? Math.max(0.15, lepEase(Math.min(1, L.potT))) : 0;
  const potLayer = (layer) => {
    const s = lepPotSprite(layer);
    c.save(); c.globalAlpha = Math.min(1, L.potA); c.translate(ppx, ppy); c.scale(pk, pk); c.drawImage(s.cv, -s.ax, -s.ay); c.restore();
  };
  if (hasPot) {
    // тень и сверкание вокруг появляющегося горшка
    c.save(); c.globalAlpha = 0.3 * L.potA; c.fillStyle = '#0a0804'; c.beginPath(); c.ellipse(ppx, ppy + 1, 13 * pk, 4 * pk, 0, 0, 7); c.fill(); c.restore();
    potLayer('B');
  }
  if (!L.hide) {
    const sp = lepFrame(L.fr || 'i0');
    // тень лепрекона
    if (!(L.sink > 0)) { c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px, py + 1, 8 * (1 - Math.min(0.5, L.z / 50)), 2.6, 0, 0, 7); c.fill(); }
    // слиток, который тянут: от рук лепрекона к рукам гнома
    if (L.tug) {
      const gx = L.gx * TILE, mx = (px + gx) / 2, my = py - 14 + (L.fr === 't1' ? -1 : L.fr === 't2' ? 1 : 0);
      c.save(); c.translate(mx, my); c.rotate((L.fr === 't0' ? 0.1 : L.fr === 't2' ? -0.1 : 0)); c.fillStyle = '#8a6410'; c.fillRect(-7, -3, 14, 6);
      c.fillStyle = '#f6d458'; c.fillRect(-6, -2, 12, 4); c.fillStyle = '#fff2a0'; c.fillRect(-5, -2, 9, 1); c.restore();
    }
    c.save();
    if (L.sink > 0 && hasPot) {
      // погружение в горшок: видна только часть выше ободка
      c.beginPath(); c.rect(ppx - 40, ppy - 120, 80, 120 - 17 * pk + 2); c.clip();
    }
    c.translate(px, py - Math.round(L.z || 0) + Math.round((L.sink || 0) * 30));
    if (L.face < 0) c.scale(-1, 1);
    blitFine(c, sp.cv, -sp.ax, -sp.ay);
    c.restore();
  }
  if (hasPot) potLayer('F');
}

// Зеркало для кооператива
function lepMirror() {
  const r = v => Math.round(v * 100) / 100;
  return (Game.lepr || []).map(L => ({
    __id: L.id, id: L.id, x: r(L.x), y: r(L.y), face: L.face, fr: L.fr, z: Math.round(L.z || 0), sink: r(L.sink || 0), hide: L.hide ? 1 : 0,
    potX: r(L.potX || 0), potY: r(L.potY || 0), potT: r(L.potT || 0), potA: r(L.potA || 0), rbP: r(L.rbP || 0), rbA: r(L.rbA || 0), rbD: L.rbD || 1,
    tug: L.tug ? 1 : 0, gx: r(L.gx || 0), gy: r(L.gy || 0), ev: L.ev, evN: L.evN,
  }));
}

// ---------- Звуки ----------

if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined') {
  // звон монет: россыпь высоких «дзынь» разной высоты
  SFX.coins = (d, t, v) => {
    for (let k = 0; k < 6; k++) {
      const f = (2100 + Math.random() * 1500) * (0.9 + v * 0.2), tt = t + k * 0.045 + Math.random() * 0.02;
      modal(d, tt, [[f, 1, 0.22], [f * 2.71, 0.35, 0.1], [f * 4.1, 0.15, 0.06]], 0.16, 0.002);
    }
  };
  SFX_DEF.coins = { pri: 2, gain: 0.4, poly: 3, cd: 0.12, len: 0.6, wet: 0.15 };
  // «ха-ха-ха»: три коротких гортанных возгласа, каждый чуть ниже
  SFX.lepHa = (d, t, v) => gnomeVoice(d, t, [[520 + v * 40, 430, 0.1], [510, 410, 0.1], [490, 380, 0.12], [470, 340, 0.2]], 0.42, 1500);
  SFX_DEF.lepHa = { pri: 1, gain: 0.4, poly: 2, cd: 0.6, len: 0.9 };
  // пощёчина: хлёсткий шлепок ладонью по щеке и короткий «звон» в ухе
  SFX.slap = (d, t, v) => {
    noiseHit(d, 'highpass', 2200, 1400, 0.8, t, 0.05, 0.9, 0.001);
    noiseHit(d, 'bandpass', 1100 + v * 200, 500, 1.4, t, 0.1, 0.5, 0.001);
    tone(d, 'sine', 210, 70, t, 0.12, 0.55, 0.002);
    modal(d, t + 0.06, [[3100, 1, 0.5], [4200, 0.4, 0.3]], 0.1, 0.004);
  };
  SFX_DEF.slap = { pri: 3, gain: 0.7, poly: 2, cd: 0.3, len: 0.7 };
  // джига: скрипка и флейта в 6/8 (ре мажор), бодран на сильных долях. Играет ~4,4 с; слышна, пока лепрекон в зоне слуха
  SFX.jig = (d, t, v) => {
    const N = { D5: 587.3, E5: 659.3, Fs5: 740, G5: 784, A5: 880, B5: 987.8, Fs4: 370, A4: 440, D4: 293.7, G4: 392, E4: 329.6 };
    const tune = [
      ['D5', 1], ['Fs5', 1], ['A5', 1], ['A5', 1], ['Fs5', 1], ['D5', 1],
      ['E5', 1], ['G5', 1], ['B5', 1], ['A5', 1], ['Fs5', 1], ['E5', 1],
      ['D5', 1], ['Fs5', 1], ['A5', 1], ['B5', 1], ['A5', 1], ['Fs5', 1],
      ['G5', 1], ['Fs5', 1], ['E5', 1], ['D5', 3],
    ];
    const step = 0.17;
    let tt = t;
    for (const [n, len] of tune) {
      const f = N[n], dur = step * len * 0.92;
      // скрипка: пила с мягким срезом + флейта: чистая синусоида на октаву выше, чуть позже
      const o = tone(d, 'sawtooth', f, f * 1.004, tt, dur, 0.1, 0.012);
      tone(d, 'sine', f, f, tt + 0.01, dur, 0.12, 0.02);
      tone(d, 'sine', f * 2, f * 2, tt + 0.012, dur * 0.8, 0.025, 0.02);
      tt += step * len;
    }
    for (let b = 0; b < 4; b++) {                       // бодран: на «раз» и «четыре»
      tone(d, 'sine', 95, 55, t + b * step * 6, 0.12, 0.25, 0.003);
      tone(d, 'sine', 90, 52, t + b * step * 6 + step * 3, 0.1, 0.14, 0.003);
    }
    tone(d, 'triangle', N.D4, N.D4, t, step * 24, 0.03, 0.2);       // бурдон
  };
  SFX_DEF.jig = { pri: 1, gain: 0.34, poly: 1, cd: 3.5, len: 4.5, wet: 0.25 };
  if (typeof FLOAT_SFX !== 'undefined') Object.assign(FLOAT_SFX, { 'ПЛЯК!': 'slap', 'Ха-ха-ха!': 'lepHa' });
}

// ---------- Ачивки ----------

function lepAchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.lepsteal) return;
  const add = [
    { id: 'lepsteal', name: 'Радуга без предупреждения', desc: 'Лепрекон перетянул слиток и ушёл по радуге. Горшок, конечно, не нашли.', ev: /Лепрекон выиграл спор/ },
    { id: 'lepslap',  name: 'Пощёчина по-гномьи', desc: 'Гном отвесил лепрекону звонкую пощёчину. Золото вернулось, а чувство собственного достоинства — тем более.', ev: /отвесил лепрекону пощёчину/ },
    { id: 'lepsee',   name: 'У рудника кто-то есть', desc: 'У золотого рудника завёлся лепрекон. Гномы пересчитали золото, потом гномов.', ev: /завёлся лепрекон/ },
    { id: 'leptease', name: 'Мимо, мимо!', desc: 'Удар по лепрекону прошёл насквозь, а магия отскочила. Лепрекон смеялся дольше всех.', ev: /махал оружием по лепрекону/, secret: true },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', lepAchInit);
