/* Isolated roster artwork adapter. */
(() => {
  'use strict';
  if (typeof document === 'undefined' || typeof URL !== 'function' || !document.currentScript?.src) return;

  const root = new URL('./', document.currentScript.src);
  const front = { trollF: 'troll', trollSF: 'trollS', trollBF: 'trollB' };
  const views = ['S', 'SE', 'E', 'NE', 'N'];
  const errors = [];
  const images = new Map();
  const pending = new Map();
  const requested = new Set();
  const companionShots = new WeakMap();
  const campaignParries = new WeakMap();
  const campaignRoles = new Set(['goblin', 'goblinChamp', 'champDuel', 'shnyr', 'campTroll']);
  const frames = new Map();
  const maximumBytes = 24 * 1024 * 1024;
  const maximumFrames = 144;
  let bytes = 0, packageData, loading, activeCampaign;

  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  // Exposed stone faces in the authored attack cells. Coordinates use the ×2
  // cell grid; the narrow mask leaves the overlapping fingers in the skin palette.
  const stoneFaces = {
    actions: { 4: [221, 169], 5: [225, 214], 6: [234, 254], 7: [206, 224] },
    directions: { 2: [174, 179], 3: [179, 251], 6: [186, 174], 7: [204, 247],
      10: [239, 171], 11: [251, 253] },
    transitions: { 2: [203, 255], 3: [176, 213], 6: [223, 253], 7: [196, 219],
      10: [259, 250], 11: [258, 217] },
  };
  const shnyrFuses = {
    main: { 2: [123, 89], 12: [112, 51], 17: [149, 86] },
    transition: { 12: [147, 82], 17: [130, 82] },
  };

  async function json(name) {
    const response = await fetch(new URL(name, root));
    if (!response.ok) throw Error(name + ' (' + response.status + ')');
    return response.json();
  }

  function packageFor() {
    if (!loading) loading = Promise.all([json('artwork-index.json'), json('phase-plan.json')])
      .then(([index, plan]) => {
        const ids = new Map(Object.entries(index.roles).map(([id, role]) => [role.kind, id]));
        packageData = { index, plan, ids };
        return packageData;
      });
    return loading;
  }

  function image(name) {
    if (!pending.has(name)) pending.set(name, new Promise((resolve, reject) => {
      const source = new Image();
      source.onload = () => {
        images.set(name, source);
        resolve(source);
      };
      source.onerror = () => reject(Error('Could not load ' + name));
      source.src = new URL(name, root).href;
    }));
    return pending.get(name);
  }

  function location(kind, direction) {
    const normalizedKind = front[kind] || kind;
    const hint = packageData.index.directions[direction];
    const forcedFront = Boolean(front[kind] || kind === 'ftZF');
    const view = forcedFront ? 'S' : (hint?.art || 'E');
    const id = packageData.ids.get(normalizedKind);
    return { normalizedKind, id, view, mirror: !forcedFront && Boolean(hint?.mirror) };
  }

  async function prepare(kind, direction) {
    try {
      const { index, plan } = await packageFor();
      const { id, view } = location(kind, direction);
      const placements = plan.roles[id]?.frames[view];
      if (!placements) return false;
      const atlasNames = new Set();
      for (const pose of Object.values(placements)) {
        if (!pose) continue;
        const source = index.roles[pose.role || id].assets[pose.asset];
        if (source) atlasNames.add(source.png);
      }
      await Promise.all([...atlasNames].map(image));
      return Object.values(placements).every(Boolean);
    } catch (error) {
      errors.push(error.message);
      return false;
    }
  }

  function adjustedFrame(art, image, pose, cell, view, kind, fr, bakedIdle, stoneFace, fuse) {
    const { w, h, ax, ay } = art.geometry;
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = h * 2;
    cv.fine = 2;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const [x, y, width, height] = cell.ink;
    const [sx, sy] = cell.cell;
    const factor = 2 * (typeof NA_SPEC === 'undefined' ? 1 : NA_SPEC[kind]?.sc || 1);
    const side = view === 'S' || view === 'N' ? 0 : 1;
    const inAir = /^j\d+$/.test(fr);
    const dying = /^d\d+$/.test(fr);
    const shift = Math.round((pose.x || 0) * side * factor);
    const sleep = /^z\d+$/.test(fr);
    const lift = bakedIdle || dying ? 0 : sleep ? -(Number(fr.slice(1)) % 2) : Math.round((pose.y || 0) * factor);
    const vertical = inAir ? clamp(lift, 1 - y, cv.height - y - height - 1) : 0;
    const ground = y + height;
    const top = Math.max(1, y + (inAir ? vertical : lift));
    const bottom = Math.min(cv.height - 1, ground + vertical);
    const outputHeight = Math.max(1, bottom - top);
    // Fit the profile and front cycles to the visible native footprint.
    // Scale from the ground line so planted feet stay at their authored height.
    if (/^[iw]\d+$/.test(fr)) {
      const profile = kind === 'ftZ' && view === 'E';
      const frontView = kind === 'ftZF' || (kind === 'ftZ' && view === 'S');
      if (profile || frontView) {
        c.translate(ax * 2 + (profile ? 1 : -2), ground);
        c.scale(profile ? 1.16 : 1.12, 1);
        c.translate(-ax * 2, -ground);
      }
    }
    // Restore reach about the contact line within the original frame.
    if (kind === 'ftZ' && view === 'E' && fr === 'a6') {
      c.translate(ax * 2 + 20, ground + 4);
      c.scale(1.26, 1.25);
      c.translate(-ax * 2, -ground);
    }
    c.globalAlpha = clamp(1 - (pose.fade || 0), 0, 1);

    for (let row = 0; row < outputHeight; row++) {
      const sourceRow = Math.round(row * (height - 1) / Math.max(1, outputHeight - 1));
      const upper = (height - sourceRow - 1) / Math.max(1, height - 1);
      const dx = clamp(Math.round(shift * upper), 1 - x, cv.width - x - width - 1);
      c.drawImage(image, sx + x, sy + y + sourceRow, width, 1, x + dx, top + row, width, 1);
      if (stoneFace && Math.abs(y + sourceRow - stoneFace[1]) <= 8) {
        const [centerX, centerY] = stoneFace;
        const start = centerX - 9 + dx;
        const strip = c.getImageData(start, top + row, 19, 1);
        const py = y + sourceRow - centerY;
        for (let i = 0; i < 19; i++) {
          const px = i - 9, p = i * 4;
          if (!strip.data[p + 3] || Math.abs(px + py * 0.3) + Math.abs(py) * 0.75 > 9) continue;
          const light = strip.data[p] * 0.27 + strip.data[p + 1] * 0.6 + strip.data[p + 2] * 0.13;
          const tone = light < 86 ? 42 : light < 132 ? 68 : light < 180 ? 102 : 139;
          strip.data[p] = tone - 9;
          strip.data[p + 1] = tone + 8;
          strip.data[p + 2] = tone + 13;
        }
        c.putImageData(strip, start, top + row);
      }
    }

    if (pose.hurt > 0) {
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,222,187,' + Math.min(.4, pose.hurt * .32) + ')';
      c.fillRect(0, 0, cv.width, cv.height);
    }
    const spark = fuse && [
      (fuse[0] + clamp(Math.round(shift * (ground - fuse[1] - 1) / Math.max(1, height - 1)),
        1 - x, cv.width - x - width - 1)) / 2 - ax,
      (top + Math.round((fuse[1] - y) * (outputHeight - 1) / Math.max(1, height - 1))) / 2 - ay,
    ];
    return { cv, w, h, ax, ay, hi: true, view, spark };
  }

  function frame(kind, requested, direction) {
    if (!packageData || typeof naPose !== 'function') return null;
    const { normalizedKind, id, view, mirror } = location(kind, direction);
    const fr = requested || 'i0';
    const chosen = packageData.plan.roles[id]?.frames[view]?.[fr];
    if (!chosen) return null;

    const key = id + '|' + view + '|' + fr;
    const hit = frames.get(key);
    if (hit) {
      frames.delete(key);
      frames.set(key, hit);
      return { ...hit, mirror };
    }
    const role = packageData.index.roles[chosen.role || id];
    const atlas = role?.assets[chosen.asset];
    const source = atlas && images.get(atlas.png);
    const cell = atlas?.keys[chosen.frame];
    if (!source || !cell) return null;

    const pose = naPose(fr);
    if (/^ft/.test(normalizedKind) && typeof FT_DEAD !== 'undefined' && FT_DEAD[fr]) Object.assign(pose, FT_DEAD[fr]);
    const stoneFace = normalizedKind === 'trollS' && /^a\d+$/.test(fr)
      ? stoneFaces[chosen.asset]?.[chosen.frame] : null;
    const fuse = normalizedKind === 'shnyrKing' && view === 'E'
      ? cell.fuse ?? shnyrFuses[chosen.asset]?.[chosen.frame] : null;
    const result = adjustedFrame(role, source, pose, cell, view, normalizedKind, fr, chosen.asset === 'idle-cycle', stoneFace, fuse);
    result.cv.rosterArtwork = true;
    const size = result.cv.width * result.cv.height * 4;
    frames.set(key, result);
    bytes += size;
    while (frames.size > maximumFrames || bytes > maximumBytes) {
      const oldest = frames.keys().next().value;
      const sample = frames.get(oldest);
      bytes -= sample.cv.width * sample.cv.height * 4;
      frames.delete(oldest);
    }
    return { ...result, mirror };
  }

  function request(kind, fr, direction) {
    if (activeCampaign && activeCampaign.st !== 'die' && campaignParries.has(activeCampaign)) {
      const age = Game.time - campaignParries.get(activeCampaign);
      const parry = Math.floor(age / 0.05);
      if (parry >= 0 && parry < NA_HURT_N) {
        const sample = frame(kind, 'p' + parry, direction);
        if (sample) return sample;
      }
    }
    const sprite = frame(kind, fr, direction);
    if (sprite) return sprite;
    const key = kind + '|' + direction;
    if (!requested.has(key)) {
      requested.add(key);
      prepare(kind, direction);
    }
    return null;
  }

  function withCampaignActor(actor, draw) {
    const previous = activeCampaign;
    activeCampaign = actor;
    try { return draw(); } finally { activeCampaign = previous; }
  }

  function applyCompanionPose(actor, companion) {
    if (!window.GoblinDirections) return;
    let direction = GoblinDirections.headingOf(companion);
    const shot = companionShots.get(companion);
    if (shot) {
      const age = Game.time - shot.born;
      if (age >= shot.dur) companionShots.delete(companion);
      else if (age >= 0) {
        const headings = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
        const angle = Math.atan2(shot.gx - shot.x, shot.gy - shot.y);
        const aim = headings[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
        const name = 't' + (6 + Math.min(5, Math.floor(age / shot.dur * 6)));
        const kind = aim === 'S' ? 'ftZF' : 'ftZ';
        if (request(kind, name, aim)) {
          actor.fr = name;
          actor.face = ['NW', 'W', 'SW'].includes(aim) ? -1 : 1;
          direction = aim;
        }
      }
    }
    GoblinDirections.setHeading(actor, direction);
  }

  const previousBlit = blitFine;
  blitFine = function (context, canvas, x, y, w, h) {
    if (!canvas.rosterArtwork) return previousBlit(context, canvas, x, y, w, h);
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(canvas, x, y, w ?? canvas.width / 2, h ?? canvas.height / 2);
    context.restore();
  };

  window.OldGoldFrogTrollArtwork = {
    prepare,
    prepareAll: kind => Promise.all((front[kind] || kind === 'ftZF' ? ['S'] : views).map(view => prepare(kind, view))),
    frame,
    request,
    applyCompanionPose,
    noteCompanionShot: (actor, shot) => companionShots.set(actor, shot),
    withCampaignActor,
    noteCampaignParry: (actor, time) => {
      if (campaignRoles.has(actor.k)) campaignParries.set(actor, time);
    },
    errors,
    cacheStats: () => ({ frames: frames.size, bytes, maximumFrames, maximumBytes }),
  };
})();
