/* Marsh fauna painted from the approved original profiles and four individually
 * authored turn views. The game owns movement, native pose timers and glow. */
(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined' ||
      typeof URL === 'undefined' || !document.currentScript || window.ApprovedMarshProfile) return;
  const root = new URL('../assets/approved-marsh/',document.currentScript.src);
  const gameFrame = naFrame, gameDraw = fwDraw;
  const kinds=['newt','snail','moth'];
  const sheets=new Map(), recent=new Map(), anonymous=new WeakMap(), cache=new Map();
  const review = window.ApprovedMarshProfile = {revision:null,calls:null,errors:[]};
  let current=null;
  function heading(actor) {
    const id=actor.id??actor.__id, store=id===undefined?anonymous:recent, key=id??actor;
    const old=store.get(key);
    let dx=actor.tx-actor.x,dy=actor.ty-actor.y;
    if(old) {
      const mx=actor.x-old.x,my=actor.y-old.y,step=Math.hypot(mx,my);
      if(step>.00001&&step<4){dx=mx;dy=my;}
    }
    const dir=Number.isFinite(dx)&&Number.isFinite(dy)&&Math.hypot(dx,dy)>.00001?
      (Math.round(Math.atan2(dx,dy)/(Math.PI/4))+8)%8:old?.dir??(actor.face<0?6:2);
    if(id!==undefined&&recent.size>=1024&&!recent.has(key))recent.delete(recent.keys().next().value);
    store.set(key,{x:actor.x,y:actor.y,dir});
    return dir;
  }
  function frame(kind,pose,dir,mirror) {
    const sheet=sheets.get(kind),row=sheet?.data.frames[pose];
    if(!row)return null;
    const [sx,sy,w,h,ax,ay]=row[dir>4?8-dir:dir];
    const key=[kind,sx,sy,w,h,mirror].join('|');
    let cv=cache.get(key);
    if(!cv) {
      cv=document.createElement('canvas');cv.width=w+2;cv.height=h+2;cv.fine=2;
      const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
      if(mirror){ctx.translate(cv.width,0);ctx.scale(-1,1);}
      ctx.drawImage(sheet.image,sx,sy,w,h,1,1,w,h);
      if(cache.size>=192)cache.delete(cache.keys().next().value);
      cache.set(key,cv);
    }
    const ox=ax+.5;
    return {cv,w:cv.width/2,h:cv.height/2,ax:mirror?cv.width/2-ox:ox,ay:ay+.5};
  }
  review.preview=(kind,pose,dir)=>frame(kind,pose,dir,dir>4);
  review.ready=Promise.all(kinds.map(async kind=>{
    const image=new Image();image.src=new URL(kind+'-directions.webp',root);
    const [response]=await Promise.all([fetch(new URL(kind+'-directions.json',root)),image.decode()]);
    if(!response.ok)throw Error('Missing marsh fauna '+kind);
    const data=await response.json(),rows=Object.values(data.frames);
    if(rows.length!==42||rows.some(row=>row.length!==5||row.some(([x,y,w,h,ax,ay])=>x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight||!Number.isFinite(ax+ay))))throw Error('Invalid marsh frames '+kind);
    sheets.set(kind,{image,data});return data.master;
  })).then(masters=>{
    if(!masters.every(m=>m===masters[0]))throw Error('Different source revisions in marsh fauna');
    review.revision=masters[0];return true;
  }).catch(error=>{review.errors.push(String(error));console.error(error);return false;});
  naFrame=function(kind,pose) {
    if(current?.kind===kind) {
      const result=frame(kind,pose,current.dir,current.mirror);
      if(result){if(review.calls)review.calls[kind]=(review.calls[kind]||0)+1;return result;}
    }
    return gameFrame(kind,pose);
  };
 function drawOwnedSnail(c, W, d) {
  const x = Math.round(W.x * TILE), y = Math.round(W.y * TILE + 6);
  const angle = d * Math.PI / 4, forwardX = Math.sin(angle), forwardY = Math.cos(angle);
  const snap = n => Math.round(n * 2) / 2;
  // Keep the original 24-unit sled offset and the 12-unit harness offset.
  const point = (side, along, z=0) => [
   snap(x + side * forwardY + along * forwardX),
   snap(y + .55 * (along * forwardY - side * forwardX) - z)
  ];
  const rope = (a,b,color) => {
   const steps = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2));
   c.fillStyle=color;
   for(let i=0;i<=steps;i++) {
    const t=i/steps;
    c.fillRect(snap(a[0]+(b[0]-a[0])*t),snap(a[1]+(b[1]-a[1])*t),1,1);
   }
  };
  const plate = (left,right,back,front,z,color) => {
   const polygon=[point(left,back,z),point(right,back,z),point(right,front,z),point(left,front,z)];
   const lo=Math.min(...polygon.map(p=>p[1])), hi=Math.max(...polygon.map(p=>p[1]));
   c.fillStyle=color;
   for(let row=lo;row<hi;row+=.5){
    const scan=row+.25, hits=[];
    for(let i=0;i<4;i++){
     const a=polygon[i], b=polygon[(i+1)%4];
     if((a[1]>scan)!==(b[1]>scan))hits.push(a[0]+(b[0]-a[0])*(scan-a[1])/(b[1]-a[1]));
    }
    if(hits.length===2)c.fillRect(snap(Math.min(...hits)),row,Math.max(.5,snap(Math.abs(hits[0]-hits[1]))),.5);
   }
  };
  c.save();
  try {
   c.imageSmoothingEnabled=false;
   const harness=point(0,-12,6);
   if(W.post){
    const px=Math.round(W.post[0]*TILE), py=Math.round(W.post[1]*TILE+6);
    c.fillStyle='#4a3220';
    c.fillRect(px-1,py-7,3,8);
    rope([px,py-6],harness,'#b09060');
   }
   const sled=()=>{
    plate(-4,4,-33,-15,2,'#51371f');
    plate(-4,4,-33,-15,4,'#79512c');
    plate(-3.5,3.5,-32,-16,6,'#ae7946');
    for(let z=6.5;z<10;z+=.5)plate(-3,0,-30,-23,z,'#9b774e');
    plate(-3,0,-30,-23,10,'#d4b07a');
    for(let z=6.5;z<8;z+=.5)plate(.5,3,-26,-19,z,'#756348');
    plate(.5,3,-26,-19,8,'#a5895e');
    rope(point(0,-15,6),harness,'#c3a373');
   };
   if(forwardY>=0)sled();
   gameDraw(c,{...W,own:0});
   if(forwardY<0)sled();
   c.fillStyle='#1a1008'; c.fillRect(x-2,y-30,5,5);
   c.fillStyle='#c84a3a'; c.fillRect(x-1,y-29,3,3);
  } finally { c.restore(); }
 }
  fwDraw=function(c,actor) {
    if(!sheets.has(actor.k))return gameDraw(c,actor);
    const previous=current,dir=heading(actor);
    current={kind:actor.k,dir,mirror:(dir>4)!==(actor.face<0)};
    try{
      if(actor.k==='snail'&&actor.own)return drawOwnedSnail(c,actor,dir);
      return gameDraw(c,actor);
    }finally{current=previous;}
  };
})();