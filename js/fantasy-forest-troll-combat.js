(() => {
  'use strict';
  if (typeof document === 'undefined' || !document.currentScript?.src || typeof Image !== 'function' || typeof URL !== 'function') return;

  const assets = new URL('../assets/fantasy/forest-troll-combat/', document.currentScript.src);
  const directions = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
  const opposite = { NW: 'NE', W: 'E', SW: 'SE' };
  const motion = new WeakMap();
  const contacts = new WeakMap();
  const frames = new Map();
  const errors = [];
  const maxFrames = 48;
  let pack, atlas, active;

  const guards = phase => phase === 'parry' || /^p\d+$/.test(phase);

  function heading(actor) {
    const previous = motion.get(actor);
    if (actor.st === 'die' && previous) return previous.direction;
    let dx = previous ? actor.x - previous.x : 0;
    let dy = previous ? actor.y - previous.y : 0;
    const target = actor.tg && neuUnit(actor.tg);
    if ((actor.st === 'atk' || guards(actor.fr)) && target) {
      dx = target.x - actor.x;
      dy = target.y - actor.y;
    } else if (Math.hypot(dx, dy) < .001) {
      if (actor.st === 'home') {
        dx = actor.hx - actor.x;
        dy = actor.hy - actor.y;
      } else if (actor.st === 'roam') {
        dx = actor.wx - actor.x;
        dy = actor.wy - actor.y;
      } else if (!previous && target) {
        dx = target.x - actor.x;
        dy = target.y - actor.y;
      }
    }
    const direction = Math.hypot(dx, dy) >= .001
      ? directions[(Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8]
      : previous?.direction || (actor.vf ? 'S' : actor.face < 0 ? 'W' : 'E');
    motion.set(actor, { x: actor.x, y: actor.y, direction });
    return direction;
  }

  function requestedFrame(actor, requested) {
    if (actor.st !== 'atk') return requested;
    const frame = /^r\d+$/.test(requested) && Number.isFinite(actor.atkT) ? naAtkFr(actor.atkT) : requested;
    // Damage is attempted inside a5, before the native index advances to a6.
    return frame === 'a5' && actor.hit ? 'strike' : frame;
  }

  function drawContactClub(context, rig, aim) {
    const [x, y] = rig.grip;
    const dx = aim[0] - x, dy = aim[1] - y;
    const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
    const [sx, sy, width, height] = pack.clubHead;
    context.save();
    context.globalCompositeOperation = 'destination-over';
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = '#533021';
    context.fillRect(-6, -4, length + 7, 8);
    context.fillStyle = '#8f5e36';
    context.fillRect(-5, -2, length + 5, 4);
    context.fillStyle = '#b6804b';
    context.fillRect(-4, -2, length + 4, 1);
    context.translate(length, 0);
    context.rotate(-.63);
    context.drawImage(atlas, sx, sy, width, height, -width / 2, -height / 2, width, height);
    context.restore();
  }

  function frame(direction, phase, nativeFlip = false, aim = null) {
    if (!pack || !atlas) return null;
    const view = opposite[direction] || direction;
    const mirrored = Boolean(opposite[direction]) !== nativeFlip;
    const index = pack.views[view]?.[phase];
    if (index === undefined) return null;
    const rig = aim && (phase === 'strike' || phase === 'a6' || phase === 'a7' || phase === 'a8') ? pack.contactBodies?.[view] : null;
    const pose = naPose(phase);
    const fade = /^d\d+$/.test(phase) ? pose.fade : 0;
    const flash = /^h\d+$/.test(phase) ? pose.hurt : 0;
    const key = `${index}:${mirrored}:${fade}:${flash}${rig ? ':' + phase + ':' + aim.join(',') : ''}`;
    if (frames.has(key)) {
      const hit = frames.get(key);
      frames.delete(key);
      frames.set(key, hit);
      return hit;
    }
    const { w, h, ax, ay } = pack.geometry;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = rig ? 408 : h * 2;
    canvas.fine = 2;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1 - fade;
    if (mirrored) {
      c.translate(canvas.width, 0);
      c.scale(-1, 1);
    }
    const { source, offset } = pack.keys[rig ? rig.index : index];
    c.drawImage(atlas, ...source, ...offset, source[2], source[3]);
    if (rig) drawContactClub(c, rig, aim);
    if (flash > 0) {
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = Math.min(.4, flash * .3);
      c.fillStyle = '#ffe8d8';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    canvas.forestTrollPhase = phase;
    canvas.forestTrollContact = rig ? aim : null;
    const result = { cv: canvas, w, h: canvas.height / 2, ax: mirrored ? w - ax : ax, ay, hi: true };
    frames.set(key, result);
    if (frames.size > maxFrames) frames.delete(frames.keys().next().value);
    return result;
  }

  const nativeDraw = neuDraw;
  const nativeFrame = naFrame;
  naFrame = function (kind, phase = 'i0') {
    if (active && (kind === 'troll' || kind === 'trollF')) {
      const { actor, direction } = active;
      const action = requestedFrame(actor, phase);
      const view = opposite[direction] || direction;
      const rig = pack.contactBodies?.[view];
      let contact = contacts.get(actor);
      if (!contact && rig && actor.st === 'atk' && actor.tg && actor.hit) {
        const target = neuUnit(actor.tg);
        if (target) {
          const scale = n2Sz(actor), facing = opposite[direction] ? -1 : 1;
          const x = target.x * TILE - Math.round(actor.x * TILE);
          const y = target.y * TILE - 18 - Math.round(actor.y * TILE + 6);
          contact = { direction, aim: [
            Math.round(pack.geometry.ax * 2 + x * 2 / (scale * facing)),
            Math.round(pack.geometry.ay * 2 + y * 2 / scale),
          ] };
          contacts.set(actor, contact);
        }
      }
      let aim = contact?.aim;
      if (aim && rig && action === 'a8') {
        aim = aim.map((value, i) => Math.round(value * .63 + (rig.grip[i] + (i ? 24 : 28)) * .37));
      }
      const sprite = frame(direction, action, actor.face < 0, aim);
      if (sprite) return sprite;
    }
    return nativeFrame(kind, phase);
  };
  neuDraw = function (context, actor) {
    if (actor.k !== 'troll' || !pack) return nativeDraw(context, actor);
    if (actor.st !== 'atk' || !actor.hit) contacts.delete(actor);
    const previous = active;
    const contact = contacts.get(actor);
    const direction = contact && !guards(actor.fr) ? contact.direction : heading(actor);
    active = { actor, direction };
    try {
      return nativeDraw(context, actor);
    } finally {
      active = previous;
    }
  };

  const ready = Promise.all([
    fetch(new URL('frames.json', assets)).then(response => {
      if (!response.ok) throw Error('Forest troll frame map could not be loaded');
      return response.json();
    }),
    (async () => {
      const image = new Image();
      image.src = new URL('forest-troll.png', assets).href;
      await image.decode();
      return image;
    })(),
  ]).then(([data, image]) => {
    if (!data.keys.length || !directions.slice(0, 5).every(view => data.views[view])) throw Error('Incomplete forest troll frame map');
    pack = data;
    atlas = image;
    return true;
  }).catch(error => {
    errors.push(error.message);
    return false;
  });

  globalThis.ForestTrollCombat = { ready, errors, frame, cacheSize: () => frames.size, maxFrames };
})();
