'use strict';
// Approved atlas silhouettes are invariant for ordinary dwarves: colour-only.
// Explicit native HA choices replace only a semantic source component. The face,
// native action props, HA data model and saved unit state are preserved.
(() => {
 if(window.FantasyPublishedAppearanceArt)return;
 const previous=personSprite,previousPortrait=portraitURL,cache=new Map(),portraitCache=new Map(),bodyMasks=new WeakMap(),lastFrame=new Map(),K=2;
 const api=window.FantasyPublishedAppearanceArt={version:3,cache,portraitCache,resolve,render,base:previous,geometry,capLayout,removeHat:(u,v,p,f,o={})=>render(u,v,p,f,{...o,nohat:true}),ready:Promise.resolve(FantasyPublishedArt.ready)};

 let pixelReader=null,pixelReaderReady=false,pendingRead=null,workerReads=0;
 function disablePixelReader(error){
  pixelReaderReady=false;
  pixelReader?.terminate();
  pixelReader=null;
  if(pendingRead){
   const request=pendingRead;
   pendingRead=null;
   clearTimeout(request.timeout);
   request.reject(error);
  }
 }
 function startPixelReader(){
  if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function')return;
  try{pixelReader=new Worker('js/fantasy-pixel-read-worker.js');}catch(error){return;}
  pixelReader.onerror=event=>{event.preventDefault();disablePixelReader(Error('Sprite pixel worker unavailable'));};
  pixelReader.onmessage=({data})=>{
   if(data?.ready){pixelReaderReady=true;return;}
   if(!pendingRead)return;
   const request=pendingRead;
   pendingRead=null;
   clearTimeout(request.timeout);
   if(data instanceof ArrayBuffer&&data.byteLength===request.width*request.height*4){
    workerReads++;
    request.resolve(new ImageData(new Uint8ClampedArray(data),request.width,request.height));
   }else request.reject(Error(data?.error||'Invalid sprite pixels'));
  };
 }
 api.ready.then(startPixelReader);
 api.pixelReaderStats=()=>({ready:pixelReaderReady,reads:workerReads});
 function pixelRequest(canvas,x=0,y=0,width=canvas.width,height=canvas.height){return{canvas,x,y,width,height};}
 function readInline({canvas,x,y,width,height}){return canvas.getContext('2d').getImageData(x,y,width,height);}
 async function readInWorker(request){
  if(!pixelReaderReady||pendingRead)return readInline(request);
  const {canvas,x,y,width,height}=request;
  const bitmap=await createImageBitmap(canvas,{colorSpaceConversion:'none'});
  try{
   return await new Promise((resolve,reject)=>{
    if(!pixelReaderReady||pendingRead){reject(Error('Sprite pixel worker busy'));return;}
    const timeout=setTimeout(()=>disablePixelReader(Error('Sprite pixel read timed out')),3000);
    pendingRead={resolve,reject,width,height,timeout};
    try{pixelReader.postMessage({bitmap,x,y,width,height},[bitmap]);}catch(error){disablePixelReader(error);}
   });
  }finally{bitmap.close();}
 }
 function buildInline(builder){
  let step=builder.next();
  while(!step.done)step=builder.next(readInline(step.value));
  return step.value;
 }
 async function buildWithoutReadback(builder){
  let step=builder.next();
  while(!step.done){
   let pixels;
   try{pixels=await readInWorker(step.value);}catch(error){pixels=readInline(step.value);}
   step=builder.next(pixels);
  }
  return step.value;
 }
 function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.round(w*2)/2,Math.round(h*2)/2);}
 function oval(c,x,y,rx,ry,col){c.fillStyle=col;for(let yy=Math.floor((y-ry)*2)/2;yy<y+ry;yy+=.5){const q=(yy+.25-y)/ry;if(Math.abs(q)>=1)continue;const z=Math.sqrt(1-q*q)*rx,a=Math.ceil((x-z)*2)/2,b=Math.floor((x+z)*2)/2;if(b>a)c.fillRect(a,yy,b-a,.5);}}
 function shape(c,p,col){c.fillStyle=col;for(let y=Math.floor(Math.min(...p.map(a=>a[1]))*2)/2;y<Math.max(...p.map(a=>a[1]));y+=.5){const hits=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],q=y+.25;if((a[1]<=q&&b[1]>q)||(b[1]<=q&&a[1]>q))hits.push(a[0]+(q-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]*2)/2,z=Math.ceil(hits[i+1]*2)/2;if(z>x)c.fillRect(x,y,z-x,.5);}}}
 function rgb(s,fallback='#66834e'){return hexToRgb(typeof s==='string'&&/^#[0-9a-f]{3,6}$/i.test(s)?s:fallback);}
 function resolve(u){let holder=u,app=typeof haOf==='function'?haOf(u):null;if(!app&&u.type.includes('~')){const tail=u.type.slice(u.type.indexOf('~')+1).split('.').map(Number);if(tail.length===HA_MAX.length&&tail.every(Number.isInteger))app=haClean(tail);}if(u.type==='hero'){const t=app?haType(haBase(u),app):haBase(u);holder={...u,type:t,sx:personSex(u)};}const O=OUTFIT[holder.type]||OUTFIT.serf,sex=personSex(holder)==='f'||O.fem||holder.type==='waitress'?'f':'';const look=(holder.look>>>0)>=0x20000?holder.look:LOOK_POOL[(holder.look>>>0)%LOOK_POOL.length];holder={...holder,look,sx:sex};const L=lookOf(holder);const cap=O.cap==='serf'?L.serfCap:O.cap==='wizard'?'#6b527c':O.cap==='baker'?'#eee5d1':O.cap==='waitress'?'#efe8d9':typeof O.cap==='string'&&O.cap.startsWith('cls:')?O.tint||HA_CLS_CAP[O.cap.slice(4)]||'#9a9c99':O.cap;
  const guild=dwarfGuildWear(holder),nativeCoat=O.robe?O.robeCol||O.coat||L.green:O.coat||L.green;
  const coat=guild&&!(app?.[7]>=0)?guild.style.coat:nativeCoat;
  const beard=app?.[2]>=0?HA_BEARD_COLS[app[2]]:L.bcol||BEARDS[L.beard%BEARDS.length];
  const workwearDefault=!guild&&dwarfWorkwear(holder)&&!(app?.[2]>=0);
  return{holder,app,O,L,sex,look,cap,coat,guild,beard,beardTone:beardTone(workwearDefault?'#493326':beard),hair:O.fem?HAIR:L.hair||L.bcol||BEARDS[L.beard%BEARDS.length]};}
 function beardTone(colour){
  const channels=rgb(colour),peak=Math.max(...channels);
  // Compress only the top end of the palette. Keep silver, cream and brown
  // distinct so a colour chosen in the editor is still recognizable.
  const gain=peak>174?(174+(peak-174)*.18)/peak:1;
  return '#'+channels.map(value=>Math.round(value*gain).toString(16).padStart(2,'0')).join('');
 }
 function geometry(q,view,pose,frame,opt={}){const child=q.holder.type==='kid',a=FantasyArt.images[child?'gnome-child':q.sex==='f'?'gnome-woman-walk':'gnome-walk'];if(!a?.frames)return null;const f=pose==='walk'?Math.floor((frame%WALK_FRAMES)*8/WALK_FRAMES):0,row=view==='E'?1:view==='N'?2:0;const src=a.frames[child?((pose==='work'?4:0)+(pose==='walk'?Math.floor((frame%WALK_FRAMES)*4/WALK_FRAMES):pose==='work'?Math.floor((frame.f%WORK_FRAMES)*4/WORK_FRAMES):0)):row*8+f],s=Math.min((child?21:25)/a.maxW,(child?27:33)/a.maxH),dh=src[3]*s,top=PFY-Math.round(dh),[shear,dip]=fpaBodyMotion(view,pose,frame,opt);
  return{art:a,src,scale:s,dw:src[2]*s,top,dh,dip,shear,capY:top+dh*(q.sex==='f'?.22:.23),headY:top+dh*.30,child};}
 function transformed(c,G,fn){c.save();c.translate(PFX,PFY);c.transform(1,0,G.shear,1,0,G.dip);c.translate(-PFX,-PFY);fn();c.restore();}
 function bareCrown(c,q,G,view){const x=PFX+(view==='E'?-.4:0),y=G.capY+1,col=q.hair;oval(c,x,y+1.2,5.1,3.1,SKINS[q.L.skin%3][0]);oval(c,x-.1,y,5.3,2.7,shade(col,-.24));oval(c,x-1,y-.6,4.1,1.9,col);rect(c,x-2,y-1.5,3,.5,shade(col,.24));}
 function hair(c,q,G,view){const L=q.L,col=q.hair,x=PFX,y=G.headY-1,hs=(L.hs||0)%6;const H=[shade(col,.22),col,shade(col,-.32)];
  if(view==='N'){oval(c,x,G.capY+3,5,4,col);rect(c,x-1,G.capY+1,.5,5,H[0]);}
  // Temples/fringe retain a visible hair colour even under kerchief or bonnet.
  if(view!=='N'){for(const side of view==='E'?[-1]:[-1,1]){oval(c,x+side*4.8,y,1.2,3,col);rect(c,x+side*4.5-.2,y-1,.5,2,H[0]);}}
  c.save();c.translate(x,y);c.scale(1.12,.72);femHair(c,view,0,0,{...L,hs,hair:col,serfCap:q.cap,fem:true},{...q.O,fem:false});c.restore();
  if(hs===1&&view==='S')for(let i=0;i<5;i++){oval(c,x+5.6-i*.15,y+2+i*1.2,1,1,i%2?col:H[0]);if(i===4)rect(c,x+4.6,y+7,2,.5,'#bda164');}
  if(hs===4){const xx=view==='E'?x-5.5:x-5;oval(c,xx,y-1.4,2.4,2.2,H[2]);oval(c,xx-.3,y-1.8,1.7,1.5,col);rect(c,xx-1,y-2.2,2,.5,H[0]);}
  if(hs===5)for(const side of view==='E'?[-1]:[-1,1])for(let j=0;j<3;j++){oval(c,x+side*(4.7+j*.2),y+j*1.3,1.6,1.3,H[2]);oval(c,x+side*(4.7+j*.2)-.3,y+j*1.3-.3,1.1,.8,col);}
 }
 function beard(c,q,G,view){if(view==='N'||q.sex==='f'||q.L.noBeard)return;const x=PFX+(view==='E'?2:0),y=G.headY+1,col=q.beardTone,st=q.L.beardStyle||0,len=q.L.beardLen===2?8.6:6.2,w=view==='E'?3.4:5.2;
  let pts;if(st===0)pts=[[x-w,y],[x+w,y],[x+w*.9,y+len*.65],[x+2,y+len],[x-2,y+len],[x-w*.9,y+len*.65]];else if(st===1)pts=[[x-w,y],[x+w,y],[x+w*.75,y+len],[x+1,y+len-1.5],[x,y+len-2.5],[x-1,y+len-1.5],[x-w*.75,y+len]];else if(st===2)pts=[[x-w,y],[x+w,y],[x+w*.65,y+len*.6],[x,y+len+1],[x-w*.65,y+len*.6]];else if(st===3)pts=[[x-w,y],[x+w,y],[x+w*.95,y+len],[x-w*.95,y+len]];else pts=[[x-1.8,y+1],[x+1.8,y+1],[x+2,y+len*.7],[x,y+len],[x-2,y+len*.7]];
  shape(c,pts,shade(col,-.36));c.save();c.beginPath();c.moveTo(...pts[0]);for(const p of pts)c.lineTo(...p);c.closePath();c.clip();if(q.beardTexture){const T=q.beardTexture;c.drawImage(T.cv,...T.bounds,x-w,y,2*w,len+1);}else for(let k=-5;k<=5;k++){const xx=x+k;rect(c,xx,y+1,.8,len+1,k%3===0?shade(col,.13):k%3===1?col:shade(col,-.15));}c.restore();
  if(q.O.skBeard>=0){c.save();c.translate(x,G.headY);c.scale(1.15,q.O.skBeard===3?Math.max(.78,(PFY-G.headY-2)/15.6):.78);skinBeard(c,q.O.skBeard,view,0,0);c.restore();}
 }
 function moustache(c,q,G,view){if(view==='N'||q.sex==='f'||q.L.noBeard)return;const x=PFX+(view==='E'?1.5:0),y=G.headY-.1;c.save();c.translate(x,y);c.scale(1.1,.78);drawMoustache(c,view,0,0,q.beardTone,q.L.must);c.restore();}
 function drawFaceUnderBrim(c,q,G,view){
  if(view==='N'||G.child)return;
  const {x,eyeY:y,profile}=capLayout(q,G,view);
  const [light,mid,dark]=SKINS[q.L.skin%SKINS.length];
  const cheek=q.sex==='f'?3.15:4;
  const point=profile?(q.sex==='f'?7.5:8+((q.L.nose||0)===2?.5:0)):0;
  const patch=(vertices,color)=>shape(c,vertices.map(([dx,dy])=>[x+dx,y+dy]),color);
  if(profile){
   patch([[1.5,.75],[point-1.6,.75],[point-1.25,1.5],[point,1.55],
     [point,2.55],[point-.75,3.15],[point-2.6,2.85],[3.4,2.35],[1.5,2.35]],dark);
   patch([[3,1.15],[point-1.75,1.15],[point-1.35,1.65],[point-.35,1.85],
     [point-.35,2.5],[point-1.2,2.75],[4.1,2.15],[3,2]],mid);
   rect(c,x+point-1.55,y+1.5,1.05,.5,light);
  }else{
   patch([[-cheek,.75],[cheek,.75],[cheek+.2,1.8],[cheek-.55,2.4],
     [1.65,2.4],[1.25,3.45],[-1.35,3.45],[-1.8,2.4],[-cheek+.65,2.4],[-cheek-.2,1.8]],dark);
   rect(c,x-cheek+.55,y+1.5,cheek-2,.5,mid);
   rect(c,x+1.45,y+1.5,cheek-1.95,.5,mid);
   patch([[-1.4,1.35],[.8,1.35],[1.35,2.4],[1,3],[-1,3],[-1.45,2.5]],mid);
   rect(c,x-.85,y+1.8,1.35,.55,light);
  }
 }
 function capLayout(q,G,view){const child=G.child,profile=child||view==='E',eyeY=child?G.headY+2.05:q.sex==='f'?G.headY+.1:view==='E'?G.headY-1:G.headY-.2;return{view:child?'E':view,x:PFX+(child?1.1:0),eyeY,bottom:eyeY+1.3,anchor:eyeY-.15,profile};}
 function guildHat(c,q,G,H){
  if(!q.guild||q.app?.[0]>=0||q.O.skHat>=0)return false;
  if(q.O.tint)c=haTintCtx(c,q.O.tint);
  const yscale=Math.min(1,Math.max(.5,(H.eyeY+Math.min(0,G.dip)-.5)/12));
  const draw={
   poly:(points,color)=>shape(c,points.map(([x,y])=>[H.x+x,H.eyeY+y*yscale]),color),
   rect:(x,y,w,h,color)=>rect(c,H.x+x,H.eyeY+y*yscale,w,Math.max(.5,h*yscale),color),
   shade,
  };
  q.guild.style.head(draw,H.view,q.guild.rank);
  return true;
 }
 function* clearDetachedFightOutline(cv,G){
  const c=cv.getContext('2d'),w=cv.width,h=cv.height,im=yield pixelRequest(cv),d=im.data;
  const seen=new Uint8Array(w*h),maxX=(PFX-4.5)*K;
  const y0=(G.headY+G.dip-4)*K,y1=(G.headY+G.dip+4.5)*K;
  const isolatedDark=p=>p%w<maxX&&p/w>=y0&&Math.floor(p/w)<y1&&
    Math.max(d[p*4],d[p*4+1],d[p*4+2])<100;
  let changed=false;
  for(let p=0;p<seen.length;p++){
   if(seen[p]||d[p*4+3]<64||!isolatedDark(p))continue;
   const component=[p];seen[p]=1;
   for(let at=0;at<component.length;at++){
    const pixel=component[at],px=pixel%w,py=Math.floor(pixel/w);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const x=px+dx,y=py+dy,i=y*w+x;
     if(x<0||x>=w||y<0||y>=h||seen[i]||d[i*4+3]<64)continue;
     seen[i]=1;component.push(i);
    }
   }
   if(component.length>12||!component.every(isolatedDark))continue;
   for(const pixel of component)d[pixel*4+3]=0;
   changed=true;
  }
  if(changed)c.putImageData(im,0,0);
 }
 function capClothPath(c,hx,b,s,tall,style){if(style!==4){capShape(c,hx,b,s,tall,style);return;}const X=x=>hx+x*s;c.beginPath();c.moveTo(X(-4.3),b);c.quadraticCurveTo(X(-4.6),b-tall*.7,X(-.4),b-tall*.96);c.quadraticCurveTo(X(3.6),b-tall*1.02,X(5.8),b-tall*.5);c.quadraticCurveTo(X(7.6),b-tall*.05,X(7.2),b+.55);c.quadraticCurveTo(X(6.2),b+.2,X(4.8),b-tall*.34);c.quadraticCurveTo(X(4.7),b-tall*.1,X(4.3),b);c.closePath();}
 function lowBrim(c,q,G,view){const H=capLayout(q,G,view),x=H.x,y=H.eyeY,col=q.cap,back=view==='N'&&!G.child,profile=H.profile;const outer=profile?(G.child?[[-6,-1.05],[-2,-1.1],[3,-.9],[6.6,-.35],[7.1,.25],[6.8,1.1],[3,1.2],[-3,1.05],[-5.9,.5]]:[[-6,-1.05],[-2,-1.1],[3,-.9],[7.6,-.35],[8.25,.25],[7.7,1.1],[3,1.2],[-3,1.05],[-5.9,.5]]):back?[[-6.2,-.9],[-3,-.55],[3,-.55],[6.2,-.9],[6,1],[3,1.2],[-3,1.2],[-6,1]]:[[-6.2,-1.05],[-3,-.7],[2,-.7],[6.2,-1.05],[6,1],[3,1.2],[-3,1.2],[-6,1]];const pts=outer.map(([a,b])=>[x+a,y+b]);shape(c,pts,shade(col,-.48));shape(c,outer.map(([a,b])=>[x+a*.95,y+b*.6-.25]),shade(col,-.08));shape(c,outer.slice(0,profile?6:4).map(([a,b])=>[x+a*.92,y+b*.45-.6]).concat([[x+4,y-.15],[x-4,y-.15]]),shade(col,.19));rect(c,x-4.5,y-.5,2,.5,shade(col,.31));rect(c,x+.5,y-.5,2.5,.5,shade(col,.22));if(profile)rect(c,x+5,y-.25,1.5,.5,shade(col,.17));if(q.O.cap==='waitress'){pline(c,x-4.8,y-.65,x-3.4,y+.45,'#b4a180',.5);pline(c,x+3.2,y+.45,x+4.7,y-.65,'#b4a180',.5);rect(c,x-2.5,y+.55,5,.5,'#c3b18c');rect(c,x-2,y-.9,2,.5,'#fff7df');for(const dx of[-3,-1,1,3])rect(c,x+dx,y+.2,.5,.5,'#d3c4a2');}if(q.O.rivets||q.O.cap==='cls:warrior'||q.O.cap==='cls:paladin'){rect(c,x-3.5,y+.25,.5,.5,'#d8ba78');rect(c,x+3.5,y+.25,.5,.5,'#d8ba78');}}
 function childCapNose(c,q,G,view){const H=capLayout(q,G,view),sk=SKINS[q.L.skin%3],x=H.x+6.9,y=H.bottom+.45;oval(c,x,y,1.65,1.1,sk[2]);oval(c,x+.15,y-.2,1.35,.85,sk[0]);rect(c,x+.3,y-.75,.7,.5,shade(sk[0],.15));rect(c,x-.8,y+.55,1,.5,sk[1]);}
 function* cropCapBelow(cv,info,bottom,child){
  const c=cv.getContext('2d');
  let first=0;
  while(first<cv.height&&info.pos(first*cv.width).y<=bottom)first++;
  if(child){
   const original=yield pixelRequest(cv);
   for(let i=first*cv.width*4+3;i<original.data.length;i+=4)original.data[i]=0;
   c.putImageData(original,0,0);
   return cv.height; // The nose is painted after cropping a child's cap.
  }
  c.save();
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,first,cv.width,cv.height-first);
  c.restore();
  return first;
 }
 function* drawHeadForeground(c,head,foreground,lastRow){
  // Only an existing foreground pixel can obscure the cap. A carry or
  // low tool frequently ends below the cap and needs no Canvas readback.
  const width=head.width;
  let left=width,top=lastRow,right=-1,bottom=-1;
  for(let y=0;y<lastRow;y++)for(let x=0;x<width;x++){
   if(!foreground[(y*width+x)*4+3])continue;
   left=Math.min(left,x);right=Math.max(right,x);
   top=Math.min(top,y);bottom=y;
  }
  if(right<left)return;
  const w=right-left+1,h=bottom-top+1;
  const {data:alpha}=yield pixelRequest(head,left,top,w,h);
  const ink=new ImageData(w,h);
  let visible=false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,j=((top+y)*width+left+x)*4;
   if(!alpha[i+3]||!foreground[j+3])continue;
   ink.data.set(foreground.subarray(j,j+4),i);
   visible=true;
  }
  if(!visible)return;
  const cv=mkCanvas(width,head.height),o=cv.getContext('2d');
  o.putImageData(ink,left,top);
  c.drawImage(cv,0,0,PW,PH);
 }
 function cap(c,q,G,view,frame){const O=q.O,L=q.L,x=PFX+(G.child?1.1:0),y=G.capY,cap=q.cap,sway=Math.sin((Number(frame)||0)*.8)*.3;
  const cls=typeof O.cap==='string'&&O.cap.startsWith('cls:')?O.cap.slice(4):'',rise=O.skHat>=0?(O.skHat===0?14:O.skHat===4?10:O.skHat===5?12:11):cls?({mage:16,priest:14,warrior:12,barbarian:10,archer:12,druid:14,rogue:11,monk:4,bard:13,paladin:13}[cls]||14):O.cap==='baker'?14:q.sex==='f'&&(L.hs===2||L.hs===3)?8:(O.cap==='wizard'?15:CAP_TALL[L.capStyle||0]+(L.capStyle===9?4:2));
  const ys=Math.min(1.05,Math.max(.4,(y+Math.min(0,G.dip)-1.3)/rise));c.save();c.translate(x,y);c.scale(G.child?1.42:1.28,ys);
  if(O.skHat>=0)skinHat(c,O.skHat,view,0,0,sway);
  else if(typeof O.cap==='string'&&O.cap.startsWith('cls:'))coopHat(O.tint?haTintCtx(c,O.tint):c,O.cap.slice(4),view,0,0,sway);
  else if(q.sex==='f'&&(L.hs===2||L.hs===3))drawKerchief(c,view,0,0,cap,L.hs===3);
  else if(O.cap==='baker'||O.cap==='waitress')drawCap(c,{...O,cap:O.cap},view,0,0,sway,L,mulberry32(q.look+731));
  else {const style=O.cap==='wizard'?1:G.child?[8,2,3,0,7][(q.look>>>2)%5]:(L.capStyle||0),s=view==='E'?-1:L.capTip||1,tall=O.cap==='wizard'?13:CAP_TALL[style];c.save();c.beginPath();capClothPath(c,sway*.3,-1.1,s,tall,style);c.fillStyle=shade(cap,-.35);c.fill();c.clip();c.fillStyle=cap;c.fillRect(-3.8,-16,6,19);c.fillStyle=shade(cap,.18);c.fillRect(-3,-16,2,19);c.fillStyle=shade(cap,-.14);c.fillRect(1,-16,1.5,19);if(q.capTexture){const T=q.capTexture;c.drawImage(T.cv,...T.bounds,-5,-tall-1,10,tall+2);}c.restore();oval(c,0,-.4,4.9,1.4,shade(cap,-.33));oval(c,-.4,-.9,4.5,.8,shade(cap,.12));rect(c,-3,-1.2,5,.5,shade(cap,.27));if(style===8)oval(c,1.4*s,-1.1-tall,1.7,1.5,shade(cap,.27));if(style===4)oval(c,7.2*s,5.1,1.4,1.4,shade(cap,.27));if(style===9){acorn(c,-5.4*s,-tall*.9);acorn(c,5.4*s,-tall*.9);}if(O.cap==='wizard'){rect(c,-1,-6,.7,.7,'#e6c883');rect(c,1,-10,.6,.6,'#e6c883');}}
  if(view!=='N'&&(!q.app||q.app[8]>=0)){const d=view==='E'?-1:1,xx=-3.2*d;if(L.deco===0)twig(c,3.4*d,-1,d);else if(L.deco===1)oakLeaves(c,xx,-1,d);else if(L.deco===2)mushroom(c,xx,-1);else if(L.deco===3)feather(c,xx,-1,d);else if(L.deco===4)acorn(c,xx,-1);}
  if(O.candle&&view!=='N'){rect(c,-1,-3.8,2,3.5,'#d9d2ac');rect(c,-1,-1,2,1,'#967344');const f=Math.floor(Game.time*5)%4;shape(c,[[-.8,-4],[Math.sin(f)*.6,-7-f*.3],[1,-4]],f%2?'#eabf71':'#e0a254');rect(c,0,-5,.5,1,'#f3ddb0');}
  c.restore();
 }
 function foreground(c,q,view,pose,frame,opt){const u=q.holder;if(u.carry)fpaCarryLoad(c,u,view,pose,{...opt,carryForeground:true},frame);
  if(pose==='work'&&!opt.externalWorkTool)fpaDrawWorkTool(c,u,view,frame,opt);
  if(pose==='smoke')fpaDrawSmokingHand(c,u,view,frame);

  fpaAction(c,u,view,pose,frame,opt);
 }

 function skinSeed(r,g,b){return r>130&&g>75&&b>35&&g/r>.60&&g/r<.83&&b/g>.48&&b/g<.87&&r-g>38;}
 function bodyTemplate(G){const cv=mkCanvas(PW*PART,PH*PART),c=cv.getContext('2d');c.scale(PART,PART);c.imageSmoothingEnabled=false;c.translate(PFX,PFY);c.transform(1,0,G.shear,1,0,G.dip);c.drawImage(G.art.image,...G.src,Math.round(-G.dw/2),Math.round(-G.dh),Math.round(G.dw),Math.round(G.dh));const out=mkCanvas(PW*K,PH*K),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(cv,0,0,out.width,out.height);return out;}
 function maskInfo(q,G,view,w,h,raw){const N=w*h,M={face:new Uint8Array(N),skin:new Uint8Array(N),hair:new Uint8Array(N),beard:new Uint8Array(N),cap:new Uint8Array(N)},rows=Array.from({length:h},()=>[w,-1]);
  const pos=i=>{const y=Math.floor(i/w)/K-G.dip,x=(i%w)/K-G.shear*(y-PFY);return{x,y};};
  for(let i=0;i<N;i++){const j=i*4;if(!raw[j+3])continue;const{x,y}=pos(i),r=raw[j],g=raw[j+1],b=raw[j+2],head=y>G.capY-2&&y<G.headY+4.5&&Math.abs(x-PFX)<9,seed=skinSeed(r,g,b);if(seed&&(head||y>G.headY+4&&y<PFY-1&&Math.abs(x-PFX)>6))M.skin[i]=1;
   if(head&&seed){M.face[i]=1;const centre=PFX+(view==='E'?3.2:0),limit=view==='E'?4.1:4.2;if(view!=='N'&&Math.abs(x-centre)<limit&&y>G.capY-.6){const yy=Math.floor(i/w);rows[yy][0]=Math.min(rows[yy][0],i%w);rows[yy][1]=Math.max(rows[yy][1],i%w);}}
  }
  for(let y=0;y<h;y++){const[a,b]=rows[y];if(b<a)continue;for(let x=a;x<=b;x++)if(raw[(y*w+x)*4+3])M.face[y*w+x]=1;}
  for(let i=0;i<N;i++){const j=i*4;if(!raw[j+3]||M.face[i]||M.skin[i])continue;const{x,y}=pos(i),r=raw[j],g=raw[j+1],b=raw[j+2];if(q.sex==='f'&&y>G.capY-2&&y<G.headY+(view==='N'?11:10)&&Math.abs(x-PFX)<9&&r>70&&g<r*.78&&b<g*.46&&(y<G.headY+1||view==='N'||view==='E'&&x<PFX-2||view==='S'&&Math.abs(x-PFX)>3))M.hair[i]=1;
   else if(q.sex!=='f'&&view==='N'&&y>G.capY&&y<G.headY+5&&Math.abs(x-PFX)<7&&r>g*1.25&&g>b*1.15)M.hair[i]=1;
   if(q.sex!=='f'&&view!=='N'&&y>G.headY+.5&&y<G.headY+11&&(view==='E'?x>PFX-.5&&x<PFX+9.5:Math.abs(x-PFX)<6.5)&&r>110&&g>90&&b>65&&r/g<1.22&&g/b<1.5)M.beard[i]=1;
  }
  for(const key of['hair','beard']){const seeds=M[key].slice();for(let i=0;i<N;i++){if(!raw[i*4+3]||M.face[i]||M.skin[i])continue;if(key==="hair"&&q.sex==="f"&&!(raw[i*4]<110||raw[i*4+1]<raw[i*4]*.8&&raw[i*4+2]<raw[i*4+1]*.7))continue;const x=i%w,y=Math.floor(i/w);for(let dy=-2;dy<=2;dy++){let found=false;for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&seeds[yy*w+xx]){M[key][i]=1;found=true;break;}}if(found)break;}}}
  for(let i=0;i<N;i++){if(!raw[i*4+3]||M.face[i]||M.hair[i]||M.beard[i]||M.skin[i])continue;const{x,y}=pos(i);if(y<G.capY+3.5&&Math.abs(x-PFX)<12)M.cap[i]=1;}
  return{w,h,raw,M,pos};
 }
 const emptyForeground=new Uint8ClampedArray(PW*K*PH*K*4);
 function makeParts(q,view,pose,frame,opt){
  const externalTool=pose==='work'&&(opt.externalWorkTool||opt.sowRigBase);
  if((pose==='walk'||pose==='idle'||externalTool)&&!q.holder.carry&&!opt.gest&&!opt.wpn)return null;
  const cv=mkCanvas(PW*PART,PH*PART),c=cv.getContext('2d');c.scale(PART,PART);foreground(c,q,view,pose,frame,opt);const out=mkCanvas(PW*K,PH*K),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(cv,0,0,out.width,out.height);return out;}
 function* colour(q,G,view,source,info,fore){const out=mkCanvas(PW*K,PH*K),c=out.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0,out.width,out.height);const im=c.getImageData(0,0,out.width,out.height),d=im.data,original=new Uint8ClampedArray(d),f=fore?(yield pixelRequest(fore)).data:emptyForeground,{M,raw,pos}=info,skin=rgb(SKINS[q.L.skin%3][0]),colours={skin,beard:rgb(q.beardTone),hair:rgb(q.hair),cap:rgb(q.cap),coat:rgb(q.coat),vest:rgb(q.O.vest||q.coat),skirt:rgb(q.O.skirt||q.coat)};
  for(let i=0;i<d.length/4;i++){const j=i*4;if(!original[j+3])continue;if(f[j+3]>100){for(let k=0;k<3;k++)d[j+k]=f[j+k];continue;}if(!raw[j+3])continue;const r=raw[j],g=raw[j+1],b=raw[j+2],lum=(r+g+b)/3;if(lum<48)continue;const{x,y}=pos(i);let key=null,level=1;if(M.skin[i]||M.face[i]&&skinSeed(r,g,b)){key='skin';level=Math.max(.64,Math.min(1.15,(r+g+b)/3/190));}else if(M.beard[i]){key='beard';level=Math.max(.25,Math.min(1.15,lum/211));}else if(M.hair[i]){key='hair';level=Math.max(.3,Math.min(1.38,lum/110));}else if(M.cap[i]){key='cap';level=Math.max(.28,Math.min(1.35,Math.max(r,g,b)/(q.sex==='f'?225:135)));}else if(r<=185&&b<=110&&g>r*.83&&g>b*1.35&&y>G.capY+1){key=q.sex==='f'||q.O.vest&&view!=='N'&&Math.abs(x-PFX)<6&&y>PFY-16&&y<PFY-7?'vest':'coat';level=Math.max(.3,Math.min(1.35,g/119));}else if(q.sex==='f'&&y>PFY-13&&y<PFY-2&&r>g*1.15&&g>b*1.2){key='skirt';level=Math.max(.3,Math.min(1.3,lum/94));}if(key)for(let k=0;k<3;k++)d[j+k]=Math.max(0,Math.min(255,Math.round(colours[key][k]*level)));}
  return{cv:out,data:im,original,fore:f};
 }
 function workwearPoseShoulder(u,view,pose,frame,opt){
  if(opt.posedWorkwearShoulder)return opt.posedWorkwearShoulder;
  const profile=view==='E';
  if(profile&&pose==='work'&&(opt.sowRigBase||opt.externalWorkTool||FPA_WORK_TOOLS.has(ANIM_TOOL[frame?.anim])))return -1;
  const weaponOut=opt.wpn&&wpnParse(opt.wpn).out&&(pose==='idle'||pose==='walk');
  if(!u.carry&&(pose==='fight'||weaponOut))return profile?-1:'both';
  if(!u.carry&&opt.gest){
   if(profile)return -1;
   if(['clap','stretch','panic','five','six7'].includes(opt.gest))return 'both';
   return view==='N'?-1:1;
  }
  if(pose==='smoke'||pose==='duck'||pose==='tame')return profile||view==='N'?-1:1;
  return 0;
 }
 function dress(paint,info,q,G,view,posedShoulder){
  const layer=mkCanvas(info.w,info.h),c=layer.getContext('2d',{willReadFrequently:true});
  c.scale(K,K);
  transformed(c,G,()=>paintDwarfWorkwear(c,q,view,shape,rect));
  const pixels=c.getImageData(0,0,info.w,info.h).data,d=paint.data.data,{M}=info;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,info.w,info.h);
  c.scale(K,K);
  transformed(c,G,()=>paintDwarfWorkwear(c,q,view,shape,rect,true,posedShoulder));
  const plates=c.getImageData(0,0,info.w,info.h).data;
  for(let i=0;i<M.face.length;i++){
   const j=i*4;
   if(M.face[i]||M.skin[i]||M.hair[i]||M.beard[i]||M.cap[i]||paint.fore[j+3]>100)continue;
   if(plates[j+3]){
    for(let k=0;k<4;k++)d[j+k]=plates[j+k];
   }else if(pixels[j+3]&&d[j+3]){
    for(let k=0;k<3;k++)d[j+k]=pixels[j+k];
   }
  }
 }
 function maskCanvas(info,mask){const cv=mkCanvas(info.w,info.h),c=cv.getContext('2d'),im=c.createImageData(info.w,info.h);for(let i=0;i<mask.length;i++)if(mask[i])im.data[i*4+3]=255;c.putImageData(im,0,0);return cv;}
 function texture(info,paint,mask){const cv=mkCanvas(info.w,info.h),c=cv.getContext('2d'),im=c.createImageData(info.w,info.h);let x0=info.w,y0=info.h,x1=-1,y1=-1;for(let i=0;i<mask.length;i++)if(mask[i]){for(let j=0;j<4;j++)im.data[i*4+j]=paint.data.data[i*4+j];const x=i%info.w,y=Math.floor(i/info.w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}c.putImageData(im,0,0);return x1<0?null:{cv,bounds:[x0,y0,x1-x0+1,y1-y0+1]};}
 // The preserved base has a one-physical-pixel cap outline outside its raw mask.
 // Remove only detached old dark border fragments, before drawing new head/decor.
 function cleanupOldCapOutline(paint,info,G){const d=paint.data.data,{w,h,M,raw}=info,N=w*h,seen=new Uint8Array(N);let removed=0;
  const oldCapBorder=i=>{const j=i*4;if(raw[j+3]>=16||paint.fore[j+3]>=16||d[j]>90||d[j+1]>90||d[j+2]>90||info.pos(i).y>=G.headY-.5)return false;for(let k=0;k<4;k++)if(d[j+k]!==paint.original[j+k])return false;const x=i%w,y=Math.floor(i/w);let cap=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const z=yy*w+xx;if(M.face[z]||M.skin[z]||M.hair[z]||M.beard[z])return false;if(M.cap[z])cap=true;}return cap;};
  for(let i=0;i<N;i++){if(seen[i]||d[i*4+3]<80)continue;const points=[i];seen[i]=1;for(let at=0;at<points.length;at++){const z=points[at],x=z%w,y=Math.floor(z/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy,k=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[k]||d[k*4+3]<80)continue;seen[k]=1;points.push(k);}}if(points.length>12||!points.every(oldCapBorder))continue;for(const z of points){d[z*4+3]=0;removed++;}}
  return removed;
 }
 function clearComponent(paint,info,mask,inpaint=false,q=null){const d=paint.data.data,source=inpaint?new Uint8ClampedArray(d):null,{w,h,M}=info;for(let i=0;i<mask.length;i++){if(!mask[i]||M.face[i]||paint.fore[i*4+3]>100)continue;const j=i*4;if(!inpaint){d[j+3]=0;continue;}const x=i%w,y=Math.floor(i/w);let left=-1,right=-1;if(q&&q.sex==="f"&&y/K>14){if(q&&q.sex==="f"){const xx=Math.abs(x/K-PFX),yy=y/K;if(yy<17&&xx>4.3){d[j+3]=0;continue;}const sleeve=xx>5&&yy>=17&&yy<22,col=rgb(sleeve?"#e6d5b2":q.O.vest||q.coat),shadeFactor=sleeve?(.76+.22*Math.max(0,1-Math.abs(yy-19)/3)):.64+.24*Math.max(0,1-xx/6);for(let k=0;k<3;k++)d[j+k]=Math.round(col[k]*shadeFactor);continue;}let best=-1,dist=1e9;for(let xx=0;xx<w;xx++){const a=y*w+xx;if(!mask[a]&&!M.skin[a]&&!M.face[a]&&source[a*4+3]>100&&Math.abs(xx-w/2)<dist){best=a;dist=Math.abs(xx-w/2);}}if(best>=0){for(let k=0;k<3;k++)d[j+k]=source[best*4+k];continue;}}for(let q=x-1;q>=0;q--){const a=y*w+q;if(!mask[a]&&source[a*4+3]>100){left=a;break;}}for(let q=x+1;q<w;q++){const a=y*w+q;if(!mask[a]&&source[a*4+3]>100){right=a;break;}}if(left>=0&&right>=0){const dl=x-left%w,dr=right%w-x;for(let k=0;k<3;k++)d[j+k]=Math.round((source[left*4+k]*dr+source[right*4+k]*dl)/(dl+dr));}else d[j+3]=0;} }
 function eraseProtected(layer,info){
  const c=layer.getContext('2d');
  const face=info.protectedFaceCanvas??=maskCanvas(info,info.M.face);
  c.save();
  c.setTransform(1,0,0,1,0,0);
  c.globalCompositeOperation='destination-out';
  c.drawImage(face,0,0);
  c.restore();
 }
 // The semantic mask depends on the atlas cell and its transform, not on the
 // dwarf's identity, profession colours or tool. Reuse it across those poses.
 function bodyMaskKey(G){return [...G.src,Math.round(G.dw),Math.round(G.dh),G.shear,G.dip,PFX,PFY,PART].join('|');}
 const bodyMaskAtlas=q=>q.holder.type==='kid'?'gnome-child':q.sex==='f'?'gnome-woman-walk':'gnome-walk';
 const bodyMaskAtlasKeys=['gnome-walk','gnome-woman-walk','gnome-child'];

 let exactBodyMasks=null,maskBankHits=0;
 function bodyMaskPixels(q,G){
  const raw=exactBodyMasks?.get(bodyMaskAtlas(q)+'|'+bodyMaskKey(G))||null;
  if(raw)maskBankHits++;
  return raw;
 }
 async function openBodyMaskBank(){
  if(typeof DecompressionStream!=='function'||!window.crypto?.subtle)return;
  const response=await fetch('assets/fantasy/dwarf-mask-bank-v1.bin.gz');
  if(!response.ok||!response.body)return;
  const bytes=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(bytes.length<8||bytes.length>2e6||new TextDecoder().decode(bytes.subarray(0,4))!=='DMB1')return;
  const metaEnd=8+new DataView(bytes.buffer).getUint32(4,true);
  if(metaEnd<8||metaEnd>bytes.length)return;
  const manifest=JSON.parse(new TextDecoder().decode(bytes.subarray(8,metaEnd)));
  if(manifest.w!==PW*K||manifest.h!==PH*K||!Array.isArray(manifest.entries)||manifest.entries.length>150||!Number.isInteger(manifest.count)||manifest.count>manifest.entries.length||manifest.count<1)return;
  const tileSize=manifest.w*manifest.h*4;
  if(bytes.length!==metaEnd+manifest.count*tileSize)return;
  const verified=await Promise.all(bodyMaskAtlasKeys.map(async atlas=>{
   const asset=FantasyArt.images[atlas]?.image;
   if(!asset||!manifest.assets?.[atlas])return null;
   const path='assets/fantasy/'+atlas+'-v1.png';
   if(path!==manifest.assets[atlas].asset)return null;
   const reply=await fetch(path);
   if(!reply.ok)return null;
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',await reply.arrayBuffer()));
   const hex=Array.from(digest,value=>value.toString(16).padStart(2,'0')).join('');
   return hex===manifest.assets[atlas].sha256?atlas:null;
  }));
  const verifiedAtlases=new Set(verified.filter(Boolean)),bank=new Map();
  manifest.entries.forEach(pair=>{
   if(!Array.isArray(pair))return;
   const [key,index]=pair;
   if(typeof key!=='string'||!verifiedAtlases.has(key.split('|',1)[0])||!Number.isInteger(index)||index<0||index>=manifest.count)return;
   bank.set(key,new Uint8ClampedArray(bytes.buffer,metaEnd+index*tileSize,tileSize));
  });
  if(bank.size)exactBodyMasks=bank;
 }
 // Asset loading and hash verification are opportunistic. A cold early
 // frame and all unlisted native actions retain the unchanged renderer.
 api.maskBankReady=api.ready.then(openBodyMaskBank).catch(()=>{});
 api.maskBankStats=()=>({masks:exactBodyMasks?.size||0,hits:maskBankHits});
 function* cachedMask(q,G,view){
  let masks=bodyMasks.get(G.art);
  if(!masks){masks=new Map();bodyMasks.set(G.art,masks);}
  const key=[G.src[0],G.src[1],q.sex,view,G.shear,G.dip].join('|');
  if(masks.has(key))return masks.get(key);
  let raw=bodyMaskPixels(q,G);
  if(!raw)raw=(yield pixelRequest(bodyTemplate(G))).data;
  const info=maskInfo(q,G,view,PW*K,PH*K,raw);
  info.capCloth=info.M.cap.map((v,i)=>v&&info.pos(i).y<G.capY-.8?1:0);
  if(masks.size>=64)masks.delete(masks.keys().next().value);
  masks.set(key,info);
  return info;
 }
 const pendingDecorativeSprite=mkCanvas(1,1);pendingDecorativeSprite._pendingSprite=true;
 // Add the intermediate weight shifts at the final raster scale. The atlas
 // keeps both boots and the coat hem together, including carried objects.
 const WALK_WEIGHT = [
  [0,0],[.5,-.5],[1,-1],[1,-.5],[.5,0],[0,.5],
  [0,-.5],[-.5,-.5],[-1,-1],[-1,-.5],[-.5,0],[0,.5]
 ];
 // Wrist positions in the eight native profile cells, in half-world pixels.
 // Measured on the source silhouette before the final walk weight shifts.
 const PROFILE_WRISTS = {
  m:[[18,49],[18,46],[23,50],[17,50],[19,49],[31,48],[33,47],[18,48]],
  f:[[24,49],[24,44],[25,46],[27,48],[24,49],[27,43],[29,46],[32,43]]
 };
 function* profileRelaxedHand(out,q,pose,frame,opt,G){
  if(G.child||q.holder.carry&&!fpaBackpackGrip(q.holder,pose)||opt.gest||opt.posedWorkwearShoulder||opt.wpn&&wpnParse(opt.wpn).out)return;
  const phase=pose==='walk'?Math.floor(((Number(frame)||0)%WALK_FRAMES)*8/WALK_FRAMES):0;
  // Wardrobe art is already on this layer. Protect its shoulder and blend the
  // sleeve into the original silhouette below it, where the atlas baked in
  // a round fist (male) or a solid bright glove (female).
  const female=q.sex==='f',[x,y0]=PROFILE_WRISTS[female?'f':'m'][phase];
  const y=y0+Math.round(G.dip*K);
  const c=out.getContext('2d',{willReadFrequently:true});
  const left=x-7,top=y-10,im=yield pixelRequest(out,left,top,15,18),d=im.data;
  const fallback=q.guild?q.coat:female?(q.O.vest||q.coat):q.coat;
  const sleeveSamples=[];
  for(let dy=-10;dy<=-6;dy++)for(let dx=-4;dx<=2;dx++){
   const j=((dy+10)*15+dx+7)*4,[r,g,b,a]=d.subarray(j,j+4);
   const sleeve=female?r>135&&g>r*.71&&b>g*.51:r<170&&g>r*1.04&&g>b*1.38;
   if(a>180&&sleeve)sleeveSamples.push([r,g,b]);
  }
  sleeveSamples.sort((a,b)=>a[1]-b[1]);
  const cloth=sleeveSamples[Math.floor(sleeveSamples.length*.5)]||rgb(fallback);
  const skin=SKINS[q.L.skin%3];
  const skinDark=rgb(skin[2]),skinMid=rgb(skin[1]),skinLight=rgb(skin[0]);
  const tone=(color,delta)=>color.map(v=>Math.max(0,Math.min(255,Math.round(v+delta))));
  const sleeveDark=tone(cloth,-26),sleeveMid=tone(cloth,-8);
  const sleeveLight=tone(cloth,6),cuff=tone(cloth,-17);
  for(let dy=-6;dy<8;dy++)for(let dx=-7;dx<8;dx++){
   const j=((dy+10)*15+dx+7)*4;
   if(d[j+3]<160)continue;
   const [r,g,b]=d.subarray(j,j+3),ax=Math.abs(dx);
   // Bridge the top of the old cuff to its sleeve, keeping the side outlines.
   const sleeveJoint=dy>=-6&&dy<=-2&&ax<=3&&r<106&&g<87;
   const oldHand=female?
     (g>=148&&g>r*1.03&&g>b*1.42||dy>=-4&&r>163&&r>g*1.08&&g>b*1.17):
     r>=110&&g>=67&&r>g*1.12&&g>b*1.17;
   if(!(oldHand||sleeveJoint)||ax>(female?5:6)||dy>6)continue;
   let color=dx<=-4||dy===6?sleeveDark:dx>=1?sleeveLight:sleeveMid;
   if(ax<=4&&dy>=-1&&dy<=5){
    if(dy===-1)color=cuff;
    else if(dy===5&&ax<=2||dy===4&&ax===3||ax===4&&dy>=2&&dy<=3)color=skinDark;
    else if(ax<=3&&dy<=4)color=dx>=-2&&dy<=2?skinLight:skinMid;
   }
   d.set(color,j);
  }
  c.putImageData(im,left,top);
 }
 function walkWeight(source,q,view,frame,opt){
  if(q.holder.type==='kid')return source;
  const [shift,rise]=WALK_WEIGHT[(Number(frame)||0)%WALK_WEIGHT.length];
  if(!shift&&!rise)return source;
  const cv=mkCanvas(source.width,source.height),c=cv.getContext('2d');
  c.imageSmoothingEnabled=false;
  const dx=Math.round(shift*K*(view==='N'?-1:1)*(view==='E'?.65:1));
  const dy=Math.round(rise*K*(opt.gait==='tired'?.5:1));
  const pivot=(PFY-6)*K, blend=4*K;
  c.drawImage(source,0,0,source.width,pivot,dx,dy,source.width,pivot);
  // The shift decreases to zero at the boots so ground contact stays fixed.
  for(let row=0;row<blend;row++){
   const weight=1-row/blend;
   const top=pivot+row+Math.round(dy*weight);
   const next=pivot+row+1+Math.round(dy*(1-(row+1)/blend));
   if(next>top)c.drawImage(source,0,pivot+row,source.width,1,Math.round(dx*weight),top,source.width,next-top);
  }
  c.drawImage(source,0,pivot+blend,source.width,source.height-pivot-blend,0,pivot+blend,source.width,source.height-pivot-blend);
  return cv;
 }
 function render(u,view='S',pose='idle',frame=0,opt={},deferred=false){if(view==='W')view='E';if(!u||!OUTFIT[u.type])return previous(u,view,pose,frame,opt);const q=resolve(u),G=geometry(q,view,pose,frame,opt);if(!G)return fpaWaitingDwarf();const ap=q.app,explicit=i=>!!ap&&ap[i]>=0,cls=typeof q.O.cap==='string'&&q.O.cap.startsWith('cls:'),hairChange=q.sex==='f'&&explicit(11),beardChange=q.sex!=='f'&&!q.L.noBeard&&(explicit(3)||explicit(4)||explicit(5)||explicit(13)),capChange=true,capeChange=explicit(14),special=capChange||beardChange||hairChange||capeChange;
  const {gf,...options}=opt,candle=capChange&&q.O.candle?Math.floor(Game.time*5)%4:0;
  const smokeKind=pose==='smoke'?smokeKindOf(u):null;
  const motion=JSON.stringify([q.holder.type,q.look,q.sex,view,pose,frame?.anim,options,u.carry,u.carryN,u.injury,candle,smokeKind,dwarfGuildCacheKey(q.guild)]);
  const key=motion+'|'+(pose==='work'?frame.f:frame)+'|'+(opt.gest?gf||0:0);
  if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);u._spr=s;return s;}
  // Timing-sensitive external props (the thrown object, pipe, and combat FX)
  // are drawn after this sprite and must use the exact native frame.
  const canDefer=pose==='idle'||pose==='walk'||(pose==='work'&&frame.anim!=='toss'&&frame.f<8);
  const fallback=canDefer?cache.get(lastFrame.get(motion)):null;
  // A queued frame can reuse another phase of the same action and costume.
  // It never substitutes idle for a swing or a different tool/view.
  if(R.inFrame&&!u._exactYardPose&&(fallback||u._decorativeSprite||(R.cam.z<=1&&canDefer&&!fpaTrunkGrip(q.holder,pose)))){
   const snapshot={...u,_spr:null};
   if(spriteDefer('fpa:'+key,()=>render(snapshot,view,pose,frame,opt,true)))return fallback||pendingDecorativeSprite;
  }
  if(R.inFrame)spriteBudgetOk(false);
  const t0=performance.now();
  const source=previous({...u,_spr:null},view,pose,frame,{...opt,nohat:false}),fore=makeParts(q,view,pose,frame,opt);
  const builder=buildPose(u,view,pose,frame,opt,q,G,source,fore,{ap,cls,hairChange,beardChange,capChange,capeChange,special,motion,key,t0});
  return deferred&&pixelReaderReady?buildWithoutReadback(builder):buildInline(builder);
 }
 function* buildPose(u,view,pose,frame,opt,q,G,source,fore,flags){
  const {ap,cls,hairChange,beardChange,capChange,capeChange,special,motion,key,t0}=flags;
  const info=yield* cachedMask(q,G,view);
  const paint=yield* colour(q,G,view,source,info,fore);
  let out=paint.cv;
  const workwear=dwarfWorkwear(q.holder);
  if(workwear)dress(paint,info,q,G,view,workwearPoseShoulder(q.holder,view,pose,frame,opt));
  if(special){if(beardChange)q.beardTexture=texture(info,paint,info.M.beard);if(!opt.nohat)q.capTexture=texture(info,paint,info.capCloth);if(capChange){clearComponent(paint,info,info.M.cap,false);if(!opt.nohat)cleanupOldCapOutline(paint,info,G);}if(beardChange)clearComponent(paint,info,info.M.beard,true);if(hairChange){const removeHair=info.M.hair.map((v,i)=>v&&info.pos(i).y>G.headY+5.2?1:0);clearComponent(paint,info,removeHair,true,q);}
   paint.cv.getContext('2d').putImageData(paint.data,0,0);out=mkCanvas(PW*K,PH*K);const c=out.getContext('2d');c.scale(K,K);c.imageSmoothingEnabled=false;
   if(capeChange&&view!=='N'){c.save();c.translate(PFX,PFY);c.scale(1.75,1);skinCape(c,q.O.skCape,view,-13,-6,false);c.restore();}c.drawImage(paint.cv,0,0,PW,PH);
   const layer=mkCanvas(PW*K,PH*K),l=layer.getContext('2d');l.scale(K,K);l.imageSmoothingEnabled=false;
   if(capChange){const crown=mkCanvas(PW*K,PH*K),cc=crown.getContext('2d');cc.scale(K,K);transformed(cc,G,()=>bareCrown(cc,q,G,view));cc.setTransform(1,0,0,1,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(info.capMaskCanvas??=maskCanvas(info,info.M.cap),0,0);l.drawImage(crown,0,0,PW,PH);}
   transformed(l,G,()=>{if(hairChange)hair(l,q,G,view);if(beardChange){beard(l,q,G,view);moustache(l,q,G,view);}});eraseProtected(layer,info);c.drawImage(layer,0,0,PW,PH);
   transformed(c,G,()=>{
    if(workwear&&q.sex!=='f'&&!q.L.noBeard&&!beardChange)paintWorkwearBeard(c,G,view,shape,q.beardTone);
    drawFaceUnderBrim(c,q,G,view);
   });
   let capLayer=null,capRows=0;if(capChange&&!opt.nohat){const H=capLayout(q,G,view);capLayer=mkCanvas(PW*K,PH*K);const hc=capLayer.getContext('2d');hc.scale(K,K);hc.imageSmoothingEnabled=false;transformed(hc,G,()=>{if(!guildHat(hc,q,G,H)){cap(hc,q,{...G,capY:H.anchor},H.view,frame);lowBrim(hc,q,G,view);}});capRows=yield* cropCapBelow(capLayer,info,H.bottom,G.child);if(G.child)transformed(hc,G,()=>childCapNose(hc,q,G,view));c.drawImage(capLayer,0,0,PW,PH);}
   if(capeChange&&view==='N'){c.save();c.translate(PFX,PFY);c.scale(1.6,1);skinCape(c,q.O.skCape,view,-13,-6,true);c.restore();}if(fore){if(!ap&&!opt.nohat&&!cls){if(capLayer)yield* drawHeadForeground(c,capLayer,paint.fore,capRows);}else c.drawImage(fore,0,0,PW,PH);}
  } else paint.cv.getContext('2d').putImageData(paint.data,0,0);
  if(q.guild&&view==='E'&&pose==='fight')yield* clearDetachedFightOutline(out,G);
  if(view==='E'&&(pose==='idle'||pose==='walk'))yield* profileRelaxedHand(out,q,pose,frame,opt,G);
  if(pose==='walk')out=walkWeight(out,q,view,frame,opt);
  if(cache.has(key)){const existing=cache.get(key);u._spr=existing;return existing;}
  out._fantasyAppearance=true;out._fpaNoHat=!!opt.nohat;out._fpaColourOnly=!special;cache.set(key,out);if(cache.size>800)cache.delete(cache.keys().next().value);
  lastFrame.delete(motion);lastFrame.set(motion,key);if(lastFrame.size>800)lastFrame.delete(lastFrame.keys().next().value);
  if(R.inFrame)spriteSpent(t0);
  u._spr=out;return out;
 }
 personSprite=render;
 portraitURL=function(type,look=3,sx=''){if(!OUTFIT[type]||(UNIT_TYPES[type]&&UNIT_TYPES[type].animal))return previousPortrait(type,look,sx);const me=type==='hero'?(Game.hero?.look===look?Game.hero:Game.units.find(u=>u.type==='hero'&&u.look===look)):null,u=me||{type,look,sx},q=resolve(u),key=JSON.stringify([q.holder.type,q.look,q.sex]);if(portraitCache.has(key))return portraitCache.get(key);const s=render(u,'S','idle',0,{});if(s._pendingSprite)return fpaWaitingDwarf().toDataURL();const cv=mkCanvas(48,48),c=cv.getContext('2d');c.fillStyle='#263929';c.fillRect(0,0,48,48);c.imageSmoothingEnabled=false;c.drawImage(s,2,0,48,48,0,0,48,48);const url=cv.toDataURL();portraitCache.set(key,url);if(portraitCache.size>500)portraitCache.delete(portraitCache.keys().next().value);return url;};
 api.ready.then(()=>{cache.clear();portraitCache.clear();if(typeof PORTRAIT_CACHE!=='undefined')PORTRAIT_CACHE.clear();if(window.FantasyPublishedPortraits)FantasyPublishedPortraits.cache.clear();});
})();
