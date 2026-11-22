'use strict';
// The title scene is independent of the simulation and its sprite bank.
(() => {
  const screen = document.getElementById('loading');
  const backdrop = document.getElementById('fantasy-load-cv');
  const dancers = document.getElementById('fantasy-dance-cv');
  if (!screen || screen.classList.contains('hidden') || !backdrop || !dancers) return;
  const output = backdrop.getContext('2d');
  const stage = dancers.getContext('2d');
  if (!output || !stage) return;

  const state = window.FantasySplash = { failures: [], frames: 0, people: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const portrait = matchMedia('(orientation: portrait) and (max-width: 700px)');
  const layouts = {
    wide: { patch: [268,302,530,264], hearth: [474,300,120,246] },
    tall: { patch: [18,322,273,187], hearth: [132,322,56,177] },
  };
  let running = true, pending = null, sceneKey = '', frameKey = '';

  function asset(layout, name, key, suffix) {
    if (layout[key]) return layout[key];
    const image = new Image();
    image.onload = () => {
      if (key !== 'strip' || !image.decode) {
        layout[key + 'Ready'] = true;
        queueFrame();
        return;
      }
      image.decode().then(() => {
        layout.stripReady = true;
        queueFrame();
      }, () => state.failures.push(name + suffix));
    };
    image.onerror = () => state.failures.push(name + suffix);
    layout[key] = image;
    image.src = 'assets/fantasy/menu-concept-' + name + suffix + '.webp';
    return image;
  }

  function drawBackdrop(still, plate, patch, width, height, scale, left, top) {
    backdrop.width = dancers.width = width;
    backdrop.height = dancers.height = height;
    const matte = output.createLinearGradient(0, 0, 0, height);
    matte.addColorStop(0, '#151714');
    matte.addColorStop(.63, '#24201b');
    matte.addColorStop(1, '#161b15');
    output.fillStyle = matte;
    output.fillRect(0, 0, width, height);
    for (const context of [output, stage]) {
      context.setTransform(scale, 0, 0, scale, left, top);
      context.imageSmoothingEnabled = false;
    }
    output.drawImage(still, 0, 0);
    if (plate) output.drawImage(plate, ...patch);
  }

  function frame(now) {
    pending = null;
    if (!running || document.hidden) return;
    if (!reduced.matches) queueFrame();
    const name = portrait.matches ? 'tall' : 'wide', layout = layouts[name];
    const still = asset(layout, name, 'still', '');
    if (!still.naturalWidth) return;

    screen.dataset.conceptArt = 'true';
    let plate = null;
    if (!reduced.matches) {
      asset(layout, name, 'strip', '-dance');
      const clean = asset(layout, name, 'plate', '-plate');
      if (layout.stripReady && layout.plateReady) plate = clean;
    }

    const width = backdrop.clientWidth, height = backdrop.clientHeight;
    if (!width || !height) return;
    const moving = !!plate;
    const key = name + ':' + width + ':' + height + ':' + moving;
    const step = moving ? Math.floor(now * 44 / 1460) : 0;
    const nextFrame = key + ':' + step;
    if (nextFrame === frameKey) return;
    frameKey = nextFrame;

    if (sceneKey !== key) {
      sceneKey = key;
      const scale = Math.min(width / still.naturalWidth, height / still.naturalHeight);
      const left = Math.round((width - still.naturalWidth * scale) / 2);
      const top = Math.round((height - still.naturalHeight * scale) / 2);
      drawBackdrop(still, plate, layout.patch, width, height, scale, left, top);
      const [x,y,w,h] = layout.hearth;
      state.hearth = { x: (left + x * scale) / width, y: (top + y * scale) / height,
        w: w * scale / width, h: h * scale / height };
    }

    const phase = step % 44;
    const sway = moving ? Math.sin(phase * Math.PI * 2 / 44) : 0;
    if (moving) {
      const [x,y,w,h] = layout.patch;
      stage.clearRect(x, y, w, h);
      stage.drawImage(layout.strip, phase % 11 * w, Math.floor(phase / 11) * h, w, h, x, y, w, h);
    }
    state.people = 5;
    state.frames++;
    state.concept = { layout: name, moving, sway, frame: state.frames };
  }

  function queueFrame() {
    if (running && !document.hidden && pending === null) pending = requestAnimationFrame(frame);
  }

  function cancelFrame() {
    if (pending === null) return;
    cancelAnimationFrame(pending);
    pending = null;
  }

  function onVisibilityChange() {
    if (document.hidden) cancelFrame();
    else queueFrame();
  }

  const observer = new MutationObserver(() => { if (screen.classList.contains('hidden')) stop(); });
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(queueFrame) : null;

  function stop() {
    running = false;
    cancelFrame();
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener('resize', queueFrame);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (reduced.removeEventListener) reduced.removeEventListener('change', queueFrame);
    else reduced.removeListener(queueFrame);
    for (const name of Object.keys(layouts)) delete layouts[name];
    backdrop.width = backdrop.height = dancers.width = dancers.height = 0;
  }

  window.loadingStop = stop;
  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
  if (resize) resize.observe(backdrop);
  else window.addEventListener('resize', queueFrame);
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (reduced.addEventListener) reduced.addEventListener('change', queueFrame);
  else reduced.addListener(queueFrame);
  queueFrame();
})();
