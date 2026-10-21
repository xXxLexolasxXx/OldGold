'use strict';
let PLANK_TEX = null;
// Левая колонка: вкладки, строительство, склад, жители, хозяйство, меню и окно здания.

const UI = { cat: 0, tab: 'build', hoverType: null, last: {}, bicons: {} };

// ---------- Мелочи ----------

let toastN = 0;
function toastKind(text) {   // тип оповещения → цвет печати: night / imp / (coop приходит аргументом)
  if (/ноч|призрак|нечист|сов[аы] |мыш|Малгор|гоблин|тёмн/i.test(text)) return 'night';
  if (/достиг уровня|веха|погиб|упал от голода|Мало памяти|не выполнен|Победа|Поражение/i.test(text)) return 'imp';
  return '';
}
function toastClose(el) { if (!el || !el.parentNode || el.classList.contains('burn')) return; el.classList.add('burn'); setTimeout(() => el.remove(), 320); }
function toast(text, target, kind) {
  const box = document.getElementById('toasts');
  if (!box) return;
  if (box.childElementCount > 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast v' + (toastN++ % 3) + (target ? ' link' : '') + ' ' + (kind || toastKind(String(text)));
  el.textContent = text;
  el.onclick = () => { if (target) focusBuilding(target); toastClose(el); };
  box.appendChild(el);
  // чем длиннее текст, тем дольше висит; на телефоне — заметно дольше; уходит «сгоранием», а не щелчком
  const mob = document.body.classList.contains('mobile');
  // важное (поход, зима, голод, золото школы) висит заметно дольше
  const keep = /поход|Зим|Осень|голод|школ.*золот|золот.*школ|Малгор|Победа|Поражение/i.test(String(text)) ? 1.7 : 1;
  setTimeout(() => toastClose(el), keep * Math.max(mob ? 7000 : 4500, 2800 + String(text).length * (mob ? 110 : 70)));
}

function focusBuilding(b) {
  if (!b || b.removed) return;
  selectBuilding(b);
  centerOn((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE);
}

const gi = (g, cls = '') => `<img class="${cls}" src="${iconURL('good', g, 2)}" alt="" data-g="${g}" title="${GOODS[g].name}">`;
const ui = n => `<img src="${iconURL('ui', n, 2)}" alt="">`;

function costHTML(cost) {
  return '<div class="cost">' + Object.entries(cost).filter(([, n]) => n)
    .map(([g, n]) => `<span>${gi(g)}${n}</span>`).join('') + '</div>';
}

// Иконка здания: обрезаем прозрачные поля спрайта и плавно уменьшаем.
function buildingIconURL(type) {
  if (UI.bicons[type]) return UI.bicons[type];
  const spr = buildingSprite(type).canvas;
  const c0 = spr.getContext('2d');
  const d = c0.getImageData(0, 0, spr.width, spr.height).data;
  let x0 = spr.width, y0 = spr.height, x1 = 0, y1 = 0;
  for (let y = 0; y < spr.height; y++) for (let x = 0; x < spr.width; x++) {
    if (d[(y * spr.width + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const k = Math.min(144 / w, 108 / h);
  const cv = mkCanvas(144, 108), c = cv.getContext('2d');
  c.imageSmoothingEnabled = k < 1;
  c.imageSmoothingQuality = 'high';
  c.drawImage(spr, x0, y0, w, h, (144 - w * k) / 2, 108 - h * k, w * k, h * k);
  UI.bicons[type] = cv.toDataURL();
  return UI.bicons[type];
}

function makeUITextures() {
  const wood = mkCanvas(128, 128), w = wood.getContext('2d');
  const r = mulberry32(5);
  w.fillStyle = '#2a1e14'; w.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x++) {
    const v = Math.sin(x * 0.18) * 0.5 + Math.sin(x * 0.53 + 1) * 0.3 + (r() - 0.5) * 0.7;
    w.fillStyle = v > 0 ? `rgba(110,78,46,${v * 0.22})` : `rgba(6,4,2,${-v * 0.3})`;
    w.fillRect(x, 0, 1, 128);
  }
  for (let k = 0; k < 18; k++) { w.fillStyle = 'rgba(8,5,2,0.35)'; w.fillRect((r() * 128) | 0, 0, 1, 128); }
  for (let y = 0; y < 128; y += 32) { w.fillStyle = 'rgba(0,0,0,0.35)'; w.fillRect(0, y, 128, 1); w.fillStyle = 'rgba(255,220,160,0.05)'; w.fillRect(0, y + 1, 128, 1); }
  document.documentElement.style.setProperty('--wood-tex', `url(${wood.toDataURL()})`);

  // Горизонтальные доски (пиксель-арт, 1 пиксель = 1 px экрана): ряд 16 px = доска 12 + тень + зазор 3.
  // У каждой доски своя рампа тона, волокна с бликом, сучки, выщербины и дыры, широкие зазоры,
  // гвозди: обычные, пара гнутых и пара вбитых криво. Плитка бесшовная.
  const PW = 384, PH = 384;
  const pl = mkCanvas(PW, PH), p = pl.getContext('2d');
  const q = mulberry32(31);
  const RN = n => (q() * n) | 0;
  const tones = [[150, 104, 58], [136, 94, 52], [160, 114, 66], [142, 100, 56], [168, 122, 72], [124, 86, 48]];
  const ramp = (c, f) => `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;
  const FR = [0.5, 0.66, 0.8, 0.92, 1.04, 1.2, 1.42];
  const px = (x, y, col, w = 1, h = 1) => {
    p.fillStyle = col; x = ((x % PW) + PW) % PW; y = ((y % PH) + PH) % PH;
    p.fillRect(x, y, w, h); if (x + w > PW) p.fillRect(x - PW, y, w, h);
  };
  const DARK = '#070402', BACK = '#150c06';
  const nails = [];
  for (let row = 0; row < PH / 16; row++) {
    const y0 = row * 16;
    // фон под досками виден в зазорах
    px(0, y0 + 13, BACK, PW, 3); px(0, y0 + 14, DARK, PW, 2);
    let x = RN(120) - 60; const first = x;
    while (x < first + PW) {
      const len = Math.min(first + PW - x, 80 + RN(120));
      const c = tones[RN(tones.length)];
      // зерно: полосы разной длины вдоль доски
      for (let yy = 0; yy < 12; yy++) {
        let xx = 0;
        while (xx < len) {
          const run = 2 + RN(9), t = q();
          const k = (yy < 2 ? 1 : 0) + (t < 0.12 ? 1 : t < 0.5 ? 2 : t < 0.86 ? 3 : 4);
          px(x + xx, y0 + yy, ramp(c, FR[Math.min(k, 5)]), Math.min(run, len - xx), 1);
          xx += run;
        }
      }
      // волокна: волнистые тёмные нити с бликом под ними
      for (let g = 0, n = 3 + (len / 28 | 0); g < n; g++) {
        const gy = y0 + 2 + RN(8), ph = q() * 6, amp = 0.4 + q() * 1.3, gx = x + RN(len), gl = 24 + RN(90), fr = 0.06 + q() * 0.08;
        for (let k = 0; k < gl && gx + k < x + len - 1; k++) {
          const yy = gy + Math.round(Math.sin(k * fr + ph) * amp);
          if (yy > y0 && yy < y0 + 11) { px(gx + k, yy, ramp(c, FR[0] * 0.85)); if (q() < 0.8) px(gx + k, yy + 1, ramp(c, FR[5])); }
        }
      }
      // сучок с кольцами; иногда выпавший — сквозная дыра
      if (len > 100 && q() < 0.6) {
        const kx = x + 18 + RN(len - 36), ky = y0 + 4 + RN(4);
        for (let r = 4; r >= 1; r--) {
          for (let a = 0; a < 40; a++) {
            const an = a / 40 * 6.283, ex = Math.round(Math.cos(an) * r * 2), ey = Math.round(Math.sin(an) * r * 0.95);
            px(kx + ex, ky + ey, ramp(c, r % 2 ? FR[0] * 0.8 : FR[5]));
          }
        }
        px(kx - 1, ky, ramp(c, 0.4), 3, 1);
        if (q() < 0.5) { px(kx - 2, ky - 1, DARK, 5, 3); px(kx - 3, ky, DARK, 7, 1); px(kx - 1, ky + 2, BACK, 3, 1); }
      }
      // фаски: блик сверху, тень снизу
      px(x, y0, ramp(c, FR[6]), len, 1);
      px(x, y0 + 11, ramp(c, 0.55), len, 1);
      px(x, y0 + 12, ramp(c, 0.32), len, 1);
      // выщербины по нижнему и верхнему краю — рваные откусы
      for (let n = 1 + RN(3); n > 0; n--) {
        const bx = x + 4 + RN(Math.max(1, len - 20)), bw = 4 + RN(12), fromTop = q() < 0.4, bh = 2 + RN(4);
        for (let k = 0; k < bw; k++) {
          const hh = Math.max(1, Math.round(bh * Math.sin((k + 0.5) / bw * Math.PI) * (0.6 + q() * 0.6)));
          if (fromTop) px(bx + k, y0, DARK, 1, hh); else px(bx + k, y0 + 12 - hh + 1, DARK, 1, hh);
          if (!fromTop) px(bx + k, y0 + 12 - hh, ramp(c, 1.3));   // свежий светлый скол
        }
      }
      // сквозная дыра посреди доски (щель)
      if (q() < 0.22) { const hx = x + 10 + RN(Math.max(1, len - 24)), hw = 3 + RN(6); px(hx, y0 + 3 + RN(4), DARK, hw, 2 + RN(2)); }
      // торцевой стык: широкий зазор, видна светлая торцевая грань
      px(x, y0, DARK, 3, 13); px(x + 3, y0 + 1, ramp(c, 1.25), 1, 11);
      nails.push([x + 8, y0 + 3], [x + 8, y0 + 8], [x + len - 8, y0 + 3], [x + len - 8, y0 + 8]);
      x += len;
    }
    // дополнительные широкие зазоры и сорванные куски между рядами
    for (let n = 3 + RN(3); n > 0; n--) { const gx = RN(PW), gw = 4 + RN(14); px(gx, y0 + 11, DARK, gw, 4); px(gx + 1, y0 + 10, DARK, Math.max(1, gw - 3), 1); }
  }
  // гвозди: прямые, гнутые (торчат, шляпки нет) и вбитые криво. Гнутые — только у нижнего гвоздя доски: ему есть куда торчать.
  const O = '#0c0805', ST = '#b4aea0', STH = '#f0ead8', STD = '#6a665c';
  nails.forEach(([nx, ny], i) => {
    const low = i % 4 === 1 || i % 4 === 3;
    if (low && i % 9 === 1) {
      // гнутый: стержень торчит из дырки, на высоте 6 px переламывается и уходит вбок остриём вниз
      px(nx - 2, ny + 2, 'rgba(0,0,0,0.7)', 6, 1); px(nx - 1, ny + 1, O, 3, 1);                       // вмятина
      for (let k = 0; k < 6; k++) { px(nx - 1, ny - k, O); px(nx + 1, ny - k, O); px(nx, ny - k, k % 2 ? ST : STH); }
      px(nx - 1, ny - 6, O, 3, 1);
      px(nx + 1, ny - 6, O); px(nx + 1, ny - 7, O, 4, 1); px(nx + 1, ny - 6, STH, 4, 1);                  // излом, дальше вбок
      px(nx + 4, ny - 6, O, 2, 1); px(nx + 4, ny - 5, ST); px(nx + 5, ny - 6, ST); px(nx + 5, ny - 5, O); px(nx + 4, ny - 4, O);  // остриё вниз
      px(nx + 3, ny - 5, STD);
    } else if (i % 9 === 5) {
      // вбитый криво: шляпка перекошена и наполовину в доске, рядом трещина и приподнятая щепка
      px(nx - 2, ny + 2, 'rgba(0,0,0,0.65)', 7, 1);
      px(nx - 2, ny + 1, O, 2, 1); px(nx - 1, ny, O); px(nx - 2, ny, STD); px(nx - 1, ny, STD);
      px(nx, ny - 1, STH); px(nx + 1, ny - 1, ST); px(nx + 1, ny - 2, STH); px(nx + 2, ny - 2, ST); px(nx + 3, ny - 3, STH); px(nx + 3, ny - 2, STD);
      px(nx, ny, STD); px(nx + 1, ny, O); px(nx + 2, ny - 1, O); px(nx + 4, ny - 3, O); px(nx + 4, ny - 2, O);
      px(nx - 3, ny + 1, DARK); px(nx - 4, ny + 2, DARK); px(nx - 5, ny + 3, DARK); px(nx + 5, ny + 1, 'rgba(255,230,180,0.5)', 2, 1); px(nx + 4, ny + 2, 'rgba(255,230,180,0.4)');
    } else {
      px(nx - 1, ny + 2, 'rgba(0,0,0,0.65)', 4, 1);
      px(nx - 1, ny - 1, STD, 3, 3); px(nx - 1, ny - 1, STH); px(nx, ny - 1, ST); px(nx - 1, ny, ST); px(nx + 1, ny + 1, O); px(nx, ny, ST);
    }
  });
  document.documentElement.style.setProperty('--plank-tex', `url(${pl.toDataURL()})`);
  PLANK_TEX = pl;   // те же доски — на строительных лесах (js/levels.js)

  // Кожа для верхней строки: пиксельная выделка, морщины, поры; по кромке — медные заклёпки
  const LW = 96, LH = 96;
  const lc = mkCanvas(LW, LH), l = lc.getContext('2d');
  const lq = mulberry32(47);
  const LB = [122, 78, 44], LR = [0.55, 0.7, 0.84, 0.96, 1.08, 1.2];
  const lcol = (f) => `rgb(${Math.min(255, LB[0] * f) | 0},${Math.min(255, LB[1] * f) | 0},${Math.min(255, LB[2] * f) | 0})`;
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    // низкочастотная «выделка» + зерно; ячейки 1–2 px
    const w = Math.sin(x * 0.11 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(y * 0.13 + x * 0.03) * 0.5;
    const t = lq() * 0.9 + w * 0.25;
    l.fillStyle = lcol(LR[t < 0.18 ? 1 : t < 0.5 ? 2 : t < 0.85 ? 3 : t < 1.1 ? 4 : 5]);
    l.fillRect(x, y, 1, 1);
  }
  for (let k = 0; k < 14; k++) {   // морщины: короткие изогнутые тёмные штрихи со светлой кромкой
    let cx = (lq() * LW) | 0, cy = (lq() * LH) | 0; const dir = lq() * 6.28, len = 8 + ((lq() * 20) | 0), bend = (lq() - 0.5) * 0.25;
    for (let i = 0, a = dir; i < len; i++, a += bend) {
      cx += Math.cos(a); cy += Math.sin(a);
      l.fillStyle = lcol(LR[0] * 0.9); l.fillRect(((cx | 0) + LW) % LW, ((cy | 0) + LH) % LH, 1, 1);
      if (i % 2) { l.fillStyle = lcol(LR[5]); l.fillRect(((cx | 0) + LW) % LW, (((cy | 0) + 1) + LH) % LH, 1, 1); }
    }
  }
  for (let k = 0; k < 90; k++) { l.fillStyle = lcol(LR[0] * 0.8); l.fillRect((lq() * LW) | 0, (lq() * LH) | 0, 1, 1); }   // поры
  document.documentElement.style.setProperty('--leather-tex', `url(${lc.toDataURL()})`);
  // заклёпка 8×8 (шляпка 3×3 с ободком); ряды по кромке растянуты `space`, поэтому по углам заклёпки ложатся ровно
  // на одно и то же место (первая плитка рядов — в углу), без наслоения и обрезанных половинок
  const rv = mkCanvas(8, 8), r2 = rv.getContext('2d');
  const rp = (x, y, c, w = 1, h = 1) => { r2.fillStyle = c; r2.fillRect(x, y, w, h); };
  rp(2, 2, 'rgba(0,0,0,0.55)', 5, 5);                  // тень
  rp(1, 1, '#4a2c08', 5, 5);                           // ободок
  rp(2, 2, '#c8902a', 3, 3); rp(2, 2, '#fff2b8'); rp(3, 2, '#f4d060'); rp(2, 3, '#f4d060'); rp(4, 4, '#8a5a14');
  const rvUrl = `url(${rv.toDataURL()})`;
  document.documentElement.style.setProperty('--leather',
    `${rvUrl} space no-repeat left top, ${rvUrl} space no-repeat left bottom, ${rvUrl} no-repeat space left top, ${rvUrl} no-repeat space right top, ` +
    `linear-gradient(rgba(255,220,160,0.06), rgba(0,0,0,0.22)), var(--leather-tex), #5a3a20`);
}

function setTool(tool) {
  Game.tool = tool;
  R.roadDrag = null;
  document.querySelectorAll('.bbtn, .tools button').forEach(b => b.classList.remove('active'));
  mobileTool(tool);
  toolHint(tool);
  if (!tool) { R.hover = null; return; }
  if (tool.kind === 'build') document.querySelector(`.bbtn[data-type="${tool.type}"]`)?.classList.add('active');
  if (tool.kind === 'road') document.getElementById('tool-road').classList.add('active');
  if (tool.kind === 'erase') document.getElementById('tool-erase').classList.add('active');
  if (tool.kind === 'field') document.getElementById('tool-' + tool.crop)?.classList.add('active');
}

function setSpeed(s) {
  Game.paused = s === 0;
  if (s) Game.speed = SPEEDS.includes(s) ? s : 1;      // 0,5 / 1 / 2 / 3 (старое ×4 из сохранений и скриптов — обычная скорость)
  tempoShow();
}

// Выпадающие панели верхней строки: одна открыта за раз, закрываются по клику мимо и по Esc
function initDropdowns() {
  const all = [...document.querySelectorAll('#topbar .dd')];
  const closeAll = except => all.forEach(d => { if (d !== except) d.classList.remove('open'); });
  for (const d of all) {
    const t = d.querySelector('.dd-t');
    t.addEventListener('click', e => { e.stopPropagation(); closeAll(d); d.classList.toggle('open'); });
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#topbar .dd')) closeAll(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  // выбор скорости закрывает панель — кнопка сама показывает текущую
  document.querySelectorAll('#dd-speed [data-speed]').forEach(b => b.addEventListener('click', () => closeAll()));
}

// Меню → «Выйти в главное меню»: одиночная игра сохраняется в автосохранение и открывается стартовый экран
// («Продолжить» вернёт туда же); в общей деревне — просто выходим из неё.
function exitToMainMenu() {
  if (typeof Coop !== 'undefined' && Coop.on && typeof coopLeaveGame === 'function') {
    if (confirm('Выйти из общей деревни в главное меню?')) coopLeaveGame();
    return;
  }
  if (!confirm('Выйти в главное меню? Игра сохранится в автосохранение.')) return;
  let ok = false;
  try { ok = saveGame('auto'); } catch (e) { console.error(e); }
  if (!ok && !confirm('Не удалось сохранить игру. Всё равно выйти?')) return;
  location.reload();
}

function openTab(name) {
  UI.tab = name;
  document.querySelectorAll('#tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  updateUI(true);
}

function openBuildCat(k) {
  if (!(k >= 0 && k < BUILD_CATS.length) || !visibleCats().includes(k)) return;
  UI.cat = k;
  openTab('build');
  renderBuildList();
}

function queueTraining(type) {
  const schools = Game.buildings.filter(b => b.type === 'school' && b.state === 'done');
  if (!schools.length) { toast('Нет готовой школы'); return; }
  schools.sort((a, b) => a.queue.length - b.queue.length);
  if (schools[0].queue.length >= 10) { toast('Очередь в школе заполнена'); return; }
  schools[0].queue.push(type);
  toast(`В школу: ${UNIT_TYPES[type].name}`);
}

// ---------- Постепенное открытие меню ----------

const UNLOCK_NAMES = { res: 'Ресурсы', grain: 'Зерно и хлеб', hops: 'Хмель и пиво', inn2: 'Второй трактир', pigs: 'Свиньи и мясо', base: 'Хозяйство', craft: 'Ремесло', metal: 'Плавка золота', magic: 'Магия' };

function allUnlocked() { return Object.fromEntries(UNLOCKS.map(u => [u.id, true])); }

function isUnlocked(item) {
  const st = UNLOCKS.find(u => u.items.includes(item));
  return !st || !!Game.unlocked[st.id];
}

function menuItemShown(type) {
  const d = BUILDINGS[type];
  return !d.hidden && !d.noMenu && isUnlocked(type);
}

function unlockStage(id, quiet) {
  if (Game.unlocked[id]) return;
  Game.unlocked[id] = true;
  if (!quiet) toast('Открыто в меню: ' + UNLOCK_NAMES[id]);
  renderBuildMenu();
}

function unlockAll() {
  Game.unlocked = allUnlocked();
  for (const b of Game.buildings) b.hold = false;
  UI.shown = null;
  renderBuildMenu();
}

// Каждая следующая стадия открывается, когда достроено всё из предыдущей
function checkUnlocks() {
  for (const st of UNLOCKS) {
    if (Game.unlocked[st.id] || !st.after) continue;
    if (unlockReady(st)) unlockStage(st.id);
  }
}

// Вкладки с хотя бы одной открытой позицией (индексы в BUILD_CATS)
function visibleCats() {
  return BUILD_CATS.map((c, k) => k).filter(k => buildTypesIn(BUILD_CATS[k]).length);
}
function buildTypesIn(cat) { return BUILD_ORDER.filter(t => BUILDINGS[t].cat === cat && menuItemShown(t)); }

function renderBuildMenu() {
  const vis = visibleCats();
  if (!vis.includes(UI.cat) && vis.length) UI.cat = vis[0];
  const all = new Set(BUILD_ORDER.filter(menuItemShown));
  for (const crop of ['wheat', 'hops']) if (isUnlocked('tool:' + crop)) all.add('tool:' + crop);
  const fresh = UI.shown ? [...all].filter(t => !UI.shown.has(t)) : [];
  UI.shown = all;
  // вкладки: новые появляются плавно, остальные остаются на месте
  const box = document.getElementById('build-cats');
  UI.catEls = UI.catEls || {};
  for (const k of vis) {
    const name = BUILD_CATS[k];
    let b = UI.catEls[name];
    if (!b) {
      b = UI.catEls[name] = document.createElement('button');
      b.textContent = name;
      b.onclick = () => openBuildCat(k);
      if (UI.shown && UI.catsReady) { b.classList.add('enter'); b.addEventListener('animationend', () => b.classList.remove('enter'), { once: true }); }
    }
    b.title = name;
    b.dataset.cat = name;
    box.appendChild(b);                          // повторная вставка выстраивает порядок
  }
  for (const name in UI.catEls) if (!vis.some(k => BUILD_CATS[k] === name)) { UI.catEls[name].remove(); delete UI.catEls[name]; }
  UI.catsReady = true;
  // инструменты полей
  for (const crop of ['wheat', 'hops']) {
    const btn = document.getElementById('tool-' + crop), on = isUnlocked('tool:' + crop);
    btn.classList.toggle('locked', !on);
    if (on && fresh.includes('tool:' + crop)) { btn.classList.add('enter'); btn.addEventListener('animationend', () => btn.classList.remove('enter'), { once: true }); }
  }
  UI.fresh = fresh;
  renderBuildList();
  UI.fresh = [];
}

// ---------- Инициализация ----------

function initUI() {
  makeUITextures();
  document.querySelectorAll('img[data-icon]').forEach(im => { im.src = iconURL('ui', im.dataset.icon, 2); });

  document.querySelectorAll('#tabs .tab-btn').forEach(btn => { btn.onclick = () => Mobile.on ? mobileTab(btn.dataset.tab) : openTab(btn.dataset.tab); });

  renderBuildMenu();
  setInterval(checkUnlocks, 500);

  document.getElementById('tool-road').onclick = () => setTool(Game.tool && Game.tool.kind === 'road' ? null : { kind: 'road' });
  document.getElementById('tool-erase').onclick =() => setTool(Game.tool && Game.tool.kind === 'erase' ? null : { kind: 'erase' });
  for (const [crop, label] of [['wheat', 'Пшеница'], ['hops', 'Хмель']]) {
    const btn = document.getElementById('tool-' + crop);
    btn.innerHTML = gi(crop) + label;
    btn.onclick = () => setTool(Game.tool && Game.tool.kind === 'field' && Game.tool.crop === crop ? null : { kind: 'field', crop });
  }

  document.querySelectorAll('[data-speed]').forEach(btn => { btn.onclick = () => { const s = +btn.dataset.speed; if (!s) togglePause(); else pickSpeed(SPEEDS.indexOf(s)); }; });
  initDropdowns();
  setSpeed(Game.paused ? 0 : Game.speed || 1);
  document.getElementById('help-close').onclick = () => document.getElementById('help').classList.add('hidden');

  document.querySelector('#tab-menu').addEventListener('click', e => {
    const t = e.target.closest('[data-menu]');
    if (!t) return;
    const m = t.dataset.menu;
    track('menu-' + m, { save: 'Сохранил игру', load: 'Загрузил сохранение', loadauto: 'Загрузил автосохранение', new: 'Открыл «Новая карта»', help: 'Открыл «Как играть»' }[m]);
    if (m === 'save') toast(saveGame('manual') ? 'Игра сохранена' : 'Не удалось сохранить');
    if (m === 'load') { if (loadGame('manual')) { toast('Игра загружена'); updateUI(true); } else toast('Сохранения нет'); }
    if (m === 'loadauto') { if (loadGame('auto')) { toast('Загружено автосохранение'); updateUI(true); } else toast('Автосохранения пока нет'); }
    if (m === 'new' && confirm('Начать на новой карте? Несохранённый прогресс пропадёт.')) newGame();
    if (m === 'help') document.getElementById('help').classList.toggle('hidden');
    if (m === 'lang') I18N.toggle();
    if (m === 'lang') I18N.toggle();
    if (m === 'tutorial') { if (Mobile.on) mobileSheet(null); tutStart(); }
    if (m === 'mainmenu') exitToMainMenu();
    updateUI(true);
  });

  // склад: клик по слоту — запретить/разрешить приём
  document.getElementById('store-list').addEventListener('click', e => {
    const s = e.target.closest('[data-block]');
    if (!s) return;
    const g = s.dataset.block;
    Game.storeBlock[g] = !Game.storeBlock[g];
    toast(Game.storeBlock[g] ? `Склады не принимают: ${GOODS[g].name}` : `Склады снова принимают: ${GOODS[g].name}`);
    updateUI(true);
  });

  document.getElementById('people-list').addEventListener('click', e => {
    const t = e.target.closest('[data-train]');
    if (t) { queueTraining(t.dataset.train); updateUI(true); }
  });

  document.getElementById('overview').addEventListener('click', e => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    const b = Game.buildings.find(x => x.id === +a.dataset.goto);
    if (b) focusBuilding(b);
  });

  document.getElementById('log-list').addEventListener('click', e => {
    const f = e.target.closest('[data-logf]');
    if (f) { UI.logFilter = f.dataset.logf; updateUI(true); return; }
    const r = e.target.closest('[data-logx]');
    if (!r) return;
    const x = +r.dataset.logx, y = +r.dataset.logy;
    centerOn(x * TILE, y * TILE);
    UI.logMark = { x, y, at: performance.now() };
    if (Mobile.on) mobileSheet(null);
  });

  const info = document.getElementById('info');
  info.addEventListener('click', e => {
    const t = e.target.closest('button, [data-untrain-at], [data-block]');
    if (!t) return;
    const b = Game.selected;
    if (!b || b.removed) return;
    const act = t.dataset.act;
    if (t.dataset.train) { if (b.queue.length < 10) b.queue.push(t.dataset.train); }
    else if (t.dataset.untrainAt) b.queue.splice(+t.dataset.untrainAt, 1);
    else if (act === 'untrainall') b.queue.length = 0;
    else if (act === 'demolish') {
      if (b.isRoad) removeRoadSite(b);
      else if (b.state !== 'done' || confirm(`Снести «${b.def.name}»?`)) removeBuilding(b);
      Game.selected = null;
    }
    else if (act === 'pause') b.paused = !b.paused;
    else if (act === 'upgrade') startUpgrade(b);
    else if (act === 'upgcancel') cancelUpgrade(b);
    else if (act === 'deliver') toggleDeliver(b);
    else if (act === 'festival') { if (!festOn()) { const bad = festivalStart('manual'); if (bad) toast(bad); } }
    else if (act === 'goto') focusBuilding(b);
    else if (act === 'herobuild') heroHelpBuild(b);
    else if (act === 'prev') cycleBuilding(-1);
    else if (act === 'next') cycleBuilding(1);
    else if (act === 'hire') queueTraining(b.def.worker);
    else if (t.dataset.block) Game.storeBlock[t.dataset.block] = !Game.storeBlock[t.dataset.block];
    updateUI(true);
  });
  info.addEventListener('change', e => {
    const t = e.target;
    const b = Game.selected;
    if (t.dataset.recipe !== undefined && b) { b.recipeOn[+t.dataset.recipe] = t.checked; updateUI(true); }
    if (t.dataset.crop && b) { b.crops[t.dataset.crop] = t.checked; updateUI(true); }
  });
}

function renderBuildList() {
  document.querySelectorAll('#build-cats button').forEach(b => b.classList.toggle('active', b.dataset.cat === BUILD_CATS[UI.cat]));
  const list = document.getElementById('build-list');
  list.innerHTML = '';
  for (const type of buildTypesIn(BUILD_CATS[UI.cat])) {
    const def = BUILDINGS[type];
    const btn = document.createElement('button');
    btn.className = 'bbtn';
    if ((UI.fresh || []).includes(type)) { btn.classList.add('enter'); btn.addEventListener('animationend', () => btn.classList.remove('enter'), { once: true }); }
    btn.dataset.type = type;
    btn.innerHTML = `<img class="bimg" src="${buildingIconURL(type)}" alt=""><span class="bname">${def.name}</span>${costHTML(def.cost)}`;
    btn.onclick = () => setTool(Game.tool && Game.tool.type === type ? null : { kind: 'build', type, rot: def.noRotate || def.rots ? 0 : (UI.lastRot || 0) });
    btn.onmouseenter = () => { if (Mobile.on) return; UI.hoverType = type; updateUI(true); };
    btn.onmouseleave = () => { UI.hoverType = null; updateUI(true); };
    if (Game.tool && Game.tool.type === type) btn.classList.add('active');
    list.appendChild(btn);
  }
}

// ---------- Содержимое вкладок ----------

function totals() {
  const t = emptyGoods();
  for (const b of Game.buildings) if (b.isStore()) for (const g of GOOD_KEYS) t[g] += b.stock[g];
  return t;
}

// «Запасы и запреты»: числа — в строке ресурсов сверху, здесь только что склады принимают и куда идёт запас.
// Показываем товары, которые деревня уже видела (есть, производились или запрещены) — без пустых клеток «на вырост».
function storeHTML() {
  const t = totals(), r = typeof rates === 'function' ? rates() : null, P = Game.produced || {};
  let h = '<div class="muted small">Касание по товару — запретить складам его принимать (или снова разрешить). Стрелка — запас растёт или тает. Сколько чего — в строке ресурсов сверху.</div>';
  for (const grp of GOOD_GROUPS) {
    const gs = GOOD_KEYS.filter(g => GOODS[g].group === grp && !GOODS[g].noStore && (t[g] || P[g] || Game.storeBlock[g]));
    if (!gs.length) continue;
    h += `<div class="group-title">${grp}</div><div class="slots">`;
    for (const g of gs) {
      const x = r && r[g], net = x ? x.prod - x.cons : 0;
      const fl = net > 0.3 ? '<span class="fl up">▲</span>' : net < -0.3 ? '<span class="fl dn">▼</span>' : '';
      h += `<div class="slot click${t[g] ? '' : ' zero'}${Game.storeBlock[g] ? ' blocked' : ''}" data-block="${g}" title="${GOODS[g].name}: ${t[g]}${Game.storeBlock[g] ? ' — склады не принимают' : ''}">${gi(g)}${fl}</div>`;
    }
    h += '</div>';
  }
  return h;
}

function peopleHTML() {
  const cnt = {}, idle = {}, queued = {};
  let hungry = 0, smoking = 0, sleeping = 0, hurt = 0;
  for (const u of Game.units) {
    cnt[u.type] = (cnt[u.type] || 0) + 1;
    if (u.idleFlag || (!u.home && !u.isCourier && u.type !== 'builder')) idle[u.type] = (idle[u.type] || 0) + 1;
    if (!u.noFood && u.food < HUNGRY) hungry++;
    if (u.brk && u.brk.kind === 'sleep') sleeping++;
    else if (u.brk) smoking++;
    if (u.injury) hurt++;
  }
  for (const b of Game.buildings) if (b.type === 'school') {
    for (const q of b.queue) queued[q] = (queued[q] || 0) + 1;
    if (b.training) queued[b.training.type] = (queued[b.training.type] || 0) + 1;
  }
  let h = `<div class="stat-row"><b>Всего жителей</b><span class="v">${Game.units.length}</span></div>`;
  if (hungry) h += `<div class="stat-row warn">Голодных: ${hungry}</div>`;
  if (smoking) h += `<div class="stat-row muted">На перекуре: ${smoking}</div>`;
  if (sleeping) h += `<div class="stat-row warn">Спят пьяные: ${sleeping}</div>`;
  if (hurt) h += `<div class="stat-row warn">Травмированы: ${hurt}</div>`;
  for (const k of ALL_UNIT_KEYS) {
    const c = cnt[k] || 0;
    const T = UNIT_TYPES[k];
    if (T.noTrain && !c) continue;
    h += `<div class="prow"><img class="portrait" src="${portraitURL(k)}" alt="">
      <div><div class="pn">${T.name}</div><div class="muted small">${idle[k] ? `свободно: ${idle[k]}` : c ? 'все заняты' : 'нет'}${queued[k] ? ` · учится: ${queued[k]}` : ''}</div></div>
      <span class="pc">${c}</span><span></span></div>`;   // учить — кнопками в окне школы, без дубля здесь
    if (c && LEVEL_XP[k]) h += levelsHTML(k);
  }
  return h;
}

// Выслуга трудяг и работяг: сколько на каком уровне и шкала до следующего у каждого
function levelsHTML(type) {
  const list = Game.units.filter(u => u.type === type).sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const by = [0, 0, 0, 0];
  for (const u of list) by[unitLevel(u)]++;
  const what = type === 'serf' ? ['', 'носит по 1', 'по 2 за раз', 'по 3 за раз'] : ['', 'ждёт подвоза', 'берёт 1 материал', 'берёт 2 материала'];
  const need = type === 'serf' ? 'доставок' : 'очков (здание 3, дорога 1)';
  let h = `<div class="lvls"><div class="muted small">${[1, 2, 3].filter(l => by[l]).map(l => `ур.${l}: <b>${by[l]}</b> (${what[l]})`).join(' · ')}</div><div class="xpbars">`;
  const shown = list.slice(0, 12);
  for (const u of shown) {
    const L = unitLevel(u), p = levelProgress(u), xp = u.xp || 0, t = LEVEL_XP[type];
    const tip = L >= 3 ? `Уровень 3, выслуга ${xp}. Выше некуда, только в начальство` : `Уровень ${L}: ${xp} из ${t[L]} ${need} до следующего`;
    h += `<span class="xpbar l${L}" title="${tip}"><i style="width:${Math.round(p * 100)}%"></i><b>${L}</b></span>`;
  }
  if (list.length > shown.length) h += `<span class="muted small">+${list.length - shown.length}</span>`;
  return h + '</div></div>';
}

function collectAlerts() {
  const out = [];
  const idleBuilders = Game.units.filter(u => u.type === 'builder' && u.idleFlag).length;
  for (const b of Game.buildings) {
    if (b.state !== 'done') {
      if (b.problem() === 'noroad') out.push({ b, icon: ['ui', 'road'], text: `${b.def.name}: стройка без дороги к складу` });
      else if (!b.builder && !idleBuilders) out.push({ b, icon: ['ui', 'noworker'], text: `${b.def.name}: стройка ждёт работягу` });
      continue;
    }
    const p = b.problem();
    if (!p || p === 'paused' || p === 'enough') continue;
    if (p === 'noroad') { out.push({ b, icon: ['ui', 'road'], text: `${b.def.name}: нет дороги к складу` }); continue; }
    if (p === 'damaged') { out.push({ b, icon: ['ui', 'warn'], text: `${b.def.name}: повреждено нечистью, ждёт ремонта` }); continue; }
    if (p === 'noworker') out.push({ b, icon: ['ui', 'noworker'], text: `${b.def.name}: нужен ${UNIT_TYPES[b.def.worker].name.toLowerCase()}` });
    else if (p === 'full') out.push({ b, icon: ['ui', 'full'], text: `${b.def.name}: всё заполнено` });
    else if (p.startsWith('need:')) out.push({ b, icon: ['good', p.slice(5)], text: `${b.def.name}: нет «${GOODS[p.slice(5)].name}»` });
  }
  for (const b of Game.buildings) if (b.type === 'school' && b.state === 'done' && b.queue.length && b.stock.gold < 1 && !b.training)
    out.push({ b, icon: ['good', 'gold'], text: 'Школа ждёт золото' });
  const hungry = Game.units.filter(u => u.food < HUNGRY).length;
  if (hungry) {
    const inn = Game.buildings.find(b => b.type === 'inn' && b.state === 'done');
    out.push({ b: inn, icon: ['good', 'bread'], text: `Голодных жителей: ${hungry}` + (inn && !innFood(inn) ? ' — в трактире нет еды' : '') });
  }
  return out;
}

function overviewHTML(alerts) {
  let h = '<div class="group-title">Проблемы</div>';
  if (!alerts.length) h += '<div class="muted small">Всё работает как надо. Подозрительно. Проверьте ещё раз.</div>';
  for (const a of alerts)
    h += `<div class="alert" ${a.b ? `data-goto="${a.b.id}"` : ''}><img src="${iconURL(a.icon[0], a.icon[1], 2)}" alt=""><div>${a.text}${Guide.hint(a.b)}</div></div>`;
  h += Guide.statsHTML();
  h += '<div class="group-title">Произведено за игру</div>';
  let any = false;
  for (const g of GOOD_KEYS) if (Game.produced[g]) {
    any = true;
    h += `<div class="stat-row">${gi(g)}${GOODS[g].name}<span class="v">${Game.produced[g]}</span></div>`;
  }
  if (!any) h += '<div class="muted small">Пока ничего.</div>';
  const counts = {};
  for (const b of Game.buildings) counts[b.type] = (counts[b.type] || 0) + 1;
  h += '<div class="group-title">Здания</div>';
  for (const t of BUILD_ORDER) if (counts[t]) h += `<div class="stat-row">${BUILDINGS[t].name}<span class="v">${counts[t]}</span></div>`;
  return h;
}

// ---------- Окно здания ----------

function statusChip(b) {
  if (b.isRoad) return b.dug < 1 ? `<span class="chip wait">Копают ${Math.round(b.dug * 100)}%</span>`
    : b.pave > 0 ? `<span class="chip wait">Мостят ${Math.round(b.pave * 100)}%</span>` : '<span class="chip wait">Выкопано, ждёт камень</span>';
  if (b.state !== 'done' && b.problem() === 'noroad') return '<span class="chip bad">Нет дороги к складу</span>';
  if (b.state === 'site') return '<span class="chip wait">Разметка площадки</span>';
  if (b.state === 'build') return `<span class="chip wait">Строится ${Math.round(b.progress * 100)}%</span>`;
  const p = b.problem();
  if (!p) return b.working || b.def.worker === undefined || b.type === 'woodcutter' || b.type === 'quarry' || b.type === 'farm'
    ? '<span class="chip ok">Работает</span>' : '<span class="chip ok">Готово</span>';
  if (p === 'noroad') return '<span class="chip bad">Нет дороги к складу</span>';
  if (p === 'paused') return '<span class="chip off">На паузе</span>';
  if (p === 'noworker') return '<span class="chip bad">Нет рабочего</span>';
  if (p === 'damaged') return '<span class="chip bad">Повреждено — ждёт ремонта</span>';
  if (p === 'full') return '<span class="chip wait">Всё заполнено</span>';
  if (p === 'enough') return '<span class="chip off">Отдыхает: еды на складе вдоволь</span>';
  return `<span class="chip bad">Нет: ${GOODS[p.slice(5)].name}</span>`;
}

function slotHTML(g, n, cap, extra = '') {
  return `<div class="slot${n ? '' : ' zero'}${extra}" title="${GOODS[g].name}">${gi(g)}<span class="n">${cap != null ? `${n}/${cap}` : n}</span></div>`;
}

function recipeHTML(b, r, i) {
  const ins = Object.entries(r.in).map(([g, n]) => `${gi(g)}${n > 1 ? '×' + n : ''}`).join(' ');
  const outs = Object.entries(r.out).map(([g, n]) => `${gi(g)}${n > 1 ? '×' + n : ''}`).join(' ');
  const multi = b && b.def.recipes.length > 1;
  const on = !b || b.recipeOn[i];
  return `<div class="recipe${on ? '' : ' off'}">${ins || '<span class="muted">из недр</span>'}<span class="arrow">→</span>${outs}<span class="t">${r.time}с</span>${multi ? `<input type="checkbox" data-recipe="${i}" ${on ? 'checked' : ''} title="Производить">` : ''}</div>`;
}

function workerHTML(b) {
  const type = b.def.worker;
  const w = b.worker && b.worker.home === b ? b.worker : null;
  const st = w ? (w.inside === b ? (b.working ? 'работает' : 'внутри') : 'в пути / снаружи') : null;
  return `<div class="irow"><img class="portrait" src="${portraitURL(type, w ? w.look : 3)}" alt="">
    <div><div>${UNIT_TYPES[type].name}</div><div class="small ${w ? 'muted' : 'warn'}">${w ? st : 'нет — нужно обучить'}</div></div>
    ${w ? '' : '<button data-act="hire" style="margin-left:auto">Обучить</button>'}</div>`;
}

// «Не жди — помоги»: на стройке без свободного работяги герой может взяться за молоток сам
function heroBuildBtn(b) {
  if (typeof Coop !== 'undefined' && Coop.mirror) return '';
  const h = Game.units.find(u => u.type === 'hero' && !u.dead);
  if (!h || b.builder) return '';
  return `<button class="upg" data-act="herobuild" title="Свободного работяги нет, а ждать скучно: герой возьмёт молоток сам"><span><b>Строить героем</b><small>не ждать работягу</small></span></button>`;
}
function heroHelpBuild(b) {
  const h = Game.units.find(u => u.type === 'hero' && !u.dead);
  if (!h || b.removed) return;
  const road = b.isRoad;
  issueCmd(h, { kind: 'build', b, tx: road ? b.x : b.doorX, ty: road ? b.y : b.doorY, label: road ? 'Строить дорогу' : 'Строить' });
  toast('Герой идёт строить');
}

function infoBuilding(b) {
  if (b.isRoad) {
    return `<div class="ihead"><img class="bpic" src="${iconURL('ui', 'road', 2)}" alt=""><div><h3>Дорога</h3>${statusChip(b)}</div></div>
      <div class="slots">${slotHTML('stone', b.stock.stone, ROAD_STONE)}</div>
      <div class="irow">Работяга: ${b.builder ? (b.dug < 1 ? 'копает' : 'кладёт камень') : `<span class="muted">${b.dug < 1 ? 'ждёт свободного работягу' : 'ждёт камень'}</span>`}</div>
      <div class="tip">Сначала работяга бесплатно копает корыто — это он умеет лучше всего. Потом за 1 камень выкладывает мостовую, если камень вообще кто-нибудь привезёт.</div>
      <div class="iactions">${heroBuildBtn(b)}<button data-act="demolish">${ui('trash')}Отменить</button></div>`;
  }
  const def = b.def;
  const same = Game.buildings.filter(x => x.type === b.type).length;
  let h = `<div class="ihead"><img class="bpic" src="${buildingIconURL(b.type)}" alt=""><div><h3>${def.name}${b.level === 2 ? ' <span class="lvl">ур. 2</span>' : ''}</h3>${statusChip(b)}</div></div>`;
  h += Guide.whyHTML(b);
  h += '<div class="iactions">';
  if (same > 1) h += `<button data-act="prev" title="Предыдущее такое же ([)">${ui('prev')}</button><button data-act="next" title="Следующее такое же (])">${ui('next')}</button>`;
  h += `<button data-act="goto" title="Показать на карте">${ui('eye')}</button>`;
  if (b.state === 'done' && (def.worker || def.auto)) h += `<button data-act="pause" title="Пауза производства (P)" class="${b.paused ? 'active' : ''}">${ui(b.paused ? 'play' : 'pause')}</button>`;
  h += `<span class="grow"></span><button data-act="demolish" title="Снести">${ui('trash')}</button></div>`;
  // большая понятная кнопка: принимать ли сюда доставки
  if (b.state === 'done' && (def.inputs || b.isStore())) {
    h += b.noDeliver
      ? `<button class="deliv closed" data-act="deliver" title="Трудяги сюда ничего не везут и очень этому рады. Нажмите, чтобы испортить им праздник">${ui('nodeliver')}<span><b>Доставки закрыты</b><small>нажмите, чтобы открыть</small></span></button>`
      : `<button class="deliv open" data-act="deliver" title="Запретить трудягам везти сюда товары (B). Они не обидятся, они вообще редко обижаются на меньшее количество работы">${ui('deliver')}<span><b>Доставки открыты</b><small>нажмите, чтобы закрыть</small></span></button>`;
  }

  if (b.type === 'inn' && b.state === 'done' && !(typeof Coop !== 'undefined' && Coop.mirror)) {
    const bad = festOn() ? '' : festCanStart(), on = festOn();
    h += `<button class="deliv ${on || !bad ? 'open' : 'closed'}" data-act="festival" title="Все бросают работу, пьют эль, пляшут и кричат «ура». Нужен эль в трактире; прерывается нечистью и вечером"><span><b>${on ? 'Праздник идёт!' : 'Устроить праздник'}</b><small>${on ? 'гуляют до вечера' : bad || 'на 1–2 дня, расход эля выше'}</small></span></button>`;
  }

  if (b.upg) {
    const U = b.upg;
    h += `<div class="isec">Достройка до уровня 2</div><div class="bar"><div style="width:${Math.round(U.hits / U.maxHits * 100)}%"></div></div><div class="slots">`;
    for (const g in U.cost) if (U.cost[g]) h += slotHTML(g, U.used[g] + U.stock[g], U.cost[g]);
    h += `</div><div class="irow">Работяга: ${U.builder ? '<span class="good">строит</span>' : '<span class="warn">нет свободного</span>'}</div>`;
    h += `<button class="upg no" data-act="upgcancel" title="Отменить достройку: материалы пропадут, работяги вздохнут с облегчением"><span><b>Отменить достройку</b><small>уже внесённые материалы пропадут</small></span></button>`;
  } else if (canUpgrade(b)) {
    const up = b.def.up;
    const cost = Object.keys(up.cost).map(g => `${gi(g)}${up.cost[g]}`).join(' ');
    h += `<button class="upg" data-act="upgrade" title="Работяги надстроят здание: материалы привезут трудяги. Когда-нибудь. Если дорога есть"><span><b>Достроить до уровня 2: ${cost}</b><small>${BUILDINGS[b.type].desc2}</small></span></button>`;
  }
  if (b.state !== 'done') {
    h += `<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`;
    h += '<div class="isec">Материалы</div><div class="slots">';
    for (const g in def.cost) if (def.cost[g]) h += slotHTML(g, b.usedOf[g] + b.stock[g], def.cost[g]);
    h += '</div>';
    h += `<div class="irow">Работяга: ${b.builder ? '<span class="good">работает</span>' : '<span class="warn">нет свободного</span>'}</div>`;
    h += `<div class="iactions">${heroBuildBtn(b)}</div>`;
    return h + `<div class="idesc">${def.desc}</div>`;
  }

  if (b.autoJob) h += `<div class="bar mana"><div style="width:${Math.round((1 - b.autoJob.t / b.autoJob.r.time) * 100)}%"></div></div>`;
  if (def.worker) h += workerHTML(b);

  if (def.recipes) {
    h += `<div class="isec">Производство${def.recipes.length > 1 ? ' (галочки — что делать)' : ''}</div>`;
    def.recipes.forEach((r, i) => { h += recipeHTML(b, r, i); });
  }

  if (b.isStore()) {
    h += '<div class="isec">Хранится (клик — не принимать)</div><div class="slots">';
    for (const g of GOOD_KEYS) if (b.stock[g] || Game.storeBlock[g])
      h += `<div class="slot click${Game.storeBlock[g] ? ' blocked' : ''}" title="${GOODS[g].name}" data-block="${g}">${gi(g)}<span class="n">${b.stock[g]}</span></div>`;
    h += '</div>';
  } else {
    if (def.inputs) {
      h += '<div class="isec">Привезено</div><div class="slots">';
      for (const g in def.inputs) h += slotHTML(g, b.stock[g], def.inputs[g], b.wantsInput(g) ? '' : ' blocked');
      h += '</div>';
    }
    if (def.outputs) {
      h += '<div class="isec">Готово к вывозу</div><div class="slots">';
      for (const g in def.outputs) h += slotHTML(g, b.stock[g], def.outputs[g]);
      h += '</div>';
    }
  }

  if (b.type === 'school') {
    h += '<div class="isec">Обучение · 1 золото</div>';
    if (b.training) {
      h += `<div class="irow"><img class="portrait" src="${portraitURL(b.training.type)}" alt="">${UNIT_TYPES[b.training.type].name}</div>`;
      h += `<div class="bar"><div style="width:${Math.round(b.training.t / (TRAIN_TIME * (b.def.trainMult || 1)) * 100)}%"></div></div>`;
    } else if (b.queue.length && b.stock.gold < 1) {
      const w = schoolWhy(b);
      h += `<div class="warn small">Ждём золото${w ? ': ' + w.t + ' ' + w.a : ''}</div>`;
      if (w && w.icon === 'g:gold' && !b.incoming.gold && goldAnywhere() <= 0) h += '<div class="iactions"><button data-act="untrainall">Очистить очередь</button></div>';
    }
    h += '<div class="queue">' + b.queue.map((q, i) => `<img src="${portraitURL(q)}" title="${UNIT_TYPES[q].name} — клик убирает" data-untrain-at="${i}">`).join('') + '</div>';
    h += '<div class="train-grid">';
    for (const t of UNIT_KEYS) {
      const q = b.queue.filter(x => x === t).length;
      h += `<button class="tbtn" data-train="${t}" title="${UNIT_TYPES[t].name}"><img src="${portraitURL(t)}" alt="">${UNIT_TYPES[t].name.slice(0, 7)}${q ? `<span class="q">${q}</span>` : ''}</button>`;
    }
    h += '</div>';
  }
  if (b.type === 'inn') {
    const hungry = Game.units.filter(u => u.food < HUNGRY).length;
    h += `<div class="irow ${hungry ? 'warn' : 'muted'}">Голодных: ${hungry}</div>`;
    if (b.state === 'done') {
      // что гномы реально съедят: курица разделывается на куски, так что считаем и целые тушки
      const have = FOODS.map(g => [g, Math.max(0, b.stock[g] - b.reserved[g]) + (g === 'chickenleg' ? Math.max(0, b.stock.chicken) * 4 : 0)]).filter(x => x[1] > 0);
      h += have.length
        ? `<div class="irow muted">Еда в запасе: ${have.map(([g, n]) => `${GOODS[g].name.toLowerCase()} ${n}`).join(', ')}</div>`
        : '<div class="irow warn">Еды нет — голодные идут на склад всухомятку</div>';
    }
  }
  if (b.type === 'quarry') {
    let n = 0;
    for (let y = b.doorY - 10; y <= b.doorY + 10; y++) for (let x = b.doorX - 10; x <= b.doorX + 10; x++) {
      const o = inb(x, y) && World.obj[idx(x, y)];
      if (o && o.t === 'stone') n += o.n;
    }
    h += `<div class="irow ${n ? 'muted' : 'warn'}">Камня вокруг: ${n}</div>`;
  }
  if (b.type === 'woodcutter') {
    let n = 0, grown = 0;
    for (let y = b.doorY - 9; y <= b.doorY + 9; y++) for (let x = b.doorX - 9; x <= b.doorX + 9; x++) {
      const o = inb(x, y) && World.obj[idx(x, y)];
      if (o && o.t === 'tree') { n++; if (o.g >= 1) grown++; }
    }
    h += `<div class="irow muted">Деревьев рядом: ${n}, взрослых: ${grown}</div>`;
  }
  if (b.type === 'goatpen') {
    const n = Game.units.filter(x => x.type === 'goat' && x.homePen === b.id).length;
    const wild = Game.animals.filter(a => a.kind === 'goat').length;
    h += `<div class="irow">Вьючных коз: <b>${n}</b> из 3</div><div class="irow muted">Диких коз на карте: ${wild}</div>`;
  }
  if (b.type === 'stable') {
    const n = Game.units.filter(x => x.type === 'carter' && x.homeStable === b.id).length;
    h += `<div class="irow">Извозчиков: <b>${n}</b> из 3</div><div class="small muted">Лошадь: 3 сена + 2 зерна. Телега везёт сразу весь стек — до 5 штук.</div>`;
  }
  if (b.def.crops) {
    const cnt = {};
    for (const o of World.obj) if (o && o.t === 'field' && o.farm === b.id) cnt[o.crop || 'wheat'] = (cnt[o.crop || 'wheat'] || 0) + 1;
    h += '<div class="isec">Что сеять</div>';
    const CROP_NAMES = { wheat: 'Пшеница → зерно', hay: 'Травы → сено', hops: 'Хмель на шестах' };
    for (const crop of def.crops)
      h += `<div class="recipe${b.crops[crop] ? '' : ' off'}">${gi(crop)} ${CROP_NAMES[crop]}<span class="t">полей: ${cnt[crop] || 0}</span>${def.crops.length > 1 ? `<input type="checkbox" data-crop="${crop}" ${b.crops[crop] ? 'checked' : ''}>` : ''}</div>`;
    h += `<div class="irow muted">Всего полей: ${Object.values(cnt).reduce((a, v) => a + v, 0)} из ${FARM_FIELDS}</div><div class="small muted">${def.crops.includes('hops') ? `Поля хмеля закладывайте инструментом «Хмель» рядом (до ${FARM_R} клеток): доска за подвесы.` : `Поля закладывайте инструментом «Пшеница» рядом с фермой (до ${FARM_R} клеток) — работяга вскопает их бесплатно.`} Сено — побочный продукт жатвы.</div>`;
  }
  if (b.type === 'bonfire') h += `<div class="small muted">Кольца на карте: свет и защита от нечисти — ${BONFIRE_SAFE} клеток, у костра возрождаются герои — ${BONFIRE_HERO}, вне ${BONFIRE_NOSPAWN} нечисть и не появляется.</div>`;
  if (b.type === 'swine') {
    const st = ['', '⅓', '⅔'];
    h += '<div class="isec">Загон</div>';
    h += `<div class="irow">Взрослых (3/3): <b>${b.stock.pig}</b> из ${def.outputs.pig}</div>`;
    h += `<div class="irow muted">Подрастают: ${b.pigs.length ? b.pigs.map(s => st[s]).join(', ') : 'нет'}</div>`;
    h += '<div class="small muted">Каждая охапка сена: все подрастают на треть и рождается поросёнок.</div>';
  }
  return h + `<div class="idesc">${def.desc}</div>`;
}

function infoPreview(type) {
  const def = BUILDINGS[type];
  let h = `<div class="ihead"><img class="bpic" src="${buildingIconURL(type)}" alt=""><div><h3>${def.name}</h3><span class="chip off">${def.cat}</span></div></div>`;
  h += '<div class="isec">Стоимость</div>' + costHTML(def.cost);
  if (def.worker) h += `<div class="irow"><img class="portrait" src="${portraitURL(def.worker)}" alt="">Работник: ${UNIT_TYPES[def.worker].name}</div>`;
  else if (def.auto) h += '<div class="irow muted">Работает без работника</div>';
  if (def.recipes) { h += '<div class="isec">Производство</div>'; def.recipes.forEach((r, i) => { h += recipeHTML(null, r, i); }); }
  else if (def.outputs) h += '<div class="isec">Добывает</div><div class="slots">' + Object.keys(def.outputs).map(g => slotHTML(g, 1)).join('') + '</div>';
  return h + `<div class="idesc">${def.desc}</div>`;
}

function infoTips() {
  return `<div class="tip muted">Ничего не выбрано. ${typeof Mobile !== 'undefined' && Mobile.on ? 'Коснитесь здания' : 'Кликните по зданию'} на карте — здесь появятся его запасы, рабочий и производство.</div>`;
}

// ---------- Обновление ----------

function setHTML(id, html) {
  if (UI.last[id] === html) return;
  UI.last[id] = html;
  document.getElementById(id).innerHTML = html;
}

function updateUI(force) {
  if (force) UI.last = {};
  const sel = Game.selected && !Game.selected.removed ? Game.selected : null;
  let info;
  if (sel) info = infoBuilding(sel);
  else if (UI.hoverType) info = infoPreview(UI.hoverType);
  else {
    const hb = R.hover && !Game.tool ? buildingAt(R.hover) : null;
    info = hb ? infoBuilding(hb) : infoTips();
  }
  setHTML('info', info);

  if (UI.tab === 'store') setHTML('store-list', storeHTML());
  if (UI.tab === 'people') setHTML('people-list', peopleHTML());
  const alerts = collectAlerts();
  if (UI.tab === 'overview') setHTML('overview', overviewHTML(alerts));
  if (UI.tab === 'menu') {
    const fmt = m => m ? `${new Date(m.at).toLocaleString(I18N.locale())} · ${Math.floor(m.time / 60)} мин · ${m.people} жит.` : 'нет';
    setHTML('save-info', `Режим: <span class="diff-chip" style="background:${dif().color}" title="${dif().desc}">${dif().name}</span><br>Сохранение: ${fmt(saveMeta('manual'))}<br>Автосохранение: ${fmt(saveMeta('auto'))}`);
  }
  if (UI.tab === 'log') { UI.logUnread = 0; setHTML('log-list', logHTML()); }
  const lb = document.getElementById('log-badge');
  lb.textContent = UI.logUnread > 99 ? '99+' : UI.logUnread || 0;
  lb.classList.toggle('hidden', !UI.logUnread);
  const badge = document.getElementById('alert-badge');
  badge.textContent = alerts.length;
  badge.classList.toggle('hidden', !alerts.length);

  const t = totals();
  const food = t.bread + t.sausage;
  const rows = [['timber', t.timber], ['stone', t.stone], ['gold', t.gold], ['bread', food], ['mana', t.mana]];
  setHTML('res-sum', [rows[0], rows[1], rows[2]].map(([g, n]) => `<span>${gi(g)}${n}</span>`).join(''));
  setHTML('res-bar', rows
    .map(([g, n]) => `<div class="res-row" title="${g === 'bread' ? 'Еда (хлеб + колбаса)' : GOODS[g].name}">${gi(g)}<span class="rn">${g === 'bread' ? 'Еда' : GOODS[g].name}</span><b>${n}</b></div>`).join('')
    + `<div class="res-row" title="Жители">${ui('people')}<span class="rn">Жители</span><b>${Game.units.length}</b></div>`
    + resMoreHTML(t, rows));

  const sec = Math.floor(Game.time);
  document.getElementById('clock').textContent =
    `${isNightNow() ? '☾' : isEveningNow() ? '◐' : '☀'} ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// Остальные товары на складах — компактной сеткой под главными (только то, что есть)
function resMoreHTML(t, rows) {
  const main = new Set(rows.map(r => r[0]).concat('sausage'));
  const gs = GOOD_KEYS.filter(g => t[g] > 0 && !main.has(g));
  return gs.length ? `<div class="res-more">${gs.map(g => `<span title="${GOODS[g].name}">${gi(g)}<b>${t[g]}</b></span>`).join('')}</div>` : '';
}

// Закрыть / открыть здание для доставок
function toggleDeliver(b) {
  b.noDeliver = !b.noDeliver;
  toast(b.noDeliver ? `${b.def.name}: доставки закрыты — трудяги сюда ничего не везут` : `${b.def.name}: доставки снова открыты`, b);
  logEvent('deliver', b.noDeliver ? `${b.def.name}: доставки закрыты` : `${b.def.name}: доставки открыты`, b.doorX, b.doorY);
}

// Подсказка при постройке: как повернуть здание (кнопки «Повернуть» больше нет)
function toolHint(tool) {
  const el = document.getElementById('tool-hint');
  if (!el) return;
  if (!tool || tool.kind !== 'build' || Mobile.on) { el.classList.add('hidden'); return; }
  const noRot = BUILDINGS[tool.type].noRotate;
  el.innerHTML = noRot ? '<b>' + BUILDINGS[tool.type].name + '</b>: это здание не поворачивается. Оно и так стоит как надо, спросите у него' : '<kbd>T</kbd> — повернуть здание: вход на юг, восток или запад. На север гномы не ходят, принципиально';
  el.classList.remove('hidden');
}
