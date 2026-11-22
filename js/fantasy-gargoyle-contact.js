// Atlas coordinates and animation are on the half-world-pixel grid.
(() => {
  'use strict';
  if (typeof URL !== 'function' || !document.currentScript?.src) return;
  const columns = ['S', 'SE', 'E', 'NE', 'N'];
  const mirror = { SW: 'SE', W: 'E', NW: 'NE' };
  const views = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE', 'N'];
  // Each cel has its own marked paws, lamp contact, wing roots, and eye pixels.
  const layouts = {
    A: { row: 0, pivot: 100, bottom: 136, sole: 22, shoulders: [90, 114, 109, 119], sweep: 5, frames: [
      { paws: [90, 109], hold: [111, 130], joints: [90, 109, 105], eyes: [[96, 101], [104, 101]] },
      { paws: [92, 113], hold: [114, 125], joints: [91, 103, 105], eyes: [[115, 98]] },
      { paws: [87, 108], hold: [109, 126], joints: [95, 103, 103], eyes: [[114, 98]] },
      { paws: [86, 111], hold: [109, 131], joints: [91, 103, 104], eyes: [] },
      { paws: [89, 110], hold: [111, 132], joints: [90, 110, 105], eyes: [] },
    ] },
    B: { row: 1, pivot: 114, bottom: 144, sole: 18, shoulders: [107, 124, 132, 135], sweep: 4, frames: [
      { paws: [108, 121], hold: [117, 124], joints: [108, 122, 126], eyes: [[111, 119], [120, 119]] },
      { paws: [110, 123], hold: [127, 121], joints: [109, 117, 124], eyes: [[124, 118]] },
      { paws: [109, 120], hold: [125, 121], joints: [109, 118, 124], eyes: [[124, 118]] },
      { paws: [108, 124], hold: [127, 120], joints: [109, 117, 124], eyes: [] },
      { paws: [106, 123], hold: [116, 121], joints: [108, 122, 126], eyes: [] },
    ] },
    C: { row: 2, pivot: 100, bottom: 90, sole: 45, shoulders: [91, 110, 72, 75], sweep: 5, frames: [
      { paws: [94, 107], joints: [91, 109, 60], eyes: [[97, 52], [104, 52]] },
      { paws: [95, 107], joints: [93, 103, 60], eyes: [[111, 52]] },
      { paws: [93, 106], joints: [95, 103, 58], eyes: [[113, 51]] },
      { paws: [91, 110], joints: [94, 102, 61], eyes: [] },
      { paws: [92, 109], joints: [92, 108, 61], eyes: [] },
    ] },
  };
  const cages = {
    A: [7.5,-8.5,4.4,7],
    B: [11.4,-8,4.6,7.4],
    C: [0,-30,5.6,9],
  };
  const eyeColors = [[129, 97, 50], [182, 134, 66], [237, 191, 107]];
  const cache = new Map(), cels = new Map();
  const atlas = new Image();
  let ready = false;
  const readyPromise = new Promise((resolve, reject) => {
    atlas.onload = () => { ready = true; resolve(); };
    atlas.onerror = () => reject(new Error('Gargoyle atlas unavailable'));
  });
  readyPromise.catch(error => console.error(error));
  atlas.src = new URL('../assets/fantasy/leshy-elf-review/gargoyle-atlas.png', document.currentScript.src);

  function cel(row, column) {
    const key = row * columns.length + column;
    if (!cels.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(atlas, column * 200, row * 200, 200, 200, 0, 0, 200, 200);
      cels.set(key, ctx.getImageData(0, 0, 200, 200).data);
    }
    return cels.get(key);
  }

  function frame(style, direction, phase, eye) {
    const layout = layouts[style], view = mirror[direction] || direction;
    const column = columns.indexOf(view);
    if (!ready || !layout || column < 0) return null;
    phase = Math.max(0, Math.min(7, Math.round(phase)));
    eye = Math.max(0, Math.min(3, Math.round(eye)));
    const key = [style, direction, phase, eye].join('|');
    if (cache.has(key)) return cache.get(key);
    const marks = layout.frames[column], source = cel(layout.row, column);
    const flip = mirror[direction] ? -1 : 1, front = view === 'S' || view === 'N';
    const offset = style === 'B' ? 14 : 0;
    const originX = 48, baseY = 68, originY = baseY + 2 * layout.sole;
    const cv = document.createElement('canvas');
    cv.width = 96; cv.height = 76; cv.fine = 2;
    const context = cv.getContext('2d', { willReadFrequently: true });
    const pixels = context.createImageData(cv.width, cv.height);
    const [left, right, taperStart, taperEnd] = layout.shoulders;
    const sourceToX = x => originX + offset + flip * (x - layout.pivot);
    const sourceToY = y => baseY + y - layout.bottom;
    for (let y = layout.bottom - 56; y < layout.bottom; y++) {
      // Only wing pixels outside each shoulder move. Taper before the thighs.
      const taper = Math.max(0, Math.min(1, (taperEnd - y) / (taperEnd - taperStart)));
      const amount = layout.sweep * phase / 7 * taper;
      for (let x = layout.pivot - 30; x <= layout.pivot + 30; x++) {
        const hinge = x < left ? left : front && x > right ? right : x;
        const stretch = amount * Math.min(1, Math.abs(x - hinge) / 9);
        const sample = x + Math.sign(hinge - x) * Math.round(stretch);
        const s = (y * 200 + sample) * 4;
        if (source[s + 3] < 128) continue;
        const t = (sourceToY(y) * cv.width + sourceToX(x)) * 4;
        pixels.data[t] = source[s];
        pixels.data[t + 1] = source[s + 1];
        pixels.data[t + 2] = source[s + 2];
        pixels.data[t + 3] = 255;
      }
    }
    if (eye) for (const [x, y] of marks.eyes) {
      const index = (sourceToY(y) * cv.width + sourceToX(x)) * 4;
      if (pixels.data[index + 3]) pixels.data.set(eyeColors[eye - 1], index);
    }
    context.putImageData(pixels, 0, 0);
    const point = (x, y) => ({
      x: (sourceToX(x) - originX) / 2,
      y: (sourceToY(y) - originY) / 2,
    });
    const [jointLeft, jointRight, jointY] = marks.joints;
    const result = {
      cv, w: cv.width / 2, h: cv.height / 2, ax: originX / 2, ay: originY / 2,
      rear: view === 'N' || view === 'NE',
      hold: marks.hold ? point(...marks.hold) : null,
      roots: [point(jointLeft, jointY), point(jointRight, jointY)],
      feet: marks.paws.map(x => point(x, layout.bottom - 2)),
    };
    cache.set(key, result);
    if (cache.size > 96) cache.delete(cache.keys().next().value);
    return result;
  }

  function livePose(style,ph){
    const t=Game.time,k=garEyeK();
    const turn= Math.sin(t*(style==='B'?.5:style==='C'?.4:.45)+ph)*
      (style==='B'?.3+.7*k:style==='C'?.4+.6*k:.35+.65*k);
    const dir=views[Math.round((turn+1)*4)];
    const lift=style==='C'?(Math.sin(t*1.1+ph)*.5+.5)*(.25+.75*k)
      :Math.max(0,Math.sin(t*(style==='B'?.8:.9)+ph))**6*k;
    return frame(style,dir,lift*7,k*3);
  }
  function link(c,start,end){
    c.strokeStyle=IRON[0];c.lineWidth=.8;c.beginPath();c.moveTo(start.x,start.y);
    c.lineTo(end.x,end.y);c.stroke();
    const length=Math.hypot(end.x-start.x,end.y-start.y);
    for(let dist=1;dist<length-.5;dist+=1.5){
      const f=dist/length;
      c.fillStyle=IRON[2];
      c.fillRect(Math.round((start.x+(end.x-start.x)*f)*2)/2,
        Math.round((start.y+(end.y-start.y)*f)*2)/2,.5,.5);
    }
  }
  function lamp(c,style,bx,by,lit,ph,pose=livePose(style,ph)){
    c.save();c.translate(bx,by);
    if(style==='C'){
      c.fillStyle=IRON[1];c.fillRect(-.9,-30,1.8,25);c.fillStyle=IRON[2];c.fillRect(-.9,-30,.6,25);
      for(const h of [-10,-17,-24]){c.fillStyle=IRON[0];c.fillRect(-2,h,4,1.2);}
    }else{
      const projected=style==='B';
      c.fillStyle='#6e685e';c.fillRect(-2.3,projected?-24:-22,4.6,projected?19:17);
      c.fillStyle='#9a9488';c.fillRect(-2.3,projected?-24:-22,1.2,projected?19:17);
      if(projected){
        garPoly(c,[[-3.5,-22],[5,-22],[15,-18],[15,-16],[5,-16],[-3.5,-19]],'#545747');
        c.fillStyle='#818372';c.fillRect(-1,-18,16,.5);
      }else{c.fillStyle='#696657';garPoly(c,[[-11,-22],[11,-22],[9,-20],[4,-19],[-4,-19],[-9,-20]],'#696657');c.fillStyle='#a19a85';c.fillRect(-11,-22,22,.5);}
    }
    const [lx,ly,w,h]=cages[style];
    lampCage(c,lx,ly,w,h,lit,Math.round(Math.sin(Game.time*6+ph)*18));
    if(lit)glow(c,lx,style==='A'?-13.5:style==='B'?-13:-35,style==='C'?17:16,'255,196,100',
      .26+.06*Math.sin(Game.time*5+ph));
    const tip={x:lx,y:ly-h-w*1.1-2.2};
    if(pose.hold && (style==='A'||pose.rear))link(c,pose.hold,tip);
    if(style==='C'){
      // The two slates bridge the fixed turret finial to C's soles.
      garPoly(c,[[-8,-45],[8,-45],[5,-43.5],[0,-42],[-5,-43.5]],'#424b4c');
      c.fillStyle='#87897b';c.fillRect(-8,-45,16,.5);
    }
    c.imageSmoothingEnabled=false;c.drawImage(pose.cv,-pose.ax,-pose.ay,pose.w,pose.h);
    if(style==='B' && !pose.rear){
      link(c,pose.hold,tip);
      // The painted upper lip and fang cover the first half-pixel of chain.
      const hx=pose.hold.x-.5, hy=pose.hold.y-.5;
      c.drawImage(pose.cv,(pose.ax+hx)*2,(pose.ay+hy)*2,2,2,hx,hy,1,1);
    }
    c.restore();
  }
  globalThis.ForestGargoyleStone = { frame, livePose, lamp, readyPromise };
  const base={A:garA,B:garB,C:garC};
  function replace(style){return (c,x,y,lit,ph)=>ready && globalThis.FantasyForestRosterV4?.ready
    ?lamp(c,style,x,y,lit,ph):base[style](c,x,y,lit,ph);}
  garA=replace('A');garB=replace('B');garC=replace('C');

  // Variant 6 was reserved for a gargoyle in the original street renderer.
  // Choose its profile by tile, independently of time, growth, and lamp state.
  function streetStyle(tile, variant = hash(tile) % 7) {
    if (variant !== 6 || !ready || !globalThis.FantasyForestRosterV4?.ready) return null;
    return 'ABC'[hash(tile ^ 0x2d0b) % 3];
  }

  const drawWoodenLamp = drawGothicLamp;
  drawGothicLamp = function(c, x, y, variant, lit, phase) {
    const tile = idx(Math.floor(x / TILE), Math.floor(y / TILE));
    const style = streetStyle(tile, variant);
    return style ? drawGargoyleLamp(c, x, y, lit, phase, style) : drawWoodenLamp(c, x, y, variant, lit, phase);
  };

  function morphShift(id, x, y) {
    const style = id === 7 && streetStyle(idx(x, y));
    if (!style) return null;
    const [lx,ly,,h] = cages[style];
    // The street anchor is at tileY + 24 and case 7 starts at tileY - 6.
    return [lx, 24 + ly - h / 2 + 6];
  }

  const drawDecorMorph = drawMorph;
  drawMorph = function(c, id, px, py, o, strength) {
    const shift = morphShift(id, px / TILE, py / TILE);
    if (!shift) return drawDecorMorph(c, id, px, py, o, strength);
    c.save();
    // The published face already sits seven right and six down of the old
    // light-map anchor for slot 6. Keep its pixels and blink timing intact.
    if (globalThis.FantasyPublishedNightDecor) c.translate(shift[0] - 7, shift[1] - 6);
    else c.translate(...shift);
    try { return drawDecorMorph(c, id, px, py, o, strength); }
    finally { c.restore(); }
  };

  const getDecorMorphLight = decorMorphLight;
  decorMorphLight = function(id, x, y) {
    const light = getDecorMorphLight(id, x, y);
    const shift = morphShift(id, x, y);
    if (shift) {
      light[0] += shift[0];
      light[1] += shift[1];
    }
    return light;
  };
})();
