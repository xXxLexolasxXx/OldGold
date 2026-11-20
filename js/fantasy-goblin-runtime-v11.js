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
  let heading, drawingActor, outerActor;
  // Authored E/a6 weapon endpoints and ink geometry from roster-v4/artwork-index.json.
  const profileContacts = {
    goblin: [80,66,31,47,50,51,28,48],
    goblinB: [89,71,24,53,66,45,28,48],
  };
  const attackPlacements = new WeakMap();
  const throws = new WeakMap();
  function attackHeading(actor,live) {
    const record=actor.k==='shnyr'?throws.get(actor):attackPlacements.get(actor),t=actor.atkT||0;
    return record&&actor.st==='atk'&&t>.12&&t>=record.time&&t<.56&&Game.time-record.seen<=.56?record.direction:live;
  }
  const strikeFrames = new Map();
  function compositeLimb(sprite,source,idle,erase,crop,origin,anchor,theta,behind) {
    const path=(c,points)=>{c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();};
    const body=mkCanvas(sprite.cv.width,sprite.cv.height),b=body.getContext('2d');
    b.imageSmoothingEnabled=false;b.drawImage(sprite.cv,0,0);b.save();path(b,erase);b.clip();
    b.clearRect(0,0,body.width,body.height);b.drawImage(idle.cv,0,0);b.restore();
    const arm=mkCanvas(source.cv.width,source.cv.height),a=arm.getContext('2d');
    a.imageSmoothingEnabled=false;path(a,crop);a.clip();a.drawImage(source.cv,0,0);
    const cv=mkCanvas(body.width,body.height),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    const draw=()=>{c.save();c.translate(...anchor);c.rotate(theta);c.translate(-origin[0],-origin[1]);c.drawImage(arm,0,0);c.restore();};
    if(behind)draw();c.drawImage(body,0,0);if(!behind)draw();
    const pixels=c.getImageData(0,0,cv.width,cv.height);for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=128?255:0;c.putImageData(pixels,0,0);
    cv.fine=2;cv.rosterArtwork=true;return cv;
  }
  function profilePoint(kind,point) {
    const [, ,x,y,w,h,ax,ay]=profileContacts[kind],pose=naPose('a6');
    const shift=Math.round((pose.x||0)*2*(NA_SPEC[kind]?.sc||1)),lift=Math.round((pose.y||0)*2*(NA_SPEC[kind]?.sc||1));
    return[(point[0]+Math.round(shift*(y+h-point[1]-1)/(h-1)))/2-ax,
      (y+lift+Math.round((point[1]-y)*(h-lift-1)/(h-1)))/2-ay];
  }
  function directedStrike(kind,sprite,direction) {
    if(!sprite||!profileContacts[kind])return sprite;
    const view={SW:'SE',W:'E',NW:'NE'}[direction]||direction,key=kind+'|'+view;
    if(strikeFrames.has(key))return{...strikeFrames.get(key),mirror:sprite.mirror};
    const spear=kind==='goblinB',grip=profilePoint(kind,spear?[65,70]:[69,66]),tip=profilePoint(kind,spear?[89,71]:[80,66]);
    if(view==='E'){const result={...sprite,weapon:{grip,tip}};strikeFrames.set(key,result);return result;}
    const source=art.frame(kind,'a6','E');let idle=art.frame(kind,'i0',view);
    if(!source||!idle)return sprite;
    if(view==='N'){
      const repair=mkCanvas(idle.cv.width,idle.cv.height),r=repair.getContext('2d');
      r.imageSmoothingEnabled=false;r.translate(idle.ax*4,0);r.scale(-1,1);r.drawImage(idle.cv,0,0);idle={cv:repair};
    }
    const origin=spear?[66,68]:[66,65];
    const crop=spear?[[64,65],[72,65],[103,64],[103,78],[64,79]]:[[64,63],[70,63],[94,62],[94,73],[64,75]];
    const erase=view==='S'?(spear?[[54,59],[65,58],[67,96],[55,97]]:[[54,59],[67,59],[68,78],[54,78]])
      :view==='N'?[[55,62],[90,62],[90,79],[55,79]]
      :spear?[[63,64],[105,64],[105,80],[63,80]]:[[64,62],[100,62],[100,76],[64,76]];
    const anchor=view==='S'?(spear?[67,64]:[66,63]):view==='N'?[70,64]:spear?[62,67]:[62,61];
    const theta=spear?{S:1.47,SE:.67,NE:-.89,N:-1.23}[view]:{S:1.66,SE:.74,NE:-.83,N:-1.28}[view];
    const cv=compositeLimb(sprite,source,idle,erase,crop,origin,anchor,theta,view==='N'||view==='NE');
    const point=p=>{const x=(p[0]+source.ax)*2-origin[0],y=(p[1]+source.ay)*2-origin[1];return[
      (anchor[0]+Math.cos(theta)*x-Math.sin(theta)*y)/2-sprite.ax,
      (anchor[1]+Math.sin(theta)*x+Math.cos(theta)*y)/2-sprite.ay];};
    const result={...sprite,cv,weapon:{grip:point(grip),tip:point(tip)}};strikeFrames.set(key,result);return result;
  }
  const releaseFrames = new Map();
  function shnyrGrip() {
    const pose=naPose('a6'),factor=2*(NA_SPEC.shnyrKing.sc||1),shift=Math.round(pose.x*factor),lift=Math.round(pose.y*factor);
    return[(121+Math.round(shift*(162-95-1)/109))/2-46,
      (52+lift+Math.round((95-52)*(110-lift-1)/109))/2-80];
  }
  function directedRelease(sprite,direction) {
    if(!sprite)return null;
    const view={SW:'SE',W:'E',NW:'NE'}[direction]||direction;
    if(view!=='S'&&view!=='N')return{...sprite,release:view==='E'?shnyrGrip():view==='SE'?[23,-33]:[23,-33]};
    if(releaseFrames.has(view))return{...releaseFrames.get(view),mirror:sprite.mirror};
    const source=art.frame('shnyrKing','a6','E');let idle=art.frame('shnyrKing','i0',view);
    if(!source||!idle)return sprite;
    if(view==='S'){
      // The front idle holds a second bomb. Repair from the clean resting left
      // shoulder instead, so its raised hand cannot leak into this release pose.
      const repair=mkCanvas(sprite.cv.width,sprite.cv.height),r=repair.getContext('2d');
      r.imageSmoothingEnabled=false;r.translate(sprite.ax*4,0);r.scale(-1,1);r.drawImage(sprite.cv,0,0);idle={cv:repair};
    }
    const crop=[[112,105],[119,94],[138,88],[143,88],[143,100],[130,108],[116,116]];
    const erase=view==='S'?[[112,80],[152,80],[152,120],[112,120]]
      :[[116,100],[130,91],[155,87],[159,96],[137,111],[119,117]];
    const origin=[116,105],anchor=view==='S'?[114,108]:[119,108];
    const theta=view==='S'?2.249:-.602;
    const path=(c,points)=>{c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();};
    const body=mkCanvas(sprite.cv.width,sprite.cv.height),b=body.getContext('2d');
    b.imageSmoothingEnabled=false;b.drawImage(sprite.cv,0,0);b.save();path(b,erase);b.clip();
    b.clearRect(0,0,body.width,body.height);b.drawImage(idle.cv,0,0);b.restore();
    const arm=mkCanvas(source.cv.width,source.cv.height),a=arm.getContext('2d');
    a.imageSmoothingEnabled=false;path(a,crop);a.clip();a.drawImage(source.cv,0,0);
    const cv=mkCanvas(body.width,body.height),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    const drawArm=()=>{c.save();c.translate(...anchor);c.rotate(theta);c.translate(-origin[0],-origin[1]);c.drawImage(arm,0,0);c.restore();};
    if(view==='N')drawArm();c.drawImage(body,0,0);if(view==='S')drawArm();
    const pixels=c.getImageData(0,0,cv.width,cv.height);for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=128?255:0;c.putImageData(pixels,0,0);
    cv.fine=2;cv.rosterArtwork=true;
    const old=shnyrGrip(),px=(old[0]+source.ax)*2-origin[0],py=(old[1]+source.ay)*2-origin[1];
    const release=[(anchor[0]+Math.cos(theta)*px-Math.sin(theta)*py)/2-sprite.ax,
      (anchor[1]+Math.sin(theta)*px+Math.cos(theta)*py)/2-sprite.ay];
    const result={...sprite,cv,release};releaseFrames.set(view,result);return result;
  }
  let bomb;
  function shnyrProjectile(actor) {
    const t=actor.atkT || 0;
    if(actor.k!=='shnyr'||actor.st!=='atk'||t>=.30){throws.delete(actor);return null;}
    const target=neuUnit(actor.tg);
    if(!target||neuUnitOut(target))return null;
    let flight=throws.get(actor);
    if(flight&&(t<flight.time||Game.time-flight.seen>.56))flight=null;
    const direction=attackHeading(actor,family.headingOf(actor)),view={SW:'SE',W:'E',NW:'NE'}[direction]||direction;
    if(!flight||t<=.12){
      const endpoint={S:[17,-32],SE:[30,-36],E:[28,-37],NE:[30,-35],N:[30,-33]}[view];
      const exact=directedRelease(art.frame('shnyrKing','a6',direction),direction)?.release;
      const release=exact||endpoint;
      flight={start:[actor.x*TILE+release[0]*(west.has(direction)?-1:1),actor.y*TILE+6+release[1]],
        end:[target.x*TILE,target.y*TILE+6-17],direction,time:t,seen:Game.time};
      throws.set(actor,flight);
    }
    flight.time=t;flight.seen=Game.time;
    // Normal movement can lead the short toss until impact. Once the target
    // escapes the native hit tolerance, the bomb finishes its missed trajectory.
    if(!flight.missed&&!flight.landed){
      if(Math.hypot(target.x-actor.x,target.y-actor.y)>FSPEC.shnyr.rng+.8)flight.missed=true;
      else flight.end=[target.x*TILE,target.y*TILE+6-17];
    }
    if(t>=.24)flight.landed=true;
    if(t<.12)return null;
    const u=Math.min(1,(t-.12)/.12),start=flight.start,end=flight.end;
    return{x:Math.round((start[0]+(end[0]-start[0])*u)*2)/2,
      y:Math.round((start[1]+(end[1]-start[1])*u-Math.sin(u*Math.PI)*7)*2)/2,
      u,alpha:t<=.24?1:Math.max(0,1-(t-.24)/.06),release:start.slice(),landing:end.slice(),missed:!!flight.missed};
  }
  function drawBomb(c,point){
    if(!point)return;
    if(!bomb){
      bomb=mkCanvas(16,18);const b=bomb.getContext('2d');
      for(const [color,x,y,w,h] of [
        ['#211e25',4,6,8,10],['#211e25',2,8,12,6],['#41434d',4,7,8,8],
        ['#595b64',4,8,3,4],['#86808a',5,8,2,2],['#29272f',9,10,3,5],
        ['#b48743',3,12,10,2],['#dfbc6b',4,12,3,1],['#8a6338',8,4,2,3],
        ['#d9b06b',9,2,2,3],['#fff2a0',10,1,2,2],['#e88c3a',12,2,1,1],
      ]){b.fillStyle=color;b.fillRect(x,y,w,h);}
    }
    c.save();c.globalAlpha*=point.alpha;c.imageSmoothingEnabled=false;c.drawImage(bomb,point.x-4,point.y-4.5,8,9);c.restore();
  }
  function strikePlacement(kind, actor, direction, scale, campaign) {
    // Move the complete rig, retaining the authored grip and weapon length.
    // The directional limb layers retain their own authored contact geometry.
    if (!actor || (!profileContacts[kind] && kind !== 'goblinChamp')) return null;
    const t = actor.atkT || 0;
    if (actor.st !== 'atk' || t >= .56) { attackPlacements.delete(actor); return null; }
    const spec = campaign ? FSPEC[actor.k] : NSPEC[actor.k];
    if (!spec) return null;
    let committed = attackPlacements.get(actor);
    if (committed && (t < committed.time || Game.time-committed.seen > .56)) {
      attackPlacements.delete(actor); committed = null;
    }
    if (!committed || t <= .12) {
      const target = neuUnit(actor.tg);
      if (!target || neuUnitOut(target)) return null;
      const dx = (target.x-actor.x)*TILE, dy = (target.y-actor.y)*TILE;
      // Commit the visual swing before impact. A departing target causes a miss,
      // rather than dragging the attacker after it or snapping the rig home.
      const distance = Math.hypot(dx,dy), cap = Math.min(1,spec.rng*TILE/Math.max(.001,distance));
      committed = {dx:dx*cap,dy:dy*cap,direction,time:t,seen:Game.time};
      attackPlacements.set(actor,committed);
    }
    if(t>.12&&!committed.impact&&!committed.missed){
      const target=neuUnit(actor.tg),dx=target?(target.x-actor.x)*TILE:Infinity,dy=target?(target.y-actor.y)*TILE:Infinity;
      if(!target||neuUnitOut(target)||Math.hypot(dx,dy)>(spec.rng+.8)*TILE)committed.missed=true;
      else{
        // Follow ordinary in-range movement until the strike attempt, with a
        // finite speed bound. A teleport or escaping target cannot snap the rig.
        const x=dx-committed.dx,y=dy-committed.dy,distance=Math.hypot(x,y),budget=Math.max(0,t-committed.time)*160;
        const follow=distance?Math.min(1,budget/distance):0;
        committed.dx+=x*follow;committed.dy+=y*follow;
      }
      if(actor.hit||t>=.24)committed.impact=true;
    }
    committed.time = t;
    committed.seen = Game.time;
    const {dx,dy} = committed;
    const smooth = v => { v = Math.max(0,Math.min(1,v)); return v*v*(3-2*v); };
    const amount = smooth((t-.12)/.12) * (1-smooth((t-.32)/.2));
    if (!amount) return null;
    {
      const weapon = kind==='goblinChamp'?GoblinChampionDirections.frame(kind,'a6',direction).weapon
        :directedStrike(kind,art.frame(kind,'a6',direction),direction)?.weapon;
      if (!weapon) return null;
      const sign = west.has(direction) ? -1 : 1;
      const A=[weapon.grip[0]*sign*scale,weapon.grip[1]*scale],B=[weapon.tip[0]*sign*scale,weapon.tip[1]*scale];
      const vx=B[0]-A[0],vy=B[1]-A[1],tx=dx,ty=dy-17;
      const along=Math.max(0,Math.min(1,((tx-A[0])*vx+(ty-A[1])*vy)/(vx*vx+vy*vy)));
      const ox=tx-A[0]-vx*along,oy=ty-A[1]-vy*along,distance=Math.hypot(ox,oy);
      const move=distance>5?(1-5/distance)*amount:0;
      return{x:Math.round(ox*move*2)/2,y:Math.round(oy*move*2)/2};
    }
  }

  function enabled(kind) { return kinds.has(kind) && window.GoblinPolish?.enabled !== false; }
  function contactFrame(actor, fr) {
    // The simulation strikes before the authored contact cell in both attack timelines.
    return actor?.st === 'atk' && actor.hit && (fr === 'a4' || fr === 'a5') ? 'a6' : fr;
  }
  naFrame = function(kind,fr) {
    if (enabled(kind)) {
      const phase=contactFrame(drawingActor,fr),sprite = art.request(kind,phase,heading || 'E');
      if (sprite) return phase==='a6'?directedStrike(kind,sprite,heading||'E'):sprite;
    }
    return originalFrame(kind,fr);
  };
  neuDraw = function(c,actor) {
    if (!enabled(actor.k)) return originalNeutral(c,actor);
    const previous = heading, previousActor = drawingActor;
    heading = attackHeading(actor,family.headingOf(actor));
    drawingActor = actor;
    const scale = typeof n2Sz === 'function' ? n2Sz(actor) : 1;
    const kind = actor.k === 'goblin' && actor.id%2 ? 'goblinB' : actor.k;
    const placement = strikePlacement(kind,actor,heading,scale,false);
    c.save();
    try {
      if (placement) c.translate(placement.x,placement.y);
      if(west.has(heading)!==(actor.face<0)){c.translate(Math.round(actor.x*TILE)*2,0);c.scale(-1,1);}
      return originalNeutral(c,actor);
    }
    finally { c.restore(); heading = previous; drawingActor = previousActor; }
  };
  foeDrawRaider = function(c,actor) {
    const previous = outerActor;
    outerActor = actor;
    const kind = actor.k === 'goblin' && actor.id%2 ? 'goblinB' : actor.k;
    const contactKind = actor.k === 'champDuel' ? 'goblinChamp' : kind;
    const supported = enabled(kind) || contactKind === 'goblinChamp';
    const direction = supported ? attackHeading(actor,family.headingOf(actor)) : null;
    const placement = supported ? strikePlacement(contactKind,actor,direction,contactKind==='goblinChamp'?1:1.1,true) : null;
    const projectile=actor.k==='shnyr'&&enabled('shnyrKing')?shnyrProjectile(actor):null;
    if (placement) c.save();
    try {
      if (placement) c.translate(placement.x,placement.y);
      const behind=projectile&&projectile.y<actor.y*TILE-4;
      if(behind)drawBomb(c,projectile);
      const result=originalRaider(c,actor);
      if(!behind)drawBomb(c,projectile);
      return result;
    }
    finally { if (placement) c.restore(); outerActor = previous; }
  };
  campDrawGoblin = function(c,actor,explicitKind) {
    const kind = explicitKind || (actor.k === 'goblinChamp' ? 'goblinChamp' : actor.id%2 ? 'goblinB' : 'goblin');
    if(kind==='goblinChamp'){
      const direction=attackHeading(actor,family.headingOf(actor));
      c.save();try{
        if(west.has(direction)!==(outerActor===actor&&actor.face<0))c.scale(-1,1);
        const placement=outerActor===actor?null:strikePlacement(kind,actor,direction,1,true);
        if(placement)c.translate(placement.x*(west.has(direction)?-1:1),placement.y);
        return originalCamp(c,actor,explicitKind);
      }finally{c.restore();}
    }
    if (!enabled(kind)) return originalCamp(c,actor,explicitKind);
    const direction = attackHeading(actor,family.headingOf(actor));
    // The family renderer already selects animation frames and cancels the generic fall transform.
    if (kind !== 'shnyrKing') {
      const previous = heading, previousActor = drawingActor;
      heading = direction;
      drawingActor = actor;
      c.save();
      try {
        if (west.has(direction) !== (outerActor === actor && actor.face < 0)) c.scale(-1,1);
        const placement = outerActor === actor ? null : strikePlacement(kind,actor,direction,1.1,true);
        if (placement) c.translate(placement.x*(west.has(direction)?-1:1),placement.y);
        return originalCamp(c,actor,kind);
      } finally { c.restore(); heading = previous; drawingActor = previousActor; }
    }
    // Shnyr has a separate campaign sprite path with the same visual timing as the family.
    const dead = actor.st === 'die';
    let fr = dead ? naDieFr(actor.dt || 0) : actor.st === 'atk' ? naAtkFr(actor.atkT,0.6)
      : actor.st === 'chase' ? 'w'+((Game.time*16.5+actor.id)%NA_N|0) : naIdleFr(Game.time,actor.id);
    if (!dead && Game.time-(actor.hurtT??-9)<0.3) fr = naHurtFr(Game.time-actor.hurtT);
    // The held bomb has left the hand before its .24 s native melee impact.
    if(actor.st==='atk'&&actor.atkT>=.12&&actor.atkT<.32)fr='a6';
    let sprite = art.request(kind,contactFrame(actor,fr),direction);
    if (!sprite) return originalCamp(c,actor,kind);
    if(fr==='a6')sprite=directedRelease(sprite,direction);
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
      for(const direction of ['S','N'])directedRelease(art.frame('shnyrKing','a6',direction),direction);
      for(const kind of ['goblin','goblinB'])for(const direction of ['S','SE','E','NE','N'])directedStrike(kind,art.frame(kind,'a6',direction),direction);
      return true;
    }).catch(error=>{errors.push(error.message);return false});
  window.OldGoldGoblinRuntime = {ready,errors,campSprite,shnyrProjectile,attackHeading,
    strikeFrame:(kind,direction)=>directedStrike(kind,art.frame(kind,'a6',direction),direction),
    shnyrReleaseFrame:direction=>directedRelease(art.frame('shnyrKing','a6',direction),direction),
    shnyrSceneFrame:fr=>art.request('shnyrKing',fr,'E')};
})();
