'use strict';
// Мелкие звуки гномов: пук, трубка, муха, свист, чих, урчание живота, отрыжка.
// Включаются сами по себе возле случайных гномов на экране и при событиях
// (молния, падение, испуг). Подключается после sfx.js и дополняет таблицу SFX.

const GnomeSfx = { t: 3 + Math.random() * 3, cd: new Map() };

Object.assign(SFX, {
  // «пу-пу-пуу»: два коротких и один длинный, с дребезжащим низким тоном
  toot: (d, t) => {
    const ctx = Sfx.ctx;
    for (const [k, len, f] of [[0, 0.09, 130], [0.13, 0.08, 150], [0.26, 0.34, 110]]) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(d);
      const o = tone(lp, 'sawtooth', f, f * 0.62, t + k, len, 0.5, 0.01);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();   // дрожание
      lfo.frequency.value = 38; lg.gain.value = 16; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t + k); lfo.stop(t + k + len + 0.02);
      noiseHit(lp, 'bandpass', 300, 200, 1.2, t + k, len, 0.25, 0.01);
    }
  },
  // трубка: бульканье при затяжке, потом долгий выдох
  pipe: (d, t) => {
    for (const k of [0, 0.11, 0.2]) tone(d, 'sine', 240 + k * 500, 420 + k * 500, t + k, 0.07, 0.18, 0.01);
    noiseHit(d, 'bandpass', 900, 500, 0.8, t + 0.35, 0.9, 0.2, 0.25);
  },
  // муха: кружит, жужжание плывёт вверх-вниз
  fly: (d, t) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 280; bp.Q.value = 2; bp.connect(d);
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 190;
    lfo.frequency.value = 3.2; lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < 4; k++) { g.gain.linearRampToValueAtTime(0.35, t + 0.3 + k * 0.55); g.gain.linearRampToValueAtTime(0.06, t + 0.6 + k * 0.55); }
    g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g); g.connect(bp); o.start(t); lfo.start(t); o.stop(t + 2.7); lfo.stop(t + 2.7);
  },
  // насвистывание весёлой попевки
  whistle: (d, t) => {
    const mel = [[880, 988, 0.14], [988, 1175, 0.14], [1175, 1175, 0.28], [988, 880, 0.14], [880, 784, 0.32]];
    let tt = t;
    for (const [a, b, len] of mel) { tone(d, 'sine', a, b, tt, len, 0.28, 0.02); tone(d, 'sine', a * 2, b * 2, tt, len, 0.04, 0.02); tt += len * 1.05; }
  },
  // а-а-апчхи!
  sneeze: (d, t) => {
    gnomeVoice(d, t, [[300, 520, 0.28]], 0.35, 1000);
    noiseHit(d, 'highpass', 2200, 1200, 0.8, t + 0.3, 0.16, 0.7, 0.004);
    gnomeVoice(d, t + 0.32, [[500, 260, 0.14]], 0.5, 1200);
  },
  // урчание голодного живота
  rumble: (d, t) => {
    const ctx = Sfx.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(d);
    tone(lp, 'sawtooth', 70, 48, t, 0.55, 0.5, 0.15);
    tone(lp, 'sawtooth', 56, 82, t + 0.5, 0.5, 0.5, 0.1);
    noiseHit(lp, 'lowpass', 200, 120, 1, t, 1, 0.12, 0.2);
  },
  burp: (d, t) => { tone(d, 'sawtooth', 120, 70, t, 0.4, 0.4, 0.02); noiseHit(d, 'lowpass', 400, 200, 1, t, 0.35, 0.2, 0.02); },
});

// у каждого звука свой кулдаун — чтобы не надоедали
const GNOME_SFX_CD = { toot: 25, pipe: 6, fly: 18, whistle: 20, sneeze: 30, rumble: 20, burp: 40 };
function gnomeSfx(kind, u, vel = 1, delay = 0) {
  if (!Sfx.ctx || !Sfx.on || u.inside) return false;
  const last = GnomeSfx.cd.get(kind) || -1e9;
  if (Game.time - last < GNOME_SFX_CD[kind]) return false;
  GnomeSfx.cd.set(kind, Game.time);
  sfxAt(kind, u.x * TILE, u.y * TILE, vel, delay);
  return true;
}

// Случайные звуки: раз в 3–8 секунд один гном на экране что-то издаёт
function gnomeSfxTick(dt) {
  if (!Sfx.ctx || !Sfx.on) return;
  GnomeSfx.t -= dt;
  if (GnomeSfx.t > 0) return;
  GnomeSfx.t = 3 + Math.random() * 5;
  const seen = Game.units.filter(u => !u.inside && !u.dead && !UNIT_TYPES[u.type].animal && u.type !== 'carter' && sfxPlace(u.x * TILE, u.y * TILE));
  if (!seen.length) return;
  const u = seen[(Math.random() * seen.length) | 0];
  const hungry = u.food < 0.35;
  const pool = [['toot', 2], ['fly', 2], ['whistle', 3], ['sneeze', 2], ['burp', 1], ['rumble', hungry ? 6 : 0.5]];
  if (u.anim === 'smoke') pool.push(['pipe', 12]);
  if (u.injury) pool.push(['fly', 3]);
  const tot = pool.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * tot;
  for (const [k, w] of pool) { r -= w; if (r <= 0) { gnomeSfx(k, u, 0.9); break; } }
}

// Курящий гном затягивается трубкой
{
  const _unit = sfxUnit;
  sfxUnit = function (u, kind, delay = 0) {
    if (kind === 'smoke') { gnomeSfx('pipe', u, 1, delay / Math.max(1, Game.speed)); return; }
    _unit(u, kind, delay);
  };

  // испуг, падение, ушиб: иногда сам собой раздаётся «пу-пу-пуу»
  const _fl = sfxFloater;
  sfxFloater = function (text, x, y) {
    _fl(text, x, y);
    if ((text === 'А-а-а!' || text === 'Бух!' || text === 'Ай!') && Math.random() < 0.45) {
      const u = Game.units.reduce((b, c) => (!c.inside && Math.hypot(c.x - x, c.y - y) < 1.5 && (!b || Math.hypot(c.x - x, c.y - y) < Math.hypot(b.x - x, b.y - y)) ? c : b), null);
      if (u) gnomeSfx('toot', u, 1, 0.2);
    }
  };

  // молния: гномы на экране вскрикивают, один испуганно пукает
  const _bolt = lightningStrike;
  lightningStrike = function () {
    _bolt();
    if (!Sfx.ctx || !Sfx.on) return;
    const seen = Game.units.filter(u => !u.inside && !u.dead && isPerson(u) && sfxPlace(u.x * TILE, u.y * TILE));
    seen.slice().sort(() => Math.random() - 0.5).slice(0, 2).forEach((u, i) => sfxAt(i ? 'ouch' : 'scream', u.x * TILE, u.y * TILE, 0.9, 0.35 + Math.random() * 0.5));
    if (seen.length && Math.random() < 0.5) gnomeSfx('toot', seen[(Math.random() * seen.length) | 0], 0.9, 0.9);
  };

  const _tick = sfxTick;
  sfxTick = function (dt) { _tick(dt); gnomeSfxTick(dt); };
}
