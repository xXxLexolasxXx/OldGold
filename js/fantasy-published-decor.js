'use strict';
// New 0.11 village decor: existing placement, ownership, growth and beauty stay native.
(() => {
 if(window.FantasyPublishedDecor||typeof vdDraw!=='function')return;
 const native=vdDraw,cache=new Map(),W=56,H=64,OX=12,OY=36;
 const colors=['#a35b50','#537d91','#68844e','#c4a45d','#8e7198','#b67c91'];
 const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
 function shape(c,pts,col){c.fillStyle=col;for(let y=Math.floor(Math.min(...pts.map(p=>p[1])));y<Math.ceil(Math.max(...pts.map(p=>p[1])));y++){const hits=[];for(let k=0;k<pts.length;k++){const a=pts[k],b=pts[(k+1)%pts.length],yy=y+.5;if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))hits.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let k=0;k+1<hits.length;k+=2)c.fillRect(Math.ceil(hits[k]),y,Math.max(.5,Math.floor(hits[k+1])-Math.ceil(hits[k])),1);}}
 function paint(c,t,v,ph){
  const x=16,y=26;
  rect(c,x-8,y-1,17,2,'#43513b');
  if(t==='statue'){
   const pal=[['#737d73','#adb09a','#d5ceb0'],['#8d826a','#bbb08d','#e2cf9c'],['#5f7870','#91a799','#c2d1b7']][v%3];
   shape(c,[[x-10,y-2],[x-8,y-7],[x+8,y-7],[x+10,y-2],[x+9,y],[x-9,y]],'#414c43');
   rect(c,x-8,y-6,16,4,pal[0]);rect(c,x-7,y-6,14,1,pal[2]);rect(c,x-6,y-2,12,1,pal[1]);
   shape(c,[[x-5,y-9],[x-7,y-16],[x-5,y-22],[x+4,y-22],[x+7,y-16],[x+5,y-9]],'#3e4942');
   shape(c,[[x-4,y-10],[x-5,y-18],[x-3,y-22],[x+3,y-22],[x+5,y-18],[x+4,y-10]],pal[0]);
   rect(c,x-4,y-20,3,6,pal[1]);rect(c,x-3,y-11,3,3,'#454f43');rect(c,x+1,y-11,3,3,'#454f43');
   shape(c,[[x-6,y-23],[x-5,y-28],[x-2,y-32],[x+1,y-34],[x+4,y-30],[x+6,y-23]],'#3c4c43');
   shape(c,[[x-4,y-24],[x-3,y-28],[x,y-32],[x+2,y-31],[x+4,y-24]],pal[1]);rect(c,x-3,y-26,2,2,pal[2]);
   rect(c,x-5,y-23,10,4,pal[0]);rect(c,x-3,y-23,6,2,pal[2]);
   shape(c,[[x-5,y-20],[x+5,y-20],[x+4,y-16],[x,y-11],[x-4,y-16]],pal[1]);
   for(const dx of [-3,0,3])rect(c,x+dx,y-19,1,4,pal[2]);
   rect(c,x-7,y-19,2,6,pal[1]);rect(c,x+5,y-19,2,6,pal[0]);
   if(v%3===1){rect(c,x+8,y-24,1,15,'#506454');shape(c,[[x+5,y-25],[x+9,y-27],[x+13,y-25],[x+13,y-23],[x+9,y-24],[x+5,y-23]],pal[2]);}
   if(v%3===2){rect(c,x-9,y-16,4,4,'#567e7a');rect(c,x-8,y-16,2,1,'#c9c795');rect(c,x-10,y-15,1,2,pal[2]);}
   rect(c,x-3,y-4,6,1,'#7c9b71');rect(c,x,y-5,1,3,'#b5bd8e');
  } else if(t==='sign'){
   rect(c,x-3,y-4,6,4,'#586951');rect(c,x-2,y-28,4,27,'#453f30');rect(c,x-1,y-27,1,24,'#b09461');
   shape(c,[[x-3,y-28],[x,y-32],[x+3,y-28]],'#60816b');
   const board=['#a98450','#8d8d61','#bb9c65'][v%3], edge=['#c7aa70','#b4b28c','#e0c58e'][v%3];
   const num=2+v%2;for(let k=0;k<num;k++){const d=k%2?-1:1,yy=y-24+k*7;
    shape(c,[[x-d,yy-3],[x+d*9,yy-3],[x+d*13,yy],[x+d*9,yy+3],[x-d,yy+3]],'#483e2c');
    shape(c,[[x,yy-2],[x+d*9,yy-2],[x+d*11,yy],[x+d*9,yy+2],[x,yy+2]],board);
    rect(c,Math.min(x,x+d*8),yy-2,8,1,edge);
    for(let j=0;j<3;j++)rect(c,x+d*(3+j*2),yy,1,1,'#665339');
    rect(c,x,yy,1,1,'#c4bb8f');
   }
  } else {
   rect(c,x-4,y-3,8,3,'#65765f');rect(c,x-3,y-3,6,1,'#b1b291');rect(c,x-1,y-35,2,32,'#4b4533');rect(c,x-1,y-33,1,27,'#b99c62');
   shape(c,[[x-3,y-35],[x,y-39],[x+3,y-35],[x,y-32]],'#c2aa6b');rect(c,x,y-37,1,2,'#f0dca0');
   const col=colors[v%6],phase=ph*Math.PI/8,yy=y-33;
   for(let j=0;j<14;j++){const dy=Math.round(Math.sin(phase+j*.6)*1.3),xx=x+1+j;
    rect(c,xx,yy+dy,1,11,'#4d4935');rect(c,xx,yy+dy+1,1,8,col);rect(c,xx,yy+dy+1,1,1,'#d0b879');rect(c,xx,yy+dy+9,1,1,'#b39b61');
    if(j>3&&j<10)rect(c,xx,yy+dy+4,1,j===4||j===9?2:4,'#e0c68c');
    if(j===6||j===7)rect(c,xx,yy+dy+5,1,2,'#727c5a');
   }
  }
 }
 vdDraw=function(c,x,y,o){
  if(!['statue','flag','sign'].includes(o.t))return native(c,x,y,o);
  const v=((o.v||0)% (o.t==='flag'?6:3)+6)% (o.t==='flag'?6:3),ph=o.t==='flag'?((Math.floor(Game.time*8+x*TILE*.1)%16)+16)%16:0,key=o.t+'|'+v+'|'+ph;
  let cv=cache.get(key);if(!cv){cv=mkCanvas(W*2,H*2);const g=cv.getContext('2d');g.setTransform(2,0,0,2,OX*2,OY*2);g.imageSmoothingEnabled=false;paint(g,o.t,v,ph);cache.set(key,cv);}
  c.save();c.imageSmoothingEnabled=R.smooth;c.drawImage(cv,x*TILE-OX,y*TILE-OY,W,H);c.restore();
 };
 window.FantasyPublishedDecor={version:1,cache,rasterScale:2,kinds:['statue','flag','sign']};
})();
