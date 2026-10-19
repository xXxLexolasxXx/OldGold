'use strict';
// Рисует существ игры её собственными функциями и сохраняет PNG для сайта (site/img/mon/*.png) + site/data/sprites.json.
// Запуск: node tools/site-export-server.js, открыть http://localhost:8791/tools/site-export.html?save (без ?save — только просмотр).
const SAVE = location.search.includes('save');
const LOG = m => { document.getElementById('log').textContent += m + '\n'; };

// рисовалка «в точку земли»: холст W×H, ноги в (W/2, H-14)
function onGround(fn, W = 160, H = 170) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  Game.time = 0.4;
  fn(c, W / 2, H - 14);
  return cv;
}
const foe = (fn, N = {}) => onGround((c, x, y) => { c.save(); c.translate(x, y); c.scale(2, 2); fn(c, Object.assign({ st: 'idle', ph: 0, atkT: 0, castT: 0, phase: 1 }, N)); c.restore(); });
const entOf = kind => {
  const e = { i: 0, water: false, rock: false, state: 'idle', t: 0, k: 1, alpha: 1, x: 0, y: 0, face: 1, phase: 0, moving: false, hitT: 0, atk: 0, wx: 0, wy: 0 };
  for (let n = 0; n < 4000; n++) { e.i = n; if (entBase(e).kind === kind) break; }
  return e;
};
const tree = kind => () => onGround((c, x, y) => { const e = entOf(kind); e.x = x / TILE; e.y = y / TILE; drawEnt(c, e); }, 200, 220);

// id, название, группа, как рисуем
const LIST = [
  // нечисть
  ['oak', 'Ходячий дуб', 'night', tree('oak')],
  ['birch', 'Ходячая берёза', 'night', tree('birch')],
  ['pine', 'Ходячая сосна', 'night', tree('pine')],
  ['fir', 'Ходячая ель', 'night', tree('fir')],
  ['water', 'Водяной', 'night', () => onGround((c, x, y) => { drawEnt(c, { i: 5, water: true, rock: false, state: 'idle', t: 0, k: 1, alpha: 1, x: x / TILE, y: y / TILE, face: 1, phase: 0, moving: false, hitT: 0, atk: 0, wx: x / TILE, wy: y / TILE }); }, 200, 200)],
  ['skeleton', 'Скелет', 'night', () => onGround((c, x, y) => { drawSkeleton(c, { x: x / TILE, y: y / TILE, face: 1, k: 1, state: 'roam', t: 0, phase: 0, moving: false, scared: 0, atk: -9 }); })],
  ['ghost', 'Призрак', 'night', () => ghostSprite('idle', 2)],
  ['reaper', 'Жнец', 'night', () => reaperSprite('idle', 2, 0)],
  // тёмный маг
  ['raven', 'Ворон-разведчик', 'foe', () => foe(foeDrawRaven, { st: 'chase', ph: 1 })],
  ['thrall', 'Прислужник тьмы', 'foe', () => foe(foeDrawThrall)],
  ['knight', 'Рыцарь тьмы', 'foe', () => foe(foeDrawKnight)],
  ['malgor', 'Тёмный маг Малгор', 'foe', () => foe(foeDrawMalgor)],
  ['spire', 'Чёрный шпиль', 'foe', () => foeTowerSprite(false)],
  // лесные нейтралы и феи
  ['pixie', 'Цветочная фея', 'neutral', () => naFrame('pixie', 'i0')],
  ['fairy', 'Лесная фея', 'neutral', () => naFrame('fairy', 'i0')],
  ['leshy', 'Леший', 'neutral', () => naFrame('leshy', 'i0')],
  ['boar', 'Кабан-страж', 'neutral', () => naFrame('boar', 'i0')],
  ['spore', 'Чумной моховик', 'neutral', () => naFrame('spore', 'i0')],
  // звери
  ['wolf', 'Волк', 'beast', () => creatureSprite('wolf', null)],
  ['deer', 'Олень', 'beast', () => creatureSprite('deer', null)],
  ['rabbit', 'Кролик', 'beast', () => creatureSprite('rabbit', null)],
  ['goat', 'Дикая коза', 'beast', () => creatureSprite('goat', null)],
  ['fox', 'Лиса', 'beast', () => creatureSprite('fox', null)],
  ['elk', 'Лось', 'beast', () => creatureSprite('elk', null)],
  ['chicken', 'Курица', 'beast', () => creatureSprite('chicken', null)],
  ['goose', 'Гусь', 'beast', () => creatureSprite('goose', null)],
];

function crop(src, maxSide) {
  const w = src.width, h = src.height, t = document.createElement('canvas'); t.width = w; t.height = h;
  const tc = t.getContext('2d'); tc.drawImage(src, 0, 0);
  const d = tc.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, maxSide / Math.max(cw, ch));
  const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(cw * k)); o.height = Math.max(1, Math.round(ch * k));
  const oc = o.getContext('2d'); oc.imageSmoothingEnabled = k < 1; oc.imageSmoothingQuality = 'high';
  oc.drawImage(t, x0, y0, cw, ch, 0, 0, o.width, o.height);
  return o;
}

async function put(path, o) { if (SAVE) await fetch('/save/' + path, { method: 'POST', body: await new Promise(r => o.toBlob(r, 'image/png')) }); }
(async () => {
  const meta = {};
  // здания (как в sheet.html) и иконки товаров
  const bl = [], gl = [];
  for (const t of [...BUILD_ORDER, 'graveyard'].filter(t => BUILDINGS[t])) {
    try {
      const spr = buildingSprite(t, 0, 1), cv = document.createElement('canvas'); cv.width = spr.w; cv.height = spr.h;
      cv.getContext('2d').drawImage(spr.canvas, 0, 0, spr.w, spr.h);
      const o = crop(cv, 150); if (!o) continue;
      bl.push(t); await put('img/bld/' + t + '.png', o);
      const d = document.createElement('div'); d.className = 'c'; d.appendChild(o); d.append(t); document.getElementById('g').appendChild(d);
    } catch (e) { LOG('bld ' + t + ': ' + e.message); }
  }
  for (const g of GOOD_KEYS) {
    try { const o = document.createElement('canvas'); o.width = o.height = 18; o.getContext('2d').drawImage(iconCanvas('good', g), 0, 0); gl.push(g); await put('img/ico/' + g + '.png', o); } catch (e) { LOG('ico ' + g + ': ' + e.message); }
  }
  // скриншоты из promo/posts, уменьшенные до 960 px (webp)
  const SHOTS = ['01_camp_day.png', '20_village_pixel.png', '23b_night_lanterns.png', '25_buildings_set.png', '12_hero_card.jpg', '11_ui_minimap.jpg', '03b_ghosts.png', '10b_rain.png', '32_neutrals_fairies.png', '15_start_menu_coop.jpg'], sh = [];
  for (const f of SHOTS) {
    try {
      const im = new Image(); im.src = '/promo/posts/' + f; await im.decode();
      const k = Math.min(1, 960 / im.width), o = document.createElement('canvas'); o.width = Math.round(im.width * k); o.height = Math.round(im.height * k);
      const oc = o.getContext('2d'); oc.imageSmoothingQuality = 'high'; oc.drawImage(im, 0, 0, o.width, o.height);
      const id = f.replace(/[.][a-z]+$/, ''); sh.push({ id, w: o.width, h: o.height });
      if (SAVE) await fetch('/save/img/shots/' + id + '.webp', { method: 'POST', body: await new Promise(r => o.toBlob(r, 'image/webp', 0.8)) });
    } catch (e) { LOG('shot ' + f + ': ' + e.message); }
  }
  meta._shots = sh;
  meta._buildings = bl; meta._goods = gl;
  for (const [id, name, group, fn] of LIST) {
    try {
      let src = fn(); if (src && src.cv) src = src.cv;
      const o = crop(src, 180);
      if (!o) { LOG('пусто: ' + id); continue; }
      meta[id] = { name, group, w: o.width, h: o.height };
      const d = document.createElement('div'); d.className = 'c'; d.appendChild(o); d.append(id + ' ' + o.width + '×' + o.height); document.getElementById('g').appendChild(d);
      if (SAVE) await fetch('/save/img/mon/' + id + '.png', { method: 'POST', body: await new Promise(r => o.toBlob(r, 'image/png')) });
    } catch (e) { LOG(id + ': ' + e.message + ' @' + (e.stack || '').split('\n')[1]); }
  }
  if (SAVE) await fetch('/save/data/sprites.json', { method: 'POST', body: JSON.stringify(meta) });
  LOG('готово: ' + Object.keys(meta).length + ' из ' + LIST.length);
})();
