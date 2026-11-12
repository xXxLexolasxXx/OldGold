'use strict';
// Road presentation only. Native road cells, routing, anchors and decor stay native.
(() => {
 const native={shape:roadShape,mask:roadMaskCanvas,tile:drawRoadTile},cache=new Map(),RADIUS=7,EDGE=1,S=TILE+ROAD_M*2;
 const names=['Ровная мостовая','Мягкий скол','Мох в швах','Старая трещинка','Тёплый камень','Резная метка','Земляной шов','Лист у обочины'];
 const api=window.FantasyRoadArt={version:3,rasterScale:2,paintedWidth:16,coreWidth:14,variantNames:names,cache,native,ready:Promise.resolve(),errors:[],variantAt:(x,y)=>variant(x*TILE+16,y*TILE+16)};
 const hash2=(x,y,s=0)=>{let n=Math.imul(x|0,73856093)^Math.imul(y|0,19349663)^(Game.seed|0)^s;n=Math.imul(n^(n>>>16),0x45d9f3b);return(n^(n>>>16))>>>0;};
 const variant=(x,y)=>hash2(Math.floor(x/64),Math.floor(y/64),871)&7;
 const directions = [[1,0],[0,1],[-1,0],[0,-1]];
 const turnTrim = 9, shortcutRadius = 4.5;
 function roadTurn(x,y) {
  const neighbors = directions.filter(([dx,dy])=>isRoadAt(x+dx,y+dy));
  if (neighbors.length !== 2) return null;
  const [[ax,ay],[bx,by]] = neighbors;
  if (ax*bx+ay*by !== 0 || isRoadAt(x+ax+bx,y+ay+by)) return null;
  return neighbors;
 }
 function graph(x,y) {
  const segments=[],fills=[];
  const add=(x,y,dx,dy,radius=RADIUS)=>segments.push([x,y,dx,dy,dx*dx+dy*dy,radius]);
  const turns=new Map();
  const turn=(a,b)=>{
   const key=a+':'+b;
   if(!turns.has(key))turns.set(key,roadTurn(a,b));
   return turns.get(key);
  };
  for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){
   if(!isRoadAt(xx,yy))continue;
   const px=(xx+.5)*TILE,py=(yy+.5)*TILE;
   if(isRoadAt(xx+1,yy)&&isRoadAt(xx,yy+1)&&isRoadAt(xx+1,yy+1))fills.push([px,py]);
   const corner=turn(xx,yy);
   if(corner){
    const [[ax,ay],[bx,by]]=corner;
    let lastX=px+ax*turnTrim,lastY=py+ay*turnTrim;
    for(let i=1;i<=6;i++){
     const t=i/6,u=1-t;
     const X=px+(u*u*ax+t*t*bx)*turnTrim,Y=py+(u*u*ay+t*t*by)*turnTrim;
     add(lastX,lastY,X-lastX,Y-lastY);
     lastX=X;lastY=Y;
    }
   }else add(px,py,0,0);
   for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    if(!isRoadAt(xx+dx,yy+dy))continue;
    if(dx&&dy){
     const a=Boolean(isRoadAt(xx+dx,yy)), b=Boolean(isRoadAt(xx,yy+dy));
     if(a&&b)continue;
     // A courier can walk the diagonal when exactly one side is paved.
     // Keep the shortcut narrow, without filling the enclosed triangle.
     add(px,py,dx*TILE,dy*TILE,a||b?shortcutRadius:RADIUS);
    }else{
     const start=corner?turnTrim:0,end=turn(xx+dx,yy+dy)?turnTrim:0;
     add(px+dx*start,py+dy*start,dx*(TILE-start-end),dy*(TILE-start-end));
    }
   }
  }
  return {segments,fills};
 }
 function distance2(px,py,{segments,fills}){
  for(const [x,y] of fills)if(px>=x&&px<=x+TILE&&py>=y&&py<=y+TILE)return 0;
  let best=Infinity,shortcut=Infinity;
  for(const [x,y,dx,dy,length,radius] of segments){
   const t=length?Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/length)):0;
   const X=px-x-t*dx,Y=py-y-t*dy;
   const d2=X*X+Y*Y;
   if(radius===RADIUS){best=Math.min(best,d2);continue;}
   shortcut=Math.min(shortcut,d2);
  }
  if(best<=RADIUS**2)return best;
  // Distinguish the worn shortcut from the wider stone surface.
  if(shortcut<=(shortcutRadius+EDGE)**2)return -(shortcut+1);
  return best;
 }
 function trailTexture(wx,wy,distance){
  const h=hash2(Math.floor(wx/3),Math.floor(wy/3),197);
  const tone=h%4;
  const edge=shortcutRadius-.75+(h%5)*.25;
  if(distance>edge){
   if(distance>shortcutRadius+.35&&h%4!==0)return null;
   return [72+tone,99+tone,60+tone,48+tone*6];
  }
  if(h%13===0)return [103,104,72,145];
  return [87+tone*2,101+tone,64+tone,82+tone*10];
 }
 roadShape=function(c,x,y,px,py,grow){
  const {segments,fills}=graph(x,y),ox=px-x*TILE,oy=py-y*TILE;
  c.beginPath();
  for(const [ax,ay] of fills)c.rect(ax+ox,ay+oy,TILE,TILE);
  for(const [ax,ay,dx,dy,length,radius] of segments){
   const r=Math.max(.5,radius+(grow||0)*.5),X=ax+ox,Y=ay+oy;
   c.moveTo(X+r,Y);c.arc(X,Y,r,0,Math.PI*2);
   if(!length)continue;
   const len=Math.sqrt(length),nx=-dy/len*r,ny=dx/len*r;
   pathPolyCW(c,[[X+nx,Y+ny],[X+dx+nx,Y+dy+ny],[X+dx-nx,Y+dy-ny],[X-nx,Y-ny]]);
   c.moveTo(X+dx+r,Y+dy);c.arc(X+dx,Y+dy,r,0,Math.PI*2);
  }
 };
 const stoneSeeds=new Map();let stoneSeedTag=null;
 function stone(col,row){if(stoneSeedTag!==Game.seed){stoneSeedTag=Game.seed;stoneSeeds.clear();}const key=col+':'+row;if(stoneSeeds.has(key))return stoneSeeds.get(key);const h=hash2(col,row,493),p={x:col*12+(row&1)*6+6+((h&255)/255-.5)*3,y:row*10+5+(((h>>>8)&255)/255-.5)*2.5,h};stoneSeeds.set(key,p);if(stoneSeeds.size>4096)stoneSeeds.delete(stoneSeeds.keys().next().value);return p;}
 function texture(wx,wy,dist,forced){const row=Math.floor(wy/10);let first=1e9,second=1e9,A=null,B=null;for(let r=row-1;r<=row+1;r++){const col=Math.floor((wx-(r&1)*6)/12);for(let k=col-1;k<=col+1;k++){const p=stone(k,r),dx=wx-p.x,dy=wy-p.y,d=dx*dx+dy*dy;if(d<first){second=first;B=A;first=d;A=p;}else if(d<second){second=d;B=p;}}}const edge=(second-first)/(2*Math.hypot(A.x-B.x,A.y-B.y)),dx=wx-A.x,dy=wy-A.y,h=A.h,v=forced==null?variant(A.x,A.y):forced;
  if(edge<.65)return v===2&&h%3===0?[83,98,61]:[99,93,72];
  const t=((h>>>2)%3-1)*2,warm=v===4&&h%4===0?4:0;let p=[129+t+warm,121+t,95+t-warm];
  if(edge<1.3)p=dx+dy<0?[151+t,141+t,111+t]:[110+t,104+t,82+t];else if(dy<-1.2&&dx<2.8)p=[141+t+warm,132+t,103+t];else if(dy>1.7)p=[123+t+warm,116+t,92+t];
  if(v===1&&h%3===0&&edge<1.65&&dx>1&&dy>1)p=[103,96,74];
  if(v===2&&h%3===0&&edge<1.4&&dy>0)p=[88,103,64];
  if(v===3&&h%3===0&&((dx>-.8&&dx<-.15&&dy>-2&&dy<1)||(dx>-.4&&dx<1.5&&dy>.5&&dy<1.2)))p=[111,104,81];
  if(v===5&&h%5===0&&Math.abs(dx)+Math.abs(dy)<1.65&&Math.abs(dx)+Math.abs(dy)>.85)p=[130,112,73];
  if(v===6&&h%3===0&&edge<1.5&&dy>1)p=[106,97,72];
  if(v===7&&h%3===0&&dist>RADIUS-1.3&&Math.abs(dx)<1.2&&Math.abs(dy)<1.2)p=[91,106,66];
  return p;
 }
 function pair(x,y,forced){let neighbors='';for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++)neighbors+=isRoadAt(xx,yy)?'1':'0';const key=[Game.seed,x,y,neighbors,forced??'world'].join(':');if(cache.has(key))return cache.get(key);const geometry=graph(x,y),fine=[mkCanvas(S*2,S*2),mkCanvas(S*2,S*2)],ox=x*TILE-ROAD_M,oy=y*TILE-ROAD_M;
  const contexts=fine.map(cv=>cv.getContext('2d')),images=contexts.map(c=>c.createImageData(S*2,S*2));
  for(let py=0;py<S*2;py++)for(let px=0;px<S*2;px++){const wx=ox+(px+.5)/2,wy=oy+(py+.5)/2,d2=distance2(wx,wy,geometry);if(d2>(RADIUS+EDGE)**2)continue;const o=(py*S*2+px)*4;
   if(d2<0){
    const rgb=trailTexture(wx,wy,Math.sqrt(-d2-1));
    if(rgb){
     for(let k=0;k<3;k++)images[0].data[o+k]=rgb[k];
     images[0].data[o+3]=rgb[3];
    }
    continue;
   }
   const d=Math.sqrt(d2);let rgb;if(d2<=RADIUS*RADIUS){rgb=texture(wx,wy,d,forced);for(let k=0;k<3;k++)images[1].data[o+k]=rgb[k];images[1].data[o+3]=255;}else{const h=hash2(Math.floor(wx/5),Math.floor(wy/5),61);rgb=h%5===0?[82,94,59]:[89,84,63];for(let k=0;k<3;k++)images[0].data[o+k]=rgb[k];images[0].data[o+3]=255;}}
  const output=fine.map((cv,i)=>{contexts[i].putImageData(images[i],0,0);const out=mkCanvas(S,S),c=out.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(cv,0,0,S,S);return out;});cache.set(key,output);if(cache.size>384)cache.delete(cache.keys().next().value);return output;
 }
 roadMaskCanvas=function(x,y,grow,cobbles){return pair(x,y)[cobbles?1:0];};
 // Keep native dirty regions/rver/lazy state; replace only its dithered paint.
 drawRoadTile=function(x,y){const result=native.tile(x,y);if(!TERR.ready||(!World.road[idx(x,y)]&&!diagBands(x,y).length&&!roadChamfers(x,y).length))return result;const bi=Math.floor(y/TBAND),b=TERR.rb[bi];if(!b)return result;const c=b.cv.getContext('2d'),px=x*TILE,py=y*TILE-b.y0;c.save();c.beginPath();c.rect(px,py,TILE,TILE);c.clip();c.clearRect(px,py,TILE,TILE);const p=pair(x,y);c.imageSmoothingEnabled=false;c.drawImage(p[0],px-ROAD_M,py-ROAD_M);c.drawImage(p[1],px-ROAD_M,py-ROAD_M);c.restore();return result;};
 api.sample=(x,y,v)=>pair(x,y,v);api.clear=()=>cache.clear();
})();

function faStoneFoot(c, x, y, w = 8) {
  poly(c, [[x-w/2,y-3],[x+w/2-1,y-4],[x+w/2+1,y],[x-1,y+2],[x-w/2-1,y]], '#676d61');
  pline(c, x-w/2+1, y-3, x+w/2-2, y-3, '#b0b19a', 1);
  faRect(c, x-w/2, y, 3, 1, '#718651');
}

drawGothicLamp = function (c, x, y, v, lit, ph, glowStep) {
  c.save(); c.imageSmoothingEnabled = false;
  shadowAt(c, x+2, y, 5); faStoneFoot(c, x, y);
  const side = v % 2 ? -1 : 1, lx = x+side*7, ly = y-28;
  faRect(c, x-2, y-31, 4, 28, '#493c2b'); faRect(c, x-1, y-30, 1, 26, '#a27d4b');
  faRect(c, x-3, y-25, 6, 2, '#6e775e'); faRect(c, x-3, y-7, 6, 2, '#6e775e');
  poly(c, [[x-4,y-31],[x,y-36],[x+4,y-31]], '#567867');
  pline(c, x, y-30, lx, y-33, '#473d2e', 2); pline(c, lx, y-33, lx, ly-3, '#bf9c58', 1);
  // Copper roof, amber glass, visible metal frame; extinguishing remains native.
  if (lit) glow(c, lx, ly+3, 15, '255,191,92', 0.16+(glowStep??Math.sin(Game.time*5+ph)*5)*0.005);
  poly(c, [[lx-5,ly],[lx,ly-5],[lx+5,ly],[lx+4,ly+1],[lx-4,ly+1]], '#52796e');
  pline(c, lx-4, ly, lx, ly-4, '#a8b39b', 1);
  faRect(c,lx-4,ly+1,8,9,'#493d2c'); faRect(c,lx-3,ly+2,6,6,lit?'#dba34d':'#68766c');
  if(lit) faRect(c,lx-2,ly+3,2,4,Math.sin(Game.time*6+ph)>0?'#ffe8a0':'#f3ce78');
  faRect(c,lx,ly+1,1,8,'#8e7043'); faRect(c,lx-4,ly+9,8,1,'#b18d50');
  c.restore();
};

drawBench = function(c, px, py, o) {
  const w=[12,20,29][benchSeats(o)-1], x=px+16-w/2, y=py+24;
  c.save(); shadowAt(c, px+17, y, w/2);
  for(const dx of [2,w-4]) { faStoneFoot(c,x+dx+1,y,5); faRect(c,x+dx,y-12,2,11,'#554432'); }
  faRect(c,x-1,y-13,w+2,5,'#654b32'); faRect(c,x,y-13,w,1,'#c09a60');
  faRect(c,x,y-11,w,1,'#967347'); faRect(c,x-1,y-6,w+2,3,'#956f44'); faRect(c,x,y-6,w,1,'#c4a16a');
  for(let k=0;k<benchSeats(o);k++) { const xx=x+(k+.5)*w/benchSeats(o); poly(c,[[xx,y-12],[xx+1,y-10],[xx,y-9],[xx-1,y-10]],'#aaa171'); }
  c.restore();
};

drawBin = function(c, px, py, o) {
  const x=px+16,y=py+24;
  shadowAt(c,x+1,y,6); faStoneFoot(c,x,y,12);
  poly(c,[[x-5,y-12],[x+5,y-12],[x+6,y-4],[x+4,y],[x-4,y],[x-6,y-4]],'#745639');
  for(const dx of [-3,0,3]) faRect(c,x+dx,y-11,1,10,'#ad8551');
  faRect(c,x-5,y-9,10,2,'#52685e'); faRect(c,x-5,y-3,10,2,'#52685e');
  poly(c,[[x-7,y-12],[x-4,y-15],[x+4,y-15],[x+7,y-12]],'#698273');
  faRect(c,x-4,y-13,8,2,'#302f25');
  if(o.g>.65) { faRect(c,x-2,y-14,3,2,'#b5a67d'); faRect(c,x+2,y-14,2,1,'#6a8c55'); }
};

drawBed = function(c, px, py, o) {
  const x=px+16,y=py+23;
  ellipse(c,x,y,11,4,'#6b705e'); ellipse(c,x,y-2,10,4,'#b0ac8c'); ellipse(c,x,y-3,8,3,'#5e503a');
  for(let k=0;k<7;k++) {
    const xx=x-7+k*2, yy=y-4-(k*7+(o.v||0))%5;
    faRect(c,xx,yy,1,y-yy-2,'#567747'); faRect(c,xx-1,yy+2,3,1,'#7c9754');
    const col=['#d4b36f','#bb839d','#9da9c3'][((o.v||0)+k)%3];
    faRect(c,xx-1,yy-1,3,2,col); faRect(c,xx,yy-2,1,4,col); faRect(c,xx,yy-1,1,1,'#f0dca3');
  }
};

drawCrateObj = function(c,px,py,o) {
  const x=px+9,y=py+12; shadowAt(c,px+17,py+25,9);
  poly(c,[[x,y+3],[x+11,y],[x+18,y+4],[x+7,y+7]],'#b08d58');
  poly(c,[[x,y+3],[x+7,y+7],[x+7,y+15],[x,y+11]],'#705335');
  poly(c,[[x+7,y+7],[x+18,y+4],[x+18,y+12],[x+7,y+15]],'#8e6b43');
  pline(c,x+8,y+8,x+17,y+12,'#bb975c',1); pline(c,x+17,y+5,x+8,y+14,'#bb975c',1);
  faRect(c,x+3,y+5,2,7,'#53665a'); faRect(c,x+13,y+6,2,7,'#53665a');
};

const faOldMagicObj = drawMagicObj;
drawMagicObj = function(c,px,py,o) {
  c.save(); c.translate(px+16,py+24); c.scale(.85,.85); c.translate(-px-16,-py-24);
  faOldMagicObj(c,px,py,o); c.restore();
};

drawFenceObj = function(c,px,py,o) {
  const y=py+23;
  for(const x of [px+4,px+27]) {
    faStoneFoot(c,x,y,6); faRect(c,x-2,y-13,4,12,'#785c3d'); faRect(c,x-1,y-12,1,10,'#b29560');
    poly(c,[[x-3,y-13],[x,y-17],[x+3,y-13]],'#67846a');
  }
  faRect(c,px+4,y-11,23,2,'#9b7d4e'); faRect(c,px+4,y-5,23,2,'#896a43');
  pline(c,px+7,y-10,px+24,y-4,'#b99b65',1);
};

// Match the approved building layers: author in world coordinates, rasterize at
// 2x, then present through the map's existing nearest-neighbour/overview policy.
// Wrap only paint functions. Growth clipping and night morphs stay with the
// native drawStreetObj/drawDecorObj, outside this graphics-only layer.
(() => {
  const cache = new Map(), W = 64, H = 80, OX = 16, OY = 40;
  let scratch;
  function fine(c,x,y,w,h,col) {
    c.fillStyle=col;c.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,Math.round(w*2)/2,Math.round(h*2)/2);
  }
  function output(c,x,y,key,paint) {
    let cv=key&&cache.get(key);
    if(!cv) {
      cv=key?mkCanvas(W*2,H*2):(scratch||(scratch=mkCanvas(W*2,H*2)));
      const g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
      g.setTransform(2,0,0,2,(OX-x)*2,(OY-y)*2);g.imageSmoothingEnabled=false;
      paint(g);
      if(key)cache.set(key,cv);
    }
    c.save();c.imageSmoothingEnabled=R.smooth;c.drawImage(cv,x-OX,y-OY,W,H);c.restore();
  }
  const bench=drawBench,bin=drawBin,bed=drawBed,cratePaint=drawCrateObj,fence=drawFenceObj,lamp=drawGothicLamp,magic=drawMagicObj;
  drawBench=function(c,x,y,o){output(c,x,y,'bench:'+((o.v||0)%15),g=>{
    bench(g,x,y,o);const w=[12,20,29][benchSeats(o)-1],xx=x+16-w/2,yy=y+24;
    for(const dx of [2,w-3]){fine(g,xx+dx,yy-11.5,.5,.5,'#dbc38c');fine(g,xx+dx,yy-4.5,.5,.5,'#d4b47a');}
    fine(g,xx+3,yy-12,w-6,.5,'#b18b55');fine(g,xx+4,yy-4.5,Math.max(2,w-9),.5,'#755238');
  });};
  drawBin=function(c,x,y,o){output(c,x,y,'bin:'+((o.g||0)>.65),g=>{
    bin(g,x,y,o);for(const yy of [y+15,y+21]){fine(g,x+12,yy,.5,1,'#b8b99a');fine(g,x+19,yy,.5,1,'#b8b99a');}
    fine(g,x+13.5,y+14,.5,6,'#c4a26b');
  });};
  drawBed=function(c,x,y,o){output(c,x,y,'bed:'+((o.v||0)%15),g=>{
    bed(g,x,y,o);for(const dx of [-7,-2,4,8])fine(g,x+16+dx,y+23,1,.5,'#66775b');
  });};
  drawCrateObj=function(c,x,y,o){output(c,x,y,'crate',g=>{
    cratePaint(g,x,y,o);for(const dx of [12,22])for(const yy of [y+18,y+24])fine(g,x+dx,yy,.5,.5,'#d1c29b');
    fine(g,x+18.5,y+20,.5,5,'#6b5238');
  });};
  drawFenceObj=function(c,x,y,o){output(c,x,y,'fence',g=>{
    fence(g,x,y,o);for(const dx of [4,27]){fine(g,x+dx,y+13,.5,1,'#d7bd83');fine(g,x+dx,y+19,.5,1,'#ccb17a');}
    fine(g,x+6,y+12.5,19,.5,'#c5a86f');
  });};
  drawGothicLamp=function(c,bx,by,v,lit,ph){
    const side=v%2?1:0,glowStep=lit?Math.round(Math.sin(Game.time*5+ph)*5):0;
    const glint=lit&&Math.sin(Game.time*6+ph)>0?1:0;
    // Share the two unlit sprites and the bounded set of lit phases across
    // all lamps. Repainting a shared scratch canvas forced a flush per lamp.
    const key=lit?`lamp:${side}:${glowStep}:${glint}`:`lamp:${side}:off`;
    output(c,bx-22,by-24,key,g=>{
      lamp(g,bx,by,side,lit,ph,glowStep);
      for(const dy of [-24.5,-6.5]){fine(g,bx-2,by+dy,.5,.5,'#c3bf9a');fine(g,bx+2,by+dy,.5,.5,'#c3bf9a');}
      fine(g,bx-.5,by-22,.5,10,'#886b46');
      const lx=bx+(side?-7:7),ly=by-28;
      fine(g,lx-2.5,ly+2,.5,4,lit?'#f7df9d':'#a2afa0');
    });
  };
  drawMagicObj=function(c,x,y,o){output(c,x,y,null,g=>magic(g,x,y,o));};
  window.FantasyStreetArt={rasterScale:2,worldBounds:[-OX,-OY,W,H],cache,clear:()=>cache.clear()};
})();


