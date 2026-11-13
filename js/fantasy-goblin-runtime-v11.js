(() => {
  'use strict';
  const art = window.OldGoldFrogTrollArtwork;
  const family = window.GoblinFamilyDirections;
  if (!art || !family || typeof URL !== 'function' || !document.currentScript?.src) return;
  const kinds = new Set(['goblin','goblinB','goblinKing','shnyrKing']);
  const west = new Set(['SW','W','NW']);
  const sizes = [4,6,8], states = ['0','1','d'];
  const root = new URL('../assets/fantasy/goblin-camps-v9/',document.currentScript.src);
  const frames = new Map();
  const foreground = new Map();
  const approaches = new Map();
  const errors = [];
  const originalFrame = naFrame, originalNeutral = neuDraw, originalCamp = campDrawGoblin;
  const originalLair = neuDrawLair, originalLairList = neuDrawList, originalLairSprite = naLairSprite;
  const originalRaider = foeDrawRaider;
  let heading, outerActor;

  function enabled(kind) { return kinds.has(kind) && window.GoblinPolish?.enabled !== false; }
  naFrame = function(kind,fr) {
    if (enabled(kind)) {
      const sprite = art.request(kind,fr,heading || 'E');
      if (sprite) return sprite;
    }
    return originalFrame(kind,fr);
  };
  neuDraw = function(c,actor) {
    if (!enabled(actor.k)) return originalNeutral(c,actor);
    const previous = heading;
    heading = family.headingOf(actor);
    try { return originalNeutral(c,actor); }
    finally { heading = previous; }
  };
  foeDrawRaider = function(c,actor) {
    const previous = outerActor;
    outerActor = actor;
    try { return originalRaider(c,actor); }
    finally { outerActor = previous; }
  };
  campDrawGoblin = function(c,actor,explicitKind) {
    const kind = explicitKind || (actor.k === 'goblinChamp' ? 'goblinChamp' : actor.id%2 ? 'goblinB' : 'goblin');
    if (!enabled(kind)) return originalCamp(c,actor,explicitKind);
    const direction = family.headingOf(actor);
    // The family renderer already selects animation frames and cancels the generic fall transform.
    if (kind !== 'shnyrKing') {
      const previous = heading;
      heading = direction;
      c.save();
      try {
        if (west.has(direction) !== (outerActor === actor && actor.face < 0)) c.scale(-1,1);
        return originalCamp(c,actor,kind);
      } finally { c.restore(); heading = previous; }
    }
    // Shnyr has a separate campaign sprite path with the same visual timing as the family.
    const dead = actor.st === 'die';
    let fr = dead ? naDieFr(actor.dt || 0) : actor.st === 'atk' ? naAtkFr(actor.atkT,0.6)
      : actor.st === 'chase' ? 'w'+((Game.time*16.5+actor.id)%NA_N|0) : naIdleFr(Game.time,actor.id);
    if (!dead && Game.time-(actor.hurtT??-9)<0.3) fr = naHurtFr(Game.time-actor.hurtT);
    const sprite = art.request(kind,fr,direction);
    if (!sprite) return originalCamp(c,actor,kind);
    c.save();
    try {
      if (outerActor === actor && dead) {
        const time = actor.dt || 0;
        c.translate(0,-Math.min(6,time*12));
        c.rotate(-Math.min(1.45,time*4));
      }
      if (sprite.mirror !== (outerActor === actor && actor.face < 0)) c.scale(-1,1);
      blitFine(c,sprite.cv,-sprite.ax,-sprite.ay);
    } finally { c.restore(); }
  };

  function lairState(lair) {
    return Game.neutrals.some(actor=>actor.lair===lair.id&&actor.st!=='die')
      ? String(Math.floor(Game.time*1.8+lair.id)%2) : 'd';
  }
  function sizeOf(lair) { return sizes.includes(lair.size) ? lair.size : sizes[(lair.x + lair.y) % sizes.length]; }
  function campSprite(size,state) { return frames.get(size+'|'+state); }
  function drawCamp(c,lair,sprite) {
    const x=Math.round(lair.x*TILE+16),y=Math.round(lair.y*TILE+22);
    blitFine(c,sprite.cv,x-sprite.ax,y-sprite.ay);
  }
  function drawApproach(c,lair,size) {
    const approach=approaches.get(size);
    const roadY=lair.y+2;
    if (!approach || !isRoadAt(lair.x,roadY)) return;
    const x=Math.round(lair.x*TILE+16);
    const y=Math.round(lair.y*TILE+22)+approach.start;
    const end=roadY*TILE+TILE/2-3;
    if(end<=y)return;
    c.save();
    c.imageSmoothingEnabled=false;
    c.drawImage(approach.cv,x+approach.center-7,y,14,end-y);
    c.restore();
  }
  naLairSprite = function(kind,state='0') {
    return kind==='goblin' && campSprite(6,state) || originalLairSprite(kind,state);
  };
  neuDrawLair = function(c,lair) {
    if (lair.k !== 'goblin') return originalLair(c,lair);
    const size=sizeOf(lair), sprite=campSprite(size,lairState(lair));
    if (!sprite) return originalLair(c,lair);
    drawApproach(c,lair,size);
    drawCamp(c,lair,sprite);
  };
  neuDrawList = function(list,c,x0,y0,x1,y1) {
    originalLairList(list,c,x0,y0,x1,y1);
    for (const lair of Game.lairs || []) {
      if(lair.k!=='goblin'||sizeOf(lair)!==8||lair.x<x0-3||lair.x>x1+3||lair.y<y0-3||lair.y>y1+4)continue;
      const sprite=foreground.get(lairState(lair));
      if(sprite)list.push([lair.y+0.42,()=>drawCamp(c,lair,sprite)]);
    }
  };
  async function load(size,state) {
    const image=new Image();
    image.src=new URL('goblin-camp-'+size+'-'+state+'.png',root).href;
    await image.decode();
    if(image.width!==288||image.height!==286)throw Error('Camp dimensions '+size+'/'+state);
    const cv=mkCanvas(288,286);cv.fine=2;cv.goblinCamp=size;cv.goblinCampState=state;
    cv.getContext('2d').drawImage(image,0,0);
    const sprite={cv,w:144,h:143,ax:72,ay:118};
    frames.set(size+'|'+state,sprite);
    if (state==='0') {
      const {data}=cv.getContext('2d').getImageData(0,0,288,286);
      let foot=286,left=288,right=0;
      for(let y=285;y>=0&&right===0;y--){
        for(let x=116;x<=167;x++){
          if(!data[(y*288+x)*4+3])continue;
          left=Math.min(left,x);right=Math.max(right,x+1);foot=y+1;
        }
      }
      if(!right)throw Error('Camp has no south approach '+size);
      const center=(left+right)/2;
      const strip=mkCanvas(28,40), sc=strip.getContext('2d');
      strip.goblinApproach=size;
      for(let y=0;y<40;y++){
        const half=Math.min(12,4+Math.floor(y/4));
        for(let x=-half;x<=half;x++){
          const p=((foot-7)*288+Math.round(center+x*.32))*4;
          const shade=1-Math.abs(x)/(half+1)*.22;
          sc.fillStyle='rgb('+[0,1,2].map(k=>Math.round(data[p+k]*shade)).join(',')+')';
          sc.fillRect(x+14,y,1,1);
        }
      }
      approaches.set(size,{cv:strip,start:foot/2-121,center:center/2-72});
    }
    if(size!==8)return;
    const gate=mkCanvas(288,286);gate.fine=2;gate.goblinGate=state;
    const c=gate.getContext('2d');
    c.beginPath();
    c.moveTo(102,165);c.lineTo(160,165);c.lineTo(166,209);
    c.lineTo(151,217);c.lineTo(146,195);c.lineTo(129,195);
    c.lineTo(124,217);c.lineTo(102,208);c.closePath();c.clip();
    c.drawImage(image,0,0);
    foreground.set(state,{...sprite,cv:gate});
  }
  const ready=Promise.all([...sizes.flatMap(size=>states.map(state=>load(size,state))),
    ...[...kinds].map(kind=>art.prepareAll(kind))]).then(results=>{
      if(results.some(result=>Array.isArray(result)&&result.some(ok=>!ok)))throw Error('Goblin atlas load failed');
      return true;
    }).catch(error=>{errors.push(error.message);return false});
  window.OldGoldGoblinRuntime = {ready,errors,campSprite,shnyrSceneFrame:fr=>art.request('shnyrKing',fr,'E')};
})();
