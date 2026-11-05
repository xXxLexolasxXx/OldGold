/* 0.11.99 burial prince + bone wards. Native parameters/timers/anchors. */
'use strict';
(() => {
 if(window.FantasyBarrowPolish)return;
 const before=kpSprite,wardBefore=raidDrawWard,cache=new Map();let last;
 function materialKit(c){
  const ramps=new Map();
  function ramp(col){if(ramps.has(col))return ramps.get(col);const cv=mkCanvas(1,1),g=cv.getContext('2d');g.fillStyle=col;g.fillRect(0,0,1,1);const rgb=[...g.getImageData(0,0,1,1).data].slice(0,3);const r=[-.42,-.22,0,.17,.3].map(v=>'rgb('+rgb.map(a=>Math.round(v<0?a*(1+v):a+(255-a)*v)).join(',')+')');ramps.set(col,r);return r;}
  function surf(bounds,test,cols,light){const M=c.getTransform(),I=M.inverse(),pts=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]].map(([x,y])=>[M.a*x+M.c*y+M.e,M.b*x+M.d*y+M.f]);const x0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0])))),x1=Math.min(c.canvas.width,Math.ceil(Math.max(...pts.map(p=>p[0])))),y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),y1=Math.min(c.canvas.height,Math.ceil(Math.max(...pts.map(p=>p[1]))));c.save();c.setTransform(1,0,0,1,0,0);let prev='';for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const xx=I.a*(x+.5)+I.c*(y+.5)+I.e,yy=I.b*(x+.5)+I.d*(y+.5)+I.f;if(!test(xx,yy))continue;const col=cols[Math.max(0,Math.min(cols.length-1,Math.round(light(xx,yy)*(cols.length-1))))];if(prev!==col){c.fillStyle=col;prev=col;}c.fillRect(x,y,1,1);}c.restore();}
  function ell(x,y,rx,ry,col){surf([x-rx,y-ry,x+rx,y+ry],(xx,yy)=>((xx-x)/rx)**2+((yy-y)/ry)**2<=1,ramp(col),(xx,yy)=>{const nx=(xx-x)/rx,ny=(yy-y)/ry;return .29-.28*nx-.31*ny+.31*Math.sqrt(Math.max(0,1-nx*nx-ny*ny));});}
  function polygon(p,col){const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);surf([x0,y0,x1,y1],(x,y)=>{let ins=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])ins=!ins;return ins;},ramp(col),(x,y)=>.91-.56*(x-x0)/(x1-x0||1)-.26*(y-y0)/(y1-y0||1));}
  function tube(x,y,xx,yy,w,col){const dx=xx-x,dy=yy-y,l=dx*dx+dy*dy||1,rr=w/2;surf([Math.min(x,xx)-rr,Math.min(y,yy)-rr,Math.max(x,xx)+rr,Math.max(y,yy)+rr],(px,py)=>{const t=Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/l)),rx=px-x-t*dx,ry=py-y-t*dy;return rx*rx+ry*ry<=rr*rr;},ramp(col),(px,py)=>{const t=Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/l));return .55-((px-x-t*dx)*.24+(py-y-t*dy)*.33)/Math.max(.2,rr);});}
  return{ell,polygon,tube};
 }

 const kits=new WeakMap(),kit=ctx=>{if(!kits.has(ctx))kits.set(ctx,materialKit(ctx));return kits.get(ctx);};
 const ellipse=(ctx,x,y,rx,ry,col)=>kit(ctx).ell(x,y,rx,ry,col),naLimb=(ctx,x,y,xx,yy,w,col)=>kit(ctx).tube(x,y,xx,yy,w,col),poly=(ctx,pts,col,ink,width)=>kit(ctx).polygon(pts,col);
 function paint(c,fr,phase){
  const P=kpParams(fr),ink='#463a35',ivory=P.flash?'#fff3d8':'#ddcaa6',boneShade='#a99675',light='#f3dfb8';
  const armor=['#7b8078','#6f7a74','#786b73'][phase-1],dark=['#454f4c','#3b4a46','#493f4d'][phase-1];
  const cloth=['#786878','#687b70','#865e68'][phase-1],gold='#bf985c',eye=['#9dbfc2','#b9ca97','#e5ae82'][phase-1];
  const shape=(p,col,w=1)=>poly(c,p,col,ink,w),rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const line=(x,y,xx,yy,w,col)=>naLimb(c,x,y,xx,yy,w,col);
  const joint=(x,y,r)=>{ellipse(c,x,y,r+.7,r+.7,ink);ellipse(c,x-.3,y-.3,r,r,ivory);};
  const limb=(x,y,xx,yy,w)=>{line(x,y,xx,yy,w+1.2,ink);line(x,y,xx,yy,w,ivory);line(x-.6,y-.4,xx-.6,yy-.4,.75,light);};
  c.save();c.translate(P.adv,0);const hip=-38+P.sink*.9,shoulder=-68+P.sink*.8+P.bob;
  shape([[-18+P.lean*.4,shoulder],[-31,shoulder+9],[-34-P.sway*2,-5],[-27,-7],[-24,-1],[-19,-6],[-15,-2],[-7,-7],[0,-3],[5,-8],[12,-4],[18,-10],[25+P.sway,-8],[25,shoulder+6]],dark);
  shape([[-18,shoulder+1],[-24,shoulder+10],[-29-P.sway,-8],[-21,-5],[-10,-9],[-9,shoulder+3]],cloth);
  for(const x of [-22,-14,10,18])line(x,shoulder+15,x-P.sway,-12,1.1,shade(cloth,.2));
  for(const s of [-1,1]){
   const ph=P.mv?P.sw*s:0,lift=P.mv?Math.max(0,-P.cw*s)*4:0,foot=s*7+ph*5,knee=s*6+ph*3;
   limb(s*4,hip,knee,(hip-lift)/2,4.5);limb(knee,(hip-lift)/2,foot,-2-lift,3.7);joint(knee,(hip-lift)/2,2.5);
   ellipse(c,knee-.5,(hip-lift)/2-.5,3.4,2.8,armor);line(knee-2,(hip-lift)/2-1,knee+1,(hip-lift)/2-1,.6,gold);
   shape([[foot-2.3,-16-lift],[foot+2.1,-16-lift],[foot+2.5,-5-lift],[foot-2.1,-4-lift]],armor,.5);line(foot-1,-14-lift,foot-1,-6-lift,.6,light);
   shape([[foot-4,-5-lift],[foot+4,-5-lift],[foot+6,-1-lift],[foot-4,-1-lift]],armor);line(foot-2,-3-lift,foot+3,-3-lift,1.1,gold);
  }
  shape([[-17,shoulder+3],[-9,shoulder-3],[12,shoulder-2],[18,shoulder+7],[15,hip-1],[-15,hip]],armor);
  ellipse(c,-6,shoulder+13,9,13,armor);ellipse(c,7,shoulder+13,8,12,armor);
  for(const s of[-1,1]){line(s*5,shoulder+1,s*13,shoulder+6,1,gold);line(s*13,shoulder+6,s*14,hip-5,.8,gold);for(let j=0;j<6;j++)ellipse(c,s*13,shoulder+8+j*3.1,.65,.65,light);}
  shape([[-17,shoulder+3],[-9,shoulder-3],[-3,shoulder],[-5,hip],[-15,hip]],dark);
  shape([[-12,shoulder+5],[-4,shoulder+3],[-5,hip-6],[-12,hip-6]],shade(armor,.24),.6);
  for(const y of [shoulder+12,shoulder+19,shoulder+26]){line(-10,y,10,y-1,1.5,gold);rect(-11,y-1,1.5,1.5,light);}
  shape([[-9,shoulder+8],[0,shoulder+3],[9,shoulder+8],[7,shoulder+22],[0,shoulder+26],[-7,shoulder+22]],dark);
  for(let i=0;i<4;i++){const y=shoulder+10+i*3.5;line(-5,y,-.5,y+1,1.4,ivory);line(.5,y+1,5,y,1.4,ivory);ellipse(c,-4.4,y,.8,.9,light);}
  line(0,shoulder+8,0,shoulder+24,1.4,boneShade);
  rect(-15,hip-4,30,3,'#6b513e');rect(-2.5,hip-4,5,4,gold);rect(-1.1,hip-3,2,2,dark);
  for(const x of [-18,17]){shape([[x-6,shoulder+1],[x,shoulder-3],[x+7,shoulder+4],[x+3,shoulder+10],[x-6,shoulder+7]],ivory);line(x-3,shoulder+3,x+2,shoulder+6,1,boneShade);}
  if(phase>1){line(-4,shoulder+5,-1,shoulder+15,1,eye);line(-1,shoulder+15,4,shoulder+20,1,eye);if(phase===3)shape([[-3,shoulder+15],[0,shoulder+10],[3,shoulder+16],[0,shoulder+23]],eye,.6);}
  const arm=(s,hand)=>{const sx=s*16,sy=shoulder+5,ex=(sx+hand[0])/2+s*3,ey=(sy+hand[1])/2+5;limb(sx,sy,ex,ey,3.7);limb(ex,ey,hand[0],hand[1],3.1);joint(ex,ey,2.3);joint(hand[0],hand[1],2.5);};
  arm(-1,P.bhand);arm(1,P.hand);
  // Native hand paths and blade angle are retained through all 12 key phases.
  c.save();c.translate(P.hand[0],P.hand[1]);c.rotate(P.ang);
  // Full native-length cold magical blade. Transparent overscan (below) lets
  // the raised sword keep its length rather than shrinking it to fit a frame.
  const blade=64;c.translate(6,0);
  shape([[0,-5.8],[40,-5],[blade,-3.6],[46,3],[38,6],[34,5.6],[28,6],[24,5.6],[18,6],[14,5.6],[0,5.8]],'#5292bc');
  shape([[0,-5.1],[39,-4.6],[61,-3.5],[43,.6],[0,.6]],'#c3e5ed',.4);line(2,-4.7,40,-4.3,1.1,'#f0fbf4');line(3,0,48,0,1.4,'#22486c');line(4,-.8,53,-.8,.75,'#eafffa');
  for(const x of[9,18,27,36]){line(x,-2.8,x,2.2,.65,'#d7ffff');line(x,-2,x+2,-.5,.5,'#9ae2ee');}
  shape([[-4,-10],[-1,-7],[1,-5],[1,5],[-1,7],[-4,10],[-3,4],[-3,-4]],'#48626b',.6);rect(-2,-4,1.2,8,'#bfd2cd');rect(-13,-1.5,9,3,'#48626b');ellipse(c,-17,0,2.7,2.7,'#a6d2e6');c.restore();
  const hx=P.lean*.65+P.hdx,hy=-86+P.sink*.8+P.bob+P.hdy+P.lean*.2;
  limb(P.lean*.3,shoulder-2,hx,hy+10,3.1);for(let i=0;i<3;i++){const u=(i+1)/4;ellipse(c,hx*u+(1-u)*P.lean*.3,(shoulder-2)*(1-u)+(hy+10)*u,2.1,1.1,boneShade);}
  c.save();c.translate(hx,hy);c.rotate(P.tilt-.04+P.hdy*.01);
  ellipse(c,0,-2,11.5,12,boneShade);ellipse(c,-1,-4,10,9,ivory);ellipse(c,-8,3,3,4,ivory);ellipse(c,8,3,3,4,ivory);
  line(-5,-10,-2,-7,.6,boneShade);line(-2,-7,-3,-4,.6,boneShade);line(5,-10,7,-8,.5,light);
  for(const x of [-5,5]){shape([[x-3,-3],[x+3,-3],[x+2,2],[x-2,2]],ink,.5);rect(x-.7,-1.5,1.6,2,eye);}
  line(-8,-4,-3,-4.8,1.1,ivory);line(3,-4.8,8,-4,1.1,ivory);
  shape([[-1,1],[2,4],[-2,4]],dark,.5);rect(-7,6,14,2+P.jaw*.35,ink);
  for(let i=0;i<7;i++)rect(-6+i*1.9,6,1.1,1.8,light);
  shape([[-8,8+P.jaw*.3],[8,8+P.jaw*.3],[7,11+P.jaw*.3],[-7,11+P.jaw*.3]],ivory,.7);
  c.save();c.translate(0,-11);c.rotate(-.1);
  shape([[-13,0],[-13,-4],[-10,-12],[-6,-5],[-3,-17],[1,-5],[5,-19],[8,-4],[12,-12],[14,-1],[12,3],[-12,3]],gold);
  shape([[-11,-2],[-9,-8],[-6,-3],[-2,-12],[0,-3],[5,-14],[7,-3],[11,-8],[12,0]],'#d8b573',.4);
  rect(-12,0,25,2,'#836540');for(const x of [-8,1,9])shape([[x-1.3,0],[x,-1.5],[x+1.3,0],[x,1.6]],eye,.4);
  c.restore();c.restore();c.restore();
 }
 kpSprite=function(fr,phase=1){
  phase=Math.max(1,Math.min(3,phase));const key=fr+'|'+phase;if(cache.has(key)){last=cache.get(key);return last;}
  if(typeof spriteBudgetOk==='function'&&!spriteBudgetOk(!!last))return last;
  const t=performance.now(),pad={left:10,top:48,right:30,bottom:40},cv=mkCanvas((KP.W+40)*2,(KP.H+88)*2),c=cv.getContext('2d');c.scale(2,2);c.lineJoin='round';c.lineCap='round';c.imageSmoothingEnabled=false;c.translate(KP.AX+pad.left,KP.AY+pad.top);paint(c,fr,phase);cv.fine=2;cv.barrowPad=pad;last={cv};cache.set(key,last);if(cache.size>KP.MAX)cache.delete(cache.keys().next().value);if(typeof spriteSpent==='function')spriteSpent(t);return last;
 };
 const nativeBlit=blitFine;
 blitFine=function(c,cv,x,y,w,h){const p=cv.barrowPad;if(!p)return nativeBlit(c,cv,x,y,w,h);return nativeBlit(c,cv,x-p.left,y-p.top,(w??KP.W)+p.left+p.right,(h??KP.H)+p.top+p.bottom);};
 const wards=new Map();
 function wardFrame(frame,hurt){
  const key=frame+'|'+hurt;if(wards.has(key))return wards.get(key);
  const cv=mkCanvas(48,76),c=cv.getContext('2d');c.scale(2,2);c.translate(12,34);c.lineJoin='round';
  const ink='#554536',bone=hurt?'#fff3d6':'#ddcba6',shade='#ad9874';
  naLimb(c,0,-24,0,-1,2.1,ink);naLimb(c,-.2,-24,-.2,-1,.9,'#9a794c');
  poly(c,[[-6,-3],[6,-3],[6,0],[-6,0]],shade,ink,.5);
  for(const [x,y] of [[-4,-11],[3,-11],[0,-18]]){
   poly(c,[[x-2,y-2],[x+1.5,y-2.5],[x+2.4,y],[x+1.4,y+2],[x-1.5,y+2]],bone,ink,.5);
   c.fillStyle=ink;c.fillRect(x-1.1,y-.6,.7,.8);c.fillRect(x+.7,y-.6,.7,.8);
   naLimb(c,x-1,y+1.5,x+1,y+1.5,.4,shade);
  }
  const pulse=Math.sin(frame/12*Math.PI*2);poly(c,[[-1.6,-25],[0,-29-pulse],[1.7,-25],[0,-22]],'#b9d6ca',ink,.35);c.fillStyle='#eef0d3';c.fillRect(-.3,-26,.6,1.6);
  cv.fine=2;wards.set(key,cv);return cv;
 }
 raidDrawWard=function(c,N){
  const dead=N.st==='die',alpha=dead?Math.max(0,1-N.dt/1.2):1;if(!alpha)return;
  const x=Math.round(N.x*TILE),y=Math.round(N.y*TILE+6),frame=((Math.floor((Game.time*9+N.id)/Math.PI/2*12)%12)+12)%12;
  c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=typeof R==='undefined'?false:R.smooth;c.fillStyle='rgba(10,8,4,.3)';c.beginPath();c.ellipse(x,y+1,7,2.5,0,0,7);c.fill();blitFine(c,wardFrame(frame,!!N.ov),x-12,y-34,24,38);c.restore();
  if(!dead&&fsBarOn(N))fsBar(c,x,y-33,N.hp/N.mhp);
 };
 window.FantasyBarrowPolish={before,wardBefore,paint,wardFrame,cache,ratio:2};
})();
