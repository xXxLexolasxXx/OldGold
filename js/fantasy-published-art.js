'use strict';
// Optional art adapter for current OldGold. Load after native game modules.
// Native simulation, dimensions, anchors and action frame selectors are retained.
const FantasyPublishedArt = {images:{},errors:[],cache:new Map(),people:new Map(),version:1};
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
 const sourceBox=fpaBounds(base.canvas).map(v=>v*(2/(base.canvas.width/base.w))),b=a.bounds;
 const worldW=base.fw||bDims(type,rot).w*TILE;
 const artW=(type==='inn'?worldW*.63:type==='farm'?worldW*.72:type==='sawmill'||type==='brewery'?worldW*.60:worldW-12)*k;
 const artH=(type==='inn'?92:type==='school'?106:type==='farm'?85:type==='sawmill'||type==='brewery'?80:Math.min(110,(BUILDINGS[type].top||70)+16))*k;
 const box=special?sourceBox:[(base.padx+5)*k,(base.top+depth-yard)*k-artH,Math.max(12*k,artW),artH];
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
personSprite = function (u, view, pose, frame, opt = {}) {
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
  const key = [u.type, female?'f':'m',u.sx||'', variant, view, pose, f, workF, pose === 'smoke' ? frame : '', pose === 'work' ? frame.anim : '', u.carry, opt.carryN || u.carryN || 1, opt.gest, opt.gf, opt.wpn, opt.gait, opt.nohat, u.injury].join('|');
  if (FA_RENDER_CACHE.has(key)) return FA_RENDER_CACHE.get(key);
  const cv = mkCanvas(PW * PART, PH * PART), c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false; c.scale(PART, PART);
  const src = art.frames[child?((pose==='work'?4:0)+(pose==='walk'?Math.floor((frame%WALK_FRAMES)*4/WALK_FRAMES):pose==='work'?Math.floor((frame.f%WORK_FRAMES)*4/WORK_FRAMES):0)):row*8+f];
  const scale = Math.min((child?21:25) / art.maxW, (child?27:33) / art.maxH);
  const dw = src[2] * scale, dh = src[3] * scale;
  const fight=pose==='fight'?(FIGHT_BODY[frame]||FIGHT_BODY.ready):null;
  const dip=fight?fight[1]:pose==='duck'||pose==='tame'?2:pose==='idle'?-(IDLE_BREATH[(Number(frame)||0)%IDLE_FRAMES]||0):pose==='work'?Math.sin((frame.f||0)*Math.PI/4):0;
  c.save();c.translate(PFX,PFY);c.transform(1,0,fight?fight[0]*.42:0,1,0,dip);c.drawImage(art.image,...src,Math.round(-dw/2),Math.round(-dh),Math.round(dw),Math.round(dh));c.restore();
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
  if (pose === 'work') {
    const toolKind=ANIM_TOOL[frame.anim];const angles=toolKind==='toss'?TOSS_A:toolKind==='pat'?PAT_A:toolKind==='sickle'||toolKind==='spade'?SWING_SICKLE:SWING_A;
    const a=angles[workF%angles.length],hx=19,hy=22;
    const tx = Math.round(hx + Math.sin(a) * 6), ty = Math.round(hy - Math.cos(a) * 8);
    pline(c, hx, hy, tx, ty, '#644127', 2);
    const tool = ANIM_TOOL[frame.anim];
    if (tool === 'axe') {
      poly(c, [[tx - 1, ty - 3], [tx + 5, ty - 2], [tx + 4, ty + 3], [tx - 1, ty + 1]], '#aeb6b1', '#42463e', 0.5);
    } else if (tool === 'pick') {
      pline(c, tx - 4, ty + 1, tx + 4, ty - 1, '#bfc3b7', 1);
    } else if (tool === 'sickle') {
      c.strokeStyle = '#c3c6b8'; c.lineWidth = 1; c.beginPath(); c.arc(tx, ty, 4, -2.6, 0.8); c.stroke();
    } else if (tool === 'spade') {
      poly(c, [[tx - 2, ty - 1], [tx + 2, ty - 1], [tx + 2, ty + 3], [tx, ty + 5], [tx - 2, ty + 3]], '#adb5aa');
    } else if (tool === 'hook') {
      pline(c, hx, hy, tx, ty - 4, '#a68b5d', 1); c.strokeStyle = '#b7bda8'; c.beginPath(); c.arc(tx + 1, ty - 4, 2, Math.PI, 0); c.stroke();
    } else { faRect(c, tx - 3, ty - 2, 6, 4, '#42423b'); faRect(c, tx - 3, ty - 2, 6, 1, '#c3c6b8'); }
    faRect(c, hx - 1, hy - 1, 3, 3, '#edbc8b');
  }
  if (opt.gest === 'eat' || opt.gest === 'drink') {
    faRect(c, 18, 20 - (opt.gf || 0) * 3, 3, 4, '#d49c3d');
    faRect(c, 18, 19 - (opt.gf || 0) * 3, 3, 1, '#fff2ce');
  }
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
function fpaAction(c,u,view,pose,frame,opt){
 const O=OUTFIT[u.type],L=lookOf(u),coat=O.coat||L.green||'#66863d';
 const arm=(hx,hy,s=1)=>{pline(c,PFX+s*4,PFY-16,hx,hy,'#44362b',3);pline(c,PFX+s*4,PFY-16,hx,hy,coat,2);faRect(c,hx-.5,hy,2,2,SKINS[L.skin%SKINS.length][0]);};
 if(opt.gest){const ss=['clap','stretch','panic','five'].includes(opt.gest)?[1,-1]:[view==='N'?-1:1];for(const s of ss){const q=gestPts(opt.gest,opt.gf||0,s,PFY-16,PFY-25,view);arm(PFX+q[1][0]*.8,q[1][1],s);}}
 if(pose==='duck'||pose==='tame'){const f=Number(frame)||0;arm(PFX+6+(f%3),PFY-5);}
 const W=opt.wpn?wpnParse(opt.wpn):pose==='fight'?{m:'fists',o:'',out:true}:null;
 if(!W)return;
 if(!W.out&&pose!=='fight'){if(W.m)drawOnBack(c,W.m,PFX-4,PFY-16,view);if(W.o)drawOnBack(c,W.o,PFX+2,PFY-15,view);return;}
 const state=pose==='fight'&&FIGHT_BODY[frame]?frame:'ready',style=WPN_STYLE[W.m]||'fist',table=FIGHT_ARM[style]||FIGHT_ARM.fist||FIGHT_ARM.blade;
 const f=table[state]||table.ready,A=f[0],tilt=f[1],reach=f[2]||4.2,hx=PFX+1+Math.sin(A)*reach,hy=PFY-16-Math.cos(A)*reach;
 arm(hx,hy);c.save();c.translate(hx,hy);if(style==='bow')drawBow(c,W.m,0,0,tilt,state==='windup'?[-4,1]:null);else if(W.m&&W.m!=='fists')drawWeapon(c,W.m,0,0,Math.sin(tilt),-Math.cos(tilt));c.restore();
 const q=(W.o==='wshield'?FIGHT_BACK.shield:FIGHT_BACK.free)[state]||[2,3],bx=PFX+q[0],by=PFY-16+q[1];arm(bx,by,-1);if(W.o==='wshield')drawShield(c,bx,by,view==='E'?2.3:3.3,4);else if(W.o)drawWeapon(c,W.o,bx,by,.4,-.9);
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
