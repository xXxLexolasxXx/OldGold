'use strict';
// The title scene runs independently of the simulation and its asset loader.
(() => {
  const canvas = document.getElementById('fantasy-load-cv');
  const screen = document.getElementById('loading');
  const output = canvas?.getContext('2d');
  if (!output || !screen || screen.classList.contains('hidden')) return;

  const background = document.createElement('canvas');
  const art = {}, failures = [];
  const state = window.FantasySplash = { art, failures, frames: 0, people: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let c = output, revision = 0, cached = '', trees, hadPeople = false, hadFire = false;

  // Cropped from the game sprites at the title scene's maximum backing size.
  const atlas = new Image();
  atlas.onload = () => {
    const sprites = { school: [0, 0, 191, 230], inn: [224, 0, 204, 187],
      storehouse: [0, 232, 130, 108], 'bonfire-hearth': [144, 232, 108, 53] };
    for (const [name, rect] of Object.entries(sprites)) art[name] = { image: atlas, rect };
    revision++;
  };
  atlas.onerror = () => failures.push('menu-village');
  atlas.src = 'assets/fantasy/menu-village.png';

  function rect(x, y, w, h, color) {
    c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function polygon(points, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.closePath(); c.fill();
  }
  function rand(i) {
    const n = Math.imul(i + 19, 1597334677);
    return (Math.imul(n ^ (n >>> 16), 2246822519) >>> 0) / 4294967295;
  }
  function sprite(name, x, y, limitW, limitH) {
    const a = art[name];
    if (!a) return;
    const scale = Math.min(limitW / a.rect[2], limitH / a.rect[3]);
    const w = Math.round(a.rect[2] * scale), h = Math.round(a.rect[3] * scale);
    c.drawImage(a.image, ...a.rect, Math.round(x - w / 2), Math.round(y - h), w, h);
  }
  function pine(x, y, h, index) {
    const image = trees?.[index % trees.length];
    if (image) {
      const w = Math.round(h * image.width / image.height);
      c.drawImage(image, Math.round(x - w / 2), Math.round(y - h), w, h);
      return;
    }
    rect(x - 1, y - h * .45, 2, h * .45, '#473c31');
    for (let band = 0; band < 3; band++) {
      const top = y - h * (1 - band * .21), base = y - h * (.52 - band * .19);
      const w = Math.round(h * (.20 + band * .035));
      for (let row = Math.floor(top); row <= base; row++) {
        const edge = Math.max(1, Math.round(w * (row - top) / (base - top)));
        rect(x - edge, row, edge * 2, 1, index % 2 ? '#294b3b' : '#29483c');
        rect(x - edge, row, Math.max(1, Math.floor(edge * .67)), 1, '#365943');
      }
    }
  }

  function paintBackground(W, H, cx, cy, house, mobile) {
    const sky = ['#192d3c', '#1d3241', '#223b49', '#284451', '#304c55', '#38565b', '#42605f', '#4f6863', '#606f65', '#777d6a'];
    sky.forEach((color, i) => rect(0, i * H / 18, W, H / 18 + 1, color));
    for (let i = 0; i < 34; i++) rect(rand(i + 3) * W, rand(i + 54) * H * .35, 1, 1, i % 5 ? '#708993' : '#d3c9a3');
    const ridges = [
      ['#3b555d', [.44,.37,.27,.39,.32,.24,.34,.39,.29,.32,.42]],
      ['#425c56', [.48,.38,.42,.46,.40,.34,.43,.42,.37,.45,.48]],
      ['#486553', [.57,.51,.45,.49,.55,.53,.47,.43,.52,.49,.56]],
    ];
    for (const [color, heights] of ridges) for (let x = 0; x < W; x += 2) {
      const f = x / W * (heights.length - 1), j = Math.floor(f);
      const h = heights[j] + (heights[j + 1] - heights[j]) * (f - j);
      const y = Math.round((h + Math.sin(x * .49) * .005) * H);
      rect(x, y, 2, H - y, color);
    }
    for (let i = 0; i < 57; i++) {
      const x = i / 56 * W, y = H * (.54 + .035 * Math.sin(i * .29));
      const h = 4 + rand(i + 320) * 9;
      for (let row = 0; row < h; row++) {
        const w = Math.round(row / h * 3);
        rect(x - w, y - h + row, w * 2 + 1, 1, i % 3 ? '#385849' : '#3d5c49');
      }
    }
    polygon([[0,H*.68],[W*.20,H*.57],[W*.54,H*.62],[W*.81,H*.57],[W,H*.63],[W,H],[0,H]], '#4e6846');
    polygon([[0,H*.84],[W*.25,H*.76],[W*.54,H*.79],[W*.82,H*.72],[W,H*.78],[W,H],[0,H]], '#3f5d43');
    for (let i = 0; i < 115; i++) {
      const x = rand(i + 500) * W, y = H * (.65 + rand(i + 900) * .35);
      rect(x, y, 1 + rand(i) * 4, 1, ['#58764c', '#6b8050', '#395640'][i % 3]);
      if (i % 5 === 0) rect(x + 2, y - 1, 1, 1, '#9a9362');
    }
    for (let i = 0; i < 18; i++) {
      const x = i < 9 ? W * rand(i + 83) * .20 : W * (.82 + rand(i + 83) * .18);
      const y = H * (.56 + rand(i + 44) * .30);
      pine(x, y, 13 + rand(i + 92) * 32, i);
    }
    for (let row = 0; row < 16; row++) {
      const y = cy + 9 + row * 5, x = cx + Math.sin(row * .30) * 13;
      for (let col = -2; col <= 2; col++) {
        const px = Math.round(x + col * 5 + row % 2 * 2);
        rect(px, y, 4, 3, ['#a39773', '#817d62', '#8c8b6f'][(row + col + 20) % 3]);
        rect(px, y + 3, 4, 1, '#535c49');
      }
    }
    if (!mobile) sprite('storehouse', cx - W * .40, cy + 2, house * .58, house * .62);
    sprite('school', cx - W * .27, cy - 6, house * .86, house * 1.13);
    sprite('inn', cx + W * .29, cy - 7, house, house);
  }

  const people = new Map();
  function person(x, y, female, frame, view = 'S') {
    if (!hadPeople) return;
    const key = (female ? 'f' : 'm') + view;
    if (!people.has(key)) people.set(key, { type: 'serf', look: female ? 14 : 23, sx: female ? 'f' : '', carry: null });
    const walking = view === 'E', phase = walking ? Math.floor(frame % 8 * WALK_FRAMES / 8) : 0;
    const image = personSprite(people.get(key), view, walking ? 'walk' : 'idle', phase, {});
    const scale = .65;
    c.drawImage(image, Math.round(x - PFX * scale), Math.round(y - PFY * scale), PW * scale, PH * scale);
    state.people++;
  }
  function paintMotion(t, W, cx, cy, house, shortLandscape) {
    for (let i = 0; i < 5; i++) {
      const p = (t * .18 + i * .2) % 1;
      c.globalAlpha = (1 - p) * .25;
      rect(cx + W * .29 + house * .26 + Math.sin(p * 5) * 4, cy - house * .96 - p * 22, 2 + p * 4, 2 + p * 3, '#c0beb0');
    }
    c.globalAlpha = 1;
    person(cx - 27, cy - (shortLandscape ? 4 : 8), false, 0);
    person(cx + 27, cy - (shortLandscape ? 3 : 7), true, 0);
    sprite('bonfire-hearth', cx, cy + 10, 53, 29);
    if (hadFire) {
      const a = FantasyArt.images['bonfire-flames'];
      const f = a.frames[Math.floor(t * 9) % a.frames.length], h = shortLandscape ? 22 : 30, w = f[2] / f[3] * h;
      c.drawImage(a.image, ...f, Math.round(cx - w / 2), Math.round(cy - h + 1), Math.round(w), h);
    } else if (art['bonfire-hearth']) {
      const step = Math.floor(t * 7) % 3;
      rect(cx - 5, cy - 7, 10, 7, '#d56d34');
      rect(cx - 3, cy - 12 - step, 6, 11 + step, '#eea548');
      rect(cx - 1, cy - 8, 3, 7, '#ffe49b');
    }
    person(cx - 29, cy + 18, true, 0);
    person(cx + 28, cy + 17, false, 0);
    person(cx - W * .22 + t * 7 % (W * .44), cy + 29, false, Math.floor(t * 7), 'E');
    for (let i = 0; i < 7; i++) {
      const p = (t * .27 + i / 7) % 1;
      rect(cx + Math.sin(i * 7 + p * 5) * 9, cy - 8 - p * 28, 1, 1, p < .6 ? '#e7c784' : '#a57b51');
    }
  }

  let running = true, last = -Infinity;
  const observer = new MutationObserver(() => { if (screen.classList.contains('hidden')) stop(); });
  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
  function stop() { running = false; observer.disconnect(); }
  window.loadingStop = stop;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 66) return;
    last = now;
    const W = Math.max(100, Math.ceil(canvas.clientWidth / 3)), H = Math.max(60, Math.ceil(canvas.clientHeight / 3));
    const mobile = canvas.clientWidth < 700;
    const shortLandscape = canvas.clientHeight < 520 && canvas.clientWidth > canvas.clientHeight;
    const cx = W / 2, cy = H * (shortLandscape ? .51 : mobile ? .62 : .73);
    const house = Math.min(101, W * .29, H * (shortLandscape ? .27 : .35));
    const nextTrees = window.FantasyTreesPolish?.base;
    if (nextTrees !== trees) { trees = nextTrees; revision++; }
    const key = W + ':' + H + ':' + revision;
    const peopleReady = !!(window.FantasyPublishedAppearanceArt && typeof FantasyArt !== 'undefined' &&
      FantasyArt.images['gnome-walk']?.frames && FantasyArt.images['gnome-woman-walk']?.frames);
    const fireReady = typeof FantasyArt !== 'undefined' && !!FantasyArt.images['bonfire-flames']?.frames?.length;
    if (reduced.matches && key === cached && peopleReady === hadPeople && fireReady === hadFire && state.frames) return;
    hadPeople = peopleReady; hadFire = fireReady;
    if (key !== cached) {
      cached = key;
      canvas.width = background.width = W * 2; canvas.height = background.height = H * 2;
      c = background.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.imageSmoothingEnabled = false;
      paintBackground(W, H, cx, cy, house, mobile);
      c = output;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(background, 0, 0);
    c.setTransform(2, 0, 0, 2, 0, 0); c.imageSmoothingEnabled = false;
    paintMotion(reduced.matches ? 0 : now / 1000, W, cx, cy, house, shortLandscape);
    state.frames++;
  }
  frame(performance.now());
})();
