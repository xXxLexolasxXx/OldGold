// Игровая часть пиксельного трактира: из модели buildInn собирает объект спрайта в формате buildingSprite
// (canvas/shadow/w/h/top/padx/…) и переводит точки модели (веранда, печь, бар, окна, двор) в пиксели спрайта.
// Этот кусок вклеивается в js/bldpx.js сборщиком build-runtime.js, внутри общей обёртки-IIFE.

function innPxBuild(rot, lv) {
  const def = BUILDINGS.inn, d = bDims('inn', rot);
  const FW = d.w * TILE, FD = d.h * TILE, top = def.top + 34;
  const W = Math.ceil(FW + BPADX * 2 + FD * BSK), H = FD + top + BBOTTOM;
  BK = 1;
  const g = new BGrid(W, H, BPADX, top + FD);
  g.rot = 0; g.LD = FD; g.noSmoke = true;   // вход на восток — своя ровная компоновка 3×4, а не поворот модели
  (d.rot ? buildInnTall : buildInn)(g, lv, ROOF_LV[lv](STRAW1.olive));
  g.finish({ step: 1.6, ink: P1.ink });
  const M = g.meta;
  const scr = p => { const q = g.W3(p); return [g.sx(q[0], q[1]), g.sy(q[1], p[2] || 0)]; };
  // окна → [cx, cy, w, h, round] в пикселях спрайта (как WIN_REC у старых зданий)
  const sideW = s => s;
  const wins = [];
  for (const w of M.wins) {
    const ws = sideW(w.side);
    if (ws !== 'S' && ws !== 'E') continue;
    const c = w.side === 'S' || w.side === 'N' ? [w.a + w.w / 2, w.at, w.z + w.h / 2] : [w.at, w.a + w.w / 2, w.z + w.h / 2];
    const [x, y] = scr(c);
    wins.push([x, y, ws === 'S' ? w.w : Math.max(3, w.w * 0.5), w.h, w.round]);
  }
  const shadow = mkCanvas(W, H), sc = shadow.getContext('2d');
  sc.filter = 'blur(2px)'; sc.fillStyle = 'rgba(30,22,12,0.32)';
  const corners = [[0, 0, 0], [FW, 0, 0], [FW, FD, 0], [0, FD, 0]].map(scr);
  sc.beginPath(); corners.forEach((p, i) => (i ? sc.lineTo(p[0] + 3, p[1] - 2) : sc.moveTo(p[0] + 3, p[1] - 2))); sc.closePath(); sc.fill();
  const spr = {
    canvas: innPxUp(g.toCanvas(), 3), shadow, w: W, h: H, top, padx: BPADX, fw: FW, baseY: top + FD - 2, doorCx: BPADX + (d.dx + 0.5) * TILE,
    pxInn: lv, noDeck: true, k1: true,
    chimneys: (g.chim || []).map(scr), wins,
    porch: scr(M.porch), oven: scr(M.oven), bar: scr(M.bar), doorPt: scr(M.doorPt),
    perches: d.rot ? [scr([30, 99, 63]), scr([78, 113, 42])] : [scr([33, 69, 63]), scr([114, 78, 44])],
    fire: M.fire && scr(M.fire), spit: M.spit && scr(M.spit), chop: M.chop && scr(M.chop), darts: M.darts && scr(M.darts), stage: M.stage && scr(M.stage),
    seats: (M.seats || []).map(scr), tables: (M.tables || []).map(scr), pantry: (M.pantry || []).map(scr), stock: (M.stock || []).map(scr),
    feast: (M.feast || []).map(p => [...scr(p), p[3]]),
  };
  return spr;
}

// ×3 ближайшим соседом: игра рисует здания со сглаживанием, а у холста ×3 пиксели остаются чёткими (как у прежних спрайтов)
function innPxUp(src, k) { const cv = mkCanvas(src.width * k, src.height * k), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, cv.width, cv.height); return cv; }

// зеркало для входа с запада (rot 2): старые поля отражает mirrorSprite, новые — здесь
function innPxMirror(s) {
  const m = mirrorSprite(s, s.fw), W = s.w, pt = p => p && [W - p[0], p[1], ...p.slice(2)];
  for (const k of ['fire', 'spit', 'chop', 'darts', 'stage']) m[k] = pt(s[k]);
  for (const k of ['seats', 'tables', 'pantry', 'stock', 'feast']) m[k] = (s[k] || []).map(pt);
  return m;
}

function innPxSprite(rot, lv) {
  const d = bDims('inn', rot), key = 'inn:px:' + d.rot + ':' + lv;
  if (SPR.buildings[key]) return SPR.buildings[key];
  const spr = d.rot === 2 ? innPxMirror(innPxSprite(1, lv)) : innPxBuild(d.rot, lv);
  SPR.buildings[key] = spr;
  return spr;
}
