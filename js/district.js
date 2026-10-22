'use strict';
// Новый район: Совет выбирает, где деревня строится дальше. Раз в несколько суток (когда деревня подросла)
// находятся 2–3 места разного вида: у воды, у леса, у руды, у горы — у каждого свой плюс и свой минус.
// Выбранный район подсвечен на карте; мастерские «своего» ремесла в нём работают быстрее (resWork → темп в mood.js),
// любые здания в нём — чуть быстрее, а гномам рядом достаётся минус вида (distMood в mood.js).
// В одиночной игре решает игрок (вкладка «Совет», часть «Новый район»); в коопе — голосование Совета деревни
// (coopsim.js: coopCouncilOpen, вид 'district'), клиентам — зеркало mir.dist.
// Состояние: Game.dist { k, x, y, r, day, by } и Game.distOffer { day, opts } (оба в сохранении).

const DIST_R = 7, DIST_EVERY = 3, DIST_MIN_B = 10;
const DIST_WORK = 1.25, DIST_WORK_ANY = 1.05;
const DIST_KINDS = {
  water:    { n: 'У воды', b: ['farm', 'hopfarm', 'brewery', 'mill', 'fisherhut', 'pier'], mood: -2,
              minus: 'Сырость: гномам в районе −2 к настроению' },
  forest:   { n: 'У леса', b: ['woodcutter', 'sawmill'], moodNight: -3,
              minus: 'Ночью чаща шепчет: гномам в районе −3 к настроению ночью' },
  ore:      { n: 'У руды', b: ['goldmine', 'ironmine', 'crystalmine', 'metallurgist', 'smeltery', 'weaponsmith', 'armory'], mood: -2,
              minus: 'Шум и копоть: гномам в районе −2 к настроению' },
  mountain: { n: 'У горы', b: ['quarry', 'watchtower'], moodNight: -2,
              minus: 'Ветер со скал: гномам в районе −2 к настроению ночью' },
};
const distOwn = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(DIST_KINDS, k);
const distDay = () => cycleAt(Game.time).k;
const distMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;

function distPlus(k) {
  const D = DIST_KINDS[k], names = D.b.filter(t => BUILDINGS[t]).map(t => BUILDINGS[t].name.toLowerCase());
  return `${names.join(', ')} в районе работают на ${Math.round((DIST_WORK - 1) * 100)}% быстрее, остальные здания — на ${Math.round((DIST_WORK_ANY - 1) * 100)}%`;
}

function distStore() { return Game.buildings.find(b => b.type === 'storehouse' && !b.removed) || null; }
function distDone() { let n = 0; for (const b of Game.buildings) if (b.state === 'done' && !b.removed && !b.isRoad) n++; return n; }

// Можно ли выбирать новый район сейчас
function distEligible() {
  if (distDone() < DIST_MIN_B || !distStore()) return false;
  const D = Game.dist;
  return !D || distDay() - D.day >= DIST_EVERY;
}

// Поиск мест: сетка с шагом 3, у каждого места — оценка каждого вида; лучшее место каждого вида, далеко друг от друга
function distScan() {
  const st = distStore();
  if (!st) return [];
  const sx = st.doorX, sy = st.doorY, best = {};
  for (let y = 4; y < MAP_H - 4; y += 3) for (let x = 4; x < MAP_W - 4; x += 3) {
    const d = Math.hypot(x - sx, y - sy);
    if (d < 10 || d > 46) continue;
    let free = 0;
    for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (isFreeGrass(xx, yy)) free++;
    if (free < 30) continue;                                       // строить-то есть где?
    let water = 0, tree = 0, edge = 0, rock = 0;
    for (let yy = y - DIST_R; yy <= y + DIST_R; yy++) for (let xx = x - DIST_R; xx <= x + DIST_R; xx++) {
      if (!inb(xx, yy) || Math.hypot(xx - x, yy - y) > DIST_R) continue;
      const i = idx(xx, yy), t = World.terrain[i], o = World.obj[i];
      if (t === T_WATER) water++;
      else if (t === T_ROCK) {
        rock++;
        if (World.crystal[i]) edge += 2;
        else if ((inb(xx, yy + 1) && World.terrain[idx(xx, yy + 1)] === T_GRASS) || (inb(xx + 1, yy) && World.terrain[idx(xx + 1, yy)] === T_GRASS)) edge++;
      }
      if (o && o.t === 'tree') tree++;
    }
    const sc = { water: water / 10, forest: tree / 12, ore: edge / 8, mountain: rock / 30 };
    for (const k in sc) {
      if (sc[k] < 1) continue;
      const v = sc[k] + free / 60 - d / 80;                         // поближе к складу и попросторнее — лучше
      if (!best[k] || v > best[k].v) best[k] = { k, x, y, v, d: Math.round(d) };
    }
  }
  const all = Object.values(best).sort((a, b) => b.v - a.v), out = [];
  for (const s of all) {
    if (out.some(o => Math.hypot(o.x - s.x, o.y - s.y) < 12)) continue;
    out.push(s);
    if (out.length >= 3) break;
  }
  return out.length >= 2 ? out.map(s => ({ k: s.k, x: s.x, y: s.y, r: DIST_R, d: s.d, l: `${DIST_KINDS[s.k].n} · ${s.d} кл. от склада` })) : [];
}

function distSay(text) {
  if (typeof coop !== 'undefined' && coop && coop.out && coop.players) coop.out.push({ msg: { t: 'toast', text } });
  else if (typeof toast === 'function') toast(text);
}

function distSet(o, by) {
  if (!o || !distOwn(o.k) || !inb(o.x, o.y)) return false;
  Game.dist = { k: o.k, x: o.x, y: o.y, r: o.r || DIST_R, day: distDay(), by: by || null };
  Game.distOffer = null;
  if (typeof logEvent === 'function') logEvent('law', `Новый район: ${DIST_KINDS[o.k].n.toLowerCase()} — строим там`, o.x, o.y);
  return true;
}

// Одиночная игра: предложение висит, пока игрок не выберет (обновляется раз в сутки)
function distTick() {
  if (distMirror() || (typeof coop !== 'undefined' && coop && coop.players)) return;
  const day = distDay();
  if (!distEligible()) { Game.distOffer = null; return; }
  if (Game.distOffer && Game.distOffer.day === day) return;
  const opts = distScan();
  Game.distOffer = opts.length ? { day, opts } : { day, opts: [] };
  if (opts.length && typeof toast === 'function') toast('Совет деревни: пора выбрать, где строить новый район — вкладка «Совет»');
}

// ---------- Эффекты ----------
function distIn(D, x, y, pad = 0) { return Math.hypot(x - (D.x + 0.5), y - (D.y + 0.5)) <= D.r + pad; }
function distWork(u) {
  const D = Game.dist, h = u.home;
  if (!D || !h || h.removed || !h.w) return 1;
  if (!distIn(D, h.x + h.w / 2, h.y + h.h / 2)) return 1;
  return DIST_KINDS[D.k].b.includes(h.type) ? DIST_WORK : DIST_WORK_ANY;
}
function distMood(u, night) {
  const D = Game.dist;
  if (!D || !DIST_KINDS[D.k] || !distIn(D, u.x, u.y, 1)) return 0;
  const K = DIST_KINDS[D.k];
  return (K.mood || 0) + (night ? K.moodNight || 0 : 0);
}
if (typeof resWork === 'function') {
  const _rw = resWork;
  resWork = function (u) { return _rw(u) * distWork(u); };
}

// ---------- Кооп: зеркало ----------
function distMirrorOut() { return Game.dist ? { k: Game.dist.k, x: Game.dist.x, y: Game.dist.y, r: Game.dist.r, day: Game.dist.day, by: Game.dist.by } : null; }
function distMirrorIn(m) { Game.dist = m && distOwn(m.k) ? m : null; }

// ---------- Сохранение ----------
const DISTT = { t: 1 };
if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); DISTT.t -= dt; if (DISTT.t <= 0) { DISTT.t = 5; distTick(); } };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.dist = null; Game.distOffer = null; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    if (Game.dist) s.dist = Game.dist;
    if (Game.distOffer && Game.distOffer.opts.length) s.distOffer = Game.distOffer;
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    const d = s && s.dist;
    Game.dist = d && distOwn(d.k) && Number.isInteger(d.x) && Number.isInteger(d.y) ? { k: d.k, x: d.x, y: d.y, r: d.r > 0 && d.r <= 12 ? d.r : DIST_R, day: Number.isFinite(d.day) ? d.day : 0, by: d.by || null } : null;
    const o = s && s.distOffer;
    Game.distOffer = o && Array.isArray(o.opts) ? { day: o.day | 0, opts: o.opts.filter(p => p && distOwn(p.k) && Number.isInteger(p.x) && Number.isInteger(p.y)).slice(0, 3) } : null;
  };
}

// ---------- Карта: подсвеченная зона и места на выбор ----------
function distRing(c, x, y, r, col, label, alpha) {
  const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE, R = r * TILE;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = col.replace('rgb', 'rgba').replace(')', ',0.10)');
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
  c.setLineDash([10, 7]); c.lineDashOffset = -Game.time * 12;
  c.strokeStyle = col; c.lineWidth = 2.5; c.stroke();
  c.setLineDash([]);
  if (label) {
    c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
    c.lineWidth = 4; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(label, cx, cy - R - 6);
    c.fillStyle = '#fff4d0'; c.fillText(label, cx, cy - R - 6);
  }
  c.restore();
}
const DIST_COL = { water: 'rgb(90,170,240)', forest: 'rgb(100,200,90)', ore: 'rgb(230,170,70)', mountain: 'rgb(190,190,200)' };

// места на выбор: в одиночке — пока открыта вкладка «Совет»; в коопе — пока идёт голосование (Coop.qx.c.pts)
function distOptsShown() {
  if (typeof Coop !== 'undefined' && Coop.on) { const c = Coop.qx && Coop.qx.c; return c && c.pts ? c.pts : null; }
  return typeof UI !== 'undefined' && UI.tab === 'council' && Game.distOffer ? Game.distOffer.opts : null;
}

if (typeof drawOverlay === 'function' && typeof document !== 'undefined') {
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const D = Game.dist;
    if (D && DIST_KINDS[D.k]) distRing(c, D.x, D.y, D.r, DIST_COL[D.k], 'Новый район: ' + DIST_KINDS[D.k].n.toLowerCase(), 0.75);
    const O = distOptsShown();
    if (O) O.forEach((o, i) => { if (o && DIST_KINDS[o.k]) distRing(c, o.x, o.y, o.r || DIST_R, DIST_COL[o.k], `${i + 1}. ${DIST_KINDS[o.k].n}`, 0.55 + 0.25 * Math.sin(Game.time * 3)); });
  };
}

// ---------- Вкладка «Совет»: часть «Новый район» ----------
const distEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function distCard(o, btn) {
  const K = DIST_KINDS[o.k];
  return `<div class="lw-row"><div class="lw-name"><b>${distEsc(K.n)}</b><span class="muted small"> · ${o.d != null ? o.d + ' кл. от склада' : ''}</span></div>
    <div class="dl-chips"><span class="dl-chip up">${distEsc(distPlus(o.k))}</span><span class="dl-chip dn">${distEsc(K.minus)}</span>${o.d > 30 ? '<span class="dl-chip dn">Далеко таскать со склада</span>' : ''}</div>${btn || ''}</div>`;
}
function distHTML() {
  const D = Game.dist, coopOn = typeof Coop !== 'undefined' && Coop.on;
  let h = '';
  if (D && DIST_KINDS[D.k]) {
    const left = Math.max(0, DIST_EVERY - (distDay() - D.day));
    h += `<div class="muted small">Деревня строится здесь (зона подсвечена на карте)${D.by ? ' — решил ' + distEsc(D.by) : ''}. ${left ? `Новое место можно выбрать через ${left} сут.` : 'Можно выбрать новое место.'}</div>`
      + distCard(D, `<div class="lw-btns"><button data-cn="dist:look:-1">Показать</button></div>`);
  }
  if (coopOn) return h + `<div class="muted small">В общей деревне место выбирает голосование Совета (утром, вместе с остальными вопросами).</div>`;
  const O = Game.distOffer;
  if (O && O.opts.length) {
    h += `<div class="lw-top"><span><b>Куда строить новый район?</b></span><span class="muted small">места подсвечены на карте</span></div>`;
    O.opts.forEach((o, i) => { h += distCard(o, `<div class="lw-btns"><button data-cn="dist:pick:${i}">Строим здесь</button><button data-cn="dist:look:${i}">Показать</button></div>`); });
  } else if (!D) h += `<div class="muted small">Когда в деревне будет ${DIST_MIN_B} готовых зданий, Совет предложит места для нового района.</div>`;
  return h;
}
function distClick(v) {
  const [a, s] = v.split(':'), i = +s;
  const o = i < 0 ? Game.dist : Game.distOffer && Game.distOffer.opts[i];
  if (!o) return;
  if (a === 'look' && typeof centerOn === 'function') { centerOn((o.x + 0.5) * TILE, (o.y + 0.5) * TILE); return; }
  if (a === 'pick' && !distMirror() && distSet(o, null)) { toast(`Новый район: ${DIST_KINDS[o.k].n.toLowerCase()}. Стройте мастерские внутри круга`); updateUI(true); }
}
if (typeof councilAdd === 'function') councilAdd({ id: 'dist', order: 5, title: 'Новый район', html: distHTML, click: distClick, badge: () => !!(Game.distOffer && Game.distOffer.opts.length && !(typeof Coop !== 'undefined' && Coop.on)) });
