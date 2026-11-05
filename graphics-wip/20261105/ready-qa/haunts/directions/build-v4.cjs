const fs=require('fs'),dir=__dirname;let s=fs.readFileSync(dir+'/approved-haunts-v3.js','utf8');
function change(a,b){if(!s.includes(a))throw Error('Missing replacement '+a.slice(0,100));s=s.replace(a,b);}
change(' const nativeSprite=fzPxSprite,nativeBanArt=fzBansheeArt,cache=new Map();let down=new WeakMap(),rawMode=false;',` class PixelCache extends Map{
  constructor(maxEntries,maxBytes){super();this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.bytes=0;this.hits=0;this.misses=0;}
  cost(v){return v.width*v.height*4+(v.fzSol?.byteLength||0)+(v.hauntLive?v.hauntLive.width*v.hauntLive.height*4:0);}
  get(k){const v=super.get(k);if(v){this.hits++;super.delete(k);super.set(k,v);}return v;}
  set(k,v){this.delete(k);this.misses++;super.set(k,v);this.bytes+=this.cost(v);while(this.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.keys().next().value);return this;}
  delete(k){const v=super.get(k);if(v)this.bytes-=this.cost(v);return super.delete(k);}
  clear(){super.clear();this.bytes=0;}
 }
 const nativeSprite=fzPxSprite,nativeBanArt=fzBansheeArt,nativeLive=fzLive,nativeDrawList=fairy2DrawList,cache=new PixelCache(512,24*1024*1024);let down=new WeakMap(),rawMode=false,activeView='S',activeCorrection=false;
 const headings=['S','SE','E','NE','N','NW','W','SW'],views=['S','SE','E','NE','N','NE','E','SE'];
 const actorMeta=new WeakMap(),actorMotion=new WeakMap(),pinned=new WeakMap();
 const phaseSteps={noon:.5,ban:1,les:.5,kik:1/3,vod:1/3,rus:1/3};
 function normalize(kind,args){const finite=x=>Number.isFinite(Number(x))?Number(x):0,step=phaseSteps[kind],period=step*12,p=finite(args[1]),walk=Number(args[2]);return[Math.round(Math.max(0,Math.min(2,finite(args[0])))*12)/12,((Math.round(p/step)%12+12)%12)*step,walk>=0?((Math.round(walk*2)%12+12)%12)/2:-1];}
 function context(direction,nativeFace,fn){const n=headings.indexOf(direction),i=n<0?0:n,old=[activeView,activeCorrection];activeView=views[i];activeCorrection=(i>=5)!==(nativeFace<0);try{return fn();}finally{[activeView,activeCorrection]=old;}}
 function mirror(cv){const out=canvas(cv.width,cv.height),c=out.getContext('2d');c.imageSmoothingEnabled=false;c.translate(out.width,0);c.scale(-1,1);c.drawImage(cv,0,0);out.fzO=cv.fzO?.slice();out.fzPx=true;return out;}
 function viewPose(kind,args){return pose(kind,args).map((q,i)=>{const a=q.a.slice(),h=q.h.slice(),b=q.b.slice(),side=i?1:-1,x=Math.abs(a[0]);if(activeView==='E'){a[0]=i?-x*.18:x*.10;a[1]-=i?0:.5;}else if(activeView==='SE'){a[0]=i?-x*.48:x*.55;a[1]-=i?0:.35;}else if(activeView==='NE'){a[0]=side*x*.68;a[1]-=i?0:.35;}if(activeCorrection){h[0]*=-1;b[0]*=-1;}const sourceA=activeCorrection?-q.a[0]:q.a[0];b[0]+=(a[0]-sourceA)*.55;b[1]+=(a[1]-q.a[1])*.5;return{...q,a,b,h};});}
 function headingOf(o){if(pinned.has(o))return pinned.get(o);const r=actorMotion.get(o),x=Number(o.x)||0,y=Number(o.y)||0;let dx=r?x-r.x:0,dy=r?y-r.y:0;
  const unit=Number.isFinite(o.tgt)?Game.unitMap?.get(o.tgt):o.hit?.u,point=unit||o.hit?.p;
  if(point&&['chase','come','haunt','grab','sing'].includes(o.state)){dx=point.x-x;dy=point.y-y;}
  if(Math.hypot(dx,dy)<.001&&Number.isFinite(o.tx)&&Number.isFinite(o.ty)){dx=o.tx-x;dy=o.ty-y;}
  let index=r?.index??(o.face<0?6:o.face>0?2:0);if(Math.hypot(dx,dy)>.003){const a=Math.atan2(dx,dy)/(Math.PI/4),next=(Math.round(a)+8)%8,delta=Math.abs(((a-index+12)%8)-4);if(!r||delta>.59)index=next;}
  actorMotion.set(o,{x,y,index});return headings[index];
 }
 fairy2DrawList=function(list,c,...bounds){const F=Game.fairy2;if(F){const add=(o,kind,flip)=>{if(o)actorMeta.set(o,{kind,flip});};add(F.les,'les',false);add(F.noon,'noon',true);for(const o of F.kik||[])add(o,'kik',true);for(const o of F.ban||[])add(o,'ban',true);add(F.pond?.vod,'vod',true);add(F.pond?.rus,'rus',false);}return nativeDrawList(list,c,...bounds);};
 fzLive=function(o,get){const meta=actorMeta.get(o);return meta?context(headingOf(o),meta.flip?(o.face||1):1,()=>nativeLive(o,get)):nativeLive(o,get);};`);
change("const assets={errors:[],image:null,frames:{},heads:{},palettes:{},source:'assets/fantasy/haunt-bodies-v3.png',headSource:'assets/fantasy/haunt-busts-v2.png'};", "const assets={errors:[],image:null,frames:{},views:{},heads:{},palettes:{},source:'assets/fantasy/haunt-bodies-v3.png',headSource:'assets/fantasy/haunt-busts-v2.png',viewSources:Object.fromEntries(['SE','E','NE','N'].map(v=>[v,'assets/fantasy/haunt-bodies-v4-'+v+'.png']))};");
change(' function buildParts(im){',' function buildParts(im,view=\'S\'){const target={};');
change('assets.image=source;','if(view===\'S\')assets.image=source;');
change('   assets.frames[kind]=[];','   target[kind]=[];');
change("const sd=connectedBody(c.getImageData(col*cw,row*ch,cw,ch).data,cw,ch),cv=canvas(S[0]*2,S[1]*2),o=cv.getContext('2d'),id=o.createImageData(cv.width,cv.height),d=id.data;", "const sd=connectedBody(c.getImageData(col*cw,row*ch,cw,ch).data,cw,ch),cv=canvas(S[0]*2,S[1]*2),o=cv.getContext('2d'),id=o.createImageData(cv.width,cv.height),d=id.data;let cx=sp.cx;if(view!=='S'){const centres=[];for(let yy=240;yy<285;yy++){let left=cw,right=-1;for(let xx=0;xx<cw;xx++)if(sd[(yy*cw+xx)*4+3]>=220){left=Math.min(left,xx);right=Math.max(right,xx);}if(right>=left)centres.push((left+right)/2);}centres.sort((a,b)=>a-b);cx=centres[Math.floor(centres.length/2)]||128;}");
change("if(wy<headSpecs[kind][5]||(kind==='vod'&&wy>1))continue;", "if((view==='S'&&wy<headSpecs[kind][5])||(kind==='vod'&&wy>1))continue;");
change('sx=(sp.cx+wx/sp.x)*cw/256','sx=(cx+wx/sp.x)*cw/256');
change('o.putImageData(id,0,0);assets.frames[kind].push(cv);','o.putImageData(id,0,0);target[kind].push(cv);');
change('  });\n }\n function clear()',"  });assets.views[view]=target;if(view==='S')assets.frames=target;\n }\n function clear()");
change('hauntv[23]:','hauntv[234]:');
change("assets.ready=Promise.all([loadImage(assets.source),loadImage(assets.headSource)]).then(([body,head])=>{if(body)buildParts(body);if(head&&body)buildHeads(head);clear();});", "assets.ready=Promise.all([loadImage(assets.source),loadImage(assets.headSource),...Object.values(assets.viewSources).map(loadImage)]).then(([body,head,...images])=>{if(body)buildParts(body);if(head&&body)buildHeads(head);Object.keys(assets.viewSources).forEach((v,i)=>{if(images[i])buildParts(images[i],v);});clear();});");
change(' function limbs(c,kind,args){',' function limbs(c,kind,args,layer=\'all\'){');
change('paths=pose(kind,args),ph=', 'paths=viewPose(kind,args),ph=');
change('  paths.forEach((q,idx)=>{','  paths.forEach((q,idx)=>{if(layer===\'far\'&&idx!==0||layer===\'near\'&&idx!==1)return;');
change('r=sp.arm,skin=sp.skin,cloth=sp.cloth,angle=',"r=sp.arm*(activeView==='E'?.82:1),skin=layer==='far'?[sp.skin[0],sp.skin[0],sp.skin[1],sp.skin[2],sp.skin[3]]:sp.skin,cloth=layer==='far'?[sp.cloth[0],sp.cloth[0],sp.cloth[1],sp.cloth[2],sp.cloth[3]]:sp.cloth,angle=");
change('src=assets.frames[kind]?.[row];','src=assets.views[activeView]?.[kind]?.[row];');
change('const head=assets.heads[kind]?.[row];','const head=activeView===\'S\'?assets.heads[kind]?.[row]:null;');
change('effects(c,kind,args,false);body(c,kind,args);c.save();if(kind===\'vod\'){c.beginPath();c.rect(-15,-26,30,26.8);c.clip();}limbs(c,kind,args);c.restore();effects(c,kind,args,true);',`effects(c,kind,args,false);
  const arms=layer=>{c.save();if(kind==='vod'){c.beginPath();c.rect(-15,-26,30,26.8);c.clip();}limbs(c,kind,args,layer);c.restore();};
  if(activeView==='N'){arms('all');body(c,kind,args);}else if(activeView==='S'){body(c,kind,args);arms('all');}else{arms('far');body(c,kind,args);arms('near');}
  effects(c,kind,args,true);`);
change('lookup.set(key,rgb);','if(lookup.size>=4096)lookup.clear();lookup.set(key,rgb);');
change('cv.fzO=[S[2],S[3],S[0],S[1]];cv.fzPx=true;return cv;','cv.fzO=[S[2],S[3],S[0],S[1]];cv.fzPx=true;return activeCorrection?mirror(cv):cv;');
change("const key=kind+'|'+args.join('|')+'|'+FZ_NOOUT;", "args=normalize(kind,args);const key=activeView+'|flip:'+activeCorrection+'|'+kind+'|'+args.join('|')+'|'+FZ_NOOUT;");
change("'hauntv3:'+key", "'hauntv4:'+activeView+':'+activeCorrection+':'+key");
change(" fzNoonPx=(...a)=>make('noon',a);", " fzNoonSprite=(...a)=>{a=normalize('noon',a);return fzPxSprite('noon'+a.join('_'),60,88,30,80,()=>make('noon',a));};\n fzBansheeSprite=(...a)=>{a=normalize('ban',a);return fzPxSprite('ban'+a.join('_'),64,84,32,30,()=>make('ban',a));};\n fzLeshySprite=(...a)=>{a=normalize('les',a);return fzPxSprite('les'+a.join('_'),36,50,18,48,()=>make('les',a));};\n fzKikSprite=(...a)=>{a=normalize('kik',a);return fzPxSprite('kik'+a.join('_'),26,32,13,30,()=>make('kik',a));};\n fzVodSprite=(...a)=>{a=normalize('vod',a);return fzPxSprite('vod'+a.join('_'),30,28,15,26,()=>make('vod',a));};\n fzRusSprite=(...a)=>{a=normalize('rus',a);return fzPxSprite('rus'+a.join('_'),22,30,11,28,()=>make('rus',a));};\n fzNoonPx=(...a)=>make('noon',a);");
change('version:3,ready:assets.ready','version:4,ready:assets.ready');
change('after:make,pose,renderSpec:',`after:make,pose,headings,viewPose,headingOf,requiredAssets:[assets.source,assets.headSource,...Object.values(assets.viewSources)],
  frame(kind,args=[0,0,-1],direction='S',face){const i=headings.indexOf(direction),f=face??(i>=5?-1:1);return context(direction,f,()=>{const source=make(kind,args).hauntLive;return f<0?mirror(source):source;});},
  death(kind,frame=0,direction='S',face){const i=headings.indexOf(direction),f=face??(i>=5?-1:1),n=((Math.round(Number(frame)||0)%12)+12)%12;return context(direction,f,()=>{const source=FZ_DIE[kind](n);return f<0?mirror(source):source;});},
  setHeading(actor,direction){if(headings.includes(direction))pinned.set(actor,direction);else pinned.delete(actor);},
  anchors(kind,args=[0,0,-1],direction='S',face){const i=headings.indexOf(direction),f=face??(i>=5?-1:1);return context(direction,f,()=>({foot:[0,0],native:pose(kind,normalize(kind,args)).map(q=>[q.h[0]*f,q.h[1]]),actual:viewPose(kind,normalize(kind,args)).map(q=>[q.h[0]*(activeCorrection?-1:1)*f,q.h[1]])}));},
  cacheStats:()=>({entries:cache.size,rgbaBytes:cache.bytes,maxEntries:cache.maxEntries,maxRgbaBytes:cache.maxBytes,hits:cache.hits,misses:cache.misses}),
  renderSpec:`);
fs.writeFileSync(dir+'/fantasy-published-haunts-v4.js',s);
