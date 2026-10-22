'use strict';
// Звуки арены (АРЕНА.md, 14.3): гонг раунда, отсчёт, рёв трибун, свист, удары, перекат, горшок проигравшему.
// Свой синтез на кирпичиках sfx.js (tone, noiseHit, modal), без пространства — как звуки забега (runsfx.js).
// Тишина, если звуки выключены кнопкой 🔊 или аудио ещё не запущено. В тестах и на сервере звука нет.

const ASfx = {
  last: {},
  gap: { hit: 0.06, miss: 0.08, step: 0.18, shot: 0.05, crowd: 0.8, boo: 1.5 },
  play(kind, vel = 1) {
    if (typeof RSfx === 'undefined' || !RSfx.ok()) return;
    const ctx = Sfx.ctx, now = ctx.currentTime;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* без звука */ } }
    if (now - (ASfx.last[kind] || -9) < (ASfx.gap[kind] || 0.04)) return;
    ASfx.last[kind] = now;
    const f = ASFX_DEF[kind];
    if (!f) return;
    try { f(AudioCore.sfx, now + 0.005, vel); } catch (e) { /* звук не критичен */ }
  },
};

const ASFX_DEF = {
  // гонг: низкий металл с долгим хвостом и биениями
  gong(d, t) { modal(d, t, [[110, 1, 2.4], [221, 0.6, 1.8], [293, 0.4, 1.4], [442, 0.25, 0.9]], 0.4, 0.004); noiseHit(d, 'lowpass', 900, 200, 0.6, t, 0.25, 0.25, 0.002); },
  // отсчёт: короткий деревянный стук, на «бой!» — выше
  count(d, t) { modal(d, t, [[660, 1, 0.12], [990, 0.4, 0.08]], 0.25, 0.002); },
  go(d, t) { modal(d, t, [[880, 1, 0.2], [1320, 0.5, 0.12]], 0.3, 0.002); tone(d, 'triangle', 440, 660, t, 0.25, 0.15); },
  // трибуны: шум толпы (рокот + «а-а-а»), сила vel
  crowd(d, t, v) {
    noiseHit(d, 'bandpass', 500, 900, 0.7, t, 1.4, 0.18 * v, 0.25);
    noiseHit(d, 'bandpass', 1400, 1100, 1.2, t + 0.1, 1.1, 0.08 * v, 0.3);
    for (const f of [196, 247, 294]) tone(d, 'sawtooth', f * (0.98 + Math.random() * 0.04), f * 1.02, t + Math.random() * 0.1, 1.0, 0.025 * v, 0.25);
  },
  // свист: два коротких «фьють»
  boo(d, t) { tone(d, 'sine', 1800, 2600, t, 0.18, 0.12, 0.01); tone(d, 'sine', 2600, 1500, t + 0.22, 0.28, 0.12, 0.01); },
  // удар: глухой шлепок, крит — со звоном
  hit(d, t, v) { noiseHit(d, 'bandpass', 1500, 600, 1.2, t, 0.08, 0.28 * v); tone(d, 'square', 200, 90, t, 0.07, 0.14 * v); },
  crit(d, t) { noiseHit(d, 'bandpass', 2200, 800, 1.2, t, 0.1, 0.3); modal(d, t + 0.01, [[1700, 1, 0.12], [2500, 0.5, 0.08]], 0.12, 0.002); },
  heavy(d, t) { tone(d, 'sine', 150, 50, t, 0.25, 0.4); noiseHit(d, 'lowpass', 1300, 200, 0.8, t, 0.2, 0.35); },
  shield(d, t) { modal(d, t, [[820, 1, 0.18], [1260, 0.5, 0.12]], 0.18, 0.002); },
  miss(d, t) { noiseHit(d, 'bandpass', 600, 2200, 0.9, t, 0.14, 0.14, 0.03); },
  swing(d, t) { noiseHit(d, 'bandpass', 400, 1800, 0.8, t, 0.12, 0.12, 0.03); },
  // замах тяжёлого: низкий рык-предупреждение
  tel(d, t) { tone(d, 'sawtooth', 120, 90, t, 0.3, 0.12, 0.05); },
  roll(d, t) { noiseHit(d, 'lowpass', 700, 300, 0.7, t, 0.22, 0.2, 0.02); },
  perfect(d, t) { for (const [f, k] of [[1046, 0], [1568, 0.07], [2093, 0.14]]) tone(d, 'sine', f, f, t + k, 0.3, 0.12, 0.004); },
  shot(d, t) { noiseHit(d, 'highpass', 2000, 4000, 0.6, t, 0.07, 0.12); tone(d, 'triangle', 600, 300, t, 0.07, 0.08); },
  thud(d, t) { tone(d, 'sine', 180, 70, t, 0.12, 0.25); noiseHit(d, 'lowpass', 800, 200, 0.7, t, 0.08, 0.2); },
  cast(d, t) { tone(d, 'triangle', 520, 880, t, 0.18, 0.12); tone(d, 'sine', 1040, 1320, t + 0.05, 0.15, 0.06); },
  ult(d, t) { for (const f of [262, 330, 392, 523]) tone(d, 'sawtooth', f, f * 1.01, t, 0.9, 0.06, 0.08); noiseHit(d, 'bandpass', 400, 1200, 0.8, t, 0.9, 0.12, 0.2); },
  heal(d, t) { tone(d, 'sine', 523, 523, t, 0.12, 0.15); tone(d, 'sine', 659, 784, t + 0.1, 0.22, 0.15); },
  stun(d, t) { for (let k = 0; k < 3; k++) tone(d, 'sine', 1400 + k * 300, 1200 + k * 300, t + k * 0.06, 0.1, 0.07); },
  step(d, t) { noiseHit(d, 'lowpass', 700, 300, 0.8, t, 0.05, 0.06); },
  // горшок: «дзынь-бум» — глиняный звон и удар
  pot(d, t) { modal(d, t, [[1320, 1, 0.25], [1980, 0.4, 0.15]], 0.2, 0.002); tone(d, 'sine', 160, 60, t + 0.18, 0.3, 0.4); noiseHit(d, 'lowpass', 900, 150, 0.7, t + 0.18, 0.25, 0.3); },
  win(d, t) { [523, 659, 784, 1046].forEach((f, k) => { tone(d, 'triangle', f, f, t + k * 0.14, 0.5, 0.2); tone(d, 'sine', f / 2, f / 2, t + k * 0.14, 0.5, 0.15); }); },
  lose(d, t) { [392, 330, 262, 196].forEach((f, k) => tone(d, 'triangle', f, f * 0.97, t + k * 0.22, 0.55, 0.2)); },
  // «бубнёж» распорядителя в рупор: слоги без слов
  brum(d, t) { for (let k = 0; k < 5; k++) { const f = 160 + Math.random() * 90; tone(d, 'square', f, f * (0.85 + Math.random() * 0.3), t + k * 0.09, 0.08, 0.05, 0.01); } },
  ui(d, t) { tone(d, 'triangle', 600, 600, t, 0.06, 0.1); },
};
