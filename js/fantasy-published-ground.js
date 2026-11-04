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
