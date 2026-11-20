(() => {
  'use strict';
  if (typeof document === 'undefined' || !document.currentScript?.src || typeof URL !== 'function' || typeof Image !== 'function') return;

  const root = new URL('../assets/fantasy/bog-troll-combat/', document.currentScript.src);
  const role = 'trollB';
  const headingNames = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
  const mirrors = { NW: 'NE', W: 'E', SW: 'SE' };
  const movement = new WeakMap();
  const strikes = new WeakMap();
  const packs = new Map(), pending = new Map(), frames = new Map(), errors = [];
  const limit = 48;
  let active, strikeInProgress;

  function heading(actor) {
    const previous = movement.get(actor);
    if (actor.st === 'die' && previous) return previous.view;
    let dx = previous ? actor.x - previous.x : 0;
    let dy = previous ? actor.y - previous.y : 0;
    const target = actor.tg && neuUnit(actor.tg);
    const guard = actor.fr === 'parry' || /^p\d+$/.test(actor.fr);
    if (target && (actor.st === 'atk' || guard || !previous)) {
      dx = target.x - actor.x;
      dy = target.y - actor.y;
    } else if (Math.hypot(dx, dy) < .001) {
      const destination = actor.st === 'roam' ? [actor.wx, actor.wy] : actor.st === 'home' ? [actor.hx, actor.hy] : null;
      if (destination) {
        dx = destination[0] - actor.x;
        dy = destination[1] - actor.y;
      }
    }
    const view = Math.hypot(dx, dy) >= .001
      ? headingNames[(Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8]
      : previous?.view || (actor.vf ? 'S' : actor.face < 0 ? 'W' : 'E');
    movement.set(actor, { x: actor.x, y: actor.y, view });
    return view;
  }

  const position = unit => ({ x: unit.x, y: unit.y, id: unit.id });
  const health = unit => unit.hero?.hp ?? unit.rec?.hp ?? (unit.rec ? 30 + 8 * unit.rec.lvl : undefined);

  // Observe the synchronous native strike. Heavy blows may resolve on another
  // unit inside the telegraph, and rolls can leave the attempted strike empty.
  const previousHurt = neuHurtUnit;
  neuHurtUnit = function (unit, amount) {
    if (!strikeInProgress || !unit) return previousHurt(unit, amount);
    const before = health(unit);
    const outcome = previousHurt(unit, amount);
    if (health(unit) < before) strikeInProgress.hits.push(position(unit));
    return outcome;
  };
  const previousStrike = neuStrike;
  neuStrike = function (actor, target) {
    if (actor.k !== role || !target || !packs.has(actor.k)) return previousStrike(actor, target);
    const previous = strikeInProgress;
    const intended = actor.tel ? position(actor.tel) : position(target);
    const observed = { hits: [] };
    strikeInProgress = observed;
    try { return previousStrike(actor, target); }
    finally {
      strikeInProgress = previous;
      const hit = observed.hits.find(unit => unit.id === target.id) || observed.hits[0];
      const targetPoint = hit || intended;
      const dx = targetPoint.x - actor.x, dy = targetPoint.y - actor.y;
      const view = Math.hypot(dx, dy) >= .001
        ? headingNames[(Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8]
        : heading(actor);
      strikes.set(actor, { view, targetPoint, hit: Boolean(hit), time: actor.atkT });
    }
  };

  function contactPoint(actor, strike) {
    const geometry = packs.get(actor.k).data.geometry;
    const scale = n2Sz(actor), facing = mirrors[strike.view] ? -1 : 1;
    const x = strike.targetPoint.x * TILE - Math.round(actor.x * TILE);
    const y = strike.targetPoint.y * TILE - Math.round(actor.y * TILE + 6) + (strike.hit ? -18 : 6);
    return [
      Math.round(geometry.ax * 2 + x * 2 / (scale * facing)),
      Math.round(geometry.ay * 2 + y * 2 / scale),
    ];
  }

  function drawWeapon(c, pack, rig, aim) {
    const [x, y] = rig.grip;
    const [sx, sy, width, height] = pack.data.keys[pack.data.tool].source;
    c.save();
    c.globalCompositeOperation = 'destination-over';
    const dx = aim[0] - x, dy = aim[1] - y, reach = Math.hypot(dx, dy);
    c.translate(x, y);
    c.rotate(Math.atan2(dy, dx));
    c.fillStyle = '#462d1f';
    c.fillRect(-6, -5, reach + 6, 10);
    c.fillStyle = '#7d5b39';
    c.fillRect(-5, -4, reach + 5, 6);
    c.fillStyle = '#a08253';
    c.fillRect(-4, -3, reach + 4, 2);
    c.translate(reach, 0);
    c.rotate(-.27);
    c.drawImage(pack.atlas, sx, sy, width, height, -width / 2, -height / 2, width, height);
    c.restore();
  }

  function requested(actor, fr) {
    if (actor.st !== 'atk') return fr;
    const action = /^r\d+$/.test(fr) && Number.isFinite(actor.atkT) ? naAtkFr(actor.atkT) : fr;
    return action === 'a5' && actor.hit ? 'strike' : action;
  }

  function frame(kind, view, fr, nativeFlip = false, impact = null) {
    const pack = packs.get(kind);
    const side = Boolean(mirrors[view]) !== nativeFlip;
    const authored = mirrors[view] || view;
    const rig = impact && pack?.data.contact?.[authored];
    const id = rig ? rig.body : pack?.data.views[authored]?.[fr];
    if (id === undefined) return null;
    const pose = naPose(fr);
    const alpha = /^d\d+$/.test(fr) ? 1 - pose.fade : 1;
    const flash = /^h\d+$/.test(fr) ? Math.min(.4, pose.hurt * .3) : 0;
    const effect = rig ? `:${fr}:${impact.hit}:${impact.aim.join(',')}` : '';
    const key = `${kind}:${id}:${side}:${alpha}:${flash}${effect}`;
    if (frames.has(key)) {
      const hit = frames.get(key);
      frames.delete(key);
      frames.set(key, hit);
      return hit;
    }
    const { w, h, ax, ay } = pack.data.geometry;
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = rig ? 408 : h * 2;
    cv.fine = 2;
    cv.trollPhase = fr;
    cv.trollContact = rig ? { hit: impact.hit, aim: impact.aim, grip: rig.grip, view } : null;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    if (side) {
      c.translate(cv.width, 0);
      c.scale(-1, 1);
    }
    const { source, offset } = pack.data.keys[id];
    c.drawImage(pack.atlas, ...source, ...offset, source[2], source[3]);
    if (rig) drawWeapon(c, pack, rig, impact.aim);
    if (flash > 0) {
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = flash;
      c.fillStyle = '#ffe8d8';
      c.fillRect(0, 0, cv.width, cv.height);
    }
    const result = { cv, w, h: cv.height / 2, ax: side ? w - ax : ax, ay, hi: true };
    frames.set(key, result);
    if (frames.size > limit) frames.delete(frames.keys().next().value);
    return result;
  }

  const previousFrame = naFrame;
  const previousDraw = neuDraw;
  naFrame = function (kind, fr = 'i0') {
    if (active && (kind === active.actor.k || kind === active.actor.k + 'F')) {
      const { actor, view, strike } = active;
      const phase = requested(actor, fr);
      let impact = null;
      if (strike && ['strike', 'a6', 'a7', 'a8'].includes(phase)) {
        let aim = contactPoint(actor, strike);
        if (phase === 'a8') {
          const grip = packs.get(actor.k).data.contact[mirrors[view] || view].grip;
          aim = aim.map((value, i) => Math.round(value * .59 + (grip[i] + (i ? 7 : 31)) * .41));
        }
        impact = { hit: strike.hit, aim };
      }
      return frame(actor.k, view, phase, actor.face < 0, impact) || previousFrame(kind, fr);
    }
    return previousFrame(kind, fr);
  };
  neuDraw = function (ctx, actor) {
    if (actor.k !== role) return previousDraw(ctx, actor);
    if (!packs.has(actor.k)) {
      prepare(actor.k);
      return previousDraw(ctx, actor);
    }
    let strike = strikes.get(actor);
    if (strike && (actor.st !== 'atk' || !actor.hit || actor.atkT < strike.time)) {
      strikes.delete(actor);
      strike = null;
    }
    const previous = active;
    active = { actor, view: strike?.view || heading(actor), strike };
    try { return previousDraw(ctx, actor); }
    finally { active = previous; }
  };

  function prepare(kind) {
    if (pending.has(kind)) return pending.get(kind);
    const url = root;
    const atlas = new Image();
    atlas.src = new URL('atlas.png', url).href;
    const data = fetch(new URL('frames.json', url)).then(response => {
      if (!response.ok) throw Error('Frame map is unavailable');
      return response.json();
    });
    const loading = Promise.all([data, atlas.decode()]).then(([data]) => {
      packs.set(kind, { data, atlas });
      return true;
    }).catch(error => {
      errors.push(kind + ': ' + error.message);
      return false;
    });
    pending.set(kind, loading);
    return loading;
  }

  globalThis.BogTrollCombat = {
    get ready() {
      return prepare(role);
    },
    errors,
    frame,
    cacheSize: () => frames.size,
    limit,
  };
})();
