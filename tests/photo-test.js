'use strict';
// Фото-режим: рамки и фильтры рисуются без исключений на любых размерах, слои фильтров известны, подпись содержит название деревни.
// Запуск: node tests/photo-test.js
const S = require('./lib/sim');
const sim = S.newSim(7);
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };
const r = JSON.parse(sim.h.run(`(() => {
  const calls = [], out = { n: 0, bad: [] };
  const ctx = new Proxy({}, { get(t, k) { if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} }); return typeof k === 'string' && /^(save|restore|fillRect|strokeRect|fillText|strokeText|clearRect)$/.test(k) ? (...a) => { out.n++; if (a.some(v => typeof v === 'number' && !isFinite(v))) out.bad.push(k + ':' + a.join()); } : t[k]; }, set(t, k, v) { t[k] = v; return true; } });
  for (const [f] of PH_FRAMES) for (const key of Object.keys(PH_FILTERS)) for (const [w, h] of [[2048, 1536], [750, 1624], [320, 200]]) for (const cap of [true, false]) {
    phDrawFrame(ctx, w, h, f, cap, phCaptionText()); phDrawFilter(ctx, w, h, key);
  }
  return JSON.stringify({ n: out.n, bad: out.bad.slice(0, 3), cap: phCaptionText(), frames: PH_FRAMES.length, filters: Object.keys(PH_FILTERS).length });
})()`));
console.log(`Проверка фото-режима: вызовов рисования ${r.n}, рамок ${r.frames}, фильтров ${r.filters}, подпись: ${r.cap}`);
ok(r.n > 500, 'рамки почти ничего не рисуют');
ok(!r.bad.length, 'нечисловые координаты: ' + r.bad.join(' | '));
ok(/«.+» · сутки \d+/.test(r.cap), 'подпись без названия деревни и суток: ' + r.cap);
ok(!sim.errors.length, 'исключения: ' + sim.errors.slice(0, 2).join(' | '));
console.log(fails.length ? `Провалов: ${fails.length}` : 'Фото-режим в порядке');
process.exit(fails.length ? 1 : 0);
