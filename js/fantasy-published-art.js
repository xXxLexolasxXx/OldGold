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
function fpaBodyMotion(view,pose,frame,opt) {
  if(pose==='fight'){const f=FIGHT_BODY[frame]||FIGHT_BODY.ready;return [f[0]*.42,f[1]];}
  if(pose==='idle')return [0,-(IDLE_BREATH[Number(frame)%IDLE_FRAMES]||0)];
  if(view!=='E'&&view!=='W')return [0,pose==='duck'||pose==='tame'?2:0];
  if(pose==='work'){
    const f=frame.f|0;
    if(frame.anim==='toss')return [-(TOSS_DIP[f]||0)*.23,0];
    if(frame.anim==='pat')return [-.1-((PAT_A[f]??1.8)-1.8)*.12,0];
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
  const key = [u.type, female?'f':'m',u.sx||'', variant, view, pose, f, workF, phaseKey, pose === 'work' ? frame.anim : '', u.carry, opt.carryN || u.carryN || 1, opt.gest, opt.gest?opt.gf:0, opt.wpn, opt.gait, opt.nohat, opt.posture, u.injury].join('|');
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
  if (u.carry) {
    c.save(); c.translate(PFX, u.carry === 'trunk' ? 13 : 23);
    if (u.carry === 'trunk') c.scale(1.4, 1.2);
    drawLoads(c, u.carry, opt.carryN || u.carryN || 1); c.restore();
  }
  if (pose === 'work') fpaDrawWorkTool(c,{...u,look:normalizedLook},view,frame,opt);
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
// Remove only the atlas's static skin/sleeve components for actively posed arms.
// Ordinary idle/walk and carriers take the no-op path before reading any pixels.
function fpaCleanAtlasArms(cv,u,view,pose,frame,opt={},geometry={}){
 if(u.carry||u.type==='kid')return {removed:0,filled:0,components:0};
 const W=opt.wpn?wpnParse(opt.wpn):null,both=pose==='work'||pose==='fight'||(W?.out&&(pose==='idle'||pose==='walk'))||['clap','stretch','panic','five','six7'].includes(opt.gest),one=!both&&(!!opt.gest||pose==='smoke'||pose==='tame'||pose==='duck');
 if(!both&&!one)return {removed:0,filled:0,components:0};
 const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height),src=new Uint8ClampedArray(im.data),d=im.data,k=cv.width/PW,w=cv.width,h=cv.height,dh=geometry.dh||33,dw=geometry.dw||25,dip=geometry.dip||0,shear=geometry.shear||0,top=PFY-dh;
 const mask=new Uint8Array(w*h),visited=new Uint8Array(w*h),skin=i=>src[i+3]>=160&&src[i]>140&&src[i+1]>95&&src[i+2]>69&&src[i]>src[i+1]*1.08&&src[i+1]>src[i+2]*1.08;
 const xy=p=>{const y=(Math.floor(p/w)+.5)/k-dip,x=(p%w+.5)/k-shear*(y-PFY);return[x,y];};
 const roi=p=>{const[x,y]=xy(p),a=Math.abs(x-PFX);return y>=top+dh*.5&&y<PFY-5&&a>=4.5&&a<=dw*.57&&!(a<6.5&&y<top+dh*.64);};
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
 const tool=ANIM_TOOL[frame?.anim],known=['axe','pick','hammer','sickle','spade','hook','toss','pat','bucket'].includes(tool);
 if(!known)return {known:false,drawn:false};
 const angles=tool==='toss'?TOSS_A:tool==='pat'?PAT_A:tool==='sickle'||tool==='spade'?SWING_SICKLE:SWING_A;
 const f=Math.max(0,Math.min(angles.length-1,frame.f|0)),fr={anim:frame.anim,f};
 // Vary the wind-up without moving the grip during contact and recovery.
 const windup=f<8?Math.sin(f/8*Math.PI):0;
 const a=angles[f]+(FPA_WORK_ARC[frame.anim]||0)*windup,dip=swingDip(fr),lean=frame.anim==='reap'||frame.anim==='dig'?.28:frame.anim==='pat'?.42:0,hip=-6.2+dip,sh=-12+dip;
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
 const offset=profile?0:4, reach=profile?1:.68;
 if(!profile){
  smoothLimb(c,[-4.2,sh+.6],[-5.4,(sh+hip)/2],[-4.8,hip-.4],2.1,shade(coat,-.25));
  hand(c,-4.8,hip-.4,skin[0]);
 }
 c.translate(0,hip);c.rotate(lean);c.translate(0,-hip);
 const hx=offset+.4+Math.sin(a)*3.8*reach,hy=sh-Math.cos(a)*3.8,tx=hx+Math.sin(a)*6.5*reach,ty=hy-Math.cos(a)*6.5,nx=-(ty-hy)/6.5,ny=(tx-hx)/6.5;
 smoothLimb(c,[offset+.4,sh+.4],[(offset+.4+hx)/2+.6,(sh+hy)/2+.5],[hx,hy],2.1,coat);
 if(!['toss','pat','bucket'].includes(tool))line(c,hx-(tx-hx)*.25,hy-(ty-hy)*.25,tx,ty,'#6e4428',.9);
 switch(tool){
 case 'toss':case 'pat':break; // Native bare hands; projectile belongs to its native effect.
 case 'bucket':{const bx=hx+Math.sin(a)*2.2,by=hy-Math.cos(a)*2.2;c.fillStyle='#5a3a1e';c.fillRect(Math.round(bx-2),Math.round(by-1),4,3);c.fillStyle='#9a6a3a';c.fillRect(Math.round(bx-2),Math.round(by-1),4,1);c.fillStyle='#3a3a3e';c.fillRect(Math.round(bx-2),Math.round(by),4,1);if(f<5){c.fillStyle='#6ab8ff';c.fillRect(Math.round(bx-1),Math.round(by-2),2,1);}break;}
 case 'axe':poly(c,[[tx,ty],[tx+nx*2.4,ty+ny*2.4],[tx+nx*2.2-(tx-hx)*.22,ty+ny*2.2-(ty-hy)*.22],[tx-(tx-hx)*.15,ty-(ty-hy)*.15]],'#b8bcc0','#3a3a3e',.3);break;
 case 'pick':c.strokeStyle='#8a8e92';c.lineWidth=.9;c.beginPath();c.moveTo(tx-nx*3.2,ty-ny*3.2);c.quadraticCurveTo(tx+(tx-hx)*.08,ty+(ty-hy)*.08,tx+nx*3.2,ty+ny*3.2);c.stroke();break;
 case 'hammer':c.save();c.translate(tx,ty);c.rotate(Math.atan2(ty-hy,tx-hx));c.fillStyle='#5c564f';c.fillRect(-.8,-1.7,2,3.4);c.fillStyle='#9e958a';c.fillRect(-.8,-1.7,2,.6);c.restore();break;
 case 'hook':{c.strokeStyle='#6e4428';c.lineWidth=.9;c.beginPath();c.moveTo(tx,ty);c.lineTo(tx+(tx-hx)*.9,ty+(ty-hy)*.9);c.stroke();const kx=tx+(tx-hx)*.9,ky=ty+(ty-hy)*.9;c.strokeStyle='#2a1c10';c.lineWidth=.8;c.beginPath();c.arc(kx+nx*1.4,ky+ny*1.4,1.5,0,Math.PI*1.5);c.stroke();ellipse(c,kx+nx*2.2,ky+ny*2.2,1,1.3,'#a8d860');break;}
 case 'sickle':c.strokeStyle='#d0d4d8';c.lineWidth=.8;c.beginPath();c.arc(tx+nx*1.6,ty+ny*1.6,2,Math.atan2(ny,nx)+Math.PI*.2,Math.atan2(ny,nx)+Math.PI*1.2);c.stroke();break;
 case 'spade':c.save();c.translate(tx,ty);c.rotate(Math.atan2(ty-hy,tx-hx));c.fillStyle='#9e958a';c.fillRect(0,-1.2,2.4,2.4);c.restore();break;
 }
 hand(c,hx,hy,skin[1]);c.restore();
 const world=(x,y)=>[PFX+(view==='N'?-1:1)*(x*Math.cos(lean)-(y-hip)*Math.sin(lean)),PFY+hip+x*Math.sin(lean)+(y-hip)*Math.cos(lean)];
 return{known:true,drawn:true,projection:profile?'native-profile':'front-working-tool',tool,frame:f,frames:angles.length,hand:world(hx,hy),tip:world(tx,ty)};
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
drawFolk=function(c,u,x,y,...args){
 if(!OUTFIT[u.type])return fpaNativeFolkDraw(c,u,x,y,...args);
 c.save();c.translate(x,y);c.scale(2/3,2/3);fpaNativeFolkDraw(c,u,0,0,...args);c.restore();
};
