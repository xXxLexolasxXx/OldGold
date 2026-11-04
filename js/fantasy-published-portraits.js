'use strict';
// Cosmetic UI portrait adapter. Load last, after fantasy-published-art and native facespx.
(() => {
 if (globalThis.FantasyPublishedPortraits) return;
 const oldFace=campFaceUrl, oldPixel=pxfFaceUrl, oldPortrait=portraitURL;
 const cache=new Map();
 const goblins={gob:{kind:'goblin',hx:1.6,hy:-18.6},champ:{kind:'goblinChamp',hx:3.3,hy:-26},shnyr:{kind:'goblinKing',hx:2.1,hy:-19.7}};
 function goblinFace(who,f){
  const meta=goblins[who];if(!meta||!globalThis.GoblinPolish?.enabled)return '';
  const key='goblin|'+who+'|'+(f?1:0);if(cache.has(key))return cache.get(key);
  const S=NA_SPEC[meta.kind],sp=naFrame(meta.kind,f?'i8':'i0');
  const k=sp.cv.width/S.w,sc=S.sc||1;
  const cv=document.createElement('canvas');cv.width=cv.height=72;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  // Exact new-model head anchors in its local drawing coordinates, transformed
  // through the native species scale and returned sprite backing resolution.
  c.drawImage(sp.cv,(S.ax+(meta.hx-10)*sc)*k,(S.ay+(meta.hy-12)*sc)*k,22*sc*k,24*sc*k,0,0,72,72);
  const url=cv.toDataURL();cache.set(key,url);return url;
 }
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
 const rgb=h=>h.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));
 function named(who,f){
  const role=roles[who],art=globalThis.FantasyPublishedArt?.images[role?.female?'gnome-woman-walk':'gnome-walk'];
  if(!role||!art?.frames)return '';
  const hero=(who==='hero'||who==='heroF')&&Game.hero&&
    (personSex(Game.hero)==='f')===!!role.female?Game.hero:null;
  const signature=hero?JSON.stringify([hero.look,hero.hero?.app,hero.hero?.clsKey]):'';
  const key=who+'|'+(f?1:0)+'|'+signature;if(cache.has(key))return cache.get(key);
  const cv=document.createElement('canvas');cv.width=cv.height=72;const c=cv.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;
  if(hero){const spr=personSprite(hero,'S','idle',0);const k=spr.width/PW;c.drawImage(spr,k,0,24*k,24*k,0,0,72,72);}
  else {
   const s=art.frames[0],hh=Math.round(s[3]*.64);const crop=document.createElement('canvas');crop.width=s[2];crop.height=hh;
   const q=crop.getContext('2d',{willReadFrequently:true});q.drawImage(art.image,s[0],s[1],s[2],hh,0,0,s[2],hh);
   const d=q.getImageData(0,0,crop.width,crop.height),p=d.data,cap=rgb(role.cap),coat=rgb(role.coat),hair=rgb(role.hair);
   for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){
    const i=(y*crop.width+x)*4;if(!p[i+3])continue;let target=null,light=1;
    const r=p[i],g=p[i+1],b=p[i+2],ny=y/s[3];
    if(!role.female&&g>r*.83&&g>b*1.35&&r<185&&b<110){target=ny<.31?cap:coat;light=g/119;}
    else if(!role.female&&ny>.32&&ny<.64&&r>110&&Math.abs(r-g)<35&&g-b<65){target=hair;light=(r+g+b)/3/205;}
    else if(role.female&&ny<.28&&r>110&&g>80&&b>45){target=cap;light=(r+g+b)/3/190;}
    else if(role.female&&ny>.3&&ny<.62&&r>80&&r>g*1.45&&g>b*1.4){target=hair;light=r/180;}
    if(target)for(let n=0;n<3;n++)p[i+n]=Math.min(255,Math.round(target[n]*Math.max(.25,Math.min(1.35,light))));
   }
   q.putImageData(d,0,0);c.drawImage(crop,0,0,crop.width,crop.height,0,0,72,72);
  }
  // Close only the two eyes, leaving the source face, nose and expression intact.
  const eyes=role.female?[[30,34],[40,34]]:[[29,30],[42,30]];
  if(f){for(const [x,y]of eyes){c.fillStyle='#e8b48b';c.fillRect(x-2,y-3,5,7);c.fillStyle='#68442e';c.fillRect(x-2,y+1,5,1);}}
  c.fillStyle='#e9d38e';c.strokeStyle='#c8a050';c.lineWidth=1;
  if(role.mark==='glasses'){for(const[x,y]of eyes){c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.stroke();}c.fillRect(35,34,2,1);}
  if(role.mark==='candle'){c.fillStyle='#eee3bd';c.fillRect(51,16,4,10);c.fillStyle='#ffcf64';c.fillRect(f?52:51,11,3,5);c.fillStyle='#fff4c3';c.fillRect(52,13,1,2);}
  if(role.mark==='feather'){c.fillStyle='#eee9d8';c.beginPath();c.moveTo(48,22);c.lineTo(59,3);c.lineTo(53,6);c.lineTo(46,23);c.fill();}
  if(role.mark==='gem'){c.fillRect(20,20,32,2);c.fillStyle='#c83341';c.fillRect(34,17,5,6);}
  if(role.mark==='pin'){c.fillStyle='#63462b';c.fillRect(25,13,22,2);c.fillStyle='#d1b07b';c.fillRect(24,12,3,3);}
  if(role.mark==='scar'){c.fillStyle='#9f4e36';c.fillRect(23,36,6,1);}
  if(role.mark==='elder'){c.fillStyle='#a6a692';c.fillRect(21,26,10,2);c.fillRect(41,26,10,2);}
  const url=cv.toDataURL();cache.set(key,url);return url;
 }
 campFaceUrl=function(who,f){return goblinFace(who,f)||named(who,f)||oldFace(who,f);};
 pxfFaceUrl=function(who,f){return goblinFace(who,f)||named(who,f)||oldPixel(who,f);};
 portraitURL=function(type,look=3,sx=''){
  // Animal/creature paths deliberately keep their original renderer.
  if(!OUTFIT[type]||(UNIT_TYPES[type]&&UNIT_TYPES[type].animal))return oldPortrait(type,look,sx);
  const me=type==='hero'?(Game.hero?.look===look?Game.hero:Game.units.find(u=>u.type==='hero'&&u.look===look)):null;
  const holder=me||{type,look,sx,carry:null};const art=globalThis.FantasyPublishedArt?.images[type==='kid'?'gnome-child':personSex(holder)==='f'||OUTFIT[type].fem?'gnome-woman-walk':'gnome-walk'];
  if(!art)return oldPortrait(type,look,sx);
  const key='unit|'+type+'|'+look+'|'+sx+'|'+JSON.stringify(me?.hero?.app)+'|'+me?.hero?.clsKey;if(cache.has(key))return cache.get(key);
  const spr=personSprite(holder,'S','idle',0);if(!spr)return oldPortrait(type,look,sx);
  const cv=document.createElement('canvas');cv.width=cv.height=48;const c=cv.getContext('2d');
  const g=c.createRadialGradient(24,18,2,24,18,34);g.addColorStop(0,'#4a5a30');g.addColorStop(1,'#141a0c');c.fillStyle=g;c.fillRect(0,0,48,48);c.imageSmoothingEnabled=false;
  if(type==='kid'&&art.frames){const a=art.frames[0];c.drawImage(art.image,a[0],a[1],a[2],Math.round(a[3]*.65),3,2,42,46);}
  else {const scale=spr.width/PW;c.drawImage(spr,scale,0,24*scale,24*scale,0,0,48,48);}
  const url=cv.toDataURL();cache.set(key,url);return url;
 };
 const api={version:1,roles:[...Object.keys(roles),...Object.keys(goblins)],cache,ready:Promise.resolve(globalThis.FantasyPublishedArt?.ready)};
 globalThis.FantasyPublishedPortraits=api;
 api.ready.then(()=>{cache.clear();if(typeof PORTRAIT_CACHE!=='undefined')PORTRAIT_CACHE.clear();});
})();
