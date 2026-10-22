'use strict';
// «Таверна отряда» — здание-мост между кампанией и режимом забегов (ЗАБЕГ.md).
// Открывается после главы 3 сценария. Клик по зданию → экран таверны: хозяин у стойки
// предлагает забеги разной сложности; здесь же переодевание, напарник и (позже) арена.
// Мета-прогресс забегов живёт отдельно от сейвов деревни: localStorage 'og_run_meta'.

const RUN_META_KEY = 'og_run_meta';
const RUN_CLOAKS = [['Багровый', '#a8322a'], ['Лесной', '#3f7a3a'], ['Индиго', '#3b4a9a'], ['Охра', '#c8962a'], ['Пепельный', '#7a7a80']];
const RUN_PALS = {
  warrior: ['Щитоносец', 'Держит удар и прикрывает героя', '#c8a050'],
  archer: ['Стрелок', 'Бьёт издали, пока вы держите строй', '#7ac85a'],
  healer: ['Лекарь', 'Подлатает героя между схватками', '#e8e0d0'],
  bomber: ['Подрывник', 'Швыряет бочонки с порохом по толпе', '#d0743a'],
};
const RUN_DIFFS = [
  { id: 'walk', name: 'Прогулка', floors: 3, mult: 0.8, desc: 'Этажи 1–3, без босса. Для разминки.', say: 'Сначала разомнёшься. Вниз, потом обратно. Без героизма.' },
  { id: 'dive', name: 'Спуск', floors: 5, mult: 1, desc: '5 этажей и Малгор на дне.', say: 'До самого дна. Малгор давно не принимал гостей.' },
  { id: 'curse', name: 'Проклятие', floors: 5, mult: 1.5, need: 'win', desc: 'Враги злее, награда щедрее.', say: 'Он осерчал. Плати вдвое — получишь вдвое.' },
  { id: 'daily', name: 'Ежедневный', floors: 5, mult: 1.1, daily: true, desc: 'Сегодня подземелье одно на всех. Таблица рекордов дня.', say: 'Сегодня все спускаются по одной лестнице. Посмотрим, кто вылезет с добычей.' },
  { id: 'week', name: 'Недельный', floors: 5, mult: 1.2, weekly: true, desc: 'Одно подземелье на всю неделю. Побей чужой рекорд.', say: 'Нынешняя неделя — одна на всех. Соревнуйся, а не ной.' },
];

function runMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(RUN_META_KEY)); } catch (e) { /* нет хранилища */ }
  m = m && typeof m === 'object' ? m : {};
  return Object.assign({ ups: {}, weapons: {}, weapon: 'pick', stones: 0, shards: 0, runs: 0, wins: 0, best: 0, cloak: 0, pal: 'warrior', weekBest: {}, hurtUntil: 0 }, m);
}
function runMetaSave(m) { try { localStorage.setItem(RUN_META_KEY, JSON.stringify(m)); } catch (e) { /* нет хранилища */ } }
function runWeekSeed() { return rsWeekOf(new Date().toISOString().slice(0, 10)); }  // неделя с понедельника, по UTC — как у сервера

// ---------- здание ----------
BUILDINGS.squadtavern = {
  name: 'Таверна отряда', cat: 'Основа', w: 4, h: 3, top: 90, cost: { timber: 8, stone: 6 }, wideDoor: true, auto: true,
  desc: 'Здесь собирают отряд для спуска в подземелья Малгора. Хозяин предложит забег, а ещё тут можно переодеться и выбрать напарника.',
};
BUILD_ORDER.push('squadtavern');
UNLOCKS.push({ id: 'squad', items: ['squadtavern'] });
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.squad = 'Таверна отряда';
Object.assign(SIGN_OF, { squadtavern: 'swords' });
DWARF_TYPES.add('squadtavern');
Object.assign(MODELS, {
  squadtavern(m) {
    m.box({
      x0: 6, x1: 98, y0: 14, y1: 62, h: 44, wall: 'stone', col: '#8a8478', lowerStone: 0,
      roof: { type: 'gable', axis: 'X', rise: 30, mat: 'slate', col: '#4a3e66', ov: 6 },
      decor: {
        S: [{ t: 'door', main: true, shift: -16, w: 30, h: 22, o: { frame: 'stone', double: true } },
          { t: 'win', at: 18, z: 8, w: 8, h: 10, o: { lit: true, stone: true } }, { t: 'win', at: 70, z: 8, w: 8, h: 10, o: { lit: true, stone: true } },
          { t: 'win', at: 24, z: 28, w: 8, h: 9, o: { lit: true } }, { t: 'win', at: 52, z: 28, w: 8, h: 9, o: { lit: true } }, { t: 'win', at: 80, z: 28, w: 8, h: 9, o: { lit: true } },
          { t: 'sign', at: 62, z: 24, kind: 'swords' }, { t: 'lantern', at: 88, z: 21 }],
        E: [{ t: 'win', at: 30, z: 8, w: 7, h: 9, o: { lit: true, stone: true } }, { t: 'win', at: 30, z: 28, w: 7, h: 9, o: { lit: true } }],
        W: [{ t: 'win', at: 30, z: 8, w: 7, h: 9, o: { lit: true, stone: true } }],
      },
      gable: { E: [{ t: 'win', at: 38, z: 6, w: 6, h: 7, o: { lit: true, arch: true } }] },
      chimneys: [{ x: 14, y: 50, h: 18, kind: 'stone', w: 6 }],
    });
    m.box({ x0: 8, x1: 46, y0: 4, y1: 14, h: 22, open: true, canopy: true, noShadow: true, roof: { type: 'lean', down: 'S', rise: 6, mat: 'shingle', col: '#5a3a64', ov: 2 } });
    m.g.spr.doorPt = m.at(m.doorX, 12);
    m.prop((c, x, y) => barrel(c, x, y), 3, 20);
    m.prop((c, x, y) => crate(c, x, y, 6), 3, 6);
    // скрещённые мечи на стене-вывеске у входа
    m.prop((c, x, y) => {
      line(c, x - 7, y - 16, x + 7, y, '#cfd4dc', 1.6); line(c, x + 7, y - 16, x - 7, y, '#cfd4dc', 1.6);
      line(c, x - 9, y - 4, x - 4, y - 6, '#8a5a2a', 1.6); line(c, x + 9, y - 4, x + 4, y - 6, '#8a5a2a', 1.6);
    }, 92, 6);
    m.prop((c, x, y) => { for (const k of [0, 1, 2]) { c.fillStyle = k % 2 ? '#e8dcc0' : '#4a3e66'; c.fillRect(x - 15 + k * 10, y - 1, 10, 4); } }, m.doorX, 1);
  },
});

// ---------- доступность ----------
function squadTavernOpen() {
  const g = Game.goal;
  if (!g) return false;
  if (g.mode === 'scenario') return g.ch >= 3;   // глава 3 «Пиво вместо совести» пройдена
  return Game.buildings.some(b => b.type === 'brewery' && b.state === 'done');   // свободная игра: пивоварня стоит
}
{
  const _step = step;
  let acc = 0;
  step = function (dt) {
    _step(dt);
    acc += dt;
    if (acc < 2) return;
    acc = 0;
    if (Game.unlocked && !Game.unlocked.squad && squadTavernOpen()) unlockStage('squad');
  };
}

// ---------- реплики хозяина ----------
function tavernKeeperSay() {
  const ch = Game.goal && Game.goal.mode === 'scenario' ? Game.goal.ch : 3;
  const m = runMeta();
  const L = ['Кружка пуста? Тогда и ноги у тебя пустые. Вниз!', 'Малгор платит гномам за шум. Вернее — не платит.', 'Герой? Видал я героев. Все возвращаются голодные.',
    'Что смотришь? Пена сама себя не вытрет.'];
  if (!m.runs) L.unshift('Новенький? Вниз по лестнице, влево от бочки. Назад — как повезёт.');
  if (m.wins) L.push('Победитель Малгора! Кружка за счёт заведения. Одна.');
  if (ch >= 5) L.push('Говорят, шпиль темнеет. Хороший знак. Или плохой.');
  if (m.hurtUntil > Date.now()) L.push('Сядь, герой. Ты ещё белый, как мука. Потом пойдёшь.');
  return L;
}

// ---------- экран таверны ----------
const Tav = { el: null, cv: null, t: 0, raf: 0, parts: [], say: '', sayT: 0, sayI: 0, prevSpeed: 1, open: false };

function tavernOpen() {
  if (Tav.open) return;
  Tav.open = true;
  Tav.prevSpeed = Game.speed || 1;
  try { setSpeed(0); } catch (e) { /* без паузы */ }
  const el = document.createElement('div');
  el.id = 'tavern-ui';
  el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#120b06;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit;color:#f1dfb0;';
  el.innerHTML = `<div style="position:relative;width:min(100vw,calc(100vh*16/9*0.62));max-width:960px">
    <canvas id="tav-cv" width="320" height="180" style="width:100%;image-rendering:pixelated;border:2px solid #b8902c;border-radius:6px;display:block;background:#1a0f08"></canvas>
    <div id="tav-say" style="${innerWidth < 640 ? 'position:static;margin:6px 0 0;min-height:34px;' : 'position:absolute;left:50%;top:6%;transform:translateX(-10%);max-width:46%;'}background:#f4e6c0;color:#3a2410;border:2px solid #6a4a1a;border-radius:8px;padding:6px 10px;font-size:clamp(11px,1.6vw,15px);box-shadow:0 2px 8px #000a"></div>
    <button id="tav-x" style="position:absolute;right:6px;top:6px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;padding:4px 10px;cursor:pointer">✕ Выйти</button>
  </div>
  <div id="tav-cards" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px;max-width:960px;padding:0 8px"></div>
  <div id="tav-bar" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px"></div>`;
  document.body.appendChild(el);
  Tav.el = el; Tav.cv = el.querySelector('#tav-cv');
  el.querySelector('#tav-x').onclick = tavernClose;
  Tav.keyH = e => { if (e.key === 'Escape' && Tav.open && !Run.on) tavernClose(); };
  window.addEventListener('keydown', Tav.keyH);
  Tav.lines = tavernKeeperSay(); Tav.sayI = 0; Tav.sayT = 0; Tav.t = 0; Tav.parts = [];
  RSfx.ambStart('tavern'); RSfx.play('clink');
  tavernRender();
  let last = performance.now();
  const loop = now => {
    if (!Tav.open) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;   // метка первого кадра бывает раньше performance.now()
    tavernFrame(dt);
    Tav.raf = requestAnimationFrame(loop);
  };
  Tav.raf = requestAnimationFrame(loop);
}

function tavernClose() {
  if (!Tav.open) return;
  Tav.open = false; cancelAnimationFrame(Tav.raf); RSfx.ambStop();
  window.removeEventListener('keydown', Tav.keyH);
  if (Tav.el) Tav.el.remove();
  Tav.el = null;
  try { setSpeed(Tav.prevSpeed || 1); } catch (e) { /* без паузы */ }
  if (runMeta().hurtUntil > Date.now()) { try { toast('Герой отлёживается в таверне — набирается сил'); } catch (e) { /* без тоста */ } }
}

function tavernRender() {
  const m = runMeta(), wk = runWeekSeed();
  const btn = 'background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:14px';
  const cards = Tav.el.querySelector('#tav-cards');
  const hurt = m.hurtUntil > Date.now();
  cards.innerHTML = RUN_DIFFS.map(d => {
    const locked = d.need === 'win' && !m.wins;
    const lvl = d.id === 'curse' ? Math.max(1, Math.min(5, m.wins)) : 0;
    const best = d.weekly ? (m.weekBest[wk] || 0) : d.daily ? ((m.dayBest || {})[runDayKey()] || 0) : 0;
    return `<button data-d="${d.id}" ${locked ? 'disabled' : ''} style="${btn};width:218px;text-align:left;${locked ? 'opacity:.45;cursor:default' : ''}">
      <span style="display:block;width:100%;text-align:left"><b style="font-size:16px;display:block">${d.name}${lvl ? ' ' + lvl : ''}${locked ? ' 🔒' : ''}</b><small style="display:block">${locked ? 'Победите Малгора, чтобы открыть' : d.desc}</small>${best ? `<small style="display:block">${d.daily ? 'Ваш результат сегодня' : 'Рекорд недели'}: ${best}</small>` : ''}</span></button>`;
  }).join('');
  cards.querySelectorAll('button[data-d]').forEach(b => {
    b.onmouseenter = () => { const d = RUN_DIFFS.find(x => x.id === b.dataset.d); if (d && !b.disabled) { tavernSay(d.say); Tav.hover = true; } };
    b.onmouseleave = () => { Tav.hover = false; };
    b.onclick = () => {
      const d = RUN_DIFFS.find(x => x.id === b.dataset.d); if (!d || b.disabled) return;
      if (d.daily || d.weekly) { rbChoose(d); return; }   // попытка дня или тренировка — игрок решает сам
      RSfx.play('ui'); tavernClose(); runStart(d);
    };
  });
  const pal = RUN_PALS[m.pal];
  Tav.el.querySelector('#tav-bar').innerHTML =
    `<button id="tb-cloak" style="${btn}">Переодеться: плащ «${RUN_CLOAKS[m.cloak % RUN_CLOAKS.length][0]}»</button>
     <button id="tb-pal" style="${btn}">Напарник: ${pal[0]}</button>
     <button id="tb-shop" style="${btn}">Мастерская деда</button>
     <button id="tb-board" style="${btn}">Рекорды</button>
     <button id="tb-squad" style="${btn}">Отряд (кооп)</button>
     <button id="tb-arena" style="${btn};opacity:.6">Арена (скоро)</button>
     <span style="align-self:center;font-size:13px;opacity:.85">💎 ${m.stones} &nbsp; ◆ ${m.shards} &nbsp; Забегов: ${m.runs} · Побед: ${m.wins}${hurt ? ' · герой отлёживается' : ''}</span>`;
  Tav.el.querySelector('#tb-cloak').onclick = () => { const mm = runMeta(); mm.cloak = (mm.cloak + 1) % RUN_CLOAKS.length; runMetaSave(mm); tavernRender(); tavernSay('Красный тебе шёл, но вкус — дело хозяйское.'); };
  Tav.el.querySelector('#tb-pal').onclick = () => { const ks = Object.keys(RUN_PALS), mm = runMeta(); mm.pal = ks[(ks.indexOf(mm.pal) + 1) % ks.length]; runMetaSave(mm); tavernRender(); tavernSay(RUN_PALS[mm.pal][1] + '.'); };
  Tav.el.querySelector('#tb-shop').onclick = tavernShop;
  Tav.el.querySelector('#tb-board').onclick = rbOpen;
  Tav.el.querySelector('#tb-squad').onclick = () => rnOpen();
  Tav.el.querySelector('#tb-arena').onclick = () => tavernSay('Арена? Там пока делают трибуны. Приходи позже.');
}

function tavernSay(text) { Tav.say = text; Tav.sayT = 6; Tav.el.querySelector('#tav-say').textContent = text; Tav.el.querySelector('#tav-say').style.display = 'block'; }

function tavernFrame(dt) {
  Tav.t += dt; Tav.sayT -= dt;
  if (Tav.sayT <= 0) {
    Tav.sayI = (Tav.sayI + 1) % Tav.lines.length;
    tavernSay(Tav.lines[Tav.sayI]); Tav.sayT = 5.5;
  }
  RSfx.ambTick(dt);
  tavernDraw(Tav.cv.getContext('2d'), Tav.t);
}

// Сцена 320×180: тёплый зал — очаг с котлом, окно в ночь, полки с бутылками, бочки с кранами, стойка.
// Хозяин и посетители — настоящие гномы игры (drawPerson из people.js), поэтому выглядят как жители деревни.
// Неподвижная часть рисуется один раз в Tav.bg, каждый кадр — огонь, свет, гномы, пар и искры.
const TAV_SPR = new Map();
function tavGnome(type, look, view, pose, frame, opt, part) {
  const key = `${type}|${look}|${view}|${pose}|${frame}|${opt && opt.gest || ''}|${opt && opt.gf || 0}|${part}`;
  let cv = TAV_SPR.get(key);
  if (cv) return cv;
  const [c2, ctx] = mkSprite(PW, PH, PS);
  drawPerson(ctx, type, lookOf({ type, look }), view, pose, frame, null, null, mulberry32(look * 977 + 13), opt || {});
  cv = toPixelArt(c2, PS / part, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  if (TAV_SPR.size > 260) TAV_SPR.delete(TAV_SPR.keys().next().value);
  TAV_SPR.set(key, cv);
  return cv;
}
// гном ногами в точке (x, y); flip — смотрит влево
function tavPut(c, spr, x, y, part, flip) {
  const sx = Math.round(x - (flip ? PW - PFX : PFX) * part), sy = Math.round(y - PFY * part);
  if (!flip) { c.drawImage(spr, sx, sy); return; }
  c.save(); c.translate(sx + spr.width, sy); c.scale(-1, 1); c.drawImage(spr, 0, 0); c.restore();
}

function tavBg() {
  const cv = mkCanvas(320, 180), c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const rnd = mulberry32(4242), px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // стена: вертикальные доски с волокном
  for (let x = 0; x < 320; x += 12) {
    const tone = ['#5a3820', '#603c22', '#56361e', '#5e3a20'][(x / 12) % 4];
    px(x, 0, 12, 96, tone); px(x, 0, 1, 96, '#3e2412'); px(x + 11, 0, 1, 96, '#6e4a2a');
    for (let k = 0; k < 5; k++) px(x + 2 + ((rnd() * 8) | 0), (rnd() * 90) | 0, 1, 4 + ((rnd() * 8) | 0), '#4e3018');
    if (rnd() < 0.5) { const ky = 10 + ((rnd() * 70) | 0); px(x + 4, ky, 3, 2, '#3e2412'); px(x + 5, ky, 1, 1, '#2a180a'); }   // сучок
  }
  // нижние панели
  px(0, 90, 320, 30, '#3e2614'); px(0, 90, 320, 2, '#7a5430'); px(0, 92, 320, 1, '#2a180a');
  for (let x = 4; x < 320; x += 26) { px(x, 96, 22, 20, '#4a2e18'); px(x, 96, 22, 1, '#2e1c0e'); px(x, 96, 1, 20, '#2e1c0e'); px(x + 21, 96, 1, 20, '#6a4626'); px(x, 115, 22, 1, '#6a4626'); }
  // пол: доски вширь, к зрителю шире
  let y = 120, hgt = 5;
  while (y < 180) {
    px(0, y, 320, hgt, (y / 5 | 0) % 2 ? '#6a4424' : '#704828'); px(0, y, 320, 1, '#4a2e16');
    for (let x = ((rnd() * 60) | 0); x < 320; x += 50 + ((rnd() * 50) | 0)) px(x, y, 1, hgt, '#4a2e16');
    for (let k = 0; k < 6; k++) px((rnd() * 320) | 0, y + 1 + ((rnd() * (hgt - 1)) | 0), 6 + ((rnd() * 10) | 0), 1, '#5e3c1e');
    y += hgt; hgt += 1;
  }
  // потолочные балки и гирлянды хмеля
  px(0, 0, 320, 7, '#3a2210'); px(0, 7, 320, 2, '#2a180a'); px(0, 0, 320, 1, '#5a3a1e');
  for (const bx of [84, 236]) { px(bx, 0, 8, 120, '#3a2210'); px(bx, 0, 1, 120, '#5a3a1e'); px(bx + 7, 0, 1, 120, '#24140a'); }
  for (let x = 4; x < 320; x += 3) {
    const sag = Math.round(Math.sin((x % 80) / 80 * Math.PI) * 5);
    px(x, 8 + sag, 2, 1, '#4a6a22');
    if (x % 9 === 1) { px(x - 1, 9 + sag, 3, 3, '#7aa83a'); px(x, 10 + sag, 1, 1, '#a8d060'); px(x, 12 + sag, 1, 1, '#4a6a22'); }
  }
  // окно в ночь (между балкой и полками)
  const wx = 98, wy = 22;
  px(wx - 3, wy - 3, 32, 44, '#3a2210'); px(wx - 3, wy + 38, 32, 3, '#7a5430');
  const sky = c.createLinearGradient(0, wy, 0, wy + 38); sky.addColorStop(0, '#0e1638'); sky.addColorStop(1, '#2a3a6a');
  c.fillStyle = sky; c.fillRect(wx, wy, 26, 38);
  px(wx, wy, 3, 3, '#3a2210'); px(wx + 23, wy, 3, 3, '#3a2210'); px(wx, wy, 1, 6, '#3a2210'); px(wx + 25, wy, 1, 6, '#3a2210');   // скруглённый верх
  for (let k = 0; k < 9; k++) px(wx + 2 + ((rnd() * 22) | 0), wy + 3 + ((rnd() * 18) | 0), 1, 1, rnd() < 0.3 ? '#fff6c0' : '#c8d0f0');
  px(wx + 17, wy + 6, 5, 5, '#f4ecc8'); px(wx + 18, wy + 5, 3, 7, '#f4ecc8'); px(wx + 19, wy + 6, 3, 4, '#cfc8a8');   // луна
  px(wx, wy + 28, 26, 10, '#16203e'); for (let x = wx; x < wx + 26; x += 4) px(x, wy + 24 + ((x * 7) % 5), 3, 14, '#121a32');   // ели за окном
  px(wx + 12, wy, 2, 38, '#3a2210'); px(wx, wy + 18, 26, 2, '#3a2210');   // переплёт
  px(wx + 2, wy + 22, 2, 2, '#ffd27a'); px(wx + 6, wy + 30, 1, 1, '#ffd27a');   // огоньки дальней деревни
  // горшок с геранью на подоконнике
  px(wx + 3, wy + 34, 7, 5, '#a8502a'); px(wx + 3, wy + 34, 7, 1, '#c8703a'); px(wx + 4, wy + 30, 5, 4, '#3e7426'); px(wx + 5, wy + 29, 2, 2, '#e04a4a'); px(wx + 8, wy + 31, 1, 1, '#e04a4a');
  // очаг: каменная кладка, полка, котёл
  const fx = 8, fy = 30;
  for (let j = 0; j < 9; j++) for (let i = 0; i < 6; i++) {
    const bx = fx + i * 11 - (j % 2 ? 5 : 0), by = fy + j * 10;
    if (bx < fx - 2 || bx > fx + 60) continue;
    const g = ['#7a7068', '#6e655e', '#847a70', '#6a6058'][((i * 5 + j * 3) % 4)];
    px(Math.max(fx, bx), by, Math.min(10, fx + 66 - bx), 9, g); px(Math.max(fx, bx), by, 10, 1, '#968a7e'); px(Math.max(fx, bx), by + 8, 10, 1, '#4e4640');
  }
  px(fx + 12, fy + 34, 42, 56, '#2a2420'); px(fx + 14, fy + 36, 38, 54, '#120c08');   // топка
  c.fillStyle = '#2a2420'; c.beginPath(); c.arc(fx + 33, fy + 36, 21, Math.PI, 0); c.fill();
  c.fillStyle = '#120c08'; c.beginPath(); c.arc(fx + 33, fy + 37, 19, Math.PI, 0); c.fill();
  px(fx - 4, fy + 6, 74, 5, '#5a3a1e'); px(fx - 4, fy + 6, 74, 1, '#8a6038'); px(fx - 4, fy + 11, 74, 1, '#2a180a');   // полка
  // на полке: кружки, свеча, подкова
  for (const [mx2, col] of [[fx + 2, '#d8d0c0'], [fx + 10, '#b8a888'], [fx + 52, '#d8d0c0']]) { px(mx2, fy, 6, 6, col); px(mx2 + 6, fy + 2, 1, 3, col); px(mx2, fy, 6, 1, '#f4ecd0'); }
  px(fx + 30, fy - 3, 4, 9, '#f0e6c8'); px(fx + 28, fy + 4, 8, 2, '#a07a30');
  c.strokeStyle = '#9aa0aa'; c.lineWidth = 2; c.beginPath(); c.arc(fx + 44, fy - 4, 4, 0.2, Math.PI - 0.2); c.stroke();
  px(fx + 33, fy + 40, 1, 22, '#2a2420');                                     // цепь котла
  c.fillStyle = '#26221e'; c.beginPath(); c.ellipse(fx + 33, fy + 68, 11, 8, 0, 0, Math.PI * 2); c.fill();
  px(fx + 22, fy + 61, 22, 3, '#3a342e'); px(fx + 24, fy + 61, 18, 1, '#5a524a');
  // дрова у очага
  for (let k = 0; k < 4; k++) { px(fx + 66 + (k % 2) * 3, 110 - k * 4, 12, 4, '#6a4424'); px(fx + 66 + (k % 2) * 3, 110 - k * 4, 3, 4, '#c8a070'); px(fx + 67 + (k % 2) * 3, 111 - k * 4, 1, 2, '#8a6038'); }
  // коврик у очага
  c.fillStyle = '#8a2a22'; c.beginPath(); c.ellipse(46, 148, 34, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#d8a040'; c.lineWidth = 1; c.beginPath(); c.ellipse(46, 148, 30, 5, 0, 0, Math.PI * 2); c.stroke();
  // полки с бутылками за стойкой
  for (const sy of [30, 56]) {
    px(128, sy + 18, 104, 4, '#5a3a1e'); px(128, sy + 18, 104, 1, '#8a6038'); px(128, sy + 22, 104, 1, '#24140a');
    for (const bx of [131, 230]) px(bx - 2, sy + 22, 3, 5, '#4a2e18');
    let bx = 132;
    while (bx < 226) {
      const kind = (rnd() * 5) | 0, col = ['#3e7a3a', '#8a5a1a', '#6a1e2a', '#2e5a7a', '#c8902a'][kind];
      if (kind === 4 && bx < 214) { px(bx, sy + 8, 12, 10, '#8a5a2a'); px(bx, sy + 10, 12, 1, '#b8902c'); px(bx, sy + 15, 12, 1, '#b8902c'); px(bx + 1, sy + 8, 1, 10, '#a8703a'); bx += 14; continue; }   // бочонок
      const h2 = 9 + ((rnd() * 6) | 0);
      px(bx, sy + 18 - h2, 5, h2, col); px(bx + 1, sy + 18 - h2 - 3, 3, 3, col); px(bx + 1, sy + 18 - h2 - 4, 3, 1, '#2a180a');
      px(bx + 1, sy + 19 - h2, 1, h2 - 3, 'rgba(255,255,255,0.35)'); px(bx, sy + 12, 5, 3, '#e8dcb8');
      bx += 7;
    }
  }
  // большие бочки с кранами справа
  for (const [bx2, by2] of [[256, 50], [286, 50], [271, 82]]) {
    c.fillStyle = '#7a4a22'; c.beginPath(); c.ellipse(bx2 + 13, by2 + 13, 14, 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9a6430'; c.beginPath(); c.ellipse(bx2 + 13, by2 + 13, 10, 10, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a2210'; c.lineWidth = 1; for (let k = -6; k <= 6; k += 4) { c.beginPath(); c.moveTo(bx2 + 13 + k, by2 + 4); c.lineTo(bx2 + 13 + k, by2 + 22); c.stroke(); }
    c.strokeStyle = '#c8a050'; c.lineWidth = 2; c.beginPath(); c.ellipse(bx2 + 13, by2 + 13, 13, 13, 0, 0, Math.PI * 2); c.stroke();
    px(bx2 + 11, by2 + 20, 5, 3, '#c8a050'); px(bx2 + 12, by2 + 23, 3, 3, '#a07a30'); px(bx2 + 13, by2 + 26, 1, 1, '#ffcc5a');
  }
  px(252, 76, 64, 4, '#4a2e18'); px(252, 108, 64, 4, '#4a2e18');   // козлы под бочки
  // вывеска отряда: топоры и кружка
  px(144, 10, 72, 18, '#3a2210'); px(146, 12, 68, 14, '#c8a870'); px(146, 12, 68, 1, '#e8d0a0'); px(146, 25, 68, 1, '#8a6a40');
  c.strokeStyle = '#7a8088'; c.lineWidth = 2; c.beginPath(); c.moveTo(166, 24); c.lineTo(180, 14); c.moveTo(194, 24); c.lineTo(180, 14); c.stroke();
  px(176, 14, 8, 9, '#f4ecd0'); px(184, 16, 2, 4, '#f4ecd0'); px(176, 13, 8, 2, '#ffffff'); px(177, 16, 6, 6, '#e0a030');
  // стойка
  px(118, 106, 184, 44, '#5a3418'); px(114, 100, 192, 8, '#8a5a2a'); px(114, 100, 192, 1, '#c08a4a'); px(114, 107, 192, 1, '#3a2210');
  for (let x = 124; x < 300; x += 22) { px(x, 112, 18, 30, '#64401e'); px(x, 112, 18, 1, '#3a2210'); px(x, 112, 1, 30, '#3a2210'); px(x + 17, 112, 1, 30, '#7a522a'); }
  px(116, 142, 188, 2, '#c8a050'); px(116, 143, 188, 1, '#7a5a20');   // латунная перекладина для ног
  for (let x = 130; x < 300; x += 40) px(x, 140, 2, 6, '#a07a30');
  // кран-колонна на стойке
  px(242, 82, 8, 18, '#a07a30'); px(242, 82, 8, 2, '#e0c070'); for (const k of [0, 1, 2]) { px(238 + k * 6, 86, 3, 8, '#7a3a1c'); px(238 + k * 6, 85, 3, 1, '#c8703a'); }
  // стол на переднем плане
  px(222, 156, 98, 7, '#7a4a22'); px(222, 156, 98, 1, '#b07a42'); px(222, 163, 98, 2, '#3a2210'); px(230, 165, 7, 15, '#5a3418');
  for (let x = 226; x < 320; x += 9) px(x, 158, 1, 4, '#6a3e1c');
  return cv;
}

function tavernDraw(c, t) {
  c.imageSmoothingEnabled = false;
  if (!Tav.bg) Tav.bg = tavBg();
  c.drawImage(Tav.bg, 0, 0);
  const fl = 0.78 + Math.sin(t * 9) * 0.1 + Math.sin(t * 23) * 0.07 + Math.sin(t * 3.1) * 0.05;
  // огонь в очаге: языки, угли, поленья
  const fx = 41;
  for (let k = 0; k < 7; k++) {
    const x = fx - 12 + k * 4, h = 12 + Math.sin(t * 8 + k * 1.7) * 4 + (k === 3 ? 7 : k === 2 || k === 4 ? 4 : 0);
    c.fillStyle = k % 2 ? '#ff9a2a' : '#e8601a'; c.fillRect(x, 116 - h, 4, h);
    c.fillStyle = '#ffd25a'; c.fillRect(x + 1, 116 - h * 0.6, 2, h * 0.6);
    c.fillStyle = '#fff2b0'; c.fillRect(x + 1, 116 - h * 0.25, 2, h * 0.25);
  }
  c.fillStyle = '#4a2a14'; c.fillRect(fx - 14, 114, 30, 3); c.fillRect(fx - 10, 111, 22, 3);
  c.fillStyle = '#ff6a1a'; for (let k = 0; k < 6; k++) c.fillRect(fx - 12 + k * 5, 117, 2, 1);
  // пар над котлом
  for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; c.fillStyle = `rgba(230,230,220,${0.35 * (1 - ph)})`; c.fillRect(fx - 2 + Math.sin(t * 2 + k) * 3 + k * 2, 88 - ph * 26, 3, 3); }
  // кот у очага: спит, хвост покачивается, ухо дёргается
  const kx = 40, ky = 147;
  c.fillStyle = '#3a3040'; c.beginPath(); c.ellipse(kx, ky, 9, 4.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(kx - 8, ky - 2, 4, 3.5, 0, 0, Math.PI * 2); c.fill();
  c.fillRect(kx - 11, ky - 7, 2, 3); c.fillRect(kx - 7, ky - 7 + (Math.sin(t * 0.7) > 0.95 ? 1 : 0), 2, 3);
  c.fillStyle = '#e8b040'; c.fillRect(kx - 10, ky - 3, 2, 1);
  const tw = Math.sin(t * 1.6) * 2; c.fillStyle = '#3a3040'; c.fillRect(kx + 8, ky + 1, 4, 2); c.fillRect(kx + 11, ky - 1 + tw * 0.5, 2, 3);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(kx - 6, ky - 4, 10, 1);
  // хозяин за стойкой: наш гном-пивовар; машет, протирает кружку, показывает на забег
  const cyc = t % 14, idle = Math.floor(t * 5) % IDLE_FRAMES;
  const gest = Tav.hover ? 'point' : t < 3 || (cyc > 9 && cyc < 11) ? 'wave' : cyc > 5 && cyc < 7.5 ? 'drink' : '';
  const keeper = tavGnome('brewer', 11, 'S', 'idle', idle, gest ? { gest, gf: gestCyc(t) } : {}, 3);
  tavPut(c, keeper, 186, 124, 3, false);
  // стойка поверх ног хозяина
  c.drawImage(Tav.bg, 114, 100, 192, 50, 114, 100, 192, 50);
  // кружки на стойке: пена и пар
  for (const [x, full] of [[130, 1], [150, 1], [222, 0], [266, 1], [282, 1]]) {
    c.fillStyle = '#d8d0c0'; c.fillRect(x, 92, 9, 9); c.fillStyle = '#a89878'; c.fillRect(x, 99, 9, 2); c.fillRect(x + 9, 94, 2, 5); c.fillStyle = '#f4ecd0'; c.fillRect(x + 1, 93, 2, 6);
    if (full) { c.fillStyle = '#fff8e8'; c.fillRect(x - 1, 89, 11, 4); c.fillRect(x + 1, 88, 6, 1); c.fillStyle = '#e8dcc0'; c.fillRect(x - 1, 92, 11, 1); }
  }
  // посетители: двое за столом (один пьёт, другой хлопает), у стойки — официантка
  const p1 = tavGnome('miner', 3, 'E', 'idle', (idle + 2) % IDLE_FRAMES, (t % 9) > 6 ? { gest: 'drink', gf: gestCyc(t) } : {}, 3);
  const p2 = tavGnome('woodcutter', 11, 'S', 'idle', (idle + 4) % IDLE_FRAMES, (t % 11) > 8.5 ? { gest: 'clap', gf: gestCyc(t * 1.4) } : {}, 3);
  const p3 = tavGnome('waitress', 1, 'S', 'idle', (idle + 1) % IDLE_FRAMES, (t % 13) > 10 ? { gest: 'wave', gf: gestCyc(t * 1.2) } : {}, 3);
  tavPut(c, p3, 118, 174, 3, false);
  tavPut(c, p2, 256, 174, 3, false);
  tavPut(c, p1, 302, 176, 3, true);
  // стол поверх ног сидящих и кружки на нём
  c.drawImage(Tav.bg, 222, 156, 98, 24, 222, 156, 98, 24);
  for (const x of [236, 284]) { c.fillStyle = '#d8d0c0'; c.fillRect(x, 148, 8, 8); c.fillStyle = '#fff8e8'; c.fillRect(x - 1, 146, 10, 3); c.fillStyle = '#a89878'; c.fillRect(x + 8, 150, 2, 4); }
  c.fillStyle = '#f0e6c8'; c.fillRect(268, 146, 3, 10); c.fillStyle = '#ffd25a'; c.fillRect(268, 143 + (Math.sin(t * 11) > 0 ? 0 : 1), 3, 3); c.fillStyle = '#fff6c0'; c.fillRect(269, 144, 1, 1);
  // фонари на балках
  const lamps = [[88, 40], [240, 40]];
  for (const [x, y] of lamps) {
    const sw = Math.sin(t * 1.3 + x) * 1.2;
    c.fillStyle = '#2a2018'; c.fillRect(x + 3 + sw * 0.5, 9, 1, y - 9);
    c.fillStyle = '#2a1e14'; c.fillRect(x + sw, y, 8, 2); c.fillRect(x + sw, y + 11, 8, 2); c.fillRect(x + sw, y, 1, 13); c.fillRect(x + 7 + sw, y, 1, 13);
    c.fillStyle = `rgb(255,${200 + fl * 40 | 0},120)`; c.fillRect(x + 1 + sw, y + 2, 6, 9); c.fillStyle = '#fff6d0'; c.fillRect(x + 3 + sw, y + 4, 2, 4);
  }
  // тёплый свет: очаг, фонари, свеча (сложением)
  c.save(); c.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, a, col) => { const g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  glow(fx, 104, 70 * fl, 0.32, '255,130,40');
  for (const [x, y] of lamps) glow(x + 4, y + 7, 46 * (0.9 + fl * 0.1), 0.26, '255,190,90');
  glow(269, 144, 24 * fl, 0.3, '255,200,100');
  glow(160, 30, 60, 0.06, '255,170,80');
  c.restore();
  // искры из очага и пылинки в свете фонарей
  if (Math.random() < 0.4) Tav.parts.push({ x: fx - 8 + Math.random() * 16, y: 104, vx: Math.random() * 10 - 5, vy: -26 - Math.random() * 18, a: 1, k: 'f' });
  if (Math.random() < 0.05) Tav.parts.push({ x: 60 + Math.random() * 200, y: 30 + Math.random() * 60, vx: Math.random() * 4 - 2, vy: Math.random() * 2 - 1, a: 0.8, k: 'd' });
  for (let i = Tav.parts.length - 1; i >= 0; i--) {
    const p = Tav.parts[i]; p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.a -= p.k === 'd' ? 0.004 : 0.014;
    if (p.a <= 0 || p.y < 40 && p.k === 'f') { Tav.parts.splice(i, 1); continue; }
    c.fillStyle = p.k === 'f' ? `rgba(255,${160 + (p.a * 90) | 0},40,${p.a})` : `rgba(255,240,200,${p.a * 0.5})`;
    c.fillRect(p.x | 0, p.y | 0, 1, 1);
  }
  // общий тёплый тон и мягкая виньетка
  c.fillStyle = `rgba(255,150,60,${0.05 * fl})`; c.fillRect(0, 0, 320, 180);
  const v = c.createRadialGradient(170, 95, 70, 170, 95, 210); v.addColorStop(0, 'rgba(20,8,0,0)'); v.addColorStop(1, 'rgba(20,8,0,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, 320, 180);
}


// ---------- Мастерская деда: траты камней на мету ----------
const RUN_SHOP = [
  { id: 'hp', name: 'Крепкая кожа', desc: '+10 здоровья за уровень', max: 5, cost: l => 6 + l * 4, kind: 'up' },
  { id: 'dmg', name: 'Точильный камень', desc: '+8% урона за уровень', max: 5, cost: l => 8 + l * 5, kind: 'up' },
  { id: 'choice', name: 'Зоркий глаз', desc: 'Четыре награды вместо трёх после этажа', max: 1, cost: () => 30, kind: 'up' },
  { id: 'xbow', name: 'Арбалет', desc: 'Стартовое оружие: бьёт издали', cost: () => 15, kind: 'weapon' },
  { id: 'staff', name: 'Посох', desc: 'Стартовое оружие: урон по площади', cost: () => 25, kind: 'weapon' },
];
function tavernShop() {
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;z-index:5;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto';
  Tav.el.appendChild(box);
  const draw = () => {
    const m = runMeta(), U = m.ups || {}, W = m.weapons || {};
    const row = it => {
      let state, can = false, act;
      if (it.kind === 'up') { const l = U[it.id] | 0; state = l >= it.max ? 'макс.' : `${it.cost(l)} 💎`; can = l < it.max && m.stones >= it.cost(l); act = `ur:${it.id}`; return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0"><span><b>${it.name}</b> ${l}/${it.max}<br><small>${it.desc}</small></span><button ${can ? '' : 'disabled'} data-tv="${act}" style="padding:5px 10px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;${can ? 'cursor:pointer' : 'opacity:.5'}">${state}</button></div>`; }
      const own = W[it.id], cur = m.weapon === it.id;
      state = cur ? 'в руках' : own ? 'взять' : `${it.cost()} 💎`; can = !cur && (own || m.stones >= it.cost());
      return `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0"><span><b>${it.name}</b><br><small>${it.desc}</small></span><button ${can ? '' : 'disabled'} data-tv="uw:${it.id}" style="padding:5px 10px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;${can ? 'cursor:pointer' : 'opacity:.5'}">${state}</button></div>`;
    };
    box.innerHTML = `<div style="background:#2a1a0e;border:2px solid #b8902c;border-radius:8px;padding:14px;max-width:420px;width:100%;color:#f1dfb0">
      <div style="font-size:18px;font-weight:700;margin-bottom:4px">Мастерская деда <span style="float:right;font-size:14px">💎 ${m.stones}</span></div>
      ${RUN_SHOP.map(row).join('')}
      <div style="margin:6px 0"><button data-tv="uw:pick"${m.weapon === 'pick' || !m.weapon ? 'disabled' : ''} style="padding:5px 10px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px">Вернуть кирку</button></div>
      <div style="text-align:right"><button id="shop-x" style="padding:6px 14px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer">Закрыть</button></div></div>`;
    box.querySelector('#shop-x').onclick = () => { box.remove(); tavernRender(); };
  };
  // кнопки через data-tv, а не onclick="…" в разметке: такие обработчики запрещает политика CSP сервера
  box.onclick = e => { const b = e.target.closest('[data-tv]'); if (!b || b.disabled) return; const [f, id] = b.dataset.tv.split(':'); if (f === 'ur') window.ur(id); else if (f === 'uw') window.uw(id); };
  window.ur = id => { const m = runMeta(), it = RUN_SHOP.find(x => x.id === id), U = m.ups = m.ups || {}, l = U[id] | 0; if (l >= it.max || m.stones < it.cost(l)) return; m.stones -= it.cost(l); U[id] = l + 1; runMetaSave(m); RSfx.play('pick'); draw(); };
  window.uw = id => { const m = runMeta(), W = m.weapons = m.weapons || {}; const it = RUN_SHOP.find(x => x.id === id); if (id !== 'pick' && !W[id]) { if (m.stones < it.cost()) return; m.stones -= it.cost(); W[id] = true; } m.weapon = id; runMetaSave(m); RSfx.play('pick'); draw(); };
  draw();
}

// ---------- клик по зданию в деревне ----------
{
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.type === 'squadtavern' && b.state === 'done') {
      const btn = `<button class="sq-open" style="margin:6px 0;padding:6px 12px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer">Войти в таверну</button>`;
      const i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + btn + h.slice(i) : h + btn;
    }
    return h;
  };
  // кнопка «Войти в таверну» без onclick в разметке (CSP); перехват на погружении — панель здания может гасить всплытие
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('.sq-open')) tavernOpen(); }, true);
}
