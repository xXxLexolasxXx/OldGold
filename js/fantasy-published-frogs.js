/* Humanoid frogfolk only. Load after native frogart/zhabpx and fantasy adapters.
 * No changes to species, pose tables, frame selectors, collisions or simulation.
 */
(() => {
 'use strict';
 if(window.FantasyPublishedFrogs)return;
 const keys=['ftG','ftB','ftP','ftR','ftK','ftQ','ftZ','ftZF'].filter(k=>NA_SPEC[k]);
 const nativeFrame=naFrame,nativeBlit=blitFine,cache=new Map();let enabled=true,pixels=0;
 const mix=(a,b,t)=>{const x=hexToRgb(a),y=hexToRgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')};
 const lerp=(a,b,t)=>a+(b-a)*t,clamp=t=>Math.max(0,Math.min(1,t));
 function pose(kind,fr){const p=naPose(fr);if(FT_DEAD[fr])Object.assign(p,FT_DEAD[fr],kind==='ftZ'||kind==='ftZF'?{x:6,y:0}:{});if(kind==='ftZF'&&/^w/.test(fr))p.rot=-(p.leg||0)*.05;if(/^z\d+$/.test(fr))p.sq=(p.sq||1)*(1+.012*(1-Math.cos(+fr.slice(1)/12*Math.PI*2)));return p}
 function draw(c,P,role,front=false,applyPose=true){
  const T=FT_PAL[role],k=col=>naK(P,col),ink=k('#2d3026');
  const skin=k(mix(T.skin,'#b5ae72',.12)),deep=k(mix(T.skin2,'#283f33',.25)),lit=k(mix(T.skin,'#f0df9d',.34)),edge=k(mix(T.skin,'#fff1c1',.58));
  const cloth=k(mix(T.cloak,'#665447',.16)),fold=k(mix(T.cloak2,'#2a2928',.12)),seam=k(mix(T.cloak,'#edc58a',.4)),cream=k(T.belly),tan=k(T.belly2),gold=k('#c39a4f'),bright=k('#efce80');
  const royal=role==='Q'||role==='K',mage=role==='P'||role==='R',hood=['G','P','R','Z'].includes(role);
  const ell=(x,y,rx,ry,col)=>ellipse(c,x,y,rx,ry,col);
  const line=(x,y,X,Y,w,col)=>{c.lineCap='round';naLimb(c,x,y,X,Y,w,col)};
  const poly=(pts,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(...pts[0]);for(const p of pts.slice(1))c.lineTo(...p);c.closePath();c.fill()};
  const dot=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,w,h)};
  const bead=(x,y,col=gold)=>{ell(x,y,.55,.65,ink);ell(x-.12,y-.12,.36,.42,col);dot(x-.25,y-.4,.25,.25,bright)};
  const volume=(x,y,rx,ry,a=skin,b=deep,l=lit)=>{ell(x,y,rx+.35,ry+.35,ink);ell(x,y,rx,ry,b);ell(x+rx*.16,y-ry*.12,rx*.86,ry*.83,a);ell(x-rx*.17,y-ry*.4,rx*.5,ry*.35,l)};
  const limb=(a,b,w,far=false)=>{line(...a,...b,w+.65,ink);line(...a,...b,w,far?deep:skin);line(a[0]-.4,a[1]-.5,b[0]-.4,b[1]-.5,w*.26,far?skin:lit)};
  const sleep=!!P.sleep,cr=sleep?1:(P.crouch||0),air=P.air||0,sw=sleep?0:P.leg,dy=cr*3.2;
  c.save();if(applyPose){c.translate(sleep?0:P.x,sleep?0:P.y);if(!sleep)c.rotate(P.rot);c.scale(1,P.sq)}
  const hand=(x,y,far=false,ground=false)=>{volume(x,y,2.1,1.25,far?deep:skin,deep,lit);for(const [fx,fy]of[[2.6,.6],[2.2,-.6],[1.6,1.4]]){const xx=x+fx+(ground?1.2:.4),yy=y+fy;line(x,y,xx,yy,1.15,ink);line(x,y,xx,yy,.7,far?skin:lit);ell(xx,yy,.48,.4,far?skin:edge)}};
  const leg=(xo,near,ph)=>{let hx=-5+xo,hy=-10+dy*.55,kx=lerp(hx+7,hx-6,air),ky=hy+.6,ax=lerp(hx+.5+ph*3.2,hx-13,air),ay=lerp(-1.9-Math.max(0,ph)*2.4-cr*.3,hy+3.4,air);
   if(front){const n=3*NA_SPEC.ftZ.sc,s=near?1:-1,lift=Math.max(0,s*P.leg)*7;hx=s*24/n;hy=(-30-lift*.4)/n;kx=s*34/n;ky=(-42-lift*.5)/n;ax=s*22/n;ay=(-9-lift)/n}
   limb([hx,hy],[kx,ky],5.1,!near);volume((hx+kx)/2,(hy+ky)/2,4.25,2.8,near?skin:deep,deep,near?lit:skin);limb([kx,ky],[ax,ay],2.6,!near);
   if(role==='Z'||royal){line(lerp(kx,ax,.28),lerp(ky,ay,.28),lerp(kx,ax,.7),lerp(ky,ay,.7),3.1,fold);for(const t of [.35,.52,.69])line(lerp(kx,ax,t)-1,lerp(ky,ay,t),lerp(kx,ax,t)+1,lerp(ky,ay,t)+.3,.35,seam)}
   const fx=ax+lerp(5.2,-1,air),fy=ay+lerp(.4,3.6,air);poly(front?[[ax-1.2,ay-.4],[ax+1.2,ay-.4],[ax+2.2,ay+1.7],[ax,ay+2.1],[ax-2.2,ay+1.7]]:[[ax,ay-.6],[fx,fy-1.1],[fx+1,fy+.2],[fx,fy+1.1],[ax,ay+1.3]],deep);
   for(const o of[-1.1,0,1.1]){if(front){line(ax,ay,ax+o*1.4,ay+1.8,.9,near?skin:deep);ell(ax+o*1.4,ay+1.8,.4,.35,lit)}else{line(ax,ay+o*.3,fx+.8,fy+o,1,near?skin:deep);line(ax+.5,ay+o*.3-.25,fx+.6,fy+o-.2,.3,near?lit:skin)}}
   for(const [xx,yy]of[[hx,hy],[kx,ky]])ell(xx-.6,yy-.7,.6,.4,near?edge:skin);
  };
  leg(-3,false,-sw);
  const norm=3*NA_SPEC.ftZ.sc,sx=front?-36/norm:role==='Z'?14/norm:3.2+(P.x>0?.4:0),sy=front?-60/norm:role==='Z'?(-58+cr*7)/norm:-17+dy;
  let far=[7+sw*1.6,-1.3-Math.max(0,-sw)*1.4];
  if(air>.3||P.up>.5)far=[sx+10,sy+1-air*8];
  if(front)far=[(56+sw*2)/norm,-6/norm];
  limb([sx-2,sy],[(sx+far[0])/2,(sy+far[1])/2+1],2.5,true);limb([(sx+far[0])/2,(sy+far[1])/2+1],far,2.1,true);hand(...far,true,true);
  // Layered mantle, rounded folds, stitch work and a moving scalloped hem.
  const flutter=(P.wing||0)*.8;
  if(role==='Z'&&!front&&!P.dead){line(3,-11+dy,-7,-36+dy,1.55,fold);line(-7,-36+dy,-9.4,-39+dy,.9,seam);line(-5.6,-32.4+dy,-3.4,-28+dy+flutter*.3,.45,tan);bead(-3.4,-27.4+dy+flutter*.3,deep);bead(-2.4,-26.6+dy+flutter*.3,fold)}
  if(front){c.fillStyle=fold;c.beginPath();c.moveTo(-9,-26);c.quadraticCurveTo(0,-28,9,-26);c.lineTo(16,-5+flutter*.25);c.quadraticCurveTo(13,-1,10,-4);c.quadraticCurveTo(0,-2,-10,-4);c.quadraticCurveTo(-13,-1,-16,-5-flutter*.25);c.closePath();c.fill();for(const s of[-1,1]){line(s*8,-23,s*13,-5,.7,cloth);line(s*6,-24,s*10,-5,.45,seam)}}
  if(role!=='B'&&!front){c.save();const falling=clamp((Math.abs(P.rot)-.7)/.5);if(falling&&role!=='Z'){c.translate(-5,0);c.scale(1-.52*falling,1);c.translate(5,0)}c.fillStyle=ink;c.beginPath();c.moveTo(-1,-24+dy);c.bezierCurveTo(-11,-27+dy,-19,-20+dy,-21,-9+flutter);c.quadraticCurveTo(-17,-2,-13,-7);c.quadraticCurveTo(-9,-1,-6,-7);c.lineTo(-1,-14);c.closePath();c.fill();
   c.fillStyle=cloth;c.beginPath();c.moveTo(-2,-23.5+dy);c.bezierCurveTo(-11,-25+dy,-18,-18+dy,-20,-9+flutter);c.quadraticCurveTo(-16,-3,-13,-8);c.quadraticCurveTo(-9,-3,-6.5,-8);c.lineTo(-2,-14);c.closePath();c.fill();
   for(let j=0;j<3;j++){line(-6-j*3,-21+j*1.7+dy,-10-j*3,-8+flutter*.6,.65,j%2?fold:seam);for(let z=0;z<4;z++)dot(-11-j*2+z*.3,-15+z*1.5+dy*.3,.35,.45,royal?gold:tan)}
   line(-18,-7+flutter,-14,-5.8,.7,royal?gold:seam);
   c.restore();
  }
  if(front)volume(0,-20,5.5,4.7);
  c.save();c.translate(0,-13+dy);c.rotate(front?0:.12+cr*.12);
  volume(0,0,front?7:9.6,front?7:8.6);volume(front?0:3.6,1.6,front?4.3:5,front?4.6:6,cream,tan,k(mix(T.belly,'#fff3d0',.3)));
  // Skin markings are authored clusters, not random grain.
  for(const[x,y,r]of[[-7,-3,.9],[-4,-5,.65],[-6,1,.7],[-3,-2,.5],[-1,-6,.6]]){ell(x,y,r,r*.7,deep);ell(x-.25,y-.25,r*.38,r*.25,lit)}
  line(-5,-4,6,4,1.8,fold);line(-5.1,-4.4,6,3.5,.55,seam);
  for(const x of[-2,0,2])bead(x,-1+x*.7);
  if(mage||royal){ell(3,1,1.2,1.6,fold);ell(2.8,.8,.7,1.1,role==='R'?k('#df9552'):k('#94c6b6'));dot(2.4,0,.45,.5,bright)}
  c.restore();
  for(let j=0;j<5;j++){const x=-5.6+j*2.4;poly([[x,-10+dy*.6],[x+2.4,-10+dy*.6],[x+2,-4.1+(j%2)],[x+.7,-3.5],[x,-5]],j%2?fold:cloth);line(x+.4,-9+dy*.6,x+1,-5.3,.35,seam)}
  line(-5.8,-10+dy*.6,6.6,-10+dy*.6,1.4,fold);bead(1,-10+dy*.6);
  for(let j=0;j<3;j++){const x=-1+j*1.8,tip=-1.6-j%2,sway=Math.sin(j+sw*1.6)*1.1;line(x,-9.2+dy*.5,x+sway,tip,1.9,ink);line(x-.2,-9,x+sway-.2,tip-.7,1.1,k(T.fe[j]));line(x,-8.5,x+sway,tip,.3,bright)}
  const hx=front?0:9.4+(P.a>.5&&role!=='P'?1.2:0)-(P.hurt>.5?1.4:0),hy=-22.4+dy*.8+(P.hurt>.5?1:0)+(sleep?1.6:0),sac=P.sac>=0?P.sac:Math.min(1,(P.mouth||0)*.9+(P.y<-.5?.15:0));
  volume(hx+1.4,hy+3.6,4.4+sac*3,2.6+sac*3,cream,tan,k(mix(T.belly,'#fff0bc',.3)));
  volume(hx,hy,front?9.2:8.2,4.9);volume(hx+(front?0:2.6),hy+2.2,front?7:6.6,2.4,cream,tan,k('#f0dfb3'));
  if((P.mouth||0)>.35){ell(hx+3,hy+2.5+P.mouth,4.8,1+P.mouth,ink);ell(hx+3.6,hy+3.4+P.mouth,3,.55,k('#d29a89'))}else{c.strokeStyle=deep;c.lineWidth=.55;c.beginPath();c.moveTo(hx-2,hy+2);c.quadraticCurveTo(hx+4,hy+3,hx+9,hy+1.6);c.stroke()}
  const eyes=front?[-5.1,5.1]:[1.8];
  for(const ex of eyes){volume(hx+ex,hy-3.5,3.1,3,skin,deep,lit);if(P.eye>=2||sleep){line(hx+ex-1.8,hy-3,hx+ex+1.7,hy-2.6,.65,deep);if(P.eye===3)line(hx+ex-1,hy-4,hx+ex+1,hy-2,.5,ink)}else{ell(hx+ex,hy-3.5,2.1,2,royal?k('#dfaa55'):k('#d3ba68'));dot(hx+ex-.2,hy-4.9,.65,2.9,ink);dot(hx+ex-1,hy-4.8,.65,.65,k('#fff2cf'));if(P.eye===1)line(hx+ex-2.5,hy-5.5,hx+ex+2.3,hy-4,.85,deep)}}
  ell(hx+(front?4.5:8.4),hy-.2,.55,.4,deep);
  for(let j=0;j<3;j++){line(hx-3.6+j*1.3,hy-.6-j*.35,hx-2+j*1.3,hy+1.3-j*.35,.45,k(T.mark));ell(hx-5.5+j*1.7,hy-1.3,.4,.28,edge)}
  if(hood&&front){c.strokeStyle=fold;c.lineWidth=4.2;c.beginPath();c.moveTo(-10,hy+4);c.bezierCurveTo(-15,hy-9,14,hy-10,10,hy+4);c.stroke();c.strokeStyle=cloth;c.lineWidth=2.4;c.stroke();c.strokeStyle=seam;c.lineWidth=.5;c.beginPath();c.moveTo(-9.6,hy+3);c.bezierCurveTo(-12,hy-7,12,hy-8,9.6,hy+3);c.stroke();for(const s of[-1,1])for(let j=0;j<4;j++)dot(s*(10-j*.4),hy-j*.8,.35,.4,tan)}
  else if(hood){c.fillStyle=fold;c.beginPath();c.moveTo(hx-11,hy+6);c.bezierCurveTo(hx-14,hy-7,hx-2,hy-13,hx+7,hy-7);c.lineTo(hx+9,hy-5);c.quadraticCurveTo(hx-2,hy-9,hx-6,hy+2);c.closePath();c.fill();
   c.strokeStyle=cloth;c.lineWidth=2.6;c.beginPath();c.moveTo(hx-10,hy+5);c.bezierCurveTo(hx-11,hy-4,hx-3,hy-10,hx+6,hy-7);c.stroke();
   c.strokeStyle=seam;c.lineWidth=.5;c.beginPath();c.moveTo(hx-10,hy+3);c.bezierCurveTo(hx-10,hy-4,hx-3,hy-9,hx+5,hy-7);c.stroke();
   for(let j=0;j<6;j++)dot(hx-9+j*.8,hy-3-j*.7,.4,.35,royal?gold:tan);
  }else if(role==='B'){line(hx-6,hy-5.4,hx+4.8,hy-5.4,1.9,cloth);for(let j=0;j<3;j++){const a=-2.4+j*.28+(P.wing||0)*.05,xx=hx-8+Math.cos(a)*7,yy=hy-8.4+j*2.2;for(const [w,col]of[[2,ink],[1.25,k(T.fe[j])]]){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(hx-3.6+j*.6,hy-5.4);c.quadraticCurveTo(hx-7+Math.cos(a)*4,hy-9+j,xx,yy);c.stroke()}line(hx-3.6+j*.6,hy-5.4,xx,yy,.3,bright)}}else{
   for(let j=0;j<5;j++){const x=hx-5.4+j*2.7,tip=hy-9.4-(j%2)*1.6-(role==='Q'?3+(j===2?2:0):0);poly([[x-1.2,hy-5.2],[x,tip],[x+1.2,hy-5.2]],fold);poly([[x-.7,hy-5.4],[x,tip+.8],[x+.7,hy-5.4]],gold);if(role==='Q')bead(x,tip+1.3,k(T.fe[j%3]))}
   line(hx-6,hy-5.2,hx+6.4,hy-5.2,1.7,gold);line(hx-5.5,hy-5.8,hx+6,hy-5.8,.45,bright);bead(hx+1,hy-5.2,k('#bc7667'));
  }
  // Preserve native shoulder, wrist and weapon axis for every action.
  const pipe=P.pipe||0,r0=[sx+9,sy+6],wnd=[sx-3.5,sy+1],str=[sx+14,sy-.5];let H;
  if(air>.3)H=[sx+6,sy-2-air*4];else if(P.up>.5)H=[sx+4,sy-14+(1-P.up)*6];else if(P.b>.5)H=[sx+8,sy-2.5];else if(P.cast>0&&(mage||royal))H=[sx+8+P.cast*2,sy-7-P.cast*5];else if(pipe>0)H=[hx+5-pipe,hy+4+(1-pipe)*4];else H=P.a<0?[lerp(r0[0],wnd[0],-P.a),lerp(r0[1],wnd[1],-P.a)]:[lerp(r0[0],str[0],Math.min(1,P.a)),lerp(r0[1],str[1],Math.min(1,P.a))];
  let zphi=null;if(role==='Z'){const zdy=cr*7;if(front){H=[-54/norm,(-34-sw*2)/norm];zphi=-Math.PI/2}else if(air>.3){H=[44/norm,(-96+zdy)/norm];zphi=-1.6}else if(P.up>.5){H=[30/norm,-120/norm];zphi=-1.7}else if(P.b>.5){H=[48/norm,(-76+zdy)/norm];zphi=-2.5}else if(P.a<0){const t=-P.a;H=[(42-t*22)/norm,(-34-t*56+zdy)/norm];zphi=-2.15-t*.5}else{const t=Math.min(1,P.a);H=[(42+t*16)/norm,(-34-t*22+zdy)/norm];zphi=-2.15+t*.95}}
  const el=[(sx+H[0])/2-.5,(sy+H[1])/2+2.2];limb([sx,sy],el,2.7);limb(el,H,2.3);line(lerp(el[0],H[0],.4),lerp(el[1],H[1],.4),lerp(el[0],H[0],.8),lerp(el[1],H[1],.8),2.7,fold);bead(lerp(el[0],H[0],.6),lerp(el[1],H[1],.6));
  const phi=zphi??(air>.3?-.6:P.up>.5?-1.35:P.b>.5?-1.9:P.a<0?lerp(-1.25,mage?-2.5:-.4,-P.a):lerp(-1.25,mage?.25:.06,Math.min(1,P.a)));
  c.save();c.translate(...H);c.rotate(phi);
  const shaft=(lo,hi,w=1.4)=>{line(lo,0,hi,0,w+.65,ink);line(lo,0,hi,0,w,k('#8e704a'));line(lo,-.3,hi,-.3,.4,k('#cfb27a'));for(const x of[-2,-1,0,1,2])line(x,-.8,x+.4,.8,.3,tan)};
  if(role==='G'||royal){const lo=role==='Q'?-14:role==='K'?-10:-9,hi=role==='Q'?22:role==='K'?17:14;shaft(lo,hi,role==='Q'?1.9:1.3);
   if(role==='G'){poly([[hi-1,-1.4],[hi+6,0],[hi-1,1.4],[hi-2,0]],ink);poly([[hi,-.8],[hi+5,0],[hi,.8]],k('#b9c1ac'));line(hi,-.8,hi+4,0,.4,k('#ede6c8'));dot(hi+5,1.3,.7,1,k('#86a55c'))}
   else if(role==='K'){for(const y of[-2.2,0,2.2]){line(hi-1,y,hi+3.6,y,1.1,gold);line(hi+3.6,y,hi+7,y*.4,.8,bright)}line(hi-2,-3,hi-2,3,1,gold)}
   else{poly([[hi-3,-1.4],[hi+2,-6],[hi+9,-3.4],[hi+9,0],[hi+2,-1.2]],ink);poly([[hi-2,-1.8],[hi+2,-5],[hi+8,-3],[hi+7,-1],[hi+2,-1.5]],k('#a8bbb4'));line(hi+2,-4.8,hi+7,-3.2,.6,k('#e1dec3'));line(hi+9,0,hi+14,0,1.2,gold);bead(hi-4,0,k('#84b4a0'))}
   for(let j=0;j<3;j++){line(hi-4-j*2,1,hi-6-j*2+flutter*.4,3+j,1.2,k(T.fe[j]));line(hi-4-j*2,1,hi-6-j*2,2.6+j,.3,bright)}
  }else if(role==='B'){if(pipe>0){/* Mouth pipe is placed below in unrotated coordinates. */}else{shaft(-4,8,.8);poly([[8,-.9],[11.6,0],[8,.9]],k('#91aa75'))}}
  else if(role==='Z'&&front){/* Native front staff is drawn below, straight down to the ground. */}
  else{const hi=role==='Z'?102/norm:19,lo=role==='Z'?-36/norm:-15;shaft(lo,hi,1.7);
   // Sweep the two terminal twigs inward, within the native rotated a6 crop.
   if(role==='Z'){line(hi-7/norm,0,hi-3/norm,4/norm,.4,seam);line(hi-9/norm,0,hi-3/norm,-5/norm,.4,fold);c.strokeStyle=fold;c.lineWidth=1.3;c.beginPath();for(let j=0;j<=8;j++){const a=j/8*3.6,r=(7-j*.4)/norm,x=lo-Math.sin(a)*r,y=r-Math.cos(a)*r;if(!j)c.moveTo(x,y);else c.lineTo(x,y)}c.stroke();line(hi-14/norm,0,hi-14/norm+3/norm,14/norm,.35,tan);bead(hi-11/norm,16/norm,deep);bead(hi-7/norm,13/norm,fold)}
   else{c.strokeStyle=fold;c.lineWidth=2.2;c.beginPath();c.moveTo(hi,0);c.bezierCurveTo(hi+3,4,hi+7,5,hi+7,1);c.stroke();c.strokeStyle=seam;c.lineWidth=.6;c.stroke()}
   for(const x of[8,10.2,12.4]){line(x,-1.5,x-1,-5-(x%3),.5,tan);bead(x-1,-5-(x%3),k(T.fe[Math.floor(x)%3]))}
   if(role!=='Z'){const gl=P.cast||Math.max(.18,P.a>.3?.5:.18);ell(24,1.6,2+gl*2,2+gl*2,mix(role==='R'?'#c76e39':'#6b9fae','#f7e3ad',gl*.7));ell(23.5,1,1.2,1.2,k('#f4eac9'));if(role==='R')for(const y of[-3,0,3])poly([[23,y-1],[26+gl*3,y],[23,y+1]],k('#e3ae5b'));else if(gl>.25)for(let j=0;j<3;j++){line(23,0,26,2-j*2,.5,k('#c5e6d6'));line(26,2-j*2,29,3-j*3,.5,k('#c5e6d6'))}}
  }
  c.restore();hand(...H);
  if(role==='Z'&&front){const xx=-60/norm;line(xx,-2/norm,xx+8/norm,-152/norm,1.6,fold);line(xx-.2,-2/norm,xx+8/norm-.2,-152/norm,.7,seam);line(xx+8/norm,-152/norm,xx+14/norm,-160/norm,.4,k('#a98c60'));line(xx+8/norm,-150/norm,xx+2/norm,-158/norm,.4,fold);for(const yy of[-50,-28,-24,-14,-10])line(xx-1.1,yy/norm,xx+1.3,yy/norm+.25,.6,tan);hand(...H)}
  if(role==='B'){if(pipe>0){const mx=hx+8.4,my=hy+2.4;line(mx-2,my,mx+14,my-.4,2,ink);line(mx-2,my,mx+14,my-.4,1.4,k('#b89562'));line(mx-2,my-.5,mx+14,my-.9,.45,k('#dfc28b'));for(const x of[3,8])line(mx+x,my-1,mx+x,my+1,.55,fold);if(P.puff)for(let j=0;j<3;j++)ell(mx+16+j*3,my-.6-j*.3,1.5-j*.3,.8,k('#c9dab2'))}else line(-8,-24+dy,6,-21+dy,1.5,k('#a88b5e'))}
  leg(2,true,sw);
  if(role==='Q'&&P.cast>0){c.strokeStyle=k('#a6ce9c');c.lineWidth=.65;for(let j=0;j<3;j++){c.beginPath();c.ellipse(2,-10,14+j*6+P.cast*6,6+j*2.4+P.cast*2,0,0,7);c.stroke()}}
  if(sleep)for(let j=0;j<2;j++){const x=hx+7+j*5,y=hy-9-j*5+(P.sleep===2?-3:0);line(x-1.5,y-1.5,x+1.5,y-1.5,.65,k('#e6e5cf'));line(x+1.5,y-1.5,x-1.5,y+1.5,.65,k('#e6e5cf'));line(x-1.5,y+1.5,x+1.5,y+1.5,.65,k('#e6e5cf'))}
  c.restore();
 }
 function frame(kind,fr){const key=kind+'|'+fr;if(cache.has(key))return cache.get(key);const S=NA_SPEC[kind],P=pose(kind,fr),z=kind==='ftZ'||kind==='ftZF',[cv,c]=mkSprite(S.w,S.h,4);c.translate(S.ax,S.ay);c.scale(S.sc||1,S.sc||1);draw(c,P,kind==='ftZF'?'Z':kind.slice(2),kind==='ftZF'&&/^[iw]/.test(fr),!z);
  let out=toPixelArt(cv,2,{outline:false,alphaCut:100});
  // Zhabien's native NA_PX path crops base art first, then rotates/translates it.
  // Keep this order: a single-pass vector transform changes staff visibility.
  if(z){const base=out;/* One-world-pixel assembly gutter for the rotated crop. */base.getContext('2d').clearRect(0,0,base.width,2);out=mkCanvas(S.w*2,S.h*2);const q=out.getContext('2d');q.imageSmoothingEnabled=false;q.translate(S.ax*2+Math.round(P.x*(S.sc||1)*2),S.ay*2+Math.round(P.y*(S.sc||1)*2));q.rotate(P.rot||0);q.scale(1/Math.sqrt(P.sq||1),P.sq||1);q.drawImage(base,-S.ax*2,-S.ay*2)}
  out.fine=2;out.fantasyFrog=true;
  if(P.fade>0){const ctx=out.getContext('2d'),im=ctx.getImageData(0,0,out.width,out.height);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(im.data[i+3]&&naHash(x,y)<P.fade)im.data[i+3]=0}ctx.putImageData(im,0,0)}
  const s={cv:out,w:S.w,h:S.h,ax:S.ax,ay:S.ay};pixels+=out.width*out.height;while(pixels>10e6&&cache.size){const key=cache.keys().next().value,old=cache.get(key);pixels-=old.cv.width*old.cv.height;cache.delete(key)}cache.set(key,s);return s;
 }
 naFrame=function(kind,fr){return enabled&&keys.includes(kind)?frame(kind,fr):nativeFrame(kind,fr)};
 blitFine=function(c,cv,x,y,w,h){if(!cv.fantasyFrog)return nativeBlit(c,cv,x,y,w,h);const old=c.imageSmoothingEnabled;c.imageSmoothingEnabled=typeof R!=='undefined'?R.smooth:false;c.drawImage(cv,x,y,w??cv.width/2,h??cv.height/2);c.imageSmoothingEnabled=old};
 window.FantasyPublishedFrogs={version:1,keys,nativeFrame,frame,cache,setEnabled(value){enabled=!!value},get enabled(){return enabled},settings:{fine:2,worldPixelStep:.5,autoOutline:false},states:()=>Object.fromEntries(keys.map(k=>[k,[...new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar,...(NA_EXTRA[k==='ftZF'?'ftZ':k]||[]).flatMap(s=>NA_FRAMES[s]||[])])]]))};
})();



