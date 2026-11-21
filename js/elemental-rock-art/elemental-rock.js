(() => {
  'use strict';
  if (!globalThis.FantasyPublishedElementals || typeof document === 'undefined' ||
      !document.currentScript?.src || typeof URL !== 'function' || typeof Image !== 'function') return;

  const nativeDraw=drawEnt, base=FantasyPublishedElementals.native;
  const directions=['E','SE','S','SW','W','NW','N','NE'];
  const views=['S','SE','E','NE','N'], mirrors={W:'E',NW:'NE',SW:'SE'};
  const headings=new WeakMap(), errors=[];
  const assetUrl=new URL('.',document.currentScript.src);
  const variantFilters=['','brightness(.90)','brightness(1.06)','saturate(.68)','sepia(.22)','brightness(.96) saturate(.82)'];
  const snap=x=>Math.round(x*2)/2;
  const shades=[1,.68,.71,.88];
  const limbScales={S:.70,M:.84,L:1};
  let loading, parts;

  function tint(image,box,filter){
    const [x,y,w,h]=box;
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    c.filter=filter;
    c.drawImage(image,x,y,w,h,0,0,w,h);
    return cv;
  }
  function prepare(){
    if(loading)return loading;
    const image=new Image();image.src=new URL('rock-parts.png',assetUrl).href;
    const map=fetch(new URL('rock-parts.json',assetUrl)).then(r=>{
      if(!r.ok)throw Error('Missing walking stone atlas map');
      return r.json();
    });
    loading=Promise.all([map,image.decode()]).then(([layout])=>{
      for(const row of [layout.body,layout.parts]){
        if(!Array.isArray(row)||row.length!==5||row.some(rect=>{
          if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isInteger))return true;
          const [x,y,w,h]=rect;
          return x<0||y<0||w<1||h<1||x+w>image.width||y+h>image.height;
        }))throw Error('Invalid walking stone atlas parts');
      }
      const filterFor=(color,filter)=>[color,filter].filter(Boolean).join(' ');
      parts={
        bodies:variantFilters.map(base=>layout.body.map(box=>tint(image,box,filterFor(base,'saturate(.83) contrast(1.12)')))),
        legs:[1,.73].map(shade=>layout.parts.slice(0,3).map(box=>tint(image,box,`brightness(${shade})`))),
        jaws:variantFilters.map(base=>shades.map(shade=>[true,false].map((up,i)=>tint(image,layout.parts[3+i],
          filterFor(base,`brightness(${shade*(up?1.12:.92)}) contrast(${up?1.14:1.08})`))))),
      };
      return true;
    }).catch(error=>{errors.push(error.message);return false;});
    return loading;
  }
  function part(c,image,x,y,w,h){
    c.drawImage(image,snap(x),snap(y),snap(w),snap(h));
  }
  function segment(c,image,a,b,width,tipWidth,far){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=snap(Math.hypot(dx,dy)+3);
    c.save();c.translate(snap(a[0]),snap(a[1]));c.rotate(Math.atan2(dy,dx)-Math.PI/2);
    c.beginPath();c.moveTo(-width/2+1,-1.5);c.lineTo(width/2-1,-1.5);
    c.lineTo(width/2,length*.28);c.lineTo(tipWidth/2,length-2);
    c.lineTo(tipWidth/2-1,length);c.lineTo(-tipWidth/2,length);
    c.lineTo(-tipWidth/2-1,length-2);c.lineTo(-width/2,length*.33);c.closePath();
    c.clip();c.fillStyle=far?'#443a2d':'#5a4b38';c.fillRect(-width,-2,width*2,length+3);
    part(c,image,-width/2,-1.5,width,length+1.5);
    c.restore();
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
  const stoneCache=new Map(), stoneArt=new WeakSet();
  const stoneByteLimit=3*1024*1024;
  let stoneBytes=0;
  function rockRaster(key,w,h,paint){
    const saved=stoneCache.get(key);
    if(saved){stoneCache.delete(key);stoneCache.set(key,saved);return saved;}
    const cv=document.createElement('canvas');
    cv.width=w*2;cv.height=h*2;
    const c=cv.getContext('2d');
    c.scale(2,2);c.imageSmoothingEnabled=false;
    paint(c);
    stoneArt.add(cv);
    stoneCache.set(key,cv);
    stoneBytes+=cv.width*cv.height*4;
    while(stoneCache.size>96||stoneBytes>stoneByteLimit){
      const oldest=stoneCache.keys().next().value, image=stoneCache.get(oldest);
      stoneBytes-=image.width*image.height*4;
      stoneCache.delete(oldest);
    }
    return cv;
  }
  function strokeCrabClaw(c,e,g,view,flip,jaw,limbs,t){
    const {S,bx,top,h}=g, width=S.w, variant=h%ROCK_VARIANTS;
    const scale=limbScales[g.size];
    const sideOfTarget=e.face<0?-1:1;
    const rear=view==='N'||view==='NE';
    const profile=view==='E'||view==='NE';
    const lean=view==='SE'||view==='NE';
    const age=e.state==='fight'&&e.atk?t-e.atk:9;
    for(const k of [1,2]){
      const side=(k===1?-1:1)*sideOfTarget;
      const far=profile?(side===(flip?1:-1)):rear&&k===1;
      const hold=e.state==='drag'&&k===2;
      const rhythm=Math.sin(t*(k===1?2.45:3.15)+e.i+k*1.6);
      const radius=profile&&far?.67:lean&&far?.72:.87;
      let x=bx+side*(width*radius+rhythm*(k===1?1.7:2.5)*scale);
      let y=top+((rear?-5:far?-1:3.5)+(k===1?rhythm:rhythm*2.35))*scale;
      let open=.26+Math.max(0,rhythm)*.37;
      if(age<.8){
        const strike=Math.sin(Math.min(1,age/.8)*Math.PI);
        x+=side*strike*(k===1?-3:5)*scale;
        y-=strike*(k===1?4:10)*scale;
        open=.32+strike*(k===1?.4:.52);
      }
      const split=rockSplitAmt(e);
      if(split){x+=side*split*10*scale;y+=split*7*scale;open=split*.9;}
      if(hold){
        const target=rockEntHand(e.t<GRAB_REACH?{...e,t:GRAB_REACH}:e);
        const t=Math.max(0,Math.min(1,(e.t-.62)/(GRAB_REACH-.62)));
        const p=t*t*(3-2*t);
        x+=(target.x-x)*p;y+=(target.y-y)*p;
        open=e.t<GRAB_REACH?.88:.1;
      }
      if(!hold||e.t<GRAB_REACH){x=snap(x);y=snap(y);}
      const socket=[bx+side*width*.26,top+(far?-2:5)*scale];
      const elbow=[socket[0]+(x-socket[0])*.54,Math.min(socket[1],y)-(far?5:3)*scale];
      const wrist=[x-side*2*scale,y+2*scale];
      segment(c,limbs[0],socket,elbow,6.5*scale,5*scale,far);
      segment(c,limbs[1],elbow,wrist,5.5*scale,5*scale,far);
      const lower=jaw(g.size,variant,k,false),upper=jaw(g.size,variant,k,true);
      c.save();c.translate(x,y);c.scale(side,1);
      c.drawImage(lower.cv,-lower.W/2,-lower.H/2,lower.W,lower.H);
      c.translate(upper.hx-upper.W/2,upper.hy-upper.H/2);c.rotate(-open);
      c.drawImage(upper.cv,-upper.hx,-upper.hy,upper.W,upper.H);
      c.restore();
    }
  }
  function shellEyes(c,e,view,flip,alpha){
    if(alpha<=.01||view==='N'||view==='NE')return;
    const {bx,top,S,size}=rockEntGeom(e),front=view==='S',side=flip?-1:1;
    const scale=limbScales[size];
    const eyes=front?[[-6.5,0],[6.5,0]]:view==='SE'?[[2.5,-1],[10.5,1]]:[[8,0]];
    c.save();c.globalAlpha*=Math.max(.92,alpha);
    for(const [x,y] of eyes){
      const xx=snap(bx+side*x*S.w/56),yy=snap(top-S.h*.40+y);
      const plane=(color,x,y,w,h)=>{
        c.fillStyle=color;
        c.fillRect(snap(xx+x*scale),snap(yy+y*scale),snap(w*scale),snap(h*scale));
      };
      plane('#624333',-3.5,-2,7,5);
      plane('#251f19',-3.5,-2,7,4);
      plane('#251f19',-2.5,-3,5,6);
      plane('#9c4230',-2.5,-1.5,5,3);
      plane('#f58742',-2,-1,4,2);
      plane('#fff0c1',-1,-1,2.5,1);
    }
    c.restore();
  }
  function drawStone(c,e,forced){
    if(e.k<=.02)return nativeDraw(c,e);
    const dir=forced||direction(e), view=mirrors[dir]||dir;
    const flip=['W','NW','SW'].includes(dir);
    const rearView=view==='N'||view==='NE';
    const g=rockEntGeom(e),nativeFlip=Boolean((g.h>>>13)&1);
    const legScale=limbScales[g.size];
    const hooks={rockSprite,rockLeg,clawJaw,drawRockEyes};
    const originalImage=c.drawImage;
    const hadOwnImage=Object.hasOwn(c,'drawImage');
    const foregroundGrip=e.state==='drag' && (e.victim||e.vsnap) && e.k>.3 &&
      e.t>GRAB_REACH+(GRAB_LIFT-GRAB_REACH)*.05;
    let deferredJaw=null,bodyArt,bodySpace,paintedRear=false,behindBody=false;
    const copy=e.victim||e.vsnap?{...e,victim:null,vsnap:{...(e.victim||e.vsnap)}}:e;
    const attackAge=Game.time-e.atk;
    const buildingAttack=e.state==='smash'&&e.hitsDone>0&&attackAge>=0&&attackAge<.8;
    const actor=buildingAttack?{...copy,state:'fight'}:copy;
    c.drawImage=function(image,...args){
      if(image===deferredJaw)return;
      if(image===bodyArt&&bodySpace&&rearView&&e.k>.3&&!paintedRear){
        paintedRear=true;
        this.save();this.setTransform(bodySpace);
        this.globalAlpha*=view==='N'?.83:.91;
        behindBody=true;
        if(foregroundGrip)deferredJaw=clawJaw(g.size,g.h%ROCK_VARIANTS,2,true).cv;
        try{strokeCrabClaw(this,actor,g,view,flip,clawJaw,parts.legs[1],Game.time);}
        finally{behindBody=false;deferredJaw=null;this.restore();}
      }
      if(!stoneArt.has(image))return originalImage.call(this,image,...args);
      const smooth=this.imageSmoothingEnabled;
      this.imageSmoothingEnabled=false;
      try{return originalImage.call(this,image,...args);}
      finally{this.imageSmoothingEnabled=smooth;}
    };
    const legs=[];
    rockLeg=(ctx,ax,ay,kx,ky,fx,fy,dim,moss)=>{
      const index=legs.length, side=index<3?-1:1;
      const legOrder=index%3;
      const frontFoot=legOrder===0;
      const far=e.k<=.3||(view==='N'?frontFoot||dim>.3:view==='NE'?frontFoot||side===(flip?1:-1):
        (view==='E'||view==='SE')?side===(flip?1:-1):dim>.2);
      const paint=()=>{
        const smooth=ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled=false;
        const bend=rearView?(legOrder-1)*side*(view==='N'?1.5:2):0;
        const knee=[kx+bend*legScale,ky+(-(far?7:5)+legOrder*.5)*legScale];
        const [upper,lower,foot]=parts.legs[far?1:0];
        segment(ctx,upper,[ax,ay],knee,8.5*legScale,6.5*legScale,far);
        segment(ctx,lower,knee,[fx,fy],6.5*legScale,3.5*legScale,far);
        part(ctx,foot,fx-3*legScale,fy+2.5-5*legScale,6*legScale,5*legScale);
        ctx.fillStyle=far?'#80745a':legOrder===0?'#d0b38a':'#aa9672';
        ctx.fillRect(snap(fx-.75),snap(fy+.5),1.5,.5);
        ctx.fillRect(snap(fx+side),snap(fy),1,.5);
        ctx.imageSmoothingEnabled=smooth;
      };
      legs.push({far,paint});
      if(far)paint();
    };
    rockSprite=(size,variant,body)=>{
      if(!body)return hooks.rockSprite(size,variant,body);
      const {w,h}=ROCK_SIZES[size], mirrored=flip!==nativeFlip;
      const frame=rockRaster([size,variant,view,mirrored].join('|'),w,h,ctx=>{
        if(mirrored){ctx.translate(w,0);ctx.scale(-1,1);}
        const edge=1+variant%3*.5;
        part(ctx,parts.bodies[variant][views.indexOf(view)],edge,1,w-edge*2,h-2);
      });
      bodyArt=frame;bodySpace=c.getTransform();
      return frame;
    };
    clawJaw=(size,variant,k,up)=>{
      // Read the native jaw geometry without generating its old image.
      const [, , rx0, ry0]=ROCK_SIZES[size].chunks[k];
      const rx=rx0*1.15,ry=ry0*1.15,W=Math.ceil(rx*2+6),H=Math.ceil(ry*2+6);
      const hx=W/2-rx*.7,hy=H/2;
      const shade=behindBody?view==='N'?.68:k===1?.71:.88:1;
      const holdingLower=!up&&k===2&&foregroundGrip;
      const cv=rockRaster(['jaw',size,variant,k,up,shade,holdingLower].join('|'),W,H,ctx=>{
        part(ctx,parts.jaws[variant][shades.indexOf(shade)][up?0:1],Math.max(0,hx-4),up?.5:hy-1,W-hx+4,H/2+1);
        if(!up){
          ctx.fillStyle='#39342c';
          ctx.fillRect(hx-2,hy-1,4,3);
          ctx.fillStyle='#867965';
          ctx.fillRect(hx-1.5,hy-.5,3,1.5);
          ctx.fillStyle='#b6a88d';
          ctx.fillRect(hx-1,hy-.5,2,.5);
          ctx.fillStyle=shade===1?'#ac9672':'#79684c';
          ctx.fillRect(hx+.5,hy+.5,Math.min(4,Math.max(1,W-hx-4)),.5);
          ctx.fillRect(hx+3,hy+1,Math.min(3,Math.max(1,W-hx-5)),.5);
          if(holdingLower){
            // A dark underside separates the moving gripping plate from the
            // planted leg. The bevel follows the jaw up to the captive.
            const length=W-hx;
            ctx.fillStyle='#3d3128';
            ctx.fillRect(hx+length*.44,hy+2.5,length*.42,1);
            ctx.fillRect(hx+length*.67,hy+1.5,length*.23,1);
            ctx.fillStyle=shade===1?'#c2a983':'#9e8664';
            ctx.fillRect(hx+length*.47,hy+1.5,length*.2,.5);
            ctx.fillRect(hx+length*.67,hy+1,length*.21,.5);
          }
        }
      });
      return {cv,W,H,hx,hy};
    };
    const claws=drawRockClaws, victimDraw=drawVictimRock;
    let nearDrawn=false;
    const paintNear=()=>{
      if(nearDrawn)return;
      nearDrawn=true;
      for(const leg of legs)if(!leg.far)leg.paint();
    };
    drawRockClaws=(ctx,actor,geom)=>{
      paintNear();
      if(paintedRear)return;
      if(foregroundGrip)deferredJaw=clawJaw(geom.size,geom.h%ROCK_VARIANTS,2,true).cv;
      try{return strokeCrabClaw(ctx,actor,geom,view,flip,clawJaw,parts.legs[0],Game.time);}
      finally{deferredJaw=null;}
    };
    drawRockEyes=(ctx,actor,alpha)=>{
      paintNear();
      shellEyes(ctx,actor,view,flip,alpha);
    };
    drawVictimRock=(ctx,actor)=>{
      victimDraw(ctx,actor);
      if(!foregroundGrip)return;
      const h=rockEntHand(actor),side=actor.face<0?-1:1;
      const jaw=clawJaw(g.size,g.h%ROCK_VARIANTS,2,true);
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.translate(h.x,h.y);
      ctx.scale(side,1);
      ctx.translate(jaw.hx-jaw.W/2,jaw.hy-jaw.H/2);
      ctx.rotate(-.1);
      ctx.drawImage(jaw.cv,-jaw.hx,-jaw.hy,jaw.W,jaw.H);
      ctx.restore();
    };
    try{
      return base.drawRockEnt(c,actor);
    }finally{
      rockSprite=hooks.rockSprite;rockLeg=hooks.rockLeg;clawJaw=hooks.clawJaw;
      drawRockEyes=hooks.drawRockEyes;drawRockClaws=claws;drawVictimRock=victimDraw;
      if(hadOwnImage)c.drawImage=originalImage;else delete c.drawImage;
    }
  }
  function draw(c,e){
    if(!e.rock||e.water||e.k<=.02)return nativeDraw(c,e);
    if(!parts){prepare();return nativeDraw(c,e);}
    return drawStone(c,e);
  }
  drawEnt=draw;
  globalThis.WalkingStoneArt={prepare,errors,direction,stoneCache,get ready(){return Boolean(parts);},get stoneBytes(){return stoneBytes;}};
  // Start the tiny atlas during startup so the first encounter normally has
  // its art ready and skips the old procedural fallback.
  prepare();
})();
