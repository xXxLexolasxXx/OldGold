/* Directional graphics for the two existing boar renderers. */
(() => {
 'use strict';
 if(window.BoarDirections)return;
 const headings=['S','SE','E','NE','N','NW','W','SW'];
 const views=['S','SE','E','NE','N','NE','E','SE'];
 const oldFrame=naFrame,oldDraw=neuDraw,oldBoar=beDrawBoar,oldBlit=blitFine;
 const cache=new Map(),maxEntries=1100,maxBytes=32*1024*1024;
 let bytes=0,hits=0,active='E';
 const states=[...new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar,...(NA_EXTRA.boar||[]).flatMap(s=>NA_FRAMES[s]||[])])];
 const known=new Set(states);
 const facing=new WeakMap();
 const digFrames=6,digRate=8;
 function headingOf(actor){
  const previous=facing.get(actor);
  const target=actor.tg&&typeof neuUnit==='function'&&neuUnit(actor.tg);
  const dx=target?target.x-actor.x:previous?actor.x-previous.x:0;
  const dy=target?target.y-actor.y:previous?actor.y-previous.y:0;
  let heading=previous?.heading??(actor.vf?0:actor.face<0?6:2);
  if(actor.st!=='die'){
   if(Math.hypot(dx,dy)>.0005)heading=(Math.round(Math.atan2(dx,dy)/(Math.PI/4))+8)%8;
   else if(previous&&actor.face!==previous.face)heading=actor.face<0?6:2;
  }
  facing.set(actor,{x:actor.x,y:actor.y,face:actor.face,heading});
  return headings[heading];
 }
 function tools(c,P){const K=x=>naK(P,x);
  const point=(x,y,width=0)=>{if(!c.directionWeaponFit)return[x,y];let m=c.getTransform();if(c.directionPost)m=c.directionPost.multiply(m);const p=m.transformPoint({x,y}),margin=4+width*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))*.5,q={x:Math.max(margin,Math.min(c.canvas.width-margin,p.x)),y:Math.max(margin,Math.min(c.canvas.height-margin,p.y))},r=m.inverse().transformPoint(q);return[r.x,r.y]};
  const poly=(p,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(...point(...p[0]));for(const a of p.slice(1))c.lineTo(...point(...a));c.closePath();c.fill()};return{K,
   dot:(x,y,w,h,col)=>c.directionWeaponFit?poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],col):(c.fillStyle=col,c.fillRect(x,y,w,h)),
   ell:(x,y,w,h,col)=>{if(!c.directionWeaponFit)return ellipse(c,x,y,w,h,col);poly(Array.from({length:20},(_,i)=>[x+Math.cos(i*Math.PI/10)*w,y+Math.sin(i*Math.PI/10)*h]),col)},
   line:(x,y,X,Y,w,col)=>{c.lineCap='round';naLimb(c,...point(x,y,w),...point(X,Y,w),w,col)},poly
  }
 }
 function boar(c,P,v){const {K,dot,ell,line,poly}=tools(c,P),side=v==='E',quarter=v==='SE'||v==='NE',back=v==='N'||v==='NE',ink=K('#2b241e'),dark=K('#493c2e'),fur=K('#796044'),light=K('#b18d60'),moss=K('#647847'),sw=P.leg||0,lunge=Math.max(0,P.a||0),paw=Math.max(0,-(P.a||0));
  const volume=(x,y,w,h,col=fur,d=dark,l=light)=>{ell(x,y,w+.4,h+.4,ink);ell(x,y,w,h,d);ell(x-.4,y-.5,w*.87,h*.8,col);ell(x-w*.23,y-h*.42,w*.34,h*.19,l)};
  const feet=(near)=>{for(const s of[-1,1]){const x=side?s*8:quarter?s*6+(near?2:-1):s*6,y=near?-7:-11,phase=(near?1:-1)*s*sw;line(x,y,x+phase*2,-1-Math.max(0,phase)*2.2,2.5,dark);volume(x+phase*2,-.7-Math.max(0,phase)*2.2,1.8,.9,ink,ink,dark);dot(x+phase*2,-1.4-Math.max(0,phase)*2.2,.3,1,dark)}};
  feet(false);
  // During the side fall the rump folds inward before the body rolls over.
  const tuck=!P.wild&&!P.dead&&P.eye===3?Math.max(0,Math.min(1,(-P.rot-.85)/.35)):0;
  const barrelX=side?(P.wild?-5.4:-4.2+1.25*tuck):quarter?-1:0;
  const barrelW=side?(P.wild?19.1:16.6-tuck):quarter?12.4:10.2;
  const neckDrop=P.root?1+2*P.dig:0;
  volume(barrelX,side?-13.4:-14+neckDrop,barrelW,side?8.8:quarter?10:12);
  for(let j=0;j<7;j++){
   const x=(side?(P.wild?-17:-11):quarter?-9:-6)+j*(side?3.4:quarter?2.7:2);
   const y=neckDrop*j/6;
   poly([[x,-21+y],[x+1,-25.5-j%2+y],[x+2.5,-21+y]],dark);
  }
  poly([[-10,-18],[-6,-23],[1,-23.5],[7,-20],[4,-17],[0,-19],[-5,-17]],moss);for(const[x,y]of[[-6,-21],[0,-22],[4,-20]]){dot(x,y,2,1,K('#8c9a59'));ell(x,y-1,1.3,.7,K('#b65f42'));dot(x-.4,y-1.3,.5,.4,K('#dfcca0'))}
  if(back){
   const tx=quarter?-8:0;
   if(quarter){
    const y=-18+neckDrop*2;
    poly([[4,y+4],[6,y-2],[9,y-4],[13,y-1],[13,y+4],[10,y+6]],dark);
    poly([[9,y-2],[10,y-7],[12,y-5],[12,y]],fur);
   }
   line(tx,-10,tx-1,-7+sw,.7,dark);
   c.strokeStyle=dark;c.lineWidth=.8;c.beginPath();c.arc(tx-1,-7+sw,1.4,0,5);c.stroke();
   for(let j=0;j<5;j++)line(-4+j*2,-17+neckDrop,-3+j*2,-12+neckDrop,.45,light);
  }
  else{
   c.directionWeaponFit=true;
   const hx=side?13+lunge*5.6-paw*1.4:quarter?7+lunge*3:0;
   const hy=-13.4+lunge*3-paw*3+(P.root?3+3*P.dig:0);
   volume(hx,hy,side?7:quarter?7.5:8,6.3);
   const nx=hx+(side?9.8:quarter?5.5:0),ny=hy+(P.root?3+2*P.dig:1.5);
   volume(nx,ny,side?2.8:quarter?3:3.7,2.2,K('#a07b62'),dark,K('#c0a184'));
   for(const x of(side?[.8,2]:[-1.5,1.5]))dot(nx+x,ny-.5,.7,.9,ink);
   for(const s of(side?[1]:[-1,1])){
    const x=hx+s*(side?5:5.2);
    poly([[x-1,hy+4.2],[x+1.1,hy-2.4],[x+2,hy+3]],K('#e6dabb'));
    poly([[hx+s*4,hy-4],[hx+s*6,hy-10],[hx+s*8,hy-5]],dark);
    if(P.eye<2){
     ell(hx+s*4.5,hy-2,1,.8,K('#e8c65d'));
     dot(hx+s*4.5,hy-2.3,.45,.6,ink);
    }
   }
   if(P.mouth>.4)dot(hx-1,hy+4,4,1,K('#743b30'));
   c.directionWeaponFit=false;
  }
  for(const[x,y]of[[-8,-16],[-5,-13],[-2,-18],[1,-16],[3,-12]]){
   poly([[x-1.1,y],[x+.2,y-.8],[x+2.8,y+.8],[x+.8,y+.65],[x+1.3,y+1.8]],dark);
   dot(x-.3,y-.65,1.6,.45,light);
  }
  feet(true);
 }
 function frame(fr,direction='E'){
  if(!known.has(fr))fr='i0';
  const view=views[headings.indexOf(direction)]||'E';
  const key='guard|'+view+'|'+fr;
  if(cache.has(key)){
   hits++;
   const s=cache.get(key);
   cache.delete(key);cache.set(key,s);
   return s;
  }
  const S=NA_SPEC.boar,P=naPose(fr),[cv,c]=mkSprite(S.w,S.h,4);
  c.translate(S.ax,S.ay);
  c.scale(S.sc||1,S.sc||1);
  c.translate(P.sleep?0:P.x,P.sleep?0:P.y);
  if(P.up>.5){
   c.translate(-10,0);c.rotate(-.38*P.up);c.translate(10,0);
  }
  c.rotate(P.dead?0:P.rot*.4);
  if(P.dead){
   c.translate(0,-13);c.scale(1,-1);c.translate(0,13);
  }
  c.scale(1,P.sq);
  boar(c,P,view);
  const out=toPixelArt(cv,2,{outline:false,alphaCut:100,quant:d=>{
   for(let i=0;i<d.length;i+=4)if(d[i+3])for(let j=0;j<3;j++)d[i+j]=Math.round(d[i+j]/16)*16;
  }});
  out.fine=2;
  out.fantasyBoarDirections=true;
  if(P.fade>0){
   const q=out.getContext('2d'),im=q.getImageData(0,0,out.width,out.height);
   for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
    if(naHash(x,y)<P.fade)im.data[(y*out.width+x)*4+3]=0;
   }
   q.putImageData(im,0,0);
  }
  const s={cv:out,w:S.w,h:S.h,ax:S.ax,ay:S.ay,view};
  cache.set(key,s);bytes+=out.width*out.height*4;
  while(bytes>maxBytes||cache.size>maxEntries){
   const k=cache.keys().next().value,v=cache.get(k);
   bytes-=v.cv.width*v.cv.height*4;cache.delete(k);
  }
  return s;
 }
 naFrame=function(kind,fr){return kind==='boar'?frame(fr,active):oldFrame(kind,fr)};
 blitFine=function(c,cv,x,y,w,h){
  if(!cv.fantasyBoarDirections)return oldBlit(c,cv,x,y,w,h);
  const smooth=c.imageSmoothingEnabled;
  c.imageSmoothingEnabled=R.smooth;
  c.drawImage(cv,x,y,w??cv.width/2,h??cv.height/2);
  c.imageSmoothingEnabled=smooth;
 };
 neuDraw=function(c,N){
  if(N.k!=='boar')return oldDraw(c,N);
  const previous=active;active=headingOf(N);
  try{return oldDraw(c,N)}finally{active=previous}
 };
 if(oldBoar)beDrawBoar=function(c,b){
  const h=headingOf(b),i=headings.indexOf(h),view=views[i];
  const digging=b.root>0, digPhase=digging?(digFrames-Math.floor(b.root*digRate)%digFrames)%digFrames:0;
  const fr=digging?'root'+digPhase:b.moving?'w'+(Math.floor(b.ph*.6*6)%12):'i0';
  const native=beSpr('boarA',BOAR_A),w=afW(native),height=afH(native),key='wild|'+view+'|'+fr;
  let s=cache.get(key);
  if(!s){
   const raw=mkCanvas(w*4,height*4),q=raw.getContext('2d'),p=naPose(fr);
   p.root=digging;p.wild=true;
   p.dig=(1-Math.cos(digPhase/digFrames*Math.PI*2))*.5;
   q.scale(4,4);q.translate(w/2,height-.2);q.scale(w/50,(height-.2)/27);
   boar(q,p,view);
   const cv=toPixelArt(raw,2,{outline:false,alphaCut:100});
   s={cv,w,h:height};cache.set(key,s);bytes+=cv.width*cv.height*4;
   while(bytes>maxBytes||cache.size>maxEntries){const k=cache.keys().next().value,v=cache.get(k);bytes-=v.cv.width*v.cv.height*4;cache.delete(k)}
  }else hits++;
  const px=b.x*TILE,py=b.y*TILE+4;
  c.save();c.fillStyle='rgba(10,8,4,.28)';c.beginPath();
  c.ellipse(px,py,Math.max(3,w*.4),Math.max(1.6,w*.1),0,0,7);c.fill();
  c.translate(Math.round(px),Math.round(py-height+1));
  if(i>=5)c.scale(-1,1);
  c.imageSmoothingEnabled=R.smooth;
  c.drawImage(s.cv,-Math.round(w/2),0,w,height);
  c.restore();
 };
 window.BoarDirections={ready:true,errors:[],headings,frame,headingOf,states:()=>states.slice(),portrait:(fr='i0')=>frame(fr,'S'),cacheStats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries,maxRgbaBytes:maxBytes,hits})};
})();
