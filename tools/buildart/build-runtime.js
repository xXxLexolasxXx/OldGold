// Сборка js/bldpx.js: растеризатор (bpx.js), материалы ×1 (bpx1.js), помощники (bvar3.js), модель трактира (bvar4.js)
// и игровой адаптер (inn-runtime.js) — в одну обёртку-IIFE, наружу только innPxSprite. Внутренние имена (box, roof, P1…)
// не попадают в глобальную область игры. Запуск: node build-runtime.js
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^'use strict';\s*/m, '');
const cut = (s, from, to) => { const a = from ? s.indexOf(from) : 0, b = to ? s.indexOf(to) : s.length; if (a < 0 || b < 0) throw new Error('нет метки ' + (a < 0 ? from : to)); return s.slice(a, b); };
const parts = [
  ['bpx.js', R('bpx.js')],
  ['bpx1.js', R('bpx1.js')],
  ['bvar3.js (помощники)', cut(R('bvar3.js'), 'const WIN1', 'const TAV1_VARS')],
  ['bvar4.js (модель трактира)', cut(R('bvar4.js'), null, 'BDEFS.innlv')],
  ['bvar5.js (трактир, вход на восток)', R('bvar5.js')],
  ['bvar6.js (трактир в профиль)', R('bvar6.js')],
  ['inn-runtime.js', R('inn-runtime.js')],
];
const out = `'use strict';
// СОБРАНО АВТОМАТИЧЕСКИ из tools/buildart (node tools/buildart/build-runtime.js) — правьте исходники там.
// Пиксельный трактир ×1 (1 px арта = 1 мировой px): растеризатор граней, материалы, модель по уровням, адаптер к buildingSprite.
const innPxSprite = (() => {
${parts.map(([n, s]) => `// ======== ${n} ========\n${s}`).join('\n')}
return innPxSprite;
})();
`;
fs.writeFileSync(path.join(__dirname, '../../js/bldpx.js'), out);
console.log('js/bldpx.js', (out.length / 1024).toFixed(1) + ' КБ');
