'use strict';
(() => {
  if(typeof URL==='undefined'||typeof BoarDirections==='undefined'||!document.currentScript?.src)return;
  const bank = BoarDirections;
  const native = bank.frame;
  const previous = naFrame;
  const views = ['S','SE','E','NE','N'];
  const viewOf = {SW:'SE',W:'E',NW:'NE'};
  const art = new Map(), cache = new Map();
  const keys = [...new Set(bank.states())];
  const known = new Set(keys);
  const root = new URL('../assets/fantasy/boar-guard/',document.currentScript.src);
  const errors = [];
  const beds = new Map();
  let active = 'E', ready = false;
  const residentImages = views.map(view => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      if(img.naturalWidth===168 && img.naturalHeight===120) art.set(view,img);
      else errors.push(view+': unexpected dimensions');
      resolve();
    };
    img.onerror = () => { errors.push(view+': missing raster');resolve(); };
    img.src = new URL('boar-guard-'+view+'-i0-2x.png',root).href;
  }));
  const bedImages = ['0','1','d'].map(phase => new Promise(resolve => {
    const img=new Image();
    img.onload=()=>{
      if(img.naturalWidth===412&&img.naturalHeight===268){
        const cv=mkCanvas(412,268);
        cv.getContext('2d').drawImage(img,0,0);
        cv.fine=2;
        beds.set(phase,{cv,w:206,h:134,ax:82,ay:106});
      }else errors.push('bed '+phase+': unexpected dimensions');
      resolve();
    };
    img.onerror=()=>{errors.push('bed '+phase+': missing raster');resolve();};
    img.src=new URL('boar-bed-v7-'+phase+'-transparent-2x.png',root).href;
  }));
  const readyPromise=Promise.all([...residentImages,...bedImages]).then(()=>ready=errors.length===0);
  const oldBed=naLairSprite;
  naLairSprite=(kind,phase='0')=>kind==='boar'&&ready&&beds.has(phase)?beds.get(phase):oldBed(kind,phase);

  function frame(key,heading='E'){
    if(!ready || !known.has(key)) return native(key,heading);
    const view=viewOf[heading]||heading, raster=art.get(view);
    if(!raster) return native(key,heading);
    const id=view+'|'+key;
    if(cache.has(id)) return {...cache.get(id),mirror:Object.hasOwn(viewOf,heading)};
    if(R.inFrame&&spriteDefer('boar-v8:'+id,()=>frame(key,view))){
      const idle=cache.get(view+'|i0');
      if(idle)return {...idle,mirror:Object.hasOwn(viewOf,heading)};
    }
    const base=native(key,heading), p=naPose(key);
    const cv=document.createElement('canvas');
    cv.width=168;cv.height=120;cv.fine=2;cv.fantasyBoarDirections=true;
    const c=cv.getContext('2d',{willReadFrequently:true});
    c.imageSmoothingEnabled=false;
    if(key==='i0') c.drawImage(raster,0,0);
    else {
      const scale=NA_SPEC.boar.sc||1;
      c.save();c.translate(base.ax*2,base.ay*2);c.scale(scale,scale);
      c.translate(p.x*2,p.y*2);
      if(p.up>.5){c.translate(-20,0);c.rotate(-.38*p.up);c.translate(20,0);}
      c.rotate(p.dead?0:p.rot*.4);
      if(p.dead){c.translate(0,-26);c.scale(1,-1);c.translate(0,26);}
      c.scale(1,p.sq);
      c.scale(1/scale,1/scale);
      const step=p.leg||0;
      const diagonal=view==='SE'||view==='NE';
      for(let y=0;y<120;y++){
        const weight=Math.max(0,Math.min(1,(y-76)/22));
        const split=diagonal?(view==='SE'?78:90):84;
        for(const [start,end,side] of [[0,split,-1],[split,168,1]]){
          const depth=diagonal && side===(view==='SE'?-1:1)?.55:1;
          const shift=Math.round(step*weight*4*side*depth);
          const lift=Math.round(Math.max(0,step*side)*weight*3*depth);
          c.drawImage(raster,start,y,end-start,1,start-base.ax*2+shift,y-base.ay*2-lift,end-start,1);
        }
      }
      c.restore();
      // Seat the visible silhouette against the native support line before fading.
      if(step || key.startsWith('d')){
        const bottom=(surface)=>{
          const {data}=surface.getContext('2d').getImageData(0,0,168,120);
          for(let y=119;y>=0;y--)for(let x=0;x<168;x++){
            if(data[(y*168+x)*4+3]>=128)return y;
          }
          return -1;
        };
        const support=bottom((p.fade>0?native('d6',heading):base).cv);
        const current=bottom(cv);
        if(current>=0 && support>=0 && current!==support){
          const pixels=c.getImageData(0,0,168,120);
          c.clearRect(0,0,168,120);
          c.putImageData(pixels,0,support-current);
        }
      }
      if(p.fade>0){
        const pixels=c.getImageData(0,0,168,120);
        for(let y=0;y<120;y++)for(let x=0;x<168;x++){
          if(naHash(x,y)<p.fade)pixels.data[(y*168+x)*4+3]=0;
        }
        c.putImageData(pixels,0,0);
      }
    }
    const result={...base,cv,view};
    cache.set(id,result);
    if(cache.size>120)cache.delete(cache.keys().next().value);
    return {...result,mirror:Object.hasOwn(viewOf,heading)};
  }
  const draw=neuDraw;
  neuDraw=function(c,actor){
    if(actor.k!=='boar')return draw(c,actor);
    const prior=active;
    active=bank.headingOf(actor);
    try{return draw(c,{...actor,face:Object.hasOwn(viewOf,active)?-1:1});}finally{active=prior;}
  };
  naFrame=(kind,key)=>kind==='boar'&&ready&&known.has(key)?frame(key,active):previous(kind,key);
  window.BoarGuardV8={readyPromise,errors,keys,frame,native,views};
  readyPromise.then(ok=>{if(ok)for(const view of views)frame('i0',view);});
})();
