'use strict';
// Ручная нечисть, перерисованная под мелкий пиксель (PX_FINE > 1, pixel.js): летучие мыши; помощники
// nxFine/nxDissolve — общие (ими же рисуется эхо павших в foeart.js). Баньши, лесная нечисть фей и волк
// перерисованы в ветке noon-scary (решение владельца 23.10). При PX_FINE = 1 — прежние спрайты.

// Свести векторный рисунок w×h (в игровых пикселях, начало в ox, oy) в мелкий пиксель-арт
function nxFine(w, h, ox, oy, draw, opts = {}) {
  const F = PX_FINE, S = 2 * F, cv = mkCanvas(w * S, h * S), c = cv.getContext('2d', { willReadFrequently: true });
  c.scale(S, S); c.translate(ox, oy); c.lineCap = 'round'; c.lineJoin = 'round';
  draw(c);
  const out = toPixelArt(cv, 2, Object.assign({ outline: true, outlineDark: 0.55, alphaCut: 96, clean: true }, opts));
  out.fine = F;
  return out;
}

// «Растворение» книзу: мелкие дыры тем гуще, чем ниже — край тает пикселями, а не полупрозрачностью
function nxDissolve(c, x0, y0, w, h, seed, k = 1) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
  for (let n = 0; n < 520 * k; n++) {
    const t = rnd(), y = y0 + t * h;
    if (rnd() > t * t * 1.15) continue;
    const z = 0.35 + rnd() * 0.6;
    c.fillRect(x0 + rnd() * w, y, z, z);
  }
  c.restore();
}

// ---------- Летучие мыши (nechist.js): кадр по взмаху, 9 ступеней от крыльев вниз до вверх ----------
function nxBat(c, flap) {
  const w = 5 + Math.abs(flap) * 2.5, up = flap * 3.2, M = '#2a2236', M2 = '#3c3050', BN = '#0e0a14';
  for (const s of [-1, 1]) {
    // перепонка: зубчатый край между «пальцами»
    c.fillStyle = s < 0 ? M : M2;
    c.beginPath(); c.moveTo(s * 1, 0); c.lineTo(s * w, -2 - up); c.lineTo(s * (w - 1.8), 1 - up * 0.4); c.lineTo(s * (w - 3.4), 0.4); c.lineTo(s * (w - 5), 2.2); c.closePath(); c.fill();
    c.strokeStyle = BN; c.lineWidth = 0.35;
    c.beginPath(); c.moveTo(s * 1, -0.2); c.lineTo(s * w, -2 - up); c.moveTo(s * (w * 0.5), -1 - up * 0.5); c.lineTo(s * (w - 1.8), 1 - up * 0.4); c.moveTo(s * (w * 0.5), -1 - up * 0.5); c.lineTo(s * (w - 3.4), 0.4); c.stroke();
  }
  ellipse(c, 0, 0.4, 1.3, 1.8, '#16121c');                                               // тело
  ellipse(c, 0, -1.8, 1.1, 1, '#16121c');                                                 // голова
  for (const s of [-1, 1]) poly(c, [[s * 0.4, -2.4], [s * 1.2, -4], [s * 1.1, -2.2]], '#16121c');   // ушки
  c.fillStyle = '#ff8060'; c.fillRect(-0.75, -2.1, 0.5, 0.45); c.fillRect(0.25, -2.1, 0.5, 0.45);   // красные глазки
  c.fillStyle = '#f0ecd8'; c.fillRect(-0.35, -1, 0.25, 0.4); c.fillRect(0.1, -1, 0.25, 0.4);         // клычки
}
const NX_BAT = [];
function nxBatFrame(flap) {
  const i = Math.max(0, Math.min(8, Math.round((flap + 1) * 4)));
  return NX_BAT[i] || (NX_BAT[i] = nxFine(18, 14, 9, 8, c => nxBat(c, i / 4 - 1), { outlineDark: 0.7 }));
}
if (typeof drawBats === 'function') {
  const _bats = drawBats;
  drawBats = function (c) {
    if (PX_FINE <= 1) return _bats(c);
    const bats = Game.bats;
    if (!bats || !bats.length) return;
    for (const b of bats) {
      if (b.state === 'grab') { drawBatGrab(c, b); continue; }
      const px = Math.round(b.x * TILE), py = Math.round(b.y * TILE - b.z);
      c.fillStyle = 'rgba(10,8,4,0.2)'; c.beginPath(); c.ellipse(px, b.y * TILE + 2, 4, 1.2, 0, 0, 7); c.fill();
      blitFine(c, nxBatFrame(Math.sin(b.ph)), px - 9, py - 8, 18, 14);
    }
  };
}
