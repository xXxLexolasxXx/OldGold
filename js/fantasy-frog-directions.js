/* Humanoid frogfolk only. Artwork and transient direction context only. */
(() => {
 'use strict';if(window.FrogDirections)return;
 const kinds=['ftG','ftB','ftP','ftR','ftK','ftQ','ftZ','ftZF'].filter(k=>NA_SPEC[k]);
 const headings=['S','SE','E','NE','N','NW','W','SW'],views=['S','SE','E','NE','N','NE','E','SE'];
 const oldFrame=naFrame,oldDraw=neuDraw,oldBlit=blitFine;
 const facing=new WeakMap(),forced=new WeakMap();
 function headingOf(n){
  if(forced.has(n))return forced.get(n);
  const prev=facing.get(n),target=n.tg&&typeof neuUnit==='function'?neuUnit(n.tg):null;
  let dx=0,dy=0,h=prev?.h??(n.vf?0:n.face<0?6:2);
  if(target&&['atk','chase','idle'].includes(n.st)){dx=target.x-n.x;dy=target.y-n.y}
  else if(prev){dx=n.x-prev.x;dy=n.y-prev.y}
  if(n.st!=='die'){
   if(Math.hypot(dx,dy)>.0005)h=(Math.round(Math.atan2(dx,dy)/(Math.PI/4))+8)%8;
   else if(prev&&n.face!==prev.face)h=n.face<0?6:2;
  }
  facing.set(n,{x:n.x,y:n.y,face:n.face,h});
  return headings[h];
 }
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
 const materials={
  G:{cloth:'#49503a',fold:'#292e25',seam:'#92916a',plane:'#71764e',rim:'#c7bf87',metal:'#887454',edge:'#dfc082'},
  B:{cloth:'#374e56',fold:'#25383e',seam:'#7c9a91',plane:'#52736e',rim:'#b6cfb3',metal:'#657a73',edge:'#c5d6b9'},
  P:{cloth:'#45375a',fold:'#2b263d',seam:'#8d7ea5',plane:'#68577d',rim:'#b9a5d1',metal:'#737c9e',edge:'#bbd3ec'},
  R:{cloth:'#693c32',fold:'#392522',seam:'#a8674c',plane:'#96533d',rim:'#e6a36d',metal:'#925735',edge:'#e6b467'},
  K:{cloth:'#6d4830',fold:'#372b24',seam:'#ae8760',plane:'#996648',rim:'#dcc295',metal:'#997348',edge:'#f1cb79'},
  Q:{cloth:'#523353',fold:'#302436',seam:'#a07891',plane:'#78516f',rim:'#d4a9b2',metal:'#a07947',edge:'#f2ce83'},
  Z:{cloth:'#503450',fold:'#302537',seam:'#907090',plane:'#715477',rim:'#c9a8b0',metal:'#80583b',edge:'#e4bd70'},
 };
 function frog(c,kind,P,v,fr){const {K,dot,ell,line,poly}=tools(c,P),role=kind==='ftZF'?'Z':kind.slice(2),T=FT_PAL[role],back=v==='N'||v==='NE',quarter=v==='SE'||v==='NE',side=v==='E',royal=role==='K'||role==='Q',mage=role==='P'||role==='R',norm=3*NA_SPEC.ftZ.sc,nativeFront=kind==='ftZF'&&/^[iw]/.test(fr);
  const M=materials[role],hood=role==='G'||mage||role==='Z';
  const ink=K('#2d3026'),skin=K(T.skin),deep=K(T.skin2),lit=K(shade(T.skin,.25)),cloth=K(M.cloth),fold=K(M.fold),seam=K(M.seam),tan=K(T.belly2),cream=K(T.belly),gold=K('#c39a4f');
  const bronze=K(M.metal),gilt=K(M.edge),rim=K(M.rim),plane=K(M.plane);
  const tassels=role==='Z'?[T.fe[0],'#874d79','#a16579']:T.fe;
  const staffDark=K('#503626'),staffLight=K('#b68a55');
  function onSilhouette(draw){
   c.save();c.globalCompositeOperation='source-atop';
   draw();
   c.restore();
  }
  const volume=(x,y,w,h,col=skin,dark=deep,light=lit)=>{ell(x,y,w+.35,h+.35,ink);ell(x,y,w,h,dark);ell(x-.3,y-.3,w*.84,h*.82,col);ell(x-w*.27,y-h*.4,w*.36,h*.22,light)};
  const limb=(a,b,w,col)=>{line(...a,...b,w+.6,ink);line(...a,...b,w,col);line(a[0]-.35,a[1]-.3,b[0]-.35,b[1]-.3,w*.2,lit)};
  function stitch(x,y){
   switch(role){
    case 'G':
     line(x-2,y-1,x,y+1,.65,bronze);line(x,y+1,x+2,y-1,.55,gilt);
     line(x-2,y+.6,x,y+2.6,.65,bronze);line(x,y+2.6,x+2,y+.6,.55,gilt);
     break;
    case 'B':
     for(let i=0;i<3;i++)line(x-1.6+i*1.35,y-1.25,x-2.1+i*1.35,y+1,.58,i===0?gilt:bronze);
     break;
    case 'P':
     poly([[x-1,y-2],[x+.85,y-.65],[x+.2,y+.1],[x+1.25,y+.35],[x-.9,y+2.2],[x-.35,y+.7],[x-1.45,y+.2]],gilt);
     break;
    case 'R':
     poly([[x-1.8,y+.9],[x-1,y-1.4],[x-.1,y-.5],[x+.6,y-2],[x+1.65,y+1],[x,y+2]],bronze);
     dot(x-.4,y+.25,1,.8,gilt);
     break;
    case 'K':
     line(x-1.8,y-1,x+1.8,y-1,.65,bronze);
     for(const dx of[-1.55,0,1.55])line(x+dx,y-1.55,x+dx,y+1.35,.52,gilt);
     break;
    case 'Q':
     poly([[x-2,y-1.3],[x,y-2.2],[x+2,y-1.3],[x+1.7,y+.9],[x,y+2],[x-1.7,y+.9]],bronze);
     poly([[x-1.15,y-.9],[x,y-1.4],[x+1.15,y-.9],[x+.85,y+.6],[x,y+1.1],[x-.85,y+.6]],gilt);
     break;
   }
  }
  const cr=P.sleep?1:P.crouch||0,air=P.air||0,sw=P.sleep?0:P.leg||0,dy=cr*3.2,R=frogRig(kind,P,nativeFront),headX=(side?R.hx:quarter?4.1:0)+(role==='K'&&fr[0]==='d'?clamp((Math.abs(P.rot)-.5)/.6)*(side||quarter?2:7):0),headY=R.hy+(role==='Z'?air*3.2:0);
  function hand(x,y,far=false){
   volume(x,y,2,1.2);
   const fingers=far&&nativeFront&&v==='S'?[[-1.45,1.75],[0,2.32],[1.45,1.75]]:[[3,.6],[2.6,-.6],[2,1.4]];
   for(const [xx,yy] of fingers){
    line(x,y,x+xx,y+yy,1.1,ink);
    line(x,y,x+xx,y+yy,.65,far?deep:skin);
    dot(x+xx-.4,y+yy-.2,.4,.35,far?skin:lit);
   }
   if(far&&side)onSilhouette(()=>{
    line(x+.65,y+.25,x+2.25,y+.5,.48,lit);
    dot(x+1.7,y-.52,.7,.42,lit);
   });
  }
  function grip(x,y){
   poly([[x-2.05,y-.62],[x-1.22,y-1.36],[x+.45,y-1.23],[x+1.06,y-.36],[x+.85,y+.95],[x-.65,y+1.32],[x-1.89,y+.62]],ink);
   poly([[x-1.75,y-.55],[x-1.12,y-1.02],[x+.28,y-.89],[x+.72,y-.2],[x+.59,y+.61],[x-.54,y+1.03],[x-1.57,y+.4]],skin);
   line(x-1.5,y-.65,x-.74,y-.83,.42,lit);
   line(x-1.64,y-.11,x-.83,y-.2,.4,deep);
   line(x-1.46,y+.45,x-.7,y+.32,.37,deep);
  }
  function weapon(){const H=R.hand;limb(R.shoulder,R.elbow,2.7,skin);limb(R.elbow,H,2.3,skin);line(...R.elbow,...H,1.5,fold);c.directionWeaponFit=true;c.save();c.translate(...H);c.rotate(R.angle);
   const shaft=(lo,hi,w=1.4)=>{line(lo,0,hi,0,w+.65,ink);line(lo,0,hi,0,w,K('#8e704a'));line(lo,-.3,hi,-.3,.4,K('#cfb27a'));for(const x of[-2,-1,0,1,2])line(x,-.8,x+.4,.8,.3,tan)};
   if(nativeFront){/* Native straight staff is placed below in body coordinates. */}
   else if(role==='B'){
    if(!P.pipe){
     shaft(-4,8,.8);
     poly([[8,-.9],[11.6,0],[8,.9]],deep);
     line(8.4,-.33,10.35,0,.48,gilt);
     line(-3.5,-.6,-1.7,.45,.5,bronze);
    }
   }else if(role==='G'||royal){
    const lo=role==='Q'?-14:role==='K'?-10:-9,hi=role==='Q'?22:role==='K'?17:14;
    shaft(lo,hi,role==='Q'?1.9:1.3);
    if(role==='G'){
     poly([[hi-1,-1.4],[hi+6,0],[hi-1,1.4],[hi-2,0]],ink);
     poly([[hi,-.8],[hi+5,0],[hi,.8]],K('#83948c'));
     line(hi-.1,-.48,hi+4,.02,.5,gilt);
    }else if(role==='K'){
     for(const y of[-2.2,0,2.2]){
      line(hi-1,y,hi+3.6,y,1.1,bronze);
      line(hi+3.6,y,hi+7,y*.4,.8,gilt);
     }
     line(hi-1,-2,hi-1,2,1.05,fold);
    }else{
     poly([[hi-3,-1.4],[hi+2,-6],[hi+9,-3.4],[hi+9,0],[hi+2,-1.2]],ink);
     poly([[hi-2,-1.8],[hi+2,-5],[hi+8,-3],[hi+7,-1],[hi+2,-1.5]],K('#a8bbb4'));
     line(hi+2,-4.6,hi+7.5,-3.1,.5,gilt);
     dot(hi+4.1,-3.45,.85,.8,K('#716e8e'));
     line(hi+9,0,hi+14,0,1.2,gold);
    }
   }else{
    const hi=role==='Z'?102/norm:19,lo=role==='Z'?-36/norm:-15;
    shaft(lo,hi,1.7);
    if(role==='Z'){
     line(hi-7/norm,0,hi-3/norm,4/norm,.4,staffLight);
     line(hi-9/norm,0,hi-3/norm,-5/norm,.4,staffDark);
     line(lo,0,lo-2,2,.8,staffDark);
    }else{
     line(hi,0,hi+4,3,1.7,fold);
     line(hi+4,3,hi+7,1,1.5,fold);
     const s=2+(P.cast||.18)*2;
     if(role==='P'){
      poly([[24-s,1.6],[24,1.6-s],[24+s,1.6],[24,1.6+s]],bronze);
      poly([[24-s*.65,1.6],[24-.4,1.6-s*.7],[24+.6,1.6],[24,1.6+s*.6]],gilt);
     }else{
      poly([[24-s,1.6+s],[24-s*.75,1.6],[24-s*.18,1.6-s],[24+s*.2,1.6-s*.15],[24+s*.7,1.6-s*.6],[24+s,1.6+s]],fold);
      poly([[24-s*.75,1.6+s*.65],[24-s*.05,1.6-s*.55],[24+s*.65,1.6+s*.55]],K('#cf7b48'));
      dot(23.6,1.6,.85,.7,gilt);
     }
    }
    for(const x of[8,10.2,12.4]){
     line(x,-1.5,x-1,-5-(x%3),.5,tan);
     ell(x-1,-5-(x%3),.5,.6,bronze);
    }
   }
   c.restore();
   // Keep the strike marks and the upright flame at their original reach.
   if(side){
    const tip=length=>[H[0]+Math.cos(R.angle)*length,H[1]+Math.sin(R.angle)*length];
    if((role==='G'||royal)&&P.a>.6){
     const [x,y]=tip((role==='Q'?22:role==='K'?17:14)+9);
     for(const s of [-1,1])line(x-2,y+s*5,x+4,y+s*4,.8,K('#d9d6ae'));
    }else if(role==='B'&&!P.pipe&&P.a>.8){
     const [x,y]=tip(8);
     for(const s of [-1,1])line(x+4,y+s*3,x+10,y+s*2.4,.7,K('#cdd9b1'));
    }else if(role==='R'&&!P.dead){
     const [x,y]=tip(24),glow=P.cast>0?P.cast:P.a>.3?.5:.18;
     for(const [i,offset] of [[0,-4],[1,0],[2,3]]){
      const top=y-4.5-glow*4-i;
      poly([[x+offset-1.2,y-1],[x+offset-.55,top+1.2],[x+offset,top],[x+offset+.65,top+1.45],[x+offset+1.2,y-1]],K(i===1?'#d99a5a':'#b86742'));
     }
     dot(x-.4,y-2,.8,.9,gilt);
    }
   }
   if(nativeFront){
    const x=-60/norm, tip=x+8/norm;
    line(x,-2/norm,tip,-152/norm,1.6,staffDark);
    line(x-.2,-2/norm,tip-.2,-152/norm,.7,staffLight);
    line(tip,-152/norm,x+14/norm,-160/norm,.4,staffLight);
    line(tip,-150/norm,x+2/norm,-158/norm,.4,staffDark);
    onSilhouette(()=>{
     for(const y of [-33,-28,-12]){
      const xx=x+8/norm*(y+2/norm)/(-150/norm);
      line(xx-.46,y,xx+.46,y,1.05,bronze);
      line(xx-.48,y-.28,xx+.24,y-.28,.58,gilt);
     }
    });
   }
   c.directionWeaponFit=false;
   // Closed fingers overlap the wood. H remains the native wrist point.
   if(nativeFront)grip(...H);
   else if(role==='B'&&P.pipe)hand(...H);
   else{
    c.save();c.translate(...H);c.rotate(R.angle+Math.PI/2);
    grip(0,0);c.restore();
   }
  }
  if(role==='Z'&&!P.dead){c.directionWeaponFit=true;line(3,-11+dy,-7,-36+dy,1.55,staffDark);line(-7,-36+dy,-9.4,-39+dy,.9,staffLight);line(-5.6,-32.4+dy,-3.4,-28+dy,.45,tan);ell(-3.4,-27.4+dy,.55,.65,deep);ell(-2.4,-26.6+dy,.55,.65,staffDark);c.directionWeaponFit=false}
  limb(R.far.shoulder,R.far.elbow,2.5,deep);limb(R.far.elbow,R.far.hand,2.1,deep);hand(...R.far.hand,true);
  if(back)weapon();
  // Separate leg projections: paired spread toes in front/back, long tarsus in profile.
  for(const s of[-1,1]){let hip=[s*5,-10+dy*.5],knee=[s*(side?6:9),-7+dy],foot=[s*(side?6:7)+sw*s*(side?3:1),-1.7-Math.max(0,sw*s)*2.4];if(side){hip=[-5+s*3,-10+dy*.55];knee=[hip[0]+lerp(7,-6,air),hip[1]+.6];foot=[lerp(hip[0]+.5+sw*s*3.2,hip[0]-13,air),lerp(-1.9-Math.max(0,sw*s)*2.4-cr*.3,hip[1]+3.4,air)]}else if(air>.3){knee=[s*12,-11];foot=[s*13,-5-air*4]}
   const planted=role==='Z'&&air<=.3&&!P.sleep&&fr[0]!=='d'&&Math.abs(P.rot)<.45&&s*sw<=0;
   const toeDrop=planted?(side?2.1:nativeFront&&v==='S'?-.65:0):0;
   limb(hip,knee,5,s<0?deep:skin);volume((hip[0]+knee[0])/2,(hip[1]+knee[1])/2,4,2.7);limb(knee,foot,2.6,s<0?deep:skin);
   for(const t of[-1,0,1]){
    const x=foot[0]+(side?4:t*1.5),y=foot[1]+(side?t*.6:1.8)+toeDrop;
    line(...foot,x,y,1.2,deep);
    line(foot[0]-.2,foot[1]-.2,x-.2,y-.2,.55,lit);
   }
   onSilhouette(()=>{
    const [kx,ky]=knee,[fx,fy]=foot;
    if(s<0){
     const tx=(hip[0]+kx)/2,ty=(hip[1]+ky)/2;
     poly([[tx-3.1,ty-1.1],[tx-1.9,ty+.1],[kx-.3,ky+.65],[fx+.35,fy-.2],[fx-.8,fy+.6],[kx-1.15,ky+1.2],[tx-2.6,ty+1.7]],role==='Z'?K('#38492f'):deep);
     poly([[tx-2.2,ty-1.9],[tx-.2,ty-2.3],[tx+1,ty-1.35],[tx-.65,ty-.5],[tx-1.8,ty-.65]],role==='Z'?K('#69754a'):skin);
    }
    poly([[kx-1.6,ky-.7],[kx+.8,ky-.9],[kx+1.4,ky+.3],[kx+.3,ky+1.2],[kx-1.5,ky+.7]],bronze);
    line(kx-1.2,ky-.7,kx+.5,ky-.65,.55,gilt);
    line(kx+.6,ky+1.4,fx+.7,fy-.5,.7,deep);
    dot(fx-.65,fy-.7,.8,.45,lit);
   });
  }
  // Hunched torso and a genuinely rear-facing mantle, with fixed stitch clusters.
  const cape=back||role!=='B';if(cape){const fall=clamp((Math.abs(P.rot)-.5)/.6),L=side?lerp(-19,-7,fall):quarter?lerp(-14,-7,fall):lerp(-13,-7,fall),RX=side?2:quarter?9:13;poly([[L*.6,-24+dy],[side?-5:quarter?1:5,-26+dy],[RX,-21+dy],[RX+3+sw*.4,-5],[quarter?0:5,-7],[L+sw*.5,-4]],ink);poly([[L*.6+.6,-23.5+dy],[side?-5:quarter?1:5,-25.3+dy],[RX-.6,-20.5+dy],[RX+2+sw*.4,-6],[quarter?0:5,-8],[L+1+sw*.5,-5]],cloth);for(const x of[-8,-3,3]){const xx=Math.max(L+1,Math.min(RX-1,x));line(xx,-21+dy,xx+sw*.3,-7,.55,fold)}for(let j=0;j<7;j++)dot(L+2+j*(RX-L-4)/6,-6+(j%2)*.4,.45,.6,royal?gold:seam);if(back){poly([[-8,-16+dy],[-4,-16.4+dy],[-3.5,-11],[-7.5,-10.5]],fold);for(let j=0;j<3;j++)line(-7.8+j*1.4,-15.9+dy,-7.3+j*1.4,-15.2+dy,.3,seam);if(quarter){poly([[5,-24+dy],[9,-20+dy],[11+sw*.4,-6],[6,-7],[3,-15]],fold);line(5.8,-22+dy,8.5+sw*.4,-7,.55,seam)}}}
  if(cape)onSilhouette(()=>{
   const left=side?-11:quarter?-9:-9.5,right=side?1:quarter?7.5:10;
   const sway=sw*.4;
   poly([[left,-19+dy],[left+3,-23+dy],[left+5,-22+dy],[left+3+sway,-7],[left+sway,-6]],plane);
   poly([[right-3,-20+dy],[right,-18+dy],[right+1+sway,-7],[right-1+sway,-7.5],[right-4,-14+dy]],fold);
   line(left+1.4,-19+dy,left+1.8+sway,-8.3,.65,seam);
   line(left+1.6,-20.9+dy,left+3.2,-22.3+dy,.78,rim);
   line(left+1.4,-18.5+dy,left+1.3,-16.6+dy,.66,rim);
   if(back){
    const center=quarter?2.8:-1;
    if(role==='Z'){
     poly([[center,-22+dy],[center+3,-17+dy],[center+.6,-13+dy],[center-2.6,-17.4+dy]],bronze);
     poly([[center,-20.8+dy],[center+1.8,-17.1+dy],[center+.5,-14.8+dy],[center-1.6,-17.4+dy]],gilt);
     poly([[center,-19.5+dy],[center+.8,-17.5+dy],[center+.4,-16+dy],[center-.7,-17.4+dy]],fold);
    }else stitch(center,-16.5+dy);
    const patch=left+3.8+sway;
    poly([[patch-1.5,-12.1],[patch+.9,-12.7],[patch+1.7,-10.4],[patch-.9,-9.6]],fold);
    line(patch-1.05,-11.8,patch+.75,-12.25,.55,K('#a17f8e'));
    dot(patch-.8,-10.65,.55,.5,bronze);
   }
   for(let j=0;j<5;j++){
    const x=left+1+j*(right-left-2)/4+sway,y=-7.3+(j%2)*.4;
    line(x-.65,y-.7,x,y,.65,bronze);line(x,y,x+.65,y-.7,.55,gilt);
   }
  });
  if(!back){volume(side?0:quarter?1:0,-13+dy,side?9.6-clamp((Math.abs(P.rot)-.5)/.6)*1.4:quarter?8.5:8,8);volume(side?3.6:quarter?3:0,-11.4+dy,side?5:4.8,5.8,cream,tan,K(shade(T.belly,.2)));line(-5,-17+dy,6,-9+dy,1.6,fold);line(-5.2,-17.3+dy,5.8,-9.3+dy,.45,seam);for(const x of[-2,0,2])ell(x,-14+x*.7+dy,.4,.5,gold);if(mage||royal)volume(3,-12+dy,1.1,1.5,K(role==='R'?'#df9552':'#94c6b6'),fold,K('#efce80'))}
  if(!back)onSilhouette(()=>{
   const x=side?2.1:quarter?.8:-.5,y=-13.7+dy;
   poly([[x-3,y-2.2],[x+1,y-2.8],[x+3,y-1],[x+.9,y+1.2],[x-2.7,y+.4]],fold);
   line(x-2.3,y-1.6,x+.6,y-2.1,.8,bronze);
   poly([[x+.4,y-2.1],[x+1.8,y-1],[x+.6,y+.2],[x-.5,y-.8]],gilt);
   dot(x+.4,y-.95,.75,.6,K('#6a91a1'));
   line(x-2,y+2,x+1.7,y+2.5,.65,tan);
   if(role!=='Z')stitch(x-2,y+2.3);
  });
  for(let j=0;j<3;j++){const x=-1+j*1.8,sway=Math.sin(j+sw*1.6)*1.1;line(x,-9.2+dy*.5,x+sway,-1.6-j%2,1.9,ink);line(x-.2,-9,x+sway-.2,-2.3-j%2,1.1,K(tassels[j]));line(x,-8.5,x+sway,-1.6-j%2,.3,K('#efce80'))}for(let j=0;j<4;j++){const x=-4.5+j*2.8;poly([[x,-9+dy*.6],[x+2,-9+dy*.6],[x+2.1+sw*.2,-4.8],[x+.6,-3.8]],j%2?fold:cloth);line(x+.4,-8+dy*.5,x+.6,-5,.35,seam)}line(-6,-9+dy*.6,6,-9+dy*.6,1.3,fold);
  if(!back){volume(headX+1,headY+3.5,4.4+(P.sac||0)*3,2.5+(P.sac||0)*3,cream,tan,K(shade(T.belly,.2)));volume(headX,headY,side?8.2:quarter?8.8:9.2,4.9);volume(headX+(side?2.6:quarter?1.8:0),headY+2.2,side?6.6:7,2.4,cream,tan,K('#f0dfb3'));const eyes=side?[1.8]:quarter?[-3.1,4.8]:[-5.1,5.1];for(const ex of eyes){volume(headX+ex,headY-3.5,3.1,3);if(P.eye>=2||P.sleep)line(headX+ex-1.8,headY-3,headX+ex+1.7,headY-2.6,.65,deep);else{ell(headX+ex,headY-3.5,2.1,2,K('#d3ba68'));dot(headX+ex-.2,headY-4.9,.65,2.9,ink);dot(headX+ex-1,headY-4.8,.65,.65,K('#fff2cf'))}}line(headX-4,headY+2,headX+7,headY+2.2,.5,deep);if(P.mouth>.35)ell(headX+2,headY+3,4,1+P.mouth,ink);for(const x of[-5,-2,1])dot(headX+x,headY-.4,.6,.4,K(T.mark))}
  else{volume(headX,headY,quarter?7.4:8.8,4.8);line(headX-3,headY-2,headX-1,headY+2,.6,deep);line(headX+1,headY-3,headX+3,headY+1,.5,deep)}
  if(['G','P','R','Z'].includes(role)){if(back){poly([[headX-8,headY+1],[headX-7,headY-5],[headX-2,headY-7],[headX+5,headY-6],[headX+8,headY-2],[headX+7,headY+4],[headX-4,headY+5]],cloth);line(headX-2,headY-6,headX,headY+3,.7,fold);for(let j=0;j<4;j++)dot(headX-.8,headY-4+j*1.7,.4,.5,seam)}else{poly([[headX-8,headY],[headX-7,headY-5],[headX-2,headY-7],[headX+5,headY-6],[headX+8,headY-2],[headX+5.6,headY-3],[headX,headY-5.8],[headX-5.4,headY-3],[headX-6,headY+2.5]],cloth);line(headX-5,headY-4.2,headX-1,headY-6,.5,seam)}}
  if(['G','P','R','Z'].includes(role)){
   // The hood's raised fold changes plane as the head turns.
   const x=headX,y=headY;
   if(back){
    const ridge=quarter?1.7:-.4;
    poly([[x-5.8,y-3.7],[x-1.8,y-6],[x+ridge,y-5.2],[x+ridge-.5,y-2.5],[x-3.6,y+.1]],seam);
    poly([[x+ridge,y-5.2],[x+5.3,y-4.8],[x+6.8,y-1.9],[x+5.6,y+2.5],[x+ridge-.5,y+3.6],[x+ridge+.8,y-.4]],fold);
    for(const j of[0,1,2])dot(x+ridge+.2+j*.55,y-3.6+j*1.65,.55,.45,seam);
   }else{
    if(side&&(role==='R'||role==='G')){
     poly([[x-7.4,y-4],[x-6.6,y-7.4],[x-2.8,y-9.15],[x+.7,y-9.4],[x+5.6,y-7],[x+7.8,y-3.1],[x+3.7,y-5.5],[x-2.6,y-5.8]],fold);
     line(x-6.1,y-7,x-2.8,y-8.55,.55,seam);
     line(x-2.8,y-8.55,x+.3,y-8.8,.55,plane);
    }
    line(x-5.8,y-3.4,x-2,y-5.7,.65,fold);
    line(x-4.5,y-4.6,x-1.8,y-5.9,.55,seam);
    line(x-6.6,y+.4,x-5.8,y-2.2,.55,fold);
   }
   const bend=sw*.4;
   if(back){
    poly([[-5,-21+dy],[-1.7,-23+dy],[1.2,-21+dy],[.1+bend,-15],[-2+bend,-13],[-3.3+bend,-17]],fold);
    line(-1.6,-21+dy,-2+bend,-16,.65,seam);
   }else{
    line(-3.7,-16+dy,-1.6,-14.7+dy,.55,seam);
    dot(-2.5,-15.6+dy,.7,.65,gold);
   }
  }
  if(royal){for(let j=0;j<5;j++){const x=headX-5.4+j*2.7,tip=headY-9.4-(j%2)*1.6-(role==='Q'?3+(j===2?2:0):0);poly([[x-1.2,headY-5.2],[x,tip],[x+1.2,headY-5.2]],fold);poly([[x-.7,headY-5.4],[x,tip+.8],[x+.7,headY-5.4]],gold)}line(headX-6,headY-5.2,headX+6.4,headY-5.2,1.7,gold)}
  onSilhouette(()=>{
   const x=headX,y=headY;
   if(hood){
    poly([[x-7,y-2.4],[x-5.3,y-5.1],[x-2.4,y-6.1],[x-.9,y-5.5],[x-4.6,y-4.3],[x-6,y-1]],plane);
    line(x-6.6,y-2.3,x-5.1,y-4.6,.7,bronze);
    dot(x-5.45,y-4.8,.65,.65,gilt);
    line(x-5.05,y-4.85,x-3.25,y-5.7,.65,rim);
    line(x-2.45,y-5.8,x-1.35,y-5.58,.55,rim);
   }
   if(!back){
    const cheek=side?x+4:quarter?x+3:x-3;
    const jaw=side?x+1.7:quarter?x+.65:x;
    poly([[jaw-4.5,y+2.8],[jaw-1.5,y+3.5],[jaw+2.1,y+3.2],[jaw+4.8,y+2.65],[jaw+4.1,y+4.4],[jaw+.6,y+5.7],[jaw-2.9,y+5.35],[jaw-4.5,y+4.35]],role==='Z'?K('#625b36'):K(shade(T.belly2,-.32)));
    poly([[jaw-3.7,y+4],[jaw-.9,y+4.7],[jaw+2.1,y+4.05],[jaw+2.7,y+4.8],[jaw+.6,y+5.75],[jaw-2.2,y+5.5]],role==='Z'?K('#413f28'):fold);
    line(jaw-2.25,y+2.55,jaw+1.25,y+2.6,.6,role==='Z'?K('#b39b60'):tan);
    poly([[cheek-1.2,y+.2],[cheek+1.3,y+.5],[cheek+2.1,y+1.15],[cheek-.2,y+1.4]],lit);
   }
  });
  if(royal){
   const collar=quarter?2:0;
   if(back){
    if(role==='Q')onSilhouette(()=>{
     const x=headX,y=headY;
     poly([[x-6.5,y-2.8],[x-3,y-.4],[x+2.9,y+.15],[x+6.8,y-1.8],[x+5.8,y+2.2],[x+2.2,y+4.9],[x-2.6,y+4.1],[x-5.5,y+2.1]],deep);
     line(x-2.8,y+.45,x+2.2,y+1,.62,K(shade(T.skin2,-.26)));
     line(x+2.2,y+1,x+4.6,y+.4,.55,K(shade(T.skin2,-.26)));
    });
    line(collar-4,-21+dy,collar,-22+dy,1.2,fold);
    line(collar,-22+dy,collar+3,-20+dy,.6,seam);
    line(collar-1,-19+dy,collar+.3,-13,.6,seam);
   }else{
    line(collar-4,-17.7+dy,collar+.8,-16+dy,1.1,gold);
    line(collar-3.6,-18+dy,collar-1.1,-17.4+dy,.42,cream);
   }
   line(headX-4,headY-5.6,headX-1,headY-5.6,.45,cream);
  }
  if(role==='B'){
   if(side){
    line(headX-5.1,headY-4.9,headX+3.9,headY-5,.85,fold);
    for(const [i,col] of T.fe.entries()){
     const a=-2.4+i*.28+(P.wing||0)*.05,x=headX-8+Math.cos(a)*7,y=headY-8.4+i*2.2;
     const baseX=headX-3.6+i*.6,baseY=headY-5.4;
     poly([[baseX,baseY],[x+1.35,y-.6],[x,y],[x+.8,y+1.4],[baseX-.5,baseY+.55]],K(shade(col,-.2)));
     line(x+.65,y+.3,baseX-.5,baseY+.1,.45,K(col));
    }
   }
   for(const [x,y] of [[-4,-14],[-2.4,-15],[4.3,-10.5]])dot(x,y+dy,.65,.55,deep);
   line(-5,-10.5+dy,-3.3,-9.4+dy,.45,lit);
  }
  if(!back)weapon();
  if(role==='B'&&P.pipe&&!back){const mx=R.hx+8.4,my=R.hy+2.4;line(mx-2,my,mx+14,my-.4,2,ink);line(mx-2,my,mx+14,my-.4,1.4,K('#b89562'));if(P.puff)for(let j=0;j<3;j++)ell(mx+16+j*3,my-.6-j*.3,1.5-j*.3,.8,K('#c9dab2'))}
  if(P.cast>0&&(mage||royal)){
   const wave=role==='P'?K('#9eb9ec'):role==='R'?K('#e7a05d'):role==='K'?K('#dbc280'):K('#9fbcaa');
   for(let j=0;j<3;j++){
    const rx=14+j*6+P.cast*6,ry=6+j*2.4+P.cast*2;
    if(mage){
     const side=j%2?1:-1;
     const x=2+side*(rx-2),y=-10+(j-1)*ry*.56;
     if(role==='P'){
      line(x-side*5,y+2,x-side*2,y-1,.65,wave);
      line(x-side*2,y-1,x-side,y+.5,.65,wave);
      line(x-side,y+.5,x,y-2,.65,gilt);
     }else{
      poly([[x-1,y+1],[x-.65,y-.65],[x+.4,y-1.55],[x+.9,y+.55]],wave);
      dot(x-side*3,y+1.55,.85,.7,gilt);
     }
    }else{
     c.strokeStyle=wave;c.lineWidth=.65;c.beginPath();
     const start=role==='K'?Math.PI*1.08:Math.PI*.12+j*.17;
     c.ellipse(2,-10,rx,ry,0,start,start+(role==='K'?Math.PI*.84:Math.PI*1.45));
     c.stroke();
    }
   }
  }
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
 neuDraw=function(c,N){const prev=active;if(kinds.includes(N.k))active=headingOf(N);try{return oldDraw(c,N)}finally{active=prev}};

 window.FrogDirections={ready:true,errors:[],kinds,headings,frame,headingOf,rig:(kind,fr)=>frogRig(kind,pose(kind,fr),kind==='ftZF'&&/^[iw]/.test(fr)),portrait:(kind,fr='i0')=>frame(kind,fr,'S'),setHeading:(n,d)=>headings.includes(d)?forced.set(n,d):forced.delete(n),cacheStats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries,maxRgbaBytes:maxBytes,hits}),states:kind=>[...new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar,...(NA_EXTRA[kind==='ftZF'?'ftZ':kind]||[]).flatMap(s=>NA_FRAMES[s]||[])])]};
})();
