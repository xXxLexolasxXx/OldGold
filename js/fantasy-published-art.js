'use strict';
// Optional art adapter for current OldGold. Load after native game modules.
// Native simulation, dimensions, anchors and action frame selectors are retained.
// Bound only our replacement architecture canvases. Native sprite caches and
// render budgets remain native. A hit refreshes insertion order for true LRU.
class FPABuildingArtCache extends Map {
  constructor() { super(); this.maxEntries = 64; this.maxBytes = 96 * 1024 * 1024; this.weights = new Map(); this.bytes = 0; this.hits = 0; this.stores = 0; this.evictions = 0; }
  static pixelWeight(spr) {
    const pixels = cv => cv && cv.width && cv.height ? cv.width * cv.height : 0;
    return 4 * (pixels(spr.canvas) + pixels(spr.shadow));
  }
  get(key) {
    if (!super.has(key)) return undefined;
    const spr = super.get(key); super.delete(key); super.set(key, spr); this.hits++; return spr;
  }
  delete(key) {
    if (!super.delete(key)) return false;
    this.bytes -= this.weights.get(key) || 0; this.weights.delete(key); return true;
  }
  set(key, spr) {
    const weight = FPABuildingArtCache.pixelWeight(spr);
    this.delete(key); this.stores++;
    if (weight > this.maxBytes) return this;
    while (this.size && (this.size >= this.maxEntries || this.bytes + weight > this.maxBytes)) {
      this.delete(this.keys().next().value); this.evictions++;
    }
    super.set(key, spr); this.weights.set(key, weight); this.bytes += weight; return this;
  }
  clear() { super.clear(); this.weights.clear(); this.bytes = 0; this.hits = 0; this.stores = 0; this.evictions = 0; }
  get stats() { return { entries: this.size, bytes: this.bytes, maxEntries: this.maxEntries, maxBytes: this.maxBytes, hits: this.hits, stores: this.stores, evictions: this.evictions }; }
}
const FantasyPublishedArt = {images:{},errors:[],cache:new FPABuildingArtCache(),people:new Map(),version:1};
const FantasyArt = FantasyPublishedArt;
const FPAYardBank = { ready: null, errors: [] };
const fpaYardBankURL = new URL('../assets/fantasy/school-inn-bank.json', document.currentScript.src);
FPAYardBank.ready = (async () => {
  const load = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Yard bank HTTP ' + response.status);
    return response;
  };
  const { width, height, entries } = await (await load(fpaYardBankURL)).json();
  const atlas = await createImageBitmap(await (await load(new URL('school-inn-bank.png', fpaYardBankURL))).blob());
  try {
    if (atlas.width !== width || atlas.height !== height) throw new Error('Unexpected yard bank size');
    const extract = ([x,y,w,h]) => {
      const canvas = mkCanvas(w,h);
      canvas.getContext('2d').drawImage(atlas,x,y,w,h,0,0,w,h);
      return canvas;
    };
    for (const [key, { meta, regions }] of Object.entries(entries)) {
      if (!SPR.buildings[key]) SPR.buildings[key] = { ...meta, canvas: extract(regions[0]), shadow: extract(regions[1]) };
    }
    return true;
  } finally { atlas.close(); }
})().catch(error => { FPAYardBank.errors.push(error.message); return false; });
function faRect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(.5,w),Math.max(.5,h));}
function fpaBounds(cv){const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]>=96){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return x1<0?[0,0,1,1]:[x0,y0,x1-x0+1,y1-y0+1];}
FantasyPublishedArt.ready=Promise.all(["house","well","tradepost","infirmary","pier","fisherhut","library","herohall","watchtower","armory", "bakery", "bonfire-flames", "bonfire-hearth", "brewery", "butchery", "crystalmine", "farm", "gnome-child", "gnome-walk", "gnome-woman-walk", "goatpen", "goldmine", "graveyard", "guild_archer", "guild_mage", "guild_rogue", "guild_warrior", "hopfarm", "inn", "ironmine", "magicworkshop", "metallurgist", "mill", "quarry", "sawmill", "school", "smeltery", "squadtavern", "stable", "storehouse", "swine", "tannery", "weaponsmith", "woodcutter"].map(type=>new Promise(resolve=>{const im=new Image();im.onload=()=>{const cv=mkCanvas(im.width,im.height),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);const d=c.getImageData(0,0,cv.width,cv.height);if(type.startsWith('gnome-')){for(let i=3;i<d.data.length;i+=4)d.data[i]=d.data[i]>=220?255:0;c.putImageData(d,0,0);}const a={image:cv,bounds:fpaBounds(cv)};if(type.startsWith('gnome-')||type==='bonfire-flames')faSliceFrames(a,d.data,cv.width,cv.height,type==='gnome-child'||type==='bonfire-flames'?4:8,type==='gnome-child'||type==='bonfire-flames'?2:3);FantasyPublishedArt.images[type]=a;FantasyPublishedArt.cache.clear();FantasyPublishedArt.people.clear();resolve();};im.onerror=()=>{FantasyPublishedArt.errors.push(type);resolve();};im.src='assets/fantasy/'+type+'-v1.png';})));
// New 0.11 buildings get purpose-built architecture, never an unrelated PNG donor.
const FPA_NEW_TYPES=new Set(['house','well','tradepost','infirmary','pier','fisherhut','library','herohall','watchtower','magiccircle']);
const FPA_CODE_ASSETS=new Map();
function fpaCodeAsset(type,vr=0){
 const codeKey=type+':'+vr;if(FPA_CODE_ASSETS.has(codeKey))return FPA_CODE_ASSETS.get(codeKey);
 const cv=mkCanvas(360,360),c=cv.getContext('2d');c.scale(2,2);c.imageSmoothingEnabled=false;
 const OUT='#392719',WOOD='#76502c',HI='#c1914c',STONE='#a49c77';
 const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const poly=(pts,col)=>{c.beginPath();c.moveTo(...pts[0]);for(const p of pts.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=col;c.fill();};
 const line=(x,y,X,Y,col,w=1)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();};
 const stone=(x,y,w,h)=>{rect(x-1,y-1,w+2,h+2,OUT);rect(x,y,w,h,STONE);for(let yy=0;yy<h;yy+=6){line(x,y+yy,x+w,y+yy,'#766d52');for(let xx=(yy%12?0:6);xx<w;xx+=12){line(x+xx,y+yy,x+xx,y+Math.min(h,yy+6),'#766d52');rect(x+xx+2,y+yy+1,7,1,'#c7bd92');}}};
 const door=(x,y,w=15,h=27)=>{rect(x-2,y-2,w+4,h+4,OUT);rect(x,y,w,h,'#76502e');for(let xx=2;xx<w;xx+=4)rect(x+xx,y,1,h,'#a57640');rect(x,y+5,w,2,'#3f3426');rect(x,y+h-7,w,2,'#3f3426');rect(x+w-4,y+h/2,2,2,'#e0bc59');};
 const win=(x,y,w=13,h=16)=>{rect(x-2,y-2,w+4,h+4,OUT);rect(x,y,w,h,'#f4b953');rect(x+1,y+1,w-2,h/2,'#ffdf87');rect(x+w/2,y,1,h,'#754522');rect(x,y+h/2,w,1,'#754522');rect(x-3,y+h+1,w+6,2,HI);};
 const roof=(x,y,w,h,col='#56773e')=>{poly([[x-4,y],[x+w*.48,y-h],[x+w+19,y-6],[x+w+6,y+13],[x-4,y+17]],OUT);poly([[x,y],[x+w*.48,y-h+4],[x+w+14,y-5],[x+w+3,y+10],[x,y+13]],col);for(let yy=0;yy<h;yy+=5){const a=yy/h;line(x+w*.48*(1-a),y-h+5+yy,x+w+9-(yy*.15),y-4+yy*.4,'#344b2b',1);line(x+w*.48*(1-a)+1,y-h+6+yy,x+w+8-(yy*.15),y-3+yy*.4,'#90a95a',1);}line(x-3,y+16,x+w*.45,y-h+1,HI,3);line(x+w*.45,y-h+1,x+w+17,y-5,HI,3);};
 const shell=(x,y,w,h,col='#dab57b')=>{poly([[x,y],[x+w,y-8],[x+w+21,y+3],[x+w+21,y+h-7],[x+w,y+h+4],[x,y+h]],OUT);rect(x+2,y+2,w-3,h-3,col);poly([[x+w,y-5],[x+w+18,y+4],[x+w+18,y+h-9],[x+w,y+h+1]],'#9e7749');rect(x+2,y+h-6,w-3,6,'#867451');for(const xx of [x+4,x+w*.45,x+w-5])rect(xx,y+2,3,h-8,WOOD);rect(x,y+12,w,3,WOOD);rect(x,y+h-12,w,3,WOOD);};
 const barrel=(x,y)=>{rect(x-5,y-14,11,14,OUT);rect(x-4,y-13,9,12,'#a16d37');rect(x-4,y-10,9,2,'#4c493b');rect(x-4,y-4,9,2,'#4c493b');rect(x-2,y-12,1,10,'#c4924b');};
 if(type==='magiccircle'){
  for(let i=0;i<64;i++){const a=i*Math.PI/32,x=90+Math.cos(a)*58,y=108+Math.sin(a)*27;rect(x-2,y-1,4,3,i%3?'#8eaaab':'#d4dfb7');}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,x=90+Math.cos(a)*44,y=108+Math.sin(a)*20;line(x-2,y-3,x+2,y+3,'#bba7de');line(x-2,y+2,x+2,y-2,'#bba7de');}
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7,x=90+Math.cos(a)*64,y=108+Math.sin(a)*31;stone(x-5,y-12,10,15);rect(x-1,y-9,2,7,'#a78ed5');}
  stone(81,91,18,16);rect(83,89,14,4,'#b29ecb');
 }else if(type==='pier'){
  // The pier is a timber deck over water, with posts, ropes and a mooring.
  poly([[18,99],[129,82],[163,103],[50,127]],OUT);poly([[21,99],[129,85],[158,103],[50,123]],'#ab8249');for(let i=0;i<14;i++){const x=23+i*8;line(x,99-i*1.0,x+28,119-i*1.0,'#62472b',2);line(x+1,98-i,x+28,116-i,'#d1a463');}for(const [x,y]of [[24,98],[53,122],[131,86],[156,104]]){rect(x-2,y-3,4,22,WOOD);rect(x-3,y-5,6,4,HI);}line(25,95,131,82,'#c9b87c',1);barrel(112,105);rect(137,102,8,6,'#635744');
 }else if(type==='well'){
  // Visible empty stone shaft, bucket, windlass, and pitched shelter.
  for(const x of [49,119]){rect(x-3,67,7,74,OUT);rect(x-2,67,5,72,WOOD);rect(x-1,69,1,66,HI);}stone(56,116,61,27);poly([[54,117],[82,107],[118,116],[90,129]],OUT);poly([[62,117],[83,111],[110,117],[89,123]],'#252b25');line(52,88,124,88,WOOD,5);line(52,87,124,87,HI);line(88,88,88,118,'#b9aa77');rect(83,112,12,12,'#825b31');rect(82,112,14,2,'#c7ad74');roof(40,69,86,29,'#688143');
 }else if(type==='watchtower'){
  stone(63,77,49,68);shell(47,50,76,37,'#d6bd8d');roof(42,47,82,38,'#6d7850');for(const x of [52,71,91,111])rect(x,56,4,19,OUT);door(78,116,15,27);for(const y of [90,101,112])rect(99,y,4,8,'#34352b');line(131,56,131,20,WOOD,2);poly([[132,22],[149,27],[132,34]],'#b54b37');
 }else{
  const cfg={house:[48,82,72,60,'#587b3d'],tradepost:[35,82,92,58,'#7a5943'],infirmary:[41,75,84,64,'#8c674d'],fisherhut:[48,91,62,47,'#426c76'],library:[37,73,91,67,'#6d5f85'],herohall:[33,68,98,74,'#884936']}[type];
  const [x,y,w,h,rc]=cfg;shell(x,y,w,h,type==='infirmary'?'#e4d3a7':'#dbb985');roof(x-5,y-5,w+5,37,type==='house'?['#587b3d','#985936','#5a7581','#7b6587','#957644','#3f6e61','#875151','#6f7d56'][vr%8]:rc);door(x+w*.47,y+h-29,16,27);win(x+9,y+24);win(x+w-25,y+21);
  stone(x+w+3,y-29,10,28);rect(x+w+1,y-32,14,4,'#c4b996');
  if(type==='house'){win(x+w*.47,y-16,11,12);rect(x+2,y+h-1,w+16,3,'#b9aa81');}
  if(type==='tradepost'){for(let i=0;i<8;i++)poly([[x-6+i*13,y+32],[x+7+i*13,y+30],[x+10+i*13,y+46],[x-3+i*13,y+48]],i%2?'#d9ba76':'#7d9155');for(const xx of [x-4,x+w+7])rect(xx,y+47,3,31,WOOD);rect(x-4,y+68,w+14,7,'#8f6338');for(let i=0;i<6;i++)rect(x+3+i*13,y+61,9,6,['#bc6c35','#7c943c','#d2b263'][i%3]);barrel(x+w+21,y+h);}
  if(type==='infirmary'){rect(x+w*.46,y+7,16,16,'#eee4bd');rect(x+w*.46+6,y+9,4,12,'#aa4335');rect(x+w*.46+2,y+13,12,4,'#aa4335');for(let i=0;i<3;i++){rect(x-7+i*8,y+h+4,6,5,'#795331');rect(x-5+i*8,y+h-4,2,9,'#658541');rect(x-7+i*8,y+h-2,6,2,'#7c9d4b');}}
  if(type==='fisherhut'){for(let i=0;i<6;i++){line(x+w+3+i*3,y+12,x+w+19-i,y+49,'#beb58a');line(x+w+3,y+14+i*6,x+w+19,y+13+i*6,'#beb58a');}line(x-7,y+20,x-7,y+56,WOOD,2);poly([[x-9,y+31],[x-5,y+29],[x-3,y+38],[x-7,y+43]],'#aaa992');barrel(x+w+21,y+h+4);}
  if(type==='library'){rect(x+w*.5-7,y+5,19,13,OUT);rect(x+w*.5-5,y+7,7,9,'#edd1a0');rect(x+w*.5+3,y+7,7,9,'#caa96c');for(let i=0;i<5;i++)rect(x+w+5+i*3,y+24,2,14,['#90523c','#687b50','#a78d43'][i%3]);}
  if(type==='herohall'){for(const xx of [x+9,x+w-18]){rect(xx,y+3,12,26,'#9d342c');poly([[xx,y+28],[xx+6,y+34],[xx+12,y+28]],'#9d342c');rect(xx+5,y+8,2,14,'#dfb956');rect(xx+2,y+12,8,2,'#dfb956');}poly([[x+w*.5-5,y-12],[x+w*.5+7,y-12],[x+w*.5+5,y-1],[x+w*.5+1,y+2],[x+w*.5-3,y-1]],'#d0a247');}
 }
 const asset={image:cv,bounds:fpaBounds(cv),procedural:true};FPA_CODE_ASSETS.set(codeKey,asset);return asset;
}
// Restore the fixtures that lived in the replaced native static canvas.
// Native inside.js keeps its worker/child/animal animation and exact anchors.
function fpaPaintProps(c,s,k,type){
 c.save();c.scale(k,k);c.imageSmoothingEnabled=false;
 const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const bench=(p,w=17)=>{const[x,y]=p;r(x-w/2,y-5,w,3,'#543821');r(x-w/2,y-5,w,1,'#c79854');r(x-w/2+2,y-2,2,5,'#6b482b');r(x+w/2-3,y-2,2,5,'#6b482b');};
 const block=(p,w=15,h=9)=>{const[x,y]=p;r(x-w/2-1,y-h-1,w+2,h+2,'#414437');r(x-w/2,y-h,w,h,'#a5a58c');r(x-w/2,y-h,w,2,'#d2d0ac');r(x+w/2-3,y-h,3,h,'#797f6c');};
 if(type==='inn'){
  for(const p of s.seats||[])bench(p,9);
  if(s.oven){const[x,y]=s.oven;r(x-10,y-17,21,23,'#503a2a');r(x-9,y-16,19,20,'#c09963');for(let i=0;i<4;i++){r(x-9,y-14+i*5,19,1,'#8b6643');r(x-3+(i%2)*5,y-15+i*5,1,5,'#8b6643');}r(x-6,y-7,13,9,'#352b23');r(x-8,y+3,17,3,'#d0ad79');}
  if(s.spit){const[x,y]=s.spit;r(x-12,y-7,2,13,'#6e4c2c');r(x+11,y-7,2,13,'#6e4c2c');r(x-12,y-4,25,1,'#4b4536');r(x-5,y-4,11,6,'#a87537');r(x-4,y-4,8,2,'#d7a65c');}
  for(const p of s.pantry||[]){r(p[0]-5,p[1]+2,10,2,'#88603c');r(p[0]-5,p[1]+2,1,5,'#573e29');}
 }
 if(type==='school'&&s.play){const P=s.play;for(const p of P.swing||[]){const[x,y]=p;r(x-10,y-30,2,33,'#6d4b2c');r(x+10,y-30,2,33,'#6d4b2c');r(x-11,y-31,24,3,'#bf9653');r(x-4,y-28,1,23,'#b5a475');r(x+5,y-28,1,23,'#b5a475');bench([x,y],12);}if(P.read)bench(P.read,18);if(P.hop){const[x,y]=P.hop;c.strokeStyle='#d6ccb0';c.lineWidth=.6;for(let i=0;i<4;i++)c.strokeRect(x-3+(i%2)*3,y-i*4,6,4);}if(P.sand){const[x,y]=P.sand;r(x-10,y-5,22,12,'#856138');r(x-9,y-4,20,9,'#d8bd7c');}if(P.garden){const[x,y]=P.garden;r(x-9,y-4,20,10,'#745b36');for(let i=0;i<5;i++)r(x-7+i*4,y-3,2,8,'#87a354');}if(P.seesaw){const p=P.seesaw;r(p[0][0],p[0][1]-3,p[1][0]-p[0][0],3,'#a97940');}if(P.slide){const[x,y]=P.slide;r(x,y-16,3,20,'#87613c');for(let i=0;i<12;i++)r(x+i,y-12+i,5,2,'#acb0a0');}}
 if(type==='sawmill'&&s.saw){const[x,y]=s.saw;bench([x,y+7],32);r(x-18,y-3,36,5,'#a97943');c.fillStyle='#b5b8a6';c.beginPath();c.arc(x,y,s.sawR||10,0,Math.PI*2);c.fill();r(x-2,y-2,4,4,'#535a4d');}
 if(type==='quarry'&&s.block)block(s.block,19,13);
 if(s.glow){const[x,y]=s.glow;r(x-1,y+1,2,10,'#6d4b2b');r(x-3,y-4,6,6,'#54412b');r(x-2,y-3,4,4,'#f1b84c');}
 for(const p of s.stock||[])if(Array.isArray(p))bench([p[0],p[1]+1],9);
 const penRects=s.penRects||(s.penRect?[s.penRect]:[]);for(const p of penRects){if(!Array.isArray(p)||p.length<4)continue;const[x,y,w,h]=p;for(let i=0;i<=w;i+=10){r(x+i,y-6,2,7,'#74512f');r(x+i,y+h-6,2,7,'#74512f');}r(x,y-4,w,1,'#bc9252');r(x,y+h-4,w,1,'#bc9252');}
 c.restore();
}
const fpaNativeBuilding=buildingSprite,fpaCanvasIDs=new WeakMap();let fpaCanvasID=0;
buildingSprite=function(type,rot=0,level=1,settle,vr=0){
 const base=fpaNativeBuilding(type,rot,level,settle,vr),a=FantasyPublishedArt.images[type==='bonfire'?'bonfire-hearth':type]||(FPA_NEW_TYPES.has(type)?fpaCodeAsset(type,vr):null);if(!a)return base;
 if(!fpaCanvasIDs.has(base.canvas))fpaCanvasIDs.set(base.canvas,++fpaCanvasID);const key=[type,rot,level,settle,vr,fpaCanvasIDs.get(base.canvas)].join('|');if(FantasyPublishedArt.cache.has(key))return FantasyPublishedArt.cache.get(key);
 const cv=mkCanvas(Math.round(base.w*2),Math.round(base.h*2)),c=cv.getContext('2d'),k=2;
 // Match the native architecture envelope: activities retain every native anchor.
 const depth=bDims(type,rot).h*TILE, special=['bonfire','pier','well','magiccircle'].includes(type);
 const yard=type==='inn'?40:type==='school'?38:25;
 const b=a.bounds;
 const worldW=base.fw||bDims(type,rot).w*TILE;
 const artW=(type==='inn'?worldW*.63:type==='farm'?worldW*.72:type==='sawmill'||type==='brewery'?worldW*.60:worldW-12)*k;
 const artH=(type==='inn'?92:type==='school'?106:type==='farm'?85:type==='sawmill'||type==='brewery'?80:Math.min(110,(BUILDINGS[type].top||70)+16))*k;
 const box=special?fpaBounds(base.canvas).map(v=>v*(2/(base.canvas.width/base.w))):[(base.padx+5)*k,(base.top+depth-yard)*k-artH,Math.max(12*k,artW),artH];
 const scale=Math.min(box[2]/b[2],box[3]/b[3]),w=b[2]*scale,h=b[3]*scale,x=box[0]+(box[2]-w)/2,y=box[1]+box[3]-h;

 c.imageSmoothingEnabled=false;c.save();if(rot===1||rot===2){c.translate(x*2+w,0);c.scale(-1,1);}c.drawImage(a.image,...b,x,y,w,h);c.restore();
 if(type==='house'&&vr){const palette=['#587b3d','#a15a37','#4b7c88','#82618e','#a08442','#3f7661','#a35555','#687a52'],rgb=hexToRgb(palette[vr%8]);const d=c.getImageData(0,0,cv.width,cv.height),p=d.data;for(let yy=0;yy<Math.min(cv.height,y+h*.62);yy++)for(let xx=0;xx<cv.width;xx++){const i=(yy*cv.width+xx)*4;if(p[i+3]&&p[i+1]>p[i]*1.08&&p[i+1]>p[i+2]*1.1){const light=Math.max(.35,Math.min(1.6,p[i+1]/115));for(let q=0;q<3;q++)p[i+q]=Math.min(255,rgb[q]*light);}}c.putImageData(d,0,0);}
 if(type==='house'){
  const trim=['#7b522c','#a4773b','#6c6267','#8e6146','#5f7652','#90753d','#7c5967','#7b6951'][vr%8];
  c.fillStyle=trim;c.fillRect(x+w*.2,y+h*.68,2*k,7*k);c.fillRect(x+w*.62,y+h*.68,2*k,7*k);
  c.fillStyle='#ebc787';for(let i=0;i<=(vr%4);i++)c.fillRect(x+w*.35+i*2*k,y+h*.8,k,k);
 }
 const artEra=buildingEra(type,level,settle);
 if(artEra>=2&&!['bonfire','pier','well','magiccircle'].includes(type)){
  c.fillStyle=artEra>=3?'#d3ae5e':'#9d743e';c.fillRect(x+w*.3,y+h*.84,w*.28,1*k);
  if(artEra>=3){c.fillRect(x+w*.3,y+h*.84-2*k,k,3*k);c.fillRect(x+w*.58,y+h*.84-2*k,k,3*k);}
 }
 if(type==='magiccircle'&&level>=2){c.strokeStyle=level>=3?'#d8c080':'#bca3da';c.lineWidth=k;c.beginPath();c.ellipse(x+w*.5,y+h*.6,w*.3,h*.21,0,0,Math.PI*2);c.stroke();}
 if(level>=2&&type!=='pier'&&type!=='magiccircle'&&type!=='bonfire'){
  c.fillStyle='#523a25';c.fillRect(x+w*.15,y+h*.37,2*k,16*k);c.fillStyle=level>=3?'#8d3c77':'#b34132';c.fillRect(x+w*.15+2*k,y+h*.37,9*k,6*k);c.fillStyle='#f1cc6c';c.fillRect(x+w*.15+5*k,y+h*.37+2*k,2*k,3*k);
  if(level>=3){c.fillStyle='#f0cb67';c.fillRect(x+w*.5,y-3*k,2*k,7*k);c.fillRect(x+w*.5-2*k,y-2*k,6*k,2*k);}
 }fpaPaintProps(c,base,k,type);const shadow=mkCanvas(cv.width,cv.height),sc=shadow.getContext('2d');sc.fillStyle='rgba(27,31,15,.22)';sc.beginPath();sc.ellipse(x+w*.5,y+h-2*k,w*.46,7*k,0,0,Math.PI*2);sc.fill();const spr={...base,shadow,canvas:cv,_publishedArt:true,_publishedArtSource:a.procedural?'procedural:'+type:'png:'+type};if(base.wins?.length)spr.wins=base.wins.map((q,i)=>[(x+w*(i%2?.68:.28))/k,(y+h*.68)/k,Math.min(q[2],9),Math.min(q[3],10),q[4]]);if(base.bar)spr.bar=[(x+w*.5)/k,(y+h*.45)/k];spr.perches=[[((x+w*.45)/k),((y+8*k)/k)]];if(['well','watchtower','pier','magiccircle','graveyard','goatpen','stable'].includes(type))spr.chimneys=null;else if(base.chimneys?.length)spr.chimneys=[[((x+w*.8)/k),((y+6*k)/k)],...(type==='inn'&&base.oven?[[base.oven[0],base.oven[1]-13]]:[])];FantasyPublishedArt.cache.set(key,spr);return spr;
};
const fpaNativeBuildingDraw=drawBuilding;
drawBuilding=function(c,b,...args){const prev=FantasyPublishedArt.drawingType;FantasyPublishedArt.drawingType=b.type;try{return fpaNativeBuildingDraw(c,b,...args);}finally{FantasyPublishedArt.drawingType=prev;}};
const fpaNativeFlames=drawBonfireFlames;
drawBonfireFlames=function(c,x,y,strong,seed,mul=1){if(FantasyPublishedArt.drawingType&&FantasyPublishedArt.drawingType!=='bonfire')return;const a=FantasyPublishedArt.images['bonfire-flames'];if(!a||!strong)return fpaNativeFlames(c,x,y,strong,seed,mul);const f=a.frames[((Math.floor(Game.time*9+seed)%8)+8)%8],s=Math.min(34/a.maxW,45/a.maxH)*mul;c.save();c.imageSmoothingEnabled=false;glow(c,x,y-8,52*mul,'255,167,65',.2);c.drawImage(a.image,...f,x-f[2]*s/2,y-f[3]*s,f[2]*s,f[3]*s);c.restore();};
function faSliceFrames(art, pixels, width, height, cols, rows) {
  art.frames = []; art.maxW = 0; art.maxH = 0;
  for (let row = 0; row < rows; row++) {
    const top = Math.floor(row * height / rows), bottom = Math.floor((row + 1) * height / rows);
    // Generated sheets can have slightly uneven outer padding. Detect the
    // transparent gutters rather than cutting a hand/hat at a nominal cell edge.
    const runs = []; let start = -1, last = -1;
    const gap = Math.max(3, Math.floor(width / cols * 0.035));
    for (let x = 0; x <= width + gap; x++) {
      let count = 0;
      if (x < width) for (let y = top; y < bottom; y++) if (pixels[(y * width + x) * 4 + 3] >= 128) count++;
      if (count >= 3) { if (start < 0) start = x; last = x; }
      else if (start >= 0 && x - last > gap) { if (last - start > width / cols * 0.2) runs.push([start, last + 1]); start = -1; }
    }
    const groups = runs.length >= cols ? runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, cols).sort((a, b) => a[0] - b[0]) : null;
    for (let col = 0; col < cols; col++) {
    const left = groups ? groups[col][0] : Math.floor(col * width / cols);
    const right = groups ? groups[col][1] : Math.floor((col + 1) * width / cols);
    let x0 = right, x1 = left - 1, y0 = bottom, y1 = top - 1;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 128) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const f = x1 < x0 ? [left, top, 1, 1] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
    art.maxW = Math.max(art.maxW, f[2]); art.maxH = Math.max(art.maxH, f[3]); art.frames.push(f);
    }
  }
}

const faNativePersonSprite = personSprite;
const FA_RENDER_CACHE = FantasyPublishedArt.people;
// The infirmary's yard worker is a presentation role, not a simulation job.
OUTFIT.healer = { ...OUTFIT.serf, cap: '#739887', coat: '#3e675a' };
const FPA_WORK_ARC = {chop:-.48,mine:-.13,build:.42,reap:.12,dig:.34,hoppick:-.28,douse:.26};
// The quarry yard emits its first chips on frame 4. Both clocks use the same strike pose.
const FPA_MINE_ANGLES=[1.2,1,.8,.55,.22,-.12,-.4,-.52,.49,2.28,2.4,1.68];
const FPA_YARD_MINE_ANGLES=[1.2,1,.8,.55,.22,-.12,-.4,-.52,.49,1.38,.96,1.2];
const FPA_YARD_MINE_PHASES=[0,2,5,7,9,10,11,1];
const FPA_WOODCUT_ANGLES=[1.45,1.15,.8,.38,.02,-.32,-.71,-.94,.46,2.12,2.4,1.91];
const FPA_FIELD_ANGLES={
 sow:[1.98,1.82,1.66,1.48,1.27,1.07,.93,.79,1.65,2.52,2.75,2.24],
 wheat:[2.3,2.19,2.04,1.9,1.75,1.58,1.39,1.18,1.75,2.28,2.48,2.15],
 hay:[2.22,2.13,2.02,1.83,1.71,1.62,1.5,1.38,1.86,2.35,2.55,2.22],
 hops:[1.35,1.17,.98,.79,.63,.48,.33,.21,.8,1.36,1.72,1.47],
 fork:[1.89,1.74,1.55,1.37,1.19,1.08,.91,.77,1.58,2.32,2.46,1.93],
};
function fpaMinePhase(frame) {
  return Math.max(0,Math.min(11,frame.f|0));
}
function fpaBodyMotion(view,pose,frame,opt) {
  if(opt.sowRigBase)return [0,0];
  if(pose==='fight'){const f=FIGHT_BODY[frame]||FIGHT_BODY.ready;return [f[0]*.42,f[1]];}
  if(pose==='idle')return [0,-(IDLE_BREATH[Number(frame)%IDLE_FRAMES]||0)];
  if(view!=='E'&&view!=='W')return [0,pose==='duck'||pose==='tame'?2:0];
  if(pose==='work'){
    const f=frame.f|0;
    if(opt.fieldWork)return [(1.25-FPA_FIELD_ANGLES[opt.fieldWork][fpaMinePhase(frame)])*.1,0];
    if(frame.anim==='toss')return [-(TOSS_DIP[f]||0)*.23,0];
    if(frame.anim==='pat')return [-.1-((PAT_A[f]??1.8)-1.8)*.12,0];
    if(frame.anim==='mine'){
      const angles=opt.yardMining?FPA_YARD_MINE_ANGLES:FPA_MINE_ANGLES;
      return [(1.14-angles[fpaMinePhase(frame)])*.12+.025,0];
    }
    if(frame.anim==='chop'&&opt.woodcutting){
      const angle=FPA_WOODCUT_ANGLES[fpaMinePhase(frame)];
      return [opt.woodcutting==='tree'?.14+(1.14-angle)*.025:(1.14-angle)*.12,0];
    }
    const angle=SWING_A[f]??SWING_A[SWING_A.length-1];
    return [(1.14-angle)*.12+(FPA_WORK_ARC[frame.anim]||0)*.19,0];
  }
  if(pose==='duck'||pose==='tame'){
    const phase=[0,.35,.8,1,.62,.2][Number(frame)]||0;
    return [-phase*(opt.posture==='forage'?.22:pose==='tame'?.12:.16),2];
  }
  return [0,0];
}
personSprite = function (u, view, pose, frame, opt = {}) {
  if(pose==='work'&&!Object.prototype.hasOwnProperty.call(ANIM_TOOL,frame?.anim))return faNativePersonSprite(u,view,pose,frame,opt);
  if(window.FantasyPublishedAppearance)u=FantasyPublishedAppearance.resolve(u).holder||u;
  const child=u.type==='kid';
  const female = personSex(u)==='f' || !!OUTFIT[u.type]?.fem || u.type === 'waitress';
  const art = FantasyArt.images[child?'gnome-child':female ? 'gnome-woman-walk' : 'gnome-walk'];
  if (!art || !OUTFIT[u.type]) {
    return faNativePersonSprite(u, view, pose, frame, opt);
  }
  const f = pose === 'walk' ? Math.floor((frame % WALK_FRAMES) * 8 / WALK_FRAMES) : 0;
  const row = view === 'E' ? 1 : view === 'N' ? 2 : 0;
  const workF = pose === 'work' ? frame.f : 0;
  const variant = u.look >>> 0;
  const normalizedLook=(u.look>>>0)>=0x20000?u.look:LOOK_POOL[(u.look>>>0)%LOOK_POOL.length];
  // Cache the phase actually consumed by the pose helpers. Atlas frame zero
  // alone cannot distinguish breathing or the named native fight states.
  const phaseKey=pose==='idle'?(Number(frame)||0)%IDLE_FRAMES:pose==='walk'?(Number(frame)||0)%WALK_FRAMES:pose==='fight'?String(frame):pose==='work'?`${frame.anim}:${frame.f}`:frame;
  const key = [u.type, female?'f':'m',u.sx||'', variant, view, pose, f, workF, phaseKey, pose === 'work' ? frame.anim : '', u.carry, opt.carryN || u.carryN || 1, opt.gest, opt.gest?opt.gf:0, opt.wpn, opt.gait, opt.nohat, opt.posture, opt.yardMining, opt.woodcutting, opt.fieldWork, opt.externalWorkTool, opt.sowRigBase, u.injury].join('|');
  if (FA_RENDER_CACHE.has(key)) return FA_RENDER_CACHE.get(key);
  const cv = mkCanvas(PW * PART, PH * PART), c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false; c.scale(PART, PART);
  const src = art.frames[child?((pose==='work'?4:0)+(pose==='walk'?Math.floor((frame%WALK_FRAMES)*4/WALK_FRAMES):pose==='work'?Math.floor((frame.f%WORK_FRAMES)*4/WORK_FRAMES):0)):row*8+f];
  const scale = Math.min((child?21:25) / art.maxW, (child?27:33) / art.maxH);
  const dw = src[2] * scale, dh = src[3] * scale;
  const [shear,dip]=fpaBodyMotion(view,pose,frame,opt);
  c.save();c.translate(PFX,PFY);c.transform(1,0,shear,1,0,dip);c.drawImage(art.image,...src,Math.round(-dw/2),Math.round(-dh),Math.round(dw),Math.round(dh));c.restore();
  fpaCleanAtlasArms(cv,u,view,pose,frame,opt,{dw,dh,dip,shear});
  // Preserve value ramps while mapping the source green uniform to the exact
  // profession colors already defined by this game (hat and coat separately).
  if (!female&&!child) {
    const O = OUTFIT[u.type], L = lookOf({...u,look:normalizedLook});
    const cap = O.cap === 'serf' ? L.serfCap : O.cap === 'wizard' ? '#657d36' : O.cap === 'baker' ? '#eee5cf' : O.cap;
    const capRGB = hexToRgb(cap), coatRGB = hexToRgb(O.coat || L.green);
    const data = c.getImageData(0, 0, cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4, p = data.data;
      if (!p[i + 3] || p[i] > 185 || p[i + 2] > 110 || p[i + 1] < p[i] * 0.83 || p[i + 1] < p[i + 2] * 1.35) continue;
      const target = y < (PFY - dh + dh * 0.31) * PART ? capRGB : coatRGB;
      const light = Math.max(0.35, Math.min(1.5, p[i + 1] / 119));
      for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, Math.round(target[k] * light));
    }
    c.putImageData(data, 0, 0);
  }
  if (u.carry)fpaCarryLoad(c,u,view,pose,opt);
  if (pose === 'work'&&!opt.externalWorkTool) fpaDrawWorkTool(c,{...u,look:normalizedLook},view,frame,opt);
  if (pose === 'smoke') {
    const rig = fpaSmokingRig(u, view, frame), O = OUTFIT[u.type];
    const coat = O.coat || '#66863d', hx = PFX + rig.hand[0], hy = PFY + rig.hand[1];
    pline(c, PFX + 4, PFY - 12, hx, hy, '#3e2c20', 3);
    pline(c, PFX + 4, PFY - 12, hx, hy, coat, 2);
    faRect(c, hx, hy, 2, 2, '#efc394');
  }
  fpaAction(c,u,view,pose,frame,opt);
  if (FA_RENDER_CACHE.size > 1600) FA_RENDER_CACHE.delete(FA_RENDER_CACHE.keys().next().value);
  const out=mkCanvas(PW*2,PH*2),oc=out.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(cv,0,0,out.width,out.height);FA_RENDER_CACHE.set(key,out); u._spr=out;
  return out;
};

function fpaSmokingRig(u,view,frame){const v=view==='E'?'E':'S';return {hand:SMOKE_ARM[v].hand[Number(frame)%SMOKE_ARM[v].hand.length],mouth:SMOKE_MOUTH[v]};}
function fpaTrunkGrip(u,pose){
 return u.type==='woodcutter'&&u.carry==='trunk'&&(pose==='idle'||pose==='walk');
}
function fpaCropGrip(u,pose){
 return (u.carry==='wheat'||u.carry==='hay'||u.carry==='hops')&&
   (u.type==='farmer'||u.type==='hopgrower'||u.type==='builder')&&(pose==='idle'||pose==='walk');
}
function fpaBoxGrip(u,pose){
 return (u.carry==='crate'||u.carry==='bread')&&(pose==='idle'||pose==='walk');
}
const FPA_CRATE_HOLD=[4,24.5];
const fpaNativeDrawLoad=drawLoad;
drawLoad=function(c,g){
 if(g!=='crate')return fpaNativeDrawLoad(c,g);
 fpaSowPolygon(c,[[-4.75,-2.5],[-2.75,-4],[4.5,-4],[5,-2.25],[5,5],[-4.75,5]],'#3b291e');
 fpaSowPolygon(c,[[-4.25,-2],[-2.5,-3.5],[4,-3.5],[4.5,-2],[-2,-1.75]],'#c79960');
 fpaSowPolygon(c,[[-4.25,-1.75],[4.5,-1.75],[4.5,3],[-4.25,3]],'#9d6940');
 fpaSowPolygon(c,[[-4.25,-1.75],[-2.75,-1],[-2.75,3],[-4.25,3]],'#6b442c');
 c.fillStyle='#67442b';c.fillRect(-2.5,0,7,.5);c.fillRect(-2.5,1.5,7,.5);
 c.fillStyle='#c18c53';c.fillRect(-3.25,-1.75,1,4.75);c.fillRect(3.25,-1.75,1,4.75);
 c.fillStyle='#d8bd82';c.fillRect(-3,-1.25,.5,.5);c.fillRect(3.5,-1.25,.5,.5);
 c.fillStyle='#67442b';c.fillRect(-4.25,3,8.75,1.5);
 c.fillStyle='#ae7745';c.fillRect(-4.25,3,8.75,.5);
 c.fillStyle='#58645b';c.fillRect(-3,2,.5,.5);c.fillRect(3.5,2,.5,.5);
};
function fpaCarryLoad(c,u,view,pose,opt){
 const n=opt.carryN||u.carryN||1;
 const crop=fpaCropGrip(u,pose),box=fpaBoxGrip(u,pose),crate=u.carry==='crate';
 if(!fpaTrunkGrip(u,pose)&&!crop&&!box){
   c.save();
   c.translate(PFX,u.carry==='trunk'?13:23);
   if(u.carry==='trunk')c.scale(1.4,1.2);
   drawLoads(c,u.carry,n);
   c.restore();
   return;
 }
 const profile=view==='E'||view==='W',back=view==='N';
 const look=(u.look>>>0)>=0x20000?u.look:LOOK_POOL[(u.look>>>0)%LOOK_POOL.length];
 const features=lookOf({...u,look}),skin=SKINS[features.skin%SKINS.length][0];
 const coat=OUTFIT[u.type].coat||features.green;
 const centerX=box?(profile?crate?FPA_CRATE_HOLD[0]:2.2:0):profile?1:back?-2.2:0;
 const centerY=box?FPA_CRATE_HOLD[1]:crop?24.7:25.5;
 const narrow=crop&&u.carry==='hops';
 const arms=box?[
   {shoulder:[profile?1.5:4.5,22],grip:[centerX+4.5,centerY+.75],shade:-.22},
   {shoulder:[profile?-3.5:-4.5,22],grip:[centerX-4.25,centerY+1.25],shade:0}
 ]:profile?[
   {shoulder:[1.5,22.5],grip:[narrow?3.8:6,25],shade:-.22},
   {shoulder:[-3,22],grip:[-2,crop?25.5:26.5],shade:0}
 ]:[
   {shoulder:[-4.5,22],grip:[back?-6:narrow?-3.2:-5.5,26],shade:-.12},
   {shoulder:[4.5,22],grip:[back?4.2:narrow?3.2:5.5,back?26.5:25.5],shade:0}
 ];
 c.save();
 c.translate(PFX,0);
 if(back){
   // From behind, the torso covers the log held in front of the body.
   c.beginPath();
   const edge=box?3.5:5.2;
   c.rect(-PFX,18,PFX-edge,16);
   c.rect(edge,18,PFX-edge,16);
   c.clip();
 }
 for(const {shoulder,grip,shade:shadow} of arms){
   const elbow=[shoulder[0]+Math.sign(grip[0])*1,shoulder[1]+2.5];
   const width=crop||box?4.5:5.5;
   fpaSowBand(c,shoulder,elbow,width,'#302923');
   fpaSowBand(c,elbow,grip,width-1,'#302923');
   fpaSowBand(c,shoulder,elbow,width-1,shade(coat,shadow));
   fpaSowBand(c,elbow,grip,width-2,shade(coat,shadow+.12));
 }
 c.save();
 c.translate(centerX,centerY);
 c.rotate(crop||box?0:profile?-.08:back?.09:-.09);
 if(crate)c.scale(.62/(YARD_K*2/3),.62/(YARD_K*2/3));
 else c.scale(crop||box?(back?-1:1):profile?1.23:back?-.94:.94,1.03);
 drawLoads(c,u.carry,n);
 c.restore();
 for(const {grip} of arms)hand(c,grip[0],grip[1],skin);
 c.restore();
}
// Remove only the atlas's static skin/sleeve components for actively posed arms.
// Ordinary idle/walk and other carriers take the no-op path.
function fpaCleanAtlasArms(cv,u,view,pose,frame,opt={},geometry={}){
 const cargoGrip=fpaTrunkGrip(u,pose)||fpaCropGrip(u,pose)||fpaBoxGrip(u,pose);
 if((u.carry&&!cargoGrip)||u.type==='kid')return {removed:0,filled:0,components:0};
 const W=opt.wpn?wpnParse(opt.wpn):null,both=cargoGrip||pose==='sawGrip'||pose==='yardGrip'||pose==='work'||pose==='fight'||(W?.out&&(pose==='idle'||pose==='walk'))||['clap','stretch','panic','five','six7'].includes(opt.gest),one=!both&&(!!opt.gest||pose==='smoke'||pose==='tame'||pose==='duck');
 if(!both&&!one)return {removed:0,filled:0,components:0};
 const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height),src=new Uint8ClampedArray(im.data),d=im.data,k=cv.width/PW,w=cv.width,h=cv.height,dh=geometry.dh||33,dw=geometry.dw||25,dip=geometry.dip||0,shear=geometry.shear||0,top=PFY-dh;
 const saw=pose==='sawGrip'||pose==='yardGrip';
 const mask=new Uint8Array(w*h),visited=new Uint8Array(w*h),skin=i=>src[i+3]>=160&&src[i]>(saw?108:140)&&src[i+1]>(saw?67:95)&&src[i+2]>(saw?43:69)&&src[i]>src[i+1]*1.08&&src[i+1]>src[i+2]*1.08;
 const xy=p=>{const y=(Math.floor(p/w)+.5)/k-dip,x=(p%w+.5)/k-shear*(y-PFY);return[x,y];};
 const roi=p=>{const[x,y]=xy(p),a=Math.abs(x-PFX);return y>=top+dh*.5&&y<PFY-5&&a>=(saw?3.5:4.5)&&a<=dw*.57&&!(a<6.5&&y<top+dh*.64);};
 const comps=[];for(let p=0;p<w*h;p++){if(visited[p]||!roi(p)||!skin(p*4))continue;const pixels=[],queue=[p];visited[p]=1;for(let at=0;at<queue.length;at++){const q=queue[at];pixels.push(q);const x=q%w,y=Math.floor(q/w);for(const r of [x?q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1])if(r>=0&&!visited[r]&&roi(r)&&skin(r*4)){visited[r]=1;queue.push(r);}}if(pixels.length>=Math.max(3,k*k*.7)){let x=0,y=0,y0=1e6,y1=-1e6;for(const q of pixels){const a=xy(q);x+=a[0];y+=a[1];y0=Math.min(y0,a[1]);y1=Math.max(y1,a[1]);}comps.push({pixels,x:x/pixels.length,y:y/pixels.length,y0,y1});}}
 let chosen=comps;if(one){const side=view==='N'?-1:1;if(view==='E'||view==='W'){const sorted=comps.slice().sort((a,b)=>a.x-b.x);chosen=sorted.length?[sorted[0]]:[];}else chosen=comps.filter(q=>(q.x-PFX)*side>0);}
 for(const comp of chosen){
  const seed=[];for(let yy=Math.max(0,Math.floor((comp.y0+dip-4)*k));yy<Math.min(h,Math.ceil((comp.y0+dip)*k));yy++)for(let xx=Math.max(0,Math.floor((comp.x-1)*k));xx<Math.min(w,Math.ceil((comp.x+1)*k));xx++){const i=(yy*w+xx)*4;if(src[i+3]>180&&!skin(i)&&Math.max(src[i],src[i+1],src[i+2])>65)seed.push([src[i],src[i+1],src[i+2]]);}
  const cloth=i=>{const a=[src[i],src[i+1],src[i+2]],v=Math.max(...a);if(v<65)return true;return seed.some(b=>{const z=Math.max(...b);return Math.abs(a[0]/v-b[0]/z)+Math.abs(a[1]/v-b[1]/z)+Math.abs(a[2]/v-b[2]/z)<.34;});};
  const queue=comp.pixels.slice(),seen=new Set(queue);for(let at=0;at<queue.length;at++){const q=queue[at],a=xy(q),i=q*4;if(!src[i+3])continue;mask[q]=1;const x=q%w,y=Math.floor(q/w);for(const r of [x?q-1:-1,x<w-1?q+1:-1,y?q-w:-1,y<h-1?q+w:-1]){if(r<0||seen.has(r)||!roi(r))continue;const b=xy(r),j=r*4;if(Math.abs(b[0]-comp.x)>3.2||b[1]<comp.y0-5||b[1]>comp.y1+1||src[j+3]<160||(!skin(j)&&!cloth(j)))continue;seen.add(r);queue.push(r);}}
 }
 let removed=0,filled=0;for(let p=0;p<mask.length;p++)if(mask[p]){const[x,y]=xy(p),i=p*4;if(Math.abs(x-PFX)<=6.2){const step=x<PFX?1:-1;let q=p,didFill=false;while(q>=Math.floor(p/w)*w&&q<(Math.floor(p/w)+1)*w&&Math.abs((q%w+.5)/k-PFX)>1){q+=step;const j=q*4;if(!mask[q]&&src[j+3]>=180&&!skin(j)){d[i]=src[j];d[i+1]=src[j+1];d[i+2]=src[j+2];d[i+3]=src[j+3];filled++;didFill=true;break;}}if(!didFill){d[i+3]=0;removed++;}}else{d[i+3]=0;removed++;}}
 c.putImageData(im,0,0);const result={removed,filled,components:chosen.length,mask,width:w,height:h};FantasyPublishedArt.lastArmCleanup={pose,view,removed,filled,components:chosen.length};return result;
}
// Work props use the current native grip, upper-body pivot and phase tables.
// W is E geometry; native callers mirror the complete actor once at draw time.
function fpaDrawWorkTool(c,u,view,frame,opt={}){
 if(opt.sowRigBase)return {known:true,drawn:false};
 const tool=ANIM_TOOL[frame?.anim],known=['axe','pick','hammer','sickle','spade','hook','toss','pat','bucket'].includes(tool);
 if(!known)return {known:false,drawn:false};
 const mineAngles=opt.yardMining?FPA_YARD_MINE_ANGLES:FPA_MINE_ANGLES;
 const angles=FPA_FIELD_ANGLES[opt.fieldWork]||(tool==='pick'?mineAngles:tool==='axe'&&opt.woodcutting?FPA_WOODCUT_ANGLES:tool==='toss'?TOSS_A:tool==='pat'?PAT_A:tool==='sickle'||tool==='spade'?SWING_SICKLE:SWING_A);
 const f=Math.max(0,Math.min(angles.length-1,frame.f|0));
 const fr={anim:frame.anim,f};
 const windup=tool!=='pick'&&!opt.woodcutting&&!opt.fieldWork&&f<8?Math.sin(f/8*Math.PI):0;
 const a=angles[f]+(FPA_WORK_ARC[frame.anim]||0)*windup,dip=swingDip(fr);
 const lean=tool==='pick'?.1:frame.anim==='reap'||frame.anim==='dig'?.28:frame.anim==='pat'?.42:0,hip=-6.2+dip,sh=-12+dip;
 const O=OUTFIT[u.type]||OUTFIT.serf,L=lookOf(u),skin=SKINS[L.skin%SKINS.length],coat=O.coat||L.green||'#66863d';
 const profile=view==='E'||view==='W';
 c.save();c.translate(PFX,PFY);
 if(!profile&&(tool==='pat'||tool==='toss')){
  const hands=[],phase=f/angles.length*Math.PI*2,front=view==='S';
  for(const side of [-1,1]){
   let hx,hy;if(tool==='pat'){const press=Math.max(0,Math.min(1,(a-1.8)/.9));hx=side*4.2+Math.sin(phase+(side<0?0:Math.PI))*.65;hy=-14+(side<0?press:1-press)*1.5;}
   else if(side===(front?1:-1)){hx=side*(4.2+Math.sin(a)*3.4);hy=-13.5-Math.cos(a)*4.4;}
   else{hx=side*4.4+Math.sin(phase)*.4;hy=-12.5+Math.sin(phase)*.6;}
   const shoulder=-14.5+Math.sin(phase)*.2;
   smoothLimb(c,[side*4.2,shoulder],[side*5.8,(shoulder+hy)/2+1.9],[hx,hy],2.1,side>0===front?shade(coat,-.2):coat);hand(c,hx,hy,skin[1]);hands.push([PFX+hx,PFY+hy]);
  }
  c.restore();return{known:true,drawn:true,projection:'front-working-hands',tool,frame:f,frames:angles.length,hand:hands[1],hands,tip:null};
 }
 // The forward/back views keep the working hand on the actor's right.
 // Foreshorten the swing without changing the native phase or side grip.
 if(!profile&&view==='N')c.scale(-1,1);
 const offset=profile?(opt.woodcutting==='tree'?-1.6:0):4, reach=profile?1:.68;
 if(!profile){
  smoothLimb(c,[-4.2,sh+.6],[-5.4,(sh+hip)/2],[-4.8,hip-.4],2.1,shade(coat,-.25));
  hand(c,-4.8,hip-.4,skin[0]);
 }
 c.translate(0,hip);c.rotate(lean);c.translate(0,-hip);
 const arm=3.8;
 // The pick points into the depth of the scene during the lift. It shows
 // its full shaft at impact, while the shoulder and short arm stay fixed.
 const shaft=opt.fieldWork?(tool==='sickle'?4.7:6.6):tool!=='pick'?6.5:opt.yardMining?6.8:f===9||f===10?9.5:8.1;
 const hx=offset+.4+Math.sin(a)*arm*reach,hy=sh-Math.cos(a)*arm;
 let tx=hx+Math.sin(a)*shaft*reach,ty=hy-Math.cos(a)*shaft;
 let nx=-(ty-hy)/shaft,ny=(tx-hx)/shaft;
 const edge=opt.fieldWork?0:tool==='pick'?3.2:2.4;
 if(opt.workContact){
   const [x,y]=opt.workContact,co=Math.cos(lean),si=Math.sin(lean);
   const cx=x*co+(y-hip)*si,cy=hip-x*si+(y-hip)*co;
   const aim=opt.workAim;
   const dx=cx-hx,dy=cy-hy,length=Math.hypot(dx,dy)||1;
   const targetNX=-dy/length,targetNY=dx/length;
   tx+=(cx-targetNX*edge-tx)*aim;
   ty+=(cy-targetNY*edge-ty)*aim;
   nx+=(targetNX-nx)*aim;
   ny+=(targetNY-ny)*aim;
 }
 if(tool==='spade'&&!opt.fieldWork&&u.type!=='baker'){
   [tx,ty]=fpaFitSpadeToSprite(c,hx,hy,tx,ty);
 }
 smoothLimb(c,[offset+.4,sh+.4],[(offset+.4+hx)/2+.6,(sh+hy)/2+.5],[hx,hy],2.1,coat);
 if(!['toss','pat','bucket','pick'].includes(tool)){
   const handle=[hx-(tx-hx)*.25,hy-(ty-hy)*.25],head=[tx,ty];
   const peel=tool==='spade'&&u.type==='baker';
   fpaSowBand(c,handle,head,peel?1:tool==='spade'?2:1.65,'#39291f');
   fpaSowBand(c,handle,head,peel?.5:.75,'#b58a57');
 }
 if(opt.fieldWork)fpaFieldHead(c,opt.fieldWork==='fork'?'fork':tool,hx,hy,tx,ty);
 else switch(tool){
 case 'toss':case 'pat':break; // Native bare hands; projectile belongs to its native effect.
 case 'bucket':{const bx=hx+Math.sin(a)*2.2,by=hy-Math.cos(a)*2.2;c.fillStyle='#5a3a1e';c.fillRect(Math.round(bx-2),Math.round(by-1),4,3);c.fillStyle='#9a6a3a';c.fillRect(Math.round(bx-2),Math.round(by-1),4,1);c.fillStyle='#3a3a3e';c.fillRect(Math.round(bx-2),Math.round(by),4,1);if(f<5){c.fillStyle='#6ab8ff';c.fillRect(Math.round(bx-1),Math.round(by-2),2,1);}break;}
 case 'axe':{
   const dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
   if(opt.woodcutting){
     fpaSowBand(c,[hx-ux,hy-uy],[tx,ty],2,'#372723');
     fpaSowBand(c,[hx-ux,hy-uy],[tx,ty],.75,'#b58352');
   }
   const at=(along,across)=>[tx+ux*along*1.25+nx*across,ty+uy*along*1.25+ny*across];
   fpaSowPolygon(c,[at(.75,-.8),at(1,.65),at(.45,1.4),at(0,edge),
     at(-1.25,edge+.2),at(-2.6,edge),at(-2.35,1.35),at(-1.2,.35),at(-1.1,-.8)],'#303930');
   fpaSowPolygon(c,[at(.5,.5),at(0,edge-.2),at(-1.3,edge),at(-2.3,edge-.25),
     at(-1.9,1.55),at(-1,.9)],'#869c94');
   line(c,...at(0,edge),...at(-2.1,edge), '#dde5cb',.55);
   line(c,...at(-.65,-.6),...at(-.65,.7),'#c49559',.65);
   break;
 }
 case 'pick':{
   const sx=hx-(tx-hx)*.18,sy=hy-(ty-hy)*.18;
   fpaSowBand(c,[sx,sy],[tx,ty],2,'#302621');
   fpaSowBand(c,[sx,sy],[tx,ty],.85,'#a97a4d');
   const dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy)||1;
   const cx=tx+dx/length*.8,cy=ty+dy/length*.8;
   c.beginPath();
   c.moveTo(tx-nx*4,ty-ny*4);
   c.quadraticCurveTo(cx,cy,tx+nx*3.2,ty+ny*3.2);
   c.strokeStyle='#252b29';
   c.lineWidth=2.5;
   c.stroke();
   c.strokeStyle='#cdd8d1';
   c.lineWidth=1.5;
   c.stroke();
   const at=(along,across)=>[tx+dx/length*along*1.2+nx*across*1.2,ty+dy/length*along*1.2+ny*across*1.2];
   fpaSowPolygon(c,[at(-1.45,-1.15),at(.9,-1.25),at(1.15,.5),at(.3,1.3),
     at(-1.25,1.05)],'#543c2b');
   fpaSowPolygon(c,[at(-1,-.9),at(.65,-.85),at(.85,.45),at(.15,.95),at(-.9,.7)],'#c49559');
   fpaSowPolygon(c,[at(-.75,0),at(-.1,-.7),at(.62,-.2),at(.25,.65),at(-.35,.65)],'#4d9b93');
   fpaSowPolygon(c,[at(-.6,-.1),at(-.1,-.55),at(.35,-.2),at(-.3,.2)],'#c1ebe0');
   break;
 }
 case 'hammer':{
   c.save();c.translate(tx,ty);c.rotate(Math.atan2(ty-hy,tx-hx));
   c.scale(1.25,1.2);
   fpaSowPolygon(c,[[-1,-1.5],[-.5,-2],[1,-2],[1.25,-1.5],
     [1.25,1.5],[.75,2],[-.75,2],[-1,1.5]],'#303930');
   fpaSowPolygon(c,[[-.5,-1.5],[.75,-1.5],[.75,1.5],[-.5,1.5]],'#879790');
   c.fillStyle='#d9e2ca';c.fillRect(-.5,-1.5,1.25,.5);
   c.fillStyle='#c49559';c.fillRect(-.75,-.5,1,.5);
   c.restore();break;
 }
 case 'hook':{
   const end=[tx+(tx-hx)*.9,ty+(ty-hy)*.9];
   fpaSowBand(c,[tx,ty],end,1.65,'#6e4428');
   fpaFieldHead(c,'hook',hx,hy,...end);break;
 }
 case 'sickle':fpaFieldHead(c,'sickle',hx,hy,tx,ty);break;
 case 'spade':{
   if(u.type!=='baker'){fpaSpadeHead(c,hx,hy,tx,ty);break;}
   // The bakery reuses the dig animation for its flat oven peel.
   c.save();c.translate(tx,ty);c.rotate(Math.atan2(ty-hy,tx-hx));
   c.fillStyle='#9e958a';c.fillRect(0,-1.2,2.4,2.4);c.restore();
   break;
 }
 }
 hand(c,hx,hy,skin[1]);c.restore();
 const world=(x,y)=>[PFX+(view==='N'?-1:1)*(x*Math.cos(lean)-(y-hip)*Math.sin(lean)),PFY+hip+x*Math.sin(lean)+(y-hip)*Math.cos(lean)];
 const blade=tool==='pick'||tool==='axe';
 return{known:true,drawn:true,projection:profile?'native-profile':'front-working-tool',tool,frame:f,frames:angles.length,hand:world(hx,hy),tip:world(blade?tx+nx*edge:tx,blade?ty+ny*edge:ty)};
}
function fpaDrawContactTool(c,u,frame,px,py,face,target,progress,options={}){
 const side=face<0?-1:1;
 const look=(u.look>>>0)>=0x20000?u.look:LOOK_POOL[(u.look>>>0)%LOOK_POOL.length];
 const t=Math.max(0,Math.min(1,progress<.5?(progress-.46)/.04:(.86-progress)/.32));
 const aim=t*t*(3-2*t);
 c.save();
 c.translate(px-side*PFX,py-PFY);
 c.scale(side,1);
 const rig=fpaDrawWorkTool(c,{...u,look},'E',frame,{...options,workContact:[(target[0]-px)*side,target[1]-py],workAim:aim});
 c.restore();
 return rig;
}
function fpaDrawQuarryPick(c,u,frame,px,py,face,target,progress){
 return fpaDrawContactTool(c,u,frame,px,py,face,target,progress);
}
function fpaDrawWoodcutAxe(c,u,frame,px,py,face,target,progress,kind){
 return fpaDrawContactTool(c,u,frame,px,py,face,target,progress,{woodcutting:kind});
}
function fpaDrawFieldTool(c,u,frame,px,py,face,target,progress,kind){
 return fpaDrawContactTool(c,u,frame,px,py,face,target,progress,{fieldWork:kind});
}

// Each key controls the hip-to-shoulder lean and the shovel tip, in profile
// and relative to the planted soles. The grips are computed on the same shaft.
// Phase, torso shift, front grip, and shaft rotation relative to ground contact.
const FPA_SOW_KEYS=[
 [0,0,0,2,-12.5,.48], [.16,-.65,-.5,1.5,-14,.72], [.32,-1.4,-1,.5,-15.5,1.04],
 [.50,2,2,4.5,-9.5,0], [.56,2,2,4.5,-9.5,0],
 [.73,.75,.75,3,-11.5,.32], [1,0,0,2,-12.5,.48],
];
let fpaSowCanvas;
function fpaSowPolygon(c,points,color){
 const top=Math.floor(Math.min(...points.map(p=>p[1]))*2)/2;
 const bottom=Math.max(...points.map(p=>p[1]));
 c.fillStyle=color;
 for(let y=top;y<bottom;y+=.5){
   const row=y+.25,edges=[];
   for(let i=0;i<points.length;i++){
     const a=points[i],b=points[(i+1)%points.length];
     if((a[1]<=row)===(b[1]<=row))continue;
     edges.push(a[0]+(row-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   edges.sort((a,b)=>a-b);
   for(let i=0;i+1<edges.length;i+=2){
     const x=Math.round(edges[i]*2)/2,end=Math.round(edges[i+1]*2)/2;
     c.fillRect(x,y,end-x,.5);
   }
 }
}
function fpaSowBand(c,a,b,width,color){
 const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
 const x=(b[1]-a[1])*width/(2*length),y=(a[0]-b[0])*width/(2*length);
 fpaSowPolygon(c,[[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]],color);
}
function fpaSowFist(c,grip,angle,skin,far){
 const [x,y]=grip,dx=Math.sin(angle),dy=Math.cos(angle);
 const form=(points,color)=>fpaSowPolygon(c,points.map(([across,along])=>[
   x+across*dy+along*dx,y-across*dx+along*dy
 ]),color);
 form([[-2.5,-1.5],[-1.5,-2.5],[1,-2.5],[2.5,-1.5],[2.5,.5],
   [1.5,2],[-1,2],[-2.5,1]],far?'#5b4031':'#73513b');
 form([[-2,-1.5],[-1.5,-2],[1,-2],[2,-1.5],[2,.5],
   [1.5,1.5],[-1,1.5],[-2,1]],far?skin[1]:skin[0]);
 form([[-1.5,-1.5],[.5,-1.5],[1,-.5],[-.5,0],[-1.5,-.5]],far?skin[1]:shade(skin[0],.18));
 form([[-.5,.5],[1,-.25],[2,.5],[1.5,1.5],[0,1.5],[-1,1]],far?shade(skin[1],-.2):skin[1]);
}
function fpaDrawSowPose(world,u,source,px,py,face,target,progress){
 return fpaDrawTwoHandWork(world,u,source,px,py,face,target,progress,'spade',1);
}
const FPA_MINE_POSE_KEYS=[
 [0,0,0,3.5,-12,.55],[.21,-1,-.5,2,-15,-.45],[.43,-2,-1,1,-17,-1.25],
 [.50,2,1.5,6.5,-12,0],[.56,2,1.5,6.5,-12,0],
 [.73,1,1,4.5,-11,.75],[1,0,0,3.5,-12,.55],
];
const FPA_AXE_POSE_KEYS=[
 [0,0,0,3.5,-13,.45],[.20,-1,-.5,1,-16,-.9],[.43,-2,-1,-2,-18,-2.75],
 [.50,2,1.5,3.5,-15,0],[.56,2,1.5,3.5,-15,0],
 [.74,.5,1,4,-12,.65],[1,0,0,3.5,-13,.45],
];
const FPA_HAMMER_POSE_KEYS=[
 [0,0,0,3.5,-13,.35],[.20,-.75,-.5,2,-16,-.75],[.43,-1.5,-1,.5,-18,-2.25],
 [.50,1.5,1.5,4,-15,0],[.56,1.5,1.5,4,-15,0],
 [.74,.5,1,4,-12,.6],[1,0,0,3.5,-13,.35],
];
const FPA_HARVEST_POSE_KEYS={
 wheat:[[0,0,0,3,-12,.65],[.39,-1.3,-.5,1,-15,-1.1],[.49,1.2,1.1,4,-12,0],
   [.56,1.6,1.5,4,-12,0],[.76,.6,.5,3,-12,.85],[1,0,0,3,-12,.65]],
 hay:[[0,0,0,3,-12,.65],[.39,-1,-.6,1,-15,-1.25],[.49,1.8,1.6,4,-12,0],
   [.56,1.8,1.6,4,-12,0],[.76,.7,.5,3,-12,.9],[1,0,0,3,-12,.65]],
 hops:[[0,0,0,3,-13,.65],[.39,-.8,-.7,1,-16,-.85],[.49,1.6,-.8,4,-14,0],
   [.56,1.6,-.8,4,-14,0],[.76,.6,0,3,-13,.8],[1,0,0,3,-13,.65]],
 fork:[[0,0,0,3,-12,.65],[.39,-1.5,-1,1,-17,-1.15],[.49,2,1.5,4,-12,0],
   [.56,2,1.5,4,-12,0],[.76,1,.7,3,-12,.75],[1,0,0,3,-12,.65]],
};
const FPA_HARVEST_SUPPORTS=new WeakMap();
const FPA_HARVEST_FRAMES=new Map(),FPA_HARVEST_SOURCES=new WeakMap();
let fpaHarvestSourceId=0;
function fpaStrikeRig(targetX,targetY,progress,keys,edgeSize){
 const index=keys.findIndex(key=>key[0]>progress);
 const next=index<0?keys.length-1:index,a=keys[next-1],b=keys[next];
 const t=(progress-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);
 const [dx,dy,hx,hy,sweep]=a.slice(1).map((v,i)=>v+(b[i+1]-v)*s);
 const [, , ,strikeX,strikeY]=keys[3];
 const reach=Math.hypot(targetX-strikeX,targetY-strikeY);
 const edge=Math.min(edgeSize,reach*.72),shaft=Math.sqrt(reach*reach-edge*edge);
 const swing=Math.atan2(targetY-strikeY,targetX-strikeX)-Math.atan2(edge,shaft)+sweep;
 const ux=Math.cos(swing),uy=Math.sin(swing);
 const near=[hx,hy],far=[hx-ux*5,hy-uy*5];
 const handle=[hx-ux*7,hy-uy*7],socket=[hx+ux*shaft,hy+uy*shaft];
 const tip=[socket[0]-uy*edge,socket[1]+ux*edge];
 return {dx,dy,near,far,handle,socket,tip,angle:Math.atan2(ux,uy),edge,shaft};
}
function fpaDrawMinePose(world,u,source,px,py,face,target,progress,scale=1){
 return fpaDrawTwoHandWork(world,u,source,px,py,face,target,progress,'pick',scale);
}
function fpaDrawAxePose(world,u,source,px,py,face,target,progress){
 return fpaDrawTwoHandWork(world,u,source,px,py,face,target,progress,'axe',1);
}
function fpaDrawHammerPose(world,u,source,px,py,face,target,progress){
 return fpaDrawTwoHandWork(world,u,source,px,py,face,target,progress,'hammer',1);
}
function fpaDrawHarvestPose(world,u,source,px,py,face,target,progress,kind,scale=1){
 let id=FPA_HARVEST_SOURCES.get(source);
 if(!id){id=++fpaHarvestSourceId;FPA_HARVEST_SOURCES.set(source,id);}
 const phase=scale===1?(progress>=.49&&progress<=.56?.52:Math.round(progress*40)/40):progress;
 const local=point=>[(point[0]-px)*face/scale,(point[1]-py)/scale];
 const goal=local(target),hold=FPA_HARVEST_SUPPORTS.get(target);
 const support=hold?local(hold):null;
 const key=[id,kind,phase,scale,...goal,...(support||[])].join('|');
 let frame=FPA_HARVEST_FRAMES.get(key);
 if(!frame){
   if(support)FPA_HARVEST_SUPPORTS.set(goal,support);
   const cv=mkCanvas(104,100),c=cv.getContext('2d');
   c.setTransform(2,0,0,2,52,84);c.imageSmoothingEnabled=false;
   const rig=fpaDrawTwoHandWork(c,u,source,0,0,1,goal,phase,kind,1);
   frame={cv,rig};
   if(FPA_HARVEST_FRAMES.size>=128)FPA_HARVEST_FRAMES.delete(FPA_HARVEST_FRAMES.keys().next().value);
   FPA_HARVEST_FRAMES.set(key,frame);
 }
 world.save();
 world.imageSmoothingEnabled=false;
 world.translate(px,py);world.scale(face*scale,scale);
 world.drawImage(frame.cv,-26,-42,52,50);
 world.restore();
 const {rig}=frame;
 return {...rig,tip:[px+rig.tip[0]*face*scale,py+rig.tip[1]*scale]};
}
let fpaStrikeCanvas;
function fpaDrawTwoHandWork(world,u,source,px,py,face,target,progress,tool,scale){
 const snap=n=>Math.round(n*2)/2;
 const end=FPA_SOW_KEYS.findIndex(key=>key[0]>progress);
 const next=end<0?FPA_SOW_KEYS.length-1:end;
 const a=FPA_SOW_KEYS[next-1],b=FPA_SOW_KEYS[next];
 const t=(progress-a[0])/(b[0]-a[0]),mix=t*t*(3-2*t);
 const sow=a.slice(1).map((v,i)=>v+(b[i+1]-v)*mix);
 const targetX=(target[0]-px)*face/scale,targetY=(target[1]-py)/scale;
 const fieldKeys=FPA_HARVEST_POSE_KEYS[tool==='rack'?'hops':tool];
 const single=fieldKeys&&tool!=='fork';
 const strike=fieldKeys?fpaStrikeRig(targetX,targetY,progress,fieldKeys,0)
   :tool==='spade'?null:tool==='pick'
   ?fpaStrikeRig(targetX,targetY,progress,FPA_MINE_POSE_KEYS,4.5)
   :tool==='axe'?fpaStrikeRig(targetX,targetY,progress,FPA_AXE_POSE_KEYS,3.5)
   :fpaStrikeRig(targetX,targetY,progress,FPA_HAMMER_POSE_KEYS,2.5);
 const [dx,dy,sowGripX,sowGripY,sowSweep]=sow;
 const bodyX=strike?.dx??dx,bodyY=strike?.dy??dy;
 const gripLean=[snap(bodyX),snap(bodyY)];
 const lean=[snap(bodyX*1.65),snap(bodyY*1.2)];
 const spade=tool==='spade';
 const reach=single?Math.max(0,Math.min(1,(progress-.28)/.21,(.86-progress)/.30)):0;
 const near=tool==='rack'?[3+(targetX-3)*reach,-13+(targetY+13)*reach]
   :strike?.near||[sowGripX,sowGripY];
 const angle=strike?.angle??(Math.atan2(targetX-4.5,targetY+9.5)+sowSweep);
 const spadeLength=Math.hypot(targetX-4.5,targetY+9.5);
 const tip=strike?.tip||[near[0]+Math.sin(angle)*spadeLength,near[1]+Math.cos(angle)*spadeLength];
 const along=(point,distance)=>{
   const x=point[0]-distance*Math.sin(angle),y=point[1]-distance*Math.cos(angle);
   return spade?[x,y]:[snap(x),snap(y)];
 };
 const spacing=6.5;
 const support=single&&FPA_HARVEST_SUPPORTS.get(target);
 const supportX=support?(support[0]-px)*face/scale:targetX-(tool==='rack'?2.5:1.5);
 const supportY=support?(support[1]-py)/scale:targetY-(tool==='rack'?1:3);
 const far=single?[1+(supportX-1)*reach,-11+(supportY+11)*reach]
   :strike?.far||along(near,spacing);
 const handle=single?along(near,1.5):strike?.handle||along(near,spacing+2.75);
 const socket=fieldKeys?along(tip,tool==='fork'?2.45:2.75):strike?.socket||along(tip,2);
 const farBehind=spade||far[0]<-3+gripLean[0];
 const outfit=OUTFIT[u.type];
 const look=lookOf({...u,look:(u.look>>>0)>=0x20000?u.look:LOOK_POOL[(u.look>>>0)%LOOK_POOL.length]});
 const cloth=outfit.coat||look.green,leather=(strike&&outfit.apron)||'#765232',outline='#32271e';
 const skin=SKINS[look.skin%SKINS.length];
 const cv=strike?(fpaStrikeCanvas??=mkCanvas(160,130)):(fpaSowCanvas??=mkCanvas(96,90));
 const c=cv.getContext('2d'),left=strike?32:19,top=strike?54:37;
 c.setTransform(1,0,0,1,0,0);
 c.clearRect(0,0,cv.width,cv.height);
 c.setTransform(2,0,0,2,left*2,top*2);
 c.imageSmoothingEnabled=false;
 const part=(x,y,w,h,tx=x,ty=y)=>c.drawImage(source,(PFX+x)*2,(PFY+y)*2,w*2,h*2,tx,ty,w,h);
 // The torso leans over a smaller hip shift. Keep the upper legs joined to
 // that pivot while the original soles stay planted.
 const hipShift=[snap(bodyX*.55),snap(Math.max(0,bodyY)*.65)];
 const torso=(x,y)=>{
   const weight=Math.max(0,Math.min(1,(-y-8)/8));
   return [snap(x+hipShift[0]+(lean[0]-hipShift[0])*weight),
     snap(y+hipShift[1]+(lean[1]-hipShift[1])*weight)];
 };
 const shoulder=torso(-1,-15);
 const garment=(points,color)=>fpaSowPolygon(c,points.map(([x,y])=>torso(x,y)),color);
 const arm=(start,grip,dark)=>{
   const elbow=dark?[snap((start[0]+grip[0])/2-1),snap((start[1]+grip[1])/2+1)]
     :strike?[snap((start[0]+grip[0])/2-1.6),snap((start[1]+grip[1])/2+2.5)]
     :torso(-3.5,-11.5);
   const wrist=[snap(grip[0]+(elbow[0]-grip[0])*.43),snap(grip[1]+(elbow[1]-grip[1])*.43)];
   const hem=[start[0]+(elbow[0]-start[0])*.68,start[1]+(elbow[1]-start[1])*.68];
   const normal=(a,b)=>{
     const x=b[0]-a[0],y=b[1]-a[1],length=Math.hypot(x,y)||1;
     return [y/length,-x/length];
   };
   const n0=normal(start,elbow),n1=normal(elbow,wrist);
   const turn=normal([0,0],[-n0[1]-n1[1],n0[0]+n1[0]]);
   const edge=(point,n,d)=>[point[0]+n[0]*d,point[1]+n[1]*d];
   const profile=(width,color)=>{
     const [s,e,w]=width.map(v=>v/2);
     fpaSowPolygon(c,[edge(start,n0,s),edge(elbow,n0,e),edge(elbow,turn,e),edge(elbow,n1,e),
       edge(wrist,n1,w),edge(wrist,n1,-w),edge(elbow,n1,-e),edge(elbow,turn,-e),
       edge(elbow,n0,-e),edge(start,n0,-s)],color);
   };
   // Profile widths and half-pixel cloth clusters sampled from the standing
   // farmer. Both sleeves bend at the same elbow that drives the wrist.
   profile(dark?[6,5.5,4.5]:[6.5,6,5],'#28160c');
   profile(dark?[5,4.5,3.5]:[5.5,5,4],strike?shade(cloth,dark?-.32:-.14):dark?'#37461d':'#566f2d');
   const sleeveLight=strike?shade(cloth,dark?-.08:.16):dark?'#4a5f27':'#627e34';
   fpaSowPolygon(c,[edge(elbow,n1,1.75),edge(wrist,n1,1.5),
     edge(wrist,n1,.5),edge(elbow,n1,.5)],sleeveLight);
   fpaSowPolygon(c,[edge(start,n0,2.5),edge(hem,n0,2.25),
     edge(hem,n0,-2),edge(start,n0,-2.5)],strike?shade(leather,dark?-.28:0):dark?'#5c4026':'#69482b');
   fpaSowPolygon(c,[edge(start,n0,2),edge(hem,n0,1.5),
     edge(hem,n0,.5),edge(start,n0,.5)],strike?shade(leather,dark?-.1:.24):dark?'#69482b':'#714e2e');
   fpaSowBand(c,[hem[0]-.5,hem[1]-.5],hem,4,'#5c4026');
   const cuff=[wrist[0]+(elbow[0]-wrist[0])*.32,wrist[1]+(elbow[1]-wrist[1])*.32];
   const cuffColor=shade(cloth,dark?-.04:.34);
   fpaSowBand(c,cuff,wrist,3.25,cuffColor);
   return {cuff,wrist,cuffColor};
 };
 part(-PFX,-6,PW,6);
 const hip=(x,y)=>[x+hipShift[0],y+hipShift[1]];
 fpaSowPolygon(c,[[-6,-5.5],hip(-5.5,-10.5),hip(4,-11),[5.5,-5.5]],outline);
 fpaSowPolygon(c,[[-5,-6],hip(-4.5,-10),hip(.5,-9.5),[.5,-6]],'#624a34');
 fpaSowPolygon(c,[[1,-6],hip(0,-10),hip(3.5,-10),[5,-6]],'#483626');
 fpaSowPolygon(c,[[-4.5,-6.5],hip(-4,-8.5),hip(-1.5,-8.5),[-1.5,-7]],'#7b5b3e');
 fpaSowBand(c,hip(2,-9),[3.5,-7],.5,'#775638');
 const farShoulder=[shoulder[0]+2,shoulder[1]-.5];
 if(farBehind){
   arm(farShoulder,far,true);
   if(!spade)fpaSowFist(c,far,angle,skin,true);
 }
 garment([[-6,-16],[-3,-18],[4,-17],[6,-13],[5,-8],[-5,-8],[-6,-11]],outline);
 garment([[-5.5,-15.5],[-3,-17],[3.5,-16],[5,-13],[4,-8.5],[-4,-8.5],[-5.5,-11]],shade(cloth,-.24));
 garment([[-4.5,-15.5],[-2,-16.5],[2,-16],[4.5,-12.5],[3.5,-9.5],[-3.5,-9.5],[-4.5,-11]],cloth);
 garment([[-4.5,-12],[-2,-12],[.5,-11],[3,-11.5],[2.5,-10.5],[-1,-10],[-4,-10.5]],shade(cloth,.19));
 // The brown shoulder piece wraps over the green sleeve and stops before
 // the elbow. Its shaded hem meets the posed sleeve instead of framing it.
 garment([[-6,-15.5],[-4.5,-17],[.5,-17],[3,-15.5],[2,-14],
   [.5,-13],[-1.5,-12],[-4.5,-12.5],[-5.5,-13.5]],outline);
 garment([[-5.5,-15.5],[-4,-16.5],[.5,-16.5],[2.5,-15.5],[1,-14],
   [-1,-13],[-4,-13],[-5,-13.5]],leather);
 garment([[-5,-15.5],[-4,-16],[-.5,-16],[1.5,-15.5],[.5,-15],
   [-2,-15],[-4.5,-14.5]],'#a47a50');
 garment([[-5,-14],[-3,-13.5],[-1.5,-13.5],[1,-14.5],[1,-14],
   [-1,-13],[-4,-13],[-5,-13.5]],'#523c2b');
 garment([[-4.5,-12.5],[-2,-12],[.5,-12.5],[-.5,-11.5],[-3.5,-11.5]],shade(cloth,.16));
 garment([[-4.5,-10], [4.5,-10],[4,-8.5],[-4.5,-8.5]],outline);
 garment([[-4.5,-9.5],[4,-9.5],[4,-9],[-4.5,-9]],'#715034');
 garment([[2.5,-10],[4,-10],[4,-8.5],[2.5,-8.5]],'#cda75e');
 garment([[3,-9.5],[3.5,-9.5],[3.5,-9],[3,-9]],outline);
 const farArm=farBehind?null:arm(farShoulder,far,true);
 const [lx,ly]=lean;
 // Keep the original cap, face and beard. The lower atlas rectangle is
 // limited to the front of the head, above the original sleeve and wrist.
 part(-PFX,-PFY,PW,17.5,-PFX+lx,-PFY+ly);
 part(.5,-17.5,10,5,.5+lx,-17.5+ly);
 if(farArm)fpaSowBand(c,farArm.cuff,farArm.wrist,2.5,farArm.cuffColor);
 arm(torso(-3,-15),near,false);
 if(tool!=='rack'){
   fpaSowBand(c,handle,socket,single?1.8:strike?2.5:2.25,outline);
   fpaSowBand(c,handle,socket,single?.75:1,'#b58a57');
   if(!single)fpaSowBand(c,near,far,.9,'#d4a775');
 }
 if(tool==='pick')fpaMiningHead(c,socket,angle,strike.edge);
 else if(tool==='axe')fpaFellingHead(c,socket,angle,strike.edge);
 else if(tool==='hammer')fpaBuildingHammerHead(c,socket,angle,strike.edge);
 else if(tool==='rack'){
   const [x,y]=near;
   fpaSowPolygon(c,[[x-.5,y-1],[x+.5,y-3.5],[x+2,y-3],[x+2.5,y-1],[x+1.5,y+.5]],'#4b632c');
   c.fillStyle='#a9bd62';c.fillRect(snap(x+.5),snap(y-2.5),1,.5);
   c.fillRect(snap(x+1),snap(y-1.5),1,.5);
 }else if(fieldKeys)fpaFieldHead(c,tool==='fork'?'fork':tool==='hops'?'hook':'sickle',near[0],near[1],tip[0],tip[1]);
 else fpaSpadeHead(c,near[0],near[1],tip[0],tip[1]);
 if(spade||!farBehind)fpaSowFist(c,far,angle,skin,true);
 fpaSowFist(c,near,angle,skin,false);
 world.save();
 world.imageSmoothingEnabled=false;
 world.translate(px,py);
 world.scale(face*scale,scale);
 world.drawImage(cv,-left,-top,cv.width/2,cv.height/2);
 world.restore();
 const contact=tool==='rack'?near:tip;
 return {tip:[px+contact[0]*face*scale,py+contact[1]*scale],near,far,shoulder,lean,shaft:strike?.shaft};
}
function fpaHeavyHeadLayer(c,[x,y],angle,edge,width,depth){
 const ux=Math.sin(angle),uy=Math.cos(angle);
 return (points,color)=>fpaSowPolygon(c,points.map(([along,side])=>{
   const across=edge+(side-edge)*depth;
   return [x+ux*along*width-uy*across,y+uy*along*width+ux*across];
 }),color);
}
function fpaBuildingHammerHead(c,socket,angle,edge){
 const shape=fpaHeavyHeadLayer(c,socket,angle,edge,1.28,1.16);
 shape([[-1.55,-2.9],[.95,-2.9],[1.85,-2.1],[1.85,edge-.6],
   [1.25,edge],[-1.2,edge],[-1.8,edge-.55],[-1.8,-2.35]],'#323730');
 shape([[-1.15,-2.4],[.8,-2.4],[1.3,-1.8],[1.3,edge-.55],
   [-1.15,edge-.55]],'#86998d');
 shape([[-1.2,edge-.5],[1.2,edge-.5],[.85,edge],[-.85,edge]],'#d9e4cb');
 shape([[-1.4,-2.35],[-.8,-2.35],[-.8,edge-.65],[-1.4,edge-.65]],'#aebdaf');
 shape([[-1.4,-.8],[1.45,-.8],[1.45,.55],[-1.4,.55]],'#63492e');
 shape([[-1,-.55],[.95,-.55],[.95,.3],[-1,.3]],'#cb9b56');
}
function fpaFellingHead(c,socket,angle,edge){
 const shape=fpaHeavyHeadLayer(c,socket,angle,edge,1.3,1.18);
 shape([[1.25,-1.3],[1.75,.3],[.95,1.65],[.5,edge-.35],[0,edge],
   [-1.7,edge+.2],[-3.25,edge-.55],[-2.6,1.35],[-1.3,.3],[-1.55,-1.25]],'#303930');
 shape([[1,.15],[.45,1.55],[0,edge-.4],[-1.6,edge-.15],
   [-2.65,edge-.65],[-2.15,1.35],[-1,.5]],'#879e94');
 shape([[0,edge],[-1.7,edge+.2],[-3.25,edge-.55],[-2.55,edge-.8],
   [-1.6,edge-.35],[0,edge-.45]],'#dce7d3');
 shape([[-1.1,-1.2],[.9,-1.2],[1.1,-.45],[.75,.75],[-1.1,.8]],'#573b2b');
 shape([[-.75,-1],[.55,-1],[.7,-.55],[.5,.5],[-.75,.55]],'#c39958');
}
function fpaMiningHead(c,socket,angle,edge){
 const shape=fpaHeavyHeadLayer(c,socket,angle,edge,1.28,1.17);
 const collar=fpaHeavyHeadLayer(c,socket,angle,0,1.22,1.18);
 shape([[0,edge],[1.35,edge-.9],[2.1,1.5],[1.8,-1.65],[.8,-3.9],
   [-.6,-3.25],[-.45,-1.4],[-1.35,0],[-.85,edge-1.3]],'#29332d');
 shape([[0,edge],[.75,edge-.85],[1.5,1.5],[1.15,-1.4],[.65,-3.45],
   [.15,-2.65],[.15,-1],[-.55,.35],[-.4,edge-1.3]],'#819992');
 shape([[0,edge],[.75,edge-.85],[1.2,1.8],[.65,1.9],
   [.3,edge-1.25]],'#dce7d3');
 shape([[.65,-3.45],[1.15,-1.4],[.6,-1.3],[.15,-2.65]],'#b7c8b9');
 collar([[-1.8,-1.45],[.55,-1.6],[1.25,-.8],[1.25,.9],
   [.4,1.5],[-1.8,1.15]],'#553d2b');
 collar([[-1.4,-1.1],[.45,-1.15],[.85,-.55],[.85,.7],[.2,1.1],
   [-1.35,.85]],'#c39958');
 collar([[-1,0],[-.3,-.85],[.6,-.35],[.35,.7],[-.55,.75]],'#439087');
 collar([[-1,0],[-.3,-.85],[.4,-.35],[-.5,.2]],'#c0e9d7');
}
const FPA_SPADE_OUTLINE=[[0,-.9],[0,.9],[.5,1.6],[1,2.15],[2.65,2.15],[2.65,1.75],
 [3.25,1.75],[3.75,.9],[4.8,.9],[4.8,-.9],[3.75,-.9],[3.25,-1.75],[2.65,-1.75],
 [2.65,-2.15],[1,-2.15],[.5,-1.6]];
const FPA_SPADE_WIDTH=1.3,FPA_SPADE_DEPTH=1.18;
function fpaFitSpadeToSprite(c,hx,hy,tx,ty){
 const dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy)||1,x=dx/length,y=dy/length;
 const m=c.getTransform(),vx=m.a*x+m.c*y,vy=m.b*x+m.d*y;
 // Leave room for the half-pixel scan rows after rotation and resampling.
 const inset=Math.hypot(m.a,m.b)*1.25;
 let pull=0;
 for(const [depth,side] of FPA_SPADE_OUTLINE){
   const px=tx-depth*FPA_SPADE_DEPTH*x-side*FPA_SPADE_WIDTH*y;
   const py=ty-depth*FPA_SPADE_DEPTH*y+side*FPA_SPADE_WIDTH*x;
   const xx=m.a*px+m.c*py+m.e,yy=m.b*px+m.d*py+m.f;
   if(vx>0)pull=Math.max(pull,(xx-c.canvas.width+inset)/vx);
   if(vx<0)pull=Math.max(pull,(xx-inset)/vx);
   if(vy>0)pull=Math.max(pull,(yy-c.canvas.height+inset)/vy);
   if(vy<0)pull=Math.max(pull,(yy-inset)/vy);
 }
 pull=Math.min(pull,length-1);
 return [tx-pull*x,ty-pull*y];
}
function fpaSpadeHead(c,hx,hy,tx,ty){
 const dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy)||1;
 const x=dx/length,y=dy/length;
 // The middle of the cutting edge is the existing contact coordinate.
 const layer=(points,color)=>fpaSowPolygon(c,points.map(([depth,side])=>[
   tx-depth*FPA_SPADE_DEPTH*x-side*FPA_SPADE_WIDTH*y,
   ty-depth*FPA_SPADE_DEPTH*y+side*FPA_SPADE_WIDTH*x
 ]),color);
 layer(FPA_SPADE_OUTLINE,'#303930');
 layer([[.35,-.9],[.35,.9],[1.1,1.65],[2.45,1.65],[3.2,1.25],
   [3.65,.5],[3.65,-.5],[3.2,-1.25],[2.45,-1.65],[1.1,-1.65]],'#7c928d');
 layer([[.45,-.85],[1.1,-1.6],[2.45,-1.6],[3.1,-1.15],
   [2.45,-.65],[1.25,-.4]],'#a6b9af');
 layer([[0,-.85],[0,.85],[.5,1.55],[1.1,1.9],[1.1,1.4],
   [.55,.65],[.55,-.65],[1.1,-1.4],[1.1,-1.9],[.5,-1.55]],'#dde5cb');
 layer([[2.15,-.3],[2.9,-.55],[4.55,-.55],[4.55,.55],[2.9,.55],
   [2.15,.3]],'#a47144');
 layer([[3.85,-.65],[4.35,-.65],[4.35,.65],[3.85,.65]],'#d8ad68');
}
function fpaFieldHead(c,tool,hx,hy,tx,ty){
 const dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
 const p=(along,across)=>[tx+ux*along*1.22-uy*across*1.25,ty+uy*along*1.22+ux*across*1.25];
 if(tool==='fork'){
   fpaSowBand(c,p(-2,-1.5),p(-2,1.5),1.15,'#4f5b51');
   for(const tine of [-1.5,0,1.5]){
     fpaSowBand(c,p(-2,tine),p(0,tine),1.15,'#48564e');
     fpaSowBand(c,p(-2,tine),p(0,tine),.65,'#c7d0bb');
   }
 }else if(tool==='spade'){
   fpaSpadeHead(c,hx,hy,tx,ty);
 }else{
   const short=tool==='hook';
   const sweep=short?2.6:3.75;
   const blade=(points,color)=>fpaSowPolygon(c,points.map(([along,across])=>p(along,across)),color);
   blade([[-2.55,-.65],[-2.9,.4],[-2.35,sweep-.4],[-1.3,sweep],
     [-.25,sweep-.85],[0,0],[-.7,.7],[-1.25,sweep-1.25],[-1.8,sweep-1.4],[-2,0]],'#27342d');
   blade([[-2.55,.35],[-2.1,sweep-.55],[-1.3,sweep-.45],[-.5,sweep-.9],
     [0,0],[-.95,1.05],[-1.3,sweep-1.15],[-2,sweep-1.35]],'#b9c9b9');
   fpaSowBand(c,p(-2.65,-.45),p(-2.15,.25),.75,'#c19257');
 }
}
let fpaFieldSample;
function fpaFieldSurface(u,x,y,o,kind){
 if(!R.canvas||!FPA_FIELD_ANGLES[kind])return null;
 const side=u.face<0?-1:1,footX=u.x*TILE,footY=u.y*TILE+6;
 if(kind==='sow')return [footX+side*8,y*TILE+26.5];
 const sprite=SPR.fields[o.crop]?.[fieldStage(o.g)];
 if(!sprite)return null;
 if(!fpaFieldSample)fpaFieldSample=mkCanvas(TILE,TILE).getContext('2d',{willReadFrequently:true});
 const c=fpaFieldSample;
 c.clearRect(0,0,TILE,TILE);
 c.drawImage(sprite,0,0,TILE,TILE);
 const data=c.getImageData(0,0,TILE,TILE).data;
 const hops=kind==='hops',targetX=footX+side*(hops?10:8),targetY=footY-(hops?14:6);
 const cropPixel=(i,j)=>{
   const at=(j*TILE+i)*4,r=data[at],g=data[at+1],b=data[at+2];
   return hops?g>=103&&g>=r*1.06&&g>=b*1.19:r>=132&&g>=121&&g>=b*1.15;
 };
 let point=null,best=Infinity;
 for(let j=1;j<TILE-1;j++)for(let i=1;i<TILE-1;i++){
   if(!cropPixel(i,j))continue;
   const px=x*TILE+i+.5,py=y*TILE+j+.5;
   if(Math.abs(px-footX)<5)continue;
   const d=(px-targetX)**2+1.3*(py-targetY)**2;
   if(d<best){best=d;point=[px,py];}
 }
 if(point){
   let support=null,score=Infinity;
   const i0=point[0]-x*TILE-.5,j0=point[1]-y*TILE-.5;
   const rise=hops?4:8;
   const [, , ,gripX,gripY]=FPA_HARVEST_POSE_KEYS[kind][3];
   for(let j=Math.max(1,j0-rise-3);j<=Math.min(TILE-2,j0-2);j++)
     for(let i=Math.max(1,i0-5);i<=Math.min(TILE-2,i0+5);i++){
       if(!cropPixel(i,j))continue;
       const px=x*TILE+i+.5,py=y*TILE+j+.5;
       const gap=Math.hypot(px-footX-side*gripX,py-footY-gripY);
       const distance=(i-i0+side*1.5)**2+(j-j0+rise)**2+6*Math.max(0,4.75-gap)**2;
       if(distance<score){score=distance;support=[px,py];}
     }
   if(support)FPA_HARVEST_SUPPORTS.set(point,support);
 }
 return point;
}
let fpaWoodcutSample;
function fpaWoodcutSurface(u,{x,y,o}){
 if(!R.canvas||o.awake)return null;
 const px=Math.round(u.x*TILE),py=Math.round(u.y*TILE+6),left=px-13,top=py-14;
 const w=27,h=24;
 if(!fpaWoodcutSample)fpaWoodcutSample=mkCanvas(w,h).getContext('2d',{willReadFrequently:true});
 const c=fpaWoodcutSample,log=o.t==='log';
 c.clearRect(0,0,w,h);
 c.save();
 c.translate(-left,-top);
 if(log)drawLog(c,x,y);
 else drawTree(c,x,y,o,idx(x,y));
 c.restore();
 const pixels=c.getImageData(0,0,w,h).data;
 const side=u.face<0?-1:1;
 let point=null,best=Infinity;
 for(let j=1;j<h-1;j++)for(let i=1;i<w-1;i++){
   const wx=left+i+.5,wy=top+j+.5,dx=wx-px;
   if(Math.abs(dx)<4.5)continue;
   const at=(j*w+i)*4,r=pixels[at],g=pixels[at+1],b=pixels[at+2];
   if(pixels[at+3]<244||r<44||r<g*1.01||g<b*1.09)continue;
   const distance=(Math.abs(dx)-(log?9:7))**2+(wy-(py+(log?-2:-7)))**2+(dx*side<0?2:0);
   if(distance<best){point=[wx,wy];best=distance;}
 }
 return point;
}
// Sample a small world-space patch once per target. The gameplay tile can
// extend past the visible rock, particularly on its eastern edge.
let fpaQuarrySample;
function fpaQuarrySurface(target,origin){
 if(!R.canvas)return null;
 const {x,y,stone}=target,radius=14,size=radius*2+1;
 if(!fpaQuarrySample)fpaQuarrySample=mkCanvas(size,size).getContext('2d',{willReadFrequently:true});
 const c=fpaQuarrySample,left=Math.round(origin[0])-radius,top=Math.round(origin[1])-radius;
 const solid=new Uint8Array(size*size),depths=new Float64Array(solid.length);
 function sample(draw,depth){
   c.clearRect(0,0,size,size);
   c.save();
   c.translate(-left,-top);
   draw();
   c.restore();
   const pixels=c.getImageData(0,0,size,size).data;
   for(let i=0;i<solid.length;i++)if(pixels[i*4+3]>244){
     solid[i]=1;
     depths[i]=depth;
   }
 }
 if(stone){
   // Ignore hit shake so the point remains stable through the strike.
   sample(()=>drawRock(c,x,y,{...stone,hitT:0,dmg:0},idx(x,y)),0);
 }else{
   for(const mount of MOUNTS){
     const s=MT_SIZES[mount.size],mx=mount.x-s.w/2,my=mount.y-s.h+9;
     if(mx>left+size||mx+s.w<left||my>top+size||my+s.h<top)continue;
     sample(()=>drawMountain(c,mount),mount.y/TILE+.12);
   }
 }
 let best=null,distance=Infinity;
 for(let j=1;j<size-1;j++)for(let i=1;i<size-1;i++){
   const at=j*size+i;
   if(!solid[at]||!solid[at-1]||!solid[at+1])continue;
   const px=left+i+.5,py=top+j+.5;
   const d=(px-origin[0])**2+1.5*(py-origin[1])**2;
   if(d<distance){best={point:[px,py],depth:stone?null:depths[at]};distance=d;}
 }
 return best;
}
// Weapon-only native pose projection. The atlas body and all hitboxes stay fixed.
function fpaDrawWeaponProps(c,u,view,pose,frame,opt={}){
 const W=opt.wpn?wpnParse(opt.wpn):pose==='fight'?{m:'fists',o:'',out:true}:null;if(!W)return;
 const v=view==='W'?'E':view,fight=pose==='fight'?(FIGHT_BODY[frame]?frame:'ready'):null,ff=fight||'ready',style=WPN_STYLE[W.m]||'fist',O=OUTFIT[u.type]||OUTFIT.serf,L=lookOf(u),skin=SKINS[L.skin%SKINS.length],coat=O.coat||L.green||'#66863d';
 const ph=pose==='walk'?Number(frame)/WALK_FRAMES*Math.PI*2:0,sw=Math.sin(ph),breath=pose==='idle'?(IDLE_BREATH[(Number(frame)||0)%IDLE_FRAMES]||0):0,crouch=(fight?FIGHT_BODY[fight][1]:pose==='duck'||pose==='tame'?1.8:0)-breath+(pose==='work'?swingDip(frame):0),hip=-6.2+crouch,sh=-12+crouch;
 let lean=fight?FIGHT_BODY[fight][0]:pose==='walk'?(u.carry?.16:.05):pose==='work'&&(frame.anim==='reap'||frame.anim==='dig')?.28:pose==='work'&&frame.anim==='pat'?.42:0;
 if(pose==='walk'&&opt.gait==='tired')lean+=.16;if(pose==='walk'&&opt.gait==='drunk')lean+=Math.cos(ph)*.1;
 const amp=opt.gait==='drunk'?.3:opt.gait==='tired'?.07:.15,roll=pose==='walk'?sw*amp*(v==='E'?.35:1)+(opt.gait==='drunk'?Math.cos(ph)*.08:0):0,sway=pose==='walk'?sw*(v==='E'?.25:.8):0,bob=pose==='walk'?-Math.abs(Math.cos(ph))*(injLeg(u.injury)?1.2:opt.gait==='tired'?.3:.7)+.3:0,armed=!u.carry&&(fight||(W.out&&(pose==='walk'||pose==='idle')));
 c.save();c.translate(PFX+sway,PFY+bob);c.rotate(roll);
 if(v==='E'){
  c.translate(0,hip);c.rotate(lean);c.translate(0,-hip);
  if(!armed){if(WPN_BACK[W.m]){c.save();c.globalCompositeOperation='destination-over';drawOnBack(c,W.m,-2.4,sh+3.4,'E');c.restore();}if(W.o==='wshield'){c.save();c.globalCompositeOperation='destination-over';drawOnBack(c,'wshield',-3.4,sh+3.6,'E');c.restore();}c.restore();return;}
  const f=(FIGHT_ARM[style]||FIGHT_ARM.fist)[ff]||(FIGHT_ARM[style]||FIGHT_ARM.fist).ready,[a,tilt,reach=4.2]=f,wk=!fight&&pose==='walk'&&(style==='blade'||style==='stab')?sw:0;
  const hx=.4+Math.sin(a)*reach+wk*.3,hy=sh+.4-Math.cos(a)*reach+wk*.5,dx=Math.sin(tilt+wk*.16),dy=-Math.cos(tilt+wk*.16),fk=fightKey(ff),two=(style==='heavy'||style==='staff')&&ff!=='draw'&&ff!=='d0'&&ff!=='s5'&&!(style==='staff'&&(fk==='win0'||fk==='win1'||isCastF(ff)));
  let bx,by;if(two){bx=hx-dx*2.4;by=hy-dy*2.4;}else if(style==='bow'){const q=FIGHT_BACK.bow[fk];if(q){bx=-.4+q[0];by=sh+.4+q[1];}else{bx=hx-.9;by=hy+.3;}}else{const q=(W.o==='wshield'?FIGHT_BACK.shield:FIGHT_BACK.free)[ff]||FIGHT_BACK.free.ready;bx=-.4+q[0];by=sh+.4+q[1];}
  smoothLimb(c,[-.4,sh+.4],[(-.4+bx)/2+.3,(sh+.4+by)/2+.7],[bx,by],2.2,shade(coat,-.35));hand(c,bx,by,skin[2]);
  if(W.o&&WPN_STYLE[W.o]==='stab'){const d=fk==='windup'||fk==='parry'?[.95,-.3]:[.85,.52];drawWeapon(c,W.o,bx,by,d[0],d[1]);}
  if(W.o==='wshield')drawShield(c,bx+.9,by-.6,1.7,3.9);
  if(style==='bow')drawBow(c,W.m,hx,hy,tilt,fk==='windup'?[bx,by]:null);else if(style!=='fist')drawWeapon(c,W.m,hx,hy,dx,dy,(ff==='draw'||ff==='d0'||ff==='s5')&&(style==='blade'||style==='stab')?'hilt':undefined);
  smoothLimb(c,[.4,sh+.4],[(.4+hx)/2+.4,(sh+.4+hy)/2+.6],[hx,hy],2.1,coat);
  if(style==='fist'){ellipse(c,hx,hy,fk==='strike'||ff==='bhit'?1.95:1.5,fk==='strike'||ff==='bhit'?1.9:1.45,skin[1]);if(fight&&BOTTLE_POSE[fight])drawBottle(c,hx,hy,BOTTLE_POSE[fight][0],BOTTLE_POSE[fight][1]);if(W.m==='fists'){line(c,hx-1.2,hy-.4,hx+1.2,hy-.4,'#e8dcc0',.45);line(c,hx-1.2,hy+.5,hx+1.2,hy+.5,'#e8dcc0',.45);}}else hand(c,hx,hy,skin[1]);
 }else{
  const front=v==='S';c.translate(0,lean*2.4);
  if(!armed){if(WPN_BACK[W.m])drawOnBack(c,W.m,front?3.6:-1.2,sh+2.6,v);if(!front&&W.o==='wshield')drawShield(c,0,sh+3.8,3.1,3.6);c.restore();return;}
  for(const side of [-1,1]){const h=hip-.2,main=side===(front?-1:1),off=!main&&W.o;
   if(main&&style!=='fist'){const d=style==='heavy'?[side*.3,-.95]:style==='staff'?[side*.12,-.99]:style==='blade'?[side*.34,-.94]:[side*.42,.9];if(style==='bow')drawBow(c,W.m,side*5.1,h+.5,0,null);else drawWeapon(c,W.m,side*5.1,h+.5,d[0],d[1]);}
   if(off&&W.o!=='wshield')drawWeapon(c,W.o,side*5.1,h+.5,side*.4,.92);
   smoothLimb(c,[side*4.2,sh+.6],[side*5.4,(sh+h)/2],[side*5,h],2.3,side>0===front?shade(coat,-.25):coat);hand(c,side*5.1,h+.5,skin[0]);if(off==='wshield')drawShield(c,side*5.4,h-.4,front?2.6:2.2,3.2);
  }
 }
 c.restore();
}
// Native GF is 10..21 for a 12-frame cycle, not a 0..1 interpolation.
// Preserve that clock, use both native joints and attach items to the wrist.
function fpaDrawGestureProps(c,u,view,pose,frame,opt={}){
 const gest=opt.gest;if(!gest||u.carry)return {drawn:false};const W=opt.wpn?wpnParse(opt.wpn):null;if(pose==='fight'||W?.out&&(pose==='idle'||pose==='walk'))return {drawn:false};
 const v=view==='W'?'E':view,profile=v==='E',child=u.type==='kid',female=personSex(u)==='f'||OUTFIT[u.type]?.fem||u.type==='waitress',art=FantasyArt.images[child?'gnome-child':female?'gnome-woman-walk':'gnome-walk'];
 let head=PFY-20;const [,dip]=fpaBodyMotion(v,pose,frame,opt);
 if(art){const row=profile?1:v==='N'?2:0,f=pose==='walk'?Math.floor((Number(frame)%WALK_FRAMES)*8/WALK_FRAMES):0,src=art.frames[child?(pose==='walk'?Math.floor((Number(frame)%WALK_FRAMES)*4/WALK_FRAMES):0):row*8+f],sc=Math.min((child?21:25)/art.maxW,(child?27:33)/art.maxH),dh=src[3]*sc;head=PFY-Math.round(dh)+dh*.30;}
 const sh=PFY-14+dip,headY=head+dip,O=OUTFIT[u.type]||OUTFIT.serf,L=lookOf(u),coat=O.coat||L.green||'#66863d',skin=SKINS[L.skin%SKINS.length],raw=Number(opt.gf)||0,gf=['five','flirt','wslap','cheek'].includes(gest)?raw:gestK(raw),sides=['clap','stretch','panic','five','six7'].includes(gest)?[1,-1]:[v==='N'?-1:1],joints=[];
 for(const side of sides){const q=gestPts(gest,gf,side,sh,headY,v),S=[PFX+(profile?.4:side*4.2),sh+.5],E=[PFX+q[0][0],q[0][1]],H=[PFX+q[1][0],q[1][1]],raised=H[1]<sh+1;
  c.save();if(raised){c.beginPath();c.rect(-80,-80,180,240);c.moveTo(PFX+(profile?1:0)+5.8,headY+3.3);c.ellipse(PFX+(profile?1:0),headY+3.3,5.8,7.3,0,0,Math.PI*2);c.clip('evenodd');}
  smoothLimb(c,S,E,H,2.1,side>0?coat:shade(coat,-.12));c.restore();hand(c,H[0],H[1],skin[0]);
  if(gest==='eat'){line(c,H[0],H[1],H[0]+.9,H[1]-.7,'#aa9660',.5);ellipse(c,H[0]+.9,H[1]-.7,.6,.45,'#dac99a');}
  if(gest==='drink'||gest==='chest'&&gf>=.5)drawFlask(c,H[0]+1,H[1],.3);
  joints.push({side,shoulder:S,elbow:E,hand:H});
 }
 return{drawn:true,gest,rawGF:raw,gf,headY,shoulderY:sh,joints,hand:joints.at(-1)?.hand};
}
function fpaAction(c,u,view,pose,frame,opt){
 const O=OUTFIT[u.type],L=lookOf(u),coat=O.coat||L.green||'#66863d';
 if(opt.gest)fpaDrawGestureProps(c,u,view,pose,frame,opt);
 if(pose==='duck'||pose==='tame'){
  const phase=[0,.35,.8,1,.62,.2][Number(frame)]||0,side=view==='N'?-1:1,profile=view==='E'||view==='W';
  const shoulder=[PFX+(profile?.4:side*4.2),PFY-11];
  const reach=pose==='tame'?6.1+phase*2.3:opt.posture==='forage'?4.4+phase*4:opt.posture==='sit'?4:5.8-phase*3;
  const hy=PFY-(pose==='tame'?7.8+phase:opt.posture==='forage'?6.4-phase*3.8:opt.posture==='sit'?5+phase*1.4:6.8+phase*5.1);
  const hx=PFX+side*reach;
  smoothLimb(c,shoulder,[(shoulder[0]+hx)/2+side,PFY-8], [hx,hy],2.1,coat);
  hand(c,hx,hy,SKINS[L.skin%SKINS.length][0]);
 }
 fpaDrawWeaponProps(c,u,view,pose,frame,opt);
}
window.FantasyPublishedArt=FantasyPublishedArt;

// Icons can be generated by native startup before asynchronous PNGs arrive.
// Invalidate both the URL cache and existing category/card DOM after completion.
FantasyPublishedArt.ready.then(()=>{
 if(typeof UI==='undefined')return;UI.bicons={};UI.shown=null;
 for(const im of document.querySelectorAll('.bc-ico'))delete im.dataset.t;
 if(typeof renderBuildMenu==='function'&&R.canvas)renderBuildMenu();
 if(typeof renderBuildList==='function'&&R.canvas)renderBuildList();
 for(const btn of document.querySelectorAll('.bbtn[data-type]')){const im=btn.querySelector('.bimg');if(im)im.src=buildingIconURL(btn.dataset.type);}
});

// Native yard anchors are closer together than full-width atlas silhouettes.
// Scale around the foot, keeping the existing animation call and prop contact.
const fpaNativeFolkDraw=drawFolk;
drawFolk=function(c,u,x,y,view,pose,frame,opt,flip){
 if(!OUTFIT[u.type])return fpaNativeFolkDraw(c,u,x,y,view,pose,frame,opt,flip);
 if(pose==='work'&&frame.anim==='mine'){
   // Pass the mapped phase before sprite scheduling. Contact and follow-through
   // then use the same immediate path as their world counterparts.
   frame={...frame,f:FPA_YARD_MINE_PHASES[Math.max(0,Math.min(7,frame.f|0))]};
   opt={...opt,yardMining:true};
 }
 c.save();c.translate(x,y);c.scale(2/3,2/3);fpaNativeFolkDraw(c,u,0,0,view,pose,frame,opt,flip);c.restore();
};
