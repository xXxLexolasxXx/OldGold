'use strict';
// Арена PvP — офлайн-клиент (АРЕНА.md, этап 2): «Арена: тренировка с ботом».
// Экран арены (выбор класса и бота), бой с ботом на ядре arenasim.js, HUD, ввод ПК и телефона, итог с реваншем.
// Входы: кнопка «Арена» в Таверне отряда, вкладка «Арена» зала героев, пункт «Арена» в главном меню.
// Рейтинг, очередь и вызов друга — этап 3 (сервер), здесь показаны как «скоро».
// Игрок на арене — арена-копия героя 13 уровня (раздел 5): числа класса из ARENA_TUNE, облик — свой.
// Ядро шагает ровно 20 раз в секунду (как будет на сервере), рисование — каждый кадр с плавным переходом между шагами.

const Arena = { on: false, el: null, cv: null, S: null, prev: null, acc: 0, raf: 0, last: 0, keys: {}, joy: null, cast: -1, roll: 0,
  from: '', cls: 'warrior', tier: 2, foe: '', pops: [], fx: [], fans: [], walk: [0, 0], holders: [{}, {}], burst: [null, null],
  mi: 0, net: null, pot: -1, prevPot: -1, ct: 0, scr: 'lobby', hudT: 0, endT: 0, surT: 0, prevSpeed: 1, touch: false, brumT: 0, mood: '', look: null, seenOver: false };
const AR_LS = 'og_arena';
const AR_TIERS = [null, { name: 'Соломенный страж', info: 'Ходит и бьёт. Перекатываться не умеет — учитесь на нём.' },
  { name: 'Старый ветеран арены', info: 'Держит дистанцию, иногда уходит от тяжёлых ударов.' },
  { name: 'Каменный чемпион', info: 'Читает замахи, бережёт силы, сбивает ульты. Без шуток.' }];

// ---------- Реплики Брюма (в манере лиг: смешно и чуть обидно) ----------
const AR_BRUM = {
  lobby: ['Выбирай класс и соперника. Остальное я прокомментирую — громко и несправедливо.', 'Хочешь рейтинг — зови живого соперника. Чучела рейтинг не дают, зато и не обижаются.',
    'Любой класс, любое чучело. В деревне так не дадут — там надо учиться. Тут — только падать.', 'Лига Опилок ждёт вас. Не обижайтесь: из опилок тоже что-то делают. Например, опилки.'],
  intro: ['Дамы и гномы! Слева — {0}, справа — {1}. Ставки не принимаются: денег у вас всё равно нет.', 'На песке {0} против {1}. Песок, кстати, тоже участвует. Он всегда побеждает.',
    'Встречайте: {0}! И {1}, которого мы встречаем из вежливости.', 'Арена открыта! Трибуны полны. Ну, почти. Ну, кто-то есть. {0} против {1}!'],
  bot: [null, 'Соломенный страж. Он не сдаётся, потому что не умеет.', 'Старый ветеран арены. Видел сотни героев и ни одного хорошего.', 'Каменный чемпион. Без шуток: он правда каменный.'],
  go: ['Бой!', 'Начали! Кто первый упадёт — тот и проиграл. Сложная наука.', 'Гонг! Бороды вперёд!'],
  ult: ['Ульта! Трибуны проснулись!', 'Это было громко. Даже я проснулся.', 'Вот это я понимаю — ульта. Бабушка бы гордилась. Или испугалась.'],
  perfect: ['Идеальный уворот! Красиво. Бесполезно, но красиво.', 'Увернулся! Песок аплодирует.', 'Перекат в последний миг! Так и задумывалось. Наверное.'],
  ot: ['Песок горит! Борт сужается — прятаться больше негде.', 'Овертайм! Кто стоит у борта — тот жарится.'],
  round: ['Раунд за {0}! {1}, не расстраивайтесь, это просто песок.', '{0} забирает раунд. Аплодисменты! Можно жиденькие.', 'Раунд — {0}! {1}, вставай, песок не кровать.'],
  time: ['По таймеру! Здоровья больше — значит, прав. Так в жизни не работает, а тут работает.'],
  win: ['{0} побеждает! {1} получает Позорный горшок. Носить с гордостью.', 'Победа {0}! Горшок — проигравшему, слава — победителю, песок — всем.'],
  dry: ['Сухая победа! {1}, это было… быстро.'],
  sur: ['Сдался! Мудро. Или трусливо. Летописцы разберутся.'],
  rematch: ['Реванш! Публика любит повторы. Особенно чужие поражения.', 'Ещё раз! Горшок на голове — не повод сдаваться.'],
  boo: ['Мимо, мимо и ещё раз мимо. Трибуны свистят — им можно.'],
};
const arPick = (L, ...a) => { const s = L[(Math.random() * L.length) | 0]; return a.length ? t(s, ...a) : t(s); };
const arEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arName = i => (Arena.net ? Arena.net.nm[i] : i === Arena.mi ? arMyName() : t(AR_TIERS[Arena.tier].name));
const arClsName = k => t(typeof GCLS !== 'undefined' && GCLS[k] ? GCLS[k].name : k);
const arClsCol = k => (typeof GCLS !== 'undefined' && GCLS[k] ? GCLS[k].col : '#e8dcc0');

function arLoad() {
  try { const o = JSON.parse(localStorage.getItem(AR_LS)); if (o && ARENA_KIT[o.cls]) Arena.cls = o.cls; if (o && o.tier >= 1 && o.tier <= 3) Arena.tier = o.tier; } catch (e) { /* нет хранилища */ }
  if (!Arena.clsSet) { const H = typeof Game !== 'undefined' && Game.hero && Game.hero.hero; if (H && ARENA_KIT[H.clsKey]) Arena.cls = H.clsKey; }
}
function arSave() { try { localStorage.setItem(AR_LS, JSON.stringify({ cls: Arena.cls, tier: Arena.tier })); } catch (e) { /* нет хранилища */ } }
// облик своего героя (если есть): та же внешность на арене
function arMyLook(cls) {
  const h = typeof Game !== 'undefined' && Game.hero, H = h && h.hero, base = 'hero_' + cls;
  const ap = H && typeof haClean === 'function' ? haClean(H.app) : null;
  if (h && ap && typeof haType === 'function') return { type: haType(base, ap), look: h.look, sx: ap[10] === 1 ? 'f' : '', carry: null };
  return { type: OUTFIT[base] ? base : 'hero', look: h ? h.look : 7, sx: '', carry: null };
}
function arMyName() { const H = typeof Game !== 'undefined' && Game.hero && Game.hero.hero; return (H && H.name) || t('Вы'); }

// ---------- Открыть / закрыть ----------
function arenaOpen(from) {
  if (Arena.on) return;
  Arena.on = true; Arena.from = from || '';
  arLoad();
  try { Arena.prevSpeed = Game.speed || 1; if (typeof setSpeed === 'function' && !(typeof StartMenu !== 'undefined' && StartMenu.open)) setSpeed(0); } catch (e) { /* без паузы */ }
  Arena.touch = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) || (typeof Mobile !== 'undefined' && !!Mobile.on);
  arCss();
  const el = document.createElement('div');
  el.id = 'ar-ui';
  el.innerHTML = `<canvas id="ar-cv"></canvas>
    <div id="ar-hud" class="hidden"></div>
    <div id="ar-brum" class="hidden"><b>${t('Брюм')}:</b> <span></span></div>
    <button id="ar-sur" class="hidden" data-ar="sur">${t('Сдаться')}</button>
    <div id="ar-joy" class="hidden"><div id="ar-knob"></div></div>
    <div id="ar-bar" class="hidden"></div>
    <div id="ar-msg"></div>
    <div id="ar-panel"></div>`;
  document.body.appendChild(el);
  Arena.el = el; Arena.cv = el.querySelector('#ar-cv');
  Arena.fans = arFansMake(((Math.random() * 1e9) | 0) + 1);
  // клики и нажатия ловим на window в фазе захвата: часть окон игры гасит всплытие у document раньше нас
  Arena.clk = e => { if (Arena.el && Arena.el.contains(e.target)) arClick(e); };
  Arena.pd = e => { const bar = Arena.el && Arena.el.querySelector('#ar-bar'); if (bar && bar.contains(e.target)) arBarDown(e); };
  window.addEventListener('click', Arena.clk, true); window.addEventListener('pointerdown', Arena.pd, true);
  arJoyInit(el.querySelector('#ar-joy'));
  Arena.kd = arKey; Arena.ku = arKeyUp; Arena.blur = () => { Arena.keys = {}; };
  window.addEventListener('keydown', Arena.kd, true); window.addEventListener('keyup', Arena.ku, true); window.addEventListener('blur', Arena.blur);
  if (typeof pcBusy === 'function' && !pcBusy._ar) { const _pb = pcBusy; pcBusy = function () { return Arena.on || _pb(); }; pcBusy._ar = true; }
  arLobby();
  Arena.last = performance.now();
  const loop = now => { if (!Arena.on) return; const dt = Math.min(0.1, (now - Arena.last) / 1000); Arena.last = now; try { arFrame(dt); } catch (e) { console.error(e); } Arena.raf = requestAnimationFrame(loop); };
  Arena.raf = requestAnimationFrame(loop);
}
function arenaClose() {
  if (!Arena.on) return;
  if (typeof arNetLeave === 'function') arNetLeave(true);
  Arena.on = false; cancelAnimationFrame(Arena.raf);
  window.removeEventListener('keydown', Arena.kd, true); window.removeEventListener('keyup', Arena.ku, true); window.removeEventListener('blur', Arena.blur);
  window.removeEventListener('click', Arena.clk, true); window.removeEventListener('pointerdown', Arena.pd, true);
  if (Arena.el) Arena.el.remove();
  Arena.el = null; Arena.S = null; Arena.keys = {};
  try { if (typeof setSpeed === 'function' && !(typeof StartMenu !== 'undefined' && StartMenu.open)) setSpeed(Arena.prevSpeed || 1); } catch (e) { /* без паузы */ }
  if (Arena.from === 'tavern' && typeof tavernOpen === 'function') tavernOpen();
}

// ---------- Экран арены: выбор класса и соперника ----------
function arLobby() {
  Arena.scr = 'lobby'; Arena.S = null; Arena.net = null; Arena.mi = 0;
  if (typeof arNetHello === 'function') arNetHello();
  for (const id of ['#ar-hud', '#ar-sur', '#ar-joy', '#ar-bar', '#ar-brum']) Arena.el.querySelector(id).classList.add('hidden');
  Arena.el.querySelector('#ar-msg').textContent = '';
  arLobbyRender();
  arBrumSay(arPick(AR_BRUM.lobby));
}
function arLobbyRender() {
  const P = Arena.el.querySelector('#ar-panel'), my = arMyLook(Arena.cls);
  const cls = ARENA_CLS.map(k => `<button class="ar-cl${k === Arena.cls ? ' on' : ''}" data-ar="cls:${k}" style="--c:${arClsCol(k)}"><img src="${typeof portraitURL === 'function' ? portraitURL('hero_' + k, my.look) : ''}" alt=""><b>${arEsc(arClsName(k))}</b></button>`).join('');
  const kit = ARENA_KIT[Arena.cls].map((k, i) => {
    const a = ARENA_TUNE.ab[k], tx = ARENA_TXT[k];
    const meta = a.pas ? t('пассивно') : a.ult ? t('ульта · шкала') : t('{0} · откат {1} с', a.cost, a.cd);
    return `<div class="ar-ab${a.ult ? ' ult' : ''}"><img src="${typeof abilIcon16 === 'function' ? abilIcon16(k) : ''}" alt=""><span><b>${i + 1}. ${arEsc(t(tx[0]))}</b> <small>${arEsc(meta)}</small><br>${arEsc(t(tx[1]))}</span></div>`;
  }).join('');
  const tiers = [1, 2, 3].map(n => `<button class="ar-tier${n === Arena.tier ? ' on' : ''}" data-ar="tier:${n}"><b>${arEsc(t(AR_TIERS[n].name))}</b><small>${arEsc(t(AR_TIERS[n].info))}</small></button>`).join('');
  const C = ARENA_TUNE.cls[Arena.cls];
  P.className = 'ar-lobby';
  P.innerHTML = `<div class="ar-card">
    <div class="ar-top"><h2>${t('Арена')} <small>${t('бой с ботом и онлайн')}</small></h2><button class="ar-x" data-ar="exit" title="${t('Выйти')}">✕</button></div>
    <div class="ar-sub">${t('На песок выходит арена-копия героя 13 уровня: все шесть способностей, ульта копится от урона. Деревенское железо не в счёт — решают руки и класс.')}</div>
    <h3>${t('Ваш класс')}</h3><div class="ar-cls">${cls}</div>
    <div class="ar-info"><b style="color:${arClsCol(Arena.cls)}">${arEsc(arClsName(Arena.cls))}</b> · ${t('здоровье {0}', C.hp)} · ${C.shot ? t('бьёт издалека: {0} клеток', C.rng) : t('бьёт вблизи')}</div>
    <div class="ar-kit">${kit}</div>
    <h3>${t('Соперник')}</h3><div class="ar-tiers">${tiers}</div>
    <div class="ar-go"><button class="ar-b big" data-ar="go">${t('В бой!')}</button></div>
    ${typeof arNetLobbyHtml === 'function' ? arNetLobbyHtml() : ''}
    <div class="ar-keys">${Arena.touch ? t('Джойстик слева — ходить, кнопки справа — способности и перекат.') : t('WASD или стрелки — ходить, 1–6 — способности, V или пробел — перекат, Esc — сдаться. Бьёт сам, когда соперник рядом.')}</div>
  </div>`;
}

function arClick(e) {
  const b = e.target.closest && e.target.closest('[data-ar]');
  if (!b || b.disabled) return;
  const [k, v] = b.dataset.ar.split(':');
  ASfx.play('ui');
  if (k === 'cls') { Arena.cls = v; Arena.clsSet = true; arSave(); arLobbyRender(); }
  else if (k === 'tier') { Arena.tier = +v; arSave(); arLobbyRender(); arBrumSay(t(AR_BRUM.bot[Arena.tier])); }
  else if (k === 'go') arStart(false);
  else if (k === 'again') { if (Arena.net && typeof arNetAgain === 'function') arNetAgain(); else arStart(true); }
  else if (k === 'lobby') arLobby();
  else if (k === 'exit') arenaClose();
  else if (k === 'sur' && Arena.scr === 'fight') arSurrender();
  else if (typeof arNetClick === 'function') arNetClick(k, v, b);
}

// ---------- Бой ----------
function arStart(rematch) {
  const T = ARENA_TUNE;
  Arena.net = null; Arena.mi = 0;
  if (!rematch || !Arena.foe) { const pool = ARENA_CLS.filter(k => k !== Arena.cls); Arena.foe = pool[(Math.random() * pool.length) | 0]; }
  Arena.pot = rematch ? Arena.prevPot : -1;
  const seed = ((Math.random() * 2147483647) | 0) + 1;
  Arena.S = arenaNew({ seed, cls: [Arena.cls, Arena.foe], nm: [arMyName(), t(AR_TIERS[Arena.tier].name)], bots: [null, Arena.tier] });
  Arena.prev = Arena.S.f.map(F => [F.x, F.y]);
  Arena.acc = 0; Arena.cast = -1; Arena.roll = 0; Arena.pops = []; Arena.fx = []; Arena.walk = [0, 0]; Arena.burst = [null, null]; Arena.seenOver = false; Arena.endT = 0;
  Arena.ct = 0; Arena.surT = 0;
  const me = arMyLook(Arena.cls);
  Arena.holders = [me, { type: OUTFIT['hero_' + Arena.foe] ? 'hero_' + Arena.foe : 'hero', look: 3 + Arena.tier * 11, sx: '', carry: null }];
  Arena.scr = 'fight';
  const P = Arena.el.querySelector('#ar-panel'); P.innerHTML = ''; P.className = '';
  for (const id of ['#ar-hud', '#ar-sur', '#ar-bar', '#ar-brum']) Arena.el.querySelector(id).classList.remove('hidden');
  Arena.el.querySelector('#ar-joy').classList.toggle('hidden', !Arena.touch);
  Arena.el.querySelector('#ar-sur').textContent = t('Сдаться');
  arBarBuild();
  arHud(true);
  const a = `${arMyName()} (${arClsName(Arena.cls)})`, b = `${t(AR_TIERS[Arena.tier].name)} (${arClsName(Arena.foe)})`;
  arBrumSay(rematch ? arPick(AR_BRUM.rematch) : arPick(AR_BRUM.intro, a, b));
  arFansReact(Arena.fans, 'cheer', Arena.ct, 0.6);
  ASfx.play('crowd', 0.8);
  void T;
}

// ввод игрока на этот шаг: только намерение
function arInput() {
  const K = Arena.keys;
  let mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), my = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
  if (Arena.joy) { mx = Arena.joy.x; my = Arena.joy.y; }
  const L = Math.sqrt(mx * mx + my * my);
  if (L > 1) { mx /= L; my /= L; }
  const inp = { mx, my, cast: Arena.cast, roll: Arena.roll ? 1 : 0 };
  Arena.cast = -1; Arena.roll = 0;
  return inp;
}

function arFrame(dt) {
  let S = Arena.S;
  const T = ARENA_TUNE;
  arSizeCanvas();
  if (S) {
    Arena.acc += dt;
    let n = 0;
    if (Arena.net) { arNetPump(dt); S = Arena.S; }   // онлайн: ядро шагает по кадрам входов с сервера
    else {
      while (Arena.acc >= T.dt && n < 6) {
        Arena.prev = S.f.map(F => [F.x, F.y]);
        arenaStep(S, [arInput(), null]);
        arEvents(S);
        Arena.acc -= T.dt; n++;
      }
      if (n >= 6) Arena.acc = 0;
    }
    Arena.ct = S.T + Arena.acc;
    for (let i = 0; i < 2; i++) { const F = S.f[i], v = Math.sqrt(F.vx * F.vx + F.vy * F.vy); Arena.walk[i] = (Arena.walk[i] + v * dt * 3.2) % 8; }
    if (S.phase === 'over' && !Arena.seenOver) { Arena.seenOver = true; Arena.endT = Arena.ct + 1.6; }
    if (Arena.seenOver && Arena.endT && Arena.ct >= Arena.endT && Arena.scr === 'fight') arResult();
    Arena.hudT -= dt;
    if (Arena.hudT <= 0) { Arena.hudT = 0.1; arHud(false); arBarUpdate(); }
  } else Arena.ct += dt;
  // частицы
  for (const p of Arena.fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
  Arena.fx = Arena.fx.filter(p => p.t < p.life);
  for (const p of Arena.pops) p.t += dt;
  Arena.pops = Arena.pops.filter(p => p.t < (p.big ? 1.6 : 1.1));
  if (Arena.brumT && Arena.ct > Arena.brumT) { Arena.brumT = 0; const b = Arena.el.querySelector('#ar-brum'); if (b && Arena.scr === 'fight') b.classList.add('fade'); }
  arDraw();
}

// ---------- События ядра → надписи, звук, трибуны, Брюм ----------
function arPop(i, text, col, big) {
  const S = Arena.S, F = S.f[i];
  Arena.pops.push({ x: F.x + (Math.random() - 0.5) * 0.4, y: F.y, text, col, t: 0, big: !!big });
  if (Arena.pops.length > 40) Arena.pops.shift();
}
function arEvents(S) {
  const me = Arena.mi, now = S.T;
  for (const e of S.ev) {
    switch (e.k) {
      case 'count': ASfx.play('count'); Arena.el.querySelector('#ar-msg').textContent = String(e.n); break;
      case 'go': ASfx.play('gong'); ASfx.play('go'); Arena.el.querySelector('#ar-msg').textContent = t('Бой!'); setTimeout(() => { if (Arena.el && Arena.S === S) Arena.el.querySelector('#ar-msg').textContent = ''; }, 800); if (e.round > 1) arBrumSay(arPick(AR_BRUM.go)); break;
      case 'dmg': {
        if (e.src === 'ring') { if (S.tick % 10 === 0) arPop(e.i, '−' + Math.max(1, Math.round(e.n * 10)), '#ff8a30'); break; }
        const col = e.i === me ? '#ff8a70' : '#ffe680';
        arPop(e.i, (e.crit ? t('Крит!') + ' ' : '') + '−' + Math.max(1, Math.round(e.n)), e.crit || e.heavy ? '#ffb040' : col, e.crit || e.heavy);
        if (e.fin) arPop(e.a >= 0 ? e.a : e.i, t('Добивание!'), '#ffe070', true);
        if (e.back) arPop(e.a >= 0 ? e.a : e.i, t('Со спины!'), '#c8a0ff');
        ASfx.play(e.heavy ? 'heavy' : e.crit ? 'crit' : 'hit');
        if (e.heavy || e.crit) arFansReact(Arena.fans, 'gasp', Arena.ct, 0.3);
        break;
      }
      case 'miss': arPop(e.i, t('Мимо'), '#d8d0b0'); ASfx.play('miss'); Arena.misses = (Arena.misses || 0) + 1; if (Arena.misses % 6 === 0) { arFansReact(Arena.fans, 'boo', Arena.ct, 0.4); ASfx.play('boo'); if (Math.random() < 0.4) arBrumSay(arPick(AR_BRUM.boo)); } break;
      case 'dodge': arPop(e.i, t('Перекат!'), '#cfe8ff'); break;
      case 'inv': arPop(e.i, t('Неуязвим'), '#cfe8ff'); break;
      case 'shield': arPop(e.i, t('Строй держит!'), '#8ac8ff'); ASfx.play('shield'); break;
      case 'block': ASfx.play('thud'); arBurstAt(e.x, e.y, ['#d8d0bc', '#8a8478'], 6); break;
      case 'perfect': arPop(e.i, t('Идеальный уворот!'), '#ffe070', true); arPop(e.a, t('Открыт!'), '#ffd040', true); ASfx.play('perfect'); arFansReact(Arena.fans, 'cheer', Arena.ct, 0.5); if (Math.random() < 0.5) arBrumSay(arPick(AR_BRUM.perfect)); break;
      case 'whiff': arPop(e.i, t('Мимо!'), '#e8e0c0'); break;
      case 'tel': ASfx.play('tel'); if (e.i !== me && !Arena.telHint) { Arena.telHint = true; arPop(me, t('Красный клин — перекат!'), '#ff8a70', true); } break;
      case 'roll': ASfx.play('roll'); arBurstAt(S.f[e.i].x, S.f[e.i].y + 0.2, ['#d8c8a0', '#a89870'], 8); break;
      case 'st': {
        const W = { stun: 'Оглушён!', ice: 'Замёрз!', root: 'В путах!', sil: 'Молчит!', slow: 'Замедлен', blind: 'Ослеплён!', open: 'Открыт!', burn: 'Горит!', bleed: 'Кровь!' }[e.s];
        if (W && !(e.s === 'slow' && Arena.lastSlow > now - 1.5)) arPop(e.i, t(W), e.s === 'burn' ? '#ff9a40' : e.s === 'bleed' ? '#ff6a5a' : '#fff2a0');
        if (e.s === 'slow') Arena.lastSlow = now;
        if (e.s === 'stun' || e.s === 'ice') ASfx.play('stun');
        break;
      }
      case 'imm': arPop(e.i, t('Иммунитет'), '#cfe8ff'); break;
      case 'ward': arPop(e.i, t('Оберег!'), '#fff0a0'); ASfx.play('shield'); break;
      case 'heal': arPop(e.i, '+' + Math.round(e.n), '#8aff9a'); ASfx.play('heal'); break;
      case 'cast': case 'ult': {
        const k = e.ab, nm = ARENA_TXT[k] ? t(ARENA_TXT[k][0]) : k;
        arPop(e.i, nm + '!', (typeof ABIL_COL !== 'undefined' && ABIL_COL[k]) || '#ffe070', e.k === 'ult');
        Arena.burst[e.i] = { k, s: Arena.ct };
        ASfx.play(e.k === 'ult' ? 'ult' : 'cast');
        if (e.k === 'ult') { arFansReact(Arena.fans, 'cheer', Arena.ct, 1); ASfx.play('crowd', 1); arBrumSay(arPick(AR_BRUM.ult)); Arena.flash = 0.35; }
        break;
      }
      case 'fail': if (e.i === me) arPop(me, t({ far: 'Далеко', hidden: 'Не видно', los: 'Колонна мешает', res: 'Не хватает сил', cd: 'Ещё не готово', ult: 'Шкала не полна', stun: 'Не до того', sil: 'Молчит' }[e.why] || 'Нельзя'), '#d8d0b0'); break;
      case 'steal': arPop(e.a, t('Карманы: +{0}', e.n), '#ffd060'); break;
      case 'drain': arPop(e.i, t('−{0} ресурса', e.n), '#d8a0ff'); break;
      case 'cleanse': arPop(e.i, t('Чисто!'), '#c0ffd0'); break;
      case 'trap': arPop(e.i, t('Капкан!'), '#c8a070', true); ASfx.play('thud'); break;
      case 'shatter': arPop(e.i, t('Лёд треснул!'), '#9ee0ff'); break;
      case 'meteor': arBurstAt(e.x, e.y, ['#fff0a0', '#ff9a30', '#e04a18', '#5a3a20'], 16); ASfx.play('heavy'); break;
      case 'arrowfall': arBurstAt(e.x, e.y, ['#d8c8a0', '#a89870'], 3); ASfx.play('shot', 0.6); break;
      case 'shot': ASfx.play('shot'); break;
      case 'blink': arBurstAt(e.x, e.y, ['#3a3448', '#5a5068', '#8a8aa8'], 10); break;
      case 'ot': arBrumSay(arPick(AR_BRUM.ot)); Arena.el.querySelector('#ar-msg').textContent = t('Овертайм!'); setTimeout(() => { if (Arena.el) Arena.el.querySelector('#ar-msg').textContent = ''; }, 1200); ASfx.play('gong'); break;
      case 'round': {
        const w = e.w, nmW = arName(w), nmL = arName(1 - w);
        Arena.el.querySelector('#ar-msg').textContent = t('Раунд — {0}!', nmW);
        if (S.winner < 0) arBrumSay(e.why === 'time' ? arPick(AR_BRUM.time) : arPick(AR_BRUM.round, nmW, nmL), 'win');
        ASfx.play('gong'); ASfx.play('crowd', 1);
        arFansReact(Arena.fans, w === me ? 'mug' : 'cheer', Arena.ct, 0.8);
        break;
      }
      case 'rest': Arena.el.querySelector('#ar-msg').textContent = t('Раунд {0}', e.round); break;
      case 'won': {
        const w = e.w, nmW = arName(w), nmL = arName(1 - w);
        Arena.prevPot = 1 - w;
        arBrumSay(e.sur ? arPick(AR_BRUM.sur) : S.score[1 - w] === 0 ? arPick(AR_BRUM.dry, nmW, nmL) : arPick(AR_BRUM.win, nmW, nmL), 'win');
        ASfx.play(w === me ? 'win' : 'lose');
        setTimeout(() => ASfx.play('pot'), 900);
        arFansReact(Arena.fans, w === me ? 'mug' : 'laugh', Arena.ct, 1);
        Arena.el.querySelector('#ar-msg').textContent = w === me ? t('Победа!') : t('Поражение');
        break;
      }
      case 'surrender': break;
    }
  }
}
function arBurstAt(x, y, cols, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 60 * (0.4 + Math.random() * 0.6);
    Arena.fx.push({ x: x * TILE, y: y * TILE - 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 40 * Math.random(), g: 200, t: 0, life: 0.5 + Math.random() * 0.4, col: cols[k % cols.length], s: 1.5 + Math.random() * 1.5 });
  }
}
function arBrumSay(text, mood) {
  const b = Arena.el && Arena.el.querySelector('#ar-brum');
  if (!b) return;
  b.querySelector('span').textContent = text;
  b.classList.remove('fade');
  Arena.brumT = Arena.ct + 4.5; Arena.brumTalk = Arena.ct + 1.6; Arena.mood = mood || '';
  ASfx.play('brum');
}

// ---------- Итог матча ----------
function arResult() {
  const S = Arena.S, mi = Arena.mi, me = S.f[mi], won = S.winner === mi;
  Arena.scr = 'result';
  for (const id of ['#ar-sur', '#ar-bar', '#ar-joy']) Arena.el.querySelector(id).classList.add('hidden');
  Arena.el.querySelector('#ar-msg').textContent = '';
  const P = Arena.el.querySelector('#ar-panel');
  P.className = 'ar-res';
  const sm = me.sm;
  P.innerHTML = `<div class="ar-card small">
    <h2 class="${won ? 'win' : 'lose'}">${won ? t('Победа!') : S.sur === mi ? t('Вы сдались') : t('Поражение')}</h2>
    <div class="ar-score">${S.score[mi]} : ${S.score[1 - mi]}</div>
    <div class="ar-vs">${arEsc(arName(mi))} (${arEsc(arClsName(me.cls))}) — ${arEsc(arName(1 - mi))} (${arEsc(arClsName(S.f[1 - mi].cls))})</div>
    ${Arena.net ? arNetResultHtml(won) : won ? `<div class="ar-note">${t('Соломенный, ветеран или чемпион — победа есть победа. Рейтинг даёт бой с живым соперником: кнопка «Рейтинговый бой» на экране арены.')}</div>`
    : `<div class="ar-note pot">${t('Вам вручён Позорный горшок: носить один бой. Реванш — и снимете.')}</div>`}
    <div class="ar-stats">${t('Урон: {0} · лечение: {1} · идеальных уворотов: {2} · способностей: {3}', Math.round(sm.dmg), Math.round(sm.heal), sm.perfect, sm.casts)}</div>
    <div class="ar-go"><button class="ar-b big" data-ar="again">${Arena.net ? t('Ещё бой') : t('Реванш')}</button><button class="ar-b" data-ar="lobby">${t('Другой бой')}</button><button class="ar-b sec" data-ar="exit">${t('Выйти')}</button></div>
  </div>`;
}

// ---------- HUD ----------
function arHud(force) {
  const S = Arena.S, el = Arena.el.querySelector('#ar-hud');
  if (!S) return;
  const T = ARENA_TUNE, left = Math.max(0, T.roundT - S.t), fight = S.phase === 'fight';
  const side = (F, i) => {
    const pct = Math.max(0, F.hp / F.mhp * 100), cups = [0, 1].map(k => `<i class="${S.score[i] > k ? 'on' : ''}"></i>`).join('');
    const nm = arName(i);
    return `<div class="ar-side s${i}"><div class="ar-nm"><b>${arEsc(nm)}</b> <small style="color:${arClsCol(F.cls)}">${arEsc(arClsName(F.cls))}</small><span class="ar-cups">${cups}</span></div>
      <div class="ar-hp"><i style="width:${pct.toFixed(1)}%"></i><span>${Math.ceil(F.hp)} / ${F.mhp}</span></div>
      <div class="ar-sts">${arStWords(S, F).map(([w, c]) => `<em style="color:${c}">${arEsc(w)}</em>`).join('')}</div></div>`;
  };
  const html = `${side(S.f[0], 0)}<div class="ar-timer${S.ot ? ' ot' : ''}"><b>${fight ? Math.ceil(left) : S.phase === 'count' ? Math.ceil(S.phT) : '—'}</b><small>${t('раунд {0}', S.round)}</small></div>${side(S.f[1], 1)}`;
  if (force || el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
}

// ---------- Панель способностей: те же значки и вид, что у heroabil.js, плюс перекат ----------
function arBarBuild() {
  const bar = Arena.el.querySelector('#ar-bar'), kit = ARENA_KIT[Arena.cls];
  const keyN = i => (typeof ABIL_KEYN !== 'undefined' ? ABIL_KEYN[i] : String(i + 1));
  const rollKey = typeof PC !== 'undefined' && PC.binds && PC.binds.roll && typeof pcCodeName === 'function' ? pcCodeName(PC.binds.roll.split('+').pop()) : 'V';
  bar.innerHTML = `<div class="ar-res"><i></i><span></span></div><div class="ar-ultg"><i></i><span></span></div>
    <div class="ar-slots"><button class="ab-s ar-roll" data-roll="1" aria-label="${t('Перекат')}"><img src="${typeof abilIcon16 === 'function' ? abilIcon16('evade') : ''}" alt=""><i class="ab-key">${arEsc(rollKey)}</i><b class="ab-cd"></b><em></em></button>`
    + kit.map((k, i) => { const a = ARENA_TUNE.ab[k]; return `<button class="ab-s${a.ult ? ' ult' : ''}${a.pas ? ' pas' : ''}" data-ab="${i}" aria-label="${arEsc(t(ARENA_TXT[k][0]))}" title="${arEsc(t(ARENA_TXT[k][0]) + ': ' + t(ARENA_TXT[k][1]))}"><img src="${typeof abilIcon16 === 'function' ? abilIcon16(k) : ''}" alt="">${a.pas ? '<i class="ab-cost ab-inf">∞</i>' : a.ult ? '' : `<i class="ab-cost">${a.cost}</i>`}<i class="ab-key">${arEsc(keyN(i))}</i><b class="ab-cd"></b><em></em></button>`; }).join('') + '</div>';
  arBarUpdate();
}
function arBarUpdate() {
  const S = Arena.S, bar = Arena.el && Arena.el.querySelector('#ar-bar');
  if (!S || !bar) return;
  const F = S.f[Arena.mi], T = ARENA_TUNE, now = S.T, kit = ARENA_KIT[F.cls];
  const R = typeof ABIL_RES !== 'undefined' ? ABIL_RES[F.rk] : { name: F.rk, col: '#e8c040' };
  const res = bar.querySelector('.ar-res');
  res.querySelector('i').style.width = Math.round(F.res) + '%'; res.querySelector('i').style.background = R.col;
  res.querySelector('span').textContent = `${t(R.name)} ${Math.round(F.res)}`;
  const ug = bar.querySelector('.ar-ultg');
  ug.querySelector('i').style.width = Math.round(F.ult) + '%'; ug.classList.toggle('full', F.ult >= 100);
  ug.querySelector('span').textContent = F.ult >= 100 ? t('Ульта готова!') : t('Ульта {0}%', Math.floor(F.ult));
  bar.querySelectorAll('[data-ab]').forEach(b => {
    const i = +b.dataset.ab, k = kit[i], a = T.ab[k];
    if (a.pas) return;
    const left = arCdLeft(S, F, k), why = arCanCast(S, F, i), full = a.cd * F.pas.cd;
    b.classList.toggle('cd', !a.ult && left > 0);
    b.classList.toggle('lack', why === 'res' || why === 'ult');
    b.classList.toggle('on', !!(F.buf[k] > now));
    b.querySelector('.ab-cd').style.setProperty('--p', a.ult ? Math.round((1 - F.ult / 100) * 360) + 'deg' : Math.round(Math.min(1, left / full) * 360) + 'deg');
    b.querySelector('em').textContent = !a.ult && left > 0 ? Math.ceil(left) : '';
  });
  const rb = bar.querySelector('[data-roll]'), rl = Math.max(0, F.rollCd - now);
  rb.classList.toggle('cd', rl > 0);
  rb.querySelector('.ab-cd').style.setProperty('--p', Math.round(Math.min(1, rl / T.rollCd) * 360) + 'deg');
  rb.querySelector('em').textContent = rl > 0 ? Math.ceil(rl) : '';
}
function arBarDown(e) {
  e.stopPropagation(); if (e.cancelable) e.preventDefault();
  const b = e.target.closest('[data-ab],[data-roll]');
  if (!b || Arena.scr !== 'fight') return;
  if (b.dataset.roll) Arena.roll = 1; else Arena.cast = +b.dataset.ab;
  b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140);
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (err) { /* без вибрации */ }
}

// ---------- Ввод: клавиатура и джойстик ----------
function arKey(e) {
  if (!Arena.on) return;
  if (/^F\d+$/.test(e.code)) return;                         // полный экран, обновление страницы — как обычно
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  e.stopImmediatePropagation();
  const scr = Arena.scr, code = e.code;
  if (scr !== 'fight') {
    if (code === 'Escape') { if (scr === 'result' || scr === 'queue' || scr === 'invite' || scr === 'board') { if (typeof arNetLeave === 'function') arNetLeave(); arLobby(); } else arenaClose(); e.preventDefault(); }
    else if (code === 'Enter' && !e.repeat && (scr === 'lobby' || scr === 'result')) { if (Arena.net && typeof arNetAgain === 'function') arNetAgain(); else arStart(scr === 'result'); e.preventDefault(); }
    return;
  }
  e.preventDefault();
  if (code === 'Escape') { if (!e.repeat) arSurrender(); return; }
  Arena.keys[code] = true;
  if (e.repeat) return;
  const rollCode = typeof PC !== 'undefined' && PC.binds && PC.binds.roll ? PC.binds.roll.split('+').pop() : 'KeyV';
  if (code === rollCode || code === 'Space') { Arena.roll = 1; return; }
  const keys = typeof ABIL_KEYS !== 'undefined' ? ABIL_KEYS : ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
  const i = keys.indexOf(code);
  if (i >= 0) Arena.cast = i;
  else if (/^Numpad[1-6]$/.test(code)) Arena.cast = +code.slice(6) - 1;
}
function arKeyUp(e) { if (!Arena.on) return; Arena.keys[e.code] = false; if (!/^F\d+$/.test(e.code)) e.stopImmediatePropagation(); }
function arJoyInit(joy) {
  const knob = joy.querySelector('#ar-knob');
  const R = () => joy.getBoundingClientRect();
  const move = e => {
    const r = R(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, m = r.width * 0.4, k = Math.min(1, d / m);
    Arena.joy = d < 6 ? { x: 0, y: 0 } : { x: dx / d * k, y: dy / d * k };
    knob.style.transform = `translate(${dx / d * Math.min(d, m)}px, ${dy / d * Math.min(d, m)}px)`;
  };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); try { joy.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое событие */ } move(e); });
  joy.addEventListener('pointermove', e => { if (e.buttons || e.pressure || e.pointerType === 'touch') move(e); });
  const end = () => { Arena.joy = null; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
}
function arSurrender() {
  const b = Arena.el.querySelector('#ar-sur');
  if (Arena.surT > performance.now()) { Arena.surT = 0; b.textContent = t('Сдаться'); if (Arena.net) { arNetSend({ a: 'surrender' }); return; } arenaSurrender(Arena.S, Arena.mi); arEvents(Arena.S); return; }
  Arena.surT = performance.now() + 3000;
  b.textContent = t('Точно сдаться? Ещё раз');
  setTimeout(() => { if (Arena.el && Arena.surT && Arena.surT <= performance.now()) { Arena.surT = 0; b.textContent = t('Сдаться'); } }, 3100);
}

// ---------- Рисование ----------
function arSizeCanvas() {
  const cv = Arena.cv, dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  Arena.dpr = dpr;
}
function arView() {
  const W = innerWidth, H = innerHeight, T = ARENA_TUNE, portrait = H > W * 1.15;
  const top = Arena.scr === 'fight' || Arena.scr === 'result' ? (W < 640 ? 62 : 74) : 0;
  const bottom = Arena.scr !== 'fight' ? 0 : Arena.touch ? (portrait ? 210 : 0) : 100;
  const pw = W, ph = Math.max(120, H - top - bottom);
  const s = Math.min(pw, ph) / ((T.R + 0.6) * 2 * TILE);
  return { s, ox: W / 2 - T.cx * TILE * s, oy: top + ph / 2 - T.cy * TILE * s };
}
function arDraw() {
  const cv = Arena.cv, c = cv.getContext('2d'), dpr = Arena.dpr, V = arView(), T = ARENA_TUNE, S = Arena.S, t = Arena.ct;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0c0805'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(V.s * dpr, 0, 0, V.s * dpr, V.ox * dpr, V.oy * dpr);
  c.imageSmoothingEnabled = false;
  const bg = arBgCanvas();
  c.drawImage(bg, (T.cx - AR_RAD) * TILE, (T.cy - AR_RAD) * TILE);
  // трибуны и Брюм
  for (const f of Arena.fans) if (f.y < T.cy) arDrawFan(c, f, t);
  arDrawBrum(c, t, Arena.brumTalk > t, Arena.brumT > t ? Arena.mood : '');
  // чужие функции рисования (вспышки способностей, зоны) живут во времени деревни — подставляем время арены
  const gt = Game.time, gfx = Game.fx;
  Game.time = t; Game.fx = Arena.fx;
  try {
    if (S) arDrawWorld(c, S, t);
  } catch (e) { console.error(e); } finally { Game.time = gt; Game.fx = gfx; }
  for (const f of Arena.fans) if (f.y >= T.cy) arDrawFan(c, f, t);
  // частицы
  for (const p of Arena.fx) { c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * 0.8); }
  c.globalAlpha = 1;
  // надписи над бойцами
  c.textAlign = 'center';
  for (const p of Arena.pops) {
    const a = Math.max(0, 1 - p.t / (p.big ? 1.6 : 1.1)), y = (p.y * TILE - 68 - p.t * 22);
    c.font = `bold ${p.big ? 13 : 10}px sans-serif`;
    c.globalAlpha = a; c.fillStyle = '#000'; c.fillText(p.text, p.x * TILE + 1, y + 1); c.fillStyle = p.col; c.fillText(p.text, p.x * TILE, y);
  }
  c.globalAlpha = 1;
  if (Arena.flash > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(255,230,160,${Arena.flash * 0.5})`; c.fillRect(0, 0, cv.width, cv.height); Arena.flash -= 0.02; }
}
function arDrawWorld(c, S, t) {
  const T = ARENA_TUNE, a = Math.min(1, Arena.acc / T.dt);
  // горящий песок за кругом овертайма
  if (S.ring < T.R) {
    c.save();
    c.beginPath(); c.arc(T.cx * TILE, T.cy * TILE, T.R * TILE, 0, 7); c.arc(T.cx * TILE, T.cy * TILE, S.ring * TILE, 0, 7, true);
    c.fillStyle = `rgba(255,90,20,${0.22 + 0.06 * Math.sin(t * 8)})`; c.fill('evenodd');
    c.strokeStyle = 'rgba(255,170,60,0.9)'; c.lineWidth = 2; c.setLineDash([6, 4]);
    c.beginPath(); c.arc(T.cx * TILE, T.cy * TILE, S.ring * TILE, 0, 7); c.stroke();
    c.restore();
    if (Math.random() < 0.5) { const an = Math.random() * 7, r = (S.ring + Math.random() * (T.R - S.ring)) * TILE; Arena.fx.push({ x: T.cx * TILE + Math.cos(an) * r, y: T.cy * TILE + Math.sin(an) * r, vx: 0, vy: -30, g: -10, t: 0, life: 0.6, col: Math.random() < 0.5 ? '#ff9a30' : '#ffe070', s: 2 }); }
  }
  for (const z of S.zones) arDrawZone(c, z, S.T, z.o === 0);
  for (const F of S.f) if (F.swing) arDrawWedge(c, F, S.T);
  // по глубине: препятствия, бойцы, волки
  const list = [];
  for (const o of T.obs) list.push([o.y, () => arDrawObs(c, o)]);
  const pos = S.f.map((F, i) => { const p = Arena.prev && Arena.prev[i] || [F.x, F.y]; return [p[0] + (F.x - p[0]) * a, p[1] + (F.y - p[1]) * a]; });
  S.f.forEach((F, i) => list.push([pos[i][1], () => {
    arDrawFighter(c, Arena, F, pos[i][0], pos[i][1], t, Arena.holders[i], i === Arena.mi);
    if (F.st.invis > S.T && i !== Arena.mi) return;
    const u = { x: pos[i][0], y: pos[i][1], face: F.face, hfx: F.anim && F.anim.k === 'hurt' && S.T - F.anim.t < 0.3 ? { t: t + 0.1 } : null };
    // свечение действующей способности и вспышка в момент приёма
    let best = null, bl = 0;
    for (const k in F.buf) { const left = F.buf[k] - S.T; if (left > bl) { bl = left; best = k; } }
    if (best && typeof drawAbilAura === 'function') drawAbilAura(c, u, best, 1, bl);
    const B = Arena.burst[i];
    if (B && t - B.s < 1.1 && typeof drawAbilBurst === 'function') drawAbilBurst(c, u, B.k, (t - B.s) / 1.1);
  }]));
  for (const p of S.pets) list.push([p.y, () => { if (typeof abDrawZone === 'function') abDrawZone(c, { k: 'beast', x: p.x, y: p.y, face: p.face, run: p.run, bt: p.bt, until: p.t1 }, S.T); }]);
  list.sort((x, y) => x[0] - y[0]).forEach(e => e[1]());
  for (const p of S.shots) { const B = S.f[p.tg]; arDrawShot(c, p, t, B.x - p.x, B.y - p.y); }
  // полоски здоровья над головами
  S.f.forEach((F, i) => {
    if (F.dead || (F.st.invis > S.T && i !== Arena.mi)) return;
    const x = pos[i][0] * TILE, y = pos[i][1] * TILE - 60, w = 32;
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    c.fillStyle = i === Arena.mi ? '#5ac04a' : '#d0503a'; c.fillRect(x - w / 2, y, w * Math.max(0, F.hp / F.mhp), 3);
    c.fillStyle = '#b070ff'; c.fillRect(x - w / 2, y + 3, w * F.ult / 100, 1);
  });
}

// ---------- Стили ----------
function arCss() {
  if (document.getElementById('ar-css')) return;
  const st = document.createElement('style');
  st.id = 'ar-css';
  st.textContent = `
  #ar-ui{position:fixed;inset:0;z-index:10020;background:#0c0805;color:#f1dfb0;font-family:inherit;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
  #ar-ui .hidden{display:none!important}
  #ar-cv{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block}
  #ar-hud{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:flex-start;padding:6px 10px;background:linear-gradient(#000c,#0000);pointer-events:none}
  .ar-side{flex:1;min-width:0}.ar-side.s1{text-align:right}
  .ar-nm{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}.ar-nm b{color:#f6e8c0}
  .ar-cups{margin:0 6px}.ar-cups i{display:inline-block;width:10px;height:10px;margin:0 2px;border-radius:2px;border:1px solid #d8b04a;background:#2a1a0a;vertical-align:-1px}.ar-cups i.on{background:#f6d458;box-shadow:0 0 5px #f6d458}
  .ar-hp{position:relative;height:14px;background:#2a1410;border:1px solid #000;border-radius:4px;overflow:hidden;margin-top:2px}
  .ar-hp i{display:block;height:100%;background:linear-gradient(#7ae060,#3a9a2a)}.s1 .ar-hp i{background:linear-gradient(#f07050,#a8301a);margin-left:auto}
  .ar-hp span{position:absolute;inset:0;font-size:10px;line-height:14px;text-align:center;color:#fff;text-shadow:0 1px 0 #000}
  .ar-sts{min-height:14px;font-size:11px;font-weight:bold;text-shadow:0 1px 2px #000}.ar-sts em{font-style:normal;margin:0 3px}
  .ar-timer{flex:0 0 64px;text-align:center;background:#2a1a0ccc;border:2px solid #b8902c;border-radius:8px;padding:2px 0}
  .ar-timer b{display:block;font-size:22px;color:#f6d458;line-height:1.1}.ar-timer small{font-size:10px;opacity:.8}.ar-timer.ot{border-color:#ff7030}.ar-timer.ot b{color:#ff9a50}
  #ar-brum{position:absolute;left:50%;transform:translateX(-50%);top:76px;max-width:min(620px,92vw);background:#f4e6c0;color:#3a2410;border:2px solid #6a4a1a;border-radius:8px;padding:5px 10px;font-size:13px;box-shadow:0 2px 8px #000a;pointer-events:none;transition:opacity .6s}
  #ar-brum.fade{opacity:0}
  #ar-sur{position:absolute;right:8px;top:62px;background:#3a2410cc;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer;font-family:inherit}
  #ar-msg{position:absolute;left:0;right:0;top:40%;text-align:center;font-size:clamp(28px,7vw,54px);font-weight:700;color:#f6d458;text-shadow:0 3px 8px #000,0 0 2px #000;pointer-events:none}
  #ar-joy{position:absolute;left:calc(18px + env(safe-area-inset-left));bottom:calc(22px + env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;background:#ffffff14;border:2px solid #ffffff38;touch-action:none}
  #ar-knob{position:absolute;left:44px;top:44px;width:44px;height:44px;border-radius:50%;background:#ffffff50;pointer-events:none}
  #ar-bar{position:absolute;right:calc(10px + env(safe-area-inset-right));bottom:calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:flex-end;gap:4px;--abs:52px;touch-action:none}
  #ar-bar .ar-slots{display:flex;gap:6px;align-items:flex-end}
  #ar-bar .ar-res,#ar-bar .ar-ultg{position:relative;width:240px;max-width:60vw;height:11px;background:#15100a;border:1px solid #000;border-radius:4px;overflow:hidden}
  #ar-bar .ar-res i,#ar-bar .ar-ultg i{display:block;height:100%}
  #ar-bar .ar-ultg i{background:linear-gradient(90deg,#6a3ab0,#c890ff)}#ar-bar .ar-ultg.full{box-shadow:0 0 8px #c890ff}
  #ar-bar .ar-res span,#ar-bar .ar-ultg span{position:absolute;inset:0;text-align:center;font-size:9px;line-height:11px;color:#fff;text-shadow:0 1px 0 #000}
  #ar-bar button{position:relative;padding:0;border-radius:10px;cursor:pointer;overflow:hidden;flex:none;-webkit-tap-highlight-color:transparent}
  #ar-bar .ab-s{width:var(--abs);height:var(--abs);background:radial-gradient(circle at 50% 35%,#4a3818,#1e1509 75%);border:2px solid #b8902c;box-shadow:0 2px 0 #000}
  #ar-bar .ab-s img{width:calc(var(--abs) - 16px);height:calc(var(--abs) - 16px);image-rendering:pixelated;display:block;margin:auto}
  #ar-bar .ab-s.on{border-color:#7fe0ff;box-shadow:0 0 10px rgba(127,224,255,.8)}
  #ar-bar .ab-s.pas{border-style:dashed;border-color:#8a7a50;opacity:.75}
  #ar-bar .ab-s.lack img{filter:grayscale(1) brightness(.55)}#ar-bar .ab-s.lack{border-color:#4a68a8}
  #ar-bar .ab-s.hit{transform:scale(.9)}
  #ar-bar .ab-cd{position:absolute;inset:0;background:conic-gradient(rgba(0,0,0,.66) var(--p,0deg),rgba(0,0,0,0) 0);pointer-events:none}
  #ar-bar em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:bold;font-size:17px;color:#fff;text-shadow:0 1px 0 #000,0 0 3px #000;pointer-events:none}
  #ar-bar i{position:absolute;font-style:normal;font-size:11px;line-height:12px;font-weight:bold;text-shadow:0 1px 0 #000;pointer-events:none}
  #ar-bar .ab-key{left:4px;top:2px;color:#ffe9a8}#ar-bar .ab-cost{right:4px;bottom:2px;color:#9ec8ff}#ar-bar .ab-inf{color:#f0d880}
  #ar-bar .ab-s.ult{width:calc(var(--abs) + 6px);height:calc(var(--abs) + 6px);border-color:#b070ff;background:radial-gradient(circle at 50% 35%,#4a2a78,#1a0e2c 78%)}
  #ar-bar .ab-s.ult:not(.lack){animation:arUlt 1.6s ease-in-out infinite}
  @keyframes arUlt{50%{box-shadow:0 2px 0 #000,0 0 16px rgba(200,140,255,.95)}}
  #ar-bar .ar-roll{border-color:#7aa0c8;margin-right:6px}
  .ar-touch #ar-bar .ab-key{display:none}
  #ar-panel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto;pointer-events:none}
  #ar-panel.ar-lobby,#ar-panel.ar-res{pointer-events:auto;background:rgba(8,5,2,.55)}
  #ar-panel:empty{display:none}
  .ar-card{background:#1f1710f2;border:2px solid #b8902c;border-radius:10px;padding:12px 14px;width:min(760px,97vw);max-height:96vh;overflow:auto;box-sizing:border-box;box-shadow:0 6px 30px #000c}
  .ar-card.small{width:min(460px,96vw);text-align:center}
  .ar-top{display:flex;align-items:center}.ar-top h2{flex:1;margin:0;color:#f6d458;font-size:22px}.ar-top h2 small{font-size:13px;color:#e8dcc0;font-weight:normal}
  .ar-x{background:none;border:none;color:#e8dcc0;font-size:22px;cursor:pointer}
  .ar-sub{font-size:12px;opacity:.8;margin:2px 0 6px}
  .ar-card h3{margin:10px 0 5px;color:#f6d458;font-size:14px}
  .ar-cls{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:5px}
  .ar-cl{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px;background:#2a2014;border:2px solid #4a3a20;border-radius:6px;color:#f6e8c0;cursor:pointer;font-family:inherit;font-size:11px}
  .ar-cl img{width:40px;height:40px;image-rendering:pixelated;border-radius:4px}.ar-cl.on{border-color:var(--c);box-shadow:0 0 8px var(--c);background:#3a2c14}.ar-cl b{color:var(--c)}
  .ar-info{font-size:12px;margin:6px 0 4px}
  .ar-kit{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:4px}
  .ar-ab{display:flex;gap:6px;align-items:flex-start;font-size:11px;line-height:1.3;background:#2a2014;border:1px solid #4a3a20;border-radius:5px;padding:4px 6px}
  .ar-ab img{width:26px;height:26px;image-rendering:pixelated;flex:none}.ar-ab b{color:#f6e8c0}.ar-ab small{opacity:.65}.ar-ab.ult{border-color:#7a4ab0}
  .ar-tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px}
  .ar-tier{display:flex;flex-direction:column;gap:2px;text-align:left;padding:6px 9px;background:#2a2014;border:2px solid #4a3a20;border-radius:6px;color:#f6e8c0;cursor:pointer;font-family:inherit}
  .ar-tier.on{border-color:#f6d458;background:#3a2c14}.ar-tier small{font-size:11px;opacity:.75}
  .ar-go{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0 4px}
  .ar-b{padding:8px 16px;font-size:14px;background:#8a6a1c;color:#fff4d0;border:1px solid #d8b04a;border-radius:6px;cursor:pointer;font-family:inherit}
  .ar-b.big{font-size:18px;padding:10px 26px;font-weight:bold}.ar-b.sec{background:#3a2c14;border-color:#7a5f28}
  .ar-soon{display:flex;flex-wrap:wrap;gap:6px}.ar-soon button{padding:5px 10px;background:#2a2014;color:#a89878;border:1px dashed #5a4a2a;border-radius:5px;font-family:inherit;font-size:12px}
  .ar-soon.on button:not(:disabled){background:#4a3414;color:#f6e8c0;border:1px solid #d8b04a;cursor:pointer}.ar-soon input{width:96px;padding:5px 8px;background:#15100a;color:#f6e8c0;border:1px solid #7a5f28;border-radius:5px;font-family:inherit;font-size:13px}
  .ar-lnk{background:none;border:none;color:#c8a878;text-decoration:underline;cursor:pointer;font-family:inherit;font-size:11px;padding:0}
  .ar-lg{color:var(--c);font-weight:bold}.ar-tab{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.ar-tab th{text-align:left;color:#f6d458;border-bottom:1px solid #5a4a2a;padding:2px 4px}.ar-tab td{padding:2px 4px;border-bottom:1px solid #2a2014}
  .ar-keys{font-size:11px;opacity:.7;margin-top:8px}
  .ar-res h2{margin:4px 0;font-size:30px}.ar-res h2.win{color:#9fe070}.ar-res h2.lose{color:#ff9a70}
  .ar-score{font-size:34px;font-weight:bold;color:#f6d458}.ar-vs{font-size:13px;opacity:.85}
  .ar-note{font-size:13px;margin:8px 0}.ar-note.pot{color:#e8b070}.ar-stats{font-size:12px;opacity:.8}
  .ar-lobby .ar-go{position:sticky;bottom:-12px;background:#1f1710f2;padding:8px 0;margin-bottom:-4px;z-index:2}
  @media (max-width:640px){ #ar-brum{top:92px;font-size:12px} #ar-sur{top:62px;right:auto;left:8px;padding:2px 7px;font-size:11px} .ar-timer{flex-basis:52px}.ar-timer b{font-size:18px} #ar-bar{--abs:min(52px,calc((100vw - 190px) / 4))} }
  @media (max-height:420px){ #ar-hud{padding:3px 8px} .ar-sts{display:none} #ar-brum{top:46px;font-size:11px;padding:3px 8px} #ar-sur{top:46px;right:auto;left:8px} }
  @media (pointer:coarse){ #ar-bar{--abs:58px} }
  @media (pointer:coarse) and (orientation:portrait){ #ar-bar{max-width:62vw} #ar-bar .ar-slots{flex-wrap:wrap;justify-content:flex-end;max-width:calc(4 * (var(--abs) + 8px))} }
  @media (pointer:coarse) and (orientation:landscape){ #ar-bar{--abs:50px} #ar-joy{width:116px;height:116px} #ar-knob{left:36px;top:36px} }`;
  document.head.appendChild(st);
}
