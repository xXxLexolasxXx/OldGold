'use strict';
// Семьи и поколения (СИСТЕМЫ.md, раздел 1). У каждого жителя — имя, род, пол, возраст (год = игровые сутки),
// супруг, родители и дети: u.fam = { n, r, sx, a, sp, pn, kn, g }.
//   Свадьбы: раз в сутки двое весёлых одиноких взрослых женятся (+настроение, бывает — праздник).
//   Дети: у пары рождается гномёнок (тип kid: не работает, ест, играет, ходит за мамой), на 3-й год становится трудягой.
//     Ребёнок наследует облик (колпак и бороду) одного из родителей и род отца. Гномята рождаются уже с бородой — так заведено.
//   Старость: с 28 лет работает медленнее, после 32 может тихо уйти к предкам (не «потеря»: призраков не прибавит;
//     на «Спокойном» старики не умирают). Горе в семье — родные тоскуют.
// Рождаемость ограничена: не больше ребёнка в сутки, деревня не растёт выше FAM_CAP по званию, нужна еда на складах.
// Веха «жители» (goal.js) считает только взрослых. Хроника — Game.fam.chron, часть «Семьи» во вкладке «Совет»,
// семья видна в карточке гнома. Сейв: s.units[k].fam (супруг — номером в списке), s.fam. Кооп: fam в пакете жителей.

const FAM_ADULT = 3, FAM_OLD = 28, FAM_DIE = 32;   // лет
const FAM_CAP = [18, 28, 40];                       // потолок жителей для рождений по званию
const FAM_KIDS = 3;                                 // детей на пару
const FAM_M = ['Брун', 'Гром', 'Дорн', 'Кетиль', 'Ульф', 'Хаград', 'Торбин', 'Гурни', 'Бальд', 'Ракк', 'Мурт', 'Сверр', 'Дробин', 'Хэмли', 'Тарк', 'Корм', 'Ойвин', 'Грюн', 'Бодо', 'Фаст'];
const FAM_F = ['Гильда', 'Брунна', 'Дагни', 'Хельга', 'Ингрид', 'Руна', 'Сигна', 'Торва', 'Эльда', 'Марна', 'Бетта', 'Ведда', 'Ормхильд', 'Кайса', 'Тюра', 'Ловиса'];
const FAM_CLANS = ['Дубобород', 'Камнелоб', 'Пивохлёб', 'Молотобой', 'Грибоед', 'Рудокоп', 'Медноус', 'Кривонос', 'Железнопуз', 'Златопуз', 'Пнеступ', 'Мохобор', 'Кремнезуб', 'Сажерук'];

UNIT_TYPES.kid = { name: 'Гномёнок', shirt: '#c8a050', noTrain: true };
if (!ALL_UNIT_KEYS.includes('kid')) ALL_UNIT_KEYS.push('kid');
if (typeof OUTFIT !== 'undefined') OUTFIT.kid = { cap: '#e86a3a', pants: '#5a4028', coat: '#3a7aa8' };

const famServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const famMirror = () => typeof Coop !== 'undefined' && !!Coop.mirror;
function famSay(text) { if (famServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
function famG() { return Game.fam || (Game.fam = { chron: [], st: { born: 0, wed: 0, died: 0, gen: 1 }, wedDay: -1, birthDay: -1 }); }
const famPick = a => a[(Math.random() * a.length) | 0];
const famDay = () => cycleAt(Game.time).k;
const famOn = u => !u.dead && isPerson(u) && u.type !== 'hero' && u.type !== 'carter' && !u.hero && !u.rec && !u.gm && !u.gx && !u.teamOf && !u.owner && UNIT_TYPES[u.type] && !UNIT_TYPES[u.type].recruit;
const famName = u => u.fam ? `${u.fam.n} ${u.fam.r}` : UNIT_TYPES[u.type].name;
const famStage = f => f.a < FAM_ADULT ? 'ребёнок' : f.a >= FAM_OLD ? 'старейшина' : 'взрослый';
function famNote(text) {
  const G = famG();
  G.chron.push([famDay() + 1, text]);
  if (G.chron.length > 40) G.chron.shift();
  if (typeof logEvent === 'function') logEvent('fam', text);
}

// лениво: у старых жителей семьи нет — придумываем
function famOf(u) {
  if (u.fam) return u.fam;
  const fem = u.type === 'waitress' || (u.type !== 'kid' && Math.random() < 0.45);
  u.fam = { n: famPick(fem ? FAM_F : FAM_M), r: famPick(FAM_CLANS), sx: fem ? 'f' : 'm', a: u.type === 'kid' ? 0 : Math.round((4 + Math.random() * 18) * 10) / 10, sp: 0, pn: null, kn: [], g: 1 };
  return u.fam;
}

// для mood.js: старость медленнее
function famMul(u) { const f = u.fam; return f && f.a >= FAM_OLD ? 0.92 : 1; }
const famAdults = () => Game.units.filter(u => famOn(u) && u.type !== 'kid').length;

// ---------- Ход времени ----------

const FAMT = { acc: 0 };
function famTick(dt) {
  FAMT.acc += dt;
  if (FAMT.acc < 5) return;
  const step = FAMT.acc; FAMT.acc = 0;
  if (Game.time < 20) return;
  const G = famG(), yr = step / CYCLE, calm = !!dif().noLoss;
  const people = [];
  for (const u of Game.units) {
    if (!famOn(u)) continue;
    const f = famOf(u);
    f.a = Math.round((f.a + yr) * 1000) / 1000;
    people.push(u);
    // вырос
    if (u.type === 'kid' && f.a >= FAM_ADULT) famGrowUp(u);
    // старость
    else if (f.a >= FAM_DIE && !calm && !u.inside && Math.random() < (0.25 + 0.1 * (f.a - FAM_DIE)) * step / CYCLE) famPassAway(u);   // чем старше — тем скорее
  }
  const day = famDay();
  // свадьба: не чаще раза в сутки, днём
  if (G.wedDay !== day && !isNightNow() && Math.random() < step / 120) {
    const free = people.filter(u => u.type !== 'kid' && !u.fam.sp && u.fam.a < FAM_OLD + 4 && (!u.md || u.md.m >= 48) && !u.inside && !u.dead);
    const a = free.filter(u => u.fam.sx === 'm'), b = free.filter(u => u.fam.sx === 'f');
    if (a.length && b.length) { G.wedDay = day; famWed(famPick(a), famPick(b)); }
  }
  // рождение: не чаще раза в сутки, нужна еда и место
  if (G.birthDay !== day && Math.random() < step / 150) {
    const rank = Game.goal ? Math.min(2, Game.goal.rank | 0) : 0;
    const food = famStore('bread') + famStore('sausage') + famStore('croissant') + famStore('steak');
    if (people.length < FAM_CAP[rank] && food >= Math.max(6, people.length / 2)) {
      const moms = people.filter(u => u.fam.sx === 'f' && u.type !== 'kid' && u.fam.a < FAM_OLD - 4 && u.fam.sp && (u.fam.kn || []).length < FAM_KIDS && !u.inside && !u.brk);
      const mom = moms.length ? famPick(moms) : null;
      const dad = mom && Game.unitMap.get(mom.fam.sp);
      if (mom && dad && !dad.dead) { G.birthDay = day; famBirth(mom, dad); }
    }
  }
}
function famStore(g) { let n = 0; for (const s of Game.buildings) if (s.isStore() && !s.removed) n += Math.max(0, s.offer(g)); return n; }

function famWed(a, b) {
  const G = famG();
  a.fam.sp = b.id; b.fam.sp = a.id;
  b.fam.r = a.fam.r;                                    // жена берёт род мужа
  G.st.wed++;
  for (const u of [a, b]) if (typeof moodPoke === 'function') moodPoke(u, 'wed', 12, 400);
  for (const u of Game.units) if (u !== a && u !== b && famOn(u) && Math.hypot(u.x - a.x, u.y - a.y) < 12 && typeof moodPoke === 'function') moodPoke(u, 'wedg', 3, 200);
  famNote(`Свадьба: ${a.fam.n} и ${b.fam.n} из рода ${a.fam.r}`);
  famSay(`Свадьба! ${a.fam.n} и ${b.fam.n} теперь семья`);
  if (Math.random() < 0.5 && !Game.festWish) Game.festWish = true;   // бывает, гуляет вся деревня (festival.js)
  if (typeof floater === 'function') { floater(a.x, a.y - 1.5, 'Горько!', '#ffd0e0'); floater(b.x, b.y - 1.5, '♥', '#ff8aa8'); }
}

function famBirth(mom, dad) {
  const G = famG();
  const p = (typeof randomFreeNear === 'function' && randomFreeNear(Math.floor(mom.x), Math.floor(mom.y), 0, 2)) || [Math.floor(mom.x), Math.floor(mom.y)];
  const k = spawnUnit('kid', p[0], p[1]);
  const heir = Math.random() < 0.5 ? dad : mom;
  k.look = heir.look;                                   // весь в отца (или в мать): колпак, борода, нос
  const fem = Math.random() < 0.45;
  k.fam = { n: famPick(fem ? FAM_F : FAM_M), r: dad.fam.r, sx: fem ? 'f' : 'm', a: 0, sp: 0, pn: [dad.fam.n, mom.fam.n], kn: [], g: Math.max(dad.fam.g || 1, mom.fam.g || 1) + 1 };
  k.food = 1;
  for (const u of [mom, dad]) { u.fam.kn = (u.fam.kn || []).concat(k.fam.n).slice(-6); if (typeof moodPoke === 'function') moodPoke(u, 'baby', 10, 400); }
  G.st.born++; G.st.gen = Math.max(G.st.gen, k.fam.g);
  famNote(`В семье ${dad.fam.r} пополнение: ${fem ? 'дочка' : 'сын'} ${k.fam.n}, ${k.fam.g}-е поколение. ${heir === dad ? 'Весь в отца' : 'Вся в мать'}`);
  famSay(`Родился гномёнок ${k.fam.n} ${k.fam.r}! Уже с бородой, как положено`);
}

function famGrowUp(u) {
  u.type = 'serf';
  u.proc = null; u.action = null; u.anim = null; u.idleFlag = false;
  famNote(`${u.fam.n} ${u.fam.r} вырос и взялся за работу${u.fam.pn ? ` — родители, ${u.fam.pn[0]} и ${u.fam.pn[1]}, гордятся` : ''}`);
  if (typeof floater === 'function') floater(u.x, u.y - 1.5, 'Я уже большой!', '#ffe9a0');
}

function famPassAway(u) {
  const f = u.fam, name = famName(u);
  const lost = Game.lostGnomes || 0;
  u.fam.old = true;
  removeUnit(u);
  Game.lostGnomes = lost;                               // ушёл к предкам — не «погиб»: призраков не прибавится
  famG().st.died++;
  famNote(`${name} ушёл к предкам на ${Math.floor(f.a)}-м году. ${f.kn && f.kn.length ? 'Остались дети: ' + f.kn.join(', ') + '.' : 'Помянули кружкой.'}`);
  famSay(`${name} тихо ушёл к предкам. Деревня поднимает кружки`);
}

// любая смерть (и от старости, и от нечисти, и от чумы): родные горюют, супруг овдовел
if (typeof removeUnit === 'function') {
  const _ru = removeUnit;
  removeUnit = function (u) {
    const was = !u.dead && u.fam;
    _ru(u);
    if (!was || !u.dead) return;
    const f = u.fam;
    for (const o of Game.units) {
      if (o === u || o.dead || !o.fam) continue;
      const kin = o.id === f.sp || (o.fam.pn && o.fam.pn.includes(f.n) && o.fam.r === f.r) || (f.kn && f.kn.includes(o.fam.n) && o.fam.r === f.r);
      if (!kin) continue;
      if (o.id === f.sp) o.fam.sp = 0;
      if (typeof moodPoke === 'function') moodPoke(o, 'grief', -10, 500);
    }
    if (!f.old && Game.fam) famNote(`${famName(u)} больше не с нами. Семья ${f.r} горюет`);
  };
}

// ---------- Гномёнок ----------

function* kidGen(u) {
  const f = u.fam || famOf(u);
  const r = Math.random();
  const mom = f.pn ? Game.units.find(o => !o.dead && o.fam && o.fam.n === f.pn[1] && o.fam.r === f.r && !o.inside) : null;
  if (mom && r < 0.4 && Math.hypot(mom.x - u.x, mom.y - u.y) > 3) {
    const spot = randomFreeNear(Math.floor(mom.x), Math.floor(mom.y), 1, 2, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
    if (spot) yield { walk: spot };
  } else if (r < 0.65 && typeof leisureGen === 'function' && Game.time >= (u.nextLeisure || 0)) {
    yield* leisureGen(u);
    return;
  } else {
    const st = nearestStore(u.x, u.y) || Game.buildings.find(b => b.type === 'inn' && b.state === 'done');
    if (st) {
      const spot = randomFreeNear(st.doorX, st.doorY + 2, 1, 5, (x, y) => isWalkable(x, y) && !World.door[idx(x, y)]);
      if (spot) yield { walk: spot };
    }
  }
  if (Math.random() < 0.15 && typeof floater === 'function') floater(u.x, u.y - 1.2, famPick(['А я тоже хочу молоток!', 'Догони!', 'Дедушка, а почему ночью страшно?', 'Я гриб нашёл!', 'Когда вырасту — буду героем', 'Мам, есть хочу']), '#fff0c8');
  yield { wait: 2 + Math.random() * 3 };
}

// обед гномёнка: как у взрослых, только без кружки пива
function* kidEatGen(u, inn) {
  const food = innFood(inn);
  if (!food) return;
  inn.reserved[food]++;
  u.eat = { inn, food, gen: u.proc };
  const ok = yield { walk: [inn.doorX, inn.doorY] };
  if (inn.removed) { u.eat = null; return; }
  if (!ok) { inn.reserved[food]--; u.eat = null; u.nextEatTry = Game.time + 15; return; }
  if (isStoreB(inn)) while (storeInside(inn) >= storeCapOf(inn) && !inn.removed) yield { wait: 0.4 };
  if (inn.removed) { u.eat = null; return; }
  yield { enter: inn };
  yield { wait: 4 };
  u.eat = null;
  if (!inn.removed) { inn.reserved[food]--; inn.stock[food]--; u.food = 1; }
  yield { leave: true };
}
// у гномят нет настроения взрослых (срывы, трактир, хандра) — они просто играют
if (typeof mdOn === 'function') { const _mo = mdOn; mdOn = function (u) { return u.type !== 'kid' && _mo(u); }; }

if (typeof Unit !== 'undefined') {
  const _think = Unit.prototype.think;
  Unit.prototype.think = function () {
    if (this.type !== 'kid') return _think.call(this);
    if (this.wantsEat()) {
      const inn = findInn(this);
      if (inn) { this.idleFlag = false; return kidEatGen(this, inn); }
      this.nextEatTry = Game.time + 15;
    }
    this.idleFlag = false;
    return kidGen(this);
  };
}
// гномёнок мельче
if (typeof drawUnit === 'function') {
  const _du = drawUnit;
  drawUnit = function (c, u) {
    if (u.type !== 'kid') { _du(c, u); return; }
    const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
    c.save(); c.translate(px, py); c.scale(0.68, 0.68); c.translate(-px, -py);
    _du(c, u);
    c.restore();
  };
}
// веха «жители» — только взрослые
if (typeof goalAlive === 'function') {
  const _ga = goalAlive;
  goalAlive = function () { let k = 0; for (const u of Game.units) if (u.type === 'kid' && !u.dead) k++; return _ga() - k; };
}

// ---------- Карточка гнома ----------

function famCardHTML(u) {
  if (!u || !famOn(u)) return '';
  const f = u.fam || (famMirror() ? null : famOf(u));
  if (!f) return '';
  const sp = f.sp ? Game.unitMap.get(f.sp) : null;
  const rows = [`<div class="mc-t">Семья</div><div class="fm-name"><b>${f.n} ${f.r}</b> · ${Math.floor(f.a)} ${famYears(Math.floor(f.a))} · ${famStage(f)}${f.g > 1 ? ` · ${f.g}-е поколение` : ''}</div>`];
  if (sp && !sp.dead && sp.fam) rows.push(`<div class="irow small">${f.sx === 'f' ? 'Муж' : 'Жена'}: ${sp.fam.n}</div>`);
  if (f.pn) rows.push(`<div class="irow small">Родители: ${f.pn[0]} и ${f.pn[1]}</div>`);
  if (f.kn && f.kn.length) rows.push(`<div class="irow small">Дети: ${f.kn.join(', ')}</div>`);
  if (f.a >= FAM_OLD) rows.push('<div class="irow small muted">Старость: работает чуть медленнее</div>');
  return rows.join('');
}
function famYears(n) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'год' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'года' : 'лет'; }
if (typeof mdCardHTML === 'function') {
  const _mc = mdCardHTML;
  mdCardHTML = function (u) {
    const h = _mc(u), add = famCardHTML(u);
    if (!add) return h;
    const i = h.lastIndexOf('<button class="hc-x"');
    return i >= 0 ? h.slice(0, i) + add + h.slice(i) : h + add;
  };
}

// ---------- Подключение ----------

if (typeof LOG_KINDS !== 'undefined') {
  LOG_KINDS.fam = { icon: 'people', name: 'Семьи' };
  LOG_GROUP.fam = 'life';
  if (typeof LOG_SARC !== 'undefined') LOG_SARC.fam = ['Род продолжается. Борода — тоже.', 'Тёща уже интересуется, где тут склад.', 'Летопись толстеет быстрее старосты.'];
}
if (typeof MD_WHY !== 'undefined') Object.assign(MD_WHY, { wed: 'Свадьба!', wedg: 'Гуляли на свадьбе', baby: 'Пополнение в семье', grief: 'Горе в семье' });

function famMirrorOut() { const G = Game.fam; return G ? { st: G.st, chron: G.chron.slice(-12) } : null; }
function famMirrorIn(m) { if (!m) { Game.fam = null; return; } const G = famG(); G.st = m.st; G.chron = m.chron; }

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!famMirror()) famTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.fam = null; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    Game.units.forEach((u, k) => {
      const d = s.units && s.units[k], f = u.fam;
      if (!d || !f) return;
      const sp = f.sp ? Game.units.findIndex(o => o.id === f.sp && !o.dead) : -1;
      d.fam = { n: f.n, r: f.r, sx: f.sx, a: f.a, sp, pn: f.pn || undefined, kn: f.kn && f.kn.length ? f.kn : undefined, g: f.g };
    });
    const G = Game.fam;
    if (G) s.fam = { chron: G.chron, st: G.st, wd: G.wedDay, bd: G.birthDay };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    const str = (v, d) => typeof v === 'string' && v.length < 40 ? v : d;
    (s.units || []).forEach((d, k) => {
      const u = Game.units[k], f = d && d.fam;
      if (!u || !f || typeof f !== 'object') return;
      u.fam = { n: str(f.n, famPick(FAM_M)), r: str(f.r, famPick(FAM_CLANS)), sx: f.sx === 'f' ? 'f' : 'm', a: Number.isFinite(f.a) ? Math.max(0, Math.min(60, f.a)) : 10,
        sp: 0, pn: Array.isArray(f.pn) && f.pn.length === 2 ? f.pn.map(x => str(x, '?')) : null, kn: Array.isArray(f.kn) ? f.kn.slice(-6).map(x => str(x, '?')) : [], g: Number.isInteger(f.g) && f.g > 0 ? Math.min(f.g, 99) : 1, _sp: Number.isInteger(f.sp) ? f.sp : -1 };
    });
    for (const u of Game.units) if (u.fam && u.fam._sp != null) { const o = Game.units[u.fam._sp]; if (o && o !== u) u.fam.sp = o.id; delete u.fam._sp; }
    Game.fam = null;
    const m = s.fam;
    if (m && typeof m === 'object') {
      const G = famG();
      G.chron = Array.isArray(m.chron) ? m.chron.filter(c => Array.isArray(c) && typeof c[1] === 'string').slice(-40) : [];
      for (const k in G.st) if (m.st && Number.isFinite(m.st[k])) G.st[k] = m.st[k];
      G.wedDay = Number.isFinite(m.wd) ? m.wd : -1; G.birthDay = Number.isFinite(m.bd) ? m.bd : -1;
    }
  };
}

// ---------- «Совет»: часть «Семьи» ----------

function famHTML() {
  const G = Game.fam || { chron: [], st: { born: 0, wed: 0, died: 0, gen: 1 } };
  const ppl = Game.units.filter(u => famOn(u) && u.fam);
  const kids = ppl.filter(u => u.type === 'kid').length, old = ppl.filter(u => u.fam.a >= FAM_OLD).length;
  const pairs = ppl.filter(u => u.fam.sp && u.fam.sx === 'f').length;
  const rank = Game.goal ? Math.min(2, Game.goal.rank | 0) : 0;
  let h = `<div class="lw-top"><span>Семей: <b>${pairs}</b></span><span>Детей: <b>${kids}</b></span><span>Старейшин: <b>${old}</b></span><span class="muted small">поколений ${G.st.gen} · свадеб ${G.st.wed} · родилось ${G.st.born}</span></div>`;
  if (ppl.length >= FAM_CAP[rank]) h += `<div class="muted small lw-note">Деревне тесно: детей не заводят, пока жителей ${FAM_CAP[rank]} и больше${rank < 2 ? ' — новое звание даст простор' : ''}.</div>`;
  h += '<div class="mc-t">Летопись</div>';
  if (!G.chron.length) h += '<div class="muted small">Пока тихо: ни свадеб, ни крестин. Весёлые одинокие гномы рано или поздно найдут друг друга.</div>';
  else h += '<div class="fm-chron">' + G.chron.slice(-10).reverse().map(c => `<div class="fm-c"><span class="fm-d">Сутки ${c[0]}</span>${String(c[1]).replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</div>`).join('') + '</div>';
  h += '<div class="muted small md-tips">Свадьбы бывают у весёлых одиноких гномов. Детям нужна еда на складах; на третий год гномёнок берётся за работу. Старики работают медленнее и однажды уходят к предкам.</div>';
  return h;
}
if (typeof councilAdd === 'function') councilAdd({ id: 'fam', order: 4, title: 'Семьи', html: famHTML });
