// Сборка js/bldpx.js: растеризатор (bpx.js), материалы ×1 (bpx1.js), помощники (bvar3.js), модели трактира, склада и домов
// и игровой адаптер (px-runtime.js) — в одну обёртку-IIFE, наружу только pxSprite и пара помощников. Внутренние имена (box, roof, P1…)
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
  ['bvar7.js (реквизит склада)', cut(R('bvar7.js'), 'const Q2 =', 'const STORE1_VARS')],
  ['bvar8.js (склад)', cut(R('bvar8.js'), null, 'BDEFS.store2')],
  ['bvar9.js (дома)', R('bvar9.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['bvar10.js (реквизит школы и лесопилки)', R('bvar10.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['bvar11.js (школа, лесопилка, лесоруб, каменоломня)', R('bvar11.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['bvar12.js (реквизит блока 1)', R('bvar12.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['bvar13.js (колодец, извозчик, торговый пост, загон)', R('bvar13.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['bvar14.js (лазарет)', R('bvar14.js').split(/\r?\n/).filter(l => !l.startsWith('BDEFS.')).join('\n')],
  ['px-runtime.js', R('px-runtime.js')],
];
const out = `'use strict';
// СОБРАНО АВТОМАТИЧЕСКИ из tools/buildart (node tools/buildart/build-runtime.js) — правьте исходники там.
// Пиксельные здания ×1 (1 px арта = 1 мировой px): трактир, склад, дома — растеризатор граней, материалы, модели по уровням, адаптер к buildingSprite.
const { innPxSprite, pxSprite, pxPile, PX_HOUSE_NAMES } = (() => {
${parts.map(([n, s]) => `// ======== ${n} ========\n${s}`).join('\n')}
return { innPxSprite, pxSprite, pxPile, PX_HOUSE_NAMES };
})();
`;
fs.writeFileSync(path.join(__dirname, '../../js/bldpx.js'), out);
console.log('js/bldpx.js', (out.length / 1024).toFixed(1) + ' КБ');
