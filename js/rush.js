'use strict';
// «Навались!» (решение владельца 27.10): кнопка в верхней полосе. На RUSH_LEN секунд все, у кого нет дела, —
// свободные работяги и мастера без работы у своего здания (лесоруб без дерева, каменотёс без глыбы, фермер без поля,
// мельник без зерна…) — наваливаются на то, чего деревне сейчас больше всего не хватает:
//   wood  — рубят спелые деревья и несут брёвна на склад (стройки, доски, дрова на зиму);
//   stone — колют глыбы и несут камень на склад (стройки, дороги);
//   grain — жнут спелую пшеницу и сеют на пустых полях ферм (мельница, еда на зиму).
// Что в дефиците — rushNeeds(): заявки зданий (demand) минус свободное на складах, плюс зимние сводки season.js.
// Повторное нажатие или таймер — отбой; начатое дело гном доделывает, нового не берёт. Без кнопки всё как раньше.
// Читают: logistics.js (rushDispatch — работяги), jobs.js (idleWait — мастера), entities.js (u.rushJob → rushGen),
// workers.js (rushDoing). Кооп: решает сервер (команда t:'rush'), клиентам — зеркало mir.rush. Сохранение — поле rush.

const RUSH_LEN = 150;            // секунд игры
const RUSH_R = 16;               // как далеко от себя гном ищет, на что навалиться
const RUSH_RECHECK = 15;         // как часто пересматриваем, чего не хватает
const RUSH_KINDS = {
  wood: { g: 'trunk', name: 'Брёвна', verb: 'рубят лес', doing: 'наваливается: рубит лес' },
  stone: { g: 'stone', name: 'Камень', verb: 'колют камень', doing: 'наваливается: колет камень' },
  grain: { g: 'wheat', name: 'Зерно', verb: 'жнут и сеют пшеницу', doing: 'наваливается: жнёт и сеет' },
};

const rushServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const rushMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
const rushOn = () => !!(Game.rush && Game.rush.k);
function rushSay(text) { if (rushServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }

// ---------- Что в дефиците ----------

function rushFree(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed && s.state === 'done') n += Math.max(0, s.offer(g)); return n; }
function rushDemand(g) {
  let n = 0;
  for (const b of Game.buildings) if (!b.removed && !b.isStore()) n += Math.max(0, b.demand(g));
  if (g === 'stone') for (const s of Game.roadSites.values()) n += Math.max(0, s.demand('stone'));
  return n;
}
// есть ли вообще на что наваливаться
function rushFits(k, o) {
  if (!o) return false;
  if (k === 'wood') return o.t === 'tree' && o.g >= 1 && !o.awake;
  if (k === 'stone') return o.t === 'stone' && o.n > 0;
  if (k === 'grain') return o.t === 'field' && o.crop === 'wheat' && !o.plan && !!o.farm && (o.g >= 1 || o.g < 0);
  return false;
}
function rushAny(k) { for (let i = 0; i < World.obj.length; i++) if (rushFits(k, World.obj[i]) && !World.obj[i].res) return true; return false; }

// { wood: { short, why }, … } — short: сколько не хватает (меньше нуля — запас); пересчёт не чаще раза в 5 с
const RUSHN = { t: -1e9, v: null };
function rushNeeds() {
  if (RUSHN.v && Math.abs(Game.time - RUSHN.t) < 5) return RUSHN.v;
  const out = {};
  // брёвна: стройкам и цехам прямо, на недостающие доски (1 бревно → 2 доски) и на зиму, если её запас мал
  {
    const direct = rushDemand('trunk'), boards = Math.max(0, Math.ceil((rushDemand('timber') - rushFree('timber')) / 2));
    let winter = 0;
    if (typeof seaWoodRush === 'function' && seaWoodRush()) { const w = seaWoodInfo(); winter = Math.max(0, w.need - w.have); }
    const short = direct + boards + winter - rushFree('trunk');
    out.wood = { short, why: winter > direct + boards ? `на зиму не хватает ≈${winter} брёвен` : `стройкам и цехам нужно брёвен: ${direct + boards}` };
  }
  {
    const need = rushDemand('stone');
    out.stone = { short: need - rushFree('stone'), why: `стройкам и дорогам нужно камня: ${need}` };
  }
  {
    const mill = rushDemand('wheat');
    let winter = 0;
    if (typeof seaFoodInfo === 'function' && typeof seaIdx === 'function' && seaIdx() !== 2) { const f = seaFoodInfo(); winter = Math.max(0, Math.ceil((f.need - f.have) / 3)); }
    out.grain = { short: mill + winter - rushFree('wheat'), why: winter > mill ? `еды на зиму мало: нужно ≈${winter} зерна` : `мельницам нужно зерна: ${mill}` };
  }
  for (const k in out) out[k].can = rushAny(k);
  RUSHN.t = Game.time; RUSHN.v = out;
  return out;
}
// на что наваливаемся: где нехватка больше (явной нет — где запас меньше всего)
function rushPickKind() {
  const n = rushNeeds();
  let best = null;
  for (const k in RUSH_KINDS) if (n[k].can && (!best || n[k].short > n[best].short)) best = k;
  if (!best) return null;
  return { k: best, why: n[best].short > 0 ? n[best].why : 'явной нехватки нет — запасаем впрок' };
}

// ---------- Вкл/выкл ----------

function rushStart(by) {
  const p = rushPickKind();
  if (!p) { rushSay('Наваливаться не на что: ни спелых деревьев, ни глыб, ни полей пшеницы рядом'); return false; }
  Game.rush = { k: p.k, why: p.why, until: Game.time + RUSH_LEN, nT: Game.time + RUSH_RECHECK };
  const K = RUSH_KINDS[p.k];
  rushSay(`Навались! Все, у кого нет дела, ${K.verb}: ${p.why}`);
  if (typeof logEvent === 'function') logEvent('people', `«Навались!»${by ? ` (${by})` : ''}: ${K.name.toLowerCase()} — ${p.why}`);
  rushBtnUpdate();
  return true;
}
function rushStop(why) {
  if (!Game.rush) return;
  Game.rush = null;
  if (why) rushSay(why);
  rushBtnUpdate();
}
function rushToggle(by) { if (rushOn()) { rushStop('Отбой: каждый — к своему делу'); return false; } return rushStart(by); }
function rushCmd(name) { rushToggle(name); }

function rushTick() {
  const R = Game.rush;
  if (!R) return;
  if (Game.time >= R.until) { rushStop('«Навались!» закончилось: каждый — к своему делу'); return; }
  if (Game.time >= R.nT) {
    R.nT = Game.time + RUSH_RECHECK;
    const p = rushPickKind();
    if (!p) { rushStop('Наваливаться больше не на что: каждый — к своему делу'); return; }
    if (p.k !== R.k) rushSay(`Навались: теперь ${RUSH_KINDS[p.k].name.toLowerCase()} — ${p.why}`);
    R.k = p.k; R.why = p.why;
  }
}

// ---------- Кто и куда ----------

// может ли гном навалиться: не герой, не напарник, не рекрут, не отдыхает по приказу
function rushMay(u) {
  if (!u || u.dead || u.type === 'hero' || u.owner || u.teamOf || u.rec || u.kid || u.gx || u.gm) return false;   // и не глава гильдии
  return typeof wkMay !== 'function' || wkMay(u);
}
// ближайшая цель к (x, y) — индекс клетки, бронируется; -1 — нет
function rushTarget(x, y) {
  const k = Game.rush.k;
  const t = findObjNear(Math.floor(x), Math.floor(y), RUSH_R, o => !o.res && rushFits(k, o) && (k !== 'grain' || rushFarmOk(o)));
  if (!t) return -1;
  t.o.res = true;
  return idx(t.x, t.y);
}
function rushFarm(o) { const b = o && o.farm ? Game.buildings.find(q => q.id === o.farm) : null; return b && !b.removed && b.state === 'done' ? b : null; }
function rushFarmOk(o) { const b = rushFarm(o); return !!b && !(typeof prioOff === 'function' && prioOff(b)) && (o.g >= 1 ? !outFull(b, o.crop) : !!b.crops[o.crop]); }

// мастер без дела у своего здания (jobs.js, idleWait) или вовсе без здания (entities.js, think)
function rushPick(u) {
  if (!rushOn() || rushMirror() || !rushMay(u)) return -1;
  return rushTarget(u.x, u.y);
}
// свободные работяги (logistics.js, после строек, полей и ремонта)
function rushDispatch(idle) {
  if (!rushOn() || !idle.length) return;
  for (let k = idle.length - 1; k >= 0; k--) {
    const u = idle[k];
    if (!rushMay(u)) continue;
    const i = rushTarget(u.x, u.y);
    if (i < 0) continue;
    idle.splice(k, 1);
    u.rushJob = i;
    u.idleFlag = false; u.idleStreak = 0;
    u.proc = null; u.action = null; u.anim = null;
  }
}
const rushDoing = u => { const o = World.obj[u.rushJob]; return o && o.t === 'stone' ? RUSH_KINDS.stone.doing : o && o.t === 'field' ? RUSH_KINDS.grain.doing : RUSH_KINDS.wood.doing; };

// донести груз g на ближайший склад
function* rushCarry(u, g, text) {
  u.carry = g; u.carryN = 1;
  const st = nearestStore(u.x, u.y, g);
  const ok = st && (yield { walk: [st.doorX, st.doorY] });
  if (!ok || st.removed || !st.isStore() || !u.carry) { if (u.carry) dropPile(Math.floor(u.x), Math.floor(u.y), g, 1); u.carry = null; u.carryN = 0; return; }
  st.stock[g] += 1; Game.produced[g] += 1;
  u.carry = null; u.carryN = 0;
  floater(st.doorX + 0.5, st.doorY - 0.5, text, '#e8d890');
}

// само дело: дерево — срубить и унести бревно; глыба — отколоть кусок и унести; поле — сжать или засеять
function* rushGen(u, i) {
  const o = World.obj[i], x = i % MAP_W, y = (i / MAP_W) | 0;
  const free = () => { u.rushJob = -1; if (o && World.obj[i] === o) o.res = false; };
  const kind = o && (o.t === 'tree' ? 'wood' : o.t === 'stone' ? 'stone' : 'grain');
  // дело прервали с грузом в руках (диспетчер дал мастеру здание) — груз кладём рядом, его подберут
  if (u.carry) { if (GOODS[u.carry]) dropPile(Math.floor(u.x), Math.floor(u.y), u.carry, u.carryN || 1); u.carry = null; u.carryN = 0; }
  if (!rushOn() || !rushFits(kind, o)) { free(); return; }   // отбой или цель пропала — к своему делу
  u.idleFlag = false;
  if (kind === 'stone') {
    let spot = null, bd = 1e9;
    for (const [dx, dy] of DIRS) { const sx = x + dx, sy = y + dy; if (!isWalkable(sx, sy)) continue; const d = Math.hypot(sx - u.x, sy - u.y); if (d < bd) { bd = d; spot = [sx, sy]; } }
    const ok = spot && (yield { walk: spot });
    if (!ok || World.obj[i] !== o) { free(); yield { wait: 1 }; return; }
    for (let k = 0; k < 5; k++) {
      u.face = x + 0.5 > u.x ? 1 : -1; u.vdir = 'E';
      if (typeof rockHit === 'function') fxLater(0.52, () => rockHit(x, y, o, u, k === 4));
      yield { wait: 1, anim: 'mine' };
      if (World.obj[i] !== o) { free(); return; }
    }
    free();
    o.n--; o.dmg = 0;
    if (o.n <= 0) World.obj[i] = null;
    yield { wait: 0.5, anim: 'duck' };
    yield* rushCarry(u, 'stone', '+1 камень');
    return;
  }
  const ok = yield { walk: [x, y], offroad: true };
  if (!ok || World.obj[i] !== o) { free(); yield { wait: 1 }; return; }
  u.vdir = 'E'; u.face = x + 0.5 > u.x ? 1 : -1;
  if (kind === 'wood') {
    yield { wait: 4.5, anim: 'chop' };
    free();
    if (World.obj[i] !== o) return;
    World.obj[i] = { t: 'stump', g: 0 };
    World.growing.add(i);
    yield* rushCarry(u, 'trunk', '+1 бревно');
    return;
  }
  const b = rushFarm(o);
  if (!b) { free(); return; }
  if (o.g >= 1) {   // жатва: как помощь работяги с урожаем — сноп и солома на ферму
    for (let k = 0; k < 4; k++) fxLater(0.45 + k * 0.95, () => harvestFx(x, y, o.crop));
    yield { wait: 4, anim: 'reap' };
    free();
    if (World.obj[i] !== o || o.g < 1) return;
    o.g = -1;
    const extra = !!o.ash; o.ash = false;
    u.carry = o.crop; u.carryN = 1;
    const ok2 = yield { walk: [b.doorX, b.doorY] };
    if (b.removed || !ok2 || !u.carry) { if (u.carry) dropPile(Math.floor(u.x), Math.floor(u.y), o.crop, 1); u.carry = null; u.carryN = 0; return; }
    for (let k = 0; k < (extra ? 5 : 3); k++) if (k === 0 || !outFull(b, o.crop)) gather(b, o.crop);
    const hay = (extra ? 3 : 2) + (typeof seaHayBonus === 'function' ? seaHayBonus(o.crop) : 0);
    for (let k = 0; k < hay; k++) if (!outFull(b, 'hay')) gather(b, 'hay');
    u.carry = null; u.carryN = 0;
    floater(b.doorX + 0.5, b.doorY - 0.5, 'Навалились на жатву', '#e8d890');
    return;
  }
  yield { wait: 3, anim: 'dig' };   // посев на пустом поле
  free();
  if (World.obj[i] !== o || o.g >= 0) return;
  o.g = 0;
  fertilize(b, o);
  World.growing.add(i);
}

// ---------- Кооп и сохранение ----------

function rushMirrorOut() { const R = Game.rush; return R ? { k: R.k, why: R.why, until: Math.round(R.until) } : null; }
function rushMirrorIn(m) {
  Game.rush = m && RUSH_KINDS[m.k] ? { k: m.k, why: String(m.why || ''), until: +m.until || 0, nT: Infinity } : null;
  rushBtnUpdate();
}

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!rushMirror()) rushTick(); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.rush = null; RUSHN.v = null; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg(), R = Game.rush;
    if (R) s.rush = { k: R.k, why: R.why, left: Math.max(0, Math.round(R.until - Game.time)) };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    const r = s && s.rush;
    Game.rush = null; RUSHN.v = null;
    if (r && typeof r.k === 'string' && Object.prototype.hasOwnProperty.call(RUSH_KINDS, r.k) && Number.isFinite(r.left) && r.left > 0)
      Game.rush = { k: r.k, why: String(r.why || '').slice(0, 120), until: Game.time + Math.min(RUSH_LEN, r.left), nT: Game.time + RUSH_RECHECK };
  };
}

// ---------- Кнопка ----------

let rushBtnT = 0;
function rushBtnUpdate() {
  if (typeof document === 'undefined' || !document.getElementById || rushServer()) return;
  const b = document.getElementById('rush-btn');
  if (!b || b.tagName !== 'BUTTON') return;   // в песочнице сервера и тестов document — заглушка
  const R = Game.rush, label = b.querySelector('span'), img = b.querySelector('img');
  if (R && RUSH_KINDS[R.k]) {
    const K = RUSH_KINDS[R.k], left = Math.max(0, R.until - Game.time);
    label.innerHTML = `<i class="rn">${K.name}</i> ${fmtTime(left)}`;
    b.classList.add('rush-on');
    b.title = `Навались: ${K.name.toLowerCase()} — ${R.why}. Все без дела ${K.verb}. Ещё ${fmtTime(left)}; нажмите, чтобы дать отбой`;
    if (img && img.dataset.g !== K.g && typeof iconURL === 'function') { img.src = iconURL('good', K.g, 2); img.dataset.g = K.g; }
  } else {
    label.textContent = 'Навались!';
    b.classList.remove('rush-on');
    let hint = '';
    if (Game.buildings && Game.buildings.length && World.obj) { const p = rushPickKind(); hint = p ? ` Сейчас: ${RUSH_KINDS[p.k].name.toLowerCase()} — ${p.why}.` : ' Сейчас наваливаться не на что.'; }
    b.title = `Навались! Свободные работяги и мастера без дела помогают с тем, чего не хватает: рубят лес, колют камень, жнут и сеют.${hint} ${Math.round(RUSH_LEN / 60 * 10) / 10} мин или до повторного нажатия`;
    if (img && img.dataset.g && typeof iconURL === 'function') { img.src = iconURL('ui', 'build', 2); delete img.dataset.g; }
  }
}
function rushClick() {
  if (rushMirror()) { coopSend({ t: 'rush' }); return; }
  if (!rushOn()) { RUSHN.v = null; }
  rushToggle();
  if (typeof updateUI === 'function') updateUI(true);
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('rush-btn');
    if (b) b.addEventListener('click', rushClick);
  });
}
// подпись и подсказка кнопки — вместе с интерфейсом, не чаще раза в секунду (на сервере updateUI — пустышка)
if (typeof updateUI === 'function') {
  const _uu = updateUI;
  updateUI = function (force) {
    _uu(force);
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (force || now - rushBtnT > 1000) { rushBtnT = now; rushBtnUpdate(); }
  };
}
