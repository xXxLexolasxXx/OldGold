/* Presentation only. Scout, spearman and goblin king only. */
(() => {
 'use strict';
 if(window.GoblinFamilyDirections)return;
 const kinds=['goblin','goblinB','goblinKing'];
 const headings=['S','SE','E','NE','N','NW','W','SW'],views=['S','SE','E','NE','N','NE','E','SE'];
 const oldFrame=naFrame,oldNeu=neuDraw,oldCamp=campDrawGoblin;
 const cache=new Map();let bytes=0,hits=0,active='E';
 const maxBytes=24*1024*1024,maxEntries=900;
 const frameNames=new Set([...NA_ALL,...NA_FRAMES.parry,...NA_FRAMES.roar]);
 const normalized=fr=>frameNames.has(fr)?fr:'i0';
 const heading=GoblinChampionDirections.headingOf;
 const raised=P=>Math.max(0,Math.min(1,P.up||0));
 const theta=P=>naTheta({...P,up:0})*(1-raised(P))-3*raised(P);
 function rig(kind,P){
  const shnyr=kind==='shnyrKing',king=kind==='goblinKing'||shnyr,champ=kind==='goblinChamp';
  const sx=shnyr?2.2:king?2.5:2,sy=shnyr?-14.6:king?-14.5:-14,l1=shnyr?3.8:king?4:3.8,l2=shnyr?3.6:king?3.7:3.6,a=shnyr?naTheta(P):theta(P),b=a-.4;
  const u=naDir(a),v=naDir(b),e=[sx+u[0]*l1,sy+u[1]*l1];
  if(!champ)return{shoulder:[sx,sy],elbow:e,hand:[e[0]+v[0]*l2,e[1]+v[1]*l2],angle:Math.atan2(...naDir(b+.15).slice().reverse()),fxAngle:b};
  const base=P.a>0?-.2+P.a*1.5:-.6+P.a*1.9,t=base*(1-raised(P))-2.7*raised(P);
  const ex=4+Math.cos(t+1.25)*5.2,ey=-20+Math.sin(t+1.25)*5.2;
  return{shoulder:[4,-20],elbow:[ex,ey],hand:[ex+Math.cos(t+.45)*4.8,ey+Math.sin(t+.45)*4.8],angle:t-.2,fxAngle:t-.35};
 }
 function paint(c,kind,P,view){
  const shnyr=kind==='shnyrKing',king=kind==='goblinKing'||shnyr,champ=kind==='goblinChamp',spear=kind==='goblinB',elite=king||champ;
  const B=champ?1.5:shnyr?1.12:king?1.35:1,T=champ?1.3:1,back=view==='N'||view==='NE',quarter=view==='SE'||view==='NE',side=view==='E';
  const K=x=>naK(P,x),C={ink:K('#241f24'),skin:K('#73963e'),shadow:K('#4a6e30'),light:K('#aac462'),dark:K('#45291a'),leather:K('#875434'),cloth:K(spear?'#a06840':'#7a3a4a'),fold:K('#452939'),steel:K('#867e74'),silver:K('#cec6ba'),gold:K('#c89226'),ivory:K('#f0d6a8')};
  const poly=(p,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(...p[0]);for(const v of p.slice(1))c.lineTo(...v);c.closePath();c.fill()};
  const dot=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
  const ball=(x,y,w,h,col)=>ellipse(c,x,y,w,h,col);
  const line=(x,y,X,Y,w,col)=>{c.lineCap='round';naLimb(c,x,y,X,Y,w,col)};
  const volume=(x,y,w,h,base,shadow,light)=>{ball(x,y,w,h,C.ink);ball(x,y-.2,w-.4,h-.4,shadow);ball(x-.5,y-.7,w*.75,h*.7,base);ball(x-w*.3,y-h*.35,w*.3,h*.2,light)};
  if(shnyr){C.cloth=K('#8a1a2a');C.fold=K('#5e0e1c');C.skin=K('#82b44c');C.shadow=K('#5a8634')}
  const R=rig(kind,P),sw=P.leg||0,hx=(side?1.8:quarter?1.8:0)+(champ?3.3:king?2.1:1.6)*Math.max(0,Math.min(1,(Math.abs(P.rot)-.3)/.2)),hy=champ?-26:king?-19.7:-18.6;
  naShadow(c,champ?10:king?8:6);c.save();c.translate(P.x,P.y);c.rotate(P.rot);c.scale(1,P.sq);
  function armAndWeapon(){
   const [x,y]=R.hand,[ex,ey]=R.elbow,[sx,sy]=R.shoulder;
   const wrapSwordGrip = champ;
   for(const [w,col]of[[champ?3.2:2,C.ink],[champ?2.5:1.4,C.skin]]){line(sx,sy,ex,ey,w,col);line(ex,ey,x,y,w*.9,col)}
   line(ex,ey,x,y,champ?1.8:.7,C.shadow);
   if(!wrapSwordGrip)ball(x,y,champ?1.3:1,champ?1.2:.9,C.skin);
   c.save();c.translate(x,y);c.rotate(R.angle);
   if(spear){line(-5,0,9,0,1.25,C.ink);line(-4.8,0,9,0,.8,C.leather);poly([[8.6,-1.4],[12.6,0],[8.6,1.4]],C.ink);poly([[9,-.9],[12,0],[9,.9]],C.silver);dot(7.2,-.7,1.8,1.4,C.dark);poly([[6.7,.5],[8.1,.5],[7.8+sw*.25,3.1],[6.9+sw*.25,2.6]],C.cloth)}
   else if(shnyr){line(-3,0,9,0,1.1,C.gold);volume(11,0,2.8,2.8,K('#41434d'),K('#25272d'),K('#777985'));line(12.6,0,14.2+Math.cos(R.angle)-Math.sin(R.angle),-Math.sin(R.angle)-Math.cos(R.angle),.5,C.leather);}
   else if(king){line(0,0,9,0,1.7,C.ink);line(0,-.2,8.5,-.2,1,C.leather);volume(9,0,2.7,2.7,C.leather,C.dark,C.leather);dot(7.2,-2,.7,4,C.gold);dot(9.7,-2,.6,4,C.gold);for(const yy of[-1,1])poly([[9,yy*1.4],[10.5,yy*3.1],[10.4,yy*1.2]],C.silver)}
   else if(champ){
    if(!wrapSwordGrip)dot(0,-3,1.2,6,C.dark);
    poly([[1.2,-1.6],[15,-1.3],[18,0],[15,1.4],[12,.9],[10.5,1.7],[8,1.1],[6,1.7],[1.2,1.7]],C.ink);
    poly([[1.6,-1.1],[14.8,-.8],[17,0],[14.5,.8],[12,.4],[10.2,1.1],[7.8,.5],[6,1.1],[1.6,1.1]],C.steel);
    line(2,-.9,14,-.7,.45,C.silver);
    if(wrapSwordGrip){
     const iron=K('#4a4540');
     dot(-2,-.7,3,1.4,C.dark);
     dot(-2,-.75,.45,1.5,iron);
     dot(-2,-.55,.22,.55,C.steel);
     poly([[-1.65,-.9],[-.95,-1.18],[.45,-.8],[.65,.45],[-.05,1.16],[-1.4,.91]],C.ink);
     poly([[-1.38,-.68],[-.82,-.94],[.38,-.56],[.38,.49],[-.22,.89],[-1.23,.61]],C.skin);
     line(-1.18,-.63,-.67,-.74,.32,C.light);
     line(-1.11,.17,-.58,.31,.23,C.shadow);
     line(-.79,-.18,-.21,-.11,.28,C.light);
     dot(0,-3,1.2,6,iron);
     line(.2,-2.6,.2,2.6,.4,C.silver);
    }
   }
   else{poly([[0,-1],[4,-1],[5.9,0],[3.9,1.1],[2.9,.7],[2.3,1.2],[0,1]],C.ink);poly([[.4,-.55],[3.9,-.55],[5,0],[3.6,.35],[.4,.45]],C.silver);dot(-.4,-1.5,.7,3,C.leather)}
   c.restore();if(shnyr){c.nativeFX=true;dot(x+Math.cos(R.angle)*14.4+1,y+Math.sin(R.angle)*14.4-1.6,1,1,K('#fff2a0'));c.nativeFX=false}
   if(!wrapSwordGrip){
    ball(x,y,.85,.8,C.skin);
    dot(x-.4,y-.6,.7,.4,C.light);
    for(const z of[-.3,.25,.75])line(x+z,y-.3,x+z+.35,y+.5,.2,C.shadow);
   }
   if(wrapSwordGrip&&!quarter)c.lineWidth=.2;
  }
  function farArm(){const a=shnyr?(P.up>.5?-2.7:.4):(elite?.5+P.b*.9:.3+P.b*.4)*(1-raised(P))-(elite?2.5:2.7)*raised(P),sx=shnyr?-3:elite?-3*B:-2.8,sy=shnyr?-14.4:elite?-15*T:-14.1,l1=shnyr?3.6:elite?4.3:3.6,l2=shnyr?3.2:elite?3.8:3.4,bend=shnyr?.4:elite?.6:.3,u=naDir(a),v=naDir(a+bend),ex=sx+u[0]*l1,ey=sy+u[1]*l1,x=ex+v[0]*l2,y=ey+v[1]*l2;for(const[w,col]of[[elite?2.5:1.8,C.ink],[elite?1.8:1.1,C.shadow]]){line(sx,sy,ex,ey,w,col);line(ex,ey,x,y,w*.9,col)}ball(x,y,elite?1:.75,elite?.9:.65,C.shadow);for(const z of[-.3,.3])line(x+z,y-.3,x+z+.25,y+.4,.2,C.light)}
  if(back)farArm();
  if(back)armAndWeapon();
  // Each projection has its own feet and leg construction, not a compressed side.
  if(side){for(const sign of[-1,1]){const hip=sign*1.8*B,knee=hip+sign*sw*1.2,foot=sign*2.1*B+sign*sw*2.4;line(hip,-9.4,knee,-4.8,3.1,C.ink);line(hip,-9.4,knee,-4.8,2.45,sign<0?C.shadow:C.skin);line(knee,-4.8,foot,-1.3,2.6,C.ink);line(knee,-4.8,foot,-1.3,1.9,C.dark);poly([[foot-1.7,-2],[foot+1,-2],[foot+3.2,-.8],[foot+3.1,.1],[foot-1.7,.1]],C.ink);poly([[foot-1.2,-1.6],[foot+.8,-1.6],[foot+2.4,-.7],[foot-1.2,-.5]],C.leather);line(foot-.7,-1.5,foot+.7,-1.1,.3,C.gold)}}else{
  for(const side of[-1,1]){const x=side*(quarter?2.3:2.7)*B,fy=side*sw*(quarter?1.1:1.7),kx=x+(quarter?side*sw*.5:0);
   line(x,-8.8*T,kx,-4*T,elite?3.1:2,C.ink);line(x,-8.8*T,kx,-4*T,elite?2.4:1.4,side<0?C.shadow:C.skin);line(kx,-4*T,x,-1+fy,elite?2.6:1.8,C.dark);
   poly([[x-1.6,-2+fy],[x+1,-2+fy],[x+(quarter?2.2:1.3),fy],[x+1,1+fy],[x-1.7,.5+fy]],C.ink);dot(x-1.2,-1.5+fy,2.4,1.4,C.leather);line(x-.9,-1.1+fy,x+.8,-1.1+fy,.3,elite?C.silver:C.light);
   if(champ)volume(kx,-4.8*T,1.5,1.2,C.steel,C.dark,C.silver);
  }
  }
  // Rear cloak is a rear surface: seam, folds, repairs and hem, no chest jewelry.
  if(back||elite){c.save();if(Math.abs(P.rot)>.3){c.scale(1-Math.min(.25,(Math.abs(P.rot)-.3)*.3),1)}poly([[-5*B,-16*T],[-3*B,-18*T],[3*B,-17.4*T],[5.8*B+sw*.3,-3],[2*B,-3.8],[-2*B,-2.8],[-6*B+sw*.4,-3.4]],C.ink);poly([[-4.5*B,-16*T],[-2.8*B,-17.2*T],[2.7*B,-16.8*T],[5*B+sw*.3,-4],[2*B,-4.6],[-2*B,-3.6],[-5.2*B+sw*.4,-4.2]],C.cloth);for(const x of[-3,-.5,2])line(x*B,-15*T,(x+.6)*B+sw*.3,-5,.55,C.fold);line(-4.7*B,-4.6,4.5*B,-4.6,.4,king?C.gold:C.leather);if(back){for(const y of[-15,-12,-9])dot(-.6,y*T,.5,.6,C.leather);dot(-3*B,-8,1.8,2,C.fold);line(-3*B,-7.6,-1.3*B,-7.6,.3,C.ivory)}if(view==='NE'){poly([[1.7*B,-17.2*T],[4.4*B,-15.9*T],[5*B,-5],[2.3*B,-4.7],[.9*B,-9]],C.fold);line(2*B,-16*T,3.9*B,-5.3,.6,C.leather);poly([[-4.6*B,-15.9*T],[-2.4*B,-17.5*T],[-.8*B,-16.5*T],[-2*B,-14.8*T]],C.cloth)}for(let j=0;j<7;j++)dot((-4.3+j*1.4)*B,-4.8,.3,.55,king?C.gold:C.leather);c.restore()}
  if(!back){volume(side?.7:quarter?.4:0,-12*T,(side?4.2:quarter?4.6:5.1)*B,5*T,C.cloth,C.fold,C.cloth);
   if(champ)for(let j=0;j<3;j++){const y=(-16+j*2.4)*T;poly([[-4.4*B,y],[-1,y-.4],[4*B,y+.1],[4.2*B,y+1.8],[0,y+2.5],[-4.3*B,y+2]],C.ink);poly([[-4*B,y+.4],[-1,y],[3.6*B,y+.5],[3.7*B,y+1.5],[0,y+2],[-3.9*B,y+1.6]],j===1?C.steel:C.dark);line(-3.7*B,y+.5,2.8*B,y+.6,.4,C.silver);for(const x of[-3,2.7])ball(x*B,y+1.2,.25,.25,C.gold)}
   if(king){for(let j=0;j<8;j++){const x=-4.5+j*1.3;ball(x,-16.7+Math.abs(j-3.5)*.2,.9,.8,C.ivory)}for(let j=0;j<7;j++)ball(-3+j, -14.5+Math.sin(j/6*Math.PI),.3,.3,C.gold);volume(.3,-13.2,.8,.8,C.gold,C.dark,C.ivory)}
   line(-3*B,-15*T,3.3*B,-10*T,1.1,C.dark);line(-3*B,-15.2*T,3.3*B,-10.2*T,.35,C.leather);dot(-4*B,-9.5*T,8*B,1.2,C.dark);dot(-.7,-9.7*T,1.7,1.6,C.gold);dot(-.3,-9.3*T,.8,.7,C.dark);
  }
  if(champ&&quarter){
   if(back){
    // The back plate and the near shoulder turn away with the cloak.
    poly([[-4.7,-21.2],[-1.6,-23.1],[2.2,-22.4],[5.3,-19.4],[4.4,-16.2],[1.3,-18.1],[-2.5,-18.6],[-5.8,-19.6]],C.ink);
    poly([[-4.8,-20],[-1.3,-22.2],[1.9,-21.7],[4.4,-19.4],[4,-17.5],[1.2,-19],[-2.8,-19.2]],C.steel);
    line(-3.7,-20.5,-1.1,-21.6,.55,C.silver);
    line(1,-18.8,2.7,-13.8,.8,C.fold);
    line(2,-17.2,3.4,-13.6,.55,K('#ab5c6a'));
    line(3.7,-12.5,5.4,-7,.6,K('#ab5c6a'));
   }else{
    // Staggered shoulder lames wrap the near side of the cuirass.
    volume(4.9,-20.2,2.6,2.2,C.steel,C.dark,C.silver);
    volume(5.7,-18.5,2.2,1.6,C.steel,C.dark,C.silver);
    line(4.2,-18.3,5.2,-18.8,.45,C.silver);
    line(3.9,-15.6,5.9,-16.4,.55,C.steel);
    line(2.3,-13.6,4.9,-14.3,.5,C.silver);
   }
  }
  if(!back)farArm();
  const nearEar=side?3.3:quarter?6.9:7.5,farEar=quarter?-5.3:-7.5;
  poly([[hx-2,hy-1],[hx+farEar,hy-4],[hx+farEar+1,hy],[hx-2,hy+1.3]],C.ink);poly([[hx-2.5,hy-.6],[hx+farEar+1,hy-2.9],[hx+farEar+1.6,hy-.1]],C.shadow);poly([[hx+2,hy-1],[hx+nearEar,hy-4.2],[hx+nearEar-1,hy+.3],[hx+2,hy+1.5]],C.ink);
  poly([[hx+2,hy-.6],[hx+nearEar-1,hy-3],[hx+nearEar-1.6,hy],[hx+2,hy+.8]],C.skin);
  volume(hx,hy,quarter?3.6:4,3.7,C.skin,C.shadow,C.light);
  if(!back){if(quarter||side){poly([[hx+.6,hy-1.4],[hx+3,hy-.7],[hx+5.7,hy+1],[hx+5,hy+2.2],[hx+1,hy+2.4]],C.ink);poly([[hx+1,hy-1],[hx+2.7,hy-.3],[hx+4.8,hy+.9],[hx+4.7,hy+1.5],[hx+1,hy+1.8]],C.skin);line(hx+1.5,hy-.6,hx+4.1,hy+.6,.4,C.light)}const nose=side?hx+4.1:quarter?hx+3:hx;volume(nose,hy+.9,side?2.7:quarter?2.4:1.3,1.2,C.skin,C.shadow,C.light);
   for(const ex of(side?[1.5]:quarter?[-.2,2.5]:[-1.9,1.9])){if(P.eye<2){ball(hx+ex,hy-.9,.85,.7,K('#fff2a0'));dot(hx+ex+.1,hy-1.3,.45,.8,C.ink)}else line(hx+ex-.6,hy-.9,hx+ex+.7,hy-.6,.4,C.ink);line(hx+ex-.9,hy-2,hx+ex+.8,hy-1.8,.5,C.shadow)}
   dot(hx-.9+(quarter?1:0),hy+2,2.6,.5+P.mouth*.8,C.ink);for(const x of[-.6,1.1])poly([[hx+x,hy+3.1],[hx+x+.6,hy+3],[hx+x+.3,hy+1.6]],C.ivory);
  }else{line(hx,hy-2.7,hx,hy+2.4,.4,C.shadow);dot(hx-1.8,hy+2.6,3.3,.5,C.shadow)}
  if(!elite&&!spear){poly([[hx-4.1,hy+1],[hx-4.6,hy-2.4],[hx-2.5,hy-4.7],[hx+.5,hy-5],[hx+3.6,hy-3.3],[hx+4.3,hy],[hx+2.6,hy+2.5],[hx+2,hy-1.7],[hx-.2,hy-3.2],[hx-2.5,hy-1.7],[hx-2.9,hy+2.3]],C.cloth);if(back){ball(hx,hy-.7,3.5,3.3,C.cloth);line(hx-.7,hy-3.2,hx-.4,hy+1.7,.45,C.fold)}line(hx-2.5,hy-3,hx+.2,hy-4,.4,K('#a85a6a'))}
  if(champ||spear){ball(hx,hy-3.3,4.2,2.7,C.ink);ball(hx-.2,hy-3.5,3.7,2.2,C.steel);dot(hx-4.2,hy-2.2,8.4,.7,C.dark);for(const x of[-3,-1,1,3])ball(hx+x,hy-1.8,.25,.25,C.silver);line(hx-.7,hy-5.3,hx-.7,hy-2.5,.5,C.silver);if(champ)for(const s of[-1,1])poly([[hx+s*2.5,hy-5],[hx+s*5,hy-6],[hx+s*5.7,hy-9],[hx+s*6.2,hy-8],[hx+s*6,hy-5.5],[hx+s*3,hy-4]],C.ivory)}
  if(king){poly([[-4+hx,hy-2.8],[-4.3+hx,hy-6.7],[-2.4+hx,hy-5],[-.9+hx,hy-7.5],[.6+hx,hy-5],[2.4+hx,hy-7],[3.8+hx,hy-2.8]],C.gold);dot(hx-3.6,hy-3.7,7,1.1,C.gold);line(hx-3,hy-3.5,hx+2.8,hy-3.5,.4,C.ivory);if(!back)for(const x of[-2,.3,2.3])ball(hx+x,hy-3.2,.35,.4,x===.3?K('#5292bc'):C.cloth)}
  if(champ&&back){
   // The helmet continues over the occiput and terminates above the neck.
   const x=hx+(quarter?.45:0);
   poly([[x-3.3,hy-3.2],[x+2.7,hy-3.4],[x+3.7,hy-1.4],[x+2.9,hy+.9],[x+.9,hy+1.9],[x-2.1,hy+1.6],[x-3.5,hy-.1]],C.ink);
   poly([[x-2.9,hy-3.3],[x+2.4,hy-3.4],[x+3.2,hy-1.5],[x+2.4,hy+.6],[x+.8,hy+1.4],[x-1.9,hy+1.1],[x-3,hy-.3]],C.steel);
   poly([[x+.1,hy-3.4],[x+2.4,hy-3.4],[x+3.2,hy-1.5],[x+2.4,hy+.6],[x+.8,hy+1.4],[x+1.2,hy-.7]],K('#504a46'));
   line(x-2.5,hy-1.4,x-1.6,hy-2.4,.55,C.silver);
   line(x-1.5,hy-2.5,x-.6,hy-2.6,.5,C.silver);
   dot(x-1.8,hy+.2,.6,.5,C.gold);
   dot(x+.7,hy+.5,.6,.5,C.gold);
  }
  if(!shnyr&&!champ){
   const facingOffset=quarter?1.2:0;
   if(king){
    // Fold the collar around the near shoulder. The clasp stays on the chest.
    if(back){
     volume(-1,-15.8,3.4,1.15,C.ivory,C.leather,C.silver);
     line(-2,-14.9,-.9,-11.1,.6,C.fold);
     line(1.4,-14.9,2.4+sw*.4,-8.7,.6,K('#a55b68'));
    }else{
     volume(-3.2+facingOffset,-15.6,2.3,1.25,C.ivory,C.leather,C.silver);
     volume(2.8+facingOffset,-15,1.8,1,C.ivory,C.leather,C.silver);
     line(-1.8+facingOffset,-13.7,0+facingOffset,-12.9,.45,C.gold);
     dot(-.8+facingOffset,-13.1,.55,.55,C.ivory);
    }
    line(hx-2.7,hy-4.1,hx-.8,hy-4.9,.55,C.ivory);
    line(hx+1.4,hy-4.6,hx+2.8,hy-4,.6,C.dark);
   }else if(spear){
    line(hx-2.8,hy-3.1,hx-1.4,hy-4.3,.5,C.silver);
    line(hx+1.1,hy-3.8,hx+2.8,hy-3.1,.55,C.dark);
    if(!back){
     line(-3,-13.8,-.6,-14.7,.65,C.leather);
     dot(-2.65,-13.8,.5,.5,C.gold);
     line(-2.4,-11.6,-.4,-12.1,.4,C.fold);
    }
   }else{
    line(hx-3.4,hy-2.2,hx-2.8,hy-3.5,.5,C.fold);
    line(hx-2.1,hy-3.9,hx-.7,hy-4.3,.45,K('#a85a6a'));
    if(!back){
     dot(-2.9,-12.1,1.15,1.2,C.fold);
     dot(-2.7,-12,.45,.35,C.leather);
    }
   }
  }
  if(shnyr){line(-4.5*B,-4.2,4.5*B,-4.2,1.4,C.ivory);for(const x of[-3,-1,1,3])dot(x*B,-4.5,.35,.8,C.ink);if(!back){for(const x of(side?[2.2]:[-.8,2.2])){volume(hx+x,hy-2.6,1.4,1.1,C.gold,C.dark,C.ivory);ball(hx+x,hy-2.6,.8,.6,K('#9ad8e8'))}volume(.8,-12.6,1.5,1.5,C.gold,C.dark,C.ivory);ball(.8,-12.6,.9,.9,C.ink);for(const x of[-3.4,3.6]){volume(x,-8.8,1.2,1.5,C.leather,C.dark,C.leather);line(x-.5,-9.4,x+.4,-9.4,.3,C.gold)}}}
  if(!back)armAndWeapon();
  // Shield has its own front boss / rear grip, and follows the original far hand.
  if(champ){const a=(.5+P.b*.9)*(1-raised(P))-2.5*raised(P),u=naDir(a),v=naDir(a+.6),x=-3*B+u[0]*4.3+v[0]*3.8+1,y=-15*T+u[1]*4.3+v[1]*3.8-1;volume(x,y,6.2,6.7,C.leather,C.dark,C.leather);for(const d of[-3.3,-1.6,0,1.6,3.3])line(x+d,y-4.3,x+d,y+4.3,.3,C.dark);line(x-4.3,y-2.2,x+4.3,y-2.2,.8,C.steel);line(x-4.3,y+2.2,x+4.3,y+2.2,.8,C.steel);if(back)line(x-1.4,y-2,x+1,y+2,1,C.dark);else volume(x,y,1.4,1.5,C.steel,C.dark,C.silver)}
  if(P.a>.6){c.strokeStyle='rgba(255,242,190,.65)';c.lineWidth=.5;c.beginPath();c.arc(...R.hand,champ?16:king?10:8,R.fxAngle-1.2,R.fxAngle-.2);c.stroke()}if(!elite&&P.b>.5){c.strokeStyle='rgba(220,230,200,.85)';c.lineWidth=.6;c.beginPath();c.arc(4,-13,4.6,-1.2,1.2);c.stroke()}
  c.restore();
 }
 // Fit only overflowing visual contours; rig coordinates and native FX origins stay fixed.
 function boundedContext(c){
  const point=(x,y)=>{if(c.nativeFX)return[x,y];const m=c.getTransform(),p=m.transformPoint({x,y}),pad=4+c.lineWidth*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))*.5,X=Math.max(pad,Math.min(c.canvas.width-pad,p.x)),Y=Math.max(pad,Math.min(c.canvas.height-pad,p.y));if(X===p.x&&Y===p.y)return[x,y];const q=m.inverse().transformPoint({x:X,y:Y});return[q.x,q.y]};
  const oval=(x,y,rx,ry,rotation,start,end,ccw,original,args)=>{const m=c.getTransform(),p=m.transformPoint({x,y}),co=Math.cos(rotation),si=Math.sin(rotation),ux=m.a*rx*co+m.c*rx*si,uy=m.b*rx*co+m.d*rx*si,vx=-m.a*ry*si+m.c*ry*co,vy=-m.b*ry*si+m.d*ry*co,pad=4+c.lineWidth*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))*.5,ex=Math.hypot(ux,vx),ey=Math.hypot(uy,vy);if(p.x-ex>=pad&&p.x+ex<=c.canvas.width-pad&&p.y-ey>=pad&&p.y+ey<=c.canvas.height-pad)return original.apply(c,args);let span=end-start;if(ccw){while(span>0)span-=Math.PI*2;span=Math.max(-Math.PI*2,span)}else{while(span<0)span+=Math.PI*2;span=Math.min(Math.PI*2,span)}for(let i=0;i<=32;i++){const a=start+span*i/32,X=x+Math.cos(a)*rx*co-Math.sin(a)*ry*si,Y=y+Math.cos(a)*rx*si+Math.sin(a)*ry*co;c.lineTo(...point(X,Y))}};
  const special={moveTo:(x,y)=>c.moveTo(...point(x,y)),lineTo:(x,y)=>c.lineTo(...point(x,y)),quadraticCurveTo:(x,y,X,Y)=>c.quadraticCurveTo(...point(x,y),...point(X,Y)),bezierCurveTo:(x,y,X,Y,xx,yy)=>c.bezierCurveTo(...point(x,y),...point(X,Y),...point(xx,yy)),fillRect:(x,y,w,h)=>{if(c.nativeFX)return c.fillRect(x,y,w,h);const raw=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],pts=raw.map(p=>point(...p));if(pts.every((p,i)=>p[0]===raw[i][0]&&p[1]===raw[i][1]))return c.fillRect(x,y,w,h);const p=new Path2D();p.moveTo(...pts[0]);for(const a of pts.slice(1))p.lineTo(...a);p.closePath();c.fill(p)},ellipse:(...a)=>oval(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],c.ellipse,a),arc:(...a)=>oval(a[0],a[1],a[2],a[2],0,a[3],a[4],a[5],c.arc,a)};
  return new Proxy(c,{get:(t,k)=>special[k]||(typeof t[k]==='function'?t[k].bind(t):Reflect.get(t,k,t)),set:(t,k,v)=>Reflect.set(t,k,v,t)});
 }
 function frame(kind,fr,direction='E'){
  if(!kinds.includes(kind)||window.GoblinPolish?.enabled===false)return oldFrame(kind,fr);
  fr=normalized(fr);let i=headings.indexOf(direction);if(i<0)i=2;const view=views[i];

  const key=kind+'|'+view+'|'+fr;if(cache.has(key)){hits++;const s=cache.get(key);cache.delete(key);cache.set(key,s);return s}
  const S=NA_SPEC[kind],P=naPose(fr);P.pal=S.pal||null;
  const [cv,c]=mkSprite(S.w,S.h,4);c.lineCap='round';c.lineJoin='round';c.translate(S.ax,S.ay);if(S.sc)c.scale(S.sc,S.sc);if(view==='E'&&kind!=='shnyrKing')NA_DRAW[kind](boundedContext(c),P,fr);else paint(boundedContext(c),kind,P,view);
  const out=toPixelArt(cv,2,{outline:false,alphaCut:100});out.fine=2;out.fantasyGoblin=true;
  if(P.fade>0){const q=out.getContext('2d'),im=q.getImageData(0,0,out.width,out.height);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(!im.data[i+3])continue;if(naHash(x,y)<P.fade)im.data[i+3]=0;else{im.data[i]+=(230-im.data[i])*P.fade*.4;im.data[i+1]+=(240-im.data[i+1])*P.fade*.4;im.data[i+2]+=(200-im.data[i+2])*P.fade*.4}}q.putImageData(im,0,0)}
  const s={cv:out,w:S.w,h:S.h,ax:S.ax,ay:S.ay,view};bytes+=out.width*out.height*4;cache.set(key,s);while(bytes>maxBytes||cache.size>maxEntries){const k=cache.keys().next().value,v=cache.get(k);bytes-=v.cv.width*v.cv.height*4;cache.delete(k)}return s;
 }
 naFrame=function(kind,fr){return kinds.includes(kind)?frame(kind,fr,active):oldFrame(kind,fr)};
 neuDraw=function(c,N){
  if(!kinds.includes(N.k))return oldNeu(c,N);
  const previous=active;active=heading(N);
  try{return oldNeu(c,N)}finally{active=previous}
 };
 campDrawGoblin=function(c,N,art){
  if(!kinds.includes(art||N.k))return oldCamp(c,N,art);
  const previous=active;active=heading(N);
  try{return oldCamp(c,N,art)}finally{active=previous}
 };
 window.GoblinFamilyDirections={ready:true,errors:[],kinds,headings,frame,headingOf:heading,rig,portrait:(kind,fr='i0')=>frame(kind,fr,'S'),cacheStats:()=>({entries:cache.size,rgbaBytes:bytes,maxEntries,maxRgbaBytes:maxBytes,hits})};
})();
