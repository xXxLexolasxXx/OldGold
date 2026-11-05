/* V4 representative: one flower pixie. Rich authored raster surfaces,
 * actual cold-native hand/FX anchors, no simulation or save modifications.
 * Review candidate only: no production index changes in this branch. */
'use strict';
(()=>{
 if(window.FantasyForestNeutralsV4)return;
 const A=window.FantasyForestNeutralsV4={version:4,ready:false,assetErrors:[],kinds:['pixie'],pixelRatio:2};
 const src=new URL('../assets/fantasy/forest-neutrals-v4/pixie-rig-source-v2.png',document.currentScript.src).href;
 const oldFrame=naFrame,oldDraw=neuDraw,headings=['S','SE','E','NE','N','NW','W','SW'];
 const sourceViews=['S','SE','E','NE','N'],cache=new Map(),motion=new WeakMap();
 const MAX_BYTES=32*1024*1024,MAX_ENTRIES=96,MAX_STATIC=32*1024*1024;
 let bytes=0,staticBytes=0,hits=0,misses=0;
 const worldPerSourcePixel=(44.95-9.6666666667)/460,sole=.4833333333,sourceShoulderY=260;
 const models={};
 const valid=new Set(NA_ALL.concat(NA_FRAMES.parry||[],NA_FRAMES.roar||[],...(NA_EXTRA.pixie||[]).map(k=>NA_FRAMES[k])));
 const make=(w,h)=>{const cv=document.createElement('canvas');cv.width=Math.max(1,Math.ceil(w));cv.height=Math.max(1,Math.ceil(h));return cv;};
 function remember(cv){staticBytes+=cv.width*cv.height*4;if(staticBytes>MAX_STATIC)throw Error('Static raster budget exceeded');return cv;}
 function components(im){
  const cv=make(im.width,im.height),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);
  const data=c.getImageData(0,0,cv.width,cv.height),d=data.data,W=cv.width,H=cv.height,label=new Int32Array(W*H),queue=new Int32Array(W*H),parts=[];
  let id=0;
  for(let start=0;start<label.length;start++){
   if(label[start]||d[start*4+3]<220)continue;id++;let loX=W,loY=H,hiX=0,hiY=0,head=0,tail=1;queue[0]=start;label[start]=id;
   while(head<tail){const p=queue[head++],x=p%W,y=Math.floor(p/W);loX=Math.min(loX,x);hiX=Math.max(hiX,x);loY=Math.min(loY,y);hiY=Math.max(hiY,y);
    for(let yy=Math.max(0,y-1);yy<=Math.min(H-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(W-1,x+1);xx++){const p2=yy*W+xx;if(!label[p2]&&d[p2*4+3]>=220){label[p2]=id;queue[tail++]=p2;}}
   }
   if(tail>500)parts.push({id,x:loX,y:loY,w:hiX-loX+1,h:hiY-loY+1,count:tail});
  }
  function crop(p){const out=make(p.w,p.h),oc=out.getContext('2d'),px=oc.createImageData(out.width,out.height);
   for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const at=(p.y+y)*W+p.x+x;if(label[at]!==p.id)continue;const o=(y*p.w+x)*4;for(let k=0;k<3;k++)px.data[o+k]=Math.min(255,Math.round(d[at*4+k]/8)*8);px.data[o+3]=255;}oc.putImageData(px,0,0);return remember(out);
  }
  return {parts,crop,W,H};
 }
 function cut(cv,x,y,w,h){const out=make(w,h),c=out.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(cv,x,y,w,h,0,0,out.width,out.height);return remember(out);}
 function build(im){
  const C=components(im),bodies=C.parts.filter(p=>p.y<C.H*.6&&p.y+p.h<C.H*.68).sort((a,b)=>b.count-a.count).slice(0,5).sort((a,b)=>a.x+a.w/2-b.x-b.w/2),arms=C.parts.filter(p=>p.y>C.H*.68).sort((a,b)=>b.count-a.count).slice(0,10).sort((a,b)=>a.x+a.w/2-b.x-b.w/2);
  if(bodies.length!==5||arms.length!==10)throw Error('Expected 5 body surfaces and 10 complete arms, observed '+bodies.length+'/'+arms.length);
  const imageWidth=im.width;staticBytes+=im.width*im.height*4;
  bodies.forEach((p,index)=>{
   const view=sourceViews[index],original=C.crop(p),body=remember(make(p.w,p.h)),left=remember(make(p.w,p.h)),right=remember(make(p.w,p.h));
   const raw=original.getContext('2d').getImageData(0,0,p.w,p.h),bodyPx=new ImageData(p.w,p.h),wingL=new ImageData(p.w,p.h),wingR=new ImageData(p.w,p.h);
   let footL=p.w,footR=0;for(let y=Math.max(0,p.h-15);y<p.h;y++)for(let x=0;x<p.w;x++)if(raw.data[(y*p.w+x)*4+3]){footL=Math.min(footL,x);footR=Math.max(footR,x);}
   const footX=(footL+footR+1)/2,footY=p.h,globalFoot=p.x+footX,legCut=Math.floor(p.h*.78),column=new Uint8Array(p.w);
   for(let x=0;x<p.w;x++)for(let y=p.h-12;y<p.h;y++)if(raw.data[(y*p.w+x)*4+3]){column[x]=1;break;}
   const runs=[];let run=null;for(let x=0;x<p.w;x++){if(column[x]&&run===null)run=x;if(run!==null&&(!column[x]||x===p.w-1)){runs.push([run,column[x]?x+1:x]);run=null;}}
   const boots=runs.filter(a=>a[1]-a[0]>4);let centres=boots.length>=2?[(boots[0][0]+boots[0][1])/2,(boots[boots.length-1][0]+boots[boots.length-1][1])/2]:[footX-p.h*.025,footX+p.h*.025];
   const legHalf=Math.max(16,p.h*.041),legRects=centres.map(x=>({x:Math.max(0,Math.floor(x-legHalf)),y:legCut,w:Math.ceil(legHalf*2),h:p.h-legCut}));
   for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
    const at=(y*p.w+x)*4;if(!raw.data[at+3])continue;const gy=p.y+y,gx=p.x+x;
    let low=globalFoot-45,high=globalFoot+55;
    if(gy<220){low=globalFoot-70;high=globalFoot+70;}
    if(gy>300){low-=Math.min(50,(gy-300)*.42);high+=Math.min(50,(gy-300)*.35);}
    if(view==='N'){low=globalFoot-70-Math.max(0,gy-300)*.35;high=globalFoot+70+Math.max(0,gy-300)*.35;}
    const wing=gy<425&&(gx<low||gx>high),leg=legRects.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y);
    const dst=wing?(gx<low?wingL:wingR):bodyPx;
    if(!wing&&leg)continue;for(let k=0;k<4;k++)dst.data[at+k]=raw.data[at+k];
   }
   body.getContext('2d').putImageData(bodyPx,0,0);left.getContext('2d').putImageData(wingL,0,0);right.getContext('2d').putImageData(wingR,0,0);
   const legParts=legRects.map(r=>{const cv=cut(original,r.x,r.y,r.w,r.h);return {upper:cut(cv,0,0,cv.width,cv.height*.53),lower:cut(cv,0,cv.height*.48,cv.width,cv.height*.52),width:r.w*worldPerSourcePixel,hip:[(r.x+r.w/2-footX)*worldPerSourcePixel,sole+(legCut-footY)*worldPerSourcePixel]};});
   const armParts=arms.slice(index*2,index*2+2).map(p=>{const cv=C.crop(p);return {upper:cut(cv,0,cv.height*.14,cv.width,cv.height*.39),lower:cut(cv,0,cv.height*.47,cv.width,cv.height*.36),hand:cut(cv,0,cv.height*.80,cv.width,cv.height*.20)};});
   const socketX=view==='N'?[-65,65]:[-45,55],sockets=socketX.map(x=>[x*worldPerSourcePixel,sole+(sourceShoulderY-p.y-footY)*worldPerSourcePixel]);
   models[view]={body,left,right,p,footX,footY,legParts,armParts,sockets,scale:worldPerSourcePixel,imageWidth};
  });
 }
 function blit(c,cv,x,y,w,h){c.imageSmoothingEnabled=false;c.drawImage(cv,x,y,w,h);}
 function segment(c,cv,a,b,w){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);c.save();c.translate(...a);c.rotate(Math.atan2(dy,dx)-Math.PI/2);blit(c,cv,-w/2,-.25,w,len+.5);c.restore();}
 function nativeArm(P,near){const th=near?naTheta(P):P.up>.5?-2.7:.35+P.b*.2,bend=near?-.5+P.b*.6:-.4,s=[near?.8:-1.2,near?-20:-19],l1=near?3.8:3.5,l2=near?3.6:3.4,e=[s[0]+Math.sin(th)*l1,s[1]+Math.cos(th)*l1],h=[e[0]+Math.sin(th+bend)*l2,e[1]+Math.cos(th+bend)*l2],sc=NA_SPEC.pixie.sc||1;return {e:e.map(x=>x*sc),h:h.map(x=>x*sc),angle:th+bend};}
 function wing(c,M,near,P){
  const im=near?M.right:M.left,root=M.sockets[near?1:0],split=sourceShoulderY-M.p.y,fold=P.dead||P.sleep,open=fold?.48:.94+P.wing*.16;
  const above=23+(fold?-8:P.wing*3.2),below=14+(fold?-2:P.wing*1.2),rootY=-28.42,x0=-M.footX*M.scale-root[0];
  c.save();c.translate(root[0],rootY);c.scale(open,1);
  c.drawImage(im,0,0,im.width,split,x0,-above,im.width*M.scale,above);
  c.drawImage(im,0,split,im.width,im.height-split,x0,0,im.width*M.scale,below);c.restore();
 }
 function drawLeg(c,M,P,near,view){
  const part=M.legParts[near?1:0],sc=NA_SPEC.pixie.sc||1,sw=P.leg*1.3*sc,front=view==='S'||view==='N',side=view==='E';
  let fx=(near?1.5:-1.3)*sc+(near?-sw:sw),fy=sole;
  if(front){fx=(near?1.5:-1.3)*sc+(near?-sw:sw)*.2;fy+=P.leg*(near?-1:1)*.65;}
  else if(!side){fx=(near?1.5:-1.3)*sc+(near?-sw:sw)*.7;fy+=P.leg*(near?-1:1)*.35;}
  const a=part.hip,b=[(a[0]+fx)*.5,(a[1]+fy)*.5],f=[fx,fy-.4];segment(c,part.upper,a,b,part.width);segment(c,part.lower,b,f,part.width);
 }
 function drawArm(c,M,P,near){const a=M.sockets[near?1:0],r=nativeArm(P,near),im=M.armParts[near?1:0],w=near?2.5:2.2;segment(c,im.upper,a,r.e,w);segment(c,im.lower,r.e,r.h,w*.8);
  if(near){const theta=r.angle+.2,sc=NA_SPEC.pixie.sc||1,tip=[r.h[0]+Math.sin(theta)*7.3*sc,r.h[1]+Math.cos(theta)*7.3*sc];c.strokeStyle='#76523a';c.lineWidth=1.1;c.beginPath();c.moveTo(...r.h);c.lineTo(...tip);c.stroke();c.strokeStyle='#c6a775';c.lineWidth=.4;c.beginPath();c.moveTo(r.h[0]-.3,r.h[1]);c.lineTo(tip[0]-.3,tip[1]);c.stroke();
   c.fillStyle=P.dark?'#ad79ba':'#edb79d';for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])c.fillRect(tip[0]+dx-.55,tip[1]+dy-.55,1.1,1.1);c.fillStyle='#e6cd84';c.fillRect(tip[0]-.5,tip[1]-.5,1,1);
   if(P.cast||P.b){const radius=3+P.cast*7;c.strokeStyle=P.dark?'#b991cd':'#e3d89e';c.lineWidth=.5;c.beginPath();c.ellipse(tip[0],tip[1],radius,radius*.8,0,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+P.cast*2;c.fillStyle=i%2?'#f4dbb2':'#c6cc92';c.fillRect(tip[0]+Math.cos(a)*radius-.5,tip[1]+Math.sin(a)*radius*.8-.5,1,1);}}
  }
  c.save();c.translate(...r.h);c.rotate(-r.angle);blit(c,im.hand,-w*.5,-.45,w,w*im.hand.height/im.hand.width);c.restore();
 }
 function faceState(c,M,P,view){
  if(!P.eye||view==='N'||view==='NE')return;
  // Authored source-space eye landmarks; rear surfaces never receive a face.
  const eyes={S:[[169,178,18,14],[202,177,16,14]],SE:[[494,178,18,14],[522,176,9,13]],E:[[809,178,14,14]]}[view];
  c.save();c.translate(-M.footX*M.scale,sole-M.footY*M.scale);c.scale(M.scale,M.scale);
  for(const [gx,gy,w,h]of eyes){const x=gx-M.p.x,y=gy-M.p.y;c.fillStyle='#f0b888';c.fillRect(x,y,w,h);c.fillStyle='#985840';c.fillRect(x,y+h-3,w,3);c.fillStyle='#583028';
   if(P.eye===3){for(let i=0;i<3;i++){c.fillRect(x+2+i*3,y+2+i*3,4,3);c.fillRect(x+w-6-i*3,y+2+i*3,4,3);}}
   else if(P.eye===1){c.fillRect(x+1,y+3,w-2,4);c.fillStyle='#486840';c.fillRect(x+w*.45,y+7,4,3);}
   else{c.fillRect(x+1,y+6,w-2,3);c.fillRect(x+w-4,y+3,3,3);}
  }c.restore();
 }
 function paint(c,P,view){const M=models[view],sc=NA_SPEC.pixie.sc||1,lift=P.dead?0:P.sleep?1:7,rear=view==='N'||view==='NE';c.save();c.translate(P.x*sc,(P.y-lift)*sc);c.rotate(P.rot);
  wing(c,M,false,P);if(!rear)wing(c,M,true,P);drawLeg(c,M,P,false,view);drawLeg(c,M,P,true,view);drawArm(c,M,P,false);
  const x=-M.footX*M.scale,y=sole-M.footY*M.scale;blit(c,M.body,x,y,M.body.width*M.scale,M.body.height*M.scale);
  faceState(c,M,P,view);if(rear)wing(c,M,true,P);drawArm(c,M,P,true);c.restore();
 }
 function frame(fr='i0',heading='E'){
  if(!A.ready)return oldFrame('pixie',fr);fr=valid.has(fr)?fr:'i0';const key=heading+'|'+fr;
  if(cache.has(key)){hits++;const p=cache.get(key);cache.delete(key);cache.set(key,p);return p;}misses++;
  const mirror=['SW','W','NW'].includes(heading),view=({SW:'SE',W:'E',NW:'NE'})[heading]||heading,M=models[view];if(!M)return frame(fr,'E');
  const P=naPose(fr),S=NA_SPEC.pixie,pad=48,sp={w:S.w+pad*2,h:S.h+pad*2,ax:S.ax+pad,ay:S.ay+pad,pixelRatio:2,heading,view},cv=make(sp.w*2,sp.h*2),c=cv.getContext('2d');c.scale(2,2);c.translate(sp.ax,sp.ay);if(mirror)c.scale(-1,1);paint(c,P,view);
  const image=c.getImageData(0,0,cv.width,cv.height),d=image.data;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const at=(y*cv.width+x)*4;if(d[at+3]<128||P.fade&&naHash(x>>1,y>>1)<P.fade){d[at+3]=0;continue;}d[at+3]=255;for(let k=0;k<3;k++){let v=d[at+k];if(P.hurt)v+=(245-v)*P.hurt*.26;d[at+k]=Math.min(255,Math.round(v/8)*8);}}
  c.putImageData(image,0,0);cv.fine=2;sp.cv=cv;const cost=cv.width*cv.height*4;
  while(cache.size&&(cache.size>=MAX_ENTRIES||bytes+cost>MAX_BYTES)){const key=cache.keys().next().value,old=cache.get(key);bytes-=old.cv.width*old.cv.height*4;cache.delete(key);}cache.set(key,sp);bytes+=cost;return sp;
 }
 function heading(N){const p=motion.get(N);let dx=p?N.x-p.x:0,dy=p?N.y-p.y:0,d=p?.heading||(N.vf?'S':N.face<0?'W':'E');
  if(N.st!=='die'&&Math.hypot(dx,dy)<.0001){const target=N.tg&&typeof neuUnit==='function'?neuUnit(N.tg):null;if(target){dx=target.x-N.x;dy=target.y-N.y;}else if(N.st==='roam'){dx=N.wx-N.x;dy=N.wy-N.y;}else if(N.st==='home'){dx=N.hx-N.x;dy=N.hy-N.y;}}
  if(N.st!=='die'&&Number.isFinite(dx)&&Number.isFinite(dy)&&Math.hypot(dx,dy)>.0001)d=headings[(Math.round(Math.atan2(dx,dy)/(Math.PI/4))+8)%8];motion.set(N,{x:N.x,y:N.y,heading:d});return d;
 }
 naFrame=function(kind,fr){return kind==='pixie'&&A.ready?frame(fr,'E'):oldFrame(kind,fr);};
 neuDraw=function(c,N){if(N.k!=='pixie'||!A.ready)return oldDraw(c,N);const sp=frame(N.fr||'i0',heading(N)),x=Math.round(N.x*TILE),y=Math.round(N.y*TILE+6),dead=N.st==='die',alpha=dead?Math.max(0,Math.min(1,1-(N.dt-.9)/2.3)):1;if(!alpha)return;c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;c.fillStyle='rgba(10,8,4,.3)';c.beginPath();c.ellipse(x,y+1,NSPEC.pixie.sz*(dead?1.1:.8),NSPEC.pixie.sz*.28,0,0,7);c.fill();c.drawImage(sp.cv,x-sp.ax,y-sp.ay,sp.w,sp.h);c.restore();if(!dead&&N.hp<N.mhp-.5){c.fillStyle='#261c19';c.fillRect(x-10,y-86,20,4);c.fillStyle='#7eaa66';c.fillRect(x-9,y-85,18*Math.max(0,N.hp/N.mhp),2);}};
 Object.assign(A,{headings,sourceViews,frame,originalFrame:oldFrame,heading,models,source:src,stats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries:MAX_ENTRIES,maxRgbaBytes:MAX_BYTES,staticBytes,maxStaticBytes:MAX_STATIC,hits,misses}),clear:()=>{cache.clear();bytes=0;},portrait:()=>frame('i0','S'),nativeArm});
 A.readyPromise=new Promise(resolve=>{const im=new Image();im.onload=()=>{try{build(im);A.ready=true;}catch(e){A.assetErrors.push(e.message);}resolve(A);};im.onerror=()=>{A.assetErrors.push(src);resolve(A);};im.src=src;});
})();
