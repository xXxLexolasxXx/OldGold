'use strict';
// Примерка единого пиксельного шаблона для нечисти: A — как в игре, B/C/D — тот же векторный
// исходник, сведённый с МЕЛКИМ шагом: в 2/3/4 раза больше пикселей на тот же размер (больше деталей).
// Только для листов выбора, в игру не подключено.

const PXS = { last: null, orig: toPixelArt, mkOrig: mkSprite, HI: 12 };

// Векторный холст спрайта рисуем в высоком разрешении (12 px на игровой пиксель), игра об этом не знает:
// перехват toPixelArt сводит его в тот же размер, что и обычно. Холсты-заготовки с собственным
// setTransform (князь, скелет, голем, люди: s = 6) не трогаем — у них и так 6 px на игровой.
mkSprite = function (w, h, s = SS) {
  if (s > 3) return PXS.mkOrig(w, h, s);
  const m = PXS.HI / s, r = PXS.mkOrig(w, h, s * m);
  r[0]._pxsM = m;
  return r;
};
toPixelArt = function (src, scale, opts = {}) {
  const m = src._pxsM || 1;
  PXS.last = { src, scale: scale * m, opts };
  return PXS.orig(src, scale * m, opts);
};

// Одиночные «пылинки» без соседей — прочь (чистый пиксель-арт без лишних точек)
function pxsDespeckle(cv) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d'), img = c.getImageData(0, 0, W, H), d = img.data;
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (!src[o + 3]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && src[(yy * W + xx) * 4 + 3]) n++;
    }
    if (n === 0) d[o + 3] = 0;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// Наложения поверх сведённого кадра (лицо энта, глаза князя): пиксели итогового кадра, которых нет
// в чистом повторном сведении. Нарисованы рукой в игровом размере — переносим их блоками.
function pxsOverlay(fin, rerun, g, k, out) {
  const W = fin.width, H = fin.height;
  if (rerun.width !== W || rerun.height !== H) return;
  const a = fin.getContext('2d').getImageData(0, 0, W, H).data, b = rerun.getContext('2d').getImageData(0, 0, W, H).data;
  const oc = out.getContext('2d'), f = k / g;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    if (!a[o + 3] || (a[o] === b[o] && a[o + 1] === b[o + 1] && a[o + 2] === b[o + 2] && a[o + 3] === b[o + 3])) continue;
    oc.fillStyle = `rgb(${a[o]},${a[o + 1]},${a[o + 2]})`;
    oc.fillRect(Math.floor(x * f), Math.floor(y * f), Math.max(1, Math.round(f)), Math.max(1, Math.round(f)));
  }
}

// Свести источник с разрешением r (px на игровой пиксель) в шаг 1/k игрового пикселя.
// Если r не делится на k — сначала плавно пересэмплируем до ближайшего кратного.
function pxsReduce(src, r, k, opts) {
  let t = r / k, S = src;
  if (t < 1 || t !== Math.round(t)) {
    const R2 = k * Math.max(1, Math.ceil(r / k));
    S = mkCanvas(Math.round(src.width * R2 / r), Math.round(src.height * R2 / r));
    const c = S.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, S.width, S.height);
    t = R2 / k;
  }
  return pxsDespeckle(PXS.orig(S, t, opts));
}

// make() возвращает итоговый игровой канвас кадра; g — px этого канваса на игровой пиксель.
// Ответ: { A, g, src: 'vec' | 'own', v: { k: канвас с шагом 1/k } }. 'own' — ручной пиксель-арт
// без векторного исходника: мельче его можно сделать только перерисовкой.
function pxsVariants(make, g = 1, ks = [2, 3, 4], o = {}) {
  PXS.last = null;
  const A = make();
  const cap = o.own ? null : PXS.last;
  const res = { A, g, v: {}, src: cap || o.vec ? 'vec' : 'own' };
  const base = { outline: true, outlineDark: 0.5, alphaCut: o.cut || 110, clean: true };
  if (!cap) {
    if (o.vec) for (const k of ks) res.v[k] = pxsReduce(A, g, k, base);
    return res;
  }
  const rerun = PXS.orig(cap.src, cap.scale, cap.opts);
  const r = cap.scale * g;
  for (const k of ks) {
    const cv = pxsReduce(cap.src, r, k, Object.assign({}, cap.opts, base, { ink: 0, onData: null }));
    pxsOverlay(A, rerun, g, k, cv);
    res.v[k] = cv;
  }
  return res;
}
