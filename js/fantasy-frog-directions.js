/* Humanoid frogfolk only. Artwork and transient direction context only. */
(() => {
 'use strict';if(window.FrogDirections)return;
 const kinds=['ftG','ftB','ftP','ftR','ftK','ftQ','ftZ','ftZF'].filter(k=>NA_SPEC[k]);
 const headings=['S','SE','E','NE','N','NW','W','SW'],views=['S','SE','E','NE','N','NE','E','SE'];
 const oldFrame=naFrame,oldDraw=neuDraw,oldBlit=blitFine,oldBoar=typeof beDrawBoar==='function'?beDrawBoar:null;
 const cache=new Map();let active='E',bytes=0,hits=0;const maxBytes=32*1024*1024,maxEntries=1100;
 const clamp=x=>Math.max(0,Math.min(1,x)),lerp=(a,b,t)=>a+(b-a)*t;
 function tools(c,P){const K=x=>naK(P,x);
  const point=(x,y,width=0)=>{if(!c.directionWeaponFit)return[x,y];let m=c.getTransform();if(c.directionPost)m=c.directionPost.multiply(m);const p=m.transformPoint({x,y}),margin=4+width*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))*.5,q={x:Math.max(margin,Math.min(c.canvas.width-margin,p.x)),y:Math.max(margin,Math.min(c.canvas.height-margin,p.y))},r=m.inverse().transformPoint(q);return[r.x,r.y]};
  const poly=(p,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(...point(...p[0]));for(const a of p.slice(1))c.lineTo(...point(...a));c.closePath();c.fill()};return{K,
   dot:(x,y,w,h,col)=>c.directionWeaponFit?poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],col):(c.fillStyle=col,c.fillRect(x,y,w,h)),
   ell:(x,y,w,h,col)=>{if(!c.directionWeaponFit)return ellipse(c,x,y,w,h,col);poly(Array.from({length:20},(_,i)=>[x+Math.cos(i*Math.PI/10)*w,y+Math.sin(i*Math.PI/10)*h]),col)},
   line:(x,y,X,Y,w,col)=>{c.lineCap='round';naLimb(c,...point(x,y,w),...point(X,Y,w),w,col)},poly
  }
 }
 function frogRig(kind,P,front=false){const role=kind==='ftZF'?'Z':kind.slice(2),cr=P.sleep?1:P.crouch||0,air=P.air||0,dy=cr*3.2,norm=3*NA_SPEC.ftZ.sc,sx=front?-36/norm:role==='Z'?14/norm:3.2+(P.x>0?.4:0),sy=front?-60/norm:role==='Z'?(-58+cr*7)/norm:-17+dy,pipe=P.pipe||0,hx=9.4+(P.a>.5&&role!=='P'?1.2:0)-(P.hurt>.5?1.4:0),hy=-22.4+dy*.8+(P.hurt>.5?1:0)+(P.sleep?1.6:0);let H,phi;
  const r0=[sx+9,sy+6],wnd=[sx-3.5,sy+1],str=[sx+14,sy-.5];
  if(air>.3)H=[sx+6,sy-2-air*4];else if(P.up>.5)H=[sx+4,sy-14+(1-P.up)*6];else if(P.b>.5)H=[sx+8,sy-2.5];else if(P.cast>0&&['P','R','K','Q'].includes(role))H=[sx+8+P.cast*2,sy-7-P.cast*5];else if(pipe>0)H=[hx+5-pipe,hy+4+(1-pipe)*4];else H=P.a<0?[lerp(r0[0],wnd[0],-P.a),lerp(r0[1],wnd[1],-P.a)]:[lerp(r0[0],str[0],Math.min(1,P.a)),lerp(r0[1],str[1],Math.min(1,P.a))];
  phi=air>.3?-.6:P.up>.5?-1.35:P.b>.5?-1.9:P.a<0?lerp(-1.25,['P','R'].includes(role)?-2.5:-.4,-P.a):lerp(-1.25,['P','R'].includes(role)?.25:.06,Math.min(1,P.a));
  if(role==='Z'){const zdy=cr*7;if(air>.3){H=[44/norm,(-96+zdy)/norm];phi=-1.6}else if(P.up>.5){H=[30/norm,-120/norm];phi=-1.7}else if(P.b>.5){H=[48/norm,(-76+zdy)/norm];phi=-2.5}else if(P.a<0){const t=-P.a;H=[(42-t*22)/norm,(-34-t*56+zdy)/norm];phi=-2.15-t*.5}else{const t=Math.min(1,P.a);H=[(42+t*16)/norm,(-34-t*22+zdy)/norm];phi=-2.15+t*.95}}
  if(front){H=[-54/norm,(-34-(P.leg||0)*2)/norm];phi=-Math.PI/2}
  let far=[7+(P.leg||0)*1.6,-1.3-Math.max(0,-(P.leg||0))*1.4];if(air>.3||P.up>.5)far=[sx+10,sy+1-air*8];let farShoulder=[sx-2,sy];if(role==='Z'){const up=air>.3||P.up>.5;far=up?[30/norm,-100/norm]:[(46+(P.leg||0)*4)/norm,-6/norm];farShoulder=[4/norm,(-62+cr*7)/norm]}if(front){far=[(56+(P.leg||0)*2)/norm,-6/norm];farShoulder=[36/norm,-60/norm]}return{far:{shoulder:farShoulder,elbow:[(farShoulder[0]+far[0])/2,(farShoulder[1]+far[1])/2+1],hand:far},shoulder:[sx,sy],elbow:[(sx+H[0])/2-.5,(sy+H[1])/2+2.2],hand:H,angle:phi,hx,hy};
 }
 function frog(c,kind,P,v,fr){const {K,dot,ell,line,poly}=tools(c,P),role=kind==='ftZF'?'Z':kind.slice(2),T=FT_PAL[role],back=v==='N'||v==='NE',quarter=v==='SE'||v==='NE',side=v==='E',royal=role==='K'||role==='Q',mage=role==='P'||role==='R',norm=3*NA_SPEC.ftZ.sc,nativeFront=kind==='ftZF'&&/^[iw]/.test(fr);
  const ink=K('#2d3026'),skin=K(T.skin),deep=K(T.skin2),lit=K(shade(T.skin,.25)),cloth=K(T.cloak),fold=K(T.cloak2),seam=K(shade(T.cloak,.35)),tan=K(T.belly2),cream=K(T.belly),gold=K('#c39a4f');
  const volume=(x,y,w,h,col=skin,dark=deep,light=lit)=>{ell(x,y,w+.35,h+.35,ink);ell(x,y,w,h,dark);ell(x-.3,y-.3,w*.84,h*.82,col);ell(x-w*.27,y-h*.4,w*.36,h*.22,light)};
  const limb=(a,b,w,col)=>{line(...a,...b,w+.6,ink);line(...a,...b,w,col);line(a[0]-.35,a[1]-.3,b[0]-.35,b[1]-.3,w*.2,lit)};
  const cr=P.sleep?1:P.crouch||0,air=P.air||0,sw=P.sleep?0:P.leg||0,dy=cr*3.2,R=frogRig(kind,P,nativeFront),headX=(side?R.hx:quarter?4.1:0)+(role==='K'&&fr[0]==='d'?clamp((Math.abs(P.rot)-.5)/.6)*(side||quarter?2:7):0),headY=R.hy+(role==='Z'?air*3.2:0);
  const hand=(x,y)=>{volume(x,y,2,1.2);for(const [xx,yy]of[[2.6,.6],[2.2,-.6],[1.6,1.4]]){line(x,y,x+xx+.4,y+yy,1.1,ink);line(x,y,x+xx+.4,y+yy,.65,skin);dot(x+xx,y+yy-.2,.4,.35,lit)}};
  function weapon(){const H=R.hand;limb(R.shoulder,R.elbow,2.7,skin);limb(R.elbow,H,2.3,skin);line(...R.elbow,...H,1.5,fold);c.directionWeaponFit=true;c.save();c.translate(...H);c.rotate(R.angle);
   const shaft=(lo,hi,w=1.4)=>{line(lo,0,hi,0,w+.65,ink);line(lo,0,hi,0,w,K('#8e704a'));line(lo,-.3,hi,-.3,.4,K('#cfb27a'));for(const x of[-2,-1,0,1,2])line(x,-.8,x+.4,.8,.3,tan)};
   if(nativeFront){/* Native straight staff is placed below in body coordinates. */}
   else if(role==='B'){if(!P.pipe){shaft(-4,8,.8);poly([[8,-.9],[11.6,0],[8,.9]],K('#91aa75'))}}
   else if(role==='G'||royal){const lo=role==='Q'?-14:role==='K'?-10:-9,hi=role==='Q'?22:role==='K'?17:14;shaft(lo,hi,role==='Q'?1.9:1.3);if(role==='G'){poly([[hi-1,-1.4],[hi+6,0],[hi-1,1.4],[hi-2,0]],ink);poly([[hi,-.8],[hi+5,0],[hi,.8]],K('#b9c1ac'))}else if(role==='K'){for(const y of[-2.2,0,2.2]){line(hi-1,y,hi+3.6,y,1.1,gold);line(hi+3.6,y,hi+7,y*.4,.8,K('#efce80'))}}else{poly([[hi-3,-1.4],[hi+2,-6],[hi+9,-3.4],[hi+9,0],[hi+2,-1.2]],ink);poly([[hi-2,-1.8],[hi+2,-5],[hi+8,-3],[hi+7,-1],[hi+2,-1.5]],K('#a8bbb4'));line(hi+9,0,hi+14,0,1.2,gold)}}
   else{const hi=role==='Z'?102/norm:19,lo=role==='Z'?-36/norm:-15;shaft(lo,hi,1.7);if(role==='Z'){line(hi-7/norm,0,hi-3/norm,4/norm,.4,seam);line(hi-9/norm,0,hi-3/norm,-5/norm,.4,fold);line(lo,0,lo-2,2,.8,fold)}else{line(hi,0,hi+4,3,1.7,fold);line(hi+4,3,hi+7,1,1.5,fold);const gl=P.cast||.18;volume(24,1.6,2+gl*2,2+gl*2,role==='R'?K('#c76e39'):K('#6b9fae'),deep,K('#f7e3ad'))}for(const x of[8,10.2,12.4]){line(x,-1.5,x-1,-5-(x%3),.5,tan);ell(x-1,-5-(x%3),.5,.6,gold)}}
   c.restore();if(nativeFront){const x=-60/norm;line(x,-2/norm,x+8/norm,-152/norm,1.6,fold);line(x-.2,-2/norm,x+8/norm-.2,-152/norm,.7,seam);line(x+8/norm,-152/norm,x+14/norm,-160/norm,.4,seam);line(x+8/norm,-150/norm,x+2/norm,-158/norm,.4,fold)}c.directionWeaponFit=false;hand(...H);
  }
  if(role==='Z'&&!P.dead){c.directionWeaponFit=true;line(3,-11+dy,-7,-36+dy,1.55,fold);line(-7,-36+dy,-9.4,-39+dy,.9,seam);line(-5.6,-32.4+dy,-3.4,-28+dy,.45,tan);ell(-3.4,-27.4+dy,.55,.65,deep);ell(-2.4,-26.6+dy,.55,.65,fold);c.directionWeaponFit=false}
  limb(R.far.shoulder,R.far.elbow,2.5,deep);limb(R.far.elbow,R.far.hand,2.1,deep);hand(...R.far.hand);
  if(back)weapon();
  // Separate leg projections: paired spread toes in front/back, long tarsus in profile.
  for(const s of[-1,1]){let hip=[s*5,-10+dy*.5],knee=[s*(side?6:9),-7+dy],foot=[s*(side?6:7)+sw*s*(side?3:1),-1.7-Math.max(0,sw*s)*2.4];if(side){hip=[-5+s*3,-10+dy*.55];knee=[hip[0]+lerp(7,-6,air),hip[1]+.6];foot=[lerp(hip[0]+.5+sw*s*3.2,hip[0]-13,air),lerp(-1.9-Math.max(0,sw*s)*2.4-cr*.3,hip[1]+3.4,air)]}else if(air>.3){knee=[s*12,-11];foot=[s*13,-5-air*4]}
   limb(hip,knee,5,s<0?deep:skin);volume((hip[0]+knee[0])/2,(hip[1]+knee[1])/2,4,2.7);limb(knee,foot,2.6,s<0?deep:skin);for(const t of[-1,0,1]){const x=foot[0]+(side?4:t*1.5),y=foot[1]+(side?t*.6:1.8);line(...foot,x,y,1.2,deep);line(foot[0]-.2,foot[1]-.2,x-.2,y-.2,.55,lit)}}
  // Hunched torso and a genuinely rear-facing mantle, with fixed stitch clusters.
  const cape=back||role!=='B';if(cape){const fall=clamp((Math.abs(P.rot)-.5)/.6),L=side?lerp(-19,-7,fall):quarter?lerp(-14,-7,fall):lerp(-13,-7,fall),RX=side?2:quarter?9:13;poly([[L*.6,-24+dy],[side?-5:quarter?1:5,-26+dy],[RX,-21+dy],[RX+3+sw*.4,-5],[quarter?0:5,-7],[L+sw*.5,-4]],ink);poly([[L*.6+.6,-23.5+dy],[side?-5:quarter?1:5,-25.3+dy],[RX-.6,-20.5+dy],[RX+2+sw*.4,-6],[quarter?0:5,-8],[L+1+sw*.5,-5]],cloth);for(const x of[-8,-3,3]){const xx=Math.max(L+1,Math.min(RX-1,x));line(xx,-21+dy,xx+sw*.3,-7,.55,fold)}for(let j=0;j<7;j++)dot(L+2+j*(RX-L-4)/6,-6+(j%2)*.4,.45,.6,royal?gold:seam);if(back){poly([[-8,-16+dy],[-4,-16.4+dy],[-3.5,-11],[-7.5,-10.5]],fold);for(let j=0;j<3;j++)line(-7.8+j*1.4,-15.9+dy,-7.3+j*1.4,-15.2+dy,.3,seam);if(quarter){poly([[5,-24+dy],[9,-20+dy],[11+sw*.4,-6],[6,-7],[3,-15]],fold);line(5.8,-22+dy,8.5+sw*.4,-7,.55,seam)}}}
  if(!back){volume(side?0:quarter?1:0,-13+dy,side?9.6-clamp((Math.abs(P.rot)-.5)/.6)*1.4:quarter?8.5:8,8);volume(side?3.6:quarter?3:0,-11.4+dy,side?5:4.8,5.8,cream,tan,K(shade(T.belly,.2)));line(-5,-17+dy,6,-9+dy,1.6,fold);line(-5.2,-17.3+dy,5.8,-9.3+dy,.45,seam);for(const x of[-2,0,2])ell(x,-14+x*.7+dy,.4,.5,gold);if(mage||royal)volume(3,-12+dy,1.1,1.5,K(role==='R'?'#df9552':'#94c6b6'),fold,K('#efce80'))}
  for(let j=0;j<3;j++){const x=-1+j*1.8,sway=Math.sin(j+sw*1.6)*1.1;line(x,-9.2+dy*.5,x+sway,-1.6-j%2,1.9,ink);line(x-.2,-9,x+sway-.2,-2.3-j%2,1.1,K(T.fe[j]));line(x,-8.5,x+sway,-1.6-j%2,.3,K('#efce80'))}for(let j=0;j<4;j++){const x=-4.5+j*2.8;poly([[x,-9+dy*.6],[x+2,-9+dy*.6],[x+2.1+sw*.2,-4.8],[x+.6,-3.8]],j%2?fold:cloth);line(x+.4,-8+dy*.5,x+.6,-5,.35,seam)}line(-6,-9+dy*.6,6,-9+dy*.6,1.3,fold);
  if(!back){volume(headX+1,headY+3.5,4.4+(P.sac||0)*3,2.5+(P.sac||0)*3,cream,tan,K(shade(T.belly,.2)));volume(headX,headY,side?8.2:quarter?8.8:9.2,4.9);volume(headX+(side?2.6:quarter?1.8:0),headY+2.2,side?6.6:7,2.4,cream,tan,K('#f0dfb3'));const eyes=side?[1.8]:quarter?[-3.1,4.8]:[-5.1,5.1];for(const ex of eyes){volume(headX+ex,headY-3.5,3.1,3);if(P.eye>=2||P.sleep)line(headX+ex-1.8,headY-3,headX+ex+1.7,headY-2.6,.65,deep);else{ell(headX+ex,headY-3.5,2.1,2,K('#d3ba68'));dot(headX+ex-.2,headY-4.9,.65,2.9,ink);dot(headX+ex-1,headY-4.8,.65,.65,K('#fff2cf'))}}line(headX-4,headY+2,headX+7,headY+2.2,.5,deep);if(P.mouth>.35)ell(headX+2,headY+3,4,1+P.mouth,ink);for(const x of[-5,-2,1])dot(headX+x,headY-.4,.6,.4,K(T.mark))}
  else{volume(headX,headY,quarter?7.4:8.8,4.8);line(headX-3,headY-2,headX-1,headY+2,.6,deep);line(headX+1,headY-3,headX+3,headY+1,.5,deep)}
  if(['G','P','R','Z'].includes(role)){if(back){poly([[headX-8,headY+1],[headX-7,headY-5],[headX-2,headY-7],[headX+5,headY-6],[headX+8,headY-2],[headX+7,headY+4],[headX-4,headY+5]],cloth);line(headX-2,headY-6,headX,headY+3,.7,fold);for(let j=0;j<4;j++)dot(headX-.8,headY-4+j*1.7,.4,.5,seam)}else{poly([[headX-8,headY],[headX-7,headY-5],[headX-2,headY-7],[headX+5,headY-6],[headX+8,headY-2],[headX+5.6,headY-3],[headX,headY-5.8],[headX-5.4,headY-3],[headX-6,headY+2.5]],cloth);line(headX-5,headY-4.2,headX-1,headY-6,.5,seam)}}
  if(royal){for(let j=0;j<5;j++){const x=headX-5.4+j*2.7,tip=headY-9.4-(j%2)*1.6-(role==='Q'?3+(j===2?2:0):0);poly([[x-1.2,headY-5.2],[x,tip],[x+1.2,headY-5.2]],fold);poly([[x-.7,headY-5.4],[x,tip+.8],[x+.7,headY-5.4]],gold)}line(headX-6,headY-5.2,headX+6.4,headY-5.2,1.7,gold)}
  if(!back)weapon();
  if(role==='B'&&P.pipe&&!back){const mx=R.hx+8.4,my=R.hy+2.4;line(mx-2,my,mx+14,my-.4,2,ink);line(mx-2,my,mx+14,my-.4,1.4,K('#b89562'));if(P.puff)for(let j=0;j<3;j++)ell(mx+16+j*3,my-.6-j*.3,1.5-j*.3,.8,K('#c9dab2'))}
  if(P.cast>0&&(mage||royal)){c.strokeStyle=K('#a6ce9c');c.lineWidth=.65;for(let j=0;j<3;j++){c.beginPath();c.ellipse(2,-10,14+j*6+P.cast*6,6+j*2.4+P.cast*2,0,0,7);c.stroke()}}
 }
 function pose(kind,fr){const P=naPose(fr);if(/^ft/.test(kind)&&typeof FT_DEAD!=='undefined'&&FT_DEAD[fr])Object.assign(P,FT_DEAD[fr],/^ftZ/.test(kind)?{x:6,y:0}:{});if(/^z\d+$/.test(fr))P.sq=(P.sq||1)*(1+.012*(1-Math.cos(+fr.slice(1)/12*Math.PI*2)));return P}
 function frame(kind,fr,direction='E'){
  if(!kinds.includes(kind)||window.FantasyPublishedFrogs?.enabled===false)return oldFrame(kind,fr);let i=headings.indexOf(direction);if(i<0)i=2;const view=views[i];
  const allowed=new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar,...(NA_EXTRA[kind==='ftZF'?'ftZ':kind]||[]).flatMap(s=>NA_FRAMES[s]||[])]);if(!allowed.has(fr))fr='i0';
  const key=kind+'|'+view+'|'+fr;if(cache.has(key)){hits++;const s=cache.get(key);cache.delete(key);cache.set(key,s);return s}
  const S=NA_SPEC[kind],P=pose(kind,fr),z=/^ftZ/.test(kind),frogfolk=/^ft/.test(kind),[cv,c]=mkSprite(S.w,S.h,4);c.translate(S.ax,S.ay);c.scale(S.sc||1,S.sc||1);
  if(z){const ax=S.ax*4,ay=S.ay*4;c.directionPost=new DOMMatrix().translate(ax+Math.round(P.x*(S.sc||1)*2)*2,ay+Math.round(P.y*(S.sc||1)*2)*2).rotate((P.rot||0)*180/Math.PI).scale(1/Math.sqrt(P.sq||1),P.sq||1).translate(-ax,-ay)}
  if(!z){c.translate(P.sleep?0:P.x,P.sleep?0:P.y);c.rotate(P.sleep?0:P.rot);c.scale(1,P.sq)}
  frog(c,kind,P,view,fr);
  let out=toPixelArt(cv,2,{outline:false,alphaCut:100,quant:d=>{for(let i=0;i<d.length;i+=4)if(d[i+3])for(let j=0;j<3;j++)d[i+j]=Math.round(d[i+j]/16)*16}});if(z){const base=out;base.getContext('2d').clearRect(0,0,base.width,2);out=mkCanvas(S.w*2,S.h*2);const q=out.getContext('2d');q.imageSmoothingEnabled=false;q.translate(S.ax*2+Math.round(P.x*(S.sc||1)*2),S.ay*2+Math.round(P.y*(S.sc||1)*2));q.rotate(P.rot||0);q.scale(1/Math.sqrt(P.sq||1),P.sq||1);q.drawImage(base,-S.ax*2,-S.ay*2)}out.fine=2;out.creatureDirections=true;
  if(P.fade>0){const q=out.getContext('2d'),im=q.getImageData(0,0,out.width,out.height);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)if(naHash(x,y)<P.fade)im.data[(y*out.width+x)*4+3]=0;q.putImageData(im,0,0)}
  const s={cv:out,w:S.w,h:S.h,ax:S.ax,ay:S.ay,view};bytes+=out.width*out.height*4;cache.set(key,s);while(bytes>maxBytes||cache.size>maxEntries){const k=cache.keys().next().value,v=cache.get(k);bytes-=v.cv.width*v.cv.height*4;cache.delete(k)}return s;
 }
 naFrame=function(kind,fr){return kinds.includes(kind)?frame(kind,fr,active):oldFrame(kind,fr)};
 blitFine=function(c,cv,x,y,w,h){if(!cv.creatureDirections)return oldBlit(c,cv,x,y,w,h);const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=R.smooth;c.drawImage(cv,x,y,w??cv.width/2,h??cv.height/2);c.imageSmoothingEnabled=smooth};
 neuDraw=function(c,N){const prev=active;if(kinds.includes(N.k))active=GoblinDirections.headingOf(N);try{return oldDraw(c,N)}finally{active=prev}};

 window.FrogDirections={ready:true,errors:[],kinds,headings,frame,rig:(kind,fr)=>frogRig(kind,pose(kind,fr),kind==='ftZF'&&/^[iw]/.test(fr)),portrait:(kind,fr='i0')=>frame(kind,fr,'S'),setHeading:GoblinDirections.setHeading,cacheStats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries,maxRgbaBytes:maxBytes,hits}),states:kind=>[...new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar,...(NA_EXTRA[kind==='ftZF'?'ftZ':kind]||[]).flatMap(s=>NA_FRAMES[s]||[])])]};
})();
