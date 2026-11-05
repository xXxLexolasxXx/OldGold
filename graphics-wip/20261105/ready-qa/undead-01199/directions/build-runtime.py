from pathlib import Path
root=Path(__file__).resolve().parents[4]/'publish/oldgold-pages-20261104'
# Resolve from the recorded baseline rather than reapplying transformations.
here=Path(__file__).resolve().parent
root=here.parents[2]/'publish/oldgold-pages-20261104'
s=(here/'approved-court-v3.js').read_text(encoding='utf-8')
s=s.replace("parts:{},ready:false", "parts:{},views:{},viewSources:{S:'assets/fantasy/court-bodies-v5-S.png',E:'assets/fantasy/court-bodies-v5-E.png',NE:'assets/fantasy/court-bodies-v5-NE.png',N:'assets/fantasy/court-bodies-v5-N.png'},ready:false")
s=s.replace(" const canvas=", " let activeView='SE';\n const partsFor=k=>assets.views[activeView]?.[k]||assets.parts[k],specFor=k=>partsFor(k).spec||specs[k];\n const canvas=")
s=s.replace('function build(body,arms){for(const [kind,S]of Object.entries(specs)){','function build(body,arms,view){const table={};for(const [kind,base]of Object.entries(specs)){const S={...base,w:base.w*(view===\'E\'?.65:view===\'NE\'?.94:1)};')
s=s.replace('const P={master,raw,upper:', 'const P={spec:S,master,raw,upper:')
s=s.replace('assets.parts[kind]=P;', 'table[kind]=P;')
s=s.replace("}assets.ready=true;cache.clear();}","}assets.views[view]=table;if(view==='SE')assets.parts=table;}")
s=s.replace("const ready=Promise.all([load(assets.bodies),load(assets.arms)]).then(([b,a])=>{if(b&&a)build(b,a);});", "const ready=Promise.all([load(assets.bodies),load(assets.arms),...Object.values(assets.viewSources).map(load)]).then(([b,a,...images])=>{if(!b||!a||images.some(x=>!x))return;build(b,a,'SE');Object.keys(assets.viewSources).forEach((v,i)=>build(images[i],a,v));assets.ready=true;cache.clear();});")
s=s.replace("const S=specs[kind],B=FPX_BOX[kind],P=assets.parts[kind]", "const S=specFor(kind),B=FPX_BOX[kind],P=partsFor(kind)")
s=s.replace("const S=specs[kind],parts=assets.parts[kind]", "const S=specFor(kind),parts=partsFor(kind)")
s=s.replace("const p=parts.legs[i];segment(c,p.upper,a,b,width*.8,s<0);", "if(activeView==='E'){a[0]*=.25;b[0]=b[0]*.8;f[0]=f[0]*.9;width*=.78;}else if(activeView==='S'||activeView==='N'){const sign=activeView==='S'?1:-1;a[0]=s*S.w*.11;b[0]=s*S.w*.13+(b[0]-a[0])*.12;f[0]=s*S.w*.14+Q.sw*s*.45;f[1]+=sign*Q.sw*s*1.1;width*=.86;}const p=parts.legs[i];segment(c,p.upper,a,b,width*.8,s<0);")
s=s.replace("const R=rig(kind,Q,s),A=assets.parts[kind],S=specs[kind]", "const R=rig(kind,Q,s),A=partsFor(kind),S=specFor(kind)")
s=s.replace("a=[s*S.w*.30+Q.lean", "a=[(activeView==='E'?-S.w*.12+(s<0?.6:0):s*S.w*.30)+Q.lean")
s=s.replace("R.a=a;R.b=b;", "R.a=a;R.b=b;if(activeView==='E')R.w*=.83;else if(activeView==='S'||activeView==='N'){const sign=activeView==='S'?1:-1,dx=R.h[0]-R.a[0];R.h=[s*S.w*.30+dx*.16,R.h[1]+sign*Math.max(0,dx)*.35];R.b=[(R.a[0]+R.h[0])*.5,(R.a[1]+R.h[1])*.5+1];R.angle=sign*Math.PI/2+R.angle*.22;}else if(activeView==='NE'){R.h[1]-=Math.max(0,R.h[0]-R.a[0])*.17;R.b[1]-=.7;}")
old="c.save();c.scale(2,2);c.translate(B[2],B[3]);legs(c,kind,Q);c.restore();body(c,kind,Q);\n  c.save();c.scale(2,2);c.translate(B[2],B[3]);arm(c,kind,Q,-1);const R=arm(c,kind,Q,1);weapon(c,kind,Q,R);"
new="c.save();c.scale(2,2);c.translate(B[2],B[3]);legs(c,kind,Q);if(activeView==='E'||activeView==='NE'||activeView==='N')arm(c,kind,Q,-1);if(activeView==='N'){const backHand=arm(c,kind,Q,1);weapon(c,kind,Q,backHand);}c.restore();body(c,kind,Q);\n  c.save();c.scale(2,2);c.translate(B[2],B[3]);if(activeView==='S'||activeView==='SE')arm(c,kind,Q,-1);const R=arm(c,kind,Q,1);if(activeView!=='N')weapon(c,kind,Q,R);"
assert old in s
s=s.replace(old,new)
start=s.index(' let activeBossFrame=null;');end=s.index(" if(typeof foeDrawMalgor",start)
runtime=r'''
 let activeBossFrame=null,renderView='SE',mirrorCorrection=false;
 const headings=['S','SE','E','NE','N','NE','E','SE'],headings8=['S','SE','E','NE','N','NW','W','SW'],facing=new WeakMap(),previewViews=new WeakMap();
 function headingOf(N){
  const forced=previewViews.get(N);if(forced!==undefined)return{heading:forced,direction:headings8[forced],view:headings[forced],mirror:forced>=5};
  const time=Game.time;let r=facing.get(N),target=typeof foeUnit==='function'&&N.tg?foeUnit(N.tg):null,dx=0,dy=0;
  if(target&&(N.st==='atk'||N.st==='cast'||N.st==='idle')){dx=target.x-N.x;dy=target.y-N.y;}
  else if(r){dx=N.x-r.x;dy=N.y-r.y;}
  let desired=r?r.desired:(N.face<0?7:1);
  if(Math.hypot(dx,dy)>.001)desired=((Math.round(Math.atan2(dx,dy)/(Math.PI/4))%8)+8)%8;
  else if(r&&N.face!==r.face&&N.st!=='die'&&N.st!=='vanish')desired=N.face<0?7:1;
  if(!r){r={current:desired,desired,x:N.x,y:N.y,face:N.face,time};facing.set(N,r);}
  if(N.st!=='die'&&N.st!=='vanish'){
   if(r.desired!==desired){r.desired=desired;r.time=time;}
   if(time<r.time)r.time=time;
   if(time-r.time>=.055&&r.current!==desired){const d=(desired-r.current+8)%8;r.current=(r.current+(d<=4?1:7))%8;r.time+=.055;}
  }
  if(Math.hypot(dx,dy)>.001||time!==r.seen){r.x=N.x;r.y=N.y;r.face=N.face;r.seen=time;}
  return{heading:r.current,direction:headings8[r.current],view:headings[r.current],mirror:r.current>=5};
 }
 function directionFrame(kind,fr,direction='SE',correction=false){
  if(!kinds.includes(kind)||!assets.ready)return original(kind,fr);
  const i=headings8.indexOf(direction),view=i>=0?headings[i]:direction;
  if(i>=5)correction=!correction;
  if(activeBossFrame!==null&&kind.startsWith('fMalgor')&&fr==='c6')fr='c'+activeBossFrame;
  const key=kind+'|'+fr+'|'+view+'|'+correction;if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);return s;}
  const B=FPX_BOX[kind];let cv=canvas(B[0]*2,B[1]*2);const previous=activeView;activeView=view;try{paint(cv,kind,fr);}finally{activeView=previous;}
  if(correction){const reflected=canvas(cv.width,cv.height),c=reflected.getContext('2d');c.imageSmoothingEnabled=false;c.translate(cv.width,0);c.scale(-1,1);c.drawImage(cv,0,0);reflected.fine=2;cv=reflected;}
  const out={cv,w:B[0],h:B[1],ax:correction?B[0]-B[2]:B[2],ay:B[3],direction,view,mirror:correction};cache.set(key,out);if(cache.size>1200)cache.delete(cache.keys().next().value);return out;
 }
 foePxFrame=function(kind,fr){return directionFrame(kind,fr,renderView,mirrorCorrection);};
 const nativeRaider=foeDrawRaider;
 foeDrawRaider=function(c,N){
  if(N.k==='raven')return nativeRaider(c,N);
  const d=headingOf(N),previous=renderView,previousMirror=mirrorCorrection;renderView=d.view;mirrorCorrection=d.mirror!==(N.face<0);
  try{return nativeRaider(c,N);}finally{renderView=previous;mirrorCorrection=previousMirror;}
 };
'''
s=s[:start]+runtime+s[end:]
s=s.replace("version:'court-v3-raster-parts'", "version:'court-v5-eight-directions'")
s=s.replace('assets,ready,rig,pose};','assets,ready,rig,pose,frame:directionFrame,headingOf,headings:headings8,setHeading:(n,d)=>{const i=headings8.indexOf(d);if(i<0)previewViews.delete(n);else previewViews.set(n,i);}};')
# Explicit byte-bounded sprite LRU. Cache keys never include raw time or gf.
cache_class=''' class PixelCache extends Map{
 constructor(){super();this.bytes=0;this.maxBytes=32*1024*1024;this.maxEntries=1200;this.hits=0;this.misses=0;}
 cost(v){return v.cv.width*v.cv.height*4;}
 delete(k){const v=super.get(k);if(v)this.bytes-=this.cost(v);return super.delete(k);}
 clear(){super.clear();this.bytes=0;}
 set(k,v){if(this.has(k))this.delete(k);const bytes=this.cost(v);while(this.size&&(this.size>=this.maxEntries||this.bytes+bytes>this.maxBytes))this.delete(this.keys().next().value);super.set(k,v);this.bytes+=bytes;return this;}
 }
'''
s=s.replace(' const original=foePxFrame,cache=new Map()',cache_class+' const original=foePxFrame,cache=new PixelCache()')
s=s.replace("if(!kinds.includes(kind)||!assets.ready)return original(kind,fr);\n  const i=", "if(!kinds.includes(kind)||!assets.ready)return original(kind,fr);correction=!!correction;\n  const i=")
s=s.replace("if(cache.has(key)){const s=cache.get(key);cache.delete(key);cache.set(key,s);return s;}\n  const B=", "if(cache.has(key)){cache.hits++;const s=cache.get(key);cache.delete(key);cache.set(key,s);return s;}cache.misses++;\n  const B=")
s=s.replace('headings:headings8,setHeading:', 'headings:headings8,cacheStats:()=>({entries:cache.size,rgbaBytes:cache.bytes,maxEntries:cache.maxEntries,maxRgbaBytes:cache.maxBytes,hits:cache.hits,misses:cache.misses}),setHeading:')
# Normalize public frame/view inputs too, so callers cannot create time-based keys.
s=s.replace("const i=headings8.indexOf(direction),view=i>=0?headings[i]:direction;", "const i=headings8.indexOf(direction),view=i>=0?headings[i]:'SE';const match=/^([iwach])(\\d+)$/.exec(String(fr));if(match)fr=match[1]+(Number(match[2])%(match[1]==='h'?6:12));else if(!NA_FRAMES.fight.includes(fr))fr='i0';")
s=s.replace('headings:headings8,cacheStats:', "headings:headings8,portrait:(kind='fMalgor1',phase=0)=>directionFrame(kind,'i'+((Math.floor(Number(phase)||0)%12+12)%12),'S'),cacheStats:")
# Back of rockling has opaque stone/moss sleeves, not front amber crest pieces.
s=s.replace('if(S.hip){for(const cx of S.leg)', "if(view==='N'&&kind==='fRock')P.upper=P.lower;if(S.hip){for(const cx of S.leg)")
# Rear weapons are behind the torso; do not draw the near arm twice.
s=s.replace("if(activeView==='N'){const backHand=arm(c,kind,Q,1);weapon(c,kind,Q,backHand);}", "if(activeView==='N'){const backHand=rig(kind,Q,1);backHand.angle=-Math.PI/2+backHand.angle*.22;weapon(c,kind,Q,backHand);}")
# Keep the native hand and cast-FX coordinates; view changes affect sockets,
# elbow folding, texture projection, weapon orientation and depth ordering.
s=s.replace('R.h=[s*S.w*.30+dx*.16,R.h[1]+sign*Math.max(0,dx)*.35];','')
s=s.replace('R.h[1]-=Math.max(0,R.h[0]-R.a[0])*.17;','')
s=s.replace('try{return bossDraw(c,N);}finally{activeBossFrame=previous;}', 'const reflect=mirrorCorrection;if(reflect){c.save();c.scale(-1,1);mirrorCorrection=false;}try{return bossDraw(c,N);}finally{if(reflect){mirrorCorrection=true;c.restore();}activeBossFrame=previous;}')
s=s.replace(" const ready=", " const anchorContext=canvas(1,1).getContext('2d');\n const ready=")
anchor_api="anchors:(kind,fr,dir='SE')=>{const before=activeView,i=headings8.indexOf(dir);activeView=i>=0?headings[i]:dir;try{const q=pose(fr),cc=anchorContext,near=arm(cc,kind,q,1,true).h,far=arm(cc,kind,q,-1,true).h;return{view:activeView,mirror:i>=5,nativeNear:rig(kind,q,1).h,nativeFar:rig(kind,q,-1).h,near,far,foot:[0,0],castFX:rig(kind,q,-1).h};}finally{activeView=before;}},"
s=s.replace('headings:headings8,', 'headings:headings8,'+anchor_api)
(root/'js/fantasy-darkcourt-polish.js').write_text(s,encoding='utf-8')
print(root/'js/fantasy-darkcourt-polish.js')
