'use strict';
// Presentation-only ground finish for the current biome/ocean terrain painter.
// Native bands, lazy restore, seasons, ocean, map cells and road caches stay native.
(() => {
  if (window.FantasyPublishedGround) return;
  const finished = new WeakMap();
  let generation=-1, baked=new Set(), shore=new Map();
  const info = window.FantasyPublishedGround = {version:1,bands:0,pixels:0,finished};
  // Carry the approved old village's warm sand and restrained shoreline foam into
  // native biome palettes. Winter keeps its snow/ice ramp; coastal ocean survives.
  for (const [kind,p] of Object.entries(BIOME_PAL)) {
    if (kind === 'winter') continue;
    const amount = kind === 'meadow' || kind === 'coast' ? .7 : .22;
    p.sand = p.sand.map((v,i)=>Math.round(v*(1-amount)+[183,166,119][i]*amount));
    p.foamK *= .55;
  }
  function finish(b,bi,fresh=false) {
    if (!b || !b.cv.width || finished.get(b.cv)===TERR.gen) return;
    if(generation!==TERR.gen){generation=TERR.gen;baked=new Set();shore=new Map();}
    if(!fresh&&baked.has(bi)){finished.set(b.cv,TERR.gen);return;}
    const cv=b.cv,c=cv.getContext('2d',{willReadFrequently:true}),im=c.getImageData(0,0,cv.width,cv.height),d=im.data;
    let n=0,wet=0;
    const width=cv.width, snow=biomePal().snow;
    function nearby(tx,ty){const key=idx(tx,ty);if(shore.has(key))return shore.get(key);const out=[];for(let yy=ty-1;yy<=ty+1;yy++)for(let xx=tx-1;xx<=tx+1;xx++)if(inb(xx,yy)&&World.terrain[idx(xx,yy)]===T_WATER)out.push([xx*TILE,yy*TILE]);shore.set(key,out);return out;}
    // Compress the old electric green ramp into quiet moss/fern colours. Keep
    // native biome patches, flowers, rock, ocean water and snow recognisable.
    for(let i=0;i<d.length;i+=4) {
      const r=d[i],g=d[i+1],bl=d[i+2];
      if(g>r*1.13 && g>bl*1.18 && g>42 && bl<145) {
        d[i]=Math.round((r*.72+13)/6)*6;
        d[i+1]=Math.round((g*.72+20)/6)*6;
        d[i+2]=Math.round((bl*.72+13)/6)*6;n++;
      } else if(!snow&&r>g*1.04&&g>bl*1.16&&r>100&&r<236){
        // Damp sand follows the real shoreline and fades inland. It uses only
        // the painted beach ramp; geography and water/ecology arrays are read-only.
        const px=(i/4)%width,py=Math.floor(i/4/width)+b.y0,tx=Math.floor(px/TILE),ty=Math.floor(py/TILE);
        let dist=1e9;for(const [wx,wy]of nearby(tx,ty)){const dx=Math.max(wx-px,0,px-wx-TILE),dy=Math.max(wy-py,0,py-wy-TILE);dist=Math.min(dist,Math.hypot(dx,dy));}
        const amount=(1-smoothstep(0,22,dist))*.26;
        if(amount>0){d[i]=Math.round((r+(139-r)*amount)/6)*6;d[i+1]=Math.round((g+(128-g)*amount)/6)*6;d[i+2]=Math.round((bl+(94-bl)*amount)/6)*6;wet++;}
      }
    }
    info.shorePixels=(info.shorePixels||0)+wet;
    if(n||wet)c.putImageData(im,0,0);
    finished.set(cv,TERR.gen);baked.add(bi);info.bands++;info.pixels+=n;
  }
  const done=terrBandDone;
  terrBandDone=function(j,bi){const result=done(j,bi);finish(TERR.bands[bi],bi,true);return result;};
  // Compressed PNG restore bypasses terrBandDone; a restored canvas is new and
  // finishes once here. This also supports injecting the art into an open game.
  const draw=terrDraw;
  terrDraw=function(c,cam,vw,vh){
    const bh=TBAND*TILE,a=Math.max(0,Math.floor(cam.y/bh)-1),z=Math.min(TERR.bands.length-1,Math.ceil((cam.y+vh)/bh)+1);
    for(let i=a;i<=z;i++)finish(TERR.bands[i],i);
    return draw(c,cam,vw,vh);
  };
})();

// 0.12 ground-cover pass. World terrain/resources/biome assignment are read-only.
(() => {
  if(window.FantasyGroundCover)return;
  const info=window.FantasyGroundCover={version:1,palettes:new Map(),shrubs:new Map(),bands:0,drawn:0};
  function palette(){
    const key=MapOpt.biome;if(info.palettes.has(key))return info.palettes.get(key);
    const p=biomePal(),snow=!!p.snow,center=key==='meadow'?p.g0.map((v,i)=>(v+p.g1[i])*.25+[78,121,65][i]*.5):p.g0.map((v,i)=>(v+p.g1[i])*.5);
    const colors=[];
    for(let soil=0;soil<4;soil++)for(let tone=0;tone<6;tone++){
      const amount=snow?0:soil/3*.85;
      const rgb=center.map((v,i)=>Math.round(v+(tone-2)*5+((key==='meadow'?p.dirt[i]*.5+[124,104,73][i]*.5:p.dirt[i])-v)*amount));
      const hex='#'+rgb.map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');colors.push(gsHexIdx(hex));
    }
    info.palettes.set(key,colors);return colors;
  }
  const nativeBase=gsBaseGen;
  gsBaseGen=function*(st){
    yield* nativeBase(st);
    if(st.biomeKind!=='world'||biomePal().snow)return;
    const {W,H,ox,oy,seed}=st,colors=palette(),col=new Uint16Array(W*H);
    // Coarse continuous colour fields, sampled into small pixel clusters.
    // Native K/B classification is retained for ecology and the variant catalogue.
    const G=16,gw=Math.ceil(W/G)+2,gh=Math.ceil(H/G)+2,field=new Float32Array(gw*gh),soil=new Float32Array(gw*gh),detail=new Float32Array(gw*gh);
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
      const wx=ox+x*G,wy=oy+y*G,i=y*gw+x;
      field[i]=gsVNW(wx,wy,135,seed+517)*.78+gsVNW(wx,wy,42,seed+518)*.22;
      soil[i]=gsVNW(wx,wy,115,seed+619)*.85+gsVNW(wx,wy,27,seed+620)*.15;detail[i]=gsVNW(wx,wy,18,seed+751);
    }
    const sample=(a,x,y)=>{const ix=x>>4,iy=y>>4,fx=(x&15)/16,fy=(y&15)/16,i=iy*gw+ix;return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+gw]*(1-fx)+a[i+gw+1]*fx)*fy;};
    for(let y=0;y<H;y+=2){
      for(let x=0;x<W;x+=2){
        const tone=Math.max(0,Math.min(5,Math.floor(1+(sample(field,x,y)-.3)*9+(sample(detail,x,y)-.5)*2.8))),earth=Math.min(3,Math.floor(smoothstep(.61,.77,sample(soil,x,y))*3.999));
        const color=colors[earth*6+tone];
        for(let dy=0;dy<2&&y+dy<H;dy++)for(let dx=0;dx<2&&x+dx<W;dx++)col[(y+dy)*W+x+dx]=color;
      }
      yield;
    }
    st.col=col;info.bands++;
  };
  const nativeDecor=gsDecorGen;
  gsDecorGen=function*(st,D,x0,x1,y0,y1,tileOk){
    if(st.biomeKind!=='world'){yield* nativeDecor(st,D,x0,x1,y0,y1,tileOk);return;}
    // Keep native flowers/ferns/pebbles as sparse accents, preserving their brushes.
    yield* nativeDecor(st,D,x0,x1,y0,y1,(x,y)=>(!tileOk||tileOk(x,y))&&(hash(idx(x,y)+917)%5===0));
    // Tiny coherent grass blades give the broad pigment fields material and scale.
    const put=(x,y,delta)=>{if(x<0||y<0||x>=st.W||y>=st.H||st.mask&&!st.mask[y*st.W+x])return;const o=(y*st.W+x)*4;if(D[o+3]!==255)return;D[o]=Math.max(0,Math.min(255,D[o]+delta*.7));D[o+1]=Math.max(0,Math.min(255,D[o+1]+delta));D[o+2]=Math.max(0,Math.min(255,D[o+2]+delta*.5));};
    for(let ty=y0;ty<=y1;ty++){for(let tx=x0;tx<=x1;tx++){
      const h=hash(idx(tx,ty)+3121);if(h%3||tileOk&&!tileOk(tx,ty))continue;
      const x=tx*TILE-st.ox+5+((h>>>7)%20),y=ty*TILE-st.oy+9+((h>>>13)%17);
      put(x,y,5);put(x+1,y-1,8);put(x+2,y-2,9);put(x-1,y-2,7);put(x,y+1,-7);put(x+1,y+1,-5);
    }yield;}

  };
  function shrub(mode,variant,frame){
    const key=mode+':'+variant+':'+frame;if(info.shrubs.has(key))return info.shrubs.get(key);
    const cv=document.createElement('canvas');cv.width=56;cv.height=40;const c=cv.getContext('2d');c.scale(2,2);c.imageSmoothingEnabled=false;
    const pal=mode==='au2'?['#493c25','#775630','#ac7739','#cf9b4b','#e1bc70']:mode==='au1'?['#36432b','#5e7035','#899a46','#afaf56','#c9c278']:mode==='win'?['#344437','#526958','#8ca38d','#cbd8c7','#edeed6']:['#2d432c','#46643a','#648346','#8fa758','#b9c879'];
    const wind=[0,.5,0,-.5][frame],rect=(x,y,w,h,k)=>{c.fillStyle=pal[k];c.fillRect(x,y,w,h);};
    // Root and branch anchors never move. Only upper leaf tips shift half a world px.
    rect(10,16,9,1,0);rect(12,12,2,4,0);rect(17,11,1,5,0);
    const lobes=variant===1?[[8,12,5,4],[17,9,6,6],[23,13,4,3]]:variant===2?[[6,13,4,3],[12,10,5,5],[20,12,6,4]]:[[7,12,5,4],[14,9,6,6],[22,12,5,4]];
    for(const [cx,cy,rx,ry]of lobes){for(let y=-ry;y<=ry;y++){
      const span=Math.floor(Math.sqrt(Math.max(0,1-y*y/(ry*ry)))*rx),x=cx-span+(y<0?wind:0);
      rect(x,cy+y,span*2+1,1,0);if(span>1)rect(x+1,cy+y,span*2-1,1,y>ry*.4?1:2);
      if(y<1&&span>2)rect(x+1,cy+y,Math.max(1,span),1,3);if(y<-ry*.35&&span>2)rect(x+2,cy+y,Math.max(1,span-2),1,4);
    }}
    rect(6+wind,10,3,1,3);rect(12+wind,6,3,1,4);rect(18+wind,10,3,1,3);rect(23,13,2,1,1);
    if(variant===1&&mode!=='win'){c.fillStyle=mode==='au2'?'#caa15b':'#b78a67';c.fillRect(18,9,1,1);c.fillRect(15,12,1,1);}
    info.shrubs.set(key,cv);return cv;
  }
  info.sprite=shrub;
  const nativeDraw=drawWaterSparkles;
  drawWaterSparkles=function(c,left,top,right,bottom){
    nativeDraw(c,left,top,right,bottom);
    const cam={x:left*TILE,y:top*TILE},vw=(right-left+1)*TILE,vh=(bottom-top+1)*TILE;
    const mode=typeof seaVisMode==='function'?seaVisMode():'base',density=MapOpt.biome==='forest'?13:23;
    const x0=Math.max(1,Math.floor(cam.x/TILE)-1),x1=Math.min(MAP_W-2,Math.ceil((cam.x+vw)/TILE)),y0=Math.max(1,Math.floor(cam.y/TILE)-1),y1=Math.min(MAP_H-2,Math.ceil((cam.y+vh)/TILE));
    let drawn=0;c.save();c.imageSmoothingEnabled=R.smooth;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=idx(x,y),h=hash(i+743);if(h%density!==0||World.terrain[i]!==T_GRASS||World.road[i]||World.bmap[i]||World.obj[i])continue;
      if(DIRS.some(([dx,dy])=>World.road[idx(x+dx,y+dy)]))continue;
      const px=x*TILE+2+((h>>>7)&3),py=y*TILE+10+((h>>>11)&3),frame=(Math.floor(Game.time*.7)+(h>>>13))&3;
      c.fillStyle='rgba(24,39,21,.18)';c.fillRect(px+4,py+16,19,2);c.drawImage(shrub(mode,(h>>>5)%3,frame),px,py,28,20);drawn++;
    }
    c.restore();info.drawn=drawn;
  };
})();

// New hand-clustered ground carpet. Replaces the previous flat field/soil finish.
(() => {
  const marks=new WeakMap();let generation=-1,baked=new Set();
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  function material(b,bi,fresh=false){
    if(!b||!b.cv.width||marks.get(b.cv)===TERR.gen)return;
    if(generation!==TERR.gen){generation=TERR.gen;baked=new Set();}
    if(!fresh&&baked.has(bi)){marks.set(b.cv,TERR.gen);return;}
    const cv=b.cv,w=cv.width,H=cv.height,c=cv.getContext('2d',{willReadFrequently:true});
    if(biomePal().snow){marks.set(cv,TERR.gen);baked.add(bi);return;}
    const im=c.getImageData(0,0,w,H),d=im.data,seed=Game.seed|0;
    const themes={meadow:[73,109,57],forest:[49,83,44],steppe:[142,132,78],mountain:[82,98,66],swamp:[57,77,47],coast:[78,115,60]};
    const center=themes[MapOpt.biome]||themes.meadow;
    const G=8,gw=Math.ceil(w/G)+2,gh=Math.ceil(H/G)+2,field=new Float32Array(gw*gh);
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++)field[y*gw+x]=(gsVNW(x*G,y*G+b.y0,19,seed+713)-.5)*7+(gsVNW(x*G,y*G+b.y0,85,seed+907)-.5)*4;
    function pigment(x,y){const ix=x>>3,iy=y>>3,fx=(x&7)/8,fy=(y&7)/8,i=iy*gw+ix;return (field[i]*(1-fx)+field[i+1]*fx)*(1-fy)+(field[i+gw]*(1-fx)+field[i+gw+1]*fx)*fy;}
    const alpha=new Uint8Array(w*H);
    // The cell map is read-only. Native coast/rock blends survive at their borders.
    for(let y=0;y<H;y++)for(let x=0;x<w;x++){
      const wy=y+b.y0,tx=x>>5,ty=wy>>5,i=idx(tx,ty);if(World.terrain[i]!==T_GRASS)continue;
      let a=1;const px=x&31,py=wy&31;
      if(ty>0&&World.terrain[i-MAP_W]!==T_GRASS)a=Math.min(a,smoothstep(1,13,py));
      if(ty<MAP_H-1&&World.terrain[i+MAP_W]!==T_GRASS)a=Math.min(a,smoothstep(1,13,31-py));
      if(tx>0&&World.terrain[i-1]!==T_GRASS)a=Math.min(a,smoothstep(1,13,px));
      if(tx<MAP_W-1&&World.terrain[i+1]!==T_GRASS)a=Math.min(a,smoothstep(1,13,31-px));
      alpha[y*w+x]=Math.round(a*255);if(!a)continue;
      const tone=pigment(x&~1,y&~1),o=(y*w+x)*4;
      for(let q=0;q<3;q++){const v=center[q]+tone*(q===1?1:.7);d[o+q]=clamp(d[o+q]*(1-a)+v*a);}
    }
    const ink=(x,y,rgb)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=w||y>=H)return;const a=alpha[y*w+x]/255;if(a<.9)return;const o=(y*w+x)*4;for(let q=0;q<3;q++)d[o+q]=clamp(d[o+q]*(1-a)+rgb[q]*a);};
    const shift=(base,r,g,b)=>[base[0]+r,base[1]+g,base[2]+b];
    // Every tile has its own deterministic brush seed; borders do not repeat.
    for(let ty=Math.max(0,Math.floor(b.y0/TILE)-1);ty<=Math.min(MAP_H-1,Math.floor((b.y0+H)/TILE));ty++)for(let tx=0;tx<MAP_W;tx++){
      const i=idx(tx,ty);if(World.terrain[i]!==T_GRASS)continue;
      const r=mulberry32((hash(i+seed)^0x6e31)>>>0),ox=tx*TILE,oy=ty*TILE-b.y0;
      const base=shift(center,pigment(ox+15,Math.max(0,Math.min(H-1,oy+16)))*.7,pigment(ox+15,Math.max(0,Math.min(H-1,oy+16))),0);
      // Small pockets of real-looking earth, rather than broad noise blotches.
      if(r()<.09){
        const cx=ox+9+r()*14,cy=oy+11+r()*13,rx=4+r()*4,ry=2+r()*2;
        const soil=MapOpt.biome==='swamp'?[87,81,55]:[123,100,70];
        for(let y=-Math.ceil(ry);y<=ry;y++){
          const span=Math.floor(Math.sqrt(Math.max(0,1-y*y/(ry*ry)))*rx);
          for(let x=-span;x<=span;x++){
            const shadow=y<-ry*.35,edge=Math.abs(x)>=span-1;
            ink(cx+x,cy+y,shadow?shift(soil,-13,-13,-9):edge?shift(soil,-5,-4,-3):y>0?shift(soil,5,4,2):soil);
          }
        }
        if(rx>5){
          ink(cx-1,cy,shift(soil,15,13,8));ink(cx,cy,shift(soil,7,6,3));ink(cx,cy+1,shift(soil,-13,-12,-8));
          ink(cx+2,cy-1,shift(soil,-12,-10,-7));ink(cx+3,cy,shift(soil,-10,-9,-6));ink(cx+4,cy,shift(soil,9,7,4));
        }
        for(let k=0;k<3;k++){const x=cx-rx+1+k*rx*.8;ink(x,cy+ry,shift(base,-8,-10,-4));ink(x+1,cy+ry-1,shift(base,11,15,5));}
      }
      // Layered 3–7 px leaf clusters: dark contact, body, warm upper-left tips.
      const count=5+(r()*4|0);
      for(let k=0;k<count;k++){
        const x=ox+3+r()*25,y=oy+4+r()*25;
        const dark=shift(base,-10,-13,-6),mid=shift(base,3,5,1),light=shift(base,14,20,7);
        const kind=r()*4|0;
        if(kind===0){
          ink(x-2,y+1,dark);ink(x-1,y+1,dark);ink(x,y+1,dark);ink(x+1,y+1,dark);
          ink(x-2,y,mid);ink(x-1,y-1,mid);ink(x,y,mid);ink(x+1,y-1,mid);ink(x+2,y,mid);
          ink(x-2,y-1,light);ink(x,y-2,light);ink(x+1,y-2,shift(base,9,14,5));
        }else if(kind===1){
          for(let dx=-2;dx<=2;dx++){ink(x+dx,y+1,dark);ink(x+dx,y,mid);}
          ink(x-2,y-1,shift(base,8,11,4));ink(x-1,y-1,shift(base,9,13,5));ink(x,y-1,mid);ink(x+2,y-1,mid);
          ink(x-1,y-2,shift(base,12,16,6));
        }else if(kind===2){
          ink(x-2,y,dark);ink(x-1,y+1,dark);ink(x,y+1,dark);ink(x+1,y,mid);ink(x+2,y-1,mid);ink(x+3,y-1,light);
          ink(x,y,mid);ink(x-1,y-1,mid);ink(x-2,y-2,light);ink(x,y-2,shift(base,9,14,5));
        }else{
          ink(x,y+1,dark);ink(x+1,y+1,dark);ink(x,y,mid);ink(x-1,y-1,mid);ink(x-2,y-1,light);
          ink(x+1,y-1,shift(base,9,14,5));ink(x+2,y-1,mid);ink(x,y-2,mid);
        }
      }
      // Soft storybook undergrowth: clustered clover, moss and rare tiny blossoms.
      const detail=mulberry32((hash(i+seed)^0x39a1)>>>0);
      const accents=2+(detail()*3|0);
      for(let k=0;k<accents;k++){
        const x=ox+5+detail()*21,y=oy+5+detail()*22,kind=detail()*4|0;
        const shadow=shift(base,-9,-12,-4),leaf=shift(base,7,12,5),tip=shift(base,17,22,10);
        if(kind===0){
          ink(x,y+1,shadow);ink(x+1,y+1,shadow);ink(x,y,leaf);
          ink(x-1,y-1,tip);ink(x-2,y-1,leaf);ink(x,y-2,tip);ink(x+1,y-1,leaf);ink(x+2,y-1,tip);
        }else if(kind===1){
          for(let dx=-2;dx<=2;dx++){ink(x+dx,y+1,shadow);ink(x+dx,y,leaf);}
          ink(x-1,y-1,tip);ink(x,y-1,leaf);ink(x+1,y-1,tip);ink(x-2,y,shift(base,12,16,8));
        }else if(kind===2){
          // A bent fern tip; quiet enough to sit under walking feet.
          ink(x,y+1,shadow);ink(x,y,leaf);ink(x,y-1,leaf);ink(x+1,y-2,tip);ink(x+2,y-2,leaf);
          ink(x-1,y,tip);ink(x+1,y-1,leaf);ink(x-1,y-2,leaf);
        }else{
          // Fallen seed husks are warm muted notes, never bright random flecks.
          ink(x,y+1,shadow);ink(x-1,y,shift(base,19,11,3));ink(x,y-1,shift(base,28,19,8));ink(x+1,y,shift(base,12,8,2));
        }
      }
      if(detail()<.09&&MapOpt.biome!=='steppe'){
        const x=ox+6+detail()*20,y=oy+7+detail()*19;
        for(const [dx,dy,tint]of [[0,0,0],[4,1,-9],[7,-1,5]]){
          ink(x+dx,y+dy+1,shift(base,-8,-10,-3));ink(x+dx,y+dy,shift(base,1,6,1));
          ink(x+dx-1,y+dy-2,[152+tint,140+tint,164+tint]);ink(x+dx+1,y+dy-2,[170+tint,154+tint,177+tint]);
          ink(x+dx,y+dy-3,[179+tint,163+tint,184+tint]);ink(x+dx,y+dy-2,[223,207,151]);
        }
      }
      // Rare little seed/flower heads are grouped accents, not confetti.
      if(r()<.055){const x=ox+5+r()*21,y=oy+6+r()*21;ink(x,y+1,shift(base,-9,-9,-4));ink(x,y,[205,195,129]);ink(x-1,y-1,[227,218,166]);ink(x,y-1,[238,226,174]);}
    }
    c.putImageData(im,0,0);
    if(TERR.mini&&TERR.mini.width){
      TERR.mini.getContext('2d').drawImage(cv,0,b.y0/TILE*3,MAP_W*3,H/TILE*3);
    }
    marks.set(cv,TERR.gen);baked.add(bi);
  }
  const done=terrBandDone;terrBandDone=function(j,bi){const result=done(j,bi);material(TERR.bands[bi],bi,true);return result;};
  const draw=terrDraw;terrDraw=function(c,cam,vw,vh){const bh=TBAND*TILE;for(let i=Math.max(0,Math.floor(cam.y/bh)-1);i<=Math.min(TERR.bands.length-1,Math.ceil((cam.y+vh)/bh)+1);i++)material(TERR.bands[i],i);return draw(c,cam,vw,vh);};
})();
