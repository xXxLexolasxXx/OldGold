'use strict';
// Звуки забега и таверны. Синтез на общем аудио-ядре (sfx.js/music.js), без пространственной привязки:
// RSfx.play('hit') и т.п. Тишина, если звуки мира выключены (кнопка 🔊) или контекст ещё не создан.

const RSfx = {
  ok() { if (typeof Sfx === 'undefined' || !Sfx.on) return false; if (!Sfx.ctx) { try { sfxInit(); } catch (e) { return false; } } return !!(Sfx.ctx && AudioCore.sfx && Sfx.ctx.state !== 'closed'); },
  last: {},
  play(kind, vel = 1) {
    if (!RSfx.ok()) return;
    const ctx = Sfx.ctx, now = ctx.currentTime;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* без звука */ } }
    if (now - (RSfx.last[kind] || -9) < (RSfx.gap[kind] || 0.04)) return;   // не чаще, чем нужно: иначе каша
    RSfx.last[kind] = now;
    const f = RSfx.def[kind]; if (!f) return;
    try { f(AudioCore.sfx, now + 0.005, vel); } catch (e) { /* звук не критичен */ }
  },
  gap: { hit: 0.08, hurt: 0.06, step: 0.2, coin: 0.05 },
  def: {
    hit(d, t, v) { noiseHit(d, 'bandpass', 1800, 700, 1.2, t, 0.09, 0.25 * v); tone(d, 'square', 220, 110, t, 0.07, 0.12 * v); },
    hurt(d, t, v) { noiseHit(d, 'lowpass', 900, 300, 0.8, t, 0.16, 0.3 * v); tone(d, 'sawtooth', 160, 70, t, 0.18, 0.2 * v); },
    heroHurt(d, t, v) { tone(d, 'sawtooth', 260, 90, t, 0.28, 0.32 * v); noiseHit(d, 'lowpass', 1200, 200, 0.7, t, 0.22, 0.3 * v); },
    kill(d, t, v) { modal(d, t, [[310, 1, 0.22], [520, 0.6, 0.15], [740, 0.35, 0.1]], 0.3 * v); noiseHit(d, 'bandpass', 2400, 500, 1, t, 0.15, 0.22 * v); },   // костяной хруст
    rattle(d, t, v) { for (let k = 0; k < 4; k++) modal(d, t + k * 0.04, [[900 + k * 130, 1, 0.05]], 0.12 * v); },
    dash(d, t, v) { noiseHit(d, 'bandpass', 400, 2600, 0.9, t, 0.16, 0.28 * v, 0.03); },
    slam(d, t, v) { tone(d, 'sine', 140, 40, t, 0.4, 0.5 * v); noiseHit(d, 'lowpass', 1600, 150, 0.7, t, 0.35, 0.45 * v); modal(d, t, [[90, 1, 0.4], [180, 0.5, 0.25]], 0.3 * v); },
    coin(d, t, v) { tone(d, 'square', 988, 988, t, 0.06, 0.1 * v); tone(d, 'square', 1319, 1319, t + 0.06, 0.12, 0.1 * v); },
    heal(d, t, v) { tone(d, 'sine', 523, 523, t, 0.12, 0.18 * v); tone(d, 'sine', 659, 784, t + 0.1, 0.22, 0.18 * v); },
    stairs(d, t, v) { for (let k = 0; k < 4; k++) tone(d, 'triangle', 330 * Math.pow(1.26, k), 330 * Math.pow(1.26, k), t + k * 0.09, 0.3, 0.16 * v); },
    pick(d, t, v) { tone(d, 'triangle', 440, 440, t, 0.1, 0.2); tone(d, 'triangle', 660, 880, t + 0.08, 0.3, 0.22); },
    bolt(d, t, v) { tone(d, 'sawtooth', 520, 180, t, 0.24, 0.16 * v); tone(d, 'sine', 780, 300, t, 0.2, 0.1 * v); },
    shoot(d, t, v) { noiseHit(d, 'highpass', 2000, 4000, 0.6, t, 0.08, 0.15 * v); tone(d, 'triangle', 600, 300, t, 0.08, 0.1 * v); },
    boom(d, t, v) { tone(d, 'sine', 120, 35, t, 0.45, 0.45 * v); noiseHit(d, 'lowpass', 1400, 120, 0.7, t, 0.4, 0.4 * v); },
    caw(d, t, v) { tone(d, 'sawtooth', 700, 420, t, 0.12, 0.12 * v); tone(d, 'sawtooth', 640, 380, t + 0.13, 0.14, 0.1 * v); },
    boss(d, t, v) { tone(d, 'sawtooth', 70, 50, t, 1.2, 0.35); tone(d, 'sawtooth', 105, 75, t, 1.2, 0.2); tone(d, 'sine', 35, 35, t, 1.2, 0.4); },
    win(d, t, v) { [523, 659, 784, 1046].forEach((f, k) => { tone(d, 'triangle', f, f, t + k * 0.14, 0.5, 0.22); tone(d, 'sine', f / 2, f / 2, t + k * 0.14, 0.5, 0.18); }); },
    lose(d, t, v) { [392, 330, 262, 196].forEach((f, k) => tone(d, 'triangle', f, f * 0.97, t + k * 0.22, 0.55, 0.22)); },
    // таверна
    clink(d, t, v) { modal(d, t, [[2400, 1, 0.18], [3600, 0.5, 0.12]], 0.15 * v); modal(d, t + 0.05, [[2900, 1, 0.14]], 0.1 * v); },
    crackle(d, t, v) { for (let k = 0; k < 3; k++) noiseHit(d, 'highpass', 2500 + Math.random() * 2000, 1500, 1, t + Math.random() * 0.15, 0.03, 0.12 * v); },
    ui(d, t, v) { tone(d, 'triangle', 600, 600, t, 0.06, 0.12); },
    // шаги по камню
    step(d, t, v) { noiseHit(d, 'lowpass', 500, 200, 0.8, t, 0.06, 0.1 * v); },
  },
  // фон: подземный гул и капли / треск очага и звон кружек в таверне
  amb: null,
  ambStart(kind) {
    RSfx.ambStop();
    if (!RSfx.ok()) return;
    const ctx = Sfx.ctx, g = ctx.createGain(); g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(kind === 'dungeon' ? 0.1 : 0.0001, ctx.currentTime + 1.5);
    const nodes = [];
    if (kind === 'dungeon') {
      for (const f of [55, 82.5]) { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 160; o.connect(lp); lp.connect(g); o.start(); nodes.push(o); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.07 + f / 2000; lg.gain.value = 3; l.connect(lg); lg.connect(o.frequency); l.start(); nodes.push(l); }
    }
    g.connect(AudioCore.sfx);
    RSfx.amb = { g, nodes, kind };
    RSfx.ambT = 0; RSfx.ambNext = 1;
  },
  ambStop() {
    const a = RSfx.amb; RSfx.amb = null; if (!a) return;
    try { a.g.gain.cancelScheduledValues(0); a.g.gain.value = 0; for (const n of a.nodes) { try { n.stop(); } catch (e) { /* уже остановлен */ } } a.g.disconnect(); } catch (e) { /* ок */ }
  },
  ambTick(dt) {
    const a = RSfx.amb; if (!a || !RSfx.ok()) return;
    RSfx.ambT += dt;
    if (RSfx.ambT < RSfx.ambNext) return;
    RSfx.ambT = 0;
    if (a.kind === 'tavern') { RSfx.ambNext = 0.2 + Math.random() * 0.8; RSfx.play(Math.random() < 0.8 ? 'crackle' : 'clink', 0.6); }
    else { RSfx.ambNext = 2 + Math.random() * 5; const t = Sfx.ctx.currentTime; tone(AudioCore.sfx, 'sine', 1400, 700, t, 0.1, 0.06); tone(AudioCore.sfx, 'sine', 1400, 700, t + 0.18, 0.1, 0.03); }   // капля
  },
};
