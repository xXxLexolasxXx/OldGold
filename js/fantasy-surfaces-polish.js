'use strict';
// Load after terrain.js. Visual-only water detail: no world edits, timers or RNG.
(() => {
  if (window.FantasySurfacesPolish) return;
  const frames = [];
  const colors = ['#619599', '#7caeaa', '#a1c6b7'];
  for (let f = 0; f < 16; f++) {
    const cv = document.createElement('canvas'); cv.width = 56; cv.height = 18;
    const c = cv.getContext('2d');
    // Match approved buildings: 2x intermediate buffer, world-space dimensions.
    c.scale(2, 2); c.imageSmoothingEnabled = false;
    // Fade in/out through pixel clusters rather than opacity pulsing.
    const life = Math.sin(Math.PI * f / 15);
    if (life > 0.15) {
      const width = 3 + Math.round(life * 9), drift = Math.floor(f / 5);
      c.fillStyle = colors[0]; c.fillRect(11 - (width >> 1) + drift, 5, width + 3, 1);
      c.fillStyle = colors[1]; c.fillRect(10 - (width >> 1) + drift, 4, width, 1);
      if (life > 0.65) {
        c.fillStyle = colors[2]; c.fillRect(9 - (width >> 1) + drift, 4, 3, 1);
        c.fillStyle = colors[0]; c.fillRect(17 + drift, 1, 4, 1);
      }
    }
    frames.push(cv);
  }
  const original = terrDraw;
  const info = window.FantasySurfacesPolish = { frames: frames.length, drawn: 0 };
  terrDraw = function (c, cam, vw, vh) {
    original(c, cam, vw, vh);
    if (!TERR.ready) return;
    const x0 = Math.max(1, Math.floor(cam.x / TILE) - 1), y0 = Math.max(1, Math.floor(cam.y / TILE) - 1);
    const x1 = Math.min(MAP_W - 2, Math.ceil((cam.x + vw) / TILE)), y1 = Math.min(MAP_H - 2, Math.ceil((cam.y + vh) / TILE));
    const tick = Math.floor(Game.time * 3);
    let drawn = 0;
    c.save(); c.globalAlpha = 0.48; c.imageSmoothingEnabled = R.smooth;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y), h = hash(i + 0x3751);
      if ((h & 7) !== 0 || World.terrain[i] !== T_WATER) continue;
      // Keep clusters off the blended shore, including diagonal coves.
      let open = true;
      for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (World.terrain[idx(x + dx, y + dy)] !== T_WATER) { open = false; break; }
      }
      if (!open) continue;
      const phase = (tick + (h >>> 8)) & 15;
      c.drawImage(frames[phase], x * TILE + 2 + ((h >>> 4) & 3), y * TILE + 9 + ((h >>> 6) & 7), 28, 9);
      drawn++;
    }
    c.restore(); info.drawn = drawn;
  };
})();
