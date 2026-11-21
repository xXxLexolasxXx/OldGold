'use strict';
// Decorative ground layer. Native entrance cells, routes and building states remain authoritative.
(() => {
  const frontage = {
    armory:[.36,.97],bakery:[.37,.98],bonfire:[.50,.99],brewery:[.40,.98],
    butchery:[.40,.98],crystalmine:[.40,.97],farm:[.36,.98],fisherhut:[.27,.94],
    goatpen:[.31,.98],goldmine:[.33,.98],graveyard:[.33,.96],guild_archer:[.37,.97],
    guild_mage:[.38,.98],guild_rogue:[.34,.98],guild_warrior:[.37,.98],herohall:[.35,.98],
    hopfarm:[.39,.98],house:[.36,.97],infirmary:[.33,.95],inn:[.41,.97],
    ironmine:[.34,.98],library:[.39,.97],magiccircle:[.50,.99],magicworkshop:[.41,.98],
    metallurgist:[.31,.97],mill:[.40,.98],pier:[.27,.86],quarry:[.36,.98],
    sawmill:[.40,.985],school:[.40,.985],smeltery:[.24,.97],squadtavern:[.37,.98],
    stable:[.35,.98],storehouse:[.37,.96],swine:[.36,.98],tannery:[.31,.98],
    tradepost:[.44,.91],watchtower:[.31,.98],weaponsmith:[.33,.98],well:[.50,.99],
    woodcutter:[.37,.98],
  };
  const cache = new WeakMap();
  const step = 4;
  function findRoute(start, goal, boxes, bounds, radius) {
    const blocked = ([x, y]) => boxes.some(([l, t, r, b]) => {
      const dx = Math.max(l - x, 0, x - r);
      const dy = Math.max(t - y, 0, y - b);
      return dx * dx + dy * dy < radius * radius;
    });
    function clear(a, b) {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let i = 0; i <= n; i++) {
        const at = i / n;
        if (blocked([a[0] + (b[0] - a[0]) * at, a[1] + (b[1] - a[1]) * at])) return false;
      }
      return true;
    }
    if (clear(start, goal)) return [start, goal];
    if (blocked(start) || blocked(goal)) return null;

    const nodes = [start, goal];
    const grid = new Map();
    for (let y = bounds[1]; y <= bounds[3]; y += step) {
      for (let x = bounds[0]; x <= bounds[2]; x += step) {
        if (blocked([x, y])) continue;
        grid.set(`${x}:${y}`, nodes.length);
        nodes.push([x, y]);
      }
    }
    const open = new Set([0]);
    const distance = new Float64Array(nodes.length).fill(Infinity);
    const previous = new Int32Array(nodes.length).fill(-1);
    const toGoal = ([x, y]) => Math.hypot(x - goal[0], y - goal[1]);
    distance[0] = 0;
    while (open.size) {
      let current = -1, best = Infinity;
      for (const node of open) {
        const cost = distance[node] + toGoal(nodes[node]);
        if (cost < best) { current = node; best = cost; }
      }
      if (current === 1) break;
      open.delete(current);
      const point = nodes[current];
      const neighbors = [1];
      if (current === 0) {
        for (let i = 2; i < nodes.length; i++) {
          if (Math.hypot(nodes[i][0] - point[0], nodes[i][1] - point[1]) <= TILE) neighbors.push(i);
        }
      } else {
        for (const dx of [-step, 0, step]) for (const dy of [-step, 0, step]) {
          const index = grid.get(`${point[0] + dx}:${point[1] + dy}`);
          if (index !== undefined && index !== current) neighbors.push(index);
        }
      }
      for (const next of neighbors) {
        const target = nodes[next];
        const cost = distance[current] + Math.hypot(target[0] - point[0], target[1] - point[1]);
        if (cost < distance[next] && clear(point, target)) {
          distance[next] = cost;
          previous[next] = current;
          open.add(next);
        }
      }
    }
    if (previous[1] === -1) return null;
    const route = [];
    for (let i = 1; i !== -1; i = previous[i]) route.unshift(nodes[i]);
    const smooth = [start];
    for (let i = 0; i < route.length - 1;) {
      let next = route.length - 1;
      while (next > i + 1 && !clear(route[i], route[next])) next--;
      smooth.push(route[next]);
      i = next;
    }
    return smooth;
  }
  function plan(building, sprite) {
    const { type, x, y, w, h, doorX, doorY } = building;
    const origin = [x * TILE - sprite.padx, y * TILE - sprite.top];
    const [left, top, width, height] = sprite._artBox;
    const [u, v] = frontage[type];
    const rotation = sprite._artRotation ?? building.rot ?? 0;
    const northFire = type === 'bonfire' && rotation === 3;
    const goal = [origin[0] + left + width * (rotation === 1 || rotation === 2 ? 1 - u : u),
      origin[1] + top + height * (northFire ? .36 : v)];
    const gate = [(doorX + .5) * TILE, (doorY + .5) * TILE];
    const port = [goal[0], goal[1] + (northFire ? -8.5 : 8.5)];
    const boxes = [];
    const translated = ([l, t, r, b]) => boxes.push([l + origin[0], t + origin[1], r + origin[0], b + origin[1]]);
    const around = (point, halfWidth, behind, front) => {
      if (!Array.isArray(point) || !point.slice(0, 2).every(Number.isFinite)) return;
      translated([point[0] - halfWidth, point[1] - behind, point[0] + halfWidth, point[1] + front]);
    };
    const exact = window.FantasyPublishedYard?.obstacles?.(sprite, type, building);
    if (exact) {
      exact.forEach(translated);
    } else {
      for (const [key, a, b, d] of [['block',10,5,3],['cartSpot',16,8,7],['oven',10,6,6],
        ['spit',13,5,6],['chop',6,5,4],['rack',6,4,4],['saw',11,4,10]]) around(sprite[key], a, b, d);
      for (const spots of Object.values(sprite.piles || {})) {
        for (const point of spots) around(point, 7, 5, 5);
      }
      for (const key of ['knead','baker','vat','panner','kiln','stoker','butcher','stamp','sorter']) {
        around(sprite.pt?.[key], 6, 3, 5);
      }
      for (const point of sprite.pt?.racks || []) around(point, 6, 3, 5);
      const penRects = sprite.penRects || (sprite.penRect ? [sprite.penRect] : []);
      for (const rect of penRects) {
        if (rect.length === 4 && rect.every(Number.isFinite)) {
          translated([rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]]);
        }
      }
    }
    const radius = window.FantasyRoadArt.paintedWidth / 2;
    const bounds = [Math.min(x*TILE, gate[0]) - 7, Math.min(y*TILE, gate[1]) - 3,
      Math.max((x+w)*TILE, gate[0]) + 7, Math.max((y+h)*TILE, gate[1]) + 12];
    const facade = [origin[0] + left + 2, Math.max(origin[1] + top, y * TILE - 2),
      origin[0] + left + width - 2, goal[1] - 1];
    const route = findRoute(gate, port, northFire ? boxes : [...boxes, facade], bounds, radius + .5);
    return { gate, goal, boxes, route: route && [...route, goal] };
  }
  function draw(context, building) {
    if (!frontage[building.type] || building.state !== 'done' || !Number.isFinite(building.doorX) ||
        !Number.isFinite(building.doorY) || !window.FantasyRoadArt?.paintApproach) return;
    if (World.terrain[idx(building.doorX, building.doorY)] === T_WATER) return;
    const era = building.eraFx && !building.upg && Game.time - building.eraFx.t0 <= ERA_FX.dur ? building.eraFx.from : undefined;
    const sprite = buildingSprite(building.type, building.rot || 0, building.level, era, building.hv || 0);
    if (!sprite._artBox) return;
    const key = [Game.seed, building.x, building.y, building.doorX, building.doorY].join(':');
    let entry = cache.get(building);
    if (entry?.key !== key || entry.sprite !== sprite) {
      const layout = plan(building, sprite);
      entry = { key, sprite, art: layout.route && FantasyRoadArt.paintApproach(layout.route, layout.boxes) };
      cache.set(building, entry);
    }
    if (!entry.art) return;
    const { canvas, x, y, width, height } = entry.art;
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(canvas, x, y, width, height);
    context.restore();
  }

  window.FantasyDoorApproaches = { draw, plan, frontage };
})();
