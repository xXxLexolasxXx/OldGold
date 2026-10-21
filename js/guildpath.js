'use strict';
// Развитие гильдий поверх guilds.js (подключается после heromana.js):
// · слава гильдии (b.glory) и звания главы: Новички → Подмастерья → Мастера → Легенда, у каждого звания свой бонус;
// · ветки рекрутов: с 5 уровня — одна из двух веток класса, с 10 уровня ветка усиливается («ветеран»);
// · общее задание гильдий на сутки (вклад каждой гильдии считается) и «Кубок деревни» раз в трое суток;
// · уровень 3 гильдии (нужны L2 и звание «Мастера»): рекруты до 18 ур., 6-й ранг мастерства героя;
// · «Путь гильдии» в окне здания: что сделано, что дальше и что это даст.
// В общей деревне всё считает сервер (тот же step()), игроки получают славу и кубок вместе со зданием,
// задание дня — в зеркале мира (mir.gp), ветку рекрута — в u.gx.br.

const GP_RANKS = [
  { n: 'Новички', g: 0, perk: '' },
  { n: 'Подмастерья', g: 25, perk: 'новобранцы приходят сразу 2-го уровня' },
  { n: 'Мастера', g: 70, perk: 'урок героя на 1 золото дешевле; можно строить уровень 3' },
  { n: 'Легенда', g: 150, perk: 'рекруты гильдии бьют на 10% сильнее' },
];
// ветки: v — сила на 5 уровне, v2 — у ветерана (10 уровень)
const GBR = {
  warrior: [{ k: 'guard', n: 'Страж', v: 0.25, v2: 0.4, d: v => `по нему на ${Math.round(v * 100)}% меньше урона` },
    { k: 'cleave', n: 'Рубака', v: 0.2, v2: 0.35, d: v => `урон +${Math.round(v * 100)}%` }],
  archer: [{ k: 'sniper', n: 'Снайпер', v: 2, v2: 3, d: v => `дальность +${v}, меткость +${v * 5}%` },
    { k: 'tracker', n: 'Следопыт', v: 0.4, v2: 0.7, d: v => `опыта +${Math.round(v * 100)}%, замечает врагов дальше` }],
  rogue: [{ k: 'shadow', n: 'Тень', v: 0.12, v2: 0.22, d: v => `ещё +${Math.round(v * 100)}% к шансу крита` },
    { k: 'pick', n: 'Карманник', v: 0.3, v2: 0.5, d: v => `с побед золото (${Math.round(v * 100)}%)` }],
  mage: [{ k: 'pyro', n: 'Пиромант', v: 0.25, v2: 0.4, d: v => `урон +${Math.round(v * 100)}%` },
    { k: 'healer', n: 'Целитель', v: 4, v2: 7, d: v => `лечит отряд рядом на ${v} раз в 6 с` }],
};
const GBR_LVL = 5, GBR_VET = 10;
const GP_TASKS = {
  night:  { n: 'Ночной дозор', d: 'одолеть нечисть: скелетов, ходячие деревья', need: [5, 8] },
  hunt:   { n: 'Охота', d: 'победить волков, лис или лесных нейтралов', need: [3, 5] },
  drill:  { n: 'Учения', d: 'тренировки рекрутов у главы', need: [3, 5] },
  lesson: { n: 'Наука', d: 'уроки героя у глав гильдий', need: [1, 2] },
};
const GP_CUP_DAYS = 3;
const GP_L3 = {
  guild_warrior: { cost: { timber: 8, stone: 14 } }, guild_archer: { cost: { timber: 14, stone: 8 } },
  guild_rogue: { cost: { timber: 10, stone: 10 } }, guild_mage: { cost: { timber: 8, stone: 14 } },
};
const GP_DESC3 = {
  guild_warrior: 'Зал под золотой короной: рекруты растут до 18 уровня, тренировки злее, а герой может стать грандмастером. Чучела подали в отставку.',
  guild_archer: 'Ложа под золотой короной: лучники растут до 18 уровня, а герой может стать грандмастером. Мишени уехали в отпуск без возврата.',
  guild_rogue: 'Дом под золотой короной (откуда она — не спрашивайте): ловкачи растут до 18 уровня, а герой может стать грандмастером.',
  guild_mage: 'Башня под золотой короной: маги растут до 18 уровня, а герой может стать грандмастером. Звёзды на куполе теперь подмигивают нарочно.',
};
const GP_MASTERY3 = 6;
const GP = { t: 0, hT: 0, hooked: false, cHooked: false, pendGl: null };

const gpIsGuildType = t => !!GP_L3[t];
const gpGl = b => (b.glory != null ? b.glory : GP.pendGl && GP.pendGl.has(b.id) ? GP.pendGl.get(b.id) : 0);
function gpRank(b) { const g = gpGl(b); let r = 0; for (let i = 0; i < GP_RANKS.length; i++) if (g >= GP_RANKS[i].g) r = i; return r; }
function gpGuildOfCls(cls) {
  const g = cls && GCLS[cls] ? GCLS[cls].guild || cls : null;
  return g ? Game.buildings.find(b => isGuild(b) && b.def.guild === g) || null : null;
}
const gpUnitGuild = u => (u.rec ? guildOf(u) : u.type === 'hero' && u.hero ? gpGuildOfCls(u.hero.clsKey) : null);
function gpBranch(R) { if (!R || !R.br) return null; const L = GBR[R.cls]; return (L && L.find(x => x.k === R.br)) || null; }
// сила ветки рекрута u с ключом k (0 — нет такой ветки)
function gpBr(u, k) { const R = u && u.rec, B = gpBranch(R); return B && B.k === k ? (R.lvl >= GBR_VET ? B.v2 : B.v) : 0; }
const gpLegend = u => { const b = u && u.rec && guildOf(u); return b && gpRank(b) >= 3; };
function gpMasteryCap(b) { return b && (b.level || 1) >= 3 ? GP_MASTERY3 : MASTERY_MAX; }
const gpMirror = () => typeof isMirror === 'function' && isMirror();
const gpServer = () => typeof isServer === 'function' && isServer();

// ================= Слава и звания =================

function gpGlory(b, n, why) {
  if (!b || !n || gpMirror()) return;
  const was = gpRank(b);
  b.glory = Math.max(0, (b.glory || 0) + n);
  const r = gpRank(b);
  if (r > was) {
    const R = GP_RANKS[r], gm = masterOf(b);
    gnews(`${b.def.name}: звание «${R.n}»! Теперь ${R.perk}`, b);
    logEvent('people', `${b.def.name} получила звание «${R.n}»`, b.doorX + 0.5, b.doorY);
    if (gm) { floater(gm.x, gm.y - 1.9, `«${R.n}»!`, '#ffe070'); fxBurst(gm.x * TILE, gm.y * TILE - 14, 22, ['#ffe070', '#fff6c0', GCLS[b.def.guild].col], 80, 60, 1, 2, 120); sfxAt('chime', gm.x * TILE, gm.y * TILE); }
    if (r === 2 && (b.level || 1) >= 2) gnews(`${b.def.name}: открыт уровень 3 — кнопка в окне гильдии`, b);
  }
  if (why && n >= 5) floater(b.doorX + 0.5, b.doorY - 1, `+${n} славы`, '#f6d458');
}

// ================= Общее задание дня и кубок =================

const gpDay = () => cycleAt(Game.time).k;
const gpIsDay = () => cycleAt(Game.time).p < EVE_START && !isNightNow();
function gpState() { return Game.gpath || (Game.gpath = { day: -1, task: null, cupDay: -1, cs: {} }); }

function gpNewTask() {
  const S = gpState(), gs = Game.buildings.filter(isGuild);
  S.day = gpDay();
  if (!gs.length) { S.task = null; return; }
  const kinds = Object.keys(GP_TASKS).filter(k => k !== 'drill' || gs.some(b => recruitsOf(b).length));
  const k = kinds[(Math.random() * kinds.length) | 0], T = GP_TASKS[k];
  const big = gs.length >= 3 || (gpServer() && coop.players.size > 1);
  S.task = { k, need: T.need[big ? 1 : 0], n: 0, by: {}, done: false };
  gnews(`Задание гильдий на сегодня — «${T.n}»: ${T.d} (${S.task.need}). Вклад каждой гильдии идёт в «Кубок деревни»`);
}

function gpTaskEvent(kind, b) {
  const S = Game.gpath, T = S && S.task;
  if (!T || T.done || T.k !== kind || !b) return;
  T.n++; T.by[b.id] = (T.by[b.id] || 0) + 1;
  if (T.n < T.need) return;
  T.done = true;
  let top = null, tn = 0;
  for (const id in T.by) {
    const g = Game.buildings.find(x => x.id === +id && isGuild(x));
    if (!g) continue;
    g.stock.gold = (g.stock.gold || 0) + 2;
    gpGlory(g, 10);
    if (T.by[id] > tn) { tn = T.by[id]; top = g; }
  }
  if (top) gpGlory(top, 5);
  gnews(`Задание гильдий «${GP_TASKS[T.k].n}» выполнено! Участникам +10 славы и 2 золота в казну${top ? `, больше всех постаралась ${top.def.name.toLowerCase()} (+5)` : ''}`);
  sfxAt('chime', top ? top.doorX * TILE : 0, top ? top.doorY * TILE : 0);
}

function gpCupTick() {
  const S = gpState(), k = gpDay();
  const gs = Game.buildings.filter(isGuild);
  if (S.cupDay < 0) { S.cupDay = k; S.cs = {}; for (const b of gs) S.cs[b.id] = b.glory || 0; return; }
  if (k - S.cupDay < GP_CUP_DAYS) return;
  let best = null, bg = 0;
  for (const b of gs) { const d = (b.glory || 0) - (S.cs[b.id] || 0); if (d > bg) { bg = d; best = b; } }
  for (const b of gs) b.cup = b === best ? 1 : 0;
  if (best) {
    gpGlory(best, 8);
    gnews(`«Кубок деревни» у гильдии: ${best.def.name} (+${bg} славы за ${GP_CUP_DAYS} дня)! Её рекруты получают на 20% больше опыта до следующего кубка`, best);
    logEvent('people', `«Кубок деревни» выиграла ${best.def.name.toLowerCase()}`, best.doorX + 0.5, best.doorY);
  }
  S.cupDay = k; S.cs = {};
  for (const b of gs) S.cs[b.id] = b.glory || 0;
}

function gpCupTable() {
  const S = Game.gpath, gs = Game.buildings.filter(isGuild);
  return gs.map(b => ({ b, d: (b.glory || 0) - ((S && S.cs && S.cs[b.id]) || 0) })).sort((p, q) => q.d - p.d);
}

// ================= Целитель =================

function gpHealTick() {
  for (const u of Game.units) {
    const v = gpBr(u, 'healer');
    if (!v || u.dead || u.inside || (u.rec && u.rec.train > 0)) continue;
    let any = false;
    for (const m of Game.units) {
      if (m.dead || m.inside || Math.hypot(m.x - u.x, m.y - u.y) > 5) continue;
      if (m.rec && m.rec.hp != null) { const max = 30 + 8 * m.rec.lvl; if (m.rec.hp < max) { m.rec.hp = Math.min(max, m.rec.hp + v); any = true; floater(m.x, m.y - 1.9, '+' + v, '#8ae070'); } }
      else if (m.hero && m.hero.maxhp && m.hero.hp > 0 && m.hero.hp < m.hero.maxhp) { m.hero.hp = Math.min(m.hero.maxhp, m.hero.hp + v); any = true; floater(m.x, m.y - 1.9, '+' + v, '#8ae070'); }
      else if (m.injury && m.rec) { m.injury = null; any = true; }
    }
    if (any) fxBurst(u.x * TILE, u.y * TILE - 12, 10, ['#8ae070', '#d8ffb0', '#ffffff'], 50, 40, 0.6, 1.4, -30);
  }
}

// ================= Тик =================

function gpTick(dt) {
  if (gpMirror()) return;
  if (gpServer() && !GP.hooked) gpServerHook();
  GP.t += dt; GP.hT += dt;
  if (GP.hT >= 6) { GP.hT = 0; gpHealTick(); }
  if (GP.t < 1) return;
  GP.t = 0;
  const S = gpState();
  if (gpIsDay() && S.day !== gpDay() && cycleAt(Game.time).p > 4) { gpNewTask(); gpCupTick(); }
  // подсказка: рекрут дорос до ветки
  for (const u of Game.units) {
    const R = u.rec;
    if (!R || R.br || R.lvl < GBR_LVL || R.brHint) continue;
    R.brHint = 1;
    gnews(`${unitTitle(u)} достиг ${GBR_LVL} уровня — выберите ему ветку в карточке рекрута (клик по нему)`, guildOf(u));
    floater(u.x, u.y - 2, 'Ветка!', '#ffe070');
  }
}

// ================= Уровень 3 =================

function levelDef3(type) {
  const d = BUILDINGS[type];
  if (d._l3) return d._l3;
  const o = Object.assign({}, levelDef(type));
  o.up = null; o.level3 = true; o.recMax = 6; o.recLvl = 18; o.drillXp = 55; o.trainMult = 0.35;
  o.desc = GP_DESC3[type] || o.desc;
  d._l3 = o;
  return o;
}

function gpUpgrade3(b, silent) {
  b.level = 3;
  b.def = levelDef3(b.type);
  if (silent) return true;
  b.dmg = 0;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  fxBurst(cx * TILE, cy * TILE, 40, ['#f0c040', '#ffe070', '#fff6c0', GCLS[b.def.guild].col], 100, 70, 1, 2.6, 220);
  floater(cx, b.y - 1, 'Уровень 3!', '#ffe08a');
  logEvent('build', `«${BUILDINGS[b.type].name}» достроена до уровня 3`, cx, cy);
  gnews(`«${BUILDINGS[b.type].name}» — уровень 3: рекруты до 18 уровня, герою доступен 6-й ранг мастерства`, b);
  sfxAt('build', cx * TILE, cy * TILE);
  return true;
}

// Облик уровня 3: поверх облика уровня 2 — золотая корона на шесте и два щита цвета класса по бокам двери
function gpSprite3(type, rot, base) {
  const key = type + ':' + rot + ':L3';
  if (SPR.buildings[key]) return SPR.buildings[key];
  const cv = mkCanvas(base.canvas.width, base.canvas.height), c = cv.getContext('2d');
  c.drawImage(base.canvas, 0, 0);
  c.imageSmoothingEnabled = false;
  const k = base.canvas.width / base.w, OUT = '#1a100a', col = GCLS[type.slice(6)].col;
  const px = (x, y, w, h, cl) => { c.fillStyle = cl; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (base.perches && base.perches[0]) || [base.padx + base.fw / 2, base.top * 0.4];
  const cx = Math.round((P[0] - 16) * k), cy = Math.round(P[1] * k) + 8 * k;
  // шест
  px(cx - 2, cy - 96, 6, 100, OUT); px(cx - 1, cy - 95, 4, 98, '#6a4a2a'); px(cx - 1, cy - 95, 1, 98, '#a07848');
  // корона: обод и три зубца с камнями
  const W = 34, top = cy - 124;
  px(cx + 1 - W / 2 - 1, top + 14, W + 2, 14, OUT); px(cx + 1 - W / 2, top + 15, W, 12, '#f0c040'); px(cx + 1 - W / 2, top + 15, W, 3, '#fff0a0'); px(cx + 1 - W / 2, top + 24, W, 3, '#b8901e');
  for (const dx of [-W / 2 + 1, -4, W / 2 - 9]) {
    px(cx + 1 + dx - 1, top - 1, 10, 17, OUT); px(cx + 1 + dx, top, 8, 16, '#f0c040'); px(cx + 1 + dx, top, 3, 16, '#fff0a0');
    px(cx + 1 + dx + 2, top - 5, 4, 5, OUT); px(cx + 1 + dx + 3, top - 4, 2, 3, '#fff6c0');
  }
  for (const [dx, cl] of [[-W / 2 + 4, col], [-1, '#e04a3a'], [W / 2 - 6, col]]) { px(cx + 1 + dx - 1, top + 17, 6, 7, OUT); px(cx + 1 + dx, top + 18, 4, 5, cl); px(cx + 1 + dx, top + 18, 2, 2, '#ffffff'); }
  // щиты у двери
  const gy = Math.round((base.baseY - 30) * k);
  for (const sx of [-34, 26]) {
    const gx = Math.round((base.doorCx * k) + sx);
    px(gx - 1, gy - 1, 18, 22, OUT); px(gx, gy, 16, 18, '#f0c040'); px(gx + 2, gy + 2, 12, 13, col); px(gx + 2, gy + 2, 12, 3, shade(col, 0.25));
    px(gx + 7, gy + 2, 2, 13, '#f0c040'); px(gx + 4, gy + 18, 8, 3, OUT); px(gx + 5, gy + 18, 6, 2, '#f0c040');
  }
  const spr = Object.assign({}, base, { canvas: cv });
  SPR.buildings[key] = spr;
  return spr;
}

// ================= Интерфейс =================

function gpPathSteps(b) {
  const h = Game.hero, H = h && h.hero, rs = recruitsOf(b), lv = b.level || 1, gl = gpGl(b), cls = b.def.guild;
  const R = GP_RANKS;
  return [
    { ok: !!masterOf(b), n: 'Глава пришёл', how: 'глава сам приходит через пару секунд после стройки', give: 'учит героя и набирает рекрутов' },
    { ok: !!(H && guildClasses(cls).includes(H.clsKey)), n: 'Урок героя', how: 'кнопка «Обучиться» в этом окне или клик героем по гильдии', give: `класс «${GCLS[cls].name}»: бонус к силам и удар Q` },
    { ok: rs.length > 0, n: 'Первый рекрут', how: 'нужно оружие в гильдии и 1 золото — кнопка «Набрать рекрута»', give: 'боец охраняет гильдию и ходит в отряде героя' },
    { ok: rs.some(u => { const x = recOf(u); return x && x.br; }), n: `Ветка рекрута (${GBR_LVL} ур.)`, how: 'тренировки (⚔) и бои растят рекрута; ветку выбирают в его карточке', give: GBR[cls] ? GBR[cls].map(x => x.n).join(' или ') : '' },
    { ok: gl >= R[1].g, n: `Звание «${R[1].n}» (${R[1].g} славы)`, how: 'слава — за уроки, тренировки, победы рекрутов и задания дня', give: R[1].perk },
    { ok: lv >= 2, n: 'Уровень 2', how: 'кнопка «Достроить» в этом окне: брёвна, доски и камень', give: '6 рекрутов, до 14 уровня, обучение вдвое быстрее' },
    { ok: gl >= R[2].g, n: `Звание «${R[2].n}» (${R[2].g} славы)`, how: 'побеждайте в заданиях дня и в «Кубке деревни»', give: R[2].perk },
    { ok: lv >= 3, n: 'Уровень 3', how: 'нужны уровень 2 и звание «Мастера»', give: 'рекруты до 18 уровня, 6-й ранг мастерства героя' },
    { ok: gl >= R[3].g, n: `Звание «${R[3].n}» (${R[3].g} славы)`, how: 'не останавливайтесь', give: R[3].perk },
  ];
}

function gpPathHTML(b) {
  const r = gpRank(b), gl = gpGl(b), nx = GP_RANKS[r + 1];
  let x = `<div class="isec">Путь гильдии</div>`;
  const pct = nx ? Math.round((gl - GP_RANKS[r].g) / (nx.g - GP_RANKS[r].g) * 100) : 100;
  x += `<div class="irow small">Звание: <b style="color:#f6d458">${'★'.repeat(r + 1)} ${GP_RANKS[r].n}</b>${b.cup ? ' · <b class="gp-cup">Кубок деревни</b>' : ''}</div>`;
  x += `<div class="g-xp gp-gl" title="Слава гильдии: ${gl}${nx ? ' из ' + nx.g : ''}"><i style="width:${pct}%"></i></div>`;
  x += `<div class="irow small muted">Слава ${gl}${nx ? ` · до «${nx.n}» ещё ${nx.g - gl}` : ' · высшее звание'}</div>`;
  const st = gpPathSteps(b), done = st.filter(s => s.ok).length, next = st.find(s => !s.ok);
  x += `<div class="gp-path"><div class="small">Пройдено: <b>${done}</b> из ${st.length}</div>`;
  for (const s of st) {
    if (s === next) x += `<div class="gp-st now"><b>▶ ${s.n}</b><small>Как: ${s.how}</small><small class="gp-give">Даст: ${s.give}</small></div>`;
    else x += `<div class="gp-st ${s.ok ? 'ok' : ''}" title="${s.ok ? 'Готово' : 'Даст: ' + s.give}">${s.ok ? '✓' : '·'} ${s.n}</div>`;
  }
  x += '</div>';
  if ((b.level || 1) === 2 && r < 2) x += `<div class="irow small warn">Уровень 3 откроется со званием «Мастера» (${GP_RANKS[2].g} славы)</div>`;
  const S = Game.gpath, T = S && S.task;
  if (T) {
    const D = GP_TASKS[T.k], mine = T.by[b.id] || 0;
    x += `<div class="isec">Задание гильдий на сегодня</div><div class="irow small"><b>${D.n}</b>: ${D.d} — ${T.done ? '<span class="good">выполнено!</span>' : `${T.n} из ${T.need}`}${mine ? ` · вклад этой гильдии: ${mine}` : ''}</div>`;
    x += `<div class="g-xp"><i style="width:${Math.round(Math.min(1, T.n / T.need) * 100)}%"></i></div>`;
  }
  const tab = gpCupTable();
  if (tab.length > 1) {
    x += `<div class="isec">Кубок деревни · слава за ${GP_CUP_DAYS} дня</div>`;
    tab.forEach((e, i) => { x += `<div class="irow small${e.b === b ? ' gp-me' : ''}">${i + 1}. ${e.b.def.name}${e.b.cup ? ' <b class="gp-cup">· кубок</b>' : ''} — <b>${e.d}</b></div>`; });
  }
  return x;
}

function gpBranchHTML(u) {
  const R = recOf(u), L = R && GBR[R.cls];
  if (!L) return '';
  const B = gpBranch(R);
  if (B) {
    const vet = R.lvl >= GBR_VET;
    return `<div class="gp-brow small">Ветка: <b style="color:#f6d458">${B.n}${vet ? ' · ветеран' : ''}</b> — ${B.d(vet ? B.v2 : B.v)}${vet ? '' : `<br><span class="muted">с ${GBR_VET} уровня: ${B.d(B.v2)}</span>`}</div>`;
  }
  if (R.lvl < GBR_LVL) return `<div class="gp-brow small muted">С ${GBR_LVL} уровня — ветка: ${L.map(x => `${x.n} (${x.d(x.v)})`).join(' или ')}</div>`;
  return `<div class="isec">Выберите ветку</div><div class="hp-abs">${L.map(x => `<button class="hp-ab gp-br" data-rc="br_${x.k}"><b>${x.n}</b><small>${x.d(x.v)}</small></button>`).join('')}</div>`;
}

function gpSetBranch(u, k) {
  const R = u && u.rec, L = R && GBR[R.cls], B = L && L.find(x => x.k === k);
  if (!B || R.br || R.lvl < GBR_LVL) return;
  R.br = k;
  floater(u.x, u.y - 2, B.n + '!', '#ffe070');
  fxBurst(u.x * TILE, u.y * TILE - 12, 16, ['#ffe070', GCLS[R.cls].col, '#ffffff'], 70, 50, 0.9, 1.8, 120);
  sfxAt('chime', u.x * TILE, u.y * TILE);
  gnews(`${unitTitle(u)} — ветка «${B.n}»: ${B.d(B.v)}`, guildOf(u));
  logEvent('people', `${unitTitle(u)} выбрал ветку «${B.n}»`, u.x, u.y);
}

function gpInitUI() {
  if (GP.ui || typeof document === 'undefined' || !document.head || !document.createElement) return;
  GP.ui = true;
  const st = document.createElement('style');
  st.textContent = `.gp-path{margin:3px 0 4px;padding:4px 6px;background:rgba(0,0,0,.18);border-radius:4px;font-size:12px}
  .gp-st{opacity:.55;line-height:1.4}.gp-st.ok{opacity:.8;color:#9fe070}
  .gp-st.now{opacity:1;display:flex;flex-direction:column;margin:3px 0;padding:4px 6px;border:1px solid #d8b04a;border-radius:4px;background:rgba(80,60,20,.35)}
  .gp-st.now b{color:#f6d458}.gp-st small{opacity:.85;font-size:11px}.gp-give{color:#c8f0a0}
  .gp-gl i{background:linear-gradient(90deg,#c89226,#ffe070)!important}.gp-cup{color:#ffd040}.gp-me{background:rgba(255,220,140,.08)}
  .gp-br{border-color:#d8b04a!important}.gp-brow{margin:4px 0;line-height:1.35}`;
  document.head.appendChild(st);
}

// ================= Подключение =================

{
  // L2 гильдии ведёт к L3: у её описания уровня — цена L3
  const _ld = levelDef;
  levelDef = function (type) {
    const o = _ld(type);
    if (gpIsGuildType(type) && o !== BUILDINGS[type] && !o._p3) { o._p3 = true; o.up = { cost: GP_L3[type].cost }; }
    return o;
  };
  const _cu = canUpgrade;
  canUpgrade = function (b) {
    if (gpIsGuildType(b.type) && (b.level || 1) >= 2) return b.level === 2 && b.state === 'done' && !b.removed && !b.isRoad && gpRank(b) >= 2;
    return _cu(b);
  };
  const _su = startUpgrade;
  startUpgrade = function (b) {
    if (!(gpIsGuildType(b.type) && b.level === 2)) return _su(b);
    if (!canUpgrade(b) || b.upg) return false;
    const cost = b.def.up.cost, total = Object.values(cost).reduce((a, n) => a + n, 0);
    b.upg = { cost, total, used: emptyGoods(), stock: emptyGoods(), usedN: 0, hits: 0, maxHits: Math.max(1, total * HITS_PER_UNIT), builder: null, l3: true };
    b.builder = null; b._usite = null;
    gnews(`«${b.def.name}»: начата достройка до уровня 3`, b);
    logEvent('build', `«${b.def.name}»: начата достройка до уровня 3`, b.doorX + 0.5, b.doorY);
    return true;
  };
  const _ub = upgradeBuilding;
  upgradeBuilding = function (b, silent) {
    if (gpIsGuildType(b.type) && (b.level || 1) >= 2) return gpUpgrade3(b, silent);
    return _ub(b, silent);
  };
  const _bs = buildingSprite;
  buildingSprite = function (type, rot = 0, level = 1, ...rest) {
    if (level >= 3 && gpIsGuildType(type)) return gpSprite3(type, rot, _bs(type, rot, 3));
    return _bs(type, rot, level, ...rest);
  };

  // мастерство до 6-го ранга в гильдии уровня 3
  const _hgg = heroGuildGen;
  heroGuildGen = function* (u, c) {
    const H = u.hero, b = c.b, before = (H.clsKey || '') + ':' + H.mastery;
    if (b && (b.level || 1) >= 3) {
      const cl = c.cls || H.clsKey, cls = cl && guildClasses(b.def.guild).includes(cl) ? cl : b.def.guild;
      if (H.clsKey === cls && H.mastery === MASTERY_MAX) { yield* gpGrandGen(u, b, cls); return; }
    }
    yield* _hgg(u, c);
    if ((H.clsKey || '') + ':' + H.mastery !== before && b) { gpGlory(b, 3); gpTaskEvent('lesson', b); }
  };
  const _hgp = heroGuildPrice;
  heroGuildPrice = function (H, cls) {
    const p = _hgp(H, cls), b = gpGuildOfCls(cls);
    return b && gpRank(b) >= 2 && H.clsKey === cls ? Math.max(1, p - 1) : p;
  };

  // тренировка оплачена — слава и задание «Учения»
  const _so = setOrder;
  setOrder = function (u, order, pt, leader) {
    if (typeof order === 'string' && order.startsWith('br_')) { gpSetBranch(u, order.slice(3)); return; }
    const was = u.rec && u.rec.order;
    _so(u, order, pt, leader);
    if (order === 'drill' && u.rec && u.rec.order === 'drill' && was !== 'drill') { const b = guildOf(u); gpGlory(b, 2); gpTaskEvent('drill', b); }
  };

  // новобранец «Подмастерьев» — сразу 2-го уровня
  const _th = tryHire;
  tryHire = function (b) {
    const before = new Set(recruitsOf(b));
    const r = _th(b);
    if (gpRank(b) >= 1) for (const u of recruitsOf(b)) if (!before.has(u) && u.rec.lvl < 2) { u.rec.lvl = 2; u.rec.xp = 0; }
    return r;
  };

  // опыт: кубок +20%, следопыт — больше
  const _rx = recXp;
  recXp = function (u, n) {
    const b = guildOf(u);
    let k = 1 + gpBr(u, 'tracker');
    if (b && b.cup) k += 0.2;
    _rx(u, Math.round(n * k));
  };

  // меткость и урон веток, «Легенда» +10%
  const _ra = recAtk;
  recAtk = function (u) {
    let p = _ra(u);
    p += gpBr(u, 'cleave') * 0.3 + gpBr(u, 'sniper') * 0.05 + gpBr(u, 'pyro') * 0.25 + (gpLegend(u) ? 0.04 : 0);
    return Math.min(0.95, p);
  };
  const _nd = neuDamageOf;
  neuDamageOf = function (u) {
    let d = _nd(u);
    if (u.rec) d *= (1 + gpBr(u, 'cleave') + gpBr(u, 'pyro')) * (gpLegend(u) ? 1.1 : 1);
    return d;
  };
  const _ur = unitRange;
  unitRange = function (u) { return _ur(u) + gpBr(u, 'sniper'); };
  const _anc = recAnchor;
  recAnchor = function (u) { const a = _anc(u); if (gpBr(u, 'tracker')) a[2] += 3; return a; };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) { const g = gpBr(u, 'guard'); _hu(u, g ? n * (1 - g) : n); };

  // удар и выстрел: крит Тени, слава и задания за победы, золото Карманника
  const _st = strike;
  strike = function (u, f) {
    const alive = foeAlive(f);
    const sh = gpBr(u, 'shadow');
    if (alive && sh && Math.random() < sh) {
      floater(f.o.x, f.o.y - 2, 'Крит из тени!', '#e0b0ff');
      if (f.kind === 'neu') neuHit(f.o, u, neuDamageOf(u) * 2); else killFoe(f, u);
    } else _st(u, f);
    if (!alive || foeAlive(f) || gpMirror()) return;
    const b = gpUnitGuild(u), kind = f.kind === 'skel' || f.kind === 'ent' ? 'night' : 'hunt';
    if (b) { gpGlory(b, u.rec ? (f.kind === 'neu' ? 3 : 2) : 1); gpTaskEvent(kind, b); }
    const pk = gpBr(u, 'pick');
    if (pk && Math.random() < pk) { dropPile(Math.floor(f.o.x), Math.floor(f.o.y), 'gold', 1); floater(f.o.x, f.o.y - 2.2, '+1 золото', '#ffd040'); }
  };

  // окно гильдии: путь, задание дня, кубок
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (!isGuild(b) && !(gpIsGuildType(b.type) && b.upg)) return h;
    if (b.upg && (b.level || 1) >= 2) h = h.replace('Достройка до уровня 2', 'Достройка до уровня 3');
    if ((b.level || 1) === 2 && canUpgrade(b)) h = h.replace(/Достроить до уровня 2/, 'Достроить до уровня 3').replace(BUILDINGS[b.type].desc2, GP_DESC3[b.type]);
    if (isGuild(b) && !b.upg) {
      gpInitUI();
      const i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + gpPathHTML(b) + h.slice(i) : h + gpPathHTML(b);
    }
    return h;
  };
  const _rch = recCardHTML;
  recCardHTML = function (u) {
    gpInitUI();
    const h = _rch(u), i = h.indexOf('<div class="tip">');
    const add = gpBranchHTML(u);
    return i >= 0 ? h.slice(0, i) + add + h.slice(i) : h + add;
  };

  // сохранение: слава и кубок — в здании, ветка — уже в rec (units[].rc), задание и кубок — Game.gpath
  const _sb = serializeBuilding;
  serializeBuilding = function (b) {
    const d = _sb(b);
    if (b.glory) d.gl = b.glory;
    if (b.cup) d.gc = 1;
    return d;
  };
  const _ser = serializeGame;
  serializeGame = function () { const s = _ser(); if (Game.gpath) s.gp = Game.gpath; return s; };
  const _apply = applySave;
  applySave = function (s) {
    GP.pendGl = new Map((s.buildings || []).filter(d => d.gl).map(d => [d.id, d.gl]));
    try { _apply(s); } finally { GP.pendGl = null; }
    for (const d of s.buildings || []) {
      const b = Game.buildings.find(x => x.id === d.id);
      if (!b || !gpIsGuildType(b.type)) continue;
      b.glory = d.gl || 0; b.cup = d.gc ? 1 : 0;
      if (d.level === 3 && (b.level || 1) < 3) { if ((b.level || 1) < 2) upgradeBuilding(b, true); upgradeBuilding(b, true); }
      if (d.upg && !b.upg && canUpgrade(b)) { startUpgrade(b); Object.assign(b.upg.used, d.upg.used); Object.assign(b.upg.stock, d.upg.stock); b.upg.usedN = d.upg.usedN; b.upg.hits = d.upg.hits; }
    }
    Game.gpath = s.gp && typeof s.gp === 'object' ? s.gp : null;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.gpath = null; };

  const _step = step;
  step = function (dt) { _step(dt); gpTick(dt); };

  // клиент общей деревни: слава, кубок и уровень 3 — из здания; задание дня — из зеркала мира
  const _start = startGame;
  startGame = function () {
    _start();
    if (GP.cHooked) return;
    if (typeof coopApplyBuilding === 'function') {
      GP.cHooked = true;
      const _cab = coopApplyBuilding;
      coopApplyBuilding = function (d, byId) {
        GP.pendGl = new Map([[d.id, d.gl || 0]]);
        try { _cab(d, byId); } finally { GP.pendGl = null; }
        const b = byId.get(d.id);
        if (!b || !gpIsGuildType(b.type)) return;
        b.glory = d.gl || 0; b.cup = d.gc ? 1 : 0;
        if (d.level === 3 && (b.level || 1) < 3) { if ((b.level || 1) < 2) upgradeBuilding(b, true); upgradeBuilding(b, true); }
        if (d.upg && !b.upg && canUpgrade(b)) startUpgrade(b);
      };
      const _cm = coopMirror;
      coopMirror = function (m) { _cm(m); Game.gpath = m.gp || null; };
    }
  };

  // рекрутам — звёзды звания над главой гильдии
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    for (const u of Game.units) {
      if (!u.gm || u.dead || u.inside) continue;
      const b = Game.buildings.find(x => x.id === u.gm);
      if (!b) continue;
      const r = gpRank(b), px = u.x * TILE, py = u.y * TILE - 44;
      c.font = 'bold 6px sans-serif'; c.textAlign = 'center';
      const lbl = '★'.repeat(r + 1);
      c.lineWidth = 3; c.strokeStyle = 'rgba(20,12,4,0.9)'; c.strokeText(lbl, px, py);
      c.fillStyle = r >= 3 ? '#ffb030' : '#f6d458'; c.fillText(lbl, px, py); c.textAlign = 'start';
      if (b.cup) gpCupIcon(c, Math.round(px + c.measureText(lbl).width / 2 + 2), Math.round(py - 6));
    }
  };
}

// значок кубка 7×7 (свой пиксель-арт)
function gpCupIcon(c, x, y) {
  const P = (a, b, w, h, cl) => { c.fillStyle = cl; c.fillRect(x + a, y + b, w, h); };
  P(-1, -1, 9, 9, 'rgba(20,12,4,0.85)');
  P(0, 0, 7, 3, '#f0c040'); P(1, 3, 5, 1, '#d8a828'); P(2, 4, 3, 1, '#b8901e'); P(3, 5, 1, 1, '#b8901e'); P(1, 6, 5, 1, '#f0c040');
  P(1, 0, 2, 2, '#fff0a0'); P(-1, 0, 1, 2, '#d8a828'); P(7, 0, 1, 2, '#d8a828');
}
// цена урока для окна гильдии (там мастерство берётся и из зеркала)
function gpLessonPrice(b, ms, mine) { return !mine ? 3 : ms >= MASTERY_MAX ? 8 : Math.max(1, 2 + ms - (gpRank(b) >= 2 ? 1 : 0)); }

// Грандмастер: 6-й ранг — только в гильдии уровня 3
function* gpGrandGen(u, b, cls) {
  const H = u.hero, C = GCLS[cls], gm = masterOf(b), need = (MASTERY_MAX + 1) * 2;
  const ok = yield { walk: [b.doorX, b.doorY] };
  if (!ok || b.removed) return;
  if (!gm) { floater(u.x, u.y - 1.6, 'Главы гильдии нет', '#e8a070'); return; }
  if (H.level < need) { floater(gm.x, gm.y - 1.7, `Грандмастер — с ${need} уровня`, '#f6e8b0'); return; }
  const price = 8;
  if (!payGold(b, price)) { floater(gm.x, gm.y - 1.7, `Последний урок стоит ${price} золота`, '#f6e8b0'); gsay(u, `${b.def.name}: нужно ${price} золота`); return; }
  u.meetB = b; gm.meet = u; gm.proc = null; gm.action = null;
  for (let k = 0; k < 8 && Math.hypot(gm.x - u.x, gm.y - u.y) > 2.2; k++) yield { wait: 0.5 };
  b.working = true;
  floater(gm.x, gm.y - 1.8, 'Последний урок. Не подведи.', '#f6e8b0');
  for (let k = 0; k < 10; k++) { u.face = gm.x > u.x ? 1 : -1; u.vdir = 'E'; yield { wait: 0.9, anim: C.shot ? 'build' : k % 3 === 1 ? 'duck' : 'chop' }; if (b.removed) break; }
  b.working = false; gm.meet = null; u.meetB = null;
  if (b.removed) return;
  H.mastery = GP_MASTERY3;
  gsay(u, `${H.name} — грандмастер: «${C.name}», ранг ${GP_MASTERY3}!`);
  logEvent('people', `${H.name} стал грандмастером: ${C.name}`, u.x, u.y);
  floater(u.x, u.y - 2, 'Грандмастер!', '#ffe070');
  if (!H.owner && H.maxhp && typeof hlMaxHp === 'function') H.maxhp = hlMaxHp(H);
  fxBurst(u.x * TILE, u.y * TILE - 12, 30, ['#ffe070', '#fff6c0', C.col], 90, 70, 1.2, 2.2, 120);
  sfxAt('chime', u.x * TILE, u.y * TILE);
  gpGlory(b, 6); gpTaskEvent('lesson', b);
  u._spr = null;
}

// ================= Общая деревня: сервер =================

function gpServerHook() {
  GP.hooked = true;
  const _gcc = guildCoopCmd;
  guildCoopCmd = function (name, m, admin) {
    if (m.a === 'order' && typeof m.o === 'string' && m.o.startsWith('br_')) {
      const u = Game.unitMap.get(m.id);
      if (u && u.rec && !u.dead && (admin || coop.perms.manage)) gpSetBranch(u, m.o.slice(3));
      return;
    }
    return _gcc(name, m, admin);
  };
  const _mir = coopMirror;
  coopMirror = function () { const m = _mir(); if (Game.gpath) m.gp = Game.gpath; return m; };
  // ветка рекрута — игрокам вместе с данными рекрута
  const _gss = guildServerSync;
  guildServerSync = function () {
    _gss();
    for (const u of Game.units) if (u.rec && u.gx) u.gx.br = u.rec.br || '';
  };
}
