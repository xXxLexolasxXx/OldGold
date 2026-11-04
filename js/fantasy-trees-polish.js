'use strict';
// Ordinary resource trees only. Load after render.js and world/snow.js.
// Never replace SPR.trees: that array is also used by forbidden awakened ents.
(() => {
  if (window.FantasyTreesPolish) return;
  const kinds = ['oak', 'oak', 'oak', 'birch', 'pine', 'fir', 'pine'];
  const seeds = [11, 23, 37, 41, 53, 67, 71];
  function tree(kind, seed) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 184;
    const c = cv.getContext('2d'); c.scale(2, 2); c.imageSmoothingEnabled = false;
    const rng = mulberry32(seed + 813);
    const rect = (x,y,w,h,col) => { c.fillStyle=col;c.fillRect(x,y,w,h); };
    // Integer world-pixel scanlines: no soft vector fringe around silhouettes.
    function shape(points, col) {
      const lo=Math.floor(Math.min(...points.map(p=>p[1]))),hi=Math.ceil(Math.max(...points.map(p=>p[1])));
      c.fillStyle=col;
      for(let y=lo;y<hi;y++){
        const hits=[];
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length],yy=y+0.5;
          if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))hits.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        hits.sort((a,b)=>a-b);
        for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]-0.5),end=Math.ceil(hits[i+1]-0.5);if(end>x)c.fillRect(x,y,end-x,1);}
      }
    }
    const birch=kind==='birch', evergreen=kind==='pine'||kind==='fir';
    const wood=birch?['#403b30','#a9a58a','#ded9b7','#f2e5c1']:['#35281f','#69482b','#976739','#bf9151'];
    shape([[25,88],[28,81],[29,48],[34,43],[36,80],[40,88],[34,87],[32,84],[30,88]],wood[0]);
    shape([[27,87],[30,79],[30,48],[33,46],[34,80],[37,87],[33,85],[31,83],[30,87]],wood[1]);
    shape([[29,82],[31,50],[32,47],[32,80],[34,84],[31,82]],wood[2]);
    rect(30,67,1,10,wood[3]);
    shape([[30,60],[21,47],[23,45],[33,57],[41,46],[43,47],[34,62]],wood[0]);
    if(birch)for(let k=0;k<7;k++){const y=53+k*4;rect(k%2?32:30,y,2,1,wood[0]);}
    else {rect(34,68,1,12,wood[0]);rect(31,78,2,2,wood[0]);rect(32,78,1,1,wood[3]);}
    const pal=evergreen?['#24362a','#324d31','#42623b','#5b7c45','#7b9853']:['#2a3c27','#38552d','#53783a','#7c9e49','#b2c970'];
    function crown(cx,cy,rx,ry,phase) {
      // Broad asymmetrical leaf masses; the underside keeps a warm dark seam.
      for(let y=Math.floor(cy-ry);y<=cy+ry;y++){
        const dy=(y-cy)/ry;if(Math.abs(dy)>1)continue;
        const width=Math.sqrt(1-dy*dy)*rx;
        const notch=Math.sin((Math.floor(y/3)+phase)*2.3)>0.55?1:0;
        const x0=Math.ceil(cx-width)+notch,x1=Math.floor(cx+width)-notch;
        if(x1<x0)continue;
        rect(x0,y,x1-x0+1,1,pal[0]);
        if(x1-x0>3)rect(x0+1,y,x1-x0-1,1,dy>0.58?pal[1]:pal[2]);
        if(dy<0.48&&x1-x0>7)rect(x0+2,y,Math.max(1,Math.floor((x1-x0)*(0.66-dy*.18))),1,pal[3]);
        if(dy<-.16&&dy>-.8&&x1-x0>8)rect(x0+3,y,Math.floor((x1-x0)*(.34-dy*.12)),1,pal[4]);
      }
      // Restrained 2–4 px leaf clusters instead of single-pixel confetti.
      for(let k=0;k<30;k++){
        const dx=(rng()-.5)*rx*1.65,dy=(rng()-.5)*ry*1.55;
        if((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry)>.65)continue;
        const x=Math.round(cx+dx),y=Math.round(cy+dy);
        rect(x,y,2+(k%3),1,k%4===0?pal[1]:dy<0?pal[4]:pal[3]);
        if(k%3===0)rect(x+1,y+1,2,1,pal[2]);
      }
    }
    if(!evergreen){
      if(birch){crown(31,43,14,16,1);crown(34,28,13,17,2);crown(29,18,10,12,3);}
      else {
        const shift=seed%5-2;
        crown(21,43,15,14,1);crown(43,43,15,15,2);
        crown(31+shift,29,20,18,3);crown(20,29,12,12,4);crown(40,22,13,13,5);
        crown(29+shift,17,13,11,6);
      }
    } else {
      const tiers=kind==='fir'?6:5;
      for(let k=0;k<tiers;k++){
        const y=Math.round(76-k*(kind==='fir'?11:12.5));
        const w=Math.round((kind==='fir'?22:24)*(1-k/(tiers+1.2)));
        const top=y-(kind==='fir'?18:20);
        const edge=[[32,top],[32+w*.45,y-8],[32+w,y],[32+w-4,y-1],[32+w-7,y+2],[32,y],[32-w+7,y+2],[32-w+4,y-1],[32-w,y],[32-w*.45,y-8]];
        shape(edge,pal[0]);
        shape([[31,top+3],[32+w-4,y-2],[32,y-3],[32-w+3,y-1]],pal[2]);
        shape([[31,top+4],[30,y-4],[32-w+5,y-2]],pal[3]);
        for(let j=0;j<5;j++){
          const yy=top+7+j*2,span=Math.max(1,Math.floor((yy-top)/(y-top)*w*.7));
          rect(31-span,yy,Math.max(1,Math.floor(span*.6)),1,j%2?pal[4]:pal[3]);
        }
      }
    }
    return cv;
  }
  const base=kinds.map((kind,i)=>tree(kind,seeds[i])),cache={base};
  function seasonal(src, mode) {
    const cv=document.createElement('canvas');cv.width=src.width;cv.height=src.height;
    const c=cv.getContext('2d');c.drawImage(src,0,0);
    const image=c.getImageData(0,0,cv.width,cv.height),d=image.data;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
      const p=(y*cv.width+x)*4;if(!d[p+3])continue;
      const r=d[p],g=d[p+1],b=d[p+2];if(g<=r*1.05||g<=b*1.1)continue;
      const wx=x>>1,wy=y>>1,lum=(r+g+b)/3;
      const patch=(Math.floor(wx/7)*13+Math.floor(wy/6)*7)%11;
      let col;
      if(mode==='win') {
        // Broad caps follow lit foliage; no per-pixel white salt over the tree.
        if(lum>95||(lum>70&&patch<5))col=lum>115?[232,236,216]:[190,207,199];
        else col=[Math.round(r*.76),Math.round(g*.87),Math.round(b*1.04)];
      }else{
        if(mode==='au1'&&patch>6)continue;
        const light=Math.max(.36,Math.min(1.2,lum/116));
        const ramp=mode==='au2'?(patch<4?[191,105,43]:[200,151,56]):[192,174,65];
        col=ramp.map(v=>Math.round(v*light));
      }
      d[p]=col[0];d[p+1]=col[1];d[p+2]=col[2];
    }
    c.putImageData(image,0,0);return cv;
  }
  const legacy=drawTree;
  const info=window.FantasyTreesPolish={version:1,kinds:kinds.slice(),base,cache,drawn:0};
  drawTree=function(c,x,y,o,i){
    if(o.awake)return legacy(c,x,y,o,i);
    const mode=typeof seaVisMode==='function'?seaVisMode():'base';
    if(!cache[mode])cache[mode]=base.map(cv=>seasonal(cv,mode));
    const h=hash(i),spr=cache[mode][h%base.length];
    const s=o.g>=1?1:0.35+0.55*o.g;
    const bx=x*TILE+16+((h>>>4)%7)-3,by=y*TILE+28+((h>>>12)%5)-2;
    c.save();c.imageSmoothingEnabled=R.smooth;
    c.fillStyle='rgba(12,18,6,0.35)';c.beginPath();c.ellipse(bx+6*s,by-1,16*s,6*s,0,0,7);c.fill();
    const w=Math.round(64*s),hh=Math.round(92*s);
    c.drawImage(spr,Math.round(bx-w/2),Math.round(by-hh*(88/92)),w,hh);
    c.restore();info.drawn++;
  };
})();
