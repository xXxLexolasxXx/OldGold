'use strict';
// Presentation-only mountain/stone compositor for OldGold 0.11.99.
// Load after mountains.js, snow.js and fantasy-trees-polish.js.
(() => {
  if (window.FantasyPublishedEnvironment) return;
  const info=window.FantasyPublishedEnvironment={version:2,groups:0,joined:0,cache:new Map(),stoneCache:new Map()};
  let source=null,signature='',lookup=new WeakMap();
  const box=m=>{const s=MT_SIZES[m.size];return {x:Math.round(m.x-s.w/2),y:Math.round(m.y-(s.h-9)),w:s.w,h:s.h};};
  function scan(){
    const sig=MOUNTS.length;
    if(source===MOUNTS&&sig===signature)return;
    source=MOUNTS;signature=sig;lookup=new WeakMap();info.cache.clear();
    const pending=new Set(MOUNTS),groups=[];
    // Only close, similarly grounded neighbours. Every original foot remains a render entry.
    for(const m of MOUNTS){if(!pending.delete(m))continue;const members=[m];
      for(const n of MOUNTS){if(!pending.has(n)||members.length>=4)continue;
        if(members.some(a=>Math.abs(a.y-n.y)<=18&&Math.abs(a.x-n.x)<=Math.min(MT_SIZES[a.size].w,MT_SIZES[n.size].w)*.82)&&Math.abs(n.x-m.x)<260){members.push(n);pending.delete(n);}}
      members.sort((a,b)=>a.x-b.x);const g={members};groups.push(g);for(const n of members)lookup.set(n,g);
    }
    info.groupsList=groups;info.groups=groups.length;info.joined=groups.filter(g=>g.members.length>1).length;
  }
  function polygon(c,pts,color){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function rockPalette(v){const biome=typeof MapOpt==='undefined'?'meadow':MapOpt.biome;
    const bp=typeof MT_PAL_BIOME!=='undefined'&&MT_PAL_BIOME[biome];if(bp){const p=bp[v%bp.length];return [p.shade[1],p.shade[0],p.lit[1],p.lit[0],p.rim];}
    if(biome==='desert')return ['#43352c','#776047','#a58a60','#c6ad7c','#ead3a2'];
    if(biome==='winter')return ['#303a40','#58646a','#809090','#a7b3ad','#d1d7c5'];
    return v%3===2?['#44372c','#73604b','#a78f6b','#c8b38c','#e5d4aa']:['#3b352e','#6c6253','#a09277','#c1b290','#e4d3ab'];
  }
  function paintGroup(g,level){
    const key=(typeof MapOpt==='undefined'?'meadow':MapOpt.biome)+':'+level+':'+g.members.map(m=>[m.x,m.y,m.size,m.v]).join('|');
    if(info.cache.has(key)){const hit=info.cache.get(key);info.cache.delete(key);info.cache.set(key,hit);return hit;}
    const bounds=g.members.map(box),x0=Math.min(...bounds.map(b=>b.x)),y0=Math.min(...bounds.map(b=>b.y)),x1=Math.max(...bounds.map(b=>b.x+b.w)),y1=Math.max(...bounds.map(b=>b.y+b.h));
    const w=x1-x0,h=y1-y0,cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const c=cv.getContext('2d');c.scale(2,2);c.imageSmoothingEnabled=false;
    const p=rockPalette(g.members[0].v),rng=mulberry32((Math.round(x0)*17+Math.round(y0)*31+g.members.length*97)>>>0),base=h-9;
    // A shared shoulder, ridge and continuous foot, rather than stacked copies of a peak.
    const count=g.members.length===1?3:g.members.length+1,peaks=[];
    for(let k=0;k<count;k++){
      const x=8+(k+.5)*(w-16)/count;
      const central=1-Math.abs((k+.5)/count-.5)*1.5;
      const py=Math.round(5+(1-central)*h*.44+(rng()-.5)*h*.07);
      peaks.push([Math.round(x),py]);
    }
    // Continuous irregular foot follows native feet and dips at slice borders.
    // This keeps each border inside both native rectangles, avoiding clipped platforms.
    const footNodes=[[0,g.members[0].y+3-y0]];
    for(let i=0;i<g.members.length;i++){
      const m=g.members[i];footNodes.push([m.x-x0,m.y+3-y0]);
      if(i+1<g.members.length){const n=g.members[i+1];footNodes.push([(m.x+n.x)/2-x0,Math.min(m.y,n.y)+2-y0]);}
    }
    footNodes.push([w,g.members.at(-1).y+3-y0]);
    function footAt(x){for(let i=1;i<footNodes.length;i++)if(x<=footNodes[i][0]){const a=footNodes[i-1],b=footNodes[i],t=(x-a[0])/Math.max(1,b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}return footNodes.at(-1)[1];}
    const foot=[];for(let x=3;x<w-2;x+=5)foot.push([x,Math.round(footAt(x)-2+rng()*3)]);
    const ridge=[[2,footAt(2)-7],[Math.round(w*.05),base-h*.17]];
    for(let k=0;k<peaks.length;k++){
      const [x,y]=peaks[k];ridge.push([x-15,y+23],[x-13,y+18],[x-9,y+18],[x-6,y+10],[x-3,y+8],[x-2,y+3],[x,y],[x+3,y+5],[x+7,y+13],[x+10,y+14]);
      if(k+1<peaks.length){const n=peaks[k+1];ridge.push([Math.round((x+n[0])*.5),Math.round(Math.max(y,n[1])+h*.11)]);}
    }
    ridge.push([w-4,base-h*.14],[w-2,footAt(w-2)-5]);
    polygon(c,[...ridge,...foot.slice().reverse()],p[0]);
    c.save();c.beginPath();ridge.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));foot.slice().reverse().forEach(([x,y])=>c.lineTo(x,y));c.closePath();c.clip();
    c.fillStyle=p[2];c.fillRect(2,0,w-4,base+6);
    for(let k=0;k<peaks.length;k++){
      const [x,y]=peaks[k],span=w/count;
      polygon(c,[[x,y],[x+span*.18,base-h*.36],[x+span*.55,base+5],[x+span*.9,base+5],[x+span*.65,base-h*.25],[x+span*.42,y+h*.2]],p[1]);
      polygon(c,[[x-1,y+2],[x-span*.55,base-h*.12],[x-span*.12,base-h*.26],[x+span*.1,base-h*.43]],p[3]);
      polygon(c,[[x-1,y+2],[x-3,y+10],[x-span*.12,y+h*.19],[x-span*.2,y+h*.21],[x-span*.06,y+8]],p[4]);
      polygon(c,[[x+span*.25,y+h*.35],[x+span*.1,base-h*.24],[x+span*.28,base+3],[x+span*.4,base+3]],p[0]);
      // Interlocking weathered rock masses replace flat poster-like triangle faces.
      for(let row=0;row<4;row++)for(let col=0;col<2;col++){
        const xx=x-span*.34+col*span*.35+(rng()-.5)*span*.22;
        const yy=y+(base-y)*(.28+row*.17)+(rng()-.5)*(base-y)*.06;
        const rw=span*(.13+rng()*.18),rh=(base-y)*(.045+rng()*.045);
        const pts=[[xx-rw,yy],[xx-rw*.62,yy-rh*.75],[xx-rw*.1,yy-rh],[xx+rw*.68,yy-rh*.48],[xx+rw,yy+rh*.18],[xx+rw*.35,yy+rh*.7],[xx-rw*.6,yy+rh*.65]];
        polygon(c,pts,col?p[1]:p[2]);
        polygon(c,[pts[0],pts[1],pts[2],pts[3],[xx+rw*.2,yy-rh*.1],[xx-rw*.5,yy+rh*.12]],col?p[2]:p[3]);
        c.strokeStyle=col?p[0]:p[1];c.lineWidth=.5;c.beginPath();c.moveTo(xx-rw*.6,yy+rh*.65);c.lineTo(xx-rw*.15,yy+rh*.8);c.lineTo(xx+rw*.35,yy+rh*.7);c.stroke();
        if(row%2===0){polygon(c,[[xx-rw*.55,yy-rh*.68],[xx-rw*.1,yy-rh*.93],[xx+rw*.3,yy-rh*.65],[xx,yy-rh*.55]],p[4]);}
      }
    }
    // Short fractured seams and stone facets, at the same fine detail scale as masonry.
    for(const [px,py]of peaks){
      const span=w/count;
      for(let k=0;k<13;k++){
        const x=Math.round(px+(rng()-.5)*span*.85),y=Math.round(py+(base-py)*(.22+rng()*.65));
        const sw=2+Math.round(rng()*3),sh=1+Math.round(rng()*3);
        polygon(c,[[x,y],[x+sw*.4,y-1],[x+sw,y],[x+sw+1,y+sh*.5],[x+sw*.6,y+sh+1],[x+1,y+sh]],k%3?p[2]:p[3]);
        c.fillStyle=p[1];c.fillRect(x+1,y+sh+1,sw,.5);
      }
      for(let k=0;k<3;k++){
        let x=Math.round(px+(k-1)*span*.2),y=Math.round(py+(base-py)*(.3+k*.13));
        c.strokeStyle=p[1];c.lineWidth=.5;c.beginPath();c.moveTo(x,y);
        for(let j=0;j<4;j++){x+=Math.round((rng()-.45)*5);y+=3+Math.round(rng()*4);c.lineTo(x,y);}c.stroke();
      }
    }
    // Unified talus base ties peaks together without a row of identical pebbles.
    polygon(c,[...foot.map(([x,y],i)=>[x,y-7-(i%3)*2]),...foot.slice().reverse()],p[1]);
    for(let k=0;k<w/11;k++){
      const x=Math.round(3+rng()*(w-8)),y=Math.round(footAt(x)-5+rng()*3),s=2+Math.floor(rng()*4);
      polygon(c,[[x-s,y],[x-s+1,y-s],[x+1,y-s-1],[x+s,y-1],[x+s-1,y+1]],p[k%2?2:1]);
      c.fillStyle=p[3];c.fillRect(x-s+1,y-s,Math.max(1,s-1),1);
      if(k%3===0){c.fillStyle='#526141';c.fillRect(x-1,y+1,s,2);c.fillStyle='#85935c';c.fillRect(x,y,s-1,1);}
    }
    if(level>=0){const frac=MT_CAP_LEVELS[level];
      for(const [x,y]of peaks){const depth=Math.max(3,Math.round(h*frac*.65));polygon(c,[[x,y-1],[x+depth*.6,y+depth],[x+depth*.18,y+depth*.72],[x-2,y+depth],[x-depth*.6,y+depth*.85]],'#ccd8cf');polygon(c,[[x-1,y],[x+depth*.15,y+depth*.65],[x-depth*.54,y+depth*.82]],'#f0ecd6');}
    }
    c.restore();
    c.strokeStyle=p[0];c.lineWidth=.6;c.beginPath();ridge.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
    // Keep binary half-world-pixel outlines, same 2x buffer convention as buildings.
    const im=c.getImageData(0,0,cv.width,cv.height),d=im.data;
    for(let i=3;i<d.length;i+=4)d[i]=d[i]>=128?255:0;
    // Pigment lives in small connected pixel clusters, like the building masonry.
    // Low contrast follows the existing facet colour; it does not sprinkle bright noise.
    for(let y=4;y<h-3;y+=3)for(let x=3;x<w-3;x+=4){
      if(rng()>.48)continue;
      const xx=x+(rng()*2|0),yy=y+(rng()*2|0),o=((yy*2)*cv.width+xx*2)*4;
      const lum=(d[o]+d[o+1]+d[o+2])/3;if(d[o+3]<255||lum<65||lum>205)continue;
      const tint=rng()>.45?7:-6,width=rng()>.5?3:2;
      for(let dy=0;dy<3;dy++)for(let dx=0;dx<width*2;dx++){
        if(dy===2&&(dx<2||dx>width*2-2))continue;
        const q=((yy*2+dy)*cv.width+xx*2+dx)*4;
        if(d[q+3]<255||Math.abs(d[q]-d[o])>22||Math.abs(d[q+1]-d[o+1])>22)continue;
        d[q]=Math.max(0,Math.min(255,d[q]+tint));d[q+1]=Math.max(0,Math.min(255,d[q+1]+tint));d[q+2]=Math.max(0,Math.min(255,d[q+2]+tint-1));
      }
    }
    c.putImageData(im,0,0);
    const slices=new WeakMap();
    for(let i=0;i<g.members.length;i++){
      const m=g.members[i],b=bounds[i],left=i?Math.round((g.members[i-1].x+m.x)*.5):b.x,right=i+1<g.members.length?Math.round((m.x+g.members[i+1].x)*.5):b.x+b.w;
      const slice=document.createElement('canvas');slice.width=b.w*2;slice.height=b.h*2;const sc=slice.getContext('2d');sc.imageSmoothingEnabled=false;
      sc.save();sc.beginPath();sc.rect(Math.max(0,left-b.x)*2,0,Math.min(b.w,right-b.x)*2-Math.max(0,left-b.x)*2,b.h*2);sc.clip();sc.drawImage(cv,(x0-b.x)*2,(y0-b.y)*2);sc.restore();slices.set(m,{cv:slice,b});
    }
    const result={slices,members:g.members.length};info.cache.set(key,result);while(info.cache.size>128)info.cache.delete(info.cache.keys().next().value);return result;
  }
  info.compose=members=>{const g={members:members.slice().sort((a,b)=>a.x-b.x)};return paintGroup(g,typeof mtCapLevel==='function'?mtCapLevel():0);};
  const oldMountain=drawMountain;
  drawMountain=function(c,m){scan();const g=lookup.get(m)||{members:[m]};const level=typeof mtCapLevel==='function'?mtCapLevel():0;
    const entry=paintGroup(g,level).slices.get(m);if(!entry)return oldMountain(c,m);
    c.save();c.imageSmoothingEnabled=R.smooth;c.drawImage(entry.cv,entry.b.x,entry.b.y,entry.b.w,entry.b.h);c.restore();
  };
  // Rebuild only visual lookup when native mining/disaster code rebuilds mountains.
  const oldBuild=buildMountains;buildMountains=function(...args){const result=oldBuild.apply(this,args);source=null;return result;};
  function stone(v,mode){const key=v+':'+mode;if(info.stoneCache.has(key))return info.stoneCache.get(key);
    const cv=document.createElement('canvas');cv.width=52;cv.height=40;const c=cv.getContext('2d');c.scale(2,2);const p=rockPalette(v),dx=v%2;
    polygon(c,[[2,12],[5+dx,6],[11,3],[18,4],[23,10],[24,15],[19,18],[7,18],[2,15]],p[0]);
    polygon(c,[[3,12],[6+dx,7],[11,4],[18,5],[21,10],[15,12],[7,15]],p[3]);
    polygon(c,[[7,15],[15,12],[21,10],[23,14],[18,17],[8,17]],p[1]);
    polygon(c,[[11,5],[15,6],[15,12],[10,14],[7,13]],p[2]);
    c.fillStyle=p[4];c.fillRect(7,6,4,1);c.fillRect(5,8,2,1);c.fillStyle=p[0];c.fillRect(15,8,1,4);c.fillRect(16,11,3,1);
    if(mode==='win'){polygon(c,[[5,7],[11,3],[18,4],[21,8],[15,7],[11,9],[8,8]],'#dce5d5');c.fillStyle='#f2efd8';c.fillRect(9,5,7,1);}else{c.fillStyle='#64744b';c.fillRect(4,14,4,2);c.fillStyle='#94a366';c.fillRect(4,14,3,1);}
    info.stoneCache.set(key,cv);return cv;
  }
  const oldStone=drawStoneObj;
  drawStoneObj=function(c,x,y,o,i){
    if(!o||!Number.isFinite(o.n))return oldStone(c,x,y,o,i);
    const k=Math.max(1,Math.ceil(o.n/1.6)),offs=[[3,12],[12,4],[14,14],[0,2],[8,8],[16,22]],mode=typeof seaVisMode==='function'?seaVisMode():'base';
    c.save();c.imageSmoothingEnabled=R.smooth;
    for(let j=Math.min(k,offs.length)-1;j>=0;j--){const [ox,oy]=offs[j],px=x*TILE+ox-4,py=y*TILE+oy-6;c.fillStyle='rgba(0,0,0,0.3)';c.beginPath();c.ellipse(px+16,py+17,11,4,0,0,7);c.fill();c.drawImage(stone((i+j)%4,mode),px,py,26,20);}
    c.restore();
  };
})();
