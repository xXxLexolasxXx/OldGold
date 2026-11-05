/* OldGold birds, presentation only. Load after native renderers and published owl pass.
 * Raster views authored independently for front, front 3/4, side, rear 3/4, back.
 * No simulation writes. No timing changes. Runtime canvases have 0.5-world-pixel grid.
 */
'use strict';
(()=>{
 if(window.FantasyPublishedBirds)return;
 const cache=new Map(),errors=[],history=new WeakMap(),ownedFrames=new WeakMap(),MAX_ENTRIES=1800,MAX_BYTES=24*1024*1024;
 const beforeAfBlit=afBlit,beforeFineBlit=blitFine;
 function ownedBlit(c,s,x,y,w,h){const m=ownedFrames.get(s);if(!m)return beforeAfBlit(c,s,x,y,w,h);w=w??m.box[0];h=h??m.box[1];const sx=w/m.box[0],sy=h/m.box[1],sm=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;c.drawImage(s,x-m.padding[0]*sx,y-m.padding[1]*sy,s.width/2*sx,s.height/2*sy);c.imageSmoothingEnabled=sm;}
 afBlit=function(c,s,x,y,w,h){if(ownedFrames.has(s))return ownedBlit(c,s,x,y,w,h);return beforeAfBlit(c,s,x,y,w,h);};
 blitFine=function(c,s,x,y,w,h){const m=ownedFrames.get(s);if(!m)return beforeFineBlit(c,s,x,y,w,h);if(w===undefined||h===undefined||w===s.width/2&&h===s.height/2){const sm=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;c.drawImage(s,x,y,w??s.width/2,h??s.height/2);c.imageSmoothingEnabled=sm;return;}return ownedBlit(c,s,x,y,w,h);};
 const moduleURL=document.currentScript?.src||new URL('js/fantasy-published-birds.js',document.baseURI).href;
 const requiredAssets=['assets/fantasy-birds/owl-flight-runtime-v2.png','assets/fantasy-birds/owl-perch-runtime-v2.png','assets/fantasy-birds/owl-flight-runtime-v2.json','assets/fantasy-birds/owl-perch-runtime-v2.json','assets/fantasy-birds/chicken-runtime-v2.png','assets/fantasy-birds/chicken-runtime-v2.json'];
 const images=[],metadata=[],extraPacks=[],supportedKinds=['owl','chicken'];let loaded=false;
 const manifestPath='assets/fantasy-birds/extra-packs.json';requiredAssets.push(manifestPath);
 const assetURL=src=>new URL('../'+src,moduleURL).href;
 const json=async src=>{try{const r=await fetch(assetURL(src));if(!r.ok)throw Error(r.status);return await r.json();}catch(e){errors.push(src+': '+e.message);return null;}};
 const png=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{errors.push('Не загружен ассет: '+src);resolve(null);};im.src=assetURL(src);});
 const ready=(async()=>{
  const m=await json(manifestPath);if(!m||!Array.isArray(m.packs)){if(!errors.length)errors.push('Нет списка птичьих атласов');return false;}
  for(const def of m.packs){def.slot=3+extraPacks.length;extraPacks.push(def);if(!supportedKinds.includes(def.kind))supportedKinds.push(def.kind);requiredAssets.push('assets/fantasy-birds/'+def.file+'.png','assets/fantasy-birds/'+def.file+'.json');}
  const pairs=[[requiredAssets[0],requiredAssets[2]],[requiredAssets[1],requiredAssets[3]],[requiredAssets[4],requiredAssets[5]],...extraPacks.map(d=>['assets/fantasy-birds/'+d.file+'.png','assets/fantasy-birds/'+d.file+'.json'])];
  await Promise.all(pairs.map(async([p,j],slot)=>{const [im,meta]=await Promise.all([png(p),json(j)]);images[slot]=im;metadata[slot]=meta;}));
  for(let slot=0;slot<pairs.length;slot++){
   const m=metadata[slot],im=images[slot],cols=slot<3?[12,6,16][slot]:extraPacks[slot-3].columns;
   const valid=im&&m&&m.rows?.length===5&&m.rows.every(row=>row.length===cols&&row.every(b=>b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[2]>0&&b[3]>0&&b[0]+b[2]<=im.width&&b[1]+b[3]<=im.height));
   if(!valid)errors.push('Некорректные границы атласа '+slot);
  }
  cache.clear();bytes=0;loaded=errors.length===0;return loaded;
 })();
 let bytes=0,context=null;
 const mod=(n,d)=>((n%d)+d)%d;
 function kit(w,h){const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;cv.fine=2;return{cv,c:cv.getContext('2d')};}
 function duckGear(K,box,tame,cargo,swim){
  const [w,h,ax]=box,oy=4+(swim?2.4:0),g=K.c;g.save();g.translate((K.padding?.[0]||0)*2,(K.padding?.[1]||0)*2);g.scale(2,2);g.translate(ax,oy);
  const pixel=(x,y,color)=>{g.fillStyle=color;g.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,.5,.5);};
  if(cargo){for(let y=-1.7;y<=1.7;y+=.5)for(let x=-2.5;x<=2.5;x+=.5)if((x/2.5)**2+(y/1.7)**2<=1)pixel(-1+x,5+y,y<-.5?'#e4d3a5':x<0?'#b29b6e':'#8e7652');for(let j=0;j<3;j++)pixel(-1.5+j*.5,4.3,'#74603e');g.save();g.translate(-1,5.2-2.6);g.scale(.34,.34);drawLoad(g,cargo);g.restore();}
  if(tame){for(let s of [-1,1])for(let x=.5;x<=2;x+=.5)for(let y=-1;y<=1;y+=.5)if(Math.abs(y)<=x*.65)pixel(3.2+s*x,5.4+y,s<0?'#9e3036':y<0?'#ed7760':'#c44b43');pixel(3,5.2,'#f3d080');pixel(3.5,5.2,'#b18740');}
  g.restore();
 }
 function birdWater(K,kind,box,f){const g=K.c,st=Math.sin(f/12*Math.PI*2);g.save();g.translate((K.padding?.[0]||0)*2,(K.padding?.[1]||0)*2);g.scale(2,2);g.translate(box[2],box[3]);if(kind==='goose'){g.fillStyle='rgba(44,92,134,.72)';g.beginPath();g.ellipse(0,-.8,9.6,2.2,0,0,7);g.fill();}for(const [rx,ry,alpha] of kind==='goose'?[[8.6+st,1.4,.75],[11.5+st*1.4,2,.35]]:[[8+st*.6,2.3,.6],[5.6,1.5,.55]]){g.strokeStyle='rgba(214,238,246,'+alpha+')';g.lineWidth=.5;g.beginPath();g.ellipse(0,kind==='goose'?-.8:-.4,rx,ry,0,0,7);g.stroke();}g.restore();}
 function cached(kind,view,anim,f,box,opts={}){
  const extra=extraPacks.find(d=>d.kind===kind&&d.states[anim]);
  if(!['owl','chicken'].includes(kind)&&!extra)throw new Error('Birds atlas is not implemented for: '+kind);
  if(extra){const n=extra.states[anim][2]||extra.states[anim][1];f=extra.once?.includes(anim)?Math.max(0,Math.min(n-1,Math.floor(Number(f)||0))):mod(Math.floor(Number(f)||0),n);}
  else f=anim==='fly'||anim==='walk'?mod(Math.floor(Number(f)||0),12):0;view=['S','SE','E','NE','N'].includes(view)?view:'E';
  const key=[kind,view,anim,f,!!opts.blink,Math.sign(opts.look||0),!!opts.mirror,box.join(','),extra?.id||'',!!opts.tame,opts.cargo||''].join('|');
  if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}
  const frameMeta=metadata[kind==='owl'?(anim==='fly'?0:1):kind==='chicken'?2:extra.slot],renderBox=frameMeta?.renderBox||box,K=kit(...renderBox);K.padding=frameMeta?.padding||[0,0,0,0];ownedFrames.set(K.cv,{box:[...box],padding:K.padding});if(kind==='owl'){
   if(loaded){
    const row=['S','SE','E','NE','N'].indexOf(view),fly=anim==='fly',im=images[fly?0:1],meta=metadata[fly?0:1],col=fly?f:(Math.sign(opts.look||0)+1)*2+(opts.blink?1:0);
    const [sx,sy,sw,sh]=meta.rows[row][col];
    K.c.imageSmoothingEnabled=false;
    if(meta.compiled)K.c.drawImage(im,sx,sy,sw,sh,0,0,K.cv.width,K.cv.height);
    else{
    // Uniform registration through the native cycle; crops cannot sample adjacent sprites.
    const scaleX=fly?(row===2?.16:row===1||row===3?.17:.19):.075,scaleY=fly?.10:.075;
    const bodyX=fly?sx+sw*(row===2?.66:row===1||row===3?.59:.5):sx+sw*.5;
    const bodyY=fly?[105,266,426,586,747][row]:sy+sh;
    K.c.drawImage(im,sx,sy,sw,sh,box[2]*2+(sx-bodyX)*scaleX*2,box[3]*2+(sy-bodyY)*scaleY*2,sw*scaleX*2,sh*scaleY*2);
    const data=K.c.getImageData(0,0,K.cv.width,K.cv.height);for(let i=3;i<data.data.length;i+=4)data.data[i]=data.data[i]>=96?255:0;K.c.putImageData(data,0,0);
    }
    if(opts.mirror){const copy=document.createElement('canvas');copy.width=K.cv.width;copy.height=K.cv.height;copy.getContext('2d').drawImage(K.cv,0,0);K.c.clearRect(0,0,K.cv.width,K.cv.height);K.c.save();K.c.translate((box[2]+K.padding[0])*4,0);K.c.scale(-1,1);K.c.drawImage(copy,0,0);K.c.restore();}
   }else return beforeOwl(anim==='fly'?'fly':'perch',opts.look||0,!!opts.blink,anim==='fly'?10+f:0);
  }
  if(kind==='chicken'){
   if(!loaded)return beforeCreature('chicken',anim==='walk'?f:null,anim==='peck'?'peck':null);
   const row=['S','SE','E','NE','N'].indexOf(view),col=anim==='walk'?f:anim==='peck'?13:opts.blink?15:12;
   const [x,y,w,h]=metadata[2].rows[row][col],sx=.09,sy=.09;K.c.imageSmoothingEnabled=false;
   if(metadata[2].compiled)K.c.drawImage(images[2],x,y,w,h,0,0,K.cv.width,K.cv.height);
   else K.c.drawImage(images[2],x,y,w,h,box[2]*2-w*sx,box[3]*2-h*sy*2,w*sx*2,h*sy*2);
   const data=K.c.getImageData(0,0,K.cv.width,K.cv.height);for(let i=3;i<data.data.length;i+=4)data.data[i]=data.data[i]>=96?255:0;K.c.putImageData(data,0,0);
  }
  if(extra){
   if(!loaded)throw new Error('Bird atlas is not ready: '+kind);
   const row=['S','SE','E','NE','N'].indexOf(view),[start,count,nativeN=count]=extra.states[anim],col=start+Math.floor(f*count/nativeN),m=metadata[extra.slot],im=images[extra.slot],[sx,sy,sw,sh]=m.rows[row][col];
   const front=view==='S'||view==='SE',back=view==='N'||view==='NE';
   if(kind==='duck'&&opts.cargo&&front)duckGear(K,box,false,opts.cargo,anim==='swim');
   K.c.imageSmoothingEnabled=false;K.c.drawImage(im,sx,sy,sw,sh,0,0,K.cv.width,K.cv.height);
   if((kind==='goose'||kind==='duck')&&anim==='swim')birdWater(K,kind,box,f);
   if(kind==='duck')duckGear(K,box,!!opts.tame&&!back,front?null:opts.cargo,anim==='swim');
  }
  const cv=K.cv,sz=cv.width*cv.height*4;
  while(cache.size&&(cache.size>=MAX_ENTRIES||bytes+sz>MAX_BYTES)){const k=cache.keys().next().value;const v=cache.get(k);bytes-=v.width*v.height*4;cache.delete(k);}
  if(sz<=MAX_BYTES){cache.set(key,cv);bytes+=sz;}return cv;
 }
 function direction(o,defaultView='S'){
  if(!o||typeof o!=='object')return defaultView;
  const prev=history.get(o),x=o.x,y=o.y;let dx=0,dy=0;
  if(o.state==='fly'&&o.from&&o.to){dx=o.to[0]-o.from[0];dy=o.to[1]-o.from[1];}
  else if(prev&&Number.isFinite(x)&&Number.isFinite(y)){dx=x-prev.x;dy=y-prev.y;}
  if(Math.hypot(dx,dy)<.00001){const t=o.go||o.dest||o.tgt||o.target||o.path?.[o.pi||0]||(o.mv&&o.a&&typeof o.a==='object'?o.a:null)||(Number.isFinite(o.tx)&&Number.isFinite(o.ty)?[o.tx,o.ty]:null)||(o.state==='grab'&&Number.isFinite(o.vx0)?[o.vx0*TILE,o.vy0*TILE]:null);if(Array.isArray(t)){dx=t[0]-x;dy=t[1]-y;}else if(t&&Number.isFinite(t.x)){dx=t.x-x;dy=t.y-y;}else if(Number.isFinite(o.a)){dx=Math.cos(o.a);dy=Math.sin(o.a);}}
  let view=prev?prev.view:defaultView;
  if(Math.hypot(dx,dy)>.00001){const a=Math.atan2(dy,Math.abs(dx));view=a>Math.PI*3/8?'S':a>Math.PI/8?'SE':a< -Math.PI*3/8?'N':a< -Math.PI/8?'NE':'E';}
  history.set(o,{x,y,view});return view;
 }
 function withContext(o,fn,view){const old=context;context={o,view:view||direction(o)};try{return fn();}finally{context=old;}}
 const beforeOwl=owlSprite;
 const beforeCreature=creatureSprite,beforeCreatureAt=drawCreatureAt;
 creatureSprite=function(kind,f,load,n=1,view='E'){
  if(!['chicken','henbuff','goose','duck'].includes(kind)||!loaded)return beforeCreature(kind,f,load,n,view);
  let anim=f==null?'idle':'walk',frame=f,opts={};
  if(kind==='chicken'&&load==='peck')anim='peck';
  if(kind==='goose'&&load==='attack')anim='attack';else if(kind==='goose'&&load==='swim')anim='swim';
  if(kind==='henbuff'){const mode=String(load||'s');anim=mode[0]==='g'?'grow':mode[0]==='k'?'kick':'idle';frame=Number(mode.slice(1))||0;}
  if(kind==='duck'){const flags=petFlags(load);if(flags.swim)anim='swim';opts={tame:flags.tame,cargo:flags.cargo&&GOODS[flags.cargo]?flags.cargo:null};}
  return cached(kind,context?.view||view,anim,frame,[...CR_SIZE[kind]],opts);
 };
 drawCreatureAt=function(c,kind,px,py,face,moving,phase,load,n,view='E'){
  if(!['chicken','henbuff','goose','duck'].includes(kind))return beforeCreatureAt(c,kind,px,py,face,moving,phase,load,n,view);
  // Native outer call has screen coordinates only. Resolve its existing animal without
  // assigning presentation fields to it; indoor/captured birds retain native face fallback.
  const o=(Game.animals||[]).find(a=>a.kind===kind&&Math.abs(Math.round(a.x*TILE)-px)<.1&&Math.abs(Math.round(a.y*TILE+4)-py)<.1);
  return withContext(o,()=>beforeCreatureAt(c,kind,px,py,face,moving,phase,load,n,view),o?undefined:view);
 };
 const beforePecker=drawPecker;
 drawPecker=function(c,p){if(!loaded)return beforePecker(c,p);if(p.state!=='peck')return;return withContext(p,()=>{const spr=cached('woodpecker','E','peck',Math.floor(p.ph*7)&1,[6,11,3,10]),w=6,h=11,x=(p.tree[0]+.5)*TILE+p.face*4,y=(p.tree[1]+.5)*TILE-3;c.imageSmoothingEnabled=false;c.save();c.translate(Math.round(x),Math.round(y-h-8+1));if(p.face<0)c.scale(-1,1);afBlit(c,spr,-Math.round(w/2),0,w,h);c.restore();c.imageSmoothingEnabled=R.smooth;},'E');};
 const beforeGold=sprGoose,beforeGoldDraw=goldGooseDraw;
 sprGoose=function(fr){if(!loaded)return beforeGold(fr);const f=fr>=30?fr-30:fr>=20?(fr-20)*2:fr>=10?(fr-10)*1.5:fr*6;return cached('goldGoose',context?.view||'E',fr?'walk':'idle',f,[20,18,10,18]);};
 goldGooseDraw=function(list,c,F,x0,y0,x1,y1){if(!loaded)return beforeGoldDraw(list,c,F,x0,y0,x1,y1);const g=F.gg;if(!g||!FY_SEE(g.x,g.y,x0,y0,x1,y1))return;list.push([g.y+.15,()=>withContext(g,()=>{const px=g.x*TILE,py=g.y*TILE+4;fyShadow(c,px,py,8);c.save();c.globalAlpha=1;c.translate(Math.round(px),Math.round(py));if(g.face<0)c.scale(-1,1);afBlit(c,sprGoose(g.mv?fyCyc6(g.ph*18):0),-10,-18,20,18);c.restore();c.imageSmoothingEnabled=R.smooth;if(Math.floor(g.ph*6)%5===0){c.fillStyle='#fffbd0';c.fillRect(Math.round(px+Math.sin(g.ph*5)*8),Math.round(py-12+Math.cos(g.ph*3)*5),1,1);}})]);};
 owlSprite=function(kind,look,blink,frame){if(!loaded)return beforeOwl(kind,look,blink,frame);const fly=kind==='fly',view=context?.view||(fly?'E':'S');let f=fly?(frame>=10?frame-10:[0,3,6][mod(frame||0,3)]):0;return cached('owl',view,fly?'fly':'perch',f,fly?[OWLF_W,OWLF_H,OWLF_FX,OWLF_FY]:[OWL_W,OWL_H,OWL_FX,OWL_FY],{blink,look,mirror:!fly&&context?.o?.face<0});};
 const beforeGrab=drawOwlGrab;
 drawOwlGrab=function(c,o){return withContext(o,()=>{
  // Shanks join the new feathered feet to the untouched native grip anchors.
  // Draw behind native prey/body/grip layers; neither victim nor anchor is moved.
  if(loaded){const gi=owGrabIndex(o),p=owPoseAt(gi);if(gi>=5){const dir=o.face<0?-1:1,a=p.tilt*dir,cs=Math.cos(a),sn=Math.sin(a),tal=owTalonY(p);c.save();c.globalAlpha*=o.valpha===undefined?1:o.valpha;for(const s of [-1,1]){const fx=s*1.1*p.S*dir,fy=3.8*p.S,x0=o.x+fx*cs-fy*sn,y0=o.y+fx*sn+fy*cs,x1=o.x+s*4,y1=o.y+tal;const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)*2));for(let i=0;i<=n;i++){const t=i/n;c.fillStyle=i%3===0?'#8e6838':'#d4ac62';c.fillRect(Math.round((x0+(x1-x0)*t)*2)/2-.25,Math.round((y0+(y1-y0)*t)*2)/2,.5,.5);}}c.restore();}}
  return beforeGrab(c,o);
 });};
 const beforeOwls=drawOwls;
 // Native implementation retained verbatim except scoped sprite selection per owl.
 drawOwls=function(c){const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=R.smooth;c.imageSmoothingQuality='low';for(const o of Game.owls||[]){if(o.state==='grab'){drawOwlGrab(c,o);continue;}if(o.state==='away')continue;const x=o.x,y=o.y;if(typeof onScreen==='function'&&!onScreen(x,y,80))continue;withContext(o,()=>{if(o.state==='fly'){const gy=o.to[1]+(o.from[1]-o.to[1])*(1-o.f)+34;c.fillStyle='rgba(10,8,4,0.18)';c.beginPath();c.ellipse(x,gy,8,2,0,0,7);c.fill();const s=owlSprite('fly',0,0,10+mod(Math.floor(o.ph*30),12));c.save();c.translate(x,y);if(o.face<0)c.scale(-1,1);if(o.item){c.save();c.translate(0,6);c.scale(.4,.4);drawLoad(c,o.item);c.restore();}afBlit(c,s,-OWLF_FX,-OWLF_FY,OWLF_W,OWLF_H);c.restore();}else{if(o.item){c.save();c.translate(x+.5,y+.6);c.scale(.38,.38);drawLoad(c,o.item);c.restore();}afBlit(c,owlSprite('perch',o.look,o.blink>0,0),x-OWL_FX,y-OWL_FY,OWL_W,OWL_H);}},undefined);}for(const f of Game.falling||[]){c.save();c.translate(f.x,f.y);c.rotate(f.rot);c.scale(.45,.45);drawLoad(c,f.g);c.restore();}c.imageSmoothingEnabled=smooth;c.imageSmoothingQuality='low';};
 window.FantasyPublishedBirds={ready,errors,requiredAssets,supportedKinds,packs:extraPacks,pixelRatio:2,views:['S','SE','E','NE','N'],sprite:cached,drawFrame:ownedBlit,frameInfo:s=>ownedFrames.get(s),before:{owlSprite:beforeOwl,drawOwls:beforeOwls,creatureSprite:beforeCreature,drawCreatureAt:beforeCreatureAt},cacheStats:()=>({entries:cache.size,bytes,maxEntries:MAX_ENTRIES,maxBytes:MAX_BYTES}),withContext};
})();

