'use strict';
// Ночной туман (world/night.js): клубы не бывают непрозрачными и над деревней редеют, а в лесу остаются густыми.
// Жалоба тестера 0.10.90: ночью весь город тонул в светло-серой пелене. Запуск: node tests/nightfog-test.js
const S = require('./lib/sim');
const fails = [];
const ok = (c, m) => { if (!c) { fails.push(m); console.log('  ✗ ' + m); } };

for (const seed of [11, 22, 33]) {
  const h = S.newSim(seed).h;
  const r = JSON.parse(h.run(`JSON.stringify((() => {
    const b = Game.buildings.find(b => b.type === 'bonfire') || Game.buildings[0];
    const vx = (b.x + b.w / 2) * TILE, vy = (b.y + b.h / 2) * TILE;
    // дикая клетка: трава, вокруг на 6 клеток ни зданий, ни дорог
    let wild = null;
    for (let y = 8; y < MAP_H - 8 && !wild; y += 3) for (let x = 8; x < MAP_W - 8 && !wild; x += 3) {
      let free = World.terrain[y * MAP_W + x] === T_GRASS;
      for (let dy = -6; dy <= 6 && free; dy++) for (let dx = -6; dx <= 6 && free; dx++) { const i = (y + dy) * MAP_W + x + dx; if (World.bmap[i] || World.road[i]) free = false; }
      if (free) wild = [x * TILE + 16, y * TILE + 16];
    }
    let max = 0;
    for (let k = 0; k < 400; k++) max = Math.max(max, fogPuffAlpha(1.15, (k * 2654435761) >>> 0, wild[0], wild[1]));
    const H = 99 << 12;   // самый густой клуб
    return { village: fogPuffAlpha(1.15, H, vx, vy), wild: fogPuffAlpha(1.15, H, wild[0], wild[1]), max, cap: FOG_MAX };
  })())`));
  ok(r.max <= r.cap + 1e-9 && r.cap < 0.8, `сид ${seed}: клуб тумана гуще потолка (${r.max.toFixed(2)})`);
  ok(r.village <= 0.25, `сид ${seed}: над деревней туман густой (${r.village.toFixed(2)})`);
  ok(r.wild >= 0.45, `сид ${seed}: в лесу туман пропал (${r.wild.toFixed(2)})`);
  console.log(`сид ${seed}: деревня ${r.village.toFixed(2)}, лес ${r.wild.toFixed(2)}, потолок ${r.cap}`);
}
if (fails.length) { console.log(`✗ провалов: ${fails.length}`); process.exit(1); }
console.log('✓ ночной туман: потолок и проредь над деревней');
