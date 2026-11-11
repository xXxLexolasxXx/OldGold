(() => {
  if (typeof URL !== 'function' || typeof Image !== 'function' || !document.currentScript) return;
  const nativeSprite = naLairSprite;
  const base = new URL('../assets/fantasy/', document.currentScript.src);
  const files = { fairy: 'fairy-ring.png', leshy: 'leshy-stump.png' };
  const phases = ['0', '1', 'd'];
  const frames = new Map();
  const api = { ready: false, errors: [] };
  window.FantasyForestLairs = api;

  function canvas(w, h) {
    const surface = document.createElement('canvas');
    surface.width = w;
    surface.height = h;
    return surface;
  }

  function opaqueBounds(surface) {
    const { width, height } = surface;
    const { data } = surface.getContext('2d').getImageData(0, 0, width, height);
    let left = width, top = height, right = 0, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
    if (right <= left || bottom <= top) throw new Error('Empty lair raster');
    return { left, top, width: right - left, height: bottom - top };
  }

  function paintState(context, kind, state, box) {
    const image = context.getImageData(box.left, box.top, box.width, box.height);
    const { data, width, height } = image;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const u = x / width, v = y / height;
      const r = data[offset], g = data[offset + 1], b = data[offset + 2];
      const crystal = kind === 'fairy' && u > .448 && u < .555 && v < .447;
      const eyes = kind === 'leshy' && u > .44 && u < .54 && v > .64 && v < .73 && g > 75 && g > b * 1.6 && r > b * 1.5;
      if (data[offset + 3] < 128 || (state === 'd' && crystal)) {
        data[offset + 3] = 0;
        continue;
      }
      data[offset + 3] = 255;
      if (state === 'd') {
        const gray = .28 * r + .61 * g + .11 * b;
        const light = eyes ? .035 : .81;
        data[offset] = (r * .55 + gray * .45) * light;
        data[offset + 1] = (g * .55 + gray * .45) * light;
        data[offset + 2] = (b * .55 + gray * .45) * light;
      } else if (state === '1' && (crystal || eyes)) {
        data[offset] = r + 22;
        data[offset + 1] = g + 16;
        data[offset + 2] = b + 12;
      }
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = Math.min(255, Math.round(data[offset + channel] / 8) * 8);
      }
    }
    context.putImageData(image, box.left, box.top);
  }

  function build(kind, image) {
    const source = canvas(image.naturalWidth, image.naturalHeight);
    source.getContext('2d').drawImage(image, 0, 0);
    const crop = opaqueBounds(source);
    // The cleared frame has no free-floating sparks. Use its roots as the world reference.
    const native = nativeSprite(kind, 'd');
    const scale = 2 / (native.cv.fine || 1);
    const envelope = Object.fromEntries(Object.entries(opaqueBounds(native.cv)).map(([key, value]) => [key, Math.round(value * scale)]));
    for (const phase of phases) {
      const area = { ...envelope };
      if (kind === 'fairy' && phase === 'd') {
        // The crystal is removed below; fit the remaining mushroom caps to the cleared height.
        area.top -= 6;
        area.height += 6;
      }
      const cv = canvas(native.w * 2, native.h * 2);
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(source, crop.left, crop.top, crop.width, crop.height, area.left, area.top, area.width, area.height);
      paintState(c, kind, phase, area);
      cv.fine = 2;
      frames.set(kind + phase, { cv, w: native.w, h: native.h, ax: native.ax, ay: native.ay });
    }
  }

  naLairSprite = function (kind, phase = '0') {
    if (api.ready && Object.hasOwn(files, kind) && phases.includes(phase)) return frames.get(kind + phase);
    return nativeSprite(kind, phase);
  };

  api.readyPromise = Promise.all(Object.entries(files).map(([kind, name]) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try { build(kind, image); } catch (error) { api.errors.push(kind + ': ' + error.message); }
      resolve();
    };
    image.onerror = () => { api.errors.push(kind + ': image failed to load'); resolve(); };
    image.src = new URL(name, base).href;
  }))).then(() => (api.ready = api.errors.length === 0));
})();
