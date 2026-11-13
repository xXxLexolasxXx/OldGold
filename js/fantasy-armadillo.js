'use strict';

const ArmadilloArt = (() => {
  const spec = NA_SPEC.armad;
  const frames = new Map();
  const latest = new Map();
  const movement = new Map();
  const burrows = new Map();
  const validFrames = new Set([...NA_ALL, ...['curl','roll','uncurl','bounce','parry','roar'].flatMap(key => NA_FRAMES[key])]);
  const nativeLair = naLairSprite;

  function orientation(neutral) {
    const old = movement.get(neutral.id);
    const target = neutral.st === 'atk' || neutral.st === 'chase' ? neuUnit(neutral.tg) : null;
    const dx = neutral.rl?.dx ?? (target ? target.x - neutral.x : old ? neutral.x - old.x : 0);
    const dy = neutral.rl?.dy ?? (target ? target.y - neutral.y : old ? neutral.y - old.y : 0);
    let direction = old?.direction ?? (neutral.vf ? 0 : neutral.face < 0 ? 6 : 2);
    if (Math.hypot(dx,dy) >= .012) direction = (Math.round(Math.atan2(dx,dy) / (Math.PI / 4)) + 8) % 8;
    movement.delete(neutral.id);
    movement.set(neutral.id,{ x:neutral.x, y:neutral.y, direction });
    if (movement.size > 128) movement.delete(movement.keys().next().value);
    return direction;
  }

  function frame(request, direction) {
    const name = validFrames.has(request) ? request : 'i0';
    const view = Math.min(direction,8-direction);
    const key = view + '|' + name;
    const existing = frames.get(key);
    if (existing) {
      frames.delete(key);
      frames.set(key,existing);
      return existing;
    }
    if (R.inFrame && spriteDefer('armad:' + key, () => frame(name,view))) {
      return latest.get(view) || null;
    }
    const pose = naPose(name);
    const {w,h,ax,ay,sc} = spec;
    const kit = fzPxKit(w*2,h*2,ax*2,ay*2);
    drawArmadDirection(pbScaled(kit,2*sc),pose,view);
    const cv = mkCanvas(w*2,h*2), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.translate(ax*2+Math.round(pose.x*sc*2),ay*2+Math.round(pose.y*sc*2));
    if (pose.rot) c.rotate(pose.rot);
    if (pose.sq !== 1) c.scale(1/Math.sqrt(pose.sq),pose.sq);
    c.drawImage(kit.done(),-ax*2,-ay*2);
    if (pose.hurt > .05) {
      c.resetTransform();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(255,236,220,${Math.min(.4,pose.hurt*.32)})`;
      c.fillRect(0,0,cv.width,cv.height);
    }
    const sprite = {cv,w,h,ax,ay,hi:true};
    frames.set(key,sprite);
    latest.set(view,sprite);
    if (frames.size > 240) frames.delete(frames.keys().next().value);
    return sprite;
  }

  naLairSprite = function(kind, phase = '0') {
    if (kind !== 'armad') return nativeLair(kind,phase);
    if (!burrows.has(phase)) {
      const {w,ax,ay} = NA_LAIR.armad;
      const h = 76, cv = mkCanvas(w*2,h*2), c = cv.getContext('2d');
      c.scale(2,2);
      c.translate(ax,ay);
      drawArmadBurrow(c,phase);
      cv.fine = 2;
      burrows.set(phase,{cv,w,h,ax,ay});
    }
    return burrows.get(phase);
  };

  for (let view=0; view<5; view++) frame('i0',view);
  return {frame,orientation,validFrames};
})();
