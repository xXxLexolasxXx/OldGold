'use strict';
// Звуки кампании (свой синтез на кирпичиках sfx.js — tone, noiseHit, modal; никаких записей):
//  • campBoom — взрыв горы в акте 1: удар-«бабах» в груди, сухой треск, гул и долгая осыпь камней;
//  • campRockfall — обвал в акте 2: низкий рокот, треск свода, стук валунов и шорох щебня (зовётся, пока идёт волна);
//  • gobHorn — гоблинский рожок перед волной: два гнусавых хриплых гудка, второй задирается вверх и не дотягивает.
// campSnd — звук в точке мира; если точка далеко за кадром, его всё равно слышно — тише и из центра экрана.

if (typeof SFX_DEF !== 'undefined' && typeof SFX !== 'undefined') {
  Object.assign(SFX_DEF, {
    campBoom: { pri: 4, gain: 0.6, poly: 1, cd: 1, len: 5, wet: 0.45 },
    campRockfall: { pri: 3, gain: 0.7, poly: 2, cd: 0.8, len: 2.6, wet: 0.3 },
    gobHorn: { pri: 3, gain: 0.5, poly: 1, cd: 1.5, len: 1.8, wet: 0.5 },
  });
  // стук и шорох мелких камней: n щелчков вразброс за len секунд, к концу реже и тише
  const campPebbles = (d, t, n, len, vol) => {
    for (let k = 0; k < n; k++) {
      const u = Math.pow(Math.random(), 1.6), tt = t + u * len, a = vol * (1 - u * 0.7) * (0.5 + Math.random() * 0.5);
      const f = 1100 + Math.random() * 2200;
      modal(d, tt, [[f, 1, 0.05], [f * 2.3, 0.4, 0.03]], a * 0.5, 0.001);
      noiseHit(d, 'bandpass', f * 1.4, f, 2, tt, 0.03, a * 0.6, 0.001);
    }
  };
  // гнусавая медная нота: пила и квадрат вразнобой через «рупор» (полоса) и раскрывающийся фильтр, с хрипом
  const campHornNote = (d, t, f0, f1, len, vol) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 820; bp.Q.value = 1.6;
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.12); lp.frequency.linearRampToValueAtTime(1300, t + len);
    g.gain.value = 1; bp.connect(lp); lp.connect(g); g.connect(d);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();             // хрип: быстрая дрожь громкости
    lfo.frequency.value = 38; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain);
    const vib = ctx.createOscillator(), vg = ctx.createGain();             // вибрато — у гоблина дыхалка не очень
    vib.frequency.value = 6.5; vg.gain.value = f1 * 0.012; vib.connect(vg);
    for (const [type, mul, a] of [['sawtooth', 1, 1], ['square', 1.012, 0.45]]) {   // нота держится, а не гаснет, как у tone()
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0 * mul, t); o.frequency.linearRampToValueAtTime(f1 * mul, t + len * 0.6);
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vol * a, t + 0.06);
      og.gain.setValueAtTime(vol * a * 0.85, t + len - 0.14); og.gain.linearRampToValueAtTime(0.0001, t + len);
      vg.connect(o.frequency); o.connect(og); og.connect(bp); o.start(t); o.stop(t + len + 0.02);
    }
    lfo.start(t); lfo.stop(t + len + 0.05); vib.start(t); vib.stop(t + len + 0.05);
    noiseHit(d, 'bandpass', 1600, 900, 1.2, t, 0.12, vol * 0.5, 0.01);   // «пф-ф» в мундштук
  };
  Object.assign(SFX, {
    campBoom: (d, t, v) => {
      tone(d, 'sine', 74 + v * 10, 24, t, 1.7, 1, 0.004);                                  // удар в груди
      tone(d, 'triangle', 140, 40, t, 0.5, 0.5, 0.003);
      noiseHit(d, 'bandpass', 2600, 700, 0.8, t, 0.28, 0.9, 0.001);                      // сухой треск
      noiseHit(d, 'lowpass', 1400, 70, 0.7, t + 0.02, 2.8, 1, 0.01);                      // раскат
      tone(d, 'sine', 42, 30, t + 0.3, 4.2, 0.45, 0.4);                                    // гул горы
      noiseHit(d, 'lowpass', 260, 60, 0.8, t + 0.5, 4, 0.55, 0.6);
      for (let k = 0; k < 4; k++) noiseHit(d, 'bandpass', 500 + Math.random() * 700, 300, 3, t + 0.6 + k * 0.55 + Math.random() * 0.3, 0.07, 0.4, 0.002);   // трещины
      for (let k = 0; k < 5; k++) tone(d, 'sine', 120 + Math.random() * 60, 45, t + 0.8 + Math.random() * 2.4, 0.3, 0.35, 0.004);   // валуны падают
      campPebbles(d, t + 0.7, 26, 3.6, 0.45);                                               // осыпь
    },
    campRockfall: (d, t, v) => {
      noiseHit(d, 'lowpass', 240, 60, 0.7, t, 2.4, 0.75, 0.25);                            // рокот
      tone(d, 'sine', 40 + v * 6, 30, t, 2.2, 0.35, 0.3);
      for (let k = 0; k < 2 + (v * 3 | 0); k++) noiseHit(d, 'bandpass', 700 + Math.random() * 900, 400, 3, t + 0.1 + Math.random() * 1.6, 0.06, 0.4, 0.002);   // треск свода
      if (v > 0.4) tone(d, 'sine', 110 + v * 40, 42, t + 0.3 + v, 0.35, 0.5, 0.004);    // валун
      campPebbles(d, t + 0.2, 12, 2, 0.3);                                                  // щебень
    },
    gobHorn: (d, t, v) => {
      const r = 0.96 + v * 0.08;
      campHornNote(d, t, 168 * r, 176 * r, 0.42, 0.5);
      campHornNote(d, t + 0.5, 170 * r, 246 * r, 1.05, 0.55);                              // вверх — и не дотянул до квинты
    },
  });
}

// x == null — по ширине кадра (волна обвала идёт через всю карту)
function campSnd(kind, x, y, v = 1) {
  if (typeof sfxAt !== 'function' || typeof R === 'undefined' || !R.cam || !R.canvas || typeof camScale !== 'function') return;
  const s = camScale(), cx = R.cam.x + R.canvas.clientWidth / s / 2, cy = R.cam.y + R.canvas.clientHeight / s / 2;
  const wx = x == null ? cx : x * TILE, wy = y * TILE, p = typeof sfxPlace === 'function' ? sfxPlace(wx, wy) : null;
  if (p && p.vol > 0.3) sfxAt(kind, wx, wy, v);
  else sfxAt(kind, cx, cy, v * 0.5);
}
