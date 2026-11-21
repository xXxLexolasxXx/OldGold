/* Golden goose uses isolated cells from the approved half-world-pixel atlas. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' ||
      typeof URL === 'undefined' || typeof Image === 'undefined') return;
  const scriptSource = document.currentScript?.src;
  if (typeof scriptSource !== 'string' || !scriptSource) return;

  const api = window.FantasyGoose = {ready: false, errors: []};
  const marker = {};
  const headings = new WeakMap();
  const columns = 12;
  const cellWidth = 54;
  const cellHeight = 44;
  const rows = 5;
  const dest = [-13.5, -21, 27, 22];
  const view = [0, 1, 2, 3, 4, 3, 2, 1];
  let activeDirection;

  function heading(goose) {
    const previous = headings.get(goose);
    const dx = previous ? goose.x - previous.x : 0;
    const dy = previous ? goose.y - previous.y : 0;
    const dir = Math.hypot(dx, dy) > 1e-5
      ? (Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8
      : previous?.dir ?? (goose.face < 0 ? 6 : 2);
    headings.set(goose, {x: goose.x, y: goose.y, dir});
    return dir;
  }

  const image = new Image();
  image.src = new URL('../assets/fantasy-birds/gold-goose-runtime-v1.png', scriptSource).href;
  api.readyPromise = image.decode().then(async () => {
    if (image.naturalWidth !== columns * cellWidth || image.naturalHeight !== rows * cellHeight) {
      throw Error('Unexpected golden goose atlas dimensions');
    }
    const cells = Array.from({length: rows}, () => []);
    for (let row = 0; row < rows; row++) for (let phase = 0; phase < columns; phase++) {
      const x = phase * cellWidth, y = row * cellHeight;
      if (typeof createImageBitmap === 'function') {
        cells[row].push(await createImageBitmap(image, x, y, cellWidth, cellHeight));
      } else {
        const cell = document.createElement('canvas');
        cell.width = cellWidth;
        cell.height = cellHeight;
        const context = cell.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(image, x, y, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        cells[row].push(cell);
      }
    }
    const frames = view.map((row, dir) => cells[row].map(img => ({
      img,
      source: [0, 0, cellWidth, cellHeight],
      dest,
      marker,
      mirror: dir > 4,
    })));
    function frame(dir, phase) {
      return frames[dir]?.[phase < 30 ? 0 : phase - 30];
    }
    api.frame = frame;

    const oldBlit = fyBlit;
    const oldSprite = sprGoose;
    const oldDraw = goldGooseDraw;
    fyBlit = function(c, sprite, x, y, face, alpha = 1, scale = 1) {
      if (sprite?.marker !== marker) return oldBlit.apply(this, arguments);
      c.save();
      c.globalAlpha = alpha;
      c.imageSmoothingEnabled = false;
      c.translate(Math.round(x), Math.round(y));
      c.scale(sprite.mirror ? -scale : scale, scale);
      c.drawImage(sprite.img, ...sprite.source, ...sprite.dest);
      c.restore();
    };
    sprGoose = function(phase) {
      return frame(activeDirection, phase) ?? oldSprite.call(this, phase);
    };
    goldGooseDraw = function(list, c, world, ...bounds) {
      const start = list.length;
      oldDraw.call(this, list, c, world, ...bounds);
      if (!world.gg) return;
      const direction = heading(world.gg);
      for (let i = start; i < list.length; i++) {
        const draw = list[i][1];
        list[i][1] = () => {
          const previous = activeDirection;
          activeDirection = direction;
          try { return draw(); } finally { activeDirection = previous; }
        };
      }
    };
    api.ready = true;
    return true;
  }).catch(error => {
    api.errors.push(String(error));
    return false;
  });
})();
