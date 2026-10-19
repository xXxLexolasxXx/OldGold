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
  { id: 'week', name: 'Недельный', floors: 5, mult: 1.2, weekly: true, desc: 'Один сид на всю неделю. Побей чужой рекорд.', say: 'Нынешняя неделя — одна на всех. Соревнуйся, а не ной.' },
];

function runMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(RUN_META_KEY)); } catch (e) { /* нет хранилища */ }
  m = m && typeof m === 'object' ? m : {};
  return Object.assign({ stones: 0, shards: 0, runs: 0, wins: 0, best: 0, cloak: 0, pal: 'warrior', weekBest: {}, hurtUntil: 0 }, m);
}
function runMetaSave(m) { try { localStorage.setItem(RUN_META_KEY, JSON.stringify(m)); } catch (e) { /* нет хранилища */ } }
function runWeekSeed() { const d = new Date(); const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); return Math.floor((t / 86400000 + 3) / 7); }  // неделя с понедельника

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
  if (!g) return true;                       // старые сохранения — открыто
  if (g.mode === 'scenario') return g.ch >= 3;   // глава 3 «Пиво вместо совести» пройдена
  return Game.buildings.some(b => b.type === 'brewery' && b.state === 'done');   // свободная игра: пивоварня стоит
}
setInterval(() => {
  try { if (Game && Game.buildings && !Game.unlocked.squad && squadTavernOpen()) unlockStage('squad'); } catch (e) { /* игра ещё не создана */ }
}, 2000);

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
    <div id="tav-say" style="position:absolute;left:50%;top:6%;transform:translateX(-10%);max-width:46%;background:#f4e6c0;color:#3a2410;border:2px solid #6a4a1a;border-radius:8px;padding:6px 10px;font-size:clamp(11px,1.6vw,15px);box-shadow:0 2px 8px #000a"></div>
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
  tavernRender();
  let last = performance.now();
  const loop = now => {
    if (!Tav.open) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tavernFrame(dt);
    Tav.raf = requestAnimationFrame(loop);
  };
  Tav.raf = requestAnimationFrame(loop);
}

function tavernClose() {
  if (!Tav.open) return;
  Tav.open = false; cancelAnimationFrame(Tav.raf);
  window.removeEventListener('keydown', Tav.keyH);
  if (Tav.el) Tav.el.remove();
  Tav.el = null;
  try { setSpeed(Tav.prevSpeed || 1); } catch (e) { /* без паузы */ }
}

function tavernRender() {
  const m = runMeta(), wk = runWeekSeed();
  const btn = 'background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:14px';
  const cards = Tav.el.querySelector('#tav-cards');
  const hurt = m.hurtUntil > Date.now();
  cards.innerHTML = RUN_DIFFS.map(d => {
    const locked = d.need === 'win' && !m.wins;
    const best = d.weekly ? (m.weekBest[wk] || 0) : 0;
    return `<button data-d="${d.id}" ${locked ? 'disabled' : ''} style="${btn};width:218px;text-align:left;${locked ? 'opacity:.45;cursor:default' : ''}">
      <b style="font-size:16px;display:block">${d.name}${locked ? ' 🔒' : ''}</b><small style="display:block">${locked ? 'Победите Малгора, чтобы открыть' : d.desc}</small>${best ? `<small style="display:block">Рекорд недели: ${best}</small>` : ''}</button>`;
  }).join('');
  cards.querySelectorAll('button[data-d]').forEach(b => {
    b.onmouseenter = () => { const d = RUN_DIFFS.find(x => x.id === b.dataset.d); if (d && !b.disabled) tavernSay(d.say); };
    b.onclick = () => { const d = RUN_DIFFS.find(x => x.id === b.dataset.d); if (d && !b.disabled) { tavernClose(); runStart(d); } };
  });
  const pal = RUN_PALS[m.pal];
  Tav.el.querySelector('#tav-bar').innerHTML =
    `<button id="tb-cloak" style="${btn}">Переодеться: плащ «${RUN_CLOAKS[m.cloak % RUN_CLOAKS.length][0]}»</button>
     <button id="tb-pal" style="${btn}">Напарник: ${pal[0]}</button>
     <button id="tb-arena" style="${btn};opacity:.6">Арена (скоро)</button>
     <span style="align-self:center;font-size:13px;opacity:.85">💎 ${m.stones} &nbsp; ◆ ${m.shards} &nbsp; Забегов: ${m.runs} · Побед: ${m.wins}${hurt ? ' · герой отлёживается' : ''}</span>`;
  Tav.el.querySelector('#tb-cloak').onclick = () => { const mm = runMeta(); mm.cloak = (mm.cloak + 1) % RUN_CLOAKS.length; runMetaSave(mm); tavernRender(); tavernSay('Красный тебе шёл, но вкус — дело хозяйское.'); };
  Tav.el.querySelector('#tb-pal').onclick = () => { const ks = Object.keys(RUN_PALS), mm = runMeta(); mm.pal = ks[(ks.indexOf(mm.pal) + 1) % ks.length]; runMetaSave(mm); tavernRender(); tavernSay(RUN_PALS[mm.pal][1] + '.'); };
  Tav.el.querySelector('#tb-arena').onclick = () => tavernSay('Арена? Там пока делают трибуны. Приходи позже.');
}

function tavernSay(text) { Tav.say = text; Tav.sayT = 6; Tav.el.querySelector('#tav-say').textContent = text; Tav.el.querySelector('#tav-say').style.display = 'block'; }

function tavernFrame(dt) {
  Tav.t += dt; Tav.sayT -= dt;
  if (Tav.sayT <= 0) {
    Tav.sayI = (Tav.sayI + 1) % Tav.lines.length;
    tavernSay(Tav.lines[Tav.sayI]); Tav.sayT = 5.5;
  }
  tavernDraw(Tav.cv.getContext('2d'), Tav.t);
}

// Сцена 320×180: стена, очаг, полки, стойка, хозяин. Всё собственной рисовкой.
function tavernDraw(c, t) {
  c.imageSmoothingEnabled = false;
  const fl = 0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.08;
  // стена и пол
  c.fillStyle = '#2a1a0e'; c.fillRect(0, 0, 320, 180);
  for (let y = 0; y < 110; y += 10) for (let x = (y / 10 % 2) * 12 - 12; x < 320; x += 24) { c.fillStyle = (x / 24 + y / 10) % 2 ? '#35210f' : '#2f1d0e'; c.fillRect(x, y, 23, 9); }
  for (let x = 0; x < 320; x += 20) { c.fillStyle = x / 20 % 2 ? '#4a3018' : '#43291a'; c.fillRect(x, 120, 20, 60); c.fillStyle = '#2a190c'; c.fillRect(x, 120, 1, 60); }
  c.fillStyle = '#1a0f08'; c.fillRect(0, 118, 320, 3);
  // балки
  c.fillStyle = '#4a2c14'; c.fillRect(0, 6, 320, 6); c.fillRect(70, 0, 6, 118); c.fillRect(244, 0, 6, 118);
  // очаг слева
  c.fillStyle = '#6a625a'; c.fillRect(14, 40, 52, 78); c.fillStyle = '#3a342e'; c.fillRect(22, 58, 36, 60);
  c.fillStyle = '#0c0604'; c.fillRect(26, 64, 28, 54);
  const g = c.createRadialGradient(40, 112, 2, 40, 104, 30 * fl); g.addColorStop(0, 'rgba(255,230,120,0.95)'); g.addColorStop(0.5, 'rgba(255,120,30,0.7)'); g.addColorStop(1, 'rgba(255,60,10,0)');
  c.fillStyle = g; c.fillRect(8, 60, 64, 60);
  for (let k = 0; k < 5; k++) { const fx = 30 + k * 5, h = 14 + Math.sin(t * 8 + k * 1.7) * 5 + (k === 2 ? 6 : 0); c.fillStyle = k % 2 ? '#ffb43c' : '#ff7a1e'; c.fillRect(fx, 114 - h, 4, h); c.fillStyle = '#ffe680'; c.fillRect(fx + 1, 114 - h * 0.55, 2, h * 0.55); }
  c.fillStyle = '#3a2410'; c.fillRect(26, 114, 28, 4);
  // отсветы на всю сцену от огня
  c.fillStyle = `rgba(255,140,40,${0.07 * fl})`; c.fillRect(0, 0, 320, 180);
  // полки с бочонками справа
  for (const [x, y] of [[255, 30], [255, 62]]) {
    c.fillStyle = '#5a3a1c'; c.fillRect(x, y + 20, 56, 4);
    for (let k = 0; k < 3; k++) { c.fillStyle = '#8a5a2a'; c.fillRect(x + 4 + k * 18, y + 4, 14, 16); c.fillStyle = '#b8902c'; c.fillRect(x + 4 + k * 18, y + 8, 14, 1); c.fillRect(x + 4 + k * 18, y + 15, 14, 1); }
  }
  // фонари
  for (const x of [112, 208]) {
    const sw = Math.sin(t * 1.3 + x) * 1.5;
    c.fillStyle = '#2a2018'; c.fillRect(x + sw, 12, 1, 14);
    c.fillStyle = '#3a2c1c'; c.fillRect(x - 4 + sw, 26, 9, 10);
    const lg = c.createRadialGradient(x + sw, 31, 1, x + sw, 31, 22); lg.addColorStop(0, `rgba(255,220,120,${0.85 * fl})`); lg.addColorStop(1, 'rgba(255,180,60,0)');
    c.fillStyle = lg; c.fillRect(x - 24, 8, 50, 46); c.fillStyle = '#ffe9a0'; c.fillRect(x - 2 + sw, 28, 5, 6);
  }
  // вывеска на стене: кружка и мечи
  c.fillStyle = '#6a4a1a'; c.fillRect(140, 38, 40, 26); c.fillStyle = '#d8c48a'; c.fillRect(142, 40, 36, 22);
  c.strokeStyle = '#7a8088'; c.lineWidth = 2; c.beginPath(); c.moveTo(148, 58); c.lineTo(172, 44); c.moveTo(172, 58); c.lineTo(148, 44); c.stroke();
  // стойка
  c.fillStyle = '#5a3a1c'; c.fillRect(96, 104, 128, 40); c.fillStyle = '#7a5226'; c.fillRect(92, 100, 136, 8);
  c.fillStyle = '#3a2410'; for (let x = 100; x < 224; x += 20) c.fillRect(x, 112, 1, 32);
  c.fillStyle = '#9a7036'; c.fillRect(92, 100, 136, 2);
  // хозяин: приземистый гном с огромной бородой, фартук
  const bob = Math.sin(t * 2) * 0.7, hx = 160;
  c.fillStyle = '#3a2a50'; c.fillRect(hx - 16, 82 + bob, 32, 24);                   // тело
  c.fillStyle = '#d8d0c0'; c.fillRect(hx - 12, 90 + bob, 24, 16);                  // фартук
  c.fillStyle = '#e8b890'; c.fillRect(hx - 9, 62 + bob, 18, 16);                   // лицо
  c.fillStyle = '#b0562a'; c.fillRect(hx - 10, 76 + bob, 20, 20);                  // борода
  c.fillStyle = '#c8663a'; c.fillRect(hx - 8, 76 + bob, 16, 16);
  c.fillStyle = '#8a3c1c'; for (let k = 0; k < 5; k++) c.fillRect(hx - 8 + k * 4, 88 + bob + (k % 2) * 2, 2, 8);
  c.fillStyle = '#1a1008'; c.fillRect(hx - 5, 68 + bob, 3, 3); c.fillRect(hx + 2, 68 + bob, 3, 3);   // глаза
  if (Math.sin(t * 0.9) > 0.96) { c.fillStyle = '#e8b890'; c.fillRect(hx + 2, 68 + bob, 3, 3); }          // подмигивает
  c.fillStyle = '#7a3a1c'; c.fillRect(hx - 7, 60 + bob, 14, 5);                    // брови/шапка
  c.fillStyle = '#4a2a60'; c.fillRect(hx - 11, 56 + bob, 22, 8); c.fillRect(hx - 8, 52 + bob, 16, 5);   // колпак
  // рука с кружкой: протирает
  const hand = Math.sin(t * 3.2) * 4;
  c.fillStyle = '#e8b890'; c.fillRect(hx + 12 + hand * 0.4, 94 + bob, 7, 6);
  c.fillStyle = '#d8d0c0'; c.fillRect(hx + 14, 90 + bob, 8, 10); c.fillStyle = '#a07a30'; c.fillRect(hx + 22, 93 + bob, 3, 5);
  c.fillStyle = '#f4ecd0'; c.fillRect(hx + 15, 88 + bob, 6, 2);
  // кружки на стойке
  for (const x of [112, 130, 192, 206]) { c.fillStyle = '#d8d0c0'; c.fillRect(x, 92, 8, 9); c.fillStyle = '#f4ecd0'; c.fillRect(x, 90, 8, 3); c.fillStyle = '#a07a30'; c.fillRect(x + 8, 94, 2, 4); }
  // пар/искры
  if (Math.random() < 0.3) Tav.parts.push({ x: 164 + Math.random() * 8, y: 86, vx: Math.random() * 6 - 3, vy: -12 - Math.random() * 6, a: 0.5, k: 's' });
  if (Math.random() < 0.4) Tav.parts.push({ x: 28 + Math.random() * 24, y: 100, vx: Math.random() * 10 - 5, vy: -28 - Math.random() * 20, a: 1, k: 'f' });
  for (let i = Tav.parts.length - 1; i >= 0; i--) {
    const p = Tav.parts[i]; p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.a -= 0.012;
    if (p.a <= 0) { Tav.parts.splice(i, 1); continue; }
    c.fillStyle = p.k === 's' ? `rgba(240,240,240,${p.a * 0.5})` : `rgba(255,${160 + (p.a * 90) | 0},40,${p.a})`;
    c.fillRect(p.x | 0, p.y | 0, p.k === 's' ? 2 : 1, p.k === 's' ? 2 : 1);
  }
  // виньетка
  const v = c.createRadialGradient(160, 90, 60, 160, 90, 200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = v; c.fillRect(0, 0, 320, 180);
}

// ---------- клик по зданию в деревне ----------
{
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.type === 'squadtavern' && b.state === 'done') {
      const btn = `<button class="sq-open" onclick="tavernOpen()" style="margin:6px 0;padding:6px 12px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer">Войти в таверну</button>`;
      const i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + btn + h.slice(i) : h + btn;
    }
    return h;
  };
}
