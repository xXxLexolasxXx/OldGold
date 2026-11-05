'use strict';
// Presentation only: native pose, joints, expression, seasonal ornaments and
// sprite-budget pipeline remain the source of truth for the peaceful golem.
(() => {
 if(window.FantasyPublishedGolem||typeof drawGolemBody!=='function')return;
 const nativeBody=drawGolemBody,nativeBlob=gBlob,cache=new Map(),K=2;
 const A=window.FantasyPublishedGolem={nativeBody,nativeBlob,cache,version:1,draws:0};
 const STONE=['#302f29','#454d42','#5e6859','#7a8270','#979b83','#b6b69a','#d6cfb0','#ebe0bd'];
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 const inside=(x,y,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 function tile(rx,ry,seed,o){
  const key=[rx,ry,seed,o.n,o.tone,o.crack,o.moss,GL_SEA].join('|');
  if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);return s;}
  const rng=mulberry32(seed*7919+11),n=o.n||9,pts=[];
  // Native outline and deterministic stone spacing, with hand clustered bevels.
  for(let i=0;i<n;i++){const a=(i+(rng()-.5)*.5)/n*Math.PI*2,r=.84+rng()*.28;pts.push([Math.cos(a)*rx*r,Math.sin(a)*ry*r]);}
  const pad=3,w=Math.ceil((rx*2.4+pad*2)*K),h=Math.ceil((ry*2.4+pad*2)*K),ox=w/2,oy=h/2,cv=mkCanvas(w,h),c=cv.getContext('2d'),im=c.createImageData(w,h),tone=o.tone||0;
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
   const x=(px+.5-ox)/K,y=(py+.5-oy)/K;if(!inside(x,y,pts))continue;
   const edge=!inside(x-.6,y,pts)||!inside(x+.6,y,pts)||!inside(x,y-.6,pts)||!inside(x,y+.6,pts);
   const top=!inside(x-1.5,y-1.5,pts),bottom=!inside(x+1.4,y+1.5,pts);
   let level=edge?0:top?6:bottom?1:3;
   if(!edge&&!top&&!bottom){
    // Broad carved planes, never a carpet of independent random pixels.
    const a=x/rx,b=y/ry,cut=(seed%7-3)*.035;
    level=b<-.27+a*.27+cut?5:b>.26-a*.12?2:a<-.25?4:3;
    if(a>.38&&b>-.4)level=Math.max(1,level-1);
    if(b<-.63&&a<.25)level=6;
   }
   // The tightly overlapping native forearm stones need quieter bevels: a
   // repeated ivory rim reads as bandaging rather than weathered masonry.
   const forearm=seed>=62&&seed<=86&&rx<13&&ry<13&&o.moss<=4;
   const colour=rgb(forearm&&level>=6?'#b3b09a':STONE[level]),i=(py*w+px)*4;
   for(let j=0;j<3;j++)im.data[i+j]=Math.max(0,Math.min(255,colour[j]*(1+tone*.65)));
   im.data[i+3]=255;
  }
  c.putImageData(im,0,0);c.save();c.translate(ox,oy);c.scale(K,K);c.beginPath();c.moveTo(...pts[0]);for(const p of pts)c.lineTo(...p);c.closePath();c.clip();
  const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x*K)/K,Math.round(y*K)/K,w,h);};
  if(o.crack){const x=(rng()-.5)*rx*.45,y=-ry*.2,p=[[x-1,y-ry*.32],[x+1.5,y],[x-.5,y+ry*.24],[x+1.5,y+ry*.55]];c.strokeStyle='#3e483d';c.lineWidth=.65;c.beginPath();c.moveTo(...p[0]);for(const v of p)c.lineTo(...v);c.stroke();c.strokeStyle='#c3bea0';c.lineWidth=.45;c.beginPath();c.moveTo(p[0][0]+.65,p[0][1]);for(const v of p)c.lineTo(v[0]+.65,v[1]);c.stroke();}
  if(o.moss){
   const moss=GL_MOSS_SEA[GL_SEA]||GL_MOSS_SEA[3],count=Math.max(2,Math.min(7,Math.ceil(o.moss*.65)));
   for(let i=0;i<count;i++){const x=(rng()-.5)*rx*1.5,y=-ry*.62+(rng()-.5)*ry*.28,s=1.4+rng()*2.2;
    r(x-s,y,s*2,s*.9,'#344d2b');r(x-s+.5,y-.5,s*1.6,s*.8,moss[1]);r(x-s+.5,y-.5,s*.8,.5,moss[3]);r(x+s*.15,y+.5,s*.6,.5,moss[0]);
    if(i%3===0&&ry>6){r(x,y+s*.55,.5,2.2,moss[0]);r(x-.5,y+s*.8,.5,.5,moss[2]);}
   }
  }
  // Sparse worn mineral seams, arranged in short connected chiselled clusters.
  if(rx>10&&ry>7){const x=-rx*.35,y=-ry*.02;r(x,y,2,.5,'#b5b298');r(x+2,y+.5,1,.5,'#7f8872');r(rx*.4,ry*.35,1.5,.5,'#4b5848');}
  c.restore();const s={canvas:cv,x:-ox/K,y:-oy/K,w:w/K,h:h/K};cache.set(key,s);while(cache.size>320)cache.delete(cache.keys().next().value);return s;
 }
 function stone(c,x,y,rx,ry,seed,o={}){const s=tile(rx,ry,seed,o);c.save();c.imageSmoothingEnabled=false;c.drawImage(s.canvas,x+s.x,y+s.y,s.w,s.h);c.restore();}
 drawGolemBody=function(c,view,pose,f){const previous=gBlob;gBlob=stone;try{A.draws++;return nativeBody(c,view,pose,f);}finally{gBlob=previous;}};
 GL_CACHE.clear();GL_QUEUE=null;
})();
