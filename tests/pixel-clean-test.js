'use strict';
// Чистка пикселей камней и краба: ни одной одиночной тёмной («чёрной») точки, цельная обводка, без чёрных глаз.
// Краб рисуется пиксельной кистью (fillRect) — его кадры собираем здесь на фиктивном канвасе и проверяем по пикселям.
// Камни и горы рисуются настоящим канвасом: их кадры проверяет лист tools/pixel-audit.html (?mark=1 подсвечивает
// найденные точки), а здесь проверяем сам фильтр на синтетике и что он подключён только к камням и скалам.
// Запуск: node tests/pixel-clean-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- фиктивный канвас: fillRect, globalAlpha, translate, getImageData/putImageData
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return h.length === 4 ? [(n >> 8 & 15) * 17, (n >> 4 & 15) * 17, (n & 15) * 17] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mkCanvas(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  const g = { canvas: { width: w, height: h }, globalAlpha: 1, fillStyle: '#000000', tx: 0, ty: 0,
    translate(x, y) { this.tx += x; this.ty += y; },
    fillRect(x, y, rw, rh) {
      const [r, gg, b] = hexRgb(this.fillStyle), a = this.globalAlpha;
      for (let yy = y + this.ty; yy < y + this.ty + rh; yy++) for (let xx = x + this.tx; xx < x + this.tx + rw; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const o = (yy * w + xx) * 4;
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = Math.max(d[o + 3], Math.round(a * 255));
      }
    },
    getImageData() { return { data: d, width: w, height: h }; }, putImageData() {} };
  return { width: w, height: h, getContext: () => g, data: d };
}
const ctx = vm.createContext({ mkCanvas, console, Math });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/world/seaart.js'), 'utf8'), ctx, { filename: 'seaart.js' });
// фильтры из pixel.js отдельно (палитра и остальной конвейер им не нужны)
{
  const src = fs.readFileSync(path.join(ROOT, 'js/pixel.js'), 'utf8');
  const a = src.indexOf('function pixLum'), b = src.indexOf('// Цветная обводка');
  vm.runInContext(src.slice(a, b), ctx);
}

const lum = (d, o) => d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11;
// число «мусорных» точек: висящие и одиночные тёмные (тот же критерий, что у фильтра и листа аудита)
const specks = (cv, thr = 80) => vm.runInContext(`countSpecks`, ctx)(cv.data, cv.width, cv.height, thr);

console.log('фильтр dropSpecks');
{
  const W = 11, H = 11, d = new Uint8ClampedArray(W * H * 4);
  const put = (x, y, c) => { const o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
  for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) put(x, y, [150, 140, 120]);
  put(4, 4, [10, 8, 6]);                                   // чёрная точка на теле
  for (let x = 1; x < 8; x++) put(x, 1, [20, 16, 12]);     // цельная обводка: ряд тёмных
  put(10, 10, [200, 50, 50]);                                // висящий пиксель в углу
  const before = vm.runInContext('countSpecks', ctx)(d, W, H, 70);
  ok(before === 2, `нашёл чёрную точку и висящий пиксель (${before})`);
  vm.runInContext('dropSpecks', ctx)(d, W, H, 70);
  const o = (4 * W + 4) * 4;
  ok(lum(d, o) > 100 && d[o + 3] === 255, 'чёрная точка закрашена цветом соседей');
  ok(d[(10 * W + 10) * 4 + 3] === 0, 'висящий пиксель стёрт');
  ok(lum(d, (1 * W + 4) * 4) < 40 && lum(d, (1 * W + 1) * 4) < 40, 'цельная обводка не тронута');
  ok(vm.runInContext('countSpecks', ctx)(d, W, H, 70) === 0, 'после чистки точек нет');
}

console.log('краб: все кадры');
{
  const A = vm.runInContext('SEA_ART', ctx).crab, seaSprite = vm.runInContext('seaSprite', ctx);
  let frames = 0, bad = 0, black = 0, noRing = 0, clipped = 0;
  for (const a in A.anims) for (let f = 0; f < A.anims[a]; f++) {
    frames++;
    const cv = seaSprite('crab', a, f).cv, d = cv.data, W = cv.width, H = cv.height;
    const n = specks(cv);
    if (n) { bad++; console.log(`    ${a}${f}: одиночных точек ${n}`); }
    let solid = 0, ring = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (!d[o + 3]) continue;
      solid++;
      if (lum(d, o) < 14) black++;                      // чистый чёрный (как были глаза)
      if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && lum(d, o) > 70 && !(a === 'hide' && y === H - 1)) { clipped++; console.log(`    край: ${a}${f} (${x},${y})`); }   // на краю допустима только обводка (и песок норы у нижнего края)   // рисунок упёрся в край — обрезан
      if (d[o] < 100 && d[o + 1] < 40) ring++;           // тёмно-красный контур
    }
    if (!ring) noRing++;
    if (!solid) bad++;
  }
  ok(frames === 35, `кадров краба 35 (${frames})`);
  ok(bad === 0, 'ни в одном кадре краба нет одиночных тёмных и висящих пикселей');
  ok(black === 0, 'на крабе нет чёрных пикселей (глаза — светлые бусинки)');
  ok(noRing === 0, 'у каждого кадра есть обводка тоном панциря');
  ok(clipped === 0, 'рисунок не обрезан краем кадра (на краю одна обводка)');
}

console.log('фильтр подключён только к камням и скалам');
{
  const users = [];
  for (const dir of ['js', 'js/world']) for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
    if (/\bspecks:/.test(src)) users.push(f);
  }
  ok(users.sort().join() === 'mountains.js,rocks.js,sprites.js', `specks: только камни, скалы и валуны (${users.join(', ')})`);
  const rocks = fs.readFileSync(path.join(ROOT, 'js/world/rocks.js'), 'utf8');
  ok(/toPixelArt\(cv, ROCK_K/.test(rocks), 'камни и челюсти клешней сводятся в пиксели (одна обводка по силуэту)');
}

console.log(fails.length ? `Провалов: ${fails.length}` : 'Проверка пройдена');
process.exit(fails.length ? 1 : 0);
