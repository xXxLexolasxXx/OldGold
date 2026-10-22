'use strict';
// Выгрузка карт кампании (js/campaign/actN.js → camp<N>Map()) в формат редактора карт:
//   node tools/campaign/mkmaps.js   →   maps/campaign/act1.oldgold-map.json
// Файл открывается в игре: меню → «Ещё» → «Редактор карт» → «Импорт». В самой кампании карта строится кодом,
// поэтому правки из редактора переносятся в camp<N>Map() (или в код карты, если акт перейдёт на готовый файл).
const fs = require('fs');
const path = require('path');
const { createHost } = require('../../server/simhost');

const OUT = path.join(__dirname, '../../maps/campaign');
fs.mkdirSync(OUT, { recursive: true });
const h = createHost(() => {});
for (const n of JSON.parse(h.run('JSON.stringify(Object.keys(CAMP_ACTS))'))) {
  const json = h.run(`(function () { const m = CAMP_ACTS[${n}].map(); const v = meValidate(m); return JSON.stringify({ map: meEncode(m), v: { errors: v.errors, warnings: v.warnings } }); })()`);
  const { map, v } = JSON.parse(json);
  const file = path.join(OUT, `act${n}.oldgold-map.json`);
  fs.writeFileSync(file, JSON.stringify(map));
  console.log(`акт ${n}: ${path.relative(process.cwd(), file)} (${map.w}×${map.h}), ошибок проверки ${v.errors.length}, предупреждений ${v.warnings.length}`);
  for (const e of v.errors) console.log('  ✗ ' + e);
  for (const w of v.warnings) console.log('  ⚠ ' + w);
}
