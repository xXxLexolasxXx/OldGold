'use strict';
// Обучение «за руку»: каждый шаг — короткое задание. Игрока ведут по самому интерфейсу:
// мигает нужная кнопка (вкладка → раздел → здание), остальное притушено, стрелка показывает, куда жать,
// а на карте подсвечено ЛУЧШЕЕ место (рядом с ресурсом и дорогой) и маршрут дороги от «А» до «Б».
// Реплики шагов — голос старосты Грума; после этапов идут сцены лора (lore.js).
// Шаг засчитывается только по действию игрока. Есть «Пропустить», «Повторить шаг» и чек-лист целей.
// Первая ночь прерывает обучение своим шагом, потом всё продолжается с того же места.
// В общей деревне — короткий вариант без стройки: меню и здания там общие, хосту не мешаем.

const Tut = {
  on: false, i: 0, doneAt: 0, cam0: null, el: null, list: null, dim: null, arrow: null,
  coop: false, ok: [], ret: -1, nightDone: false, cast: false, f: null, camKey: '', spotC: null, roadC: null, fieldC: null, raf: 0,
};

const isMob = () => typeof Mobile !== 'undefined' && Mobile.on;
const findB = type => Game.buildings.find(b => b.type === type && !b.removed);
const storeB = () => Game.buildings.find(b => b.isStore() && !b.isPile);
// здание связано дорогой со складом
const linked = b => { const s = storeB(); return !!(b && s && compAt(b.doorX, b.doorY) && compAt(b.doorX, b.doorY) === compAt(s.doorX, s.doorY)); };
const catBtn = name => `#build-cats button[data-cat="${name}"]`;
const tabSel = name => `#tabs .tab-btn[data-tab="${name}"]`;
const tutSeen = () => { try { return localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { return false; } };
const tutN = k => String(k + 1).padStart(2, '0');
// «Кликните по складу» / «Коснитесь склада»
const tap = (dat, gen) => isMob() ? 'Коснитесь ' + gen : 'Кликните по ' + dat;
const buildTabOpen = () => UI.tab === 'build' && (!isMob() || document.body.classList.contains('sheet-tab'));
const tutHeroNear = (b, r) => { const h = Game.hero; return !!(h && b && !h.inside && Math.hypot(h.x - (b.x + b.w / 2), h.y - (b.y + b.h / 2)) < r); };

// Конец обучения (или пропуск): достраиваем школу и открываем «Ресурсы»
function releaseStart() {
  if (Tut.coop) return;                      // в общей деревне меню и стройки не наши
  for (const b of Game.buildings) b.hold = false;
  unlockStage('res', true);
}

const more = (title, html) => `<details><summary>${title}</summary>${html}</details>`;

// ---------- Где строить: лучшая клетка и маршрут дороги ----------

// клетка свободна под фундамент
function tutFree(i) {
  const o = World.obj[i];
  return World.terrain[i] === T_GRASS && !World.bmap[i] && !World.door[i] && !World.road[i] && !Game.roadSites.has(i) && (!o || isStreetObj(o));
}

// Суммы по прямоугольнику (деревья, камни, свободная трава) — «сколько рядом» за O(1)
function tutSums(test) {
  const W = MAP_W + 1, S = new Int32Array(W * (MAP_H + 1));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
    S[(y + 1) * W + x + 1] = (test(idx(x, y)) ? 1 : 0) + S[y * W + x + 1] + S[(y + 1) * W + x] - S[y * W + x];
  return (x0, y0, x1, y1) => {   // включительно, с обрезкой по краю
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(MAP_W - 1, x1); y1 = Math.min(MAP_H - 1, y1);
    if (x1 < x0 || y1 < y0) return 0;
    return S[(y1 + 1) * W + x1 + 1] - S[y0 * W + x1 + 1] - S[(y1 + 1) * W + x0] + S[y0 * W + x0];
  };
}

// Сколько клеток дороги доложить до сети склада: поле 0-1 (дорога и заложенная дорога — 0, свободная клетка — 1)
// и «куда идти» (par) — по нему строится маршрут от входа к сети
function tutRoadField() {
  const s = storeB();
  const key = `${Game.buildings.length}|${Game.roadSites.size}|${s ? s.id : 0}`;
  if (Tut.fieldC && Tut.fieldC.key === key && performance.now() - Tut.fieldC.t < 3000) return Tut.fieldC;
  const d = new Int32Array(N_TILES).fill(-1), par = new Int32Array(N_TILES).fill(-1);
  if (s) {
    const c0 = compAt(s.doorX, s.doorY), q = new Int32Array(N_TILES * 4);
    let h = N_TILES * 2, t = h;      // дек: шаги по дороге — в голову, по траве — в хвост
    for (let i = 0; i < N_TILES; i++) if (World.road[i] && World.roadComp[i] === c0) { d[i] = 0; q[t++] = i; }
    while (h < t) {
      const c = q[h++], cx = c % MAP_W;
      for (const n of [cx + 1 < MAP_W ? c + 1 : -1, cx > 0 ? c - 1 : -1, c + MAP_W < N_TILES ? c + MAP_W : -1, c - MAP_W]) {
        if (n < 0) continue;
        const zero = World.road[n] || Game.roadSites.has(n);
        if (!zero && !canPlaceRoad(n % MAP_W, (n / MAP_W) | 0)) continue;
        const nd = d[c] + (zero ? 0 : 1);
        if (d[n] >= 0 && d[n] <= nd) continue;
        d[n] = nd; par[n] = c;
        if (zero && h > 0) q[--h] = n; else if (t < q.length) q[t++] = n;
      }
    }
  }
  Tut.fieldC = { key, t: performance.now(), d, par };
  return Tut.fieldC;
}

// Лучшее место для здания: близко к ресурсу, к дороге и складу, проходимо и никому не перекрывает путь.
// {bx, by, w, h, rot, door:[x,y], tap:[x,y]} или null
function tutBestSpot(type) {
  const s = storeB(), def = BUILDINGS[type];
  if (!s || !def) return null;
  const rot = Game.tool && Game.tool.kind === 'build' && Game.tool.type === type ? Game.tool.rot || 0 : 0;
  const key = `${type}|${rot}|${Game.buildings.length}|${Game.roadSites.size}`;
  if (Tut.spotC && Tut.spotC.key === key && performance.now() - Tut.spotC.t < 8000) return Tut.spotC.res;
  const d = bDims(type, rot), field = tutRoadField().d;
  const trees = tutSums(i => { const o = World.obj[i]; return !!(o && o.t === 'tree' && o.g >= 1); });
  const stones = tutSums(i => { const o = World.obj[i]; return !!(o && o.t === 'stone' && o.n > 0); });
  const free = type === 'farm' ? tutSums(tutFree) : null;
  const near = t => { const b = findB(t); return b ? [b.doorX, b.doorY] : [s.doorX, s.doorY]; };
  const pal = { sawmill: near('woodcutter'), mill: near('farm'), bakery: near('mill') }[type];
  const R = 28, list = [];
  for (let by = s.doorY - R; by <= s.doorY + R; by++) for (let bx = s.doorX - R; bx <= s.doorX + R; bx++) {
    if (bx < 1 || by < 1 || bx + d.w >= MAP_W - 1 || by + d.h >= MAP_H - 1) continue;
    let ok = true;
    for (let yy = by; yy < by + d.h && ok; yy++) for (let xx = bx; xx < bx + d.w; xx++) if (!tutFree(idx(xx, yy))) { ok = false; break; }
    if (!ok) continue;
    const dx = bx + d.dx, dy = by + d.dy;
    if (!inb(dx, dy)) continue;
    const rc = field[idx(dx, dy)];
    if (rc < 0) continue;                                          // к входу дорогу не провести
    let sc = -rc * 1.4 - Math.hypot(dx - s.doorX, dy - s.doorY) * 0.25;
    if (type === 'woodcutter') { const n = trees(dx - 6, dy - 6, dx + 6, dy + 6); if (n < 6) continue; sc += Math.min(n, 30) * 1.1; }
    if (type === 'quarry') { const n = stones(dx - 8, dy - 8, dx + 8, dy + 8); if (!n) continue; sc += Math.min(n, 10) * 3; }
    if (type === 'farm') sc += free(bx - 4, by - 4, bx + d.w + 3, by + d.h + 3) * 0.45 - trees(bx - 2, by - 2, bx + d.w + 1, by + d.h + 1) * 0.5;
    if (pal) sc -= Math.hypot(dx - pal[0], dy - pal[1]) * 0.4;
    // не прижиматься к чужим входам: им тоже нужны дороги
    for (let yy = by - 1; yy <= by + d.h; yy++) for (let xx = bx - 1; xx <= bx + d.w; xx++) if (inb(xx, yy) && World.door[idx(xx, yy)]) sc -= 8;
    list.push([sc, bx, by]);
  }
  list.sort((a, b) => b[0] - a[0]);
  let res = null;
  for (const [, bx, by] of list.slice(0, 60)) {       // точная проверка (вода, проход, камень рядом) — только лучшим
    if (checkPlacement(type, bx, by, d.rot)) continue;
    res = { type, bx, by, w: d.w, h: d.h, rot: d.rot, door: [bx + d.dx, by + d.dy], tap: [bx + Math.floor(d.w / 2), by + d.h - 1] };
    break;
  }
  Tut.spotC = { key, t: performance.now(), res };
  return res;
}

// Маршрут дороги от входа здания до сети склада: {need: клетки без дороги, от «А» у сети к «Б» у входа} или null
function tutRoadPlan(b) {
  if (!b || !storeB()) return null;
  const key = `${b.id}|${Game.roadSites.size}|${Game.buildings.length}`;
  if (Tut.roadC && Tut.roadC.key === key && performance.now() - Tut.roadC.t < 900) return Tut.roadC.res;
  const { d, par } = tutRoadField(), start = idx(b.doorX, b.doorY);
  let res = null;
  if (d[start] >= 0) {
    const need = [];
    for (let c = par[start], guard = 0; c >= 0 && guard < 2000; c = par[c], guard++) if (!World.road[c] && !Game.roadSites.has(c)) need.push(c);
    res = { need: need.reverse() };
  }
  Tut.roadC = { key, t: performance.now(), res };
  return res;
}
const roadDone = b => { if (!b) return false; if (linked(b)) return true; const p = tutRoadPlan(b); return !!(p && !p.need.length); };

// ---------- Куда смотреть: фокус текущего шага ----------
// {k:'ui', sel, say} — подсветить кнопку; {k:'map', box:[x0,y0,x1,y1], at:[x,y], say} — место на карте; {k:'none', say}

const uiF = (sel, say, extra) => ({ k: 'ui', sel, say, ...extra });
const mapF = (box, at, say, extra) => ({ k: 'map', box, at, say, ...extra });
const bMap = (b, say) => mapF([b.x - 0.5, b.y - 1.5, b.x + b.w + 0.5, b.y + b.h + 0.5], [b.x + b.w / 2, b.y - 1.2], say, { ring: b });

function buildFocus(type) {
  const def = BUILDINGS[type], cat = def.cat;
  if (Game.tool && Game.tool.kind === 'build' && Game.tool.type === type) {
    const sp = tutBestSpot(type);
    if (isMob() && R.hover) return uiF('#mtool-ok', 'Нажмите ✓ — и стройка заложена.', { spot: sp });
    if (!sp) return { k: 'none', say: 'Найдите место сами: зелёная рамка — можно, красная — нельзя.' };
    const why = { woodcutter: ': лес рядом, до дороги рукой подать', quarry: ': камни под боком', farm: ': есть где разбить поле', sawmill: ': между лесорубом и складом' }[type] || '';
    return mapF([sp.bx - 2, sp.by - 3, sp.bx + sp.w + 2, sp.by + sp.h + 2], [sp.tap[0] + 0.5, sp.by - 1.6],
      `${tap('светлой рамке', 'светлой рамки')} под стрелкой — лучшее место${why}.`, { spot: sp });
  }
  if (!buildTabOpen()) return uiF(tabSel('build'), 'Откройте вкладку «Строительство» (молоток).');
  if (BUILD_CATS[UI.cat] !== cat) return uiF(catBtn(cat), `Раздел «${cat}».`);
  return uiF(`.bbtn[data-type="${type}"]`, `Выберите «${def.name}».`);
}

function roadFocus(b) {
  const p = tutRoadPlan(b);
  if (!p) return { k: 'none', say: 'К этому входу дорогу не провести — снесите стройку («Снести») и поставьте по стрелке.' };
  if (!(Game.tool && Game.tool.kind === 'road')) {
    if (isMob() && !buildTabOpen()) return uiF(tabSel('build'), 'Откройте «Строительство» — там «Дорога».', { plan: p });
    return uiF('#tool-road', `Возьмите «Дорогу»${isMob() ? '' : ' (или клавиша R)'}.`, { plan: p });
  }
  const xs = p.need.map(i => i % MAP_W), ys = p.need.map(i => (i / MAP_W) | 0);
  const a = p.need[0];
  return mapF([Math.min(...xs) - 1, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2], [a % MAP_W + 0.5, ((a / MAP_W) | 0) - 0.3],
    `${isMob() ? 'Ведите пальцем' : 'Протяните мышью'} от «А» до «Б» по жёлтым клеткам — можно в несколько заходов. Клетка — 1 камень.`, { plan: p });
}

// цепочка зданий: каждое поставить и соединить дорогой со складом
function chainFocus(types) {
  for (const t of types) {
    const b = findB(t);
    if (!b) return buildFocus(t);
    if (!roadDone(b)) return roadFocus(b);
  }
  return null;
}
const chainDone = types => types.every(t => roadDone(findB(t)));
const chainSub = types => types.flatMap(t => [[`Поставить: ${BUILDINGS[t].name}`, !!findB(t)], ['Проложить к ней дорогу', roadDone(findB(t))]]);

function heroFocus(target) {
  const h = Game.hero;
  if (!h) return { k: 'none', say: 'Героя пока нет — жмите «Пропустить».' };
  // телефон: шторка закрыла кнопку героя — сначала свернуть её
  if (isMob() && /sheet-(tab|info)/.test(document.body.className)) return uiF('#sheet-close', 'Сверните шторку — герой ждёт на карте.');
  if (Game.selUnit !== h) return uiF('#hero-btn', `Выберите героя: кнопка с портретом${isMob() ? '' : ' или клавиша H'}.`, { mark: [h.x, h.y] });
  return target();
}
function heroJob() {
  const b = Game.buildings.find(x => x.state !== 'done' && !x.isRoad && !x.removed);
  if (b) return bMap(b, `${tap('стройке', 'стройки')} — герой пойдёт строить.`);
  const h = Game.hero, t = findObjNear(Math.floor(h.x), Math.floor(h.y), 14, o => o.t === 'tree' && o.g >= 1 && !o.res);
  if (t) return mapF([t.x - 1, t.y - 2, t.x + 2, t.y + 1], [t.x + 0.5, t.y - 1.4], `${tap('дереву', 'дерева')} под стрелкой — герой нарубит брёвен.`);
  return { k: 'none', say: `${tap('дереву, камню или стройке', 'дерева, камня или стройки')}.` };
}
// ночью костёр «проверили»: открыли его окно или послали к нему героя
function tutFireSeen() {
  const h = Game.hero, sel = Game.selected, bf = findB('bonfire'), c = h && h.cmd;
  if ((sel && sel.type === 'bonfire') || (c && bf && (c.b === bf || Math.hypot(c.tx - bf.doorX, c.ty - bf.doorY) < 3))) Tut.fire = true;
  return Tut.fire;
}
const heroCmd = () => { const h = Game.hero; return !!(h && h.cmd && h.cmd.kind && h.cmd.kind !== 'move'); };

// ---------- Шаги ----------
// solo — только в своей деревне. События воронки: tut2-step-NN / tut2-ok-NN / tut2-skip-NN (закрыл) / tut2-pass-NN (пропустил шаг)
const TUT_STEPS = [
  {
    ph: 'Деревня', title: 'Осмотритесь',
    text: () => 'Приехали, старейшина. Долина Старого Золота — дом наших прадедов. Оглядитесь, пока гномы распрягают повозки и пока никто ничего не сломал.',
    focus: () => ({ k: 'none', say: isMob() ? 'Потяните карту пальцем, двумя пальцами — масштаб.' : 'Потяните карту правой кнопкой мыши (или W A S D), колесо — масштаб.' }),
    done: () => Tut.cam0 && (Math.hypot(R.cam.x - Tut.cam0.x, R.cam.y - Tut.cam0.y) > 120 || R.cam.z !== Tut.cam0.z),
  },
  {
    ph: 'Деревня', title: 'Загляните на склад', solo: true,
    enter: () => { if (Game.selUnit) { Game.selUnit = null; updateUI(true); } },   // выбранный герой ушёл бы к складу вместо окна склада
    text: () => 'Склад — всё, что мы увезли из Подгорья: брёвна, камень, хлеб и золото. Кладовщик пересчитывает их каждую ночь и всё равно недоволен.',
    focus: () => { const s = storeB(); return s ? bMap(s, `${tap('складу', 'склада')} — откроется окно с запасами.`) : { k: 'none', say: '' }; },
    done: () => Game.selected && Game.selected.isStore && Game.selected.isStore(),
  },
  {
    ph: 'Стройка', title: 'Дом лесоруба', solo: true, chain: ['woodcutter'], enter: () => unlockStage('res', true),
    text: () => 'Строить будем из брёвен и камня, как деды. Лесоруб рубит лес; лес, как ни странно, против.',
  },
  {
    ph: 'Стройка', title: 'Каменоломня', solo: true, chain: ['quarry'], enter: () => unlockStage('res', true),
    text: () => 'Камень берут у серых валунов. Предки тут уже копали — может, найдём что-нибудь, кроме мозолей.',
  },
  {
    ph: 'Стройка', title: 'Лесопилка', solo: true, chain: ['sawmill'], enter: () => unlockStage('res', true),
    text: () => 'Брёвна — в доски. Брёвна подвезёт лесоруб, когда достроится. Терпение — тоже ресурс. У гномов его много, у меня — нет.',
  },
  {
    ph: 'Хлеб', title: 'Ферма', solo: true, chain: ['farm'], enter: () => unlockStage('grain', true),
    text: () => 'Трактир кормит, а кто-то должен кормить трактир. Ферме нужна трава вокруг — под поле. Зерно у бабушки Яглы, она выдаст. Наверное.',
  },
  {
    ph: 'Хлеб', title: 'Мельница и пекарня', solo: true, chain: ['mill', 'bakery'], enter: () => unlockStage('grain', true),
    text: () => 'Зерно → мука → хлеб. Гномы любят хлеб почти так же сильно, как ворчать. Я — исключение: ворчать я люблю больше.',
  },
  {
    ph: 'Хозяйство', title: 'Где что не так', grum: false,
    text: () => 'Значки над домами говорят, чего не хватает: дороги, рабочего, сырья. Все беды разом — во вкладке «Хозяйство». Достроите цепочку — меню само откроет новый раздел.',
    focus: () => uiF(tabSel('overview'), 'Откройте вкладку «Хозяйство» (свиток).'),
    done: () => UI.tab === 'overview' && (!isMob() || document.body.classList.contains('sheet-tab')),
  },
  {
    ph: 'Герой', title: 'Ваш герой',
    enter: () => { if (isMob()) mobileSheet(null); },
    text: () => 'Герой — правнук Фонарщика, самый быстрый из нас и мастер на все руки. Дайте ему дело, пока он не нашёл фляжку.',
    focus: () => heroFocus(heroJob),
    done: heroCmd,
  },
  {
    ph: 'Бой', title: 'Способности', grum: false,
    text: () => `Нечисть — забота героя. В углу экрана — панель способностей: <b>атака</b>${isMob() ? '' : ' (<kbd>Q</kbd>)'} бьёт ближайшего врага, а свои приёмы у каждого класса появятся после учёбы в гильдии${isMob() ? '' : ' (клавиши <kbd>1</kbd>–<kbd>5</kbd>)'}. ${isMob() ? 'Касание — применить, удержание — подсказка.' : 'Наведите — подсказка.'} Днём целей нет — просто попробуйте.`,
    focus: () => heroFocus(() => {
      const b = document.querySelector('#ab-bar [data-abu="u_atk"]');
      if (!b || !b.getClientRects().length) return uiF('#hero-btn', 'Выберите героя — появится панель способностей.');
      return uiF('#ab-bar [data-abu="u_atk"]', isMob() ? 'Коснитесь кнопки атаки — одно касание, без меню.' : 'Нажмите кнопку атаки на панели (или Q).');
    }),
    done: () => Tut.cast,
  },
  {
    ph: 'Ночь', title: 'Первая ночь', night: true,
    text: () => isEveningNow()
      ? 'Ночь: деревья открывают глаза, скелеты выходят погулять — про это дед на карте не писал. Поставьте героя у большого костра, огонь его бодрит. Испуганные гномы сами спрячутся в трактире: храбрость в зарплату не входит.'
      : 'Скоро стемнеет, и долина покажет, почему предки ушли. К вечеру пусть в трактире будет хлеб, а герой — у костра.',
    focus: () => {
      if (!isEveningNow()) return uiF('#speed-cur', 'Ускорьте время до вечера (или просто подождите).');
      const bf = findB('bonfire');
      if (!bf) return { k: 'none', say: 'Держитесь до рассвета.' };
      if (!tutFireSeen()) return bMap(bf, `${tap('большому костру', 'большого костра')} — проверьте, горит ли огонь.`);
      if (tutHeroNear(bf, 5)) return { k: 'none', say: 'Герой у огня. Держитесь до рассвета.' };
      return heroFocus(() => bMap(bf, `${isMob() ? 'Коснитесь земли' : 'Кликните'} рядом с костром — герой встанет у огня.`));
    },
    done: () => isEveningNow() && (!findB('bonfire') || (tutFireSeen() && tutHeroNear(findB('bonfire'), 5))),
  },
  {
    ph: 'Дальше', title: 'Что ещё есть', grum: false,
    text: () => `Это потом — подсказки сами всплывут, когда понадобятся:
      ${more('Гильдии и классы', 'Цепочка «хлеб → пиво → свиньи → ремесло → металл» откроет оружейника, а за ним гильдии. Глава гильдии учит героя классу.')}
      ${more('Праздник и субботник', 'Праздник — кнопка в трактире: все пляшут, потом болеют. Субботник — раз в день с утра: деревня убирает мусор.')}
      ${more('Кооператив', 'Меню → Мультиплеер: общая деревня с друзьями. Помогают. Иногда.')}
      ${more('Справка', 'Меню → «Как играть». Это обучение тоже можно повторить из меню.')}`,
  },
  {
    ph: 'Финал', title: 'Дальше — сами!', last: true,
    text: () => 'Главное: дороги, хлеб, непустой склад, а к ночи — свет и герой на месте. Что там с башней — разберёмся. Потом. Всё, что гномы вспомнят о долине, — в журнале «Лор» (меню). Гномы в вас верят. Ну, некоторые.',
  },
];

const tutStep = () => TUT_STEPS[Tut.i];
const stepUsable = s => !(Tut.coop && s.solo);
const stepHasTask = s => !!(s.chain || s.done);
const stepDone = s => s.chain ? chainDone(s.chain) : s.done ? !!s.done() : false;
function stepFocus(s) {
  const f = s.chain ? chainFocus(s.chain) : s.focus ? s.focus() : null;
  // телефон: цель на карте, а её закрывает шторка — сначала свернуть шторку
  if (f && f.k === 'map' && isMob() && /sheet-(tab|info)/.test(document.body.className)) return uiF('#sheet-close', 'Сверните шторку — дальше на карте.', { plan: f.plan, spot: f.spot, ring: f.ring });
  return f;
}

// ---------- Ход обучения ----------

function tutStart(mode) {
  track('tut-start', 'Обучение: началось');
  Tut.coop = mode === 'coop' || (typeof Coop !== 'undefined' && !!Coop.on);
  Object.assign(Tut, { on: true, i: 0, doneAt: 0, ok: [], ret: -1, nightDone: false, cast: false, fire: false, camKey: '' });
  Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  const help = document.getElementById('help'); if (help) help.classList.add('hidden');
  tutRender();
  tutLoop();
}

function tutClose(finished) {
  if (finished) track('tut-done', 'Обучение: пройдено до конца');
  else if (Tut.on) track('tut2-skip-' + tutN(Tut.i), 'Обучение 2: закрыл на шаге ' + (Tut.i + 1));
  Tut.on = false;
  try { localStorage.setItem('oldgold-tut', 'done'); } catch (e) { /* нет хранилища */ }
  tutHighlight([]);
  releaseStart();
  for (const el of [Tut.el, Tut.list, Tut.dim, Tut.arrow]) if (el) el.classList.add('hidden');
  if (finished) { toast('Обучение пройдено! Его можно повторить в меню'); applaud('Деревня аплодирует: обучение пройдено!'); }
}

function tutGo(d) {
  if (Tut.ret >= 0 && tutStep().night) { Tut.i = Tut.ret; Tut.ret = -1; }   // ночь прервала шаг — вернуться к нему
  else {
    let i = Tut.i + d;
    while (i > 0 && i < TUT_STEPS.length - 1 && (!stepUsable(TUT_STEPS[i]) || (TUT_STEPS[i].night && Tut.nightDone))) i += d < 0 ? -1 : 1;
    Tut.i = Math.max(0, Math.min(TUT_STEPS.length - 1, i));
  }
  Tut.doneAt = 0; Tut.camKey = '';
  if (Tut.i === 0) Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  tutRender();
}

// Повторить шаг: убрать инструмент из руки, свернуть шторки и показать всё заново, с первой кнопки
function tutRedo() {
  track('tut2-redo-' + tutN(Tut.i), 'Обучение 2: повторил шаг ' + (Tut.i + 1));
  if (Game.tool) setTool(null);
  if (isMob()) mobileSheet(null);
  Tut.doneAt = 0; Tut.camKey = '';
  if (Tut.i === 0) Tut.cam0 = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
  tutRender();
}

function tutEls() {
  if (Tut.el) return;
  const view = document.getElementById('view');
  Tut.el = document.createElement('div'); Tut.el.id = 'tut';
  Tut.list = document.createElement('div'); Tut.list.id = 'tut-list';
  Tut.dim = document.createElement('div'); Tut.dim.id = 'tut-dim';
  Tut.arrow = document.createElement('div'); Tut.arrow.id = 'tut-arrow';
  Tut.arrow.innerHTML = '<i></i>';
  document.body.append(Tut.dim, Tut.arrow);
  view.append(Tut.el, Tut.list);
  Tut.el.addEventListener('click', e => {
    const a = e.target.closest('[data-tut]');
    if (!a) return;
    const k = a.dataset.tut;
    if (k === 'next') { if (tutStep().last) tutClose(true); else tutGo(1); }
    if (k === 'skip') {
      track('tut2-pass-' + tutN(Tut.i), 'Обучение 2: пропустил шаг ' + (Tut.i + 1));
      Tut.ok[Tut.i] = 'skip';
      if (tutStep().night) Tut.nightDone = true;
      tutGo(1);
    }
    if (k === 'redo') tutRedo();
    if (k === 'close') tutClose(false);
    if (k === 'min') Tut.el.classList.toggle('min');
    if (k === 'list') Tut.list.classList.toggle('open');
  });
  Tut.list.addEventListener('click', () => Tut.list.classList.toggle('open'));
  // способность засчитываем и с клавиатуры, и с панели (heroabil.js тоже ставит Tut.cast)
  if (typeof heroAbility === 'function' && !heroAbility.tut) {
    const raw = heroAbility;
    heroAbility = function (k) { if (Tut.on && (k === 'g_strike' || /^ab\d$/.test(k))) Tut.cast = true; return raw.apply(this, arguments); };
    heroAbility.tut = true;
  }
}

function tutRender() {
  tutEls();
  const s = tutStep(), ok = Tut.doneAt > 0, task = stepHasTask(s);
  track('tut2-step-' + tutN(Tut.i), 'Обучение 2: дошёл до шага ' + (Tut.i + 1));
  if (ok) track('tut2-ok-' + tutN(Tut.i), 'Обучение 2: выполнил шаг ' + (Tut.i + 1));
  if (s.enter) s.enter();   // шаги со стройкой (solo) в общей деревне не показываются
  if (s.night) Tut.eve = isEveningNow();
  const steps = TUT_STEPS.filter(stepUsable), n = steps.indexOf(s) + 1;
  Tut.el.classList.remove('hidden', 'min');
  Tut.el.classList.toggle('ok', ok);
  Tut.el.innerHTML = `
    <div class="tut-head"><span class="tut-n">Обучение · ${n} из ${steps.length}${s.ph ? ' · ' + s.ph : ''}</span>
      <button data-tut="list" title="Список целей">☰</button><button data-tut="min" title="Свернуть / развернуть">▁</button><button data-tut="close" title="Закрыть обучение">✕</button></div>
    <div class="tut-bar"><div style="width:${Math.round((n - 1 + (ok ? 1 : 0)) / steps.length * 100)}%"></div></div>
    <h3>${ok ? '✔ ' : ''}${s.title}</h3>
    <div class="tut-text">${s.grum === false ? '' : '<b class="tut-who">Грум Ворчун:</b> '}${s.text()}</div>
    <div class="tut-do"></div>
    <div class="tut-btns">
      ${task ? '<button data-tut="redo" title="Показать шаг заново">↺ Повторить шаг</button>' : '<span></span>'}
      <button data-tut="${task && !ok ? 'skip' : 'next'}" class="${ok || !task ? 'primary' : ''}">${s.last ? 'Начать игру' : ok || !task ? 'Дальше →' : 'Пропустить'}</button>
    </div>`;
  tutListRender();
  tutUpdate(true);
  // прочитали — описание сворачивается, остаются заголовок, «что нажать» и кнопки (окна из очереди ждут, только пока оно развёрнуто)
  clearTimeout(Tut.autoMin);
  const step = Tut.i;
  Tut.autoMin = setTimeout(() => { if (Tut.on && Tut.i === step && !Tut.doneAt && task) Tut.el.classList.add('min'); }, isMob() ? 8000 : 15000);
}

function tutListRender() {
  const cur = tutStep(), usable = TUT_STEPS.filter(stepUsable);
  const rows = usable.map(s => {
    const k = TUT_STEPS.indexOf(s), st = Tut.ok[k] === true ? 'ok' : Tut.ok[k] === 'skip' ? 'skip' : s === cur ? 'cur' : '';
    const sub = s === cur && s.chain ? '<ul>' + chainSub(s.chain).map(([t, d]) => `<li class="${d ? 'ok' : ''}">${t}</li>`).join('') + '</ul>' : '';
    return `<li class="${st}">${s.title}${sub}</li>`;
  }).join('');
  const done = usable.filter(s => Tut.ok[TUT_STEPS.indexOf(s)] === true).length;
  const html = `<div class="tl-h">Цели <b>${done}/${usable.length}</b></div><ol>${rows}</ol>`;
  if (Tut.list.dataset.h !== html) { Tut.list.dataset.h = html; Tut.list.innerHTML = html; }
  Tut.list.classList.remove('hidden');
  // телефон: внизу панель инструмента (✓ ↻ ✕) или карточка героя — значок целей на них не лезет
  const hc = document.getElementById('hero-card');
  Tut.list.classList.toggle('tool', !!Game.tool || !!(hc && hc.getClientRects().length));
}

// Подсветка кнопок (список кнопок строительства перерисовывается — обновляем каждый такт)
function tutHighlight(sel) {
  document.querySelectorAll('.tut-hl').forEach(e => { if (!sel.some(s => e.matches(s))) e.classList.remove('tut-hl'); });
  for (const s of sel) document.querySelectorAll(s).forEach(e => e.classList.add('tut-hl'));
}

// Пересчитать фокус: что подсветить и какую строку «что делать» показать
function tutUpdate(force) {
  const f = Tut.doneAt ? null : stepFocus(tutStep());
  Tut.f = f;
  tutHighlight(f && f.k === 'ui' ? [f.sel] : []);
  const say = Tut.doneAt ? 'Готово! Идём дальше…' : f && f.say ? f.say : '';
  const doEl = Tut.el.querySelector('.tut-do');
  if (doEl && (force || doEl.dataset.say !== say)) { doEl.dataset.say = say; doEl.innerHTML = say ? `<i>▶</i>${say}` : ''; doEl.classList.toggle('hidden', !say); }
  // цель на карте далеко — подвести камеру (один раз на новую цель)
  if (f && f.k === 'map') {
    const key = Tut.i + ':' + f.say;   // по смыслу цели, а не по рамке: пока тянут дорогу, рамка меняется — камера не должна прыгать
    if (Tut.camKey !== key) {
      Tut.camKey = key;
      const cx = (f.box[0] + f.box[2]) / 2 * TILE, cy = (f.box[1] + f.box[3]) / 2 * TILE;
      // цель не влезает (слишком крупно) — отдалить, чтобы рядом было видно и окно, и лес вокруг
      let zoomed = false;
      const fits = () => (f.box[2] - f.box[0]) * TILE * camScale() < R.canvas.clientWidth * 0.45 && (f.box[3] - f.box[1]) * TILE * camScale() < R.canvas.clientHeight * 0.4;
      for (let k = 0; k < 3 && !fits() && ZOOMS.indexOf(R.cam.z) > (R.canvas.clientHeight < 520 ? 0 : 1); k++) { zoomStep(-1); zoomed = true; }
      // цель — в середину свободного от окна обучения места (а не «если далеко»: по краям панели и карточки)
      tutCenter(cx, cy);
    }
  }
}

// Поставить точку карты (мировые px) в середину той части экрана, которую не закрывает окно обучения
function tutCenter(wx, wy) {
  // где окно стоит обычно (без «переезда»), прямо сейчас: шторки могли его сдвинуть
  const fl = Tut.el.classList.contains('flip');
  if (fl) Tut.el.classList.remove('flip');
  const pr = Tut.home = Tut.el.getBoundingClientRect();
  if (fl) Tut.el.classList.add('flip');
  const cr = R.canvas.getBoundingClientRect(), W = cr.width, H = cr.height - (isMob() ? 60 : 0);   // на телефоне снизу полоса вкладок
  const l = pr.left - cr.left, t = pr.top - cr.top, rgt = pr.right - cr.left, btm = pr.bottom - cr.top;
  // из четырёх свободных полос (слева, справа, сверху, снизу от окна) — самая большая
  const free = [[l * H, l / 2, H / 2], [(W - rgt) * H, (rgt + W) / 2, H / 2], [t * W, W / 2, t / 2], [(H - btm) * W, W / 2, (btm + H) / 2]];
  free.sort((a, b) => b[0] - a[0]);
  const [, sx, sy] = free[0];
  const s = camScale();
  R.cam.x = wx - sx / s; R.cam.y = wy - sy / s;
  clampCam();
}

function tutTick() {
  if (!Tut.on) return;
  const s = tutStep();
  // первая ночь прерывает любой шаг до неё; после — возвращаемся на тот же шаг
  const ni = TUT_STEPS.findIndex(x => x.night);
  if (!Tut.nightDone && Tut.ret < 0 && Tut.i < ni && typeof isEveningNow === 'function' && isEveningNow() && isNightNow()) {
    Tut.ret = Tut.i; Tut.i = ni; Tut.doneAt = 0; Tut.camKey = '';
    track('tut2-night', 'Обучение 2: первая ночь прервала шаг ' + (Tut.ret + 1));
    tutRender();
    return;
  }
  if (!Tut.doneAt && stepHasTask(s) && stepDone(s)) {
    Tut.doneAt = performance.now();
    Tut.ok[Tut.i] = true;
    if (s.night) Tut.nightDone = true;
    if (Game.tool && s.chain) setTool(null);
    sfxAt('chime', R.cam.x + 200, R.cam.y + 150);
    tutRender();
    return;
  }
  if (Tut.doneAt && performance.now() - Tut.doneAt > 1800) { tutGo(1); return; }
  if (s.night && Tut.eve !== isEveningNow()) { tutRender(); return; }   // стемнело — текст шага «ночь» другой
  tutUpdate(false);
  tutListRender();
}

// ---------- Затемнение и стрелка: каждый кадр, чтобы ехали вместе с картой и шторками ----------

function tutRect() {
  const f = Tut.f;
  if (!f) return null;
  if (f.k === 'ui') {
    const el = [...document.querySelectorAll(f.sel)].find(e => e.getClientRects().length);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left - 5, y: r.top - 5, w: r.width + 10, h: r.height + 10, ui: true };
  }
  if (f.k === 'map') {
    const cr = R.canvas.getBoundingClientRect(), s = camScale();
    const sx = x => cr.left + (x * TILE - R.cam.x) * s, sy = y => cr.top + (y * TILE - R.cam.y) * s;
    const [x0, y0, x1, y1] = f.box;
    return { x: sx(x0), y: sy(y0), w: (x1 - x0) * TILE * s, h: (y1 - y0) * TILE * s, ax: sx(f.at[0]), ay: sy(f.at[1]) };
  }
  return null;
}

function tutLoop() {
  cancelAnimationFrame(Tut.raf);
  const hide = () => { Tut.dim.classList.add('hidden'); Tut.arrow.classList.add('hidden'); };
  const step = () => {
    if (!Tut.on) { hide(); return; }
    Tut.raf = requestAnimationFrame(step);
    const r = Tut.doneAt ? null : tutRect();
    // поверх открыто другое окно (вход, глава, дилемма) — не тушим его своей тенью
    if (!r || (typeof nqBusy === 'function' && nqBusy())) { hide(); return; }
    Tut.dim.classList.remove('hidden');
    Tut.dim.classList.toggle('map', !r.ui);
    Object.assign(Tut.dim.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    // стрелка: над целью; у верхнего края — снизу; кнопки боковой панели — справа от них
    let dir = 'down', x = r.ax != null ? r.ax : r.x + r.w / 2, y = r.ay != null ? r.ay : r.y;
    if (r.ui && r.y < 90) { dir = 'up'; y = r.y + r.h; }
    const pr0 = Tut.el.getBoundingClientRect(), underPanel = x > pr0.left && x < pr0.right && y - 50 < pr0.bottom && y > pr0.top;
    if (r.ui && ((r.x < 40 && r.w < 320 && r.x + r.w < window.innerWidth / 3) || underPanel)) { dir = 'left'; x = r.x + r.w; y = r.y + r.h / 2; }
    Tut.arrow.className = 'tut-arrow-' + dir;
    Object.assign(Tut.arrow.style, { left: x + 'px', top: y + 'px' });
    // окно обучения не закрывает цель: цель там, где окно стоит обычно, — окно переезжает к другому краю
    if (!Tut.el.classList.contains('flip') || !Tut.home) Tut.home = Tut.el.getBoundingClientRect();
    const pr = Tut.home;
    Tut.el.classList.toggle('flip', !(r.x > pr.right || r.x + r.w < pr.left || r.y > pr.bottom || r.y + r.h < pr.top));
  };
  step();
}

// Карта: лучшее место (рамка и вход), разрешённые/запрещённые клетки вокруг, маршрут дороги «А → Б», рамка у здания
function drawTutMarks(c) {
  if (!Tut.on || Tut.doneAt || !Tut.f) return;
  const f = Tut.f, pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
  c.save();
  if (f.spot && Game.tool && Game.tool.kind === 'build') {
    const sp = f.spot, cx = sp.bx + sp.w / 2, cy = sp.by + sp.h / 2;
    for (let y = Math.floor(cy - 8); y <= cy + 8; y++) for (let x = Math.floor(cx - 8); x <= cx + 8; x++) {
      if (!inb(x, y) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > 7.5) continue;
      c.fillStyle = tutFree(idx(x, y)) ? 'rgba(120,230,90,0.24)' : 'rgba(235,60,40,0.38)';
      c.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    }
    c.fillStyle = `rgba(150,255,110,${0.25 + 0.2 * pulse})`;
    c.fillRect(sp.bx * TILE, sp.by * TILE, sp.w * TILE, sp.h * TILE);
    c.lineWidth = 2 + pulse; c.strokeStyle = '#d8ff9a';
    c.strokeRect(sp.bx * TILE + 1, sp.by * TILE + 1, sp.w * TILE - 2, sp.h * TILE - 2);
    c.fillStyle = '#f6d458';
    c.fillRect(sp.door[0] * TILE + 4, sp.door[1] * TILE + 4, TILE - 8, TILE - 8);   // сюда смотрит вход
  }
  if (f.plan && f.plan.need.length) {
    const need = f.plan.need;
    c.fillStyle = `rgba(246,212,88,${0.3 + 0.25 * pulse})`;
    for (const i of need) c.fillRect((i % MAP_W) * TILE + 2, ((i / MAP_W) | 0) * TILE + 2, TILE - 4, TILE - 4);
    const lab = (i, txt) => {
      const x = (i % MAP_W + 0.5) * TILE, y = (((i / MAP_W) | 0) + 0.5) * TILE;
      c.fillStyle = '#160e0a'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#f6d458'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#f6d458'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 0.5);
    };
    lab(need[0], 'А');
    if (need.length > 1) lab(need[need.length - 1], 'Б');
  }
  if (f.ring) {
    const b = f.ring;
    c.lineWidth = 2 + pulse; c.strokeStyle = `rgba(246,212,88,${0.6 + 0.4 * pulse})`;
    c.strokeRect(b.x * TILE - 2, b.y * TILE - 2, b.w * TILE + 4, b.h * TILE + 4);
  }
  if (f.mark) {   // где сейчас герой
    const [x, y] = f.mark;
    c.strokeStyle = `rgba(246,212,88,${0.6 + 0.4 * pulse})`; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x * TILE, y * TILE + 2, 12, 6, 0, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}

// ждём, пока игрок выйдет из стартового меню и назовёт героя: ни меню, ни окно имени не должны прятать обучение
// (notify.js подменяет эту функцию: обучение — последний шаг входа в игру)
function tutWhenFree(ready) {
  const menu = document.getElementById('loading');
  const busy = document.getElementById('hero-name') || (menu && !menu.classList.contains('hidden'));
  if (busy) setTimeout(tutWhenFree, 400);
  else if (ready) tutStart();
  else setTimeout(() => tutWhenFree(true), 800);   // окно имени появляется чуть позже меню — ещё раз проверяем
}

function initTutorial() {
  setInterval(tutTick, 300);
  let seen = false;
  try { seen = localStorage.getItem('oldgold-tut') === 'done'; } catch (e) { /* нет хранилища */ }
  if (!seen) tutWhenFree(); else track('tut-seen-before', 'Обучение не показано (уже проходил)');
}
