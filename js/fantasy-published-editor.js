'use strict';
// Cosmetic bridge for OldGold 0.11.99. Load after heroapp.js and the fantasy art adapter.
// The native editor remains responsible for every option, apply/cancel and save/coop path.
(() => {
  if (globalThis.FantasyPublishedAppearance) return;
  function resolve(u) {
    const app = typeof haOf === 'function' ? haOf(u) : null;
    const holder = app ? Object.assign({}, u, {
      type: haType(haBase(u), app), sx: personSex(u)
    }) : u;
    return { holder, app, look: lookOf(holder), outfit: OUTFIT[holder.type] || OUTFIT.serf,
      sex: personSex(holder) };
  }
  globalThis.FantasyPublishedAppearance = Object.freeze({ resolve, version: '0.11.99' });
  if (typeof haOpenEditor !== 'function' || typeof haBodyFor !== 'function') return;
  const originalOpen = haOpenEditor;
  const originalBody = haBodyFor;
  let active = null;
  // Capture the draft only through the native rendering callback. Never rewrite H.app,
  // ap[12..14], localStorage, server messages, or onOk/onCancel callbacks.
  haBodyFor = function (app, clsKey, look) {
    if (!active) return originalBody(app, clsKey, look);
    active.draft = { app, clsKey, look };
    return sprite(active);
  };
  function sprite(state) {
    const d = state.draft;
    if (!d) return null;
    const base = d.clsKey && OUTFIT['hero_' + d.clsKey] ? 'hero_' + d.clsKey : 'hero';
    const u = { type: d.app ? haType(base, d.app) : base, look: d.look,
      sx: d.app && d.app[10] === 1 ? 'f' : '', carry: null };
    const moving = state.pose !== 'idle';
    const frame = moving ? Math.floor(performance.now() / 150) % 8 : 0;
    const result = personSprite(u, state.view === 'W' ? 'E' : state.view, state.pose,
      state.pose === 'work' ? { anim: 'build', f: frame } : frame);
    if (state.view !== 'W' || !result) return result;
    const flipped = document.createElement('canvas');
    flipped.width = result.width; flipped.height = result.height;
    const ctx = flipped.getContext('2d');
    ctx.translate(flipped.width, 0); ctx.scale(-1, 1); ctx.drawImage(result, 0, 0);
    return flipped;
  }
  function paint(state) {
    const cv = state.box && state.box.querySelector('#ha-body');
    if (!cv || !state.draft) return;
    const spr = sprite(state), c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = false;
    if (spr && spr.width) {
      const k = Math.min(cv.width / spr.width, cv.height / spr.height);
      c.drawImage(spr, (cv.width - spr.width * k) / 2, cv.height - spr.height * k,
        spr.width * k, spr.height * k);
    }
  }
  haOpenEditor = function (opts) {
    if (active && active.timer) clearInterval(active.timer);
    const state = { view: 'S', pose: 'idle', draft: null, box: null };
    active = state;
    const box = originalOpen.apply(this, arguments);
    state.box = box;
    const controls = document.createElement('div');
    controls.className = 'fantasy-ha-views';
    controls.innerHTML = '<label>Ракурс <select aria-label="Ракурс модели"><option value="S">Спереди</option><option value="E">Справа</option><option value="W">Слева</option><option value="N">Сзади</option></select></label><label>Действие <select aria-label="Действие модели"><option value="idle">Стоит</option><option value="walk">Идёт</option><option value="work">Работает</option></select></label>';
    box.querySelector('.ha-pv').appendChild(controls);
    controls.addEventListener('change', () => {
      const selects = controls.querySelectorAll('select');
      state.view = selects[0].value; state.pose = selects[1].value; paint(state);
    });
    state.timer = setInterval(() => {
      if (!box.isConnected) {
        clearInterval(state.timer);
        if (active === state) active = null;
      } else if (state.pose !== 'idle') paint(state);
    }, 150);
    return box;
  };
  const style = document.createElement('style');
  style.id = 'fantasy-published-editor-css';
  style.textContent = '.fantasy-ha-views{display:grid;gap:6px;width:100%;font-size:12px}.fantasy-ha-views label{display:grid;gap:3px}.fantasy-ha-views select{min-height:30px;max-width:132px;background:#211a12;color:#f6e8c0;border:1px solid #8a6a28;border-radius:4px}.ha-pv canvas{image-rendering:auto}@media(max-width:600px){#ha-editor .ha-card{max-height:96dvh;padding:12px}#ha-editor .ha-arr,#ha-editor .ha-sexb{min-width:32px;min-height:32px}#ha-editor .ha-sw{width:23px;height:23px}#ha-editor .ha-rows{min-width:0;flex-basis:230px}#ha-editor .ha-row>span{flex-basis:85px}#ha-editor .ha-pv{margin:auto}}';
  document.head.appendChild(style);
})();
