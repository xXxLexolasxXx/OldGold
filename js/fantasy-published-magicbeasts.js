/* OldGold magical beasts. Load after fairy1, dragonpet and pxbeasts. */
(() => {
  'use strict';
  if (window.FantasyMagicBeasts) return;
  const ROOT = new URL('../assets/fantasy/magicbeasts/', document.currentScript.src);
  const cache = new Map(), motion = new WeakMap(), errors = [], sheets = {};
  let bytes = 0, active = null;
  const LIMIT = 512, BYTE_LIMIT = 24 * 1024 * 1024;
  const spec = {
    unicorn:{file:'unicorn.png',rows:3,cuts:[0,334,677,1024],w:48,h:44,ax:24,ay:44,supportDy:2},
    forest:{file:'forest.png',rows:5,cuts:[0,242,474,670,816,1024],w:44,h:40,ax:21,ay:37,flipped:[16],supportDy:-3},
    fire:{file:'fire.png',rows:5,cuts:[0,218,437,652,817,1024],w:44,h:40,ax:21,ay:37,supportDy:-3},
    ice:{file:'ice.png',rows:5,cuts:[0,220,430,628,794,1024],w:44,h:40,ax:21,ay:37,supportDy:-3},
    swamp:{file:'swamp.png',rows:5,cuts:[0,212,452,628,801,1024],w:44,h:40,ax:21,ay:37,flipped:[16,17],supportDy:-3},
    adult:{file:'adult.png',rows:5,cuts:[0,203,418,628,793,1024],w:100,h:60,ax:42,ay:57,flipped:[16],supportDy:-2},
    griffin:{file:'griffin.png',rows:7,cuts:[0,228,441,666,928,1112,1368,1536],w:62,h:60,ax:31,ay:60,supportDy:-2},
    salamander:{file:'salamander.png',rows:3,cuts:[0,350,697,1024],w:64,h:34,ax:32,ay:34,flipped:[13],supportDy:2}
  };
  const api = window.FantasyMagicBeasts = {
    ready:false, errors, version:'directional-1',
    stats:() => ({entries:cache.size,rgbaBytes:bytes,limit:LIMIT,byteLimit:BYTE_LIMIT}),
    roster:spec,
    directionOf:o=>motion.get(o)?.dir,
    geometrySummary:()=>Object.fromEntries(Object.entries(sheets).map(([kind,s])=>[kind,{worldPixelsPerSourcePixel:s.worldScale,authorViews:5,cells:s.cells.length,supportOffsetBackingPixels:spec[kind].supportDy||0}])),
    preview(kind,dir,state,frame) { return sprite(kind,{dir,face:1},state,frame); }
  };
  function bearing(o, target) {
    const prev=motion.get(o); let dx=prev ? o.x-prev.x:0,dy=prev ? o.y-prev.y:0;
    if (Math.hypot(dx,dy)<0.00001 && target) { dx=target.x-o.x;dy=target.y-o.y; }
    let dir=prev ? prev.dir:(o.face<0?6:2);
    if (Math.hypot(dx,dy)>0.00001) dir=((Math.round(Math.atan2(dx,dy)/(Math.PI/4))%8)+8)%8;
    motion.set(o,{x:o.x,y:o.y,dir}); return {dir,face:o.face||1};
  }
  function sprite(kind,ctx,state,frame) {
    const s=spec[kind],sheet=sheets[kind]; if(!s||!sheet) return null;
    const dir=((ctx.dir%8)+8)%8,view=[0,1,2,3,4,3,2,1][dir];
    const k=((Math.floor(frame)||0)%12+12)%12;
    let row=0;
    if(kind==='unicorn'&&state==='walk') row=k<3||k>=9?1:k>=3&&k<6?0:2;
    else if(kind==='griffin') row=state==='walk'?(k<6?1:2):state==='fly'?(k<6?3:4):state==='take'?(k<4?0:k<8?4:3):state==='atk'?(k<3?3:k<9?5:4):state==='die'?(k<3?4:k<6?5:6):0;
    else if(kind==='salamander')row=state==='work'?(k<6?1:2):0;
    else if(kind!=='unicorn')row=state==='sleep'?3:state==='flyatk'||state==='atk'||state==='shot'?4:state==='fly'?(k<6?1:2):0;
    const key=[kind,dir,state,k].join(':'); if(cache.has(key)) return cache.get(key);
    const cell=sheet.cells[row*5+view],cv=document.createElement('canvas');cv.width=s.w*2;cv.height=(s.h+4)*2;
    const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    const flip=(dir>4)!==!!s.flipped?.includes(row*5+view);
    c.save(); if(flip){c.translate(cv.width,0);c.scale(-1,1);}
    const dest=cell.dest.slice();
    // Two world pixels of transparent reserve above/below; actor/world support is unchanged.
    dest[1]+=4;
    // Native twelve-sample breathing phase, pinned to the same ground support.
    if(state==='idle'||state==='sleep'){const rise=Math.round(Math.sin(k/12*Math.PI*2));dest[1]-=rise;dest[3]+=rise;}
    c.drawImage(sheet.img,...cell.source,...dest);c.restore();
    cv.fine=2;cv.fzO=[s.ax,s.ay+2,s.w,s.h+4];cv.magicNativeO=[s.ax,s.ay,s.w,s.h];cv.magicBeast=true;cv.magicKind=kind;cv.magicState=state;cv.magicFrame=k;
    const n=cv.width*cv.height*4;
    while(cache.size>=LIMIT||bytes+n>BYTE_LIMIT){const first=cache.keys().next().value;const old=cache.get(first);bytes-=old.width*old.height*4;cache.delete(first);}
    cache.set(key,cv);bytes+=n; return cv;
  }
  async function load(kind,s){
    const img=new Image();img.src=new URL(s.file,ROOT).href;await img.decode();
    const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
    const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);
    const pixels=c.getImageData(0,0,cv.width,cv.height),a=pixels.data;
    // Asset normalization only: remove generated low-alpha edge haze on the game pixel grid.
    for(let i=3;i<a.length;i+=4)a[i]=a[i]>=160?255:0;
    const cw=img.width/5,ch=img.height/s.rows,cells=[];
    for(let row=0;row<s.rows;row++)for(let col=0;col<5;col++){
      let x0=Math.round(col*cw),x1=Math.round((col+1)*cw),y0=s.cuts?.[row]??Math.round(row*ch),y1=s.cuts?.[row+1]??Math.round((row+1)*ch);
      // Keep the complete connected animal; discard isolated generation debris in gutters.
      const visited=new Set(),components=[];
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const seed=y*img.width+x;if(!a[seed*4+3]||visited.has(seed))continue;
        const q=[seed];visited.add(seed);
        for(let j=0;j<q.length;j++){const n=q[j],nx=n%img.width,ny=Math.floor(n/img.width);
          for(let yy=Math.max(y0,ny-1);yy<=Math.min(y1-1,ny+1);yy++)for(let xx=Math.max(x0,nx-1);xx<=Math.min(x1-1,nx+1);xx++){
            const v=yy*img.width+xx;if(a[v*4+3]&&!visited.has(v)){visited.add(v);q.push(v);}
          }
        }components.push(q);
      }
      const largest=Math.max(...components.map(v=>v.length));
      for(const component of components)if(component.length<largest*0.08)for(const n of component)a[n*4+3]=0;
      let minX=x1,minY=y1,maxX=x0,maxY=y0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(a[(y*img.width+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      if(maxX<=minX||maxY<=minY)throw Error('empty atlas cell '+kind+' '+row+' '+col);
      const sw=maxX-minX+1,sh=maxY-minY+1;
      // A common scale per species, determined from the complete neutral silhouette.
      cells.push({source:[minX,minY,sw,sh],bounds:[sw,sh]});
    }
    c.putImageData(pixels,0,0);
    const maxW=Math.max(...cells.map(v=>v.bounds[0])),maxH=Math.max(...cells.map(v=>v.bounds[1]));
    const scale=Math.min((s.w-2)*2/maxW,(s.h-2)*2/maxH);
    cells.forEach(cell=>{const [w,h]=cell.bounds;cell.dest=[Math.round(s.w-w*scale/2),Math.round(s.h*2-2-h*scale)+(s.supportDy||0),Math.round(w*scale),Math.round(h*scale)];});
    sheets[kind]={img:cv,cells,worldScale:scale/2};
  }
  function wrap(name,getContext){
    const original=window[name];if(typeof original!=='function')throw Error('Missing native '+name);
    window[name]=function(list,c,F,...bounds){
      const start=list.length,result=original.call(this,list,c,F,...bounds);
      const common=name==='griffinDraw'?getContext(F,0,bounds):null;
      for(let i=start;i<list.length;i++){
        const draw=list[i][1],ctx=common||getContext(F,i-start,bounds);
        if(ctx)list[i][1]=function(){const old=active;active=ctx;try{return draw();}finally{active=old;}};
      }return result;
    };
  }
  api.readyPromise=Promise.all(Object.entries(spec).map(([k,s])=>load(k,s))).then(()=>{
    const oldUni=sprUnicorn,oldBlit=fyBlit;
    sprUnicorn=function(fr){return active?.kind==='unicorn'?sprite('unicorn',active,fr>=30?'walk':'idle',fr>=30?fr-30:0):oldUni(fr);};
    fyBlit=function(c,spr,x,y,face=1,alpha=1,scale=1){
      if(!spr.magicBeast)return oldBlit(c,spr,x,y,face,alpha,scale);
      const [ax,ay,w,h]=spr.fzO;c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;c.translate(Math.round(x),Math.round(y));if(scale!==1)c.scale(scale,scale);c.drawImage(spr,-ax,-ay,w,h);c.restore();
    };
    wrap('unicornDraw',F=>F.uni?{kind:'unicorn',...bearing(F.uni,F.uni.st==='flee'?{x:F.uni.x+Math.cos(F.uni.fa),y:F.uni.y+Math.sin(F.uni.fa)}:F.uni.tg)}:null);
    const oldBaby=pxbBaby,oldAdult=fzDragonSprite,oldGriffin=sprGriffin,oldSal=sprSalamander,oldPxb=pxbBlit;
    const dragonFrame=(mode,p)=>mode==='fly'?Math.round(p*1.5):mode==='flyatk'?Math.floor(p)*2:Math.round(p*2);
    pxbBaby=function(sp,mode,p){const kind=spec[sp]?sp:'forest';return sprite(kind,active||{dir:0},active?.shot?'shot':mode,dragonFrame(mode,p))||oldBaby(sp,mode,p);};
    fzDragonSprite=function(mode,p){return sprite('adult',active||{dir:0},mode,dragonFrame(mode,p))||oldAdult(mode,p);};
    sprGriffin=function(pose,k){return sprite('griffin',active||{dir:0},pose,k)||oldGriffin(pose,k);};
    sprSalamander=function(fr){return sprite('salamander',active||{dir:2},fr>=30?'work':'idle',fr>=30?fr-30:0)||oldSal(fr);};
    pxbBlit=function(c,cv,x,y,face=1,...rest){
      const result=oldPxb(c,cv,x,y,cv.magicBeast?1:face,...rest);
      // Retain the native wild-dragon breath primitive (its body used to contain this FX).
      // Existing pet shot/victim anchors and overlays stay in dpDraw unchanged.
      if(cv.magicBeast&&cv.magicState==='flyatk'){
        const baby=cv.magicKind!=='adult',p=Math.floor(cv.magicFrame/2),t=p/6*Math.PI*2;
        const hb=baby?-12-Math.round(Math.sin(t)*2):-8-Math.round(Math.sin(t)*2);
        const hx=baby?26:67,hy=baby?-54+hb+Math.round(Math.sin(t-1)):-92+hb+Math.round(Math.sin(t-1)*1.5)+3;
        const K=fzPxKit(baby?132:300,baby?120:180,baby?63:126,baby?111:171);
        if(baby)DS_fire(K,[hx+25,hy+11],0.35,36+(p&1)*3,p,0.55);
        else{
          const ja=0.42+(p&1)*0.05,J=[hx-6,hy+5],jaw=DS_rot(J,[31,1],ja),tip=[hx+28,hy+5];
          const M=[(tip[0]+jaw[0])/2+2,(tip[1]+jaw[1])/2-1],ang=ja*0.35+0.32;
          DS_fire(K,M,ang,Math.min((170-M[0])/Math.cos(ang),74)+(p&1)*4,p,1);
        }
        K.outline(DR.OUT);const fx=K.done();fx.fzO=cv.magicNativeO;
        oldPxb(c,fx,x,y,face,...rest);
      }
      return result;
    };
    wrap('dragonDraw',F=>{
      const d=F.dr;if(!d)return null;
      let target=d.st==='back'?{x:d.nx+0.5,y:d.ny+0.5}:d.st==='out'?{x:d.tx,y:d.ty}:d.st==='fire'&&d.fire?{x:d.fire[0]+0.5,y:d.fire[1]+0.5}:null;
      return {kind:d.stage?'adult':d.sp||'forest',...bearing(d,target)};
    });
    wrap('dpDraw',(F,index,bounds)=>{
      const pets=F.dp?.pets.filter(p=>p.st!=='away'&&FY_SEE(p.x,p.y,...bounds))||[],p=pets[index];
      return p?{kind:p.sp||'forest',shot:!!(p.shot&&Game.time-p.shot.t<0.35),...bearing(p,p.shot&&Game.time-p.shot.t<0.35?p.shot:null)}:null;
    });
    wrap('griffinDraw',F=>F.gr?{kind:'griffin',...bearing(F.gr,F.gr.st==='duel'?Game.unitMap.get(F.gr.foe):F.gr.wx!=null?{x:F.gr.wx,y:F.gr.wy}:null)}:null);
    wrap('salamanderDraw',(F,index,bounds)=>{
      const visible=F.sal.filter(s=>{const b=fyBuilding(s.bid);return b&&FY_SEE(b.doorX,b.doorY,...bounds);}),s=visible[index],b=s&&fyBuilding(s.bid);
      // A stationary amphibian faces its furnace door, from the actual building orientation.
      return b?{kind:'salamander',dir:b.rot===2?2:6,face:1}:null;
    });
    api.ready=true;return true;
  }).catch(e=>{errors.push(String(e?.stack||e));console.error('FantasyMagicBeasts',e);return false;});
})();
