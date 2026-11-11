/* 0.11.99 mimics and their matching treasure chests. Presentation only. */
'use strict';
(() => {
 if(window.FantasyMimicPolish)return;
 const original=chSpr,cache=new Map();
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
 function paint(c,kind,v,a,b,t){
  const st=CHEST_STYLES[kind==='c'?v:MIMIC_STYLE[v]],small=!!st.small;
  const x=small?6:3,w=small?14:20,h=small?8:10,y=22-h,attack=kind==='a',jump=attack&&a?1:0;
  const front=w-3,top=y-jump,lift=attack?(a?10:7):kind==='c'&&a?6:t.lid?1:0;
  const lidH=small?4:5,ly=Math.max(1,top-lidH-lift);
  const ink='#493b2d',cream='#eadbbc',pink='#c78b89',darkMouth='#594346';
  const rect=(xx,yy,ww,hh,col)=>{c.fillStyle=col;c.fillRect(xx,yy,ww,hh);};
  const polyline=(p,col)=>poly(c,p,col,ink,.45);
  // Bevelled front boards, side plane, paired hinges and a rounded lid.
  polyline([[x,top],[x+front,top-1],[x+w,top+1],[x+w,21-jump],[x+front,22-jump],[x,21-jump]],st.w);
  polyline([[x+front,top-1],[x+w,top+1],[x+w,21-jump],[x+front,22-jump]],st.d);
  rect(x+.6,top+.7,front-1,1,st.l);rect(x+.5,20-jump,front-1,1,st.d);
  for(let i=1;i<3;i++){const yy=top+(21-jump-top)*i/3;rect(x+.7,yy,front-1,.45,st.d);rect(x+1,yy+.5,front-1,.35,st.l);}
  for(let i=0;i<st.bands;i++){
   const xx=x+2+i*(front-4)/Math.max(1,st.bands-1);rect(xx,top,1,21-jump-top,st.t);rect(xx+.25,top+.7,.35,1,st.l);rect(xx+.25,19.5-jump,.4,.4,st.k);
  }
  if(st.lid==='round')polyline([[x,ly+2],[x+2,ly],[x+front-2,ly-.3],[x+front,ly+1],[x+front,ly+lidH],[x,ly+lidH]],st.w);
  else polyline([[x,ly],[x+front,ly-.5],[x+front,ly+lidH],[x,ly+lidH]],st.w);
  polyline([[x+front,ly+1],[x+w,ly+2],[x+w,ly+lidH+1],[x+front,ly+lidH]],st.d);
  rect(x+1,ly+.5,front-2,.6,st.l);rect(x+1,ly+lidH-1,front-2,.6,st.d);
  for(let i=0;i<st.bands;i++){const xx=x+2+i*(front-4)/Math.max(1,st.bands-1);rect(xx,ly+1,1,lidH-1,st.t);rect(xx+.2,ly+1,.4,.6,st.k);}
  const lock=x+front*.52;
  rect(lock-1.1,top+2,2.4,3.1,st.k);rect(lock-.3,top+2.7,.65,1.5,ink);
  for(const [xx,yy] of [[x+1.2,top+1.3],[x+front-2,top+1.3],[x+1.2,19.8-jump],[x+front-2,19.8-jump]])rect(xx,yy,.6,.6,st.k);
  if(st.deco==='moss'){for(const xx of [x+1,x+7,x+front-3])polyline([[xx,ly],[xx+2,ly+1],[xx+1,ly+3],[xx-.5,ly+2]],'#81905c');}
  if(st.deco==='gems'||st.deco==='star'){for(const xx of [x+front*.3,x+front*.75])polyline([[xx-1,top+4],[xx,top+2.7],[xx+1,top+4],[xx,top+5.3]],st.deco==='star'?'#b9a6cc':'#8ca9a1');}
  if(st.deco==='rune'||st.deco==='frost'){lineRune(c,lock,ly+2,st.l);}
  if(st.deco==='plates'){for(const xx of [x+4,x+front-4])polyline([[xx-1,ly+1],[xx+1,ly+1],[xx+1.5,ly+4],[xx-1.5,ly+4]],cream);}
  if(st.deco==='weave')for(let i=0;i<4;i++)rect(x+1.5+i*3,top+1,.5,7,st.l);
  if(st.deco==='skull'){ellipse(c,lock,ly+2,1.5,1.2,cream);rect(lock-.8,ly+1.8,.5,.5,ink);rect(lock+.4,ly+1.8,.5,.5,ink);}
  if(kind==='c'){
   if(a){rect(x+1,ly+lidH,front-2,Math.max(1,top-ly-lidH),darkMouth);for(let i=0;i<3;i++){ellipse(c,x+4+i*4,top-.4-i%2,1.3,.6,st.k);}}
   return;
  }
  const teeth=()=>{for(let xx=x+2;xx<x+front-1;xx+=3)polyline([[xx,top-.5],[xx+1,top+1.5],[xx+1.8,top-.5]],cream);};
  if(attack){
   rect(x+.8,ly+lidH,front-1,Math.max(1,top-ly-lidH+1),darkMouth);
   for(let xx=x+2;xx<x+front-1;xx+=3)polyline([[xx,ly+lidH],[xx+1,ly+lidH+2.5],[xx+1.8,ly+lidH]],cream);
   teeth();polyline([[lock-1.5,top],[lock+1.5,top],[lock+2,top+4+a],[lock-1,top+4+a]],pink);
   for(const xx of [x+4,x+front-4]){ellipse(c,xx,ly+2,1.25,1,'#d3bd79');rect(xx-.3,ly+1.5,.6,1.2,ink);}
   for(const xx of [x+3,x+front-3])polyline([[xx-1,21-jump],[xx+1,21-jump],[xx+2,23],[xx-1,23]],'#96704d');return;
  }
  // Preserve all ten subtle disguise clues; the tell remains part of gameplay.
  if(v===0)teeth();
  if(v===9)for(const xx of[x+1.2,x+front-2.8])polyline([[xx,top-.5],[xx+.8,top+2],[xx+1.5,top-.5]],cream);
  if(v===1){rect(x+front-3,top, .5,3.3,'#a2bfc0');ellipse(c,x+front-2.8,top+3.5,.5,.6,'#c0d0c1');}
  if(v===2||v===7){ellipse(c,lock,top+3,1,1.3,t.eye?'#d6c17e':'#60503a');rect(lock+(t.eye?.2:-.1),top+2.4,.45,1.3,ink);}
  if(v===7){rect(lock-.8,top+2,1.6,2,ink);rect(lock+(t.eye?.25:-.55),top+2.3,.4,1.4,'#d6c17e');}
  if(v===3)rect(x+1,top-.6,front-2,.7,ink);
  if(v===4)polyline([[x+w-3,21],[x+w,22],[x+w,23],[x+w-3,23]],'#96704d');
  if(v===5)rect(lock-.5,top,1.1,t.tongue?3.5:.8,pink);
  if(v===6)for(let xx=x+1;xx<x+front-1;xx+=2)rect(xx,top-.5+(xx%4?.3:0),1.5,.5,ink);
  if(v===8){rect(x,ly+1,1.3,2,st.d);rect(x+front-1,ly+2,.8,1.4,st.l);}
  if(kind==='s'){
   if(a===0||a===7){rect(x+3,top-1.5,front-6,1.8,ink);ellipse(c,lock-1,top-.8,1.2,1,'#dac686');if(a===7)ellipse(c,lock+3,top-.8,1.2,1,'#dac686');}
   if(a===1)polyline([[lock-1,top],[lock+1,top],[lock+1.5,top+5+b],[lock-1,top+5+b]],pink);
   if(a===2){rect(x+1,top-.8,front-2,1.2,ink);teeth();}
   if(a===3)for(const xx of [x+2,x+front-3])polyline([[xx,21],[xx+2,21],[xx+3,23],[xx,23]],'#96704d');
   if(a===4){polyline([[x+4,ly],[x+7,ly-2],[x+13,ly-.5],[x+10,ly+1.3]],'#809461');ellipse(c,lock,top-.5,1.2,.8,'#dac686');}
   if(a===5){rect(x-.5,ly+3,.6,2,'#a2bfc0');rect(x+front,ly+1,.6,2,'#a2bfc0');}
   if(a===6){rect(x+4,top,.6,5,'#a2bfc0');ellipse(c,x+6,23,3.8,.45,'#9cbbbf');}
  }
 }
 function lineRune(c,x,y,col){c.strokeStyle=col;c.lineWidth=.45;c.beginPath();c.moveTo(x-1.5,y+1);c.lineTo(x,y-1);c.lineTo(x+1.5,y+1);c.moveTo(x,y-1);c.lineTo(x,y+2);c.stroke();}
 chSpr=function(kind,v,a=0,b=0,t={}){
  const key=[kind,v,a,b,!!t.eye,!!t.tongue,!!t.lid].join('|');if(cache.has(key))return cache.get(key);
  if(R.inFrame&&R.cam.z<=1&&spriteDefer('mimic:'+key,()=>chSpr(kind,v,a,b,t)))return null;
  const cv=mkCanvas(CH_W*2,CH_H*2),c=cv.getContext('2d');c.scale(2,2);c.lineJoin='round';c.lineCap='round';c.imageSmoothingEnabled=false;paint(c,kind,v,a,b,t);cv.fine=2;cache.set(key,cv);return cv;
 };
 drawChest=function(c,ch){
  const px=ch.x*TILE,py=ch.y*TILE+4;let spr,dy=0,dx=0,alpha=1;
  if(!ch.mimic)spr=chSpr('c',ch.v,ch.state==='open'?1:0);
  else if(ch.state==='hide'){
   const tl=ch.tell;if(tl&&tl.strong)spr=chSpr('s',ch.m,tl.k,Math.floor(ch.ph*4)&1);
   else{const on=tl?Math.sin(tl.t/tl.len*Math.PI)>.2:false;spr=chSpr('m',ch.m,0,0,{eye:on,tongue:on,lid:tl&&tl.k===1&&on});if(!tl&&ch.sloppy)spr=chSpr('s',ch.m,[1,3,6][ch.m%3],0);if(tl&&tl.k===2&&on)dx=Math.sin(tl.t*30)*.7;if(tl&&on&&tl.k===3)dy=-1;}
  }else if(ch.state==='dying'){spr=chSpr('a',ch.m,Math.floor(ch.ph*12)&1);alpha=Math.max(0,1-ch.t/1.4);dx=Math.sin(ch.t*40)*.8;}
  else spr=chSpr('a',ch.m,Math.floor(ch.ph*5)&1);
  if(!spr)return;
  if(ch.state==='reveal')dy=-Math.abs(Math.sin(ch.ph*9))*2;
  c.save();c.fillStyle='rgba(10,8,4,.3)';c.beginPath();c.ellipse(px,py,10,2.4,0,0,7);c.fill();c.globalAlpha=alpha;c.imageSmoothingEnabled=typeof R==='undefined'?false:R.smooth;c.translate(Math.round(px+dx),Math.round(py+dy));if(ch.face<0&&ch.state!=='hide')c.scale(-1,1);c.drawImage(spr,-13,-22,CH_W,CH_H);c.restore();
 };
 window.FantasyMimicPolish={original,ratio:2,paint,cache};
})();
