'use strict';
// Authored five-view mammals. Game data, native clocks, footprints and the
// outer cargo/prey transforms remain native; orientation is transient only.
(() => {
 if(window.FantasyPublishedAnimals)return;
 const K=2,VIEWS=['S','SE','E','NE','N'],KINDS=['rabbit','deer','wolf','goat','fox','elk','horse','pig'];
 const previousSprite=creatureSprite,previousAt=drawCreatureAt,previousUnit=drawUnit,previousPig=pigSpriteHR,previousPigs=drawPigs,previousPen=drawPenAnimals;
 const cache=new Map(),weights=new Map(),parts=new Map(),nativeBoxes=new Map(),facing=new WeakMap();let bytes=0,actor=null,penContext=null,pigContext=null,indexTime=null,indexList=null,index=new Map();
 const A=window.FantasyPublishedAnimals={version:1,images:{},errors:[],cache,parts,views:VIEWS,kinds:KINDS,ready:null,native:{creatureSprite:previousSprite,drawCreatureAt:previousAt,drawUnit:previousUnit,pigSpriteHR:previousPig,drawPigs:previousPigs},sprite,heading,stats:()=>({entries:cache.size,bytes,maxEntries:1024,maxBytes:33554432,parts:parts.size}),context:u=>actor=u};
 const canonical=v=>({SW:['SE',true],W:['E',true],NW:['NE',true]})[v]||[VIEWS.includes(v)?v:'E',false];
 function put(key,cv){cache.set(key,cv);const size=cv.width*cv.height*4;weights.set(key,size);bytes+=size;while(cache.size>1024||bytes>33554432){const k=cache.keys().next().value;bytes-=weights.get(k)||0;weights.delete(k);cache.delete(k);}return cv;}
 function hit(key){if(!cache.has(key))return null;const cv=cache.get(key);cache.delete(key);cache.set(key,cv);return cv;}
 function clear(){cache.clear();weights.clear();parts.clear();bytes=0;}
 // Split by real opaque components, not equal-width cells: a side-view tail is
 // wider than a frontal animal. Whiskers remain attached to their nearest body.
 function split(image){
  const w=image.width,h=image.height,cv=mkCanvas(w,h),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const im=c.getImageData(0,0,w,h),d=im.data,labels=new Int32Array(w*h),queue=new Int32Array(w*h),groups=[];let seq=0;
  for(let i=0;i<w*h;i++){if(labels[i]||d[i*4+3]<220)continue;const id=++seq;let n=0,tail=1,x0=w,y0=h,x1=-1,y1=-1;queue[0]=i;labels[i]=id;while(n<tail){const p=queue[n++],x=p%w,y=(p/w)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const q of [x? p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!labels[q]&&d[q*4+3]>=220){labels[q]=id;queue[tail++]=q;}}groups.push({id,n:tail,x0,y0,x1,y1});}
  const main=groups.slice().sort((a,b)=>b.n-a.n).slice(0,5).sort((a,b)=>a.x0-b.x0);if(main.length!==5)throw Error('Expected five opaque animal views');const owners=new Map(main.map((q,i)=>[q.id,i])),bounds=main.map(q=>({...q}));
  for(const g of groups){if(owners.has(g.id)||g.n<3)continue;let best=-1,dist=Infinity;for(let j=0;j<main.length;j++){const q=main[j],dx=Math.max(q.x0-g.x1,g.x0-q.x1,0),dy=Math.max(q.y0-g.y1,g.y0-q.y1,0),v=dx*dx+dy*dy;if(v<dist){dist=v;best=j;}}if(dist<=1600){owners.set(g.id,best);const b=bounds[best];b.x0=Math.min(b.x0,g.x0);b.x1=Math.max(b.x1,g.x1);b.y0=Math.min(b.y0,g.y0);b.y1=Math.max(b.y1,g.y1);}}
  return bounds.map((b,j)=>{const out=mkCanvas(b.x1-b.x0+1,b.y1-b.y0+1),g=out.getContext('2d'),pixels=g.createImageData(out.width,out.height);for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){const i=y*w+x;if(owners.get(labels[i])!==j)continue;const o=((y-b.y0)*out.width+x-b.x0)*4;pixels.data[o]=d[i*4];pixels.data[o+1]=d[i*4+1];pixels.data[o+2]=d[i*4+2];pixels.data[o+3]=255;}g.putImageData(pixels,0,0);return out;});
 }
 A.ready=Promise.all(KINDS.map(kind=>new Promise(resolve=>{const im=new Image();im.onload=()=>{try{A.images[kind]=split(im);}catch(e){A.errors.push(kind+': '+e.message);}clear();resolve();};im.onerror=()=>{A.errors.push(kind+': image load');resolve();};im.src='assets/fantasy/animal-'+kind+'-views-v'+(kind==='rabbit'?2:1)+'.png';})));
 function eyeLandmarks(source,kind,view){
  if(view==='N'||view==='NE')return [];
  const Y={rabbit:view==='S'?.47:.44,deer:.265,goat:.245,wolf:.23,fox:.24,elk:.28,horse:.18,pig:.27}[kind]||.25;
  const targets=view==='S'?[.34,.66]:view==='SE'?[.76]:[.875],d=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data,eyes=[];
  for(const target of targets){let best=null,score=Infinity;for(let y=Math.max(0,Math.floor((Y-.065)*source.height));y<Math.min(source.height,(Y+.065)*source.height);y++)for(let x=Math.max(0,Math.floor((target-.095)*source.width));x<Math.min(source.width,(target+.095)*source.width);x++){const i=(y*source.width+x)*4;if(d[i+3]<220||d[i]+d[i+1]+d[i+2]>120)continue;const q=((x/source.width-target)/.1)**2+((y/source.height-Y)/.07)**2;if(q<score){score=q;best=[x/source.width,y/source.height];}}if(best)eyes.push(best);}
  return eyes;
 }
 function nativeBox(kind){
  if(nativeBoxes.has(kind))return nativeBoxes.get(kind);const cv=kind==='pig'?previousPig(3,0):previousSprite(kind,null,null,1,'E'),fine=cv.fine||1,d=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let i=3;i<d.length;i+=4)if(d[i]){const x=(i>>2)%cv.width,y=((i>>2)/cv.width)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const b={x:x0/fine,y:y0/fine,w:(x1-x0+1)/fine,h:(y1-y0+1)/fine,ax:kind==='pig'?12:CR_SIZE[kind][2],ay:kind==='pig'?13:CR_SIZE[kind][3]};nativeBoxes.set(kind,b);return b;
 }
 function baseParts(kind,view,w,h,ax,ay){
  const asset=kind==='packgoat'?'goat':kind,key=[asset,view,w,h,ax,ay].join('|');if(parts.has(key))return parts.get(key);const source=A.images[asset]?.[VIEWS.indexOf(view)];if(!source)return null;
  const b=nativeBox(kind),reference=A.images[asset][VIEWS.indexOf('E')],cv=mkCanvas(w*K,h*K),c=cv.getContext('2d',{willReadFrequently:true}),sc=Math.min(b.w/reference.width,b.h/reference.height),dw=source.width*sc,dh=source.height*sc,x=(view==='E'?b.x+b.w/2:ax)-dw/2,y=b.y+b.h+(ay-b.ay)-dh;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,x*K,y*K,dw*K,dh*K);const image=c.getImageData(0,0,cv.width,cv.height),d=image.data;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<140){d[i+3]=0;continue;}d[i+3]=255;for(let j=0;j<3;j++)d[i+j]=Math.round(d[i+j]/8)*8;}
  c.putImageData(image,0,0);const hoof=['deer','elk','goat','horse'].includes(asset),cut=y+dh*(hoof?.65:asset==='rabbit'?.84:.67),top=y+dh*(hoof?.44:.5),projection=new Int32Array(cv.width);
  // Locate the actual drawn paws. There may be only two visible paws from the
  // front/back; hidden legs are not duplicated into four artificial limbs.
  for(let py=Math.max(0,Math.floor((ay-dh*.13)*K));py<Math.min(cv.height,Math.ceil(ay*K));py++)for(let px=0;px<cv.width;px++)if(d[(py*cv.width+px)*4+3])projection[px]++;
  const groups=[];for(let px=0;px<cv.width;){if(!projection[px]){px++;continue;}const a=px;let sum=0,weighted=0;while(px<cv.width&&projection[px]){sum+=projection[px];weighted+=projection[px]*px;px++;}groups.push({x:weighted/sum/K,weight:sum});}const feet=groups.sort((a,b)=>b.weight-a.weight).slice(0,4).sort((a,b)=>a.x-b.x).map(q=>q.x);if(!feet.length)feet.push(ax);if(feet.length===1){feet.splice(0,1,x+dw*(view==='E'?.32:.3),x+dw*(view==='E'?.78:.7));}
  const buffers=Array.from({length:feet.length+2},()=>new Uint8ClampedArray(d.length));
  for(let py=0;py<cv.height;py++)for(let px=0;px<cv.width;px++){const i=(py*cv.width+px)*4;if(!d[i+3])continue;const yy=(py+.5)/K,xx=(px+.5)/K;let leg=0;for(let j=1;j<feet.length;j++)if(Math.abs(xx-feet[j])<Math.abs(xx-feet[leg]))leg=j;const ids=[];if(yy<cut+.65)ids.push(yy<top?feet.length+1:feet.length);if(yy>=cut-.65)ids.push(leg);for(const id of ids)buffers[id].set(d.subarray(i,i+4),i);}
  if(hoof||asset==='pig')for(const buf of buffers.slice(0,feet.length)){let bottom=-1;for(let i=3;i<buf.length;i+=4)if(buf[i])bottom=Math.max(bottom,((i>>2)/cv.width)|0);if(bottom>=0)for(let px=0;px<cv.width;px++){const i=(bottom*cv.width+px)*4;if(buf[i+3]){buf[i]=Math.min(buf[i],70);buf[i+1]=Math.min(buf[i+1],57);buf[i+2]=Math.min(buf[i+2],43);}}}
  const layers=buffers.map(buf=>{const v=mkCanvas(cv.width,cv.height),g=v.getContext('2d'),im=g.createImageData(cv.width,cv.height);im.data.set(buf);g.putImageData(im,0,0);return v;});
  // Preserve the authored pupils when a 500px portrait becomes a tiny 2x
  // game animal. Back views are explicitly excluded, never given a face.
  const hc=layers[feet.length+1].getContext('2d');hc.fillStyle='#292117';for(const[ex,ey]of eyeLandmarks(source,asset,view))hc.fillRect(Math.round((x+ex*dw)*K),Math.round((y+ey*dh)*K),1,1);
  if(view!=='N'&&view!=='NE'){const ny={rabbit:view==='S'?.62:.55,deer:.35,goat:.36,wolf:.34,fox:.35,elk:.43,horse:.33,pig:.43}[asset]||.35,nx=view==='S'?.5:view==='SE'?.94:.985;hc.fillStyle=asset==='rabbit'?'#b77b70':asset==='pig'?'#af6870':'#342820';hc.fillRect(Math.min(cv.width-1,Math.round((x+nx*dw)*K)),Math.round((y+ny*dh)*K),1,1);}
  const limbs=feet.map((x,i)=>({source:i,x,far:!!(i%2),phase:i*Math.PI*.5}));if(feet.length===2){limbs.splice(0,2,{source:0,x:feet[0],far:true,phase:0},{source:1,x:feet[1],far:true,phase:Math.PI},{source:0,x:feet[0],far:false,phase:Math.PI*1.5},{source:1,x:feet[1],far:false,phase:Math.PI*.5});}else if(feet.length===3){const missing=feet[1]-feet[0]>feet[2]-feet[1]?0:2;limbs.push({source:missing,x:feet[missing],far:true,phase:Math.PI*1.5});}
  const p={w,h,ax,ay,x,y,dw,dh,cut,top,feet,limbs,legs:layers.slice(0,feet.length),body:layers[feet.length],head:layers[feet.length+1],whole:cv};parts.set(key,p);return p;
 }
 function paint(c,p,kind,view,f){
  const idle=f==null,t=idle?0:f/12*Math.PI*2,hop=kind==='rabbit'&&!idle?Math.abs(Math.sin(t))*2.4:0,bob=idle?0:Math.round(Math.sin(t*2)*.8)/K;
  const leg=L=>{const front=view==='S'||view==='N',phase=t+L.phase,sw=idle?0:Math.sin(phase)*(front?.035:.15),lift=idle?0:Math.max(0,Math.cos(phase))*.75;c.save();c.translate(L.x,p.cut-hop-lift);c.rotate(sw);c.drawImage(p.legs[L.source],-L.x,-p.cut,p.w,p.h);c.restore();};
  for(const L of p.limbs.filter(q=>q.far))leg(L);c.drawImage(p.body,0,bob-hop,p.w,p.h);c.drawImage(p.head,0,bob-hop,p.w,p.h);for(const L of p.limbs.filter(q=>!q.far))leg(L);
 }
 function gear(c,kind,load,n,view,f,w,h,ax,ay){
  if(!load&&kind!=='packgoat')return;
  const front=view==='S'||view==='N',rear=view==='N'||view==='NE';
  if(kind==='packgoat'){
   const x=front?ax-4:ax-4.6,y=ay-14;c.fillStyle='#382a20';c.fillRect(x-.5,y-.5,8.8,7.2);c.fillStyle='#946a43';c.fillRect(x,y,7.8,5.8);c.fillStyle='#b78c58';c.fillRect(x+.5,y+.5,6.8,1.2);c.fillStyle='#60462e';c.fillRect(x+3,y+1,1,4.8);c.fillStyle='#d0aa59';c.fillRect(x+2.8,y+2.4,1.5,1.2);if(load){c.save();c.translate(front?ax:ax-.6,ay-15.6);c.scale(.7,.7);drawLoad(c,load);c.restore();}return;
  }
  if(kind==='rabbit'&&typeof petGear==='function'){const hop=f==null?0:Math.abs(Math.sin(f/12*Math.PI*2))*2.4;c.save();c.translate(ax,ay-11-hop);petGear(c,load,front?0:3.2,4.8,0,5.2);c.restore();return;}
  if(['wolf','fox','elk'].includes(kind)&&load){const native={wolf:[15.6,6.6,.45],fox:[10.6,6.4,.4],elk:[20,25,.45]}[kind];c.save();c.translate(front?ax:ax+native[0],front?ay-h*.38:native[1]);c.scale(native[2],native[2]);drawLoad(c,load);c.restore();}
 }
 function cartSprite(f,load,n,view){
  const driverKey=actor?.type==='carter'?JSON.stringify([actor.type,actor.look,personSex(actor),typeof haOf==='function'?haOf(actor):null]):'default';const[v,flip]=canonical(view),frame=f==null?null:((f|0)%12+12)%12,key=['cart',v,flip,frame,load||'',Math.min(5,Math.max(0,n|0)),driverKey].join('|'),got=hit(key);if(got)return got;
  const cv=mkCanvas(112,76),c=cv.getContext('2d',{willReadFrequently:true});c.scale(K,K);c.imageSmoothingEnabled=false;if(flip){c.translate(56,0);c.scale(-1,1);}const[dx,dy]={E:[1,0],SE:[.707,.707],S:[0,1],NE:[.707,-.707],N:[0,-1]}[v],rear=dy<0,t=frame==null?0:frame/12*Math.PI*2,ax=28,ay=33,cx=ax-12*dx,cy=19-2*dy;
  const polygon=(points,colour)=>{c.fillStyle=colour;c.beginPath();c.moveTo(...points[0]);for(const p of points)c.lineTo(...p);c.closePath();c.fill();},stroke=(a,b,col,width=.6)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();};
  const wheel=(x,y,dark)=>{c.save();c.translate(x,y);c.scale(Math.max(.28,Math.abs(dx)),1);c.fillStyle='#342a21';c.beginPath();c.arc(0,0,5.4,0,Math.PI*2);c.fill();c.fillStyle=dark?'#654b35':'#a07846';c.beginPath();c.arc(0,0,4.5,0,Math.PI*2);c.fill();c.strokeStyle=dark?'#9b7a4a':'#d1aa68';c.lineWidth=.6;c.beginPath();c.arc(0,0,4.1,Math.PI,Math.PI*1.8);c.stroke();for(let i=0;i<6;i++){const a=i/6*Math.PI*2+t*.5;stroke([0,0],[Math.cos(a)*3.8,Math.sin(a)*3.8],'#4b3929',.7);}c.fillStyle='#c4ab70';c.fillRect(-.7,-.7,1.4,1.4);c.restore();};
  const horse=sprite('horse',frame,null,1,v),hx=ax+12.6*dx,horseFoot=dy<0?33+dy*9:33,hy=horseFoot-30;
  const drawHorse=()=>{c.drawImage(horse,hx-18,hy,36,30);};
  wheel(ax-14*dx-9.6*dy,dy?27:25,true);if(rear)drawHorse();
  const along=[dx*11,dy*3],across=[-dy*8,dx*2.4],q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[cx+a*along[0]+b*across[0],cy+a*along[1]+b*across[1]]);
  polygon(q,'#bb915b');for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];if((a[1]+b[1])/2<cy-.1)continue;polygon([a,b,[b[0],b[1]+5.5],[a[0],a[1]+5.5]],i%2?'#795332':'#946a41');stroke(a,b,'#dfbd7d',.7);stroke([a[0],a[1]+5.3],[b[0],b[1]+5.3],'#493625',.7);for(const k of [1.8,3.6])stroke([a[0],a[1]+k],[b[0],b[1]+k],'#65472e',.45);for(const p of[a,b]){c.fillStyle='#c4a570';c.fillRect(p[0]-.4,p[1]+1.2,.8,.8);}}
  for(let i=1;i<4;i++)stroke([q[0][0]+(q[1][0]-q[0][0])*i/4,q[0][1]+(q[1][1]-q[0][1])*i/4],[q[3][0]+(q[2][0]-q[3][0])*i/4,q[3][1]+(q[2][1]-q[3][1])*i/4],'#8a6139',.5);
  if(load)for(let i=0;i<Math.min(5,n||0);i++){c.save();if(v==='E')c.translate(8+(i%3)*6.5,16-Math.floor(i/3)*4.4);else c.translate(cx-5.4+(i%3)*5.4,16+dy*(dy>0?-4:-6)-Math.floor(i/3)*4.2);c.scale(.62,.62);drawLoad(c,load);c.restore();}
  // The driver is the current approved dwarf renderer, never a second head.
  const holder=actor?.type==='carter'?actor:{type:'carter',look:3,sx:'m'},gv=rear?'N':v==='S'?'S':'E',driver=personSprite({...holder,carry:null},gv,'idle',0,{}),gx=v==='E'?24:cx+3*dx,gy=v==='E'?19:cy-2;c.drawImage(driver,gx-PFX*.4,gy-PFY*.4,PW*.4,PH*.4);
  if(!rear)drawHorse();wheel(ax-14*dx+9.6*dy,dy?27:28,false);if(v==='E'){stroke([34,18],[50,14],'#3d3024',.6);stroke([49,15],[53,11],'#3d3024',.5);stroke([26.4,15],[34,17],'#3d3024',.4);}else{stroke([gx+2,gy-3],[hx,horseFoot-15],'#3d3024',.5);stroke([cx+3*dx,cy+5],[hx,horseFoot-8],'#4b3826',.7);}
  cv.fine=K;cv._fantasyAnimal={kind:'cart',view,frame,anchor:[28,33],driver:'current personSprite',cargo:n||0};return put(key,cv);
 }
 function sprite(kind,f,load,n=1,view='E'){
  if(kind==='cart'&&A.images.horse)return cartSprite(f,load,n,view);
  const asset=kind==='packgoat'?'goat':kind;if(!A.images[asset]||!CR_SIZE[kind])return previousSprite(kind,f,load,n,view);
  const [v,flip]=canonical(view),frame=f==null?null:((f|0)%crFrames(kind)+crFrames(kind))%crFrames(kind),key=[kind,v,flip,frame,load||'',Math.min(5,Math.max(0,n|0))].join('|'),got=hit(key);if(got)return got;
  const[w,h,ax,ay]=CR_SIZE[kind],p=baseParts(kind,v,w,h,ax,ay),cv=mkCanvas(w*K,h*K),c=cv.getContext('2d',{willReadFrequently:true});c.scale(K,K);c.imageSmoothingEnabled=false;if(flip){c.translate(ax*2,0);c.scale(-1,1);}const behind=(v==='N'||v==='NE')&&['wolf','fox','elk'].includes(kind);if(behind)gear(c,kind,load,n,v,frame,w,h,ax,ay);paint(c,p,kind,v,frame);if(!behind)gear(c,kind,load,n,v,frame,w,h,ax,ay);cv.fine=K;cv._fantasyAnimal={kind,view,frame,anchor:[ax,ay],parts:p.feet.length+2};return put(key,cv);
 }
 function heading(u,face=1,view='E'){
  if(!u)return view==='E'&&face<0?'W':view;const old=facing.get(u);let dx=0,dy=0;
  if(u.path?.[u.pi||0]){const p=u.path[u.pi||0];dx=p[0]+.5-u.x;dy=p[1]+.5-u.y;}
  else if(u.action?.path?.[u.action.i||0]){const p=u.action.path[u.action.i||0];dx=p[0]+.5-u.x;dy=p[1]+.5-u.y;}
  else if(u.tx!=null&&u.ty!=null&&(u.tx||u.ty)){dx=u.tx-u.x;dy=u.ty-u.y;}
  if(Math.hypot(dx,dy)<.01&&old&&u.moving){dx=u.x-old.x;dy=u.y-old.y;}
  const dir=Math.hypot(dx,dy)>.001?['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2(dy,dx)/Math.PI*4)+8)%8]:old?.dir||(view==='E'&&face<0?'W':view);facing.set(u,{x:u.x,y:u.y,dir});return dir;
 }
 function entity(kind,px,py){if(actor)return actor;if(penContext){const q=penContext,b=q.b;for(const u of b._pen||[])if(Math.abs(u.x+q.ox-px)<.1&&Math.abs(u.y+q.oy-py)<.1)return u;}if(indexTime!==Game.time||indexList!==Game.animals){indexTime=Game.time;indexList=Game.animals;index=new Map();for(const u of Game.animals||[])index.set([u.kind,Math.round(u.x*TILE),Math.round(u.y*TILE+4)].join('|'),u);}return index.get([kind,Math.round(px),Math.round(py)].join('|'));}
 creatureSprite=function(kind,f,load,n=1,view='E'){return sprite(kind,f,load,n,view);};
 drawCreatureAt=function(c,kind,px,py,face,moving,phase,load,n,view='E'){
  if(!A.images[kind==='packgoat'?'goat':kind==='cart'?'horse':kind]||!CR_SIZE[kind])return previousAt(c,kind,px,py,face,moving,phase,load,n,view);
  const dir=heading(entity(kind,px,py),face,view),[v,flip]=canonical(dir);return previousAt(c,kind,px,py,flip?-1:1,moving,phase,load,n,v);
 };
 drawUnit=function(c,u){if(u.type!=='goat'&&u.type!=='carter')return previousUnit(c,u);const old=actor;actor=u;try{return previousUnit(c,u);}finally{actor=old;}};
 drawPenAnimals=function(c,b,s,ox,oy){const old=penContext;penContext={b,ox,oy};try{return previousPen(c,b,s,ox,oy);}finally{penContext=old;}};
 // The pen retains native bilinear positions, scale by growth, and two-frame
 // step clock. Pigs share the same new anatomical rig rather than old rows.
 pigSpriteHR=function(stage,f){let view='E',outerFlip=false;if(pigContext){const k=pigContext.cursor++,b=pigContext.b,q=pigContext.s.penQuad,t=Game.time*.22+k*2.3+b.id,du=Math.cos(t)*.44,dv=-Math.sin(t*.7+k*1.7)*.294,dx=du*(q[1][0]-q[0][0])+dv*(q[2][0]-q[0][0]),dy=du*(q[1][1]-q[0][1])+dv*(q[2][1]-q[0][1]);view=['E','SE','S','SW','W','NW','N','NE'][(Math.round(Math.atan2(dy,dx)/Math.PI*4)+8)%8];outerFlip=Math.cos(t)<0;}return pigSprite(stage,f,view,outerFlip);};
 function pigSprite(stage,f,view='E',outerFlip=false){if(!A.images.pig)return previousPig(stage,f);const[v,mirror]=canonical(view),flip=mirror!==outerFlip,s=Math.max(1,Math.min(3,stage|0)),frame=(f|0)&1,key=['pig',s,frame,v,flip].join('|'),got=hit(key);if(got)return got;const w=24,h=16,p=baseParts('pig',v,w,h,12,14),cv=mkCanvas(w*K,h*K),c=cv.getContext('2d',{willReadFrequently:true});c.scale(K,K);if(flip){c.translate(24,0);c.scale(-1,1);}const scale=[.55,.75,1][s-1];c.translate(12,13);c.scale(scale,scale);c.translate(-12,-14);paint(c,p,'pig',v,frame?3:null);cv.fine=K;cv._fantasyAnimal={kind:'pig',view,frame,anchor:[12,13],stage:s,outerFlipCompensated:outerFlip};return put(key,cv);};
 A.pigSprite=pigSprite;
 drawPigs=function(c,b,s,ox,oy){const old=pigContext;pigContext={b,s,cursor:0};try{return previousPigs(c,b,s,ox,oy);}finally{pigContext=old;}};
 A.ready.then(()=>{if(typeof PORTRAIT_CACHE!=='undefined')PORTRAIT_CACHE.clear();});
})();



