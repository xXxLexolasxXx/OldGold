'use strict';
// Наследие: мета-прогрессия между играми. Хранится в профиле игрока (profCur().meta), поэтому не зависит
// от слотов сохранений и не теряется при загрузке другого слота.
//  • Опыт наследия даёт каждая деревня (ночи, вехи, жители, постройки, победа, главы сценария; ×множитель
//    сложности) и каждая ачивка. Деревня определяется зерном карты, так что перезагрузка сохранения не
//    начисляет дважды: в профиль идёт только прирост выше лучшего результата этой деревни.
//  • За уровни наследия и ачивки открываются: титулы, колпаки, бороды, расцветки зданий, стартовые наборы и
//    особые гномы. Всё косметическое, кроме малой прибавки к припасам на старте (до +10 к основным товарам)
//    и стартового набора.
// Читает: people.js (lookOf, personSprite), levels.js (buildingSprite), difficulty.js (diffApplyStart),
// goal.js (goalFinish), profile.js (вкладка «Наследие»).

const LG_SPECIAL_BASE = 0x20000;   // look ≥ этого — особый гном (в пуле обычных look значения < 0x10000)
const LG_MAX_LEVEL = 12;
const LG_ACH_XP = 6;               // за каждую ачивку
const LG_DIFF_MUL = { calm: 0.6, normal: 1, survival: 1.4 };
const LG_SHARE = 3;                // из 5 гномов носят выбранные колпак и бороду

const LG_LEVEL_TITLES = ['Новичок', 'Подмастерье', 'Староста', 'Десятник', 'Мастер-гном', 'Градоначальник', 'Хранитель очага',
  'Лорд холма', 'Старейшина рода', 'Хозяин долины', 'Легенда долины', 'Вечный летописец', 'Хранитель наследия'];
function lgNeed(l) { return 50 * l * (l + 1) / 2; }   // опыта до уровня l: 50, 150, 300, 500, 750, ...

// ---------- Каталог наград ----------
// req: { ach } ачивка, { lvl } уровень наследия, { wins } выигранных деревень
const LG_CATS = [
  { id: 'title', name: 'Титулы', hint: 'Титул виден в профиле и на стартовом экране. Без выбора — по уровню наследия.',
    items: [
      ...LG_LEVEL_TITLES.map((n, i) => ({ id: 'L' + i, name: n, desc: 'Титул уровня наследия', req: i ? { lvl: i } : null })),
      { id: 'night', name: 'Ночной дозорный', desc: 'Пережито много ночей', req: { ach: 'dawn20' } },
      { id: 'brew', name: 'Пивовар-самоучка', desc: 'Тёмное пиво — вершина карьеры', req: { ach: 'beer150' } },
      { id: 'mayor', name: 'Мэр без выборов', desc: 'Город на сто жителей', req: { ach: 'pop100' } },
      { id: 'guild', name: 'Мастер гильдии', desc: 'Герой выучился в гильдии', req: { ach: 'guild' } },
      { id: 'ghost', name: 'Охотник за призраками', desc: 'Три привидения отправлены на покой', req: { ach: 'ghost3' } },
      { id: 'victor', name: 'Победитель мрака', desc: 'Выиграна хотя бы одна деревня', req: { wins: 1 } },
      { id: 'victor3', name: 'Тот, кого боится тьма', desc: 'Выиграно три деревни', req: { wins: 3 } },
    ] },
  { id: 'hat', name: 'Колпаки', hint: 'Цвет носят трудяги, форму — все гномы, кроме героя и колдуна. Выбранное надето примерно на 60% жителей.',
    items: [
      { id: 'none', name: 'Как есть', desc: 'Каждый одет как хочет', req: null },
      { id: 'wine', name: 'Бордовый', desc: 'Цвет трудяг', req: { ach: 'first' }, sw: '#8a2a36', cap: '#8a2a36' },
      { id: 'sun', name: 'Подсолнух', desc: 'Цвет трудяг', req: { ach: 'bread50' }, sw: '#d8a82a', cap: '#d8a82a' },
      { id: 'sky', name: 'Небесный', desc: 'Цвет трудяг', req: { ach: 'lvl2' }, sw: '#3e6aa8', cap: '#3e6aa8' },
      { id: 'plum', name: 'Сливовый', desc: 'Цвет трудяг', req: { ach: 'dawn5' }, sw: '#6a3a8a', cap: '#6a3a8a' },
      { id: 'snow', name: 'Снежный', desc: 'Цвет трудяг', req: { ach: 'dawn20' }, sw: '#e8ecf2', cap: '#e8ecf2' },
      { id: 'phryg', name: 'Фригийский', desc: 'Короткий, с загнутым носком', req: { ach: 'school' }, sw: '#c85a3a', style: 3 },
      { id: 'night', name: 'Ночной до плеча', desc: 'Длинный, кончик свисает', req: { ach: 'fog' }, sw: '#5a5a8a', style: 4 },
      { id: 'cork', name: 'Штопор', desc: 'Кончик закручен петлёй', req: { ach: 'ghostfood' }, sw: '#6a9a3a', style: 7 },
      { id: 'horn', name: 'Рожки с желудями', desc: 'Раздвоенный, с жёлудями', req: { ach: 'goat' }, sw: '#8a6a3a', style: 9 },
      { id: 'pom', name: 'Золотой помпон', desc: 'Короткий, с помпоном', req: { lvl: 6 }, sw: '#e0b83a', cap: '#e0b83a', style: 8 },
    ] },
  { id: 'beard', name: 'Бороды', hint: 'Цвет и вид бороды у выбранной доли гномов; у героя и колдуна — свои.',
    items: [
      { id: 'none', name: 'Как есть', desc: 'Природный разнобой', req: null },
      { id: 'grey', name: 'Седая', desc: 'За долгие часы у костра', req: { ach: 'time30' }, sw: '#dcdcdc', bcol: '#dcdcdc' },
      { id: 'copper', name: 'Медная', desc: 'Железо въелось в бороду', req: { ach: 'iron100' }, sw: '#b8602a', bcol: '#b8602a' },
      { id: 'coal', name: 'Смоль', desc: 'Память о потерях', req: { ach: 'loss5' }, sw: '#2a2420', bcol: '#2a2420' },
      { id: 'moss', name: 'Мшистая', desc: 'Лесорубы знают толк', req: { ach: 'timber100' }, sw: '#7a9a4a', bcol: '#7a9a4a' },
      { id: 'silver', name: 'Серебряная', desc: 'Наследие ур. 3', req: { lvl: 3 }, sw: '#c8d0d8', bcol: '#c8d0d8' },
      { id: 'gold', name: 'Золотая', desc: 'Золота — 600 штук', req: { ach: 'gold600' }, sw: '#e8c040', bcol: '#e8c040' },
      { id: 'braid', name: 'С косичкой', desc: 'Заплетена и затянута', req: { ach: 'beer' }, sw: '#a07040', braid: true },
      { id: 'azure', name: 'Лазурная', desc: 'Сказочная борода', req: { lvl: 8 }, sw: '#6aa0d8', bcol: '#6aa0d8' },
    ] },
  { id: 'tint', name: 'Расцветки зданий', hint: 'Подкрашивает все здания вашей деревни. Серый камень и дым остаются прежними.',
    items: [
      { id: 'none', name: 'Как есть', desc: 'Естественное дерево и камень', req: null },
      { id: 'sunset', name: 'Закатные кровли', desc: 'Теплее и краснее', req: { ach: 'pop25' }, sw: '#c8542a', hue: -16, sat: 1.12, bri: 1 },
      { id: 'autumn', name: 'Золотая осень', desc: 'Медовые стены', req: { lvl: 3 }, sw: '#d8a030', hue: 8, sat: 1.3, bri: 1.04 },
      { id: 'forest', name: 'Лесная', desc: 'Позеленевшее дерево', req: { ach: 'dawn' }, sw: '#6a8a3a', hue: 38, sat: 1, bri: 0.98 },
      { id: 'frost', name: 'Морозная', desc: 'Холодные синие крыши', req: { ach: 'dawn20' }, sw: '#5a8ac0', hue: 165, sat: 0.9, bri: 1.06 },
      { id: 'lav', name: 'Вечерняя лаванда', desc: 'Сиреневые сумерки', req: { lvl: 5 }, sw: '#8a6ab8', hue: 230, sat: 0.95, bri: 1.04 },
    ] },
  { id: 'kit', name: 'Стартовые наборы', hint: 'Один набор на новую игру: небольшая прибавка к складу. Уровень наследия даёт ещё до +10 к основным товарам.',
    items: [
      { id: 'none', name: 'Без набора', desc: 'Только то, что даёт сложность', req: null },
      { id: 'carp', name: 'Плотницкий', desc: '+20 досок, +4 бревна', req: { ach: 'timber100' }, give: { timber: 20, trunk: 4 } },
      { id: 'mason', name: 'Каменотёсный', desc: '+25 камня', req: { ach: 'stone100' }, give: { stone: 25 } },
      { id: 'baker', name: 'Хлебный', desc: '+20 хлеба', req: { ach: 'bread50' }, give: { bread: 20 } },
      { id: 'purse', name: 'Золотой запас', desc: '+25 золота', req: { ach: 'gold50' }, give: { gold: 25 } },
      { id: 'quart', name: 'Кладовщик', desc: '+8 досок, камня, хлеба и золота', req: { lvl: 5 }, give: { timber: 8, stone: 8, bread: 8, gold: 8 } },
      { id: 'crew', name: 'Лишняя пара рук', desc: '+2 трудяги в бригаде', req: { lvl: 8 }, serfs: 2 },
    ] },
  { id: 'spec', name: 'Особые гномы', hint: 'Один из стартовых трудяг будет особенным: свой вид и запись в журнале. На игру не влияет, зато заметен.',
    items: [
      { id: 'none', name: 'Никого', desc: 'Все как все', req: null },
      { id: 'elder', name: 'Старейшина', desc: 'Седой, до пояса, колпак до плеча', req: { lvl: 3 }, sw: '#f4f4ee',
        look: { bcol: '#f4f4ee', beardLen: 2, beardStyle: 2, brow: 1, must: 2, capStyle: 4, serfCap: '#6a6a9a', skin: 0, braid: false } },
      { id: 'ginger', name: 'Рыжий весельчак', desc: 'Закрученные усы, серьга в ухе', req: { ach: 'beer' }, sw: '#c8501c',
        look: { bcol: '#c8501c', beardLen: 2, beardStyle: 1, brow: 1, must: 1, earring: true, freckles: true, capStyle: 7, serfCap: '#c83a28', skin: 1, braid: false } },
      { id: 'sage', name: 'Сивый мудрец', desc: 'Выпускник школы с тёмным колпаком', req: { ach: 'school' }, sw: '#e0e4ec',
        look: { bcol: '#e0e4ec', beardLen: 2, beardStyle: 3, brow: 1, must: 0, capStyle: 1, serfCap: '#4c3a80', skin: 0, braid: false } },
      { id: 'golden', name: 'Золотая Борода', desc: 'Борода золотом, косица и серьга', req: { ach: 'gold600' }, sw: '#e8c040',
        look: { bcol: '#e8c040', beardLen: 2, beardStyle: 0, brow: 0, must: 0, earring: true, braid: true, capStyle: 8, serfCap: '#e0b83a', skin: 2 } },
    ] },
];
const LG_CAT = Object.fromEntries(LG_CATS.map(c => [c.id, c]));
const LG_SPECS = LG_CAT.spec.items.filter(i => i.look);

// ---------- Данные профиля ----------

function lgMeta() {
  const p = profCur();
  let m = p.meta;
  if (!m || typeof m !== 'object') m = p.meta = {};
  m.xp = +m.xp || 0;
  for (const k of ['v', 'w', 'seen', 'eq']) if (!m[k] || typeof m[k] !== 'object') m[k] = {};
  m.vc = +m.vc || 0; m.wins = +m.wins || 0;
  return m;
}
function lgAchCount() { const p = profCur(); return ACHS.reduce((n, a) => n + (p.ach[a.id] ? 1 : 0), 0); }
function lgTotal() { return lgMeta().xp + LG_ACH_XP * lgAchCount(); }
function lgLevelOf(total) { let l = 0; while (l < LG_MAX_LEVEL && total >= lgNeed(l + 1)) l++; return l; }
function lgLevel() { return lgLevelOf(lgTotal()); }

function lgHas(it) {
  if (!it.req) return true;
  const r = it.req, p = profCur(), m = lgMeta();
  if (r.ach) return !!p.ach[r.ach];
  if (r.lvl) return lgLevel() >= r.lvl;
  if (r.wins) return m.wins >= r.wins;
  return false;
}
function lgReqText(it) {
  const r = it.req;
  if (!r) return '';
  if (r.ach) return 'Ачивка «' + (ACH_BY[r.ach] ? ACH_BY[r.ach].name : r.ach) + '»';
  if (r.lvl) return 'Наследие, уровень ' + r.lvl;
  if (r.wins) return 'Выиграно деревень: ' + r.wins;
  return '';
}
function lgItem(cat, id) { return LG_CAT[cat].items.find(i => i.id === id); }
// выбранный предмет категории (только если он открыт)
function lgPicked(cat) {
  const id = lgMeta().eq[cat], it = id && lgItem(cat, id);
  return it && it.id !== 'none' && lgHas(it) ? it : null;
}
function lgTitle() {
  const it = lgPicked('title');
  return it ? it.name : LG_LEVEL_TITLES[lgLevel()];
}

// ---------- Начисление ----------

function lgScore() {
  const g = Game.goal;
  if (!g) return 0;
  const nights = Math.min(60, typeof goalNights === 'function' ? goalNights() : 0);
  const built = Game.buildings.filter(b => b.state === 'done').length;
  let s = nights * 2 + (g.rank || 0) * 25 + Math.min(30, Math.max(0, ((g.st && g.st.maxPop) || 0) - 14) / 4) + Math.min(15, Math.max(0, built - 6) / 6);   // стартовые 14 жителей и 6 зданий не считаются
  if (g.mode === 'scenario') s += (g.ch || 0) * 12;
  if (g.won) s += 60;
  return Math.min(400, Math.floor(s * (LG_DIFF_MUL[Game.diff] || 1)));
}

function lgActive() {
  if (typeof Game === 'undefined' || !Game.units || !Game.units.length || !Game.goal || Game.stress) return false;
  if (typeof StartMenu !== 'undefined' && StartMenu.open) return false;
  if (typeof Coop !== 'undefined' && (Coop.on || Coop.mirror)) return false;
  return true;
}

// возвращает прирост опыта за этот вызов
function lgTick() {
  if (!lgActive()) return 0;
  const m = lgMeta(), key = 's' + Game.seed, prev = m.v[key] || 0, score = lgScore();
  let gain = 0;
  if (score > prev) {
    const lvl0 = lgLevel();
    gain = score - prev;
    m.xp += gain; m.v[key] = score;
    if (prev < 8 && score >= 8) m.vc++;
    const keys = Object.keys(m.v);
    if (keys.length > 40) delete m.v[keys[0]];     // старые деревни забываем: их опыт уже в xp
    const lvl1 = lgLevel();
    if (lvl1 > lvl0) toast(`Наследие: уровень ${lvl1} — «${LG_LEVEL_TITLES[lvl1]}»`);
    profSave();
  }
  if (Game.goal.won && !m.w[key]) { m.w[key] = 1; m.wins++; profSave(); }
  lgAnnounce();
  if (typeof UI !== 'undefined' && gain) lgRefreshWin();
  return gain;
}

// сообщаем о новых наградах (одним оповещением, не пачкой)
function lgAnnounce() {
  const m = lgMeta(), fresh = [];
  for (const c of LG_CATS) for (const it of c.items) if (it.req && !m.seen[c.id + ':' + it.id] && lgHas(it)) { m.seen[c.id + ':' + it.id] = 1; fresh.push(it.name); }
  if (!fresh.length) return;
  profSave();
  toast('Наследие: открыто «' + fresh[0] + '»' + (fresh.length > 1 ? ` и ещё ${fresh.length - 1}` : '') + '. Выбрать — в профиле, вкладка «Наследие»');
}
function lgRefreshWin() { if (typeof profTab !== 'undefined' && profTab === 'legacy' && typeof profRefresh === 'function') profRefresh(); }

// ---------- Эффект: старт новой игры ----------

function lgStartBonus() {
  const b = Math.min(lgLevel(), 10);
  return { timber: b, stone: b, bread: b, gold: b };
}

function lgApplyStart() {
  if (typeof Coop !== 'undefined' && Coop.on) return;
  if (typeof profCur !== 'function') return;   // кооп-сервер и тесты: профиля игрока нет
  const store = Game.buildings.find(b => b.type === 'storehouse');
  if (!store) return;
  const mul = typeof dif === 'function' ? dif().stock : 1;
  const kit = lgPicked('kit'), add = lgStartBonus(), parts = [];
  if (kit && kit.give) for (const g in kit.give) add[g] = (add[g] || 0) + kit.give[g];
  for (const g in add) {
    const n = Math.round(add[g] * mul);
    if (n > 0) store.stock[g] = (store.stock[g] || 0) + n;
  }
  if (kit && kit.serfs) {
    const s = Game.units.find(u => u.type === 'serf' && !u.dead);
    if (s) for (let k = 0; k < kit.serfs; k++) spawnUnit('serf', Math.floor(s.x), Math.floor(s.y));
  }
  const sp = lgPicked('spec');
  if (sp) {
    const s = Game.units.find(u => u.type === 'serf' && !u.dead);
    if (s) {
      s.look = LG_SPECIAL_BASE + LG_SPECS.indexOf(sp);
      s.lgName = sp.name;
      logEvent('people', `В путь вместе с вами пошёл особый гном: ${sp.name}`, s.x, s.y);
    }
  }
  const lvl = lgLevel();
  if (lvl > 0 || kit) logEvent('people', `Наследие (ур. ${lvl})${kit && kit.id !== 'none' ? ', набор «' + kit.name + '»' : ''}: припасы пополнены`);
}

{
  const _das = diffApplyStart;
  diffApplyStart = function (k) { _das(k); try { lgApplyStart(); } catch (e) { console.warn(e); } };
}

// ---------- Эффект: внешность гномов ----------

const LG_NO_DRESS = t => !t || t === 'waitress' || t === 'enchanter' || String(t).startsWith('hero');
function lgDress(u, L) {
  if (LG_NO_DRESS(u.type)) return L;
  const l = u.look >>> 0;
  if (l >= LG_SPECIAL_BASE) {
    const s = LG_SPECS[l - LG_SPECIAL_BASE];
    return s ? Object.assign(L, s.look) : L;
  }
  const hat = lgPicked('hat'), beard = lgPicked('beard');
  if (!hat && !beard) return L;
  const h = Math.imul(l + 17, 0x9e3779b1) >>> 0;
  if (hat && h % 5 < LG_SHARE) {
    if (hat.cap) L.serfCap = hat.cap;
    if (hat.style !== undefined) L.capStyle = hat.style;
  }
  if (beard && (h >>> 8) % 5 < LG_SHARE) {
    if (beard.bcol) L.bcol = beard.bcol;
    if (beard.braid) L.braid = true;
  }
  return L;
}
{
  const _lo = lookOf;
  lookOf = function (u) { return lgDress(u, _lo(u)); };
}

// ---------- Эффект: расцветка зданий ----------

const LG_TINTED = new WeakMap();   // исходный спрайт → { id: окрашенная копия }

function lgTintCanvas(src, T) {
  const w = src.width, h = src.height;
  const cv = mkCanvas(w, h), c = cv.getContext('2d');
  c.drawImage(src, 0, 0);
  const img = c.getImageData(0, 0, w, h), d = img.data;
  const a = Math.cos(T.hue * Math.PI / 180), b = Math.sin(T.hue * Math.PI / 180);
  const m = [
    0.213 + 0.787 * a - 0.213 * b, 0.715 - 0.715 * a - 0.715 * b, 0.072 - 0.072 * a + 0.928 * b,
    0.213 - 0.213 * a + 0.143 * b, 0.715 + 0.285 * a + 0.140 * b, 0.072 - 0.072 * a - 0.283 * b,
    0.213 - 0.213 * a - 0.787 * b, 0.715 - 0.715 * a + 0.715 * b, 0.072 + 0.928 * a + 0.072 * b,
  ];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], bl = d[i + 2];
    let R = r * m[0] + g * m[1] + bl * m[2], G = r * m[3] + g * m[4] + bl * m[5], B = r * m[6] + g * m[7] + bl * m[8];
    const Y = 0.299 * R + 0.587 * G + 0.114 * B;
    R = (Y + (R - Y) * T.sat) * T.bri; G = (Y + (G - Y) * T.sat) * T.bri; B = (Y + (B - Y) * T.sat) * T.bri;
    d[i] = R < 0 ? 0 : R > 255 ? 255 : R; d[i + 1] = G < 0 ? 0 : G > 255 ? 255 : G; d[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
  }
  c.putImageData(img, 0, 0);
  return cv;
}
{
  const _bs = buildingSprite;
  buildingSprite = function (type, rot, level) {
    const spr = _bs(type, rot, level), T = lgPicked('tint');
    if (!T || !spr || !spr.canvas || !spr.canvas.width) return spr;
    let m = LG_TINTED.get(spr);
    if (!m) LG_TINTED.set(spr, m = {});
    if (!m[T.id]) {
      try { m[T.id] = Object.assign({}, spr, { canvas: lgTintCanvas(spr.canvas, T) }); } catch (e) { m[T.id] = spr; }
    }
    return m[T.id];
  };
}

// ---------- Вкладка профиля ----------

function lgBar(frac) { return `<div class="lg-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></i></div>`; }

function lgRender() {
  const m = lgMeta(), total = lgTotal(), lvl = lgLevelOf(total), eq = m.eq;
  const next = lvl < LG_MAX_LEVEL ? lgNeed(lvl + 1) : 0, base = lgNeed(lvl);
  const bonus = lgStartBonus();
  let h = `<div class="lg-head"><div><b class="lg-title">${esc(lgTitle())}</b><small>Наследие, уровень ${lvl}${lvl >= LG_MAX_LEVEL ? ' (максимум)' : ''}</small></div>` +
    `<div class="lg-num"><b>${total}</b><small>опыта наследия</small></div></div>` +
    lgBar(next ? (total - base) / (next - base) : 1) +
    `<div class="lg-sub">${next ? `До уровня ${lvl + 1}: ${next - total}` : 'Все уровни пройдены'} · деревень сыграно: ${m.vc} · выиграно: ${m.wins} · ачивок: ${lgAchCount()}</div>`;
  h += `<div class="lg-note">Опыт даёт каждая деревня (ночи, вехи, жители, постройки, победа; на «Спокойном» ×0.6, на «Выживании» ×1.4) и каждая ачивка (+${LG_ACH_XP}). Он остаётся в профиле при смене слота и загрузке любого сохранения.</div>`;
  h += `<div class="lg-note">Сейчас на старте новой игры: <b>+${bonus.timber} досок, +${bonus.stone} камня, +${bonus.bread} хлеба, +${bonus.gold} золота</b> (потолок на 10-м уровне).</div>`;
  for (const c of LG_CATS) {
    const open = c.items.filter(i => lgHas(i)).length;
    h += `<div class="prof-sec">${c.name} <span class="lg-cnt">${open}/${c.items.length}</span></div><div class="lg-hint">${c.hint}</div><div class="lg-grid">`;
    for (const it of c.items) {
      const ok = lgHas(it);
      const cur = c.id === 'title' ? (eq.title ? eq.title === it.id : it.id === 'L' + lvl) : ((eq[c.id] || 'none') === it.id);
      const sw = it.sw ? `<i class="lg-sw" style="background:${it.sw}"></i>` : '';
      h += `<button class="lg-item${ok ? '' : ' locked'}${cur && ok ? ' on' : ''}" data-pa="lg-eq" data-k="${c.id}:${it.id}"${ok ? '' : ' disabled'}>${sw}<span><b>${ok ? esc(it.name) : '🔒 ' + esc(it.name)}</b><small>${ok ? esc(it.desc) : esc(lgReqText(it))}</small></span></button>`;
    }
    h += '</div>';
  }
  return h;
}

function lgAction(a, k) {
  if (a !== 'lg-eq') return '';
  const [cat, id] = String(k).split(':'), it = LG_CAT[cat] && lgItem(cat, id);
  if (!it || !lgHas(it)) return 'Ещё не открыто';
  const m = lgMeta();
  if (cat === 'title' && /^L\d+$/.test(id) && +id.slice(1) === lgLevel()) delete m.eq.title;   // текущий уровневый — значит «по умолчанию»
  else m.eq[cat] = id;
  profSave();
  if (cat === 'hat' || cat === 'beard') { try { PEOPLE_CACHE.clear(); PORTRAIT_CACHE.clear(); } catch (e) { /* кэш не обязателен */ } }
  if (typeof profBtnLabel === 'function') profBtnLabel();
  return cat === 'kit' || cat === 'spec' ? 'Выбрано: «' + it.name + '» — сработает в новой игре' : 'Выбрано: «' + it.name + '»';
}

// в конце деревни — вклад в наследие сразу, без ожидания таймера
{
  const _gf = goalFinish;
  goalFinish = function (res, why, lines) {
    _gf(res, why, lines);
    try { const g = lgTick(); if (g > 0) toast(`Наследие: +${g} опыта за эту деревню`); } catch (e) { console.warn(e); }
  };
}
setInterval(() => { try { lgTick(); } catch (e) { console.warn(e); } }, 5000);
