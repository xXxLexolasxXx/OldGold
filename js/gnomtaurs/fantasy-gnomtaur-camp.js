(() => {
  'use strict';
  if (typeof document === 'undefined' || !document.currentScript?.src || typeof Image !== 'function' || typeof URL !== 'function') return;

  const nativeSprite = naLairSprite;
  const nativeDraw = neuDrawLair;
  const anchors = [[66, 92], [82, 92], [50, 124]];
  const phases = ['0', '1', 'd'];
  const width = 328, height = 292;
  const frames = [];
  const errors = [];
  let active = 0;

  function tier(lair) {
    if (lair.lv >= 1.3) return 2;
    if (lair.lv >= 1.15) return 1;
    return 0;
  }

  // The baked trail ends at the south edge of the camp. Bridge the grass
  // between that edge and the cap of a road built directly below the exit.
  function link(c, lair) {
    const roadX = lair.x + 1, roadY = lair.y + 1;
    if (!inb(roadX, roadY) || !isRoadAt(roadX, roadY)) return;
    const x = (roadX + .5) * TILE, y = roadY * TILE;
    const roadHalfWidth = (globalThis.FantasyRoadArt?.coreWidth ?? 14) / 2;
    c.save();
    for (let row = 0; row < 26; row++) {
      const half = Math.round((5.5 + (roadHalfWidth - 5.5) * row / 25) * 2) / 2;
      c.globalAlpha = row < 17 ? 1 : (26 - row) / 9;
      c.fillStyle = '#655339';
      c.fillRect(x - half, y + row / 2 - .5, half * 2, .5);
      c.fillStyle = row % 7 < 3 ? '#886d4c' : '#806544';
      c.fillRect(x - half + 1, y + row / 2 - .5, (half - 1) * 2, .5);
    }
    c.restore();
  }

  naLairSprite = function (kind, phase = '0') {
    return (kind === 'gnomtaur' && frames[active]?.get(phase)) || nativeSprite(kind, phase);
  };

  neuDrawLair = function (c, lair) {
    if (lair.k !== 'gnomtaur' || frames.length !== anchors.length) return nativeDraw(c, lair);
    const previous = active;
    active = tier(lair);
    try {
      link(c, lair);
      return nativeDraw(c, lair);
    } finally {
      active = previous;
    }
  };

  const image = new Image();
  image.src = new URL('camp-atlas.png', document.currentScript.src).href;
  const ready = image.decode().then(() => {
    if (image.naturalWidth !== width * phases.length || image.naturalHeight !== height * anchors.length) {
      throw Error('Unexpected gnomtaur camp atlas dimensions');
    }
    for (const [row, [ax, ay]] of anchors.entries()) {
      const states = new Map();
      for (const [column, phase] of phases.entries()) {
        const cv = document.createElement('canvas');
        cv.width = width;
        cv.height = height;
        cv.fine = 2;
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(image, column * width, row * height, width, height, 0, 0, width, height);
        states.set(phase, { cv, w: width / 2, h: height / 2, ax, ay });
      }
      frames.push(states);
    }
    return true;
  }).catch(error => {
    frames.length = 0;
    errors.push(error.message);
    return false;
  });

  globalThis.GnomtaurCamp = { ready, errors };
})();
