/* Small fauna presentation only. Load once after native renderers and other fantasy modules.
 * No controller, pose table, duration, footprint, anchor or serializable entity edits.
 * Frog: generated full-body 5-view / 7-pose atlas. Other fauna: native pixel geometry.
 */
(() => {
 'use strict';
 if (window.FantasyPublishedSmallfauna) return;
 const root = new URL('../assets/fantasy-smallfauna/', document.currentScript.src);
 const cache = new Map(), facing = new WeakMap();
 const errors = [], MAX_ENTRIES = 768, MAX_BYTES = 16 * 1024 * 1024;
 const frogNames = ['sit','blink','croak','crouch','launch','air','land'];
 const views = ['Анфас','Передний ¾','Профиль','Задний ¾','Спина'];
 let bytes = 0, hits = 0, misses = 0, enabled = true, ready = false, palette, atlas, frogImage, context = null;
 const native = {drawFrog,drawWorm,drawButterfly,drawFireflies,beDrawBees,wlDraw,fwDraw,naFrame};
 const wrap = (n,m) => ((n%m)+m)%m;
 const quant = (p,n=12) => wrap(Math.floor(p/Math.PI/2*n),n);
 const canon = d => d > 4 ? 8-d : d;
 function direction(o, dx, dy) {
  let old = facing.get(o);
  if (!old) old = {x:o.x,y:o.y,d:o.face<0?6:2};
  const mx = o.x-old.x, my = o.y-old.y;
  if (Math.hypot(mx,my) > .00001) { dx=mx;dy=my; }
  if (Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx,dy) > .015) old.d = wrap(Math.round(Math.atan2(dx,dy)/(Math.PI/4)),8);
  old.x=o.x;old.y=o.y;facing.set(o,old);return old.d;
 }
 function targetDir(o) { return direction(o,o.tx-o.x,o.ty-o.y); }
 function memo(key, build) {
  if (cache.has(key)) { const s=cache.get(key);cache.delete(key);cache.set(key,s);hits++;return s; }
  misses++;const s=build(), cost=s.cv.width*s.cv.height*4;
  while(cache.size && (cache.size>=MAX_ENTRIES || bytes+cost>MAX_BYTES)) { const k=cache.keys().next().value;bytes-=cache.get(k).cv.width*cache.get(k).cv.height*4;cache.delete(k); }
  if(cost<=MAX_BYTES){cache.set(key,s);bytes+=cost;}return s;
 }
 function canvas(w,h,ax,ay,fn) {
  const cv=document.createElement('canvas');cv.width=Math.ceil(w*2);cv.height=Math.ceil(h*2);cv.fine=2;
  const c=cv.getContext('2d');c.scale(2,2);c.translate(ax,ay);c.imageSmoothingEnabled=false;fn(c);
  const im=c.getImageData(0,0,cv.width,cv.height);for(let i=3;i<im.data.length;i+=4)im.data[i]=im.data[i]>=100?255:0;c.putImageData(im,0,0);
  return {cv,ax,ay,w,h};
 }
 function blit(c,s,x,y) { c.drawImage(s.cv,x-s.ax,y-s.ay,s.w,s.h); }
 // Half-world-pixel raster brush. Ellipses and lines are stamped on the same grid;
 // no canvas antialiased path ever becomes a body surface.
 function kit(c,p,d,depth=.45,originV=0) {
  const a=canon(d)*Math.PI/4, sn=Math.sin(a),cs=Math.cos(a);
  const point=(u,v,z)=>[u*cs+(v+originV)*sn,(v+originV)*cs*depth-u*sn*depth-z];
  const dot=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.max(.5,Math.round(w*2)/2),Math.max(.5,Math.round(h*2)/2));};
  const ell=(x,y,rx,ry,col)=>{for(let Y=Math.floor((y-ry)*2);Y<Math.ceil((y+ry)*2);Y++)for(let X=Math.floor((x-rx)*2);X<Math.ceil((x+rx)*2);X++)if(((X+.5)/2-x)**2/rx**2+((Y+.5)/2-y)**2/ry**2<=1)dot(X/2,Y/2,.5,.5,col);};
  const line=(x,y,X,Y,w,col)=>{const n=Math.max(1,Math.ceil(Math.hypot(X-x,Y-y)*3));for(let i=0;i<=n;i++)ell(x+(X-x)*i/n,y+(Y-y)*i/n,w/2,w/2,col);};
  const limb=(A,B,w,far=false)=>{const x=point(...A),y=point(...B);line(...x,...y,w+.55,p[0]);line(...x,...y,w,p[far?1:2]);line(x[0]-.25,x[1]-.3,y[0]-.25,y[1]-.3,Math.max(.5,w*.3),p[far?2:3]);};
  const vol=(u,v,z,ru,rv,rz,base=2)=>{const [x,y]=point(u,v,z),rx=Math.hypot(ru*cs,rv*sn),ry=Math.hypot(ru*sn*depth,rv*cs*depth,rz);ell(x,y,rx+.35,ry+.35,p[0]);ell(x,y,rx,ry,p[1]);ell(x-.15,y-.25,rx*.91,ry*.86,p[base]);ell(x-rx*.22,y-ry*.4,rx*.46,ry*.3,p[Math.min(5,base+1)]);};
  const eye=(u,v,z,blink=false)=>{const [x,y]=point(u,v,z);ell(x,y,.8,.75,p[0]);if(!blink){dot(x-.2,y-.35,.5,.5,p[5]);}};
  const poly=(pts,col)=>{const q=pts.map(p=>point(...p));const minY=Math.floor(Math.min(...q.map(p=>p[1]))*2),maxY=Math.ceil(Math.max(...q.map(p=>p[1]))*2);for(let y=minY;y<maxY;y++){const yy=(y+.5)/2,xs=[];for(let i=0;i<q.length;i++){const A=q[i],B=q[(i+1)%q.length];if((A[1]<=yy&&B[1]>yy)||(B[1]<=yy&&A[1]>yy))xs.push(A[0]+(yy-A[1])/(B[1]-A[1])*(B[0]-A[0]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)dot(Math.ceil(xs[i]*2)/2,y/2,Math.max(.5,(xs[i+1]-xs[i])),.5,col);}};
  return {point,dot,ell,line,limb,vol,eye,poly,p,a,sn,cs,d,depth};
 }
 function mirror(c,d) { if(d>4)c.scale(-1,1); }
 function bodyRig(kind) {return kind==='newt'?{depth:.38,originV:4.2}:kind==='moth'?{depth:.45,originV:2}:{depth:.27,originV:0};}
 function anatomyLocal(kind,P) {
  const up=P.up>.5?1:0;
  if(kind==='newt')return{head:[-Math.sin((P.leg||0)*1.8)*(P.hurt>.4?1.8:.9)/bodyRig(kind).depth,11,3.8+up*3.6]};
  if(kind==='moth')return{head:[0,4,18],lantern:[0,-6.4,14.4]};
  return{head:P.hurt>.4?null:[0,14.2,5+up*3]};
 }
 function landmarks(kind,fr,d=2) {
  const P=naPose(fr),S=NA_SPEC[kind],R=bodyRig(kind),A=anatomyLocal(kind,P),angle=canon(d)*Math.PI/4,cs=Math.cos(angle),sn=Math.sin(angle),rot=kind==='snail'?P.rot*.5:0,factor=kind==='moth'?.4:.5;
  const pose=q=>{if(!q)return null;const[x,y]=q,xx=(x*Math.cos(rot)-y*Math.sin(rot)+P.x*factor)*S.sc,yy=(x*Math.sin(rot)+y*Math.cos(rot)+P.y*factor)*S.sc;return[d>4?-xx:xx,6+yy];};
  const point=q=>q?pose([q[0]*cs+(q[1]+R.originV)*sn,(q[1]+R.originV)*cs*R.depth-q[0]*sn*R.depth-q[2]]):null;
  return{head:point(A.head),lantern:point(A.lantern),ground:[0,6]};
 }
 function frogSpriteNew(name,d) {
  const row=Math.max(0,frogNames.indexOf(name)),view=canon(d),M=atlas.poseCalibration[frogNames[row]],cells=atlas.frames.slice(row*5,row*5+5);
  // One cold-native pose calibration for ALL five authored views. Never fit each
  // view to a reserved canvas. Projection widths / heights remain naturally different.
  const maxW=Math.max(...cells.map(b=>b[2]))*M.scaleX,maxH=Math.max(...cells.map(b=>b[3]))*M.scaleY;
  const extent=Math.ceil((Math.abs(M.centerX)+maxW/2)*2)/2+1,left=-extent,right=extent,top=Math.floor((M.bottom-maxH)*2)/2-1,bottom=Math.ceil(M.bottom*2)/2+1;
  return memo('frog|'+d+'|'+name,()=>canvas(right-left,bottom-top,-left,-top,c=>{
   mirror(c,d);const b=cells[view],w=b[2]*M.scaleX,h=b[3]*M.scaleY;
   c.drawImage(frogImage,...b,M.centerX-w/2,M.bottom-h,w,h);
   // Quantized opaque pixels keep the tiny game sprite on its exact x2 grid.
   const oc=c.canvas.getContext('2d'),im=oc.getImageData(0,0,c.canvas.width,c.canvas.height);for(let i=3;i<im.data.length;i+=4)im.data[i]=im.data[i]>=100?255:0;oc.putImageData(im,0,0);
  }));
 }
 function snail(K,P,fr) {
  const {vol,limb,point,line,ell,dot,cs,sn,p}=K,hide=P.hurt>.4, wave=Math.sin((P.leg||0)*1.6)*.7;
  // A continuous muscular foot, tail, mantle and two eye stalks. Never legs.
  vol(0,-3,.8,4.3,12.5,.9);vol(0,1,1.7,4.2,11,1.6);
  for(let i=-9;i<11;i+=2){const [x,y]=point(3,i,1);dot(x,y,.8,.5,p[3]);}
  const head=()=>{if(!hide){
   vol(...anatomyLocal('snail',P).head,3.1,3.4,3);
   for(const u of(sn>.1?[2,-2]:[-2,2])){const i=u>0?1:0,sway=Math.sin(P.y*4+i*2+(P.wing||0)*1.4)*1.1,A=[u,13.4+i*2.2,6+(P.up>.5?3:0)],B=[u*1.5,15.2+i*2.2+sway,12+(P.up>.5?5:0)];limb(A,B,.85,sn>.1&&u>0);const q=point(...B);ell(...q,.85,.85,p[0]);dot(q[0]-.25,q[1]-.3,.5,.5,p[5]);}
   // Lower sensory tentacles are short; the shell never acquires a face.
   for(const u of[-1,1])limb([u*2,15,3],[u*3.5,18,2.7],.65,u<0);
  }};
  if(cs<0)head();
  const sy=hide?1:-3;vol(0,sy,10,7.9,8.5,9,4);
  // Shell whorls occupy the visible side wall; back/front show the shell ridge.
  if(sn>.4){const q=point(7,sy,10);for(let i=0;i<26;i++){const t=i/25*10,r=6.5*(1-i/28);const x=q[0]+Math.cos(t)*r*sn,y=q[1]+Math.sin(t)*r*.85;ell(x,y,.65,.65,i%3?p[5]:p[0]);}}
  else {const q=point(0,sy,13);line(q[0],q[1]-5,q[0]+1,q[1]+7,.8,p[5]);}
  for(const [u,v,z]of[[-2,-6,17],[3,-3,18],[1,-9,15]]){const q=point(u,v,z);ell(...q,2.2,1,p[2]);ell(q[0]-.3,q[1]-.3,1.1,.5,p[3]);}
  if(cs>=0)head();
  for(let v=-9;v<8;v+=2){const q=point(3,v,.6+Math.sin(v*.7+(P.leg||0)*3)*.25);dot(q[0],q[1],.8,.5,p[3]);}
 }
 function newt(K,P,fr) {
  const {vol,limb,point,line,ell,eye,poly,p,cs}=K,ph=P.leg||0,hide=P.hurt>.4;
  const up=P.up>.5?1:0,tail=[];for(let i=0;i<8;i++)tail.push([Math.sin(i*.8+ph*1.8)*(hide?1.5:.8),9-i*3.6,3+Math.max(0,3-i)*(.1+up*1.2)+Math.max(0,i-5)*.3]);
  const leg=(u,v,near)=>{const gait=ph*Math.sign(u)*(v>0?1:-1),A=[u,v,2.7],B=[u*2.1,v+gait*2,1.1],C=[u*2.7,v+gait*3+1,-.1];limb(A,B,1.8,!near);limb(B,C,1.1,!near);for(const f of[-1,0,1])limb(C,[C[0]+f*.6,C[1]+1.5,-.2],.55,!near);};
  const near=(u,v)=>v*K.cs-u*K.sn>=0;
  for(const u of[-2.6,2.6])for(const v of[-6,6])if(!near(u,v))leg(u,v,false);
  const fin=tail.slice(4).map((q,i)=>[q[0],q[1],q[2]+(i===0?3.8:7.6-i)]);
  poly([...fin,...tail.slice(4).reverse().map(q=>[q[0],q[1],q[2]])],p[4]);
  for(let i=0;i<fin.length-1;i++)line(...point(...fin[i]),...point(...fin[i+1]),.6,p[4]);
  for(let i=7;i>=0;i--){const z=tail[i],r=i<4?3-i*.2:Math.max(.45,2-(i-4)*.5);vol(...z,r,i<5?2.7:Math.max(1.2,2.7-(i-4)*.5),r*.75);}
  // Orange ventral edges, not an orange painted dorsal stripe.
  if(cs>-.3)for(let i=0;i<4;i++){const q=point(2.6,tail[i][1],2);line(q[0]-1,q[1],q[0]+1,q[1],.8,p[4]);}
  for(const u of[-2.6,2.6])for(const v of[-6,6])if(near(u,v))leg(u,v,true);
  const head=anatomyLocal('newt',P).head,headU=head[0];
  vol(...head,4.2,4.1,2.8);
  for(const [u,v]of[[-1,5],[1,0],[-1,-6],[1,-10]]){const q=point(u,v,5);ell(...q,.65,.5,p[0]);}
  // Native model has red external gill twigs; retain these exact anatomy features.
  for(const u of[-1,1])for(const f of[-1,0,1]){const q=point(headU+u*3.5,8,4+up*3.6),r=point(headU+u*5,6+f,6+f*.7+up*3.6);line(...q,...r,.55,'#bf6753');}
  if(canon(K.d)<3){if(canon(K.d)<2)eye(headU-2.8,12,5.5+up*3.6);eye(headU+2.8,12,5.5+up*3.6);}
 }
 function wings(K,kind,frame,P={}) {
  const {vol,limb,poly,point,line,ell,dot,eye,p,cs}=K,large=kind==='lantern',S=large?1:kind==='moth'?.15:.17, fl=large?(P.wing||0):kind==='moth'?-Math.cos(frame*Math.PI/6):Math.sin(frame*Math.PI/6),open=large?.22+.78*Math.abs(fl):kind==='moth'?[.25,.67,1,.67][wrap(Math.round(frame/3),4)]:1/7+6/7*Math.abs(fl);
  const z=large?18:1,body=large?3:.48;
  // Four individual fore/hind wing panels attach to the thorax; far pair first.
  const wing=(side,far)=>{const profile=large&&canon(K.d)===2,quarter=large&&[1,3].includes(canon(K.d)),tip=side*(large?15:17)*open;
   // The side view is its own swept forewing / hindwing silhouette, not a scaled front.
   const pts=profile?[[side,3,z],[side*4,-10,z+11+fl*7],[side*3,-22,z+3+fl*4],[side*2,-13,z-6],[side,-4,z]]:[[side,3,z],[tip,quarter?-3:7,z+fl*6],[side*(large?16:19)*open,quarter?-14:-1,z+fl*3],[side*8*open,quarter?-12:-8,z-1],[side,-4,z]];
   const scale=q=>q.map((n,i)=>i===2?(n-z)*S*(large?1:.4)+z:n*S);poly(pts.map(scale),p[far?2:3]);
   const inner=profile?[[side,1,z],[side*3,-10,z+6+fl*6],[side*2,-18,z+3+fl*3]]:[[side*2,2,z],[side*12*open,quarter?-3:4,z+fl*4],[side*9*open,quarter?-10:-3,z+fl*2]];
   poly(inner.map(scale),p[4]);const A=point(side*S,0,z),B=point((profile?side*3:side*13*open)*S,(profile?-17:quarter?-10:3)*S,z+fl*4*S*(large?1:.4));line(...A,...B,large?.6:.5,p[1]);if(large){const q=point(profile?side*2.7:side*12*open,profile?-14:quarter?-8:-1,z+(profile?4:0)+fl*3);ell(...q,1.8,1.3,'#78617d');ell(q[0]-.2,q[1]-.2,.7,.6,p[5]);}};
  const farSide=K.sn>.1?1:-1;wing(farSide,true);
  if(large)for(const side of[-1,1])for(let i=0;i<3;i++)limb([side*1.3,2-i*1.6,z-1],[side*4,1-i*2,z-3.5],.6,side<0);
  else for(const side of[-1,1])for(let i=0;i<3;i++)limb([side*.18,.24-i*.2,z-.1],[side*.55,.1-i*.2,z-.55],.5,side<0);
  vol(0,-3*S,z,body,4.3*S,body*.85);vol(0,1*S,z+.5*S,body*.9,2.1*S,body*.95);
  wing(-farSide,false);
  vol(...(large?anatomyLocal('moth',P).head:[0,4*S,z+.4*S]),body*.8,1.7*S,body*.8);
  if(K.cs>-.35){const q=point(body*.5,5*S,z+body*.4);dot(q[0],q[1],large?.8:.5,large?.8:.5,p[0]);}
  if(large){for(const side of[-1,1])limb([side*.8,4,z+1],[side*3,7,z+4],.6,side<0);const q=point(...anatomyLocal('moth',P).lantern);ell(...q,2.6,2.2,p[4]);ell(q[0]-.5,q[1]-.5,1.1,1,p[5]);}
  else for(const side of[-1,1])limb([side*.12,.65,z+.1],[side*.45,1,z+.45],.5,side<0);
 }
 function nativeSprite(kind,fr,d,flip) {
  const S=NA_SPEC[kind],m=/^([a-z]+)(\d+)$/.exec(fr),state=m?m[1]:fr,frame=m?Math.min(state==='h'?5:11,+m[2]):0;
  const key=kind+'|'+d+'|'+flip+'|'+state+frame;
  // New quarter-view toes need two transparent rows below the legacy side-view
  // buffer. Keep world scale, NA_SPEC, and ax/ay unchanged; never squash the view.
  return memo(key,()=>canvas(S.w,S.h+(kind==='newt'?2:0),S.ax,S.ay,c=>{
   if(flip)c.scale(-1,1);const P=naPose(m?state+frame:fr),p=palette[kind==='moth'?'lantern':kind].map(col=>naK(P,col));
   c.save();c.scale(S.sc||1,S.sc||1);c.translate(P.x*(kind==='moth'?.4:.5),P.y*(kind==='moth'?.4:.5));if(kind==='snail')c.rotate(P.rot*.5);
   const R=bodyRig(kind),K=kit(c,p,d,R.depth,R.originV);if(kind==='snail')snail(K,P,fr);else if(kind==='newt')newt(K,P,fr);else wings(K,'lantern',frame,P);c.restore();
   if(P.fade){const oc=c.canvas.getContext('2d'),im=oc.getImageData(0,0,c.canvas.width,c.canvas.height);for(let i=0;i<im.data.length;i+=4)if(((i/4*37)%101)/101<P.fade)im.data[i+3]=0;oc.putImageData(im,0,0);}
  }));
 }
 function insect(kind,d,fr,col) {
  const W=kind==='butterfly'?8:kind==='moth'?6:kind==='bee'?3:3,H=kind==='bee'?3:kind==='firefly'?3:4;
  return memo(kind+'|'+d+'|'+fr+'|'+(col||''),()=>canvas(W,H,W/2,H/2,c=>{
   mirror(c,d);const p=(palette[kind==='butterfly'?'moth':kind]||palette.moth).slice();if(col){p[3]=col;p[4]=col;}
   if(kind==='butterfly'||kind==='moth'){const K=kit(c,p,d,.25);c.translate(0,.9);wings(K,kind,kind==='moth'?fr*3:fr);}
   else {const K=kit(c,p,d),{point,ell,dot,limb}=K,side=canon(d);const q=point(0,0,0);ell(...q,kind==='bee'?1.4:.75,.8,p[0]);
    for(const side of[-1,1])for(let j=0;j<3;j++){const A=point(side*.35,.5-j*.4,-.3),B=point(side*.85,.5-j*.4,-.65);K.line(...A,...B,.5,p[0]);}
    if(kind==='bee'){const q=point(0,-.5,0);ell(...q,.65,.65,p[3]);}
    else {const q=point(0,-.5,0);ell(...q,.6,.6,p[4]);}
    for(const s of[-1,1]){const q=point(s*.7,0,kind==='bee'?(s<0?1.3:fr?.7:-.3):fr?1:.5);ell(...q,.6,.4,p[5]);}
    if(side<3){const q=point(0,.8,0);dot(q[0],q[1],.5,.5,p[0]);}
   }
  }));
 }
 function active() {return enabled&&ready;}
 function wormSpriteNew(d,fr) {
  return memo('worm|'+d+'|'+fr,()=>canvas(7,4,3.5,2,c=>{mirror(c,d);const K=kit(c,palette.worm,d);for(let i=0;i<14;i++){const v=-3.2+i*.48,wave=Math.round(Math.sin(fr/12*Math.PI*2+i*.45)*2)/2,q=K.point(wave*.35,v,.2+wave*.8);K.ell(...q,.55,.7,palette.worm[i%2?2:1]);K.dot(q[0]-.25,q[1]-.4,.5,.5,palette.worm[3]);}const q=K.point(0,.6,.5);K.ell(...q,.75,.75,palette.worm[3]);}));
 }
 drawFrog=function(c,f){if(!active())return native.drawFrog(c,f);const fr=frogFrame(f),d=direction(f,f.hop?f.tx-f.fx:NaN,f.hop?f.ty-f.fy:NaN),sp=frogSpriteNew(fr,d),px=f.x*TILE,py=f.y*TILE+3,arc=f.hop>.1?Math.sin(Math.min(1,f.hop)*Math.PI)*9:0;
  c.save();c.fillStyle='rgba(10,8,4,.28)';c.beginPath();c.ellipse(px,py,4.5-arc*.2,1.6,0,0,7);c.fill();c.imageSmoothingEnabled=false;blit(c,sp,Math.round(px),Math.round(py-arc+1));c.restore();};
 drawButterfly=function(c,b){if(!active())return native.drawButterfly(c,b);const d=targetDir(b),sp=insect('butterfly',d,quant(b.ph),b.col);c.save();c.imageSmoothingEnabled=false;c.fillStyle='rgba(10,8,4,.18)';c.fillRect(b.x*TILE-1,b.y*TILE+2,3,1);blit(c,sp,b.x*TILE,b.y*TILE-10-Math.sin(b.ph*.5)*2);c.restore();};
 drawWorm=function(c,w){if(!active())return native.drawWorm(c,w);const d=direction(w,NaN,NaN),fr=quant(w.ph*5),sp=wormSpriteNew(d,fr);c.save();c.imageSmoothingEnabled=false;const px=Math.round(w.x*TILE),py=Math.round(w.y*TILE);c.fillStyle='rgba(10,8,4,.22)';c.fillRect(px-3,py+2,7,1);blit(c,sp,px+.5,py+1);c.restore();};
 beDrawBees=function(c,h){if(!active())return native.beDrawBees(c,h);if(!beDay())return;c.save();c.imageSmoothingEnabled=false;for(const b of h.bees){const x=Math.round(b.x*TILE+Math.sin(Game.time*14+b.ph)*2),y=Math.round(b.y*TILE-6+Math.cos(Game.time*11+b.ph)*2),d=targetDir(b),fr=Math.floor(Game.time*25+b.ph)&1;blit(c,insect('bee',d,fr),x+1.5,y+.5);}c.restore();};
 wlDraw=function(c,o){if(!active()||o.k!=='moth')return native.wlDraw(c,o);const alpha=o.fade?Math.max(0,1-o.fade/1.2):Math.min(1,(WL_SPEC[o.k].life[1]-o.life)/1.5+.2);c.save();c.imageSmoothingEnabled=false;for(let j=0;j<o.n;j++){const speed=1.3+j*.27,a=Game.time*speed+j*2.1+o.id,r=3+j*1.6,mx=(o.lx||o.x)*TILE+Math.cos(a)*r,my=(o.ly||o.y)*TILE-12+Math.sin(a*1.4)*r*.6,d=wrap(Math.round(Math.atan2(-Math.sin(a),Math.cos(a*1.4)*.84)/(Math.PI/4)),8),fr=Math.floor(Game.time*18+j)%4;c.globalAlpha=alpha*.9;c.fillStyle='rgba(255,240,180,.18)';c.fillRect(mx-3,my-3,6,6);blit(c,insect('moth',d,fr),mx,my);}c.restore();};
 drawFireflies=function(c){if(!active())return native.drawFireflies(c);const fl=Game.flies;if(!fl?.length)return;const vis=Math.max(0,Math.min(1,(nightAmt()-.15)/.4));if(vis<=.02)return;c.save();c.imageSmoothingEnabled=false;for(const f of fl){const x=(f.cx+Math.cos(f.a)*f.r+Math.sin(f.ph*.7)*.3)*TILE,y=(f.cy+Math.sin(f.a*1.3)*f.r*.6)*TILE-f.z-Math.sin(f.ph*f.zw)*3,k=Math.max(0,Math.sin(f.ph*f.bl))**.6*vis;if(k<.05)continue;const X=Math.round(x),Y=Math.round(y),d=wrap(Math.round(Math.atan2(-Math.sin(f.a),Math.cos(f.a*1.3)*.78)/(Math.PI/4)),8);c.globalCompositeOperation='lighter';c.globalAlpha=k*.16;c.fillStyle='#d8f060';c.fillRect(X-3,Y-2,7,5);c.fillRect(X-2,Y-3,5,7);c.globalAlpha=k*.36;c.fillRect(X-2,Y-1,5,3);c.fillRect(X-1,Y-2,3,5);c.globalCompositeOperation='source-over';c.globalAlpha=k;blit(c,insect('firefly',d,quant(f.ph*25,2)),X+.5,Y+.5);}c.restore();};
 fwDraw=function(c,W){if(!active()||!['snail','newt','moth'].includes(W.k))return native.fwDraw(c,W);const prev=context,d=targetDir(W);context={d,flip:(d>4)!==(W.face<0)};try{return native.fwDraw(c,W);}finally{context=prev;}};
 naFrame=function(kind,fr){if(!active()||!['snail','newt','moth'].includes(kind))return native.naFrame(kind,fr);const d=context?.d??2;return nativeSprite(kind,fr,d,context?.flip??false);};
 function loadImage(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image load: '+url));im.src=url;});}
 const api=window.FantasyPublishedSmallfauna={version:'2-worldscale',views,errors,landmarks,requiredAssets:['palettes.json','frog-atlas.json','frog-directions.png'].map(s=>new URL(s,root).href),get ready(){return ready;},get enabled(){return enabled;},set enabled(v){enabled=!!v;},stats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries:MAX_ENTRIES,maxRGBABytes:MAX_BYTES,hits,misses}),clear(){cache.clear();bytes=0;},preview(kind,fr,d=0,col){if(!ready)throw new Error('Small fauna assets not ready');if(kind==='frog')return frogSpriteNew(fr,d);if(kind==='worm')return wormSpriteNew(d,wrap(+fr||0,12));if(['snail','newt','moth-large'].includes(kind))return nativeSprite(kind==='moth-large'?'moth':kind,fr,d,d>4);return insect(kind,d,+fr||0,col);},native};
 api.readyPromise=Promise.all([fetch(new URL('palettes.json',root)).then(r=>{if(!r.ok)throw Error('palettes HTTP '+r.status);return r.json();}),fetch(new URL('frog-atlas.json',root)).then(r=>{if(!r.ok)throw Error('atlas HTTP '+r.status);return r.json();}),loadImage(new URL('frog-directions.png',root).href)]).then(([p,a,im])=>{if(a.frames.length!==35||!a.poseCalibration||frogNames.some(k=>!a.poseCalibration[k]||!Number.isFinite(a.poseCalibration[k].scaleX)||!Number.isFinite(a.poseCalibration[k].scaleY)))throw Error('Expected 35 calibrated frog cells');palette=p;atlas=a;frogImage=im;ready=true;return true;}).catch(e=>{errors.push(String(e));console.error('[Smallfauna]',e);return false;});
})();
