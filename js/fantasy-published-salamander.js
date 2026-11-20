/* Browser artwork for the approved salamander. Install after the native fairy renderer. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' ||
      typeof URL === 'undefined' || typeof Image === 'undefined') return;
  const scriptSource = document.currentScript?.src;
  if (!scriptSource) return;
  const base = new URL('../assets/', scriptSource);
  const errors = [];
  const api = window.FantasySalamander = {ready:false, errors};
  const marker = {};
  const nativeScale = .9;
  let active;
  const canvas = (w,h) => Object.assign(document.createElement('canvas'), {width:w,height:h});
  async function load(file) {
    const img = new Image(); img.src = new URL(file,base); await img.decode(); return img;
  }
  function bake(entry) {
    const [x,y,w,h]=entry.dest.map(n=>Math.round(n*nativeScale*2)/2);
    const img=canvas(w*2,h*2),c=img.getContext('2d');
    c.imageSmoothingEnabled=false;
    c.drawImage(entry.img,...entry.source,0,0,img.width,img.height);
    return {img,source:[0,0,img.width,img.height],dest:[x,y,w,h]};
  }
  function cleanFragments(img) {
    const {width,height}=img,c=img.getContext('2d');
    const pixels=c.getImageData(0,0,width,height),a=pixels.data;
    const seen=new Uint8Array(width*height), groups=[];
    for(let i=0;i<seen.length;i++){
      if(seen[i]||!a[i*4+3])continue;
      const group=[i];seen[i]=1;
      for(let j=0;j<group.length;j++){
        const x=group[j]%width,y=Math.floor(group[j]/width);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const nx=x+dx,ny=y+dy,n=ny*width+nx;
          if(nx<0||nx>=width||ny<0||ny>=height||seen[n]||!a[n*4+3])continue;
          seen[n]=1;group.push(n);
        }
      }
      groups.push(group);
    }
    const threshold=Math.max(...groups.map(g=>g.length))*.05;
    for(const group of groups)if(group.length<threshold)for(const n of group)a[n*4+3]=0;
    c.putImageData(pixels,0,0);
  }
  // Animate the raised, open-mouth pose on the half-pixel grid. The lower
  // ten raster rows stay rigid so the toes keep their authored contacts.
  function salamanderWork(entry,view) {
    const {img}=entry, {width,height}=img;
    const pixels=img.getContext('2d').getImageData(0,0,width,height);
    const lock=height-10;
    return Array.from({length:12},(_,phase)=>{
      const angle=phase*Math.PI/6;
      const out=canvas(width,height),ctx=out.getContext('2d');
      const pose=ctx.createImageData(width,height);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const side=view===0||view===4?0:Math.max(-1,Math.min(1,(x-width/2)/28));
        const breath=1.5*Math.sin(angle)+side*1.1*Math.cos(angle);
        const weight=Math.max(0,Math.min(1,(lock-y)/25));
        const sourceY=y+Math.round(breath*weight);
        if(sourceY<0||sourceY>=height)continue;
        const from=(sourceY*width+x)*4,to=(y*width+x)*4;
        pose.data.set(pixels.data.subarray(from,from+4),to);
      }
      ctx.putImageData(pose,0,0);
      return {...entry,img:out};
    });
  }
  function salamanderFrames(img) {
    const clean = canvas(img.width,img.height), ctx = clean.getContext('2d');
    ctx.drawImage(img,0,0);
    const im = ctx.getImageData(0,0,img.width,img.height), a = im.data;
    for (let i=3;i<a.length;i+=4) a[i]=a[i]>=160?255:0;
    ctx.putImageData(im,0,0);
    const cuts=[0,350,697,1024];
    const cells=cuts.slice(0,-1).map((top,r)=>Array.from({length:5},(_,v)=>{
      let l=img.width,t=img.height,b=-1,d=-1;
      for(let y=top;y<cuts[r+1];y++)for(let x=Math.round(v*img.width/5);x<Math.round((v+1)*img.width/5);x++){
        if(!a[(y*img.width+x)*4+3])continue;
        l=Math.min(l,x);t=Math.min(t,y);b=Math.max(b,x);d=Math.max(d,y);
      }
      if(b<l)throw Error('Empty salamander atlas cell');
      return [l,t,b-l+1,d-t+1];
    }));
    const [, ,profileWidth,profileHeight]=cells[0][2];
    // Match the native east silhouette, using one calibration for every angle.
    const sx=120/profileWidth, sy=48/profileHeight;
    return cells.map((row,r)=>row.map(([x,y,w,h],v)=>{
      const out=canvas(160,96), c=out.getContext('2d');
      const dw=Math.round(w*sx),dh=Math.round(h*sy);
      if(dw>160||dh>94)throw Error('Salamander art exceeds sprite reserve');
      c.imageSmoothingEnabled=false;
      if(r===2&&v===3){c.translate(160,0);c.scale(-1,1);}
      c.drawImage(clean,x,y,w,h,Math.round((160-dw)/2),94-dh,dw,dh);
      return {img:out,source:[0,0,160,96],dest:[-40,-47,80,48]};
    }));
  }
  function wrap(original, context) {
    return function(list,c,F,...bounds) {
      const start=list.length;
      original.call(this,list,c,F,...bounds);
      const entries=context(F,bounds);
      for(let i=start;i<list.length;i++) {
        const draw=list[i][1], scope=entries[i-start];
        list[i][1]=()=>{const prior=active;active=scope;try{return draw();}finally{active=prior;}};
      }
    };
  }
  api.readyPromise=load('fantasy/magicbeasts/salamander.png').then(salImage=>{
    const sal=salamanderFrames(salImage).map(row=>row.map(entry=>{
      const sprite=bake(entry);
      cleanFragments(sprite.img);
      // Restore the native profile center and ground contact after quantization.
      sprite.dest[0]-=2;
      sprite.dest[1]+=.5;
      return sprite;
    }));
    const salWork=sal[1].map(salamanderWork);
    const oldBlit=fyBlit,oldSal=sprSalamander;
    const view=[0,1,2,3,4,3,2,1];
    function frame(dir,fr) {
      const v=view[dir];
      const entry=fr<30?sal[0][v]:salWork[v][fr-30];
      return {...entry,marker,mirror:dir>4};
    }
    api.frame=frame;
    fyBlit=function(c,spr,x,y,face,alpha=1,scale=1) {
      if(spr?.marker!==marker)return oldBlit.apply(this,arguments);
      c.save();c.globalAlpha=alpha;c.imageSmoothingEnabled=false;
      c.translate(Math.round(x),Math.round(y));
      const factor=scale/nativeScale;
      c.scale(spr.mirror?-factor:factor,factor);
      c.drawImage(spr.img,...spr.source,...spr.dest);c.restore();
    };
    sprSalamander=function(fr){return active?.kind==='sal'?frame(active.dir,fr):oldSal(fr);};
    salamanderDraw=wrap(salamanderDraw,(F,bounds)=>F.sal.flatMap(s=>{
      const b=fyBuilding(s.bid);
      return b&&FY_SEE(b.doorX,b.doorY,...bounds)?[{kind:'sal',dir:b.rot===2?2:6}]:[];
    }));
    api.ready=true;return true;
  }).catch(error=>{errors.push(String(error));return false;});
})();
