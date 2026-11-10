'use strict';
// UI crops of the actual, current body renderers. No independent portrait heads.
(() => {
 if(globalThis.FantasyPublishedPortraits)return;
 const oldFace=campFaceUrl,oldPixel=pxfFaceUrl,oldPortrait=portraitURL,cache=new Map(),sourceIds=new WeakMap();let nextSource=1;
 const sourceId=cv=>{if(!sourceIds.has(cv))sourceIds.set(cv,nextSource++);return sourceIds.get(cv);};
 const make=(n)=>{const cv=document.createElement('canvas');cv.width=cv.height=n;return cv;};
 function crop(sp,box,n=72){const cv=make(n),c=cv.getContext('2d');c.imageSmoothingEnabled=false;const k=sp.cv.width/sp.w;c.drawImage(sp.cv,...box.map(v=>v*k),0,0,n,n);return cv;}
 function cached(sp,box,key,n=72){key+='|source:'+sourceId(sp.cv);if(cache.has(key))return cache.get(key);const url=crop(sp,box,n).toDataURL();cache.set(key,url);if(cache.size>500)cache.delete(cache.keys().next().value);return url;}
 const roles={
  grum:{cap:'#e0a822',coat:'#6e1c22',hair:'#6a4024',mark:'candle'},
  yagla:{female:true,cap:'#b04a6a',coat:'#7a3a5a',hair:'#d8d4d0',mark:'glasses'},
  pim:{cap:'#2e5a22',coat:'#3a5a4a',hair:'#7a5a3a',mark:'feather'},
  tan:{cap:'#2a4a8a',coat:'#2a4a8a',hair:'#f2eee4',mark:'gem'},
  kremen:{cap:'#9a9aa6',coat:'#b07a5a',hair:'#c86a2a',mark:'scar'},
  zhmykha:{female:true,cap:'#9aaac6',coat:'#7a8aa6',hair:'#c8ccd4',mark:'pin'},
  elder:{cap:'#5a5a52',coat:'#5a5a52',hair:'#e4e2d4',mark:'elder'},
  hero:{cap:'#d4a018',coat:'#8a1c22',hair:'#8a5a2a'},
  heroF:{female:true,cap:'#d4a018',coat:'#8a1c22',hair:'#c86a2a'}
 };

 const namedPresets={
  grum:{base:'builder',look:31,capStyle:2,beardStyle:0,candle:true},
  yagla:{base:'serf',look:49,capStyle:0,hs:2},
  pim:{base:'herder',look:17,capStyle:3,beardStyle:2,deco:3},
  tan:{base:'enchanter',look:27,capStyle:1,beardStyle:0},
  kremen:{base:'stonemason',look:41,capStyle:5,beardStyle:1},
  zhmykha:{base:'carter',look:53,capStyle:2,hs:4},
  elder:{base:'serf',look:63,capStyle:4,beardStyle:0},
  hero:{base:'hero',look:3,capStyle:0,beardStyle:0},heroF:{base:'hero',look:3,capStyle:0,hs:0}
 };
 // These are render-only native outfit/look presets, never Game units or saves.
 // Geometry, cap, hair, nose and all foregrounds still come from personSprite.
 function namedHolder(who){const r=roles[who],p=namedPresets[who];if(!r||!p)return null;
  if((who==='hero'||who==='heroF')&&Game.hero&&(personSex(Game.hero)==='f')===!!r.female)return Game.hero;
  const type='portrait_'+who;
  if(!OUTFIT[type]){OUTFIT[type]={...OUTFIT[p.base],cap:r.cap,coat:r.coat,robeCol:r.coat,fem:false,candle:!!p.candle};
   HA.look[type]={bcol:r.hair,hair:r.hair,capStyle:p.capStyle,beardStyle:p.beardStyle||0,beardLen:who==='tan'||who==='elder'?2:1,deco:p.deco??5,skin:who==='elder'?1:0,noBeard:!!r.female,...(r.female?{fem:true,hs:p.hs||0}: {})};}
  return{type,look:p.look,sx:r.female?'f':'',carry:null};
 }
 function personCrop(u,f=0,n=72,background=false){
  // Low caps intentionally hide the eyes. Both UI frames are actual native idle
  // samples; do not paint artificial open eyes or a separate face over the cap.
  const sp=personSprite(u,'S','idle',f?8:0);if(!sp)return '';
  const key='person|'+n+'|'+background+'|'+sourceId(sp);if(cache.has(key))return cache.get(key);
  const cv=make(n),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  if(background){c.fillStyle='#263929';c.fillRect(0,0,n,n);}
  const k=sp.width/PW;c.drawImage(sp,k,0,24*k,24*k,0,0,n,n);
  const url=cv.toDataURL();cache.set(key,url);if(cache.size>500)cache.delete(cache.keys().next().value);return url;
 }
 function named(who,f){const u=namedHolder(who);return u?personCrop(u,f):'';}
 const goblins={gob:{kind:'goblin',hx:1.6,hy:-18.6},champ:{kind:'goblinChamp',hx:3.3,hy:-26},shnyr:{kind:'goblinKing',hx:2.1,hy:-19.7}};
 function goblinFace(who,f){const m=goblins[who];if(!m||!globalThis.GoblinPolish?.enabled)return '';const S=NA_SPEC[m.kind],sp=naFrame(m.kind,f?'i8':'i0'),sc=S.sc||1;return cached(sp,[S.ax+(m.hx-10)*sc,S.ay+(m.hy-12)*sc,22*sc,24*sc],'goblin|'+who+'|'+!!f);}
 function creatureSource(who,f){
  const fr=f?'i8':'i0';
  if(who==='troll'&&globalThis.FantasyPublishedForestfolk){const sp=naFrame('troll',fr),S=NA_SPEC.troll,P=naPose(fr),rig=FantasyPublishedForestfolk.trollRig(P,false),sq=P.sq||1,z=Math.sqrt(sq);return{sp,box:[sp.ax+(P.x||0)*S.sc+(rig.hx/3-18)/z,sp.ay+(P.y||0)*S.sc+(rig.hy/3-15)*sq,36/z,36*sq],renderer:'naFrame(troll)',frame:fr};}
  if(who==='zhab'&&globalThis.FantasyPublishedFrogs?.enabled){
   const frogs=globalThis.FrogDirections;
   const directional=frogs?.ready&&typeof frogs.frame==='function'&&frogs.kinds?.includes('ftZF');
   const sp=directional?frogs.frame('ftZF',fr,'S'):naFrame('ftZF',fr);
   const S=NA_SPEC.ftZ,P=naPose(fr),sq=P.sq||1,z=Math.sqrt(sq),sc=S.sc;
   const dx=directional?Math.round((P.x||0)*sc*2)/2:(P.x||0)*sc;
   const dy=directional?Math.round((P.y||0)*sc*2)/2:(P.y||0)*sc;
   return{sp,box:[sp.ax+dx-14*sc/z,sp.ay+dy+(-22.4-12)*sc*sq,28*sc/z,29*sc*sq],renderer:directional?'FrogDirections.frame(ftZF,S)':'naFrame(ftZF)',frame:fr,direction:'S'};
  }
  const court=globalThis.FantasyDarkCourtPolish;
  if(who==='mrak'&&court?.assets?.ready&&typeof court.portrait==='function'){const phase=f?8:0,frame='i'+phase,sp=court.portrait('fMalgor1',phase),Q=court.pose(frame),z=(FPX_BOX.fMalgor1[4]||1)/3,dy=(Q.bob+Q.br*.8)*z,H=court.worldScale?.fMalgor1?.height||84,scale=H/84;return{sp,box:[sp.ax-15*scale,sp.ay-H+dy,30*scale,33*scale],renderer:'FantasyDarkCourtPolish.portrait(fMalgor1,S)',frame,direction:'S'};}
  if(who==='mrak'&&typeof foePxFrame==='function'){const sp=foePxFrame('fMalgor1',fr);if(sp){const Q=fpxPose(fr),dy=Q.br*2/3;return{sp,box:[sp.ax-11,sp.ay-70+dy,24,27],renderer:'foePxFrame(fMalgor1) native pending court scale review',frame:fr};}}
  if(who==='golem'&&globalThis.FantasyPublishedGolem){const frame=f?9:0,cv=golemSprite('S','idle',frame,true),P=golemPose('S','idle',frame),hx=P.sx+P.head.dx,hy=-67-P.up+P.head.dy;return{sp:{cv,w:GL_W,h:GL_H,ax:GL_AX,ay:GL_AY},box:[GL_AX+hx-25,GL_AY+hy-23,50,50],renderer:'golemSprite(S,idle) peaceful',frame,season:golemSea()};}
  return null;
 }
 function creatureFace(who,f){const s=creatureSource(who,f);return s?cached(s.sp,s.box,'creature|'+who+'|'+!!f):'';}
 campFaceUrl=function(who,f){return creatureFace(who,f)||goblinFace(who,f)||named(who,f)||oldFace(who,f);};
 pxfFaceUrl=function(who,f){return creatureFace(who,f)||goblinFace(who,f)||named(who,f)||oldPixel(who,f);};
 portraitURL=function(type,look=3,sx=''){
  if(!OUTFIT[type]||(UNIT_TYPES[type]&&UNIT_TYPES[type].animal))return oldPortrait(type,look,sx);
  const me=type==='hero'?(Game.hero?.look===look?Game.hero:Game.units.find(u=>u.type==='hero'&&u.look===look)):null;
  return personCrop(me||{type,look,sx,carry:null},0,48,true)||oldPortrait(type,look,sx);
 };
 const api=globalThis.FantasyPublishedPortraits={version:1,roles:[...Object.keys(roles),...Object.keys(goblins),'troll','zhab'],pendingRoles:['mrak','golem'],cache,namedHolder,personCrop,creatureSource,native:{camp:oldFace,pixel:oldPixel,portrait:oldPortrait}};
 api.ready=Promise.all([globalThis.FantasyPublishedArt?.ready,globalThis.FantasyPublishedAppearanceArt?.ready,globalThis.FantasyDarkCourtPolish?.ready]).then(()=>{for(const who of ['mrak','golem'])if(creatureSource(who,0)){api.roles.push(who);api.pendingRoles=api.pendingRoles.filter(x=>x!==who);}cache.clear();if(typeof PORTRAIT_CACHE!=='undefined')PORTRAIT_CACHE.clear();});
})();
