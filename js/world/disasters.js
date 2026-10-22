'use strict';
// Стихийные бедствия: пожар, землетрясение, тайфун (только у моря), ураган-смерч и гибель посевов
// (летом засуха, осенью ранние заморозки). Редкие, с предупреждением: сначала знамение (тост, запись в журнале,
// знак на карте и звук), через DZ_WARN секунд удар. Не в первые DZ_FIRST_DAY суток, не во время обучения, не ночью.
//
// Защита и снижение урона:
//  • колодец (здание well): в радиусе WELL_R пожар гасят вёдрами — огонь вдвое короче и почти не перекидывается,
//    здание горит втрое медленнее и не сгорает дотла; поля в радиусе не сохнут в засуху;
//  • укрепление: здания 2-го уровня получают урон ×0,6, 3-го — ×0,4 (землетрясение, тайфун, ураган, пожар);
//  • склад запасов: склад каменный — не горит и не теряет товар; у прочих зданий огонь и вода портят часть запаса;
//  • пепел на поле: половина таких полей переживает заморозки.
// Справедливость: здания ядра деревни (DZ_CORE_R от склада) тайфун не трогает; склад, школа, трактир, лазарет,
// гильдии и башни не разрушаются никогда; за событие разрушается не больше DZ_DIF.raze зданий (на «Спокойном» — ни одного),
// гномы не гибнут (ураган лишь уносит и роняет), посевы гибнут не все и на время.
// Восстановление: повреждённые здания чинят гномы (как после нечисти), но ремонт после стихии стоит материалов
// (dzFixCost: доля цены постройки), разбитые дороги заново мостят строители (камень).
//
// Всё считает тот, кто считает игру (в кооперативе — сервер). Клиенты получают Game.dz зеркалом внутри seaMirrorOut
// (обёртка ниже — файлы коопа не правятся), здания и клетки — обычными дельтами. Рисование и звук — dzView/dzDrawList,
// одинаково для одиночной игры и клиента. Море (ocean.js из ветки моря) не обязательно: без него вода у края карты
// распознаётся тем же правилом (связная вода у края ≥ 1200 клеток, у биома «Побережье» ≥ 150).

const DZ_KINDS = ['fire', 'quake', 'typhoon', 'wind', 'blight'];
const DZ_NAMES = { fire: 'Пожар', quake: 'Землетрясение', typhoon: 'Тайфун', wind: 'Ураган', blight: 'Гибель посевов' };
const DZ_WARN = 55;               // секунд от знамения до удара
const DZ_FIRST_DAY = 2;           // первые сутки (0 и 1) — без бедствий
const WELL_R = 9;                 // радиус защиты колодца, клеток
const DZ_CORE_R = 7;              // ядро деревни вокруг склада: тайфун туда не доходит
const DZ_SAFE = new Set(['storehouse', 'school', 'inn', 'infirmary', 'herohall', 'graveyard', 'watchtower', 'library', 'squadtavern', 'well', 'tradepost']);
// сложность: gap — средний промежуток между бедствиями (суток), dmg — множитель урона, raze — сколько зданий может
// разрушить одно событие, blight — доля гибнущих посевов, bdays — сколько суток погибшие поля не растут, yb — шанс гибели посевов за год
const DZ_DIF = {
  calm: { gap: 5, dmg: 0.55, raze: 0, blight: 0.3, bdays: 0.5, yb: 0.5 },
  normal: { gap: 3, dmg: 1, raze: 1, blight: 0.45, bdays: 1, yb: 0.85 },
  survival: { gap: 2, dmg: 1.25, raze: 2, blight: 0.6, bdays: 1.5, yb: 1 },
};
const DZ_FREQ = [0, 1.8, 1, 0.6];                       // множитель промежутка: выкл / редко / обычно / часто
const DZ_FREQ_NAMES = ['выключены', 'редко', 'обычно', 'часто'];
// вес бедствий по сезонам: лето, осень, зима, весна
const DZ_SEASON_W = {
  fire: [3, 1, 0.3, 1], quake: [1, 1, 1.5, 1], typhoon: [1, 2, 1, 1.5], wind: [1.5, 2, 1.5, 2], blight: [2, 3, 0, 0],
};

const dzMirror = () => typeof isMirror === 'function' && isMirror();
const dzDif = () => DZ_DIF[Game.diff] || DZ_DIF.normal;

function dzLoadFreq() {
  let v = null;
  try { const m = /[?&]disasters=(\d)/.exec(location.search); v = m ? m[1] : localStorage.getItem('feod.disasters'); } catch (e) {}
  const n = v == null || v === '' ? NaN : +v;
  return n >= 0 && n <= 3 ? n : 2;
}
function dzNew() {
  return { v: 1, next: Game.time + CYCLE * (0.5 + (((Game.seed || 0) * 0.6180339) % 1)),   // без Math.random: старт не сдвигает случайность сида
    freq: dzLoadFreq(), last: '', n: 0, yb: -1, pend: null, cur: null, bl: [], hist: {} };
}
Game.dz = dzNew();
const DZ = () => Game.dz || (Game.dz = dzNew());

// ---------- Помощники ----------

const dzDone = () => Game.buildings.filter(b => b.state === 'done' && !b.removed && !b.isRoad);
function dzHub() { return Game.buildings.find(b => b.type === 'storehouse' && !b.removed) || Game.buildings[0] || null; }
const dzCx = b => b.x + b.w / 2, dzCy = b => b.y + b.h / 2;
// расстояние от клетки до прямоугольника здания
function dzDistB(b, x, y) { const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h)); return Math.hypot(dx, dy); }
function dzCore(b) { const h = dzHub(); return !!h && h !== b ? Math.hypot(dzCx(b) - dzCx(h), dzCy(b) - dzCy(h)) < DZ_CORE_R : !!h; }
const dzWells = () => Game.buildings.filter(b => b.type === 'well' && b.state === 'done' && !b.removed);
function dzWellNear(x, y, wells) { for (const w of wells || dzWells()) if (Math.hypot(w.doorX + 0.5 - x, w.doorY - 0.5 - y) <= WELL_R) return w; return null; }
const dzLvMul = b => (b.level >= 3 ? 0.4 : b.level >= 2 ? 0.6 : 1);
function dzNearB(x, y) { let best = null, bd = 1e9; for (const b of Game.buildings) { if (b.removed) continue; const d = dzDistB(b, x, y); if (d < bd) { bd = d; best = b; } } return best; }
const dzYear = () => (typeof seaYear === 'function' ? seaYear() : Math.floor(cycleAt(Game.time).k / 32));
const dzSeason = () => (typeof seaIdx === 'function' ? seaIdx() : 0);
const dzR = (a, b) => a + Math.random() * (b - a);
function dzSay(text, x, y) {
  if (typeof toast === 'function') toast(text, x != null ? dzNearB(x, y) : null);
}
function dzLog(text, x, y) { if (typeof logEvent === 'function') logEvent('weather', text, x, y); }

// Урон зданию от стихии: учитывает уровень (укрепление) и сложность; отмечает, что ремонт будет стоить материалов
function dzHit(b, amt, cap = 0.9) {
  if (!b || b.removed || b.state !== 'done') return 0;
  const before = b.dmg || 0;
  b.dmg = Math.min(cap, before + amt * dzLvMul(b) * dzDif().dmg);
  if (b.dmg > before + 0.001) { b.dzFix = 1; return b.dmg - before; }
  return 0;
}
// огонь и вода портят часть запаса в здании (склад каменный — не портится)
function dzSpoil(b, frac) {
  if (!b.stock || b.isStore()) return 0;
  let n = 0;
  for (const g in b.stock) { const v = b.stock[g]; if (v > 0) { const k = Math.floor(v * frac); b.stock[g] -= k; n += k; } }
  return n;
}
// разрушить здание (с ограничениями справедливости)
function dzRaze(b, cur, why) {
  if (!b || b.removed || cur.st.raze >= dzDif().raze || DZ_SAFE.has(b.type) || /^guild_/.test(b.type) || dzCore(b)) return false;
  if (dzDone().length < 10) return false;
  cur.st.raze++;
  const x = b.doorX + 0.5, y = b.doorY;
  removeBuilding(b);
  (cur.ash || (cur.ash = [])).push(idx(Math.floor(dzCx(b)), Math.floor(dzCy(b))));
  dzSay(`${why}: «${b.def.name}» разрушено до основания — можно отстроить заново`, x, y);
  dzLog(`${why}: разрушено здание «${b.def.name}»`, x, y);
  return true;
}

// ---------- Вода у края карты (море) ----------
// dzSeaDist[i] — расстояние суши до моря в клетках (1..4), 0 — далеко или само море, 255 — клетка моря.
const DZS = { key: '', dist: null, any: false };
function dzSeaPrep() {
  if (!World.terrain) return null;
  const key = MAP_W + 'x' + MAP_H + ':' + (Game.seed || 0) + ':' + (typeof MapOpt !== 'undefined' && MapOpt.biome || '');
  if (DZS.key === key && DZS.dist) return DZS.any ? DZS.dist : null;
  DZS.key = key;
  const W = MAP_W, H = MAP_H, N = W * H, T = World.terrain, dist = new Uint8Array(N);
  let sea = null;
  // ветка моря: виды водоёмов уже посчитаны
  if (typeof oceanPrep === 'function' && typeof OC_SEA !== 'undefined') {
    try { const O = oceanPrep(true); if (O && O.kind) { sea = new Uint8Array(N); for (let i = 0; i < N; i++) if (O.kind[i] === OC_SEA) sea[i] = 1; } } catch (e) { sea = null; }
  }
  if (!sea) {
    sea = new Uint8Array(N);
    const seen = new Uint8Array(N), lim = typeof MapOpt !== 'undefined' && MapOpt.biome === 'coast' ? 150 : 1200;
    for (let s = 0; s < N; s++) {
      if (T[s] !== T_WATER || seen[s]) continue;
      const comp = [s]; seen[s] = 1;
      let edge = false;
      for (let k = 0; k < comp.length; k++) {
        const i = comp[k], x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !seen[j] && T[j] === T_WATER) { seen[j] = 1; comp.push(j); }
      }
      if (edge && comp.length >= lim) for (const i of comp) sea[i] = 1;
    }
  }
  let q = [], any = false;
  for (let i = 0; i < N; i++) if (sea[i]) { dist[i] = 255; q.push(i); any = true; }
  for (let d = 1; d <= 4 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (!dist[j] && T[j] !== T_WATER) { dist[j] = d; nq.push(j); }
      }
    }
    q = nq;
  }
  DZS.dist = dist; DZS.any = any;
  return any ? dist : null;
}
function dzSeaDistB(b, sd) {
  let m = 0;
  for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
    if (!inb(x, y)) continue;
    const d = sd[idx(x, y)];
    if (d && d !== 255 && (!m || d < m)) m = d;
  }
  return m;
}

// ---------- Выбор бедствия и места ----------

function dzPickOrder(D) {
  const si = dzSeason(), list = [];
  for (const k of DZ_KINDS) {
    let w = DZ_SEASON_W[k][si];
    if (k === D.last) w *= 0.15;                       // одно и то же подряд — почти никогда
    if (k === 'blight' && D.yb === dzYear()) w = 0;    // посевы гибнут не чаще раза в год
    if (w > 0) list.push([k, w * dzR(0.2, 1)]);
  }
  return list.sort((a, b) => b[1] - a[1]).map(a => a[0]);
}

const DZ_PLAN = {
  fire() {
    const hub = dzHub(); if (!hub) return null;
    const bl = dzDone(), hx = dzCx(hub), hy = dzCy(hub);
    for (let t = 0; t < 900; t++) {
      const a = Math.random() * 6.283, r = dzR(8, 30), x = Math.floor(hx + Math.cos(a) * r), y = Math.floor(hy + Math.sin(a) * r);
      if (!inb(x, y)) continue;
      const o = World.obj[idx(x, y)];
      if (!o || o.t !== 'tree' || o.g < 0.5 || o.awake) continue;
      let near = 1e9;
      for (const b of bl) near = Math.min(near, dzDistB(b, x, y));
      if (near < 2.5 || near > (t > 600 ? 16 : 9)) continue;
      return { x, y };
    }
    return null;
  },
  quake() {
    const bl = dzDone(); if (bl.length < 5) return null;
    const b = bl[(Math.random() * bl.length) | 0];
    return { x: dzCx(b) + dzR(-3, 3), y: dzCy(b) + dzR(-3, 3), r: dzR(6, 9) };
  },
  wind() {
    const bl = dzDone(); if (!bl.length) return null;
    const b = bl[(Math.random() * bl.length) | 0], tx = dzCx(b), ty = dzCy(b), a = Math.random() * 6.283;
    const cl = (v, m) => Math.max(2, Math.min(m - 3, v));
    return { x: cl(tx - Math.cos(a) * 20, MAP_W), y: cl(ty - Math.sin(a) * 20, MAP_H), ex: cl(tx + Math.cos(a) * 22, MAP_W), ey: cl(ty + Math.sin(a) * 22, MAP_H) };
  },
  typhoon() {
    if (dzSeason() === 2 && Game.sea && Game.sea.ice > 0.5) return null;   // море подо льдом
    const sd = dzSeaPrep(), hub = dzHub();
    if (!sd || !hub) return null;
    let best = null, bd = 1e9;
    for (let i = 0; i < sd.length; i++) {
      if (sd[i] !== 1) continue;
      const x = i % MAP_W, y = (i / MAP_W) | 0, d = Math.hypot(x - dzCx(hub), y - dzCy(hub));
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (!best || bd > 45) return null;
    let hit = 0;
    for (const b of dzDone()) if (!dzCore(b) && Math.hypot(dzCx(b) - best[0], dzCy(b) - best[1]) < 20 && dzSeaDistB(b, sd)) hit++;
    if (!hit) return null;
    return { x: best[0], y: best[1], r: 20 };
  },
  blight() {
    const si = dzSeason();
    if (si === 0 && typeof seaProgress === 'function' && seaProgress() < 0.35) return null;   // засуха — во второй половине лета
    if (si === 1 && typeof seaDaysToWinter === 'function' && seaDaysToWinter() <= 2) return null;   // за двое суток до зимы — не добиваем
    if (si !== 0 && si !== 1) return null;
    if (!DZ().quick && Math.random() > dzDif().yb) { DZ().yb = dzYear(); return null; }   // в этом году обошлось
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'field' && !o.plan && o.g >= 0 && !o.bl) { n++; sx += i % MAP_W; sy += (i / MAP_W) | 0; } }
    if (n < 4) return null;
    return { x: sx / n, y: sy / n, v: si === 0 ? 'd' : 'f' };
  },
};

const DZ_OMEN = {
  fire: 'Знамение: в лесу сушь и тянет дымом — быть пожару. Колодец рядом поможет потушить',
  quake: 'Знамение: птицы сорвались с деревьев, собаки воют, земля дрожит — быть землетрясению',
  typhoon: 'Знамение: море почернело и отступило от берега — идёт тайфун. Дома у самой воды под угрозой',
  wind: 'Знамение: на горизонте закручивается тёмная воронка — идёт ураган! Уносит всех, кто попадётся',
  blight_d: 'Знамение: земля трескается от зноя — засуха погубит посевы вдали от колодцев',
  blight_f: 'Знамение: по утрам иней на колосьях — ранние заморозки погубят часть посевов. Поля с пеплом стойче',
};

function dzRoll(D, force) {
  const kinds = force ? [force] : dzPickOrder(D);
  for (const k of kinds) {
    const p = DZ_PLAN[k](D);
    if (!p) continue;
    p.k = k; p.t0 = Game.time; p.at = Game.time + (D.quick ? 1 : DZ_WARN);
    D.pend = p;
    const msg = DZ_OMEN[k === 'blight' ? 'blight_' + p.v : k];
    dzSay(msg, p.x, p.y);
    dzLog(msg, p.x, p.y);
    return p;
  }
  D.next = Game.time + 120;
  return null;
}
// для отладки и тестов: dzForce('fire') — знамение сразу, удар через секунду
function dzForce(k) { const D = DZ(); if (D.cur || D.pend) return null; D.quick = true; const p = dzRoll(D, k); D.quick = false; return p; }

function dzAllowed(D) {
  if (!DZ_FREQ[D.freq] || Game.stress) return false;
  if (cycleAt(Game.time).k < DZ_FIRST_DAY) return false;
  if (typeof Tut !== 'undefined' && Tut.on) return false;
  if (cycleAt(Game.time).p > EVE_START - DZ_WARN - 50) return false;   // только днём: знамение и удар до вечера
  return dzDone().length >= 5;
}

// ---------- Удар ----------

function dzStrike(D) {
  const p = D.pend; D.pend = null;
  const cur = D.cur = Object.assign({}, p, { t0: Game.time, st: { bld: new Set(), road: 0, tree: 0, field: 0, fly: 0, raze: 0, spoil: 0 } });
  D.last = p.k; D.n++; D.hist[p.k] = (D.hist[p.k] || 0) + 1;
  DZ_RUN[p.k].start(cur);
}
function dzEnd(D) {
  const cur = D.cur;
  D.cur = null;
  const s = cur.st, nb = s.bld.size, parts = [];
  if (nb) parts.push(`повреждено зданий: ${nb}`);
  if (s.raze) parts.push(`разрушено: ${s.raze}`);
  if (s.road) parts.push(`клеток дороги: ${s.road}`);
  if (s.tree) parts.push(`деревьев: ${s.tree}`);
  if (s.field) parts.push(`полей: ${s.field}`);
  if (s.fly) parts.push(`унесло: ${s.fly}`);
  if (cur.k !== 'blight') {
    const t = `${DZ_NAMES[cur.k]} утих${cur.k === 'quake' ? 'ло' : ''}` + (parts.length ? ': ' + parts.join(', ') + '.' : ' без потерь.') + (nb ? ' Ремонт после стихии стоит досок и камня' : '');
    dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
  }
  const gap = dzDif().gap * (DZ_FREQ[D.freq] || 1);
  D.next = Game.time + CYCLE * gap * dzR(0.7, 1.3);
}

// ---------- Пожар ----------
function dzIgnite(cur, i, wells) {
  if (cur.f.length >= 30 || cur.burnt.has(i) || cur.nIgn >= 60) return;
  const x = i % MAP_W, y = (i / MAP_W) | 0, w = dzWellNear(x + 0.5, y + 0.5, wells);
  cur.burnt.add(i); cur.nIgn++;
  cur.f.push({ i, t0: Game.time, dur: dzR(13, 19) * (w ? 0.5 : 1) });
}
function dzIgniteB(cur, b, wells) {
  if (cur.b.some(q => q.id === b.id) || b.type === 'storehouse' || b.type === 'well' || cur.bBurnt.has(b.id)) return;
  const w = dzWellNear(b.doorX + 0.5, b.doorY, wells);
  cur.bBurnt.add(b.id);
  cur.b.push({ id: b.id, t0: Game.time, dur: dzR(16, 24) * (w ? 0.5 : 1), w: !!w });
  cur.st.spoil += dzSpoil(b, w ? 0.1 : 0.3);
  if (typeof floater === 'function') floater(dzCx(b), b.y, 'Пожар!', '#ff9040');
}
const DZ_RUN = {
  fire: {
    start(cur) {
      cur.f = []; cur.b = []; cur.burnt = new Set(); cur.bBurnt = new Set(); cur.nIgn = 0; cur.sp = 0; cur.ash = [];
      dzIgnite(cur, idx(cur.x, cur.y), dzWells());
      const t = 'Пожар! Огонь перекидывается с деревьев на дома. Колодец рядом гасит огонь вдвое быстрее';
      dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
    },
    tick(cur, dt) {
      const now = Game.time, wells = dzWells(), rain = typeof WX !== 'undefined' && WX.k > 0.45;
      // здания горят: урон каждую секунду
      for (let k = cur.b.length - 1; k >= 0; k--) {
        const q = cur.b[k], b = Game.buildings.find(o => o.id === q.id);
        if (!b || b.removed) { cur.b.splice(k, 1); continue; }
        if (dzHit(b, dt * 0.035 * (q.w ? 0.35 : 1), 0.95)) cur.st.bld.add(b.id);
        if (rain) q.dur -= dt * 2;
        if (now - q.t0 > q.dur) {
          cur.b.splice(k, 1);
          if (b.dmg >= 0.9 && !q.w && Math.random() < 0.6) dzRaze(b, cur, 'Пожар');
        }
      }
      // клетки догорают: дерево → пень, поле → без урожая
      for (let k = cur.f.length - 1; k >= 0; k--) {
        const q = cur.f[k];
        if (rain) q.dur -= dt * 2;
        if (now - q.t0 <= q.dur) continue;
        cur.f.splice(k, 1);
        const o = World.obj[q.i];
        if (o && o.t === 'tree') { World.obj[q.i] = { t: 'stump', g: 0 }; World.growing.add(q.i); cur.st.tree++; }
        else if (o && o.t === 'field' && o.g >= 0) { o.g = -1; cur.st.field++; }
        if (cur.ash.length < 160) cur.ash.push(q.i);
      }
      // огонь перекидывается
      cur.sp += dt;
      if (cur.sp >= 1.5) {
        cur.sp = 0;
        const blds = dzDone();
        for (const q of cur.f.slice()) {
          const x = q.i % MAP_W, y = (q.i / MAP_W) | 0, wk = dzWellNear(x + 0.5, y + 0.5, wells) ? 0.3 : 1, rk = rain ? 0.2 : 1;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (!inb(xx, yy)) continue;
            const j = idx(xx, yy), o = World.obj[j];
            if (o && o.t === 'tree' && o.g > 0.2 && !o.awake && Math.random() < 0.14 * wk * rk) dzIgnite(cur, j, wells);
            else if (o && o.t === 'field' && !o.plan && o.g >= 0 && Math.random() < 0.1 * wk * rk) dzIgnite(cur, j, wells);
          }
          for (const b of blds) if (dzDistB(b, x + 0.5, y + 0.5) < 1.3 && Math.random() < 0.2 * wk * rk) dzIgniteB(cur, b, wells);
        }
        // горящий дом поджигает соседей реже
        for (const q of cur.b.slice()) {
          const b = Game.buildings.find(o => o.id === q.id); if (!b) continue;
          for (const o of blds) if (o !== b && dzDistB(o, dzCx(b), dzCy(b)) < Math.max(b.w, b.h) / 2 + 1.2 && Math.random() < 0.08 * (q.w ? 0.3 : 1) * (rain ? 0.2 : 1)) dzIgniteB(cur, o, wells);
        }
      }
      if ((!cur.f.length && !cur.b.length) || now - cur.t0 > 150) { cur.f.length = 0; cur.b.length = 0; return true; }
      return false;
    },
  },

  // ---------- Землетрясение ----------
  quake: {
    start(cur) {
      cur.pulse = 0; cur.cr = [];
      for (let k = 0; k < 14; k++) { const a = Math.random() * 6.283, r = Math.random() * cur.r; cur.cr.push([+(cur.x + Math.cos(a) * r).toFixed(1), +(cur.y + Math.sin(a) * r).toFixed(1), (Math.random() * 1000) | 0]); }
      const t = 'Землетрясение! Трескаются стены и дороги. Здания 2–3 уровня держатся крепче';
      dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
    },
    tick(cur) {
      const age = Game.time - cur.t0;
      while (cur.pulse < 3 && age >= 0.4 + cur.pulse * 2) {
        cur.pulse++;
        for (const b of dzDone()) {
          const d = Math.hypot(dzCx(b) - cur.x, dzCy(b) - cur.y);
          if (d > cur.r + 1) continue;
          if (dzHit(b, 0.62 * Math.pow(Math.max(0, 1 - d / (cur.r + 1)), 0.7) / 3, 0.85)) cur.st.bld.add(b.id);
        }
        if (cur.pulse === 1) {
          // дороги: трещины — клетку надо мостить заново (строитель, камень)
          const R = Math.ceil(cur.r);
          for (let y = Math.floor(cur.y) - R; y <= cur.y + R; y++) for (let x = Math.floor(cur.x) - R; x <= cur.x + R; x++) {
            if (!inb(x, y) || cur.st.road >= 30) continue;
            const i = idx(x, y), d = Math.hypot(x + 0.5 - cur.x, y + 0.5 - cur.y);
            if (!World.road[i] || d > cur.r || World.door[i] || Math.random() > 0.33 * (1 - d / cur.r)) continue;
            setRoad(x, y, false);
            if (placeRoadSite(x, y)) cur.st.road++; else setRoad(x, y, true);
          }
        }
      }
      return age > 7;
    },
  },

  // ---------- Ураган (смерч) ----------
  wind: {
    start(cur) {
      cur.px = cur.x; cur.py = cur.y; cur.fl = []; cur.seen = new Set(); cur.hit = {}; cur.ct = 0;
      cur.stamp = null; cur.len = Math.hypot(cur.ex - cur.x, cur.ey - cur.y);
      if (typeof rainStart === 'function' && dzSeason() !== 2) rainStart(50);
      const t = 'Ураган! Смерч уносит гномов, зверей и героя и роняет их где придётся. Прячьтесь в дома';
      dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
    },
    tick(cur, dt) {
      const age = Game.time - cur.t0, sp = 1.4, p = Math.min(1, age * sp / cur.len);
      const nx = (cur.ex - cur.x) / cur.len, ny = (cur.ey - cur.y) / cur.len, wob = Math.sin(age * 0.9) * 2.2;
      cur.px = cur.x + (cur.ex - cur.x) * p - ny * wob; cur.py = cur.y + (cur.ey - cur.y) * p + nx * wob;
      dzFlyTick(cur);
      cur.ct += dt;
      if (cur.ct >= 0.25 && p < 1) {
        cur.ct = 0;
        dzWindGrab(cur);
        for (const b of dzDone()) {
          if (dzDistB(b, cur.px, cur.py) > 1.6) continue;
          const had = cur.hit[b.id] || 0;
          if (had >= 0.35) continue;
          const d = dzHit(b, 0.05, 0.8);
          cur.hit[b.id] = had + 0.05;
          if (d) cur.st.bld.add(b.id);
        }
        for (let y = Math.floor(cur.py) - 1; y <= cur.py + 1; y++) for (let x = Math.floor(cur.px) - 1; x <= cur.px + 1; x++) {
          if (!inb(x, y)) continue;
          const i = idx(x, y), o = World.obj[i];
          if (o && o.t === 'tree' && !o.awake && o.g > 0.3 && cur.st.tree < 15 && Math.random() < 0.12) { World.obj[i] = { t: 'stump', g: 0 }; World.growing.add(i); cur.st.tree++; }
          else if (o && o.t === 'field' && !o.plan && o.g >= 0 && Math.random() < 0.25) { o.g = -1; cur.st.field++; }
        }
      }
      if (p >= 1 && !cur.fl.length) return true;
      return age > 90;
    },
  },

  // ---------- Тайфун ----------
  typhoon: {
    start(cur) {
      cur.wave = 0; cur.reach = 0; cur.wt = 0; cur.hb = {};
      if (typeof rainStart === 'function' && dzSeason() !== 2) rainStart(70);
      const t = 'Тайфун! Волны бьют в берег и смывают постройки у самой воды. Склад в глубине суши в безопасности';
      dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
    },
    tick(cur, dt) {
      const sd = dzSeaPrep(), age = Game.time - cur.t0;
      if (!sd) return true;
      cur.wt += dt;
      cur.reach = Math.max(0, Math.sin(cur.wt / 3 * Math.PI)) * (1 + (cur.wave % 3));   // накат 1…3 клетки
      if (cur.wt >= 3) {
        cur.wt = 0; cur.wave++;
        const reach = 1 + ((cur.wave - 1) % 3);
        for (const b of dzDone()) {
          if (dzCore(b) || Math.hypot(dzCx(b) - cur.x, dzCy(b) - cur.y) > cur.r) continue;
          const d = dzSeaDistB(b, sd);
          if (!d || d > reach) continue;
          if (!cur.hb[b.id]) { cur.hb[b.id] = 1; cur.st.spoil += dzSpoil(b, 0.25); }
          if (dzHit(b, 0.09 * (d === 1 ? 1.4 : 1), 0.85)) cur.st.bld.add(b.id);
        }
        const R = cur.r;
        for (let y = Math.floor(cur.y - R); y <= cur.y + R; y++) for (let x = Math.floor(cur.x - R); x <= cur.x + R; x++) {
          if (!inb(x, y)) continue;
          const i = idx(x, y), d = sd[i];
          if (!d || d === 255 || d > reach) continue;
          const o = World.obj[i];
          if (o && o.t === 'field' && !o.plan && o.g >= 0) { o.g = -1; cur.st.field++; }
          if (World.road[i] && d <= 2 && cur.st.road < 15 && !World.door[i] && Math.random() < 0.2) { setRoad(x, y, false); if (placeRoadSite(x, y)) cur.st.road++; else setRoad(x, y, true); }
        }
      }
      if (age > 45) {
        // в конце волна смывает самый битый дом у самой кромки (если правила позволяют)
        let worst = null;
        for (const b of dzDone()) if (cur.hb[b.id] && dzSeaDistB(b, sd) === 1 && b.dmg >= 0.6 && (!worst || b.dmg > worst.dmg)) worst = b;
        if (worst && Math.random() < 0.7) dzRaze(worst, cur, 'Тайфун');
        return true;
      }
      return false;
    },
  },

  // ---------- Гибель посевов ----------
  blight: {
    start(cur) {
      const D = DZ(), wells = dzWells(), d = dzDif(), until = Game.time + CYCLE * d.bdays;
      D.yb = dzYear();
      let share = d.blight;
      // уже голодаем к зиме — бьёт мягче: подготовка сложнее, но не безнадёжна
      if (typeof seaFoodInfo === 'function') { const f = seaFoodInfo(); if (f.need && f.have < f.need * 0.6) share *= 0.6; }
      const fields = [];
      for (let i = 0; i < N_TILES; i++) { const o = World.obj[i]; if (o && o.t === 'field' && !o.plan && o.g >= 0 && !o.bl) fields.push(i); }
      const cap = Math.floor(fields.length * share);
      let lost = 0, saved = 0;
      for (const i of fields.sort(() => Math.random() - 0.5)) {
        if (lost >= cap) break;
        const o = World.obj[i], x = i % MAP_W, y = (i / MAP_W) | 0;
        if (cur.v === 'd' && dzWellNear(x + 0.5, y + 0.5, wells)) { saved++; continue; }
        if (cur.v === 'f' && o.ash && Math.random() < 0.5) { saved++; continue; }
        o.g = 0; o.bl = until; o.bk = cur.v;
        D.bl.push(i);
        lost++;
      }
      cur.st.field = lost;
      const days = d.bdays < 1 ? 'полсуток' : d.bdays > 1 ? 'полтора суток' : 'сутки';
      const t = (cur.v === 'd' ? `Засуха: посевы сохнут — погибло полей: ${lost}` : `Ранние заморозки: побило полей: ${lost}`)
        + (saved ? `, уцелело благодаря ${cur.v === 'd' ? 'колодцам' : 'пеплу'}: ${saved}` : '') + `. Эти поля не растут ${days} — заготовь зерно и сено заранее`;
      dzSay(t, cur.x, cur.y); dzLog(t, cur.x, cur.y);
    },
    tick() { return true; },
  },
};

// ---------- Ураган: кто летит ----------
function dzFlyDest(cur, x, y) {
  if (!cur.stamp) { const h = dzHub(); cur.stamp = h ? floodFrom(h.doorX, h.doorY) : null; }
  for (let t = 0; t < 40; t++) {
    const a = Math.random() * 6.283, r = dzR(6, 13), tx = Math.floor(x + Math.cos(a) * r), ty = Math.floor(y + Math.sin(a) * r);
    if (!inb(tx, ty) || !isWalkable(tx, ty) || World.bmap[idx(tx, ty)] || World.terrain[idx(tx, ty)] === T_WATER) continue;
    if (cur.stamp && !reachedIn(cur.stamp, tx, ty)) continue;
    return [tx + 0.5, ty + 0.5];
  }
  return null;
}
function* dzFlyGen(u, dur) {
  u.brk.until = Game.time + dur + 8;
  u.slip = { d: [0, 0] };          // поза полёта (weatherPose) читает u.slip — держим до конца перерыва
  try {
    yield { wait: dur, anim: 'slipfly' };
    yield { wait: 1.4, anim: 'slipLie' };
    yield { wait: 0.6, anim: 'getup' };
  } finally { if (u.slip && u.slip.d[0] === 0 && u.slip.d[1] === 0) u.slip = null; }
  if (Math.random() < 0.7 && typeof floater === 'function') floater(u.x, u.y - 1, ['Где я?', 'Ох, голова…', 'Ещё разок!', 'Ну и ветер…'][(Math.random() * 4) | 0], '#e0f0ff');
}
function dzWindGrab(cur) {
  if (cur.fl.length >= 4 || cur.st.fly >= 10) return;
  const near = (o) => !cur.seen.has(o) && Math.hypot(o.x - cur.px, o.y - cur.py) < 1.4;
  const take = (o, kind) => {
    const dst = dzFlyDest(cur, o.x, o.y);
    if (!dst) return;
    cur.seen.add(o);
    const dur = 1.8 + Math.hypot(dst[0] - o.x, dst[1] - o.y) * 0.1;
    cur.fl.push({ o, kind, x0: o.x, y0: o.y, x1: dst[0], y1: dst[1], t0: Game.time, dur });
    cur.st.fly++;
    if (kind === 'u') {
      if (typeof startBreak === 'function') startBreak(o, 'wind', dzFlyGen(o, dur));
      if (typeof floater === 'function') floater(o.x, o.y - 1, 'А-а-а!', '#e0f0ff');
    }
  };
  for (const u of Game.units) if (!u.dead && !u.inside && u.type !== 'carter' && !u.glide && !u._bog && near(u)) take(u, 'u');
  for (const a of Game.animals) if (!a.dead && near(a)) take(a, 'a');
  for (const N of Game.neutrals || []) if (N.st !== 'die' && !N.boss && near(N)) take(N, 'n');
}
function dzFlyTick(cur) {
  const now = Game.time;
  for (let k = cur.fl.length - 1; k >= 0; k--) {
    const f = cur.fl[k], o = f.o, p = Math.min(1, (now - f.t0) / f.dur), e = p * p * (3 - 2 * p);
    if (o.dead || o.inside) { cur.fl.splice(k, 1); continue; }
    o.x = f.x0 + (f.x1 - f.x0) * e; o.y = f.y0 + (f.y1 - f.y0) * e;
    o.dzLift = Math.sin(p * Math.PI);
    if (p >= 1) {
      cur.fl.splice(k, 1); o.dzLift = 0;
      if (f.kind === 'u' && typeof floater === 'function') floater(o.x, o.y - 1, 'Бух!', '#ffe0a0');
      if (f.kind === 'n' && o.ov) o.ov = null;
    }
  }
}

// ---------- Ход времени ----------

function dzBlightTick(D) {
  if (!D.bl.length) return;
  const now = Game.time;
  for (let k = D.bl.length - 1; k >= 0; k--) {
    const i = D.bl[k], o = World.obj[i];
    if (!o || o.t !== 'field' || !o.bl) { D.bl.splice(k, 1); continue; }
    if (now >= o.bl) { delete o.bl; delete o.bk; o.g = 0; World.growing.add(i); D.bl.splice(k, 1); }
    else if (o.g !== 0) o.g = 0;                       // стоит пожухшим: не растёт, не жнётся, не пересевается
  }
}
function dzTick(dt) {
  if (dzMirror()) return;
  const D = DZ();
  dzBlightTick(D);
  if (D.cur) { if (DZ_RUN[D.cur.k].tick(D.cur, dt)) dzEnd(D); return; }
  if (D.pend) { if (Game.time >= D.pend.at) dzStrike(D); return; }
  D.chk = (D.chk || 0) + dt;
  if (D.chk < 2) return;
  D.chk = 0;
  if (Game.time < D.next || !dzAllowed(D)) return;
  dzRoll(D);
}

// ---------- Ремонт после стихии стоит материалов ----------

function dzFixCost(b) {
  const c = b.def.cost || {}, k = 0.35 * Math.max(0.2, b.dmg || 0), out = {};
  for (const g of ['trunk', 'timber', 'stone']) if (c[g]) out[g] = Math.max(1, Math.ceil(c[g] * k));
  if (!Object.keys(out).length) out.timber = 1;
  return out;
}
function dzStores() { return Game.buildings.filter(b => !b.removed && b.isStore && b.isStore()); }
function dzLack(cost) {
  const st = dzStores();
  for (const g in cost) { let have = 0; for (const b of st) have += Math.max(0, (b.stock[g] || 0) - ((b.reserved && b.reserved[g]) || 0)); if (have < cost[g]) return g; }
  return null;
}
function dzPay(cost) {
  for (const g in cost) {
    let need = cost[g];
    for (const b of dzStores()) { const take = Math.min(need, Math.max(0, (b.stock[g] || 0) - ((b.reserved && b.reserved[g]) || 0))); b.stock[g] -= take; need -= take; if (need <= 0) break; }
  }
}
const dzCostText = c => Object.keys(c).map(g => `${c[g]} ${(GOODS[g] ? GOODS[g].name : g).toLowerCase()}`).join(', ');

{
  // ремонтник сначала забирает со склада материалы; их нет — здание ждёт, гномы заняты другим
  const _rg = repairGen;
  repairGen = function* (u, b) {
    if (b && b.dzFix && !b.removed && b.dmg > 0) {
      const cost = dzFixCost(b);
      if (dzLack(cost)) { b.repairer = null; u.repairJob = null; yield { wait: 1 }; return; }
      dzPay(cost); b.dzFix = 0;
      if (typeof floater === 'function') floater(dzCx(b), b.y, '−' + dzCostText(cost), '#e8d0a0');
    }
    yield* _rg(u, b);
  };
  const _dr = dispatchRepairs;
  dispatchRepairs = function (idle) {
    // здание без материалов на ремонт пропускаем, чтобы гномы не бегали к нему впустую
    const hold = [];
    for (const b of Game.buildings) {
      if (!b.dzFix || !(b.dmg > 0.05) || b.repairer) continue;
      const cost = dzFixCost(b);
      if (dzLack(cost)) {
        hold.push([b, b.dmg]); b.dmg = 0;
        const D = DZ();
        if ((!b.dzWarnT || Game.time - b.dzWarnT > 300) && !(Game.time - (D.warnT || -1e9) < 60)) { b.dzWarnT = D.warnT = Game.time; dzSay(`Ремонт после стихии: «${b.def.name}» ждёт материалы — ${dzCostText(cost)}`, b.doorX, b.doorY); }
      }
    }
    try { _dr(idle); } finally { for (const [b, d] of hold) b.dmg = d; }
  };
}

// ---------- Колодец ----------

BUILDINGS.well = {
  name: 'Колодец', cat: 'Основа', w: 2, h: 2, top: 54, noRotate: true, cost: { timber: 2, stone: 4 },
  desc: `Каменный колодец с воротом. В радиусе ${WELL_R} клеток пожар гасят вёдрами: огонь горит вдвое короче, почти не перекидывается, а дома не сгорают дотла. Поля рядом не сохнут в засуху.`,
};
BUILD_ORDER.push('well');
UNLOCKS.push({ id: 'well', items: ['well'], after: ['farm'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.well = 'Колодец';
if (typeof MODELS !== 'undefined') {
  MODELS.well = function (m) {
    m.ground((c, mm) => {
      groundPoly(c, mm, [[10, 12], [54, 12], [54, 54], [10, 54]], 'rgba(110,100,84,0.55)');
    });
    m.prop((c, x, y) => {
      c.save();
      c.fillStyle = 'rgba(10,8,6,0.35)'; c.beginPath(); c.ellipse(x + 2, y + 2, 15, 6, 0, 0, 7); c.fill();
      // каменное кольцо: светлая левая грань, тёмная правая
      c.fillStyle = '#8e8a80'; c.fillRect(x - 13, y - 14, 26, 14);
      c.fillStyle = '#a8a498'; c.fillRect(x - 13, y - 14, 9, 14);
      c.fillStyle = '#6a665e'; c.fillRect(x + 5, y - 14, 8, 14);
      c.strokeStyle = '#1e1a16'; c.lineWidth = 1;
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) c.strokeRect(x - 13 + k * 6.5 + (r % 2) * 3, y - 14 + r * 4.6, 6.5, 4.6);
      c.fillStyle = '#5a564e'; c.beginPath(); c.ellipse(x, y - 14, 13, 4.5, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#1c2a3a'; c.beginPath(); c.ellipse(x, y - 14, 10, 3.2, 0, 0, 7); c.fill();
      c.fillStyle = '#4a7aa0'; c.fillRect(x - 4, y - 15, 5, 1);
      // столбы, ворот и двускатная крыша
      c.fillStyle = '#5a3a22'; c.fillRect(x - 12, y - 34, 3, 21); c.fillRect(x + 9, y - 34, 3, 21);
      c.fillStyle = '#7a5232'; c.fillRect(x - 12, y - 27, 24, 3);
      c.fillStyle = '#3a2614'; c.fillRect(x + 12, y - 28, 4, 2);
      c.fillStyle = '#8a4a2a'; c.beginPath(); c.moveTo(x - 17, y - 32); c.lineTo(x, y - 44); c.lineTo(x + 17, y - 32); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a05a32'; c.beginPath(); c.moveTo(x - 17, y - 32); c.lineTo(x, y - 44); c.lineTo(x, y - 32); c.closePath(); c.fill();
      // ведро на верёвке
      c.strokeStyle = '#c8b890'; c.beginPath(); c.moveTo(x + 1, y - 25); c.lineTo(x + 1, y - 19); c.stroke();
      c.fillStyle = '#6a4a2a'; c.fillRect(x - 2, y - 19, 6, 5); c.fillStyle = '#9a9a9a'; c.fillRect(x - 2, y - 17, 6, 1);
      c.restore();
    }, 32, 40);
  };
}

// ---------- Сейв ----------

{
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.dz = dzNew(); };
  const _setup = setupStart;
  setupStart = function (...a) { _setup(...a); Game.dz = dzNew(); DZS.key = ''; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), D = DZ();
    s.dz = { v: 1, nx: Math.max(0, Math.round(D.next - Game.time)), f: D.freq, l: D.last, n: D.n, yb: D.yb, h: D.hist,
      p: D.pend ? Object.assign({}, D.pend, { at: Math.max(1, Math.round(D.pend.at - Game.time)), t0: 0 }) : null,
      bl: D.bl.map(i => { const o = World.obj[i]; return o && o.bl ? [i, Math.max(1, Math.round(o.bl - Game.time)), o.bk || 'd'] : null; }).filter(Boolean),
      fx: Game.buildings.filter(b => b.dzFix && b.dmg > 0).map(b => b.id) };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const D = Game.dz = dzNew();
    DZS.key = '';
    const q = s.dz;
    if (!q) { D.next = Game.time + CYCLE * 1.2; return; }   // старое сохранение: первое бедствие не сразу
    D.next = Game.time + (q.nx || 0); D.freq = q.f != null ? q.f : D.freq; D.last = q.l || ''; D.n = q.n || 0; D.yb = q.yb != null ? q.yb : -1; D.hist = q.h || {};
    if (q.p && DZ_RUN[q.p.k]) D.pend = Object.assign({}, q.p, { at: Game.time + q.p.at, t0: Game.time });
    for (const [i, left, k] of q.bl || []) { const o = World.obj[i]; if (o && o.t === 'field') { o.bl = Game.time + left; o.bk = k; o.g = 0; D.bl.push(i); } }
    const fx = new Set(q.fx || []);
    for (const b of Game.buildings) if (fx.has(b.id)) b.dzFix = 1;
  };
  const _step = step;
  step = function (dt) { _step(dt); dzTick(dt); };
  // погибшее поле не растёт (updateGrowth может стоять за обёрткой сезонов)
  const _ug = updateGrowth;
  updateGrowth = function (dt) { _ug(dt); const D = Game.dz; if (D && D.bl.length) for (const i of D.bl) { const o = World.obj[i]; if (o && o.bl && o.g !== 0) o.g = 0; } };
}

// ---------- Кооператив: зеркало внутри сезонного ----------

function dzLite(c) {
  if (!c) return null;
  const o = { k: c.k, t0: c.t0, x: c.x, y: c.y, r: c.r, v: c.v };
  if (c.k === 'fire') { o.f = c.f.map(q => q.i); o.b = c.b.map(q => q.id); o.ash = c.ash.slice(-160); }
  if (c.k === 'quake') o.cr = c.cr;
  if (c.k === 'wind') { o.px = +c.px.toFixed(2); o.py = +c.py.toFixed(2); o.fl = c.fl.map(f => [+f.o.x.toFixed(2), +f.o.y.toFixed(2)]); }
  if (c.k === 'typhoon') o.reach = +c.reach.toFixed(2);
  return o;
}
function dzMirrorOut() {
  const D = DZ();
  return { f: D.freq, p: D.pend ? { k: D.pend.k, at: D.pend.at, t0: D.pend.t0, x: D.pend.x, y: D.pend.y, v: D.pend.v, ex: D.pend.ex, ey: D.pend.ey } : null, c: dzLite(D.cur) };
}
function dzMirrorIn(m) {
  if (!m) return;
  const D = DZ();
  D.freq = m.f; D.pend = m.p; D.cur = m.c;
}
if (typeof seaMirrorOut === 'function') {
  const _o = seaMirrorOut, _i = seaMirrorIn;
  seaMirrorOut = function () { const o = _o(); if (o) o.dz = dzMirrorOut(); return o; };
  seaMirrorIn = function (m) { _i(m); if (m && m.dz) dzMirrorIn(m.dz); };
}

// ---------- Звук (свой синтез) ----------

if (typeof SFX_DEF !== 'undefined' && typeof SFX !== 'undefined') {
  Object.assign(SFX_DEF, {
    dzOmen: { pri: 3, gain: 0.5, poly: 1, cd: 2, len: 2.6 },
    dzRumble: { pri: 3, gain: 0.75, poly: 1, cd: 1.5, len: 4 },
    dzWind: { pri: 2, gain: 0.5, poly: 1, cd: 1.8, len: 3 },
    dzSurge: { pri: 2, gain: 0.55, poly: 2, cd: 0.8, len: 2.2 },
    dzBlaze: { pri: 2, gain: 0.45, poly: 2, cd: 0.6, len: 1.3 },
    dzSplash: { pri: 1, gain: 0.35, poly: 2, cd: 0.25, len: 0.5 },
    dzWither: { pri: 2, gain: 0.4, poly: 1, cd: 1, len: 1.8 },
  });
  Object.assign(SFX, {
    // знамение: два низких удара колокола с долгим гулом
    dzOmen: (d, t) => { modal(d, t, [[196, 1, 2.2], [392, 0.4, 1.4], [523, 0.2, 0.9]], 0.5); modal(d, t + 0.7, [[174.6, 0.8, 1.8], [349, 0.3, 1.2]], 0.4); },
    // подземный гул и треск камня
    dzRumble: (d, t) => {
      noiseHit(d, 'lowpass', 180, 40, 0.8, t, 3.8, 0.9, 0.35);
      tone(d, 'sine', 44, 28, t, 3.6, 0.55, 0.3);
      for (let k = 0; k < 6; k++) noiseHit(d, 'bandpass', 600 + Math.random() * 900, 300, 2, t + 0.3 + k * 0.5 + Math.random() * 0.2, 0.08, 0.35, 0.002);
    },
    // вой ветра: полосовой шум с плавающей частотой
    dzWind: (d, t) => { noiseHit(d, 'bandpass', 380, 900, 3, t, 1.5, 0.5, 0.5); noiseHit(d, 'bandpass', 900, 420, 4, t + 1.2, 1.7, 0.45, 0.4); },
    // накат волны: нарастающий шум и шипение пены
    dzSurge: (d, t) => { noiseHit(d, 'lowpass', 300, 1400, 0.7, t, 1.1, 0.6, 0.6); noiseHit(d, 'highpass', 3000, 1800, 0.8, t + 0.9, 1.2, 0.35, 0.05); },
    // огонь занялся: глухое «ух» и треск
    dzBlaze: (d, t) => { noiseHit(d, 'lowpass', 600, 120, 0.8, t, 0.7, 0.6, 0.03); for (let k = 0; k < 5; k++) noiseHit(d, 'bandpass', 1500 + Math.random() * 2500, 1200, 3, t + 0.2 + k * 0.12, 0.015, 0.3, 0.001); },
    // ведро воды на огонь
    dzSplash: (d, t) => { noiseHit(d, 'highpass', 2500, 900, 0.8, t, 0.35, 0.45, 0.005); tone(d, 'sine', 500, 180, t, 0.12, 0.15, 0.003); },
    // сухой шелест и «ш-ш» — посевы гибнут
    dzWither: (d, t) => { noiseHit(d, 'highpass', 5000, 2500, 0.7, t, 1.5, 0.3, 0.3); tone(d, 'triangle', 330, 220, t, 1.2, 0.12, 0.2); },
  });
}
function dzSnd(kind, x, y, v = 1) {
  if (typeof sfxAt !== 'function' || typeof R === 'undefined' || !R.cam || !R.canvas) return;
  if (x == null) { const z = typeof devScale === 'function' ? devScale() : 1; sfxAt(kind, R.cam.x + R.canvas.width / z / 2, R.cam.y + R.canvas.height / z / 2, v); }
  else sfxAt(kind, x * TILE, y * TILE, v);
}

// ---------- Вид: эффекты, звук и тряска (и одиночная игра, и клиент коопа) ----------

const DZV = { pk: '', ck: '', t: 0, sndT: 0, fxT: 0, shake: 0 };
const dzView = () => { const D = Game.dz; return D ? { p: D.pend, c: dzMirror() ? D.cur : dzLite(D.cur) } : { p: null, c: null }; };
function dzViewTick() {
  if (typeof document === 'undefined') return;
  const now = performance.now() / 1000, dt = Math.min(0.1, now - (DZV.t || now)); DZV.t = now;
  const { p, c } = dzView();
  const pk = p ? p.k + p.at : '', ck = c ? c.k + c.t0 : '';
  if (pk && pk !== DZV.pk) dzSnd('dzOmen');
  DZV.pk = pk;
  if (ck && ck !== DZV.ck) {
    if (c.k === 'quake') { dzSnd('dzRumble'); }
    if (c.k === 'fire') dzSnd('dzBlaze', c.x, c.y);
    if (c.k === 'blight') dzSnd('dzWither');
    if (c.k === 'wind') dzSnd('dzWind');
  }
  DZV.ck = ck;
  if (Game.paused) return;
  DZV.sndT -= dt; DZV.fxT -= dt;
  if (!c) return;
  const fx = typeof fxBurst === 'function';
  if (c.k === 'fire' && c.f && c.f.length) {
    if (DZV.sndT <= 0) { DZV.sndT = 0.25 + Math.random() * 0.3; const i = c.f[(Math.random() * c.f.length) | 0]; if (typeof sfxAt === 'function') sfxAt('crackle', (i % MAP_W + 0.5) * TILE, ((i / MAP_W) | 0) * TILE, 0.8); }
    if (DZV.fxT <= 0 && fx) {
      DZV.fxT = 0.6;
      // вёдра: у колодца в радиусе огня летят брызги
      const wells = dzWells();
      for (const i of c.f.slice(0, 12)) {
        const x = i % MAP_W + 0.5, y = ((i / MAP_W) | 0) + 0.5;
        if (dzWellNear(x, y, wells) && Math.random() < 0.5) { fxBurst(x * TILE, y * TILE - 6, 8, ['#bfe8ff', '#7ac0f0', '#ffffff'], 50, 50, 0.6, 2, 200); if (Math.random() < 0.3) dzSnd('dzSplash', x, y, 0.7); }
      }
    }
  }
  if (c.k === 'quake') {
    const age = Game.time - c.t0;
    DZV.shake = age < 7 ? Math.max(0, 1 - age / 7) * (2 + 3 * Math.abs(Math.sin(age * 1.6))) : 0;
    if (DZV.fxT <= 0 && fx && age < 6) {
      DZV.fxT = 0.35;
      for (const b of dzDone()) if (Math.hypot(dzCx(b) - c.x, dzCy(b) - c.y) < c.r && Math.random() < 0.3) fxBurst(dzCx(b) * TILE, (b.y + b.h) * TILE - 4, 7, ['#8a7a60', '#6a5a44', '#c8a070'], 60, 40, 0.8, 2.2, 240);
    }
  } else DZV.shake = 0;
  if (c.k === 'wind' && DZV.sndT <= 0) { DZV.sndT = 2.6; dzSnd('dzWind', c.px, c.py, 1); }
  if (c.k === 'typhoon' && DZV.sndT <= 0) { DZV.sndT = 3; dzSnd('dzSurge', c.x, c.y, 1); }
}

// ---------- Рисование ----------

function dzDrawList(list, c, x0, y0, x1, y1) {
  const { p, c: cur } = dzView(), t = Game.time;
  const vis = (x, y, m = 2) => x >= x0 - m && x <= x1 + m && y >= y0 - m && y <= y1 + m;
  // поля: пожухшие (засуха) и в инее (заморозки)
  const D = Game.dz;
  if (D) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = World.obj[idx(x, y)];
    if (!o || o.t !== 'field' || !o.bl) continue;
    list.push([y + 0.02, () => {
      const fr = o.bk === 'f';
      c.fillStyle = fr ? 'rgba(220,236,255,0.55)' : 'rgba(150,110,50,0.55)';
      c.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
      c.fillStyle = fr ? '#f4fbff' : '#5a3a1a';
      for (let k = 0; k < 9; k++) c.fillRect(x * TILE + 3 + ((k * 11 + x * 5) % 25), y * TILE + 4 + ((k * 7 + y * 3) % 23), fr ? 2 : 3, 1);
    }]);
  }
  if (p && vis(p.x, p.y, 6)) list.push([p.y + 0.5, () => dzDrawOmen(c, p, t)]);
  if (!cur) return;
  if (cur.ash) for (const i of cur.ash) {
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (!vis(x, y)) continue;
    list.push([y + 0.03, () => { c.fillStyle = 'rgba(28,22,18,0.45)'; c.beginPath(); c.ellipse((x + 0.5) * TILE, (y + 0.6) * TILE, 13, 7, 0, 0, 7); c.fill(); }]);
  }
  if (cur.k === 'fire') {
    for (const i of cur.f || []) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      if (!vis(x, y)) continue;
      list.push([y + 0.95, () => { drawFire(c, (x + 0.5) * TILE, (y + 0.85) * TILE, 'camp', t, i, { sparks: 3 }); dzSmoke(c, (x + 0.5) * TILE, (y + 0.1) * TILE, t, i); }]);
    }
    for (const id of cur.b || []) {
      const b = Game.buildings.find(o => o.id === id);
      if (!b || !vis(dzCx(b), dzCy(b), 4)) continue;
      list.push([b.y + b.h - 0.04, () => {
        const top = (b.def.top || 60) * 0.45;
        for (let k = 0; k < Math.max(2, b.w); k++) {
          const fx = (b.x + 0.5 + k * (b.w - 1) / Math.max(1, b.w - 1)) * TILE, fy = (b.y + b.h * 0.55) * TILE - top * (0.4 + 0.3 * ((k + id) % 2));
          drawFire(c, fx, fy, 'blaze', t, id * 3 + k, { sparks: 4 });
        }
        dzSmoke(c, dzCx(b) * TILE, b.y * TILE - top, t, id);
      }]);
    }
  }
  if (cur.k === 'quake' && cur.cr) for (const [x, y, s] of cur.cr) {
    if (!vis(x, y)) continue;
    list.push([y - 0.4, () => {
      const r = mulberry32(s), a = Math.min(1, (t - cur.t0) / 1.2), fade = Math.max(0, 1 - Math.max(0, t - cur.t0 - 40) / 30);
      c.save(); c.globalAlpha = a * fade * 0.85; c.strokeStyle = '#1a120a'; c.lineWidth = 2;
      let px = x * TILE, py = y * TILE;
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 18; py += (r() - 0.5) * 10; c.lineTo(Math.round(px), Math.round(py)); }
      c.stroke(); c.restore();
    }]);
  }
  if (cur.k === 'wind' && cur.px != null) {
    list.push([cur.py + 0.6, () => dzDrawTwister(c, cur.px * TILE, (cur.py + 0.5) * TILE, t, 1)]);
  }
  if (cur.k === 'typhoon') dzDrawSurge(list, c, cur, x0, y0, x1, y1, t);
}
function dzSmoke(c, x, y, t, s) {
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.3 + k / 4 + s * 0.17) % 1;
    c.fillStyle = `rgba(70,64,60,${(0.45 * (1 - p)).toFixed(3)})`;
    c.beginPath(); c.arc(Math.round(x + Math.sin(p * 4 + k + s) * 8), Math.round(y - p * 46), 3 + p * 8, 0, 7); c.fill();
  }
}
// смерч: воронка из полос (контур, бегущие полосы — вращение), пыльное облако у земли и мусор вокруг
const DZ_TW = ['#3e3830', '#5c554a', '#7e766a', '#a49c8e'];
function dzDrawTwister(c, x, y, t, a) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = 'rgba(30,24,18,0.35)'; c.beginPath(); c.ellipse(x, y, 30, 10, 0, 0, 7); c.fill();
  const N = 22, st = Math.floor(t * 14);
  for (let k = N - 1; k >= 0; k--) {
    const h = k * 6, w = Math.round(4 + Math.pow(k, 1.35) * 1.15), sw = Math.round(Math.sin(t * 2.4 + k * 0.32) * (1.5 + k * 0.55));
    const xl = Math.round(x + sw - w), yy = Math.round(y - h - 8);
    c.fillStyle = '#221e18'; c.fillRect(xl - 1, yy - 1, w * 2 + 2, 8);
    c.fillStyle = DZ_TW[(k + st) % 4]; c.fillRect(xl, yy, w * 2, 6);
    c.fillStyle = DZ_TW[3]; c.fillRect(xl + 1, yy + 1, Math.max(1, Math.round(w * 0.35)), 2);          // светлый край слева
    c.fillStyle = DZ_TW[0]; c.fillRect(xl + w * 2 - Math.max(1, Math.round(w * 0.3)), yy + 2, Math.max(1, Math.round(w * 0.3)), 4);   // тень справа
  }
  // пыль у основания
  for (let k = 0; k < 7; k++) {
    const ang = t * 3 + k * 0.9, r = 12 + (k % 3) * 7;
    c.fillStyle = k % 2 ? 'rgba(120,96,64,0.7)' : 'rgba(150,126,92,0.6)';
    c.beginPath(); c.ellipse(Math.round(x + Math.cos(ang) * r), Math.round(y - 4 + Math.sin(ang) * 3), 7, 4, 0, 0, 7); c.fill();
  }
  // мусор: щепки, листья, комья
  for (let k = 0; k < 14; k++) {
    const ang = t * (4 + (k % 3)) + k * 0.45, hh = 8 + ((k * 17) % 110), r = 6 + hh * 0.3;
    c.fillStyle = ['#6a4a2a', '#5a7a3a', '#3a2a1a', '#8a6a3a'][k % 4];
    c.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y - hh - 6 + Math.sin(ang) * 3), k % 3 ? 2 : 3, 2);
  }
  c.restore();
}
function dzDrawSurge(list, c, cur, x0, y0, x1, y1, t) {
  const sd = dzSeaPrep();
  if (!sd) return;
  const reach = cur.reach || 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = sd[idx(x, y)];
    if (!d || d === 255 || d > reach + 0.5) continue;
    if (Math.hypot(x - cur.x, y - cur.y) > (cur.r || 20) + 4) continue;
    list.push([y - 0.45, () => {
      const a = Math.min(1, reach - d + 1);
      c.fillStyle = `rgba(60,130,170,${(0.45 * a).toFixed(3)})`;
      c.fillRect(x * TILE, y * TILE, TILE, TILE);
      c.fillStyle = `rgba(240,250,255,${(0.8 * a).toFixed(3)})`;
      for (let k = 0; k < 5; k++) c.fillRect(x * TILE + ((k * 9 + Math.floor(t * 14) + x * 3) % 30), y * TILE + ((k * 13 + y * 7) % 28), 3, 2);
    }]);
  }
}
// знак на карте: пульсирующее кольцо цвета бедствия и маленький символ
const DZ_COL = { fire: '255,120,40', quake: '200,160,100', typhoon: '90,170,230', wind: '180,180,200', blight: '200,170,60' };
function dzDrawOmen(c, p, t) {
  const left = Math.max(0, p.at - t), k = 1 - left / DZ_WARN, x = p.x * TILE, y = p.y * TILE;
  const r = 18 + ((t * 30) % 26), col = DZ_COL[p.k];
  c.save();
  c.strokeStyle = `rgba(${col},${(0.8 * (1 - ((t * 30) % 26) / 26)).toFixed(3)})`; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y, r, r * 0.55, 0, 0, 7); c.stroke();
  if (p.k === 'wind') { dzDrawTwister(c, x, y, t, 0.25 + 0.5 * k); }
  else if (p.k === 'fire') { for (let q = 0; q < 3; q++) { const ph = (t * 0.4 + q / 3) % 1; c.fillStyle = `rgba(90,80,70,${(0.35 * (1 - ph)).toFixed(3)})`; c.beginPath(); c.arc(x + Math.sin(ph * 5 + q) * 6, y - 10 - ph * 40, 3 + ph * 7, 0, 7); c.fill(); } }
  else if (p.k === 'quake') { const j = Math.sin(t * 40) * 1.5 * k; c.fillStyle = '#4a3a2a'; for (let q = 0; q < 6; q++) c.fillRect(Math.round(x - 14 + q * 5 + j), Math.round(y - 2 + (q % 2) * 3), 3, 2); }
  else if (p.k === 'typhoon') { c.fillStyle = `rgba(20,40,70,${(0.25 * k).toFixed(3)})`; c.beginPath(); c.ellipse(x, y, 40, 22, 0, 0, 7); c.fill(); }
  else { c.fillStyle = p.v === 'f' ? '#e8f4ff' : '#a07030'; for (let q = 0; q < 8; q++) c.fillRect(Math.round(x - 16 + ((q * 9) % 32)), Math.round(y - 8 + ((q * 5) % 16)), 2, 2); }
  c.restore();
}
function dzTint(c) {
  const { p, c: cur } = dzView();
  const k = cur ? cur.k : p ? p.k : null;
  if (!k || typeof R === 'undefined') return;
  const z = devScale(), vw = R.canvas.width / z, vh = R.canvas.height / z, cam = R.cam;
  const a = cur ? (k === 'typhoon' || k === 'wind' ? 0.16 : k === 'fire' ? 0.08 : 0.05) : 0.06 * Math.min(1, (Game.time - p.t0) / DZ_WARN);
  const col = k === 'fire' ? '255,90,30' : k === 'typhoon' ? '20,40,80' : k === 'wind' ? '40,40,50' : k === 'blight' ? '170,120,40' : '90,70,50';
  c.fillStyle = `rgba(${col},${a.toFixed(3)})`;
  c.fillRect(cam.x - 2, cam.y - 2, vw + 4, vh + 4);
}

if (typeof weatherDrawList === 'function') {
  const _wdl = weatherDrawList;
  weatherDrawList = function (list, c, x0, y0, x1, y1) { _wdl(list, c, x0, y0, x1, y1); try { dzDrawList(list, c, x0, y0, x1, y1); } catch (e) { if (!dzDrawList.err) { dzDrawList.err = 1; console.error(e); } } };
}
if (typeof drawWeather === 'function') {
  const _dw = drawWeather;
  drawWeather = function (c) { _dw(c); try { dzTint(c); dzViewTick(); } catch (e) { if (!dzViewTick.err) { dzViewTick.err = 1; console.error(e); } } };
}
if (typeof render === 'function') {
  // тряска земли: камера на кадр сдвигается и возвращается
  const _r = render;
  render = function () {
    const s = DZV.shake;
    if (!s || typeof R === 'undefined' || !R.cam) { _r(); return; }
    const ox = Math.round((Math.random() - 0.5) * 2 * s), oy = Math.round((Math.random() - 0.5) * 2 * s);
    R.cam.x += ox; R.cam.y += oy;
    try { _r(); } finally { R.cam.x -= ox; R.cam.y -= oy; }
  };
}

// ---------- Настройка частоты (Меню → Настройки) ----------

function dzSetFreq(n) {
  const D = DZ();
  D.freq = ((n % 4) + 4) % 4;
  try { localStorage.setItem('feod.disasters', String(D.freq)); } catch (e) {}
  dzMenuSync();
  return D.freq;
}
function dzMenuSync() {
  const b = typeof document !== 'undefined' && document.getElementById('dz-btn');
  if (!b) return;
  b.querySelector('span').textContent = 'Стихийные бедствия: ' + DZ_FREQ_NAMES[DZ().freq];
  b.style.display = dzMirror() ? 'none' : '';
}
if (typeof MENU_GROUPS !== 'undefined') { const g = MENU_GROUPS.find(x => x.k === 'set'); if (g && !g.sel.includes('#dz-btn')) g.sel += ', #dz-btn'; }
if (typeof startGame === 'function') {
  const _s = startGame;
  startGame = function () {
    _s.apply(this, arguments);
    const list = document.querySelector('#tab-menu .menu-list');
    if (list && !document.getElementById('dz-btn')) {
      const b = document.createElement('button');
      b.id = 'dz-btn'; b.title = 'Пожары, землетрясения, тайфуны, ураганы и гибель посевов: как часто. Сложность тоже влияет. Деревня целиком не погибает';
      b.innerHTML = '<span></span>';
      b.onclick = () => dzSetFreq(DZ().freq + 1);
      list.appendChild(b);
    }
    dzMenuSync();
  };
}
