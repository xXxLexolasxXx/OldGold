// Isolated artwork for both gnomtaurs. The original draw path retains gameplay overlays.
(() => {
  'use strict';
  if (typeof document === 'undefined' || !document.currentScript?.src || typeof Image !== 'function' || typeof URL !== 'function') return;

  const root = new URL('.', document.currentScript.src);
  const models = {
    gtSpear: { file: 'spear-atlas.png', poses: ['rest', 'windup', 'thrust', 'recover', 'stepA', 'passA', 'stepB', 'passB', 'kneel', 'fall', 'victory'] },
    gtBow: { file: 'archer-atlas.png', poses: ['rest', 'nock', 'draw', 'release', 'settle', 'stepA', 'passA', 'stepB', 'passB', 'kneel', 'fall', 'victory'] },
  };
  const directions = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
  const views = directions.slice(0, 5);
  const samples = new Map();
  const cache = new Map();
  const limit = 144;
  const motion = new WeakMap();
  const shots = new WeakMap();
  const errors = [];
  let active;
  const loaded = new Set();

  function canvas(width, height) {
    const surface = document.createElement('canvas');
    surface.width = width;
    surface.height = height;
    return surface;
  }

  function drawRearSpearPass(ctx, first, groundY) {
    const { width, height } = first;
    const join = groundY - 48;
    const row = first.getContext('2d').getImageData(0, join, width, 1).data;
    let left = 0, right = width - 1;
    while (left < width && !row[left * 4 + 3]) left++;
    while (right > left && !row[right * 4 + 3]) right--;
    if (left >= right) throw Error('Missing rear hoof support');

    // Swap the supporting side below the body, keeping the spear and torso in place.
    ctx.drawImage(first, 0, 0, width, join, 0, 0, width, join);
    ctx.save();
    ctx.translate(left + right + 1, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(first, 0, join, width, height - join, 0, join, width, height - join);
    ctx.restore();
  }

  function separateAxialSpear(ctx, view) {
    if (view === 'N') {
      // Behind the wrist, the stock head and pennant sit in transparent space.
      ctx.clearRect(131, 46, 22, 34);
      return;
    }
    // In front, the old foreshortened head lies over the tunic. Replace its
    // small footprint with the neighboring cloth; the closed fingers remain.
    const cloth = ctx.getImageData(102, 59, 24, 37);
    const source = new Uint8ClampedArray(cloth.data);
    const area = [
      [59, 61, 106, 113], [61, 64, 104, 114], [64, 70, 103, 116],
      [70, 75, 104, 116], [75, 89, 103, 115], [89, 96, 106, 115],
    ];
    for (const [top, bottom, left, right] of area) {
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const output = ((y - 59) * cloth.width + x - 102) * 4;
        const sample = ((y - 59) * cloth.width + 16 + Math.floor((x - left) / 2)) * 4;
        const neighbor = source[sample + 3] ? sample : ((y - 59) * cloth.width + 16) * 4;
        cloth.data.set(source.subarray(neighbor, neighbor + 4), output);
      }
    }
    ctx.putImageData(cloth, 102, 59);
  }

  function removeSideShaft(ctx, view) {
    // The projected spear gets one straight shaft. Restore the sleeve behind
    // the horizontal stock drawing while preserving the wrist and closed fist.
    const [left, arm, right] = view === 'SE' ? [109, 119, 135] : [109, 123, 136];
    const top = 54, bottom = 63, width = right - left;
    const image = ctx.getImageData(left, 47, width, 18);
    const before = new Uint8ClampedArray(image.data);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (x >= arm && y < 56) continue;
      const offset = ((y - 47) * width + x - left) * 4;
      const row = x < arm ? 63 + (y % 2) : 50 + (y % 4);
      const sample = ((row - 47) * width + x - left) * 4;
      if (before[sample + 3] && before[offset + 3]) image.data.set(before.subarray(sample, sample + 4), offset);
    }
    ctx.putImageData(image, left, 47);
  }

  function load(kind, poses, image) {
    const size = FantasyPublishedForestfolk.before(kind, 'i0');
    const width = size.w * 2, height = size.h * 2;
    if (image.width !== width * views.length || image.height !== height * poses.length) throw Error('Unexpected atlas dimensions');

    for (const [row, pose] of poses.entries()) for (const [col, view] of views.entries()) {
      const cv = canvas(width, height);
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      if (kind === 'gtSpear' && view === 'N' && pose === 'passB') {
        drawRearSpearPass(ctx, samples.get('gtSpear:passA:N').cv, size.ay * 2);
      } else {
        ctx.drawImage(image, col * width, row * height, width, height, 0, 0, width, height);
      }
      if (kind === 'gtSpear' && pose === 'thrust' && (view === 'SE' || view === 'E')) removeSideShaft(ctx, view);
      let bodyOnly;
      if (kind === 'gtSpear' && pose === 'thrust' && axisGrips[view]) {
        bodyOnly = canvas(width, height);
        const body = bodyOnly.getContext('2d');
        body.drawImage(cv, 0, 0);
        separateAxialSpear(body, view);
        if (view === 'N') {
          // The rear windup and recovery hold the spear on the other side of
          // the source thrust. Keep their grip hand throughout the attack.
          const aligned = canvas(width, height);
          const rear = aligned.getContext('2d');
          rear.imageSmoothingEnabled = false;
          rear.translate(size.ax * 4, 0);
          rear.scale(-1, 1);
          rear.drawImage(bodyOnly, 0, 0);
          bodyOnly = aligned;
        }
      }
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let top = height, left = width, right = -1;
      for (let i = 3; i < pixels.length; i += 4) {
        if (!pixels[i]) continue;
        const pixel = (i - 3) / 4;
        top = Math.min(top, Math.floor(pixel / width));
        left = Math.min(left, pixel % width);
        right = Math.max(right, pixel % width);
      }
      if (top === height) throw Error(`Empty atlas frame: ${view} ${pose}`);
      samples.set(`${kind}:${pose}:${view}`, { cv, bodyOnly, w: size.w, h: size.h, ax: size.ax, ay: size.ay, top, left, right });
    }
    if (kind === 'gtSpear') axisShaft.getContext('2d').drawImage(image,
      views.indexOf('E') * width + 151, poses.indexOf('thrust') * height + 44, 63, 45, 0, 0, 63, 45);
  }

  const knownFrames = new Set([...NA_ALL, ...NA_FRAMES.roar, ...NA_FRAMES.parry]);
  // Half-pixel coordinates of the arrow rest on the release art.
  const bowRest = { S: [137, 44], SE: [143, 44], E: [162, 44], NE: [155, 44], N: [61, 43] };
  const axisGrips = { S: [110, 59], N: [70, 54] };
  const axisShaft = canvas(63, 45);
  // Segment beyond the closed fist in the side and three-quarter views.
  const spearPieces = {
    SE: { start: [146, 57], grip: [140, 57], tip: [190, 56] },
    E: { start: [151, 57], grip: [144, 57], tip: [206, 56] },
    NE: { start: [155, 56], grip: [150, 56], tip: [194, 54] },
  };
  const aimedSpear = canvas(380, 328);
  aimedSpear.fine = 2;
  const attacks = {
    gtSpear: ['rest', 'windup', 'windup', 'windup', 'windup', 'windup', 'thrust', 'thrust', 'thrust', 'recover', 'recover', 'rest'],
    gtBow: ['rest', 'nock', 'nock', 'draw', 'draw', 'draw', 'release', 'release', 'settle', 'settle', 'settle', 'rest'],
  };
  const walk = ['passA', 'passA', 'stepA', 'stepA', 'stepA', 'passA', 'passB', 'passB', 'stepB', 'stepB', 'stepB', 'passB'];

  function poseFor(kind, direction, frame, p, released) {
    if (p.dead) return 'fall';
    if (/^d[4-9]$/.test(frame)) return 'kneel';
    if (/^a\d+$/.test(frame)) {
      const index = Number(frame.slice(1));
      // Native contact occurs inside a5, before the next integer art frame.
      if (index === 5 && released) return kind === 'gtBow' ? 'release' : 'thrust';
      return attacks[kind][index];
    }
    if (/^w\d+$/.test(frame)) {
      const pose = walk[Number(frame.slice(1))];
      // The rear three-quarter passB raises the same front hoof as passA.
      if (kind === 'gtBow' && direction === 'NE' && pose === 'passB') return 'stepB';
      return pose;
    }
    if (frame === 'strike') return kind === 'gtBow' ? 'release' : 'thrust';
    if (frame === 'windup') return kind === 'gtBow' ? 'draw' : 'windup';
    if (frame === 'recover') return kind === 'gtBow' ? 'settle' : 'recover';
    if (frame === 'step') return 'stepA';
    if (frame === 'parry' || /^p\d+$/.test(frame)) return kind === 'gtBow' ? 'settle' : 'windup';
    if (p.up > .5) return 'victory';
    return 'rest';
  }

  const paired = { SW: 'SE', W: 'E', NW: 'NE' };

  function frameFor(kind, heading, requested, nativeFlip = false, released = false, aim = false) {
    if (!loaded.has(kind)) return null;
    const direction = paired[heading] || heading;
    const flip = Boolean(paired[heading]) !== nativeFlip;
    const frame = requested || 'i0';
    if (!knownFrames.has(frame)) return null;
    const p = naPose(frame);
    const pose = poseFor(kind, direction, frame, p, released);
    const axisAim = aim && kind === 'gtSpear' && pose === 'thrust' && Object.hasOwn(axisGrips, direction);
    const key = `${kind}:${direction}:${frame}:${pose}:${flip}:${axisAim}`;
    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }

    const base = samples.get(`${kind}:${pose}:${direction}`);
    if (!base) return null;
    const source = axisAim ? base.bodyOnly : base.cv;
    const cv = canvas(source.width, source.height);
    cv.fine = 2;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(cv.width, 0);
      ctx.scale(-1, 1);
    }
    const ax = flip ? base.w - base.ax : base.ax;
    const groundX = ax * 2;
    const groundY = base.ay * 2;
    const side = direction === 'S' || direction === 'N' ? 0 : 1;
    const falling = frame.startsWith('d') && pose !== 'fall';
    const crouch = pose === 'kneel' ? (Number(frame.slice(1)) - 5) * 10 : falling ? Math.round(-p.rot * 27) : 0;
    const breathing = (1 - p.sq) * 32;
    const lift = pose === 'fall' ? 0 : Math.max(1 - base.top, -4, Math.round((p.y - p.up + breathing) * 1.2));
    const recoil = pose === 'fall' ? 0 : Math.round(p.x * side);
    const lean = pose === 'rest' ? Math.round((Math.max(-1, Math.min(1, p.a)) * 4 + p.rot * 6) * side) : 0;
    ctx.globalAlpha = 1 - p.fade;
    const offset = y => {
      const upper = Math.min(1, Math.max(0, (groundY - y) / 77));
      const x = Math.round((lean + recoil) * upper);
      const shift = Math.max(1 - base.left, Math.min(cv.width - base.right - 2, x));
      return [shift, -Math.round((lift + crouch) * upper)];
    };
    // Group output rows with identical offsets. Each row maps to one source row.
    let start = 0;
    let [shiftX, shiftY] = offset(0);
    for (let y = 1; y <= cv.height; y++) {
      const [nextX, nextY] = offset(y);
      if (y < cv.height && nextX === shiftX && nextY === shiftY) continue;
      const first = Math.max(start, -shiftY);
      const last = Math.min(y, cv.height - shiftY);
      if (last > first) ctx.drawImage(source, 0, first + shiftY, cv.width, last - first, shiftX, first, cv.width, last - first);
      start = y;
      [shiftX, shiftY] = [nextX, nextY];
    }

    if (p.hurt > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,186,144,${Math.min(.45, p.hurt * .45)})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }

    function projectedPoint([sourceX, sourceY]) {
      for (let y = sourceY - 12; y <= sourceY + 12; y++) {
        const [shiftX, shiftY] = offset(y);
        if (y + shiftY !== sourceY) continue;
        const x = sourceX + shiftX;
        return [flip ? cv.width - x : x, y];
      }
      return [flip ? cv.width - sourceX : sourceX, sourceY];
    }
    const result = { ...base, cv, ax, pose, frame, groundX, groundY, hi: true };
    if (kind === 'gtBow' && pose === 'release') {
      const [x, y] = projectedPoint(bowRest[direction]);
      result.bowRest = [x / 2 - ax, y / 2 - base.ay];
    }
    if (axisAim) {
      const grip = projectedPoint(axisGrips[direction]);
      result.spear = { grip, tip: [grip[0] + 55, grip[1] - 1], axis: direction };
    } else if (kind === 'gtSpear' && pose === 'thrust' && spearPieces[direction]) {
      const piece = spearPieces[direction];
      const grip = projectedPoint(piece.grip), tip = projectedPoint(piece.tip);
      const start = projectedPoint(piece.start);
      const outer = flip ? Math.max(0, tip[0] - 5) : Math.min(cv.width, tip[0] + 5);
      const clipX = Math.min(start[0], outer);
      result.spear = { grip, tip, clip: [clipX, start[1] - 13, Math.abs(start[0] - outer), 45] };
    }
    cache.set(key, result);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return result;
  }

  function heading(actor) {
    const previous = motion.get(actor);
    if (actor.st === 'die' && previous) return previous.direction;
    let dx = previous ? actor.x - previous.x : 0;
    let dy = previous ? actor.y - previous.y : 0;
    const target = actor.tg ? neuUnit(actor.tg) : null;
    if (actor.st === 'atk' && target) {
      [dx, dy] = [target.x - actor.x, target.y - actor.y];
    } else if (Math.hypot(dx, dy) < .001) {
      if (target && actor.st === 'flee') {
        if (previous?.state === 'flee') return previous.direction;
        [dx, dy] = [actor.x - target.x, actor.y - target.y];
      } else if (target) [dx, dy] = [target.x - actor.x, target.y - actor.y];
      else if (actor.st === 'roam') [dx, dy] = [actor.wx - actor.x, actor.wy - actor.y];
      else if (actor.st === 'home') [dx, dy] = [actor.hx - actor.x, actor.hy - actor.y];
    }
    const facing = actor.face < 0 ? 'W' : 'E';
    const direction = Math.hypot(dx, dy) >= .001
      ? directions[(Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8]
      : previous?.direction || facing;
    motion.set(actor, { x: actor.x, y: actor.y, direction, state: actor.st });
    return direction;
  }

  function aimSpear(sprite, actor, target) {
    const { grip, tip, clip, axis } = sprite.spear;
    const scale = n2Sz(actor), side = actor.face < 0 ? -1 : 1;
    const actorX = Math.round(actor.x * TILE), actorY = Math.round(actor.y * TILE + 6);
    const targetX = target.x * TILE, targetY = target.y * TILE - 24;
    const dx = (targetX - actorX) * 2 / (scale * side) + sprite.ax * 2 - grip[0];
    const dy = (targetY - actorY) * 2 / scale + sprite.ay * 2 - grip[1];
    const shaftX = tip[0] - grip[0], shaftY = tip[1] - grip[1];
    const targetAngle = Math.atan2(dy, dx);
    const shaftAngle = Math.atan2(shaftY, shaftX);
    // Foreshorten at a close target, while retaining a plausible weapon length.
    const shaftLength = Math.hypot(shaftX, shaftY);
    const reach = Math.max(axis ? 12 : shaftLength * .42, Math.min(axis === 'S' ? 152 : 116, Math.hypot(dx, dy)));
    const stretch = reach / shaftLength;
    const px = 80, py = 80;
    const ctx = aimedSpear.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, aimedSpear.width, aimedSpear.height);
    ctx.drawImage(sprite.cv, px, py);
    if (clip) {
      const [left, top, width, height] = clip;
      ctx.clearRect(px + left, py + top, width, height);
    }
    ctx.save();
    if (axis === 'N') ctx.globalCompositeOperation = 'destination-over';
    ctx.translate(px + grip[0], py + grip[1]);
    ctx.rotate(targetAngle);
    ctx.scale(stretch, 1);
    if (clip) {
      // Bridge the grip from the same wood texture along the new axis, behind
      // the fingers. The tip and this handle therefore turn as a single piece.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(axisShaft, 8, 10, 17, 7, -13, -3, 23, 7);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.rotate(-shaftAngle);
    if (axis) ctx.drawImage(axisShaft, -1, -13);
    else {
      const [left, top, width, height] = clip;
      ctx.drawImage(sprite.cv, left, top, width, height, left - grip[0], top - grip[1], width, height);
    }
    ctx.restore();
    aimedSpear.tip = [
      actorX + (grip[0] + Math.cos(targetAngle) * reach - sprite.ax * 2) / 2 * scale * side,
      actorY + (grip[1] + Math.sin(targetAngle) * reach - sprite.ay * 2) / 2 * scale,
    ];
    return { ...sprite, cv: aimedSpear, w: aimedSpear.width / 2, h: aimedSpear.height / 2, ax: sprite.ax + px / 2, ay: sprite.ay + py / 2 };
  }

  const nativeFrame = naFrame;
  const nativeDraw = neuDraw;
  naFrame = function (kind, frame) {
    if (active?.kind === kind) {
      // A fresh provocation can leave a roar over the first attack. Draw the
      // actual windup and contact when the simulation is already attacking.
      const action = active.attackFrame && /^r\d+$/.test(frame) ? active.attackFrame : frame;
      const sprite = frameFor(kind, active.direction, action, active.nativeFlip, active.released, Boolean(active.target));
      if (sprite) {
        active.bowRest = sprite.bowRest;
        if (sprite.spear && active.target) return aimSpear(sprite, active.actor, active.target);
        return sprite;
      }
    }
    return nativeFrame(kind, frame);
  };
  neuDraw = function (ctx, actor) {
    if (!loaded.has(actor.k)) return nativeDraw(ctx, actor);
    const previous = active;
    const flight = actor.arw ? Game.time - actor.arw.t : Infinity;
    active = {
      actor,
      target: actor.k === 'gtSpear' && actor.st === 'atk' && actor.tg ? neuUnit(actor.tg) : null,
      kind: actor.k,
      direction: heading(actor),
      nativeFlip: actor.face < 0,
      attackFrame: actor.st === 'atk' && Number.isFinite(actor.atkT) ? naAtkFr(actor.atkT) : flight >= 0 && flight < .06 ? 'a5' : null,
      released: actor.st === 'atk' && (actor.hit || (flight >= 0 && flight < .3)),
    };
    try {
      return nativeDraw(ctx, actor);
    } finally {
      active = previous;
    }
  };

  function arrowOrigin(actor) {
    if (actor.k !== 'gtBow' || !active || !loaded.has(actor.k)) return null;
    const shot = shots.get(actor);
    if (shot?.time === actor.arw.t) return shot.origin;
    const rest = active.bowRest || frameFor(actor.k, active.direction, 'a5', active.nativeFlip, true)?.bowRest;
    if (!rest) return null;
    const scale = n2Sz(actor);
    const origin = {
      x: Math.round(actor.x * TILE) + rest[0] * scale * (active.nativeFlip ? -1 : 1),
      y: Math.round(actor.y * TILE + 6) + rest[1] * scale,
    };
    shots.set(actor, { time: actor.arw.t, origin });
    return origin;
  }

  const ready = Promise.all(Object.entries(models).map(async ([kind, model]) => {
    const image = new Image();
    image.src = new URL(model.file, root).href;
    try {
      await image.decode();
      load(kind, model.poses, image);
      loaded.add(kind);
      return true;
    } catch (error) {
      errors.push(`${kind}: ${error.message}`);
      return false;
    }
  })).then(results => results.every(Boolean));
  globalThis.FantasyGnomtaurs = { ready, errors, frame: frameFor, arrowOrigin, cacheSize: () => cache.size, limit };
})();
