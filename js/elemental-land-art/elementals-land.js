'use strict';
// Isolated elemental rigs. Native rendering owns rise, sway, effects and victim layering.
(() => {
  if (!globalThis.FantasyPublishedElementals || typeof document === 'undefined' ||
      !document.currentScript?.src || typeof URL !== 'function' || typeof Image !== 'function') return;
  const previous = entSprite;
  const nativeDraw = drawEnt;
  const treeKinds=['oak','birch','pine','fir'];
  const headings = new WeakMap();
  const cache = new Map();
  const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const views = ['S','SE','E','NE','N'];
  // Pupil centers on the assembled body in world pixels, before mirroring.
  const treePupils = {
    oak: {S:[[36.5,34],[46,34]], SE:[[49,34.5],[57,34.5]], E:[[55,35]]},
    birch: {S:[[36.5,27],[45,27]], SE:[[48,27.5],[56,27.5]], E:[[47.5,27.5]]},
    pine: {S:[[37,29],[45.5,29.5]], SE:[[43,30],[50,30]], E:[[45,31.5]]},
    fir: {S:[[37,35.5],[46,35.5]], SE:[[49,36],[55,36]], E:[[59,36]]},
  };
  const shoulders = {
    S:[[-18,55],[18,55]], SE:[[-17,54],[13,55]], E:[[-6,54],[9,55]],
    NE:[[-13,54],[17,55]], N:[[-18,55],[18,55]],
  };
  const snap = x => Math.round(x * 2) / 2;
  const errors=[];
  const artURL=new URL('.',document.currentScript.src);
  const bodies={};
  const limbsByKind={};
  let eyeShade,loading,loaded=false;
  function prepare(){
    if(loading)return loading;
    const atlas=new Image();
    atlas.src=new URL('land-parts.png',artURL).href;
    const layout=fetch(new URL('land-parts.json',artURL)).then(response=>{
      if(!response.ok)throw Error('Missing elemental asset map');
      return response.json();
    });
    loading=Promise.all([layout,atlas.decode()]).then(([map])=>{
      const valid=part=>part.x>=0&&part.y>=0&&part.w>0&&part.h>0&&
        part.x+part.w<=atlas.width&&part.y+part.h<=atlas.height&&part.baseW>0&&part.baseH>0;
      for(const row of Object.values(map)){
        if(!Array.isArray(row)||row.length!==5||!row.every(valid))throw Error('Malformed elemental atlas');
      }
      if([...treeKinds,'limbs'].some(key=>!map[key]))throw Error('Incomplete elemental atlas');
      const cells=key=>(map[key]||[]).map(part=>({...part,image:atlas}));
      const limbCells=cells('limbs');
      for(const kind of treeKinds){
        bodies[kind]=cells(kind);
        limbsByKind[kind]=limbCells.map(part=>tintPart(part,treeFilters[kind]));
      }
      eyeShade=makeEyeShade();
      loaded=true;
      return true;
    }).catch(error=>{errors.push(error.message);return false;});
    return loading;
  }

  function part(c,p,x,y,w,h){
    c.drawImage(p.image,p.x,p.y,p.w,p.h,snap(x),snap(y),snap(w),snap(h));
  }
  const treeFilters={
    oak:'saturate(.78) brightness(.87)',
    birch:'grayscale(.94) contrast(.72) brightness(1.52)',
    pine:'saturate(.97) brightness(.96)',
    fir:'grayscale(.76) sepia(.18) hue-rotate(17deg) brightness(.77)',
  };
  function tintPart(p,filter){
    const image=document.createElement('canvas');
    image.width=p.w;image.height=p.h;
    const ctx=image.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.filter=filter;
    ctx.drawImage(p.image,p.x,p.y,p.w,p.h,0,0,p.w,p.h);
    return {...p,image,x:0,y:0};
  }
  function makeEyeShade(){
    const mask=document.createElement('canvas');
    mask.width=11;mask.height=7;
    const ctx=mask.getContext('2d'), pixels=ctx.createImageData(11,7);
    for(let row=0;row<7;row++)for(let col=0;col<11;col++){
      const radius=Math.hypot((col-5)/5.5,(row-3)/3.5);
      pixels.data[(row*11+col)*4+3]=255*.8*Math.max(0,1-radius*radius);
    }
    ctx.putImageData(pixels,0,0);
    return mask;
  }
  const gripBark={
    oak:['#614028','#a78051','#c8a572'], birch:['#827e70','#c8c2ad','#e5deca'],
    pine:['#794328','#af7548','#d29a64'], fir:['#545342','#878570','#a6a289'],
  };
  function polygon(c,points,color){
    c.beginPath();c.moveTo(...points[0]);
    for(const point of points.slice(1))c.lineTo(...point);
    c.closePath();c.fillStyle=color;c.fill();
  }
  function treePalm(c,x,y,face,kind) {
    const [shade,bark,edge]=gripBark[kind];
    c.save();c.translate(x,y);c.scale(face,1);
    polygon(c,[[-7,-4],[-3,-6],[2,-5],[6,-2],[6,3],[2,5],[-4,4],[-8,1]],shade);
    polygon(c,[[-7,-3],[-3,-4.5],[1,-3.5],[3,-.5],[-.5,2],[-5,1.5]],bark);
    polygon(c,[[-6,-3],[-3,-4],[.5,-3],[-1,-1.5],[-4,-2]],edge);
    c.restore();
  }
  function treeGrip(c,x,y,face,closed,kind) {
    const [shade,bark,edge]=gripBark[kind];
    c.save();c.translate(x,y);c.scale(face,1);
    for(let digit=0;digit<3;digit++){
      const position=-4+digit*3.1, joint=(digit===1?10:9)-closed;
      const tip=position+.5+closed*.9;
      polygon(c,[[-3,position-.5],[2,position-1],[joint-1,position-.5],
        [joint+1,tip],[joint,tip+2.6],[joint-2,tip+3],[joint-3,position+1.6],[0,position+2.2],[-3,position+1.6]],shade);
      polygon(c,[[-2,position],[2,position-.5],[joint-1.5,position],
        [joint-.5,tip+1],[joint-2,tip+1.7],[joint-4,position+1],[0,position+1.4]],bark);
      c.fillStyle=edge;c.fillRect(1,position-.25,Math.max(1,joint-4.5),.75);
      c.fillRect(joint-1.5,tip+.35,.75,1.15);
    }
    polygon(c,[[-3,3],[-1,1],[2,1.5],[5,4],[4,6],[1,6],[-2,5]],shade);
    polygon(c,[[-2,3],[-.5,2],[2,3],[3,4.5],[.5,4.5]],bark);
    c.restore();
  }

  const rootBark={
    oak:['#4b3020','#795237','#ab8456'], birch:['#575043','#a49a85','#d6c9aa'],
    pine:['#4e3023','#865a3d','#ab7850'], fir:['#38362d','#645d48','#9b8c68'],
  };
  function woodShape(c,a,b,width,tipWidth,far,kind,texture){
    const dx=b[0]-a[0],dy=b[1]-a[1], length=snap(Math.hypot(dx,dy)+5);
    const start=width/2,end=tipWidth/2;
    const color=rootBark[kind];
    const outside=[[-start*.4,-3],[-start,-.5],[-start*.92,length*.23],
      [-end*.8,length*.68],[-end,length-3],[-end*.3,length],[end*.62,length],
      [end,length-3],[end*.83,length*.63],[start*.88,length*.23],[start,-.5],[start*.46,-3]];
    c.save();c.translate(snap(a[0]),snap(a[1]));c.rotate(Math.atan2(dy,dx)-Math.PI/2);
    c.globalAlpha*=far?.78:1;
    polygon(c,outside,color[0]);
    polygon(c,[[-start*.67,-1],[-start*.69,length*.24],[-end*.52,length*.7],
      [-end*.39,length-2],[end*.46,length-2],[end*.5,length*.7],[start*.43,length*.25],[start*.59,0]],color[1]);
    c.save();c.globalAlpha*=.31;
    part(c,texture,-start,-1,width,length-1);
    c.restore();
    c.globalAlpha*=.8;
    polygon(c,[[-start*.55,length*.095],[-start*.28,length*.08],[-end*.23,length*.37],
      [-end*.43,length*.60],[-end*.37,length*.34]],color[2]);
    polygon(c,[[start*.31,length*.3],[start*.46,length*.35],[end*.48,length*.65],
      [end*.28,length*.87],[end*.21,length*.72],[start*.18,length*.48]],color[0]);
    polygon(c,[[-start*.25,length*.13],[start*.13,length*.22],[start*.02,length*.35],
      [-end*.08,length*.5],[-end*.01,length*.72],[end*.19,length*.89],
      [-end*.1,length*.88],[-end*.19,length*.73],[-end*.29,length*.49],
      [-start*.12,length*.32],[-start*.18,length*.24],[-start*.39,length*.16]],color[0]);
    c.restore();
  }

  function rootFoot(c,far,kind){
    const [shade,bark,edge]=rootBark[kind];
    c.save();c.globalAlpha*=far?.72:1;
    polygon(c,[[-7,1],[-5,-2],[-3,-3],[-3,-7],[2,-8],[5,-5],[5,-2],[9,0],
      [11,3],[6,3],[3,2],[.5,4],[-3,3],[-6,4],[-8,3]],shade);
    polygon(c,[[-6,1],[-4,-1],[-2,-2],[-2,-6],[1,-7],[4,-4],[3,-1],
      [7,0],[9,2],[6,2],[3,1],[.5,3],[-2,2],[-5,3]],bark);
    polygon(c,[[-4,0],[-2,-2],[-2,-5],[.5,-6],[1,-3],[-.5,-1],[-1,1],[-4,2]],edge);
    c.restore();
  }
  function frame(view,name,mirror=false,yaw=0,kind='oak') {
    const key = [kind,view,name,mirror,yaw].join('|');
    const found=cache.get(key);
    if(found){cache.delete(key);cache.set(key,found);return found;}
    const pose=entPose(name,ENT_LOOK[kind]), limbs=limbsByKind[kind],cv=document.createElement('canvas');
    cv.width=ENT_SW*2;cv.height=ENT_SH*2;cv.fine=2;
    const c=cv.getContext('2d');
    c.scale(2,2);c.imageSmoothingEnabled=false;
    const holdingPose=/^g[2-8]$/.test(name)||name.startsWith('cw');
    const order = view==='E'||view==='SE' ? (mirror?[0,1]:[1,0]) : (mirror?[1,0]:[0,1]);
    function rootJoint(side) {
      const [[x,y],knee]=pose.legs[side];
      const upper=[x+(ENT_CX-x)*.35,y-9];
      const lower=[x+(knee[0]-x)*.32,y+(knee[1]-y)*.32];
      woodShape(c,upper,lower,14,17,false,kind,limbs[3]);
    }
    function leg(side,far) {
      const [a,b,f]=pose.legs[side], [x,y]=f;
      const root=[a[0]+(ENT_CX-a[0])*.25,a[1]-5];
      woodShape(c,root,b,18,14,far,kind,limbs[3]);
      woodShape(c,b,f,15,10,far,kind,limbs[3]);
      c.save();c.translate(snap(x),snap(y));
      if(side===0)c.scale(-1,1);
      rootFoot(c,far,kind);
      c.restore();
    }
    function arm(side,far,stage) {
      const holding=side===1 && (/^g\d$/.test(name)||name.startsWith('cw'));
      const [,joint,hand]=pose.arms[side];
      const attack=name==='f0'||name==='f1';
      const outward=side===0?-1:1;
      const b=[joint[0]+outward*(far?0:attack?4:2),joint[1]+(far?4:0)];
      const anchors=shoulders[view];
      const raw=anchors[mirror?1-side:side];
      const a=[ENT_CX+raw[0]*(mirror?-1:1),raw[1]];
      let h=hand;
      if(!holding) {
        const [x,y]=hand;
        h=[x+outward*(far?-2:attack?5:2),y+(far?(name==='f0'?12:6):0)];
      }
      if(side===1&&yaw){
        const x=hand[0]-ENT_CX,y=hand[1]-ENT_BASE;
        const cos=Math.cos(yaw),sin=Math.sin(yaw);
        h=[ENT_CX+x*cos+y*sin,ENT_BASE+y*cos-x*sin];
      }
      const branch=side===0?-1:1;
      const blend=view==='N'?.31:far?.2:.15;
      const shoulder=[a[0]+(ENT_CX-a[0])*blend+branch*(far?0:.75),a[1]-(view==='N'?3:1)];
      if(!far&&stage==='all') {
        const siding=[shoulder[0]+(ENT_CX-shoulder[0])*.42,shoulder[1]-3];
        const entry=[shoulder[0]*.78+b[0]*.22,shoulder[1]*.78+b[1]*.22];
        woodShape(c,siding,entry,13,16,false,kind,limbs[0]);
      }
      if(stage!=='fore') woodShape(c,shoulder,b,18,14,far,kind,limbs[0]);
      if(stage==='upper') return;
      // Overlap the elbow with a single strip of bark instead of a second cap.
      const elbow=[b[0]+(shoulder[0]-b[0])*.15,b[1]+(shoulder[1]-b[1])*.15];
      woodShape(c,elbow,h,15,12,far,kind,limbs[1]);
      if(side===1&&pose.noClaw){
        woodShape(c,[h[0],h[1]-2],h,8,7,far,kind,limbs[2]);
      }else{
        const dx=h[0]-b[0],dy=h[1]-b[1],len=Math.hypot(dx,dy)||1;
        const wrist=[h[0]-dx/len*2,h[1]-dy/len*2];
        woodShape(c,wrist,[h[0]+dx/len*4,h[1]+dy/len*4],12,14,far,kind,limbs[2]);
      }
    }
    const farHold=holdingPose&&order[0]===1;
    leg(order[0],true);arm(order[0],true,farHold?'upper':'all');
    const art=bodies[kind],body=art[views.indexOf(view)];
    const ceiling={oak:85,birch:90,pine:90,fir:90}[kind];
    const h=ceiling*body.baseH/Math.max(...art.map(p=>p.baseH));
    // The profile crown gains its old breadth while keeping its narrower torso.
    const nativeProfileWidth={oak:78,birch:64,pine:65,fir:66}[kind];
    const w=Math.min(view==='E'?nativeProfileWidth:78,h*body.baseW/body.baseH*(view==='E'?1.60:1.30));
    c.save();
    if(mirror){c.translate(ENT_CX*2,0);c.scale(-1,1);}
    part(c,body,ENT_CX-w/2,90-h,w,h);
    c.restore();
    const pupils = (treePupils[kind][view] || []).map(([x,y]) => [mirror ? ENT_CX*2-x : x,y]);
    // Apply the original pupil shade as a tiny prebuilt mask. No synchronous
    // pixel readback is needed from newly posed canvases during world render.
    c.save();c.globalCompositeOperation='source-atop';
    for(const [x,y] of pupils)c.drawImage(eyeShade,x-2.5,y-1.5,5.5,3.5);
    c.restore();
    leg(order[1],false);rootJoint(order[1]);
    arm(order[1],false,'all');
    if(farHold)arm(1,false,'fore');
    const eyes = pupils.map(([x,y]) => [x-1,y-1]);
    const value={cv,eyes,hand:pose.arms[1][2]};
    cache.set(key,value);
    while(cache.size>64)cache.delete(cache.keys().next().value);
    return value;
  }
  function direction(e) {
    const last = headings.get(e);
    let dx = e.moving && last ? e.x-last.x : 0;
    let dy = e.moving && last ? e.y-last.y : 0;
    if (Math.hypot(dx,dy) < .002) {
      if (e.state === 'drag') {
        if (e.t >= GRAB_LIFT && e.dragDir) [dx,dy] = e.dragDir;
        else if (Number.isFinite(e.vx0) && Number.isFinite(e.vy0)) {
          [dx,dy] = [e.vx0-e.x,e.vy0-e.y];
        }
      } else if (e.state === 'smash' && e.target) {
        const {x,y,w,h} = e.target;
        [dx,dy] = [x+w/2-e.x,y+h/2-e.y];
      } else if(e.state==='fight'&&e.foe) [dx,dy]=[e.foe.x-e.x,e.foe.y-e.y];
      else if(e.goal) [dx,dy]=[e.goal[0]-e.x,e.goal[1]-e.y];
    }
    const dir = Math.hypot(dx,dy) > .02 ? directions[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8] : last?.dir || (e.face < 0?'W':'E');
    headings.set(e,{x:e.x,y:e.y,dir});
    return dir;
  }
  function draw(c,e,forced) {
    if(e.rock||e.water)return nativeDraw(c,e);
    if(e.k>.02&&!loading)prepare();
    if(!loaded)return nativeDraw(c,e);
    const species=entBase(e).kind;
    if(!bodies[species]?.length)return nativeDraw(c,e);
    const dir = forced || direction(e);
    const view = ({W:'E',NW:'NE',SW:'SE'})[dir] || dir;
    const mirror = ['W','NW','SW'].includes(dir) !== (e.face < 0) && dir !== 'N' && dir !== 'S';
    const yaw=e.state==='drag'&&e.moving?Math.round(Math.sin(e.phase*.85)*.03*(e.face<0?-1:1)*512)/512:0;
    const old = entSprite,originalImage=c.drawImage,hadOwnImage=Object.hasOwn(c,'drawImage');
    let ownSprite;
    entSprite = (kind,name) => {
      if(kind!==species)return previous(kind,name);
      const data=frame(view,name,mirror,yaw,species);
      ownSprite=data.cv;
      return data;
    };
    c.drawImage=function(image,...args){
      if(image!==ownSprite)return originalImage.call(this,image,...args);
      const smooth=this.imageSmoothingEnabled;
      this.imageSmoothingEnabled=false;
      try{return originalImage.call(this,image,...args);}
      finally{this.imageSmoothingEnabled=smooth;}
    };
    const previousGrip=drawGrip,previousGrabbed=drawGrabbed;
    if(e.state==='drag') {
      drawGrip=(ctx,x,y,face,closed)=>treeGrip(ctx,x,y,face,closed,species);
      drawGrabbed=(ctx,unit,x,y,rot,held,...rest)=>{
        if(ctx===c&&held){
          const hand=entHandWorld(e);
          treePalm(ctx,hand.x,hand.y,e.face<0?-1:1,species);
        }
        return previousGrabbed(ctx,unit,x,y,rot,held,...rest);
      };
    }
    try {
      // The native renderer can write transient victim fields. The preview draws
      // a copy with the real unit's appearance and preserves the live unit.
      return nativeDraw(c,e.victim || e.vsnap ? {...e,victim:null,vsnap:{...(e.victim || e.vsnap)}} : e);
    } finally {
      entSprite = old;
      drawGrip = previousGrip;
      drawGrabbed = previousGrabbed;
      if(hadOwnImage)c.drawImage=originalImage;else delete c.drawImage;
    }
  }
  drawEnt = draw;
  globalThis.LandElementalArt = {cache,views,draw,frame,direction,prepare,errors};
})();
