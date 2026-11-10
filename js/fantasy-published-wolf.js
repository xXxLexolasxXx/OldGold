'use strict';
(() => {
 const K=2, VIEWS=['S','SE','E','NE','N'];
 const previousSprite=creatureSprite, previousAt=drawCreatureAt;
 const cache=new Map(), parts=new Map(), facing=new WeakMap();
 const cargoCache=new Map();
 const cargoWidth=8, maxCargoEntries=64, maxSpriteEntries=256;
 const [w,h,ax,ay]=CR_SIZE.wolf;
 let views, nativeBounds;
 const api=window.FantasyPublishedWolf={errors:[]};
 const canonical=v=>({SW:['SE',true],W:['E',true],NW:['NE',true]})[v]||[VIEWS.includes(v)?v:'E',false];
 const slate=[[32,27,28],[52,43,43],[72,61,59],[94,83,79],[118,106,99],[145,132,120],[175,160,142],[209,191,167],[234,217,190]];
 const cream=[[55,39,33],[76,54,43],[100,73,54],[126,96,69],[155,124,93],[183,151,114],[208,178,139],[228,202,163],[244,225,190]];
 function coatColour(r,g,b){
   const ramp=r-b>24&&r>125?cream:slate;
   const light=(r*3+g*5+b*2)/10;
   return ramp.reduce((a,c)=>Math.abs((c[0]*3+c[1]*5+c[2]*2)/10-light)<Math.abs((a[0]*3+a[1]*5+a[2]*2)/10-light)?c:a);
 }
 function split(image){
  const w=image.width,h=image.height,cv=mkCanvas(w,h),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const im=c.getImageData(0,0,w,h),d=im.data,labels=new Int32Array(w*h),queue=new Int32Array(w*h),groups=[];let seq=0;
  for(let i=0;i<w*h;i++){if(labels[i]||d[i*4+3]<220)continue;const id=++seq;let n=0,tail=1,x0=w,y0=h,x1=-1,y1=-1;queue[0]=i;labels[i]=id;while(n<tail){const p=queue[n++],x=p%w,y=(p/w)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const q of [x? p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!labels[q]&&d[q*4+3]>=220){labels[q]=id;queue[tail++]=q;}}groups.push({id,n:tail,x0,y0,x1,y1});}
  const main=groups.slice().sort((a,b)=>b.n-a.n).slice(0,5).sort((a,b)=>a.x0-b.x0);if(main.length!==5)throw Error('Expected five opaque wolf views');const owners=new Map(main.map((q,i)=>[q.id,i])),bounds=main.map(q=>({...q}));
  for(const g of groups){if(owners.has(g.id)||g.n<3)continue;let best=-1,dist=Infinity;for(let j=0;j<main.length;j++){const q=main[j],dx=Math.max(q.x0-g.x1,g.x0-q.x1,0),dy=Math.max(q.y0-g.y1,g.y0-q.y1,0),v=dx*dx+dy*dy;if(v<dist){dist=v;best=j;}}if(dist<=1600){owners.set(g.id,best);const b=bounds[best];b.x0=Math.min(b.x0,g.x0);b.x1=Math.max(b.x1,g.x1);b.y0=Math.min(b.y0,g.y0);b.y1=Math.max(b.y1,g.y1);}}
  return bounds.map((b,j)=>{const out=mkCanvas(b.x1-b.x0+1,b.y1-b.y0+1),g=out.getContext('2d'),pixels=g.createImageData(out.width,out.height);for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){const i=y*w+x;if(owners.get(labels[i])!==j)continue;const o=((y-b.y0)*out.width+x-b.x0)*4;pixels.data[o]=d[i*4];pixels.data[o+1]=d[i*4+1];pixels.data[o+2]=d[i*4+2];pixels.data[o+3]=255;}g.putImageData(pixels,0,0);return out;});
 }

 function eyeLandmarks(source,view){
  if(view==='N'||view==='NE')return [];
  const Y=.23;
  const targets=view==='S'?[.34,.66]:view==='SE'?[.76]:[.875],d=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data,eyes=[];
  for(const target of targets){let best=null,score=Infinity;for(let y=Math.max(0,Math.floor((Y-.065)*source.height));y<Math.min(source.height,(Y+.065)*source.height);y++)for(let x=Math.max(0,Math.floor((target-.095)*source.width));x<Math.min(source.width,(target+.095)*source.width);x++){const i=(y*source.width+x)*4;if(d[i+3]<220||d[i]+d[i+1]+d[i+2]>120)continue;const q=((x/source.width-target)/.1)**2+((y/source.height-Y)/.07)**2;if(q<score){score=q;best=[x/source.width,y/source.height];}}if(best)eyes.push(best);}
  return eyes;
 }
 function nativeBox(){
  if(nativeBounds)return nativeBounds;
  const cv=previousSprite('wolf',null,null,1,'E'),fine=cv.fine||1;
  const d=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height).data;
  let x0=cv.width,y0=cv.height,x1=-1,y1=-1;
  for(let i=3;i<d.length;i+=4)if(d[i]){
   const x=(i>>2)%cv.width,y=((i>>2)/cv.width)|0;
   x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  }
  nativeBounds={x:x0/fine,y:y0/fine,w:(x1-x0+1)/fine,h:(y1-y0+1)/fine};
  return nativeBounds;
 }
 function baseParts(view){
  if(parts.has(view))return parts.get(view);
  const source=views[VIEWS.indexOf(view)],reference=views[VIEWS.indexOf('E')],b=nativeBox();
  const cv=mkCanvas(w*K,h*K),c=cv.getContext('2d',{willReadFrequently:true});
  const sc=Math.min(b.w/reference.width,b.h/reference.height),dw=source.width*sc,dh=source.height*sc;
  const x=(view==='E'?b.x+b.w/2:ax)-dw/2,y=b.y+b.h-dh;
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,x*K,y*K,dw*K,dh*K);
  const image=c.getImageData(0,0,cv.width,cv.height),d=image.data;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<140){d[i+3]=0;continue;}d[i+3]=255;const shade = coatColour(d[i],d[i+1],d[i+2]); d.set(shade,i);}
  c.putImageData(image,0,0);const cut=y+dh*.67,top=y+dh*.5,projection=new Int32Array(cv.width);
  // Locate the actual drawn paws. There may be only two visible paws from the
  // front/back; hidden legs are not duplicated into four artificial limbs.
  for(let py=Math.max(0,Math.floor((ay-dh*.13)*K));py<Math.min(cv.height,Math.ceil(ay*K));py++)for(let px=0;px<cv.width;px++)if(d[(py*cv.width+px)*4+3])projection[px]++;
  const groups=[];for(let px=0;px<cv.width;){if(!projection[px]){px++;continue;}const a=px;let sum=0,weighted=0;while(px<cv.width&&projection[px]){sum+=projection[px];weighted+=projection[px]*px;px++;}groups.push({x:weighted/sum/K,weight:sum});}const feet=groups.sort((a,b)=>b.weight-a.weight).slice(0,4).sort((a,b)=>a.x-b.x).map(q=>q.x);if(!feet.length)feet.push(ax);if(feet.length===1){feet.splice(0,1,x+dw*(view==='E'?.32:.3),x+dw*(view==='E'?.78:.7));}
  const buffers=Array.from({length:feet.length+2},()=>new Uint8ClampedArray(d.length));
  for(let py=0;py<cv.height;py++)for(let px=0;px<cv.width;px++){const i=(py*cv.width+px)*4;if(!d[i+3])continue;const yy=(py+.5)/K,xx=(px+.5)/K;let leg=0;for(let j=1;j<feet.length;j++)if(Math.abs(xx-feet[j])<Math.abs(xx-feet[leg]))leg=j;const ids=[];if(yy<cut+.65)ids.push(yy<top?feet.length+1:feet.length);if(yy>=cut-.65)ids.push(leg);for(const id of ids)buffers[id].set(d.subarray(i,i+4),i);}
  const layers=buffers.map(buf=>{const v=mkCanvas(cv.width,cv.height),g=v.getContext('2d'),im=g.createImageData(cv.width,cv.height);im.data.set(buf);g.putImageData(im,0,0);return v;});
  // Preserve the authored pupils when a 500px portrait becomes a tiny 2x
  // game animal. Back views are explicitly excluded, never given a face.
  const hc=layers[feet.length+1].getContext('2d');hc.fillStyle='#292117';for(const[ex,ey]of eyeLandmarks(source,view))hc.fillRect(Math.round((x+ex*dw)*K),Math.round((y+ey*dh)*K),1,1);
  if(view!=='N'&&view!=='NE'){const ny=.34,nx=view==='S'?.5:view==='SE'?.94:.985;hc.fillStyle='#342820';const px=Math.min(cv.width-1,Math.round((x+nx*dw)*K)),py=Math.round((y+ny*dh)*K); if(d[(py*cv.width+px)*4+3])hc.fillRect(px,py,1,1);}
  const limbs=feet.map((x,i)=>({source:i,x,far:!!(i%2),phase:i*Math.PI*.5}));if(feet.length===2){limbs.splice(0,2,{source:0,x:feet[0],far:true,phase:0},{source:1,x:feet[1],far:true,phase:Math.PI},{source:0,x:feet[0],far:false,phase:Math.PI*1.5},{source:1,x:feet[1],far:false,phase:Math.PI*.5});}else if(feet.length===3){const missing=feet[1]-feet[0]>feet[2]-feet[1]?0:2;limbs.push({source:missing,x:feet[missing],far:true,phase:Math.PI*1.5});}
  const p={w,h,ax,x,y,dw,dh,cut,limbs,legs:layers.slice(0,feet.length),body:layers[feet.length],head:layers[feet.length+1]};parts.set(view,p);return p;
 }

 function paint(c,p,view,f){
  if(f!=null&&(view==='S'||view==='N')){
   const pose=weightPose(p,f);
   function leg(track){
    c.save();
    c.translate(track.x+track.offset,p.cut+pose.hip);
    c.scale(1,track.stretch);
    c.drawImage(p.legs[track.source],-track.x,-p.cut,p.w,p.h);
    c.restore();
   }
   for(const track of pose.limbs)if(track.far)leg(track);
   c.drawImage(p.body,pose.lean,pose.hip,p.w,p.h);
   c.drawImage(p.head,pose.lean,pose.hip,p.w,p.h);
   for(const track of pose.limbs)if(!track.far)leg(track);
   return;
  }
  const idle=f==null,t=idle?0:f/12*Math.PI*2,bob=idle?0:Math.round(Math.sin(t*2)*.8)/K;
  const leg=L=>{const front=view==='S'||view==='N',phase=t+L.phase,sw=idle?0:Math.sin(phase)*(front?.035:.15),lift=idle?0:Math.max(0,Math.cos(phase))*.75;c.save();c.translate(L.x,p.cut-lift);c.rotate(sw);c.drawImage(p.legs[L.source],-L.x,-p.cut,p.w,p.h);c.restore();};
  for(const L of p.limbs.filter(q=>q.far))leg(L);c.drawImage(p.body,0,bob,p.w,p.h);c.drawImage(p.head,0,bob,p.w,p.h);for(const L of p.limbs.filter(q=>!q.far))leg(L);
 }

 // Quantize the weight shift and the landing plane on the common half-pixel
 // grid. A swing compresses the leg below its joint instead of sliding the
 // complete cutout upwards, so the shoulder and hip keep their overlap.
 function weightPose(p,f){
  const angle=f/12*Math.PI*2;
  const roundHalf=x=>Math.round(x*2)/2;
  const hip=roundHalf(Math.sin(angle*2)*.4);
  const lean=roundHalf(Math.cos(angle)*.5);
  const floor=p.y+p.dh;
  const length=floor-p.cut;
  const limbs=p.limbs.map(L=>{
   const side=L.x<p.ax?-1:1;
   const swing=Math.cos(angle)*-side*(L.far?-1:1);
   const lift=roundHalf(Math.max(0,swing)*(L.far?1:1.5));
   const depth=L.far?1:0;
   const offset=L.far?-side*.5:0;
   return {...L,lift,depth,offset,contact:floor-lift-depth,
    stretch:(length-lift-depth-hip)/length};
  });
  return {hip,lean,limbs};
 }

 function heading(u,face=1,view='E'){
  if(!u)return view==='E'&&face<0?'W':view;const old=facing.get(u);let dx=0,dy=0;
  if(u.path?.[u.pi||0]){const p=u.path[u.pi||0];dx=p[0]+.5-u.x;dy=p[1]+.5-u.y;}
  else if(u.action?.path?.[u.action.i||0]){const p=u.action.path[u.action.i||0];dx=p[0]+.5-u.x;dy=p[1]+.5-u.y;}
  else if(u.tx!=null&&u.ty!=null&&(u.tx||u.ty)){dx=u.tx-u.x;dy=u.ty-u.y;}
  if(Math.hypot(dx,dy)<.01&&old&&u.moving){dx=u.x-old.x;dy=u.y-old.y;}
  const dir=Math.hypot(dx,dy)>.001?['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2(dy,dx)/Math.PI*4)+8)%8]:old?.dir||(view==='E'&&face<0?'W':view);facing.set(u,{x:u.x,y:u.y,dir});return dir;
 }

 function paintBody(c,f,load,v){
   const p=baseParts(v);
   const back=v==='N'||v==='NE';
   if(back)paintCargo(c,p,load,v);
   paint(c,p,v,f);
   if(!back)paintCargo(c,p,load,v);
 }
 function paintCargo(c,p,load,v){
   if(!load)return;
   c.save();
   const mouth={
     E:[31.6,6.6], S:[p.ax,p.y+p.dh*.37],
     SE:[p.x+p.dw*.94,p.y+p.dh*.35],
     NE:[p.x+p.dw*.89,p.y+p.dh*.37], N:[p.ax,p.y+p.dh*.37]
   }[v];
   c.translate(...mouth);
   c.scale(.45,.45);
   drawLoad(c,load);
   c.restore();
 }
 // Only the portion beyond the native frame lives in this strip. This keeps
 // the original frame, silhouette, shadow, layering and root available to all
 // ordinary sprite callers. The world callback blits the strip in the same
 // depth slot immediately after the native frame.
 function cargoOverflow(load){
   if(cargoCache.has(load)){
     const stored=cargoCache.get(load);
     cargoCache.delete(load);
     cargoCache.set(load,stored);
     return stored;
   }
   const part=baseParts('E');
   const cv=mkCanvas(cargoWidth*K,h*K);
   const c=cv.getContext('2d',{willReadFrequently:true});
   c.scale(K,K);
   c.translate(-w,0);
   paintCargo(c,part,load,'E');
   const rgba=c.getImageData(0,0,cv.width,cv.height);
   for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=rgba.data[i]>=128?255:0;
   c.putImageData(rgba,0,0);
   cv.fine=K;
   cargoCache.set(load,cv);
   if(cargoCache.size>maxCargoEntries)cargoCache.delete(cargoCache.keys().next().value);
   return cv;
 }
 function sprite(f,load,view='E'){
   const [v,flip]=canonical(view), frame=f==null?null:((f|0)%12+12)%12;
   const key=[v,flip,frame,load||''].join('|');
   if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}
   const cv=mkCanvas(w*K,h*K);
   const c=cv.getContext('2d',{willReadFrequently:true});
   c.scale(K,K);c.imageSmoothingEnabled=false;
   if(flip){c.translate(ax*2,0);c.scale(-1,1);}
   paintBody(c,frame,load,v);
   const pixels=c.getImageData(0,0,cv.width,cv.height);
   for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=128?255:0;
   c.putImageData(pixels,0,0);
   cv.fine=K;cache.set(key,cv);
   if(cache.size>maxSpriteEntries)cache.delete(cache.keys().next().value);
   return cv;
 }
 api.ready=new Promise(resolve=>{
   const im=new Image();
   im.onload=()=>{try{views=split(im);}catch(e){api.errors.push(e.message);}resolve();};
   im.onerror=()=>{api.errors.push('assets/fantasy/wolf-atlas.png');resolve();};
   im.src='assets/fantasy/wolf-atlas.png';
 });
 creatureSprite=function(kind,f,load,n,view){
   return kind==='wolf'&&views?sprite(f,load,view):previousSprite(kind,f,load,n,view);
 };
 drawCreatureAt=function(c,kind,x,y,face,moving,phase,load,n,view='E'){
   if(kind!=='wolf'||!views)return previousAt(c,kind,x,y,face,moving,phase,load,n,view);
   const entity=Game.animals.find(a=>a.kind==='wolf'&&Math.round(a.x*TILE)===x&&Math.round(a.y*TILE+4)===y);
   const dir=heading(entity,face,view);
   const [v,flip]=canonical(dir);
   const result=previousAt(c,kind,x,y,flip?-1:1,moving,phase,load,n,v);
   if(v==='E'&&load){
     const strip=cargoOverflow(load);
     c.save();
     c.translate(x,y);
     if(flip)c.scale(-1,1);
     afBlit(c,strip,w-ax,-ay);
     c.restore();
   }
   return result;
 };
})();
