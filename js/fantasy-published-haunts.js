'use strict';
/* Full-body fairy2 art. New torso/legs/arms/hands/weapon, native gameplay rig only.
   Visual sampling is a half-world-pixel grid. Native simulation and death recipes
   are deliberately outside this render-only module. */
(() => {
 if(globalThis.FantasyPublishedHaunts)return;
 const raw={noon:fzNoonPx,ban:fzBansheePx,les:fzLeshyPx,kik:fzKikPx,vod:fzVodPx,rus:fzRusPx};
 const sizes={noon:[60,88,30,80],ban:[64,84,32,30],les:[36,50,18,48],kik:[26,32,13,30],vod:[30,28,15,26],rus:[22,30,11,28]};
 class PixelCache extends Map{
  constructor(maxEntries,maxBytes){super();this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.bytes=0;this.hits=0;this.misses=0;}
  cost(v){return v.width*v.height*4+(v.fzSol?.byteLength||0)+(v.hauntLive?v.hauntLive.width*v.hauntLive.height*4:0);}
  get(k){const v=super.get(k);if(v){this.hits++;super.delete(k);super.set(k,v);}return v;}
  set(k,v){this.delete(k);this.misses++;super.set(k,v);this.bytes+=this.cost(v);while(this.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.keys().next().value);return this;}
  delete(k){const v=super.get(k);if(v)this.bytes-=this.cost(v);return super.delete(k);}
  clear(){super.clear();this.bytes=0;}
 }
 const nativeSprite=fzPxSprite,nativeBanArt=fzBansheeArt,nativeLive=fzLive,nativeDrawList=fairy2DrawList,cache=new PixelCache(512,24*1024*1024),displayCache=new PixelCache(256,8*1024*1024);let down=new WeakMap(),rawMode=false,activeView='S',activeCorrection=false;
 const headings=['S','SE','E','NE','N','NW','W','SW'],views=['S','SE','E','NE','N','NE','E','SE'];
 const actorMeta=new WeakMap(),actorMotion=new WeakMap(),pinned=new WeakMap();
 const phaseSteps={noon:.5,ban:1,les:.5,kik:1/3,vod:1/3,rus:1/3};
 function normalize(kind,args){const finite=x=>Number.isFinite(Number(x))?Number(x):0,step=phaseSteps[kind],period=step*12,p=finite(args[1]),walk=Number(args[2]);return[Math.round(Math.max(0,Math.min(2,finite(args[0])))*12)/12,((Math.round(p/step)%12+12)%12)*step,walk>=0?((Math.round(walk*2)%12+12)%12)/2:-1];}
 function context(direction,nativeFace,fn){const n=headings.indexOf(direction),i=n<0?0:n,old=[activeView,activeCorrection];activeView=views[i];activeCorrection=(i>=5)!==(nativeFace<0);try{return fn();}finally{[activeView,activeCorrection]=old;}}
 function mirror(cv){const out=canvas(cv.width,cv.height),c=out.getContext('2d');c.imageSmoothingEnabled=false;c.translate(out.width,0);c.scale(-1,1);c.drawImage(cv,0,0);out.fzO=cv.fzO?.slice();out.fzPx=true;return out;}
 function viewPose(kind,args){return pose(kind,args).map((q,i)=>{const a=q.a.slice(),h=q.h.slice(),b=q.b.slice(),side=i?1:-1,x=Math.abs(a[0]);if(activeView==='E'){a[0]=i?-x*.18:x*.10;a[1]-=i?0:.5;}else if(activeView==='SE'){a[0]=i?-x*.48:x*.55;a[1]-=i?0:.35;}else if(activeView==='NE'){a[0]=side*x*.68;a[1]-=i?0:.35;}if(activeCorrection){h[0]*=-1;b[0]*=-1;}const sourceA=activeCorrection?-q.a[0]:q.a[0];b[0]+=(a[0]-sourceA)*.55;b[1]+=(a[1]-q.a[1])*.5;return{...q,a,b,h};});}
 function headingOf(o){if(pinned.has(o))return pinned.get(o);const r=actorMotion.get(o),x=Number(o.x)||0,y=Number(o.y)||0;let dx=r?x-r.x:0,dy=r?y-r.y:0;
  const kind=actorMeta.get(o)?.kind;let unit=Number.isFinite(o.tgt)?Game.unitMap?.get(o.tgt):o.hit?.u;
  // Stationary spirits face an already affected listener/cutter or existing gift.
  // These are native simulation facts, not newly selected AI targets.
  if(!unit&&kind==='rus'&&o.state==='sing')unit=Game.units.find(u=>u._lure&&!u.dead&&!u.inside&&Math.hypot(u.x-x,u.y-y)<=9);
  if(!unit&&kind==='les'&&o.state==='angry')unit=Game.units.find(u=>u.type==='woodcutter'&&u.fzWander>Game.time&&!u.dead&&!u.inside&&Math.hypot(u.x-x,u.y-y)<=26);
  const point=unit||o.hit?.p||(kind==='les'&&o.state==='calm'?o.gift:null);
  if(point&&['chase','come','haunt','grab','sing','angry','calm'].includes(o.state)){dx=point.x-x;dy=point.y-y;}
  if(Math.hypot(dx,dy)<.001&&Number.isFinite(o.tx)&&Number.isFinite(o.ty)){dx=o.tx-x;dy=o.ty-y;}
  let index=r?.index??(o.face<0?6:o.face>0?2:0);if(Math.hypot(dx,dy)>.003){const a=Math.atan2(dx,dy)/(Math.PI/4),next=(Math.round(a)+8)%8,delta=Math.abs(((a-index+12)%8)-4);if(!r||delta>.59)index=next;}
  actorMotion.set(o,{x,y,index});return headings[index];
 }
 fairy2DrawList=function(list,c,...bounds){const F=Game.fairy2;if(F){const add=(o,kind,flip)=>{if(o)actorMeta.set(o,{kind,flip});};add(F.les,'les',false);add(F.noon,'noon',true);for(const o of F.kik||[])add(o,'kik',true);for(const o of F.ban||[])add(o,'ban',true);add(F.pond?.vod,'vod',true);add(F.pond?.rus,'rus',false);}return nativeDrawList(list,c,...bounds);};
 fzLive=function(o,get){const meta=actorMeta.get(o);return meta?context(headingOf(o),meta.flip?(o.face||1):1,()=>nativeLive(o,get)):nativeLive(o,get);};
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),snap=v=>Math.round(v*2)/2,TAU=Math.PI*2;
 const canvas=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
 const specs={
  noon:{x:.115,y:[[0,-71],[90,-54.6],[170,-44.7],[300,-25],[495,1]],skin:['#49372b','#916246','#c79266','#e7bd8e','#f4d5a6'],cloth:['#494332','#82765c','#b6aa85','#dacda6','#f1e4c3'],arm:1.3},
  ban:{x:.16,y:[[0,-29],[90,-7.5],[170,5.5],[300,28],[495,51]],skin:['#27303d','#526477','#8f9eaa','#c7d0d0','#e7e7d8'],cloth:['#1e2633','#354357','#57677d','#83909f','#b5bcc1'],arm:1.8},
  les:{x:.10,y:[[0,-46],[95,-29.7],[170,-25.3],[300,-13.3],[495,1]],skin:['#2d281d','#57402b','#87643c','#b38d54','#dcc18a'],cloth:['#2a3f27','#4b6033','#788547','#a4ae62','#c2ca80'],arm:2.15},
  kik:{x:.075,y:[[0,-29],[95,-19.7],[170,-15.7],[300,-7.8],[495,1]],skin:['#30382a','#5c6648','#89916b','#b7bc8d','#d7d7ac'],cloth:['#312e23','#544831','#7e6d44','#aa925e','#d0ba83'],arm:.9},
  vod:{x:.105,y:[[0,-28],[90,-19.7],[170,-10],[300,-3],[380,1],[512,5]],skin:['#253f32','#3c6750','#659273','#99b18a','#c9cba1'],cloth:['#2d482b','#506834','#849146','#b5b45c','#d8cd84'],arm:1.8},
  rus:{x:.072,y:[[0,-28],[90,-21.3],[170,-16],[260,-8.8],[495,1]],skin:['#654834','#a47955','#d5a67e','#edc7a0','#f5ddba'],cloth:['#4e665d','#839b86','#b5c5a6','#dfdfbd','#f2e9cb'],arm:.8}
 };
 const ramps={
  noon:['29251f','59422c','855b38','ba8753','d8ae76','f0d4a3','655e4e','a69a7b','d6c6a3','f0e2bf','74542d','b58437','d8ac51','efce7d','633b31','a15843','d38b60'],
  ban:['202632','344356','4f6074','768794','a8b7bd','d7dbd2','4b4f58','7c8490','afb5ba','e2dfd0','53666d','8bada9','bee2cc','994d42','d68264'],
  les:['29291f','493927','6e5132','9e7c49','c19c62','e2c28b','304a2d','536936','84944a','b2be69','67482d','b5804c','dfb67e','b9d76e','e9e3a0'],
  kik:['26291e','414431','5e6945','8a9463','b4bd8c','4d3f2b','776340','a28a57','c3aa72','a7a18c','d5ccb0','e8dfc2','b6c66a','e4dfa1'],
  vod:['24392e','315c4e','4e7f67','7ba185','aec29a','3a4f29','637c36','97a84e','c3bf70','8a632e','bd963e','e5c65f','f4e1a2','76674b','b8a77c','e1cfa1','f0e2bf'],
  rus:['353529','704e33','a4774c','d2a273','efc7a0','836335','ba8f46','dfb85f','f1d58b','3f6243','6a8c55','a6b87b','e5ddbd','f3e8cd','325b59','538c84','86b9a8','b9d9bf','995d50']
 };

 function pose(kind,args){
  const lv=Number(args[0])||0,p=Number(args[1])||0,walk=args[2]??-1,kk=lv/2,S=sizes[kind],paths=[];
  const add=(a,b,h,r,hr)=>paths.push({a,b,h,r,hr});
  if(kind==='noon'){
   const poses=[{L:[-34,-94,Math.PI/2+.3],R:[34,-100,Math.PI/2-.25]},{L:[-40,-142,-Math.PI/2-.55],R:[24,-186,-Math.PI/2-.65]},{L:[-44,-124,Math.PI+.15],R:[50,-116,.35]}],li=Math.min(1,Math.floor(lv)),t=lv-li,pose=t?{L:poses[li].L.map((v,i)=>v+(poses[li+1].L[i]-v)*t),R:poses[li].R.map((v,i)=>v+(poses[li+1].R[i]-v)*t)}:poses[lv];
   const elbows={};
   for(const side of[-1,1]){const a=[side*16,-134],h=side<0?pose.L:pose.R,dx=h[0]-a[0],dy=h[1]-a[1],len=Math.hypot(dx,dy)||1;let nx=-dy/len,ny=dx/len;if(nx*side<0){nx=-nx;ny=-ny;}const e=[(a[0]+h[0])/2+nx*7,(a[1]+h[1])/2+ny*7+2];elbows[side]=e;add(a.map(v=>v/3),e.map(v=>v/3),h.slice(0,2).map(v=>v/3),2.1,1.4);}
   const h=pose.L;
   for(const j of[-1.5,-.5,.5,1.5,-3.2]){const thumb=j< -2,a=h[2]-j*(thumb?.4:.36),a2=a-.2,l1=thumb?4.5:Math.abs(j)>1?6:7.5,l2=thumb?3.5:Math.abs(j)>1?4.5:5.5,b=[h[0]+Math.cos(a)*2.5,h[1]+Math.sin(a)*2.5],q=[b[0]+Math.cos(a)*l1,b[1]+Math.sin(a)*l1],r=[q[0]+Math.cos(a2)*l2,q[1]+Math.sin(a2)*l2];add(b.map(v=>v/3),q.map(v=>v/3),r.map(v=>v/3),.55,.7);}
   const e=elbows[1],rh=pose.R,fa=Math.atan2(rh[1]-e[1],rh[0]-e[0]),ha=[fa+Math.PI/2-.35,fa-Math.PI/2+.35].reduce((b,c)=>Math.cos(c)*.6-Math.sin(c)>Math.cos(b)*.6-Math.sin(b)?c:b);
   let x=rh[0]+Math.cos(ha)*11,y=rh[1]+Math.sin(ha)*11,d=ha;const sg=-Math.sin(ha+Math.PI/2)>-Math.sin(ha-Math.PI/2)?1:-1;
   for(let j=0;j<40;j++){const t=j/40,w=t<.3?3+t*5.5:4.65*(1-(t-.3)/.7)+.25;d+=sg*(t<.1?.02:.095);const xx=x+Math.cos(d)*1.35,yy=y+Math.sin(d)*1.35;add([x/3,y/3],[xx/3,yy/3],[xx/3,yy/3],w/3+.3,.4);x=xx;y=yy;}
  }else if(kind==='ban'){
   const ar=Math.min(1,lv),wob=Math.sin(p/12*Math.PI*2),wob2=Math.sin(p/12*Math.PI*2+1.3),mix=(a,b)=>a+(b-a)*ar;
   for(const side of[-1,1])add([side*9,mix(35.5,34.5)-30],[side*mix(15.8+wob2*.4,17.6+wob2*.3),mix(44,27+wob*.6)-30],[side*mix(15.2+wob*.6,16.8+wob*.4),mix(50.6+wob*.8,18.6+wob*1.2)-30],2.2,6);
  }else if(kind==='les'||kind==='kik'){

   const wk=walk>=0,wp=walk/6*Math.PI*2,ph=kind==='les'?(wk?walk:p)/6*Math.PI*2:wk?wp:p/4*Math.PI*2;
   const bx=wk?Math.round(-Math.sin(wp)*(kind==='les'?1.5:1))/3:0,by=wk?-Math.round(Math.abs(Math.sin(wp))*(kind==='les'?2:1.5))/3:0;
   for(const side of[-1,1]){
    const sw=wk?Math.sin(wp+(side>0?Math.PI:0))*(kind==='les'?4:2)*(1-kk):0;
    const a=kind==='les'?[side*19,-76]:[side*9,-47],b=kind==='les'?[side*(32+3*kk),-54-36*kk+sw*.5]:[side*(16+6*kk),-32-20*kk+sw*.5];
    const h=kind==='les'?[side*(30+7*kk)+Math.sin(ph)*side*1.5*(1-kk),-30-86*kk+sw]:[side*(15+11*kk),-18-58*kk+Math.sin(ph+side)*1.5*(1-kk)+sw];
    add(a.map((v,i)=>v/3+(i?by:bx)),b.map((v,i)=>v/3+(i?by:bx)),h.map((v,i)=>v/3+(i?by:bx)),kind==='les'?2.5:1.1,kind==='les'?5.5:4);
   }
  }else if(kind==='vod'){
   const ph=p/4*Math.PI*2;for(const side of[-1,1])add([side*8,-10],[side*(31+3*kk)/3,(-16-22*kk)/3],[side*(26+12*kk)/3,(-6-58*kk+Math.sin(ph+side)*(1-kk))/3],2.1,5);
  }else if(kind==='rus'){
   add([3,-16],[13/3,-12],[14/3,-8],1.1,1.1);
   add([-3,-16],lv>=1.5?[-16/3,-40/3]:[(-14-2*kk)/3,(-38-2*kk)/3],lv>=1.5?[-22/3,-49/3]:[(-7.5-12.5*kk)/3,(-29.5-17*kk)/3],1.1,1.3);
  }
  return kind==='noon'?paths.slice(0,2):paths;
 }

 // Atlas subjects are not perfectly cell-centred: align the face and sternum,
 // rather than treating the nominal cell midpoint as an anatomical landmark.
 Object.assign(specs.noon,{cx:162,arm:1.65});Object.assign(specs.ban,{cx:164,arm:2.6});
 Object.assign(specs.les,{cx:138});Object.assign(specs.kik,{cx:126});
 Object.assign(specs.vod,{cx:100});Object.assign(specs.rus,{cx:96});
 const headSpecs={noon:[128,211,.08,-54.6,350,-44.7],ban:[128,199,.11,-7.4,350,5.5],les:[131,204,.075,-29.7,320,-25.3],kik:[133,207,.053,-19.7,320,-15.7],vod:[128,180,.075,-19.7,350,-10],rus:[128,192,.055,-19,330,-16]};
 const assets={errors:[],image:null,frames:{},views:{},heads:{},palettes:{},source:'assets/fantasy/haunt-bodies-v3.png',headSource:'assets/fantasy/haunt-busts-v2.png',viewSources:Object.fromEntries(['SE','E','NE','N'].map(v=>[v,'assets/fantasy/haunt-bodies-v4-'+v+'.png']))};
 const colorCache={};
 const extras={noon:['a34f39','c97850','e7aa71','342b25','94382b','d26746'],ban:['96b8b8','d4e4d8','94d7c0','a74738','e99266'],les:['c59654','ead49b','3d5829','5f7a31','8ba346'],kik:['667c4b','9aa46c','b3c56a','e2dca3','dad0ab'],vod:['3c806d','79a78d','b3c5a1','d2b755','eed485','e7d5a8'],rus:['ac753c','d1a453','efd082','3b746c','68a695','9ac8b1','d5d9b7']};
 function connectedBody(sd,w,h){
  const labels=new Int32Array(w*h),queue=new Int32Array(w*h);let label=0,best=0,bestSize=0;
  for(let start=0;start<labels.length;start++){
   if(labels[start]||sd[start*4+3]<220)continue;label++;let head=0,tail=1;queue[0]=start;labels[start]=label;
   while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){const j=yy*w+xx;if(!labels[j]&&sd[j*4+3]>=220){labels[j]=label;queue[tail++]=j;}}}
   if(tail>bestSize){bestSize=tail;best=label;}
  }
  // Adjacent atlas columns contain loose chaff. Keep this character's connected
  // silhouette; all detached motes/ripples are animated by effects(), not baked.
  for(let i=0;i<labels.length;i++)if(labels[i]!==best)sd[i*4+3]=0;
  return sd;
 }
 function inverseY(points,y){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(y<=b[1])return a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]);}return 999;}
 function buildParts(im,view='S'){const target={};
  const source=canvas(im.width,im.height),c=source.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);if(view==='S')assets.image=source;
  const cw=im.width/6,ch=im.height/2;
  Object.keys(sizes).forEach((kind,col)=>{
   const S=sizes[kind],sp=specs[kind],pal=[...new Set([...ramps[kind],...extras[kind],...sp.skin.map(x=>x.slice(1)),...sp.cloth.map(x=>x.slice(1))])].map(h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)));
   target[kind]=[];
   const common=['30362e','9dada0','dfe2c9','392b23','654830','a17c48','c5a46a','e5c586','c3ae83','302f25','789f91','b6d1bd','6e998f','b6d7bd','a97b35','e0bd69','c99d4f','e9cc83','9cb6a0','9eae5d'];
   assets.palettes[kind]=[...pal,...common.map(h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)))];colorCache[kind]=new Map();
   for(let row=0;row<2;row++){
    const sd=connectedBody(c.getImageData(col*cw,row*ch,cw,ch).data,cw,ch),cv=canvas(S[0]*2,S[1]*2),o=cv.getContext('2d'),id=o.createImageData(cv.width,cv.height),d=id.data;let cx=sp.cx;if(view!=='S'){const centres=[];for(let yy=240;yy<285;yy++){let left=cw,right=-1;for(let xx=0;xx<cw;xx++)if(sd[(yy*cw+xx)*4+3]>=220){left=Math.min(left,xx);right=Math.max(right,xx);}if(right>=left)centres.push((left+right)/2);}centres.sort((a,b)=>a-b);cx=centres[Math.floor(centres.length/2)]||128;}
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
     const wy=(y+.5)/2-S[3],wx=(x+.5)/2-S[2];if((view==='S'&&wy<headSpecs[kind][5])||(kind==='vod'&&wy>1))continue;
     const sy=inverseY(sp.y,wy)*ch/512,sx=(cx+wx/sp.x)*cw/256;if(sy<0||sy>=ch||sx<0||sx>=cw)continue;
     // Palette votes preserve a deliberate pixel cluster instead of averaging it.
     const votes=new Map();let hits=0;
     for(const yy of[-.28,0,.28])for(const xx of[-.28,0,.28]){
      const px=Math.max(0,Math.min(cw-1,Math.floor(sx+xx/sp.x/2))),py=Math.max(0,Math.min(ch-1,Math.floor(sy+yy*3))),j=(py*cw+px)*4;if(sd[j+3]<220)continue;
      let best=Infinity,q=0;pal.forEach((rgb,k)=>{const ds=(rgb[0]-sd[j])**2*.8+(rgb[1]-sd[j+1])**2+(rgb[2]-sd[j+2])**2*.8;if(ds<best){best=ds;q=k;}});votes.set(q,(votes.get(q)||0)+1);hits++;
     }
     if(hits<4)continue;const q=[...votes].sort((a,b)=>b[1]-a[1])[0][0],i=(y*cv.width+x)*4;d.set([...pal[q],255],i);
    }
    o.putImageData(id,0,0);
    if(kind==='rus'){cv.hauntRows=[];for(let y=0;y<cv.height;y++){let l=cv.width,r=-1;for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x);}cv.hauntRows.push([l,r]);}}
    target[kind].push(cv);
   }
  });assets.views[view]=target;if(view==='S')assets.frames=target;
 }
 function clear(){cache.clear();displayCache.clear();down=new WeakMap();for(const k of Object.keys(FZ_CVC))if(/^(noon|ban|les|kik|vod|rus|hauntv[234]:)/.test(k)){delete FZ_CVC[k];const n=FZ_ORD.get(k)||0;FZ_ORD.delete(k);FZ_PX-=n;}}
 function buildHeads(im){
  const source=canvas(im.width,im.height),c=source.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);const cw=im.width/6,ch=im.height/2;
  Object.keys(sizes).forEach((kind,col)=>{const S=sizes[kind],[ax,ay,sc,eye,bottom]=headSpecs[kind],pal=assets.palettes[kind];assets.heads[kind]=[];
   for(let row=0;row<2;row++){
    const sd=connectedBody(c.getImageData(col*cw,row*ch,cw,ch).data,cw,ch),cv=canvas(S[0]*2,S[1]*2),o=cv.getContext('2d'),id=o.createImageData(cv.width,cv.height),d=id.data;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
     const wx=(x+.5)/2-S[2],wy=(y+.5)/2-S[3],sx=ax+wx/sc,sy=ay+(wy-eye)/sc;if(sx<0||sx>=cw||sy<0||sy>=bottom)continue;
     const votes=new Map();let count=0;
     for(const yy of[-.25,0,.25])for(const xx of[-.25,0,.25]){const px=Math.max(0,Math.min(cw-1,Math.floor(sx+xx/sc/2))),py=Math.max(0,Math.min(ch-1,Math.floor(sy+yy/sc/2))),i=(py*cw+px)*4;if(sd[i+3]<220)continue;let best=Infinity,q=0;pal.forEach((p,j)=>{const ds=(p[0]-sd[i])**2*.8+(p[1]-sd[i+1])**2+(p[2]-sd[i+2])**2*.8;if(ds<best){best=ds;q=j;}});votes.set(q,(votes.get(q)||0)+1);count++;}
     if(count<4)continue;const q=[...votes].sort((a,b)=>b[1]-a[1])[0][0];d.set([...pal[q],255],(y*cv.width+x)*4);
    }
    o.putImageData(id,0,0);assets.heads[kind].push(cv);
   }
  });
 }
 const loadImage=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{assets.errors.push(src);resolve(null);};im.src=src;});
 assets.ready=Promise.all([loadImage(assets.source),loadImage(assets.headSource),...Object.values(assets.viewSources).map(loadImage)]).then(([body,head,...images])=>{if(body)buildParts(body);if(head&&body)buildHeads(head);Object.keys(assets.viewSources).forEach((v,i)=>{if(images[i])buildParts(images[i],v);});clear();});
 function poly(c,pts,col){c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));c.closePath();c.fill();}
 function line(c,pts,col,w=.5){c.strokeStyle=col;c.lineWidth=w;c.beginPath();pts.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));c.stroke();}
 function oval(c,x,y,rx,ry,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
 // Five nested asymmetric bands model each limb; joints and tendons share material.
 function segment(c,a,b,r0,r1,pal,grain=false){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,n=[-dy/len,dx/len],point=(u,t)=>[a[0]+dx*u+n[0]*(r0+(r1-r0)*u)*t,a[1]+dy*u+n[1]*(r0+(r1-r0)*u)*t];
  poly(c,[point(0,-1),point(1,-1),point(1,1),point(0,1)],pal[0]);
  for(const[l,r,k]of[[-.78,.76,1],[-.7,.40,2],[-.56,-.06,3],[-.5,-.28,4]])poly(c,[point(.06,l),point(.96,l),point(.96,r),point(.06,r)],pal[k]);
  if(grain){for(let i=1;i<5;i++){const u=i/5;line(c,[point(u,-.55),point(u+.12,-.22),point(u+.16,-.4)],pal[i%2?0:3],.4);}}
 }
 function limbs(c,kind,args,layer='all'){
  const sp=specs[kind],lv=Number(args[0])||0,p=Number(args[1])||0,paths=viewPose(kind,args),ph=p/(kind==='ban'?12:kind==='noon'||kind==='les'?6:4)*TAU;
  paths.forEach((q,idx)=>{if(layer==='far'&&idx!==0||layer==='near'&&idx!==1)return;
   const side=idx===0?-1:1,a=q.a,b=q.b,h=q.h,r=sp.arm*(activeView==='E'?.82:1),skin=layer==='far'?[sp.skin[0],sp.skin[0],sp.skin[1],sp.skin[2],sp.skin[3]]:sp.skin,cloth=layer==='far'?[sp.cloth[0],sp.cloth[0],sp.cloth[1],sp.cloth[2],sp.cloth[3]]:sp.cloth,angle=Math.atan2(h[1]-b[1],h[0]-b[0]);
   // Sleeves end above the elbow; no sockets or old silhouette are left exposed.
   const sleeved=kind==='noon'||kind==='ban'||kind==='rus'||kind==='kik';
   segment(c,a,b,r*1.15,r*.78,sleeved?cloth:skin,kind==='les');
   if(sleeved){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    for(let j=0;j<3;j++){const u=.22+j*.21,x=a[0]+dx*u,y=a[1]+dy*u;line(c,[[x+nx*r*.65,y+ny*r*.65],[x-nx*r*.15-dx*.08,y-ny*r*.15-dy*.08]],cloth[j%2?1:4],.4);}
    if(kind==='ban')for(let j=0;j<3;j++){const u=.4+j*.15,x=a[0]+dx*u+nx*r*.7,y=a[1]+dy*u+ny*r*.7;poly(c,[[x,y],[x+nx*r*.9+Math.sin(ph+j)*.3,y+ny*r*.9+2],[x+dx*.13,y+dy*.13]],cloth[1+j%3]);}
   }
   oval(c,b[0],b[1],r*.85,r*.8,skin[1]);oval(c,b[0]-.22,b[1]-.25,r*.55,r*.5,skin[3]);
   segment(c,b,h,r*.75,r*.48,skin,kind==='les');
   if(sleeved){const u=.72,ex=a[0]+(b[0]-a[0])*u,ey=a[1]+(b[1]-a[1])*u;line(c,[[ex-r*.7,ey-.2],[ex+r*.7,ey+.4]],kind==='noon'?'#b45a3c':cloth[4],.6);}
   // Palm stays exactly on the native victim anchor. Every finger has two joints.
   const palm=kind==='vod'?1.6:kind==='ban'?1.7:kind==='les'?1.35:kind==='noon'?1.05:.8;
   oval(c,h[0],h[1],palm,palm*.85,skin[0]);oval(c,h[0]-.15,h[1]-.2,palm*.78,palm*.68,skin[3]);
   const tips=[];
   for(let j=0;j<4;j++){
    const spread=(j-1.5)*(kind==='vod'?.40:.28),ang=angle+spread,len=(kind==='ban'?5:kind==='les'?3.4:kind==='vod'?3.1:kind==='kik'?2.5:1.7)*(j===0||j===3?.78:1),bend=(kind==='rus'?-.4:lv>.8?-.2:.35)*side;
    const root=[h[0]+Math.cos(angle+Math.PI/2)*(j-1.5)*palm*.42,h[1]+Math.sin(angle+Math.PI/2)*(j-1.5)*palm*.42],mid=[root[0]+Math.cos(ang)*len*.55,root[1]+Math.sin(ang)*len*.55],tip=[mid[0]+Math.cos(ang+bend)*len*.5,mid[1]+Math.sin(ang+bend)*len*.5];
    if(kind==='vod'){mid[0]=clamp(mid[0],-13.5,13.5);tip[0]=clamp(tip[0],-13.5,13.5);}tips.push(tip);
    if(kind==='vod'&&j){poly(c,[h,tips[j-1],tip],skin[2]);line(c,[tips[j-1],tip],skin[3],.35);}
    segment(c,root,mid,kind==='ban'?.32:.28,.23,skin);segment(c,mid,tip,.24,.14,skin);
    if(kind!=='rus'&&kind!=='noon')line(c,[tip,[clamp(tip[0]+Math.cos(ang+bend+.4)*.8,kind==='vod'?-14:-99,kind==='vod'?14:99),tip[1]+Math.sin(ang+bend+.4)*.8]],kind==='les'?'#d6c28a':'#302f25',.4);
   }
   const ta=angle-side*.95,thumb=[h[0]+Math.cos(ta)*palm*1.8,h[1]+Math.sin(ta)*palm*1.8];if(kind==='vod')thumb[0]=clamp(thumb[0],-13.5,13.5);segment(c,h,thumb,.4,.2,skin);
   line(c,[[b[0]-.3,b[1]-.2],[h[0]-.3,h[1]-.2]],skin[1],.35);
   if(kind==='les'){for(let j=0;j<3;j++){const u=.25+j*.25,x=a[0]+(b[0]-a[0])*u,y=a[1]+(b[1]-a[1])*u;oval(c,x-side*r*.8,y,.8,.5,cloth[1+j%3]);}}
   if(kind==='kik'||kind==='vod'){for(let j=0;j<2;j++){const x=a[0]+side*j*.6,y=a[1]+j;line(c,[[x,y],[x+Math.sin(ph+j)*.5,y+2+j]],cloth[j+1],.45);}}
   if(kind==='noon'&&idx===1)sickle(c,b,h,skin);
  });
 }
 function sickle(c,b,h){
  const fa=Math.atan2(h[1]-b[1],h[0]-b[0]),opts=[fa+Math.PI/2-.35,fa-Math.PI/2+.35],ang=opts.reduce((a,b)=>Math.cos(b)*.6-Math.sin(b)>Math.cos(a)*.6-Math.sin(a)?b:a),end=[h[0]+Math.cos(ang)*4,h[1]+Math.sin(ang)*4];
  segment(c,[h[0]-Math.cos(ang)*1.8,h[1]-Math.sin(ang)*1.8],end,.6,.5,['#392b23','#654830','#a17c48','#c5a46a','#e5c586']);
  for(let i=-1;i<=2;i++){const x=h[0]+Math.cos(ang)*i*.65,y=h[1]+Math.sin(ang)*i*.65;line(c,[[x-.45,y-.2],[x+.45,y+.2]],'#c3ae83',.3);}
  const sign=-Math.sin(ang+Math.PI/2)>-Math.sin(ang-Math.PI/2)?1:-1,pts=[end];let[x,y]=end,d=ang;
  for(let i=0;i<27;i++){d+=sign*.10;x+=Math.cos(d)*.55;y+=Math.sin(d)*.55;pts.push([x,y]);}
  line(c,pts,'#30362e',1.25);line(c,pts,'#9dada0',.8);line(c,pts.slice(4),'#dfe2c9',.35);
 }
 function body(c,kind,args){
  const S=sizes[kind],lv=Number(args[0])||0,p=Number(args[1])||0,walk=args[2]??-1,ph=p/(kind==='ban'?12:kind==='noon'||kind==='les'?6:4)*TAU,wp=walk/6*TAU,row=lv>=(kind==='ban'?.35:.8)?1:0,src=assets.views[activeView]?.[kind]?.[row];if(!src)return;
  const walking=(kind==='les'||kind==='kik')&&walk>=0,bx=walking?snap(-Math.sin(wp)*.45):0,bob=walking?snap(-Math.abs(Math.sin(wp))*.55):0;
  const cut=kind==='les'?-13.3:kind==='kik'?-4:null,cutpx=cut===null?src.height:Math.round((S[3]+cut)*2);
  c.save();c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;
  // Legs are independent moving pieces attached at hips; the raised foot compresses
  // smoothly up to the knee, while the planted root/foot remains on the ground.
  if(cut!==null){for(const side of[-1,1]){
   const lift=walking?Math.max(0,Math.sin(wp+(side>0?0:Math.PI)))*(kind==='les'?3:1.6):0,x=side<0?0:S[2]*2,w=side<0?S[2]*2:src.width-S[2]*2,h=src.height-cutpx,sway=walking?Math.sin(wp+side)*.35:0,start=cutpx+Math.round(bob*2),end=src.height-Math.round(lift*2);
   for(let y=start;y<end;y++){const u=(y-start)/Math.max(1,end-start),sy=cutpx+Math.min(h-1,Math.floor(u*h)),dx=Math.round((bx*(1-u)+sway*Math.sin(u*Math.PI))*2);c.drawImage(src,x,sy,w,1,x+dx,y,w,1);}
  }}
  for(let y=0;y<cutpx;y++){
   const wy=y/2-S[3],u=clamp((wy+(kind==='ban'?0:25))/(kind==='ban'?53:27));let dx=bx,dy=bob;
   if(kind==='ban')dx+=snap(Math.sin(ph+u*3)*u*2.5);
   if(kind==='noon'&&wy>-35)dx+=snap(Math.sin(ph+u*2)*u*.9);
   if(kind==='rus'&&wy>-10){dx+=snap(Math.sin(ph+u*2)*u*.8);const q=src.hauntRows?.[y];if(q&&q[1]>=q[0])dx=clamp(dx,(1-q[0])/2,(src.width-2-q[1])/2);}
   if(kind==='vod')dy+=snap(Math.sin(ph)*.35*clamp((-wy)/20));
   if(kind==='kik'&&wy>-18)dx+=snap(Math.sin(ph+u*4)*u*.35);
   c.drawImage(src,0,y,src.width,1,Math.round(dx*2),y+Math.round(dy*2),src.width,1);
  }
  const head=activeView==='S'?assets.heads[kind]?.[row]:null;if(head)c.drawImage(head,Math.round(bx*2),Math.round(bob*2));
  c.restore();
 }
 function effects(c,kind,args,front){
  const p=Number(args[1])||0,lv=Number(args[0])||0,ph=p/(kind==='ban'?12:kind==='noon'||kind==='les'?6:4)*TAU;
  if(kind==='noon'){
   if(!front){c.strokeStyle='#a97b35';c.lineWidth=.5;c.beginPath();c.ellipse(0,-55.5,14.5,16.5,0,0,TAU);c.stroke();for(let j=0;j<12;j++){const a=j/12*TAU+ph/12;line(c,[[Math.cos(a)*15,-55.5+Math.sin(a)*17],[Math.cos(a)*17,-55.5+Math.sin(a)*19]],'#e0bd69',.5);}}
   for(let j=0;j<22;j++){const t=j/22,a=ph*(1+(j%3)*.15)+j*2.4,sn=Math.sin(a);if((sn>0)!==front)continue;const x=Math.cos(a)*(3+t*13),y=-2-t*26+Math.sin(a)*2;line(c,[[x,y],[x+.8,y-.5]],j%3?'#c99d4f':'#e9cc83',.5);}
  }
  if(front&&(kind==='vod'||kind==='rus'))for(let j=0;j<9;j++){const x=(kind==='vod'?-11:-9)+j*(kind==='vod'?2.7:2)+Math.sin(ph+j)*.4,y=.5+Math.sin(ph+j*.7)*.35;line(c,[[x,y],[x+1.5,y]],j%2?'#789f91':'#b6d1bd',.5);}
  if(front&&kind==='ban')for(let j=0;j<10;j++){const x=Math.sin(ph+j*2)*8,y=32+j*1.5+Math.sin(ph+j)*1.3;c.fillStyle=j%2?'#6e998f':'#b6d7bd';c.fillRect(snap(x),snap(y),.5,.5);}
  if(front&&kind==='kik')for(let j=0;j<3;j++){const y=-8+(p+j)%4*2.2,x=(j-1)*5+Math.sin(ph+j);c.fillStyle='#9cb6a0';c.fillRect(snap(x),snap(y),.5,.5);}
  if(front&&kind==='les')for(let j=0;j<3;j++){const x=Math.sin(ph+j*2)*9,y=-36+(p+j*2)%6*5;c.fillStyle='#9eae5d';c.fillRect(snap(x),snap(y),.5,1);}
 }
 function render2(kind,args){
  const S=sizes[kind],cv=canvas(S[0]*2,S[1]*2),c=cv.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;c.scale(2,2);c.translate(S[2],S[3]);c.lineJoin='round';c.lineCap='round';
  effects(c,kind,args,false);
  const arms=layer=>{c.save();if(kind==='vod'){c.beginPath();c.rect(-15,-26,30,26.8);c.clip();}limbs(c,kind,args,layer);c.restore();};
  if(activeView==='N'){arms('all');body(c,kind,args);}else if(activeView==='S'){body(c,kind,args);arms('all');}else{arms('far');body(c,kind,args);arms('near');}
  effects(c,kind,args,true);
  const id=c.getImageData(0,0,cv.width,cv.height),d=id.data,pal=assets.palettes[kind],lookup=colorCache[kind];
  for(let i=0;i<d.length;i+=4){d[i+3]=d[i+3]>=128?255:0;if(!d[i+3]||!pal)continue;const key=d[i]*65536+d[i+1]*256+d[i+2];let rgb=lookup.get(key);if(!rgb){let best=Infinity;for(const p of pal){const ds=(p[0]-d[i])**2*.8+(p[1]-d[i+1])**2+(p[2]-d[i+2])**2*.8;if(ds<best){best=ds;rgb=p;}}if(lookup.size>=4096)lookup.clear();lookup.set(key,rgb);}d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];}
  c.putImageData(id,0,0);cv.fzO=[S[2],S[3],S[0],S[1]];cv.fzPx=true;return activeCorrection?mirror(cv):cv;
 }
 function make(kind,args){
  args=normalize(kind,args);const key=activeView+'|flip:'+activeCorrection+'|'+kind+'|'+args.join('|')+'|'+FZ_NOOUT;if(cache.has(key))return cache.get(key);const S=sizes[kind],live=render2(kind,args),cv=canvas(S[0]*3,S[1]*3),c=cv.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;c.drawImage(live,0,0,cv.width,cv.height);
  const d=c.getImageData(0,0,cv.width,cv.height).data;cv.fzSol=new Uint8Array(cv.width*cv.height);for(let i=0;i<cv.fzSol.length;i++)cv.fzSol[i]=d[i*4+3]>150?1:0;cv.hauntLive=live;cv.hauntKind=kind;cv.hauntArgs=args.slice();if(cache.size>=900)cache.delete(cache.keys().next().value);cache.set(key,cv);return cv;
 }
 fzNoonSprite=(...a)=>{a=normalize('noon',a);return fzPxSprite('noon'+a.join('_'),60,88,30,80,()=>make('noon',a));};
 fzBansheeSprite=(...a)=>{a=normalize('ban',a);return fzPxSprite('ban'+a.join('_'),64,84,32,30,()=>make('ban',a));};
 fzLeshySprite=(...a)=>{a=normalize('les',a);return fzPxSprite('les'+a.join('_'),36,50,18,48,()=>make('les',a));};
 fzKikSprite=(...a)=>{a=normalize('kik',a);return fzPxSprite('kik'+a.join('_'),26,32,13,30,()=>make('kik',a));};
 fzVodSprite=(...a)=>{a=normalize('vod',a);return fzPxSprite('vod'+a.join('_'),30,28,15,26,()=>make('vod',a));};
 fzRusSprite=(...a)=>{a=normalize('rus',a);return fzPxSprite('rus'+a.join('_'),22,30,11,28,()=>make('rus',a));};
 fzNoonPx=(...a)=>make('noon',a);fzBansheePx=(...a)=>make('ban',a);fzLeshyPx=(...a)=>make('les',a);fzKikPx=(...a)=>make('kik',a);fzVodPx=(...a)=>make('vod',a);fzRusPx=(...a)=>make('rus',a);
 fzPxSprite=function(key,w,h,ox,oy,draw){
  if(!/^(noon|ban|les|kik|vod|rus)/.test(key))return nativeSprite(key,w,h,ox,oy,draw);
  const source=nativeSprite('hauntv4:'+activeView+':'+activeCorrection+':'+key,w,h,ox,oy,draw);if(!source)return source;if(down.has(source))return down.get(source);const material=draw();let cv;
  if(material?.hauntLive)cv=material.hauntLive;else{cv=canvas(w*2,h*2);const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(source,0,0,cv.width,cv.height);cv.fzO=[ox,oy,w,h];cv.fzPx=true;}down.set(source,cv);return cv;
 };
 fzBansheeArt=function(lv,p,Q,wide=0){return Q===3&&!rawMode?make('ban',[lv,p]):nativeBanArt(lv,p,Q,wide);};
 clear();
 globalThis.FantasyPublishedHaunts={version:4,ready:assets.ready,assets,kinds:Object.keys(raw),sizes,raw,cache,render:make,
  before(kind,args){rawMode=true;try{const source=raw[kind](...args),cv=canvas(source.width,source.height),S=sizes[kind];cv.getContext('2d').drawImage(source,0,0);cv.fzO=[S[2],S[3],S[0],S[1]];return cv;}finally{rawMode=false;}},
  after:make,pose,headings,viewPose,headingOf,requiredAssets:[assets.source,assets.headSource,...Object.values(assets.viewSources)],
  frame(kind,args=[0,0,-1],direction='S',face){args=normalize(kind,args);direction=headings.includes(direction)?direction:'S';const i=headings.indexOf(direction),f=face??(i>=5?-1:1),key='frame|'+kind+'|'+args.join('_')+'|'+direction+'|'+f;if(displayCache.has(key))return displayCache.get(key);const cv=context(direction,f,()=>{const source=make(kind,args).hauntLive;return f<0?mirror(source):source;});displayCache.set(key,cv);return cv;},
  death(kind,frame=0,direction='S',face){direction=headings.includes(direction)?direction:'S';const i=headings.indexOf(direction),f=face??(i>=5?-1:1),n=((Math.round(Number(frame)||0)%12)+12)%12,key='death|'+kind+'|'+n+'|'+direction+'|'+f;if(displayCache.has(key))return displayCache.get(key);const cv=context(direction,f,()=>{const source=FZ_DIE[kind](n);return f<0?mirror(source):source;});displayCache.set(key,cv);return cv;},
  setHeading(actor,direction){if(headings.includes(direction))pinned.set(actor,direction);else pinned.delete(actor);},
  anchors(kind,args=[0,0,-1],direction='S',face){const i=headings.indexOf(direction),f=face??(i>=5?-1:1);return context(direction,f,()=>({foot:[0,0],native:pose(kind,normalize(kind,args)).map(q=>[q.h[0]*f,q.h[1]]),actual:viewPose(kind,normalize(kind,args)).map(q=>[q.h[0]*(activeCorrection?-1:1)*f,q.h[1]])}));},
  cacheStats:()=>({entries:cache.size,rgbaBytes:cache.bytes,maxEntries:cache.maxEntries,maxRgbaBytes:cache.maxBytes,hits:cache.hits,misses:cache.misses,displayEntries:displayCache.size,displayRgbaBytes:displayCache.bytes,displayMaxEntries:displayCache.maxEntries,displayMaxRgbaBytes:displayCache.maxBytes}),
  renderSpec:{backingScale:2,worldPixelStep:.5,handRig:'native coordinates; entirely new painted limbs',autoOutline:false,body:'complete v3 atlas, no native pixels'},nativeBanArt};
})();
