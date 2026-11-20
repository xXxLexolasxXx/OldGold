/* Approved native salamander frames, baked by tools/art/bake-salamander.cjs. */
(() => {
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined'||typeof URL==='undefined'||typeof Image==='undefined')return;
  const src=document.currentScript?.src;if(!src)return;
  const api=window.FantasySalamander={ready:false,errors:[]},marker={},nativeScale=.9;
  let active;
  const image=new Image();image.src=new URL('../assets/fantasy/magicbeasts/salamander-frames.png',src).href;
  api.readyPromise=image.decode().then(()=>{
    if(image.naturalWidth!==1872||image.naturalHeight!==86)throw Error('Unexpected salamander atlas dimensions');
    const frames=Array.from({length:13},(_,i)=>({img:image,source:[i*144,0,144,86],dest:[-38,-42,72,43],marker,mirror:false}));
    const mirrored=frames.map(f=>({...f,mirror:true}));
    function frame(dir,fr){
      if(dir!==2&&dir!==6)return null;
      const i=fr<30?0:Math.max(1,Math.min(12,fr-29));
      return(dir===6?mirrored:frames)[i];
    }
    api.frame=frame;
    const oldBlit=fyBlit,oldSal=sprSalamander,oldDraw=salamanderDraw;
    fyBlit=function(c,spr,x,y,face,alpha=1,scale=1){
      if(spr?.marker!==marker)return oldBlit.apply(this,arguments);
      c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;c.translate(Math.round(x),Math.round(y));
      const factor=scale/nativeScale;c.scale(spr.mirror?-factor:factor,factor);
      c.drawImage(spr.img,...spr.source,...spr.dest);c.restore();
    };
    sprSalamander=function(fr){return active?frame(active,fr):oldSal(fr);};
    salamanderDraw=function(list,c,F,...bounds){
      const start=list.length;oldDraw.call(this,list,c,F,...bounds);
      const entries=F.sal.flatMap(s=>{const b=fyBuilding(s.bid);return b&&FY_SEE(b.doorX,b.doorY,...bounds)?[b.rot===2?2:6]:[];});
      for(let i=start;i<list.length;i++){
        const draw=list[i][1],dir=entries[i-start];
        list[i][1]=()=>{const previous=active;active=dir;try{return draw();}finally{active=previous;}};
      }
    };
    api.ready=true;return true;
  }).catch(error=>{api.errors.push(String(error));return false;});
})();
