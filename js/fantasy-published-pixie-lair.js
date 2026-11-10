/* Isolated treehouse candidate. The native lair draw still owns state, depth and effects. */
(() => {
  const nativeSprite = naLairSprite;
  const asset = new URL('../assets/fantasy/pixie-treehouse.png', document.currentScript.src);
  const states = ['0', '1', 'd'];
  const frames = new Map();
  const api = { ready: false, errors: [] };
  window.PixieLairSample = api;

  function canvas(width, height) {
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    return result;
  }

  function bounds(image) {
    const { width, height, data } = image;
    let left = width, top = height, right = 0, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
    if (right <= left || bottom <= top) throw new Error('Empty treehouse raster');
    return { left, top, width: right - left, height: bottom - top };
  }

  function pixels(surface) {
    return surface.getContext('2d').getImageData(0, 0, surface.width, surface.height);
  }

  function tint(image, area, state) {
    const { data, width, height } = image;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 128) {
        data[offset + 3] = 0;
        continue;
      }
      data[offset + 3] = 255;
      const u = (x - area.left) / area.width;
      const v = (y - area.top) / area.height;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      const window = ((u - .604) / .035) ** 2 + ((v - .480) / .034) ** 2 < 1;
      const lantern = Math.abs(u - .342) < .019 && Math.abs(v - .498) < .018;
      const flame = (window || lantern) && red > 155 && green > 110 && red - blue > 65;
      if (state === 'd') {
        const gray = .26 * red + .64 * green + .10 * blue;
        const dark = flame ? .25 : .78;
        data[offset] = (red * .52 + gray * .48) * dark;
        data[offset + 1] = (green * .52 + gray * .48) * dark;
        data[offset + 2] = (blue * .52 + gray * .48) * dark;
      } else if (flame && state === '1') {
        data[offset + 1] = Math.min(255, green + 24);
        data[offset + 2] = Math.min(255, blue + 17);
      }
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = Math.min(255, Math.round(data[offset + channel] / 8) * 8);
      }
    }
  }

  function build(image) {
    const source = canvas(image.naturalWidth, image.naturalHeight);
    source.getContext('2d').drawImage(image, 0, 0);
    const cut = bounds(pixels(source));
    // Cleared native frame supplies the physical envelope without floating sparks.
    const native = nativeSprite('pixie', 'd');
    const nativeBox = bounds(pixels(native.cv));
    const ratio = 2 / (native.cv.fine || 1);
    const area = Object.fromEntries(Object.entries(nativeBox).map(([key, value]) => [key, Math.round(value * ratio)]));
    for (const state of states) {
      const cv = canvas(native.w * 2, native.h * 2);
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(source, cut.left, cut.top, cut.width, cut.height, area.left, area.top, area.width, area.height);
      const data = pixels(cv);
      tint(data, area, state);
      c.putImageData(data, 0, 0);
      cv.fine = 2;
      frames.set(state, { cv, w: native.w, h: native.h, ax: native.ax, ay: native.ay });
    }
    api.ready = true;
  }

  naLairSprite = function (kind, state = '0') {
    if (kind === 'pixie' && api.ready && frames.has(state)) return frames.get(state);
    return nativeSprite(kind, state);
  };

  api.readyPromise = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try { build(image); } catch (error) { api.errors.push(error.message); }
      resolve(api.ready);
    };
    image.onerror = () => {
      api.errors.push('Treehouse raster failed to load');
      resolve(false);
    };
    image.src = asset.href;
  });
})();
