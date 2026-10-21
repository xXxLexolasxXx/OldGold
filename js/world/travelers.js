'use strict';
// Одинокие путники (ДИКИЕ_ГНОМЫ.md, порция 1): с края карты к деревне приходят паломники, травницы, гонцы, бродяги,
// искатели, воры и разбойники. Над головой — пиксельный смайлик с намерением: 🙂 добрый, 😐 нейтральный, ❓ ищет товар,
// 😈 злой (четверть воров прячется под 😐, пока не полезет на склад). Клик по путнику — разговор: окно дилеммы (dilemma.js)
// с особым событием tv_*; в коопе — голосование, как у всех дилемм; разговор не сдвигает очередь обычных дилемм.
// Вор тащит товар со склада к краю карты — герой или рекрут рядом не дают украсть и ловят по дороге. Разбойник нападает
// на гнома-одиночку и дерётся как лесной нейтрал (`brigand` в Game.neutrals: телеграф, перекат, комбо из combat.js).
// Молва (Game.dil.rel.road) меняет состав гостей. Состояние — Game.trav (в сохранение), клиентам коопа — зеркало mir.trav.
// Подключается после dilemma.js и neutrals.js: всё через обёртки, чужие файлы почти не трогаем (одна строка в coopsim/coopclient).

const TV_GAP = [150, 260];       // пауза между путниками, с
const TV_MAX = 2;                // не больше путников на карте одновременно
const TV_GUARD_R = 5;            // герой/рекрут ближе — вор не полезет на склад
const TV_CATCH_R = 2.2;          // так близко к убегающему вору — пойман
const TV_SAY_R = 5;              // гномы так близко к путнику — реагируют

// emo: good 🙂, neu 😐, seek ❓, evil 😈; w — вес выбора; spd — клеток/с; goal: store — к складу, pass — мимо, prey — к добыче
const TV_KINDS = {
  pilgrim:   { name: 'Паломник', emo: 'good', w: 16, spd: 1.25, goal: 'store', stay: 32, body: '#d8c8a0', hat: '#8a6a3a', beard: '#f2f2ec', staff: 1, ev: 'tv_pilgrim' },
  herbalist: { name: 'Травница', emo: 'good', w: 10, spd: 1.35, goal: 'store', stay: 36, body: '#5a8a4a', hat: '#3a6a2a', braid: '#c87a3a', basket: 1, ev: 'tv_herb' },
  courier:   { name: 'Гонец', emo: 'good', w: 10, spd: 2.0, goal: 'store', stay: 30, day: 3, body: '#3a5a9a', hat: '#c8a030', beard: '#8a5a2a', bag: 1, ev: 'tv_courier' },
  wanderer:  { name: 'Бродяга', emo: 'neu', w: 22, spd: 1.3, goal: 'pass', body: '#7a6a5a', hat: '#5a4a3a', beard: '#9a9a90', pack: 1, ev: 'tv_wander' },
  seeker:    { name: 'Искатель', emo: 'seek', w: 14, spd: 1.5, goal: 'store', stay: 45, body: '#8a5a8a', hat: '#4a2a5a', beard: '#d8c8b0', ev: 'tv_seek_' },
  thief:     { name: 'Вор', emo: 'evil', w: 16, spd: 1.6, goal: 'store', stay: 3, day: 2, evil: 1, body: '#2a2a32', hat: '#1a1a22', beard: '#3a2a20', mask: 1, ev: 'tv_thief' },
  brigand:   { name: 'Разбойник', emo: 'evil', w: 12, spd: 1.5, goal: 'prey', day: 4, evil: 1, body: '#6a2a22', hat: '#3a1a12', beard: '#2a1a10', club: 1, ev: 'tv_brigand' },
};
const TV_SEEK = ['bread', 'beer', 'timber', 'stone', 'sausage', 'hide', 'leather', 'iron', 'mana', 'croissant'];
const TV_SAYS = {
  good: ['Здрасьте!', 'Добрый путник!', 'Заходи, гостем будешь', 'Ух ты, гость!'],
  neu: ['Кто таков?', 'Мимо идёт…', 'Хм, бродяга', 'Издалека, видать'],
  seek: ['Чего ищешь, мил гном?', 'Потерял что?', 'Ищет чего-то…'],
  evil: ['Не нравится он мне…', 'Глаз да глаз!', 'Прячьте кошельки!', 'Мутный тип'],
};
const TV_HERO_SAYS = ['Я за тобой слежу', 'Только попробуй', 'Руки на виду!'];

// ---------- События-разговоры (окно dilemma.js) ----------
// fx.trav — что делает путник после решения: gift, heal, join, rumor, leave, catch, fight
const TV_EVENTS = [
  { id: 'tv_pilgrim', t: 'Паломник у ворот', ic: 'people', r: 1, c: { chainOnly: true },
    d: 'Седой паломник с посохом идёт к святым камням за тремя горами. Просит ночлега и обещает молиться за урожай. Молиться он, судя по мозолям на коленях, умеет.',
    o: [{ t: 'Приютить на ночлег', cost: { bread: 2, beer: 1 }, fx: { rel: { road: 1 }, trav: 'gift' }, out: 'Паломник выспался, благословил амбар и оставил на прощание дар.' },
      { t: 'Попросить благословения', fx: { mood: 1, trav: 'leave' }, out: 'Он перекрестил склад посохом. Склад, кажется, стал увереннее.' },
      { t: 'Не пускать', def: 1, fx: { rel: { road: -1 }, trav: 'leave' }, out: 'Паломник вздохнул и ушёл. Молиться за вас он, похоже, передумал.' }] },
  { id: 'tv_herb', t: 'Травница с корзиной', ic: 'log_tree', r: 1, c: { chainOnly: true },
    d: 'Травница в зелёном платке несёт корзину подорожника, зверобоя и чего-то, что шевелится. Говорит, вылечит любого, кто не успел убежать.',
    o: [{ t: 'Попросить вылечить всех', cost: { bread: 2 }, fx: { rel: { road: 1 }, trav: 'heal' }, out: 'Травница обошла всех хромых, приложила листья и пошептала. Хромых стало меньше, а шёпота — больше.' },
      { t: 'Купить банку маны', cost: { gold: 3 }, fx: { res: { mana: 1 } }, out: 'Банка синяя, булькает и пахнет грозой. Травница клянётся, что это не компот.' },
      { t: 'Пусть идёт', def: 1, out: 'Травница пожала плечами и пошла дальше. Шевелящееся в корзине помахало на прощание.' }] },
  { id: 'tv_courier', t: 'Гонец просит помощи', ic: 'trade', r: 1, c: { chainOnly: true },
    d: 'Запыхавшийся гонец с соседней заставы: у них кончился хлеб, а до обоза неделя. Просит шесть буханок сейчас — или обещание собрать больше к его возвращению.',
    o: [{ t: 'Дать 6 хлеба сейчас', cost: { bread: 6 }, fx: { res: { gold: 6 }, rel: { road: 1, traders: 1 }, trav: 'leave' }, out: 'Гонец расплатился честно и умчался. На заставе вас теперь поминают добрым словом и с набитым ртом.' },
      { t: 'Пообещать собрать больше', fx: { flag: 'tv_promise', chain: ['courier_back', 1, 2], trav: 'leave' }, out: 'Гонец записал обещание на бересте. Береста, увы, не забывает.' },
      { t: 'Отказать', def: 1, fx: { rel: { road: -1 }, trav: 'leave' }, out: 'Гонец убежал, ворча на всю округу. Округа слушала внимательно.' }] },
  { id: 'courier_back', t: 'Гонец вернулся', ic: 'trade', r: 1, c: { chainOnly: true, flag: 'tv_promise' },
    d: 'Тот самый гонец вернулся с пустой телегой и полным доверием. Вы обещали хлеб — десять буханок.',
    o: [{ t: 'Отдать 10 хлеба', cost: { bread: 10 }, fx: { res: { gold: 14 }, rel: { road: 2, traders: 1 }, unflag: 'tv_promise' }, out: 'Застава спасена, гонец плачет, золото звенит. Слух о честных гномах пошёл по всем дорогам.' },
      { t: 'Извиниться', def: 1, fx: { rel: { road: -2 }, unflag: 'tv_promise' }, out: 'Гонец уехал с пустой телегой. Дорога теперь знает, чего стоит ваше слово.' }] },
  { id: 'tv_wander', t: 'Бродяга на дороге', ic: 'log_gossip', r: 1, c: { chainOnly: true },
    d: 'Бродяга с мешком за плечами идёт «куда глаза глядят». Глаза глядят прямо на вашу пивоварню.',
    o: [{ t: 'Угостить пивом и расспросить', cost: { beer: 1 }, fx: { rel: { road: 1 }, trav: 'rumor' }, out: 'Бродяга выпил, утёр бороду и рассказал, что видел по дороге.' },
      { t: 'Позвать жить к нам', cost: { bread: 4 }, fx: { trav: 'join' }, out: 'Бродяга подумал ровно одну кружку и согласился. Мешок он, правда, не развязывает.' },
      { t: 'Обобрать путника', fx: { res: { gold: 4 }, rel: { road: -2 }, trav: 'leave' }, risk: { p: 0.35, fx: { heroHp: -8, mood: -1 }, out: 'Бродяга оказался бывшим кулачным бойцом.' }, out: 'Золото у нас, совесть — у бродяги. Дорога это запомнит.' },
      { t: 'Пусть идёт', def: 1, out: 'Бродяга ушёл, насвистывая. Куда — не знает даже он.' }] },
  { id: 'tv_thief', t: 'Подозрительный тип', ic: 'store', r: 1, c: { chainOnly: true },
    d: 'Тип в надвинутом капюшоне идёт к складу, высматривая, где плохо лежит. Плохо лежит, как назло, всё.',
    o: [{ t: 'Схватить его!', req: 'hero', fx: { rel: { road: 1 }, trav: 'catch' }, risk: { p: 0.3, fx: { heroHp: -6 }, out: 'Вор огрел героя палкой, но всё равно попался.' }, out: 'Герой сгрёб вора за шиворот. Всё, что тот успел взять, высыпалось на дорогу.' },
      { t: 'Откупиться: пусть уходит', cost: { gold: 2 }, fx: { trav: 'leave' }, out: 'Вор взял монеты, поклонился и ушёл. Честный вор — редкость, но этот, кажется, честный.' },
      { t: 'Сделать вид, что не заметили', def: 1, out: 'Тип продолжил путь к складу. Гномы старательно смотрят в другую сторону.' }] },
  { id: 'tv_brigand', t: 'Разбойник с дубиной', ic: 'log_animal', r: 1, c: { chainOnly: true },
    d: 'По дороге идёт разбойник с дубиной и улыбкой человека, которому должны все. Он высматривает гнома, который отошёл от своих.',
    o: [{ t: 'Вызвать на бой', req: 'hero', fx: { trav: 'fight' }, out: 'Герой вышел на дорогу. Разбойник перехватил дубину поудобнее.' },
      { t: 'Откупиться: 4 золота', cost: { gold: 4 }, fx: { rel: { road: -1 }, trav: 'leave' }, out: 'Разбойник взвесил кошель, хмыкнул и ушёл. Слух о щедрой деревне ушёл вместе с ним.' },
      { t: 'Пусть подойдёт', def: 1, out: 'Ворота открыты, гномы — снаружи. Разбойник ухмыляется.' }] },
];
// искатель: по событию на каждый товар (одинаково на сервере и у клиентов)
for (const g of TV_SEEK) {
  const nm = typeof GOODS !== 'undefined' && GOODS[g] ? GOODS[g].name.toLowerCase() : g;
  const price = Math.max(4, Math.round(((typeof TR_BASE !== 'undefined' && TR_BASE[g]) || 1.5) * 5 * 1.3));
  TV_EVENTS.push({ id: 'tv_seek_' + g, t: 'Искатель: ' + nm, ic: 'trade', r: 1, c: { chainOnly: true },
    d: `Странник в лиловом плаще ищет «${nm}» — говорит, без этого ему никак, а платит щедрее любого каравана.`,
    o: [{ t: 'Продать 5 шт.', cost: { [g]: 5 }, fx: { res: { gold: price }, rel: { road: 1 }, trav: 'leave' }, out: 'Искатель расплатился, не торгуясь, и ушёл, прижимая покупку к груди.' },
      { t: 'Подарить 2 шт.', cost: { [g]: 2 }, fx: { rel: { road: 2 }, mood: 1, trav: 'leave' }, out: 'Искатель расчувствовался и обещал рассказать о вас всем дорогам.' },
      { t: 'Не продавать', def: 1, fx: { trav: 'leave' }, out: 'Искатель вздохнул и побрёл искать дальше.' }] });
}
if (typeof DIL_EVENTS !== 'undefined') {
  for (const e of TV_EVENTS) { DIL_EVENTS.push(e); DIL_BY_ID[e.id] = e; }
  DIL_REL.road = 'Путники';
}

// ---------- Состояние ----------

const tvServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const tvMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
function tvEnsure() { return Game.trav || (Game.trav = { next: -1, seq: 0, n: 0, list: [], talk: 0, stolen: 0, caught: 0 }); }
const tvR = (a, b) => a + Math.random() * (b - a);
const tvPick = a => a[(Math.random() * a.length) | 0];
function tvSay(text) { if (tvServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }
function tvLog(text, x, y) { if (typeof logEvent === 'function') logEvent('trade', text, x, y); }
const tvRep = () => (Game.dil && Game.dil.rel && Game.dil.rel.road) || 0;
const tvStore = () => Game.buildings.find(s => s.isStore() && !s.removed && s.state === 'done') || null;
const tvShown = T => (T.mask && !T.loot ? 'neu' : TV_KINDS[T.k].emo);          // что видно над головой
function tvFighters() { return Game.units.filter(u => !u.dead && !u.inside && (u.hero ? u.hero.hp > 0 : u.rec && !(u.rec.train > 0) && !(u.downUntil > Game.time))); }
function tvGuardNear(x, y, r) { for (const u of tvFighters()) if (Math.hypot(u.x - x, u.y - y) <= r) return u; return null; }
function tvHero() {
  if (tvServer()) { for (const h of coop.players.values()) if (h && !h.dead && h.hero && h.hero.hp > 0) return h; return null; }
  return Game.units.find(u => u.type === 'hero' && !u.dead && u.hero && u.hero.hp > 0) || null;
}

// ---------- Появление ----------

function tvEdgeCells(gx, gy) {
  const out = [];
  for (let i = 0; i < 40; i++) {
    const side = i % 4, t = Math.floor(tvR(4, (side % 2 ? MAP_H : MAP_W) - 4));
    const x = side === 0 ? t : side === 1 ? MAP_W - 2 : side === 2 ? t : 1;
    const y = side === 0 ? 1 : side === 1 ? t : side === 2 ? MAP_H - 2 : t;
    if (inb(x, y) && isWalkable(x, y) && Math.hypot(x - gx, y - gy) > 22) out.push([x, y]);
  }
  for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function tvPath(sx, sy, gx, gy) {
  const p = findPath(sx, sy, gx, gy, false, 0, 14000, 0.9);
  return p && p.length ? p : null;
}
// маршрут: от края к цели (и для «мимо» — дальше к другому краю)
function tvRoute(goal, pass) {
  const [gx, gy] = goal;
  for (const [sx, sy] of tvEdgeCells(gx, gy).slice(0, 8)) {
    const p = tvPath(sx, sy, gx, gy);
    if (!p || p.length < 6) continue;
    const r = [[sx, sy], ...p];
    if (!pass) return r;
    const far = tvEdgeCells(gx, gy).filter(([x, y]) => Math.hypot(x - sx, y - sy) > 30);
    for (const [ex, ey] of far.slice(0, 5)) { const q = tvPath(gx, gy, ex, ey); if (q && q.length > 4) return r.concat(q); }
    return r.concat(r.slice(0, -1).reverse());         // другого края нет — обратно той же дорогой
  }
  return null;
}

function tvChooseKind() {
  const rep = tvRep(), day = cycleAt(Game.time).k + 1, foe = Game.foe && !Game.foe.defeated && Game.foe.stage >= 3;
  const eve = isEveningNow();
  const hasGuard = tvFighters().length > 0;
  const pool = [];
  let tot = 0;
  for (const k in TV_KINDS) {
    const K = TV_KINDS[k];
    if (!K.w) continue;                                            // купцы диких гномов приходят только от своих поселений
    if (K.day && day < K.day && !Game.noGrace) continue;
    if (k === 'brigand' && !hasGuard) continue;                    // без героя и рекрутов разбойник — нечестно
    if (eve && !K.evil && k !== 'wanderer') continue;              // вечером ходят бродяги и злые
    let w = K.w;
    if (K.emo === 'good') w *= Math.max(0.3, 1 + 0.15 * rep);
    if (K.evil) w *= Math.max(0.4, 1 - 0.12 * rep) * (foe ? 1.5 : 1);
    pool.push([k, w]); tot += w;
  }
  let r = Math.random() * tot;
  for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
  return pool.length ? pool[pool.length - 1][0] : null;
}

function tvSpawn(kind) {
  const V = tvEnsure(), st = tvStore();
  if (!st) return null;
  const k = kind || tvChooseKind();
  if (!k) return null;
  const K = TV_KINDS[k];
  let goal = [st.doorX, st.doorY + 1];
  if (!isWalkable(goal[0], goal[1])) goal = [st.doorX, st.doorY];
  if (K.goal === 'pass') {
    const p = randomFreeNear(st.doorX, st.doorY + 2, 3, 7, (x, y) => isWalkable(x, y));
    if (p) goal = p;
  }
  const route = tvRoute(goal, K.goal === 'pass');
  if (!route) return null;
  const T = {
    id: Game.nextId++, k, st: 'in', x: route[0][0] + 0.5, y: route[0][1] + 0.5, f: 1, pi: 0, route,
    stay: K.stay || 0, said: 0, t: 0, mask: k === 'thief' && Math.random() < 0.25 ? 1 : 0, loot: null, heals: 0,
    g: k === 'seeker' ? tvSeekGood() : null,
  };
  V.list.push(T); V.n++;
  const shown = tvShown(T);
  tvLog(`На дороге путник: ${shown === 'neu' && T.mask ? 'Бродяга' : K.name}`, T.x, T.y);
  if (V.n <= 1) tvSay('К деревне идёт путник — над головой видно, с чем пришёл. Щёлкните по нему, чтобы заговорить');
  return T;
}
function tvSeekGood() {
  const have = TV_SEEK.filter(g => typeof dilHave === 'function' && dilHave(g) >= 5);
  return have.length && Math.random() < 0.75 ? tvPick(have) : tvPick(TV_SEEK);
}

// ---------- Ход ----------

function tvMove(T, dt, dir, spd) {
  const route = T.route;
  let step = spd * dt;
  while (step > 0) {
    const ni = T.pi + dir;
    if (ni < 0 || ni >= route.length) return true;
    const tx = route[ni][0] + 0.5, ty = route[ni][1] + 0.5, d = Math.hypot(tx - T.x, ty - T.y);
    if (Math.abs(tx - T.x) > 0.01) T.f = tx > T.x ? 1 : -1;
    if (d <= step) { T.x = tx; T.y = ty; T.pi = ni; step -= d; } else { T.x += (tx - T.x) / d * step; T.y += (ty - T.y) / d * step; step = 0; }
  }
  return dir > 0 ? T.pi >= route.length - 1 : T.pi <= 0;
}

function tvGone(T, why) {
  const V = Game.trav, i = V.list.indexOf(T);
  if (i >= 0) V.list.splice(i, 1);
  if (V.talk === T.id) V.talk = 0;
  if (why === 'stolen' && T.loot) {
    V.stolen++;
    const what = Object.keys(T.loot).map(g => `${dilGoodName(g).toLowerCase()} ×${T.loot[g]}`).join(', ');
    tvLog(`Вор ушёл за край карты с добычей: ${what}`, T.x, T.y);
    tvSay('Вор ушёл с добычей! В следующий раз держите героя у склада');
  }
}

// вор на складе: берёт самое ценное, что лежит
function tvSteal(T) {
  const st = tvStore();
  if (!st) return false;
  const base = typeof TR_BASE !== 'undefined' ? TR_BASE : {};
  const goods = Object.keys(base).filter(g => g !== 'trunk' && dilHave(g) > 0).sort((a, b) => base[b] - base[a]);
  const gold = dilHave('gold');
  let left = 3 + ((Math.random() * 4) | 0);
  const loot = {};
  if (gold > 0) { const n = dilTake('gold', Math.min(left, Math.max(1, Math.ceil(left / 2)))); if (n) { loot.gold = n; left -= n; } }
  for (const g of goods.slice(0, 4)) { if (left <= 0) break; const n = dilTake(g, Math.min(left, 2)); if (n) { loot[g] = (loot[g] || 0) + n; left -= n; } }
  if (!Object.keys(loot).length) return false;
  T.loot = loot;
  return true;
}

function tvCatch(T, by) {
  const V = Game.trav;
  if (T.loot) {
    const tx = Math.floor(T.x), ty = Math.floor(T.y);
    for (const g in T.loot) dropPile(tx, ty, g, T.loot[g]);
    T.loot = null;
  }
  T.caught = 1; T.mask = 0; T.st = 'flee';
  V.caught++;
  floater(T.x, T.y - 2.2, 'Ладно-ладно, забирайте!', '#ffe9a0');
  if (by && by.hero) { by.hero.cxp = (by.hero.cxp || 0) + 12; floater(by.x, by.y - 2.1, '+12 опыта', '#ffe070'); }
  else if (by && by.rec && typeof recXp === 'function') recXp(by, 10);
  if (typeof fxBurst === 'function') fxBurst(T.x * TILE, T.y * TILE - 10, 12, ['#ffd700', '#fff2a0'], 60, 50, 0.6, 1.6, 200);
  tvLog(`${by ? neuName(by) : 'Гномы'} поймал вора — украденное лежит на дороге`, T.x, T.y);
  tvSay('Вора поймали! Украденное высыпалось на дорогу — гномы отнесут на склад');
}

// реплики гномов и героя рядом с путником
function tvChatter(T) {
  if (Game.time - T.said < 7) return;
  const shown = tvShown(T);
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || u.type === 'carter') continue;
    if (Math.hypot(u.x - T.x, u.y - T.y) > TV_SAY_R) continue;
    T.said = Game.time;
    if (u.hero && shown === 'evil') floater(u.x, u.y - 2.1, tvPick(TV_HERO_SAYS), '#ffd070');
    else floater(u.x, u.y - 1.9, tvPick(TV_SAYS[shown]), shown === 'evil' ? '#ffb0a0' : shown === 'good' ? '#c8f0a0' : '#e8e0c8');
    if (shown === 'good' && !u.hero && !u.gest && Math.random() < 0.5) { u.gest = 'wave'; u.gestUntil = Game.time + 1.4; u.gestFace = u.face; }
    return;
  }
}

// травница по пути лечит хромых
function tvHerbHeal(T) {
  if (T.heals >= 3) return;
  for (const u of Game.units) {
    if (u.dead || u.inside || !u.injury || Math.hypot(u.x - T.x, u.y - T.y) > 2) continue;
    u.injury = null; T.heals++;
    floater(u.x, u.y - 1.9, 'Подорожник!', '#8ae070');
    return;
  }
}

// разбойник: гном вдали от героя и рекрутов
function tvPrey(T) {
  let best = null, bd = 13;
  for (const u of Game.units) {
    if (u.dead || u.inside || u.hero || u.rec || !isPerson(u) || u.type === 'carter') continue;
    const d = Math.hypot(u.x - T.x, u.y - T.y);
    if (d < bd && !tvGuardNear(u.x, u.y, 9)) { bd = d; best = u; }
  }
  return best;
}

function tvTick(dt) {
  const V = Game.trav;
  if (!V && !tvStore()) return;
  tvEnsure();
  const W = Game.trav;
  if (W.next < 0) W.next = Game.time + tvR(120, 200);
  W.acc = (W.acc || 0) + dt;
  const sec = W.acc >= 1;
  if (sec) W.acc = 0;
  for (let i = W.list.length - 1; i >= 0; i--) {
    const T = W.list[i], K = TV_KINDS[T.k];
    if (!K || !T.route) { W.list.splice(i, 1); continue; }
    if (T.st === 'talk') continue;
    T.t += dt;
    if (T.st === 'in') {
      if (tvMove(T, dt, 1, K.spd)) {
        if (K.goal === 'pass') { tvGone(T); continue; }
        T.st = 'stay'; T.t = 0;
        if (T.k === 'pilgrim' && Math.random() < 0.5) {
          dropPile(Math.floor(T.x), Math.floor(T.y), 'bread', 2);
          floater(T.x, T.y - 2.2, 'Мир вашему дому!', '#c8f0a0');
          tvLog('Паломник оставил у склада хлеб — «на счастье»', T.x, T.y);
        }
      }
      if (T.k === 'brigand' && sec && T.pi > T.route.length * 0.35) {
        const p = tvPrey(T);
        if (p) { tvToNeu(T, p); continue; }
      }
    } else if (T.st === 'stay') {
      T.stay -= dt;
      if (T.k === 'thief' && !T.loot) {
        const g = tvGuardNear(T.x, T.y, TV_GUARD_R);
        if (g) { floater(T.x, T.y - 2.1, 'Да я так, мимо шёл…', '#e8e0c8'); T.st = 'out'; T.mask = 0; tvLog('Вор увидел стражу у склада и ушёл ни с чем', T.x, T.y); }
        else if (T.stay <= 0) {
          if (tvSteal(T)) {
            T.st = 'flee'; T.mask = 0;
            floater(T.x, T.y - 2.2, 'Хе-хе!', '#ff9a8a');
            tvLog('Вор стащил со склада товар и бежит к краю карты! Герой или рекрут рядом с ним — и он попался', T.x, T.y);
            tvSay('Держи вора! Он бежит со склада к краю карты');
            if (typeof sfxAt === 'function') sfxAt('thud', T.x * TILE, T.y * TILE, 0.6);
          } else T.st = 'out';
        }
      } else if (T.k === 'brigand') { const p = tvPrey(T); if (p) { tvToNeu(T, p); continue; } if (T.stay <= -20) T.st = 'out'; }
      else if (T.stay <= 0) T.st = 'out';
    } else if (T.st === 'out' || T.st === 'flee') {
      const spd = K.spd * (T.st === 'flee' ? 1.7 : 1);
      if (tvMove(T, dt, -1, spd)) { tvGone(T, T.loot ? 'stolen' : ''); continue; }
      if (T.st === 'flee' && T.loot) { const g = tvGuardNear(T.x, T.y, TV_CATCH_R); if (g) tvCatch(T, g); }
    }
    if (sec) {
      tvChatter(T);
      if (T.k === 'herbalist') tvHerbHeal(T);
      // кричат «держи вора», если видят бегущего с добычей
      if (T.st === 'flee' && T.loot && Math.random() < 0.4) {
        const u = Game.units.find(q => !q.dead && !q.inside && isPerson(q) && !q.hero && Math.hypot(q.x - T.x, q.y - T.y) < 6);
        if (u) floater(u.x, u.y - 1.9, 'Держи вора!', '#ff9a8a');
      }
    }
  }
  if (!sec) return;
  // новые путники
  if (Game.time < W.next || W.list.length >= TV_MAX) return;
  if (!Game.noGrace && cycleAt(Game.time).k + 1 < 2) return;
  if (isNightNow() || (typeof isDawnNow === 'function' && isDawnNow())) return;
  if (typeof dilBusy === 'function' && dilBusy()) { W.next = Game.time + 30; return; }
  if (typeof dilPop === 'function' && dilPop() < 4) return;
  if (Game.goal && Game.goal.over && Game.goal.over.res === 'lose') return;
  tvSpawn();
  W.next = Game.time + tvR(TV_GAP[0], TV_GAP[1]);
}

// ---------- Разбойник — особый лесной нейтрал ----------

if (typeof NSPEC !== 'undefined') {
  NSPEC.brigand = { name: 'Разбойник', mhp: 60, dmg: [5, 8], cd: 1.6, rng: 1.3, spd: 2.3, parry: 0.15, xp: 55, roam: 2, sz: 11,
    drop: [['gold', 3, 1], ['dagger', 1, 0.25], ['sausage', 1, 0.4]], msg: ['Кошелёк или жизнь!', 'Ну, подходи!', 'Зря ты так…'] };
}
function tvToNeu(T, tg) {
  const i = Game.trav.list.indexOf(T);
  if (i >= 0) Game.trav.list.splice(i, 1);
  const mhp = Math.round(NSPEC.brigand.mhp * dif().neuHp);
  const N = {
    id: T.id, k: 'brigand', lair: 0, tv: 1, x: T.x, y: T.y, hx: tg ? tg.x : T.x, hy: tg ? tg.y : T.y, mhp, hp: mhp, lv: 1, face: T.f, st: 'chase', t: 1,
    fr: 'i0', ph: 0, tg: tg ? tg.id : 0, prov: Game.time, cdA: 0.8, atkT: 9, hit: 1, ov: ['roar'], ovT: 0, ovP: 0.5, winT: 0, dt: 0, wx: 0, wy: 0, say: 0,
    rob: 0, flee: 0, fleeT: 0, ex: T.route[0][0] + 0.5, ey: T.route[0][1] + 0.5,
  };
  Game.neutrals.push(N);
  floater(N.x, N.y - 2.2, tg && !tg.hero ? 'Кошелёк или жизнь!' : 'Ну, подходи!', '#ff9a8a');
  if (tg) tvLog(tg.hero ? `Разбойник принял вызов: ${neuName(tg)}` : `Разбойник напал на гнома (${neuName(tg)})! Пошлите героя`, N.x, N.y);
  if (tg && !tg.hero) tvSay('Разбойник напал на гнома! Щёлкните по нему героем');
  return N;
}
function tvNeuFlee(N, why) {
  if (N.flee) return;
  N.flee = 1; N.fleeT = 0; N.tg = 0; N.st = 'flee';
  floater(N.x, N.y - 2.2, why || 'Ноги мои, ноги!', '#ffe9a0');
}

if (typeof neuThink === 'function') {
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (!N.tv || N.st === 'die') return _th(N, dt);
    if (N.flee) {
      N.fleeT += dt;
      if (N.ov) N.ovT += dt;
      neuMove(N, N.ex, N.ey, NSPEC.brigand.spd * 1.15, dt);
      N.st = 'flee'; N.fr = 'w' + (Math.floor(N.ph) % 8);
      if (Math.hypot(N.x - N.ex, N.y - N.ey) < 1.2 || N.fleeT > 40) N.gone = 1;
      return;
    }
    if (N.hp < N.mhp * 0.25) { tvNeuFlee(N, 'Ноги мои, ноги!'); return; }
    N.hx = N.x; N.hy = N.y;                                       // своего логова нет: «дом» там, где стоит
    _th(N, dt);
    if (!N.tg && N.st !== 'die') tvNeuFlee(N, 'В другой раз!');
  };
  const _hit = neuHit;
  neuHit = function (N, u, dmg) {
    if (N.tv && u && (u.hero || u.rec) && !N.flee) { N.tg = u.id; N.prov = Game.time; }
    return _hit(N, u, dmg);
  };
  const _pv = neuProvoke;
  neuProvoke = function (N, u) {
    if (!N.tv) return _pv(N, u);
    N.prov = Game.time;                                           // зовёт не лесных — только сам за себя
    if (u && !neuUnit(N.tg)) N.tg = u.id;
  };
  const _sk = neuStrike;
  neuStrike = function (N, tg) {
    _sk(N, tg);
    if (!N.tv || tg.hero || tg.rec) return;
    if (++N.rob >= 2) {                                            // два удара по гному — отнял кошель и бежит
      const n = typeof dilTake === 'function' ? dilTake('gold', 2 + ((Math.random() * 3) | 0)) : 0;
      if (n) { N.loot = n; tvLog(`Разбойник отнял у гнома ${n} золота и убегает`, N.x, N.y); }
      tvNeuFlee(N, n ? 'Спасибо за золотишко!' : 'Тьфу, пустой!');
    }
  };
  const _kill = neuKill;
  neuKill = function (N, killer) {
    _kill(N, killer);
    if (!N.tv) return;
    if (N.loot) dropPile(Math.floor(N.x), Math.floor(N.y), 'gold', N.loot);
    tvLog('Разбойник повержен — дорога стала спокойнее', N.x, N.y);
    if (Game.dil && Game.dil.rel) Game.dil.rel.road = Math.min(4, (Game.dil.rel.road || 0) + 1);
  };
  const _nt = neuTick;
  neuTick = function (dt) {
    _nt(dt);
    for (let i = Game.neutrals.length - 1; i >= 0; i--) {
      const N = Game.neutrals[i];
      if (!N.gone) continue;
      Game.neutrals.splice(i, 1);
      tvLog(N.loot ? `Разбойник ушёл за край карты с ${N.loot} золота` : 'Разбойник сбежал за край карты', N.x, N.y);
    }
  };
}

// ---------- Разговор ----------

function tvTalk(id) {
  const V = Game.trav, T = V && V.list.find(q => q.id === id);
  if (!T || T.st === 'talk' || T.st === 'flee') return { ok: false, text: T && T.st === 'flee' ? 'Он не в настроении болтать — он убегает' : '' };
  if (typeof dilOpen !== 'function') return { ok: false, text: '' };
  const d = dilEnsure();
  if (d.cur) return { ok: false, text: 'Сначала решите текущее событие' };
  const K = TV_KINDS[T.k];
  let ev = K.ev;
  if (T.k === 'seeker') ev += T.g;
  if (T.k === 'thief' && T.mask) ev = 'tv_wander';                // переодетый вор прикидывается бродягой
  const e = DIL_BY_ID[ev];
  if (!e) return { ok: false, text: '' };
  T.prev = T.st; T.st = 'talk'; V.talk = T.id;
  tvForceModal();
  const nx = d.next;
  dilOpen(e);
  d.next = nx;
  return { ok: true, text: '' };
}

// разговор начал сам игрок — окно показываем сразу, не дожидаясь, пока свернут обучение (notify.js придерживает дилеммы)
function tvForceModal() {
  if (typeof DilUI === 'undefined' || typeof dilHasUI !== 'function' || !dilHasUI() || DilUI.open) return;
  if (!tvMirror()) dilPause(true);
  DilUI.open = true;
  if (tvMirror()) setTimeout(() => { if (!(Game.dil && Game.dil.cur) && !(DilUI.el && !DilUI.el.classList.contains('hidden'))) DilUI.open = false; }, 3000);
}

function tvAct(T, act, chips) {
  const V = Game.trav;
  T.st = T.prev && T.prev !== 'talk' ? T.prev : 'in';
  if (!act) return;
  if (act === 'leave') { if (T.st !== 'flee') T.st = 'out'; return; }
  if (act === 'gift') {
    const r = Math.random();
    const [g, n] = r < 0.45 ? ['bread', 4 + ((Math.random() * 5) | 0)] : r < 0.85 ? ['gold', 3 + ((Math.random() * 3) | 0)] : ['magicstone', 1];
    dilGive(g, n); chips.push({ k: 'up', t: dilGoodName(g) + ' +' + n });
    T.st = 'out'; return;
  }
  if (act === 'heal') {
    const h = tvHero();
    if (h) { hlHeal(h, Math.round(h.hero.maxhp * 0.4)); chips.push({ k: 'up', t: 'Герой подлечен' }); }
    let n = 0;
    for (const u of Game.units) if (!u.dead && u.injury && n < 6) { u.injury = null; n++; }
    if (n) chips.push({ k: 'up', t: 'Вылечено хромых: ' + n });
    T.st = 'out'; return;
  }
  if (act === 'join') {
    if (T.k === 'thief') {
      const n = dilTake('gold', 3);
      chips.push({ k: 'warn', t: 'Это был вор!' });
      if (n) chips.push({ k: 'dn', t: 'Золото −' + n });
      T.mask = 0; T.st = 'out'; tvLog('«Новый житель» сбежал той же ночью — с нашим золотом', T.x, T.y);
      return;
    }
    const p = randomFreeNear(Math.floor(T.x), Math.floor(T.y), 0, 3) || [Math.floor(T.x), Math.floor(T.y)];
    spawnUnit('serf', p[0], p[1]);
    chips.push({ k: 'up', t: 'Жители +1' });
    tvGone(T); return;
  }
  if (act === 'rumor') {
    const r = Math.random();
    const L = (Game.lairs || []).filter(l => l.alive)[0];
    if (r < 0.35 && typeof trEnsure === 'function' && typeof tradePost === 'function' && tradePost()) {
      const g = tvPick(['bread', 'beer', 'iron', 'sword', 'timber']);
      trEnsure().ev = { id: 'dil', name: 'Слухи', goods: [g], f: 1.35, until: Game.time + 240, text: 'В соседних краях нужда: ' + dilGoodName(g).toLowerCase() + ' в цене' };
      chips.push({ k: 'up', t: dilGoodName(g) + ': цена выше' });
    } else if (r < 0.7 && L) {
      tvLog(`Бродяга рассказал: «${NEU_LAIR_NAME[L.k]}» — там, за деревьями`, L.x + 0.5, L.y + 0.5);
      chips.push({ k: 'up', t: 'Слух записан в журнал' });
    } else { dilGive('gold', 3); chips.push({ k: 'up', t: 'Старый клад: золото +3' }); }
    T.st = 'out'; return;
  }
  if (act === 'catch') {
    if (T.loot) { tvCatch(T, tvHero()); return; }
    T.mask = 0; T.caught = 1; T.st = 'flee'; V.caught++;
    chips.push({ k: 'up', t: 'Вора прогнали' });
    return;
  }
  if (act === 'fight') {
    const h = tvHero();
    if (!h) { T.st = 'in'; return; }
    tvToNeu(T, h);
    chips.push({ k: 'warn', t: 'Бой!' });
  }
}

if (typeof dilApply === 'function') {
  const _ap = dilApply;
  dilApply = function (fx, chips) {
    _ap(fx, chips);
    if (!fx || !fx.trav) return;
    const V = Game.trav, T = V && V.list.find(q => q.id === V.talk);
    if (T) tvAct(T, fx.trav, chips);
  };
  const _rs = dilResolve;
  dilResolve = function (i, who) {
    const d = dilEnsure(), tv = !!(d.cur && /^tv_/.test(d.cur.id));
    const nx = d.next, lt = d.lastT;
    const r = _rs(i, who);
    if (tv && r.ok) {
      d.next = nx; d.lastT = lt;                                  // разговор с путником не сдвигает обычные дилеммы
      const V = Game.trav, T = V && V.list.find(q => q.id === V.talk);
      if (T && T.st === 'talk') T.st = T.prev && T.prev !== 'talk' ? T.prev : 'in';
      if (V) V.talk = 0;
    }
    return r;
  };
  const _sh = dilStatusHTML;
  dilStatusHTML = function () {
    const h = _sh();
    if (!h || !Game.dil) return h;
    const v = (Game.dil.rel && Game.dil.rel.road) || 0;
    return h.replace(/<\/div>$/, `<span class="dl-rel ${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">Путники ${v > 0 ? '+' : ''}${v}</span></div>`);
  };
}

// кооп: сообщение {t:'trav', a:'talk', id}
function travCmd(name, m) {
  if (!m || m.a !== 'talk' || !Number.isInteger(m.id)) return;
  const r = tvTalk(m.id);
  if (!r.ok && r.text && typeof coopSay === 'function') coopSay(name, r.text);
  else if (r.ok) { const T = Game.trav.list.find(q => q.id === m.id); if (T) tvSay(`${name} заговорил с путником: ${TV_KINDS[T.k].name}`); }
}

// ---------- Зеркало для коопа ----------

function travMirrorOut() {
  const V = Game.trav;
  if (!V) return null;
  const r = v => Math.round(v * 100) / 100;
  return { list: V.list.map(T => ({ id: T.id, k: T.k, x: r(T.x), y: r(T.y), f: T.f, st: T.st, mask: T.mask, loot: T.loot ? 1 : 0, g: T.g })) };
}
const TVVIS = new Map();
function travMirrorIn(m) {
  if (!m) { Game.trav = null; return; }
  const V = tvEnsure();
  V.list = m.list.map(T => Object.assign({ route: [] }, T));
}

// ---------- Сохранение и подключение ----------

if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!tvMirror()) tvTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.trav = null; TVVIS.clear(); };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    const V = Game.trav;
    if (V) s.trav = { next: Math.round(V.next - Game.time), seq: V.seq, n: V.n, stolen: V.stolen, caught: V.caught, talk: V.talk,
      list: V.list.map(T => Object.assign({}, T, { x: +T.x.toFixed(2), y: +T.y.toFixed(2) })) };
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.trav = null; TVVIS.clear();
    const v = s.trav;
    if (!v) return;
    const V = tvEnsure();
    V.next = Game.time + (v.next || 120); V.seq = v.seq || 0; V.n = v.n || 0; V.stolen = v.stolen || 0; V.caught = v.caught || 0;
    V.list = (v.list || []).filter(T => TV_KINDS[T.k] && Array.isArray(T.route) && T.route.length > 1);
    const cur = Game.dil && Game.dil.cur;
    V.talk = cur && /^tv_/.test(cur.id) ? v.talk || 0 : 0;
    for (const T of V.list) if (T.st === 'talk' && T.id !== V.talk) T.st = T.prev && T.prev !== 'talk' ? T.prev : 'in';
  };
}
if (typeof LOG_KINDS !== 'undefined' && !LOG_KINDS.trade) { LOG_KINDS.trade = { icon: 'trade', name: 'Торговля' }; if (typeof LOG_GROUP !== 'undefined') LOG_GROUP.trade = 'life'; }

// клик по путнику — разговор (обёртка ставится после всех скриптов: раньше героя и кооп-клиента)
function tvAt(t) {
  const V = Game.trav;
  if (!V || !V.list.length) return null;
  const x = t[0] + 0.5, y = t[1] + 0.5;
  let best = null, bd = 1.3;
  for (const T of V.list) {
    const v = TVVIS.get(T.id) || T;
    const d = Math.hypot(v.x - x, v.y - 0.6 - y);
    if (d < bd) { bd = d; best = T; }
  }
  return best;
}
if (typeof window !== 'undefined' && window.addEventListener && typeof onLeftClickTile === 'function') {
  window.addEventListener('load', () => {
    const _click = onLeftClickTile;
    onLeftClickTile = function (t) {
      if (!Game.tool) {
        const T = tvAt(t);
        if (T) {
          if (tvMirror()) { tvForceModal(); coopSend({ t: 'trav', a: 'talk', id: T.id }); return; }
          const r = tvTalk(T.id);
          if (!r.ok && r.text) toast(r.text);
          if (r.ok || r.text) return;
        }
      }
      _click(t);
    };
  });
}

// ---------- Рисунок ----------

// пиксельные лица гномов 13×13 вместо жёлтых рожиц: колпак, глаза, борода и рот говорят о намерении.
// o — контур, h — колпак, w — блик, s — кожа, k — глаза, r — злые глаза, b — борода, m — рот, q — знак «?»
const TV_FACE = {
  hat: ['....ooo....', '...ohhho...', '..ohhwhho..', '.ooooooooo.'],
  horn: ['.o.......o.', '.oo.ooo.oo.', '.ohhhhhhho.', '.ooooooooo.'],
  beard: ['..obbbbbo..', '...obbbo...', '....obo....', '.....o.....'],
};
function tvFace(hat, face, q) {
  const rows = hat.concat(face, TV_FACE.beard).map(r => r + '..');
  if (q) ['qqq', '..q', '.q.', '...', '.q.'].forEach((p, y) => { rows[y] = rows[y].slice(0, 10) + p; });
  return rows;
}
const TV_EMO = {
  good: { pal: { o: '#3a2410', h: '#d0382a', w: '#ff9a80', s: '#f0c090', k: '#2a1808', b: '#f4f0e6', m: '#9a3a2a' },
    rows: tvFace(TV_FACE.hat, ['.ossssssso.', '.oskssskso.', '.obbsssbbo.', '.obmbbbmbo.', '..obmmmbo..']) },
  neu: { pal: { o: '#2a2a2a', h: '#6a7a8a', w: '#a8b8c8', s: '#e0b890', k: '#2a1c10', b: '#b8b0a0', m: '#5a4a3a' },
    rows: tvFace(TV_FACE.hat, ['.ossssssso.', '.oskssskso.', '.obbsssbbo.', '.obbbbbbbo.', '..obmmmbo..']) },
  evil: { pal: { o: '#1a0606', h: '#3a1a22', s: '#d8a080', k: '#1a0404', r: '#ff3a2a', b: '#5a2a1a', m: '#1a0404' },
    rows: tvFace(TV_FACE.horn, ['.oksssssko.', '.osrsssrso.', '.obbsssbbo.', '.obbmmmbbo.', '..ombbbmo..']) },
  seek: { pal: { o: '#102a4a', h: '#3a6ac8', w: '#8ab8ff', s: '#f0c090', k: '#1a1a2a', b: '#e8d8b8', m: '#6a3a2a', q: '#bfe8ff' },
    rows: tvFace(TV_FACE.hat, ['.oskssskso.', '.ossssssso.', '.obbsssbbo.', '.obbbmbbbo.', '..obbbbbo..'], true) },    // глаза вверх: высматривает товар
};
const TV_EMO_CV = {};
const TV_SC = 1.5;              // путник крупнее старой фигурки каравана — как обычный гном
function tvEmoCanvas(k) {
  if (TV_EMO_CV[k]) return TV_EMO_CV[k];
  const E = TV_EMO[k], cv = document.createElement('canvas'), W = E.rows[0].length, H = E.rows.length;
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  E.rows.forEach((row, y) => { for (let x = 0; x < W; x++) { const ch = row[x]; if (ch !== '.' && E.pal[ch]) { c.fillStyle = E.pal[ch]; c.fillRect(x, y, 1, 1); } } });
  return (TV_EMO_CV[k] = cv);
}
function tvDrawEmo(c, k, X, Y, big) {
  const s = big ? 1.5 : 1.2, w = Math.round(13 * s);
  const bob = Math.round(Math.sin(Game.time * 3 + X * 0.1) * 1.5);
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(20,14,6,0.55)'; c.beginPath(); c.arc(X, Y + bob, w * 0.62, 0, 7); c.fill();
  c.drawImage(tvEmoCanvas(k), Math.round(X - w / 2), Math.round(Y - w / 2 + bob), w, w);
  c.restore();
}

function tvDrawGnome(c, X, Y, T, ph, walk) {
  const K = TV_KINDS[T.k] || TV_KINDS.wanderer, f = T.f || 1;
  const b = walk ? Math.round(Math.abs(Math.sin(ph)) * -1) : 0, lg = walk ? Math.round(Math.sin(ph) * 1.5) : 0;
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(X, Y, 6, 2, 0, 0, 7); c.fill();
  if (K.pack) { c.fillStyle = '#8a6a3a'; c.fillRect(X - 6 * f - (f > 0 ? 0 : -1), Y - 12 + b, 4, 7); c.fillStyle = '#6a4a22'; c.fillRect(X - 6 * f - (f > 0 ? 0 : -1), Y - 12 + b, 4, 1); }
  if (K.basket) { c.fillStyle = '#a87a3a'; c.fillRect(X + 3 * f - (f > 0 ? 0 : 3), Y - 7 + b, 4, 3); c.fillStyle = '#6ac04a'; c.fillRect(X + 3 * f - (f > 0 ? 0 : 3), Y - 8 + b, 4, 1); }
  c.fillStyle = '#2a1c10'; c.fillRect(X - 3 + lg, Y - 3, 2, 3); c.fillRect(X + 1 - lg, Y - 3, 2, 3);
  c.fillStyle = K.body; c.fillRect(X - 3, Y - 10 + b, 6, 8);
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(X - 3, Y - 4 + b, 6, 1);
  c.fillStyle = '#e8b890'; c.fillRect(X - 2, Y - 14 + b, 4, 4);
  if (K.beard) { c.fillStyle = K.beard; c.fillRect(X - 2, Y - 11 + b, 4, 3); c.fillRect(X - 1, Y - 8 + b, 2, 1); }
  if (K.braid) { c.fillStyle = K.braid; c.fillRect(X - 3 * f - (f > 0 ? 0 : 1), Y - 13 + b, 1, 6); }
  if (K.mask) { c.fillStyle = '#12121a'; c.fillRect(X - 2, Y - 13 + b, 4, 2); }
  c.fillStyle = K.hat; c.fillRect(X - 3, Y - 16 + b, 6, 3); c.fillRect(X - 2, Y - 18 + b, 4, 2);
  if (T.k === 'pilgrim' || T.k === 'seeker' || T.k === 'thief') { c.fillRect(X - 3, Y - 14 + b, 1, 4); c.fillRect(X + 2, Y - 14 + b, 1, 4); }   // капюшон
  else c.fillRect(X - 1 + f, Y - 19 + b, 2, 1);
  c.fillStyle = '#1a1208'; c.fillRect(X + (f > 0 ? 0 : -1), Y - 13 + b, 1, 1);
  if (K.staff) { c.fillStyle = '#7a5a2a'; c.fillRect(X + 4 * f, Y - 17 + b, 1, 17); c.fillStyle = '#d8c070'; c.fillRect(X + 4 * f - 1, Y - 18 + b, 3, 2); }
  if (K.bag) { c.fillStyle = '#c8a060'; c.fillRect(X - 1, Y - 8 + b, 4, 3); c.fillStyle = '#e04030'; c.fillRect(X, Y - 7 + b, 1, 1); }
  if (K.club) { c.fillStyle = '#6a4a2a'; c.fillRect(X + 3 * f, Y - 13 + b, 2, 9); c.fillStyle = '#4a3018'; c.fillRect(X + 3 * f - 1, Y - 14 + b, 4, 3); }
  if (T.loot) { c.fillStyle = '#d8b878'; c.fillRect(X - 5 * f - 2, Y - 13 + b, 5, 6); c.fillStyle = '#ffd700'; c.fillRect(X - 5 * f - 1, Y - 13 + b, 3, 1); }
}

function tvDrawList(list, c, x0, y0, x1, y1) {
  const V = Game.trav;
  if (!V || !V.list.length) return;
  const mirror = tvMirror(), seen = new Set();
  const h = Game.hero;
  for (const T of V.list) {
    let px = T.x, py = T.y;
    if (mirror) {
      let v = TVVIS.get(T.id);
      if (!v) { v = { x: T.x, y: T.y }; TVVIS.set(T.id, v); }
      v.x += (T.x - v.x) * 0.2; v.y += (T.y - v.y) * 0.2; px = v.x; py = v.y;
      seen.add(T.id);
    }
    if (px < x0 - 3 || px > x1 + 3 || py < y0 - 3 || py > y1 + 4) continue;
    const walk = T.st === 'in' || T.st === 'out' || T.st === 'flee';
    list.push([py + 0.2, () => {
      const X = Math.round(px * TILE), Y = Math.round(py * TILE + 6);
      const ph = walk ? Game.time * (T.st === 'flee' ? 13 : 8) : 0;
      c.save();
      c.translate(X, Y); c.scale(TV_SC, TV_SC);
      tvDrawGnome(c, 0, 0, T, ph, walk);
      c.restore(); c.save();
      const near = h && Math.hypot(h.x - px, h.y - py) < 8;
      tvDrawEmo(c, tvShown(T), X, Y - 40, near || T.st === 'talk');
      if (T.st === 'flee' && T.loot) { c.fillStyle = '#e03a2a'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('!', X + 14, Y - 34 + Math.sin(Game.time * 8) * 2); }
      c.restore();
    }]);
  }
  if (mirror) for (const id of TVVIS.keys()) if (!seen.has(id)) TVVIS.delete(id);
}

// разбойник рисуется как гном-путник поверх нейтрального бойца (кадры из neutrals: windup/strike/hurt/d*)
function tvDrawBrigand(c, N) {
  const dead = N.st === 'die';
  const al = dead ? Math.max(0, Math.min(1, 1 - (N.dt - 0.9) / 2.3)) : 1;
  if (al <= 0) return;
  const X = Math.round(N.x * TILE), Y = Math.round(N.y * TILE + 6), fr = N.fr || 'i0';
  const walk = fr[0] === 'w' || fr === 'step';
  c.save();
  c.globalAlpha = al;
  if (dead) { c.translate(X, Y); c.rotate(-1.4 * (N.face || 1)); c.translate(-X, -Y); }
  const T = { k: 'brigand', f: N.face || 1, loot: N.loot ? 1 : 0 };
  c.translate(X, Y); c.scale(TV_SC, TV_SC);
  tvDrawGnome(c, 0, 0, T, Game.time * 10, walk);
  if (!dead && (fr === 'windup' || fr === 'strike')) {           // замах дубиной
    const f = N.face || 1, up = fr === 'windup';
    c.fillStyle = '#6a4a2a';
    if (up) c.fillRect(1 * f, -24, 2, 10); else c.fillRect(4 * f - (f < 0 ? 9 : 0), -11, 10, 2);
  }
  if (!dead && (fr === 'hurt' || fr === 'stagger')) { c.globalAlpha = 0.45 * al; c.fillStyle = '#ffffff'; c.fillRect(-3, -18, 6, 18); }
  c.restore();
  if (dead) return;
  tvDrawEmo(c, 'evil', X, Y - 42, true);
  if (N.hp < N.mhp - 0.5) {
    const w = 18, hy = Y - 56, r = Math.max(0, N.hp / N.mhp);
    c.fillStyle = 'rgba(10,6,2,0.85)'; c.fillRect(X - w / 2 - 1, hy - 1, w + 2, 4);
    c.fillStyle = r > 0.5 ? '#5ac04a' : r > 0.25 ? '#e0b030' : '#e04a3a'; c.fillRect(X - w / 2, hy, Math.round(w * r), 2);
  }
}

if (typeof neuDrawList === 'function') {
  const _dl = neuDrawList;
  neuDrawList = function (list, c, x0, y0, x1, y1) { _dl(list, c, x0, y0, x1, y1); tvDrawList(list, c, x0, y0, x1, y1); };
  const _nd = neuDraw;
  neuDraw = function (c, N) { if (N.k === 'brigand') return tvDrawBrigand(c, N); return _nd(c, N); };
}
