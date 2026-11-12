'use strict';
// Detailed work surfaces on the publication's native anchors; no simulation changes.
(()=>{
 if(window.FantasyPublishedMachinery)return;
 if(!window.FantasyPublishedYard?.paint||!FantasyPublishedYard.CanvasCache){window.FantasyPublishedMachinery={version:2,available:false,errors:['Missing FantasyPublishedYard renderer'],ready:Promise.resolve(false)};return;}
 const M=window.FantasyPublishedMachinery={version:2,available:true,cache:new FantasyPublishedYard.CanvasCache(),native:{buildingSprite,drawInsideLife,drawFoodYard},get errors(){return[...FantasyPublishedYard.errors]}},D=FantasyPublishedYard.paint,{r,ln,poly,oval,beam,board,bolt,P}=D;
 const yardBodies=new FantasyPublishedYard.CanvasCache(32,2*1024*1024);
 M.ready=Promise.resolve(FantasyPublishedYard.ready).then(ok=>{M.cache.clear();yardBodies.clear();return ok&&M.errors.length===0});
 const types=new Set(['woodcutter','goldmine','ironmine','crystalmine','metallurgist','smeltery','weaponsmith','armory','farm','hopfarm','brewery','mill','bakery','butchery','tannery','magicworkshop','storehouse','infirmary','fisherhut']);
 function masonry(c,x,y,w,h){r(c,x-1,y-1,w+2,h+2,P.ink);r(c,x,y,w,h,'#82785c');for(let yy=0;yy<h;yy+=3)for(let xx=-3+(yy%6?0:3);xx<w;xx+=6){const X=Math.max(0,xx),W=Math.min(5,w-X);if(W<1)continue;r(c,x+X,y+yy,W,2.5,['#9d9170','#a89d7a','#8e8367'][(Math.floor(xx+yy)+12)%3]);r(c,x+X+.5,y+yy,W-.5,.5,'#bfb18a');r(c,x+X+W-.5,y+yy+.5,.5,1.5,'#6a614d')}}
 function barrel(c,x,y,w=12,h=11,open=false){oval(c,x,y+.5,w*.53,1.8,P.ink);poly(c,[[x-w/2+1,y-h],[x+w/2-1,y-h],[x+w/2+1,y-h*.6],[x+w/2,y-1],[x+w/2-2,y+1],[x-w/2+2,y+1],[x-w/2,y-1],[x-w/2-1,y-h*.6]],P.ink);for(let i=0;i<6;i++){const X=x-w/2+i*w/6;r(c,X,y-h+1,w/6-.5,h-1,['#6e492d','#9f713f','#bd8d50','#b28348','#8d6038','#60432d'][i]);ln(c,X+.5,y-h+2,X+.5,y-2,i===2?'#d4ac6b':'#805332')}
 for(const yy of[-h+3,-2]){r(c,x-w/2,y+yy,w,1.5,P.iron);r(c,x-w/2,y+yy,w,.5,P.steel);for(const dx of[-w*.3,w*.3])bolt(c,x+dx,y+yy+.5)}oval(c,x,y-h,w*.46,1.7,P.hi);oval(c,x,y-h,w*.37,1.1,open?'#55452a':'#9f7743');if(open){oval(c,x-.6,y-h-.2,w*.28,.55,'#bdad6c');r(c,x+2,y-h-.5,1,.5,'#e2d2a0')}else for(const dx of[-3,0,3])ln(c,x+dx,y-h-1,x+dx,y-h+1,'#795534')}
 function crate(c,x,y,w=12,h=8){beam(c,x-w/2,y-h,w,h);for(const yy of[-h+1,-2]){beam(c,x-w/2,y+yy,w,1.5);for(const dx of[-w/2+1,w/2-2])bolt(c,x+dx,y+yy+.3)}ln(c,x-w/2+2,y-h+2,x+w/2-2,y-2,P.deep,1.5);ln(c,x-w/2+2,y-h+1.5,x+w/2-2,y-2.5,P.hi,.5)}
 function sack(c,x,y,col='#c5b480'){poly(c,[[x-3,y-8],[x-2,y-6],[x-4,y-2],[x-3,y],[x+3,y],[x+4,y-2],[x+2,y-6],[x+3,y-8]],P.ink);poly(c,[[x-2.5,y-7],[x-1,y-5.5],[x-3,y-2],[x-2,y-.5],[x+2.5,y-.5],[x+3,y-2],[x+1.5,y-5.5],[x+2.5,y-7]],col);ln(c,x-1.5,y-5.5,x+1.5,y-5.5,'#745f39');ln(c,x-2,y-3,x-1.5,y-1,'#e2d0a1');r(c,x+.5,y-3,1,.5,'#99875e')}
 function log(c,x,y,w=15){oval(c,x,y,w*.5,2.7,P.ink);beam(c,x-w/2,y-2,w,4);for(const[dx,dy]of[[-4,-1],[-1,1],[3,-.5]])ln(c,x+dx,y+dy,x+dx+3,y+dy,'#5e422c');oval(c,x+w/2,y,2.3,2.3,P.ink);oval(c,x+w/2,y-.2,1.8,1.8,'#d0ad70');oval(c,x+w/2,y-.2,1.1,1.1,'#9d7846');oval(c,x+w/2,y-.2,.5,.5,'#d9bb80');ln(c,x+w/2+.3,y-1.5,x+w/2-.3,y-.5,'#6d5032')}
 function bench(c,x,y,w=20){poly(c,[[x-w/2-1,y-1],[x+w/2-1,y-2],[x+w/2+1,y+1],[x-w/2+1,y+2]],P.ink);beam(c,x-w/2,y,w,2);for(const dx of[-w/2+2,w/2-4]){beam(c,x+dx,y+2,2,7);bolt(c,x+dx+.5,y+1)}ln(c,x-w/2+3,y+7,x+w/2-3,y+7,P.deep,1);for(let j=0;j<3;j++)ln(c,x-w/2+2+j*5,y+.5,x-w/2+5+j*5,y+.5,P.edge)}
 function anvil(c,x,y,k=1){c.save();c.translate(x,y);c.scale(k,k);beam(c,-4,1,8,7);oval(c,0,1,4.5,1.4,P.hi);poly(c,[[-9,-4],[-6,-6],[4,-6],[7,-4],[6,-2],[2,-2],[2,0],[4,1],[-4,1],[-2,0],[-2,-2],[-6,-2]],P.ink);poly(c,[[-8,-4],[-5,-5],[4,-5],[6,-4],[4,-3],[-5,-3]],P.silver);r(c,-4,-3,7,1.5,P.iron);r(c,-1,-2,3,2,P.steel);r(c,-3,0,7,.5,P.silver);r(c,2,-5.5,1,.5,P.shine);bolt(c,-3,3);bolt(c,2,3);c.restore()}
 function forge(c,x,y,w=19){poly(c,[[x+w/2,y-15],[x+w/2+3,y-13],[x+w/2+3,y+3],[x+w/2,y+3]],'#5d5747');poly(c,[[x-w/2,y-16],[x-w/2+3,y-18],[x+w/2+3,y-16],[x+w/2,y-14]],'#b8ac85');masonry(c,x-w/2,y-15,w,18);poly(c,[[x-6,y+1],[x-6,y-6],[x-4,y-9],[x+3,y-9],[x+6,y-6],[x+6,y+1]],P.ink);poly(c,[[x-4.5,y],[x-4.5,y-5],[x-3,y-7],[x+2.5,y-7],[x+4.5,y-5],[x+4.5,y]],'#693b28');for(const[dx,dy]of[[-3,-1],[0,-2],[2,0],[-1,-4]]){r(c,x+dx,y+dy,2,1,'#bf7535');r(c,x+dx,y+dy,1,.5,'#edba64')}r(c,x-6,y+1,12,1,P.iron);for(let dx=-4;dx<5;dx+=2)r(c,x+dx,y-2,.5,3,P.iron);for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6,b=a+Math.PI/6,rad=7.3;poly(c,[[x+Math.cos(a)*rad,y-4+Math.sin(a)*rad],[x+Math.cos(b)*rad,y-4+Math.sin(b)*rad],[x+Math.cos(b)*5.7,y-4+Math.sin(b)*5.7],[x+Math.cos(a)*5.7,y-4+Math.sin(a)*5.7]],i%2?'#b7ab82':'#998e6c')}beam(c,x-w/2-1,y+3,w+2,2);for(const dx of[-7,6])bolt(c,x+dx,y+2)}
 function bellows(c,x,y){beam(c,x-5,y+1,12,2);poly(c,[[x-5,y],[x-4,y-5],[x+4,y-3],[x+6,y]],'#593c2c');for(let i=0;i<5;i++){ln(c,x-4+i*2,y-4+i*.3,x-4+i*2,y,'#a3754a');ln(c,x-3.5+i*2,y-3.5+i*.3,x-3.5+i*2,y,'#3f3027')}ln(c,x+6,y,x+10,y-1,P.steel,1.5);bolt(c,x-5,y+2)}
 function hide(c,x,y,w=11,h=11){poly(c,[[x-w*.45,y-h],[x-w*.18,y-h+.8],[x,y-h-1],[x+w*.2,y-h+.7],[x+w*.45,y-h],[x+w*.3,y-h*.55],[x+w*.5,y-1],[x+w*.18,y-1.5],[x,y],[x-w*.18,y-1.5],[x-w*.5,y-1],[x-w*.3,y-h*.55]],'#694832');poly(c,[[x-w*.33,y-h+1],[x,y-h],[x+w*.3,y-h+1],[x+w*.2,y-h*.55],[x+w*.32,y-2],[x,y-1],[x-w*.32,y-2],[x-w*.2,y-h*.55]],'#bd9964');ln(c,x-2,y-h+3,x-1,y-3,'#d8b87e');ln(c,x+1,y-h+4,x+2,y-2,'#9a764b');poly(c,[[x-w*.2,y-h+2],[x-w*.08,y-h*.6],[x-w*.12,y-3],[x-w*.25,y-2],[x-w*.3,y-h*.6]],'#d5b17b');poly(c,[[x+w*.23,y-h+2],[x+w*.12,y-h*.5],[x+w*.25,y-2],[x+w*.31,y-2],[x+w*.21,y-h*.5]],'#a78352');for(let yy=2;yy<h-1;yy+=2){r(c,x-w*.3,y-yy,.5,.5,'#ead1a0');r(c,x+w*.3,y-yy,.5,.5,'#704e33')}for(const[dx,dy]of[[-1,-3],[1,-5],[-2,-7],[2,-9]])r(c,x+dx,y+dy,1,.5,'#e3c18c')}
 function stone(c,x,y,w=16,h=10,ore='stone'){const col=ore==='crystal'?'#7c9d9a':ore==='gold'?'#90947d':'#858d86';poly(c,[[x-w/2,y],[x-w/2+2,y-h+2],[x-2,y-h],[x+w/2-2,y-h+2],[x+w/2,y-2],[x+4,y+1]],P.ink);poly(c,[[x-w/2+2,y-h+2],[x-2,y-h+1],[x+w/2-3,y-h+2],[x+2,y-h/2],[x-w/2+1,y-h/2]],'#b4bba0');poly(c,[[x-w/2+1,y-h/2],[x+2,y-h/2],[x+4,y],[x-w/2+1,y-1]],col);poly(c,[[x+w/2-3,y-h+2],[x+w/2-1,y-2],[x+4,y],[x+2,y-h/2]],'#5c7168');for(let i=0;i<7;i++){const dx=((i*7)%Math.floor(w-3))-w/2+2,dy=-2-(i*3)%(h-3);r(c,x+dx,y+dy,1.5,.5,i%2?'#ced0ac':'#66796a')}
 if(ore!=='stone')for(const[dx,dy]of[[-3,-4],[1,-7],[3,-2]]){r(c,x+dx,y+dy,1.5,1.5,ore==='gold'?'#ba9446':ore==='crystal'?'#65b6b7':'#647c83');r(c,x+dx,y+dy,1,.5,ore==='gold'?'#ead27c':ore==='crystal'?'#b0e0cb':'#b9c8c0')}}
 function millstone(c,x,y){beam(c,x-8,y+3,16,3);oval(c,x,y,8,3,P.ink);oval(c,x,y-1,7.5,2.5,'#a9aa8a');oval(c,x,y-1.5,6.5,1.8,'#cfca9e');for(let i=0;i<10;i++){const a=i*Math.PI/5;ln(c,x+Math.cos(a)*2,y-1.5+Math.sin(a)*.5,x+Math.cos(a)*6,y-1.5+Math.sin(a)*1.6,'#8e977d')}oval(c,x,y-1.5,1.2,.7,'#535f50');beam(c,x-.5,y-8,1,6);beam(c,x-1,y-8,7,1);bolt(c,x+5,y-8)}
 function alchemy(c,x,y){bench(c,x,y,21);beam(c,x-9,y-11,18,1);for(const dx of[-8,7])beam(c,x+dx,y-11,1,11);for(let i=0;i<5;i++){const xx=x-6+i*2.7; r(c,xx-.8,y-15,1.5,3.5,P.ink);r(c,xx-.5,y-13.5,1,1.5,['#79a3a0','#aa8eae','#9ba967'][i%3]);r(c,xx-.5,y-15,1,.5,'#d9c894');r(c,xx-.5,y-14,.5,.5,'#d7e0bf')}poly(c,[[x-5,y-3],[x,y-4],[x+5,y-3],[x+5,y],[x,y-.5],[x-5,y]],'#d8c697');ln(c,x,y-3,x,y-.5,'#80664b');for(const dx of[-3,2])ln(c,x+dx,y-2.5,x+dx+1.5,y-2.5,'#a38864');oval(c,x+7,y-1.5,1.5,1.5,'#749d9b');r(c,x+6.5,y-5,1,2,'#d3d4a5');r(c,x+7,y-3.5,.5,1,'#c7e1c7')}
 function cauldron(c,x,y){for(const dx of[-5,4])beam(c,x+dx,y-2,1.5,4);oval(c,x,y-3,6,4,P.ink);oval(c,x,y-3,5.3,3.4,P.iron);oval(c,x-1,y-4,3.5,1.7,P.steel);oval(c,x,y-6,5.8,1.8,P.silver);oval(c,x,y-6,4.8,1.1,'#607f63');oval(c,x-.8,y-6.4,2.7,.5,'#a8bd86');for(const dx of[-6,5]){r(c,x+dx,y-5,1,2,P.iron);r(c,x+dx,y-5,1,.5,P.silver)}bolt(c,x-3,y-2);r(c,x-2,y+1,4,.5,'#bf7942')}
 function copper(c,x,y){masonry(c,x-10,y+12,21,10);r(c,x-5,y+16,10,6,P.ink);r(c,x-3,y+19,6,2,'#b77e3f');r(c,x-2,y+19,3,.5,'#e8bf6c');oval(c,x,y+11,10,5,P.ink);r(c,x-10,y-5,20,16,P.ink);for(let i=0;i<10;i++)r(c,x-9+i*1.8,y-5,1.8,16,['#704931','#855532','#9e6c3c','#b27e43','#ce9a56','#d5a35b','#bd8a49','#a37140','#8c5f38','#6b4831'][i]);oval(c,x,y+9,9.5,4,'#9d6d3d');oval(c,x,y-6,10,4.5,P.ink);oval(c,x,y-6.5,9.3,3.8,'#b48347');oval(c,x,y-7.5,8,3,'#d0a263');oval(c,x,y-8,5.5,1.8,'#e0bd7c');for(const yy of[-3,8]){r(c,x-9,y+yy,18,1.2,P.iron);r(c,x-9,y+yy,18,.5,P.steel);for(const dx of[-7,-2,3,7])bolt(c,x+dx,y+yy+.4)}beam(c,x-1,y-13,2,4);r(c,x-2,y-13,4,1,P.iron);ln(c,x-9,y+8,x-14,y+8,P.mid,2);ln(c,x-14,y+8,x-14,y+16,P.mid,2);ln(c,x-9,y+7.5,x-14,y+7.5,P.edge,.5);bolt(c,x-14.5,y+10)}
 function paint(c,s,type){const Q=s.pt||{},lv=s.pxLv||s._machineryLevel||1;
 if(type==='bakery'){
   if(Q.oven){
     const[x,y]=Q.oven;
     forge(c,x,y-2,19);
     beam(c,x-18,y-2,10,2);
     for(const dx of[-15,-11]){
       oval(c,x+dx,y-3.5,1.8,1,'#d8ba77');
       ln(c,x+dx-.5,y-4,x+dx+.5,y-3.4,'#9e793f');
     }
   }
   if(Q.knead){
     const[x,y]=Q.knead,X=x+dough.x,Y=y+dough.y;
     bench(c,X,Y,15);
     sack(c,X+8,Y+7);
     ln(c,X-5,Y-.8,X+5,Y-.8,P.mid,1);
   }
 }
 if(type==='brewery'&&Q.brewer){if(Q.vat)copper(c,...Q.vat);const[x,y]=Q.brewer;barrel(c,x+mash.x,y,mash.w,-mash.y,true);barrel(c,x+19,y+3,9,9);if(lv>1)crate(c,x+24,y-8,10,6)}
 if(type==='butchery'&&Q.block){const[x,y]=Q.block;beam(c,x-5,y+1,11,7);oval(c,x+.5,y+1,6,1.8,P.hi);for(const dx of[-3,0,3])ln(c,x+dx,y+.5,x+dx+1,y+1.5,P.deep);oval(c,x+2,y-.2,3.5,1.7,'#8d5139');oval(c,x+1.5,y-.5,2.3,1,'#c9906c');r(c,x+2,y-1,1.5,.5,'#ead2a6');if(Q.hooks){const a=Q.hooks[0],z=Q.hooks[Q.hooks.length-1];beam(c,a[0]-2,a[1]-5,z[0]-a[0]+4,2);for(const p of Q.hooks){ln(c,p[0],p[1]-3,p[0],p[1]+1,P.silver);oval(c,p[0],p[1]+3,1.8,3,'#ad7954')}}}
 if(/mine$/.test(type)){const ore=type==='goldmine'?'gold':type==='crystalmine'?'crystal':'iron';if(Q.miner)stone(c,Q.miner[0]+8,Q.miner[1]+1,17,10,ore);if(Q.panner){const[x,y]=goldWashBench(Q.panner);bench(c,x,y,16);for(const dx of[-6,6])bolt(c,x+dx,y+.4)}if(Q.sorter){const[x,y]=Q.sorter;bench(c,x+3,y-7,18);for(const dx of[-2,2,5]){poly(c,[[x+dx,y-7],[x+dx+1,y-10],[x+dx+2,y-7]],'#a3c5bc');r(c,x+dx+1,y-9,.5,1,'#dbe0c1')}}if(Q.kiln)forge(c,Q.kiln[0],Q.kiln[1],18);if(Q.stamp){const[x,y]=Q.stamp;masonry(c,x-9,y-2,19,5);for(const dx of[-8,8])beam(c,x+dx,y-20,2,20);beam(c,x-10,y-21,22,3);for(const dx of[-5,0,5]){beam(c,x+dx,y-17,1.5,13);r(c,x+dx-1,y-5,3,3,P.iron);r(c,x+dx-1,y-5,3,.5,P.silver)}bolt(c,x-8,y-20);bolt(c,x+8,y-20)}if(Q.wheel){const[x,y]=Q.wheel;oval(c,x,y,8,8,P.ink);oval(c,x,y,7,7,P.wood);oval(c,x,y,5.3,5.3,'#47594b');for(let i=0;i<10;i++){const a=i*Math.PI/5;ln(c,x+Math.cos(a),y+Math.sin(a),x+Math.cos(a)*7,y+Math.sin(a)*7,P.hi,1)}bolt(c,x-.5,y-.5)}}
 if(['metallurgist','smeltery','weaponsmith','armory'].includes(type)){const[x,y]=s.glow||[s.padx+s.fw*.78,s.baseY-15];if(type!=='armory')forge(c,x,y+2,19);if(type==='smeltery'){masonry(c,x+11,y-4,10,8);r(c,x+12,y-3,8,2,'#7e4b32');r(c,x+12,y-3,6,.5,'#e0aa58');for(const dx of[-4,1,6]){r(c,x+dx,y+8,4,1.5,'#926c3a');r(c,x+dx,y+8,4,.5,'#ddbb76')}}else{anvil(c,x-17,y+4,.9);bellows(c,x+14,y+1);if(type==='armory'){bench(c,x+3,y+1,21);poly(c,[[x,y-5],[x+6,y-5],[x+6,y-1],[x+3,y+1],[x,y-1]],P.iron);ln(c,x+3,y-4,x+3,y,P.silver);ln(c,x+1,y-2,x+5,y-2,P.mid)}}}
 if(type==='mill'){const[x,y]=[s.padx+s.fw*.78,s.baseY-9];millstone(c,x,y-2);sack(c,x-11,y+4);if(lv>1)sack(c,x+11,y+4);beam(c,x+4,y-20,8,2);poly(c,[[x+3,y-19],[x+13,y-19],[x+10,y-12],[x+6,y-12]],P.ink);poly(c,[[x+4,y-18],[x+12,y-18],[x+9,y-13],[x+7,y-13]],P.mid);for(const dx of[5,7,9])r(c,x+dx,y-18,1,.5,'#e2c47c');beam(c,x+7,y-13,2,5)}
 if(type==='tannery'){const x=s.padx+s.fw*.78,y=s.baseY-9;for(const dx of[-9,9])beam(c,x+dx,y-23,2,24);beam(c,x-10,y-24,22,2);beam(c,x-10,y-3,22,2);hide(c,x,y-3,15,19);for(const dx of[-6,6])for(const dy of[-20,-14,-7])ln(c,x+dx,y+dy,x+(dx<0?-9:9),y+dy-1,'#c5b37e');barrel(c,x+19,y+3,11,8,true);const [bx,by]=tanneryBench(s);bench(c,bx,by,13);hide(c,bx,by+.45,9,3)}
 if(type==='magicworkshop'){if(s.cauldron){const[x,y]=s.cauldron;cauldron(c,x,y);alchemy(c,x+23,y-3)} }
 if(type==='storehouse'){for(const [kind,pts]of Object.entries(s.piles||{}))for(let i=0;i<pts.length;i++){const[x,y]=pts[i];if(kind==='goods'||kind==='food'){crate(c,x,y,11,7);if(lv>1&&i===0)crate(c,x+1,y-7,9,6)}else if(kind==='timber'){beam(c,x-7,y-2,15,2);for(const dx of[-5,4])r(c,x+dx,y-2,1,2,P.iron)}}}
 if(type==='woodcutter'){const x=s.padx+s.fw*.76,y=s.baseY-8;for(const dx of[-10,10]){ln(c,x+dx-3,y+2,x+dx+2,y-8,P.ink,2.5);ln(c,x+dx+3,y+2,x+dx-2,y-8,P.ink,2.5);ln(c,x+dx-3,y+1.5,x+dx+2,y-8,P.mid,1.5);ln(c,x+dx+3,y+1.5,x+dx-2,y-8,P.wood,1.5);bolt(c,x+dx-.5,y-4)}log(c,x,y-7,23);log(c,x+15,y+1,10);log(c,x+16,y-2,9);oval(c,x,y+1,5,2,P.ink);for(let i=0;i<8;i++){r(c,x-4+i,y-7,1,8,[P.deep,P.wood,P.mid,P.wood,P.hi,P.mid,P.wood,P.deep][i]);if(i%2)ln(c,x-4+i,y-4,x-3.5+i,y-1,P.deep)}oval(c,x,y-7,5,2,P.ink);oval(c,x,y-7.3,4.5,1.6,'#cfac70');oval(c,x-.5,y-7.3,3,1.1,'#9c7646');oval(c,x-.5,y-7.3,2.2,.7,'#d7b880');oval(c,x-.5,y-7.3,1,.4,'#9c7646');ln(c,x+1,y-8,x+.5,y-6.5,P.deep);ln(c,x-.5,y-15,x+.5,y-8,P.ink,1.5);ln(c,x-.5,y-15,x+.5,y-8,P.mid,.8);poly(c,[[x-.5,y-10],[x+3,y-10],[x+3.5,y-7],[x-.5,y-7.5]],P.ink);poly(c,[[x,y-9.5],[x+2.5,y-9.5],[x+3,y-7.5],[x,y-8]],P.steel);ln(c,x+2.5,y-9.5,x+3,y-7.5,P.shine)}
 if(type==='hopfarm')for(const p of Q.racks||[]){const[x,y]=p;for(const dx of[3,13])beam(c,x+dx,y-16,1.5,18);beam(c,x+2,y-17,14,2);for(let j=0;j<4;j++){const xx=x+4+j*3;ln(c,xx,y-14,xx,y-4,'#a39660');for(let k=0;k<3;k++){oval(c,xx+(k%2?-.7:.7),y-12+k*2,1.2,1.5,'#698548');r(c,xx,y-13+k*2,.5,.5,'#b0ba6d')}}}
 if(type==='farm'){for(const pair of[Q.farmer,Q.hand])if(pair){const[x,y]=pair[1];beam(c,x-9,y+1,18,2);for(let j=0;j<11;j++){const xx=x-8+j*1.5;ln(c,xx,y,xx+2,y-5-(j%3),'#8d7b40');ln(c,xx+.5,y,xx+2.5,y-5-(j%3),'#cab16d')}for(const dx of[-7,6])beam(c,x+dx,y-1,1.5,6)}}
 if(type==='infirmary'){if(s.cauldron)cauldron(c,...s.cauldron);if(s.rack){const[x,y]=s.rack;for(const dx of[-8,8])beam(c,x+dx,y-14,1.5,16);beam(c,x-9,y-15,19,2);for(let j=0;j<5;j++){const X=x-6+j*3;ln(c,X,y-13,X,y-8,'#bba273');for(const dx of[-1,0,1])ln(c,X,y-10,X+dx,y-5,'#759064')}}}
 if(type==='fisherhut'){const x=s.padx+s.fw*.8,y=s.baseY-6;bench(c,x,y-3,20);for(let j=0;j<3;j++){const X=x-5+j*4;poly(c,[[X-2,y-4],[X,y-5],[X+2,y-4],[X+3,y-5],[X+3,y-3],[X+2,y-4],[X,y-3]],'#9bb4aa');r(c,X-1,y-4,.5,.5,P.ink)}barrel(c,x+13,y+2,9,9)}
 }
 function placeButcheryBlock(c,s,k){
   const P=s.pt;
   if(!P?.block||!P.butcher)return;
   const [x,y]=P.block,face=P.butcher[0]<x?1:-1;
   const footX=x+2-face*8,footOffset=7.85;
   const left=Math.max(0,Math.floor((Math.min(x-7,footX-4))*k));
   const right=Math.min(c.canvas.width,Math.ceil((Math.max(x+7,footX+4))*k));
   const top=Math.max(0,Math.floor((y+5)*k));
   let floor=y+footOffset;
   if(right>left&&top<c.canvas.height){
     const w=right-left,h=c.canvas.height-top,data=c.getImageData(left,top,w,h).data;
     for(let row=h-1;row>=0;row--){
       let solid=false;
       for(let col=0;col<w;col++)if(data[(row*w+col)*4+3]>220){solid=true;break;}
       if(solid){floor=Math.max(floor,(top+row+1)/k+2);break;}
     }
   }
   // On the turned façade the decorative dog's layer crosses the original
   // shoulder height. Shift the whole station and keep the original animal.
   if(P.dog&&Math.abs(P.dog[0]-footX)<10&&P.dog[1]>floor-17&&P.dog[1]<floor-1)
     floor=P.dog[1]+18.5;
   const blockY=floor-footOffset;
   const carry=P.carry;
   const crosses=carry&&Math.min(carry[0][1],carry[1][1])<floor+7&&
     Math.max(carry[0][1],carry[1][1])>blockY-7&&
     Math.min(carry[0][0],carry[1][0])<x+14&&Math.max(carry[0][0],carry[1][0])>x-13;
   s.pt={...P,block:[x,blockY],carry:crosses?carry.map(([px,py])=>[Math.min(px,x-13),py]):carry};
 }
 buildingSprite=function(type,...args){const s=M.native.buildingSprite(type,...args);if(!types.has(type)||!s._publishedArt)return s;let out=M.cache.get(s.canvas);if(out)return out;const cv=mkCanvas(s.canvas.width,s.canvas.height),c=cv.getContext('2d'),k=cv.width/s.w;c.imageSmoothingEnabled=false;c.drawImage(s.canvas,0,0);out={...s,canvas:cv,_publishedMachinery:true,_machineryLevel:args[1]||1};if(type==='butchery')placeButcheryBlock(c,out,k);c.save();c.scale(k,k);paint(c,out,type);c.restore();M.cache.set(s.canvas,out);return out};
 // These offsets are shared by the painted work surfaces and their contacts.
 const ovenMouthY=-5.5;
 const dough={x:15.5,y:-8};
 const mash={x:7,y:-8,w:13};
 const peelTravel=[0,.5,2.5,5,6.5,5,2.5,.5];
 const kneadPress=[0,.25,.65,1,.8,.5,.2,0];
 const stirOffsets=[[-1,-.5],[-.5,-1],[.5,-1],[1,-.5],[1,.5],[.5,1],[-.5,1],[-1,.5]];
 function workBody(actor,cloth,view){
   const source=personSprite({...actor,_exactYardPose:true},view,'idle',0,{});
   let body=yardBodies.get(source);
   if(body)return body;
   body=mkCanvas(source.width,source.height);
   const c=body.getContext('2d',{willReadFrequently:true});
   c.drawImage(source,0,0);
   fpaCleanAtlasArms(body,actor,view,'yardGrip',0);
   // The idle profile has a wrist tucked inside the front of the coat.
   // Replace that strip before laying either working sleeve over the torso.
   c.scale(body.width/PW,body.height/PH);
   c.translate(PFX,PFY);
   if(view!=='E'||actor.type==='butcher'||actor.type==='tanner'){
     c.clearRect(-13,-15,26,10);
     fpaSowPolygon(c,[[-5.5,-14.5],[-2.5,-15],[4.5,-14],[5.5,-10],[4.5,-5],[-4.5,-5],[-5.5,-8]],'#352722');
     fpaSowPolygon(c,[[-4.5,-14],[-2,-14.5],[4,-13.5],[4.5,-10],[3.8,-6],[-4,-6],[-5,-8.5]],shade(cloth,-.2));
     fpaSowPolygon(c,[[-4.5,-13],[1.5,-13.5],[3.5,-12],[3.5,-9],[-4,-9]],cloth);
     fpaSowBand(c,[-4,-8],[3.5,-8],1,'#765438');
     fpaSowBand(c,[0,-7],[3.5,-7],1,'#503c30');
   }else{
     c.clearRect(-13,-15,11,9);
     fpaSowPolygon(c,[[-5.5,-15],[-2,-15],[-2,-6],[-4.5,-6],[-5.5,-8]],'#352722');
     fpaSowPolygon(c,[[-4.5,-14.5],[-2,-14.5],[-2,-7],[-4,-7],[-5,-8.5]],shade(cloth,-.2));
     fpaSowPolygon(c,[[-4.5,-13],[-2,-13.5],[-2,-9],[-4,-9]],cloth);
     fpaSowBand(c,[-4.5,-8],[-2,-8],.7,'#715039');
   }
   yardBodies.set(source,body);
   return body;
 }
 function workScene(c,actor,x,y,paintPose,lean=0,face=1,view='E'){
   const outfit=OUTFIT[actor.type],look=lookOf({...actor,look:LOOK_POOL[(actor.look>>>0)%LOOK_POOL.length]});
   const cloth=outfit.coat||look.green,body=workBody(actor,cloth,view),scale=YARD_K*FantasyPublishedYard.scale;
   c.save();
   c.imageSmoothingEnabled=false;
   c.translate(x,y);
   if(face<0)c.scale(-1,1);
   const left=-PFX*scale,top=-PFY*scale,width=PW*scale,height=PH*scale;
   if(lean){
     const pivot=PFY-5,split=body.height*pivot/PH;
     c.save();
     c.transform(1,0,-lean/12,1,-lean*5*scale/12,0);
     c.drawImage(body,0,0,body.width,split,left,top,width,pivot*scale);
     c.restore();
     c.drawImage(body,0,split,body.width,body.height-split,left,-5*scale,width,height-pivot*scale);
   }else c.drawImage(body,left,top,width,height);
   paintPose(cloth,SKINS[look.skin%SKINS.length]);
   c.restore();
 }
 function workSleeve(c,shoulder,grip,cloth){
   const elbow=[(shoulder[0]+grip[0])*.5-.45,(shoulder[1]+grip[1])*.5+1.05];
   for(const [from,to,width] of [[shoulder,elbow,2.8],[elbow,grip,2.4]]){
     fpaSowBand(c,from,to,width,'#352722');
     fpaSowBand(c,from,to,width-1,cloth);
   }
 }
 function workHands(c,near,far,skin){
   for(const [grip,fill] of [[far,skin[1]],[near,skin[0]]]){
     const [x,y]=grip;
     fpaSowPolygon(c,[[x-1.1,y-.7],[x+.7,y-1.1],[x+1.2,y-.2],
       [x+.9,y+1],[x-.9,y+1]],'#5f4132');
     r(c,x-.65,y-.6,1.4,1.15,fill);
   }
 }
 function drawPeelCycle(c,b,x,y,t){
   const actor={type:'baker',look:b.id*53+2};
   const phase=Math.floor(t*5)%peelTravel.length,slide=peelTravel[phase];
   const footX=x-15,footY=y+1;
   workScene(c,actor,footX,footY,(cloth,skin)=>{
     const shaftY=ovenMouthY-1.7;
     const near=[2.6+slide*.43,shaftY],far=[near[0]+2.5,shaftY];
     const blade=8.5+slide;
     workSleeve(c,[1.6,-8.1],far,shade(cloth,-.23));
     workSleeve(c,[-1.1,-7.7],near,cloth);
     c.save();
     // The far edge of the oven mouth hides the inserted part of the peel.
     c.beginPath();c.rect(-6,-13,21.5,13);c.clip();
     fpaSowBand(c,[blade-12,shaftY],[blade-1,shaftY],1.25,'#513722');
     fpaSowBand(c,[blade-12,shaftY-.2],[blade-1,shaftY-.2],.5,'#d4a266');
     fpaSowPolygon(c,[[blade-2,-7.8],[blade+.7,-8.4],[blade+2.3,-7.5],
       [blade+2,-6.6],[blade-.8,-6.4]],'#c4ab7c');
     ln(c,blade-.6,-6.5,blade+1.9,-6.5,'#76573a');
     if(phase<4){
       oval(c,blade+.2,-8.7,1.8,1.2,'#e5ce9a');
       ln(c,blade-.45,-9.4,blade+.55,-8.85,'#ad7a42');
     }
     c.restore();
     workHands(c,near,far,skin);
   });
 }
 function drawKneadCycle(c,b,x,y,t){
   const actor={type:'baker',look:b.id*53+7};
   const press=kneadPress[Math.floor(t*6)%kneadPress.length];
   const shift=(1-press)*1.8,lean=press*1.15;
   const footX=x+dough.x-6,footY=y-1;
   workScene(c,actor,footX,footY,(cloth,skin)=>{
     const near=[4.7+press*.65,-8.1-shift],far=[6.8+press*.45,-8.5-shift*.75];
     oval(c,6,dough.y+1,3.8+press*.45,1.35-press*.3,'#b99563');
     oval(c,5.8,dough.y+.7,3.1+press*.4,1.05-press*.22,'#e7d3a7');
     r(c,5.2,dough.y+.2,2,.5,'#f5e6c2');
     workSleeve(c,[1.6+lean*.45,-8.1],far,shade(cloth,-.23));
     workSleeve(c,[-1.1+lean*.45,-7.7],near,cloth);
     workHands(c,near,far,skin);
   },lean);
 }
 function drawMashCycle(c,b,x,y,t){
   const actor={type:'brewer',look:b.id*37+3};
   const [dx,dy]=stirOffsets[Math.floor(t*4)%stirOffsets.length];
   workScene(c,actor,x,y,(cloth,skin)=>{
     const tip=[mash.x+dx,mash.y+dy*.45],top=[1.1-dx*.7,-14.5-dy*.6];
     const grip=f=>[top[0]+(tip[0]-top[0])*f,top[1]+(tip[1]-top[1])*f];
     const near=grip(.33),far=grip(.63);
     workSleeve(c,[1.6,-8],far,shade(cloth,-.23));
     workSleeve(c,[-.8,-7.7],near,cloth);
     fpaSowBand(c,top,tip,1.15,'#503525');
     fpaSowBand(c,[top[0]+.2,top[1]],[tip[0]+.2,tip[1]],.5,'#cfaa6a');
     fpaSowBand(c,grip(.85),tip,1.4,'#b48a53');
     r(c,tip[0]+.7,tip[1],1,.5,'#e8cd8f');
     r(c,tip[0]-1.5,tip[1]+.45,.5,.5,'#d6b576');
     workHands(c,near,far,skin);
     ln(c,mash.x-3.5,mash.y+1.3,mash.x+3.5,mash.y+1.3,'#9c743e');
   });
 }
 const cleaverSwing=[.4,-.35,-1.15,-.68,0,0,0,.28];
 const leatherStroke=[0,.15,.4,.78,1,.76,.4,.15];
 function drawCleaverCycle(c,b,block,butcher,t){
   const face=butcher[0]<block[0]?1:-1;
   const contact=[block[0]+2,block[1]-.65];
   const x=contact[0]-face*8,y=contact[1]+8.5;
   const actor={type:'butcher',look:b.id*47+1};
   const angle=cleaverSwing[Math.floor(t*7)%cleaverSwing.length];
   const rise=Math.max(0,-angle),near=[3.2-rise*.85,-9.8-rise*1.25];
   const cos=Math.cos(angle),sin=Math.sin(angle);
   const at=(u,v)=>[near[0]+u*cos-v*sin,near[1]+u*sin+v*cos];
   const far=at(1.8,0);
   workScene(c,actor,x,y,(cloth,skin)=>{
     workSleeve(c,[1.6,-8.1],far,shade(cloth,-.23));
     workSleeve(c,[-1.1,-7.7],near,cloth);
     fpaSowBand(c,at(-1.7,0),at(3.1,0),1.15,'#4c3224');
     fpaSowBand(c,at(-1.7,-.25),at(2.8,-.25),.5,'#c99d68');
     fpaSowPolygon(c,[at(2.55,-1.7),at(4.55,-2.4),at(5.55,-1.35),
       at(5.25,.7),at(4.8,1.3),at(2.55,1)],'#343738');
     fpaSowPolygon(c,[at(3,-1.35),at(4.55,-1.9),at(5.05,-1.1),
       at(4.8,.65),at(3,1)],'#87998f');
     fpaSowBand(c,at(3.3,.75),at(4.8,1.05),.55,'#e1e0ba');
     fpaSowBand(c,at(2.85,-.6),at(2.85,.7),.55,'#a77d50');
     workHands(c,near,far,skin);
   },0,face);
 }
 function tanneryBench(s){return [s.padx+s.fw*.78-17,s.baseY-8];}
 function drawLeatherCycle(c,b,s,ox,oy){
   const [benchX,benchY]=tanneryBench(s);
   const worker=b.worker,actor={type:'tanner',look:worker?.look??b.id*43+1,sx:worker?personSex(worker):''};
   const action=worker?.action;
   const elapsed=action?.T?Math.max(0,action.T-action.t):Game.time+b.id*.31;
   const press=leatherStroke[Math.floor(elapsed*7)%leatherStroke.length];
   const lean=.65*press;
   const x=ox+benchX-6.3,y=oy+benchY+8.5;
   workScene(c,actor,x,y,(cloth,skin)=>{
     const u=3.4+press*1.35,v=-9+press*.35;
     const near=[u,v],far=[u+1.9,v-.5];
     workSleeve(c,[1.6+lean*.45,-8.1],far,shade(cloth,-.23));
     workSleeve(c,[-1.1+lean*.45,-7.7],near,cloth);
     fpaSowBand(c,[u-.95,v+.3],[u+3.6,v-1.05],1.1,'#513b28');
     fpaSowBand(c,[u-1,v+.1],[u+3.5,v-1.25],.5,'#c19255');
     fpaSowPolygon(c,[[u+2.65,v-2.3],[u+4.6,v-2.15],[u+4.3,v-.65],
       [u+2.85,v+.25],[u+2.1,v+.15]],'#48534d');
     fpaSowPolygon(c,[[u+2.8,v-1.9],[u+4.25,v-1.8],[u+4.05,v-.85],[u+2.7,v-.05]],'#899b91');
     fpaSowBand(c,[u+2.85,v+.08],[u+4.15,v-.68],.55,'#e2dfbd');
     workHands(c,near,far,skin);
   },lean);
 }
 const washTilt=[0,-.55,-1,-.6,0,.6,1,.55];
 function goldWashBench([x,y]){return [x+3,y-6];}
 function drawGoldWashCycle(c,b,x,y,t){
   const actor={type:'miner',look:b.id*71+9},[bx,by]=goldWashBench([x,y]),foot=5.5;
   const rock=washTilt[Math.floor(t*7)%washTilt.length],angle=rock*.18;
   const cs=Math.cos(angle),sn=Math.sin(angle);
   const at=(u,v)=>[u*cs-v*sn,u*sn+v*cs-foot-.75];
   const circle=(rx,ry,dy)=>Array.from({length:16},(_,i)=>{
     const a=i*Math.PI/8;
     return at(Math.cos(a)*rx,Math.sin(a)*ry+dy);
   });
   workScene(c,actor,bx,by+foot,(cloth,skin)=>{
     beam(c,-8,-foot,16,2);
     const left=at(-4.4,.35),right=at(4.4,.35);
     workSleeve(c,[-2.45,-7.4],left,shade(cloth,-.18));
     workSleeve(c,[2.45,-7.4],right,cloth);
     fpaSowPolygon(c,circle(5.2,1.9,.55),'#363c38');
     fpaSowPolygon(c,circle(5.15,1.8,0),'#727d74');
     fpaSowPolygon(c,circle(4.5,1.4,-.1),'#c8c5a8');
     fpaSowPolygon(c,circle(3.9,1.05,-.02),'#36535b');
     fpaSowPolygon(c,circle(3.65,.75,.12),'#679399');
     fpaSowBand(c,at(-2.75+rock*.35,-.2),at(.4+rock*.35,-.22),.55,'#a6c7ba');
     fpaSowBand(c,at(.5+rock*.5,.46),at(2.75+rock*.5,.35),.5,'#c9dad0');
     for(const [u,v] of [[-.65,.42],[.5,.2],[1.65,.54]]){
       const a=u+rock*.65;
       fpaSowPolygon(c,[at(a-.35,v),at(a,v-.3),at(a+.45,v-.04),
         at(a+.2,v+.25),at(a-.2,v+.28)],'#e7b254');
       fpaSowBand(c,at(a-.18,v-.2),at(a+.22,v-.21),.5,'#f6dc83');
     }
     workHands(c,left,right,skin);
   },0,1,'S');
 }
 drawFoodYard=function(c,b,s,ox,oy){
   const P=s.pt,t=Game.time+b.id*5;
   if(b.state!=='done'||!P)return M.native.drawFoodYard(c,b,s,ox,oy);
   if(s.px==='bakery'&&s._publishedMachinery){
     M.native.drawFoodYard(c,b,{...s,pt:{...P,baker:null,knead:null}},ox,oy);
     if(P.oven&&P.baker)drawPeelCycle(c,b,ox+P.oven[0],oy+P.oven[1],t);
     if(P.knead)drawKneadCycle(c,b,ox+P.knead[0],oy+P.knead[1],t);
   }else if(s.px==='butchery'&&s._publishedMachinery&&P.block&&P.butcher){
     const world=([x,y])=>[ox+x,oy+y];
     drawCleaverCycle(c,b,world(P.block),world(P.butcher),t);
     M.native.drawFoodYard(c,b,{...s,pt:{...P,butcher:null}},ox,oy);
   }else if(s.px==='goldmine'&&s._publishedMachinery&&P.panner){
     M.native.drawFoodYard(c,b,{...s,pt:{...P,panner:null}},ox,oy);
     drawGoldWashCycle(c,b,ox+P.panner[0],oy+P.panner[1],t);
   }else if(s.px==='brewery'&&s._publishedMachinery&&b.working&&P.brewer){
     M.native.drawFoodYard(c,b,{...s,pt:{...P,brewer:null}},ox,oy);
     drawMashCycle(c,b,ox+P.brewer[0],oy+P.brewer[1],t);
   }else M.native.drawFoodYard(c,b,s,ox,oy);
 };
 // The existing small window actor keeps the same hand motion; its material is now visible.
 drawInsideLife=function(c,b,s,ox,oy){M.native.drawInsideLife(c,b,s,ox,oy);if(b.type==='tannery'&&s._publishedMachinery&&b.state==='done'&&b.working)drawLeatherCycle(c,b,s,ox,oy);if(!types.has(b.type)||(!b.working&&!(INS_CNT.get(b)||0)))return;const wins=s.wins||[],n=Math.min(wins.length,Math.max(1,b.working?1+((INS_CNT.get(b)||0)>1?1:0):Math.min(INS_CNT.get(b)||0,2))),order=wins.map((w,i)=>i).sort((p,q)=>((p*7+b.id*13)%17)-((q*7+b.id*13)%17)||p-q);let shown=0;for(const i of order){const[wx,wy,ww,wh,round]=wins[i];if(ww<5)continue;if(shown++>=n)break;const x=ox+wx,y=oy+wy,ph=i*1.7+b.id,sx=x+Math.sin(Game.time*.9+ph)*ww*.16;c.save();c.beginPath();if(round)c.arc(x,y,Math.min(ww,wh)/2,0,Math.PI*2);else c.rect(x-ww/2,y-wh/2,ww,wh);c.clip();if(['metallurgist','smeltery','weaponsmith','armory'].includes(b.type)){poly(c,[[sx,y+2.5],[sx+4,y+2.5],[sx+3,y+3.5],[sx+1,y+3.5]],P.steel);r(c,sx+1.5,y+3,1.5,2,P.iron);r(c,sx+2,y+2,1,.5,'#e4b96a')}else if(['brewery','mill','bakery','hopfarm','magicworkshop'].includes(b.type)){oval(c,sx+2,y+3.5,2.5,1.2,P.wood);oval(c,sx+2,y+3,2.3,.6,'#c5b27c')}else{r(c,sx-.5,y+3.5,5,.8,P.wood);r(c,sx,y+3.5,4,.5,P.hi);r(c,sx+2,y+3,1.5,.5,'#c8b88d')}c.restore()}};
})();


