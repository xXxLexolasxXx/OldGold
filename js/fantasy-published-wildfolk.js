/* Rich native-pose art for brigands and faction chiefs only. Load after wildart.
 * Retains PW/PH/PFX/PFY, the three views, all frame names and native scales.
 */
(() => {
 'use strict';
 if(window.FantasyPublishedWildfolk)return;
 const nativeSprite=wildSprite,cache=new Map();let enabled=true;
 const accepts=key=>key==='brigand'||key==='brigand!'||key.startsWith('chief:');
 const clamp=t=>Math.max(0,Math.min(1,t));
 const blend=(a,b,t)=>{const x=hexToRgb(a),y=hexToRgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')};
 function sprite(key,view,pose,frame,opt={}){
  const ck=[key,view,pose,JSON.stringify(frame),opt.gest,opt.gf,opt.wpn,opt.gait,WILD_STYLE].join('|');if(cache.has(ck))return cache.get(ck);
  const D=wildDesc(key),chief=!!D.chief,back=view==='N',side=view==='E',evil=!!D.evil;
  const [cv,c]=mkSprite(PW,PH,4);c.translate(PFX,PFY);c.lineCap='round';c.lineJoin='round';
  const ink='#302b25',skin=SKINS[D.skin]||SKINS[3],coat=blend(D.coat,'#8a7353',.15),coatD=shade(coat,-.3),coatL=shade(coat,.23),beard=D.bcol,beardD=shade(beard,-.35),beardL=blend(beard,'#f0d8aa',.25),leather=D.strap||'#5b3e29',gold=chief?'#c6a05b':'#a58b64',shine='#e8d3a1';
  const ell=(x,y,rx,ry,col)=>ellipse(c,x,y,rx,ry,col),line=(x,y,X,Y,w,col)=>{c.lineCap='round';naLimb(c,x,y,X,Y,w,col)},poly=(pts,col)=>{c.fillStyle=col;c.beginPath();c.moveTo(...pts[0]);for(const p of pts.slice(1))c.lineTo(...p);c.closePath();c.fill()},box=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
  const volume=(x,y,rx,ry,col,dark=shade(col,-.3),light=shade(col,.2))=>{ell(x,y,rx+.25,ry+.25,ink);ell(x,y,rx,ry,dark);ell(x+.15,y-.2,rx*.89,ry*.86,col);ell(x-rx*.23,y-ry*.4,rx*.5,ry*.32,light)};
  const rivet=(x,y)=>{ell(x,y,.34,.35,leather);box(x-.15,y-.22,.3,.3,shine)};
  const fighting=pose==='fight',ff=fighting&&(FIGHT_BODY[frame]||FIGHT_BODY[fightKey(frame)])?frame:'ready',body=FIGHT_BODY[ff]||FIGHT_BODY.ready;
  const ph=typeof frame==='number'?frame/8*Math.PI*2:0,walk=pose==='walk',breath=pose==='idle'&&typeof frame==='number'?(IDLE_BREATH[frame%IDLE_FRAMES]||0):0;
  const crouch=fighting?body[1]:-breath,hip=-6.2+crouch,shoulder=-12+crouch,head=-16.6+crouch,sw=walk?Math.sin(ph):0,lean=fighting?body[0]:walk?.05+(opt.gait==='tired'?.16:0):0;
  const sway=walk?Math.sin(ph)*.35:0,bob=walk?-Math.abs(Math.sin(ph))*.42:0;c.translate(sway,bob);
  if(opt.gait==='drunk')c.rotate(Math.cos(ph)*.07);
  // Boots and jointed trousers keep the original stance and foot origin.
  for(const far of[true,false]){const s=far?-1:1,step=fighting?body[far?2:3]:walk?s*sw*.4:0;
   const x=side?(far?-1.2:1.4):s*2.1,kx=x+Math.sin(step)*2.6,fx=x+Math.sin(step)*5.2,fy=walk?-Math.max(0,s*sw)*1.2:0;
   line(x,hip,kx,-3.2,3.3,ink);line(x,hip,kx,-3.2,2.8,far?shade(D.pants,-.2):D.pants);line(kx,-3.2,fx,fy-1.2,2.8,ink);line(kx,-3.2,fx,fy-1.2,2.1,far?shade(D.pants,-.2):D.pants);
   volume(fx+.45,fy-1,1.85,1.05,far?shade(leather,-.15):leather);line(fx-.7,fy-1.6,fx+.7,fy-1.2,.35,gold);line(fx-1,fy-.1,fx+2,fy-.1,.45,ink);
   if(chief){poly([[kx-1.2,-4.5],[kx+.9,-4.5],[kx+1.2,-3],[kx,-2.6],[kx-1.1,-3.1]],'#8c8a7c');line(kx-.7,-4.2,kx+.6,-4.2,.35,'#c7c5ac');rivet(kx,-3.4)}
  }
  c.save();c.translate(0,hip);c.rotate(lean);c.translate(0,-hip);
  // A complete coat and mantle, with volume and seams rather than a recolour.
  if(D.mantle){const tail=sw*.5;c.fillStyle=ink;c.beginPath();c.moveTo(-3.6,shoulder-1);c.quadraticCurveTo(-7,shoulder+3,-6.2+tail,hip+1);c.quadraticCurveTo(-2,hip+3,4.6+tail,hip+.8);c.lineTo(3.2,shoulder);c.closePath();c.fill();c.fillStyle=shade(D.mantle,-.12);c.beginPath();c.moveTo(-3.2,shoulder-.5);c.quadraticCurveTo(-6,shoulder+3,-5.5+tail,hip+.6);c.quadraticCurveTo(-1,hip+2,4+tail,hip+.3);c.lineTo(2.9,shoulder+.2);c.closePath();c.fill();line(-3.8,shoulder+2,-4.4+tail,hip,.55,shade(D.mantle,.25));line(-4.6+tail,hip+.3,3.5+tail,hip+.5,.5,gold)}
  volume(0,(shoulder+hip)/2,side?4.2:4.7,4.3,coat,coatD,coatL);
  for(let j=0;j<3;j++){const y=shoulder+1.5+j*1.45;line(-2.9,y,2.9,y+.2,.35,coatD);if(!back)rivet(side?2.6:0,y)}
  const collar=chief?D.mantle||D.capc:'#796653';for(let j=0;j<7;j++){const x=-3.6+j*1.2,y=shoulder-.6+Math.abs(j-3)*.18;ell(x,y,.83,.7,shade(collar,-.35));ell(x-.15,y-.2,.6,.45,blend(collar,'#dfc79c',.3))}
  line(-3.4,shoulder+.4,3.2,hip,1.3,leather);line(-3.4,shoulder+.2,3.2,hip-.2,.4,shade(leather,.3));for(let j=0;j<4;j++)rivet(-2.7+j*1.4,shoulder+1+j*1.05);
  line(-4.2,hip-.5,4.2,hip-.5,1.2,leather);box(.2,hip-1.2,1.6,1.5,gold);box(.65,hip-.9,.7,.8,leather);box(.9,hip-.8,.2,.5,shine);
  c.save();c.translate(-3.6,hip-.7);c.rotate(-sw*.12);volume(-.7,1.3,1.35,1.7,shade(leather,.1));line(-1.6,.7,.1,.7,.5,gold);rivet(-.7,.8);c.restore();
  const patch=D.patch||shade(coat,.28);box(2.1,hip-2.5,1.4,1.3,patch);for(const x of[2.2,3.1])line(x,hip-2.4,x,hip-1.4,.22,shine);
  // Native battle tables provide exact wrist and weapon angles.
  const wpn=opt.wpn===undefined?D.wpn:opt.wpn,parts=(wpn||'').split('|'),main=parts[0],style=WPN_STYLE[main]||'fist';
  let arm=(FIGHT_ARM[style]||FIGHT_ARM.fist)[ff]||(FIGHT_ARM[style]||FIGHT_ARM.fist).ready;
  if(!fighting)arm=(FIGHT_ARM[style]||FIGHT_ARM.fist).ready.slice();
  const gesture=opt.gest,gf=gestK(opt.gf||0),rr=arm[2]??4.2;
  let H=[.4+Math.sin(arm[0])*rr,shoulder+.4-Math.cos(arm[0])*rr];
  if(!fighting&&walk&&(style==='blade'||style==='stab')){H[0]+=sw*.3;H[1]+=sw*.5;arm=arm.slice();arm[1]+=sw*.16}
  if(!main&&!fighting)H=[side?3.6:4,shoulder+4+(walk?sw*.5:0)];
  if(gesture){const pts=gestPts(gesture,gf,1,shoulder,head,view);if(pts)H=pts[1]}
  const q=((parts[1]==='wshield'?FIGHT_BACK.shield:FIGHT_BACK.free)[ff]||FIGHT_BACK.free.ready);
  const backHand=fighting?[-.4+q[0],shoulder+.4+q[1]]:[-3.5-sw*.8,shoulder+4];
  const twoHanded=(style==='heavy'||style==='staff')&&!['draw','d0','s5'].includes(ff)&&!(style==='staff'&&(['win0','win1'].includes(fightKey(ff))||isCastF(ff)));
  if(main&&twoHanded&&!gesture){backHand[0]=H[0]-Math.sin(arm[1])*2.4;backHand[1]=H[1]+Math.cos(arm[1])*2.4}
  const limb=(a,b,far=false)=>{const ex=(a[0]+b[0])/2+(far?-1:1),ey=(a[1]+b[1])/2+.8;for(const [w,col]of[[2.6,ink],[2.05,far?coatD:coat]]){line(...a,ex,ey,w,col);line(ex,ey,...b,w*.87,col)}line(a[0]-.3,a[1]-.2,ex-.3,ey-.2,.4,far?coat:coatL);volume(...b,.85,.8,skin[0],skin[1],skin[0]);line(ex,ey,b[0],b[1],1.25,leather);rivet((ex+b[0])/2,(ey+b[1])/2)};
  limb([-2.8,shoulder+.5],backHand,true);
  // Head views are independently drawn: no face stamped on the back view.
  const hx=side?1.8:0;
  volume(hx,head+1.1,side?3.6:4.1,3.65,skin[0],skin[1],blend(skin[0],'#ffe9bd',.2));
  if(!back){const eyes=side?[2.7]:[-1.7,1.7];for(const ex of eyes){box(hx+ex-.55,head+.2,.85,.7,ink);box(hx+ex-.55,head+.1,.3,.3,'#fff0cc');if(evil)line(hx+ex-1,head-.3,hx+ex+.7,head,.45,beardD)}
   volume(hx+(side?3.1:0),head+2,side?1.6:1.15,1.1,skin[0],skin[1],blend(skin[0],'#ffe9bd',.22));
   // Nine overlapping beard locks, independent rows of light and shadow.
   for(let j=0;j<9;j++){const x=hx-3.4+j*.79,y=head+4+(j%2)*.2,bottom=hip-1.4-Math.abs(j-4)*.45;line(x,y,x+(j-4)*.13,bottom,1.45,beardD);line(x-.2,y,x+(j-4)*.13-.2,bottom-.4,.85,beard);line(x-.35,y+.3,x+(j-4)*.13-.35,bottom-.9,.25,beardL)}
   line(hx-2.8,head+3.4,hx-.4,head+3.6,1.1,beard);line(hx+.4,head+3.6,hx+2.5,head+3.3,1.1,beard);line(hx-1.8,head+3.1,hx-.7,head+3.1,.3,beardL);
   if(D.bstyle==='braids'||D.bstyle==='plait'||D.bstyle==='dreads')for(const x of[-2.3,2.4]){for(let j=0;j<4;j++)ell(hx+x+(j%2)*.25,head+5+j*.9,.65,.55,j%2?beard:beardL);line(hx+x-.6,head+8.3,hx+x+.6,head+8.3,.65,gold)}
   if(D.paint)line(hx+(side?.2:-2.8),head+1,hx+(side?.6:-2.2),head+3,.6,D.pcol||'#b38b62');
  }else{volume(0,head+1.1,4.2,3.7,D.hair||beard);for(let j=0;j<5;j++)line(-2.8+j*1.35,head-.4,-2.5+j*1.15,head+4,.35,shade(D.hair||beard,.2))}
  // Faction-specific headwear keeps the original keyed variants, including !.
  const hat=D.head,cap=D.capc,hatL=blend(cap,'#ead29d',.28),hatD=shade(cap,-.3);
  if(opt.nohat){volume(hx,head-1,3.8,1.6,D.hair||beard);for(let j=0;j<5;j++)line(hx-2.7+j*1.2,head-1.8,hx-2.5+j*1.1,head-.3,.3,beardL)}
  else if(['patchcap','beanie','hood'].includes(hat)){c.fillStyle=ink;c.beginPath();c.moveTo(hx-4.4,head-.1);c.quadraticCurveTo(hx-5.6,head-4.6,hx-1.4,head-8);c.quadraticCurveTo(hx+2.4,head-6.7,hx+4.3,head);c.closePath();c.fill();c.fillStyle=cap;c.beginPath();c.moveTo(hx-3.8,head-.5);c.quadraticCurveTo(hx-4.7,head-4.2,hx-1.4,head-7.3);c.quadraticCurveTo(hx+1.8,head-6,hx+3.7,head-.4);c.closePath();c.fill();line(hx-3.8,head-.5,hx+3.8,head-.5,1,hatD);line(hx-3.4,head-1,hx+3.1,head-1,.4,hatL);box(hx-.8,head-4,1.5,1.2,coatL);line(hx-.6,head-3.9,hx+.4,head-3,.25,shine)}
  else if(hat==='turban'){volume(hx,head-1.8,4.6,3.2,cap,hatD,hatL);for(let j=0;j<3;j++)line(hx-3.7,head-3.1+j,hx+3.4,head-1.3+j,.55,hatD);volume(hx-3.6,head-.2,1.4,1.6,hatL);rivet(hx+1.2,head-2)}
  else if(hat==='fur'){for(let j=0;j<8;j++)volume(hx-3.3+j*.95,head-1.4-Math.sin(j/7*Math.PI)*1.7,.9,1.3,j%2?cap:hatL);line(hx-3.8,head-.2,hx+3.8,head-.2,.6,leather)}
  else {volume(hx,head-1.5,4.2,3,hat==='bone'?'#b8ad91':cap,hatD,hatL);line(hx-4,head-.2,hx+4,head-.2,.8,leather);for(let j=0;j<4;j++)rivet(hx-3+j*2,head-.3);
   if(['horns','bone','antler'].includes(hat))for(const s of[-1,1]){c.strokeStyle=ink;c.lineWidth=1.8;c.beginPath();c.moveTo(hx+s*3,head-2.8);c.quadraticCurveTo(hx+s*6,head-5,hx+s*4.6,head-7);c.stroke();c.strokeStyle='#d6c6a3';c.lineWidth=1;c.stroke();if(hat==='antler')line(hx+s*4.5,head-5,hx+s*6.7,head-6.5,.65,'#b5a684')}
  }
  if(chief&&!back&&!opt.nohat){const y=head-3.6;line(hx-3.4,y,hx+3.4,y,1.15,ink);line(hx-3.2,y,hx+3.2,y,.75,gold);for(const x of[-2.6,0,2.6]){poly([[hx+x-.8,y],[hx+x,y-2],[hx+x+.8,y]],ink);poly([[hx+x-.45,y-.2],[hx+x,y-1.45],[hx+x+.45,y-.2]],'#dfbd70')}ell(hx,y+.1,.5,.45,'#a85742');box(hx-.15,y-.15,.25,.25,shine)}
  // New weapon geometry uses the native hand endpoints and weapon angle.
  limb([side?.5:2.5,shoulder+.4],H);
  if(main&&!gesture){c.save();c.translate(...H);c.rotate(arm[1]);
   const shaft=(lo,hi)=>{line(0,lo,0,hi,1.3,ink);line(-.1,lo,-.1,hi,.8,'#94714a');line(-.3,lo,-.3,hi,.3,'#d2ae79');for(const y of[-.7,0,.7])line(-.6,y,.6,y+.25,.25,shine)};
   if(main==='wclub'){shaft(1.4,-7.2);volume(0,-5.4,1.35,1.8,'#8b6a43');for(const y of[-6.4,-4.8])line(-1.1,y,1.1,y,.45,'#b6b5a4');box(-.6,-7,.35,.5,'#d0b98e')}
   else if(main==='whatchet'){shaft(1.4,-6.4);poly([[0,-4.8],[0,-6.8],[3.3,-7.2],[3.1,-4.6]],ink);poly([[.4,-5.1],[.4,-6.5],[2.9,-6.8],[2.8,-5]],'#9ca59b');line(2.9,-6.8,2.8,-5,.5,'#d8d8bd');rivet(.7,-5.8)}
   else if(main==='wspear'){shaft(2.4,-9.6);poly([[0,-9.6],[-1.2,-10.2],[0,-12.4],[1.2,-10.2]],'#b5beb0');line(-.25,-10,0,-11.8,.35,'#e5e0c3');poly([[0,-8.2],[1.1,-7.2],[.3,-6.8]],D.acc||'#b87843');poly([[0,-7.2],[-1.1,-6.2],[-.3,-5.8]],'#d8c9a9')}
   else if(main==='wbone'){shaft(1.1,-.4);poly([[-.9,-.4],[-.15,-2],[0,-3.9],[.9,-.4]],'#e0cfac');line(0,-3.3,.3,-1,.3,'#f2e1c1')}
   else if(main==='wstick'){shaft(2.4,-8);line(0,-8,1.4,-8.2,.65,'#94714a');line(0,-6.6,.5,-4.4,.3,gold);volume(.5,-4.1,.6,.75,'#d3bf93')}
   else{shaft(1.5,-3);line(0,-3,0,-7,.8,'#c8c6b3')}
   c.restore();volume(...H,.8,.72,skin[0],skin[1],skin[0]);
  }
  if(parts[1]==='wshield'){const x=backHand[0],y=backHand[1];volume(x,y,2.6,3.1,leather);for(const dx of[-1,0,1])line(x+dx,y-2.3,x+dx,y+2.3,.25,shade(leather,-.4));line(x-2,y-1,x+2,y-1,.6,'#8f958c');volume(x,y,.7,.7,'#afb2a0')}
  if(fighting&&fightKey(frame)==='hurt'){c.globalCompositeOperation='source-atop';c.fillStyle='rgba(255,233,193,.2)';c.fillRect(-PFX,-PFY,PW,PH);c.globalCompositeOperation='source-over'}
  c.restore();
  const out=toPixelArt(cv,2,{outline:false,alphaCut:105});out.fine=2;out.fantasyWildfolk=true;if(cache.size>=700)cache.delete(cache.keys().next().value);cache.set(ck,out);return out;
 }
 wildSprite=function(key,view,pose,frame,opt){return enabled&&accepts(key)?sprite(key,view,pose,frame,opt):nativeSprite(key,view,pose,frame,opt)};
 window.FantasyPublishedWildfolk={version:1,nativeSprite,sprite,accepts,cache,setEnabled(value){enabled=!!value},get enabled(){return enabled},settings:{fine:2,worldPixelStep:.5,logical:[PW,PH],anchor:[PFX,PFY]}};
})();

