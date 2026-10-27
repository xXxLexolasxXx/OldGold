// Лист слуг Малгора: было (векторный naFrame) → стало (пиксель-арт foepx.js), все кадры, игровой масштаб.
// Страница tools/foepx-sheet.html, снимок: node tools/foepx-shot.js [all|frames] [файл.png]
const FOE_KINDS = [['fMalgor1', 'Малгор, фаза 1'], ['fMalgor3', 'Малгор, фаза 3'], ['fKnight', 'Рыцарь тьмы'], ['fThrall', 'Прислужник тьмы'], ['fRaven', 'Ворон-разведчик'], ['fBone', 'Костяной прислужник'],
  ['fG_fire', 'Страж огня'], ['fG_ice', 'Страж льда'], ['fG_bone', 'Страж костей'], ['fG_shadow', 'Страж теней'], ['fG_golem', 'Страж-голем'], ['fRock', 'Ожившая глыба']];
function foeSheet(mode) {
  const cv = document.getElementById('cv'), c = cv.getContext('2d');
  const T = (s, x, y, sz = 20, col = '#f2e6c8', al = 'left') => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = col; c.font = `bold ${sz}px Segoe UI, sans-serif`; c.textAlign = al; c.fillText(s, x, y); c.restore(); };
  const cell = (x, y, w, h) => { c.fillStyle = '#3e5a30'; c.fillRect(x, y, w, h); c.fillStyle = '#486a38'; for (let i = 0; i < w * h / 900; i++) c.fillRect(x + (i * 37 % w), y + (i * 53 % h), 3, 2); };
  const after = (k, fr, x, y, Z) => { const s = foePxFrame(k, fr); c.save(); c.imageSmoothingEnabled = false; c.drawImage(s.cv, x - s.ax * Z, y - s.ay * Z, s.w * Z, s.h * Z); c.restore(); return s; };
  const before = (k, fr, x, y, Z) => { const s = naFrame(k, fr); c.save(); c.translate(x, y); c.scale(Z, Z); blitFine(c, s.cv, -s.ax, -s.ay); c.restore(); };
  const keyFr = k => k === 'fRaven' ? ['i1', 'i4'] : k.startsWith('fMalgor') ? ['i0', 'i2', 'i4', 'c1', 'c3', 'c5'] : k.startsWith('fG_') || k === 'fBone' ? ['i0', 'w1', 'w5', 'windup', 'strike', 'hurt', 'c3'] : ['i0', 'w1', 'w5', 'windup', 'strike', 'recover'];
  if (mode === 'frames') {
    cv.width = 2400; cv.height = 12 * 250 + 40; c.fillStyle = '#1d2e26'; c.fillRect(0, 0, cv.width, cv.height);
    FOE_KINDS.forEach(([k, nm], i) => {
      const y0 = 20 + i * 250, b = FPX_BOX[k], Z = Math.min(3, 200 / b[1]);
      T(nm, 10, y0 + 20, 18); keyFr(k).forEach((fr, j) => { const x = 10 + j * 330; cell(x, y0 + 26, 320, 220); T(fr, x + 6, y0 + 44, 14, '#cfe8d6'); after(k, fr, x + 150, y0 + 26 + 214 - (b[1] - b[3]) * Z, Z); });
    });
    return;
  }
  if (mode === 'big') {                                                                         // крупно ×6 по одному
    const ks = (new URLSearchParams(location.search).get('k') || 'fMalgor1').split(','), Z = 6;
    let W = 20; for (const k of ks) W += FPX_BOX[k][0] * Z * 2 + 20;
    cv.width = W; cv.height = Math.max(...ks.map(k => FPX_BOX[k][1])) * Z + 40; c.fillStyle = '#1d2e26'; c.fillRect(0, 0, cv.width, cv.height);
    let x = 10;
    for (const k of ks) { const b = FPX_BOX[k]; for (const f of [k.startsWith('fMalgor') ? 'i0' : 'i0', k.startsWith('fMalgor') ? 'c3' : 'strike']) { cell(x, 10, b[0] * Z, b[1] * Z); after(k, f, x + b[2] * Z, 10 + b[3] * Z, Z); x += b[0] * Z + 10; } }
    return;
  }
  // главный лист: было → стало крупно, кадры и игровой масштаб
  cv.width = 2420; cv.height = 2760; c.fillStyle = '#1d2e26'; c.fillRect(0, 0, cv.width, cv.height);
  T('Слуги Малгора: было → стало (ручной пиксель-арт ×3 по образцу Полудницы)', 20, 40, 32);
  T('Своя графика. В каждой клетке слева — прежний кадр (вектор), справа — новый, одинаковый масштаб. Голем и глыба по просьбе владельца крупнее и страшнее.', 20, 70, 17, '#b8d4c0');
  const cw = 390, ch = 420;
  FOE_KINDS.forEach(([k, nm], i) => {
    const x = 10 + (i % 6) * (cw + 10), y = 90 + Math.floor(i / 6) * (ch + 20), b = FPX_BOX[k], z = Math.min(3.4, 300 / b[1]);
    cell(x, y, cw, ch); T(nm, x + 8, y + 24, 18, '#ffd27a');
    const gy = y + ch - 40 - (k === 'fRaven' ? 120 : 0), fr = k === 'fRaven' ? 'i1' : k.startsWith('fMalgor') ? 'c3' : 'strike';
    before(k, k === 'fRaven' ? 'i1' : 'i0', x + cw * 0.24, gy, z); after(k, fr, x + cw * 0.64, gy, z);
    T('было', x + cw * 0.24, y + ch - 10, 13, '#c8c8c8', 'center'); T(k.startsWith('fMalgor') ? 'стало: колдовство' : k === 'fRaven' ? 'стало' : 'стало: удар', x + cw * 0.64, y + ch - 10, 13, '#ffd27a', 'center');
  });
  const y1 = 90 + 2 * (ch + 20) + 20;
  T('Кадры (×2): покой, шаг, шаг, замах, удар, урон / восстановление, колдовство', 20, y1 + 10, 20);
  let yy = y1 + 24, col = 0, x0 = 10;
  for (const [k, nm] of FOE_KINDS) {
    if (k === 'fBone' || k === 'fRock' || k === 'fRaven') continue;
    const b = FPX_BOX[k], z = 2, fr = keyFr(k), w = b[0] * z * 0.8, h = b[1] * z;
    if (yy + h + 34 > 2740) { yy = y1 + 24; x0 = 1220; }
    let x = x0; T(nm, x + 4, yy + 16, 14, '#cfe8d6');
    for (const f of fr) { cell(x, yy + 20, w, h + 6); after(k, f, x + w * 0.45, yy + 20 + b[3] * z, z); x += w + 4; }
    yy += h + 34;
  }
  let x = x0, sy = yy;
  for (const k of ['fBone', 'fRock', 'fRaven']) {
    const b = FPX_BOX[k], z = 2, w = b[0] * z + 4, h = b[1] * z;
    for (const f of keyFr(k)) { cell(x, sy, w, h); after(k, f, x + b[2] * z, sy + b[3] * z, z); x += w + 4; }
    x = x0; sy += h + 10;
  }
}
