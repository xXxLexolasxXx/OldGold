'use strict';
// Портреты собеседников (js/campaign/faces.js): 16 лиц (гномы, гоблины и их чемпион, тролль, голем, Малгор, рассказчик, герой и героиня, Старец голема),
// каждое рисуется двумя кадрами (глаза открыты / моргнул) без исключений, кадры действительно разные, холст — 36×36 единиц
// с надвыборкой ×6 → готовый портрет 72×72 пикселя; кэш не растёт сверх числа кадров; все собеседники кампании и лора
// имеют портрет; без рисования (сервер, тесты) campFaceUrl возвращает '' — и диалоги остаются с буквой в круге.
// Рисования в node нет: холст — запись вызовов. Запуск: node tests/faceart-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const fails = [];
const check = (ok, msg) => { if (!ok && fails.length < 40) fails.push(msg); };

let TR = [];
const num = v => typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'string' ? v : '';
function makeCtx(cv) {
  const target = {
    canvas: cv,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop: (o, c) => { TR.push('stop' + o + c); } }),
  };
  return new Proxy(target, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { TR.push(String(k) + a.map(num).join(',')); }; },
    set(t, k, v) { TR.push(String(k) + '=' + num(v)); t[k] = v; return true; },
  });
}
let SIZES = [];
function makeCanvas(w, h) { const cv = { width: w, height: h }; cv.getContext = () => cv._c || (SIZES.push([cv.width, cv.height]), cv._c = makeCtx(cv)); cv.toDataURL = () => 'data:' + cv.width + 'x' + cv.height; return cv; }

const ctx = {
  console, Math, Object, Array, String, Set, Map, JSON, Proxy, RegExp, Number, Date, performance: { now: () => 0 },
  document: { createElement: () => makeCanvas(1, 1), addEventListener() {}, getElementById: () => null },
  window: {}, Game: { time: 0 }, R: {},
  mulberry32: a => () => ((a = (a * 16807) % 2147483647) / 2147483647),
};
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
for (const f of ['config.js', 'sprites.js', 'pixel.js', 'world/neutralart.js', 'campaign/faces.js']) load(f);
vm.runInContext('document.createElement = (n) => __mk(1, 1);', Object.assign(ctx, { __mk: makeCanvas }));
const run = s => vm.runInContext(s, ctx);

const WHO = run('Object.keys(CAMP_FACE_DRAW)');
check(WHO.length === 16, 'лиц должно быть 16, а их ' + WHO.length);
for (const k of ['grum', 'yagla', 'pim', 'tan', 'shnyr', 'gob', 'zhmykha', 'kremen', 'mrak', 'note', 'hero', 'heroF', 'elder', 'champ', 'troll', 'golem']) check(WHO.includes(k), 'нет лица ' + k);
check(run('CF_W') === 72, 'портрет должен быть 72×72 пикселя');

// два кадра у каждого лица — без исключений и разные
const trace = (who, f) => { TR = []; const [cv, c] = run('mkSprite(36, 36, CF_SS)'); ctx.__c = c; run(`CAMP_FACE_DRAW['${who}'](__c, ${f})`); return TR.join('|'); };
for (const k of WHO) {
  let a, b;
  try { a = trace(k, 0); b = trace(k, 1); } catch (e) { check(false, k + ': исключение ' + e.message); continue; }
  check(a.length > 200, k + ': кадр 0 почти пустой');
  check(a !== b, k + ': кадр моргания не отличается от обычного');
}

// размеры: холст 216×216 → 72×72
SIZES = [];
const url = run("campFaceUrl('grum', 0)");
check(SIZES.some(s => s[0] === 216 && s[1] === 216), 'рабочий холст должен быть 216×216, а размеры ' + JSON.stringify(SIZES));
check(SIZES.some(s => s[0] === 72 && s[1] === 72), 'готовый портрет должен быть 72×72, а размеры ' + JSON.stringify(SIZES));
check(url === 'data:72x72', 'campFaceUrl вернул ' + url);

// кэш: повторные вызовы не рисуют заново и не растут
for (const k of WHO) { run(`campFaceUrl('${k}', 0)`); run(`campFaceUrl('${k}', 1)`); }
const n1 = run('Object.keys(CAMP_FACE).length');
SIZES = []; for (const k of WHO) { run(`campFaceUrl('${k}', 0)`); run(`campFaceUrl('${k}', 1)`); }
check(n1 === 32, 'в кэше должно быть 32 кадра, а их ' + n1);
check(SIZES.length === 0, 'повторный вызов рисует заново');
check(run("campFaceUrl('нет такого', 0)") === '', 'неизвестный собеседник должен давать пустую строку');

// все собеседники кампании и лора, кроме безымянных, имеют портрет
const camp = fs.readFileSync(path.join(__dirname, '..', 'js', 'campaign.js'), 'utf8');
const lore = fs.readFileSync(path.join(__dirname, '..', 'js', 'lore.js'), 'utf8');
for (const [src, name] of [[camp, 'campaign'], [lore, 'lore']]) {
  const blk = src.match(/const (?:CAMP|LORE)_WHO = \{([\s\S]*?)\n\};/);
  check(!!blk, name + ': не найден список собеседников');
  if (blk) for (const m of blk[1].matchAll(/^\s*(\w+): \{/gm)) if (!WHO.includes(m[1])) check(false, `${name}: у «${m[1]}» нет портрета`);
}
check(/campFaceUrl\('elder'/.test(fs.readFileSync(path.join(__dirname, '..', 'js', 'world', 'golemlife.js'), 'utf8')), 'Старец голема без портрета');

// без рисования — пусто
const bare = vm.createContext({ console, Math, Object, Array, String, Map, JSON, mulberry32: ctx.mulberry32 });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'campaign', 'faces.js'), 'utf8') + ";globalThis.__r = campFaceUrl('grum', 0);", bare);
check(bare.__r === '', 'без document портрет должен быть пустым');

if (fails.length) { for (const f of fails) console.log('✗ ' + f); process.exit(1); }
console.log('Портреты: 16 лиц × 2 кадра, 72×72, кэш 32 кадра — в порядке');
