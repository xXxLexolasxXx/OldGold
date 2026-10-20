'use strict';
// Поход к Чёрному шпилю (поздняя игра, глава 6 сценария; ВРАГ.md, СЮЖЕТ.md).
// Шпиль и бой с Малгором живут в enemy.js; здесь — то, чего не хватало, чтобы до босса можно было дойти:
//   • тап по башне — «К Чёрному шпилю» (раньше основание башни отвечало «Сюда не пройти»);
//   • тропа: если путь от деревни к подножию перекрыт скалами или камнями — прорубается проход;
//     если перекрыт стенами/зданиями игрока или водой — причина пишется в чек-листе;
//   • чек-лист «что нужно, чтобы идти» в панели целей (герой, уровень, отряд, здоровье, провиант, путь),
//     кнопки «Выступить в поход», «В бой» и «Показать шпиль»;
//   • поход: отряд идёт за героем, провиант со склада, привал у подножия лечит отряд;
//   • указатель-компас на шпиль (значок в углу, сворачивается; глава 6 или шпиль уже найден).
// Кооператив: приказы уходят тем же путём, что и обычный тап (coopSend 'go' / отряд 'squad'),
// тропу и привал считает сервер.

const SPIRE_LVL = 5;          // рекомендуемый уровень героя
const SPIRE_SQUAD = 2;        // рекомендуемый отряд (рекруты гильдий и напарники героя)
const SPIRE_FOOD = 10;        // провиант на поход: столько еды берут со склада
const SPIRE_CAMP = 14;        // привал — в стольких клетках от Малгора (дальше, чем он замечает)

const Spire = { prep: null, prepT: -9, path: null, pathT: -99, ui: null };

const spireHome = F => [Math.floor(F.tx + 1.5), F.ty + 4];      // перед дверью, где стоит Малгор
const spireBoss = () => Game.raiders && Game.raiders.find(N => N.k === 'malgor' && N.st !== 'die' && N.st !== 'vanish') || null;
const spireOn = () => { const F = Game.foe; return !!F && !F.defeated; };
// показывать ли подсказки похода: глава 6 сценария, или шпиль уже найден
function spireActive() {
  if (!spireOn()) return false;
  const g = Game.goal;
  if (g && g.mode === 'scenario' && typeof GOAL_CHAPTERS !== 'undefined' && g.ch === GOAL_CHAPTERS.length - 1) return true;
  return !!Game.foe.known;
}
// клетка — часть рисунка башни (основание 3×2 и сам шпиль над ним)
function spireTileIn(x, y) {
  const F = Game.foe;
  return !!F && x >= F.tx - 1 && x <= F.tx + 3 && y >= F.ty - 8 && y <= F.ty + 1;
}
function spireVillage() {
  const st = Game.buildings.find(b => b.isStore && b.isStore()) || Game.buildings.find(b => b.type === 'storehouse');
  if (st) return [st.doorX, st.doorY + 1];
  return [MAP_W >> 1, MAP_H >> 1];
}
function spireNearWalk(x, y) {
  if (isWalkable(x, y)) return [x, y];
  return randomFreeNear(x, y, 1, 3, (a, b) => isWalkable(a, b)) || null;
}

// ---------- Тропа ----------

// Можно ли прорубить клетку: скала (не своя шахта), камень-валун, блок-декор. Стены игрока, здания и вода — нет.
function spireCarvable(i) {
  const t = World.terrain[i];
  if (t === T_WATER || World.bmap[i]) return false;
  const o = World.obj[i];
  if (o && o.t === 'fort') return false;
  return true;
}
// Дейкстра по клеткам: свободная — 1, скала/валун — 6. Возвращает список клеток или null.
function spireCarvePath(sx, sy, tx, ty) {
  const W = MAP_W, N = N_TILES, dist = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1);
  const s = idx(sx, sy), t = idx(tx, ty);
  const heap = [[0, s]];
  dist[s] = 0;
  const push = (d, i) => { heap.push([d, i]); let n = heap.length - 1; while (n > 0) { const p = (n - 1) >> 1; if (heap[p][0] <= d) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } } return top; };
  heap.length = 0; push(0, s);
  while (heap.length) {
    const [d, c] = pop();
    if (d > dist[c]) continue;
    if (c === t) break;
    const cx = c % W;
    for (const [dx, nb] of [[1, c + 1], [-1, c - 1], [0, c + W], [0, c - W]]) {
      if (nb < 0 || nb >= N || (dx === 1 && cx + 1 >= W) || (dx === -1 && cx === 0)) continue;
      if (nb !== t && !spireCarvable(nb)) continue;
      const nd = d + (walkIdx(nb) ? 1 : 6);
      if (nd < dist[nb]) { dist[nb] = nd; from[nb] = c; push(nd, nb); }
    }
  }
  if (dist[t] >= 1e9) return null;
  const out = [];
  for (let c = t; c !== -1 && c !== s; c = from[c]) out.push(c);
  return out.reverse();
}
// Проверить путь от (sx, sy) к шпилю; если перекрыт скалами — прорубить. Только на симуляции.
// Возвращает { ok, carved, why }.
function spireEnsureRoute(sx, sy) {
  const F = Game.foe;
  if (!F) return { ok: false, why: 'шпиля нет на этой карте' };
  const h = spireNearWalk(...spireHome(F));
  if (!h) return { ok: false, why: 'подножие шпиля завалено' };
  const st = spireNearWalk(sx, sy) || [sx, sy];
  if (findPath(st[0], st[1], h[0], h[1])) return { ok: true, carved: 0 };
  const cells = spireCarvePath(st[0], st[1], h[0], h[1]);
  if (!cells) {
    // почему: вода или постройки
    const p2 = spireCarvePathLoose(st[0], st[1], h[0], h[1]);
    return { ok: false, why: p2 ? 'путь перекрыт стенами или зданиями — оставьте проход' : 'шпиль за водой — пути нет' };
  }
  let rock = 0, n = 0;
  for (const i of cells) {
    if (walkIdx(i)) continue;
    n++;
    if (World.terrain[i] === T_ROCK) {
      World.terrain[i] = T_GRASS; World.crystal[i] = 0; rock++;
      if (typeof ROCKMINE !== 'undefined') ROCKMINE.mined.add(i);
    }
    const o = World.obj[i];
    if (o) { World.obj[i] = null; World.growing.delete(i); }
  }
  if (rock && typeof buildMountains === 'function') buildMountains(Game.seed);
  PF.regT = -1e9;
  if (n) logEvent('night', `К Чёрному шпилю прорублена тропа (${n} кл. завалов)`, F.tx + 1.5, F.ty + 3);
  return { ok: !!findPath(st[0], st[1], h[0], h[1]), carved: n };
}
// для объяснения причины: путь существует, если не считать зданий и стен (только вода — тупик)
function spireCarvePathLoose(sx, sy, tx, ty) {
  const W = MAP_W, N = N_TILES, seen = new Uint8Array(N), q = [idx(sx, sy)], t = idx(tx, ty);
  seen[q[0]] = 1;
  for (let k = 0; k < q.length; k++) {
    const c = q[k];
    if (c === t) return true;
    const cx = c % W;
    for (const [dx, nb] of [[1, c + 1], [-1, c - 1], [0, c + W], [0, c - W]]) {
      if (nb < 0 || nb >= N || (dx === 1 && cx + 1 >= W) || (dx === -1 && cx === 0) || seen[nb]) continue;
      if (World.terrain[nb] === T_WATER) continue;
      seen[nb] = 1; q.push(nb);
    }
  }
  return false;
}

// ---------- Подготовка (чек-лист) ----------

function spireSquad(h) {
  if (!h) return 0;
  let n = 0;
  for (const u of Game.units) {
    if (u.dead || u === h) continue;
    if (u.rec && !(u.rec.train > 0)) n++;
    else if (u.teamOf === h.id) n++;
  }
  return n;
}
function spireFoodStock() {
  let n = 0;
  for (const b of Game.buildings) if (b.isStore && b.isStore()) n += Math.max(0, b.offer('bread')) + Math.max(0, b.offer('sausage'));
  return n;
}
function spireRouteState(h) {
  if (Game.time - Spire.pathT < 3 && Spire.path) return Spire.path;
  Spire.pathT = Game.time;
  const F = Game.foe, home = spireNearWalk(...spireHome(F));
  const from = h && !h.dead ? [Math.floor(h.x), Math.floor(h.y)] : spireVillage();
  const st = spireNearWalk(from[0], from[1]) || from;
  let p = home ? findPath(st[0], st[1], home[0], home[1]) : null;
  Spire.path = { ok: !!p, len: p ? p.length : 0, camp: null, why: '' };
  if (p) {
    // привал: первая клетка пути ближе SPIRE_CAMP к Малгору
    const hx = F.tx + 1.5, hy = F.ty + 3.2;
    let camp = p[p.length - 1];
    for (const c of p) if (Math.hypot(c[0] - hx, c[1] - hy) < SPIRE_CAMP) { camp = c; break; }
    Spire.path.camp = camp;
  } else Spire.path.why = Game.spireWhy || 'путь перекрыт — нажмите «Выступить», гномы попробуют прорубить тропу';
  return Spire.path;
}
function spirePrep() {
  const F = Game.foe, h = Game.hero;
  const H = h && h.hero;
  const alive = !!(h && !h.dead && H && !(H.downT > Game.time) && (H.hp == null || H.hp > 0));
  const lvl = H ? H.level || 1 : 0, sq = spireSquad(h);
  const hpOk = !H || !H.maxhp || H.hp >= H.maxhp * 0.7;
  const coop = typeof isMirror === 'function' && isMirror();
  const food = coop ? null : spireFoodStock();
  const R = spireRouteState(h);
  const items = [
    { t: alive ? 'Герой в строю' : 'Герой в строю (сейчас без сил — очнётся у костра)', ok: alive, must: true },
    { t: `Герой ${SPIRE_LVL}+ уровня (сейчас ${lvl})`, ok: lvl >= SPIRE_LVL },
    { t: `Отряд: ${SPIRE_SQUAD}+ бойца (рекруты гильдий, напарники) — сейчас ${sq}`, ok: sq >= SPIRE_SQUAD },
    { t: 'Здоровье героя 70%+', ok: hpOk },
  ];
  if (!coop) items.push({ t: `Провиант: ${SPIRE_FOOD} хлеба или колбасы на складе (есть ${Math.floor(food)})`, ok: food >= SPIRE_FOOD });
  items.push({ t: R.ok ? `Путь до шпиля открыт (${R.len} кл.)` : 'Путь: ' + R.why, ok: R.ok, must: true });
  const boss = spireBoss();
  const near = !!(h && boss && Math.hypot(h.x - F.tx - 1.5, h.y - F.ty - 3) < SPIRE_CAMP + 4);
  return { items, ready: items.every(i => i.ok), can: alive, near, boss: boss ? { hp: Math.round(boss.hp), mhp: boss.mhp, fz: boss.fz || boss.phase || 1, shield: !!boss.shield } : null, going: !!Game.spireGo };
}

// ---------- Приказы ----------

function spireShow() {
  const F = Game.foe;
  if (!F || typeof centerOn !== 'function') return;
  F.known = true;
  centerOn((F.tx + 1.5) * TILE, (F.ty - 1) * TILE);
  if (typeof spirePtrFull === 'function') spirePtrFull();
}

// поход: отряд за героем, провиант, герой идёт на привал у подножия
function spireGo() {
  const F = Game.foe, h = Game.hero;
  if (!F || F.defeated) return;
  if (!h || h.dead || !h.hero) { toast('Без героя к Малгору не пойдёшь: нужен живой герой'); return; }
  const H = h.hero;
  if (H.downT > Game.time || H.hp <= 0) { toast(`${H.name} без сил: очнётся у костра, тогда и в поход`); return; }
  const coop = typeof isMirror === 'function' && isMirror();
  if (!coop) {
    const r = spireEnsureRoute(Math.floor(h.x), Math.floor(h.y));
    Game.spireWhy = r.ok ? '' : r.why;
    Spire.pathT = -99;
    if (!r.ok) { toast('К шпилю не пройти: ' + r.why); return; }
    if (r.carved) toast(`Гномы прорубили тропу к шпилю через завалы (${r.carved} кл.)`);
  }
  const R = spireRouteState(h);
  if (!R.ok || !R.camp) { toast('К шпилю не пройти: ' + (R.why || 'нет пути')); return; }
  // отряд
  if (typeof heroAbility === 'function' && spireSquad(h) > 0) heroAbility('g_follow');
  // провиант
  if (!coop) {
    let need = SPIRE_FOOD, got = 0;
    for (const g of ['bread', 'sausage']) for (const b of Game.buildings) {
      if (!need || !(b.isStore && b.isStore())) continue;
      const t = Math.min(need, Math.max(0, Math.floor(b.offer(g))));
      if (t > 0) { b.stock[g] -= t; need -= t; got += t; }
    }
    Game.spireGo = { prov: got, t: Game.time };
    toast(got >= SPIRE_FOOD ? `Поход к Чёрному шпилю! Провиант взят (${got}). Привал — у подножия.` : `Поход к Чёрному шпилю! Провианта мало (${got}/${SPIRE_FOOD}) — привал вылечит не до конца.`);
  } else { Game.spireGo = { prov: SPIRE_FOOD, t: Game.time }; toast('Поход к Чёрному шпилю! Отряд идёт за героем.'); }
  F.known = true;
  issueCmd(h, { kind: 'move', x: R.camp[0], y: R.camp[1], tx: R.camp[0], ty: R.camp[1], label: 'Поход к Чёрному шпилю' });
  logEvent('night', `${H.name} выступил в поход к Чёрному шпилю`, h.x, h.y);
}

// в бой: напасть на Малгора (с привала или откуда угодно)
function spireFight() {
  const h = Game.hero, N = spireBoss();
  if (!h || h.dead || !N) return;
  issueCmd(h, { kind: 'attack', f: { kind: 'foe', o: N }, tx: Math.floor(N.x), ty: Math.floor(N.y), label: 'Бой с Малгором' });
}

// привал у подножия: отряд подкрепился (на симуляции; в коопе — по героям игроков у шпиля)
function spireCampTick() {
  const F = Game.foe;
  if (!F || F.defeated) { Game.spireGo = null; return; }
  const G = Game.spireGo;
  for (const h of Game.units) {
    if (!h.hero || h.dead || h._spireCamp === F.tx * 1000 + F.ty) continue;
    if (Math.hypot(h.x - F.tx - 1.5, h.y - F.ty - 3.2) > SPIRE_CAMP + 2.5) continue;
    if (h === Game.hero && !G && !(typeof isServerSim === 'function' && isServerSim())) continue;   // пришёл сам, без похода — без привала
    h._spireCamp = F.tx * 1000 + F.ty;
    const full = !G || G.prov >= SPIRE_FOOD;
    const H = h.hero;
    if (H.maxhp) H.hp = Math.max(H.hp, full ? H.maxhp : Math.min(H.maxhp, H.hp + H.maxhp * 0.3));
    if (full) h.food = Math.max(h.food || 0, 1);
    for (const u of Game.units) if (u.rec && !u.dead && Math.hypot(u.x - h.x, u.y - h.y) < 10) u.rec.hp = 30 + 8 * u.rec.lvl;
    floater(h.x, h.y - 2, full ? 'Привал: отряд сыт и готов!' : 'Привал: перекусили чем было', '#ffe070');
    toast(`Привал у подножия Чёрного шпиля. ${full ? 'Отряд подкрепился и залечил раны.' : 'Провианта мало — подлечились чуть-чуть.'} Жмите «В бой с Малгором!»`);
  }
}

// ---------- Подключение ----------

{
  // тап по башне — бой с Малгором (герой сам дойдёт до подножия); шпиль погас — просто подойти
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const F = Game.foe;
    if (F && inb(t[0], t[1]) && spireTileIn(t[0], t[1])) {
      const N = spireBoss();
      if (N) return { kind: 'attack', f: { kind: 'foe', o: N }, tx: Math.floor(N.x), ty: Math.floor(N.y), label: 'Бой с Малгором' };
      const p = spireNearWalk(...spireHome(F));
      if (p) return { kind: 'move', x: p[0], y: p[1], tx: p[0], ty: p[1], label: F.defeated ? 'К погасшему шпилю' : 'К Чёрному шпилю' };
    }
    return _rc(t);
  };
  // глава 6: тропа к шпилю проверяется заранее
  if (typeof enemyOnChapter === 'function') {
    const _eoc = enemyOnChapter;
    enemyOnChapter = function (n) {
      _eoc(n);
      if (n >= 6 && Game.foe && !Game.foe.defeated && !(typeof isMirror === 'function' && isMirror())) {
        const v = spireVillage(), r = spireEnsureRoute(v[0], v[1]);
        Game.spireWhy = r.ok ? '' : r.why;
      }
    };
  }
  const _step = step;
  step = function (dt) {
    _step(dt);
    if (typeof isMirror === 'function' && isMirror()) return;
    Spire.tk = (Spire.tk || 0) + dt;
    if (Spire.tk < 0.5) return;
    Spire.tk = 0;
    spireCampTick();
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.spireGo = null; Game.spireWhy = ''; Spire.path = null; Spire.pathT = -99; };
}

// ---------- Панель целей: чек-лист главы 6 ----------

const spEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function spirePrepHTML() {
  if (!spireActive() || typeof document === 'undefined') return '';
  if (Game.time - Spire.prepT > 1 || !Spire.prep) { Spire.prep = spirePrep(); Spire.prepT = Game.time; }
  const P = Spire.prep, PH = ['', 'I. Призыв: бейте прислужников', 'II. Зелёный огонь: сначала рыцарь-страж (щит)', 'III. Ярость: держитесь вместе'];
  let x = '<div class="gh-sub">Поход к Чёрному шпилю</div>';
  if (P.boss && P.near) {
    const pc = Math.max(0, Math.round(100 * P.boss.hp / P.boss.mhp));
    x += `<div class="sp-boss"><div class="sp-bar"><i style="width:${pc}%"></i></div><span>Малгор ${P.boss.hp}/${P.boss.mhp} · ${spEsc(PH[P.boss.fz] || '')}${P.boss.shield ? ' · щит!' : ''}</span></div>`;
  } else {
    x += '<ul class="small sp-list">' + P.items.map(i => `<li class="${i.ok ? 'ok' : i.must ? 'bad' : ''}"><span>${i.ok ? '✔' : i.must ? '✖' : '○'} ${spEsc(i.t)}</span></li>`).join('') + '</ul>';
    x += `<div class="gh-hint">${P.ready ? 'Всё готово — можно выступать.' : P.can ? 'Идти можно и так, но ○ — это риск: Малгор бьёт сильно, а поражение — возврат к костру.' : 'Сейчас не выйти: смотрите ✖.'}</div>`;
  }
  x += '<div class="sp-btns">';
  if (P.boss && P.near) x += '<button data-sp="fight" class="primary">В бой с Малгором!</button>';
  else x += `<button data-sp="go" class="primary"${P.can ? '' : ' disabled'}>${P.going ? 'Снова в поход ▸' : 'Выступить в поход ▸'}</button>`;
  x += '<button data-sp="show">Показать шпиль</button></div>';
  return x;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('[data-sp]');
    if (!b) return;
    e.stopPropagation();
    const a = b.dataset.sp;
    if (a === 'go') spireGo(); else if (a === 'fight') spireFight(); else if (a === 'show') spireShow();
    Spire.prepT = -9;
  }, true);
}

// ---------- Компас: указатель на шпиль (DOM-значок, а не рисунок на карте) ----------
// Три вида: «крупно» (у края экрана по направлению к шпилю — первые секунды главы и по запросу), «компакт» (маленький
// полупрозрачный значок в свободном углу, по умолчанию) и «свёрнут» (крошечный компас; тап по значку сворачивает и разворачивает).
// Совсем скрыт: настройка «Указатель шпиля» (меню), шпиль в кадре, герой рядом с ним или идёт к нему, Малгор побеждён.

const SPTR_NEAR = 34;         // герой ближе этого (кл.) к шпилю — указатель не нужен
const SPTR_FULL = 9;          // сколько секунд показывать крупно
const SPtr = { el: null, fullUntil: 0, spot: null, spotT: -9 };

function spireSetting() { try { return localStorage.getItem('feod.spirePtr') !== '0'; } catch (e) { return true; } }
function spireSetSetting(on) {
  try { localStorage.setItem('feod.spirePtr', on ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  spirePtrMenuSync();
  if (typeof toast === 'function') toast(on ? 'Указатель шпиля включён' : 'Указатель шпиля скрыт. Вернуть — в меню, «Настройки».');
}
function spireFolded() {
  const g = Game.goal;
  if (g && g.ptr && g.ptr.fold != null) return !!g.ptr.fold;
  try { return localStorage.getItem('feod.spireFold') === '1'; } catch (e) { return false; }
}
function spireSetFold(f) {
  const g = Game.goal;
  if (g) (g.ptr || (g.ptr = {})).fold = f ? 1 : 0;
  try { localStorage.setItem('feod.spireFold', f ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  SPtr.fullUntil = 0;
}
// «по запросу»: показать крупно (кнопка «Показать шпиль»)
function spirePtrFull() {
  SPtr.fullUntil = performance.now() + SPTR_FULL * 1000;
  const g = Game.goal;
  if (g && g.ptr) g.ptr.fold = 0;
}
// герой у шпиля или идёт к нему
function spireHeroNear() {
  const F = Game.foe, h = Game.hero;
  if (!F || !h || h.dead) return false;
  const cx = F.tx + 1.5, cy = F.ty + 3;
  if (Math.hypot(h.x - cx, h.y - cy) < SPTR_NEAR) return true;
  const c = h.cmd;
  if (!c) return false;
  if (c.kind === 'attack' && c.f && c.f.kind === 'foe') return true;
  return c.tx != null && Math.hypot(c.tx - cx, c.ty - cy) < SPTR_NEAR;
}
const spirePtrShow = () => spireActive() && spireSetting() && !spireHeroNear();

const SPTR_SVG = '<svg viewBox="-12 -12 24 24" aria-hidden="true"><g class="sp-rot"><path d="M10 0 L-6 -7 L-2.5 0 L-6 7 Z" fill="#9cff66"/></g></svg>';
function spirePtrEl() {
  if (SPtr.el) return SPtr.el;
  const e = document.createElement('div');
  e.id = 'spire-ptr'; e.className = 'hidden';
  e.innerHTML = SPTR_SVG + '<span class="sp-lab"></span><b class="sp-x">✕</b>';
  e.addEventListener('click', ev => {
    ev.stopPropagation();
    spireSetFold(e.classList.contains('full') ? true : !spireFolded());
  });
  for (const t of ['mousedown', 'touchstart', 'pointerdown', 'wheel']) e.addEventListener(t, ev => ev.stopPropagation(), { passive: true });
  (document.getElementById('view') || document.body).appendChild(e);
  return (SPtr.el = e);
}
// свободный угол: первый из кандидатов, где под значком нет ничего, кроме карты
function spirePtrSpot(e, sz) {
  const v = document.getElementById('view');
  if (!v) return null;
  const r = v.getBoundingClientRect(), m = 8, tb = document.getElementById('topbar');
  const top = (tb ? tb.getBoundingClientRect().bottom : r.top) + 6;
  const bot = r.bottom - (document.body.classList.contains('mobile') ? 70 : 14) - sz;
  const L = r.left + m, Rr = r.right - m - sz, mid = (top + bot) / 2;
  const cand = [[L, bot], [Rr, bot], [L, top], [Rr, top], [L, mid], [Rr, mid], [L, (top + mid) / 2], [Rr, (top + mid) / 2], [L, (bot + mid) / 2], [Rr, (bot + mid) / 2]];
  const keep = SPtr.spot;
  if (keep) cand.unshift(keep);
  const cv = document.getElementById('game');
  const free = (x, y) => {
    for (const [px, py] of [[x, y], [x + sz, y], [x, y + sz], [x + sz, y + sz], [x + sz / 2, y + sz / 2], [x + sz + 6, y + sz / 2], [x - 6, y + sz / 2]]) {
      if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
      for (const o of document.elementsFromPoint(px, py)) {
        if (o === e || e.contains(o) || o.contains(v) || o === cv || o === v || o === document.body || o === document.documentElement || o.id === 'vignette' || o.id === 'toasts') continue;
        return false;
      }
    }
    return true;
  };
  for (const [x, y] of cand) if (free(x, y)) return [x, y];
  return keep || cand[1];
}
function spirePtrUpdate() {
  if (typeof document === 'undefined' || typeof R === 'undefined' || !R.canvas) return;
  const e = spirePtrEl(), g = Game.goal;
  if (!spirePtrShow()) { e.classList.add('hidden'); return; }
  // первое появление главы — крупно, один раз за сохранение
  if (g && !(g.ptr && g.ptr.seen)) {
    const p = g.ptr || (g.ptr = {});
    p.seen = 1;
    if (!spireFolded()) SPtr.fullUntil = performance.now() + SPTR_FULL * 1000;
  }
  const F = Game.foe, z = devScale(), cw = R.canvas.width, ch = R.canvas.height, dpr = cw / (R.canvas.clientWidth || cw);
  const sx = ((F.tx + 1.5) * TILE - R.cam.x) * z, sy = ((F.ty - 1) * TILE - R.cam.y) * z;
  if (sx > 0 && sx < cw && sy > 0 && sy < ch) { e.classList.add('hidden'); return; }     // шпиль в кадре
  const now = performance.now(), full = now < SPtr.fullUntil, fold = !full && spireFolded();
  const cx = cw / 2, cy = ch / 2, dx = sx - cx, dy = sy - cy, ang = Math.atan2(dy, dx);
  const h = Game.hero, dist = h ? Math.round(Math.hypot(h.x - F.tx - 1.5, h.y - F.ty - 3)) : 0;
  const mode = full ? 'full' : fold ? 'fold' : 'compact';
  if (e.dataset.mode !== mode) { e.dataset.mode = mode; e.classList.toggle('full', full); e.classList.toggle('fold', fold); SPtr.spotT = -9; }
  e.classList.remove('hidden');
  const lab = e.querySelector('.sp-lab'), t = full ? 'Чёрный шпиль · ' + dist + ' кл.' : dist + '';
  if (lab.textContent !== t) lab.textContent = t;
  e.title = fold ? 'Указатель на Чёрный шпиль — тап, чтобы развернуть' : 'Чёрный шпиль — тап, чтобы свернуть';
  e.querySelector('.sp-rot').setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(1)})`);
  const vr = (document.getElementById('view') || document.body).getBoundingClientRect();
  if (full) {                                   // у края карты, в сторону шпиля
    const w = e.offsetWidth, hgt = e.offsetHeight, tb = document.getElementById('topbar'), mob = document.body.classList.contains('mobile');
    const x0 = document.body.classList.contains('land') ? 54 : 8, x1 = vr.width - 8 - w;
    const y0 = (tb ? Math.max(0, tb.getBoundingClientRect().bottom - vr.top) : 0) + 6, y1 = vr.height - (mob ? 78 : 14) - hgt;
    const hw = (x1 - x0) / 2, hh = (y1 - y0) / 2, k = Math.min(hw / Math.abs(dx / dpr || 1e-6), hh / Math.abs(dy / dpr || 1e-6));
    e.style.left = Math.round((x0 + x1) / 2 + dx / dpr * k) + 'px';
    e.style.top = Math.round((y0 + y1) / 2 + dy / dpr * k) + 'px';
  } else {
    if (now - SPtr.spotT > 600) { SPtr.spot = spirePtrSpot(e, Math.max(e.offsetWidth, e.offsetHeight, 30)); SPtr.spotT = now; }
    if (SPtr.spot) { e.style.left = Math.round(SPtr.spot[0] - vr.left) + 'px'; e.style.top = Math.round(SPtr.spot[1] - vr.top) + 'px'; }
  }
}
{
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    try { spirePtrUpdate(); } catch (e) { if (!spirePtrUpdate.err) { spirePtrUpdate.err = 1; console.error(e); } }
  };
}

// настройка в меню («Настройки»)
function spirePtrMenuSync() {
  const b = typeof document !== 'undefined' && document.getElementById('spireptr-btn');
  if (b) b.querySelector('span').textContent = 'Указатель шпиля: ' + (spireSetting() ? 'показывать' : 'скрывать');
}
{
  const _s = startGame;
  startGame = function () {
    _s();
    const list = document.querySelector('#tab-menu .menu-list');
    if (list && !document.getElementById('spireptr-btn')) {
      const b = document.createElement('button');
      b.id = 'spireptr-btn'; b.title = 'Стрелка-компас к Чёрному шпилю в поздней игре: показывать или скрывать совсем';
      b.innerHTML = '<span></span>';
      b.onclick = () => spireSetSetting(!spireSetting());
      const eco = document.getElementById('eco-btn');
      (eco && eco.parentElement === list ? eco : list.firstChild).insertAdjacentElement(eco ? 'afterend' : 'beforebegin', b);
      spirePtrMenuSync();
    }
  };
}

// миникарта: на главе 6 шпиль мигает кольцом, чтобы его нельзя было не заметить
{
  const _dm = drawMinimapUnits;
  drawMinimapUnits = function () {
    _dm();
    if (!spireActive() || typeof MINI === 'undefined' || !MINI.ctx) return;
    const F = Game.foe, c = MINI.ctx, cv = MINI.canvas, kx = cv.width / MAP_W, ky = cv.height / MAP_H;
    const fac = cv.width / Math.max(60, cv.clientWidth || cv.width), r = (5 + 2 * Math.sin(performance.now() / 300)) * Math.max(1, fac);
    c.save();
    c.strokeStyle = '#b07cff'; c.lineWidth = Math.max(1.2, fac);
    c.beginPath(); c.arc((F.tx + 1.5) * kx, (F.ty + 1) * ky, r, 0, Math.PI * 2); c.stroke();
    c.restore();
  };
}
