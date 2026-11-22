'use strict';
(() => {
  const root = new URL('.', document.currentScript.src);
  const views = ['S', 'SE', 'E', 'NE', 'N'];
  const headings = [...views, 'NW', 'W', 'SW'];
  const mirrors = { NW: 'NE', W: 'E', SW: 'SE' };
  const images = new Map(), cache = new Map(), positions = new WeakMap();
  const errors = [];
  const limit = 64;
  const before = { prince: kpSprite, draw: kpDraw, mound: raidDrawMound };
  let active, ready = false;
  function surface(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.fine = 2;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    return c;
  }
  function bounded(key, make) {
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key); cache.set(key, value);
      return value;
    }
    const value = make();
    cache.set(key, value);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return value;
  }
  function harden(c) {
    const image = c.getImageData(0, 0, c.canvas.width, c.canvas.height);
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= 128 ? 255 : 0;
    c.putImageData(image, 0, 0);
  }
  function polygon(c, points, color) {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x,y], i) => c[i ? 'lineTo' : 'moveTo'](Math.round(x * 2) / 2, Math.round(y * 2) / 2));
    c.closePath(); c.fill();
  }
  function line(c, x, y, xx, yy, w, color) {
    c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x,y); c.lineTo(xx,yy); c.stroke();
  }
  const pad = { left: 54, top: 48, right: 54, bottom: 40 };
  function prince(frame = 'i0', phase = 1, direction = 'S', face = 1, target) {
    if (!ready) return null;
    const view = mirrors[direction] || direction;
    const index = views.indexOf(view);
    if (index < 0) return null;
    phase = Math.max(1, Math.min(3, Math.round(phase)));
    const flip = Boolean(mirrors[direction]) !== (face < 0);
    const strikeWeight = ({a4:.18,a5:1,a6:.95,a7:.55,a8:.18})[frame] || 0;
    const crouchWeight = ({a2:.10,a3:.32,a4:.70,a5:1,a6:.95,a7:.68,a8:.38,a9:.12})[frame] || 0;
    let targetX = 0, targetY = 0;
    if (crouchWeight) {
      const angle = headings.indexOf(direction) * Math.PI / 4;
      targetX = Math.round((target?.x ?? Math.sin(angle)*70) / 4)*4*face;
      targetY = Math.round((target?.y ?? Math.cos(angle)*70) / 4)*4-17;
    }
    return bounded(['prince',frame,phase,view,flip,targetX,targetY].join('|'), () => {
      // A downhill strike can reach below the existing 48-unit sprite margin.
      // Widen only this pose's lower crop; preserve the native feet and scale.
      const framePad = targetY>40 ? {...pad,bottom:80} : pad;
      const c = surface((KP.W + framePad.left + framePad.right) * 2, (KP.H + framePad.top + framePad.bottom) * 2);
      const P = kpParams(frame === 'a5' ? 'strike' : frame), rear = view === 'N' || view === 'NE';
      const span = { S:1, SE:.86, E:.58, NE:.82, N:1 }[view];
      const atlas = images.get('prince-atlas.png');
      const axis = flip ? -1 : 1;
      // Sample the same painted row for the cloak and its attached details.
      function rowOffset(y) {
        const upper=Math.max(0,Math.min(1,-y/100)),head=y < -88 ? 1 : 0;
        return [Math.round((P.lean*.45*upper+P.hdx*head+P.sway*.5*(1-upper))*2)/2,
          Math.round((P.bob*upper+P.hdy*head)*2)/2];
      }
      function shoulderAt(sign) {
        const [dx,dy]=rowOffset(-81);
        return [sign*15*span+(view==='E'?5:0)+dx,-81+dy];
      }
      let bladeScale = 1;
      if (crouchWeight) {
        // Project the blade toward the target from the near shoulder. Foreshorten
        // it when the target lies behind the prince in screen space.
        const sx = shoulderAt(1)[0]*axis;
        // A tall prince lowers his upper body for downhill attacks. His feet
        // stay planted and the shoulder travels with the cloak and skull.
        if (targetY>0) {
          const uprightDistance=Math.hypot(targetX-P.adv-sx,targetY-P.sink*.45-shoulderAt(1)[1]);
          P.bob+=Math.min(24,Math.max(0,uprightDistance-115))/.81*crouchWeight;
        }
        const sy = shoulderAt(1)[1];
        const dx = targetX-P.adv-sx, dy = targetY-P.sink*.45-sy;
        const distance = Math.max(.5, Math.hypot(dx,dy));
        const reach = Math.min(57, distance*.40);
        P.hand = [P.hand[0]+(sx+dx/distance*reach-P.hand[0])*strikeWeight,
          P.hand[1]+(sy+dy/distance*reach-P.hand[1])*strikeWeight];
        const angle = Math.atan2(dy,dx);
        P.ang += Math.atan2(Math.sin(angle-P.ang),Math.cos(angle-P.ang))*strikeWeight;
        bladeScale += (Math.min(1.03,Math.max(.2,(distance-reach)/70))-1)*strikeWeight;
      }
      c.setTransform(axis * 2, 0, 0, 2, (KP.AX + framePad.left) * 2, (KP.AY + framePad.top) * 2);
      c.translate(P.adv * axis, P.sink * .45);
      function arm(near) {
        const sign = near ? 1 : -1;
        const shoulder = shoulderAt(sign);
        const hand = near ? [(P.hand[0]-Math.cos(P.ang)*6)*axis, P.hand[1]-Math.sin(P.ang)*6] :
          [P.bhand[0] * axis, P.bhand[1]];
        const elbow = [(shoulder[0] + hand[0]) / 2 + sign * 3, (shoulder[1] + hand[1]) / 2 + 5];
        line(c,...shoulder,...elbow,5.6,'#29262c');
        line(c,...elbow,...hand,4.2,'#29262c');
        line(c,...shoulder,...elbow,4.3,near ? '#8a806b' : '#554d48');
        line(c,shoulder[0]-1,shoulder[1],elbow[0]-1,elbow[1],.8,'#c7ac78');
        line(c,...elbow,...hand,2.7,near ? '#ccb58c' : '#8b785e');
        line(c,elbow[0]-.7,elbow[1],hand[0]-.7,hand[1],.65,'#efdab0');
        for(const t of [.25,.53,.8]){
          const x=shoulder[0]*(1-t)+elbow[0]*t,y=shoulder[1]*(1-t)+elbow[1]*t;
          line(c,x-1.6,y-.5,x+1.3,y+.6,.7,'#594d3b');
          line(c,x-1.4,y-.9,x+.7,y-.1,.6,'#d2b579');
        }
        c.fillStyle='#4a443c';c.beginPath();c.ellipse(elbow[0],elbow[1],2.4,2.1,0,0,7);c.fill();
        c.fillStyle='#ad9670';c.fillRect(elbow[0]-1,elbow[1]-1,1.5,1);
        polygon(c,[[hand[0]-2,hand[1]-2],[hand[0]+1,hand[1]-2],[hand[0]+2,hand[1]+1],
          [hand[0]+1,hand[1]+2],[hand[0]-2,hand[1]+1]],'#ddc79c');
        for (let i=0;i<3;i++){
          const x=hand[0]-1.6+i*1.15,y=hand[1]+1;
          line(c,x,y,x+.6,y+(near?1.3:2.5),1.1,'#342a25');
          line(c,x,y,x+.6,y+(near?1.1:2.2),.65,'#dcc39a');
          c.fillStyle='#efdab0';c.fillRect(x,y,.7,.7);
        }
        line(c,hand[0]-1,hand[1],hand[0]-2.5,hand[1]+1.5,1.1,'#b7a081');
      }
      arm(false);
      if (view === 'N') arm(true);
      // Authored skull, cloak and leg planes share one fixed world scale.
      // Row displacements follow the existing native pose parameters.
      for (let y=0;y<240;y++) {
        const worldY = y / 2 - 117;
        const [x,bob] = rowOffset(worldY);
        if(worldY>=-17&&P.mv){
          for(const sign of [-1,1]){
            const leg=sign*P.sw,shift=Math.round(leg*4)/2,lift=Math.round(Math.max(0,-leg)*5)/2;
            const sx=sign<0?0:90;
            c.drawImage(atlas,index*180+sx,(phase-1)*240+y,90,1,-45+sx/2+x+shift,worldY-lift,45,.5);
          }
        }else c.drawImage(atlas,index*180,(phase-1)*240+y,180,1,-45+x,worldY+bob,90,.5);
      }
      if(!rear){
        const ex={S:[-3,3],SE:[1,5],E:[5]}[view];
        c.fillStyle=['#7fb9c5','#b1cc86','#e7a06b'][phase-1];
        const [eyeX,eyeY]=rowOffset(-99);
        for(const x of ex)c.fillRect(x+eyeX,-99+eyeY,1,1);
        if(phase>1){
          const color=phase===2?'#789876':'#c18460';
          const seam=[[-1,-80],[1,-77],[-1,-73],[2,-69],[0,-67],[-2,-73]];
          polygon(c,seam.map(([x,y])=>{const [dx,dy]=rowOffset(y);return [x+dx,y+dy];}),color);
        }
      }
      if (!rear && view !== 'E') arm(false);
      if (view !== 'N') arm(true);
      c.save(); c.translate(P.hand[0]*axis,P.hand[1]); c.scale(axis,1); c.rotate(P.ang);
      c.save(); c.scale(bladeScale,1);
      polygon(c,[[0,-3],[6,-5],[48,-4],[70,-2.7],[51,2.5],[6,5],[0,3]],'#3c667a');
      polygon(c,[[1,-2],[7,-4],[47,-3.2],[68,-2.5],[48,0],[1,0]],'#c9dde0');
      polygon(c,[[1,0],[48,0],[68,-2.5],[49,2],[7,4],[1,2]],'#719aab');
      line(c,9,-3.2,48,-2.6,.6,'#f1ecda');
      c.restore();
      polygon(c,[[-2,-8],[0,-8],[1,-2],[1,2],[0,8],[-2,8],[-1,2],[-1,-2]],'#655c48');
      line(c,-1.3,-7,-.2,7,.7,'#cfb57b');
      line(c,-11,0,-2,0,3,'#564438');
      line(c,-11,-.8,-2,-.8,.7,'#bda074');
      c.fillStyle = '#c6b487'; c.fillRect(-15,-2,4,4);
      for (let i=0;i<3;i++) line(c,-7+i*1.1,-1.4,-7+i*1.1,1.2,.75,'#e4cfaa');
      c.scale(bladeScale,1);
      for(const x of [14,24,34]){
        line(c,x,-1.8,x+2,-.2,.5,'#7199a6');
        line(c,x+2,-.2,x+.5,1.2,.5,'#b6d3d8');
      }
      c.restore();
      if (P.flash) {
        c.save(); c.setTransform(1,0,0,1,0,0); c.globalCompositeOperation='source-atop';
        c.fillStyle='rgba(255,234,194,.25)'; c.fillRect(0,0,c.canvas.width,c.canvas.height); c.restore();
      }
      c.setTransform(1,0,0,1,0,0); harden(c); c.canvas.barrowPad=framePad;
      return {cv:c.canvas};
    });
  }
  function stone(style='A',direction='S',phase=0,eye=0) {
    if (!ready || !['A','B','C'].includes(style)) return null;
    const view=mirrors[direction]||direction, col=views.indexOf(view);
    if(col<0)return null;
    phase=Math.max(0,Math.min(7,Math.round(phase))); eye=Math.max(0,Math.min(3,Math.round(eye)));
    return bounded(['stone',style,direction,phase,eye].join('|'),()=>{
      const c=surface(200,200),row=['A','B','C'].indexOf(style),atlas=images.get('gargoyle-atlas.png');
      if(mirrors[direction]){c.translate(200,0);c.scale(-1,1);}
      const root=style==='B'?114:100, sole=style==='A'?136:style==='B'?144:90;
      const splitY=sole-(style==='B'?20:style==='C'?35:38);
      // The dorsal strips pivot at a shared shoulder before the body covers the join.
      const opening=1+phase*.018;
      for(const side of [-1,1]){
        const sourceX=side<0?0:root+6,sourceW=side<0?root-6:200-sourceX;
        c.save(); c.translate(root,splitY); c.scale(opening,1-phase*.007); c.translate(-root,-splitY);
        c.drawImage(atlas,col*200+sourceX,row*200,sourceW,200,sourceX,0,sourceW,200);
        c.restore();
      }
      c.drawImage(atlas,col*200+root-7,row*200,14,200,root-7,0,14,200);
      if(eye && view!=='N'&&view!=='NE'){
        const faceY=style==='B'?sole-24:style==='C'?sole-35:sole-39;
        c.fillStyle=['#504c38','#aa8450','#d8ad62','#f4d891'][eye];
        const xs=view==='E'?[3]:view==='SE'?[0,4]:[-3,3];
        for(const x of xs)c.fillRect(root+x,faceY,1,1);
      }
      c.setTransform(1,0,0,1,0,0); harden(c);
      return {cv:c.canvas,w:100,h:100,ax:50,ay:90,pixelRatio:2};
    });
  }
  function mound(state='day') {
    if(!ready)return null;
    const lit=['omen','fight'].includes(state),cleared=state==='rest';
    return bounded('mound|'+state,()=>{
      const c=surface(264,200),image=images.get('mound-atlas.png');
      c.drawImage(image,cleared?528:lit?264:0,0,264,200,0,0,264,200);
      return {cv:c.canvas,w:132,h:100,ax:66,ay:62};
    });
  }
  kpDraw=function(c,actor){
    if(!ready)return before.draw(c,actor);
    const previous=positions.get(actor),dx=previous?actor.x-previous.x:0,dy=previous?actor.y-previous.y:0;
    const target=actor.tg&&typeof neuUnit==='function'?neuUnit(actor.tg):null;
    const vx=target?target.x-actor.x:dx,vy=target?target.y-actor.y:dy;
    const direction=Math.hypot(vx,vy)>.002?headings[(Math.round(Math.atan2(vx,vy)/(Math.PI/4))+8)%8]:
      previous?.direction||(actor.face<0?'W':'E');
    positions.set(actor,{x:actor.x,y:actor.y,direction});
    const distance=Math.hypot(vx,vy);
    // Match the melee reach used by neuThink. On a whiff the swing ends
    // short of the target, with room for its sprite above the ground point.
    const shortSwing=target && actor.st==='atk' && distance>NSPEC.kurgan.rng+.8;
    const aimScale=shortSwing ? NSPEC.kurgan.rng*.85/distance : 1;
    const prior=active;
    active={direction,face:actor.face||1,target:target&&{x:vx*TILE*aimScale,y:vy*TILE*aimScale}};
    try{return before.draw(c,actor);}finally{active=prior;}
  };
  kpSprite=function(frame,phase){
    return active?prince(frame,phase,active.direction,active.face,active.target)||before.prince(frame,phase):before.prince(frame,phase);
  };
  raidDrawMound=function(c,site){
    const sp=mound(site.st||(site.f?'fight':site.omen?'omen':'day'));
    if(!sp)return before.mound(c,site);
    const x=Math.round(site.site.x*TILE),y=Math.round(site.site.y*TILE+4);
    c.save();c.imageSmoothingEnabled=false;c.drawImage(sp.cv,x-sp.ax,y-sp.ay,sp.w,sp.h);c.restore();
    if(site.omen||site.f){
      c.save();c.translate(x,y);
      for(const [i,[dx,dy]]of [[-35,-6],[-23,13],[25,13],[36,-7]].entries()){
        const h=5+(Math.floor(Game.time*5+i)%3);
        polygon(c,[[dx-2,dy],[dx-3,dy-3],[dx,dy-h],[dx+2,dy-4],[dx+2,dy]],'#457f8d');
        polygon(c,[[dx-1,dy-1],[dx,dy-h+2],[dx+1,dy-2]],'#bddfd7');
      }
      c.restore();
    }
    if(typeof raidDrawSign==='function')raidDrawSign(c,x,y-50,site.st,Game.time);
  };
  const promise=Promise.all(['prince-atlas.png','gargoyle-atlas.png','mound-atlas.png'].map(async name=>{
    try{const im=new Image();im.src=new URL(name,root).href;await im.decode();images.set(name,im);}
    catch(error){errors.push(name+': '+error.message);}
  })).then(()=>ready=errors.length===0);
  globalThis.ForestGargoyleStone={frame:stone};
  globalThis.LeshyElfArt={ready:promise,errors,prince,stone,mound,pad,cacheSize:()=>cache.size,limit};
})();
