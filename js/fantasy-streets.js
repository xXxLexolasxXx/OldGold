'use strict';
// Rendering only: street objects keep their native jobs, seats and night states.
// Narrow only the painted footprint. World.road and routing retain native cells.
const faNativeRoadShape = roadShape;
roadShape = function(c,x,y,px,py,grow,bands,chamfers) {
  return faNativeRoadShape(c,x,y,px,py,grow-3,bands,chamfers);
};
const faRoadMask = roadMaskCanvas;
roadMaskCanvas = function (x, y, grow, cobbles) {
  const cv = faRoadMask(x, y, grow * 0.6, cobbles);
  if (!cobbles) {
    const c = cv.getContext('2d'), im = c.getImageData(0, 0, cv.width, cv.height);
    for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3]) {
      im.data[i] = 78; im.data[i + 1] = 91; im.data[i + 2] = 58; im.data[i + 3] = 110;
    }
    c.putImageData(im, 0, 0);
  }
  return cv;
};

function faStoneFoot(c, x, y, w = 8) {
  poly(c, [[x-w/2,y-3],[x+w/2-1,y-4],[x+w/2+1,y],[x-1,y+2],[x-w/2-1,y]], '#676d61');
  pline(c, x-w/2+1, y-3, x+w/2-2, y-3, '#b0b19a', 1);
  faRect(c, x-w/2, y, 3, 1, '#718651');
}

drawGothicLamp = function (c, x, y, v, lit, ph) {
  c.save(); c.imageSmoothingEnabled = false;
  shadowAt(c, x+2, y, 5); faStoneFoot(c, x, y);
  const side = v % 2 ? -1 : 1, lx = x+side*7, ly = y-28;
  faRect(c, x-2, y-31, 4, 28, '#493c2b'); faRect(c, x-1, y-30, 1, 26, '#a27d4b');
  faRect(c, x-3, y-25, 6, 2, '#6e775e'); faRect(c, x-3, y-7, 6, 2, '#6e775e');
  poly(c, [[x-4,y-31],[x,y-36],[x+4,y-31]], '#567867');
  pline(c, x, y-30, lx, y-33, '#473d2e', 2); pline(c, lx, y-33, lx, ly-3, '#bf9c58', 1);
  // Copper roof, amber glass, visible metal frame; extinguishing remains native.
  if (lit) glow(c, lx, ly+3, 15, '255,191,92', 0.16+Math.sin(Game.time*5+ph)*0.025);
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
  drawGothicLamp=function(c,bx,by,v,lit,ph){output(c,bx-22,by-24,null,g=>{
    lamp(g,bx,by,v,lit,ph);
    for(const dy of [-24.5,-6.5]){fine(g,bx-2,by+dy,.5,.5,'#c3bf9a');fine(g,bx+2,by+dy,.5,.5,'#c3bf9a');}
    fine(g,bx-.5,by-22,.5,10,'#886b46');
    const lx=bx+(v%2?-7:7),ly=by-28;
    fine(g,lx-2.5,ly+2,.5,4,lit?'#f7df9d':'#a2afa0');
  });};
  drawMagicObj=function(c,x,y,o){output(c,x,y,null,g=>magic(g,x,y,o));};
  window.FantasyStreetArt={rasterScale:2,worldBounds:[-OX,-OY,W,H],cache,clear:()=>cache.clear()};
})();

